//! PhaseFlag client with local evaluation, background polling,
//! and event batching.
//!
//! All network I/O uses [`reqwest::blocking`] and background work is
//! performed on [`std::thread`] threads -- no async runtime is required.
//!
//! # Example
//!
//! ```no_run
//! use phaseflag::{PhaseFlagClient, PhaseFlagConfig};
//! use std::time::Duration;
//!
//! let client = PhaseFlagClient::new(PhaseFlagConfig {
//!     base_url: "https://api.example.com/api/v1".into(),
//!     api_key: "sdk-key-xxx".into(),
//!     ..Default::default()
//! });
//!
//! client.start().expect("failed to start");
//! assert!(client.wait_until_ready(Duration::from_secs(5)));
//!
//! let dark_mode = client.get_boolean_value("dark-mode", false, None);
//!
//! client.stop();
//! ```

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use parking_lot::{Mutex, RwLock};
use reqwest::blocking::Client as HttpClient;

use crate::evaluator;
use crate::models::{
    EvaluationContext, EvaluationEvent, EvaluationResult, FlagDefinition, PhaseFlagConfig,
};

// ---------------------------------------------------------------------------
// API response helpers
// ---------------------------------------------------------------------------

/// Shape of the `GET /sdk/ruleset` response.
#[derive(serde::Deserialize)]
struct RulesetResponse {
    #[serde(default)]
    flags: Vec<FlagDefinition>,
}

/// Payload sent to `POST /sdk/events`.
#[derive(serde::Serialize)]
struct EventsBatchPayload {
    events: Vec<EvaluationEvent>,
}

/// Payload sent to `POST /evaluate`.
#[derive(serde::Serialize)]
struct EvaluatePayload {
    flag_key: String,
    context: EvaluationContext,
}

/// Shape of the `POST /evaluate` response.
#[derive(serde::Deserialize)]
struct EvaluateResponse {
    flag_key: String,
    variation_id: Option<String>,
    variation_key: Option<String>,
    value: serde_json::Value,
    #[serde(default = "default_reason")]
    reason: String,
}

fn default_reason() -> String {
    "default".into()
}

// ---------------------------------------------------------------------------
// Shared inner state
// ---------------------------------------------------------------------------

/// State shared between the main client handle and background threads.
struct Inner {
    config: PhaseFlagConfig,
    http: HttpClient,

    /// Cached flag definitions keyed by flag key.
    flag_store: RwLock<HashMap<String, FlagDefinition>>,

    /// Buffered evaluation events waiting to be flushed.
    event_queue: Mutex<Vec<EvaluationEvent>>,

    /// Signalled once the first ruleset fetch succeeds.
    ready: AtomicBool,
    ready_condvar: (parking_lot::Mutex<bool>, parking_lot::Condvar),

    /// When set, background threads should exit.
    stop_signal: AtomicBool,
}

impl Inner {
    /// Build the base URL with a trailing-slash stripped.
    fn base_url(&self) -> &str {
        self.config.base_url.trim_end_matches('/')
    }

    /// Fetch the ruleset from `GET /sdk/ruleset` and update the store.
    fn fetch_ruleset(&self) {
        let url = format!("{}/sdk/ruleset", self.base_url());
        let resp = self
            .http
            .get(&url)
            .header("X-API-Key", &self.config.api_key)
            .send();

        let resp = match resp {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[phaseflag] failed to fetch ruleset: {e}");
                return;
            }
        };

        if !resp.status().is_success() {
            eprintln!(
                "[phaseflag] ruleset fetch returned status {}",
                resp.status()
            );
            return;
        }

        let body: RulesetResponse = match resp.json() {
            Ok(b) => b,
            Err(e) => {
                eprintln!("[phaseflag] failed to parse ruleset JSON: {e}");
                return;
            }
        };

        let mut store = self.flag_store.write();
        store.clear();
        for flag in body.flags {
            store.insert(flag.key.clone(), flag);
        }
        drop(store);

        // Mark ready.
        if !self.ready.load(Ordering::Acquire) {
            self.ready.store(true, Ordering::Release);
            let (lock, cvar) = &self.ready_condvar;
            let mut ready = lock.lock();
            *ready = true;
            cvar.notify_all();
        }
    }

    /// Flush queued events to `POST /sdk/events`.
    fn flush_events(&self) -> Result<(), Box<dyn std::error::Error>> {
        let batch = {
            let mut queue = self.event_queue.lock();
            if queue.is_empty() {
                return Ok(());
            }
            std::mem::take(&mut *queue)
        };

        let url = format!("{}/sdk/events", self.base_url());
        let payload = EventsBatchPayload {
            events: batch.clone(),
        };

        let resp = self
            .http
            .post(&url)
            .header("X-API-Key", &self.config.api_key)
            .json(&payload)
            .send();

        match resp {
            Ok(r) if r.status().is_success() => Ok(()),
            Ok(r) => {
                // Re-enqueue on server error so events are not lost.
                let status = r.status();
                self.reenqueue(batch);
                Err(format!("event flush returned status {status}").into())
            }
            Err(e) => {
                self.reenqueue(batch);
                Err(Box::new(e))
            }
        }
    }

    /// Push events back to the front of the queue after a failed flush.
    fn reenqueue(&self, mut events: Vec<EvaluationEvent>) {
        let mut queue = self.event_queue.lock();
        events.append(&mut *queue);
        *queue = events;
    }
}

// ---------------------------------------------------------------------------
// PhaseFlagClient
// ---------------------------------------------------------------------------

/// Feature-flag client with local evaluation, background polling, and
/// event batching.
///
/// Create via [`PhaseFlagClient::new`], call [`start`](Self::start)
/// to begin background operations, and [`stop`](Self::stop) (or simply
/// drop) when finished.
pub struct PhaseFlagClient {
    inner: Arc<Inner>,
    polling_handle: Mutex<Option<thread::JoinHandle<()>>>,
    flush_handle: Mutex<Option<thread::JoinHandle<()>>>,
}

impl PhaseFlagClient {
    /// Create a new client. No network calls are made until
    /// [`start`](Self::start) is called.
    pub fn new(config: PhaseFlagConfig) -> Self {
        let http = HttpClient::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| HttpClient::new());

        let inner = Arc::new(Inner {
            config,
            http,
            flag_store: RwLock::new(HashMap::new()),
            event_queue: Mutex::new(Vec::new()),
            ready: AtomicBool::new(false),
            ready_condvar: (parking_lot::Mutex::new(false), parking_lot::Condvar::new()),
            stop_signal: AtomicBool::new(false),
        });

        Self {
            inner,
            polling_handle: Mutex::new(None),
            flush_handle: Mutex::new(None),
        }
    }

    /// Fetch the initial ruleset synchronously, then spawn background
    /// threads for periodic polling and event flushing.
    pub fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.inner.stop_signal.store(false, Ordering::Release);

        // Synchronous first fetch so the client becomes ready quickly.
        self.inner.fetch_ruleset();

        // Spawn polling thread.
        {
            let inner = Arc::clone(&self.inner);
            let interval = Duration::from_secs(inner.config.polling_interval_secs);
            let handle = thread::Builder::new()
                .name("phaseflag-polling".into())
                .spawn(move || {
                    polling_loop(&inner, interval);
                })?;
            *self.polling_handle.lock() = Some(handle);
        }

        // Spawn event flush thread.
        {
            let inner = Arc::clone(&self.inner);
            let interval = Duration::from_secs(inner.config.event_flush_interval_secs);
            let handle = thread::Builder::new()
                .name("phaseflag-flush".into())
                .spawn(move || {
                    flush_loop(&inner, interval);
                })?;
            *self.flush_handle.lock() = Some(handle);
        }

        Ok(())
    }

    /// Signal background threads to stop and perform a final event flush.
    pub fn stop(&self) {
        self.inner.stop_signal.store(true, Ordering::Release);

        // Wake any condvar waiters in the background threads.
        {
            let (lock, cvar) = &self.inner.ready_condvar;
            let _g = lock.lock();
            cvar.notify_all();
        }

        if let Some(h) = self.polling_handle.lock().take() {
            let _ = h.join();
        }
        if let Some(h) = self.flush_handle.lock().take() {
            let _ = h.join();
        }

        // Final flush -- best effort.
        let _ = self.inner.flush_events();
    }

    /// Block until the first ruleset fetch completes or `timeout` elapses.
    ///
    /// Returns `true` if the client became ready within the timeout.
    pub fn wait_until_ready(&self, timeout: Duration) -> bool {
        if self.inner.ready.load(Ordering::Acquire) {
            return true;
        }
        let (lock, cvar) = &self.inner.ready_condvar;
        let mut ready = lock.lock();
        if *ready {
            return true;
        }
        cvar.wait_for(&mut ready, timeout);
        *ready
    }

    /// Whether the client has successfully fetched at least one ruleset.
    pub fn is_ready(&self) -> bool {
        self.inner.ready.load(Ordering::Acquire)
    }

    // -- Local evaluation -------------------------------------------------

    /// Evaluate a boolean flag locally.
    ///
    /// Returns `default` if the flag is not found or the resolved value
    /// is not a boolean.
    pub fn get_boolean_value(
        &self,
        flag_key: &str,
        default: bool,
        ctx: Option<&EvaluationContext>,
    ) -> bool {
        match self.resolve(flag_key, ctx) {
            Some(r) => r.value.as_bool().unwrap_or(default),
            None => default,
        }
    }

    /// Evaluate a string flag locally.
    ///
    /// Returns `default` if the flag is not found or the resolved value
    /// is not a string.
    pub fn get_string_value(
        &self,
        flag_key: &str,
        default: &str,
        ctx: Option<&EvaluationContext>,
    ) -> String {
        match self.resolve(flag_key, ctx) {
            Some(r) => r
                .value
                .as_str()
                .map(String::from)
                .unwrap_or_else(|| default.to_owned()),
            None => default.to_owned(),
        }
    }

    /// Evaluate a JSON flag locally.
    ///
    /// Returns `default` if the flag is not found.
    pub fn get_json_value(
        &self,
        flag_key: &str,
        default: serde_json::Value,
        ctx: Option<&EvaluationContext>,
    ) -> serde_json::Value {
        match self.resolve(flag_key, ctx) {
            Some(r) => r.value,
            None => default,
        }
    }

    /// Get the full evaluation result for a flag, or `None` if the flag
    /// is not in the local store.
    pub fn get_variation(
        &self,
        flag_key: &str,
        ctx: Option<&EvaluationContext>,
    ) -> Option<EvaluationResult> {
        self.resolve(flag_key, ctx)
    }

    /// Return all currently loaded flag definitions.
    pub fn get_all_flags(&self) -> Vec<FlagDefinition> {
        self.inner.flag_store.read().values().cloned().collect()
    }

    // -- Remote evaluation ------------------------------------------------

    /// Evaluate a flag server-side via `POST /evaluate`.
    ///
    /// Useful when targeting rules require server-side data that the SDK
    /// does not have locally.
    pub fn evaluate_remote(
        &self,
        flag_key: &str,
        ctx: Option<&EvaluationContext>,
    ) -> Result<EvaluationResult, Box<dyn std::error::Error>> {
        let context = ctx.cloned().unwrap_or_default();
        let url = format!("{}/evaluate", self.inner.base_url());
        let payload = EvaluatePayload {
            flag_key: flag_key.to_owned(),
            context,
        };

        let resp = self
            .inner
            .http
            .post(&url)
            .header("X-API-Key", &self.inner.config.api_key)
            .json(&payload)
            .send()?;

        if !resp.status().is_success() {
            return Err(format!("remote evaluation returned status {}", resp.status()).into());
        }

        let data: EvaluateResponse = resp.json()?;
        Ok(EvaluationResult {
            flag_key: data.flag_key,
            variation_id: data.variation_id,
            variation_key: data.variation_key,
            value: data.value,
            reason: data.reason,
        })
    }

    // -- Event tracking ---------------------------------------------------

    /// Queue an evaluation event for later batched submission.
    ///
    /// Events are flushed automatically on a periodic interval, when the
    /// batch size threshold is reached, or when [`stop`](Self::stop) is
    /// called.
    pub fn track_event(&self, event: EvaluationEvent) {
        let should_flush = {
            let mut queue = self.inner.event_queue.lock();
            queue.push(event);
            queue.len() >= self.inner.config.event_batch_size
        };

        if should_flush {
            let _ = self.inner.flush_events();
        }
    }

    /// Send all queued events to `POST /sdk/events` immediately.
    pub fn flush_events(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.inner.flush_events()
    }

    // -- Internal ---------------------------------------------------------

    /// Resolve a flag locally using the cached ruleset.
    fn resolve(
        &self,
        flag_key: &str,
        ctx: Option<&EvaluationContext>,
    ) -> Option<EvaluationResult> {
        let store = self.inner.flag_store.read();
        let flag = store.get(flag_key)?;
        let default_ctx = EvaluationContext::default();
        let ctx = ctx.unwrap_or(&default_ctx);
        evaluator::evaluate(flag, ctx)
    }
}

// ---------------------------------------------------------------------------
// Drop
// ---------------------------------------------------------------------------

impl Drop for PhaseFlagClient {
    fn drop(&mut self) {
        self.stop();
    }
}

// ---------------------------------------------------------------------------
// Background thread loops
// ---------------------------------------------------------------------------

/// Periodically fetch the ruleset until the stop signal is set.
fn polling_loop(inner: &Inner, interval: Duration) {
    while !inner.stop_signal.load(Ordering::Acquire) {
        thread::sleep(interval);
        if inner.stop_signal.load(Ordering::Acquire) {
            break;
        }
        inner.fetch_ruleset();
    }
}

/// Periodically flush queued events until the stop signal is set.
fn flush_loop(inner: &Inner, interval: Duration) {
    while !inner.stop_signal.load(Ordering::Acquire) {
        thread::sleep(interval);
        if inner.stop_signal.load(Ordering::Acquire) {
            break;
        }
        if let Err(e) = inner.flush_events() {
            eprintln!("[phaseflag] periodic event flush failed: {e}");
        }
    }
}

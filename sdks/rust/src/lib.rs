//! # PhaseFlag Rust SDK
//!
//! A feature-flag client for the [PhaseFlag](https://phaseflag.dev)
//! platform with local evaluation, background polling, and event
//! batching -- all backed by blocking I/O and `std::thread` (no async
//! runtime required).
//!
//! ## Quick start
//!
//! ```no_run
//! use phaseflag::{PhaseFlagClient, PhaseFlagConfig, EvaluationContext};
//! use std::time::Duration;
//!
//! let client = PhaseFlagClient::new(PhaseFlagConfig {
//!     base_url: "https://api.example.com/api/v1".into(),
//!     api_key: "sdk-key-xxx".into(),
//!     ..Default::default()
//! });
//!
//! client.start().expect("failed to start");
//! client.wait_until_ready(Duration::from_secs(5));
//!
//! let ctx = EvaluationContext {
//!     user_id: Some("user-42".into()),
//!     ..Default::default()
//! };
//!
//! if client.get_boolean_value("dark-mode", false, Some(&ctx)) {
//!     println!("dark mode enabled!");
//! }
//!
//! client.stop();
//! ```

pub mod client;
pub mod evaluator;
pub mod models;

pub use client::PhaseFlagClient;
pub use models::*;

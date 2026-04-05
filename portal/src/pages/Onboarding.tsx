/**
 * Onboarding wizard — guides new users from account creation to first flag evaluation.
 *
 * Steps:
 *  1. Create organization
 *  2. Create project (auto-generates dev/staging/prod environments)
 *  3. Choose SDK language
 *  4. Show API key + SDK installation code snippet
 *  5. Create a sample boolean flag with toggle
 *  6. Connection status — polls API for first evaluation event
 *
 * State is persisted to localStorage so the wizard can resume after a page refresh.
 */

import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SDK_SNIPPETS, getSnippetWithKey, type SdkSnippet } from '../data/sdk-snippets';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TOTAL_STEPS = 6;

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

interface OnboardingState {
  step: number;
  orgName: string;
  orgId: string;
  projectName: string;
  projectKey: string;
  apiKey: string;
  sdkId: string;
  flagKey: string;
  flagEnabled: boolean;
  connected: boolean;
}

const STORAGE_KEY = 'pf_onboarding_state';

function loadState(): Partial<OnboardingState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState(state: Partial<OnboardingState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Small reusable UI pieces
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
      {message}
    </div>
  );
}

function CodeBlock({ code, onCopy, copied }: { code: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="relative bg-black/40 rounded-xl p-4">
      <pre className="text-sm text-pf-primary font-mono whitespace-pre-wrap overflow-x-auto pr-16">{code}</pre>
      <button
        onClick={onCopy}
        className="absolute top-3 right-3 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

function PrimaryButton({
  onClick,
  type = 'button',
  disabled = false,
  children,
}: {
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-pf-primary hover:bg-pf-primary-light disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Onboarding() {
  const { token } = useAuth();
  const navigate = useNavigate();

  // Load persisted state
  const persisted = loadState();

  const [step, setStep] = useState<number>(persisted.step ?? 1);
  const [orgName, setOrgName] = useState(persisted.orgName ?? '');
  const [orgId, setOrgId] = useState(persisted.orgId ?? '');
  const [projectName, setProjectName] = useState(persisted.projectName ?? '');
  const [projectKey, setProjectKey] = useState(persisted.projectKey ?? '');
  const [apiKey, setApiKey] = useState(persisted.apiKey ?? token ?? '');
  const [selectedSdk, setSelectedSdk] = useState<SdkSnippet>(
    SDK_SNIPPETS.find((s) => s.id === persisted.sdkId) ?? SDK_SNIPPETS[0],
  );
  const [flagKey, setFlagKey] = useState(persisted.flagKey ?? '');
  const [flagEnabled, setFlagEnabled] = useState(persisted.flagEnabled ?? false);
  const [connected, setConnected] = useState(persisted.connected ?? false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Persist whenever relevant state changes
  useEffect(() => {
    saveState({ step, orgName, orgId, projectName, projectKey, apiKey, sdkId: selectedSdk.id, flagKey, flagEnabled, connected });
  }, [step, orgName, orgId, projectName, projectKey, apiKey, selectedSdk.id, flagKey, flagEnabled, connected]);

  // ---------------------------------------------------------------------------
  // Poll for first evaluation event (step 6)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (step !== 6 || connected) return;

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 30 × 3s = 90 seconds max

    async function poll() {
      if (cancelled || attempts >= MAX_ATTEMPTS) return;
      attempts++;
      try {
        const res = await fetch(`${API_URL}/api/v1/sdk/ruleset`, {
          headers: { 'X-API-Key': apiKey || token || '' },
        });
        if (res.ok) {
          if (!cancelled) setConnected(true);
          return;
        }
      } catch {
        // network error — try again
      }
      if (!cancelled) {
        setTimeout(poll, 3000);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [step, connected, apiKey, token]);

  // ---------------------------------------------------------------------------
  // Clipboard helper
  // ---------------------------------------------------------------------------
  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------
  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Step 1: Create organization
  // ---------------------------------------------------------------------------
  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-org';
      const res = await fetch(`${API_URL}/api/v1/organizations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ slug, name: orgName }),
      });
      if (!res.ok && res.status !== 409) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create organization');
      }
      const data = res.status === 409 ? { slug } : await res.json();
      setOrgId(data.id ?? data.slug ?? slug);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2: Create project
  // ---------------------------------------------------------------------------
  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-project';
      const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-org';

      const res = await fetch(`${API_URL}/api/v1/organizations/${orgSlug}/projects`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ slug, name: projectName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create project');
      }
      const proj = await res.json();
      setProjectKey(proj.slug ?? slug);

      // Create dev/staging/prod environments
      const envs = ['development', 'staging', 'production'];
      for (const env of envs) {
        await fetch(`${API_URL}/api/v1/organizations/${orgSlug}/projects/${proj.slug ?? slug}/environments`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ slug: env, name: env.charAt(0).toUpperCase() + env.slice(1) }),
        }).catch(() => {}); // non-fatal if already exist
      }

      setApiKey(token ?? '');
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 5: Create sample boolean flag
  // ---------------------------------------------------------------------------
  async function handleCreateFlag(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const key = 'my-first-flag';
      const res = await fetch(`${API_URL}/api/v1/flags`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          key,
          name: 'My First Flag',
          flag_type: 'boolean',
          status: 'active',
          description: 'Created during onboarding',
        }),
      });
      if (!res.ok && res.status !== 409) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create flag');
      }
      setFlagKey(key);
      setFlagEnabled(false);
      setStep(6);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create flag');
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleFlag() {
    const newValue = !flagEnabled;
    setFlagEnabled(newValue);
    // Best-effort update — ignore errors
    await fetch(`${API_URL}/api/v1/flags/${flagKey}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: newValue ? 'active' : 'inactive' }),
    }).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Finish
  // ---------------------------------------------------------------------------
  function finish() {
    localStorage.setItem('pf_onboarding_done', '1');
    localStorage.removeItem(STORAGE_KEY);
    navigate('/dashboard');
  }

  const snippet = getSnippetWithKey(selectedSdk, apiKey);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0F1A20] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Skip link */}
        <div className="flex justify-end mb-6">
          <button
            onClick={finish}
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Skip setup →
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-10">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  s < step
                    ? 'bg-pf-primary text-white'
                    : s === step
                    ? 'bg-pf-primary/30 border-2 border-pf-primary text-pf-primary'
                    : 'bg-white/10 text-white/30'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
              {s < TOTAL_STEPS && (
                <div className={`w-8 h-0.5 ${s < step ? 'bg-pf-primary' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Create organization ────────────────────────────────── */}
        {step === 1 && (
          <form
            onSubmit={handleCreateOrg}
            className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6"
          >
            <div>
              <h2 className="text-2xl font-bold text-white">Create your organization</h2>
              <p className="text-white/50 mt-1">
                An organization is the top-level container for all your projects and flags.
              </p>
            </div>
            <ErrorBanner message={error} />
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Organization name</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pf-primary transition-colors"
                placeholder="Acme Corp"
              />
            </div>
            <PrimaryButton type="submit" disabled={isLoading}>
              {isLoading ? 'Creating…' : 'Create organization →'}
            </PrimaryButton>
          </form>
        )}

        {/* ── Step 2: Create project ─────────────────────────────────────── */}
        {step === 2 && (
          <form
            onSubmit={handleCreateProject}
            className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6"
          >
            <div>
              <h2 className="text-2xl font-bold text-white">Create your first project</h2>
              <p className="text-white/50 mt-1">
                A project organizes your flags. We'll auto-create{' '}
                <span className="text-pf-primary">dev / staging / prod</span> environments for you.
              </p>
            </div>
            <ErrorBanner message={error} />
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Project name</label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pf-primary transition-colors"
                placeholder="My App"
              />
            </div>
            <PrimaryButton type="submit" disabled={isLoading}>
              {isLoading ? 'Creating…' : 'Create project →'}
            </PrimaryButton>
          </form>
        )}

        {/* ── Step 3: Choose SDK ─────────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Choose your SDK</h2>
              <p className="text-white/50 mt-1">
                Project <span className="text-pf-primary font-mono">{projectKey}</span> is ready. Pick
                your language.
              </p>
            </div>
            <div className="space-y-2">
              {SDK_SNIPPETS.map((sdk) => (
                <button
                  key={sdk.id}
                  onClick={() => setSelectedSdk(sdk)}
                  className={`w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
                    selectedSdk.id === sdk.id
                      ? 'border-pf-primary bg-pf-primary/10 text-white'
                      : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      selectedSdk.id === sdk.id ? 'bg-pf-primary text-white' : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {sdk.icon}
                  </span>
                  {sdk.label}
                </button>
              ))}
            </div>
            <div className="bg-black/30 rounded-xl p-4">
              <p className="text-white/40 text-xs mb-2">Install</p>
              <code className="text-pf-primary text-sm font-mono">{selectedSdk.install}</code>
            </div>
            <PrimaryButton onClick={() => setStep(4)}>Next →</PrimaryButton>
          </div>
        )}

        {/* ── Step 4: API key + initialization snippet ───────────────────── */}
        {step === 4 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Initialize the SDK</h2>
              <p className="text-white/50 mt-1">Copy your API key and initialization snippet.</p>
            </div>

            {/* API key display */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Your API key</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-black/40 rounded-xl px-4 py-3 text-pf-primary font-mono text-sm truncate">
                  {apiKey || token || 'YOUR_API_KEY'}
                </code>
                <button
                  onClick={() => copyText(apiKey || token || '', 'apikey')}
                  className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors flex-shrink-0"
                >
                  {copied === 'apikey' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-white/70 mb-1.5">Initialization</p>
              <CodeBlock
                code={snippet.init}
                onCopy={() => copyText(snippet.init, 'init')}
                copied={copied === 'init'}
              />
            </div>

            <PrimaryButton onClick={() => setStep(5)}>Next →</PrimaryButton>
          </div>
        )}

        {/* ── Step 5: Create sample boolean flag ────────────────────────── */}
        {step === 5 && (
          <form
            onSubmit={handleCreateFlag}
            className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6"
          >
            <div>
              <h2 className="text-2xl font-bold text-white">Create your first flag</h2>
              <p className="text-white/50 mt-1">
                We'll create a boolean flag called{' '}
                <span className="text-pf-primary font-mono">my-first-flag</span> so you can test the
                integration.
              </p>
            </div>
            <ErrorBanner message={error} />

            {/* Evaluate snippet preview */}
            <div>
              <p className="text-sm font-medium text-white/70 mb-1.5">Evaluate the flag in your code</p>
              <CodeBlock
                code={snippet.evaluate}
                onCopy={() => copyText(snippet.evaluate, 'eval')}
                copied={copied === 'eval'}
              />
            </div>

            <PrimaryButton type="submit" disabled={isLoading}>
              {isLoading ? 'Creating…' : 'Create flag →'}
            </PrimaryButton>
          </form>
        )}

        {/* ── Step 5b: Flag created — toggle preview (shown after creation) */}
        {step === 5 && flagKey && (
          <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium font-mono">{flagKey}</p>
                <p className="text-white/40 text-sm mt-0.5">Boolean flag</p>
              </div>
              <button
                onClick={toggleFlag}
                className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none ${
                  flagEnabled ? 'bg-pf-primary' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    flagEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 6: Connection status ──────────────────────────────────── */}
        {step === 6 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {connected ? 'Connected!' : 'Waiting for connection…'}
              </h2>
              <p className="text-white/50 mt-1">
                {connected
                  ? 'Phase Flag can reach your API. You\'re all set!'
                  : 'Call the SDK in your app, then come back here. We\'ll detect the connection automatically.'}
              </p>
            </div>

            {/* Flag toggle */}
            {flagKey && (
              <div className="bg-black/20 rounded-xl p-5 space-y-3">
                <p className="text-white/60 text-sm">Toggle your flag to see it in action:</p>
                <div className="flex items-center justify-between">
                  <span className="text-white font-mono text-sm">{flagKey}</span>
                  <button
                    onClick={toggleFlag}
                    className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none ${
                      flagEnabled ? 'bg-pf-primary' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        flagEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-white/40 text-xs">
                  Status: <span className={flagEnabled ? 'text-pf-primary' : 'text-white/40'}>{flagEnabled ? 'ON' : 'OFF'}</span>
                </p>
              </div>
            )}

            {/* Connection indicator */}
            <div
              className={`flex items-center gap-3 rounded-xl px-5 py-4 border ${
                connected
                  ? 'border-pf-primary/30 bg-pf-primary/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              {connected ? (
                <span className="w-3 h-3 rounded-full bg-pf-primary flex-shrink-0" />
              ) : (
                <span className="w-3 h-3 rounded-full bg-white/30 flex-shrink-0 animate-pulse" />
              )}
              <span className={`text-sm ${connected ? 'text-pf-primary' : 'text-white/50'}`}>
                {connected ? 'API reachable — connection verified' : 'Polling API every 3 seconds…'}
              </span>
            </div>

            <PrimaryButton onClick={finish}>
              {connected ? 'Go to dashboard →' : 'Skip to dashboard →'}
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}

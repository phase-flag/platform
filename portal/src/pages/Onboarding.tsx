import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SDK_OPTIONS = [
  { id: 'js', label: 'JavaScript / TypeScript', install: 'npm install @phaseflag/js-sdk', init: `import { PhaseFlagClient } from '@phaseflag/js-sdk';\nconst client = new PhaseFlagClient({ apiKey: 'YOUR_API_KEY' });\nawait client.init();` },
  { id: 'python', label: 'Python', install: 'pip install phaseflag-sdk', init: `from phaseflag import PhaseFlagClient\nclient = PhaseFlagClient(api_key='YOUR_API_KEY')\nclient.init()` },
  { id: 'go', label: 'Go', install: 'go get github.com/phaseflag/go-sdk', init: `client := phaseflag.NewClient(phaseflag.Options{\n  APIKey: "YOUR_API_KEY",\n})` },
  { id: 'react', label: 'React', install: 'npm install @phaseflag/react', init: `import { PhaseFlagProvider, useFlag } from '@phaseflag/react';\n// Wrap your app:\n<PhaseFlagProvider apiKey="YOUR_API_KEY">` },
  { id: 'java', label: 'Java', install: 'implementation "io.phaseflag:phaseflag-sdk:1.0.0"', init: `PhaseFlagClient client = new PhaseFlagClient.Builder()\n  .apiKey("YOUR_API_KEY")\n  .build();` },
];

export default function Onboarding() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [projectApiKey, setProjectApiKey] = useState('');
  const [selectedSdk, setSelectedSdk] = useState(SDK_OPTIONS[0]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // First ensure we have a default org — create one if needed
      const orgRes = await fetch(`${API_URL}/api/v1/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ slug: 'default', name: 'My Organization' }),
      });
      let orgSlug = 'default';
      if (!orgRes.ok && orgRes.status !== 409) {
        const err = await orgRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create organization');
      }

      const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const projRes = await fetch(`${API_URL}/api/v1/organizations/${orgSlug}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ slug, name: projectName }),
      });
      if (!projRes.ok) {
        const err = await projRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create project');
      }
      const proj = await projRes.json();
      setProjectKey(proj.slug);
      setProjectApiKey(token || 'YOUR_API_KEY');
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  }

  function copySnippet() {
    const snippet = selectedSdk.init.replace('YOUR_API_KEY', projectApiKey);
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function finish() {
    localStorage.setItem('pf_onboarding_done', '1');
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#0F1A20] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  s <= step ? 'bg-[#34D399] text-[#0F1A20]' : 'bg-white/10 text-white/40'
                }`}
              >
                {s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${s < step ? 'bg-[#34D399]' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Create project */}
        {step === 1 && (
          <form onSubmit={createProject} className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Create your first project</h2>
              <p className="text-white/50 mt-1">A project organizes your feature flags by application.</p>
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Project name</label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#34D399] transition-colors"
                placeholder="My App"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#34D399] hover:bg-[#6EE7B7] disabled:opacity-50 text-[#0F1A20] font-semibold py-3 rounded-xl transition-colors"
            >
              {isLoading ? 'Creating…' : 'Create project →'}
            </button>
          </form>
        )}

        {/* Step 2: Choose SDK */}
        {step === 2 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Choose your SDK</h2>
              <p className="text-white/50 mt-1">Project <span className="text-[#34D399] font-mono">{projectKey}</span> created.</p>
            </div>
            <div className="space-y-2">
              {SDK_OPTIONS.map((sdk) => (
                <button
                  key={sdk.id}
                  onClick={() => setSelectedSdk(sdk)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    selectedSdk.id === sdk.id
                      ? 'border-[#34D399] bg-[#34D399]/10 text-white'
                      : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {sdk.label}
                </button>
              ))}
            </div>
            <div className="bg-black/30 rounded-xl p-4">
              <p className="text-white/40 text-xs mb-2">Install</p>
              <code className="text-[#34D399] text-sm font-mono">{selectedSdk.install}</code>
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full bg-[#34D399] hover:bg-[#6EE7B7] text-[#0F1A20] font-semibold py-3 rounded-xl transition-colors"
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 3: Copy snippet */}
        {step === 3 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Copy your initialization snippet</h2>
              <p className="text-white/50 mt-1">Paste this into your application to start using Phase Flag.</p>
            </div>
            <div className="relative bg-black/40 rounded-xl p-4">
              <pre className="text-sm text-[#34D399] font-mono whitespace-pre-wrap overflow-x-auto">
                {selectedSdk.init.replace('YOUR_API_KEY', projectApiKey)}
              </pre>
              <button
                onClick={copySnippet}
                className="absolute top-3 right-3 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <button
              onClick={finish}
              className="w-full bg-[#34D399] hover:bg-[#6EE7B7] text-[#0F1A20] font-semibold py-3 rounded-xl transition-colors"
            >
              Go to dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

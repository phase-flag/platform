import { useState } from 'react';

interface Flag {
  key: string;
  name: string;
  type: 'boolean' | 'string' | 'number' | 'json';
  enabled: boolean;
  defaultValue: string;
  description: string;
  tags: string[];
}

const initialFlags: Flag[] = [
  {
    key: 'dark_mode',
    name: 'Dark Mode',
    type: 'boolean',
    enabled: true,
    defaultValue: 'true',
    description: 'Enable dark mode for the application UI',
    tags: ['ui', 'release'],
  },
  {
    key: 'new_checkout',
    name: 'New Checkout Flow',
    type: 'boolean',
    enabled: false,
    defaultValue: 'false',
    description: 'Redesigned checkout experience with one-click purchase',
    tags: ['release', 'checkout'],
  },
  {
    key: 'banner_text',
    name: 'Promo Banner Text',
    type: 'string',
    enabled: true,
    defaultValue: '"Free shipping on orders over $50"',
    description: 'Text displayed in the promotional banner',
    tags: ['marketing', 'remote-config'],
  },
];

export default function FlagSimulator() {
  const [flags, setFlags] = useState<Flag[]>(initialFlags);
  const [newFlagKey, setNewFlagKey] = useState('');
  const [newFlagName, setNewFlagName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const toggleFlag = (key: string) => {
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const createFlag = () => {
    if (!newFlagKey.trim() || !newFlagName.trim()) return;
    const flag: Flag = {
      key: newFlagKey.toLowerCase().replace(/\s+/g, '_'),
      name: newFlagName,
      type: 'boolean',
      enabled: false,
      defaultValue: 'false',
      description: 'A new feature flag',
      tags: ['release'],
    };
    setFlags((prev) => [...prev, flag]);
    setNewFlagKey('');
    setNewFlagName('');
    setShowCreate(false);
  };

  const deleteFlag = (key: string) => {
    setFlags((prev) => prev.filter((f) => f.key !== key));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-light uppercase tracking-wider text-[#E8F0F2]">
          Feature Flags
        </h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 text-sm font-medium text-white bg-pf-primary rounded-lg hover:bg-pf-primary-light transition-colors"
        >
          + Create Flag
        </button>
      </div>

      {showCreate && (
        <div className="bg-[#111827] border border-[rgba(99,102,241,0.15)] rounded-xl p-4 animate-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              placeholder="Flag key (e.g. new_feature)"
              value={newFlagKey}
              onChange={(e) => setNewFlagKey(e.target.value)}
              className="px-3 py-2 text-sm bg-[#1E1B4B] text-[#E8F0F2] border border-[rgba(99,102,241,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-pf-primary/50 focus:border-pf-primary placeholder-[#8FA3AD]"
            />
            <input
              type="text"
              placeholder="Display name"
              value={newFlagName}
              onChange={(e) => setNewFlagName(e.target.value)}
              className="px-3 py-2 text-sm bg-[#1E1B4B] text-[#E8F0F2] border border-[rgba(99,102,241,0.15)] rounded-lg focus:outline-none focus:ring-2 focus:ring-pf-primary/50 focus:border-pf-primary placeholder-[#8FA3AD]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createFlag}
              className="px-4 py-2 text-sm font-medium text-white bg-pf-primary rounded-lg hover:bg-pf-primary-light transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm font-medium text-[#8FA3AD] bg-[#1E1B4B] border border-[rgba(99,102,241,0.15)] rounded-lg hover:bg-[#252B4B] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {flags.map((flag) => (
          <div
            key={flag.key}
            className="bg-[#111827] border border-[rgba(99,102,241,0.15)] rounded-xl p-4 hover:border-pf-primary/30 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-[#E8F0F2] truncate">{flag.name}</h4>
                  <code className="text-xs bg-[#1E1B4B] text-[#8FA3AD] px-1.5 py-0.5 rounded">
                    {flag.key}
                  </code>
                </div>
                <p className="text-sm text-[#8FA3AD] mb-2">{flag.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    flag.type === 'boolean'
                      ? 'bg-blue-900/30 text-blue-400'
                      : flag.type === 'string'
                        ? 'bg-purple-900/30 text-purple-400'
                        : 'bg-orange-900/30 text-orange-400'
                  }`}>
                    {flag.type}
                  </span>
                  {flag.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[#1E1B4B] text-[#8FA3AD]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => toggleFlag(flag.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors toggle-track ${
                    flag.enabled ? 'bg-pf-success' : 'bg-[#1E1B4B]'
                  }`}
                  role="switch"
                  aria-checked={flag.enabled}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm toggle-thumb ${
                      flag.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <button
                  onClick={() => deleteFlag(flag.key)}
                  className="p-1.5 text-[#8FA3AD] hover:text-pf-danger rounded-lg hover:bg-red-900/20 transition-colors"
                  aria-label="Delete flag"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[rgba(99,102,241,0.15)]">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#8FA3AD]">Evaluation:</span>
                <code className={`px-2 py-0.5 rounded font-mono ${
                  flag.enabled
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-red-900/30 text-red-400'
                }`}>
                  {flag.enabled ? flag.defaultValue : flag.type === 'boolean' ? 'false' : 'null'}
                </code>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                  flag.enabled
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-red-900/30 text-red-400'
                }`}>
                  {flag.enabled ? 'Serving' : 'Off'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

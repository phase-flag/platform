import { useState, useEffect } from 'react';

const CONSENT_KEY = 'pf_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:pb-6 animate-slide-up"
    >
      <div className="max-w-3xl mx-auto bg-[#111827] border border-[rgba(99,102,241,0.2)] rounded-2xl shadow-2xl shadow-black/50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Cookie icon */}
        <div className="shrink-0 w-9 h-9 rounded-xl bg-[rgba(99,102,241,0.1)] flex items-center justify-center">
          <svg
            className="w-5 h-5"
            style={{ color: '#6366F1' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
            />
            <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
            <circle cx="14" cy="14" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
          </svg>
        </div>

        {/* Text */}
        <p className="flex-1 text-sm text-white/65 leading-relaxed">
          We use cookies to improve your experience. By continuing, you agree to our{' '}
          <a
            href="https://phaseflag.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-white"
            style={{ color: '#6366F1' }}
          >
            Privacy Policy
          </a>
          .
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://phaseflag.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            Learn More
          </a>
          <button
            onClick={handleAccept}
            className="px-5 py-2 text-sm font-semibold rounded-xl transition-colors shadow-lg"
            style={{
              background: '#6366F1',
              color: '#FFFFFF',
              boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
            }}
          >
            Accept
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}

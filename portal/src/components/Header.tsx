import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/flags', label: 'Flags' },
  { to: '/evaluation', label: 'Evaluation' },
  { to: '/rollouts', label: 'Rollouts' },
  { to: '/sdks', label: 'SDKs' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-[#0B0F1A]/95 backdrop-blur border-b border-[rgba(99,102,241,0.15)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="font-heading text-xl font-light tracking-widest uppercase text-white">
              PHASE
            </span>
            <svg className="w-[13px] h-[22px]" viewBox="0 0 12 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="10" height="22" rx="5" stroke="#6366F1" strokeWidth="1.4" />
              <circle cx="6" cy="7.5" r="3" stroke="#6366F1" strokeWidth="1.4" />
            </svg>
            <span className="font-heading text-xl font-light tracking-widest uppercase text-white">
              FLAG
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-pf-primary/10 text-pf-primary'
                    : 'text-[#8FA3AD] hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-pf-primary/10 text-pf-primary">
              Interactive Demo
            </span>
            <a
              href="https://phaseflag.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium text-white bg-pf-primary rounded-lg hover:bg-pf-primary-light transition-colors"
            >
              Get Started
            </a>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-[#8FA3AD] hover:bg-white/5"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[rgba(99,102,241,0.15)] bg-[#0B0F1A]">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  location.pathname === link.to
                    ? 'bg-pf-primary/10 text-pf-primary'
                    : 'text-[#8FA3AD] hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://phaseflag.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 mt-2 text-sm font-medium text-center text-white bg-pf-primary rounded-lg"
            >
              Get Started
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

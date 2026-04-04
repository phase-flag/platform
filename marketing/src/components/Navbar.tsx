import { useState, useEffect } from 'react';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#live-demo', label: 'Live Demo' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#compare', label: 'Compare' },
  { href: '#open-source', label: 'Open Source' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0F1A20]/95 backdrop-blur shadow-sm shadow-black/20'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <a href="#" className="flex items-center gap-2 group">
            <span className="font-heading text-xl font-light tracking-widest uppercase text-white">
              PHASE
            </span>
            <svg className="w-[13px] h-[22px]" viewBox="0 0 12 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="10" height="22" rx="5" stroke="#5BBAA7" strokeWidth="1.4" />
              <circle cx="6" cy="7.5" r="3" stroke="#5BBAA7" strokeWidth="1.4" />
            </svg>
            <span className="font-heading text-xl font-light tracking-widest uppercase text-white">
              FLAG
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-lg text-sm font-medium text-pf-text-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <a
              href="https://docs.phaseflag.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium text-pf-text-muted hover:text-white transition-colors"
            >
              Docs
            </a>
            <a
              href="https://github.com/phaseflag"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium text-pf-text-muted hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://app.phaseflag.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 text-sm font-medium text-white bg-pf-mint rounded-xl hover:bg-pf-mint-light transition-colors shadow-lg shadow-pf-mint/20"
            >
              Get Started
            </a>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-lg text-pf-text-muted hover:bg-white/5"
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
        <div className="lg:hidden bg-[#0F1A20] border-t border-[rgba(91,186,167,0.15)] shadow-lg">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-pf-text-muted hover:text-white hover:bg-white/5"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-[rgba(91,186,167,0.15)] space-y-2">
              <a
                href="https://docs.phaseflag.dev"
                className="block px-3 py-2 text-sm font-medium text-pf-text-muted"
              >
                Docs
              </a>
              <a
                href="https://app.phaseflag.dev"
                className="block px-3 py-2.5 text-sm font-medium text-center text-white bg-pf-mint rounded-xl"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

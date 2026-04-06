import { useState, useEffect } from 'react';

const navLinks = [
  { href: '#features',     label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#live-demo',    label: 'Live Demo' },
  { href: '#pricing',      label: 'Pricing' },
  { href: '#compare',      label: 'Compare' },
  { href: '#open-source',  label: 'Open Source' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled ? 'glass-nav' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <a href="#" className="flex items-center gap-1 group">
            <span className="font-heading text-sm font-light tracking-[0.15em] uppercase text-white/80 group-hover:text-white transition-colors">
              PHASE
            </span>
            <svg className="w-[11px] h-[18px]" viewBox="0 0 12 24" fill="none">
              <rect x="1" y="1" width="10" height="22" rx="5" stroke="#6366F1" strokeWidth="1.5"/>
              <circle cx="6" cy="7.5" r="2.8" stroke="#6366F1" strokeWidth="1.5"/>
            </svg>
            <span className="font-heading text-sm font-light tracking-[0.15em] uppercase text-white/80 group-hover:text-white transition-colors">
              FLAG
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-md text-sm text-[#888] hover:text-white hover:bg-white/[0.05] transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-1">
            <a href="https://docs.phaseflag.com" target="_blank" rel="noopener noreferrer"
               className="px-3 py-1.5 text-sm text-[#888] hover:text-white transition-colors">
              Docs
            </a>
            <a href="https://github.com/phase-flag" target="_blank" rel="noopener noreferrer"
               className="px-3 py-1.5 text-sm text-[#888] hover:text-white transition-colors">
              GitHub
            </a>
            <a href="https://app.phaseflag.com" target="_blank" rel="noopener noreferrer"
               className="btn-primary ml-2 px-4 py-2 text-sm rounded-lg">
              Get Started
            </a>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)}
                  className="lg:hidden p-2 rounded-md text-[#888] hover:text-white hover:bg-white/[0.05] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12"/>
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16"/>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden glass-nav border-t border-white/[0.06]">
          <div className="px-4 py-3 space-y-0.5">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                 className="block px-3 py-2.5 rounded-md text-sm text-[#888] hover:text-white hover:bg-white/[0.05] transition-colors">
                {link.label}
              </a>
            ))}
            <div className="pt-3 mt-2 border-t border-white/[0.06]">
              <a href="https://app.phaseflag.com"
                 className="block btn-primary text-center px-4 py-2.5 text-sm rounded-lg">
                Get Started Free
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default function Footer() {
  const columns = [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Compare', href: '#compare' },
        { label: 'Live Demo', href: '#live-demo' },
        { label: 'Changelog', href: 'https://phaseflag.dev/changelog' },
      ],
    },
    {
      title: 'Developers',
      links: [
        { label: 'Documentation', href: 'https://docs.phaseflag.dev' },
        { label: 'API Reference', href: 'https://docs.phaseflag.dev/api' },
        { label: 'SDK Guides', href: 'https://docs.phaseflag.dev/sdks' },
        { label: 'Self-Hosting', href: 'https://docs.phaseflag.dev/self-host' },
        { label: 'OpenFeature', href: 'https://docs.phaseflag.dev/openfeature' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: 'https://phaseflag.dev/about' },
        { label: 'Blog', href: 'https://phaseflag.dev/blog' },
        { label: 'Careers', href: 'https://phaseflag.dev/careers' },
        { label: 'Contact', href: 'mailto:hello@phaseflag.dev' },
      ],
    },
    {
      title: 'Community',
      links: [
        { label: 'GitHub', href: 'https://github.com/phaseflag' },
        { label: 'Discord', href: 'https://discord.gg/phaseflag' },
        { label: 'Twitter', href: 'https://twitter.com/phaseflag' },
        { label: 'Contributing', href: 'https://github.com/phaseflag/phaseflag/blob/main/CONTRIBUTING.md' },
      ],
    },
  ];

  return (
    <footer className="bg-[#0A1218] text-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Logo and description */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-heading text-lg font-light tracking-widest uppercase text-white">
                PHASE
              </span>
              <svg className="w-[11px] h-[18px]" viewBox="0 0 12 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="10" height="22" rx="5" stroke="#5BBAA7" strokeWidth="1.4" />
                <circle cx="6" cy="7.5" r="3" stroke="#5BBAA7" strokeWidth="1.4" />
              </svg>
              <span className="font-heading text-lg font-light tracking-widest uppercase text-white">
                FLAG
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              Open-source feature flag management with intelligent release controls.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://github.com/phaseflag" className="text-white/50 hover:text-pf-mint transition-colors" aria-label="GitHub">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <a href="https://twitter.com/phaseflag" className="text-white/50 hover:text-pf-mint transition-colors" aria-label="Twitter">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://discord.gg/phaseflag" className="text-white/50 hover:text-pf-mint transition-colors" aria-label="Discord">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                </svg>
              </a>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-heading text-xs font-medium uppercase tracking-wider text-white mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="text-sm hover:text-pf-mint transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">&copy; {new Date().getFullYear()} Phase Flag. Apache 2.0 License.</p>
          <div className="flex items-center gap-6 text-sm">
            <a href="https://phaseflag.dev/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-pf-mint transition-colors">Privacy Policy</a>
            <a href="https://phaseflag.dev/terms" target="_blank" rel="noopener noreferrer" className="hover:text-pf-mint transition-colors">Terms of Service</a>
            <a href="https://status.phaseflag.dev" target="_blank" rel="noopener noreferrer" className="hover:text-pf-mint transition-colors">Status</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

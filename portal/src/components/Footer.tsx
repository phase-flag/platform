import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-[#0A1216] text-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-heading text-lg font-light tracking-widest uppercase text-white">
                PHASE
              </span>
              <svg className="w-[11px] h-[18px]" viewBox="0 0 12 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="10" height="22" rx="5" stroke="#6366F1" strokeWidth="1.4" />
                <circle cx="6" cy="7.5" r="3" stroke="#6366F1" strokeWidth="1.4" />
              </svg>
              <span className="font-heading text-lg font-light tracking-widest uppercase text-white">
                FLAG
              </span>
            </div>
            <p className="text-sm leading-relaxed">
              Open-source feature flag management with intelligent release controls.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-sm font-medium uppercase tracking-wider text-white mb-4">
              Demos
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/flags" className="hover:text-pf-primary transition-colors">Flag Management</Link></li>
              <li><Link to="/evaluation" className="hover:text-pf-primary transition-colors">Evaluation Engine</Link></li>
              <li><Link to="/rollouts" className="hover:text-pf-primary transition-colors">Rollout Visualizer</Link></li>
              <li><Link to="/sdks" className="hover:text-pf-primary transition-colors">SDK Integration</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-medium uppercase tracking-wider text-white mb-4">
              Resources
            </h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://docs.phaseflag.dev" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Documentation</a></li>
              <li><a href="https://github.com/phaseflag" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">GitHub</a></li>
              <li><a href="https://phaseflag.dev/blog" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Blog</a></li>
              <li><a href="https://phaseflag.dev/changelog" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Changelog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-medium uppercase tracking-wider text-white mb-4">
              Product
            </h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://phaseflag.dev" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Website</a></li>
              <li><a href="https://phaseflag.dev/pricing" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Pricing</a></li>
              <li><a href="https://phaseflag.dev/enterprise" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Enterprise</a></li>
              <li><a href="https://phaseflag.dev/support" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Support</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">&copy; {new Date().getFullYear()} Hextrot, Inc. (dba Phase Flag). Apache 2.0 License.</p>
          <div className="flex items-center gap-4 text-sm">
            <a href="https://phaseflag.com/terms" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Terms of Service</a>
            <a href="https://phaseflag.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Privacy Policy</a>
            <a href="https://status.phaseflag.com" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Status</a>
            <a href="https://docs.phaseflag.com" target="_blank" rel="noopener noreferrer" className="hover:text-pf-primary transition-colors">Documentation</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

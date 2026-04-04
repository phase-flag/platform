export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 lg:pt-24">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F1A20] via-[#162029] to-[#0F1A20]" />
      <div className="absolute top-20 right-0 w-96 h-96 bg-pf-mint/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-pf-mint/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pf-mint/10 text-pf-mint border border-pf-mint/20 mb-6">
              Open Source -- Apache 2.0
            </span>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-light tracking-tight text-white leading-[1.1] mb-6">
              Feature Flags.<br />
              <span className="text-pf-mint">Reimagined.</span>
            </h1>
            <p className="text-lg lg:text-xl text-pf-text-muted mb-10 max-w-lg leading-relaxed">
              Ship features safely with local evaluation, progressive rollouts,
              built-in experimentation, and 19 SDKs. Self-host or use our cloud.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="https://app.phaseflag.dev"
                className="px-7 py-3.5 text-sm font-medium text-white bg-pf-mint rounded-xl hover:bg-pf-mint-light transition-all shadow-lg shadow-pf-mint/25 hover:shadow-xl hover:shadow-pf-mint/30 hover:-translate-y-0.5"
              >
                Get Started Free
              </a>
              <a
                href="#live-demo"
                className="px-7 py-3.5 text-sm font-medium text-pf-text bg-white/5 border border-[rgba(91,186,167,0.15)] rounded-xl hover:bg-white/10 transition-all hover:-translate-y-0.5 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-pf-mint" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Try Live Demo
              </a>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-pf-text-muted">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-pf-success" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                No credit card
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-pf-success" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                Unlimited flags
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-pf-success" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                Self-host option
              </div>
            </div>
          </div>

          {/* Code preview card */}
          <div className="animate-fade-in-up animate-delay-200 animate-float">
            <div className="bg-pf-dark rounded-2xl shadow-2xl shadow-black/30 overflow-hidden border border-[rgba(91,186,167,0.15)]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-white/40 font-mono">app.tsx</span>
              </div>
              <pre className="p-5 text-sm font-mono leading-relaxed overflow-x-auto">
<span className="text-[#546e7a]">{"// Evaluate in <1ms, right in your app"}</span>{"\n"}
<span className="text-[#c792ea]">import</span> <span className="text-white">{"{ useFlag }"}</span> <span className="text-[#c792ea]">from</span> <span className="text-[#c3e88d]">'@phaseflag/react'</span>{"\n"}
{"\n"}
<span className="text-[#c792ea]">function</span> <span className="text-[#82aaff]">Checkout</span><span className="text-white">() {"{"}</span>{"\n"}
<span className="text-white">{"  "}</span><span className="text-[#c792ea]">const</span> <span className="text-white">useNewFlow</span> <span className="text-[#89ddff]">=</span> <span className="text-[#82aaff]">useFlag</span><span className="text-white">(</span>{"\n"}
<span className="text-white">{"    "}</span><span className="text-[#c3e88d]">'new_checkout'</span><span className="text-white">,</span>{"\n"}
<span className="text-white">{"    "}</span><span className="text-[#f78c6c]">false</span>{"\n"}
<span className="text-white">{"  )"}</span>{"\n"}
{"\n"}
<span className="text-white">{"  "}</span><span className="text-[#c792ea]">return</span> <span className="text-white">useNewFlow</span>{"\n"}
<span className="text-white">{"    ? "}</span><span className="text-[#89ddff]">{"<"}</span><span className="text-[#ffcb6b]">NewCheckout</span> <span className="text-[#89ddff]">/{">"}</span>{"\n"}
<span className="text-white">{"    : "}</span><span className="text-[#89ddff]">{"<"}</span><span className="text-[#ffcb6b]">ClassicCheckout</span> <span className="text-[#89ddff]">/{">"}</span>{"\n"}
<span className="text-white">{"}"}</span>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

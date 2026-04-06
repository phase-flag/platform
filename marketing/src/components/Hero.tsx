export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-16">
      <div className="absolute inset-0 bg-[#0A0A0A]" />

      {/* Very subtle top gradient — neutral, not colored */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium
                            border border-white/10 bg-white/[0.04] text-[#888] mb-8">
              Open Source — Apache 2.0
            </div>

            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight leading-[1.06] text-white mb-6">
              Feature Flags.<br />
              <span className="text-[#888]">Reimagined.</span>
            </h1>

            <p className="text-base text-[#888] leading-relaxed mb-10 max-w-md">
              Ship features safely with sub-millisecond local evaluation,
              progressive rollouts, built-in A/B testing, and 19 SDKs.
              Self-host or cloud.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <a href="https://app.phaseflag.com"
                 className="btn-primary px-6 py-2.5 text-sm rounded-lg">
                Get Started Free
              </a>
              <a href="#live-demo"
                 className="btn-secondary px-6 py-2.5 text-sm rounded-lg flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                See Live Demo
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-[#555]">
              {['No credit card', 'Unlimited flags', 'Self-host option'].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-[#888]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right: code card */}
          <div className="animate-fade-in-up animate-delay-200 animate-float">
            <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{ background: '#111111' }}>
              {/* Terminal chrome */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
                <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                <span className="ml-4 text-xs text-[#444] font-mono">app.tsx</span>
              </div>

              <pre className="px-6 py-5 text-sm font-mono leading-loose overflow-x-auto">
<span className="text-[#555]">{"// Evaluate in <1ms — local, no network calls"}</span>{"\n"}
<span className="text-[#c792ea]">import</span>{" "}
<span className="text-[#EBEBEB]">{"{ useFlag }"}</span>{" "}
<span className="text-[#c792ea]">from</span>{" "}
<span className="text-[#c3e88d]">'@phaseflag/react'</span>{"\n\n"}
<span className="text-[#c792ea]">function</span>{" "}
<span className="text-[#82aaff]">Checkout</span>
<span className="text-[#EBEBEB]">{"() {"}</span>{"\n"}
<span className="text-[#EBEBEB]">{"  "}</span>
<span className="text-[#c792ea]">const</span>{" "}
<span className="text-[#EBEBEB]">newFlow</span>{" "}
<span className="text-[#EBEBEB]">=</span>{" "}
<span className="text-[#82aaff]">useFlag</span>
<span className="text-[#EBEBEB]">{"("}</span>{"\n"}
<span className="text-[#EBEBEB]">{"    "}</span>
<span className="text-[#c3e88d]">'new_checkout'</span>
<span className="text-[#EBEBEB]">{", "}</span>
<span className="text-[#f78c6c]">false</span>{"\n"}
<span className="text-[#EBEBEB]">{"  )"}</span>{"\n\n"}
<span className="text-[#EBEBEB]">{"  "}</span>
<span className="text-[#c792ea]">return</span>{" "}
<span className="text-[#EBEBEB]">newFlow</span>{"\n"}
<span className="text-[#EBEBEB]">{"    ? "}</span>
<span className="text-[#c3e88d]">{"<"}</span>
<span className="text-[#ffcb6b]">NewCheckout</span>{" "}
<span className="text-[#c3e88d]">{"/>"}</span>{"\n"}
<span className="text-[#EBEBEB]">{"    : "}</span>
<span className="text-[#c3e88d]">{"<"}</span>
<span className="text-[#ffcb6b]">ClassicCheckout</span>{" "}
<span className="text-[#c3e88d]">{"/>"}</span>{"\n"}
<span className="text-[#EBEBEB]">{"}"}</span>
              </pre>

              {/* Stats strip */}
              <div className="px-6 py-3.5 border-t border-white/[0.06] flex items-center gap-8">
                {[
                  { label: 'Eval', value: '<1ms' },
                  { label: 'SDKs', value: '19' },
                  { label: 'Uptime', value: '99.99%' },
                ].map(m => (
                  <div key={m.label} className="flex items-center gap-2">
                    <span className="text-[11px] text-[#444] font-mono uppercase">{m.label}</span>
                    <span className="text-sm font-semibold text-[#EBEBEB] font-mono">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0A0A0A] to-transparent pointer-events-none" />
    </section>
  )
}

import TargetingPlayground from '../components/TargetingPlayground';

export default function EvaluationDemo() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-light uppercase tracking-wider text-[#E8F0F2] mb-3">
          Evaluation Engine
        </h1>
        <p className="text-[#8FA3AD] max-w-2xl leading-relaxed">
          Build targeting rules using attributes and operators, then provide a user context to see
          the evaluation result in real time. The trace shows exactly why each rule matched or failed.
        </p>
      </div>

      <TargetingPlayground />

      {/* Operators reference */}
      <div className="mt-10 bg-[#162029] border border-[rgba(99,102,241,0.15)] rounded-2xl p-6">
        <h3 className="font-heading text-sm font-medium uppercase tracking-wider text-[#E8F0F2] mb-4">
          Supported Operators
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { op: 'is', desc: 'Exact match' },
            { op: 'is_not', desc: 'Not equal' },
            { op: 'contains', desc: 'Substring match' },
            { op: 'not_contains', desc: 'No substring' },
            { op: 'one_of', desc: 'In comma list' },
            { op: 'gt', desc: 'Greater than' },
            { op: 'lt', desc: 'Less than' },
            { op: 'matches_regex', desc: 'Regex match' },
          ].map((item) => (
            <div key={item.op} className="bg-[#1C2D38] rounded-lg p-3 border border-[rgba(99,102,241,0.15)]">
              <code className="text-xs font-mono text-pf-primary">{item.op}</code>
              <p className="text-xs text-[#8FA3AD] mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

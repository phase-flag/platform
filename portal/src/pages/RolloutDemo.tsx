import RolloutVisualizer from '../components/RolloutVisualizer';

export default function RolloutDemo() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-light uppercase tracking-wider text-[#E8F0F2] mb-3">
          Rollout Visualizer
        </h1>
        <p className="text-[#8FA3AD] max-w-2xl leading-relaxed">
          See how percentage rollouts work with DJB2 deterministic hashing. Each user is assigned
          a consistent bucket (0-99) based on their ID and the flag key. Drag the slider to control
          what percentage of users see the feature.
        </p>
      </div>

      <RolloutVisualizer />

      {/* DJB2 explanation */}
      <div className="mt-10 bg-pf-dark rounded-2xl p-6">
        <h3 className="font-heading text-sm font-medium uppercase tracking-wider text-white mb-4">
          How DJB2 Hashing Works
        </h3>
        <pre className="text-sm text-white/80 font-mono leading-relaxed overflow-x-auto">
{`function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

// User's bucket = djb2Hash(flagKey + ":" + userId) % 100
// If bucket < rollout percentage, user gets the feature
// The same user always gets the same bucket for a given flag`}</pre>
      </div>

      <div className="mt-6 bg-[#162029] border border-[rgba(99,102,241,0.15)] rounded-2xl p-6">
        <h3 className="font-heading text-sm font-medium uppercase tracking-wider text-[#E8F0F2] mb-4">
          Why Deterministic Hashing?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-[#8FA3AD]">
          <div>
            <span className="font-medium text-[#E8F0F2]">Consistent</span>
            <p>A user always gets the same result for the same flag, regardless of which server evaluates it.</p>
          </div>
          <div>
            <span className="font-medium text-[#E8F0F2]">Gradual</span>
            <p>Increasing the percentage from 10% to 20% only adds new users. Users already included stay included.</p>
          </div>
          <div>
            <span className="font-medium text-[#E8F0F2]">Independent</span>
            <p>The flag key is part of the hash seed, so different flags have independent rollout assignments.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

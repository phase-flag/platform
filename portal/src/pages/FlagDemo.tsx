import FlagSimulator from '../components/FlagSimulator';

export default function FlagDemo() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-light uppercase tracking-wider text-[#E8F0F2] mb-3">
          Flag Management
        </h1>
        <p className="text-[#8FA3AD] max-w-2xl leading-relaxed">
          Create, toggle, and manage feature flags. Each flag can be a boolean, string, number, or JSON value.
          Toggle flags on and off to see how evaluation changes in real time.
        </p>
      </div>

      <FlagSimulator />

      {/* Info panel */}
      <div className="mt-10 bg-[#111827] border border-[rgba(99,102,241,0.15)] rounded-2xl p-6">
        <h3 className="font-heading text-sm font-medium uppercase tracking-wider text-[#E8F0F2] mb-4">
          How Flags Work in Phase Flag
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-[#8FA3AD]">
          <div className="space-y-3">
            <div>
              <span className="font-medium text-[#E8F0F2]">Flag Types</span>
              <p>Boolean (on/off), String (text variants), Number (numeric config), JSON (structured data).</p>
            </div>
            <div>
              <span className="font-medium text-[#E8F0F2]">Environments</span>
              <p>Each flag can have different settings per environment (development, staging, production).</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <span className="font-medium text-[#E8F0F2]">Lifecycle</span>
              <p>Flags follow a lifecycle: development, testing, production, stale, archived, deleted.</p>
            </div>
            <div>
              <span className="font-medium text-[#E8F0F2]">Metadata</span>
              <p>Add tags, owners, descriptions, ticket URLs, and runbook links to every flag.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

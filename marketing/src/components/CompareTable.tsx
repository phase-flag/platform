import { useState } from 'react';
import { comparisonCategories, competitors, type FeatureValue } from '../data/comparisons';

// ─── Cell ─────────────────────────────────────────────────────────────────────

function Cell({ value, isSelf }: { value: FeatureValue; isSelf?: boolean }) {
  const base = isSelf ? 'bg-pf-primary/5' : '';

  if (typeof value === 'string') {
    return (
      <td className={`px-4 py-3 text-center ${base}`}>
        <span className={`text-xs font-medium ${isSelf ? 'text-pf-primary' : 'text-pf-text-muted'}`}>
          {value}
        </span>
      </td>
    );
  }

  return (
    <td className={`px-4 py-3 text-center ${base}`}>
      {value ? (
        <svg
          className={`w-5 h-5 mx-auto ${isSelf ? 'text-pf-primary' : 'text-white/40'}`}
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-label="Yes"
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 mx-auto text-white/15"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-label="No"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      )}
    </td>
  );
}

// ─── CompareTable ─────────────────────────────────────────────────────────────

export interface CompareTableProps {
  /** If set, only shows this category. Otherwise shows all with toggle tabs. */
  categoryId?: string;
  /** Whether to show the competitor column headers. Default true. */
  showHeaders?: boolean;
}

export default function CompareTable({ categoryId, showHeaders = true }: CompareTableProps) {
  const [activeCategory, setActiveCategory] = useState(
    categoryId ?? comparisonCategories[0].id,
  );

  const categories = categoryId
    ? comparisonCategories.filter((c) => c.id === categoryId)
    : comparisonCategories;

  const displayCategory =
    categories.find((c) => c.id === activeCategory) ?? categories[0];

  return (
    <div>
      {/* Category tabs — only shown in full mode */}
      {!categoryId && (
        <div className="flex flex-wrap gap-2 mb-6">
          {comparisonCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-pf-primary text-white'
                  : 'bg-white/5 text-pf-text-muted hover:text-white hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[rgba(99,102,241,0.15)]">
        <table className="w-full text-sm">
          {showHeaders && (
            <thead>
              <tr className="border-b-2 border-[rgba(99,102,241,0.15)]">
                <th className="text-left px-4 py-4 font-heading text-xs font-medium uppercase tracking-wider text-pf-text-muted min-w-[180px]">
                  {displayCategory.label}
                </th>
                {competitors.map((c) => (
                  <th key={c.id} className={`px-4 py-4 text-center ${c.isSelf ? 'bg-pf-primary/5' : ''}`}>
                    <span
                      className={`font-heading text-xs font-medium uppercase tracking-wider ${
                        c.isSelf ? 'text-pf-primary' : 'text-pf-text-muted'
                      }`}
                    >
                      {c.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {displayCategory.features.map((feature, i) => (
              <tr
                key={feature.name}
                className={`border-b border-[rgba(99,102,241,0.08)] ${
                  i % 2 === 0 ? 'bg-white/[0.01]' : ''
                }`}
              >
                <td className="px-4 py-3 text-pf-text font-medium">
                  {feature.name}
                  {feature.note && (
                    <span
                      className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-pf-text-muted text-[10px] cursor-help align-middle"
                      title={feature.note}
                    >
                      i
                    </span>
                  )}
                </td>
                {competitors.map((c) => (
                  <Cell
                    key={c.id}
                    value={feature[c.id] as FeatureValue}
                    isSelf={c.isSelf}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from 'react';

type Operator = 'is' | 'is_not' | 'contains' | 'not_contains' | 'one_of' | 'gt' | 'lt' | 'matches_regex';

interface Condition {
  attribute: string;
  operator: Operator;
  value: string;
}

interface Rule {
  id: number;
  name: string;
  conditions: Condition[];
  variation: string;
  priority: number;
}

interface UserContext {
  [key: string]: string;
}

const operators: { value: Operator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'one_of', label: 'is one of' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'matches_regex', label: 'matches regex' },
];

function evaluateCondition(condition: Condition, context: UserContext): boolean {
  const attrValue = context[condition.attribute] ?? '';
  const targetValue = condition.value;

  switch (condition.operator) {
    case 'is':
      return attrValue === targetValue;
    case 'is_not':
      return attrValue !== targetValue;
    case 'contains':
      return attrValue.includes(targetValue);
    case 'not_contains':
      return !attrValue.includes(targetValue);
    case 'one_of':
      return targetValue.split(',').map((s) => s.trim()).includes(attrValue);
    case 'gt':
      return parseFloat(attrValue) > parseFloat(targetValue);
    case 'lt':
      return parseFloat(attrValue) < parseFloat(targetValue);
    case 'matches_regex':
      try {
        return new RegExp(targetValue).test(attrValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function evaluateRules(rules: Rule[], context: UserContext): { variation: string; reason: string; matchedRule: number | null } {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    const allMatch = rule.conditions.every((c) => evaluateCondition(c, context));
    if (allMatch) {
      return {
        variation: rule.variation,
        reason: `Matched rule "${rule.name}" (priority ${rule.priority})`,
        matchedRule: rule.id,
      };
    }
  }
  return { variation: 'default (false)', reason: 'No rules matched, returning default', matchedRule: null };
}

export default function TargetingPlayground() {
  const [rules, setRules] = useState<Rule[]>([
    {
      id: 1,
      name: 'Beta Users',
      conditions: [{ attribute: 'plan', operator: 'is', value: 'beta' }],
      variation: 'true',
      priority: 1,
    },
    {
      id: 2,
      name: 'US Enterprise',
      conditions: [
        { attribute: 'country', operator: 'is', value: 'US' },
        { attribute: 'plan', operator: 'one_of', value: 'enterprise, business' },
      ],
      variation: 'true',
      priority: 2,
    },
  ]);

  const [context, setContext] = useState<UserContext>({
    userId: 'user_123',
    email: 'alice@example.com',
    country: 'US',
    plan: 'enterprise',
  });

  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');
  let nextId = Math.max(...rules.map((r) => r.id), 0) + 1;

  const result = evaluateRules(rules, context);

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: nextId,
        name: `Rule ${nextId}`,
        conditions: [{ attribute: '', operator: 'is', value: '' }],
        variation: 'true',
        priority: prev.length + 1,
      },
    ]);
  };

  const removeRule = (id: number) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRuleName = (id: number, name: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
  };

  const updateCondition = (ruleId: number, condIdx: number, field: keyof Condition, value: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              conditions: r.conditions.map((c, i) =>
                i === condIdx ? { ...c, [field]: value } : c
              ),
            }
          : r
      )
    );
  };

  const addCondition = (ruleId: number) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? { ...r, conditions: [...r.conditions, { attribute: '', operator: 'is' as Operator, value: '' }] }
          : r
      )
    );
  };

  const removeCondition = (ruleId: number, condIdx: number) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? { ...r, conditions: r.conditions.filter((_, i) => i !== condIdx) }
          : r
      )
    );
  };

  const updateContext = (key: string, value: string) => {
    setContext((prev) => ({ ...prev, [key]: value }));
  };

  const addAttribute = () => {
    if (!newAttrKey.trim()) return;
    setContext((prev) => ({ ...prev, [newAttrKey]: newAttrValue }));
    setNewAttrKey('');
    setNewAttrValue('');
  };

  const removeAttribute = (key: string) => {
    setContext((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Rules panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-light uppercase tracking-wider text-[#E8F0F2]">
            Targeting Rules
          </h3>
          <button
            onClick={addRule}
            className="px-3 py-1.5 text-sm font-medium text-pf-primary border border-pf-primary rounded-lg hover:bg-pf-primary/10 transition-colors"
          >
            + Add Rule
          </button>
        </div>

        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`border rounded-xl p-4 transition-all ${
              result.matchedRule === rule.id
                ? 'border-pf-success bg-green-900/20 shadow-sm'
                : 'border-[rgba(99,102,241,0.15)] bg-[#111827]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#8FA3AD]">P{rule.priority}</span>
                <input
                  type="text"
                  value={rule.name}
                  onChange={(e) => updateRuleName(rule.id, e.target.value)}
                  className="font-medium text-sm text-[#E8F0F2] bg-transparent border-b border-transparent hover:border-[rgba(99,102,241,0.15)] focus:border-pf-primary focus:outline-none"
                />
                {result.matchedRule === rule.id && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-pf-success text-white font-medium">
                    Matched
                  </span>
                )}
              </div>
              <button
                onClick={() => removeRule(rule.id)}
                className="text-[#8FA3AD] hover:text-pf-danger transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {rule.conditions.map((cond, ci) => (
                <div key={ci} className="flex items-center gap-2 flex-wrap">
                  {ci > 0 && (
                    <span className="text-xs font-medium text-pf-primary uppercase">AND</span>
                  )}
                  <input
                    type="text"
                    placeholder="attribute"
                    value={cond.attribute}
                    onChange={(e) => updateCondition(rule.id, ci, 'attribute', e.target.value)}
                    className="flex-1 min-w-[80px] px-2 py-1.5 text-xs bg-[#1E1B4B] text-[#E8F0F2] border border-[rgba(99,102,241,0.15)] rounded-lg focus:outline-none focus:ring-1 focus:ring-pf-primary/50 placeholder-[#8FA3AD]"
                  />
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(rule.id, ci, 'operator', e.target.value)}
                    className="px-2 py-1.5 text-xs bg-[#1E1B4B] text-[#E8F0F2] border border-[rgba(99,102,241,0.15)] rounded-lg focus:outline-none focus:ring-1 focus:ring-pf-primary/50"
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="value"
                    value={cond.value}
                    onChange={(e) => updateCondition(rule.id, ci, 'value', e.target.value)}
                    className="flex-1 min-w-[80px] px-2 py-1.5 text-xs bg-[#1E1B4B] text-[#E8F0F2] border border-[rgba(99,102,241,0.15)] rounded-lg focus:outline-none focus:ring-1 focus:ring-pf-primary/50 placeholder-[#8FA3AD]"
                  />
                  {rule.conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(rule.id, ci)}
                      className="text-[#8FA3AD] hover:text-pf-danger"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => addCondition(rule.id)}
              className="mt-2 text-xs text-pf-primary hover:text-pf-primary-light transition-colors"
            >
              + Add condition
            </button>
          </div>
        ))}
      </div>

      {/* Context and result panel */}
      <div className="space-y-4">
        <h3 className="font-heading text-lg font-light uppercase tracking-wider text-[#E8F0F2]">
          User Context
        </h3>

        <div className="bg-[#111827] border border-[rgba(99,102,241,0.15)] rounded-xl p-4 space-y-2">
          {Object.entries(context).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <code className="text-xs text-[#8FA3AD] font-mono w-20 truncate">{key}</code>
              <input
                type="text"
                value={value}
                onChange={(e) => updateContext(key, e.target.value)}
                className="flex-1 px-2 py-1.5 text-sm bg-[#1E1B4B] text-[#E8F0F2] border border-[rgba(99,102,241,0.15)] rounded-lg focus:outline-none focus:ring-1 focus:ring-pf-primary/50 font-mono"
              />
              <button
                onClick={() => removeAttribute(key)}
                className="text-[#8FA3AD] hover:text-pf-danger transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2 border-t border-[rgba(99,102,241,0.15)]">
            <input
              type="text"
              placeholder="key"
              value={newAttrKey}
              onChange={(e) => setNewAttrKey(e.target.value)}
              className="w-20 px-2 py-1.5 text-xs bg-[#1E1B4B] text-[#E8F0F2] border border-[rgba(99,102,241,0.15)] rounded-lg focus:outline-none focus:ring-1 focus:ring-pf-primary/50 placeholder-[#8FA3AD]"
            />
            <input
              type="text"
              placeholder="value"
              value={newAttrValue}
              onChange={(e) => setNewAttrValue(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs bg-[#1E1B4B] text-[#E8F0F2] border border-[rgba(99,102,241,0.15)] rounded-lg focus:outline-none focus:ring-1 focus:ring-pf-primary/50 placeholder-[#8FA3AD]"
            />
            <button
              onClick={addAttribute}
              className="px-2.5 py-1.5 text-xs font-medium text-pf-primary border border-pf-primary rounded-lg hover:bg-pf-primary/10 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Evaluation result */}
        <div className={`rounded-xl p-5 border-2 transition-all ${
          result.matchedRule
            ? 'border-pf-success bg-green-900/20'
            : 'border-[rgba(99,102,241,0.15)] bg-[#111827]'
        }`}>
          <h4 className="font-heading text-sm font-medium uppercase tracking-wider text-[#E8F0F2] mb-3">
            Evaluation Result
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#8FA3AD]">Value:</span>
              <code className={`text-lg font-mono font-medium ${
                result.variation === 'true' ? 'text-pf-success' : 'text-pf-danger'
              }`}>
                {result.variation}
              </code>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm text-[#8FA3AD] shrink-0">Reason:</span>
              <span className="text-sm text-[#E8F0F2]">{result.reason}</span>
            </div>
          </div>
        </div>

        {/* Evaluation trace */}
        <div className="bg-pf-dark rounded-xl p-4">
          <h4 className="text-xs font-mono text-pf-primary mb-2">// Evaluation trace</h4>
          <pre className="text-xs text-white/80 font-mono leading-relaxed overflow-x-auto">
{`evaluate("new_feature", context)
${rules.map((rule) => {
  const matched = rule.conditions.every((c) => evaluateCondition(c, context));
  return `  Rule "${rule.name}" (P${rule.priority}):
${rule.conditions.map((c) => `    ${c.attribute} ${c.operator} "${c.value}" => ${context[c.attribute] ?? 'undefined'} => ${evaluateCondition(c, context) ? 'PASS' : 'FAIL'}`).join('\n')}
    Result: ${matched ? 'MATCH -> return ' + rule.variation : 'NO MATCH'}`;
}).join('\n')}
=> Final: ${result.variation}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

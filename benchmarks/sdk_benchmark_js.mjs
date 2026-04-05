#!/usr/bin/env node
/**
 * Phase Flag JavaScript SDK Local Evaluation Benchmark
 * =====================================================
 * Measures in-process evaluation throughput with no network I/O.
 *
 * Tests:
 *   1. Simple boolean flag (no targeting rules)
 *   2. Flag with 5 targeting rules (attribute matching)
 *   3. Flag with percentage rollout (50/50 split)
 *   4. Flag with 10 targeting rules (worst case)
 *
 * Usage:
 *   node benchmarks/sdk_benchmark_js.mjs
 *
 * No dependencies — the evaluation engine is inlined directly from
 * sdks/javascript/src/index.ts (the pure evaluation logic).
 */

// ---------------------------------------------------------------------------
// Inline evaluation engine (mirrors sdks/javascript/src/index.ts)
// ---------------------------------------------------------------------------

function djb2Hash(input) {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalisedHash(flagKey, userId) {
  return djb2Hash(`${flagKey}:${userId}`) % 100;
}

function getContextValue(ctx, key) {
  if (key === "user_id" || key === "userId") return ctx.userId;
  if (key === "session_id" || key === "sessionId") return ctx.sessionId;
  return ctx.attributes?.[key];
}

function coerceNumeric(value) {
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function matchCondition(cond, ctx) {
  const actual = getContextValue(ctx, cond.attribute);
  const op = cond.operator;
  const target = cond.value;

  if (actual === undefined || actual === null) {
    return op === "is_not" || op === "not_contains" || op === "not_one_of";
  }

  const actualStr = String(actual);
  const targetStr = String(target);

  switch (op) {
    case "is":      return actualStr === targetStr;
    case "is_not":  return actualStr !== targetStr;
    case "contains":     return actualStr.includes(targetStr);
    case "not_contains": return !actualStr.includes(targetStr);
    case "one_of": {
      const values = Array.isArray(target) ? target.map(String) : [targetStr];
      return values.includes(actualStr);
    }
    case "not_one_of": {
      const values = Array.isArray(target) ? target.map(String) : [targetStr];
      return !values.includes(actualStr);
    }
    case "gt": {
      const a = coerceNumeric(actual), b = coerceNumeric(target);
      return a !== null && b !== null && a > b;
    }
    case "lt": {
      const a = coerceNumeric(actual), b = coerceNumeric(target);
      return a !== null && b !== null && a < b;
    }
    default: return false;
  }
}

function resolvePercentageRollout(rollout, flagKey, ctx) {
  const userId = ctx.userId || ctx.sessionId || "";
  if (!userId) return null;
  const bucket = normalisedHash(flagKey, userId);
  let cumulative = 0;
  for (const entry of rollout.variations) {
    cumulative += entry.weight;
    if (bucket < cumulative) return entry.variation_id;
  }
  return null;
}

function evaluateFlag(flag, ctx) {
  const variationsById = new Map(flag.variations.map((v) => [v.id, v]));

  const makeResult = (variationId, reason) => {
    const v = variationsById.get(variationId);
    return {
      flagKey: flag.key,
      variationId,
      variationKey: v?.key ?? null,
      value: v?.value ?? null,
      reason,
    };
  };

  const rules = [...flag.targetingRules].sort((a, b) => a.priority - b.priority);

  for (const rule of rules) {
    const allMatch = rule.conditions.every((c) => matchCondition(c, ctx));
    if (!allMatch) continue;

    if (rule.variation_id) {
      return makeResult(rule.variation_id, "targeting_match");
    }

    if (rule.percentage_rollout) {
      const vid = resolvePercentageRollout(rule.percentage_rollout, flag.key, ctx);
      if (vid) return makeResult(vid, "percentage_rollout");
    }
  }

  return makeResult(flag.defaultVariationId, "default");
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SIMPLE_BOOLEAN_FLAG = {
  id: "flag-001",
  key: "simple-flag",
  name: "Simple Boolean Flag",
  flagType: "boolean",
  status: "active",
  environment: "production",
  defaultVariationId: "v-off",
  variations: [
    { id: "v-on",  key: "on",  name: "On",  value: true  },
    { id: "v-off", key: "off", name: "Off", value: false },
  ],
  targetingRules: [],
  tags: [],
};

const FLAG_WITH_5_RULES = {
  id: "flag-002",
  key: "flag-5-rules",
  name: "Flag With 5 Targeting Rules",
  flagType: "boolean",
  status: "active",
  environment: "production",
  defaultVariationId: "v-off",
  variations: [
    { id: "v-on",  key: "on",  name: "On",  value: true  },
    { id: "v-off", key: "off", name: "Off", value: false },
  ],
  targetingRules: [
    {
      priority: 1,
      conditions: [{ attribute: "plan", operator: "is", value: "enterprise" }],
      variation_id: "v-on",
    },
    {
      priority: 2,
      conditions: [{ attribute: "country", operator: "one_of", value: ["us", "ca", "gb"] }],
      variation_id: "v-on",
    },
    {
      priority: 3,
      conditions: [
        { attribute: "user_id", operator: "is_not", value: "anonymous" },
        { attribute: "age",     operator: "gt",     value: 18          },
      ],
      variation_id: "v-on",
    },
    {
      priority: 4,
      conditions: [{ attribute: "email", operator: "contains", value: "@example.com" }],
      variation_id: "v-on",
    },
    {
      priority: 5,
      conditions: [{ attribute: "version", operator: "is_not", value: "1.0" }],
      variation_id: "v-on",
    },
  ],
  tags: [],
};

const FLAG_WITH_PERCENTAGE_ROLLOUT = {
  id: "flag-003",
  key: "flag-percentage-rollout",
  name: "Flag With Percentage Rollout",
  flagType: "boolean",
  status: "active",
  environment: "production",
  defaultVariationId: "v-off",
  variations: [
    { id: "v-on",  key: "on",  name: "On",  value: true  },
    { id: "v-off", key: "off", name: "Off", value: false },
  ],
  targetingRules: [
    {
      priority: 1,
      conditions: [],
      variation_id: undefined,
      percentage_rollout: {
        variations: [
          { variation_id: "v-on",  weight: 50 },
          { variation_id: "v-off", weight: 50 },
        ],
      },
    },
  ],
  tags: [],
};

const FLAG_WITH_10_RULES = {
  id: "flag-004",
  key: "flag-10-rules",
  name: "Flag With 10 Targeting Rules",
  flagType: "string",
  status: "active",
  environment: "production",
  defaultVariationId: "v-control",
  variations: [
    { id: "v-control",   key: "control",   name: "Control",   value: "control"   },
    { id: "v-treatment", key: "treatment", name: "Treatment", value: "treatment" },
  ],
  targetingRules: Array.from({ length: 10 }, (_, i) => ({
    priority: i + 1,
    conditions: [
      { attribute: "segment",   operator: "is",     value: `segment-${i}` },
      { attribute: "plan",      operator: "one_of", value: ["pro", "enterprise"] },
      { attribute: "cohort_id", operator: "gt",     value: i * 10 },
    ],
    variation_id: "v-treatment",
  })),
  tags: [],
};

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

function runBenchmark(name, flag, ctx, iterations = 100_000) {
  // Warm-up
  for (let i = 0; i < 10_000; i++) {
    evaluateFlag(flag, ctx);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    evaluateFlag(flag, ctx);
  }
  const end = performance.now();

  const elapsedMs = end - start;
  const opsPerSec = Math.round((iterations / elapsedMs) * 1000);
  const nsPerOp  = ((elapsedMs * 1_000_000) / iterations).toFixed(1);

  return { name, iterations, elapsedMs, opsPerSec, nsPerOp };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const CTX_SIMPLE = { userId: "user-abc-123" };
const CTX_MATCH = {
  userId: "user-abc-123",
  attributes: {
    plan:      "pro",
    country:   "us",
    age:       25,
    email:     "test@example.com",
    version:   "2.0",
    segment:   "segment-3",
    cohort_id: 45,
  },
};
const CTX_NO_MATCH = {
  userId: "user-xyz-999",
  attributes: {
    plan:    "free",
    country: "xx",
    age:     10,
    email:   "noone@nowhere.tld",
    version: "1.0",
  },
};

console.log("=".repeat(70));
console.log("Phase Flag JS SDK — Local Evaluation Benchmark");
console.log("=".repeat(70));
console.log(`  Node.js ${process.version}`);
console.log(`  Iterations per scenario: 100,000`);
console.log();

const scenarios = [
  ["Simple boolean (no rules)", SIMPLE_BOOLEAN_FLAG, CTX_SIMPLE],
  ["5 rules — matching context", FLAG_WITH_5_RULES, CTX_MATCH],
  ["5 rules — no-match context", FLAG_WITH_5_RULES, CTX_NO_MATCH],
  ["Percentage rollout (50/50)", FLAG_WITH_PERCENTAGE_ROLLOUT, CTX_SIMPLE],
  ["10 rules — matching context", FLAG_WITH_10_RULES, CTX_MATCH],
  ["10 rules — no-match context", FLAG_WITH_10_RULES, CTX_NO_MATCH],
];

const colWidth = 35;
console.log(
  `  ${"Scenario".padEnd(colWidth)} ${"Ops/sec".padStart(12)} ${"ns/op".padStart(10)} ${"Total ms".padStart(10)}`
);
console.log("  " + "-".repeat(colWidth + 36));

const allResults = [];
for (const [name, flag, ctx] of scenarios) {
  const result = runBenchmark(name, flag, ctx);
  allResults.push(result);
  console.log(
    `  ${name.padEnd(colWidth)} ${result.opsPerSec.toLocaleString().padStart(12)} ${result.nsPerOp.padStart(10)} ${result.elapsedMs.toFixed(1).padStart(10)}`
  );
}

console.log();
console.log("Markdown snippet for RESULTS.md:");
console.log();
console.log("| Scenario | Ops/sec | ns/op | Total ms |");
console.log("|----------|---------|-------|----------|");
for (const r of allResults) {
  console.log(`| ${r.name} | ${r.opsPerSec.toLocaleString()} | ${r.nsPerOp} | ${r.elapsedMs.toFixed(1)} |`);
}
console.log();

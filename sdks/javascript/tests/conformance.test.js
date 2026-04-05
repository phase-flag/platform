/**
 * Phase Flag JavaScript SDK — Conformance Test Suite
 *
 * Loads all fixture files from tests/sdk-conformance/fixtures/ and validates
 * the local evaluation engine against every test case.
 *
 * Run with: node tests/conformance.test.js
 * Or via:   npm test (once test script is configured)
 *
 * Exit code 0 = all tests passed, non-zero = failures found.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Copy of the evaluation engine from the SDK
// (We import by inlining the logic here to avoid needing a build step)
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
  if (key === "user_id" || key === "userId") return ctx.user_id || ctx.userId;
  if (key === "session_id" || key === "sessionId")
    return ctx.session_id || ctx.sessionId;
  return ctx.attributes ? ctx.attributes[key] : undefined;
}

function coerceNumeric(value) {
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function parseVersion(v) {
  // Simple semver parser: returns [major, minor, patch] as numbers
  const parts = String(v)
    .replace(/^v/, "")
    .split(".")
    .map((x) => parseInt(x, 10));
  while (parts.length < 3) parts.push(0);
  return parts;
}

function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
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
    case "is":
      return actualStr === targetStr;
    case "is_not":
      return actualStr !== targetStr;
    case "contains":
      return actualStr.includes(targetStr);
    case "not_contains":
      return !actualStr.includes(targetStr);
    case "one_of": {
      const values = Array.isArray(target) ? target.map(String) : [targetStr];
      return values.includes(actualStr);
    }
    case "not_one_of": {
      const values = Array.isArray(target) ? target.map(String) : [targetStr];
      return !values.includes(actualStr);
    }
    case "gt": {
      const a = coerceNumeric(actual);
      const b = coerceNumeric(target);
      return a !== null && b !== null && a > b;
    }
    case "lt": {
      const a = coerceNumeric(actual);
      const b = coerceNumeric(target);
      return a !== null && b !== null && a < b;
    }
    case "matches_regex": {
      try {
        if (targetStr.length > 500) return false;
        return new RegExp(targetStr).test(actualStr.slice(0, 10_000));
      } catch {
        return false;
      }
    }
    case "version_gt": {
      try {
        return compareVersions(actualStr, targetStr) > 0;
      } catch {
        return false;
      }
    }
    case "version_lt": {
      try {
        return compareVersions(actualStr, targetStr) < 0;
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

function resolvePercentageRollout(rollout, flagKey, ctx) {
  const userId = ctx.user_id || ctx.userId || ctx.session_id || ctx.sessionId || "";
  if (!userId) return null;

  const bucket = normalisedHash(flagKey, String(userId));
  let cumulative = 0;
  for (const entry of rollout.variations) {
    cumulative += entry.weight;
    if (bucket < cumulative) {
      return entry.variation_id;
    }
  }
  return null;
}

function evaluateFlag(flag, ctx) {
  // Build variation lookup
  const variationsById = new Map();
  for (const v of flag.variations || []) {
    variationsById.set(v.id, v);
  }

  const makeResult = (variationId, reason) => {
    const v = variationsById.get(variationId);
    return {
      flag_key: flag.key,
      variation_id: variationId || null,
      variation_key: v ? v.key : null,
      value: v !== undefined ? v.value : null,
      reason,
    };
  };

  // Sort targeting rules by priority (ascending = higher priority)
  const targetingRules = (flag.targeting_rules || []).slice().sort(
    (a, b) => (a.priority || 0) - (b.priority || 0)
  );

  for (const rule of targetingRules) {
    const conditions = rule.conditions || [];
    const allMatch = conditions.every((c) => matchCondition(c, ctx));
    if (!allMatch) continue;

    if (rule.variation_id) {
      return makeResult(rule.variation_id, "targeting_match");
    }

    if (rule.percentage_rollout) {
      const vid = resolvePercentageRollout(rule.percentage_rollout, flag.key, ctx);
      if (vid) {
        return makeResult(vid, "percentage_rollout");
      }
    }
  }

  return makeResult(flag.default_variation_id, "default");
}

/**
 * Evaluate a flag with prerequisite checking.
 * Prerequisites are stored on the flag definition as flag.prerequisites = [{flag_key, variation_key}].
 * If any prerequisite flag does not evaluate to the required variation_key, return default with
 * reason "prerequisite_failed".
 */
function evaluateFlagWithPrerequisites(flag, ctx, allFlags) {
  const prerequisites = flag.prerequisites || [];
  for (const prereq of prerequisites) {
    const prereqFlag = allFlags[prereq.flag_key];
    if (!prereqFlag) continue; // skip unknown prerequisites
    // Evaluate the prerequisite (also recursively checking its prerequisites)
    const prereqResult = evaluateFlagWithPrerequisites(prereqFlag, ctx, allFlags);
    if (prereqResult.variation_key !== prereq.variation_key) {
      // Prerequisite not met — return the default variation with prerequisite_failed reason
      const variationsById = new Map();
      for (const v of flag.variations || []) {
        variationsById.set(v.id, v);
      }
      const defaultVariation = variationsById.get(flag.default_variation_id);
      return {
        flag_key: flag.key,
        variation_id: flag.default_variation_id || null,
        variation_key: defaultVariation ? defaultVariation.key : null,
        value: defaultVariation !== undefined ? defaultVariation.value : null,
        reason: "prerequisite_failed",
      };
    }
  }
  return evaluateFlag(flag, ctx);
}

// ---------------------------------------------------------------------------
// Deep equality helper
// ---------------------------------------------------------------------------

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-9;
  }
  if (typeof a !== "object") return String(a) === String(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(a[k], b[k]));
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "tests",
  "sdk-conformance",
  "fixtures"
);

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function runCase(suiteName, testCase) {
  const { name, flags, context, expected, target_flag } = testCase;

  // Determine which flag to evaluate
  const flagKey = target_flag || expected.flag_key;
  const flagDef = flags[flagKey];

  if (!flagDef) {
    console.log(`  SKIP [${suiteName}] ${name} — flag '${flagKey}' not in fixture`);
    skipped++;
    return;
  }

  let result;
  try {
    result = evaluateFlagWithPrerequisites(flagDef, context || {}, flags);
  } catch (err) {
    const msg = `  FAIL [${suiteName}] ${name}\n       Error: ${err.message}`;
    failures.push(msg);
    failed++;
    return;
  }

  // Check expected fields
  const checks = [];

  if (expected.value !== undefined) {
    if (!deepEqual(result.value, expected.value)) {
      checks.push(`value: got ${JSON.stringify(result.value)}, want ${JSON.stringify(expected.value)}`);
    }
  }

  if (expected.variation_key !== undefined) {
    if (result.variation_key !== expected.variation_key) {
      checks.push(
        `variation_key: got ${JSON.stringify(result.variation_key)}, want ${JSON.stringify(expected.variation_key)}`
      );
    }
  }

  if (expected.reason !== undefined) {
    const expectedReason = expected.reason.toLowerCase();
    const actualReason = (result.reason || "").toLowerCase();
    if (actualReason !== expectedReason) {
      checks.push(`reason: got '${actualReason}', want '${expectedReason}'`);
    }
  }

  if (checks.length > 0) {
    const msg = `  FAIL [${suiteName}] ${name}\n       ${checks.join("\n       ")}`;
    failures.push(msg);
    failed++;
  } else {
    passed++;
  }
}

function runSuite(fixtureFile) {
  const content = fs.readFileSync(fixtureFile, "utf8");
  const suite = JSON.parse(content);
  const suiteName = suite.suite || path.basename(fixtureFile, ".json");

  console.log(`\nSuite: ${suiteName} (${suite.cases.length} cases)`);

  for (const testCase of suite.cases) {
    runCase(suiteName, testCase);
  }
}

// Load all fixture files
const fixtureFiles = fs
  .readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => path.join(FIXTURES_DIR, f));

console.log(`Phase Flag JS SDK — Conformance Test Suite`);
console.log(`Loading ${fixtureFiles.length} fixture files from ${FIXTURES_DIR}\n`);

for (const file of fixtureFiles) {
  runSuite(file);
}

// Report
console.log("\n" + "=".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log(`Total: ${passed + failed + skipped} test cases`);

if (failures.length > 0) {
  console.log("\nFailed tests:");
  for (const f of failures) {
    console.log(f);
  }
}

console.log("=".repeat(60));

process.exit(failed > 0 ? 1 : 0);

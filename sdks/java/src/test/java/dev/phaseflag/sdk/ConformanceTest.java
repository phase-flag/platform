package dev.phaseflag.sdk;

import dev.phaseflag.sdk.models.EvaluationContext;
import dev.phaseflag.sdk.models.EvaluationResult;
import dev.phaseflag.sdk.models.FlagDefinition;
import dev.phaseflag.sdk.models.PercentageRollout;
import dev.phaseflag.sdk.models.TargetingCondition;
import dev.phaseflag.sdk.models.TargetingRule;
import dev.phaseflag.sdk.models.Variation;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Phase Flag Java SDK — Conformance Test Suite.
 *
 * <p>Loads all JSON fixture files from tests/sdk-conformance/fixtures/ and validates
 * the local evaluation engine (Evaluator.evaluate()) against every test case.
 *
 * <p>This is a self-contained test runner with no JUnit dependency.
 * Run with: javac + java, or via: mvn test (once Maven Surefire is configured)
 *
 * <p>To run manually:
 * <pre>
 *   javac -cp src/main/java src/test/java/dev/phaseflag/sdk/ConformanceTest.java
 *   java -cp src/main/java:src/test/java dev.phaseflag.sdk.ConformanceTest
 * </pre>
 */
public final class ConformanceTest {

    // ---------------------------------------------------------------------------
    // Minimal JSON parser (no external dependencies)
    // ---------------------------------------------------------------------------

    /**
     * Extremely small recursive-descent JSON parser returning:
     * String, Double, Boolean, null, List<Object>, Map<String,Object>
     */
    private static final class JsonParser {
        private final String src;
        private int pos;

        JsonParser(String src) {
            this.src = src;
            this.pos = 0;
        }

        Object parse() {
            skipWhitespace();
            if (pos >= src.length()) throw new RuntimeException("Unexpected end of input");
            char c = src.charAt(pos);
            if (c == '{') return parseObject();
            if (c == '[') return parseArray();
            if (c == '"') return parseString();
            if (c == 't') { expect("true"); return Boolean.TRUE; }
            if (c == 'f') { expect("false"); return Boolean.FALSE; }
            if (c == 'n') { expect("null"); return null; }
            return parseNumber();
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> parseObject() {
            expect("{");
            Map<String, Object> map = new HashMap<>();
            skipWhitespace();
            if (pos < src.length() && src.charAt(pos) == '}') { pos++; return map; }
            while (true) {
                skipWhitespace();
                String key = parseString();
                skipWhitespace();
                expect(":");
                Object value = parse();
                map.put(key, value);
                skipWhitespace();
                if (pos >= src.length()) break;
                char next = src.charAt(pos);
                if (next == '}') { pos++; break; }
                if (next == ',') { pos++; }
            }
            return map;
        }

        List<Object> parseArray() {
            expect("[");
            List<Object> list = new ArrayList<>();
            skipWhitespace();
            if (pos < src.length() && src.charAt(pos) == ']') { pos++; return list; }
            while (true) {
                list.add(parse());
                skipWhitespace();
                if (pos >= src.length()) break;
                char next = src.charAt(pos);
                if (next == ']') { pos++; break; }
                if (next == ',') { pos++; }
            }
            return list;
        }

        String parseString() {
            expect("\"");
            StringBuilder sb = new StringBuilder();
            while (pos < src.length()) {
                char c = src.charAt(pos++);
                if (c == '"') break;
                if (c == '\\') {
                    if (pos >= src.length()) break;
                    char esc = src.charAt(pos++);
                    switch (esc) {
                        case '"': sb.append('"'); break;
                        case '\\': sb.append('\\'); break;
                        case '/': sb.append('/'); break;
                        case 'n': sb.append('\n'); break;
                        case 'r': sb.append('\r'); break;
                        case 't': sb.append('\t'); break;
                        case 'u': {
                            String hex = src.substring(pos, pos + 4);
                            sb.append((char) Integer.parseInt(hex, 16));
                            pos += 4;
                            break;
                        }
                        default: sb.append(esc);
                    }
                } else {
                    sb.append(c);
                }
            }
            return sb.toString();
        }

        Object parseNumber() {
            int start = pos;
            if (pos < src.length() && src.charAt(pos) == '-') pos++;
            while (pos < src.length() && Character.isDigit(src.charAt(pos))) pos++;
            boolean isFloat = false;
            if (pos < src.length() && src.charAt(pos) == '.') {
                isFloat = true;
                pos++;
                while (pos < src.length() && Character.isDigit(src.charAt(pos))) pos++;
            }
            if (pos < src.length() && (src.charAt(pos) == 'e' || src.charAt(pos) == 'E')) {
                isFloat = true;
                pos++;
                if (pos < src.length() && (src.charAt(pos) == '+' || src.charAt(pos) == '-')) pos++;
                while (pos < src.length() && Character.isDigit(src.charAt(pos))) pos++;
            }
            String numStr = src.substring(start, pos);
            if (isFloat) return Double.parseDouble(numStr);
            try {
                long val = Long.parseLong(numStr);
                if (val >= Integer.MIN_VALUE && val <= Integer.MAX_VALUE) return (int) val;
                return val;
            } catch (NumberFormatException e) {
                return Double.parseDouble(numStr);
            }
        }

        void skipWhitespace() {
            while (pos < src.length() && Character.isWhitespace(src.charAt(pos))) pos++;
        }

        void expect(String s) {
            if (!src.startsWith(s, pos)) {
                throw new RuntimeException("Expected '" + s + "' at position " + pos +
                        ", got: " + src.substring(pos, Math.min(pos + 20, src.length())));
            }
            pos += s.length();
        }
    }

    // ---------------------------------------------------------------------------
    // Convert raw JSON maps to SDK model objects
    // ---------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private static FlagDefinition rawToFlagDefinition(Map<String, Object> raw) {
        String id = (String) raw.get("id");
        String key = (String) raw.get("key");
        String name = (String) raw.getOrDefault("name", "");
        String flagType = (String) raw.getOrDefault("flag_type", "boolean");
        String status = (String) raw.getOrDefault("status", "active");
        String environment = (String) raw.getOrDefault("environment", "");
        String defaultVariationId = (String) raw.get("default_variation_id");

        List<Variation> variations = new ArrayList<>();
        for (Map<String, Object> v : (List<Map<String, Object>>) raw.getOrDefault("variations", new ArrayList<>())) {
            variations.add(new Variation(
                    (String) v.get("id"),
                    (String) v.get("key"),
                    (String) v.getOrDefault("name", ""),
                    v.get("value"),
                    null
            ));
        }

        List<TargetingRule> rules = new ArrayList<>();
        for (Map<String, Object> r : (List<Map<String, Object>>) raw.getOrDefault("targeting_rules", new ArrayList<>())) {
            List<TargetingCondition> conditions = new ArrayList<>();
            for (Map<String, Object> c : (List<Map<String, Object>>) r.getOrDefault("conditions", new ArrayList<>())) {
                conditions.add(new TargetingCondition(
                        (String) c.get("attribute"),
                        (String) c.get("operator"),
                        c.get("value")
                ));
            }

            PercentageRollout rollout = null;
            Map<String, Object> rolloutRaw = (Map<String, Object>) r.get("percentage_rollout");
            if (rolloutRaw != null) {
                List<PercentageRollout.Entry> entries = new ArrayList<>();
                for (Map<String, Object> e : (List<Map<String, Object>>) rolloutRaw.getOrDefault("variations", new ArrayList<>())) {
                    int weight = ((Number) e.get("weight")).intValue();
                    entries.add(new PercentageRollout.Entry((String) e.get("variation_id"), weight));
                }
                rollout = new PercentageRollout(entries);
            }

            Number priorityNum = (Number) r.getOrDefault("priority", 0);
            rules.add(new TargetingRule(
                    priorityNum.intValue(),
                    conditions,
                    (String) r.get("variation_id"),
                    rollout,
                    null
            ));
        }

        return new FlagDefinition(id, key, name, flagType, status, environment,
                defaultVariationId, variations, rules, null);
    }

    @SuppressWarnings("unchecked")
    private static EvaluationContext rawToContext(Map<String, Object> raw) {
        if (raw == null) return EvaluationContext.empty();
        String userId = (String) raw.get("user_id");
        String sessionId = (String) raw.get("session_id");
        Map<String, Object> attrs = (Map<String, Object>) raw.get("attributes");
        EvaluationContext.Builder builder = EvaluationContext.builder()
                .userId(userId)
                .sessionId(sessionId);
        if (attrs != null) {
            builder.attributes(attrs);
        }
        return builder.build();
    }

    // ---------------------------------------------------------------------------
    // Deep equality for JSON-decoded values
    // ---------------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private static boolean deepEqual(Object a, Object b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;

        // Numeric comparison
        if (a instanceof Number && b instanceof Number) {
            double da = ((Number) a).doubleValue();
            double db = ((Number) b).doubleValue();
            return Math.abs(da - db) < 1e-9;
        }

        // List comparison
        if (a instanceof List && b instanceof List) {
            List<Object> la = (List<Object>) a;
            List<Object> lb = (List<Object>) b;
            if (la.size() != lb.size()) return false;
            for (int i = 0; i < la.size(); i++) {
                if (!deepEqual(la.get(i), lb.get(i))) return false;
            }
            return true;
        }

        // Map comparison
        if (a instanceof Map && b instanceof Map) {
            Map<String, Object> ma = (Map<String, Object>) a;
            Map<String, Object> mb = (Map<String, Object>) b;
            if (ma.size() != mb.size()) return false;
            for (Map.Entry<String, Object> entry : ma.entrySet()) {
                if (!mb.containsKey(entry.getKey())) return false;
                if (!deepEqual(entry.getValue(), mb.get(entry.getKey()))) return false;
            }
            return true;
        }

        return a.equals(b);
    }

    // ---------------------------------------------------------------------------
    // Locate fixtures directory
    // ---------------------------------------------------------------------------

    private static Path fixturesDir() {
        // This file is at sdks/java/src/test/java/dev/phaseflag/sdk/ConformanceTest.java
        // Repo root is 8 levels up
        String thisFile = ConformanceTest.class
                .getProtectionDomain().getCodeSource().getLocation().getPath();
        // When compiled to target/test-classes, go up to sdks/java then ../../
        // Try using source-relative path via system property or env var first
        String repoRoot = System.getProperty("repo.root");
        if (repoRoot == null) {
            // Heuristic: walk up from CWD until we find tests/sdk-conformance
            Path cwd = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
            Path candidate = cwd;
            for (int i = 0; i < 10; i++) {
                if (Files.isDirectory(candidate.resolve("tests").resolve("sdk-conformance"))) {
                    repoRoot = candidate.toString();
                    break;
                }
                candidate = candidate.getParent();
                if (candidate == null) break;
            }
        }
        if (repoRoot == null) {
            throw new RuntimeException("Cannot locate repo root. Set -Drepo.root=<path>");
        }
        return Paths.get(repoRoot, "tests", "sdk-conformance", "fixtures");
    }

    // ---------------------------------------------------------------------------
    // Test runner
    // ---------------------------------------------------------------------------

    private int passed = 0;
    private int failed = 0;
    private int skipped = 0;
    private final List<String> failures = new ArrayList<>();

    @SuppressWarnings("unchecked")
    private void runCase(String suiteName, Map<String, Object> testCase) {
        String name = (String) testCase.get("name");
        Map<String, Object> flags = (Map<String, Object>) testCase.get("flags");
        Map<String, Object> context = (Map<String, Object>) testCase.get("context");
        Map<String, Object> expected = (Map<String, Object>) testCase.get("expected");
        String targetFlag = (String) testCase.get("target_flag");

        String flagKey = targetFlag != null && !targetFlag.isEmpty()
                ? targetFlag
                : (String) expected.get("flag_key");

        Map<String, Object> rawFlag = (Map<String, Object>) flags.get(flagKey);
        if (rawFlag == null) {
            System.out.println("  SKIP [" + suiteName + "] " + name + " — flag '" + flagKey + "' not in fixture");
            skipped++;
            return;
        }

        FlagDefinition flag = rawToFlagDefinition(rawFlag);
        EvaluationContext ctx = rawToContext(context);

        EvaluationResult result;
        try {
            result = Evaluator.evaluate(flag, ctx);
        } catch (Exception e) {
            String msg = "  FAIL [" + suiteName + "] " + name + "\n       Error: " + e.getMessage();
            failures.add(msg);
            failed++;
            return;
        }

        List<String> checks = new ArrayList<>();

        if (expected.containsKey("value")) {
            if (!deepEqual(result.getValue(), expected.get("value"))) {
                checks.add("value: got " + result.getValue() + ", want " + expected.get("value"));
            }
        }

        if (expected.containsKey("variation_key")) {
            Object expVk = expected.get("variation_key");
            String actualVk = result.getVariationKey();
            if (expVk == null && actualVk != null) {
                checks.add("variation_key: got " + actualVk + ", want null");
            } else if (expVk != null && !expVk.equals(actualVk)) {
                checks.add("variation_key: got " + actualVk + ", want " + expVk);
            }
        }

        if (expected.containsKey("reason")) {
            String expReason = ((String) expected.get("reason")).toLowerCase();
            String actualReason = result.getReason() != null ? result.getReason().toLowerCase() : "";
            if (!actualReason.equals(expReason)) {
                checks.add("reason: got '" + actualReason + "', want '" + expReason + "'");
            }
        }

        if (checks.isEmpty()) {
            passed++;
        } else {
            String msg = "  FAIL [" + suiteName + "] " + name + "\n       " + String.join("\n       ", checks);
            failures.add(msg);
            failed++;
        }
    }

    @SuppressWarnings("unchecked")
    private void runSuite(Path fixtureFile) throws IOException {
        String content = new String(Files.readAllBytes(fixtureFile));
        Map<String, Object> suite = (Map<String, Object>) new JsonParser(content).parse();
        String suiteName = (String) suite.getOrDefault("suite", fixtureFile.getFileName().toString().replace(".json", ""));
        List<Map<String, Object>> cases = (List<Map<String, Object>>) suite.get("cases");

        System.out.println("\nSuite: " + suiteName + " (" + cases.size() + " cases)");
        for (Map<String, Object> tc : cases) {
            runCase(suiteName, tc);
        }
    }

    private void runAll() throws IOException {
        Path fixturesPath = fixturesDir();

        if (!Files.isDirectory(fixturesPath)) {
            throw new RuntimeException("Fixtures directory not found: " + fixturesPath);
        }

        // Verify required files exist
        String[] required = {
            "operators.json", "rollout.json", "prerequisites.json", "defaults.json",
            "segments.json", "edge_cases.json", "variations.json", "combined.json"
        };
        for (String fname : required) {
            if (!Files.exists(fixturesPath.resolve(fname))) {
                System.err.println("WARNING: Missing required fixture file: " + fname);
            }
        }

        // Load and run all fixture files
        File[] files = fixturesPath.toFile().listFiles(f -> f.getName().endsWith(".json"));
        if (files == null || files.length == 0) {
            throw new RuntimeException("No fixture files found in: " + fixturesPath);
        }
        // Sort for deterministic ordering
        java.util.Arrays.sort(files, (a, b) -> a.getName().compareTo(b.getName()));

        System.out.println("Phase Flag Java SDK — Conformance Test Suite");
        System.out.println("Loading " + files.length + " fixture files from " + fixturesPath);

        for (File file : files) {
            runSuite(file.toPath());
        }

        System.out.println("\n" + "=".repeat(60));
        System.out.println("Results: " + passed + " passed, " + failed + " failed, " + skipped + " skipped");
        System.out.println("Total: " + (passed + failed + skipped) + " test cases");

        if (!failures.isEmpty()) {
            System.out.println("\nFailed tests:");
            for (String f : failures) {
                System.out.println(f);
            }
        }

        System.out.println("=".repeat(60));

        if (failed > 0) {
            System.exit(1);
        }
    }

    public static void main(String[] args) throws IOException {
        new ConformanceTest().runAll();
    }
}

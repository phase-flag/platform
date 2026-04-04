package dev.phaseflag.sdk;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal, zero-dependency JSON parser and serializer.
 *
 * <p>Supports the full JSON spec (objects, arrays, strings, numbers, booleans, null)
 * via a simple recursive-descent parser. Values are represented as:
 * <ul>
 *   <li>{@code Map<String, Object>} for JSON objects</li>
 *   <li>{@code List<Object>} for JSON arrays</li>
 *   <li>{@code String} for JSON strings</li>
 *   <li>{@code Number} ({@code Long} or {@code Double}) for JSON numbers</li>
 *   <li>{@code Boolean} for JSON booleans</li>
 *   <li>{@code null} for JSON null</li>
 * </ul>
 *
 * <p>This class is intended for internal SDK use only.
 */
public final class JsonHelper {

    private JsonHelper() {
    }

    // ── Parsing ─────────────────────────────────────────────────────────────

    /**
     * Parse a JSON string into an object graph.
     *
     * @param json the JSON string
     * @return the parsed value
     * @throws IllegalArgumentException if the JSON is malformed
     */
    public static Object parse(String json) {
        if (json == null || json.isEmpty()) {
            throw new IllegalArgumentException("Empty JSON input");
        }
        var parser = new Parser(json);
        Object value = parser.parseValue();
        parser.skipWhitespace();
        if (parser.pos < parser.input.length()) {
            throw new IllegalArgumentException(
                    "Unexpected trailing content at position " + parser.pos);
        }
        return value;
    }

    /**
     * Parse a JSON string and return it as a {@code Map}.
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> parseObject(String json) {
        Object value = parse(json);
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        throw new IllegalArgumentException("Expected JSON object but got: " + value.getClass());
    }

    // ── Serialization ───────────────────────────────────────────────────────

    /**
     * Serialize a value to a JSON string.
     *
     * @param value the value to serialize
     * @return a JSON string
     */
    public static String serialize(Object value) {
        var sb = new StringBuilder(256);
        writeValue(sb, value);
        return sb.toString();
    }

    // ── Internal parser ─────────────────────────────────────────────────────

    private static final class Parser {

        final String input;
        int pos;

        Parser(String input) {
            this.input = input;
            this.pos = 0;
        }

        Object parseValue() {
            skipWhitespace();
            if (pos >= input.length()) {
                throw error("Unexpected end of input");
            }
            char c = input.charAt(pos);
            switch (c) {
                case '{':
                    return parseObject();
                case '[':
                    return parseArray();
                case '"':
                    return parseString();
                case 't':
                case 'f':
                    return parseBoolean();
                case 'n':
                    return parseNull();
                default:
                    if (c == '-' || (c >= '0' && c <= '9')) {
                        return parseNumber();
                    }
                    throw error("Unexpected character: '" + c + "'");
            }
        }

        Map<String, Object> parseObject() {
            expect('{');
            var map = new LinkedHashMap<String, Object>();
            skipWhitespace();
            if (pos < input.length() && input.charAt(pos) == '}') {
                pos++;
                return map;
            }
            while (true) {
                skipWhitespace();
                String key = parseString();
                skipWhitespace();
                expect(':');
                Object value = parseValue();
                map.put(key, value);
                skipWhitespace();
                if (pos >= input.length()) {
                    throw error("Unterminated object");
                }
                char c = input.charAt(pos);
                if (c == '}') {
                    pos++;
                    return map;
                }
                if (c == ',') {
                    pos++;
                } else {
                    throw error("Expected ',' or '}' but got '" + c + "'");
                }
            }
        }

        List<Object> parseArray() {
            expect('[');
            var list = new ArrayList<Object>();
            skipWhitespace();
            if (pos < input.length() && input.charAt(pos) == ']') {
                pos++;
                return list;
            }
            while (true) {
                list.add(parseValue());
                skipWhitespace();
                if (pos >= input.length()) {
                    throw error("Unterminated array");
                }
                char c = input.charAt(pos);
                if (c == ']') {
                    pos++;
                    return list;
                }
                if (c == ',') {
                    pos++;
                } else {
                    throw error("Expected ',' or ']' but got '" + c + "'");
                }
            }
        }

        String parseString() {
            expect('"');
            var sb = new StringBuilder();
            while (pos < input.length()) {
                char c = input.charAt(pos);
                if (c == '"') {
                    pos++;
                    return sb.toString();
                }
                if (c == '\\') {
                    pos++;
                    if (pos >= input.length()) {
                        throw error("Unterminated string escape");
                    }
                    char esc = input.charAt(pos);
                    switch (esc) {
                        case '"':
                            sb.append('"');
                            break;
                        case '\\':
                            sb.append('\\');
                            break;
                        case '/':
                            sb.append('/');
                            break;
                        case 'b':
                            sb.append('\b');
                            break;
                        case 'f':
                            sb.append('\f');
                            break;
                        case 'n':
                            sb.append('\n');
                            break;
                        case 'r':
                            sb.append('\r');
                            break;
                        case 't':
                            sb.append('\t');
                            break;
                        case 'u':
                            pos++;
                            if (pos + 4 > input.length()) {
                                throw error("Incomplete unicode escape");
                            }
                            String hex = input.substring(pos, pos + 4);
                            sb.append((char) Integer.parseInt(hex, 16));
                            pos += 3; // +1 will happen below
                            break;
                        default:
                            throw error("Invalid escape: \\" + esc);
                    }
                } else {
                    sb.append(c);
                }
                pos++;
            }
            throw error("Unterminated string");
        }

        Number parseNumber() {
            int start = pos;
            if (pos < input.length() && input.charAt(pos) == '-') {
                pos++;
            }
            // Integer part
            if (pos < input.length() && input.charAt(pos) == '0') {
                pos++;
            } else {
                parseDigits();
            }
            boolean isFloat = false;
            // Fraction
            if (pos < input.length() && input.charAt(pos) == '.') {
                isFloat = true;
                pos++;
                parseDigits();
            }
            // Exponent
            if (pos < input.length() && (input.charAt(pos) == 'e' || input.charAt(pos) == 'E')) {
                isFloat = true;
                pos++;
                if (pos < input.length()
                        && (input.charAt(pos) == '+' || input.charAt(pos) == '-')) {
                    pos++;
                }
                parseDigits();
            }
            String numStr = input.substring(start, pos);
            if (isFloat) {
                return Double.parseDouble(numStr);
            }
            try {
                return Long.parseLong(numStr);
            } catch (NumberFormatException e) {
                return Double.parseDouble(numStr);
            }
        }

        private void parseDigits() {
            if (pos >= input.length() || input.charAt(pos) < '0' || input.charAt(pos) > '9') {
                throw error("Expected digit");
            }
            while (pos < input.length() && input.charAt(pos) >= '0' && input.charAt(pos) <= '9') {
                pos++;
            }
        }

        Boolean parseBoolean() {
            if (input.startsWith("true", pos)) {
                pos += 4;
                return Boolean.TRUE;
            }
            if (input.startsWith("false", pos)) {
                pos += 5;
                return Boolean.FALSE;
            }
            throw error("Expected 'true' or 'false'");
        }

        Object parseNull() {
            if (input.startsWith("null", pos)) {
                pos += 4;
                return null;
            }
            throw error("Expected 'null'");
        }

        void skipWhitespace() {
            while (pos < input.length()) {
                char c = input.charAt(pos);
                if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                    pos++;
                } else {
                    break;
                }
            }
        }

        void expect(char expected) {
            skipWhitespace();
            if (pos >= input.length() || input.charAt(pos) != expected) {
                throw error("Expected '" + expected + "'");
            }
            pos++;
        }

        IllegalArgumentException error(String msg) {
            return new IllegalArgumentException("JSON parse error at position " + pos + ": " + msg);
        }
    }

    // ── Internal serializer ─────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private static void writeValue(StringBuilder sb, Object value) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof Boolean) {
            sb.append(value);
        } else if (value instanceof Number) {
            Number num = (Number) value;
            // Emit integers without decimal point
            if (value instanceof Long || value instanceof Integer || value instanceof Short
                    || value instanceof Byte) {
                sb.append(num.longValue());
            } else {
                double d = num.doubleValue();
                if (d == Math.floor(d) && !Double.isInfinite(d) && d < Long.MAX_VALUE && d > Long.MIN_VALUE) {
                    sb.append((long) d);
                } else {
                    sb.append(d);
                }
            }
        } else if (value instanceof String) {
            writeString(sb, (String) value);
        } else if (value instanceof Map) {
            writeObject(sb, (Map<String, Object>) value);
        } else if (value instanceof List) {
            writeArray(sb, (List<Object>) value);
        } else {
            // Fallback: treat as string
            writeString(sb, value.toString());
        }
    }

    private static void writeString(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\b':
                    sb.append("\\b");
                    break;
                case '\f':
                    sb.append("\\f");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        sb.append("\\u");
                        sb.append(String.format("%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                    break;
            }
        }
        sb.append('"');
    }

    private static void writeObject(StringBuilder sb, Map<String, Object> map) {
        sb.append('{');
        boolean first = true;
        for (var entry : map.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            writeString(sb, entry.getKey());
            sb.append(':');
            writeValue(sb, entry.getValue());
        }
        sb.append('}');
    }

    private static void writeArray(StringBuilder sb, List<Object> list) {
        sb.append('[');
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            writeValue(sb, list.get(i));
        }
        sb.append(']');
    }
}

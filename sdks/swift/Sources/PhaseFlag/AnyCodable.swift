/// A type-erased `Codable` wrapper that can hold any JSON-representable value.
///
/// `AnyCodable` bridges the gap between Swift's strong type system and
/// the loosely typed `value` fields in the PhaseFlag API. It handles
/// `Bool`, `Int`, `Double`, `String`, `[AnyCodable]`, `[String: AnyCodable]`,
/// and `nil` (JSON null).
import Foundation

public struct AnyCodable: Codable, Equatable, CustomStringConvertible {

    /// The underlying untyped value.
    public let value: Any

    // MARK: - Initializers

    public init(_ value: Any) {
        self.value = value
    }

    public init(_ value: Bool) { self.value = value }
    public init(_ value: Int) { self.value = value }
    public init(_ value: Double) { self.value = value }
    public init(_ value: String) { self.value = value }
    public init(_ value: [AnyCodable]) { self.value = value }
    public init(_ value: [String: AnyCodable]) { self.value = value }

    /// Creates an `AnyCodable` representing JSON `null`.
    public static var null: AnyCodable { AnyCodable(NSNull()) }

    // MARK: - Typed Accessors

    /// Returns the value as a `Bool`, or `nil` if the underlying value is not a boolean.
    public var boolValue: Bool? { value as? Bool }

    /// Returns the value as an `Int`, or `nil` if the underlying value is not an integer.
    public var intValue: Int? { value as? Int }

    /// Returns the value as a `Double`, coercing from `Int` if necessary.
    public var doubleValue: Double? {
        if let d = value as? Double { return d }
        if let i = value as? Int { return Double(i) }
        return nil
    }

    /// Returns the value as a `String`, or `nil` if the underlying value is not a string.
    public var stringValue: String? { value as? String }

    /// Returns the value as an array of `AnyCodable`, or `nil`.
    public var arrayValue: [AnyCodable]? { value as? [AnyCodable] }

    /// Returns the value as a dictionary, or `nil`.
    public var dictionaryValue: [String: AnyCodable]? { value as? [String: AnyCodable] }

    /// Returns `true` if the underlying value represents JSON `null`.
    public var isNull: Bool { value is NSNull }

    // MARK: - Decodable

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self.value = NSNull()
        } else if let boolVal = try? container.decode(Bool.self) {
            self.value = boolVal
        } else if let intVal = try? container.decode(Int.self) {
            self.value = intVal
        } else if let doubleVal = try? container.decode(Double.self) {
            self.value = doubleVal
        } else if let stringVal = try? container.decode(String.self) {
            self.value = stringVal
        } else if let arrayVal = try? container.decode([AnyCodable].self) {
            self.value = arrayVal
        } else if let dictVal = try? container.decode([String: AnyCodable].self) {
            self.value = dictVal
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "AnyCodable cannot decode the value"
            )
        }
    }

    // MARK: - Encodable

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case is NSNull:
            try container.encodeNil()
        case let boolVal as Bool:
            try container.encode(boolVal)
        case let intVal as Int:
            try container.encode(intVal)
        case let doubleVal as Double:
            try container.encode(doubleVal)
        case let stringVal as String:
            try container.encode(stringVal)
        case let arrayVal as [AnyCodable]:
            try container.encode(arrayVal)
        case let dictVal as [String: AnyCodable]:
            try container.encode(dictVal)
        default:
            // Fallback: attempt string representation.
            try container.encode(String(describing: value))
        }
    }

    // MARK: - Equatable

    public static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        switch (lhs.value, rhs.value) {
        case (is NSNull, is NSNull):
            return true
        case let (l as Bool, r as Bool):
            return l == r
        case let (l as Int, r as Int):
            return l == r
        case let (l as Double, r as Double):
            return l == r
        case let (l as String, r as String):
            return l == r
        case let (l as [AnyCodable], r as [AnyCodable]):
            return l == r
        case let (l as [String: AnyCodable], r as [String: AnyCodable]):
            return l == r
        default:
            return false
        }
    }

    // MARK: - CustomStringConvertible

    public var description: String {
        if value is NSNull {
            return "null"
        }
        return String(describing: value)
    }
}

// MARK: - ExpressibleBy Literals

extension AnyCodable: ExpressibleByBooleanLiteral {
    public init(booleanLiteral value: Bool) {
        self.value = value
    }
}

extension AnyCodable: ExpressibleByIntegerLiteral {
    public init(integerLiteral value: Int) {
        self.value = value
    }
}

extension AnyCodable: ExpressibleByFloatLiteral {
    public init(floatLiteral value: Double) {
        self.value = value
    }
}

extension AnyCodable: ExpressibleByStringLiteral {
    public init(stringLiteral value: String) {
        self.value = value
    }
}

extension AnyCodable: ExpressibleByArrayLiteral {
    public init(arrayLiteral elements: AnyCodable...) {
        self.value = elements
    }
}

extension AnyCodable: ExpressibleByDictionaryLiteral {
    public init(dictionaryLiteral elements: (String, AnyCodable)...) {
        self.value = Dictionary(uniqueKeysWithValues: elements)
    }
}

extension AnyCodable: ExpressibleByNilLiteral {
    public init(nilLiteral: ()) {
        self.value = NSNull()
    }
}

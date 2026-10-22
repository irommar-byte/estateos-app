import Foundation

/// GalleryOS speaks Polish, English and Ukrainian. The language follows the iPhone (or the
/// per-app choice in Settings → GalleryOS → Language); there is deliberately no switch inside
/// the app, just like Apple's own apps.
///
/// Every piece of text is written in Polish in the code and wrapped in `L(...)`. The Polish
/// sentence is the key, interpolated values become `%@` (`%1$@`, `%2$@` … in translations
/// that need another order), and Localizable.strings holds the English and Ukrainian text.
struct LocalText: ExpressibleByStringInterpolation {
    var key: String
    var arguments: [String]

    init(stringLiteral value: String) {
        key = value
        arguments = []
    }

    init(stringInterpolation: Interpolation) {
        key = stringInterpolation.key
        arguments = stringInterpolation.arguments
    }

    struct Interpolation: StringInterpolationProtocol {
        var key = ""
        var arguments: [String] = []

        init(literalCapacity: Int, interpolationCount: Int) {
            key.reserveCapacity(literalCapacity + interpolationCount * 2)
        }

        mutating func appendLiteral(_ literal: String) {
            key += literal
        }

        mutating func appendInterpolation<T>(_ value: T) {
            key += "%@"
            arguments.append("\(value)")
        }
    }
}

/// The text in the language GalleryOS is running in.
func L(_ text: LocalText) -> String {
    Localization.fill(Localization.text(text.key), text.arguments)
}

enum Localization {
    /// "pl", "en" or "uk": the localisation iOS picked for this launch.
    static let language: String = {
        let picked = Bundle.main.preferredLocalizations.first ?? "pl"
        let code = Locale(identifier: picked).language.languageCode?.identifier ?? picked
        return ["pl", "en", "uk"].contains(code) ? code : "en"
    }()

    static var isPolish: Bool { language == "pl" }
    static var isEnglish: Bool { language == "en" }
    static var isUkrainian: Bool { language == "uk" }

    /// Dates, numbers and month names in the app's language, with the person's own region.
    static let locale: Locale = {
        let current = Locale.current
        if current.language.languageCode?.identifier == language { return current }
        var components = Locale.Components(identifier: language)
        components.region = current.region
        return Locale(components: components)
    }()

    /// Translation of a key that is only known at run time (a stored title, a raw value).
    static func text(_ key: String) -> String {
        guard !key.isEmpty else { return key }
        return Bundle.main.localizedString(forKey: key, value: key, table: nil)
    }

    /// The translated text in front of the first placeholder: "Wybrane · zostało %@" → "Selected · ".
    static func head(_ key: String) -> String {
        let format = text(key)
        guard let range = format.range(of: "%") else { return format }
        return String(format[..<range.lowerBound])
    }

    /// True when `text` begins like one of the given Polish keys does in the current language.
    static func begins(_ text: String, _ keys: String...) -> Bool {
        keys.contains { key in
            let start = head(key)
            return !start.isEmpty && text.hasPrefix(start)
        }
    }

    /// Fills `%@` and `%1$@`-style placeholders. Any other `%` is left exactly as written,
    /// so "100%" needs no escaping.
    static func fill(_ format: String, _ arguments: [String]) -> String {
        guard !arguments.isEmpty, format.contains("%") else { return format }
        var result = ""
        result.reserveCapacity(format.count + arguments.reduce(0) { $0 + $1.count })
        var next = 0
        var index = format.startIndex
        while index < format.endIndex {
            let character = format[index]
            guard character == "%" else {
                result.append(character)
                index = format.index(after: index)
                continue
            }
            let after = format.index(after: index)
            if after < format.endIndex, format[after] == "@" {
                result += next < arguments.count ? arguments[next] : ""
                next += 1
                index = format.index(after: after)
                continue
            }
            // %N$@
            var cursor = after
            var digits = ""
            while cursor < format.endIndex, let digit = format[cursor].wholeNumberValue {
                digits.append(String(digit))
                cursor = format.index(after: cursor)
            }
            if !digits.isEmpty, cursor < format.endIndex, format[cursor] == "$" {
                let at = format.index(after: cursor)
                if at < format.endIndex, format[at] == "@", let position = Int(digits), position >= 1 {
                    result += position <= arguments.count ? arguments[position - 1] : ""
                    index = format.index(after: at)
                    continue
                }
            }
            result.append(character)
            index = after
        }
        return result
    }
}

/// Grammatical number. Polish and Ukrainian have three forms (1 zdjęcie, 2 zdjęcia, 5 zdjęć /
/// 1 фото, 2 фото, 5 фото…), English two. Callers pass the three Polish forms wrapped in `L`,
/// and the rule of the current language picks one.
enum Plural {
    static func pick(_ count: Int, _ one: String, _ few: String, _ many: String) -> String {
        let value = abs(count)
        let ones = value % 10
        let tens = value % 100
        switch Localization.language {
        case "en":
            return value == 1 ? one : many
        case "uk":
            if ones == 1 && tens != 11 { return one }
            if (2...4).contains(ones) && !(12...14).contains(tens) { return few }
            return many
        default:
            if value == 1 { return one }
            if (2...4).contains(ones) && !(12...14).contains(tens) { return few }
            return many
        }
    }
}

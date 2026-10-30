import Foundation

enum AppLanguage: String, CaseIterable, Identifiable {
    case system
    case pl
    case en
    case uk

    var id: String { rawValue }

    var locale: Locale {
        switch self {
        case .system:
            return Locale.autoupdatingCurrent
        case .pl:
            return Locale(identifier: "pl_PL")
        case .en:
            return Locale(identifier: "en")
        case .uk:
            return Locale(identifier: "uk_UA")
        }
    }

    var title: String {
        switch self {
        case .system: return String(localized: "Język iPhone’a")
        case .pl: return "Polski"
        case .en: return "English"
        case .uk: return "Українська"
        }
    }

    var bcp47: String? {
        switch self {
        case .system: return nil
        case .pl: return "pl"
        case .en: return "en"
        case .uk: return "uk"
        }
    }
}

enum AppLocale {
    static var override: Locale?

    static var current: Locale {
        override ?? Locale.autoupdatingCurrent
    }

    static func apply(_ language: AppLanguage) {
        override = language == .system ? nil : language.locale
    }

    static func string(_ key: String) -> String {
        let lang: String
        let id = current.identifier.lowercased()
        if id.hasPrefix("uk") {
            lang = "uk"
        } else if id.hasPrefix("en") {
            lang = "en"
        } else {
            lang = "pl"
        }
        if let path = Bundle.main.path(forResource: lang, ofType: "lproj"),
           let bundle = Bundle(path: path) {
            let value = bundle.localizedString(forKey: key, value: key, table: nil)
            if value.isEmpty == false { return value }
        }
        return key
    }
}

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
}

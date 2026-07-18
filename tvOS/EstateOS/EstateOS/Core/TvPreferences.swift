import Foundation

enum TopShelfPresentationStyle: String, CaseIterable, Identifiable {
    case carousel
    case sectioned

    var id: String { rawValue }

    var title: String {
        switch self {
        case .carousel: return "Pełny ekran (Apple TV+)"
        case .sectioned: return "Kafelki (w rzędzie)"
        }
    }

    var subtitle: String {
        switch self {
        case .carousel:
            return "Jedna oferta na cały Górny pasek. Przesuń w górę, aby otworzyć pełny ekran."
        case .sectioned:
            return "Sekcje Home i Car obok siebie z metadanymi na banerze."
        }
    }
}

enum TvPreferences {
    private static let suiteName = "group.pl.estateos.app.tvos"
    private static let topShelfStyleKey = "topShelfPresentationStyle"
    private static let favoriteCarIdsKey = "favoriteCarIds"

    static var topShelfStyle: TopShelfPresentationStyle {
        get {
            let raw = store.string(forKey: topShelfStyleKey) ?? TopShelfPresentationStyle.carousel.rawValue
            return TopShelfPresentationStyle(rawValue: raw) ?? .carousel
        }
        set {
            store.set(newValue.rawValue, forKey: topShelfStyleKey)
            store.synchronize()
        }
    }

    static var favoriteCarIds: Set<Int> {
        get {
            let raw = store.array(forKey: favoriteCarIdsKey) as? [Int] ?? []
            return Set(raw)
        }
        set {
            store.set(Array(newValue).sorted(), forKey: favoriteCarIdsKey)
            store.synchronize()
        }
    }

    private static var store: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }
}

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
            return "Pełny ekran jak Apple TV+: zdjęcie oferty, Play otwiera przegląd, Info — szczegóły. Wymaga ikony w górnym rzędzie."
        case .sectioned:
            return "Kafelki Home i Car w rzędzie pod ikoną — szybki przegląd bez pełnego ekranu."
        }
    }
}


enum TvPreferences {
    private static let suiteName = "group.pl.estateos.app.tvos"
    private static let topShelfStyleKey = "topShelfPresentationStyle"

    private static let recentSpotlightKey = "recentSpotlightSearches"
    private static let recentSearchesHomeKey = "recentSearchesHome"
    private static let recentSearchesCarKey = "recentSearchesCar"
    private static let accountAdvancedExpandedKey = "accountAdvancedExpanded"

    static var recentSpotlightSearches: [String] {
        get { store.stringArray(forKey: recentSpotlightKey) ?? [] }
        set { store.set(Array(newValue.prefix(6)), forKey: recentSpotlightKey); store.synchronize() }
    }

    static var recentSearchesHome: [String] {
        get { store.stringArray(forKey: recentSearchesHomeKey) ?? [] }
        set { store.set(Array(newValue.prefix(3)), forKey: recentSearchesHomeKey); store.synchronize() }
    }

    static var recentSearchesCar: [String] {
        get { store.stringArray(forKey: recentSearchesCarKey) ?? [] }
        set { store.set(Array(newValue.prefix(3)), forKey: recentSearchesCarKey); store.synchronize() }
    }

    static var accountAdvancedExpanded: Bool {
        get { store.bool(forKey: accountAdvancedExpandedKey) }
        set { store.set(newValue, forKey: accountAdvancedExpandedKey); store.synchronize() }
    }

    private static let favoriteCarIdsKey = "favoriteCarIds"

    static var topShelfStyle: TopShelfPresentationStyle {
        get {
            if let raw = store.string(forKey: topShelfStyleKey),
               let style = TopShelfPresentationStyle(rawValue: raw) {
                return style
            }
            if let raw = readSharedFile(),
               let style = TopShelfPresentationStyle(rawValue: raw) {
                return style
            }
            return .carousel
        }
        set {
            store.set(newValue.rawValue, forKey: topShelfStyleKey)
            store.synchronize()
            writeSharedFile(newValue.rawValue)
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


    private static var sharedContainerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteName)
    }

    private static var sharedStyleFileURL: URL? {
        sharedContainerURL?.appendingPathComponent("topShelfPresentationStyle.txt")
    }

    private static func writeSharedFile(_ raw: String) {
        guard let url = sharedStyleFileURL else { return }
        try? raw.data(using: .utf8)?.write(to: url, options: .atomic)
    }

    private static func readSharedFile() -> String? {
        guard let url = sharedStyleFileURL,
              let data = try? Data(contentsOf: url),
              let raw = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty else { return nil }
        return raw
    }

    private static var store: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }
}

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

enum ShowroomLayoutMode: String, CaseIterable, Identifiable {
    case rails
    case tiles
    case list

    var id: String { rawValue }

    var title: String {
        switch self {
        case .rails: return "Taśmy"
        case .tiles: return "Kafelki"
        case .list: return "Lista"
        }
    }

    var systemImage: String {
        switch self {
        case .rails: return "rectangle.stack"
        case .tiles: return "square.grid.2x2"
        case .list: return "list.bullet"
        }
    }
}

enum TvPreferences {
    private static let suiteName = "group.pl.estateos.app.tvos"
    private static let topShelfStyleKey = "topShelfPresentationStyle"
    private static let favoriteCarIdsKey = "favoriteCarIds"
    private static let showroomLayoutKey = "showroomLayoutMode"

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

    static var showroomLayout: ShowroomLayoutMode {
        get {
            let raw = store.string(forKey: showroomLayoutKey) ?? ShowroomLayoutMode.rails.rawValue
            return ShowroomLayoutMode(rawValue: raw) ?? .rails
        }
        set {
            store.set(newValue.rawValue, forKey: showroomLayoutKey)
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

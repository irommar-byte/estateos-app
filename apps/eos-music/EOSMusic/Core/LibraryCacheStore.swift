import Foundation

/// Dyskowy cache biblioteki — playlisty widoczne od razu po starcie, sync w tle.
enum LibraryCacheStore {
    private struct Envelope: Codable {
        let login: String
        let savedAt: Date
        let library: MusicLibraryResponse
    }

    private struct FavoritesEnvelope: Codable {
        let login: String
        let savedAt: Date
        let items: [FavoriteItem]
    }

    private struct AssetsEnvelope: Codable {
        let login: String
        let savedAt: Date
        let assets: MusicAssetsResponse
    }

    private static var cacheURL: URL {
        AppDocuments.root.appendingPathComponent("library-cache.json", isDirectory: false)
    }

    private static var favoritesCacheURL: URL {
        AppDocuments.root.appendingPathComponent("favorites-cache.json", isDirectory: false)
    }

    private static var assetsCacheURL: URL {
        AppDocuments.root.appendingPathComponent("server-assets-cache.json", isDirectory: false)
    }

    static func load(for login: String) -> MusicLibraryResponse? {
        guard let data = try? Data(contentsOf: cacheURL),
              let envelope = try? JSONDecoder().decode(Envelope.self, from: data),
              envelope.login == login else {
            return nil
        }
        return envelope.library
    }

    static func save(_ library: MusicLibraryResponse, for login: String) {
        let envelope = Envelope(login: login, savedAt: Date(), library: library)
        guard let data = try? JSONEncoder().encode(envelope) else { return }
        try? data.write(to: cacheURL, options: [.atomic])
    }

    static func loadFavorites(for login: String) -> [FavoriteItem]? {
        guard let data = try? Data(contentsOf: favoritesCacheURL),
              let envelope = try? JSONDecoder().decode(FavoritesEnvelope.self, from: data),
              envelope.login == login else {
            return nil
        }
        return envelope.items
    }

    static func saveFavorites(_ items: [FavoriteItem], for login: String) {
        let envelope = FavoritesEnvelope(login: login, savedAt: Date(), items: items)
        guard let data = try? JSONEncoder().encode(envelope) else { return }
        try? data.write(to: favoritesCacheURL, options: [.atomic])
    }

    static func loadAssets(for login: String) -> MusicAssetsResponse? {
        guard let data = try? Data(contentsOf: assetsCacheURL),
              let envelope = try? JSONDecoder().decode(AssetsEnvelope.self, from: data),
              envelope.login == login else {
            return nil
        }
        return envelope.assets
    }

    static func saveAssets(_ assets: MusicAssetsResponse, for login: String) {
        let envelope = AssetsEnvelope(login: login, savedAt: Date(), assets: assets)
        guard let data = try? JSONEncoder().encode(envelope) else { return }
        try? data.write(to: assetsCacheURL, options: [.atomic])
    }

    static func clear() {
        try? FileManager.default.removeItem(at: cacheURL)
        try? FileManager.default.removeItem(at: favoritesCacheURL)
        try? FileManager.default.removeItem(at: assetsCacheURL)
    }
}

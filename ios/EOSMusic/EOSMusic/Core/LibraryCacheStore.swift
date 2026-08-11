import Foundation

/// Dyskowy cache biblioteki — playlisty widoczne od razu po starcie, sync w tle.
enum LibraryCacheStore {
    private struct Envelope: Codable {
        let login: String
        let savedAt: Date
        let library: MusicLibraryResponse
    }

    private static var cacheURL: URL {
        AppDocuments.root.appendingPathComponent("library-cache.json", isDirectory: false)
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

    static func clear() {
        try? FileManager.default.removeItem(at: cacheURL)
    }
}

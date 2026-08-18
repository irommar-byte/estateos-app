import Foundation

/// Mapuje stabilne URL biblioteki (`eosmusic://opened/<hash>`) na plik w sandboxie aplikacji.
enum OpenedAudioRegistry {
    private static let prefix = "eosmusic://opened/"
    private static let storeURL: URL = {
        AppDocuments.ensureStructure()
        return AppDocuments.root.appendingPathComponent("opened-audio-index.json")
    }()

    struct Entry: Codable {
        var path: String
        var title: String?
        var artist: String?
        var album: String?
    }

    private struct Index: Codable {
        var entries: [String: Entry]
    }

    static func isOpenedLibraryURL(_ url: String) -> Bool {
        url.lowercased().hasPrefix(prefix)
    }

    static func libraryURL(for contentHash: String) -> String {
        "\(prefix)\(contentHash)"
    }

    static func contentHash(from libraryURL: String) -> String? {
        guard isOpenedLibraryURL(libraryURL) else { return nil }
        let hash = String(libraryURL.dropFirst(prefix.count))
        return hash.isEmpty ? nil : hash
    }

    static func entry(for libraryURL: String) -> Entry? {
        guard let hash = contentHash(from: libraryURL) else { return nil }
        return loadIndex().entries[hash]
    }

    static func localURL(for libraryURL: String) -> URL? {
        guard let entry = entry(for: libraryURL) else { return nil }
        let url = URL(fileURLWithPath: entry.path)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    static func register(
        localFile: URL,
        contentHash: String,
        title: String? = nil,
        artist: String? = nil,
        album: String? = nil
    ) {
        var index = loadIndex()
        index.entries[contentHash] = Entry(
            path: localFile.path,
            title: title,
            artist: artist,
            album: album
        )
        saveIndex(index)
    }

    static func remove(contentHash: String) {
        var index = loadIndex()
        index.entries.removeValue(forKey: contentHash)
        saveIndex(index)
    }

    private static func loadIndex() -> Index {
        guard let data = try? Data(contentsOf: storeURL),
              let decoded = try? JSONDecoder().decode(Index.self, from: data) else {
            return Index(entries: [:])
        }
        return decoded
    }

    private static func saveIndex(_ index: Index) {
        guard let data = try? JSONEncoder().encode(index) else { return }
        try? data.write(to: storeURL, options: .atomic)
    }
}

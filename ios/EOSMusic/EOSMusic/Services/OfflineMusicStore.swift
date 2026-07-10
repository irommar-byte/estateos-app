import CryptoKit
import Foundation

struct OfflineTrackEntry: Codable, Equatable {
    let url: String
    let fileName: String
    let title: String
    let artist: String?
    let downloadJobId: String?
    let savedAt: Date
}

@MainActor
final class OfflineMusicStore: ObservableObject {
    static let shared = OfflineMusicStore()

    @Published private(set) var entries: [String: OfflineTrackEntry] = [:]

    private let root: URL
    private let legacyRoot: URL
    private let indexURL: URL

    private init() {
        AppDocuments.ensureStructure()
        root = AppDocuments.downloads
        legacyRoot = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("OfflineMusic", isDirectory: true)
        indexURL = root.appendingPathComponent(".eos-index.json")
        migrateLegacyStorageIfNeeded()
        loadIndex()
    }

    var downloadsDirectory: URL { root }

    var downloadedFileCount: Int { entries.count }

    func isAvailable(_ trackUrl: String) -> Bool {
        localURL(for: trackUrl) != nil
    }

    func localURL(for trackUrl: String) -> URL? {
        guard let entry = entries[trackUrl] else { return nil }
        let file = root.appendingPathComponent(entry.fileName)
        guard FileManager.default.fileExists(atPath: file.path) else {
            entries.removeValue(forKey: trackUrl)
            saveIndex()
            return nil
        }
        return file
    }

    func allLocalAudioFiles() -> [URL] {
        guard let items = try? FileManager.default.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }
        return items
            .filter { isAudioFileName($0.lastPathComponent) }
            .sorted { $0.lastPathComponent.localizedCaseInsensitiveCompare($1.lastPathComponent) == .orderedAscending }
    }

    func save(
        request: URLRequest,
        trackUrl: String,
        title: String,
        artist: String? = nil,
        downloadJobId: String?,
        onProgress: ((Double) -> Void)? = nil
    ) async throws {
        let (asyncBytes, response) = try await URLSession.shared.bytes(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode < 400 else {
            throw APIError.server("Nie udało się pobrać pliku na urządzenie.")
        }

        let expected = response.expectedContentLength
        var data = Data()
        data.reserveCapacity(expected > 0 ? Int(expected) : 0)

        for try await byte in asyncBytes {
            try Task.checkCancellation()
            data.append(byte)
            if expected > 0, data.count % 65536 == 0 {
                onProgress?(Double(data.count) / Double(expected))
            }
        }
        try Task.checkCancellation()
        onProgress?(1)

        let fileName = fileName(for: title, artist: artist, trackUrl: trackUrl)
        let destination = root.appendingPathComponent(fileName)
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try data.write(to: destination, options: .atomic)

        entries[trackUrl] = OfflineTrackEntry(
            url: trackUrl,
            fileName: fileName,
            title: title,
            artist: artist,
            downloadJobId: downloadJobId,
            savedAt: Date()
        )
        saveIndex()
    }

    func remove(_ trackUrl: String) {
        if let entry = entries[trackUrl] {
            let file = root.appendingPathComponent(entry.fileName)
            try? FileManager.default.removeItem(at: file)
        }
        entries.removeValue(forKey: trackUrl)
        saveIndex()
    }

    func removeFile(at url: URL) {
        try? FileManager.default.removeItem(at: url)
        if let key = entries.first(where: { root.appendingPathComponent($0.value.fileName) == url })?.key {
            entries.removeValue(forKey: key)
            saveIndex()
        }
    }

    func removeAll() {
        for entry in entries.values {
            let file = root.appendingPathComponent(entry.fileName)
            try? FileManager.default.removeItem(at: file)
        }
        entries.removeAll()
        saveIndex()
    }

    private func fileName(for title: String, artist: String?, trackUrl: String) -> String {
        let hash = SHA256.hash(data: Data(trackUrl.utf8))
        let suffix = hash.prefix(4).map { String(format: "%02x", $0) }.joined()
        var base = [artist, title].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " — ")
        if base.isEmpty { base = "Utwór" }
        base = base
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
        if base.count > 80 { base = String(base.prefix(80)) }
        return "\(base) [\(suffix)].mp3"
    }

    private func migrateLegacyStorageIfNeeded() {
        let legacyIndex = legacyRoot.appendingPathComponent("index.json")
        guard FileManager.default.fileExists(atPath: legacyIndex.path) else { return }
        struct LegacyEntry: Codable {
            let url: String
            let fileName: String
            let title: String
            let downloadJobId: String?
            let savedAt: Date
        }
        guard let data = try? Data(contentsOf: legacyIndex),
              let legacy = try? JSONDecoder().decode([String: LegacyEntry].self, from: data) else { return }

        var migrated: [String: OfflineTrackEntry] = [:]
        for (key, entry) in legacy {
            let legacyFile = legacyRoot.appendingPathComponent(entry.fileName)
            let dest = root.appendingPathComponent(entry.fileName)
            guard FileManager.default.fileExists(atPath: legacyFile.path) else { continue }
            if !FileManager.default.fileExists(atPath: dest.path) {
                try? FileManager.default.copyItem(at: legacyFile, to: dest)
            }
            migrated[key] = OfflineTrackEntry(
                url: entry.url,
                fileName: entry.fileName,
                title: entry.title,
                artist: nil,
                downloadJobId: entry.downloadJobId,
                savedAt: entry.savedAt
            )
        }
        if let encoded = try? JSONEncoder().encode(migrated) {
            try? encoded.write(to: indexURL, options: .atomic)
        }
        try? FileManager.default.removeItem(at: legacyRoot)
    }

    private func loadIndex() {
        guard let data = try? Data(contentsOf: indexURL),
              let decoded = try? JSONDecoder().decode([String: OfflineTrackEntry].self, from: data) else {
            entries = [:]
            rebuildIndexFromDisk()
            return
        }
        entries = decoded.filter { _, entry in
            FileManager.default.fileExists(atPath: root.appendingPathComponent(entry.fileName).path)
        }
    }

    private func rebuildIndexFromDisk() {
        for url in allLocalAudioFiles() {
            let name = url.deletingPathExtension().lastPathComponent
            let fakeKey = "file:\(url.lastPathComponent)"
            if entries[fakeKey] == nil {
                entries[fakeKey] = OfflineTrackEntry(
                    url: fakeKey,
                    fileName: url.lastPathComponent,
                    title: name,
                    artist: nil,
                    downloadJobId: nil,
                    savedAt: (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? Date()
                )
            }
        }
        saveIndex()
    }

    private func saveIndex() {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        try? data.write(to: indexURL, options: .atomic)
    }
}

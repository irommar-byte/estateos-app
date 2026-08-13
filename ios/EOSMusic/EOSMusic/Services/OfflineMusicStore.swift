import AVFoundation
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
    private let minFreeBytes: Int64 = 40 * 1024 * 1024
    private let transfers = BackgroundTransferService.shared

    private init() {
        AppDocuments.ensureStructure()
        root = AppDocuments.downloads
        legacyRoot = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("OfflineMusic", isDirectory: true)
        indexURL = root.appendingPathComponent(".eos-index.json")
        migrateLegacyStorageIfNeeded()
        loadIndex()
        pruneMissingEntries()
    }

    var downloadsDirectory: URL { root }

    var downloadedFileCount: Int { entries.count }

    var totalDownloadedBytes: Int64 {
        entries.keys.reduce(Int64(0)) { sum, url in
            sum + (fileSize(for: url) ?? 0)
        }
    }

    func isAvailable(_ trackUrl: String) -> Bool {
        localURL(for: trackUrl) != nil
    }

    /// Read-only lookup — never mutates the index. Call `pruneMissingEntries()` to clean stale rows.
    func localURL(for trackUrl: String) -> URL? {
        guard let entry = entries[trackUrl] else { return nil }
        let file = root.appendingPathComponent(entry.fileName)
        guard FileManager.default.fileExists(atPath: file.path) else { return nil }
        return file
    }

    /// Removes index rows whose files are gone on disk.
    @discardableResult
    func pruneMissingEntries() -> Int {
        let before = entries.count
        let kept = entries.filter { _, entry in
            FileManager.default.fileExists(atPath: root.appendingPathComponent(entry.fileName).path)
        }
        guard kept.count != before else { return 0 }
        entries = kept
        saveIndex()
        EOSPerfLog.download.info("pruneMissing removed=\(before - kept.count)")
        return before - kept.count
    }

    func availableDiskBytes() -> Int64? {
        guard let values = try? root.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]),
              let available = values.volumeAvailableCapacityForImportantUsage else {
            return StorageCapacityReader.deviceVolume(for: root)?.freeBytes
        }
        return Int64(max(0, available))
    }

    /// Rejects tiny / empty downloads. Optionally probes duration via AVURLAsset.
    func validateAudioFile(at url: URL, requireDuration: Bool = false) async -> Bool {
        guard let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize, size > 1024 else {
            return false
        }
        guard requireDuration else { return true }
        let asset = AVURLAsset(url: url)
        do {
            let duration = try await asset.load(.duration)
            return duration.seconds.isFinite && duration.seconds > 0.25
        } catch {
            // Some valid MP3s are slow to parse; size check already passed.
            EOSPerfLog.download.warning("duration probe failed path=\(url.lastPathComponent, privacy: .public)")
            return true
        }
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
        if let free = availableDiskBytes(), free < minFreeBytes {
            throw APIError.server("Za mało miejsca na urządzeniu, żeby pobrać ten utwór.")
        }

        let fileName = fileName(for: title, artist: artist, trackUrl: trackUrl)
        let destination = root.appendingPathComponent(fileName)
        let tempURL = root.appendingPathComponent("." + fileName + ".part")

        if FileManager.default.fileExists(atPath: tempURL.path) {
            try? FileManager.default.removeItem(at: tempURL)
        }

        var timedRequest = request
        if timedRequest.timeoutInterval < 120 {
            timedRequest.timeoutInterval = 3600
        }

        let progressBox = onProgress
        let downloadedTemp: URL
        do {
            downloadedTemp = try await transfers.download(
                request: timedRequest,
                partURL: tempURL,
                trackKey: trackUrl,
                onProgress: { fraction in
                    progressBox?(fraction)
                }
            )
        } catch is CancellationError {
            transfers.cancel(trackKey: trackUrl)
            cleanupPart(tempURL)
            throw APIError.server("Anulowano.")
        } catch {
            cleanupPart(tempURL)
            throw error
        }

        try Task.checkCancellation()

        // Stage into .part then atomic replace destination.
        if FileManager.default.fileExists(atPath: tempURL.path) {
            try? FileManager.default.removeItem(at: tempURL)
        }
        try FileManager.default.moveItem(at: downloadedTemp, to: tempURL)

        let valid = await validateAudioFile(at: tempURL, requireDuration: true)
        guard valid else {
            cleanupPart(tempURL)
            throw APIError.server("Pobrany plik jest uszkodzony lub pusty.")
        }

        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: tempURL, to: destination)
        onProgress?(1)

        entries[trackUrl] = OfflineTrackEntry(
            url: trackUrl,
            fileName: fileName,
            title: title,
            artist: artist,
            downloadJobId: downloadJobId,
            savedAt: Date()
        )
        if let size = try? destination.resourceValues(forKeys: [.fileSizeKey]).fileSize {
            sizeCache[trackUrl] = Int64(size)
        } else {
            sizeCache.removeValue(forKey: trackUrl)
        }
        saveIndex()
        EOSPerfLog.download.info("saved track=\(trackUrl, privacy: .public) file=\(fileName, privacy: .public)")
    }

    private var sizeCache: [String: Int64] = [:]

    func fileSize(for trackUrl: String) -> Int64? {
        if let cached = sizeCache[trackUrl] { return cached }
        guard let url = localURL(for: trackUrl) else { return nil }
        guard let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize else { return nil }
        let value = Int64(size)
        sizeCache[trackUrl] = value
        return value
    }

    /// Preload sizes for list screens — one pass, no per-row disk hits during scroll.
    func cachedSizes(for trackUrls: [String]) -> [String: Int64] {
        var map: [String: Int64] = [:]
        map.reserveCapacity(trackUrls.count)
        for url in trackUrls {
            if let size = fileSize(for: url) {
                map[url] = size
            }
        }
        return map
    }

    func remove(_ trackUrl: String) {
        if let entry = entries[trackUrl] {
            let file = root.appendingPathComponent(entry.fileName)
            try? FileManager.default.removeItem(at: file)
        }
        entries.removeValue(forKey: trackUrl)
        sizeCache.removeValue(forKey: trackUrl)
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
        sizeCache.removeAll()
        saveIndex()
    }

    func cancelInFlight(trackUrl: String) {
        transfers.cancel(trackKey: trackUrl)
        // Best-effort: remove any .part for known file name pattern.
        if let entry = entries[trackUrl] {
            cleanupPart(root.appendingPathComponent("." + entry.fileName + ".part"))
        }
    }

    private func cleanupPart(_ url: URL) {
        if FileManager.default.fileExists(atPath: url.path) {
            try? FileManager.default.removeItem(at: url)
        }
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

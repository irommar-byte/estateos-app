import Foundation

final class LibraryStore {
    let root: URL
    let deviceID: String
    private(set) var assets: [String: LibraryAsset] = [:] {
        didSet { visibleCache = nil }
    }
    private(set) var localToHash: [String: String] = [:] {
        didSet { hashToLocal = nil }
    }
    /// Bumps whenever the local ↔ server mapping changes, so callers can cache counts.
    private(set) var mapRevision = 0
    private var hashToLocal: [String: String]?
    private var visibleCache: [LibraryAsset]?
    private let writer = DispatchQueue(label: "galleryos.store.writer", qos: .utility)
    private var snapshotDirty = false
    private var mapDirty = false
    private var flushScheduled = false
    private(set) var people: [String: [String]] = [:]
    /// Local ids hidden before a server record exists. The journal flag covers everything already copied.
    private(set) var concealed = Set<String>()
    private(set) var serverCursor = 0
    private var nextSeq = 1

    init(root: URL, deviceID: String) {
        self.root = root
        self.deviceID = deviceID
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        load()
    }

    static func live() -> LibraryStore {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let root = base.appendingPathComponent("GalleryOS", isDirectory: true)
        return LibraryStore(root: root, deviceID: GalleryKeychain.deviceID())
    }

    func hash(forLocal id: String) -> String? { localToHash[id] }

    func localID(forHash hash: String) -> String? {
        if let hashToLocal { return hashToLocal[hash] }
        var index: [String: String] = [:]
        index.reserveCapacity(localToHash.count)
        for (local, hash) in localToHash { index[hash] = local }
        hashToLocal = index
        return index[hash]
    }

    func remember(local: String, hash: String) {
        guard localToHash[local] != hash else { return }
        localToHash[local] = hash
        mapRevision &+= 1
        saveMap()
    }

    func detachLocal(_ id: String) {
        detachLocals([id])
    }

    func detachLocals(_ ids: [String]) {
        var changed = false
        for id in ids where localToHash.removeValue(forKey: id) != nil {
            changed = true
        }
        if changed {
            mapRevision &+= 1
            saveMap()
        }
    }

    var mappedLocalIDs: [String] { Array(localToHash.keys) }

    func visible(now: Date = .now) -> [LibraryAsset] {
        if let visibleCache { return visibleCache }
        let sorted = assets.values.filter { LibraryRules.isVisible($0) }.sorted { $0.created < $1.created }
        visibleCache = sorted
        return sorted
    }

    func trashed(now: Date = .now) -> [LibraryAsset] {
        assets.values.filter { LibraryRules.isInTrash($0, now: now) }.sorted { $0.created < $1.created }
    }

    func conceal(_ id: String) {
        guard concealed.insert(id).inserted else { return }
        saveConcealed()
    }

    func reveal(_ id: String) {
        guard concealed.remove(id) != nil else { return }
        saveConcealed()
    }

    func isConcealed(_ id: String) -> Bool { concealed.contains(id) }

    func albumNames() -> [String] {
        Set(assets.values.flatMap(\.albumNames)).sorted()
    }

    func assets(inAlbum name: String, now: Date = .now) -> [LibraryAsset] {
        visible(now: now).filter { $0.albumNames.contains(name) }
    }

    @discardableResult
    func append(_ asset: LibraryAsset, at date: Date = .now) -> JournalLine {
        var stored = asset
        stored.updatedAt = date
        let line = JournalLine(seq: nextSeq, device: deviceID, at: date, asset: stored)
        nextSeq += 1
        assets[stored.hash] = stored
        appendLine(line)
        saveSnapshot()
        return line
    }

    func merge(_ lines: [JournalLine]) {
        let combined = JournalCodec.decode(journalData()) + lines
        assets = LibraryRules.merge(combined)
        let own = combined.filter { $0.device == deviceID }.map(\.seq).max() ?? 0
        nextSeq = max(nextSeq, own + 1)
        saveSnapshot()
    }

    func setCursor(_ value: Int) {
        serverCursor = value
        saveSnapshot()
    }

    func setPeople(_ value: [String: [String]]) {
        people = value
        savePeople()
    }

    func journalFile() -> URL {
        let folder = root.appendingPathComponent("device", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("journal-\(deviceID).jsonl")
    }

    func purgeLocalOriginals() {
        var urls: [URL] = []
        for asset in assets.values {
            guard localID(forHash: asset.hash) != nil else { continue }
            for resource in asset.resources {
                urls.append(replicaURL(CatalogPaths.original(hash: resource.hash, ext: resource.ext)))
            }
        }
        guard !urls.isEmpty else { return }
        writer.async {
            let files = FileManager.default
            for url in urls where files.fileExists(atPath: url.path) {
                try? files.removeItem(at: url)
            }
        }
    }

    /// Writes pending snapshot and map changes now. Call before the app can be suspended.
    func flush() {
        flushScheduled = false
        let snapshot = snapshotDirty ? SnapshotFile(assets: assets, serverCursor: serverCursor, nextSeq: nextSeq) : nil
        let map = mapDirty ? localToHash : nil
        snapshotDirty = false
        mapDirty = false
        guard snapshot != nil || map != nil else { return }
        let root = root
        writer.async {
            if let snapshot { Self.write(snapshot, name: "snapshot.json", root: root) }
            if let map { Self.write(map, name: "map.json", root: root) }
        }
    }

    /// Blocks until queued writes reach disk.
    func flushAndWait() {
        flush()
        writer.sync {}
    }

    func replicaURL(_ relative: String) -> URL {
        root.appendingPathComponent("replica", isDirectory: true).appendingPathComponent(relative)
    }

    func bookmarkURL() -> URL {
        root.appendingPathComponent("folder.bookmark")
    }

    private func load() {
        localToHash = read([String: String].self, name: "map.json") ?? [:]
        people = read([String: [String]].self, name: "people.json") ?? [:]
        concealed = Set(read([String].self, name: "concealed.json") ?? [])
        if let snapshot = read(SnapshotFile.self, name: "snapshot.json") {
            assets = snapshot.assets
            serverCursor = snapshot.serverCursor
            nextSeq = snapshot.nextSeq
        }
        let own = JournalCodec.decode(journalData()).filter { $0.device == deviceID }.map(\.seq).max() ?? 0
        nextSeq = max(nextSeq, own + 1)
        if assets.isEmpty {
            assets = LibraryRules.merge(JournalCodec.decode(journalData()))
        }
    }

    private func journalData() -> Data {
        (try? Data(contentsOf: journalFile())) ?? Data()
    }

    private func appendLine(_ line: JournalLine) {
        let data = JournalCodec.encode([line])
        let url = journalFile()
        if FileManager.default.fileExists(atPath: url.path) {
            if let handle = try? FileHandle(forWritingTo: url) {
                defer { try? handle.close() }
                _ = try? handle.seekToEnd()
                try? handle.write(contentsOf: data)
                return
            }
        }
        try? data.write(to: url, options: .atomic)
    }

    // Encoding the whole catalogue on every uploaded photo stalls the main thread, so
    // snapshot and map writes are coalesced and encoded off the main thread.
    private func saveSnapshot() {
        snapshotDirty = true
        scheduleFlush()
    }

    private func saveMap() {
        mapDirty = true
        scheduleFlush()
    }

    private func scheduleFlush() {
        guard !flushScheduled else { return }
        flushScheduled = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self, self.flushScheduled else { return }
            self.flush()
        }
    }

    private func saveConcealed() {
        let ids = Array(concealed)
        let root = root
        writer.async { Self.write(ids, name: "concealed.json", root: root) }
    }

    private func savePeople() {
        let people = people
        let root = root
        writer.async { Self.write(people, name: "people.json", root: root) }
    }

    private func read<T: Decodable>(_ type: T.Type, name: String) -> T? {
        let url = root.appendingPathComponent(name)
        guard let data = try? Data(contentsOf: url) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = FastDate.decoding
        return try? decoder.decode(type, from: data)
    }

    private static func write<T: Encodable>(_ value: T, name: String, root: URL) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = FastDate.encoding
        guard let data = try? encoder.encode(value) else { return }
        try? data.write(to: root.appendingPathComponent(name), options: .atomic)
    }
}

private struct SnapshotFile: Codable {
    var assets: [String: LibraryAsset]
    var serverCursor: Int
    var nextSeq: Int
}

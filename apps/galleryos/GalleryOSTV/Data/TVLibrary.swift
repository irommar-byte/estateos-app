import CryptoKit
import Foundation

/// Connection state for the status pill and Settings. Kept apart from `TVLibrary` so a
/// refresh every few minutes never re-renders the photo grids.
@MainActor
final class TVLinkState: ObservableObject {
    enum Kind: Equatable {
        case connecting
        case online(TVLinkRoute)
        case offline(String)
    }

    @Published private(set) var kind: Kind = .connecting
    @Published private(set) var updatedAt: Date?
    @Published private(set) var refreshing = false

    func set(_ value: Kind) { if kind != value { kind = value } }
    func setUpdated(_ value: Date?) { updatedAt = value }
    func setRefreshing(_ value: Bool) { if refreshing != value { refreshing = value } }
}

/// Bumped when place names arrive from reverse geocoding.
@MainActor
final class TVPlaceFeed: ObservableObject {
    @Published private(set) var revision = 0
    func bump() { revision &+= 1 }
}

@MainActor
final class TVLibrary: ObservableObject {
    enum Phase: Equatable {
        case idle
        case connecting
        case ready
        case failed(String)
    }

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var model = GridModel.empty
    @Published private(set) var albums: [TVAlbum] = []
    @Published private(set) var mediaTypes: [TVAlbum] = []
    @Published private(set) var favorites: [PhotoRef] = []

    let pipeline = TVImagePipeline()
    let link = TVLinkState()
    let placeFeed = TVPlaceFeed()
    private var pulling = false

    private(set) var assets: [String: LibraryAsset] = [:]
    private var blobs: [String: String] = [:]
    private var lines: [String: JournalLine] = [:]
    private var cursor = 0
    private var server: AppleTVServer?
    private var password = ""
    private var loop: Task<Void, Never>?
    private var geocoder: TVPlaces?
    private var namespace = "default"
    private var rebuildGeneration = 0

    var isEmpty: Bool { model.all.isEmpty }
    var photoCount: Int { model.all.count }

    // MARK: Lifecycle

    /// Layout pass only. A normal launch never calls this.
    func loadPreview() {
        let calendar = Calendar.current
        let spots: [(String, Double, Double)] = [
            ("Warszawa, Mazowieckie", 52.23, 21.01), ("Kraków, Małopolskie", 50.06, 19.94),
            ("Gdańsk, Pomorskie", 54.35, 18.65), ("Zakopane, Małopolskie", 49.30, 19.95),
            ("Rzym, Lacjum", 41.90, 12.50), ("Barcelona, Katalonia", 41.39, 2.17)
        ]
        var photos: [PhotoRef] = []
        for day in 0..<18 {
            let date = calendar.date(byAdding: .day, value: -day * 4, to: Date()) ?? Date()
            let spot = spots[day % spots.count]
            for index in 0..<7 {
                var traits = PhotoTraits()
                if index == 0 { traits.insert(.video) }
                if index == 2 { traits.insert(.live) }
                if index == 4 { traits.insert(.portrait) }
                photos.append(PhotoRef(
                    id: "cloud:preview-\(day)-\(index)",
                    created: date.addingTimeInterval(TimeInterval(index * 90)),
                    pixelWidth: 4032,
                    pixelHeight: 3024,
                    traits: traits,
                    isFavorite: index == 1,
                    latitude: spot.1 + Double(index) * 0.001,
                    longitude: spot.2 + Double(index) * 0.001,
                    duration: index == 0 ? 34 : 0,
                    cloudHash: "preview-\(day)-\(index)"
                ))
            }
        }
        model = GridModel(photos: photos)
        favorites = photos.filter(\.isFavorite).reversed()
        let newest = Array(model.all.reversed())
        albums = [
            TVAlbum(name: "Wakacje", photos: Array(newest.prefix(12))),
            TVAlbum(name: "Rodzina", photos: Array(newest.dropFirst(12).prefix(9))),
            TVAlbum(name: "Dom", photos: Array(newest.suffix(8)))
        ]
        mediaTypes = TVCatalog.mediaTypes(from: newest)
        let places = TVPlaces(folder: FileManager.default.temporaryDirectory.appendingPathComponent("tv-preview"))
        places.seed(Dictionary(uniqueKeysWithValues: spots.map { (TVPlaces.key($0.1, $0.2), $0.0) }))
        geocoder = places
        phase = .ready
        link.set(.online(.home("TS253D")))
        link.setUpdated(.now)
    }

    func start(server: AppleTVServer, password: String) {
        // Keep the last snapshot on screen while reconnecting — never flash empty tabs.
        loop?.cancel()
        loop = nil
        self.server = server
        self.password = password
        namespace = Self.namespace(for: server)
        pipeline.configure(namespace: namespace)
        geocoder = TVPlaces(folder: pipeline.folder)
        if model.all.isEmpty {
            setPhase(.connecting)
        }
        link.set(.connecting)
        loop = Task { [weak self] in
            await self?.restoreSnapshot()
            await self?.cycle()
        }
    }

    func stop() {
        rebuildGeneration &+= 1
        loop?.cancel()
        loop = nil
        pipeline.attach(nil)
        lines = [:]
        assets = [:]
        blobs = [:]
        cursor = 0
        model = .empty
        albums = []
        mediaTypes = []
        favorites = []
        phase = .idle
        pulling = false
        link.set(.connecting)
        link.setUpdated(nil)
        link.setRefreshing(false)
    }

    private func setPhase(_ value: Phase) {
        if phase != value { phase = value }
    }

    func retry() {
        guard let server else { return }
        // Reconnect without wiping a usable snapshot.
        start(server: server, password: password)
    }

    func refresh() {
        guard server != nil, !pulling else { return }
        Task { await pull() }
    }

    func clearCaches() {
        pipeline.clearDisk()
        pipeline.attach(pipeline.currentTransport())
    }

    // MARK: Lookup

    func asset(for photo: PhotoRef) -> LibraryAsset? {
        guard let hash = photo.cloudHash else { return nil }
        return assets[hash]
    }

    func placeName(for photo: PhotoRef) -> String? {
        guard let latitude = photo.latitude, let longitude = photo.longitude else { return nil }
        return geocoder?.name(latitude: latitude, longitude: longitude)
    }

    func search(_ text: String) -> [PhotoRef] {
        TVCatalog.search(text, photos: model.all, blobs: blobs, extra: geocoder?.blob() ?? [:])
    }

    /// Photos grouped by place for the map, biggest first. Runs off the main thread.
    func places() async -> [TVPlace] {
        let photos = model.all
        let names = geocoder?.allNames() ?? [:]
        return await Task.detached(priority: .userInitiated) {
            TVCatalog.places(from: photos, names: names)
        }.value
    }

    // MARK: Loading

    private func cycle() async {
        while !Task.isCancelled {
            await pull()
            let wait: UInt64 = phaseIsFailed ? 20 : 300
            try? await Task.sleep(nanoseconds: wait * 1_000_000_000)
        }
    }

    private var phaseIsFailed: Bool {
        if case .failed = phase { return true }
        if case .offline = link.kind { return true }
        return false
    }

    private func pull() async {
        guard let server, !pulling else { return }
        pulling = true
        link.setRefreshing(true)
        defer {
            pulling = false
            link.setRefreshing(false)
        }
        do {
            var transport = pipeline.currentTransport()
            if transport == nil {
                if !hasContent { setPhase(.connecting) }
                link.set(.connecting)
                let connection = try await TVConnector.connect(server, password: password)
                route = connection.route
                transport = connection.transport
                pipeline.attach(connection.transport)
            }
            guard let transport else { return }
            do {
                try await ingest(from: transport)
            } catch {
                pipeline.attach(nil)
                let fresh = try await TVConnector.connect(server, password: password)
                route = fresh.route
                pipeline.attach(fresh.transport)
                try await ingest(from: fresh.transport)
            }
            link.setUpdated(.now)
            link.set(.online(route ?? .remote(server.host)))
            setPhase(.ready)
            warmVisibleThumbs()
            pipeline.trimOriginals()
        } catch {
            let message = SyncPause.message(for: error)
            link.set(.offline(message))
            if hasContent {
                setPhase(.ready)
                if pipeline.currentTransport() != nil {
                    warmVisibleThumbs()
                }
            } else {
                setPhase(.failed(message))
            }
        }
    }

    private var route: TVLinkRoute?

    private var hasContent: Bool { !model.all.isEmpty }

    private func warmVisibleThumbs() {
        let newest = model.all.reversed().prefix(TVMediaPolicy.warmThumbCount).compactMap(\.cloudHash)
        pipeline.warmRecent(hashes: Array(newest))
    }

    @discardableResult
    private func ingest(from transport: CatalogTransport) async throws -> Bool {
        var incoming: [JournalLine] = []
        var nextCursor = cursor
        var serverHadPage = false
        if let server = transport as? ServerTransport {
            let page = try await server.changes(cursor: cursor)
            incoming.append(contentsOf: page.lines)
            nextCursor = page.cursor
            serverHadPage = true
            // Incremental path: skip re-reading every journal file when nothing changed.
            if page.lines.isEmpty, !model.all.isEmpty {
                cursor = nextCursor
                return false
            }
        }
        if !serverHadPage || !incoming.isEmpty || model.all.isEmpty {
            let names = (try? await transport.list(CatalogPaths.state)) ?? []
            for name in names where name.hasPrefix("journal-") && name.hasSuffix(".jsonl") {
                let data = try await transport.readFile("\(CatalogPaths.state)/\(name)")
                incoming.append(contentsOf: JournalCodec.decode(data))
            }
        }
        let changed = merge(incoming)
        cursor = nextCursor
        if changed || model.all.isEmpty {
            await rebuild()
            saveSnapshot()
            return true
        }
        return false
    }

    @discardableResult
    private func merge(_ incoming: [JournalLine]) -> Bool {
        TVCatalog.merge(incoming, into: &lines)
    }

    private func rebuild() async {
        rebuildGeneration &+= 1
        let token = rebuildGeneration
        let assets = lines.values.map(\.asset)
        let snapshot = await Task.detached(priority: .userInitiated) {
            TVCatalog.build(from: assets)
        }.value
        guard !Task.isCancelled, token == rebuildGeneration else { return }
        apply(snapshot)
    }

    private func apply(_ snapshot: TVSnapshot) {
        assets = snapshot.assets
        blobs = snapshot.blobs
        if model != snapshot.model {
            model = snapshot.model
        }
        if albums != snapshot.albums {
            albums = snapshot.albums
        }
        if mediaTypes != snapshot.mediaTypes {
            mediaTypes = snapshot.mediaTypes
        }
        if favorites.map(\.id) != snapshot.favorites.map(\.id) {
            favorites = snapshot.favorites
        }
        pipeline.noteAssets(snapshot.assets)
        // Names only reach the map screen; the photo grids never hear about them.
        let feed = placeFeed
        geocoder?.index(snapshot.model.all) {
            Task { @MainActor in feed.bump() }
        }
    }

    // MARK: Snapshot on disk

    private var snapshotURL: URL { pipeline.folder.appendingPathComponent("snapshot.jsonl") }
    private var cursorURL: URL { pipeline.folder.appendingPathComponent("cursor.txt") }

    private func restoreSnapshot() async {
        let file = snapshotURL
        let cursorFile = cursorURL
        let loaded: ([JournalLine], Int) = await Task.detached(priority: .userInitiated) {
            let data = (try? Data(contentsOf: file)) ?? Data()
            let value = (try? String(contentsOf: cursorFile, encoding: .utf8)).flatMap { Int($0.trimmingCharacters(in: .whitespacesAndNewlines)) } ?? 0
            return (JournalCodec.decode(data), value)
        }.value
        guard !loaded.0.isEmpty else { return }
        merge(loaded.0)
        cursor = loaded.1
        await rebuild()
        link.setUpdated((try? FileManager.default.attributesOfItem(atPath: file.path)[.modificationDate]) as? Date)
        setPhase(.ready)
    }

    private func saveSnapshot() {
        let data = JournalCodec.encode(Array(lines.values))
        let file = snapshotURL
        let cursorFile = cursorURL
        let value = cursor
        Task.detached(priority: .utility) {
            try? FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? data.write(to: file, options: .atomic)
            try? String(value).write(to: cursorFile, atomically: true, encoding: .utf8)
        }
    }

    private static func namespace(for server: AppleTVServer) -> String {
        let digest = SHA256.hash(data: Data("\(server.id)|\(server.host)|\(server.directory)".utf8))
        return digest.prefix(8).map { String(format: "%02x", $0) }.joined()
    }
}

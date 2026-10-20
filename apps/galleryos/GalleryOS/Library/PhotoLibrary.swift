import CoreLocation
import Foundation
import MapKit
import Photos
import PhotosUI
import UIKit
import Vision

@MainActor
final class PhotoLibrary: NSObject, ObservableObject {
    @Published private(set) var authorization: PHAuthorizationStatus
    @Published private(set) var grid = GridModel.empty
    @Published private(set) var phoneGrid = GridModel.empty
    @Published private(set) var serverGrid = GridModel.empty
    @Published private(set) var albums: [AlbumRecord] = []
    @Published private(set) var isLoading = false
    @Published private(set) var placeNames: [String: String] = [:]
    @Published private(set) var labels: [String: [String]] = [:]
    @Published private(set) var indexing = false
    @Published var generation = 0
    @Published var cloudRevision = 0

    private var assets: [String: PHAsset] = [:]
    private var localPhotos: [PhotoRef] = []
    private var outsidePhotos: [String: PhotoRef] = [:]
    private var localAlbums: [AlbumRecord] = []
    private var albumMembers: [String: [String]] = [:]
    private var albumGrids: [String: GridModel] = [:]
    private var lastSignature: [String] = []
    private let imageManager = PHCachingImageManager()
    private var reloadTask: Task<Void, Never>?
    private var indexTask: Task<Void, Never>?
    private var placeTasks: [String: Task<Void, Never>] = [:]
    private var pendingPlaces: [String: String] = [:]
    private var placeFlushTask: Task<Void, Never>?
    private var pendingLabels: [String: [String]] = [:]
    private var labelFlushTask: Task<Void, Never>?
    private var observed = false
    private var lastCloudPrep: [String: Date] = [:]

    override init() {
        authorization = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        super.init()
        labels = LabelStore.load()
        LibraryEngine.shared.attach(self)
    }

    var cachingManager: PHCachingImageManager { imageManager }

    func prepare() {
        authorization = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard authorization == .authorized || authorization == .limited else { return }
        observe()
        scheduleReload()
    }

    func requestAccess() {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { [weak self] status in
            Task { @MainActor in
                guard let self else { return }
                self.authorization = status
                guard status == .authorized || status == .limited else { return }
                self.observe()
                self.scheduleReload()
            }
        }
    }

    func presentLimitedPicker(from controller: UIViewController) {
        PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: controller)
    }

    func asset(id: String) -> PHAsset? {
        if let cached = assets[id] { return cached }
        let local = id.hasPrefix("cloud:") ? LibraryEngine.shared.localIdentifier(forCloud: id) : id
        guard let local, !local.hasPrefix("galleryos.") else { return nil }
        if let cached = assets[local] { return cached }
        let fetched = PHAsset.fetchAssets(withLocalIdentifiers: [local], options: nil).firstObject
        if let fetched { assets[local] = fetched }
        return fetched
    }

    /// Album create, rename and delete must show up at once. The normal reload waits
    /// out the sync, and a busy library keeps postponing it.
    func reloadNow() {
        reloadTask?.cancel()
        reloadTask = Task { [weak self] in await self?.load() }
    }

    func photo(id: String) -> PhotoRef? {
        phoneGrid.all.first { $0.id == id }
            ?? serverGrid.all.first { $0.id == id }
            ?? grid.all.first { $0.id == id }
    }

    func grid(albumID: String?) -> GridModel {
        guard let albumID else { return grid }
        if albumID == "galleryos.trash" {
            return GridModel(photos: LibraryEngine.shared.trashedRefs())
        }
        if albumID.hasPrefix("galleryos.album.") {
            let name = String(albumID.dropFirst("galleryos.album.".count))
            return GridModel(photos: LibraryEngine.shared.albumRefs(name))
        }
        if let cached = albumGrids[albumID] { return cached }
        let photos = (albumMembers[albumID] ?? []).compactMap { id in
            grid.all.first { $0.id == id } ?? outsidePhotos[id]
        }
        let model = GridModel(photos: photos)
        albumGrids[albumID] = model
        return model
    }

    func album(id: String) -> AlbumRecord? {
        albums.first { $0.id == id }
    }

    func resolvePlaces(_ requests: [PlaceRequest]) {
        guard placeTasks.count < 2 else { return }
        guard let request = requests.first(where: {
            placeNames[$0.dayKey] == nil
                && pendingPlaces[$0.dayKey] == nil
                && placeTasks[$0.dayKey] == nil
        }) else { return }
        if let saved = PlaceCache.name(for: request.dayKey) {
            queuePlace(request.dayKey, saved)
            return
        }
        placeTasks[request.dayKey] = Task { [weak self] in
            await self?.geocode(request)
        }
    }

    func setFavorite(_ favorite: Bool, ids: [String]) {
        let targets = ids.compactMap { assets[$0] }
        if !targets.isEmpty {
            PHPhotoLibrary.shared().performChanges {
                for asset in targets {
                    PHAssetChangeRequest(for: asset).isFavorite = favorite
                }
            }
        }
        for index in localPhotos.indices where ids.contains(localPhotos[index].id) {
            localPhotos[index].isFavorite = favorite
        }
        LibraryEngine.shared.updateFavorite(favorite, ids: ids)
        overlayCatalog()
    }

    func delete(ids: [String]) {
        let targets = ids.compactMap { assets[$0] }
        if !targets.isEmpty {
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.deleteAssets(targets as NSArray)
            }
        }
        LibraryEngine.shared.releaseFromPhone(ids: ids)
        overlayCatalog()
    }

    func userAlbumNames(for id: String) -> [String] {
        localAlbums.filter { !$0.system && albumMembers[$0.id]?.contains(id) == true }.map(\.title)
    }

    func thumbnail(id: String) -> UIImage? {
        LibraryEngine.shared.thumbnail(id: id)
    }

    func people(for photo: PhotoRef) -> [String] {
        LibraryEngine.shared.people(for: photo.cloudHash.map { "cloud:\($0)" } ?? photo.id)
    }

    func cloudMedia(id: String) -> CloudMedia? {
        LibraryEngine.shared.cloudMedia(id: id)
    }

    func prepareCloud(id: String) async {
        // Avoid republishing the viewer on every swipe when files are already local.
        if let last = lastCloudPrep[id], Date().timeIntervalSince(last) < 2 {
            return
        }
        let before = cloudMedia(id: id)
        await LibraryEngine.shared.prepareDisplay(id: id)
        lastCloudPrep[id] = .now
        let after = cloudMedia(id: id)
        let changed = before?.still?.path != after?.still?.path
            || before?.video?.path != after?.video?.path
        if changed { cloudRevision += 1 }
    }

    var destinationConnected: Bool { DestinationSettings.load().connected }

    var syncStatus: SyncStatus {
        get { SyncFeed.shared.status }
        set {
            guard SyncFeed.shared.status != newValue else { return }
            SyncFeed.shared.status = newValue
        }
    }

    func isUploaded(_ id: String) -> Bool {
        if id.hasPrefix("cloud:") { return true }
        return LibraryEngine.shared.isUploaded(id)
    }

    func freeSpaceText() async -> String {
        if let bytes = await LibraryEngine.shared.freeSpace() {
            return ByteText.amount(bytes)
        }
        return "Serwer nie podał wolnego miejsca"
    }

    var keptOnServer: Int {
        serverGrid.all.filter { $0.id.hasPrefix("cloud:") }.count
    }

    func syncMark(for id: String) -> PhotoSyncMark {
        guard destinationConnected else { return .hidden }
        if id.hasPrefix("cloud:") { return .serverOnly }
        if LibraryEngine.shared.isDuplicate(id) { return .duplicate }
        return isUploaded(id) ? .sent : .waiting
    }

    func syncCounts() -> (sent: Int, waiting: Int) {
        guard destinationConnected else { return (0, 0) }
        let waiting = phoneGrid.all.filter { !isUploaded($0.id) }.count
        return (serverGrid.all.count, waiting)
    }

    func removeSyncedCopies() async -> String {
        await LibraryEngine.shared.removeSyncedFromPhone()
    }

    func connectDestination() async throws -> String {
        try await LibraryEngine.shared.connect()
    }

    func useThisPhone() {
        LibraryEngine.shared.useThisPhone()
        syncStatus = .hidden
    }

    func overlayCatalog() {
        let nextPhone = GridModel(photos: LibraryEngine.shared.phoneRefs(local: localPhotos))
        let nextServer = GridModel(photos: LibraryEngine.shared.serverRefs())
        let nextGrid = GridModel(photos: LibraryEngine.shared.merged(local: localPhotos))
        let remote = LibraryEngine.shared.supplementalAlbums()
        let titles = Set(localAlbums.map { $0.title.lowercased() })
        let merged = localAlbums + remote.filter { record in
            record.id == "galleryos.trash" || !titles.contains(record.title.lowercased())
        }
        var seen = Set<String>()
        let nextAlbums = merged.filter { seen.insert($0.id).inserted }
        let signature = (nextPhone.all + nextServer.all).map(\.id)
        let idsChanged = signature != lastSignature
        let albumsChanged = nextAlbums.map(\.id) != albums.map(\.id)
            || nextAlbums.map(\.count) != albums.map(\.count)
        // Skip no-op publishes so sync ticks do not rebuild every grid consumer.
        if idsChanged || phoneGrid.all.map(\.id) != nextPhone.all.map(\.id) {
            phoneGrid = nextPhone
        }
        if idsChanged || serverGrid.all.map(\.id) != nextServer.all.map(\.id) {
            serverGrid = nextServer
        }
        if idsChanged || grid.all.map(\.id) != nextGrid.all.map(\.id) {
            grid = nextGrid
        }
        if albumsChanged {
            albums = nextAlbums
            albumGrids.removeAll()
        }
        if idsChanged {
            lastSignature = signature
            generation += 1
            albumGrids.removeAll()
        }
    }

    private func observe() {
        guard !observed else { return }
        observed = true
        PHPhotoLibrary.shared().register(self)
    }

    private func scheduleReload() {
        reloadTask?.cancel()
        let pause: UInt64 = LibraryEngine.shared.stillCopying() ? 8_000_000_000 : 1_500_000_000
        reloadTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: pause)
            await self?.load()
        }
    }

    private func load() async {
        if grid.all.isEmpty { isLoading = true }
        let snapshot = await Task.detached(priority: .userInitiated) {
            GalleryIndex.build()
        }.value
        guard !Task.isCancelled else { return }
        assets = snapshot.assets
        localPhotos = snapshot.grid.all
        outsidePhotos = Dictionary(snapshot.outside.map { ($0.id, $0) }, uniquingKeysWith: { _, next in next })
        LibraryEngine.shared.noteSources(
            shared: snapshot.sharedAlbums,
            computer: snapshot.fromComputer,
            albumOnly: snapshot.albumOnly
        )
        localAlbums = snapshot.albums.sorted { lhs, rhs in
            if lhs.system != rhs.system { return lhs.system && !rhs.system }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
        albumMembers = snapshot.albumMembers
        LibraryEngine.shared.noteLocal(assets: assets, photos: localPhotos)
        overlayCatalog()
        isLoading = false
        startIndexing()
        LibraryEngine.shared.kick()
    }

    private func geocode(_ request: PlaceRequest) async {
        let location = CLLocation(latitude: request.latitude, longitude: request.longitude)
        var name: String?
        if let lookup = MKReverseGeocodingRequest(location: location) {
            lookup.preferredLocale = Locale(identifier: "pl_PL")
            if let item = try? await lookup.mapItems.first {
                name = Self.placeTitle(item)
            }
        }
        placeTasks[request.dayKey] = nil
        if let name {
            PlaceCache.store(name, for: request.dayKey)
            queuePlace(request.dayKey, name)
        }
    }

    private func queuePlace(_ dayKey: String, _ name: String) {
        pendingPlaces[dayKey] = name
        placeFlushTask?.cancel()
        placeFlushTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            await MainActor.run { self?.flushPlaces() }
        }
    }

    private func flushPlaces() {
        guard !pendingPlaces.isEmpty else { return }
        var next = placeNames
        for (key, name) in pendingPlaces { next[key] = name }
        pendingPlaces.removeAll()
        placeNames = next
    }

    private static func placeTitle(_ item: MKMapItem) -> String? {
        let reps = item.addressRepresentations
        let city = readable(reps?.cityName)
        let context = readable(reps?.cityWithContext)
        if let city, let context, context != city, !context.hasPrefix(city + " ") {
            return context
        }
        if let city, let context, context.hasPrefix(city), context.count > city.count + 1 {
            let rest = context.dropFirst(city.count).trimmingCharacters(in: CharacterSet(charactersIn: ", "))
            let home = Locale.current.localizedString(forRegionCode: "PL") ?? "Polska"
            if rest.caseInsensitiveCompare(home) == .orderedSame || rest.isEmpty {
                return city
            }
            if !rest.isEmpty { return "\(city), \(rest)" }
        }
        return city ?? context
    }

    private static func readable(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count >= 2 else { return nil }
        let digits = text.filter(\.isNumber).count
        if digits * 2 >= text.count { return nil }
        return text
    }

    private func startIndexing() {
        if LibraryEngine.shared.stillCopying() {
            indexing = false
            return
        }
        indexTask?.cancel()
        let pending = grid.all.reversed().map(\.id).filter { labels[$0] == nil && assets[$0]?.mediaType != .video }
        guard !pending.isEmpty else {
            indexing = false
            return
        }
        indexing = true
        indexTask = Task { [weak self] in
            await self?.index(pending)
        }
    }

    private func index(_ ids: [String]) async {
        var sinceSave = 0
        for id in ids {
            if Task.isCancelled { return }
            guard let asset = assets[id] else { continue }
            if let found = await Self.labels(for: asset, manager: imageManager) {
                pendingLabels[id] = found
                sinceSave += 1
                if sinceSave >= 24 {
                    flushLabels(save: true)
                    sinceSave = 0
                }
            }
        }
        flushLabels(save: true)
        indexing = false
    }

    private func flushLabels(save: Bool) {
        guard !pendingLabels.isEmpty else {
            if save { LabelStore.save(labels) }
            return
        }
        var next = labels
        for (id, value) in pendingLabels { next[id] = value }
        pendingLabels.removeAll()
        labels = next
        if save { LabelStore.save(labels) }
    }

    private static func labels(for asset: PHAsset, manager: PHImageManager) async -> [String]? {
        guard let image = await thumbnail(for: asset, manager: manager), let cgImage = image.cgImage else { return nil }
        let request = VNClassifyImageRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return nil
        }
        let found = (request.results ?? [])
            .filter { $0.confidence >= 0.3 }
            .prefix(6)
            .map(\.identifier)
        return Array(found)
    }

    private static func thumbnail(for asset: PHAsset, manager: PHImageManager) async -> UIImage? {
        await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.deliveryMode = .fastFormat
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = false
            options.isSynchronous = false
            let resumed = ResumeBox()
            manager.requestImage(
                for: asset,
                targetSize: CGSize(width: 384, height: 384),
                contentMode: .aspectFill,
                options: options
            ) { image, info in
                let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
                let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
                if cancelled {
                    resumed.resume(continuation, with: nil)
                    return
                }
                if degraded { return }
                resumed.resume(continuation, with: image)
            }
        }
    }
}

struct PlaceRequest: Hashable {
    let dayKey: String
    let latitude: Double
    let longitude: Double
}

private final class ResumeBox: @unchecked Sendable {
    private var done = false
    func resume(_ continuation: CheckedContinuation<UIImage?, Never>, with image: UIImage?) {
        guard !done else { return }
        done = true
        continuation.resume(returning: image)
    }
}

extension PhotoLibrary: PHPhotoLibraryChangeObserver {
    nonisolated func photoLibraryDidChange(_ changeInstance: PHChange) {
        Task { @MainActor in
            // Remote favorite/delete writes from LibraryEngine must not kick a full rebuild loop.
            if LibraryEngine.shared.isMutatingPhotos { return }
            self.scheduleReload()
        }
    }
}

enum PlaceCache {
    private static let key = "galleryos.place-names"

    static func name(for dayKey: String) -> String? {
        let stored = UserDefaults.standard.dictionary(forKey: key) as? [String: String]
        return stored?[dayKey]
    }

    static func store(_ name: String, for dayKey: String) {
        var stored = UserDefaults.standard.dictionary(forKey: key) as? [String: String] ?? [:]
        stored[dayKey] = name
        if stored.count > 400, let oldest = stored.keys.sorted().first {
            stored.removeValue(forKey: oldest)
        }
        UserDefaults.standard.set(stored, forKey: key)
    }
}

enum LabelStore {
    private static var url: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let folder = base.appendingPathComponent("GalleryOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("labels.json")
    }

    static func load() -> [String: [String]] {
        guard let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONDecoder().decode([String: [String]].self, from: data)) ?? [:]
    }

    static func save(_ labels: [String: [String]]) {
        guard let data = try? JSONEncoder().encode(labels) else { return }
        try? data.write(to: url, options: .atomic)
    }
}

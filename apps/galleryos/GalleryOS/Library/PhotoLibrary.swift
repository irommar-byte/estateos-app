import CoreLocation
import Foundation
import MapKit
import ImageIO
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
    /// Photos and films (Live Photos count as photos) on each side, for the shelf and the view menu.
    @Published private(set) var phoneCounts = MediaCounts.zero
    /// Where the photos of this device stand, for the filter chips on the device shelf.
    @Published private(set) var deviceSplit = DeviceSplit()
    /// Whose photos the server holds, for the filter chips on the server shelf.
    @Published private(set) var serverSplit = ServerSplit()
    private var filteredGrids: [String: GridModel] = [:]
    @Published private(set) var serverCounts = MediaCounts.zero
    /// One switch for Library, Collections and the map: screenshots stay in their own album only.
    @Published var hideScreenshots = UserDefaults.standard.bool(forKey: "galleryos.hide-screenshots") {
        didSet {
            guard hideScreenshots != oldValue else { return }
            UserDefaults.standard.set(hideScreenshots, forKey: "galleryos.hide-screenshots")
            overlayCatalog()
        }
    }
    /// Every photo, screenshots included: albums are looked up here, so "Zrzuty ekranu" still opens.
    private var everything: [PhotoRef] = []
    /// Lookup by id for the viewer and menus. Rebuilt lazily after any grid changes.
    private var refIndex: [String: PhotoRef] = [:]
    private var refIndexStale = true
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
    private var lastAnalysisNudge = Date.distantPast
    /// Set when what the counts depend on changes outside the grids (hidden screenshots, a delete).
    private var splitsStale = true
    private var lastSplit = Date.distantPast
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
        reloadPending = false
        reloadTask = Task { [weak self] in await self?.load() }
    }

    func photo(id: String) -> PhotoRef? {
        // The viewer asks many times per frame while it is dragged; linear scans of the whole library stuttered.
        if refIndexStale {
            var index: [String: PhotoRef] = [:]
            index.reserveCapacity(grid.all.count + serverGrid.all.count)
            for photo in grid.all { index[photo.id] = photo }
            for photo in serverGrid.all { index[photo.id] = photo }
            for photo in phoneGrid.all { index[photo.id] = photo }
            refIndex = index
            refIndexStale = false
        }
        return refIndex[id] ?? LibraryEngine.shared.hiddenRefs().first { $0.id == id }
    }

    func isConcealed(_ id: String) -> Bool {
        LibraryEngine.shared.isConcealed(id)
    }

    func sendNow(_ id: String) {
        LibraryEngine.shared.sendNow(id)
    }

    func setConcealed(_ concealed: Bool, ids: [String]) {
        LibraryEngine.shared.setConcealed(concealed, ids: ids)
    }

    func grid(albumID: String?) -> GridModel {
        guard let albumID else { return grid }
        if albumID == "galleryos.hidden" {
            return GridModel(photos: LibraryEngine.shared.hiddenRefs())
        }
        if albumID == "galleryos.trash" {
            return GridModel(photos: LibraryEngine.shared.trashedRefs())
        }
        if albumID.hasPrefix("galleryos.album.") {
            let name = String(albumID.dropFirst("galleryos.album.".count))
            return GridModel(photos: LibraryEngine.shared.albumRefs(name))
        }
        if let cached = albumGrids[albumID] { return cached }
        // One dictionary instead of a linear search per member: big albums opened with a visible pause.
        let byID = Dictionary((everything.isEmpty ? grid.all : everything).map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var photos = (albumMembers[albumID] ?? []).compactMap { id in
            byID[id] ?? outsidePhotos[id]
        }
        // With screenshots switched off they leave every album except their own.
        if hideScreenshots,
           PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumID], options: nil)
               .firstObject?.assetCollectionSubtype != .smartAlbumScreenshots {
            photos.removeAll { $0.traits.contains(.screenshot) }
        }
        let model = GridModel(photos: LibraryRules.keepingOneFilm(photos))
        albumGrids[albumID] = model
        return model
    }

    /// Photos behind one map pin. Filtered live, so deleted or hidden photos leave the place at once.
    func grid(placeIDs: [String]) -> GridModel {
        let wanted = Set(placeIDs)
        return GridModel(photos: grid.all.filter { wanted.contains($0.id) })
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
        let wanted = Set(ids)
        for index in localPhotos.indices where wanted.contains(localPhotos[index].id) {
            localPhotos[index].isFavorite = favorite
        }
        LibraryEngine.shared.updateFavorite(favorite, ids: ids)
        overlayCatalog()
    }

    /// iOS asks the user to confirm every delete. Photos leave GalleryOS only after that yes;
    /// before, "Nie zezwalaj" left them hidden here although they were still in Photos.
    /// Photos on this iPhone go to its Recently Deleted (iOS asks first).
    /// Server copies ("cloud:" ids) go to Recently Deleted on the server for 30 days.
    /// Before, deleting a server copy silently did nothing.
    @discardableResult
    func delete(ids: [String]) async -> Bool {
        let serverIDs = ids.filter { $0.hasPrefix("cloud:") }
        let phoneIDs = ids.filter { !$0.hasPrefix("cloud:") }
        let targets = phoneIDs.compactMap { assets[$0] }
        if !targets.isEmpty {
            do {
                try await PHPhotoLibrary.shared().performChanges {
                    PHAssetChangeRequest.deleteAssets(targets as NSArray)
                }
            } catch {
                return false
            }
        }
        if !phoneIDs.isEmpty { LibraryEngine.shared.releaseFromPhone(ids: phoneIDs) }
        if !serverIDs.isEmpty { LibraryEngine.shared.markDeleted(ids: serverIDs) }
        overlayCatalog()
        return true
    }

    func restoreFromTrash(ids: [String]) {
        LibraryEngine.shared.restoreFromTrash(ids: ids)
        albumGrids.removeAll()
        overlayCatalog()
    }

    /// Recently Deleted on the server → gone for good, on every device. Cannot be undone.
    func purge(ids: [String]) {
        LibraryEngine.shared.purge(ids: ids)
        albumGrids.removeAll()
        overlayCatalog()
    }

    /// Deletes from this device and moves the server copy to Recently Deleted on the server.
    @discardableResult
    func deleteEverywhere(ids: [String]) async -> Bool {
        let synced = ids.filter { !$0.hasPrefix("cloud:") && LibraryEngine.shared.isUploaded($0) }
        let cloud = synced.compactMap { id in serverID(for: id) }
        guard await delete(ids: ids) else { return false }
        if !cloud.isEmpty {
            LibraryEngine.shared.markDeleted(ids: cloud)
            albumGrids.removeAll()
            overlayCatalog()
        }
        return true
    }

    /// The server form ("cloud:<hash>") of a photo that is on this device and on the server.
    func serverID(for id: String) -> String? {
        if id.hasPrefix("cloud:") { return id }
        return LibraryEngine.shared.cloudID(forLocal: id)
    }

    func isTrashed(_ id: String) -> Bool {
        LibraryEngine.shared.isTrashed(id)
    }

    /// A purge request for these photos: your own go, other people's stay with their owner.
    func purgeRequest(_ ids: [String]) -> PurgeRequest? {
        let own = LibraryEngine.shared.purgeable(ids)
        return PurgeRequest(ids: own, others: ids.count - own.count)
    }

    /// The device shelf narrowed to one state ("Na serwerze", "Czeka"…).
    func phoneShelf(_ filter: DeviceFilter) -> GridModel {
        guard filter != .all else { return phoneGrid }
        let key = "phone." + filter.rawValue
        if let cached = filteredGrids[key] { return cached }
        let engine = LibraryEngine.shared
        let wanted: LibraryEngine.DeviceState
        switch filter {
        case .all, .onServer: wanted = .onServer
        case .waiting: wanted = .waiting
        case .notSent: wanted = .notSent
        case .deletedOnServer: wanted = .deletedOnServer
        }
        let model = GridModel(photos: phoneGrid.all.filter { engine.deviceState($0.id) == wanted })
        filteredGrids[key] = model
        return model
    }

    /// The server shelf narrowed to mine, other people's, or not on this device.
    func serverShelf(_ filter: ServerFilter) -> GridModel {
        guard filter != .all else { return serverGrid }
        let key = "server." + filter.rawValue
        if let cached = filteredGrids[key] { return cached }
        let engine = LibraryEngine.shared
        let model = GridModel(photos: serverGrid.all.filter { photo in
            switch filter {
            case .all: return true
            case .mine: return engine.serverAsset(photo.id).map { engine.isMine($0) } == true
            case .others: return engine.serverAsset(photo.id).map { engine.isMine($0) } != true
            case .notHere: return !engine.hasLocalCopy(photo.id)
            }
        })
        filteredGrids[key] = model
        return model
    }

    func deviceState(_ id: String) -> LibraryEngine.DeviceState {
        LibraryEngine.shared.deviceState(id)
    }

    func sendBatch(_ ids: [String]) -> SendBatch {
        let batch = LibraryEngine.shared.sendBatch(ids)
        overlayCatalog()
        return batch
    }

    /// Ids in Recently Deleted (for "Usuń wszystkie" / "Przywróć wszystkie").
    var trashedIDs: [String] {
        LibraryEngine.shared.trashedRefs().map(\.id)
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

    private let sharpCache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 160
        return cache
    }()

    /// A crisp frame for a server photo shown in a big tile. Uses the original when it is on the
    /// device; at home it fetches the original first. Away from home it keeps the preview.
    func sharpPreview(id: String, side: CGFloat) async -> UIImage? {
        let bucket: CGFloat = side > 1300 ? 2048 : 1280
        let key = "\(id)#\(Int(bucket))" as NSString
        if let hit = sharpCache.object(forKey: key) { return hit }
        var file = LibraryEngine.shared.localOriginal(id: id)
        if file == nil, ServerLink.shared.route == .home {
            await LibraryEngine.shared.pullOriginalQuietly(id: id)
            file = LibraryEngine.shared.localOriginal(id: id)
        }
        guard let file else { return nil }
        let image = await Task.detached(priority: .utility) {
            Self.downsample(file, side: bucket)
        }.value
        if let image { sharpCache.setObject(image, forKey: key) }
        return image
    }

    nonisolated private static func downsample(_ url: URL, side: CGFloat) -> UIImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: side
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: image)
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
        return "—"
    }

    var keptOnServer: Int {
        serverGrid.all.filter { $0.id.hasPrefix("cloud:") }.count
    }

    /// The small badge on a tile: on the server, waiting, not sent, deleted from the server; on the
    /// server shelf, a photo that is not on this device.
    func syncMark(for id: String) -> PhotoSyncMark {
        guard destinationConnected else { return .hidden }
        let engine = LibraryEngine.shared
        if id.hasPrefix("cloud:") { return engine.hasLocalCopy(id) ? .hidden : .serverOnly }
        switch engine.deviceState(id) {
        case .onServer: return .sent
        case .waiting: return .waiting
        case .notSent: return engine.isDuplicate(id) ? .duplicate : .notSent
        case .deletedOnServer: return .deletedOnServer
        }
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
        let phoneAll = LibraryEngine.shared.phoneRefs(local: localPhotos)
        let serverAll = LibraryEngine.shared.serverRefs()
        let mergedAll = LibraryEngine.shared.merged(local: localPhotos)
        everything = mergedAll
        let shown: ([PhotoRef]) -> [PhotoRef] = { [hideScreenshots] refs in
            hideScreenshots ? refs.filter { !$0.traits.contains(.screenshot) } : refs
        }
        var shots = Set<String>()
        if hideScreenshots {
            for list in [mergedAll, phoneAll, serverAll] {
                for photo in list where photo.traits.contains(.screenshot) {
                    shots.insert(photo.id)
                    if let hash = photo.cloudHash { shots.insert("cloud:\(hash)") }
                }
            }
        }
        aliasIndex = nil
        let shotsChanged = shots != hiddenScreenshotIDs
        hiddenScreenshotIDs = shots
        if shotsChanged || peopleBasis != mergedAll.count {
            // Screenshots switched, or the library grew or shrank (first load, photos freed or
            // arrived): people are counted and pictured again, once the grids below are in place.
            peopleBasis = mergedAll.count
            peopleRefresh?.cancel()
            peopleRefresh = Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(shotsChanged ? 50 : 2000))
                guard !Task.isCancelled else { return }
                PhotoIntelligence.shared.refreshPeople()
            }
        }
        // Most passes during a copy only change details of photos already on screen (a tile now
        // on the server). Those are patched in place; only new or removed photos re-sort.
        let shownPhone = shown(phoneAll)
        let shownServer = shown(serverAll)
        let shownMerged = shown(mergedAll)
        let nextPhone = phoneGrid.patched(with: shownPhone) ?? GridModel(photos: shownPhone)
        let nextServer = serverGrid.patched(with: shownServer) ?? GridModel(photos: shownServer)
        let nextGrid = grid.patched(with: shownMerged) ?? GridModel(photos: shownMerged)
        let phoneMoved = nextPhone.all != phoneGrid.all
        let serverMoved = nextServer.all != serverGrid.all
        // States that do not show in the photo itself (three failed tries, a second copy) are
        // picked up at least every 20 seconds.
        if Date().timeIntervalSince(lastSplit) > 20 { splitsStale = true }
        let phoneTally = MediaCounts(nextPhone.all)
        let serverTally = MediaCounts(nextServer.all)
        if phoneCounts != phoneTally { phoneCounts = phoneTally }
        if serverCounts != serverTally { serverCounts = serverTally }
        let engine = LibraryEngine.shared
        var device = deviceSplit
        if phoneMoved || serverMoved || splitsStale {
            device = DeviceSplit()
            for photo in nextPhone.all {
                switch engine.deviceState(photo.id) {
                case .onServer: device.onServer += 1
                case .waiting: device.waiting += 1
                case .notSent: device.notSent += 1
                case .deletedOnServer: device.deletedOnServer += 1
                }
            }
        }
        var server = serverSplit
        if phoneMoved || serverMoved || splitsStale {
            server = ServerSplit()
            for photo in nextServer.all {
                if engine.serverAsset(photo.id).map { engine.isMine($0) } == true { server.mine += 1 } else { server.others += 1 }
                if !engine.hasLocalCopy(photo.id) { server.notHere += 1 }
            }
            splitsStale = false
            lastSplit = .now
            filteredGrids.removeAll()
        }
        if deviceSplit != device { deviceSplit = device }
        if serverSplit != server { serverSplit = server }
        let remote = LibraryEngine.shared.supplementalAlbums()
        let titles = Set(localAlbums.map { $0.title.lowercased() })
        let merged = localAlbums + remote.filter { record in
            record.id == "galleryos.trash" || !titles.contains(record.title.lowercased())
        }
        var seen = Set<String>()
        let nextAlbums = merged.filter { seen.insert($0.id).inserted }
        let signature = (nextPhone.all + nextServer.all).map(\.id)
        let idsChanged = signature != lastSignature
        // Whole values, not only ids: a rename or a new cover must reach the screen too.
        let albumsChanged = nextAlbums != albums
        // Skip no-op publishes so sync ticks do not rebuild every grid consumer.
        // Compare whole photos, not only ids: a favourite flip keeps the ids and must still show.
        if idsChanged || phoneGrid.all != nextPhone.all {
            phoneGrid = nextPhone
            refIndexStale = true
        }
        if idsChanged || serverGrid.all != nextServer.all {
            serverGrid = nextServer
            refIndexStale = true
        }
        if idsChanged || grid.all != nextGrid.all {
            grid = nextGrid
            refIndexStale = true
        }
        aliasIndex = nil
        if albumsChanged {
            albums = nextAlbums
            albumGrids.removeAll()
        }
        if idsChanged {
            lastSignature = signature
            generation += 1
            albumGrids.removeAll()
            // New server photos get looked at too (from their previews). During a big copy every
            // sent photo shows up here; the analysis is nudged once a minute then, not each time.
            let copying = LibraryEngine.shared.stillCopying()
            if !copying || Date().timeIntervalSince(lastAnalysisNudge) > 60 {
                lastAnalysisNudge = .now
                PhotoIntelligence.shared.schedule(self)
            }
        }
    }

    private func observe() {
        guard !observed else { return }
        observed = true
        PHPhotoLibrary.shared().register(self)
    }

    /// Set while a reload is already on its way.
    private var reloadPending = false

    /// A steady stream of changes (iCloud syncing, edits, a big import) used to push the reload
    /// back on every change, so new photos could stay invisible until the app was restarted.
    /// Now the first change sets the moment and later ones ride along with it.
    private func scheduleReload() {
        guard !reloadPending else { return }
        reloadPending = true
        let pause: UInt64 = LibraryEngine.shared.stillCopying() ? 8_000_000_000 : 1_500_000_000
        reloadTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: pause)
            guard let self else { return }
            self.reloadPending = false
            await self.load()
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
        let name: String?
        if #available(iOS 26.0, *) {
            name = await Self.modernPlace(location)
        } else {
            name = await Self.legacyPlace(location)
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

    /// A readable place for a point ("Zakopane", "Barcelona, Katalonia"), for trips and memories.
    static func placeName(for location: CLLocation) async -> String? {
        if #available(iOS 26.0, *) {
            if let modern = await modernPlace(location) { return modern }
        }
        return await legacyPlace(location)
    }

    @available(iOS 26.0, *)
    private static func modernPlace(_ location: CLLocation) async -> String? {
        guard let lookup = MKReverseGeocodingRequest(location: location) else { return nil }
        lookup.preferredLocale = Localization.locale
        guard let item = try? await lookup.mapItems.first else { return nil }
        return placeTitle(item)
    }

    private static func legacyPlace(_ location: CLLocation) async -> String? {
        guard let mark = try? await CLGeocoder().reverseGeocodeLocation(location).first else { return nil }
        let city = readable(mark.locality ?? mark.subAdministrativeArea)
        let region = readable(mark.administrativeArea)
        let country = readable(mark.country)
        let home = Localization.locale.localizedString(forRegionCode: Locale.current.region?.identifier ?? "PL") ?? "Polska" // l10n:skip
        if let city, let region, region.caseInsensitiveCompare(home) != .orderedSame, region != city {
            return "\(city), \(region)"
        }
        if let city { return city }
        if let country, country.caseInsensitiveCompare(home) != .orderedSame { return country }
        return city ?? country
    }

    @available(iOS 26.0, *)
    private static func placeTitle(_ item: MKMapItem) -> String? {
        let reps = item.addressRepresentations
        let city = readable(reps?.cityName)
        let context = readable(reps?.cityWithContext)
        if let city, let context, context != city, !context.hasPrefix(city + " ") {
            return context
        }
        if let city, let context, context.hasPrefix(city), context.count > city.count + 1 {
            let rest = context.dropFirst(city.count).trimmingCharacters(in: CharacterSet(charactersIn: ", "))
            let home = Localization.locale.localizedString(forRegionCode: Locale.current.region?.identifier ?? "PL") ?? "Polska" // l10n:skip
            if rest.caseInsensitiveCompare(home) == .orderedSame || rest.isEmpty {
                return city
            }
            if !rest.isEmpty { return "\(city), \(rest)" }
        }
        return city ?? context
    }

    private static func legacyPlaceTitle(_ mark: CLPlacemark) -> String? {
        let city = readable(mark.locality ?? mark.subLocality)
        let region = readable(mark.administrativeArea)
        if let city, let region, region.caseInsensitiveCompare(city) != .orderedSame {
            return "\(city), \(region)"
        }
        return city ?? region
    }

    private static func readable(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count >= 2 else { return nil }
        let digits = text.filter(\.isNumber).count
        if digits * 2 >= text.count { return nil }
        return text
    }

    /// Every photo the library knows, screenshots included even when the grid hides them.
    var allPhotos: [PhotoRef] { everything.isEmpty ? grid.all : everything }

    /// Every photo the person wants to see: without screenshots while they are switched off. People,
    /// search, memories and Porządki use this, so a hidden screenshot shows up nowhere.
    var shownPhotos: [PhotoRef] {
        hideScreenshots ? allPhotos.filter { !$0.traits.contains(.screenshot) } : allPhotos
    }

    /// Screenshots kept out of sight right now (empty while they are shown).
    private(set) var hiddenScreenshotIDs = Set<String>()

    func isHiddenScreenshot(_ id: String) -> Bool {
        hiddenScreenshotIDs.contains(id)
    }

    /// Any id a photo was known by → the id it is shown under now.
    private var aliasIndex: [String: String]?
    private var peopleBasis = -1
    private var peopleRefresh: Task<Void, Never>?

    /// Faces and memories remember the id a photo had when it was looked at. Since then it may have
    /// moved: a server photo that came to this device, or one freed from it that now lives only on
    /// the server. This finds it under its current id, or nil when it is gone or hidden.
    func currentID(for id: String) -> String? {
        let index = aliases()
        if let hit = index[id] { return hit }
        if let hash = LibraryEngine.shared.serverHash(of: id) { return index["cloud:\(hash)"] }
        return nil
    }

    private func aliases() -> [String: String] {
        if let aliasIndex { return aliasIndex }
        var index: [String: String] = [:]
        index.reserveCapacity(serverGrid.all.count + everything.count * 2)
        for photo in serverGrid.all { index[photo.id] = photo.id }
        for photo in shownPhotos {
            index[photo.id] = photo.id
            if let hash = photo.cloudHash { index["cloud:\(hash)"] = photo.id }
        }
        aliasIndex = index
        return index
    }

    /// Scene labels now come from PhotoIntelligence, which looks at each photo once for everything.
    func adoptLabels(_ fresh: [String: [String]]) {
        guard !fresh.isEmpty else { return }
        var next = labels
        for (id, value) in fresh { next[id] = value }
        labels = next
    }

    private func startIndexing() {
        indexing = false
        PhotoIntelligence.shared.schedule(self)
    }

    private func legacyIndexing() {
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

    /// Off the main actor: Vision ran here for every photo and stalled scrolling for minutes after launch.
    nonisolated private static func labels(for asset: PHAsset, manager: PHImageManager) async -> [String]? {
        guard let image = await thumbnail(for: asset, manager: manager), let cgImage = image.cgImage else { return nil }
        // Vision's buffers are autoreleased; drained per photo so thousands of them never pile up.
        return autoreleasepool { () -> [String]? in
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
    }

    nonisolated private static func thumbnail(for asset: PHAsset, manager: PHImageManager) async -> UIImage? {
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
                // Fast format answers once and may mark that answer degraded; waiting for
                // a second answer that never comes stalled indexing for good.
                _ = degraded
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

struct MediaCounts: Equatable {
    var photos: Int
    var videos: Int

    static let zero = MediaCounts(photos: 0, videos: 0)

    init(photos: Int, videos: Int) {
        self.photos = photos
        self.videos = videos
    }

    /// Live Photos are photos; only real films count as video.
    init(_ refs: [PhotoRef]) {
        var films = 0
        for ref in refs where ref.traits.isVideo { films += 1 }
        self.init(photos: refs.count - films, videos: films)
    }

    var total: Int { photos + videos }

    var line: String {
        "\(PhotoFormat.grouped(photos)) \(PhotoFormat.noun(photos)) · \(PhotoFormat.grouped(videos)) \(MediaCounts.filmWord(videos))"
    }

    static func filmWord(_ value: Int) -> String {
        Plural.pick(value, L("film"), L("filmy"), L("filmów"))
    }
}

enum DeviceFilter: String, CaseIterable, Identifiable {
    case all, onServer, waiting, notSent, deletedOnServer
    var id: String { rawValue }
}

enum ServerFilter: String, CaseIterable, Identifiable {
    case all, mine, others, notHere
    var id: String { rawValue }
}

struct DeviceSplit: Equatable {
    var onServer = 0
    var waiting = 0
    var notSent = 0
    var deletedOnServer = 0
}

struct ServerSplit: Equatable {
    var mine = 0
    var others = 0
    var notHere = 0
}

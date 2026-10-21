import AVFoundation
import BackgroundTasks
import Foundation
import Network
import Photos
import SwiftUI
import UIKit

struct SyncStatus: Equatable {
    var title: String
    var detail: String
    var progress: Double?
    var busy: Bool
    var visible: Bool

    static let hidden = SyncStatus(title: "", detail: "", progress: nil, busy: false, visible: false)

    static func updating(_ done: Int, _ total: Int, place: String) -> SyncStatus {
        let totalSafe = max(total, 1)
        let doneSafe = min(max(done, 0), totalSafe)
        return SyncStatus(
            title: "Wysyłanie na \(place)",
            detail: "\(doneSafe) z \(totalSafe)",
            progress: Double(doneSafe) / Double(totalSafe),
            busy: true,
            visible: true
        )
    }

    static func paused(_ detail: String) -> SyncStatus {
        SyncStatus(title: "Wstrzymano", detail: detail, progress: nil, busy: false, visible: true)
    }

    static func ready(_ detail: String) -> SyncStatus {
        SyncStatus(title: "Gotowe", detail: detail, progress: nil, busy: false, visible: true)
    }
}

/// Live sync progress. Kept apart from `PhotoLibrary` so progress ticks only redraw the
/// views that show them instead of every screen observing the library.
struct SyncSources: Equatable {
    var toSend = 0
    var toSendBytes: Int64 = 0
    var cloudOriginals = 0
    var cloudBytes: Int64 = 0
    var alreadyOnServer = 0
    var copiesOnPhone = 0
    var sharedAlbums = 0
    var fromComputer = 0
    var albumOnly = 0

    static let empty = SyncSources()
}

@MainActor
final class SyncFeed: ObservableObject {
    static let shared = SyncFeed()
    @Published var status = SyncStatus.hidden
    /// Photos on the server and still waiting, refreshed with each status publish.
    @Published private(set) var counts = (sent: 0, waiting: 0)
    @Published private(set) var sources = SyncSources.empty

    func setCounts(sent: Int, waiting: Int) {
        guard counts.sent != sent || counts.waiting != waiting else { return }
        counts = (sent, waiting)
    }

    func setSources(_ next: SyncSources) {
        guard sources != next else { return }
        sources = next
    }
}

struct CloudMedia {
    var still: URL?
    var video: URL?
    var isLive: Bool
}

@MainActor
final class LibraryEngine {
    static let shared = LibraryEngine()

    private let store = LibraryStore.live()
    private let bytesKey = "galleryos.bytes-sent"
    private var assets: [String: PHAsset] = [:]
    private var photos: [String: PhotoRef] = [:] {
        didSet { countsRevision &+= 1 }
    }
    private var pendingFavorite: [String: Bool] = [:]
    private var pendingDelete = Set<String>() {
        didSet { countsRevision &+= 1 }
    }
    /// Second copies and files already stored on the server. They stay out of the upload.
    private var duplicateIDs = Set<String>() {
        didSet { countsRevision &+= 1 }
    }
    /// Originals that are only in iCloud. A remote link must not sit on them for minutes.
    private var cloudLater = Set<String>()
    private var stepNote = ""
    private var keptShared = 0
    private var keptComputer = 0
    private var keptAlbumOnly = 0
    private var countsRevision = 0
    private var snapshotCache: (key: [Int], sent: Int, total: Int)?
    private var poolCache: (key: [Int], bytes: Int64?)?
    private var poolRevision = 0
    private var sinceJournal = 0
    /// A hide or unhide must reach the server journal even when nothing is uploading.
    private var privacyDirty = false
    private var uploadedSinceIdle = 0
    private var lastJournal = Date.distantPast
    private var lastOverlay = Date.distantPast
    private var overlayTask: Task<Void, Never>?
    /// Set when the queue cannot move without the user (wrong password, Wi-Fi only…).
    private(set) var blockedReason: String?
    private var appliedFavorite = Set<String>()
    private var appliedDelete = Set<String>()
    private weak var library: PhotoLibrary?
    private var running = false
    private var again = false
    private var stopBulk = false
    private var current: Task<Void, Never>?
    private var manualTask: Task<Void, Never>?
    private var online = true
    private var onWiFi = false
    private var constrained = false
    /// Holds a `BGContinuedProcessingTask` on iOS 26 and later. Stored as `Any` so iOS 18 still compiles.
    private var continuedTask: Any?

    @available(iOS 26.0, *)
    private var continued: BGContinuedProcessingTask? {
        get { continuedTask as? BGContinuedProcessingTask }
        set { continuedTask = newValue }
    }

    private var continuedSubmitted = false
    private var continuedGeneration = 0
    private var continuedTotal: Int64 = 0
    private var continuedCompleted: Int64 = 0
    private var continuedLine = ""
    private var prepareUnits: Int64 = 0
    private var shownDone = 0
    private var shownTotal = 0
    private var shownProgress: Double = 0
    private var poolBytes: [String: Int64] = [:] {
        didSet { poolRevision &+= 1 }
    }
    private var poolScan: Task<Void, Never>?
    /// Sizes and on-device flags. Asking Photos for these on the main thread, once per photo
    /// per sort, is what froze the app and pinned the meter.
    private var factCache: [String: AssetFacts] = [:]
    private var factScan: Task<Void, Never>?
    private var poolSeededCount = 0
    private var sentByteCache: (key: [Int], bytes: Int64)?
    private var activeID: String?
    private var attempts: [String: Int] = [:]
    /// Files that failed three times. They stay out of the queue so the last two cannot spin forever.
    private var postponed = Set<String>()
    /// Photos the user tapped to send. They go even while automatic copy is off.
    private var manual = Set<String>()
    /// Set when those leftovers are parked, so the next network blip does not start another lap.
    private var settled = false
    private var removedFromPhone = Set<String>()
    private var lastUploadReport = Date.distantPast
    private let monitor = NWPathMonitor()

    private init() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        monitor.pathUpdateHandler = { path in
            let satisfied = path.status == .satisfied
            let wifi = path.usesInterfaceType(.wifi) || path.usesInterfaceType(.wiredEthernet)
            let constrained = path.isConstrained
            Task { @MainActor in
                LibraryEngine.shared.online = satisfied
                LibraryEngine.shared.onWiFi = wifi
                LibraryEngine.shared.constrained = constrained
                LibraryEngine.shared.resume()
            }
        }
        monitor.start(queue: DispatchQueue(label: "galleryos.network"))
        GalleryNetwork.shared.trackUpload { fraction in
            Task { @MainActor in
                LibraryEngine.shared.noteFileProgress(fraction)
            }
        }
        NotificationCenter.default.addObserver(
            forName: UIDevice.batteryStateDidChangeNotification,
            object: nil,
            queue: .main
        ) { _ in
            Task { @MainActor in LibraryEngine.shared.resume() }
        }
    }

    func attach(_ library: PhotoLibrary) {
        self.library = library
        guard SyncPolicy.uploadsEnabled else {
            UserDefaults.standard.set(false, forKey: "galleryos.sync.awake")
            SyncScheduler.cancelAutomatic()
            library.syncStatus = .hidden
            return
        }
        restoreShownProgress()
    }

    func freeSpace() async -> Int64? {
        guard let transport = try? await makeTransport(DestinationSettings.load()) as? WebDAVTransport else { return nil }
        defer { Task { await transport.close() } }
        return await transport.availableBytes()
    }

    func serverShareName() -> String {
        let name = DestinationSettings.load().directory.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "Public" : name
    }

    func serverShares() async -> [String] {
        guard let web = try? await copyTransport() else { return [] }
        return await web.shareChoices()
    }

    func serverChildren(_ path: String) async -> [WebEntry] {
        guard let web = try? await copyTransport() else { return [] }
        return (try? await web.children(path)) ?? []
    }

    func switchShare(to name: String) async -> String? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Wybierz folder." }
        var settings = DestinationSettings.load()
        settings.directory = trimmed
        settings.save()
        await dropTransport()
        do {
            _ = try await connect()
            return nil
        } catch {
            return SyncPause.message(for: error)
        }
    }

    private func copyTransport() async throws -> WebDAVTransport {
        let settings = DestinationSettings.load()
        guard let web = try await openTransport(settings) as? WebDAVTransport else {
            throw LibraryError(message: "Ten serwer nie pokazuje folderów.")
        }
        return web
    }

    func isUploaded(_ id: String) -> Bool {
        store.hash(forLocal: id) != nil
    }

    /// The camera-roll id behind a server tile, when that photo is still on this device.
    func localIdentifier(forCloud id: String) -> String? {
        guard id.hasPrefix("cloud:") else { return nil }
        let hash = String(id.dropFirst("cloud:".count))
        guard let local = store.localID(forHash: hash),
              !removedFromPhone.contains(local),
              !pendingDelete.contains(local) else { return nil }
        return local
    }

    func noteLocal(assets: [String: PHAsset], photos: [PhotoRef]) {
        self.assets = assets
        self.photos = Dictionary(uniqueKeysWithValues: photos.map { ($0.id, $0) })
        let alive = Set(self.photos.keys)
        removedFromPhone = removedFromPhone.filter { alive.contains($0) }
        let goneFromPhone = store.mappedLocalIDs.filter { !alive.contains($0) && !pendingDelete.contains($0) }
        store.detachLocals(goneFromPhone)
        store.purgeLocalOriginals()
        adoptDuplicates()
        if settled {
            snapshotCache = nil
            if hasPendingUploads() { settled = false }
        }
        if !settled, DestinationSettings.load().connected, !photos.isEmpty, SyncPolicy.uploadsEnabled {
            reportUpload()
        }
    }

    func noteSources(shared: Int, computer: Int, albumOnly: Int) {
        keptShared = shared
        keptComputer = computer
        keptAlbumOnly = albumOnly
        publishSources(cloudOriginals: 0, cloudBytes: 0)
    }

    func isDuplicate(_ id: String) -> Bool {
        duplicateIDs.contains(id)
    }

    /// Same date, size and pixel size means the same file. A second copy is not uploaded,
    /// and a file the server already has is linked instead of downloaded again.
    private func adoptDuplicates() {
        var tightServer: [MediaPrint: [String]] = [:]
        var looseServer: [MediaLoose: [String]] = [:]
        for asset in store.visible() {
            let loose = MediaLoose(asset)
            looseServer[loose, default: []].append(asset.hash)
            let bytes = asset.primary?.bytes ?? 0
            if bytes > 0 {
                tightServer[MediaPrint(loose: loose, bytes: Int64(bytes)), default: []].append(asset.hash)
            }
        }
        var seenLocal: [MediaPrint: String] = [:]
        var copies = Set<String>()
        var recognized = 0
        var cloudCount = 0
        var cloudBytes: Int64 = 0
        var sendCount = 0
        var sendBytes: Int64 = 0
        for photo in photos.values where !pendingDelete.contains(photo.id) {
            guard assets[photo.id] != nil else { continue }
            let loose = MediaLoose(photo)
            let bytes = factCache[photo.id]?.bytes ?? 0
            if bytes > 0 {
                let print = MediaPrint(loose: loose, bytes: bytes)
                if let hashes = tightServer[print], hashes.count == 1, store.hash(forLocal: photo.id) == nil {
                    store.remember(local: photo.id, hash: hashes[0])
                    recognized += 1
                }
                if let earlier = seenLocal[print] {
                    let keeperUploaded = store.hash(forLocal: earlier) != nil
                    let thisUploaded = store.hash(forLocal: photo.id) != nil
                    if thisUploaded && !keeperUploaded {
                        copies.insert(earlier)
                        seenLocal[print] = photo.id
                    } else if earlier != photo.id {
                        copies.insert(photo.id)
                    }
                } else {
                    seenLocal[print] = photo.id
                }
            } else if let hashes = looseServer[loose], hashes.count == 1, store.hash(forLocal: photo.id) == nil {
                store.remember(local: photo.id, hash: hashes[0])
                recognized += 1
            }
        }
        let films = store.visible().filter { LibraryRules.isFilm($0) }
        if !films.isEmpty {
            for photo in photos.values where store.hash(forLocal: photo.id) == nil && !pendingDelete.contains(photo.id) {
                guard LibraryRules.isFilm(photo) else { continue }
                let matches = films.filter {
                    LibraryRules.sameFilm(photo, $0) && store.localID(forHash: $0.hash) == nil
                }
                guard let hash = matches.max(by: { $0.updatedAt < $1.updatedAt })?.hash else { continue }
                store.remember(local: photo.id, hash: hash)
                recognized += 1
            }
        }
        var filmKept: [PhotoRef] = []
        for photo in photos.values where LibraryRules.isFilm(photo) && !pendingDelete.contains(photo.id) {
            if let index = filmKept.firstIndex(where: { LibraryRules.sameFilm($0, photo) }) {
                let earlier = filmKept[index]
                let earlierUploaded = store.hash(forLocal: earlier.id) != nil
                let thisUploaded = store.hash(forLocal: photo.id) != nil
                if thisUploaded && !earlierUploaded {
                    copies.insert(earlier.id)
                    filmKept[index] = photo
                } else if earlier.id != photo.id {
                    copies.insert(photo.id)
                }
            } else {
                filmKept.append(photo)
            }
        }
        copies.subtract(photos.keys.filter { store.hash(forLocal: $0) != nil })
        for photo in photos.values where store.hash(forLocal: photo.id) == nil && !copies.contains(photo.id) && !pendingDelete.contains(photo.id) {
            sendCount += 1
            guard assets[photo.id] != nil else { continue }
            let facts = factCache[photo.id]
            let bytes = facts?.bytes ?? 0
            sendBytes += bytes
            if facts?.onPhone == false {
                cloudCount += 1
                cloudBytes += bytes
            }
        }
        duplicateIDs = copies
        scheduleFactScan()
        var sources = SyncSources()
        sources.toSend = sendCount
        sources.toSendBytes = sendBytes
        sources.alreadyOnServer = recognized
        sources.copiesOnPhone = copies.count
        sources.sharedAlbums = keptShared
        sources.fromComputer = keptComputer
        sources.albumOnly = keptAlbumOnly
        sources.cloudOriginals = cloudCount
        sources.cloudBytes = cloudBytes
        SyncFeed.shared.setSources(sources)
    }

    private func publishSources(cloudOriginals: Int, cloudBytes: Int64) {
        var sources = SyncFeed.shared.sources
        sources.sharedAlbums = keptShared
        sources.fromComputer = keptComputer
        sources.albumOnly = keptAlbumOnly
        sources.cloudOriginals = cloudOriginals
        sources.cloudBytes = cloudBytes
        SyncFeed.shared.setSources(sources)
    }

    func setUploadsEnabled(_ enabled: Bool) {
        SyncPolicy.uploadsEnabled = enabled
        if enabled {
            stopBulk = false
            postponed.removeAll()
            attempts.removeAll()
            settled = false
            snapshotCache = nil
            kick()
            return
        }
        stopAutomaticCopy()
    }

    /// Backup is off. The queue, the background relaunch and the on-screen meter all stop.
    private func stopAutomaticCopy() {
        stopBulk = true
        again = false
        current?.cancel()
        releaseContinued()
        SyncScheduler.cancelAutomatic()
        SyncRun.setCopying(false)
        UIApplication.shared.isIdleTimerDisabled = manualTask != nil
        UserDefaults.standard.set(false, forKey: "galleryos.sync.awake")
        if manual.isEmpty {
            library?.syncStatus = .hidden
            Task { await SyncLiveActivity.shared.end() }
        }
    }

    /// Send one photo the user pointed at. Automatic backup can stay off.
    func sendNow(_ id: String) {
        guard !id.hasPrefix("cloud:"), store.hash(forLocal: id) == nil else { return }
        manual.insert(id)
        postponed.remove(id)
        attempts[id] = 0
        if SyncPolicy.uploadsEnabled {
            settled = false
            if running {
                again = true
                return
            }
            kick()
            return
        }
        stopBulk = true
        again = false
        if running { current?.cancel() }
        guard manualTask == nil else {
            reportManual()
            return
        }
        manualTask = Task { @MainActor in
            await self.deliverChosen()
            self.manualTask = nil
        }
    }

    /// One finger tap, one file. This never walks the rest of the library.
    private func deliverChosen() async {
        while running {
            library?.syncStatus = SyncStatus(
                title: "Wysyłanie",
                detail: "Zatrzymuję kopię zapasową",
                progress: nil,
                busy: true,
                visible: true
            )
            try? await Task.sleep(for: .milliseconds(200))
            if Task.isCancelled { return }
        }
        guard !SyncPolicy.uploadsEnabled else { return }
        let settings = DestinationSettings.load()
        guard settings.connected, settings.kind != DestinationKind.none else {
            manual.removeAll()
            library?.syncStatus = .paused("Nie wybrano jeszcze serwera.")
            return
        }
        if settings.kind != DestinationKind.folder, !online {
            library?.syncStatus = .paused("Brak sieci")
            return
        }
        UIApplication.shared.isIdleTimerDisabled = true
        defer {
            if manualTask != nil || !SyncPolicy.uploadsEnabled {
                UIApplication.shared.isIdleTimerDisabled = false
            }
        }
        var failed = false
        do {
            let transport = try await openCopyTransport(settings)
            while let id = manual.first {
                if SyncPolicy.uploadsEnabled || Task.isCancelled { return }
                guard let photo = photos[id], let asset = assets[id] else {
                    manual.remove(id)
                    library?.syncStatus = .paused("Tego pliku nie ma na \(ThisDevice.locative).")
                    continue
                }
                var sent = false
                var last: Error = LibraryError(message: "Nie udało się wysłać tego pliku.")
                for tryIndex in 0..<3 {
                    if SyncPolicy.uploadsEnabled || Task.isCancelled { return }
                    reportManual()
                    do {
                        try await send(photo, asset: asset, transport: transport)
                        if store.hash(forLocal: id) != nil {
                            sent = true
                            manual.remove(id)
                            attempts[id] = 0
                            postponed.remove(id)
                            library?.overlayCatalog()
                            break
                        }
                        last = LibraryError(message: "Plik nie został potwierdzony na serwerze.")
                    } catch is CancellationError {
                        return
                    } catch {
                        last = error
                        if !keepsGoing(error) { break }
                    }
                    if tryIndex < 2 {
                        library?.syncStatus = .paused("Ponawiam · \(SyncPause.message(for: last))")
                        try? await Task.sleep(for: .seconds(1))
                    }
                }
                if !sent {
                    failed = true
                    manual.remove(id)
                    library?.syncStatus = .paused(SyncPause.message(for: last))
                }
            }
            if manual.isEmpty, !failed {
                try? await writeJournal(transport)
                library?.syncStatus = .ready("Wybrany plik jest na serwerze.")
            }
        } catch is CancellationError {
            return
        } catch {
            library?.syncStatus = .paused(SyncPause.message(for: error))
        }
    }

    func kick() {
        guard canSync(), SyncPolicy.uploadsEnabled else { return }
        if settled, !hasPendingUploads() { return }
        if hasPendingUploads() { settled = false }
        stayAwake()
        if running {
            if hasPendingUploads() { again = true }
            return
        }
        running = true
        // Let the first frame land. Starting the catalogue on this turn is what iOS kills as a stuck launch.
        current = Task { @MainActor in
            await Task.yield()
            await self.cycle()
        }
    }

    /// Resume the copy loop only when it has actually stopped. A running upload is left alone.
    func keepCopying() {
        guard canSync(), SyncPolicy.uploadsEnabled else { return }
        if settled, !hasPendingUploads() { return }
        if running {
            stayAwake()
            return
        }
        kick()
    }

    func stillCopying() -> Bool {
        SyncPolicy.uploadsEnabled && canSync() && hasPendingUploads()
    }

    func resume() {
        guard canSync(), SyncPolicy.uploadsEnabled else { return }
        if settled, !hasPendingUploads() { return }
        blockedReason = nil
        let retry = attempts.contains { $0.value >= 3 && !postponed.contains($0.key) }
        for (id, count) in attempts where count >= 3 && !postponed.contains(id) {
            attempts[id] = 0
        }
        if retry || hasPendingUploads() {
            reportUpload()
        }
        if running {
            stayAwake()
            return
        }
        kick()
    }

    /// Keep this process running after the app leaves the screen. The copy loop itself is not restarted.
    func stayAwake() {
        guard SyncPolicy.uploadsEnabled, canSync(), blockedReason == nil, hasPendingUploads(),
              policyBlock(needsNetwork: true) == nil else { return }
        beginHold()
        holdScreenIfNeeded()
        // Submitted while the app is visible, so a later lock continues the same task
        // instead of starting one too late and having iOS mark it as a failure.
        guard !continuedSubmitted else { return }
        continuedSubmitted = SyncScheduler.submitContinued(subtitle: continuedSubtitle())
    }

    func keepAliveWhileLocked() {
        stayAwake()
    }

    /// The system asked for the current background task back. Hand the same queue to the next one
    /// without clearing the counter or the in-flight upload.
    func handoffContinued() {
        if #available(iOS 26.0, *) {
            continued = nil
        }
        continuedLine = ""
        // The expiring task already queued its replacement off the main thread.
        continuedSubmitted = SyncRun.isCopying
    }

    func retitleContinued(_ reason: String) {
        guard #available(iOS 26.0, *) else { return }
        guard let continued, reason != continuedLine else { return }
        continuedLine = reason
        continued.updateTitle("Wysyłanie zdjęć", subtitle: reason)
    }

    func continuedSubtitle() -> String {
        if !continuedLine.isEmpty { return continuedLine }
        let snapshot = progressSnapshot()
        guard snapshot.total > 0 else { return "Wysyłanie" }
        return TransferText.summary(
            done: min(snapshot.sent, snapshot.total),
            total: snapshot.total,
            bytesLeft: -1
        )
    }

    @available(iOS 26.0, *)
    @discardableResult
    func bind(_ task: BGContinuedProcessingTask) -> Int {
        continuedGeneration += 1
        continued = task
        continuedSubmitted = true
        let snapshot = progressSnapshot()
        continuedTotal = max(continuedTotal, Int64(max(snapshot.total, 1)) * 1000)
        let observed = Int64(snapshot.sent) * 1000
        continuedCompleted = min(max(continuedCompleted, observed), max(continuedTotal - 1, 0))
        task.progress.totalUnitCount = continuedTotal
        task.progress.completedUnitCount = continuedCompleted
        let line = continuedSubtitle()
        continuedLine = line
        task.updateTitle("Wysyłanie zdjęć", subtitle: line)
        if SyncPolicy.uploadsEnabled {
            reportUpload()
        }
        return continuedGeneration
    }

    /// The system expires a continued task that sits still for a few seconds.
    /// Exporting and hashing do not move bytes, so the counter still creeps forward.
    func tickContinued(_ generation: Int) {
        guard #available(iOS 26.0, *) else { return }
        guard generation == continuedGeneration, let continued, stillCopying() else { return }
        let snapshot = progressSnapshot()
        continuedTotal = max(continuedTotal, Int64(max(snapshot.total, 1)) * 1000)
        if fileFraction <= 0.001 {
            prepareUnits = min(prepareUnits + 5, 120)
        }
        let observed = Int64(snapshot.sent) * 1000
            + prepareUnits
            + Int64(min(max(fileFraction, 0), 0.99) * 860)
        let next = min(max(continuedCompleted + 1, observed), max(continuedTotal - 1, 0))
        continuedCompleted = next
        if continued.progress.totalUnitCount != continuedTotal {
            continued.progress.totalUnitCount = continuedTotal
        }
        continued.progress.completedUnitCount = next
        reportUpload()
    }

    /// The queue cannot move on its own. Drop the system task without reporting a failure:
    /// `success: false` shows "Niepowodzenie" and iOS then terminates the app.
    func endContinued(_ reason: String) {
        if #available(iOS 26.0, *) {
            continued?.updateTitle("Wysyłanie zdjęć", subtitle: reason)
            continued = nil
        }
        continuedSubmitted = false
        continuedLine = ""
    }

    func releaseContinued() {
        if #available(iOS 26.0, *) {
            continued = nil
        }
        continuedSubmitted = false
        continuedLine = ""
    }

    func finishContinued() {
        if #available(iOS 26.0, *) {
            if let continued {
                if continuedTotal > 0 {
                    continued.progress.completedUnitCount = continuedTotal
                }
                continued.updateTitle("Wysyłanie zdjęć", subtitle: "Gotowe")
            }
            continued = nil
        }
        continuedSubmitted = false
        continuedTotal = 0
        continuedCompleted = 0
        continuedLine = ""
    }

    func resumeFromBackgroundTransfer() {
        guard SyncPolicy.uploadsEnabled else {
            SyncScheduler.cancelAutomatic()
            return
        }
        kick()
    }

    func waitUntilIdle() async {
        await current?.value
    }

    func connect() async throws -> String {
        blockedReason = nil
        let settings = DestinationSettings.load()
        let message: String
        if settings.kind == DestinationKind.immich {
            _ = try await immich(settings)
            message = "Połączono z Immich."
            var saved = settings
            saved.connected = true
            saved.save()
            UserDefaults.standard.set(saved.place, forKey: "galleryos.place")
        } else if settings.kind == DestinationKind.webdav {
            ServerLink.shared.reset()
            let link: WebDAVLink
            do {
                link = try await WebDAVTransport.open(
                    remoteHost: settings.remoteHost.isEmpty ? settings.host : settings.remoteHost,
                    localHost: ServerLink.shared.shouldTryHome(LinkMode.current, hasLocal: !settings.localHost.isEmpty)
                        || (settings.remoteHost.isEmpty && GalleryNetwork.isLocalHost(settings.host)) ? settings.localHost : "",
                    localPort: settings.localPort,
                    localName: settings.localName,
                    forcedPort: settings.remotePort,
                    username: settings.username,
                    password: GalleryKeychain.string(account: "destination-password") ?? "",
                    directory: settings.directory
                )
            } catch {
                ServerLink.shared.failed(SyncPause.message(for: error))
                throw error
            }
            await link.transport.close()
            try Task.checkCancellation()
            let atHome = link.atHome || GalleryNetwork.isLocalHost(link.host)
            noteRoute(atHome ? "W domu" : "Zdalnie")
            ServerLink.shared.established(
                atHome ? .home : .remote,
                host: atHome && !settings.localName.isEmpty ? settings.localName : link.host
            )
            var saved = settings
            saved.directory = link.directory
            saved.connected = true
            if link.atHome {
                // Home and DDNS ports differ on QNAP (5000 inside, 5001 forwarded), so the
                // LAN result must not overwrite the remote address or port.
                saved.localHost = link.host
                saved.localPort = link.port
                if saved.remoteHost.isEmpty {
                    saved.host = link.host
                    saved.port = link.port
                }
            } else {
                saved.host = link.host
                saved.port = link.port
            }
            saved.save()
            UserDefaults.standard.set(saved.place, forKey: "galleryos.place")
            message = link.message
        } else {
            ServerLink.shared.reset()
            let transport = try await makeTransport(settings)
            do {
                try await transport.open()
            } catch {
                await transport.close()
                ServerLink.shared.failed(SyncPause.message(for: error))
                throw error
            }
            await transport.close()
            var saved = DestinationSettings.load()
            saved.connected = true
            saved.save()
            UserDefaults.standard.set(saved.place, forKey: "galleryos.place")
            message = saved.kind == DestinationKind.webdav ? "Połączono z NAS." : "Połączono."
        }
        library?.syncStatus = .ready(message)
        await dropTransport()
        let connected = DestinationSettings.load()
        SavedServerStore.shared.remember(connected, online: true)
        LibraryCloudProfile.publish(connected)
        AppleTVSharing.refreshIfEnabled()
        await ShareAccount.shared.publishLibrary()
        kick()
        return message
    }

    /// Network changed: switch the live connection between home LAN and DDNS at the next safe point.
    func reroute() {
        guard DestinationSettings.load().connected else { return }
        if running {
            again = true
            return
        }
        Task {
            await dropTransport()
            await checkRoute()
            kick()
        }
    }

    /// Opens the best route once so the connection indicator is accurate even when uploads are idle.
    func checkRoute() async {
        let settings = DestinationSettings.load()
        guard settings.connected, settings.kind == DestinationKind.webdav || settings.kind == DestinationKind.server else { return }
        do {
            let transport = try await makeTransport(settings)
            try await transport.open()
            await transport.close()
        } catch {
            ServerLink.shared.failed(SyncPause.message(for: error))
        }
    }

    func saveBookmark(_ data: Data, name: String) {
        try? data.write(to: store.bookmarkURL(), options: .atomic)
        var settings = DestinationSettings.load()
        settings.folderName = name
        settings.kind = DestinationKind.folder
        settings.place = LibraryPlace.disk.rawValue
        settings.connected = false
        settings.save()
    }

    func useThisPhone() {
        DestinationSettings.empty.save()
        ServerLink.shared.reset()
        UserDefaults.standard.set(LibraryPlace.thisPhone.rawValue, forKey: "galleryos.place")
        SavedServerStore.shared.mark(online: false)
        library?.syncStatus = .hidden
        Task { await SyncLiveActivity.shared.end() }
    }

    func setConcealed(_ concealed: Bool, ids: [String]) {
        for id in ids {
            let hash = hash(for: id)
            let local = id.hasPrefix("cloud:") ? hash.flatMap { store.localID(forHash: $0) } : id
            let cloud = hash.map { "cloud:\($0)" }
            if concealed {
                store.conceal(id)
                if let local { store.conceal(local) }
                if let cloud { store.conceal(cloud) }
            } else {
                store.reveal(id)
                if let local { store.reveal(local) }
                if let cloud { store.reveal(cloud) }
            }
            guard let hash, var asset = store.assets[hash], asset.hidden != concealed else { continue }
            asset.hidden = concealed
            store.append(asset)
            privacyDirty = true
        }
        if privacyDirty { pushPrivacyJournal() }
        library?.overlayCatalog()
    }

    func isConcealed(_ id: String) -> Bool {
        if store.isConcealed(id) { return true }
        if let hash = hash(for: id), store.assets[hash]?.hidden == true { return true }
        return false
    }

    func hiddenRefs() -> [PhotoRef] {
        var result: [PhotoRef] = []
        var seen = Set<String>()
        for photo in photos.values {
            let onServer = hash(for: photo.id).flatMap { store.assets[$0] }?.hidden == true
            guard store.isConcealed(photo.id) || onServer else { continue }
            guard !pendingDelete.contains(photo.id) else { continue }
            result.append(photo)
            seen.insert(photo.id)
        }
        for asset in store.assets.values where asset.hidden && asset.deletedAt == nil {
            if let local = store.localID(forHash: asset.hash), seen.contains(local) { continue }
            result.append(asset.photoRef())
        }
        return result.sorted { $0.created < $1.created }
    }

    /// Uploads the journal so Apple TV and the server library drop the hidden photos immediately.
    private func pushPrivacyJournal() {
        Task { [weak self] in
            guard let self else { return }
            let settings = DestinationSettings.load()
            guard settings.connected,
                  settings.kind != DestinationKind.none,
                  settings.kind != DestinationKind.immich else { return }
            do {
                let transport = try await self.makeTransport(settings)
                try await transport.open()
                try await self.writeJournal(transport)
                await transport.close()
                self.privacyDirty = false
            } catch {
                // The next copy cycle writes the same journal.
            }
        }
    }

    func updateFavorite(_ favorite: Bool, ids: [String]) {
        for id in ids {
            pendingFavorite[id] = favorite
            guard let hash = hash(for: id), var asset = store.assets[hash] else { continue }
            asset.favorite = favorite
            store.append(asset)
        }
        kick()
    }

    func releaseFromPhone(ids: [String]) {
        var onlyHere: [String] = []
        var uploaded: [String] = []
        for id in ids {
            if store.hash(forLocal: id) != nil {
                uploaded.append(id)
            } else if !id.hasPrefix("cloud:") {
                onlyHere.append(id)
            }
        }
        for id in uploaded {
            removedFromPhone.insert(id)
        }
        store.detachLocals(uploaded)
        if !onlyHere.isEmpty {
            markDeleted(ids: onlyHere)
        }
    }

    func phoneRefs(local: [PhotoRef]) -> [PhotoRef] {
        let refs = local.compactMap { photo -> PhotoRef? in
            if pendingDelete.contains(photo.id) || removedFromPhone.contains(photo.id) { return nil }
            if store.isConcealed(photo.id) { return nil }
            var copy = photo
            if let hash = store.hash(forLocal: photo.id), let asset = store.assets[hash] {
                if asset.deletedAt != nil || asset.hidden { return nil }
                copy.cloudHash = hash
                copy.isFavorite = pendingFavorite[photo.id] ?? asset.favorite
            }
            return copy
        }
        return LibraryRules.keepingOneFilm(refs)
    }

    /// True while remote favorite/delete mutations are being applied to Photos (suppress full rebuild loops).
    private(set) var photosMutationDepth = 0
    var isMutatingPhotos: Bool { photosMutationDepth > 0 }

    func serverRefs() -> [PhotoRef] {
        // Always use cloud:<hash> so the server shelf never flips identity when a photo leaves the phone.
        let visible = store.visible()
        let dropped = duplicateFilmHashes(in: visible)
        var result: [PhotoRef] = []
        result.reserveCapacity(visible.count)
        for asset in visible where !dropped.contains(asset.hash) {
            var photo = asset.photoRef()
            if let local = store.localID(forHash: asset.hash),
               !removedFromPhone.contains(local),
               !pendingDelete.contains(local) {
                photo.isFavorite = pendingFavorite[local] ?? asset.favorite
            } else {
                photo.isFavorite = asset.favorite
            }
            result.append(photo)
        }
        return result
    }

    func markDeleted(ids: [String]) {
        for id in ids {
            pendingDelete.insert(id)
            guard let hash = hash(for: id), var asset = store.assets[hash] else { continue }
            asset.deletedAt = .now
            store.append(asset)
        }
        kick()
    }

    func merged(local: [PhotoRef]) -> [PhotoRef] {
        var seen = Set<String>()
        var result: [PhotoRef] = []
        for var photo in local {
            if pendingDelete.contains(photo.id) || removedFromPhone.contains(photo.id) { continue }
            if store.isConcealed(photo.id) { continue }
            if let hash = store.hash(forLocal: photo.id), let asset = store.assets[hash] {
                if !LibraryRules.isVisible(asset) { continue }
                photo.isFavorite = pendingFavorite[photo.id] ?? asset.favorite
                photo.cloudHash = hash
                seen.insert(hash)
            }
            result.append(photo)
        }
        result = LibraryRules.keepingOneFilm(result)
        let filmsOnPhone = result.filter { LibraryRules.isFilm($0) }
        for asset in store.visible() where !seen.contains(asset.hash) && store.localID(forHash: asset.hash) == nil {
            if LibraryRules.isFilm(asset), filmsOnPhone.contains(where: { LibraryRules.sameFilm($0, asset) }) {
                continue
            }
            var photo = asset.photoRef()
            photo.isFavorite = asset.favorite
            result.append(photo)
        }
        return result
    }

    /// Extra uploads of one movie. The copy linked to the phone stays; otherwise the newest one stays.
    private func duplicateFilmHashes(in visible: [LibraryAsset]) -> Set<String> {
        let ranked = visible.sorted { lhs, rhs in
            let lhsLocal = store.localID(forHash: lhs.hash) != nil
            let rhsLocal = store.localID(forHash: rhs.hash) != nil
            if lhsLocal != rhsLocal { return lhsLocal && !rhsLocal }
            return lhs.updatedAt > rhs.updatedAt
        }
        var kept: [LibraryAsset] = []
        var dropped = Set<String>()
        for asset in ranked where LibraryRules.isFilm(asset) {
            if kept.contains(where: { LibraryRules.sameFilm($0, asset) }) {
                dropped.insert(asset.hash)
            } else {
                kept.append(asset)
            }
        }
        return dropped
    }

    /// A movie the server already has for this capture. A second export must not become a second tile.
    private func filmKeeper(for photo: PhotoRef) -> LibraryAsset? {
        guard LibraryRules.isFilm(photo) else { return nil }
        let matches = store.visible().filter { LibraryRules.sameFilm(photo, $0) }
        if let linked = matches.first(where: { store.localID(forHash: $0.hash) == photo.id }) {
            return linked
        }
        return matches
            .filter { store.localID(forHash: $0.hash) == nil }
            .max { $0.updatedAt < $1.updatedAt }
    }

    func trashedRefs() -> [PhotoRef] {
        store.trashed().map { asset in
            if let local = store.localID(forHash: asset.hash), let photo = photos[local] { return photo }
            return asset.photoRef()
        }
    }

    func albumRefs(_ name: String) -> [PhotoRef] {
        store.assets(inAlbum: name).map { asset in
            if let local = store.localID(forHash: asset.hash), var photo = photos[local] {
                photo.isFavorite = asset.favorite
                photo.cloudHash = asset.hash
                return photo
            }
            return asset.photoRef()
        }
    }

    func supplementalAlbums() -> [AlbumRecord] {
        var records: [AlbumRecord] = []
        let hidden = hiddenRefs()
        records.append(AlbumRecord(
            id: "galleryos.hidden",
            title: "Ukryte",
            count: hidden.count,
            coverID: nil,
            system: true
        ))
        let trash = trashedRefs()
        if !trash.isEmpty {
            records.append(AlbumRecord(
                id: "galleryos.trash",
                title: "Ostatnio usunięte",
                count: trash.count,
                coverID: trash.last?.id,
                system: true
            ))
        }
        for name in store.albumNames() where !name.isEmpty {
            let items = albumRefs(name)
            records.append(AlbumRecord(
                id: "galleryos.album.\(name)",
                title: name,
                count: items.count,
                coverID: items.last?.id,
                system: false
            ))
        }
        return records
    }

    private var thumbImages: [String: UIImage] = [:]

    func thumbnail(id: String) -> UIImage? {
        guard id.hasPrefix("cloud:"), let hash = hash(for: id) else { return nil }
        if let image = thumbImages[hash] {
            if PreviewCheck.isUsable(image) { return image }
            thumbImages.removeValue(forKey: hash)
        }
        let url = store.replicaURL(CatalogPaths.thumb(hash: hash))
        guard let image = usableThumb(at: url) else { return nil }
        rememberThumb(hash, image)
        return image
    }

    func prioritizeThumbs(_ ids: [String]) {
        for id in ids.reversed() {
            guard let hash = hash(for: id), !thumbMiss.contains(hash) else { continue }
            if let image = thumbImages[hash] {
                if PreviewCheck.isUsable(image) { continue }
                thumbImages.removeValue(forKey: hash)
            }
            let thumbURL = store.replicaURL(CatalogPaths.thumb(hash: hash))
            if FileManager.default.fileExists(atPath: thumbURL.path) {
                if thumbnail(id: id) != nil { continue }
                // A large file that failed to decode once stays. A blank or tiny one was already removed.
                if fileBytes(thumbURL) >= 200 { continue }
                try? FileManager.default.removeItem(at: thumbURL)
            }
            guard !thumbFlight.contains(hash) else { continue }
            if let index = thumbOrder.firstIndex(of: hash) {
                thumbOrder.remove(at: index)
            }
            thumbOrder.insert(hash, at: 0)
        }
        pumpThumbsIfNeeded()
    }

    /// Deletes a preview that is empty, tiny, or a flat black/white field. Leaves a large file alone when decoding fails once.
    private func usableThumb(at url: URL) -> UIImage? {
        let size = fileBytes(url)
        guard size > 0 else { return nil }
        guard let image = UIImage(contentsOfFile: url.path) else {
            if size < 200 { try? FileManager.default.removeItem(at: url) }
            return nil
        }
        guard image.size.width > 1, image.size.height > 1, PreviewCheck.isUsable(image) else {
            try? FileManager.default.removeItem(at: url)
            return nil
        }
        return image
    }

    private func rememberThumb(_ hash: String, _ image: UIImage) {
        guard PreviewCheck.isUsable(image) else { return }
        if thumbImages.count > 480 { thumbImages.removeAll(keepingCapacity: true) }
        thumbImages[hash] = image
    }

    func cloudThumb(id: String) async -> UIImage? {
        if let image = thumbnail(id: id) { return image }
        guard canSync(), let hash = hash(for: id), !hash.isEmpty, !thumbMiss.contains(hash) else { return nil }
        return await withCheckedContinuation { continuation in
            if let image = self.thumbnail(id: id) {
                continuation.resume(returning: image)
                return
            }
            self.thumbWaiting[hash, default: []].append(continuation)
            if !self.thumbFlight.contains(hash), !self.thumbOrder.contains(hash) {
                self.thumbOrder.insert(hash, at: 0)
            }
            self.pumpThumbsIfNeeded()
        }
    }

    private var thumbOrder: [String] = []
    private var thumbFlight = Set<String>()
    private var thumbMiss = Set<String>()
    private var thumbTries: [String: Int] = [:]
    private var thumbWaiting: [String: [CheckedContinuation<UIImage?, Never>]] = [:]
    private var thumbBusy = false

    private func enqueueMissingThumbs() {
        let missing = store.visible().filter { asset in
            guard !thumbMiss.contains(asset.hash) else { return false }
            let path = store.replicaURL(CatalogPaths.thumb(hash: asset.hash)).path
            guard FileManager.default.fileExists(atPath: path) else { return true }
            let size = (try? FileManager.default.attributesOfItem(atPath: path)[.size] as? NSNumber)?.intValue ?? 0
            return size < 200
        }.sorted { $0.created > $1.created }
        for asset in missing where !thumbOrder.contains(asset.hash) && !thumbFlight.contains(asset.hash) {
            thumbOrder.append(asset.hash)
        }
        pumpThumbsIfNeeded()
    }

    private func pumpThumbsIfNeeded() {
        guard !thumbBusy, canSync(), !thumbOrder.isEmpty else { return }
        thumbBusy = true
        Task { await self.runThumbPump() }
    }

    private func runThumbPump() async {
        defer {
            thumbBusy = false
            if !thumbOrder.isEmpty { pumpThumbsIfNeeded() }
        }
        guard canSync() else {
            finishQueuedThumbs(nil)
            return
        }
        let settings = DestinationSettings.load()
        guard let transport = try? await makeTransport(settings) else {
            finishQueuedThumbs(nil)
            return
        }
        do {
            try await transport.open()
        } catch {
            finishQueuedThumbs(nil)
            return
        }
        while canSync(), !thumbOrder.isEmpty {
            let count = min(8, thumbOrder.count)
            let batch = Array(thumbOrder.prefix(count))
            thumbOrder.removeFirst(count)
            for hash in batch { thumbFlight.insert(hash) }
            await withTaskGroup(of: (String, UIImage?).self) { group in
                for hash in batch {
                    group.addTask { @MainActor in
                        (hash, await self.fetchThumb(hash, transport: transport))
                    }
                }
                for await (hash, image) in group {
                    self.thumbFlight.remove(hash)
                    if image != nil {
                        self.thumbMiss.remove(hash)
                        self.thumbTries[hash] = nil
                    } else if self.store.assets[hash] != nil {
                        let tries = (self.thumbTries[hash] ?? 0) + 1
                        self.thumbTries[hash] = tries
                        let local = self.store.localID(forHash: hash)
                        let onDevice = local.map { self.assets[$0] != nil } ?? false
                        if onDevice, tries < 4 {
                            if !self.thumbOrder.contains(hash) { self.thumbOrder.append(hash) }
                        } else {
                            self.thumbMiss.insert(hash)
                        }
                    }
                    self.finishThumb(hash, image)
                }
            }
        }
        await transport.close()
    }

    private func fetchThumb(_ hash: String, transport: CatalogTransport) async -> UIImage? {
        let dest = store.replicaURL(CatalogPaths.thumb(hash: hash))
        if let image = usableThumb(at: dest) {
            rememberThumb(hash, image)
            return image
        }
        let thumbPath = CatalogPaths.thumb(hash: hash)
        if let data = try? await transport.readFile(thumbPath) {
            let image = UIImage(data: data)
            if let image, PreviewCheck.isUsable(image) {
                write(data, to: dest)
                rememberThumb(hash, image)
                return image
            }
            // An unfinished or flat preview is not a picture. Drop it so the next build can replace it.
            if data.count < 200 || image != nil {
                try? await transport.removeFile(thumbPath)
            }
        }
        // The server copy has no usable preview. The photo is still on this device, so build
        // the tile from the camera roll and put that JPEG back on the server.
        if let image = await localPreview(hash: hash), PreviewCheck.isUsable(image) {
            if let jpeg = image.jpegData(compressionQuality: 0.82) {
                write(jpeg, to: dest)
                await publishThumb(jpeg, hash: hash, on: transport, force: true)
            }
            rememberThumb(hash, image)
            return image
        }
        guard let asset = store.assets[hash], let primary = asset.primary else { return nil }
        let traits = PhotoTraits(rawValue: asset.traits)
        // Thumb missing on the server — build one from the original and put it back, so Apple TV
        // and the other devices stop showing an empty tile for this photo.
        if !traits.isVideo,
           let data = try? await transport.readFile(CatalogPaths.original(hash: primary.hash, ext: primary.ext)),
           let full = UIImage(data: data) {
            let image = Self.downscale(full, maxSide: 720)
            guard PreviewCheck.isUsable(image) else { return nil }
            if let jpeg = image.jpegData(compressionQuality: 0.82) {
                write(jpeg, to: dest)
                await publishThumb(jpeg, hash: hash, on: transport)
            }
            rememberThumb(hash, image)
            return image
        }
        if traits.isVideo, let image = await videoThumb(primary: primary, dest: dest, transport: transport) {
            rememberThumb(hash, image)
            return image
        }
        return nil
    }

    /// A frame for a film whose preview was never uploaded. Uses a complete copy already on this
    /// iPhone. A short download is removed and is not used as a tile.
    private func videoThumb(primary: LibraryResource, dest: URL, transport: CatalogTransport) async -> UIImage? {
        let local = store.replicaURL(CatalogPaths.original(hash: primary.hash, ext: primary.ext))
        let expected = Int64(primary.bytes)
        let size = fileBytes(local)
        if size > 0, expected > 0, size < expected {
            try? FileManager.default.removeItem(at: local)
            return nil
        }
        guard size >= 200 else { return nil }
        guard let image = await filmStill(at: local) else { return nil }
        if let jpeg = image.jpegData(compressionQuality: 0.82) {
            write(jpeg, to: dest)
            await publishThumb(jpeg, hash: primary.hash, on: transport)
        }
        return image
    }

    /// Skips the black frame many clips open on. Returns nothing when every sample is a flat field.
    private func filmStill(at url: URL) async -> UIImage? {
        let clip = AVURLAsset(url: url)
        let generator = AVAssetImageGenerator(asset: clip)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 720, height: 720)
        if #available(iOS 18.0, *) {
            generator.dynamicRangePolicy = .forceSDR
        }
        generator.requestedTimeToleranceBefore = .positiveInfinity
        generator.requestedTimeToleranceAfter = CMTime(seconds: 2, preferredTimescale: 600)
        let length = (try? await clip.load(.duration))?.seconds ?? 0
        let spots: [Double]
        if length.isFinite, length > 1 {
            spots = [min(1, length * 0.12), min(length * 0.4, max(0.2, length - 0.2))]
        } else {
            spots = [0.2, 0]
        }
        for second in spots {
            guard let cg = try? await generator.image(at: CMTime(seconds: second, preferredTimescale: 600)).image else { continue }
            let image = UIImage(cgImage: cg)
            if PreviewCheck.isUsable(image) { return image }
        }
        return nil
    }

    /// Uploads a freshly built preview so every device, including Apple TV, finds it next time.
    /// `force` replaces a file that is present but not a usable picture.
    private func publishThumb(_ jpeg: Data, hash: String, on transport: CatalogTransport, force: Bool = false) async {
        guard let image = UIImage(data: jpeg), PreviewCheck.isUsable(image) else { return }
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
        guard (try? jpeg.write(to: file, options: .atomic)) != nil else { return }
        defer { try? FileManager.default.removeItem(at: file) }
        let thumbPath = CatalogPaths.thumb(hash: hash)
        let remote = try? await transport.byteCount(thumbPath)
        if force || remote == nil || (remote ?? 0) < max(200, jpeg.count / 2) {
            try? await transport.removeFile(thumbPath)
            try? await transport.writeFile(thumbPath, from: file)
        }
    }

    /// A still from the photo that is still in the camera roll. This is what fills a server tile
    /// when the copy on the server never received a preview.
    private func localPreview(hash: String) async -> UIImage? {
        guard let local = store.localID(forHash: hash),
              !removedFromPhone.contains(local),
              !pendingDelete.contains(local) else { return nil }
        let asset = assets[local] ?? PHAsset.fetchAssets(withLocalIdentifiers: [local], options: nil).firstObject
        guard let asset else { return nil }
        if let image = await previewImage(asset, network: false) { return image }
        // The local file was evicted (Optimize Storage). Ask Photos for a small thumbnail only.
        return await previewImage(asset, network: true)
    }

    private func previewImage(_ asset: PHAsset, network: Bool) async -> UIImage? {
        let box = PreviewBox()
        let image = await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.deliveryMode = .fastFormat
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = network
            PHImageManager.default().requestImage(
                for: asset,
                targetSize: CGSize(width: 480, height: 480),
                contentMode: .aspectFill,
                options: options
            ) { image, info in
                let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
                let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
                if let image, PreviewCheck.isUsable(image) { box.latest = image }
                if cancelled || !degraded || (!network && box.latest != nil) {
                    box.finish(continuation, box.latest)
                }
            }
            Task {
                try? await Task.sleep(for: .seconds(network ? 8 : 4))
                box.finish(continuation, box.latest)
            }
        }
        guard let image, PreviewCheck.isUsable(image) else { return nil }
        return image
    }

    private static func downscale(_ image: UIImage, maxSide: CGFloat) -> UIImage {
        let size = image.size
        let longest = max(size.width, size.height)
        guard longest > maxSide, longest > 0 else { return image }
        let scale = maxSide / longest
        let target = CGSize(width: max(1, size.width * scale), height: max(1, size.height * scale))
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }

    private func finishThumb(_ hash: String, _ image: UIImage?) {
        let waiters = thumbWaiting.removeValue(forKey: hash) ?? []
        for waiter in waiters {
            waiter.resume(returning: image)
        }
    }

    private func finishQueuedThumbs(_ image: UIImage?) {
        let hashes = Set(thumbOrder).union(thumbWaiting.keys)
        thumbOrder.removeAll()
        thumbFlight.removeAll()
        for hash in hashes {
            finishThumb(hash, image)
        }
    }

    func people(for id: String) -> [String] {
        guard let hash = hash(for: id) else { return [] }
        return store.people[hash] ?? []
    }

    func cloudMedia(id: String) -> CloudMedia? {
        guard let hash = hash(for: id), let asset = store.assets[hash] else { return nil }
        let videoExt: Set<String> = ["mov", "mp4", "m4v"]
        let primaryVideo = videoExt.contains(asset.primary?.ext ?? "")
        let primary = existing(asset.primary)
        let paired = existing(asset.paired)
        let thumb = FileManager.default.fileExists(atPath: store.replicaURL(CatalogPaths.thumb(hash: hash)).path)
            ? store.replicaURL(CatalogPaths.thumb(hash: hash)) : nil
        let still = primaryVideo ? thumb : (primary ?? thumb)
        // A half-written movie opens as a black screen. Leave it out so the phone copy can play.
        let video = primaryVideo ? completeFile(asset.primary) : completeFile(asset.paired)
        guard still != nil || video != nil else { return nil }
        return CloudMedia(still: still, video: video, isLive: asset.paired != nil && !primaryVideo)
    }

    func prepareDisplay(id: String) async {
        guard let hash = hash(for: id), let asset = store.assets[hash] else { return }
        let settings = DestinationSettings.load()
        guard settings.connected else { return }
        do {
            if settings.kind == DestinationKind.immich {
                try await pullImmichFiles(asset, settings: settings, originals: true)
            } else {
                let transport = try await makeTransport(settings)
                try await transport.open()
                try await pullFiles(asset, transport: transport, originals: true)
                await transport.close()
            }
        } catch {
            library?.syncStatus = .paused(SyncPause.message(for: error))
        }
    }

    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    private func beginHold() {
        guard backgroundTask == .invalid else { return }
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "GalleryOS") { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                let token = self.backgroundTask
                self.backgroundTask = .invalid
                if self.stillCopying() {
                    self.beginHold()
                    self.keepAliveWhileLocked()
                }
                if token != .invalid {
                    UIApplication.shared.endBackgroundTask(token)
                }
            }
        }
    }

    private func endHold() {
        let token = backgroundTask
        backgroundTask = .invalid
        guard token != .invalid else { return }
        UIApplication.shared.endBackgroundTask(token)
    }

    private var liveTransport: CatalogTransport?
    private var journalLoaded = false

    private func cycle() async {
        beginHold()
        startPulse()
        SyncRun.setCopying(true)
        holdScreenIfNeeded()
        if SyncPolicy.keepUnlocked { SyncNotice.allow() }
        UserDefaults.standard.set(true, forKey: "galleryos.sync.awake")
        repeat {
            if stopBulk || !SyncPolicy.uploadsEnabled {
                again = false
                break
            }
            again = false
            await run()
        } while again && !settled && !Task.isCancelled && SyncPolicy.uploadsEnabled && !stopBulk
        if manualTask == nil {
            if let liveTransport {
                await liveTransport.close()
            }
            self.liveTransport = nil
        }
        stopPulse()
        store.flush()
        endHold()
        running = false
        current = nil
        SyncRun.setCopying(stillCopying())
        holdScreenIfNeeded()
        if stillCopying() {
            UserDefaults.standard.set(true, forKey: "galleryos.sync.awake")
            stayAwake()
            SyncScheduler.scheduleSoon()
        } else {
            UserDefaults.standard.set(false, forKey: "galleryos.sync.awake")
            if manualTask == nil {
                UIApplication.shared.isIdleTimerDisabled = false
            }
        }
    }

    func refreshHold() {
        holdScreenIfNeeded()
    }

    /// Keeps auto-lock off until the queue is finished, so the in-process upload is not suspended at 13%.
    private func holdScreenIfNeeded() {
        let hold = SyncPolicy.keepUnlocked && SyncPolicy.uploadsEnabled && blockedReason == nil && stillCopying()
        if UIApplication.shared.isIdleTimerDisabled != hold {
            UIApplication.shared.isIdleTimerDisabled = hold
        }
    }

    private func openCopyTransport(_ settings: DestinationSettings) async throws -> CatalogTransport {
        if let data = SpareDisks.shared.bookmarkForCopy() {
            let transport = try FolderTransport.resolve(bookmark: data)
            try await transport.open()
            return transport
        }
        return try await openTransport(settings)
    }

    private func openTransport(_ settings: DestinationSettings) async throws -> CatalogTransport {
        if let liveTransport {
            if !ServerLink.shared.routeDirty { return liveTransport }
            await dropTransport()
        }
        let transport = try await makeTransport(settings)
        try await transport.open()
        liveTransport = transport
        return transport
    }

    private func dropTransport() async {
        if let liveTransport {
            await liveTransport.close()
        }
        liveTransport = nil
    }

    private var pulse: Timer?

    private func startPulse() {
        pulse?.invalidate()
        let timer = Timer(timeInterval: 0.35, repeats: true) { _ in
            Task { @MainActor in LibraryEngine.shared.pulseProgress() }
        }
        RunLoop.main.add(timer, forMode: .common)
        pulse = timer
    }

    private func stopPulse() {
        pulse?.invalidate()
        pulse = nil
    }

    private var fileFraction: Double = 0

    func noteFileProgress(_ fraction: Double) {
        fileFraction = min(0.99, max(0, fraction))
        guard running, canSync() else { return }
        if SyncPolicy.uploadsEnabled {
            reportUpload()
        } else if !manual.isEmpty {
            reportManual()
        }
    }

    private func pulseProgress() {
        guard running, canSync() else { return }
        holdScreenIfNeeded()
        if #available(iOS 26.0, *), continued != nil {
            tickContinued(continuedGeneration)
        } else if SyncPolicy.uploadsEnabled {
            reportUpload()
        } else if !manual.isEmpty {
            reportManual()
        }
    }

    private func run() async {
        let settings = DestinationSettings.load()
        guard settings.connected, settings.kind != DestinationKind.none else {
            library?.syncStatus = .hidden
            return
        }
        guard SyncPolicy.uploadsEnabled, !stopBulk else {
            again = false
            return
        }
        let diskCopy = SpareDisks.shared.bookmarkForCopy() != nil
        let needsNetwork = !diskCopy && settings.kind != DestinationKind.folder
        if let reason = policyBlock(needsNetwork: needsNetwork) {
            let handPicked = !SyncPolicy.uploadsEnabled && !manual.isEmpty
            let userChoice = reason == "Czeka na ładowanie" || reason == "Czeka na Wi-Fi"
            if handPicked && userChoice {
                // A finger tap sends now. Wi-Fi and charging rules stay on the automatic queue.
            } else if userChoice || !stillCopying() {
                blockedReason = reason
                library?.syncStatus = .paused(reason)
                SyncScheduler.schedule()
                return
            } else {
                again = true
                reportUpload()
                try? await Task.sleep(for: .seconds(2))
                return
            }
        }
        blockedReason = nil
        holdScreenIfNeeded()
        if SyncPolicy.uploadsEnabled && hasPendingUploads() {
            reportUpload()
        } else if !manual.isEmpty {
            reportManual()
        }
        do {
            if settings.kind == DestinationKind.immich {
                try await syncImmich(settings)
            } else {
                let transport = try await openCopyTransport(settings)
                if !journalLoaded {
                    try await pull(transport)
                    journalLoaded = true
                }
                // Already-copied files are rechecked only after the queue is empty.
                // Doing that first left the meter at 2% while the phone hashed the whole library.
                if SyncPolicy.uploadsEnabled && hasPendingUploads() {
                    try await push(transport, settings: settings)
                } else if !manual.isEmpty {
                    try await push(transport, settings: settings)
                } else if SyncPolicy.uploadsEnabled {
                    await repairShort(transport)
                    await repairLocalPreviews(transport)
                }
            }
            if !SyncPolicy.uploadsEnabled || stopBulk {
                again = false
                return
            }
            await applyRemoteEdits()
            if let reason = blockedReason {
                retitleContinued(reason)
                holdScreenIfNeeded()
                again = true
                try? await Task.sleep(for: .seconds(8))
            }
            await refreshCatalog(now: !again)
            if !again, !photos.isEmpty {
                let parked = postponed.count
                if parked > 0 {
                    let word = Self.photoWord(parked)
                    library?.syncStatus = .ready("\(parked) \(word) nie doszły. Reszta jest na serwerze.")
                    UIApplication.shared.isIdleTimerDisabled = false
                    finishContinued()
                    SyncLiveActivity.shared.finish(
                        done: max(photos.count - parked, 0),
                        total: max(photos.count, 1),
                        bytesSent: storedBytes(),
                        place: uploadPlace(settings)
                    )
                    resetShownProgress()
                } else {
                    let note = await remoteNote(settings)
                    library?.syncStatus = .ready(note)
                    let alive = photos.values.filter { !pendingDelete.contains($0.id) }
                    let sent = alive.filter { store.hash(forLocal: $0.id) != nil }.count
                    if sent > 0, sent >= alive.count {
                        if uploadedSinceIdle > 0 {
                            let count = uploadedSinceIdle
                            uploadedSinceIdle = 0
                            ServerLink.shared.announce(
                                "Wszystko na serwerze",
                                detail: "Wysłano \(TransferText.groupedPublic(count)) \(Self.photoWord(count))",
                                symbol: "checkmark",
                                tint: Color(red: 0.2, green: 0.78, blue: 0.42)
                            )
                            SyncNotice.finished(count: count)
                        }
                        UIApplication.shared.isIdleTimerDisabled = false
                        finishContinued()
                        SyncLiveActivity.shared.finish(done: sent, total: max(alive.count, 1), bytesSent: storedBytes(), place: uploadPlace(settings))
                        resetShownProgress()
                    }
                }
                SavedServerStore.shared.remember(settings, online: true)
                await ShareAccount.shared.publishLibrary()
            }
        } catch is CancellationError {
            again = false
        } catch let url as URLError where url.code == .cancelled {
            again = false
        } catch {
            if stillCopying(), keepsGoing(error) {
                await dropTransport()
                again = true
                reportUpload()
                try? await Task.sleep(for: .seconds(2))
            } else {
                again = true
                blockedReason = SyncPause.message(for: error)
                library?.syncStatus = .paused(SyncPause.message(for: error))
                holdScreenIfNeeded()
                retitleContinued(SyncPause.message(for: error))
                SyncScheduler.schedule()
                try? await Task.sleep(for: .seconds(8))
            }
        }
    }

    private func push(_ transport: CatalogTransport, settings: DestinationSettings) async throws {
        if !SyncPolicy.uploadsEnabled || stopBulk {
            again = false
            return
        }
        let waiting = photos.values.filter {
            store.hash(forLocal: $0.id) == nil && inQueue($0.id)
        }
        let pool = Array(waiting)
        let remote = ServerLink.shared.route == .remote
        let ready = pool.filter { (attempts[$0.id] ?? 0) < 3 && !(remote && cloudLater.contains($0.id)) }
        // One linear pass. Sorting used to ask Photos whether every file was on the device,
        // tens of thousands of times, on the main thread. A tapped photo goes first.
        let chosen = ready.min { lhs, rhs in
            let leftManual = manual.contains(lhs.id)
            let rightManual = manual.contains(rhs.id)
            if leftManual != rightManual { return leftManual && !rightManual }
            let left = attempts[lhs.id] ?? 0
            let right = attempts[rhs.id] ?? 0
            if left != right { return left < right }
            if remote {
                let leftHere = factCache[lhs.id]?.onPhone ?? true
                let rightHere = factCache[rhs.id]?.onPhone ?? true
                if leftHere != rightHere { return leftHere && !rightHere }
            }
            if lhs.created != rhs.created { return lhs.created > rhs.created }
            return lhs.id < rhs.id
        }
        let batch = chosen.map { [$0] } ?? []
        if SyncPolicy.uploadsEnabled {
            reportUpload()
        } else {
            reportManual()
        }
        var lastError: Error?
        for photo in batch {
            let handPicked = manual.contains(photo.id)
            if Task.isCancelled || stopBulk || !SyncPolicy.uploadsEnabled {
                again = false
                return
            }
            guard let asset = assets[photo.id] else {
                attempts[photo.id, default: 0] += 1
                if handPicked { manual.remove(photo.id) }
                again = !manual.isEmpty || SyncPolicy.uploadsEnabled
                continue
            }
            if handPicked { reportManual() } else { reportUpload() }
            do {
                let linkedBefore = store.hash(forLocal: photo.id) != nil
                try await send(photo, asset: asset, transport: transport)
                if store.hash(forLocal: photo.id) != nil {
                    attempts[photo.id] = 0
                    postponed.remove(photo.id)
                    manual.remove(photo.id)
                    if handPicked { library?.overlayCatalog() }
                } else if !linkedBefore {
                    attempts[photo.id, default: 0] += 1
                    again = true
                    if handPicked, (attempts[photo.id] ?? 0) >= 3 {
                        manual.remove(photo.id)
                        library?.syncStatus = .paused("Plik nie został potwierdzony na serwerze.")
                    }
                }
            } catch is CancellationError {
                again = false
                return
            } catch let url as URLError where url.code == .cancelled {
                again = false
                return
            } catch SendLater.cloud {
                cloudLater.insert(photo.id)
                again = true
                stepNote = "Oryginał jest w iCloud. Zdalnie biorę najpierw to, co jest na telefonie."
                if handPicked { reportManual() } else { reportUpload() }
            } catch {
                lastError = error
                attempts[photo.id, default: 0] += 1
                again = true
                stepNote = ""
                if handPicked, (attempts[photo.id] ?? 0) >= 3 {
                    manual.remove(photo.id)
                    library?.syncStatus = .paused(SyncPause.message(for: error))
                } else if handPicked {
                    reportManual()
                } else {
                    reportUpload()
                }
                if keepsGoing(error) {
                    try? await Task.sleep(for: .milliseconds(400))
                }
            }
        }
        if !SyncPolicy.uploadsEnabled || stopBulk {
            again = false
            return
        }
        if !batch.isEmpty {
            sinceJournal += batch.count
            // The journal holds the whole catalogue; re-uploading it after every photo
            // costs more than the photo itself on big libraries.
            let last = ready.count <= batch.count
            if last || sinceJournal >= 12 || privacyDirty || Date().timeIntervalSince(lastJournal) > 25 {
                do {
                    try await writeJournal(transport)
                } catch {
                    if !keepsGoing(error) { throw error }
                    again = true
                }
            }
        }
        if !SyncPolicy.uploadsEnabled {
            return
        }
        if ready.count > batch.count { again = true }
        reportUpload()
        if ready.isEmpty, remote, !cloudLater.isEmpty, waiting.allSatisfy({ cloudLater.contains($0.id) }) {
            stepNote = "Zostało \(cloudLater.count) w iCloud. Zdalnie ich nie ściągam, w domu pójdą same."
            again = false
            reportUpload()
            return
        }
        if ready.isEmpty, !waiting.isEmpty {
            if let lastError, !keepsGoing(lastError) {
                blockedReason = SyncPause.message(for: lastError)
                library?.syncStatus = .paused(SyncPause.message(for: lastError))
                again = true
                return
            }
            // Three failures is enough. Resetting the counter here made the last files spin at 100%.
            for photo in waiting {
                postponed.insert(photo.id)
            }
            snapshotCache = nil
            settled = true
            again = false
            return
        }
        if batch.isEmpty, let lastError, waiting.isEmpty == false {
            throw lastError
        }
    }

    private static func photoWord(_ count: Int) -> String {
        if count == 1 { return "zdjęcie" }
        let tens = count % 100
        if (2...4).contains(count % 10), !(12...14).contains(tens) { return "zdjęcia" }
        return "zdjęć"
    }

    private enum SendLater: Error { case cloud }

    /// A file counts only when the server holds every byte. Presence of a short leftover does not.
    private func storedMatches(_ path: String, expected: Int, on transport: CatalogTransport) async throws -> Bool {
        let size = try await withThrowingTaskGroup(of: Int?.self) { group in
            group.addTask { try await transport.byteCount(path) }
            group.addTask {
                try await Task.sleep(for: .seconds(12))
                throw URLError(.timedOut)
            }
            let found = try await group.next() ?? nil
            group.cancelAll()
            return found
        }
        guard let size, size > 0 else { return false }
        if expected <= 0 { return true }
        return size == expected
    }

    private var verifiedBytes = Set<String>()
    private var verifiedLoaded = false
    /// A photo that failed to export this launch is skipped so the rest can still be measured.
    private var repairSkipped = Set<String>()

    private func loadVerified() {
        guard !verifiedLoaded else { return }
        verifiedLoaded = true
        let url = store.root.appendingPathComponent("verified-bytes.json")
        guard let data = try? Data(contentsOf: url),
              let list = try? JSONDecoder().decode([String].self, from: data) else { return }
        verifiedBytes = Set(list)
    }

    private let verifiedWriter = DispatchQueue(label: "galleryos.verified", qos: .utility)

    private func saveVerified() {
        let list = Array(verifiedBytes)
        let url = store.root.appendingPathComponent("verified-bytes.json")
        verifiedWriter.async {
            guard let data = try? JSONEncoder().encode(list) else { return }
            try? data.write(to: url, options: .atomic)
        }
    }

    /// Photos already marked as copied are measured again. A short file is uploaded once more.
    private func repairShort(_ transport: CatalogTransport) async {
        loadVerified()
        let pending = store.mappedLocalIDs.filter { local in
            guard !repairSkipped.contains(local), let hash = store.hash(forLocal: local) else { return false }
            return !verifiedBytes.contains(hash)
        }
        guard !pending.isEmpty else { return }
        for local in pending.prefix(4) {
            guard let hash = store.hash(forLocal: local),
                  let record = store.assets[hash],
                  let asset = assets[local] else { continue }
            let resources = record.resources.filter { $0.bytes > 0 }
            var whole = !resources.isEmpty
            for resource in resources {
                let path = CatalogPaths.original(hash: resource.hash, ext: resource.ext)
                let ok = (try? await storedMatches(path, expected: resource.bytes, on: transport)) == true
                if !ok { whole = false }
            }
            if whole {
                verifiedBytes.insert(hash)
                continue
            }
            stepNote = "Uzupełniam niepełny plik"
            reportUpload()
            do {
                try await send(PhotoRef(id: local, created: record.created, pixelWidth: record.pixelWidth, pixelHeight: record.pixelHeight, traits: PhotoTraits(rawValue: record.traits), isFavorite: record.favorite, latitude: record.latitude, longitude: record.longitude, duration: record.duration, cloudHash: hash), asset: asset, transport: transport)
                verifiedBytes.insert(hash)
            } catch {
                repairSkipped.insert(local)
            }
            saveVerified()
            return
        }
        saveVerified()
    }

    private var previewCursor = 0
    private var previewSkipped = Set<String>()

    /// Server tiles with no preview are rebuilt from the camera roll and uploaded, a few at a time.
    private func repairLocalPreviews(_ transport: CatalogTransport) async {
        let locals = store.mappedLocalIDs
        guard !locals.isEmpty else { return }
        var looked = 0
        var made = 0
        var index = previewCursor % locals.count
        while looked < 48, made < 6 {
            let local = locals[index]
            index = (index + 1) % locals.count
            looked += 1
            guard let hash = store.hash(forLocal: local),
                  !previewSkipped.contains(hash),
                  assets[local] != nil else { continue }
            let dest = store.replicaURL(CatalogPaths.thumb(hash: hash))
            let size = (try? FileManager.default.attributesOfItem(atPath: dest.path)[.size] as? NSNumber)?.intValue ?? 0
            if size >= 200 { continue }
            guard let image = await localPreview(hash: hash),
                  let jpeg = image.jpegData(compressionQuality: 0.82) else {
                previewSkipped.insert(hash)
                continue
            }
            try? FileManager.default.removeItem(at: dest)
            write(jpeg, to: dest)
            rememberThumb(hash, image)
            thumbMiss.remove(hash)
            thumbTries[hash] = nil
            await publishThumb(jpeg, hash: hash, on: transport, force: true)
            made += 1
        }
        previewCursor = index
    }

    /// HEAD on a silent DDNS link must not sit past a few seconds.
    private func exists(_ path: String, on transport: CatalogTransport) async throws -> Bool {
        try await withThrowingTaskGroup(of: Bool.self) { group in
            group.addTask { try await transport.exists(path) }
            group.addTask {
                try await Task.sleep(for: .seconds(8))
                throw URLError(.timedOut)
            }
            guard let found = try await group.next() else { return false }
            group.cancelAll()
            return found
        }
    }

    /// Gives up on a transfer that sends no bytes for two minutes, so one stuck photo
    /// cannot freeze the queue until iOS kills the app.
    private func writeGuarded(_ body: @escaping @MainActor () async throws -> Void) async throws {
        fileFraction = 0
        let limit = ServerLink.shared.route == .remote ? 40 : 120
        try await withThrowingTaskGroup(of: Void.self) { group in
            group.addTask { try await body() }
            group.addTask { [weak self] in
                var quiet = 0
                var last = 0.0
                while quiet < limit {
                    try await Task.sleep(for: .seconds(5))
                    let now = await self?.fileFraction ?? 0
                    if now > last + 0.002 {
                        last = now
                        quiet = 0
                    } else {
                        quiet += 5
                    }
                }
                throw LibraryError(message: "To zdjęcie się zacina. Idę dalej.")
            }
            try await group.next()
            group.cancelAll()
        }
    }

    private func writeJournal(_ transport: CatalogTransport) async throws {
        try await transport.writeFile(CatalogPaths.journal(device: store.deviceID), from: store.journalFile())
        sinceJournal = 0
        privacyDirty = false
        lastJournal = .now
    }

    /// Rebuilding the grids on every uploaded photo makes scrolling stutter, so while the
    /// queue is moving the catalogue is refreshed at most every few seconds.
    private func refreshCatalog(now force: Bool = false) async {
        let gap: TimeInterval = 3
        let elapsed = Date().timeIntervalSince(lastOverlay)
        if force || elapsed >= gap {
            overlayTask?.cancel()
            overlayTask = nil
            lastOverlay = .now
            await Task.yield()
            library?.overlayCatalog()
            publishCounts()
            return
        }
        guard overlayTask == nil else { return }
        overlayTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(gap - elapsed))
            guard let self, !Task.isCancelled else { return }
            self.overlayTask = nil
            self.lastOverlay = .now
            self.library?.overlayCatalog()
            self.publishCounts()
        }
    }

    func publishCounts() {
        guard canSync() else {
            SyncFeed.shared.setCounts(sent: 0, waiting: 0)
            return
        }
        let snapshot = progressSnapshot()
        SyncFeed.shared.setCounts(sent: store.visible().count, waiting: max(snapshot.total - snapshot.sent, 0))
    }

    /// Persist local state before iOS may suspend the process. The snapshot is copied here
    /// and written off the main thread; waiting for the encode can outlive the background budget.
    func prepareForBackground() {
        store.flush()
    }

    private func send(_ photo: PhotoRef, asset: PHAsset, transport: CatalogTransport) async throws {
        activeID = photo.id
        fileFraction = 0
        prepareUnits = 0
        try guardBulk(photo.id)
        if poolBytes[photo.id] == nil {
            poolBytes[photo.id] = Self.assetBytes(asset)
        }
        if ServerLink.shared.route == .remote {
            let facts = factCache[asset.localIdentifier] ?? Self.measure(asset)
            if factCache[asset.localIdentifier] == nil { factCache[asset.localIdentifier] = facts }
            if !facts.onPhone {
                stepNote = "Oryginał jest w iCloud"
                throw SendLater.cloud
            }
        }
        stepNote = "Przygotowuję"
        reportUpload()
        let exported = try await OriginalExport.export(asset, wait: ServerLink.shared.route == .remote ? 20 : nil)
        try guardBulk(photo.id)
        defer {
            if activeID == photo.id {
                activeID = nil
                fileFraction = 0
            }
            exported.resources.forEach { try? FileManager.default.removeItem(at: $0.file) }
            if let thumb = exported.thumb { try? FileManager.default.removeItem(at: thumb) }
        }
        guard let primary = exported.resources.first(where: { $0.role == "primary" }) else { return }
        poolBytes[photo.id] = Int64(exported.resources.reduce(0) { $0 + $1.bytes })
        if let keeper = filmKeeper(for: photo), keeper.hash != primary.hash {
            let owner = store.localID(forHash: keeper.hash)
            if owner == photo.id, let resource = keeper.primary {
                let path = CatalogPaths.original(hash: resource.hash, ext: resource.ext)
                if try await storedMatches(path, expected: resource.bytes, on: transport) {
                    reportUpload()
                    return
                }
                try? await transport.removeFile(path)
                try await writeGuarded { try await transport.writeFile(path, from: primary.file) }
                guard try await storedMatches(path, expected: primary.bytes, on: transport) else {
                    try? await transport.removeFile(path)
                    throw LibraryError(message: "Oryginał nie został potwierdzony.")
                }
                reportUpload()
                return
            }
            if owner == nil, let resource = keeper.primary {
                let path = CatalogPaths.original(hash: resource.hash, ext: resource.ext)
                if try await storedMatches(path, expected: resource.bytes, on: transport) {
                    store.remember(local: photo.id, hash: keeper.hash)
                    reportUpload()
                    return
                }
            }
        }
        let original = CatalogPaths.original(hash: primary.hash, ext: primary.ext)
        stepNote = "Sprawdzam, czy już jest na serwerze"
        reportUpload()
        if store.assets[primary.hash] != nil, try await storedMatches(original, expected: primary.bytes, on: transport) {
            store.remember(local: photo.id, hash: primary.hash)
            reportUpload()
            return
        }
        let record = makeAsset(photo: photo, exported: exported)
        for resource in exported.resources {
            try guardBulk(photo.id)
            let path = CatalogPaths.original(hash: resource.hash, ext: resource.ext)
            stepNote = "Wysyłam"
            reportUpload()
            if try await storedMatches(path, expected: resource.bytes, on: transport) { continue }
            try? await transport.removeFile(path)
            try await writeGuarded { try await transport.writeFile(path, from: resource.file) }
            guard try await storedMatches(path, expected: resource.bytes, on: transport) else {
                try? await transport.removeFile(path)
                throw LibraryError(message: "Oryginał nie został potwierdzony.")
            }
            addBytes(Int64(resource.bytes))
        }
        if let thumb = exported.thumb {
            let thumbPath = CatalogPaths.thumb(hash: primary.hash)
            let thumbBytes = fileBytes(thumb)
            if try await storedMatches(thumbPath, expected: Int(thumbBytes), on: transport) == false {
                try? await transport.removeFile(thumbPath)
                try await writeGuarded { try await transport.writeFile(thumbPath, from: thumb) }
                addBytes(thumbBytes)
            }
        }
        stepNote = ""
        guard try await storedMatches(CatalogPaths.original(hash: primary.hash, ext: primary.ext), expected: primary.bytes, on: transport) else {
            throw LibraryError(message: "Oryginał nie został potwierdzony.")
        }
        store.append(record)
        store.remember(local: photo.id, hash: primary.hash)
        uploadedSinceIdle += 1
        reportUpload()
    }

    private func pull(_ transport: CatalogTransport) async throws {
        if let server = transport as? ServerTransport {
            let page = try await server.changes(cursor: store.serverCursor)
            store.merge(page.lines)
            store.setCursor(page.cursor)
        }
        let names = (try? await transport.list(CatalogPaths.state)) ?? []
        var lines: [JournalLine] = []
        for name in names where name.hasPrefix("journal-") && name.hasSuffix(".jsonl") {
            let data = try await transport.readFile("\(CatalogPaths.state)/\(name)")
            lines.append(contentsOf: JournalCodec.decode(data))
        }
        if !lines.isEmpty {
            store.merge(lines)
            library?.overlayCatalog()
            enqueueMissingThumbs()
        }
    }

    private func pullFiles(_ asset: LibraryAsset, transport: CatalogTransport, originals: Bool) async throws {
        let thumb = CatalogPaths.thumb(hash: asset.hash)
        let thumbDest = store.replicaURL(thumb)
        if fileBytes(thumbDest) == 0, try await transport.exists(thumb) {
            let data = try await transport.readFile(thumb)
            if let image = UIImage(data: data), PreviewCheck.isUsable(image) {
                write(data, to: thumbDest)
            }
        }
        guard originals else { return }
        for resource in asset.resources {
            let path = CatalogPaths.original(hash: resource.hash, ext: resource.ext)
            let dest = store.replicaURL(path)
            let size = fileBytes(dest)
            if size > 0 {
                if resource.bytes <= 0 || size == Int64(resource.bytes) { continue }
                try? FileManager.default.removeItem(at: dest)
            }
            if try await transport.exists(path) == false { continue }
            let data = try await transport.readFile(path)
            if resource.bytes > 0, data.count != resource.bytes { continue }
            write(data, to: dest)
        }
    }

    private func syncImmich(_ settings: DestinationSettings) async throws {
        let client = try await immich(settings)
        let pending = photos.values.filter { store.hash(forLocal: $0.id) == nil && inQueue($0.id) }
        let batch = pending.sorted { $0.created > $1.created }.prefix(3)
        if pending.count > batch.count { again = true }
        for photo in batch {
            guard let asset = assets[photo.id] else { continue }
            reportUpload()
            let exported = try await OriginalExport.export(asset)
            defer {
                exported.resources.forEach { try? FileManager.default.removeItem(at: $0.file) }
                if let thumb = exported.thumb { try? FileManager.default.removeItem(at: thumb) }
            }
            let record = makeAsset(photo: photo, exported: exported)
            if let primary = exported.resources.first(where: { $0.role == "primary" }) {
                try await client.upload(file: primary.file, asset: record, device: store.deviceID)
                if let paired = exported.resources.first(where: { $0.role == "paired" }) {
                    var pairedAsset = record
                    pairedAsset.hash = paired.hash
                    try await client.upload(file: paired.file, asset: pairedAsset, device: store.deviceID)
                }
                if let thumb = exported.thumb {
                    _ = thumb
                }
                store.append(record)
                store.remember(local: photo.id, hash: primary.hash)
                reportUpload()
            }
        }
        let remote = try await client.listAll()
        for item in remote {
            let hash = item.deviceAssetID.isEmpty ? item.id : item.deviceAssetID
            if store.assets[hash] != nil { continue }
            let ext = ((item.fileName as NSString).pathExtension).lowercased()
            let record = LibraryAsset(
                hash: hash,
                created: item.created,
                pixelWidth: item.width,
                pixelHeight: item.height,
                traits: item.isVideo ? PhotoTraits.video.rawValue : 0,
                favorite: item.favorite,
                latitude: item.latitude,
                longitude: item.longitude,
                duration: 0,
                deletedAt: nil,
                albumNames: [],
                resources: [LibraryResource(role: "primary", hash: hash, ext: ext.isEmpty ? (item.isVideo ? "mp4" : "jpg") : ext, bytes: 0)],
                updatedAt: .now
            )
            store.append(record)
            if store.people[item.id] != nil && hash != item.id {
                store.setPeople(store.people.merging([hash: store.people[item.id] ?? []]) { $1 })
            }
        }
        if let people = try? await client.namedPeople() {
            store.setPeople(people)
        }
        var fetched = 0
        for asset in store.visible().filter({ store.localID(forHash: $0.hash) == nil }).prefix(8) {
            try await pullImmichFiles(asset, settings: settings, originals: fetched < 2, client: client)
            fetched += 1
        }
    }

    private func pullImmichFiles(_ asset: LibraryAsset, settings: DestinationSettings, originals: Bool, client existing: ImmichClient? = nil) async throws {
        let client: ImmichClient
        if let existing {
            client = existing
        } else {
            client = try await immich(settings)
        }
        let remote = try await client.listAll()
        guard let match = remote.first(where: { $0.deviceAssetID == asset.hash || $0.id == asset.hash }) else { return }
        let thumbDest = store.replicaURL(CatalogPaths.thumb(hash: asset.hash))
        if !FileManager.default.fileExists(atPath: thumbDest.path) {
            let data = try await client.download(id: match.id, original: false)
            if let image = UIImage(data: data), PreviewCheck.isUsable(image) {
                write(data, to: thumbDest)
            }
        }
        guard originals, let resource = asset.primary else { return }
        let dest = store.replicaURL(CatalogPaths.original(hash: resource.hash, ext: resource.ext))
        if FileManager.default.fileExists(atPath: dest.path) { return }
        let data = try await client.download(id: match.id, original: true)
        write(data, to: dest)
    }

    private func makeAsset(photo: PhotoRef, exported: (resources: [ExportedResource], thumb: URL?)) -> LibraryAsset {
        let primary = exported.resources.first { $0.role == "primary" }
        var favorite = photo.isFavorite
        if let pending = pendingFavorite[photo.id] { favorite = pending }
        return LibraryAsset(
            hash: primary?.hash ?? UUID().uuidString,
            created: photo.created,
            pixelWidth: photo.pixelWidth,
            pixelHeight: photo.pixelHeight,
            traits: photo.traits.rawValue,
            favorite: favorite,
            latitude: photo.latitude,
            longitude: photo.longitude,
            duration: photo.duration,
            deletedAt: pendingDelete.contains(photo.id) ? .now : nil,
            albumNames: library?.userAlbumNames(for: photo.id) ?? [],
            resources: exported.resources.map {
                LibraryResource(role: $0.role, hash: $0.hash, ext: $0.ext, bytes: $0.bytes)
            },
            updatedAt: .now,
            hidden: store.isConcealed(photo.id)
        )
    }

    private func makeTransport(_ settings: DestinationSettings) async throws -> CatalogTransport {
        let password = GalleryKeychain.string(account: "destination-password") ?? ""
        switch settings.kind {
        case DestinationKind.server:
            if ConnectionURL.isCloudNAS(settings.host) {
                var nas = settings
                nas.host = ConnectionURL.bare(settings.host)
                nas.remoteHost = nas.host
                if nas.port == 8787 { nas.port = 0 }
                return try await openAsNAS(nas, password: password)
            }
            let route: LinkRoute = GalleryNetwork.isLocalHost(settings.host) ? .home : .remote
            ServerLink.shared.attempt(route)
            do {
                let transport = try await ServerTransport.login(
                    host: settings.host,
                    port: settings.port,
                    username: settings.username,
                    password: password
                )
                ServerLink.shared.established(route, host: settings.host)
                return transport
            } catch {
                let text = SyncPause.message(for: error)
                let wrongKind = text == SyncPause.notGalleryServer || text == SyncPause.needsHTTPS
                if wrongKind, let rescued = await rescueWebDAV(settings, password: password) {
                    return rescued
                }
                let shown = wrongKind
                    ? "Pod tym adresem nie ma serwera GalleryOS. Jeśli to QNAP albo inny NAS, wróć i wybierz „Serwer NAS w domu”."
                    : text
                ServerLink.shared.failed(shown)
                throw LibraryError(message: shown)
            }
        case DestinationKind.webdav:
            let directory = settings.directory
            let mode = LinkMode.current
            let router = ServerLink.shared
            if router.shouldTryHome(mode, hasLocal: !settings.localHost.isEmpty) {
                router.attempt(.home)
                let started = Date()
                do {
                    let nearby = try await WebDAVTransport.open(
                        remoteHost: "",
                        localHost: settings.localHost,
                        localPort: settings.localPort,
                        localName: settings.localName,
                        forcedPort: 0,
                        username: settings.username,
                        password: password,
                        directory: directory
                    )
                    remember(directory: nearby.directory, settings: settings)
                    noteRoute("W domu")
                    router.established(
                        .home,
                        host: settings.localName.isEmpty ? settings.localHost : settings.localName,
                        millis: Int(Date().timeIntervalSince(started) * 1000)
                    )
                    return nearby.transport
                } catch {
                    let text = SyncPause.message(for: error)
                    if text.contains("hasło") || text.contains("zapisu") || text.contains("dostępu") {
                        router.failed(text)
                        throw error
                    }
                    router.homeFailed()
                    if mode == .home {
                        router.failed("W domu serwer nie odpowiada")
                        throw LibraryError(message: "W domu serwer nie odpowiada. Wybierz Automatycznie albo Zdalnie.")
                    }
                }
            } else if mode == .home {
                router.failed("Brak adresu w sieci domowej")
                throw LibraryError(message: "Brak adresu w domu. Ustaw dostęp na Automatycznie albo Zdalnie.")
            }
            let remote = settings.remoteHost.isEmpty ? settings.host : settings.remoteHost
            let remoteRoute: LinkRoute = GalleryNetwork.isLocalHost(remote) ? .home : .remote
            router.attempt(remoteRoute)
            let started = Date()
            let link: WebDAVLink
            do {
                link = try await WebDAVTransport.open(
                    remoteHost: remote,
                    localHost: "",
                    localPort: 0,
                    localName: "",
                    forcedPort: settings.remotePort,
                    username: settings.username,
                    password: password,
                    directory: directory
                )
            } catch {
                router.failed(SyncPause.message(for: error))
                throw error
            }
            remember(directory: link.directory, settings: settings)
            if remoteRoute == .remote, link.port > 0, link.port != settings.port {
                var saved = DestinationSettings.load()
                saved.port = link.port
                saved.save()
            }
            noteRoute(remoteRoute == .home ? "W domu" : "Zdalnie")
            router.established(remoteRoute, host: remote, millis: Int(Date().timeIntervalSince(started) * 1000))
            return link.transport
        case DestinationKind.sftp:
            return SFTPTransport(
                host: settings.host,
                port: settings.port,
                username: settings.username,
                password: password,
                directory: settings.directory
            )
        case DestinationKind.folder:
            guard let data = try? Data(contentsOf: store.bookmarkURL()) else {
                throw LibraryError(message: "Dysk odpięty")
            }
            let transport = try FolderTransport.resolve(bookmark: data)
            return transport
        default:
            throw LibraryError(message: "To miejsce nie jest włączone.")
        }
    }

    /// The address answered, but it is a NAS web page rather than the GalleryOS server.
    /// Connect over WebDAV and remember it, so the next sync does not try the API again.
    private func rescueWebDAV(_ settings: DestinationSettings, password: String) async -> CatalogTransport? {
        try? await openAsNAS(settings, password: password)
    }

    private func openAsNAS(_ settings: DestinationSettings, password: String) async throws -> CatalogTransport {
        let host = ConnectionURL.bare(settings.host)
        guard !host.isEmpty else { throw LibraryError(message: "Wpisz adres serwera.") }
        GalleryNetwork.shared.trust(host)
        let local = GalleryNetwork.isLocalHost(host)
        let link = try await WebDAVTransport.open(
            remoteHost: local ? "" : host,
            localHost: local ? host : "",
            localPort: local ? settings.port : 0,
            localName: "",
            forcedPort: settings.port,
            username: settings.username,
            password: password,
            directory: settings.directory
        )
        var saved = DestinationSettings.load()
        saved.kind = DestinationKind.webdav
        saved.place = LibraryPlace.qnap.rawValue
        saved.username = settings.username
        saved.directory = link.directory
        saved.connected = false
        if link.atHome {
            saved.localHost = link.host
            saved.localPort = link.port
            if saved.remoteHost.isEmpty {
                saved.host = link.host
                saved.port = link.port
            }
        } else {
            saved.remoteHost = link.host
            saved.host = link.host
            saved.port = link.port
        }
        saved.save()
        let route: LinkRoute = link.atHome ? .home : .remote
        ServerLink.shared.established(route, host: link.host)
        return link.transport
    }

    private func immich(_ settings: DestinationSettings) async throws -> ImmichClient {
        let password = GalleryKeychain.string(account: "destination-password") ?? ""
        return try await ImmichClient.connect(
            host: settings.host,
            port: settings.port,
            username: settings.username,
            password: password
        )
    }

    private func applyRemoteEdits() async {
        let pairs = Array(store.localToHash)
        var step = 0
        for (local, hash) in pairs {
            step += 1
            if step.isMultiple(of: 80) { await Task.yield() }
            guard let record = store.assets[hash], let asset = assets[local] else { continue }
            if record.deletedAt != nil {
                if appliedDelete.contains(hash) { continue }
                appliedDelete.insert(hash)
                photosMutationDepth += 1
                PHPhotoLibrary.shared().performChanges {
                    PHAssetChangeRequest.deleteAssets([asset] as NSArray)
                } completionHandler: { [weak self] _, _ in
                    Task { @MainActor in self?.photosMutationDepth = max(0, (self?.photosMutationDepth ?? 1) - 1) }
                }
                continue
            }
            let mark = "\(hash):\(record.favorite ? 1 : 0)"
            if pendingFavorite[local] != nil || appliedFavorite.contains(mark) || asset.isFavorite == record.favorite { continue }
            appliedFavorite.insert(mark)
            let favorite = record.favorite
            photosMutationDepth += 1
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest(for: asset).isFavorite = favorite
            } completionHandler: { [weak self] _, _ in
                Task { @MainActor in self?.photosMutationDepth = max(0, (self?.photosMutationDepth ?? 1) - 1) }
            }
        }
    }

    private func hash(for id: String) -> String? {
        if id.hasPrefix("cloud:") { return String(id.dropFirst("cloud:".count)) }
        return store.hash(forLocal: id)
    }

    private func existing(_ resource: LibraryResource?) -> URL? {
        guard let resource else { return nil }
        let url = store.replicaURL(CatalogPaths.original(hash: resource.hash, ext: resource.ext))
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    /// The replica counts only when the whole original is on disk.
    private func completeFile(_ resource: LibraryResource?) -> URL? {
        guard let resource, let url = existing(resource) else { return nil }
        guard resource.bytes > 0 else { return url }
        let size = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.int64Value ?? 0
        guard size + 4096 >= Int64(resource.bytes) else { return nil }
        return url
    }

    /// Fills server tiles whose preview file is missing. Does not delete originals or photos.
    func repairServerPreviews() async -> String {
        let hashes = Array(store.assets.keys)
        var broken: [String] = []
        for hash in hashes {
            let url = store.replicaURL(CatalogPaths.thumb(hash: hash))
            let bytes = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.intValue ?? 0
            if bytes < 200 { broken.append(hash) }
        }
        guard !broken.isEmpty else { return "Serwer: miniatury na miejscu." }
        let settings = DestinationSettings.load()
        var transport: CatalogTransport?
        if settings.connected {
            transport = try? await makeTransport(settings)
            try? await transport?.open()
        }
        var fixed = 0
        for hash in broken {
            if Task.isCancelled { break }
            var image = await localPreview(hash: hash)
            if image == nil, let asset = store.assets[hash] {
                image = await stillFromReplica(asset)
            }
            guard let image, PreviewCheck.isUsable(image), let jpeg = image.jpegData(compressionQuality: 0.72) else { continue }
            let dest = store.replicaURL(CatalogPaths.thumb(hash: hash))
            try? FileManager.default.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? jpeg.write(to: dest, options: .atomic)
            FilmPoster.store(image, id: "cloud:\(hash)")
            if let local = store.localID(forHash: hash), (store.assets[hash]?.duration ?? 0) >= 0.8 {
                FilmPoster.store(image, id: local)
            }
            GridImageStore.shared.remember("cloud:\(hash)", image)
            if let transport {
                await publishThumb(jpeg, hash: hash, on: transport, force: true)
            }
            fixed += 1
        }
        await transport?.close()
        return "Serwer: \(fixed) z \(broken.count) pustych kadrów uzupełnione."
    }

    private func stillFromReplica(_ asset: LibraryAsset) async -> UIImage? {
        let videoExt: Set<String> = ["mov", "mp4", "m4v"]
        guard let primary = asset.primary, videoExt.contains(primary.ext.lowercased()),
              let url = completeFile(primary) else { return nil }
        return await Task.detached {
            let generator = AVAssetImageGenerator(asset: AVAsset(url: url))
            generator.appliesPreferredTrackTransform = true
            generator.maximumSize = CGSize(width: 480, height: 480)
            generator.requestedTimeToleranceBefore = .positiveInfinity
            generator.requestedTimeToleranceAfter = CMTime(seconds: 2, preferredTimescale: 600)
            guard let cg = try? generator.copyCGImage(at: CMTime(seconds: 0.4, preferredTimescale: 600), actualTime: nil) else { return nil }
            return UIImage(cgImage: cg)
        }.value
    }

    private func remember(directory: String, settings: DestinationSettings) {
        guard directory != settings.directory else { return }
        var saved = DestinationSettings.load()
        saved.directory = directory
        saved.save()
    }

    private func remoteNote(_ settings: DestinationSettings) async -> String {
        guard settings.kind == DestinationKind.webdav, !settings.remoteHost.isEmpty else {
            return placeName(settings)
        }
        let password = GalleryKeychain.string(account: "destination-password") ?? ""
        let port = settings.remotePort
        if let remote = try? await WebDAVTransport.open(
            remoteHost: settings.remoteHost,
            localHost: "",
            localPort: 0,
            localName: "",
            forcedPort: port,
            username: settings.username,
            password: password,
            directory: DestinationSettings.load().directory
        ) {
            await remote.transport.close()
            return "W domu i zdalnie, \(settings.remoteHost)"
        }
        let shown = port > 0 ? port : 5001
        return "W domu działa. Zdalnie przekieruj port \(shown) w myQNAPcloud."
    }

    func removeSyncedFromPhone() async -> String {
        let settings = DestinationSettings.load()
        guard settings.connected else {
            return "Najpierw połącz bibliotekę."
        }
        let candidates = photos.keys.filter { store.hash(forLocal: $0) != nil && assets[$0] != nil }
        guard !candidates.isEmpty else {
            return "Nie ma zdjęć, których oryginał jest już na serwerze."
        }
        library?.syncStatus = SyncStatus(
            title: "Sprawdzam oryginały",
            detail: "0 z \(candidates.count)",
            progress: 0,
            busy: true,
            visible: true
        )
        var safe: [String] = []
        do {
            if settings.kind == DestinationKind.immich {
                let client = try await immich(settings)
                let remote = try await client.listAll()
                let known = Set(remote.flatMap { [$0.id, $0.deviceAssetID] })
                for id in candidates {
                    guard let hash = store.hash(forLocal: id), known.contains(hash) else { continue }
                    safe.append(id)
                }
            } else {
                let transport = try await makeTransport(settings)
                try await transport.open()
                var index = 0
                for id in candidates {
                    index += 1
                    library?.syncStatus = SyncStatus(
                        title: "Sprawdzam oryginały",
                        detail: "\(index) z \(candidates.count)",
                        progress: Double(index) / Double(candidates.count),
                        busy: true,
                        visible: true
                    )
                    guard let hash = store.hash(forLocal: id),
                          let record = store.assets[hash],
                          let primary = record.primary else { continue }
                    let path = CatalogPaths.original(hash: primary.hash, ext: primary.ext)
                    if (try? await storedMatches(path, expected: primary.bytes, on: transport)) == true {
                        safe.append(id)
                    }
                }
                await transport.close()
            }
        } catch {
            library?.syncStatus = .paused(SyncPause.message(for: error))
            return "Nie skasowałem nic. Serwer nie potwierdził oryginałów."
        }
        guard !safe.isEmpty else {
            library?.syncStatus = .ready("Oryginały nie zostały potwierdzone")
            return "Nie skasowałem nic. Serwer nie potwierdził oryginałów."
        }
        let targets = safe.compactMap { assets[$0] }
        do {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                PHPhotoLibrary.shared().performChanges {
                    PHAssetChangeRequest.deleteAssets(targets as NSArray)
                } completionHandler: { ok, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else if ok {
                        continuation.resume()
                    } else {
                        continuation.resume(throwing: LibraryError(message: "\(ThisDevice.name) nie usunął zdjęć."))
                    }
                }
            }
        } catch {
            library?.syncStatus = .paused("\(ThisDevice.name) nie usunął zdjęć")
            return "Nie skasowałem nic. Zdjęcia zostały na iPhonie i na serwerze."
        }
        for id in safe {
            removedFromPhone.insert(id)
            store.detachLocal(id)
        }
        library?.overlayCatalog()
        library?.syncStatus = .ready("\(safe.count) zdjęć zostało na serwerze")
        return "Usunąłem \(safe.count) zdjęć z \(ThisDevice.genitive). Zostały na serwerze i przez 30 dni są w Ostatnio usuniętych."
    }

    private func noteRoute(_ label: String) {
        UserDefaults.standard.set(label, forKey: "galleryos.route")
    }

    private func routeDetail() -> String {
        let route = UserDefaults.standard.string(forKey: "galleryos.route") ?? ""
        let counts = SyncFeed.shared.counts
        let sent = counts.sent
        let waiting = counts.waiting
        if route.isEmpty { return "\(sent) na serwerze · zostało \(waiting)" }
        return "\(route) · \(sent) na serwerze · zostało \(waiting)"
    }

    private func inQueue(_ id: String) -> Bool {
        !pendingDelete.contains(id) && !duplicateIDs.contains(id) && !postponed.contains(id)
    }

    private func hasPendingUploads() -> Bool {
        let snapshot = progressSnapshot()
        return snapshot.sent < snapshot.total
    }

    private func keepsGoing(_ error: Error) -> Bool {
        if let url = error as? URLError {
            switch url.code {
            case .cancelled, .networkConnectionLost, .notConnectedToInternet, .timedOut,
                 .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed, .dataNotAllowed,
                 .internationalRoamingOff, .callIsActive, .backgroundSessionWasDisconnected,
                 .backgroundSessionInUseByAnotherProcess:
                return true
            default:
                break
            }
        }
        let text = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        if text.localizedCaseInsensitiveContains("hasło") { return false }
        if text.localizedCaseInsensitiveContains("prawo zapisu") { return false }
        if text.localizedCaseInsensitiveContains("brak dostępu") { return false }
        return true
    }

    private func policyBlock(needsNetwork: Bool) -> String? {
        SyncPolicy.blockReason(needsNetwork: needsNetwork, online: online, onWiFi: onWiFi, constrained: constrained)
    }

    private func guardBulk(_ id: String) throws {
        if stopBulk, !manual.contains(id) {
            throw CancellationError()
        }
    }

    private func reportManual() {
        let left = manual.filter { store.hash(forLocal: $0) == nil }.count
        library?.syncStatus = SyncStatus(
            title: "Wysyłanie",
            detail: left <= 1 ? "Wybrany plik" : "Wybrane · zostało \(left)",
            progress: min(max(fileFraction, 0.08), 0.99),
            busy: true,
            visible: true
        )
    }

    private func reportUpload() {
        guard SyncPolicy.uploadsEnabled, !stopBulk else {
            if manual.contains(activeID ?? "") { reportManual() }
            return
        }
        let settings = DestinationSettings.load()
        let snapshot = progressSnapshot()
        guard snapshot.total > 0 else { return }
        publishCounts()
        // Cap UI publishes so the status bar does not rebuild the grid every byte.
        let now = Date()
        if snapshot.sent < snapshot.total, now.timeIntervalSince(lastUploadReport) < 0.25 { return }
        lastUploadReport = now
        let previousTotal = shownTotal
        shownTotal = snapshot.total
        shownDone = min(snapshot.sent, shownTotal)
        let pending = shownTotal - shownDone
        let byCount = pending == 0
            ? 1.0
            : min(1, (Double(shownDone) + min(max(fileFraction, 0), 0.99)) / Double(shownTotal))
        let raw = byteProgress(countProgress: byCount)
        var capped = previousTotal == shownTotal && previousTotal > 0 ? max(shownProgress, raw) : raw
        if pending > 0 { capped = min(capped, 0.994) }
        shownProgress = capped
        ensurePoolScan()
        let bytesLeft = pending == 0 ? 0 : (remainingPoolBytes() ?? -1)
        if pending == 0 {
            let done = SyncStatus(
                title: "Synchronizacja",
                detail: "Wysłane z tego \(ThisDevice.genitive) · \(TransferText.groupedPublic(shownTotal))",
                progress: nil,
                busy: false,
                visible: true
            )
            if library?.syncStatus != done {
                library?.syncStatus = done
            }
            if running { finishContinued() }
            return
        }
        var line = TransferText.summary(
            done: shownDone,
            total: shownTotal,
            bytesLeft: bytesLeft
        )
        if !stepNote.isEmpty { line = "\(stepNote) · \(line)" }
        let status = SyncStatus(
            title: "Wysyłanie",
            detail: line,
            progress: shownProgress,
            busy: true,
            visible: true
        )
        if library?.syncStatus != status {
            library?.syncStatus = status
        }
        UserDefaults.standard.set(shownDone, forKey: "galleryos.sync.shownDone")
        UserDefaults.standard.set(shownTotal, forKey: "galleryos.sync.shownTotal")
        guard running, canSync() else { return }
        SyncLiveActivity.shared.update(
            done: shownDone,
            total: shownTotal,
            bytesSent: 0,
            bytesLeft: bytesLeft,
            place: uploadPlace(settings)
        )
        guard #available(iOS 26.0, *), let continued else { return }
        continuedTotal = max(continuedTotal, Int64(shownTotal) * 1000)
        let observed = Int64(shownDone) * 1000 + Int64(min(max(fileFraction, 0), 0.99) * 900)
        let next = min(max(continuedCompleted, observed), max(continuedTotal - 1, 0))
        if continued.progress.totalUnitCount != continuedTotal {
            continued.progress.totalUnitCount = continuedTotal
        }
        if continuedCompleted != next {
            continuedCompleted = next
            continued.progress.completedUnitCount = continuedCompleted
        }
        if line != continuedLine {
            continuedLine = line
            continued.updateTitle("Wysyłanie zdjęć", subtitle: line)
        }
    }

    private func restoreShownProgress() {
        guard UserDefaults.standard.bool(forKey: "galleryos.sync.awake") else { return }
        let total = UserDefaults.standard.integer(forKey: "galleryos.sync.shownTotal")
        let done = UserDefaults.standard.integer(forKey: "galleryos.sync.shownDone")
        guard total > 0, done < total else { return }
        shownDone = done
        shownTotal = total
        shownProgress = Double(done) / Double(total)
        continuedTotal = Int64(total) * 1000
        continuedCompleted = Int64(done) * 1000
        library?.syncStatus = SyncStatus(
            title: "Wysyłanie",
            detail: TransferText.summary(done: done, total: total, bytesLeft: -1),
            progress: shownProgress,
            busy: true,
            visible: true
        )
    }

    private func resetShownProgress() {
        shownDone = 0
        shownTotal = 0
        shownProgress = 0
        activeID = nil
        poolScan?.cancel()
        poolScan = nil
    }

    private func ensurePoolScan() {
        scheduleFactScan()
        seedPoolFromFacts()
    }

    /// File size and whether the original is on this device, read off the main thread.
    private struct AssetFacts: Sendable {
        var bytes: Int64
        var onPhone: Bool
    }

    nonisolated private static func measure(_ asset: PHAsset) -> AssetFacts {
        let resources = PHAssetResource.assetResources(for: asset)
        let useful: Set<PHAssetResourceType> = [
            .photo, .video, .fullSizePhoto, .fullSizeVideo, .pairedVideo, .fullSizePairedVideo,
        ]
        let chosen = resources.filter { useful.contains($0.type) }
        let list = chosen.isEmpty ? resources : chosen
        var bytes: Int64 = 0
        var flags: [Bool] = []
        for resource in list {
            if let number = resource.value(forKey: "fileSize") as? NSNumber {
                bytes += max(number.int64Value, 0)
            }
            if let local = resource.value(forKey: "locallyAvailable") as? Bool {
                flags.append(local)
            }
        }
        if bytes == 0 {
            if asset.mediaType == .video {
                bytes = Int64(max(asset.duration, 1) * 4_000_000)
            } else {
                let pixels = Int64(max(asset.pixelWidth, 1)) * Int64(max(asset.pixelHeight, 1))
                bytes = max(pixels / 2, 800_000)
            }
        }
        return AssetFacts(bytes: bytes, onPhone: flags.isEmpty || flags.contains(true))
    }

    /// Measures a few hundred photos at a time, away from the interface, and remembers the ones
    /// Photos no longer has so the same batch is not walked forever.
    private func scheduleFactScan() {
        guard factScan == nil else { return }
        let ids = Array(photos.keys.filter { factCache[$0] == nil }.prefix(240))
        guard !ids.isEmpty else { return }
        factScan = Task.detached(priority: .utility) { [weak self] in
            var found: [String: AssetFacts] = [:]
            found.reserveCapacity(ids.count)
            var start = 0
            while start < ids.count {
                if Task.isCancelled { return }
                let end = min(start + 40, ids.count)
                let slice = Array(ids[start..<end])
                let fetched = PHAsset.fetchAssets(withLocalIdentifiers: slice, options: nil)
                var seen = Set<String>()
                fetched.enumerateObjects { asset, _, _ in
                    seen.insert(asset.localIdentifier)
                    found[asset.localIdentifier] = LibraryEngine.measure(asset)
                }
                for id in slice where !seen.contains(id) {
                    found[id] = AssetFacts(bytes: 0, onPhone: true)
                }
                start = end
                await Task.yield()
            }
            let result = found
            await MainActor.run { [weak self] in
                guard let self else { return }
                self.factCache.merge(result) { _, new in new }
                self.factScan = nil
                self.seedPoolFromFacts()
                self.adoptDuplicates()
                self.reportUpload()
            }
        }
    }

    private func seedPoolFromFacts() {
        guard factCache.count != poolSeededCount else { return }
        var next = poolBytes
        var changed = false
        for (id, facts) in factCache where next[id] == nil && facts.bytes > 0 && store.hash(forLocal: id) == nil {
            next[id] = facts.bytes
            changed = true
        }
        poolSeededCount = factCache.count
        if changed { poolBytes = next }
    }

    /// Byte progress moves during a large file. A count of 2% stays on screen for the whole next photo.
    private func byteProgress(countProgress: Double) -> Double {
        guard let queued = queuedPoolBytes(), queued > 0 else { return countProgress }
        let done = sentByteTotal()
        var moved = 0.0
        if let activeID, store.hash(forLocal: activeID) == nil, let size = poolBytes[activeID] {
            moved = Double(size) * min(max(fileFraction, 0), 0.99)
        }
        let total = Double(done) + Double(queued)
        guard total > 0 else { return countProgress }
        return min(1, (Double(done) + moved) / total)
    }

    private func sentByteTotal() -> Int64 {
        let key = [countsRevision, store.mapRevision]
        if let sentByteCache, sentByteCache.key == key { return sentByteCache.bytes }
        var sum: Int64 = 0
        for id in photos.keys where inQueue(id) {
            guard let hash = store.hash(forLocal: id), let record = store.assets[hash] else { continue }
            sum += Int64(record.resources.reduce(0) { $0 + max($1.bytes, 0) })
        }
        sentByteCache = (key, sum)
        return sum
    }

    private func remainingPoolBytes() -> Int64? {
        let key = [countsRevision, store.mapRevision, poolRevision]
        let queued: Int64?
        if let poolCache, poolCache.key == key {
            queued = poolCache.bytes
        } else {
            queued = queuedPoolBytes()
            poolCache = (key, queued)
        }
        guard var sum = queued else { return nil }
        if sum == 0 { return hasPendingUploads() ? nil : 0 }
        if let activeID, store.hash(forLocal: activeID) == nil, !pendingDelete.contains(activeID), let size = poolBytes[activeID] {
            let moved = Int64((Double(size) * min(max(fileFraction, 0), 0.99)).rounded())
            sum = max(sum - moved, 0)
        }
        return sum
    }

    private func queuedPoolBytes() -> Int64? {
        var sum: Int64 = 0
        var any = false
        for id in photos.keys where store.hash(forLocal: id) == nil && inQueue(id) {
            any = true
            guard let size = poolBytes[id] else {
                if assets[id] != nil { return nil }
                continue
            }
            sum += size
        }
        guard any else { return 0 }
        // A measured zero means the size is not known yet (often an iCloud original).
        // Showing 0 MB next to a non-empty queue is a lie, so leave the figure off.
        return sum > 0 ? sum : nil
    }

    private static func assetBytes(_ asset: PHAsset) -> Int64 {
        let resources = PHAssetResource.assetResources(for: asset)
        let useful: Set<PHAssetResourceType> = [
            .photo, .video, .fullSizePhoto, .fullSizeVideo, .pairedVideo, .fullSizePairedVideo,
        ]
        let chosen = resources.filter { useful.contains($0.type) }
        let measured = (chosen.isEmpty ? resources : chosen).reduce(Int64(0)) { $0 + fileSize($1) }
        if measured > 0 { return measured }
        if asset.mediaType == .video {
            return Int64(max(asset.duration, 1) * 4_000_000)
        }
        let pixels = Int64(max(asset.pixelWidth, 1)) * Int64(max(asset.pixelHeight, 1))
        return max(pixels / 2, 800_000)
    }

    private struct MediaLoose: Hashable {
        var second: Int
        var width: Int
        var height: Int
        var durationMs: Int

        init(_ photo: PhotoRef) {
            second = Int(photo.created.timeIntervalSince1970.rounded())
            width = photo.pixelWidth
            height = photo.pixelHeight
            durationMs = Int((photo.duration * 10).rounded())
        }

        init(_ asset: LibraryAsset) {
            second = Int(asset.created.timeIntervalSince1970.rounded())
            width = asset.pixelWidth
            height = asset.pixelHeight
            durationMs = Int((asset.duration * 10).rounded())
        }
    }

    private struct MediaPrint: Hashable {
        var loose: MediaLoose
        var bytes: Int64
    }

    private static func fileSize(_ resource: PHAssetResource) -> Int64 {
        guard let number = resource.value(forKey: "fileSize") as? NSNumber else { return 0 }
        return max(number.int64Value, 0)
    }

    /// Counting walks every photo; the engine asks several times per tick, so cache it until
    /// the photo list, deletions or the server mapping change.
    private func progressSnapshot() -> (sent: Int, total: Int) {
        let key = [countsRevision, store.mapRevision, postponed.count]
        if let snapshotCache, snapshotCache.key == key {
            return (snapshotCache.sent, snapshotCache.total)
        }
        var sent = 0
        var total = 0
        for id in photos.keys where inQueue(id) {
            total += 1
            if store.hash(forLocal: id) != nil { sent += 1 }
        }
        snapshotCache = (key, sent, total)
        return (sent, total)
    }

    private func canSync() -> Bool {
        let settings = DestinationSettings.load()
        return settings.connected && settings.kind != DestinationKind.none
    }

    private func storedBytes() -> Int64 {
        (UserDefaults.standard.object(forKey: bytesKey) as? NSNumber)?.int64Value ?? 0
    }

    private func addBytes(_ value: Int64) {
        guard value > 0 else { return }
        UserDefaults.standard.set(NSNumber(value: storedBytes() + value), forKey: bytesKey)
    }

    private func fileBytes(_ url: URL) -> Int64 {
        let size = try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber
        return size?.int64Value ?? 0
    }

    private func uploadPlace(_ settings: DestinationSettings) -> String {
        let folder = settings.directory.isEmpty ? placeName(settings) : settings.directory
        if !settings.localName.isEmpty { return "\(folder) · \(settings.localName)" }
        if !settings.remoteHost.isEmpty { return "\(folder) · \(settings.remoteHost)" }
        if !settings.host.isEmpty { return "\(folder) · \(settings.host)" }
        return folder
    }

    private func placeName(_ settings: DestinationSettings) -> String {
        switch settings.kind {
        case DestinationKind.server: return "Serwer GalleryOS"
        case DestinationKind.webdav: return settings.place == LibraryPlace.qnap.rawValue ? "QNAP" : "Serwer"
        case DestinationKind.sftp: return "SFTP"
        case DestinationKind.folder: return settings.folderName.isEmpty ? "Dysk" : settings.folderName
        case DestinationKind.immich: return "Immich"
        default: return "Biblioteka"
        }
    }

    private func copy(_ from: URL, to: URL) {
        try? FileManager.default.createDirectory(at: to.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? FileManager.default.removeItem(at: to)
        try? FileManager.default.copyItem(at: from, to: to)
    }

    private func write(_ data: Data, to url: URL) {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: url, options: .atomic)
    }
}

private final class PreviewBox: @unchecked Sendable {
    var latest: UIImage?
    private let lock = NSLock()
    private var done = false

    func finish(_ continuation: CheckedContinuation<UIImage?, Never>, _ image: UIImage?) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        continuation.resume(returning: image ?? latest)
    }
}

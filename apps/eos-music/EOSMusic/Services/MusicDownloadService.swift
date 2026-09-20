import Foundation
import UIKit
import ActivityKit

enum TrackDownloadUIState: Equatable {
    case idle
    /// Trwała kopia jest na serwerze EOS, ale nie na tym iPhonie.
    case onServer
    /// Pozyskiwanie trwałej kopii na serwerze (0…100).
    case acquiringServer(progress: Double)
    /// Pobieranie na iPhone (po serwerze) — 0…100.
    case downloading(progress: Double)
    /// Plik lokalny w Pobrane (offline).
    case done
    case failed(String)

    /// Postęp 0…100 dla UI (serwer lub telefon).
    var progressPercent: Double {
        switch self {
        case .acquiringServer(let progress), .downloading(let progress):
            return progress
        default:
            return 0
        }
    }

    var isBusy: Bool {
        switch self {
        case .acquiringServer, .downloading: return true
        default: return false
        }
    }

    var isAcquiringServer: Bool {
        if case .acquiringServer = self { return true }
        return false
    }

    var isFailed: Bool {
        if case .failed = self { return true }
        return false
    }

    var isOnDevice: Bool {
        if case .done = self { return true }
        return false
    }
}

@MainActor
final class MusicDownloadService: ObservableObject {
    /// Wysyła lokalny plik (eosmusic://external/…) na serwer — ustawiane z AppModel.
    var externalFileUploadProvider: (@MainActor (String) async throws -> (local: URL, title: String, artist: String?, album: String?, fileName: String))?

    @Published private(set) var states: [String: TrackDownloadUIState] = [:]
    /// Postęp masowego zapisu albumu / playlisty na serwerze EOS.
    @Published private(set) var bulkServerQueue: BulkServerQueueProgress? {
        didSet { updateLiveActivity() }
    }
    @Published var isBulkQueueMinimized = true
    
    var hasActiveQueue: Bool {
        bulkServerQueue != nil
            || plusDrainTask != nil
            || !plusFIFO.isEmpty
            || !activeTasks.isEmpty
            || bulkServerTask != nil
    }

    private var activeTasks: [String: Task<Void, Never>] = [:]
    private var stickyBatchTotal = 0
    private var stickyBatchLabel = ""
    private var stickyBatchURLs: Set<String> = []
    private var stickyBatchId: String?
    private var stickyBatchRevision = 0
    private var isCancellingBatch = false
    private var stickyBatchItems: [ServerQueueItem] = []
    private var stickyDeviceItems: [ServerQueueItem] = []
    private var bulkFolderId = ""
    private var bulkOnLibraryChanged: (() async -> Void)?
    private var lastServerETA: Double?
    private var heldETAMinutes: Int?
    private var lastBatchCompleted = 0
    private var bulkGeneration = 0
    private var bulkCancelled = false
    private var bulkDestination: MusicDownloadDestination = .server
    private var bulkTrackByURL: [String: MusicTrack] = [:]
    private var bulkActiveURLs: Set<String> = []
    private var activeServerJobIds: [String: String] = [:]
    /// User dismissed the bulk panel — don't rebuild from remote poll until a new bulk starts.
    private var suppressRemoteBulkQueuePanel = false
    private var bulkServerTask: Task<Void, Never>?
    private var plusFIFO: [ServerQueueItem] = []
    private var plusCompleted = 0
    private var plusTotal = 0
    private var plusActive: ServerQueueItem?
    private var plusDrainTask: Task<Void, Never>?
    private var plusAPI: MusicAPIClient?
    private var plusResolveFolderId: ((String) async throws -> String?)?
    private var plusLibraryChanged: (() async -> Void)?
    private var plusOnReady: ((String) async -> Void)?
    private var plusQueuedURLs: Set<String> = []
    private var bulkBackgroundTaskId: UIBackgroundTaskIdentifier = .invalid
    private let offline = OfflineMusicStore.shared
    private let coordinator = DownloadCoordinator.shared
    private var acquirePollLastPublish: [String: (progress: Double, at: TimeInterval)] = [:]
    /// Tracks whether cancel should restore `.onServer` (server copy existed / was acquired).
    private var wasOnServer: [String: Bool] = [:]

    /// Used by playback prefetch to avoid fighting user downloads for bandwidth.
    static var hasActiveDownloads: Bool { activeDownloadCount > 0 }
    private static var activeDownloadCount = 0
    private static var serverAcquireURLs: Set<String> = []

    static func isServerAcquireActive(_ url: String) -> Bool {
        serverAcquireURLs.contains(url)
    }

    private static func setServerAcquireActive(_ url: String, _ active: Bool) {
        if active {
            serverAcquireURLs.insert(url)
        } else {
            serverAcquireURLs.remove(url)
        }
    }

    struct BulkServerQueueProgress: Equatable {
        let label: String
        let completed: Int
        let total: Int
        let active: ServerQueueItem?
        let pending: [ServerQueueItem]
        let activeProgress: Double?
        var destination: MusicDownloadDestination = .server
        var phase: MusicBulkQueuePhase = .server
        var deviceCompleted: Int = 0
        var deviceTotal: Int = 0
        var deviceActive: ServerQueueItem? = nil
        var devicePending: [ServerQueueItem] = []
        var deviceActiveProgress: Double? = nil
        var etaSeconds: Double? = nil

        var currentTitle: String? {
            phase == .device ? (deviceActive?.title ?? active?.title) : active?.title
        }

        var extraActive: ServerQueueItem? = nil
        var extraActiveProgress: Double? = nil

        var liveCurrentItems: [DownloadAttributes.CurrentItem] {
            var items: [DownloadAttributes.CurrentItem] = []
            if phase == .device, let deviceActive {
                items.append(
                    DownloadAttributes.CurrentItem(
                        title: deviceActive.title,
                        progress: min(1, max(0, (deviceActiveProgress ?? 0) / 100))
                    )
                )
            } else {
                if let active {
                    items.append(
                        DownloadAttributes.CurrentItem(
                            title: active.title,
                            progress: min(1, max(0, (activeProgress ?? 0) / 100))
                        )
                    )
                }
                if let extraActive {
                    items.append(
                        DownloadAttributes.CurrentItem(
                            title: extraActive.title,
                            progress: min(1, max(0, (extraActiveProgress ?? 0) / 100))
                        )
                    )
                }
            }
            return Array(items.prefix(2))
        }

        var remainingCount: Int {
            if phase == .device {
                return max(0, deviceTotal - deviceCompleted)
            }
            let serverLeft = max(0, total - completed)
            if destination == .serverAndPhone {
                return serverLeft + max(0, deviceTotal - deviceCompleted)
            }
            return serverLeft
        }

        var overallProgress: Double {
            if destination == .server {
                guard total > 0 else { return 0 }
                let activeBump = activeProgress.map { $0 / 100 / Double(total) } ?? 0
                return min(1, Double(completed) / Double(total) + activeBump)
            }
            let serverWeight = 0.58
            let serverDone = total > 0 ? Double(completed) / Double(total) : 1
            let serverActive = (activeProgress ?? 0) / 100 / Double(max(total, 1))
            if phase == .server {
                return min(serverWeight, (serverDone + serverActive) * serverWeight)
            }
            let deviceDone = deviceTotal > 0 ? Double(deviceCompleted) / Double(deviceTotal) : 1
            let deviceActive = (deviceActiveProgress ?? 0) / 100 / Double(max(deviceTotal, 1))
            return min(1, serverWeight + (deviceDone + deviceActive) * (1 - serverWeight))
        }
    }

    struct ServerQueueItem: Equatable {
        let url: String
        let folderId: String
        let title: String
    }

    func uiState(for url: String, isOnServer: Bool) -> TrackDownloadUIState {
        if offline.isAvailable(url) { return .done }
        if let state = states[url] {
            if case .idle = state, isOnServer { return .onServer }
            return state
        }
        return isOnServer ? .onServer : .idle
    }

    /// Successful local/external upload remembered on-device (survives until app restart).
    func wasConfirmedOnServer(_ url: String) -> Bool {
        wasOnServer[url] == true
    }

    /// Kompatybilność ze starymi call-site’ami (`isDownloaded` = na serwerze).
    func uiState(for url: String, isDownloaded: Bool) -> TrackDownloadUIState {
        uiState(for: url, isOnServer: isDownloaded)
    }

    func syncFromTracks(_ tracks: [MusicTrack]) {
        offline.pruneMissingEntries()
        for track in tracks {
            if offline.isAvailable(track.url) {
                states[track.url] = .done
                wasOnServer[track.url] = true
                continue
            }
            if let current = states[track.url], current.isBusy { continue }
            if track.isOnServer {
                wasOnServer[track.url] = true
                if states[track.url] == nil || states[track.url] == .idle || states[track.url]?.isFailed == true {
                    states[track.url] = .onServer
                }
            }
        }
    }

    func isOfflineAvailable(_ url: String) -> Bool {
        offline.isAvailable(url)
    }

    /// Po „+” / dodaniu do playlisty: trwała kopia na serwerze + progress chmurki (bez wymuszania pliku na iPhone).
    func ensureOnServer(
        url: String,
        folderId: String?,
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)? = nil,
        onReady: (() async -> Void)? = nil
    ) {
        if offline.isAvailable(url) {
            states[url] = .done
            return
        }
        if case .onServer = states[url] { return }
        if case .acquiringServer = states[url] { return }
        if case .downloading = states[url] { return }

        Self.setServerAcquireActive(url, true)
        activeTasks[url]?.cancel()
        activeTasks[url] = Task {
            do {
                try await coordinator.withPhaseSlot(trackUrl: url, kind: .serverAcquire) {
                    try await self.acquireOnServer(
                        url: url,
                        folderId: folderId,
                        api: api,
                        onLibraryChanged: onLibraryChanged
                    )
                }
                if Task.isCancelled { return }
                wasOnServer[url] = true
                states[url] = .onServer
                await onReady?()
            } catch is CancellationError {
                restoreAfterCancel(url: url, isOnServerHint: wasOnServer[url] == true)
            } catch {
                if Task.isCancelled { return }
                states[url] = .failed(error.localizedDescription)
            }
            activeTasks[url] = nil
        }
    }

    /// Instant “+”: swap icon to progress, grow the queue, persist in the background.
    func enqueueServerAcquire(
        url: String,
        title: String,
        folderId: String?,
        api: MusicAPIClient,
        resolveFolderId: ((String) async throws -> String?)? = nil,
        onLibraryChanged: (() async -> Void)? = nil,
        onReady: ((String) async -> Void)? = nil
    ) {
        if offline.isAvailable(url) {
            states[url] = .done
            return
        }
        if case .onServer = states[url] { return }
        if case .downloading = states[url] { return }
        if plusQueuedURLs.contains(url) { return }
        if case .acquiringServer = states[url], plusQueuedURLs.contains(url) { return }

        plusAPI = api
        if let resolveFolderId { plusResolveFolderId = resolveFolderId }
        if let onLibraryChanged { plusLibraryChanged = onLibraryChanged }
        if let onReady { plusOnReady = onReady }
        suppressRemoteBulkQueuePanel = false
        if bulkServerQueue == nil {
            isBulkQueueMinimized = true
        }

        plusQueuedURLs.insert(url)
        Self.setServerAcquireActive(url, true)
        states[url] = .acquiringServer(progress: 4)
        plusFIFO.append(ServerQueueItem(url: url, folderId: folderId ?? "", title: title))
        plusTotal += 1
        if !ownsStickyBatch {
            publishPlusQueue()
        }
        startPlusDrain()
    }

    private var ownsStickyBatch: Bool {
        bulkServerTask != nil || !stickyBatchURLs.isEmpty
    }

    private func updateLiveActivity() {
        if let queue = bulkServerQueue {
            let item = (queue.phase == .device ? queue.deviceActiveProgress : queue.activeProgress) ?? 0
            let phase = queue.phase == .device ? "Na iPhonie" : "Na serwerze"
            DownloadLiveActivityController.shared.publishMusic(
                itemProgress: item / 100,
                overallProgress: queue.overallProgress,
                completed: queue.phase == .device ? queue.deviceCompleted : queue.completed,
                total: queue.phase == .device ? max(queue.deviceTotal, 1) : max(queue.total, 1),
                phase: isCancellingBatch ? "Anulowanie" : phase,
                title: queue.currentTitle ?? queue.label,
                currentItems: queue.liveCurrentItems,
                remainingCount: queue.remainingCount,
                serverETA: queue.etaSeconds ?? lastServerETA,
                batchId: stickyBatchId ?? "",
                revision: max(stickyBatchRevision, 1)
            )
        } else {
            DownloadLiveActivityController.shared.endMusic()
        }
    }

    private func publishPlusQueue(activeProgress: Double? = nil) {
        guard !ownsStickyBatch else { return }
        let total = max(plusTotal, 1)
        bulkServerQueue = attachETA(BulkServerQueueProgress(
            label: "Kolejka na serwer",
            completed: plusCompleted,
            total: total,
            active: plusActive,
            pending: plusFIFO,
            activeProgress: activeProgress ?? plusActive.map { states[$0.url]?.progressPercent } ?? nil
        ))
    }

    private func makeDeviceProgress(
        label: String,
        destination: MusicDownloadDestination,
        serverDone: Int,
        deviceCompleted: Int,
        allDevice: [ServerQueueItem],
        activeIndex: Int,
        progress: Double? = nil
    ) -> BulkServerQueueProgress {
        let active = allDevice.indices.contains(activeIndex) ? allDevice[activeIndex] : nil
        let pending = activeIndex + 1 < allDevice.count ? Array(allDevice[(activeIndex + 1)...]) : []
        return attachETA(BulkServerQueueProgress(
            label: label,
            completed: serverDone,
            total: serverDone,
            active: nil,
            pending: [],
            activeProgress: nil,
            destination: destination,
            phase: .device,
            deviceCompleted: deviceCompleted,
            deviceTotal: max(allDevice.count, 1),
            deviceActive: active,
            devicePending: pending,
            deviceActiveProgress: progress
        ))
    }

    private func attachETA(_ progress: BulkServerQueueProgress) -> BulkServerQueueProgress {
        var next = progress
        next.etaSeconds = resolveHeldETA(remaining: progress.remainingCount)
        return next
    }

    private func resolveHeldETA(remaining: Int) -> Double {
        let raw = lastServerETA ?? Double(max(1, remaining)) * 25
        let minutes = max(1, Int((raw / 60.0).rounded()))
        if let held = heldETAMinutes {
            if abs(minutes - held) >= 1 {
                heldETAMinutes = minutes
            }
        } else {
            heldETAMinutes = minutes
        }
        return Double(heldETAMinutes ?? minutes) * 60
    }

    private func startPlusDrain() {
        guard plusDrainTask == nil else { return }
        plusDrainTask = Task { [weak self] in
            guard let self else { return }
            self.beginBulkBackgroundTask()
            defer {
                self.endBulkBackgroundTask()
                self.plusDrainTask = nil
                if !self.plusFIFO.isEmpty {
                    self.startPlusDrain()
                }
            }
            await self.drainPlusQueue(limit: BulkServerQueuePolicy.maxConcurrentServerJobs)
            if self.plusFIFO.isEmpty {
                self.plusActive = nil
                if self.plusCompleted >= self.plusTotal {
                    self.plusQueuedURLs.removeAll()
                    self.plusCompleted = 0
                    self.plusTotal = 0
                    if !self.ownsStickyBatch {
                        self.bulkServerQueue = nil
                    }
                } else {
                    self.publishPlusQueue()
                }
            }
        }
    }

    private func takeNextPlusItem() -> ServerQueueItem? {
        guard !Task.isCancelled, plusAPI != nil, !plusFIFO.isEmpty else { return nil }
        let item = plusFIFO.removeFirst()
        plusActive = item
        publishPlusQueue(activeProgress: 4)
        return item
    }

    private func drainPlusQueue(limit: Int) async {
        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<max(1, limit) {
                guard let item = takeNextPlusItem() else { break }
                group.addTask { @MainActor in
                    await self.runPlusItem(item)
                }
            }
            for await _ in group {
                guard let item = takeNextPlusItem() else { continue }
                group.addTask { @MainActor in
                    await self.runPlusItem(item)
                }
            }
        }
    }

    private func runPlusItem(_ item: ServerQueueItem) async {
        guard let api = plusAPI else { return }
        var folderId = item.folderId
        do {
            if folderId.isEmpty {
                folderId = try await plusResolveFolderId?(item.url) ?? ""
            }
            await ensureOnServerWithRetry(
                url: item.url,
                folderId: folderId,
                title: item.title,
                api: api,
                onLibraryChanged: plusLibraryChanged,
                onAcquireProgress: { [weak self] progress in
                    Task { @MainActor in
                        self?.plusActive = item
                        self?.publishPlusQueue(activeProgress: progress)
                    }
                }
            )
            plusQueuedURLs.remove(item.url)
            plusCompleted += 1
            await plusOnReady?(item.title)
        } catch {
            plusQueuedURLs.remove(item.url)
            plusCompleted += 1
        }
        if plusActive?.url == item.url {
            plusActive = plusFIFO.first
        }
        publishPlusQueue()
    }

    /// Kolejka albumu: dopisuje utwory do tej samej kolejki co pojedyncze „+”.
    func queueAllOnServerSequentially(
        label: String,
        items: [ServerQueueItem],
        api: MusicAPIClient,
        isAlreadyOnServer: @escaping (String) -> Bool,
        onLibraryChanged: (() async -> Void)? = nil,
        onAllComplete: (() async -> Void)? = nil
    ) {
        let tracks = items.map {
            MusicTrack(folderId: $0.folderId, url: $0.url, title: $0.title)
        }
        queueBulkDownload(
            label: label,
            tracks: tracks,
            folderId: items.first?.folderId ?? "",
            destination: .server,
            api: api,
            isAlreadyOnServer: isAlreadyOnServer,
            onLibraryChanged: onLibraryChanged
        )
        if let onAllComplete {
            Task {
                while self.bulkServerTask != nil {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                }
                await onAllComplete()
            }
        }
    }

    func cancelBulkServerQueue(api: MusicAPIClient? = nil, remoteMusicJobs: [ActiveServerDownload] = []) {
        isCancellingBatch = true
        updateLiveActivity()
        bulkCancelled = true
        bulkGeneration += 1
        let snapshot = bulkServerQueue
        var urlsToStop = bulkActiveURLs.union(stickyBatchURLs)
        if let active = snapshot?.active { urlsToStop.insert(active.url) }
        snapshot?.pending.forEach { urlsToStop.insert($0.url) }
        if let deviceActive = snapshot?.deviceActive { urlsToStop.insert(deviceActive.url) }
        snapshot?.devicePending.forEach { urlsToStop.insert($0.url) }
        stickyBatchItems.forEach { urlsToStop.insert($0.url) }

        var jobIds = Set<String>()
        for url in urlsToStop {
            if let jobId = activeServerJobIds[url] { jobIds.insert(jobId) }
        }
        for item in remoteMusicJobs where item.isMusic && !item.isTerminal {
            if urlsToStop.contains(item.url) || stickyBatchURLs.contains(item.url) {
                jobIds.insert(item.jobId)
            }
        }

        suppressRemoteBulkQueuePanel = true
        plusDrainTask?.cancel()
        plusDrainTask = nil
        plusFIFO.removeAll()
        plusQueuedURLs.removeAll()
        plusActive = nil
        plusCompleted = 0
        plusTotal = 0
        let running = bulkServerTask
        bulkServerTask = nil
        running?.cancel()
        bulkServerQueue = nil
        bulkTrackByURL = [:]
        bulkActiveURLs = []
        let batchId = stickyBatchId
        let itemsToCancel = stickyBatchItems
        stickyBatchTotal = 0
        stickyBatchLabel = ""
        stickyBatchURLs = []
        stickyBatchItems = []
        stickyDeviceItems = []
        stickyBatchId = nil
        bulkFolderId = ""
        bulkOnLibraryChanged = nil
        lastServerETA = nil
        heldETAMinutes = nil
        lastBatchCompleted = 0
        stickyBatchRevision = 0
        isCancellingBatch = false
        clearPersistedBatch()
        endBulkBackgroundTask()
        DownloadLiveActivityController.shared.endMusic()

        if let api {
            Task {
                if let batchId {
                    try? await api.cancelDownloadQueue(batchId: batchId)
                    let deadline = Date().addingTimeInterval(8)
                    while Date() < deadline {
                        if let live = try? await api.fetchActiveServerDownloads(),
                           live.batch?.status == "cancelled" || live.batch?.id != batchId {
                            break
                        }
                        try? await Task.sleep(nanoseconds: 400_000_000)
                    }
                }
                var ids = jobIds
                if let live = try? await api.fetchActiveServerDownloads() {
                    let music = live.music.isEmpty ? live.items.filter(\.isMusic) : live.music
                    let cancelURLs = Set(itemsToCancel.map(\.url)).union(urlsToStop)
                    for item in music where !item.isTerminal && cancelURLs.contains(item.url) {
                        ids.insert(item.jobId)
                    }
                }
                for jobId in ids {
                    try? await api.cancelJob(jobId: jobId)
                }
            }
        }

        for url in urlsToStop {
            cancelDownload(for: url, isOnServer: wasOnServer[url] == true, api: api)
            if !offline.isAvailable(url), wasOnServer[url] != true {
                states[url] = .idle
            }
            activeServerJobIds.removeValue(forKey: url)
        }
    }

    /// Kolejka playlisty / zaznaczenia: najpierw serwer (po kolei), potem opcjonalnie urządzenie.
    func queueBulkDownload(
        label: String,
        tracks: [MusicTrack],
        folderId: String,
        destination: MusicDownloadDestination,
        api: MusicAPIClient,
        isAlreadyOnServer: @escaping (String) -> Bool,
        onLibraryChanged: (() async -> Void)? = nil
    ) {
        let serverItems: [ServerQueueItem] = tracks.compactMap { (track) -> ServerQueueItem? in
            if offline.isAvailable(track.url) { return nil }
            if states[track.url] == .done { return nil }
            let durable = isAlreadyOnServer(track.url) || (track.serverAssetId?.isEmpty == false)
            if BulkServerQueuePolicy.shouldSkipAsAlreadyOnServer(
                isOffline: false,
                hasDurableAsset: durable,
                wasConfirmedOnServer: wasOnServer[track.url] == true && states[track.url]?.isFailed != true
            ) {
                return nil
            }
            return ServerQueueItem(url: track.url, folderId: folderId, title: track.title)
        }
        let deviceCandidates = destination == .serverAndPhone
            ? tracks.filter { !offline.isAvailable($0.url) }
            : []
        let deviceItems: [ServerQueueItem] = deviceCandidates.map {
            ServerQueueItem(url: $0.url, folderId: folderId, title: $0.title)
        }

        guard !serverItems.isEmpty || (destination == .serverAndPhone && !deviceItems.isEmpty) else { return }

        preemptConflictingQueues(api: api)

        suppressRemoteBulkQueuePanel = false
        if bulkServerQueue == nil {
            isBulkQueueMinimized = true
        }
        bulkDestination = destination
        bulkTrackByURL = Dictionary(tracks.map { ($0.url, $0) }, uniquingKeysWith: { _, last in last })
        bulkActiveURLs = Set(serverItems.map(\.url) + deviceItems.map(\.url))
        stickyBatchLabel = label
        stickyBatchTotal = max(serverItems.count, 1)
        stickyBatchURLs = Set(serverItems.map(\.url))
        stickyBatchItems = serverItems
        stickyDeviceItems = deviceItems
        stickyBatchId = nil
        bulkFolderId = folderId
        bulkOnLibraryChanged = onLibraryChanged
        lastServerETA = Double(max(1, serverItems.count)) * 25
        heldETAMinutes = nil
        lastBatchCompleted = 0
        bulkCancelled = false
        for item in serverItems {
            wasOnServer[item.url] = false
            if states[item.url] == .onServer || states[item.url]?.isFailed == true {
                states[item.url] = .idle
            }
        }
        bulkGeneration += 1
        let generation = bulkGeneration
        plusAPI = api

        func snapshotServer(completed: Int, active: ServerQueueItem?, pending: [ServerQueueItem], progress: Double?) -> BulkServerQueueProgress {
            attachETA(BulkServerQueueProgress(
                label: label,
                completed: completed,
                total: max(serverItems.count, 1),
                active: active,
                pending: pending,
                activeProgress: progress,
                destination: destination,
                phase: .server,
                deviceTotal: deviceItems.count
            ))
        }

        bulkServerQueue = snapshotServer(
            completed: 0,
            active: serverItems.first,
            pending: Array(serverItems.dropFirst()),
            progress: 4
        )

        startServerOwnedBatch(
            generation: generation,
            folderId: folderId,
            destination: destination,
            deviceItems: deviceItems,
            api: api,
            onLibraryChanged: onLibraryChanged,
            label: label
        )
    }

    private func isCurrentBulk(_ generation: Int) -> Bool {
        !bulkCancelled && generation == bulkGeneration && bulkServerTask != nil && !Task.isCancelled
    }

    private func runPhoneOwnedServerAcquire(
        generation: Int,
        items: [ServerQueueItem],
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)?
    ) async {
        var pending = items.filter { !isServerFinished($0.url) }
        guard !pending.isEmpty else { return }
        let limit = BulkServerQueuePolicy.maxConcurrentServerJobs
        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<limit {
                guard isCurrentBulk(generation), !pending.isEmpty else { break }
                let item = pending.removeFirst()
                group.addTask { @MainActor in
                    await self.acquireServerItem(
                        item,
                        generation: generation,
                        api: api,
                        onLibraryChanged: onLibraryChanged
                    )
                }
            }
            for await _ in group {
                guard isCurrentBulk(generation), !pending.isEmpty else { continue }
                let item = pending.removeFirst()
                group.addTask { @MainActor in
                    await self.acquireServerItem(
                        item,
                        generation: generation,
                        api: api,
                        onLibraryChanged: onLibraryChanged
                    )
                }
            }
        }
        publishStickyServerSnapshot()
    }

    private func acquireServerItem(
        _ item: ServerQueueItem,
        generation: Int,
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)?
    ) async {
        guard isCurrentBulk(generation), !isServerFinished(item.url) else { return }
        let folder = item.folderId.isEmpty ? bulkFolderId : item.folderId
        await ensureOnServerWithRetry(
            url: item.url,
            folderId: folder,
            title: item.title,
            api: api,
            onLibraryChanged: onLibraryChanged,
            onAcquireProgress: { [weak self] progress in
                Task { @MainActor in
                    guard let self, self.isCurrentBulk(generation) else { return }
                    self.states[item.url] = .acquiringServer(progress: progress)
                    self.publishStickyServerSnapshot()
                }
            }
        )
        publishStickyServerSnapshot()
    }

    private func needsServerAcquire(_ url: String) -> Bool {
        if offline.isAvailable(url) { return false }
        if states[url] == .done { return false }
        if states[url] == .onServer { return false }
        return true
    }

    private func kickSequentialBulkIfNeeded() {
        guard !suppressRemoteBulkQueuePanel, !bulkCancelled else { return }
        guard bulkServerTask == nil, let api = plusAPI else { return }
        guard stickyBatchItems.contains(where: { needsServerAcquire($0.url) }) else { return }
        startServerOwnedBatch(
            generation: bulkGeneration,
            folderId: bulkFolderId,
            destination: bulkDestination,
            deviceItems: stickyDeviceItems,
            api: api,
            onLibraryChanged: bulkOnLibraryChanged,
            label: stickyBatchLabel
        )
    }

    private func startServerOwnedBatch(
        generation: Int,
        folderId: String,
        destination: MusicDownloadDestination,
        deviceItems: [ServerQueueItem],
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)?,
        label: String
    ) {
        startSequentialServerLoop(
            generation: generation,
            folderId: folderId,
            destination: destination,
            deviceItems: deviceItems,
            api: api,
            onLibraryChanged: onLibraryChanged,
            label: label
        )
    }

    private func startSequentialServerLoop(
        generation: Int,
        folderId: String,
        destination: MusicDownloadDestination,
        deviceItems: [ServerQueueItem],
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)?,
        label: String
    ) {
        guard bulkServerTask == nil else { return }
        bulkServerTask = Task { @MainActor in
            beginBulkBackgroundTask()
            DownloadBackgroundKeeper.shared.noteWorkChanged()
            defer {
                endBulkBackgroundTask()
                DownloadBackgroundKeeper.shared.noteWorkChanged()
                if bulkGeneration == generation {
                    bulkServerTask = nil
                }
            }

            let allServer = stickyBatchItems
            if !allServer.isEmpty {
                var didEnqueue = false
                var enqueuedBatchId: String?
                do {
                    let response = try await api.enqueueDownloadQueue(
                        folderId: folderId,
                        label: label,
                        tracks: allServer.map { (url: $0.url, title: $0.title) }
                    )
                    didEnqueue = true
                    enqueuedBatchId = response.batchId
                    if let batchId = response.batchId, !batchId.isEmpty {
                        stickyBatchId = batchId
                        stickyBatchRevision = max(stickyBatchRevision, 1)
                        persistBatchSession()
                    }
                    EOSLog.downloadQueue.info(
                        "enqueued batch=\(response.batchId ?? "", privacy: .public) count=\(allServer.count)"
                    )
                } catch {
                    EOSLog.downloadQueue.error("enqueue failed \(error.localizedDescription, privacy: .public)")
                }

                if ServerOwnedQueuePolicy.shouldFallBackToPhoneAcquire(
                    didEnqueue: didEnqueue,
                    batchId: enqueuedBatchId ?? stickyBatchId
                ) {
                    EOSLog.downloadQueue.warning("server queue unavailable — phone-owned acquire \(allServer.count) tracks")
                    await runPhoneOwnedServerAcquire(
                        generation: generation,
                        items: allServer,
                        api: api,
                        onLibraryChanged: onLibraryChanged
                    )
                } else {
                    publishStickyServerSnapshot()
                    let waitStarted = Date()
                    var serverWentIdle = false
                    while isCurrentBulk(generation) {
                        if allServer.allSatisfy({ !needsServerAcquire($0.url) || isServerFinished($0.url) }) {
                            break
                        }
                        var hasActiveRemoteJob = false
                        if let live = try? await api.fetchActiveServerDownloads() {
                            let music = live.music.isEmpty ? live.items.filter(\.isMusic) : live.music
                            hasActiveRemoteJob = music.contains { !$0.isTerminal && !$0.isFailed }
                            applyRemoteServerDownloads(music, batch: live.batch)
                        }
                        let finished = allServer.filter { isServerFinished($0.url) }.count
                        if ServerOwnedQueuePolicy.shouldAbandonIdleServerBatch(
                            secondsWaiting: Date().timeIntervalSince(waitStarted),
                            completed: max(finished, lastBatchCompleted),
                            hasActiveRemoteJob: hasActiveRemoteJob
                        ) {
                            EOSLog.downloadQueue.warning("server batch idle — falling back to phone-owned acquire")
                            serverWentIdle = true
                            break
                        }
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                    }
                    if serverWentIdle, isCurrentBulk(generation) {
                        await runPhoneOwnedServerAcquire(
                            generation: generation,
                            items: allServer,
                            api: api,
                            onLibraryChanged: onLibraryChanged
                        )
                    }
                }
            }

            guard destination == .serverAndPhone, isCurrentBulk(generation) else {
                if destination != .serverAndPhone, isCurrentBulk(generation) {
                    clearPersistedBatch()
                    bulkServerQueue = nil
                    stickyBatchURLs = []
                    stickyBatchItems = []
                    stickyDeviceItems = []
                    stickyBatchId = nil
                    lastBatchCompleted = 0
                }
                return
            }

            stickyBatchURLs = []
            stickyBatchId = nil

            var deviceCompleted = 0
            let allDevice = deviceItems
            let serverDone = max(allServer.count, stickyBatchTotal, 1)

            bulkServerQueue = makeDeviceProgress(
                label: label,
                destination: destination,
                serverDone: serverDone,
                deviceCompleted: deviceCompleted,
                allDevice: allDevice,
                activeIndex: 0
            )
            for (index, item) in allDevice.enumerated() {
                if Task.isCancelled || !isCurrentBulk(generation) { break }
                if offline.isAvailable(item.url) {
                    deviceCompleted += 1
                    continue
                }
                guard let track = bulkTrackByURL[item.url] else { continue }
                bulkServerQueue = makeDeviceProgress(
                    label: label,
                    destination: destination,
                    serverDone: serverDone,
                    deviceCompleted: deviceCompleted,
                    allDevice: allDevice,
                    activeIndex: index
                )
                await downloadAndWait(
                    track: track,
                    folderId: folderId,
                    api: api,
                    onLibraryChanged: { await onLibraryChanged?() },
                    onDeviceProgress: { [weak self] pct in
                        Task { @MainActor in
                            guard let self, self.isCurrentBulk(generation) else { return }
                            self.bulkServerQueue = self.makeDeviceProgress(
                                label: label,
                                destination: destination,
                                serverDone: serverDone,
                                deviceCompleted: deviceCompleted,
                                allDevice: allDevice,
                                activeIndex: index,
                                progress: pct
                            )
                            self.states[item.url] = .downloading(progress: pct)
                        }
                    }
                )
                if Task.isCancelled || !isCurrentBulk(generation) { break }
                deviceCompleted += 1
                bulkServerQueue = makeDeviceProgress(
                    label: label,
                    destination: destination,
                    serverDone: serverDone,
                    deviceCompleted: deviceCompleted,
                    allDevice: allDevice,
                    activeIndex: min(index + 1, max(allDevice.count - 1, 0))
                )
            }
            if isCurrentBulk(generation) {
                bulkServerQueue = nil
            }
        }
    }

    /// Playlist download owns the NAS worker. Stop plus-drain and any previous
    /// bulk so the next track can start instead of stalling behind a leftover job.
    private func preemptConflictingQueues(api: MusicAPIClient) {
        plusDrainTask?.cancel()
        plusDrainTask = nil
        plusFIFO.removeAll()
        plusQueuedURLs.removeAll()
        plusActive = nil
        plusCompleted = 0
        plusTotal = 0

        let previousJobs = activeServerJobIds
        let running = bulkServerTask
        bulkServerTask = nil
        running?.cancel()
        activeServerJobIds = [:]
        if !previousJobs.isEmpty {
            Task {
                for jobId in previousJobs.values where !jobId.isEmpty {
                    try? await api.cancelJob(jobId: jobId)
                }
            }
        }
    }

    private func publishStickyServerSnapshot() {
        let items = stickyBatchItems
        guard !items.isEmpty else { return }
        if let existing = bulkServerQueue, existing.phase == .device { return }
        let finished = items.filter { isServerFinished($0.url) }
        let unfinished = items.filter { !isServerFinished($0.url) }
        if unfinished.count >= 10, (heldETAMinutes ?? 1) <= 1 {
            heldETAMinutes = nil
            lastServerETA = Double(unfinished.count) * 25
        }
        let acquiring = unfinished.filter { states[$0.url]?.isAcquiringServer == true }
        let active = acquiring.first ?? unfinished.first
        let extra = acquiring.dropFirst().first
        let pending = unfinished.filter { $0.url != active?.url && $0.url != extra?.url }
        let progress = active.flatMap { states[$0.url]?.progressPercent }
        var next = attachETA(BulkServerQueueProgress(
            label: stickyBatchLabel.isEmpty ? (bulkServerQueue?.label ?? "Zapis na serwer EOS") : stickyBatchLabel,
            completed: finished.filter { states[$0.url]?.isFailed != true }.count,
            total: BulkServerQueuePolicy.displayTotal(
                stickyTotal: stickyBatchTotal,
                itemCount: items.count,
                existingTotal: bulkServerQueue?.total ?? 0
            ),
            active: active,
            pending: pending,
            activeProgress: progress,
            destination: bulkServerQueue?.destination ?? bulkDestination,
            phase: .server,
            deviceTotal: bulkServerQueue?.deviceTotal ?? stickyDeviceItems.count
        ))
        next.extraActive = extra
        next.extraActiveProgress = extra.flatMap { states[$0.url]?.progressPercent }
        if bulkServerQueue != next {
            bulkServerQueue = next
        }
    }

    private func isServerFinished(_ url: String) -> Bool {
        wasOnServer[url] == true
            || offline.isAvailable(url)
            || states[url]?.isFailed == true
            || states[url] == .onServer
            || states[url] == .done
    }

    private func beginBulkBackgroundTask() {
        guard bulkBackgroundTaskId == .invalid else { return }
        bulkBackgroundTaskId = UIApplication.shared.beginBackgroundTask(withName: "EOSMusic.BulkServerQueue") { [weak self] in
            Task { @MainActor in
                self?.endBulkBackgroundTask()
                DownloadBackgroundKeeper.shared.noteWorkChanged()
            }
        }
        DownloadBackgroundKeeper.shared.noteWorkChanged()
    }

    private func endBulkBackgroundTask() {
        guard bulkBackgroundTaskId != .invalid else { return }
        UIApplication.shared.endBackgroundTask(bulkBackgroundTaskId)
        bulkBackgroundTaskId = .invalid
    }

    /// Bounded retry (max 5) via `DownloadRetryPolicy`.
    private func ensureOnServerWithRetry(
        url: String,
        folderId: String,
        title: String,
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)? = nil,
        onAcquireProgress: ((Double) -> Void)? = nil
    ) async {
        var attempt = 0
        while !Task.isCancelled {
            do {
                try await coordinator.withPhaseSlot(trackUrl: url, kind: .serverAcquire) {
                    try await self.acquireOnServer(
                        url: url,
                        folderId: folderId,
                        api: api,
                        onLibraryChanged: onLibraryChanged,
                        onAcquireProgress: onAcquireProgress
                    )
                }
                wasOnServer[url] = true
                states[url] = .onServer
                activeServerJobIds.removeValue(forKey: url)
                return
            } catch is CancellationError {
                activeServerJobIds.removeValue(forKey: url)
                return
            } catch {
                guard let delay = DownloadRetryPolicy.delayNanoseconds(afterAttempt: attempt) else {
                    EOSPerfLog.download.error("ensureOnServer exhausted title=\(title, privacy: .public)")
                    states[url] = .failed(error.localizedDescription)
                    Self.setServerAcquireActive(url, false)
                    activeServerJobIds.removeValue(forKey: url)
                    return
                }
                EOSPerfLog.download.warning("ensureOnServer retry=\(attempt) title=\(title, privacy: .public)")
                if let stuckJob = activeServerJobIds.removeValue(forKey: url) {
                    try? await api.cancelJob(jobId: stuckJob)
                }
                states[url] = .acquiringServer(progress: 2)
                try? await Task.sleep(nanoseconds: delay)
                attempt += 1
            }
        }
    }

    private func acquireOnServer(
        url: String,
        folderId: String?,
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)? = nil,
        onAcquireProgress: ((Double) -> Void)? = nil
    ) async throws {
        Self.activeDownloadCount += 1
        Self.setServerAcquireActive(url, true)
        defer {
            Self.activeDownloadCount = max(0, Self.activeDownloadCount - 1)
            Self.setServerAcquireActive(url, false)
        }
        states[url] = .acquiringServer(progress: 3)

        if OpenedAudioRegistry.isOpenedLibraryURL(url) {
            try await acquireOpenedFileOnServer(
                url: url,
                folderId: folderId,
                api: api,
                onLibraryChanged: onLibraryChanged,
                onAcquireProgress: onAcquireProgress
            )
            return
        }

        if ExternalTrackReference.isLibraryURL(url) {
            try await acquireExternalFileOnServer(
                url: url,
                folderId: folderId,
                api: api,
                onLibraryChanged: onLibraryChanged,
                onAcquireProgress: onAcquireProgress
            )
            return
        }

        // Reuse an in-flight NAS job (this device or another) — never spawn a second acquire.
        let jobId: String
        if let active = await api.findActiveMusicJob(url: url),
           !active.isTerminal,
           !active.isFailed,
           active.looksLikeFileIngest {
            jobId = active.jobId
            activeServerJobIds[url] = jobId
            EOSPerfLog.download.info("reuse active server acquire job=\(jobId, privacy: .public)")
            try await pollServerAcquire(
                jobId: jobId,
                trackUrl: url,
                api: api,
                onProgress: onAcquireProgress
            )
        } else {
            if let stale = await api.findActiveMusicJob(url: url), !stale.isTerminal, !stale.looksLikeFileIngest {
                EOSPerfLog.download.warning("cancel stale play-proxy job=\(stale.jobId, privacy: .public)")
                try? await api.cancelJob(jobId: stale.jobId)
            }
            let ensure = try await api.startMusicDownload(
                url: url,
                folderId: folderId,
                trackUrl: url
            )
            jobId = ensure.jobId
            activeServerJobIds[url] = jobId
            if ensure.isDurableServerCopy {
                states[url] = .acquiringServer(progress: 96)
                onAcquireProgress?(96)
            } else {
                try await pollServerAcquire(
                    jobId: jobId,
                    trackUrl: url,
                    api: api,
                    onProgress: onAcquireProgress
                )
            }
        }

        await persistTrackDownloadLink(
            folderId: folderId,
            url: url,
            downloadJobId: jobId,
            api: api,
            onLibraryChanged: onLibraryChanged
        )
        wasOnServer[url] = true
        activeServerJobIds.removeValue(forKey: url)
        if Task.isCancelled { throw CancellationError() }
    }

    private func acquireOpenedFileOnServer(
        url: String,
        folderId: String?,
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)? = nil,
        onAcquireProgress: ((Double) -> Void)? = nil
    ) async throws {
        guard let local = OpenedAudioRegistry.localURL(for: url) else {
            throw APIError.server("Brak lokalnego pliku do wysłania na serwer.")
        }
        let meta = OpenedAudioRegistry.entry(for: url)
        let fileData = try Data(contentsOf: local)
        onAcquireProgress?(12)
        states[url] = .acquiringServer(progress: 18)
        let ensure = try await api.uploadLocalMusicFile(
            url: url,
            folderId: folderId,
            title: meta?.title ?? local.deletingPathExtension().lastPathComponent,
            artist: meta?.artist,
            album: meta?.album,
            fileName: local.lastPathComponent,
            fileData: fileData
        )
        let jobId = ensure.jobId
        activeServerJobIds[url] = jobId
        if ensure.ready != true {
            try await pollServerAcquire(
                jobId: jobId,
                trackUrl: url,
                api: api,
                onProgress: onAcquireProgress
            )
        } else {
            states[url] = .acquiringServer(progress: 96)
            onAcquireProgress?(96)
        }
        await persistTrackDownloadLink(
            folderId: folderId,
            url: url,
            downloadJobId: jobId,
            api: api,
            onLibraryChanged: onLibraryChanged
        )
        wasOnServer[url] = true
        activeServerJobIds.removeValue(forKey: url)
        if Task.isCancelled { throw CancellationError() }
    }

    private func acquireExternalFileOnServer(
        url: String,
        folderId: String?,
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)? = nil,
        onAcquireProgress: ((Double) -> Void)? = nil
    ) async throws {
        guard let provider = externalFileUploadProvider else {
            throw APIError.server("Brak dostępu do pliku w folderze.")
        }
        onAcquireProgress?(10)
        states[url] = .acquiringServer(progress: 14)
        let file = try await provider(url)
        onAcquireProgress?(24)
        states[url] = .acquiringServer(progress: 32)
        let fileData = try Data(contentsOf: file.local)
        onAcquireProgress?(42)
        states[url] = .acquiringServer(progress: 48)
        let ensure = try await api.uploadLocalMusicFile(
            url: url,
            folderId: folderId,
            title: file.title,
            artist: file.artist,
            album: file.album,
            fileName: file.fileName,
            fileData: fileData
        )
        let jobId = ensure.jobId
        activeServerJobIds[url] = jobId
        if ensure.ready != true {
            try await pollServerAcquire(
                jobId: jobId,
                trackUrl: url,
                api: api,
                onProgress: onAcquireProgress
            )
        } else {
            states[url] = .acquiringServer(progress: 96)
            onAcquireProgress?(96)
        }
        await persistTrackDownloadLink(
            folderId: folderId,
            url: url,
            downloadJobId: jobId,
            api: api,
            onLibraryChanged: onLibraryChanged
        )
        wasOnServer[url] = true
        activeServerJobIds.removeValue(forKey: url)
        if Task.isCancelled { throw CancellationError() }
    }

    /// Jawne wywołanie uploadu otwartego pliku (np. z playera).
    func ensureOpenedFileOnServer(
        url: String,
        localFile: URL,
        folderId: String,
        title: String,
        artist: String?,
        album: String?,
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)? = nil,
        onReady: (() async -> Void)? = nil
    ) {
        if let hash = OpenedAudioRegistry.contentHash(from: url) {
            OpenedAudioRegistry.register(
                localFile: localFile,
                contentHash: hash,
                title: title,
                artist: artist,
                album: album
            )
        }
        ensureOnServer(
            url: url,
            folderId: folderId,
            api: api,
            onLibraryChanged: onLibraryChanged,
            onReady: onReady
        )
    }

    func download(
        track: MusicTrack,
        folderId: String,
        api: MusicAPIClient,
        onLibraryChanged: @escaping () async -> Void
    ) {
        let current = uiState(for: track.url, isOnServer: track.isOnServer)
        guard current == .idle || current == .onServer || current.isFailed else { return }

        let currentlyOnServer: Bool
        if case .onServer = current {
            currentlyOnServer = true
        } else {
            currentlyOnServer = false
        }
        wasOnServer[track.url] = track.isOnServer || wasOnServer[track.url] == true || currentlyOnServer

        activeTasks[track.url]?.cancel()
        activeTasks[track.url] = Task {
            Self.activeDownloadCount += 1
            defer {
                Self.activeDownloadCount = max(0, Self.activeDownloadCount - 1)
                activeTasks[track.url] = nil
                acquirePollLastPublish[track.url] = nil
            }

            do {
                try await coordinator.enqueueDownload(trackUrl: track.url) {
                    try await self.runDownloadPipeline(
                        track: track,
                        folderId: folderId,
                        api: api,
                        onLibraryChanged: onLibraryChanged
                    )
                }
            } catch is CancellationError {
                self.restoreAfterCancel(
                    url: track.url,
                    isOnServerHint: self.wasOnServer[track.url] == true || track.isOnServer
                )
            } catch {
                if Task.isCancelled { return }
                EOSPerfLog.download.error("download failed track=\(track.url, privacy: .public) error=\(error.localizedDescription, privacy: .public)")
                states[track.url] = .failed(error.localizedDescription)
            }
        }
    }

    /// Asset / share path: respects concurrency via coordinator + OfflineMusicStore progress.
    func downloadAssetToDevice(
        url: String,
        title: String,
        artist: String?,
        api: MusicAPIClient,
        folderId: String? = nil,
        downloadJobId: String? = nil,
        onLibraryChanged: (() async -> Void)? = nil
    ) async throws {
        if offline.isAvailable(url) { return }

        wasOnServer[url] = true
        Self.activeDownloadCount += 1
        defer { Self.activeDownloadCount = max(0, Self.activeDownloadCount - 1) }

        try await coordinator.enqueueDownload(trackUrl: url) {
            let jobId: String = try await self.coordinator.withPhaseSlot(trackUrl: url, kind: .serverAcquire) {
                if let known = downloadJobId, !known.isEmpty {
                    self.states[url] = .acquiringServer(progress: 96)
                    await self.persistTrackDownloadLink(
                        folderId: folderId,
                        url: url,
                        downloadJobId: known,
                        api: api,
                        onLibraryChanged: onLibraryChanged
                    )
                    self.wasOnServer[url] = true
                    return known
                }
                if let active = await api.findActiveMusicJob(url: url),
                   !active.jobId.isEmpty,
                   active.isTerminal || active.looksLikeFileIngest {
                    self.states[url] = .acquiringServer(progress: 96)
                    await self.persistTrackDownloadLink(
                        folderId: folderId,
                        url: url,
                        downloadJobId: active.jobId,
                        api: api,
                        onLibraryChanged: onLibraryChanged
                    )
                    self.wasOnServer[url] = true
                    return active.jobId
                }
                // Local-only URIs cannot be re-fetched by the server — require an existing job.
                if ExternalTrackReference.isLibraryURL(url) || OpenedAudioRegistry.isOpenedLibraryURL(url) {
                    throw APIError.server(
                        "Brak kopii na serwerze EOS. Najpierw dokończ „Zapis na serwer” na urządzeniu z folderem."
                    )
                }
                self.states[url] = .acquiringServer(progress: 3)
                let ensure = try await api.startMusicDownload(
                    url: url,
                    folderId: folderId,
                    trackUrl: url
                )
                if !ensure.isDurableServerCopy {
                    try await self.pollServerAcquire(jobId: ensure.jobId, trackUrl: url, api: api)
                } else {
                    self.states[url] = .acquiringServer(progress: 96)
                }
                await self.persistTrackDownloadLink(
                    folderId: folderId,
                    url: url,
                    downloadJobId: ensure.jobId,
                    api: api,
                    onLibraryChanged: onLibraryChanged
                )
                self.wasOnServer[url] = true
                return ensure.jobId
            }

            try await self.coordinator.withPhaseSlot(trackUrl: url, kind: .deviceTransfer) {
                self.states[url] = .downloading(progress: 55)
                let playToken = try await api.musicPlayToken(jobId: jobId)
                var request = api.streamURLRequest(jobId: jobId, token: playToken.token)
                request.timeoutInterval = 3600
                try await self.offline.save(
                    request: request,
                    trackUrl: url,
                    title: title,
                    artist: artist,
                    downloadJobId: jobId
                ) { [weak self] fraction in
                    Task { @MainActor in
                        let progress = 55 + fraction * 45
                        if case .downloading(let old)? = self?.states[url],
                           abs(old - progress) < 8,
                           fraction < 0.99 {
                            return
                        }
                        self?.states[url] = .downloading(progress: progress)
                    }
                }
            }
        }
        states[url] = .done
    }

    private func runDownloadPipeline(
        track: MusicTrack,
        folderId: String,
        api: MusicAPIClient,
        onLibraryChanged: @escaping () async -> Void
    ) async throws {
        if offline.isAvailable(track.url) {
            states[track.url] = .done
            return
        }

        // Already on EOS server — skip second APLMate acquire; transfer only.
        if let jobId = track.durableJobId, !jobId.isEmpty {
            try await transferServerJobToDevice(
                jobId: jobId,
                track: track,
                folderId: folderId,
                api: api,
                onLibraryChanged: onLibraryChanged
            )
            return
        }
        if let active = await api.findActiveMusicJob(url: track.url),
           !active.jobId.isEmpty,
           active.looksLikeFileIngest || (active.isTerminal && active.ready == true) {
            try await transferServerJobToDevice(
                jobId: active.jobId,
                track: track,
                folderId: folderId,
                api: api,
                onLibraryChanged: onLibraryChanged
            )
            return
        }

        if ExternalTrackReference.isLibraryURL(track.url) || OpenedAudioRegistry.isOpenedLibraryURL(track.url) {
            throw APIError.server(
                "Brak kopii na serwerze EOS. Najpierw dokończ „Zapis na serwer” na urządzeniu z folderem."
            )
        }

        states[track.url] = .acquiringServer(progress: 3)

        let jobId: String = try await coordinator.withPhaseSlot(trackUrl: track.url, kind: .serverAcquire) {
            let ensure = try await api.startMusicDownload(
                url: track.url,
                folderId: folderId,
                trackUrl: track.url
            )
            let jobId = ensure.jobId
            if ensure.ready != true {
                try await self.pollServerAcquire(jobId: jobId, trackUrl: track.url, api: api)
            } else {
                self.states[track.url] = .acquiringServer(progress: 96)
            }

            await self.persistTrackDownloadLink(
                folderId: folderId,
                url: track.url,
                downloadJobId: jobId,
                api: api,
                onLibraryChanged: onLibraryChanged
            )
            self.wasOnServer[track.url] = true
            return jobId
        }

        try await transferServerJobToDevice(
            jobId: jobId,
            track: track,
            folderId: folderId,
            api: api,
            onLibraryChanged: onLibraryChanged
        )
    }

    private func transferServerJobToDevice(
        jobId: String,
        track: MusicTrack,
        folderId: String,
        api: MusicAPIClient,
        onLibraryChanged: @escaping () async -> Void,
        onProgress: ((Double) -> Void)? = nil
    ) async throws {
        try await coordinator.withPhaseSlot(trackUrl: track.url, kind: .deviceTransfer) {
            self.states[track.url] = .downloading(progress: 8)
            let playToken = try await api.musicPlayToken(jobId: jobId)
            var request = api.streamURLRequest(jobId: jobId, token: playToken.token)
            request.timeoutInterval = 3600
            try await self.offline.save(
                request: request,
                trackUrl: track.url,
                title: track.title,
                artist: track.artist,
                downloadJobId: jobId
            ) { [weak self] fraction in
                Task { @MainActor in
                    let progress = 8 + fraction * 92
                    if case .downloading(let old)? = self?.states[track.url],
                       abs(old - progress) < 6,
                       fraction < 0.99 {
                        return
                    }
                    self?.states[track.url] = .downloading(progress: progress)
                    onProgress?(progress)
                }
            }
            self.states[track.url] = .done
            self.wasOnServer[track.url] = true
            await self.persistTrackDownloadLink(
                folderId: folderId,
                url: track.url,
                downloadJobId: jobId,
                api: api,
                onLibraryChanged: onLibraryChanged
            )
            EOSPerfLog.download.info("device transfer done track=\(track.url, privacy: .public)")
        }
    }

    /// Maps library track → durable jobId so other devices can stream without the local folder bookmark.
    private func persistTrackDownloadLink(
        folderId: String?,
        url: String,
        downloadJobId: String,
        api: MusicAPIClient,
        onLibraryChanged: (() async -> Void)?
    ) async {
        guard let folderId, !folderId.isEmpty, !downloadJobId.isEmpty else {
            scheduleLibraryRefresh(onLibraryChanged)
            return
        }
        for attempt in 1...3 {
            do {
                _ = try await api.linkTrackDownload(
                    folderId: folderId,
                    url: url,
                    downloadJobId: downloadJobId
                )
                wasOnServer[url] = true
                scheduleLibraryRefresh(onLibraryChanged)
                return
            } catch {
                EOSPerfLog.download.error(
                    "linkTrackDownload failed attempt=\(attempt) url=\(url, privacy: .public) error=\(error.localizedDescription, privacy: .public)"
                )
                if attempt < 3 {
                    try? await Task.sleep(nanoseconds: UInt64(attempt) * 400_000_000)
                }
            }
        }
        // Still refresh — server asset may exist even if PATCH failed.
        scheduleLibraryRefresh(onLibraryChanged)
    }

    func downloadAllPending(
        tracks: [MusicTrack],
        folderId: String,
        destination: MusicDownloadDestination = .serverAndPhone,
        api: MusicAPIClient,
        label: String = "Pobieranie playlisty",
        isOnServer: ((String) -> Bool)? = nil,
        onLibraryChanged: @escaping () async -> Void
    ) {
        queueBulkDownload(
            label: label,
            tracks: tracks,
            folderId: folderId,
            destination: destination,
            api: api,
            isAlreadyOnServer: { [weak self] url in
                guard let self else { return false }
                if isOnServer?(url) == true { return true }
                if self.offline.isAvailable(url) { return true }
                if case .done = self.states[url] { return true }
                return false
            },
            onLibraryChanged: onLibraryChanged
        )
    }

    func removeOffline(_ url: String) {
        offline.remove(url)
        // Po usunięciu z iPhone’a zostaje kopia serwerowa (jeśli była).
        wasOnServer[url] = true
        states[url] = .onServer
    }

    func cancelDownload(for url: String, isOnServer: Bool? = nil, api: MusicAPIClient? = nil) {
        let serverHint = isOnServer ?? wasOnServer[url] ?? (states[url] == .onServer)
        if case .onServer = states[url] { wasOnServer[url] = true }
        if case .acquiringServer = states[url] { /* may still land on server */ }
        if case .downloading = states[url] { wasOnServer[url] = true }

        if let jobId = activeServerJobIds.removeValue(forKey: url), let api {
            Task { try? await api.cancelJob(jobId: jobId) }
        }

        Task { await coordinator.cancel(trackUrl: url) }
        activeTasks[url]?.cancel()
        activeTasks[url] = nil
        offline.cancelInFlight(trackUrl: url)
        restoreAfterCancel(url: url, isOnServerHint: serverHint == true || wasOnServer[url] == true)
        EOSPerfLog.download.info("cancelDownload url=\(url, privacy: .public) restoreOnServer=\(self.wasOnServer[url] == true)")
    }

    func isDownloading(_ url: String) -> Bool {
        states[url]?.isBusy == true
    }

    private func restoreAfterCancel(url: String, isOnServerHint: Bool) {
        Self.setServerAcquireActive(url, false)
        activeServerJobIds.removeValue(forKey: url)
        if offline.isAvailable(url) {
            states[url] = .done
        } else if isOnServerHint || wasOnServer[url] == true {
            wasOnServer[url] = true
            states[url] = .onServer
        } else {
            states[url] = .idle
        }
    }

    private func scheduleLibraryRefresh(_ onLibraryChanged: (() async -> Void)?) {
        guard let onLibraryChanged else { return }
        Task {
            await coordinator.notifyLibraryChanged {
                await onLibraryChanged()
            }
        }
    }

    private func downloadAndWait(
        track: MusicTrack,
        folderId: String,
        api: MusicAPIClient,
        onLibraryChanged: @escaping () async -> Void,
        onDeviceProgress: ((Double) -> Void)? = nil
    ) async {
        if offline.isAvailable(track.url) { return }
        let current = uiState(for: track.url, isOnServer: track.isOnServer)
        if current == .onServer || track.isOnServer, let jobId = track.durableJobId {
            do {
                try await transferServerJobToDevice(
                    jobId: jobId,
                    track: track,
                    folderId: folderId,
                    api: api,
                    onLibraryChanged: onLibraryChanged,
                    onProgress: onDeviceProgress
                )
            } catch {
                states[track.url] = .failed(error.localizedDescription)
            }
            return
        }
        await withCheckedContinuation { continuation in
            download(track: track, folderId: folderId, api: api, onLibraryChanged: onLibraryChanged)
            Task {
                while states[track.url]?.isBusy == true {
                    if Task.isCancelled { break }
                    if case .downloading(let p)? = states[track.url] {
                        onDeviceProgress?(p)
                    }
                    try? await Task.sleep(nanoseconds: 350_000_000)
                }
                continuation.resume()
            }
        }
    }

    /// Serwer przygotowuje MP3 — pełny progress 0…100 na chmurce.
    private func pollServerAcquire(
        jobId: String,
        trackUrl: String,
        api: MusicAPIClient,
        onProgress: ((Double) -> Void)? = nil
    ) async throws {
        let deadline = Date().addingTimeInterval(600)
        var lastMapped: Double?
        var lastProgressChange = Date()
        while Date() < deadline {
            if Task.isCancelled { throw CancellationError() }
            if await coordinator.isCancelled(trackUrl) { throw CancellationError() }
            let job = try await api.fetchJobStatus(jobId: jobId)
            let serverPct = max(0, min(100, job.progress ?? 0))
            let mapped = serverPct > 0 ? max(4, serverPct) : 4
            onProgress?(mapped)
            if let previous = lastMapped {
                if BulkServerQueuePolicy.isMeaningfulProgress(from: previous, to: mapped) {
                    lastMapped = mapped
                    lastProgressChange = Date()
                } else if BulkServerQueuePolicy.isAcquireStalled(
                    progress: mapped,
                    unchangedFor: Date().timeIntervalSince(lastProgressChange)
                ) {
                    EOSPerfLog.download.warning(
                        "server acquire stalled job=\(jobId, privacy: .public) at \(mapped, format: .fixed(precision: 0))%"
                    )
                    activeServerJobIds.removeValue(forKey: trackUrl)
                    try? await api.cancelJob(jobId: jobId)
                    throw APIError.server("Zapis utknął — ponawiam pobieranie…")
                }
            } else {
                lastMapped = mapped
                lastProgressChange = Date()
            }
            let now = Date().timeIntervalSinceReferenceDate
            let previous = acquirePollLastPublish[trackUrl]
            let shouldPublish =
                previous == nil
                || abs((previous?.progress ?? 0) - mapped) >= 8
                || now - (previous?.at ?? 0) >= 1.0
                || job.ready == true
                || job.status == "done"
            if shouldPublish {
                states[trackUrl] = .acquiringServer(progress: min(99, mapped))
                acquirePollLastPublish[trackUrl] = (mapped, now)
            }
            if job.status == "error" {
                throw APIError.server(job.error ?? "Zapis na serwerze nie powiódł się.")
            }
            let finished = job.status.lowercased() == "done" || job.status.lowercased() == "cancelled"
            if finished, !job.isDurableServerCopy {
                throw APIError.server("Zapis na serwerze nie zapisał pliku — ponawiam pobieranie…")
            }
            if MusicPlayWaitPolicy.isSatisfied(job, requireDurable: true) { return }
            try await Task.sleep(nanoseconds: 700_000_000)
        }
        throw APIError.server("Przekroczono czas zapisu na serwerze.")
    }

    /// Sync from GET /api/downloads/active — shows server acquire progress started on any device.
    /// Also merges into a locally owned bulk queue so Live Activity can move while the phone is locked.
    func applyRemoteServerDownloads(_ remote: [ActiveServerDownload], batch: DownloadBatchSnapshot? = nil) {
        let music = remote.filter { $0.isMusic && !$0.url.isEmpty }
        let remoteURLs = Set(music.map(\.url))
        var touched = false
        if let eta = batch?.etaSeconds, eta > 0 {
            lastServerETA = eta
        }
        if let done = batch?.completed {
            lastBatchCompleted = max(lastBatchCompleted, done)
        }
        if let total = batch?.total, total > 0 {
            stickyBatchTotal = max(stickyBatchTotal, total)
        }
        if let id = batch?.id, !id.isEmpty {
            stickyBatchId = stickyBatchId ?? id
        }
        if let revision = batch?.revision {
            stickyBatchRevision = max(stickyBatchRevision, revision)
        }

        for item in music {
            if suppressRemoteBulkQueuePanel, !item.isTerminal { continue }
            if offline.isAvailable(item.url) {
                if states[item.url] != .done {
                    states[item.url] = .done
                    wasOnServer[item.url] = true
                    touched = true
                }
                continue
            }
            // Don't interrupt a local phone pull.
            if case .downloading = states[item.url] { continue }

            if item.isFailed {
                let message = item.error ?? "Pobieranie anulowane."
                if states[item.url] != .failed(message) {
                    states[item.url] = .failed(message)
                    touched = true
                }
                continue
            }

            if item.isTerminal {
                if !item.isFailed {
                    wasOnServer[item.url] = true
                    if states[item.url] != .onServer && states[item.url] != .done {
                        states[item.url] = .onServer
                        touched = true
                    }
                }
                continue
            }

            let pct = item.progressPercent
            let next = TrackDownloadUIState.acquiringServer(progress: max(3, pct))
            if states[item.url] != next {
                states[item.url] = next
                touched = true
            }
        }

        // Clear stale remote-only acquiring states when the account queue no longer lists them.
        for (url, state) in states {
            guard case .acquiringServer = state else { continue }
            if activeTasks[url] != nil { continue }
            if bulkServerTask != nil { continue }
            if plusDrainTask != nil, plusQueuedURLs.contains(url) || plusActive?.url == url { continue }
            if activeServerJobIds[url] != nil { continue }
            if remoteURLs.contains(url) { continue }
            states[url] = wasOnServer[url] == true ? .onServer : .idle
            touched = true
        }

        if !stickyBatchURLs.isEmpty, let batch, let completed = batch.completed {
            let total = max(batch.total ?? stickyBatchTotal, stickyBatchTotal)
            if completed >= total, total > 0, stickyBatchId != nil {
                for url in stickyBatchURLs {
                    if case .failed = states[url] { continue }
                    if case .downloading = states[url] { continue }
                    wasOnServer[url] = true
                    if states[url] != .done {
                        states[url] = .onServer
                        touched = true
                    }
                }
                lastBatchCompleted = max(lastBatchCompleted, completed)
            }
        }

        if !suppressRemoteBulkQueuePanel {
            if !stickyBatchItems.isEmpty {
                let before = bulkServerQueue
                publishStickyServerSnapshot()
                if bulkServerQueue != before {
                    touched = true
                }
                kickSequentialBulkIfNeeded()
            } else if bulkServerTask == nil, plusDrainTask == nil {
                let activeRemote = music.filter { !$0.isTerminal }
                if let current = activeRemote.first {
                    let remoteCompleted = music.filter { $0.isTerminal && !$0.isFailed }.count
                    let pending = activeRemote.dropFirst().map {
                        ServerQueueItem(url: $0.url, folderId: $0.folderId ?? "", title: $0.title)
                    }
                    let next = attachETA(BulkServerQueueProgress(
                        label: stickyBatchLabel.isEmpty ? "Kolejka konta (serwery)" : stickyBatchLabel,
                        completed: remoteCompleted,
                        total: max(activeRemote.count + remoteCompleted, 1),
                        active: ServerQueueItem(
                            url: current.url,
                            folderId: current.folderId ?? "",
                            title: current.title
                        ),
                        pending: Array(pending),
                        activeProgress: current.progressPercent
                    ))
                    if bulkServerQueue != next {
                        bulkServerQueue = next
                        touched = true
                    }
                }
            }
        }

        if touched { objectWillChange.send() }
    }

    func restorePersistedServerBatchIfNeeded(api: MusicAPIClient) {
        plusAPI = api
        guard stickyBatchItems.isEmpty, let session = loadPersistedBatch() else { return }
        stickyBatchId = session.batchId
        stickyBatchLabel = session.label
        bulkFolderId = session.folderId
        bulkDestination = session.destination == "serverAndPhone" ? .serverAndPhone : .server
        stickyBatchItems = session.items.map { ServerQueueItem(url: $0.url, folderId: $0.folderId, title: $0.title) }
        stickyDeviceItems = session.deviceItems.map { ServerQueueItem(url: $0.url, folderId: $0.folderId, title: $0.title) }
        stickyBatchURLs = Set(stickyBatchItems.map(\.url))
        stickyBatchTotal = max(stickyBatchItems.count, 1)
        suppressRemoteBulkQueuePanel = false
        publishStickyServerSnapshot()
        kickSequentialBulkIfNeeded()
    }

    private func persistBatchSession() {
        let session = PersistedBulkSession(
            batchId: stickyBatchId,
            label: stickyBatchLabel,
            folderId: bulkFolderId,
            destination: bulkDestination == .serverAndPhone ? "serverAndPhone" : "server",
            items: stickyBatchItems.map { .init(url: $0.url, folderId: $0.folderId, title: $0.title) },
            deviceItems: stickyDeviceItems.map { .init(url: $0.url, folderId: $0.folderId, title: $0.title) }
        )
        guard let data = try? JSONEncoder().encode(session) else { return }
        try? data.write(to: Self.batchSessionURL, options: .atomic)
    }

    private func clearPersistedBatch() {
        try? FileManager.default.removeItem(at: Self.batchSessionURL)
    }

    private func loadPersistedBatch() -> PersistedBulkSession? {
        guard let data = try? Data(contentsOf: Self.batchSessionURL) else { return nil }
        return try? JSONDecoder().decode(PersistedBulkSession.self, from: data)
    }

    private static var batchSessionURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return dir.appendingPathComponent("eos-bulk-queue-session.json")
    }
}

private struct PersistedBulkSession: Codable {
    struct Item: Codable {
        var url: String
        var folderId: String
        var title: String
    }

    var batchId: String?
    var label: String
    var folderId: String
    var destination: String
    var items: [Item]
    var deviceItems: [Item]
}

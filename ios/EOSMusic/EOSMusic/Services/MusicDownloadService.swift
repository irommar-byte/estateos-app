import Foundation
import UIKit

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
    @Published private(set) var states: [String: TrackDownloadUIState] = [:]
    /// Postęp masowego zapisu albumu / playlisty na serwerze EOS.
    @Published private(set) var bulkServerQueue: BulkServerQueueProgress?

    private var activeTasks: [String: Task<Void, Never>] = [:]
    private var bulkServerTask: Task<Void, Never>?
    private var bulkBackgroundTaskId: UIBackgroundTaskIdentifier = .invalid
    private let offline = OfflineMusicStore.shared
    private let coordinator = DownloadCoordinator.shared
    private let maxConcurrentDownloads = 2
    private var acquirePollLastPublish: [String: (progress: Double, at: TimeInterval)] = [:]
    /// Tracks whether cancel should restore `.onServer` (server copy existed / was acquired).
    private var wasOnServer: [String: Bool] = [:]

    /// Used by playback prefetch to avoid fighting user downloads for bandwidth.
    static var hasActiveDownloads: Bool { activeDownloadCount > 0 }
    private static var activeDownloadCount = 0

    struct BulkServerQueueProgress: Equatable {
        let label: String
        let completed: Int
        let total: Int
        let active: ServerQueueItem?
        let pending: [ServerQueueItem]
        let activeProgress: Double?
        var currentTitle: String? { active?.title }
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

    /// Kolejka albumu: po kolei zapisuje każdy utwór na serwerze, ponawia do skutku (max 5).
    func queueAllOnServerSequentially(
        label: String,
        items: [ServerQueueItem],
        api: MusicAPIClient,
        isAlreadyOnServer: @escaping (String) -> Bool,
        onLibraryChanged: (() async -> Void)? = nil,
        onAllComplete: (() async -> Void)? = nil
    ) {
        guard !items.isEmpty else { return }
        bulkServerTask?.cancel()
        bulkServerTask = Task {
            beginBulkBackgroundTask()
            defer { endBulkBackgroundTask() }
            var completed = 0
            let all = items
            func makeProgress(activeIndex: Int, progress: Double? = nil) -> BulkServerQueueProgress {
                let active = all.indices.contains(activeIndex) ? all[activeIndex] : nil
                let pendingStart = activeIndex + 1
                let pending = pendingStart < all.count ? Array(all[pendingStart...]) : []
                return BulkServerQueueProgress(
                    label: label,
                    completed: completed,
                    total: all.count,
                    active: active,
                    pending: pending,
                    activeProgress: progress
                )
            }
            bulkServerQueue = makeProgress(activeIndex: 0)
            for (index, item) in all.enumerated() {
                if Task.isCancelled { break }
                if offline.isAvailable(item.url) || isAlreadyOnServer(item.url) {
                    states[item.url] = .onServer
                    wasOnServer[item.url] = true
                    completed += 1
                    bulkServerQueue = makeProgress(activeIndex: min(index + 1, all.count - 1))
                    continue
                }
                bulkServerQueue = makeProgress(activeIndex: index)
                await ensureOnServerWithRetry(
                    url: item.url,
                    folderId: item.folderId,
                    title: item.title,
                    api: api,
                    onLibraryChanged: onLibraryChanged,
                    onAcquireProgress: { [weak self] progress in
                        Task { @MainActor in
                            self?.bulkServerQueue = makeProgress(activeIndex: index, progress: progress)
                        }
                    }
                )
                if Task.isCancelled { break }
                completed += 1
                bulkServerQueue = makeProgress(activeIndex: min(index + 1, all.count - 1))
            }
            bulkServerQueue = nil
            if !Task.isCancelled {
                await onAllComplete?()
            }
            bulkServerTask = nil
        }
    }

    func cancelBulkServerQueue() {
        bulkServerTask?.cancel()
        bulkServerTask = nil
        bulkServerQueue = nil
        endBulkBackgroundTask()
    }

    private func beginBulkBackgroundTask() {
        guard bulkBackgroundTaskId == .invalid else { return }
        bulkBackgroundTaskId = UIApplication.shared.beginBackgroundTask(withName: "EOSMusic.BulkServerQueue") { [weak self] in
            Task { @MainActor in self?.endBulkBackgroundTask() }
        }
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
                return
            } catch is CancellationError {
                return
            } catch {
                guard let delay = DownloadRetryPolicy.delayNanoseconds(afterAttempt: attempt) else {
                    EOSPerfLog.download.error("ensureOnServer exhausted title=\(title, privacy: .public)")
                    states[url] = .failed(error.localizedDescription)
                    return
                }
                EOSPerfLog.download.warning("ensureOnServer retry=\(attempt) title=\(title, privacy: .public)")
                states[url] = .failed(error.localizedDescription)
                try? await Task.sleep(nanoseconds: delay)
                attempt += 1
                states[url] = .acquiringServer(progress: 2)
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

        let ensure = try await api.startMusicPlay(
            url: url,
            folderId: folderId,
            trackUrl: url,
            intent: "download"
        )
        let jobId = ensure.jobId
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

        if let folderId {
            _ = try? await api.linkTrackDownload(
                folderId: folderId,
                url: url,
                downloadJobId: jobId
            )
        }
        wasOnServer[url] = true
        scheduleLibraryRefresh(onLibraryChanged)
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
        if let folderId {
            _ = try? await api.linkTrackDownload(
                folderId: folderId,
                url: url,
                downloadJobId: jobId
            )
        }
        wasOnServer[url] = true
        scheduleLibraryRefresh(onLibraryChanged)
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

        let busyCount = activeTasks.values.count
        guard busyCount < maxConcurrentDownloads else {
            Task {
                while activeTasks.values.count >= maxConcurrentDownloads {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    if Task.isCancelled { return }
                }
                download(track: track, folderId: folderId, api: api, onLibraryChanged: onLibraryChanged)
            }
            return
        }

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
        onLibraryChanged: (() async -> Void)? = nil
    ) async throws {
        if offline.isAvailable(url) { return }

        wasOnServer[url] = true
        Self.activeDownloadCount += 1
        defer { Self.activeDownloadCount = max(0, Self.activeDownloadCount - 1) }

        try await coordinator.enqueueDownload(trackUrl: url) {
            let jobId: String = try await self.coordinator.withPhaseSlot(trackUrl: url, kind: .serverAcquire) {
                self.states[url] = .acquiringServer(progress: 3)
                let ensure = try await api.startMusicPlay(
                    url: url,
                    folderId: folderId,
                    trackUrl: url,
                    intent: "download"
                )
                if ensure.ready != true {
                    try await self.pollServerAcquire(jobId: ensure.jobId, trackUrl: url, api: api)
                } else {
                    self.states[url] = .acquiringServer(progress: 96)
                }
                if let folderId {
                    _ = try? await api.linkTrackDownload(
                        folderId: folderId,
                        url: url,
                        downloadJobId: ensure.jobId
                    )
                }
                self.wasOnServer[url] = true
                self.scheduleLibraryRefresh(onLibraryChanged)
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
        if track.isOnServer || wasOnServer[track.url] == true,
           let jobId = track.durableJobId {
            try await transferServerJobToDevice(
                jobId: jobId,
                track: track,
                folderId: folderId,
                api: api,
                onLibraryChanged: onLibraryChanged
            )
            return
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

            _ = try? await api.linkTrackDownload(
                folderId: folderId,
                url: track.url,
                downloadJobId: jobId
            )
            self.wasOnServer[track.url] = true
            self.scheduleLibraryRefresh(onLibraryChanged)
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
        onLibraryChanged: @escaping () async -> Void
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
                }
            }
            self.states[track.url] = .done
            self.wasOnServer[track.url] = true
            _ = try? await api.linkTrackDownload(
                folderId: folderId,
                url: track.url,
                downloadJobId: jobId
            )
            self.scheduleLibraryRefresh(onLibraryChanged)
            EOSPerfLog.download.info("device transfer done track=\(track.url, privacy: .public)")
        }
    }

    func downloadAllPending(
        tracks: [MusicTrack],
        folderId: String,
        api: MusicAPIClient,
        onLibraryChanged: @escaping () async -> Void
    ) {
        Task {
            for track in tracks {
                let state = uiState(for: track.url, isOnServer: track.isOnServer)
                guard state == .idle || state == .onServer || state.isFailed else { continue }
                await downloadAndWait(track: track, folderId: folderId, api: api, onLibraryChanged: onLibraryChanged)
            }
        }
    }

    func removeOffline(_ url: String) {
        offline.remove(url)
        // Po usunięciu z iPhone’a zostaje kopia serwerowa (jeśli była).
        wasOnServer[url] = true
        states[url] = .onServer
    }

    func cancelDownload(for url: String, isOnServer: Bool? = nil) {
        let serverHint = isOnServer ?? wasOnServer[url] ?? (states[url] == .onServer)
        if case .onServer = states[url] { wasOnServer[url] = true }
        if case .acquiringServer = states[url] { /* may still land on server */ }
        if case .downloading = states[url] { wasOnServer[url] = true }

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
        onLibraryChanged: @escaping () async -> Void
    ) async {
        await withCheckedContinuation { continuation in
            download(track: track, folderId: folderId, api: api, onLibraryChanged: onLibraryChanged)
            Task {
                while states[track.url]?.isBusy == true {
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
        while Date() < deadline {
            if Task.isCancelled { throw CancellationError() }
            if await coordinator.isCancelled(trackUrl) { throw CancellationError() }
            let job = try await api.fetchJobStatus(jobId: jobId)
            let serverPct = max(0, min(100, job.progress ?? 0))
            let mapped = serverPct > 0 ? max(4, serverPct) : 4
            onProgress?(mapped)
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
            if job.ready == true || job.status == "done" { return }
            try await Task.sleep(nanoseconds: 700_000_000)
        }
        throw APIError.server("Przekroczono czas zapisu na serwerze.")
    }

    /// Sync from GET /api/downloads/active — shows server acquire progress started on any device.
    func applyRemoteServerDownloads(_ remote: [ActiveServerDownload]) {
        let remoteURLs = Set(remote.map(\.url).filter { !$0.isEmpty })
        var touched = false

        for item in remote where item.isMusic && !item.url.isEmpty {
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
            // Local acquire task owns the row while it's actively polling.
            if activeTasks[item.url] != nil { continue }

            if item.isFailed {
                let message = item.error ?? "Pobieranie anulowane."
                if states[item.url] != .failed(message) {
                    states[item.url] = .failed(message)
                    touched = true
                }
                continue
            }

            if item.isTerminal {
                wasOnServer[item.url] = true
                if states[item.url] != .onServer && states[item.url] != .done {
                    states[item.url] = .onServer
                    touched = true
                }
                continue
            }

            let pct = item.progressPercent
            let next = TrackDownloadUIState.acquiringServer(progress: max(3, pct))
            if states[item.url] != next {
                states[item.url] = next
                wasOnServer[item.url] = true
                touched = true
            }
        }

        // Clear stale remote-only acquiring states when the account queue no longer lists them.
        for (url, state) in states {
            guard case .acquiringServer = state else { continue }
            if activeTasks[url] != nil { continue }
            if bulkServerTask != nil { continue }
            if remoteURLs.contains(url) { continue }
            states[url] = wasOnServer[url] == true ? .onServer : .idle
            touched = true
        }

        // Rebuild bulk panel from remote music items when local bulk task isn't driving it.
        if bulkServerTask == nil {
            let activeRemote = remote.filter { $0.isMusic && !$0.isTerminal && !$0.url.isEmpty }
            if activeRemote.isEmpty {
                if bulkServerQueue != nil {
                    bulkServerQueue = nil
                    touched = true
                }
            } else {
                let completed = remote.filter { $0.isMusic && $0.isTerminal && !$0.isFailed }.count
                let total = max(remote.filter(\.isMusic).count, activeRemote.count)
                let current = activeRemote[0]
                let pending = activeRemote.dropFirst().map {
                    ServerQueueItem(url: $0.url, folderId: $0.folderId ?? "", title: $0.title)
                }
                let next = BulkServerQueueProgress(
                    label: "Kolejka konta (serwery)",
                    completed: completed,
                    total: total,
                    active: ServerQueueItem(
                        url: current.url,
                        folderId: current.folderId ?? "",
                        title: current.title
                    ),
                    pending: Array(pending),
                    activeProgress: current.progressPercent
                )
                if bulkServerQueue != next {
                    bulkServerQueue = next
                    touched = true
                }
            }
        }

        if touched { objectWillChange.send() }
    }
}

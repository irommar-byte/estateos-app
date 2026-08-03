import Foundation

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

    private var activeTasks: [String: Task<Void, Never>] = [:]
    private let offline = OfflineMusicStore.shared

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
        for track in tracks {
            if offline.isAvailable(track.url) {
                states[track.url] = .done
                continue
            }
            if let current = states[track.url], current.isBusy { continue }
            if track.isOnServer {
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
            states[url] = .acquiringServer(progress: 3)
            do {
                let ensure = try await api.startMusicPlay(
                    url: url,
                    folderId: folderId,
                    trackUrl: url
                )
                let jobId = ensure.jobId
                if ensure.ready != true {
                    try await pollServerAcquire(jobId: jobId, trackUrl: url, api: api)
                } else {
                    states[url] = .acquiringServer(progress: 96)
                }

                if let folderId {
                    _ = try? await api.linkTrackDownload(
                        folderId: folderId,
                        url: url,
                        downloadJobId: jobId
                    )
                }
                await onLibraryChanged?()
                if Task.isCancelled { return }
                states[url] = .onServer
                await onReady?()
            } catch {
                if Task.isCancelled { return }
                states[url] = .failed(error.localizedDescription)
            }
            activeTasks[url] = nil
        }
    }

    func download(
        track: MusicTrack,
        folderId: String,
        api: MusicAPIClient,
        onLibraryChanged: @escaping () async -> Void
    ) {
        let current = uiState(for: track.url, isOnServer: track.isOnServer)
        guard current == .idle || current == .onServer || current.isFailed else { return }
        activeTasks[track.url]?.cancel()
        activeTasks[track.url] = Task {
            states[track.url] = .acquiringServer(progress: 3)
            do {
                // Zawsze ensure na serwerze — Play i Pobierz dzielą trwały asset.
                let ensure = try await api.startMusicDownload(
                    url: track.url,
                    folderId: folderId,
                    trackUrl: track.url
                )
                let jobId = ensure.jobId
                if ensure.ready != true {
                    try await pollServerAcquire(jobId: jobId, trackUrl: track.url, api: api)
                } else {
                    states[track.url] = .acquiringServer(progress: 96)
                }

                _ = try? await api.linkTrackDownload(
                    folderId: folderId,
                    url: track.url,
                    downloadJobId: jobId
                )
                await onLibraryChanged()

                states[track.url] = .downloading(progress: 55)
                let playToken = try await api.musicPlayToken(jobId: jobId)
                let request = api.streamURLRequest(jobId: jobId, token: playToken.token)
                try await offline.save(
                    request: request,
                    trackUrl: track.url,
                    title: track.title,
                    artist: track.artist,
                    downloadJobId: jobId
                ) { [weak self] fraction in
                    Task { @MainActor in
                        self?.states[track.url] = .downloading(progress: 55 + fraction * 45)
                    }
                }
                states[track.url] = .done
            } catch {
                if Task.isCancelled { return }
                states[track.url] = .failed(error.localizedDescription)
            }
            activeTasks[track.url] = nil
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
        states[url] = .onServer
    }

    func cancelDownload(for url: String) {
        activeTasks[url]?.cancel()
        activeTasks[url] = nil
        if offline.isAvailable(url) {
            states[url] = .done
        } else {
            states[url] = .idle
        }
    }

    func isDownloading(_ url: String) -> Bool {
        states[url]?.isBusy == true
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
    private func pollServerAcquire(jobId: String, trackUrl: String, api: MusicAPIClient) async throws {
        let deadline = Date().addingTimeInterval(600)
        while Date() < deadline {
            if Task.isCancelled { throw APIError.server("Anulowano.") }
            let job = try await api.fetchJobStatus(jobId: jobId)
            let serverPct = max(0, min(100, job.progress ?? 0))
            let mapped = serverPct > 0 ? max(4, serverPct) : 4
            states[trackUrl] = .acquiringServer(progress: min(99, mapped))
            if job.status == "error" {
                throw APIError.server(job.error ?? "Zapis na serwerze nie powiódł się.")
            }
            if job.ready == true || job.status == "done" { return }
            try await Task.sleep(nanoseconds: 450_000_000)
        }
        throw APIError.server("Przekroczono czas zapisu na serwerze.")
    }
}

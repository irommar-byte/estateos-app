import Foundation

enum TrackDownloadUIState: Equatable {
    case idle
    /// Trwała kopia jest na serwerze EOS, ale nie na tym iPhonie.
    case onServer
    case downloading(progress: Double)
    /// Plik lokalny w Pobrane (offline).
    case done
    case failed(String)

    /// Postęp 0…100 dla UI.
    var progressPercent: Double {
        if case .downloading(let progress) = self { return progress }
        return 0
    }

    var isBusy: Bool {
        if case .downloading = self { return true }
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
            } else if track.isOnServer, states[track.url] == nil || states[track.url] == .idle {
                states[track.url] = .onServer
            }
        }
    }

    func isOfflineAvailable(_ url: String) -> Bool {
        offline.isAvailable(url)
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
            setProgress(track.url, 1)
            do {
                // Zawsze ensure na serwerze — Play i Pobierz dzielą trwały asset.
                let ensure = try await api.startMusicDownload(
                    url: track.url,
                    folderId: folderId,
                    trackUrl: track.url
                )
                let jobId = ensure.jobId
                if ensure.ready != true {
                    try await pollServerJob(jobId: jobId, trackUrl: track.url, api: api)
                } else {
                    setProgress(track.url, 55)
                }

                _ = try? await api.linkTrackDownload(
                    folderId: folderId,
                    url: track.url,
                    downloadJobId: jobId
                )
                await onLibraryChanged()

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
                        self?.setProgress(track.url, 55 + fraction * 45)
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
        states[url] = .idle
    }

    func isDownloading(_ url: String) -> Bool {
        states[url]?.isBusy == true
    }

    private func setProgress(_ trackUrl: String, _ percent: Double) {
        let clamped = min(99, max(1, percent))
        states[trackUrl] = .downloading(progress: clamped)
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

    /// Serwer przygotowuje MP3 — mapujemy 0…100 → 1…55%.
    private func pollServerJob(jobId: String, trackUrl: String, api: MusicAPIClient) async throws {
        let deadline = Date().addingTimeInterval(600)
        while Date() < deadline {
            if Task.isCancelled { throw APIError.server("Anulowano.") }
            let job = try await fetchJobStatus(jobId: jobId, api: api)
            let serverPct = job.progress ?? 0
            let mapped = serverPct > 0 ? serverPct * 0.55 : 2
            setProgress(trackUrl, mapped)
            if job.status == "error" {
                throw APIError.server(job.error ?? "Pobieranie nie powiodło się.")
            }
            if job.ready == true || job.status == "done" { return }
            try await Task.sleep(nanoseconds: 500_000_000)
        }
        throw APIError.server("Przekroczono czas pobierania.")
    }

    private func fetchJobStatus(jobId: String, api: MusicAPIClient) async throws -> JobStatusResponse {
        try await api.fetchJobStatus(jobId: jobId)
    }
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }
}

import Foundation

enum TrackDownloadUIState: Equatable {
    case idle
    case downloading(progress: Double)
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
}

@MainActor
final class MusicDownloadService: ObservableObject {
    @Published private(set) var states: [String: TrackDownloadUIState] = [:]

    private var activeTasks: [String: Task<Void, Never>] = [:]
    private let offline = OfflineMusicStore.shared

    func uiState(for url: String, isDownloaded: Bool) -> TrackDownloadUIState {
        if offline.isAvailable(url) { return .done }
        if isDownloaded, states[url] == nil { return .idle }
        return states[url] ?? .idle
    }

    func syncFromTracks(_ tracks: [MusicTrack]) {
        for track in tracks where offline.isAvailable(track.url) {
            states[track.url] = .done
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
        let current = uiState(for: track.url, isDownloaded: track.isDownloaded)
        guard current == .idle || current.isFailed else { return }
        activeTasks[track.url]?.cancel()
        activeTasks[track.url] = Task {
            setProgress(track.url, 1)
            do {
                var jobId = track.downloadJobId?.nonEmpty
                if jobId == nil {
                    jobId = try await api.startMusicDownload(
                        url: track.url,
                        folderId: folderId,
                        trackUrl: track.url
                    )
                    try await pollServerJob(jobId: jobId!, trackUrl: track.url, api: api)
                    _ = try await api.linkTrackDownload(
                        folderId: folderId,
                        url: track.url,
                        downloadJobId: jobId!
                    )
                    await onLibraryChanged()
                } else {
                    setProgress(track.url, 55)
                }

                let playToken = try await api.musicPlayToken(jobId: jobId!)
                let request = api.streamURLRequest(jobId: jobId!, token: playToken.token)
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
                let state = uiState(for: track.url, isDownloaded: track.isDownloaded)
                guard state == .idle || state.isFailed else { continue }
                await downloadAndWait(track: track, folderId: folderId, api: api, onLibraryChanged: onLibraryChanged)
            }
        }
    }

    func removeOffline(_ url: String) {
        offline.remove(url)
        states[url] = .idle
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
            let job = try await api.fetchJobStatus(jobId: jobId)
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
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }
}

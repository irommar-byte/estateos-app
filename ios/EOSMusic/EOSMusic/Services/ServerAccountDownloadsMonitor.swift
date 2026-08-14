import Foundation
import Combine
import UIKit

/// Shared per-account server download queue (music + movies).
/// Phone copies stay local — only server acquisition progress is synced across devices.
@MainActor
final class ServerAccountDownloadsMonitor: ObservableObject {
    @Published private(set) var items: [ActiveServerDownload] = []
    @Published private(set) var lastError: String?

    private weak var api: MusicAPIClient?
    private weak var musicDownloads: MusicDownloadService?
    private weak var movieDownloads: MovieDownloadService?
    private var pollTask: Task<Void, Never>?
    private var isForeground = true

    func attach(
        api: MusicAPIClient,
        musicDownloads: MusicDownloadService,
        movieDownloads: MovieDownloadService
    ) {
        self.api = api
        self.musicDownloads = musicDownloads
        self.movieDownloads = movieDownloads
    }

    var hasActiveServerWork: Bool {
        items.contains { !$0.isTerminal }
    }

    func start() {
        guard pollTask == nil else { return }
        isForeground = true
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                if self.isForeground, self.api?.isAuthenticated == true {
                    await self.refreshOnce()
                }
                if !self.isForeground {
                    try? await Task.sleep(nanoseconds: 30_000_000_000)
                    continue
                }
                let ns: UInt64 = self.hasActiveServerWork ? 1_200_000_000 : 3_500_000_000
                try? await Task.sleep(nanoseconds: ns)
            }
        }
    }

    func stop() {
        pollTask?.cancel()
        pollTask = nil
        items = []
        lastError = nil
    }

    func setForeground(_ active: Bool) {
        isForeground = active
        if active {
            Task {
                await refreshOnce()
                movieDownloads?.resumePersistedBatchIfNeeded()
            }
        }
    }

    func refreshOnce() async {
        guard let api, api.isAuthenticated else {
            items = []
            return
        }
        do {
            let response = try await api.fetchActiveServerDownloads()
            items = response.items
            lastError = nil
            musicDownloads?.applyRemoteServerDownloads(response.music)
            movieDownloads?.applyRemoteServerDownloads(response.movies)
        } catch {
            // Soft-fail: keep last snapshot; avoid spamming UI on blips.
            lastError = error.localizedDescription
        }
    }
}

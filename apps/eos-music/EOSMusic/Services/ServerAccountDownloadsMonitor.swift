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
                let downloadsBusy = self.musicDownloads?.hasActiveQueue == true
                    || self.movieDownloads?.hasActiveBatch == true
                let shouldPoll = self.api?.isAuthenticated == true
                    && (self.isForeground || self.hasActiveServerWork || downloadsBusy)
                if shouldPoll {
                    await self.refreshOnce()
                }
                let busy = self.hasActiveServerWork || downloadsBusy
                let ns: UInt64
                if self.isForeground {
                    ns = busy ? 1_200_000_000 : 3_500_000_000
                } else {
                    ns = busy ? 2_400_000_000 : 12_000_000_000
                }
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
            applyDecoded(try await api.fetchActiveServerDownloads())
        } catch {
            // Soft-fail: keep last snapshot; avoid spamming UI on blips.
            lastError = error.localizedDescription
        }
    }

    func applyDecoded(_ response: ActiveServerDownloadsResponse) {
        let mergedItems = response.items.isEmpty
            ? response.music + response.movies
            : response.items
        items = mergedItems
        lastError = nil
        let music = response.music.isEmpty ? mergedItems.filter(\.isMusic) : response.music
        let movies = response.movies.isEmpty ? mergedItems.filter(\.isMovie) : response.movies
        musicDownloads?.applyRemoteServerDownloads(music, batch: response.batch)
        movieDownloads?.applyRemoteServerDownloads(movies)
    }
}

import Foundation
import UIKit

@MainActor
final class OnlineMoviesController: ObservableObject {
    @Published private(set) var shelves: [FilmsHomeShelf] = []
    @Published private(set) var downloads: [MovieDownload] = []
    @Published private(set) var serverMovieCount: Int = 0
    @Published private(set) var serverMovieBytes: Int = 0
    @Published private(set) var isLoadingHome = false
    @Published private(set) var isLoadingDownloads = false
    @Published private(set) var homeError: String?
    @Published private(set) var transferStates: [String: OnlineMovieTransferState] = [:]
    @Published private(set) var isPreparingStream = false
    @Published private(set) var streamPrepareProgress: Double = 0
    @Published var statusMessage: String?

    private weak var api: MusicAPIClient?
    private var activeTasks: [String: Task<Void, Never>] = [:]
    private var streamTask: Task<Void, Never>?
    private let transfers = BackgroundTransferService.shared

    func attach(api: MusicAPIClient) {
        self.api = api
    }

    func reset() {
        shelves = []
        downloads = []
        serverMovieCount = 0
        serverMovieBytes = 0
        homeError = nil
        statusMessage = nil
        transferStates = [:]
        isPreparingStream = false
        streamPrepareProgress = 0
        streamTask?.cancel()
        streamTask = nil
        for task in activeTasks.values { task.cancel() }
        activeTasks.removeAll()
    }

    func transferState(for url: String) -> OnlineMovieTransferState {
        if let state = transferStates[url] { return state }
        if phoneFileURL(for: url) != nil { return .onPhone }
        if downloads.contains(where: { $0.url == url && $0.isDownloaded }) { return .onServer }
        return .idle
    }

    func jobId(for url: String) -> String? {
        downloads.first(where: { $0.url == url && $0.isDownloaded })?.downloadJobId
    }

    func refreshHome() async {
        guard let api else { return }
        isLoadingHome = true
        defer { isLoadingHome = false }
        do {
            let response = try await api.fetchCdaHdHome(limit: 22)
            if response.shelves.isEmpty {
                let fallback = try await api.fetchFilmsHome(limit: 16)
                shelves = fallback.shelves.filter { $0.source.lowercased().contains("cda-hd") }
            } else {
                shelves = response.shelves
            }
            homeError = shelves.isEmpty ? "Brak pozycji w \(EOSLibraryBrand.displayName). Spróbuj ponownie za chwilę." : nil
        } catch {
            if shelves.isEmpty {
                homeError = error.localizedDescription
            }
        }
    }

    func refreshDownloads() async {
        guard let api else { return }
        isLoadingDownloads = true
        defer { isLoadingDownloads = false }
        do {
            let response = try await api.fetchMovieDownloads()
            downloads = response.downloads.filter(\.isDownloaded)
            serverMovieCount = response.resolvedCount
            serverMovieBytes = response.resolvedTotalBytes
            if serverMovieCount == 0 {
                serverMovieCount = downloads.count
            }
            if serverMovieBytes == 0 {
                serverMovieBytes = downloads.reduce(0) { $0 + ($1.bytes ?? 0) }
            }
        } catch {
            // Keep previous list; surface only when empty.
            if downloads.isEmpty {
                statusMessage = error.localizedDescription
            }
        }
    }

    /// Liczba filmów zapisanych lokalnie na tym urządzeniu.
    var phoneMovieCount: Int {
        phoneFilePaths().count
    }

    /// Suma bajtów filmów na iPhonie (importy + skopiowane z serwera).
    var phoneMovieBytes: Int64 {
        phoneFilePaths().reduce(Int64(0)) { sum, path in
            let url = URL(fileURLWithPath: path)
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            return sum + Int64(size)
        }
    }

    private func phoneFilePaths() -> [String] {
        AppDocuments.ensureStructure()
        var paths = Set<String>()
        let map = UserDefaults.standard.dictionary(forKey: Self.phoneMapKey) as? [String: String] ?? [:]
        for path in map.values {
            if FileManager.default.fileExists(atPath: path) {
                paths.insert(path)
            }
        }
        if let enumerator = FileManager.default.enumerator(
            at: AppDocuments.videoImports,
            includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey],
            options: [.skipsHiddenFiles]
        ) {
            for case let fileURL as URL in enumerator {
                let ext = fileURL.pathExtension.lowercased()
                guard ["mp4", "m4v", "mov", "mkv"].contains(ext) else { continue }
                paths.insert(fileURL.path)
            }
        }
        return Array(paths)
    }

    func search(query: String, page: Int = 1) async throws -> SearchResponse {
        guard let api else { throw APIError.unauthorized }
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { throw APIError.server("Zapytanie jest za krótkie.") }
        return try await api.searchCdaHd(query: trimmed, page: page)
    }

    func searchResults(query: String) async throws -> [SearchResultItem] {
        try await search(query: query, page: 1).results
    }

    func fetchInfo(url: String) async throws -> VideoInfoResponse {
        guard let api else { throw APIError.unauthorized }
        return try await api.fetchVideoInfo(url: url)
    }

    func fetchCatalog(mode: FilmsCatalogMode, type: FilmsCatalogKind, page: Int) async throws -> CdaHdCatalogResponse {
        guard let api else { throw APIError.unauthorized }
        return try await api.fetchCdaHdCatalog(mode: mode, type: type, page: page)
    }

    // MARK: - Downloads

    func downloadToServer(
        selection: OnlineMovieSelection,
        height: Int = 720
    ) {
        let key = selection.url
        activeTasks[key]?.cancel()
        activeTasks[key] = Task {
            await runServerAcquire(selection: selection, height: height, alsoPhone: false)
        }
    }

    func downloadToPhone(
        selection: OnlineMovieSelection,
        height: Int = 720,
        video: VideoAppModel
    ) {
        let key = selection.url
        activeTasks[key]?.cancel()
        activeTasks[key] = Task {
            await runServerAcquire(selection: selection, height: height, alsoPhone: true, video: video)
        }
    }

    func cancelTransfer(url: String) {
        activeTasks[url]?.cancel()
        activeTasks[url] = nil
        if case .acquiringServer = transferStates[url], let jobId = jobId(for: url) {
            Task { try? await api?.cancelJob(jobId: jobId) }
        }
        if downloads.contains(where: { $0.url == url && $0.isDownloaded }) {
            transferStates[url] = .onServer
        } else if phoneFileURL(for: url) != nil {
            transferStates[url] = .onPhone
        } else {
            transferStates[url] = .idle
        }
    }

    /// Stream online bez pobierania — `/api/preview` → `/api/play`.
    func watchStream(
        selection: OnlineMovieSelection,
        height: Int = 720,
        video: VideoAppModel,
        episodeQueue: [EpisodeItem]? = nil,
        seriesTitle: String? = nil
    ) {
        streamTask?.cancel()
        streamTask = Task {
            await runWatchStream(
                selection: selection,
                height: height,
                video: video,
                episodeQueue: episodeQueue,
                seriesTitle: seriesTitle
            )
        }
    }

    func cancelStreamPrepare() {
        streamTask?.cancel()
        streamTask = nil
        isPreparingStream = false
        streamPrepareProgress = 0
        statusMessage = "Anulowano uruchamianie streamu."
    }

    func playFromServer(selection: OnlineMovieSelection, video: VideoAppModel) async {
        guard let api else { return }
        do {
            let jobId: String
            if let existing = self.jobId(for: selection.url) {
                jobId = existing
            } else {
                statusMessage = "Najpierw pobierz film na serwer."
                return
            }
            let token = try await api.moviePlayToken(jobId: jobId)
            let streamURL = api.movieStreamURL(jobId: jobId, token: token.token)
            await playRemoteOrLocal(url: streamURL, title: selection.title, video: video)
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func playFromPhone(selection: OnlineMovieSelection, video: VideoAppModel) async {
        guard let local = phoneFileURL(for: selection.url) else {
            statusMessage = "Brak kopii na telefonie."
            return
        }
        await playRemoteOrLocal(url: local, title: selection.title, video: video)
    }

    private func runWatchStream(
        selection: OnlineMovieSelection,
        height: Int,
        video: VideoAppModel,
        episodeQueue: [EpisodeItem]? = nil,
        seriesTitle: String? = nil
    ) async {
        guard let api else { return }
        isPreparingStream = true
        streamPrepareProgress = 0
        statusMessage = "Uruchamiam stream…"
        defer {
            isPreparingStream = false
            streamTask = nil
        }

        do {
            // Lokalna kopia / serwer mają pierwszeństwo (natychmiastowy start).
            if let local = phoneFileURL(for: selection.url) {
                statusMessage = nil
                await playRemoteOrLocal(url: local, title: selection.title, video: video)
                return
            }
            if let existing = jobId(for: selection.url) {
                let token = try await api.moviePlayToken(jobId: existing)
                let streamURL = api.movieStreamURL(jobId: existing, token: token.token)
                statusMessage = nil
                await playRemoteOrLocal(url: streamURL, title: selection.title, video: video)
                return
            }

            let preview = try await api.startPreview(url: selection.url, height: height)
            if preview.instant != true {
                try await api.waitForPreviewReady(jobId: preview.jobId) { [weak self] progress in
                    Task { @MainActor in
                        self?.streamPrepareProgress = progress
                        self?.statusMessage = String(format: "Przygotowuję stream… %.0f%%", progress)
                    }
                }
            } else {
                streamPrepareProgress = 100
            }

            let token = try await api.previewPlayToken(jobId: preview.jobId)
            let streamURL = api.previewStreamURL(jobId: token.jobId, token: token.token)
            statusMessage = nil
            if let queue = episodeQueue, !queue.isEmpty {
                await playEpisodeQueue(
                    episodes: queue,
                    startURL: selection.url,
                    streamURLForEpisode: { ep in
                        if ep.url == selection.url { return streamURL }
                        return nil
                    },
                    seriesTitle: seriesTitle ?? selection.title,
                    video: video
                )
            } else {
                await playRemoteOrLocal(url: streamURL, title: selection.title, video: video)
            }
        } catch is CancellationError {
            // cancelled
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func deleteServerDownload(url: String) async {
        guard let api else { return }
        do {
            try await api.deleteMovieDownload(url: url)
            downloads.removeAll { $0.url == url }
            if phoneFileURL(for: url) != nil {
                transferStates[url] = .onPhone
            } else {
                transferStates[url] = .idle
            }
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    // MARK: - Private

    private func runServerAcquire(
        selection: OnlineMovieSelection,
        height: Int,
        alsoPhone: Bool,
        video: VideoAppModel? = nil
    ) async {
        guard let api else { return }
        let key = selection.url
        transferStates[key] = .acquiringServer(progress: 0)
        statusMessage = alsoPhone ? "Pobieram na serwer, potem na telefon…" : "Pobieram na serwer…"

        do {
            var start = try await api.startMovieDownload(
                url: selection.url,
                height: height,
                title: selection.title,
                thumbnail: selection.thumbnail,
                source: selection.source
            )

            if start.ready != true {
                let deadline = Date().addingTimeInterval(45 * 60)
                while Date() < deadline {
                    try Task.checkCancellation()
                    let job = try await api.fetchJobStatus(jobId: start.jobId)
                    if job.status == "error" {
                        throw APIError.server(job.error ?? "Pobieranie nie powiodło się.")
                    }
                    let pct = max(0, min(100, job.progress ?? 0))
                    transferStates[key] = .acquiringServer(progress: pct)
                    if job.ready == true || job.status == "done" { break }
                    try await Task.sleep(nanoseconds: 900_000_000)
                }
            } else {
                transferStates[key] = .acquiringServer(progress: 100)
            }

            _ = try await api.linkMovieDownload(
                url: selection.url,
                title: selection.title,
                downloadJobId: start.jobId,
                thumbnail: selection.thumbnail,
                source: selection.source
            )
            await refreshDownloads()
            transferStates[key] = .onServer
            statusMessage = "Film jest na serwerze."

            if alsoPhone, let video {
                try await pullToPhone(selection: selection, jobId: start.jobId, video: video)
            }
        } catch is CancellationError {
            // cancelled
        } catch {
            transferStates[key] = .failed(error.localizedDescription)
            statusMessage = error.localizedDescription
        }

        activeTasks[key] = nil
    }

    func pullToPhoneAfterServer(
        selection: OnlineMovieSelection,
        jobId: String,
        video: VideoAppModel? = nil,
        onProgress: ((Double) -> Void)? = nil
    ) async throws {
        try await pullToPhone(selection: selection, jobId: jobId, video: video, onProgress: onProgress)
    }

    /// Odtwarzaj serial jak playlistę Netflix — auto-następny odcinek w VideoPlayerView.
    func playEpisodeQueue(
        episodes: [EpisodeItem],
        startURL: String,
        streamURLForEpisode: (EpisodeItem) -> URL?,
        seriesTitle: String,
        video: VideoAppModel
    ) async {
        guard let startIdx = episodes.firstIndex(where: { $0.url == startURL }) else {
            statusMessage = "Nie znaleziono odcinka w kolejce."
            return
        }

        let slice = Array(episodes[startIdx...])
        var items: [VideoItem] = []
        for episode in slice {
            let title = serverDownloadTitle(seriesTitle: seriesTitle, episode: episode)
            var fileURL = streamURLForEpisode(episode)
            if fileURL == nil, let local = phoneFileURL(for: episode.url) {
                fileURL = local
            } else if fileURL == nil, let jobId = jobId(for: episode.url), let api {
                if let token = try? await api.moviePlayToken(jobId: jobId) {
                    fileURL = api.movieStreamURL(jobId: jobId, token: token.token)
                }
            }
            items.append(VideoItem(
                id: episode.url,
                title: title,
                relativePath: episode.title,
                fileURL: fileURL,
                fileSize: nil,
                folderId: UUID()
            ))
        }

        guard let firstPlayable = items.firstIndex(where: { $0.fileURL != nil }) else {
            statusMessage = "Nie udało się uruchomić odtwarzania."
            return
        }

        episodeStreamContext = EpisodeStreamContext(
            seriesTitle: seriesTitle,
            episodes: slice,
            streamHeight: 720
        )

        video.onWillStartPlayback?()
        OrientationLock.shared.unlockAll()
        video.engine.play(
            session: VideoPlaybackSession(
                items: items,
                startIndex: firstPlayable,
                folderName: seriesTitle
            ),
            sources: video.sources
        )
        video.isPlayerPresented = true
    }

    private struct EpisodeStreamContext {
        let seriesTitle: String
        let episodes: [EpisodeItem]
        let streamHeight: Int
    }

    private var episodeStreamContext: EpisodeStreamContext?

    func advanceToNextStreamingEpisode(video: VideoAppModel) async {
        guard episodeStreamContext != nil else {
            if video.engine.hasNext {
                video.engine.playNext(sources: video.sources)
            }
            return
        }
        await video.engine.advanceStreamingEpisode(sources: video.sources) { [weak self] item in
            guard let self, let api = self.api else {
                throw APIError.unauthorized
            }
            let preview = try await api.startPreview(url: item.id, height: self.episodeStreamContext?.streamHeight ?? 720)
            if preview.instant != true {
                try await api.waitForPreviewReady(jobId: preview.jobId) { _ in }
            }
            let token = try await api.previewPlayToken(jobId: preview.jobId)
            return api.previewStreamURL(jobId: token.jobId, token: token.token)
        }
    }

    private func pullToPhone(
        selection: OnlineMovieSelection,
        jobId: String,
        video: VideoAppModel? = nil,
        onProgress: ((Double) -> Void)? = nil
    ) async throws {
        guard let api else { return }
        let key = selection.url
        transferStates[key] = .downloadingPhone(progress: 0)
        statusMessage = "Kopiuję na telefon…"

        var request = URLRequest(url: api.movieFileURL(jobId: jobId))
        request.timeoutInterval = 3600
        if let token = SessionStore.load()?.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue(AppConfig.userAgent, forHTTPHeaderField: "User-Agent")

        let safeName = selection.title
            .replacingOccurrences(of: "/", with: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let fileName = (safeName.isEmpty ? "film" : safeName) + ".mp4"
        let partURL = AppDocuments.videoImports.appendingPathComponent("\(UUID().uuidString).part")

        let temp = try await transfers.download(
            request: request,
            partURL: partURL,
            trackKey: "movie:\(key)",
            onProgress: { fraction in
                let pct = min(100, max(0, fraction * 100))
                onProgress?(pct)
                Task { @MainActor in
                    self.transferStates[key] = .downloadingPhone(progress: pct)
                }
            }
        )

        AppDocuments.ensureStructure()
        let dest = AppDocuments.videoImports.appendingPathComponent("\(UUID().uuidString.prefix(8))-\(fileName)")
        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        try FileManager.default.moveItem(at: temp, to: dest)
        try? FileManager.default.removeItem(at: partURL)

        rememberPhoneFile(url: key, fileURL: dest)
        if let video {
            try video.connectFolder(name: selection.title, url: dest)
        }
        transferStates[key] = .onPhone
        statusMessage = "Film zapisany na telefonie."
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func playRemoteOrLocal(url: URL, title: String, video: VideoAppModel) async {
        if url.isFileURL {
            do {
                try video.connectFolder(name: title, url: url)
                guard let folder = video.folders.last else { return }
                await video.refreshFolder(folder)
                video.play(folder: folder, startIndex: 0)
            } catch {
                statusMessage = error.localizedDescription
            }
        } else {
            video.playStandalone(url: url, title: title)
        }
    }

    // MARK: - Phone registry

    private static let phoneMapKey = "onlineMovies.phoneFiles"

    private func phoneFileURL(for sourceURL: String) -> URL? {
        let map = UserDefaults.standard.dictionary(forKey: Self.phoneMapKey) as? [String: String] ?? [:]
        guard let path = map[sourceURL] else { return nil }
        let url = URL(fileURLWithPath: path)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    private func rememberPhoneFile(url: String, fileURL: URL) {
        var map = UserDefaults.standard.dictionary(forKey: Self.phoneMapKey) as? [String: String] ?? [:]
        map[url] = fileURL.path
        UserDefaults.standard.set(map, forKey: Self.phoneMapKey)
    }
}

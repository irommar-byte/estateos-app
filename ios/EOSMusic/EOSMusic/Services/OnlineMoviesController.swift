import Foundation
import UIKit

enum MoviePlaybackLaunchPhase: Equatable {
    case idle
    case preparing(message: String, progress: Double?)
    case presenting
    case playing
    case failed(String)
    case cancelled

    var isBusy: Bool {
        switch self {
        case .preparing, .presenting: return true
        default: return false
        }
    }

    var message: String? {
        switch self {
        case .preparing(let message, _): return message
        case .presenting: return "Otwieram odtwarzacz…"
        case .failed(let message): return message
        case .cancelled: return "Anulowano uruchamianie."
        case .idle, .playing: return nil
        }
    }

    var progress: Double? {
        guard case .preparing(_, let progress) = self else { return nil }
        return progress
    }
}

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
    @Published private(set) var playbackLaunchPhase: MoviePlaybackLaunchPhase = .idle
    @Published var statusMessage: String?

    private weak var api: MusicAPIClient?
    private weak var movieDownloads: MovieDownloadService?
    private var streamTask: Task<Bool, Never>?
    private var streamLaunchID: UUID?
    private let transfers = BackgroundTransferService.shared

    func attach(api: MusicAPIClient, movieDownloads: MovieDownloadService? = nil) {
        self.api = api
        self.movieDownloads = movieDownloads
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
        playbackLaunchPhase = .idle
        streamTask?.cancel()
        streamTask = nil
        for url in transferStates.keys {
            transfers.cancel(trackKey: "movie:\(url)")
        }
    }

    func transferState(for url: String, title: String? = nil) -> OnlineMovieTransferState {
        if let state = movieDownloads?.itemState(for: url) {
            switch state {
            case .pending, .queuedOnServer:
                return .acquiringServer(progress: 0)
            case .downloading(let progress):
                return .acquiringServer(progress: max(0, progress))
            case .pullingPhone(let progress):
                return .downloadingPhone(progress: max(0, progress))
            case .failed(let message):
                return .failed(message)
            case .done:
                if phoneFileURL(for: url) != nil { return .onPhone }
                if downloadEntry(for: url, title: title) != nil { return .onServer }
            case .idle, .skipped, .cancelled:
                break
            }
        }
        if let state = transferStates[url] { return state }
        if let keyed = transferStates.first(where: { MovieURLMatching.urlsMatch($0.key, url) })?.value {
            return keyed
        }
        if phoneFileURL(for: url) != nil { return .onPhone }
        if downloadEntry(for: url, title: title) != nil { return .onServer }
        return .idle
    }

    func jobId(for url: String, title: String? = nil) -> String? {
        downloadEntry(for: url, title: title)?.downloadJobId
    }

    func downloadEntry(for url: String, title: String? = nil) -> MovieDownload? {
        MovieURLMatching.download(matching: url, title: title, in: downloads)
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
        startUnifiedDownload(selection: selection, height: height, destination: .server)
    }

    func downloadToPhone(
        selection: OnlineMovieSelection,
        height: Int = 720,
        video: VideoAppModel
    ) {
        _ = video
        startUnifiedDownload(selection: selection, height: height, destination: .serverAndPhone)
    }

    func cancelTransfer(url: String) {
        movieDownloads?.cancelItem(id: url)
        transfers.cancel(trackKey: "movie:\(url)")
        if downloads.contains(where: { $0.url == url && $0.isDownloaded }) {
            transferStates[url] = .onServer
        } else if phoneFileURL(for: url) != nil {
            transferStates[url] = .onPhone
        } else {
            transferStates[url] = .idle
        }
    }

    private func startUnifiedDownload(
        selection: OnlineMovieSelection,
        height: Int,
        destination: OnlineMovieDownloadDestination
    ) {
        let quality = MediaQualityOption(
            id: height > 0 ? "\(height)" : "best",
            label: height > 0 ? "\(height)p" : "Best",
            height: height > 0 ? height : nil
        )
        movieDownloads?.startBatch(
            items: [
                MovieDownloadQueueItem(
                    url: selection.url,
                    title: selection.title,
                    thumbnail: selection.thumbnail,
                    source: selection.source
                )
            ],
            label: selection.title,
            thumbnail: selection.thumbnail,
            contextKey: selection.url,
            format: .videoMP4,
            quality: quality,
            destination: destination
        )
    }

    private func setPlaybackPhase(_ phase: MoviePlaybackLaunchPhase) {
        playbackLaunchPhase = phase
        isPreparingStream = phase.isBusy
        streamPrepareProgress = phase.progress ?? 0
    }

    /// Stream online bez pobierania — `/api/preview` → `/api/play`.
    /// Awaiting this method reaches a terminal launch result; callers never poll flags.
    @discardableResult
    func watchStream(
        selection: OnlineMovieSelection,
        height: Int = 720,
        video: VideoAppModel,
        episodeQueue: [EpisodeItem]? = nil,
        seriesTitle: String? = nil,
        preferSavedCopy: Bool = true
    ) async -> Bool {
        streamTask?.cancel()
        let launchID = UUID()
        streamLaunchID = launchID
        setPlaybackPhase(.preparing(message: "Uruchamiam stream…", progress: nil))
        statusMessage = nil
        let task = Task { @MainActor [weak self] in
            guard let self else { return false }
            return await self.runWatchStream(
                selection: selection,
                height: height,
                video: video,
                episodeQueue: episodeQueue,
                seriesTitle: seriesTitle,
                preferSavedCopy: preferSavedCopy
            )
        }
        streamTask = task
        let result = await task.value
        if streamLaunchID == launchID {
            streamTask = nil
            streamLaunchID = nil
        }
        return result
    }

    func cancelStreamPrepare() {
        streamTask?.cancel()
        streamTask = nil
        streamLaunchID = nil
        setPlaybackPhase(.cancelled)
        statusMessage = nil
    }

    @discardableResult
    func playFromServer(selection: OnlineMovieSelection, video: VideoAppModel) async -> Bool {
        guard let api else {
            setPlaybackPhase(.failed("Brak połączenia z serwerem EOS."))
            return false
        }
        setPlaybackPhase(.preparing(message: "Uruchamiam z serwera…", progress: nil))
        do {
            guard let existing = self.jobId(for: selection.url, title: selection.title) else {
                setPlaybackPhase(.failed("Nie znaleziono gotowego pliku na serwerze."))
                return false
            }
            let token = try await api.moviePlayToken(jobId: existing)
            let streamURL = api.movieStreamURL(jobId: existing, token: token.token)
            setPlaybackPhase(.presenting)
            let started = await playRemoteOrLocal(url: streamURL, title: selection.title, video: video)
            setPlaybackPhase(started ? .playing : .failed(video.engine.errorMessage ?? "Nie udało się uruchomić pliku z serwera."))
            return started
        } catch is CancellationError {
            setPlaybackPhase(.cancelled)
            return false
        } catch {
            setPlaybackPhase(.failed(error.localizedDescription))
            return false
        }
    }

    @discardableResult
    func playFromPhone(selection: OnlineMovieSelection, video: VideoAppModel) async -> Bool {
        guard let local = phoneFileURL(for: selection.url) else {
            setPlaybackPhase(.failed("Brak kopii na tym urządzeniu."))
            return false
        }
        setPlaybackPhase(.presenting)
        let started = await playRemoteOrLocal(url: local, title: selection.title, video: video)
        setPlaybackPhase(started ? .playing : .failed(video.engine.errorMessage ?? "Nie udało się otworzyć kopii na urządzeniu."))
        return started
    }

    private func runWatchStream(
        selection: OnlineMovieSelection,
        height: Int,
        video: VideoAppModel,
        episodeQueue: [EpisodeItem]? = nil,
        seriesTitle: String? = nil,
        preferSavedCopy: Bool = true
    ) async -> Bool {
        guard let api else {
            setPlaybackPhase(.failed("Brak połączenia z serwerem EOS."))
            return false
        }

        do {
            // Lokalna kopia / serwer — tylko gdy użytkownik nie wybrał źródła na żywo.
            if preferSavedCopy, let local = phoneFileURL(for: selection.url) {
                setPlaybackPhase(.presenting)
                let started = await playRemoteOrLocal(url: local, title: selection.title, video: video)
                setPlaybackPhase(started ? .playing : .failed(video.engine.errorMessage ?? "Nie udało się otworzyć kopii na urządzeniu."))
                return started
            }
            if preferSavedCopy, let existing = jobId(for: selection.url, title: selection.title) {
                setPlaybackPhase(.preparing(message: "Uruchamiam z serwera…", progress: nil))
                let token = try await api.moviePlayToken(jobId: existing)
                let streamURL = api.movieStreamURL(jobId: existing, token: token.token)
                setPlaybackPhase(.presenting)
                let started: Bool
                if let queue = episodeQueue, queue.count > 1 {
                    started = await playEpisodeQueue(
                        episodes: queue,
                        startURL: selection.url,
                        streamURLForEpisode: { ep in
                            MovieURLMatching.urlsMatch(ep.url, selection.url) ? streamURL : nil
                        },
                        seriesTitle: seriesTitle ?? selection.title,
                        video: video
                    )
                } else {
                    started = await playRemoteOrLocal(url: streamURL, title: selection.title, video: video)
                }
                setPlaybackPhase(started ? .playing : .failed(video.engine.errorMessage ?? "Nie udało się uruchomić pliku z serwera."))
                return started
            }

            let preview = try await api.startPreview(url: selection.url, height: height)
            if preview.instant != true {
                try await api.waitForPreviewReady(jobId: preview.jobId) { [weak self] progress in
                    Task { @MainActor in
                        self?.setPlaybackPhase(.preparing(
                            message: "Przygotowuję stream…",
                            progress: progress
                        ))
                    }
                }
            }

            let token = try await api.previewPlayToken(jobId: preview.jobId)
            let streamURL = api.previewStreamURL(jobId: token.jobId, token: token.token)
            setPlaybackPhase(.presenting)
            let started: Bool
            if let queue = episodeQueue, !queue.isEmpty {
                started = await playEpisodeQueue(
                    episodes: queue,
                    startURL: selection.url,
                    streamURLForEpisode: { ep in
                        if MovieURLMatching.urlsMatch(ep.url, selection.url) { return streamURL }
                        return nil
                    },
                    seriesTitle: seriesTitle ?? selection.title,
                    video: video
                )
            } else {
                started = await playRemoteOrLocal(url: streamURL, title: selection.title, video: video)
            }
            setPlaybackPhase(started ? .playing : .failed(video.engine.errorMessage ?? "Nie udało się uruchomić obrazu."))
            return started
        } catch is CancellationError {
            setPlaybackPhase(.cancelled)
            return false
        } catch {
            setPlaybackPhase(.failed(error.localizedDescription))
            return false
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

    func pullToPhoneAfterServer(
        selection: OnlineMovieSelection,
        jobId: String,
        video: VideoAppModel? = nil,
        onProgress: ((Double) -> Void)? = nil,
        onIndeterminateProgress: ((Int64) -> Void)? = nil
    ) async throws {
        try await pullToPhone(
            selection: selection,
            jobId: jobId,
            video: video,
            onProgress: onProgress,
            onIndeterminateProgress: onIndeterminateProgress
        )
    }

    /// Odtwarzaj serial jak playlistę Netflix — auto-następny odcinek w VideoPlayerView.
    func playEpisodeQueue(
        episodes: [EpisodeItem],
        startURL: String,
        streamURLForEpisode: (EpisodeItem) -> URL?,
        seriesTitle: String,
        video: VideoAppModel
    ) async -> Bool {
        guard let startIdx = episodes.firstIndex(where: {
            MovieURLMatching.urlsMatch($0.url, startURL)
        }) else {
            return false
        }

        let slice = Array(episodes[startIdx...])
        var items: [VideoItem] = []
        for episode in slice {
            let title = serverDownloadTitle(seriesTitle: seriesTitle, episode: episode)
            var fileURL = streamURLForEpisode(episode)
            if fileURL == nil, let local = phoneFileURL(for: episode.url) {
                fileURL = local
            } else if fileURL == nil, let jobId = jobId(for: episode.url, title: episode.title), let api {
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
            return false
        }

        episodeStreamContext = EpisodeStreamContext(
            seriesTitle: seriesTitle,
            episodes: slice,
            streamHeight: 720
        )

        return await video.beginPlaybackAndWait(
            session: VideoPlaybackSession(
                items: items,
                startIndex: firstPlayable,
                folderName: seriesTitle
            )
        )
    }

    private struct EpisodeStreamContext {
        let seriesTitle: String
        let episodes: [EpisodeItem]
        let streamHeight: Int
    }

    private var episodeStreamContext: EpisodeStreamContext?

    func clearEpisodeStreamContext() {
        episodeStreamContext = nil
        if playbackLaunchPhase == .playing {
            setPlaybackPhase(.idle)
        }
    }

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
        onProgress: ((Double) -> Void)? = nil,
        onIndeterminateProgress: ((Int64) -> Void)? = nil
    ) async throws {
        guard let api else { return }
        let key = selection.url
        transferStates[key] = .downloadingPhone(progress: 0)
        statusMessage = "Kopiuję na telefon…"

        let play = try await api.moviePlayToken(jobId: jobId)
        var request = URLRequest(url: api.movieStreamURL(jobId: jobId, token: play.token))
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
            },
            onIndeterminateProgress: { bytes in
                onIndeterminateProgress?(bytes)
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

    private func playRemoteOrLocal(url: URL, title: String, video: VideoAppModel) async -> Bool {
        // A registered phone copy already lives in our sandbox; play it directly instead
        // of copying it into another imported folder on every tap.
        episodeStreamContext = nil
        let item = VideoItem(
            id: url.absoluteString,
            title: title,
            relativePath: title,
            fileURL: url,
            fileSize: nil,
            folderId: UUID()
        )
        return await video.beginPlaybackAndWait(
            session: VideoPlaybackSession(
                items: [item],
                startIndex: 0,
                folderName: url.isFileURL ? "Na urządzeniu" : EOSLibraryBrand.displayName
            )
        )
    }

    // MARK: - Phone registry

    private static let phoneMapKey = "onlineMovies.phoneFiles"

    private func phoneFileURL(for sourceURL: String) -> URL? {
        let map = UserDefaults.standard.dictionary(forKey: Self.phoneMapKey) as? [String: String] ?? [:]
        if let path = map[sourceURL], FileManager.default.fileExists(atPath: path) {
            return URL(fileURLWithPath: path)
        }
        for (key, path) in map where MovieURLMatching.urlsMatch(key, sourceURL) {
            if FileManager.default.fileExists(atPath: path) {
                return URL(fileURLWithPath: path)
            }
        }
        return nil
    }

    private func rememberPhoneFile(url: String, fileURL: URL) {
        var map = UserDefaults.standard.dictionary(forKey: Self.phoneMapKey) as? [String: String] ?? [:]
        map[url] = fileURL.path
        UserDefaults.standard.set(map, forKey: Self.phoneMapKey)
    }
}

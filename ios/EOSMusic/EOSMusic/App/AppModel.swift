import SwiftUI
import Combine

@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var user: AuthUser?
    @Published private(set) var isBootstrapping = true
    @Published private(set) var musicFolders: [MusicFolder] = []
    @Published private(set) var musicTracks: [MusicTrack] = []
    @Published private(set) var serverAssetCount: Int = 0
    @Published private(set) var serverLibraryBytes: Int = 0
    @Published private(set) var serverAssets: [MusicAssetItem] = []
    @Published private(set) var favoriteItems: [FavoriteItem] = []
    @Published private(set) var isLibraryLoading = false
    @Published var libraryError: String?
    @Published var isFullPlayerPresented = false

    let api = MusicAPIClient()
    let playback = MusicPlaybackService()
    let downloads = MusicDownloadService()
    let sources = MusicSourcesStore()

    private var cancellables = Set<AnyCancellable>()

    init() {
        playback.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        downloads.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        sources.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        OfflineMusicStore.shared.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
    }

    func bootstrap() async {
        defer { isBootstrapping = false }
        guard let session = SessionStore.load() else { return }
        api.setToken(session.token)
        do {
            // Splash only waits for session validation — library loads in-app.
            user = try await api.me()
            Task { await refreshWorkspace(soft: true) }
        } catch {
            // Only clear session on auth failure; network blips keep the user in-app.
            if case APIError.unauthorized = error {
                logout()
            } else if case APIError.server(let message) = error,
                      message.localizedCaseInsensitiveContains("brak autoryzacji")
                        || message.localizedCaseInsensitiveContains("zaloguj") {
                logout()
            } else {
                libraryError = error.localizedDescription
                // Keep cached session user so Login isn't forced on a blip.
                user = session.user
                Task { await refreshWorkspace(soft: true) }
            }
        }
    }

    func login(login: String, password: String, remember: Bool) async throws {
        let session = try await api.login(login: login, password: password)
        user = session.user
        if remember {
            try CredentialsStore.save(login: login, password: password)
        } else {
            CredentialsStore.clear()
        }
        // Enter the app immediately; playlist sync continues in background.
        Task { await refreshWorkspace(soft: true) }
    }

    func loginWithApple(identityToken: String, login: String? = nil, password: String? = nil, linkOnly: Bool = false) async throws {
        let session = try await api.loginWithApple(
            identityToken: identityToken,
            login: login,
            password: password,
            linkOnly: linkOnly
        )
        user = session.user
        Task { await refreshWorkspace(soft: true) }
    }

    func linkAppleAccount(identityToken: String, login: String, password: String) async throws {
        _ = try await api.loginWithApple(
            identityToken: identityToken,
            login: login,
            password: password,
            linkOnly: true
        )
    }

    func unlinkAppleAccount(appleUserId: String) async throws {
        try await api.unlinkApple(appleUserId: appleUserId)
        AppleSignInService.shared.clearLink()
    }

    func logout() {
        playback.stop()
        sources.endAllAccess()
        isFullPlayerPresented = false
        api.setToken(nil)
        SessionStore.clear()
        user = nil
        musicFolders = []
        musicTracks = []
        favoriteItems = []
    }

    /// Library + favorites + assets. Never blocks login/splash.
    func refreshWorkspace(soft _: Bool = false) async {
        isLibraryLoading = true
        defer { isLibraryLoading = false }
        do {
            try await refreshMusicLibrary()
        } catch {
            libraryError = error.localizedDescription
        }
        try? await refreshFavorites()
        await refreshServerAssets()
    }

    func refreshMusicLibrary() async throws {
        let library = try await api.fetchMusicLibrary()
        musicFolders = library.folders
        musicTracks = deduplicatedTracks(library.tracks)
        downloads.syncFromTracks(musicTracks)
        libraryError = nil
    }

    func refreshFavorites() async throws {
        favoriteItems = try await api.fetchFavorites()
    }

    func isFavorite(_ url: String) -> Bool {
        favoriteItems.contains { $0.url == url }
    }

    func isOfflineAvailable(_ url: String) -> Bool {
        downloads.isOfflineAvailable(url)
    }

    func toggleFavorite(_ item: FavoriteItem) async {
        do {
            if isFavorite(item.url) {
                try await api.removeFavorite(url: item.url)
                favoriteItems.removeAll { $0.url == item.url }
            } else {
                try await api.addFavorite(item)
                favoriteItems.append(item)
            }
        } catch {
            libraryError = error.localizedDescription
        }
    }

    func addTrackToFolder(folderId: String, track: MusicTrackPayload) async throws {
        let prepared = try await prepareLibraryPayload(track)
        _ = try await api.addTrackToFolder(folderId: folderId, track: prepared)
        try await refreshMusicLibrary()
    }

    func addTracksToFolder(folderId: String, tracks: [MusicTrackPayload]) async throws {
        guard !tracks.isEmpty else { return }
        for track in tracks {
            let prepared = try await prepareLibraryPayload(track)
            _ = try await api.addTrackToFolder(folderId: folderId, track: prepared)
        }
        try await refreshMusicLibrary()
    }

    func removeTrackFromFolder(folderId: String, url: String) async throws {
        try await api.removeTrackFromFolder(folderId: folderId, url: url)
        try await refreshMusicLibrary()
    }

    func deleteMusicFolder(_ folder: MusicFolder) async throws {
        try await api.deleteMusicFolder(id: folder.id)
        try await refreshMusicLibrary()
    }

    func reorderTracks(in folderId: String, urls: [String]) async throws {
        let response = try await api.reorderFolderTracks(folderId: folderId, urls: urls)
        musicTracks.removeAll { $0.folderId == folderId }
        musicTracks.append(contentsOf: response.tracks)
    }


    func refreshServerAssets() async {
        do {
            let response = try await api.listMusicAssets()
            serverAssetCount = response.count
            serverLibraryBytes = response.totalBytes
            serverAssets = response.items
        } catch {
            // Zachowaj ostatnie wartości — Settings i tak pokazuje ścieżki lokalne.
        }
    }

    func deleteServerAsset(_ assetId: String) async {
        do {
            try await api.deleteMusicAsset(assetId: assetId)
            await refreshServerAssets()
            try? await refreshMusicLibrary()
        } catch {
            libraryError = error.localizedDescription
        }
    }

    func downloadJobId(for url: String) -> String? {
        musicTracks.first { $0.url == url }?.durableJobId
    }

    func minimizePlayer() {
        isFullPlayerPresented = false
    }

    func expandPlayer() {
        guard playback.engine != nil else { return }
        isFullPlayerPresented = true
    }

    func playTracks(_ tracks: [MusicTrack], startIndex: Int, folder: MusicFolder?) async {
        let enriched = tracks.map { track -> MusicPlaybackTrack in
            let jobId = track.durableJobId
                ?? musicTracks.first(where: { $0.url == track.url })?.durableJobId
            return MusicPlaybackTrack(from: track, downloadJobId: jobId)
        }
        let externalSourceIds = Set(enriched.compactMap(\.externalSourceId))
        for sourceId in externalSourceIds {
            if let source = sources.sources.first(where: { $0.id == sourceId }), !source.isWebDAV {
                _ = sources.beginAccess(sourceId: sourceId)
            }
        }
        let session = MusicPlaybackSession(
            queue: enriched,
            startIndex: startIndex,
            folderId: folder?.id,
            folderName: folder?.name
        )
        let needsExternalResolver = !externalSourceIds.isEmpty
        await playback.play(
            session: session,
            api: api,
            jobLookup: { [weak self] url in
                self?.downloadJobId(for: url)
            },
            libraryTrackLookup: { [weak self] url in
                self?.musicTracks.first { $0.url == url }
            },
            externalFileResolver: needsExternalResolver ? { [weak self] track in
                guard let self else { throw APIError.server("Błąd odtwarzania.") }
                return try await self.sources.resolvePlayableFile(for: track)
            } : nil,
            onTeardown: { [weak self] in
                guard let self else { return }
                for sourceId in externalSourceIds {
                    self.sources.endAccess(sourceId: sourceId)
                }
            }
        )
        isFullPlayerPresented = false
    }

    func playCatalogItems(_ items: [SearchResultItem], startIndex: Int) async {
        let queue = items.map { MusicPlaybackTrack(from: $0) }
        let session = MusicPlaybackSession(queue: queue, startIndex: startIndex, folderId: nil, folderName: nil)
        await playback.play(
            session: session,
            api: api,
            jobLookup: { [weak self] url in
                self?.downloadJobId(for: url)
            },
            libraryTrackLookup: { [weak self] url in
                self?.musicTracks.first { $0.url == url }
            }
        )
        isFullPlayerPresented = false
    }

    func playExternalTracks(_ tracks: [ExternalAudioTrack], source: ConnectedMusicSource, startIndex: Int) async {
        let sourceId = source.id
        if !source.isWebDAV {
            _ = sources.beginAccess(sourceId: sourceId)
        }
        let queue = tracks.map { $0.playbackTrack(sourceId: sourceId) }
        let session = MusicPlaybackSession(
            queue: queue,
            startIndex: startIndex,
            folderId: nil,
            folderName: source.name,
            externalSourceId: sourceId
        )
        await playback.play(
            session: session,
            api: api,
            jobLookup: { _ in nil },
            libraryTrackLookup: { [weak self] url in
                self?.musicTracks.first { $0.url == url }
            },
            externalFileResolver: { [weak self] track in
                guard let self else { throw APIError.server("Błąd odtwarzania.") }
                return try await self.sources.resolvePlayableFile(for: track)
            },
            onTeardown: { [weak self] in
                self?.sources.endAccess(sourceId: sourceId)
            }
        )
        isFullPlayerPresented = false
    }

    func downloadTrack(_ track: MusicTrack, folderId: String) {
        downloads.download(track: track, folderId: folderId, api: api) { [weak self] in
            try? await self?.refreshMusicLibrary()
        }
    }

    func downloadAll(in tracks: [MusicTrack], folderId: String) {
        downloads.downloadAllPending(tracks: tracks, folderId: folderId, api: api) { [weak self] in
            try? await self?.refreshMusicLibrary()
        }
    }

    func cancelDownload(for url: String) {
        downloads.cancelDownload(for: url)
    }

    func removeOfflineDownload(for url: String) {
        downloads.removeOffline(url)
    }

    func trackForCurrentPlayback() -> MusicTrack? {
        guard let playback = playback.engine?.currentTrack else { return nil }
        if let hit = musicTracks.first(where: { $0.url == playback.url }) { return hit }
        guard let folderId = playback.folderId else { return nil }
        return MusicTrack(from: playback, folderId: folderId)
    }

    private func deduplicatedTracks(_ tracks: [MusicTrack]) -> [MusicTrack] {
        var byURL: [String: MusicTrack] = [:]
        for track in tracks {
            if let existing = byURL[track.url] {
                let existingDownloaded = (existing.downloadJobId?.isEmpty == false)
                let newDownloaded = (track.downloadJobId?.isEmpty == false)
                if newDownloaded && !existingDownloaded {
                    byURL[track.url] = track
                }
            } else {
                byURL[track.url] = track
            }
        }
        return byURL.values.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    private func prepareLibraryPayload(_ track: MusicTrackPayload) async throws -> MusicTrackPayload {
        try await TrackMetadataEnricher.enrichPayload(track, api: api)
    }
}

import SwiftUI
import Combine
import UIKit
import ImageIO

@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var user: AuthUser?
    @Published private(set) var isBootstrapping = true
    @Published private(set) var musicFolders: [MusicFolder] = []
    @Published private(set) var musicTracks: [MusicTrack] = []
    @Published private(set) var serverAssetCount: Int = 0
    @Published private(set) var serverLibraryBytes: Int = 0
    @Published private(set) var serverDiskTotalBytes: Int?
    @Published private(set) var serverDiskFreeBytes: Int?
    @Published private(set) var serverAssets: [MusicAssetItem] = []
    @Published private(set) var favoriteItems: [FavoriteItem] = []
    @Published private(set) var isLibraryLoading = false
    @Published private(set) var librarySyncMessage: String?
    @Published var libraryError: String?
    @Published var isFullPlayerPresented = false
    @Published private(set) var toast: MusicToast?
    @Published var externalOpenPrompt: ExternalOpenPrompt?
    /// User-forced Offline from the Online/Offline control.
    /// Canonical sync is `configureOfflineMode(from:)` + `UIPreferences` onChange in `EOSMusicApp` — avoid duplicate fans elsewhere.
    @Published var offlineModeEnabled = false {
        didSet {
            playback.engine?.offlineOnly = isOfflinePlaybackActive
            if offlineModeEnabled != oldValue {
                applyOfflineModeChange()
            }
        }
    }

    let api = MusicAPIClient()
    let playback = MusicPlaybackService()
    let downloads = MusicDownloadService()
    let onlineMovies = OnlineMoviesController()
    let movieDownloads = MovieDownloadService()
    let serverDownloads = ServerAccountDownloadsMonitor()
    let sources = MusicSourcesStore()
    let network = NetworkReachability.shared

    /// True when user forced Offline or the device has no usable network.
    var isOfflinePlaybackActive: Bool {
        OfflinePlaybackPolicy.isOfflinePlaybackActive(
            offlineModeEnabled: offlineModeEnabled,
            isOnline: network.isOnline
        )
    }

    /// Sync / pobieranie / wyszukiwanie katalogu — animacja Wi‑Fi w pasku Online.
    @Published var isCatalogSearching = false

    var isNetworkBusy: Bool {
        isLibraryLoading
            || isCatalogSearching
            || downloads.bulkServerQueue != nil
            || MusicDownloadService.hasActiveDownloads
            || movieDownloads.isRunning
            || serverDownloads.hasActiveServerWork
    }

    func isMovieDownloaded(url: String) -> Bool {
        onlineMovies.jobId(for: url) != nil
    }

    func isMovieDownloaded(url: String, title: String?) -> Bool {
        onlineMovies.jobId(for: url, title: title) != nil
    }

    func isMovieOnPhone(url: String) -> Bool {
        onlineMovies.transferState(for: url) == .onPhone
    }

    var downloadedLibraryTracks: [MusicTrack] {
        LibraryData.allLocalDownloads(from: musicTracks) { isOfflineAvailable($0) }
    }

    /// Tracks visible in library browsing (full library online, downloads only offline).
    var libraryTracksForBrowsing: [MusicTrack] {
        isOfflinePlaybackActive ? downloadedLibraryTracks : musicTracks
    }

    /// Playlists that still have playable content in the current mode.
    var libraryFoldersForBrowsing: [MusicFolder] {
        guard isOfflinePlaybackActive else { return musicFolders }
        let offlineFolderIds = Set(downloadedLibraryTracks.map(\.folderId))
        return musicFolders.filter { offlineFolderIds.contains($0.id) }
    }

    func tracksMatchingOfflineAvailability(_ tracks: [MusicTrack]) -> [MusicTrack] {
        guard isOfflinePlaybackActive else { return tracks }
        return tracks.filter { isOfflineAvailable($0.url) || $0.isLocalOfflineOnly }
    }

    private var cancellables = Set<AnyCancellable>()
    private var toastDismissTask: Task<Void, Never>?
    /// Single-flight / stale-guard for overlapping library refreshes.
    private var workspaceRefreshGeneration = 0

    init() {
        onlineMovies.attach(api: api)
        movieDownloads.attach(api: api, onlineMovies: onlineMovies)
        serverDownloads.attach(api: api, musicDownloads: downloads, movieDownloads: movieDownloads)
        BluetoothMediaBrowser.shared.playFromLibrary = { [weak self] tracks, index, folder in
            await self?.playTracks(tracks, startIndex: index, folder: folder)
        }
        playback.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        // Download progress used to republish AppModel ~2×/s and invalidate every list row.
        downloads.objectWillChange
            .throttle(for: .milliseconds(280), scheduler: RunLoop.main, latest: true)
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        onlineMovies.objectWillChange
            .throttle(for: .milliseconds(280), scheduler: RunLoop.main, latest: true)
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        movieDownloads.objectWillChange
            .throttle(for: .milliseconds(280), scheduler: RunLoop.main, latest: true)
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        serverDownloads.objectWillChange
            .throttle(for: .milliseconds(400), scheduler: RunLoop.main, latest: true)
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        // sources.objectWillChange is not fanned out — SourcesView observes MusicSourcesStore directly.
        OfflineMusicStore.shared.objectWillChange
            .throttle(for: .milliseconds(200), scheduler: RunLoop.main, latest: true)
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        network.objectWillChange
            .sink { [weak self] _ in
                guard let self else { return }
                self.objectWillChange.send()
                self.playback.engine?.offlineOnly = self.isOfflinePlaybackActive
            }
            .store(in: &cancellables)
    }

    func configureOfflineMode(from preferences: UIPreferences) {
        offlineModeEnabled = preferences.offlineModeEnabled
        playback.engine?.offlineOnly = isOfflinePlaybackActive
    }

    private func applyOfflineModeChange() {
        playback.engine?.offlineOnly = isOfflinePlaybackActive
        if isOfflinePlaybackActive,
           let current = playback.engine?.currentTrack,
           !isOfflineAvailable(current.url),
           current.playbackFileURL == nil {
            playback.stop()
            presentToast(.offlineUnavailable(trackTitle: current.title))
        }
        syncBluetoothLibraryBrowse()
    }

    private func syncBluetoothLibraryBrowse() {
        BluetoothMediaBrowser.shared.updateLibrary(
            folders: libraryFoldersForBrowsing,
            tracks: libraryTracksForBrowsing
        )
    }

    func bootstrap() async {
        defer { isBootstrapping = false }
        guard let session = SessionStore.load() else { return }
        api.setToken(session.token)
        do {
            // Splash only waits for session validation — library loads in-app.
            user = try await api.me()
            await syncLocalAppleLink(from: user)
            hydrateLibraryFromCacheIfNeeded()
            serverDownloads.start()
            Task { await refreshWorkspace(soft: true) }
            Task { await onlineMovies.refreshDownloads() }
            Task { await serverDownloads.refreshOnce() }
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
                hydrateLibraryFromCacheIfNeeded()
                serverDownloads.start()
                Task { await refreshWorkspace(soft: true) }
                Task { await serverDownloads.refreshOnce() }
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
        serverDownloads.start()
        Task { await refreshWorkspace(soft: true) }
        Task { await serverDownloads.refreshOnce() }
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
        serverDownloads.start()
        Task { await serverDownloads.refreshOnce() }
    }

    func linkAppleAccount(identityToken: String, login: String? = nil, password: String? = nil) async throws {
        let session = try await api.loginWithApple(
            identityToken: identityToken,
            login: login,
            password: password,
            linkOnly: true
        )
        user = session.user
    }

    func unlinkAppleAccount(appleUserId: String) async throws {
        try await api.unlinkApple(appleUserId: appleUserId)
        AppleSignInService.shared.clearLink()
        if var current = user {
            current.appleLinked = false
            current.appleEmail = nil
            current.appleUserId = nil
            user = current
            if let session = SessionStore.load() {
                try? SessionStore.save(SessionStore.Session(token: session.token, user: current))
            }
        }
    }

    func refreshAppleLinkStatus() async {
        do {
            let me = try await api.me()
            user = me
            if let session = SessionStore.load() {
                try? SessionStore.save(SessionStore.Session(token: session.token, user: me))
            }
            await syncLocalAppleLink(from: me)
        } catch {
            // Keep local state on network blips.
        }
    }

    private func syncLocalAppleLink(from me: AuthUser?) async {
        guard let me else { return }
        if me.isAppleLinked {
            let existing = AppleSignInService.shared.linkedAccount
            try? AppleSignInService.shared.storeLink(AppleAccountLink(
                userId: me.appleUserId ?? existing?.userId ?? "linked",
                email: me.appleEmail ?? existing?.email,
                fullName: existing?.fullName,
                linkedAt: existing?.linkedAt ?? Date()
            ))
        } else if AppleSignInService.shared.isLinked {
            AppleSignInService.shared.clearLink()
        }
    }

    func logout() {
        playback.stop()
        sources.endAllAccess()
        isFullPlayerPresented = false
        serverDownloads.stop()
        api.setToken(nil)
        SessionStore.clear()
        AppleSignInService.shared.clearLink()
        user = nil
        musicFolders = []
        musicTracks = []
        favoriteItems = []
        librarySyncMessage = nil
        LibraryCacheStore.clear()
        onlineMovies.reset()
        movieDownloads.clearFinishedBatch()
    }

    private func hydrateLibraryFromCacheIfNeeded() {
        guard let login = user?.login else { return }
        guard musicTracks.isEmpty, musicFolders.isEmpty,
              let cached = LibraryCacheStore.load(for: login) else { return }
        musicFolders = cached.folders
        musicTracks = deduplicatedTracks(cached.tracks)
        downloads.syncFromTracks(musicTracks)
        syncBluetoothLibraryBrowse()
    }

    private func applyLibrarySnapshot(_ library: MusicLibraryResponse, hadCache: Bool) {
        let previousFolderIds = Set(musicFolders.map(\.id))
        let previousTrackURLs = Set(musicTracks.map(\.url))
        let newFolders = library.folders.filter { !previousFolderIds.contains($0.id) }
        let newTracks = deduplicatedTracks(library.tracks).filter { !previousTrackURLs.contains($0.url) }
        let removedTracks = musicTracks.filter { old in
            !library.tracks.contains { $0.url == old.url }
        }

        musicFolders = library.folders
        musicTracks = deduplicatedTracks(library.tracks)
        downloads.syncFromTracks(musicTracks)
        libraryError = nil
        syncBluetoothLibraryBrowse()

        if let login = user?.login {
            LibraryCacheStore.save(library, for: login)
        }

        guard hadCache, !isOfflinePlaybackActive else { return }
        var parts: [String] = []
        if !newFolders.isEmpty {
            parts.append("\(newFolders.count) nowych playlist")
        }
        if !newTracks.isEmpty {
            parts.append("\(newTracks.count) nowych utworów")
        }
        if !removedTracks.isEmpty {
            parts.append("\(removedTracks.count) usuniętych")
        }
        if parts.isEmpty {
            librarySyncMessage = "Biblioteka aktualna"
        } else {
            librarySyncMessage = "Zaktualizowano: " + parts.joined(separator: ", ")
            presentToast(MusicToast(
                systemImage: "arrow.triangle.2.circlepath",
                title: "Biblioteka zsynchronizowana",
                subtitle: parts.joined(separator: " · ")
            ))
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            if self.librarySyncMessage == "Biblioteka aktualna" || self.librarySyncMessage?.hasPrefix("Zaktualizowano") == true {
                self.librarySyncMessage = nil
            }
        }
    }

    /// Library + favorites + assets. Never blocks login/splash.
    /// Concurrent callers share one generation token — only the latest result is applied.
    func refreshWorkspace(soft _: Bool = false) async {
        workspaceRefreshGeneration &+= 1
        let generation = workspaceRefreshGeneration
        let hadCache = !musicTracks.isEmpty || !musicFolders.isEmpty
        if hadCache, !isOfflinePlaybackActive {
            librarySyncMessage = "Synchronizuję playlisty online…"
        }
        isLibraryLoading = true
        defer {
            if generation == workspaceRefreshGeneration {
                isLibraryLoading = false
            }
        }
        do {
            try await refreshMusicLibrary(hadCache: hadCache)
        } catch {
            guard generation == workspaceRefreshGeneration else { return }
            libraryError = error.localizedDescription
            if hadCache {
                librarySyncMessage = "Sync offline — pokazuję zapisaną bibliotekę"
            }
        }
        guard generation == workspaceRefreshGeneration else { return }
        try? await refreshFavorites()
        guard generation == workspaceRefreshGeneration else { return }
        await refreshServerAssets()
    }

    func refreshMusicLibrary(hadCache: Bool? = nil) async throws {
        let hadLocal = hadCache ?? (!musicTracks.isEmpty || !musicFolders.isEmpty)
        let library = try await api.fetchMusicLibrary()
        applyLibrarySnapshot(library, hadCache: hadLocal)
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

    /// Durable EOS server copy for this URL (library track or assets list).
    func isOnServer(_ url: String) -> Bool {
        if musicTracks.first(where: { $0.url == url })?.isOnServer == true { return true }
        if serverAssets.contains(where: { $0.url == url }) { return true }
        return false
    }

    func playbackCloudState(for track: MusicPlaybackTrack) -> TrackDownloadUIState {
        downloads.uiState(
            for: track.url,
            isOnServer: isOnServer(track.url) || track.isOnServer
        )
    }

    func isInLibrary(_ url: String) -> Bool {
        musicTracks.contains { $0.url == url }
    }

    /// Apple Music–style “+”: adds to primary library playlist and warms durable server asset.
    func addToLibrary(_ track: MusicTrackPayload) async throws {
        if isInLibrary(track.url) { return }
        let folderId = try await ensurePrimaryLibraryFolderId()
        try await addTrackToFolder(folderId: folderId, track: track)
        presentToast(.addedToLibrary(trackTitle: track.title))
    }

    func presentToast(_ toast: MusicToast) {
        toastDismissTask?.cancel()
        withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) {
            self.toast = toast
        }
        let id = toast.id
        toastDismissTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_400_000_000)
            guard !Task.isCancelled, self.toast?.id == id else { return }
            withAnimation(.easeInOut(duration: 0.28)) {
                self.toast = nil
            }
        }
    }

    func dismissToast() {
        toastDismissTask?.cancel()
        withAnimation(.easeInOut(duration: 0.22)) {
            toast = nil
        }
    }

    func ensurePrimaryLibraryFolderId() async throws -> String {
        if let existing = musicFolders.first(where: {
            $0.name.localizedCaseInsensitiveCompare("Moja muzyka") == .orderedSame
        }) {
            return existing.id
        }
        if let first = musicFolders.first {
            return first.id
        }
        let folder = try await api.createMusicFolder(name: "Moja muzyka")
        try await refreshMusicLibrary()
        return musicFolders.first(where: { $0.id == folder.id })?.id ?? folder.id
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

    func addTrackToFolder(folderId: String, track: MusicTrackPayload, announcePlaylistName: String? = nil) async throws {
        let prepared = try await prepareLibraryPayload(track)
        _ = try await api.addTrackToFolder(folderId: folderId, track: prepared)
        try await refreshMusicLibrary()
        if let announcePlaylistName {
            presentToast(.addedToPlaylist(trackTitle: track.title, playlist: announcePlaylistName))
        }
        downloads.ensureOnServer(
            url: track.url,
            folderId: folderId,
            api: api,
            onLibraryChanged: { [weak self] in
                try? await self?.refreshMusicLibrary()
                await self?.refreshServerAssets()
            },
            onReady: { [weak self] in
                await self?.presentToast(.savedOnServer(trackTitle: track.title))
            }
        )
    }

    func addTracksToFolder(folderId: String, tracks: [MusicTrackPayload]) async throws {
        guard !tracks.isEmpty else { return }
        for track in tracks {
            let prepared = try await prepareLibraryPayload(track)
            _ = try await api.addTrackToFolder(folderId: folderId, track: prepared)
        }
        try await refreshMusicLibrary()
    }

    /// Tworzy playlistę albumu, dodaje metadane utworów i kolejkuje zapis na serwer EOS (po kolei, z ponawianiem).
    func addAlbumToLibrary(albumTitle: String, tracks: [MusicTrackPayload]) async throws -> String {
        guard !tracks.isEmpty else { throw APIError.server("Album nie ma utworów.") }
        let folder = try await api.createMusicFolder(name: albumTitle)
        try await addTracksToFolder(folderId: folder.id, tracks: tracks)
        queueAlbumOnServer(folderId: folder.id, albumTitle: albumTitle, tracks: tracks)
        return folder.id
    }

    private func queueAlbumOnServer(folderId: String, albumTitle: String, tracks: [MusicTrackPayload]) {
        let items = tracks.map {
            MusicDownloadService.ServerQueueItem(url: $0.url, folderId: folderId, title: $0.title)
        }
        downloads.queueAllOnServerSequentially(
            label: albumTitle,
            items: items,
            api: api,
            isAlreadyOnServer: { [weak self] url in
                self?.isOnServer(url) == true
            },
            onLibraryChanged: { [weak self] in
                try? await self?.refreshMusicLibrary()
                await self?.refreshServerAssets()
            },
            onAllComplete: { [weak self] in
                await self?.presentToast(MusicToast(
                    systemImage: "externaldrive.fill.badge.checkmark",
                    title: "Album na serwerze EOS",
                    subtitle: albumTitle
                ))
            }
        )
        presentToast(MusicToast(
            systemImage: "arrow.down.circle.fill",
            title: "Kolejka pobierania",
            subtitle: "\(tracks.count) utworów · \(albumTitle)"
        ))
    }

    func removeTrackFromFolder(folderId: String, url: String) async throws {
        try await api.removeTrackFromFolder(folderId: folderId, url: url)
        try await refreshMusicLibrary()
    }

    func deleteMusicFolder(_ folder: MusicFolder) async throws {
        try await api.deleteMusicFolder(id: folder.id)
        try await refreshMusicLibrary()
    }

    func updateFolderCover(folderId: String, imageData: Data) async throws {
        let payload = await Task.detached(priority: .userInitiated) {
            Self.coverUploadData(imageData)
        }.value
        let base64 = payload.base64EncodedString()
        _ = try await api.updateMusicFolder(id: folderId, coverBase64: base64)
        try await refreshMusicLibrary()
    }

    /// Animowane GIF/APNG/WebP idą na serwer bez rekompresji (JPEG zabijał animację);
    /// statyczne zdjęcia nadal zmniejszamy do JPEG.
    nonisolated private static func coverUploadData(_ data: Data) -> Data {
        let serverLimit = 4_200_000 // limit serwera to 4,5 MB — zostaw margines na base64/nagłówki
        if isAnimatedImageData(data), data.count <= serverLimit {
            return data
        }
        return jpegDataForCover(data)
    }

    nonisolated private static func isAnimatedImageData(_ data: Data) -> Bool {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return false }
        return CGImageSourceGetCount(source) > 1
    }

    nonisolated private static func jpegDataForCover(_ data: Data) -> Data {
        guard let image = UIImage(data: data) else { return data }
        let maxSide: CGFloat = 900
        let size = image.size
        let scale = min(1, maxSide / max(size.width, size.height))
        let target = CGSize(width: max(1, size.width * scale), height: max(1, size.height * scale))
        let renderer = UIGraphicsImageRenderer(size: target)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return resized.jpegData(compressionQuality: 0.82) ?? data
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
            serverDiskTotalBytes = response.diskTotalBytes
            serverDiskFreeBytes = response.diskFreeBytes
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
        withAnimation(EOSMotion.playerSheet) {
            isFullPlayerPresented = false
        }
    }

    func expandPlayer() {
        guard playback.engine != nil else { return }
        withAnimation(EOSMotion.playerSheet) {
            isFullPlayerPresented = true
        }
    }

    func playTracks(_ tracks: [MusicTrack], startIndex: Int, folder: MusicFolder?) async {
        var queueTracks = tracks
        var start = startIndex

        if isOfflinePlaybackActive {
            let offline = tracks.filter { isOfflineAvailable($0.url) || $0.isLocalOfflineOnly }
            guard !offline.isEmpty else {
                let title = tracks.indices.contains(startIndex) ? tracks[startIndex].title : "Utwór"
                presentToast(.offlineUnavailable(trackTitle: title))
                return
            }
            let preferredURL = tracks.indices.contains(startIndex) ? tracks[startIndex].url : nil
            queueTracks = offline
            if let preferredURL, let idx = offline.firstIndex(where: { $0.url == preferredURL }) {
                start = idx
            } else {
                if let preferredURL, !isOfflineAvailable(preferredURL) {
                    let title = tracks.indices.contains(startIndex) ? tracks[startIndex].title : "Utwór"
                    presentToast(.offlineUnavailable(trackTitle: title))
                }
                start = 0
            }
        }

        let enriched = queueTracks.map { track -> MusicPlaybackTrack in
            let jobId = track.durableJobId
                ?? musicTracks.first(where: { $0.url == track.url })?.durableJobId
            return MusicPlaybackTrack(from: track, downloadJobId: jobId)
        }
        // Prefer the exact tapped URL even if offline filtering reshuffled indices.
        let preferredURL = tracks.indices.contains(startIndex) ? tracks[startIndex].url : nil
        var resolvedStart = start
        if let preferredURL,
           let idx = enriched.firstIndex(where: { $0.url == preferredURL }) {
            resolvedStart = idx
        }
        resolvedStart = min(max(0, resolvedStart), max(0, enriched.count - 1))
        let externalSourceIds = Set(enriched.compactMap(\.externalSourceId))
        for sourceId in externalSourceIds {
            if let source = sources.sources.first(where: { $0.id == sourceId }), !source.isWebDAV {
                _ = sources.beginAccess(sourceId: sourceId)
            }
        }
        let session = MusicPlaybackSession(
            queue: enriched,
            startIndex: resolvedStart,
            folderId: folder?.id,
            folderName: folder?.name ?? (isOfflinePlaybackActive ? "Pobrane" : nil)
        )
        let needsExternalResolver = !externalSourceIds.isEmpty
        await playback.play(
            session: session,
            api: api,
            jobLookup: { [weak self] url in
                self?.downloadJobId(for: url)
            },
            libraryTrackLookup: { [weak self] url in
                guard let self else { return nil }
                if let hit = self.musicTracks.first(where: { $0.url == url }) { return hit }
                return self.downloadedLibraryTracks.first(where: { $0.url == url })
            },
            externalFileResolver: needsExternalResolver ? { [weak self] track in
                guard let self else { throw APIError.server("Błąd odtwarzania.") }
                return try await self.sources.resolvePlayableFile(for: track)
            } : nil,
            offlineOnly: isOfflinePlaybackActive,
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
        var queueItems = items
        var start = startIndex
        if isOfflinePlaybackActive {
            let offline = items.filter { isOfflineAvailable($0.url) }
            guard !offline.isEmpty else {
                let title = items.indices.contains(startIndex) ? items[startIndex].title : "Utwór"
                presentToast(.offlineUnavailable(trackTitle: title))
                return
            }
            let preferred = items.indices.contains(startIndex) ? items[startIndex].url : nil
            queueItems = offline
            if let preferred, let idx = offline.firstIndex(where: { $0.url == preferred }) {
                start = idx
            } else {
                start = 0
            }
        }
        let queue = queueItems.map { MusicPlaybackTrack(from: $0) }
        let session = MusicPlaybackSession(queue: queue, startIndex: start, folderId: nil, folderName: nil)
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
        playback.engine?.offlineOnly = isOfflinePlaybackActive
        isFullPlayerPresented = false
    }

    func playServerAssets(_ assets: [MusicAssetItem], startIndex: Int) async {
        guard !assets.isEmpty else { return }
        var playable = assets
        var start = startIndex
        if isOfflinePlaybackActive {
            playable = assets.filter { asset in
                guard let url = asset.url else { return false }
                return isOfflineAvailable(url)
            }
            guard !playable.isEmpty else {
                let title = assets.indices.contains(startIndex) ? (assets[startIndex].title ?? "Utwór") : "Utwór"
                presentToast(.offlineUnavailable(trackTitle: title))
                return
            }
            let preferred = assets.indices.contains(startIndex) ? assets[startIndex].url : nil
            if let preferred, let idx = playable.firstIndex(where: { $0.url == preferred }) {
                start = idx
            } else {
                start = 0
            }
        }
        let queue = playable.map { MusicPlaybackTrack(from: $0) }
        let session = MusicPlaybackSession(
            queue: queue,
            startIndex: min(max(0, start), queue.count - 1),
            folderId: nil,
            folderName: isOfflinePlaybackActive ? "Pobrane" : "Serwer EOS"
        )
        await playback.play(
            session: session,
            api: api,
            jobLookup: { [weak self] url in
                if let hit = self?.serverAssets.first(where: { $0.url == url }) {
                    return hit.assetId
                }
                return self?.downloadJobId(for: url)
            },
            libraryTrackLookup: { [weak self] url in
                self?.musicTracks.first { $0.url == url }
            },
            offlineOnly: isOfflinePlaybackActive
        )
        isFullPlayerPresented = false
    }

    func presentExternalOpen(_ prompt: ExternalOpenPrompt) {
        externalOpenPrompt = prompt
    }

    func dismissExternalOpenPrompt() {
        externalOpenPrompt = nil
    }

    func resolveExternalOpen(as kind: ExternalMediaKind, video: VideoAppModel) async {
        guard let prompt = externalOpenPrompt else { return }
        let url = prompt.sourceURL
        dismissExternalOpenPrompt()
        switch kind {
        case .audio:
            await playExternalAudioFile(at: url)
        case .video:
            await video.openExternalVideo(at: url)
        }
    }

    func playExternalAudioFile(at sourceURL: URL) async {
        do {
            let imported = try OpenedAudioImportService.importFile(from: sourceURL)

            // Odtwarzanie nigdy nie zależy od udanego dodania do biblioteki / sieci.
            if SessionStore.load() != nil {
                Task {
                    do {
                        try await addOpenedImportToLibrary(imported)
                    } catch {
                        presentToast(MusicToast(
                            systemImage: "exclamationmark.triangle",
                            title: "Odtwarzam lokalnie",
                            subtitle: "Nie dodano do biblioteki: \(error.localizedDescription)"
                        ))
                    }
                }
            } else {
                presentToast(MusicToast(
                    systemImage: "person.crop.circle.badge.plus",
                    title: "Odtwarzam plik",
                    subtitle: "Zaloguj się, aby dodać do biblioteki i wysłać na serwer"
                ))
            }

            let track = MusicPlaybackTrack(
                openedLocalFile: imported.localURL,
                libraryURL: imported.libraryURL,
                title: imported.title,
                artist: imported.artist,
                album: imported.album,
                duration: imported.duration
            )
            let session = MusicPlaybackSession(
                queue: [track],
                startIndex: 0,
                folderId: nil,
                folderName: "Importowane"
            )
            await playback.play(
                session: session,
                api: api,
                jobLookup: { _ in nil },
                libraryTrackLookup: { [weak self] url in
                    self?.musicTracks.first { $0.url == url }
                },
                externalFileResolver: { track in
                    guard let file = track.playbackFileURL ?? OpenedAudioRegistry.localURL(for: track.url) else {
                        throw APIError.server("Brak pliku do odtworzenia.")
                    }
                    return file
                }
            )
            playback.engine?.offlineOnly = isOfflinePlaybackActive
            isFullPlayerPresented = true
        } catch {
            libraryError = error.localizedDescription
            presentToast(MusicToast(
                systemImage: "exclamationmark.triangle",
                title: "Nie udało się otworzyć",
                subtitle: error.localizedDescription
            ))
        }
    }

    /// Dodaje importowany plik do biblioteki i kolejkuje upload na serwer EOS.
    private func addOpenedImportToLibrary(_ imported: OpenedAudioImportResult) async throws {
        if isInLibrary(imported.libraryURL) {
            if let existing = musicTracks.first(where: { $0.url == imported.libraryURL }),
               !existing.isOnServer {
                downloads.ensureOnServer(
                    url: imported.libraryURL,
                    folderId: existing.folderId,
                    api: api,
                    onLibraryChanged: { [weak self] in
                        try? await self?.refreshMusicLibrary()
                        await self?.refreshServerAssets()
                    },
                    onReady: { [weak self] in
                        await self?.presentToast(.savedOnServer(trackTitle: imported.title))
                    }
                )
            }
            return
        }

        let payload = MusicTrackPayload(
            url: imported.libraryURL,
            title: imported.title,
            artist: imported.artist,
            album: imported.album,
            thumbnail: nil,
            duration: imported.duration,
            quality: nil,
            source: "opened-file",
            artistId: nil,
            albumId: nil
        )
        let folderId = try await ensurePrimaryLibraryFolderId()
        try await addTrackToFolder(folderId: folderId, track: payload, announcePlaylistName: "Importowane")
        presentToast(.addedToLibrary(trackTitle: imported.title))
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
            await self?.refreshServerAssets()
        }
    }

    /// Full player / mini player: ensure library membership, then download to this iPhone.
    func downloadCurrentPlayback() {
        Task { await downloadCurrentPlaybackAsync() }
    }

    func downloadCurrentPlaybackAsync() async {
        guard let current = playback.engine?.currentTrack else { return }
        if current.isOpenedLocalImport {
            await uploadOpenedImportToServer(current)
            return
        }
        if current.isExternal {
            presentToast(MusicToast(
                systemImage: "iphone",
                title: "Plik lokalny",
                subtitle: "Ten utwór nie wymaga pobierania"
            ))
            return
        }
        let alreadyOnServer = isOnServer(current.url) || current.isOnServer
        if alreadyOnServer {
            presentToast(MusicToast(
                systemImage: "arrow.down.circle.fill",
                title: "Pobieranie na iPhone",
                subtitle: current.title
            ))
        }
        do {
            let folderId: String
            let track: MusicTrack
            if let existing = musicTracks.first(where: { $0.url == current.url }) {
                folderId = existing.folderId
                track = existing
            } else {
                folderId = try await ensurePrimaryLibraryFolderId()
                try await addTrackToFolder(folderId: folderId, track: current.payload)
                track = musicTracks.first(where: { $0.url == current.url })
                    ?? MusicTrack(from: current, folderId: folderId)
            }
            var resolved = track
            if resolved.durableJobId == nil,
               let jobId = current.serverAssetId ?? current.downloadJobId {
                resolved = MusicTrack(
                    folderId: track.folderId,
                    url: track.url,
                    title: track.title,
                    artist: track.artist,
                    album: track.album,
                    thumbnail: track.thumbnail,
                    duration: track.duration,
                    artistId: track.artistId,
                    albumId: track.albumId,
                    downloadJobId: jobId,
                    serverAssetId: jobId,
                    addedAt: track.addedAt
                )
            }
            downloadTrack(resolved, folderId: folderId)
        } catch {
            presentToast(MusicToast(
                systemImage: "exclamationmark.icloud",
                title: "Nie udało się pobrać",
                subtitle: error.localizedDescription
            ))
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
        guard let folderId = playback.folderId ?? musicFolders.first?.id else { return nil }
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
        if track.source == "opened-file" { return track }
        return try await TrackMetadataEnricher.enrichPayload(track, api: api)
    }

    private func uploadOpenedImportToServer(_ track: MusicPlaybackTrack) async {
        guard SessionStore.load() != nil else {
            presentToast(MusicToast(
                systemImage: "person.crop.circle",
                title: "Zaloguj się",
                subtitle: "Aby wysłać plik na serwer EOS"
            ))
            return
        }
        guard let local = track.playbackFileURL ?? OpenedAudioRegistry.localURL(for: track.url) else {
            presentToast(MusicToast(
                systemImage: "exclamationmark.triangle",
                title: "Brak pliku",
                subtitle: track.title
            ))
            return
        }
        do {
            let folderId: String
            if let existing = musicTracks.first(where: { $0.url == track.url }) {
                folderId = existing.folderId
            } else {
                folderId = try await ensurePrimaryLibraryFolderId()
                try await addTrackToFolder(folderId: folderId, track: track.payload)
            }
            presentToast(MusicToast(
                systemImage: "icloud.and.arrow.up",
                title: "Wysyłam na serwer",
                subtitle: track.title
            ))
            downloads.ensureOpenedFileOnServer(
                url: track.url,
                localFile: local,
                folderId: folderId,
                title: track.title,
                artist: track.artist,
                album: track.album,
                api: api,
                onLibraryChanged: { [weak self] in
                    try? await self?.refreshMusicLibrary()
                    await self?.refreshServerAssets()
                },
                onReady: { [weak self] in
                    await self?.presentToast(.savedOnServer(trackTitle: track.title))
                }
            )
        } catch {
            presentToast(MusicToast(
                systemImage: "exclamationmark.icloud",
                title: "Nie udało się dodać",
                subtitle: error.localizedDescription
            ))
        }
    }
}

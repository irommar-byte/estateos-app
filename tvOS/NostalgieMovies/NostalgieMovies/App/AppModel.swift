import SwiftUI
import Combine

@MainActor
final class AppModel: ObservableObject {
    @Published var session: SessionStore.Session?
    @Published var isBootstrapping = true
    @Published var globalError: String?
    @Published var pendingMediaURL: String?
    @Published private(set) var favoriteURLs: Set<String> = []
    @Published private(set) var musicFolders: [MusicFolder] = []
    @Published private(set) var musicTracks: [MusicTrack] = []
    @Published private(set) var movieDownloads: [MovieDownload] = []

    let api = MoviesAPIClient()
    let musicPlayback = MusicPlaybackService()
    let movieDownloadService = MovieDownloadService()
    private var cancellables = Set<AnyCancellable>()

    init() {
        musicPlayback.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
        movieDownloadService.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
        movieDownloadService.attach(app: self)
    }

    func bootstrap() async {
        musicPlayback.attachIfNeeded()
        defer { isBootstrapping = false }
        if let saved = SessionStore.load() {
            api.setToken(saved.token)
            session = saved
            do {
                _ = try await api.me()
                await refreshFavorites()
                await refreshMusicLibrary()
                await refreshMovieDownloads()
            } catch {
                logout()
            }
        }
    }

    func login(login: String, password: String) async throws {
        let session = try await api.login(login: login, password: password)
        self.session = session
        await refreshFavorites()
        await refreshMusicLibrary()
        await refreshMovieDownloads()
    }

    func logout() {
        musicPlayback.stopPlayback()
        movieDownloadService.cancelBatch()
        SessionStore.clear()
        api.setToken(nil)
        session = nil
        favoriteURLs = []
        musicFolders = []
        musicTracks = []
        movieDownloads = []
    }

    func refreshMovieDownloads() async {
        guard session != nil else { return }
        do {
            let response = try await api.fetchMovieDownloads()
            movieDownloads = response.downloads.filter(\.isDownloaded)
        } catch {
            movieDownloads = []
        }
    }

    func movieDownloadJobId(for url: String) -> String? {
        movieDownloads.first { $0.url == url && $0.isDownloaded }?.downloadJobId
    }

    func isMovieDownloaded(url: String) -> Bool {
        movieDownloadJobId(for: url) != nil
    }

    func refreshMusicLibrary() async {
        guard session != nil else { return }
        do {
            let library = try await api.fetchMusicLibrary()
            musicFolders = library.folders
            musicTracks = library.tracks
        } catch {
            musicFolders = []
            musicTracks = []
        }
    }

    func downloadJobId(for url: String) -> String? {
        musicTracks.first { $0.url == url && $0.isDownloaded }?.downloadJobId
    }

    func isMusicDownloaded(url: String) -> Bool {
        downloadJobId(for: url) != nil
    }

    func createMusicFolder(name: String, thumbnail: String? = nil) async throws -> MusicFolder {
        let folder = try await api.createMusicFolder(name: name, thumbnail: thumbnail)
        await refreshMusicLibrary()
        return folder
    }

    func deleteMusicFolder(id: String) async throws {
        try await api.deleteMusicFolder(id: id)
        await refreshMusicLibrary()
    }

    func addTrackToFolder(folderId: String, from item: SearchResultItem) async throws {
        let payload = MoviesAPIClient.MusicTrackPayload(
            url: item.url,
            title: item.title,
            artist: item.uploader,
            album: item.album,
            thumbnail: item.thumbnail,
            duration: item.duration,
            quality: item.quality ?? "320 kbps",
            source: item.source ?? "apple-music",
            previewUrl: item.previewUrl,
            artistId: item.artistId,
            albumId: item.albumId,
            trackNumber: item.trackNumber
        )
        _ = try await api.addTrackToFolder(folderId: folderId, track: payload)
        await refreshMusicLibrary()
    }

    func addTrackToFolder(folderId: String, track: MusicTrack) async throws {
        let payload = MoviesAPIClient.MusicTrackPayload(
            url: track.url,
            title: track.title,
            artist: track.artist,
            album: track.album,
            thumbnail: track.thumbnail,
            duration: track.duration,
            quality: track.quality ?? "320 kbps",
            source: track.source ?? "apple-music",
            previewUrl: track.previewUrl,
            artistId: track.artistId,
            albumId: track.albumId,
            trackNumber: track.trackNumber
        )
        _ = try await api.addTrackToFolder(folderId: folderId, track: payload)
        await refreshMusicLibrary()
    }

    func refreshFavorites() async {
        guard session != nil else { return }
        do {
            let items = try await api.fetchFavorites()
            favoriteURLs = Set(items.map(\.url))
        } catch {
            favoriteURLs = []
        }
    }

    func isFavorite(_ url: String) -> Bool {
        favoriteURLs.contains(url)
    }

    func addFavorite(_ item: FavoriteItem) async throws {
        try await api.addFavorite(item)
        favoriteURLs.insert(item.url)
    }

    func removeFavorite(url: String) async throws {
        try await api.removeFavorite(url: url)
        favoriteURLs.remove(url)
    }

    func openDeepLinkMedia(url: String) {
        pendingMediaURL = url
    }

    func consumePendingMediaURL() -> String? {
        defer { pendingMediaURL = nil }
        return pendingMediaURL
    }
}

import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case server(String)
    case decode
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Sesja wygasła — zaloguj się ponownie."
        case .server(let msg): return msg
        case .decode: return "Nie udało się odczytać odpowiedzi serwera."
        case .network(let err):
            if let urlError = err as? URLError, urlError.code == .timedOut {
                return "Serwer nie odpowiedział na czas — przygotowanie utworu może trwać w tle. Spróbuj ponownie za chwilę."
            }
            return err.localizedDescription
        }
    }

    var isTimeout: Bool {
        guard case .network(let err) = self else { return false }
        if let urlError = err as? URLError { return urlError.code == .timedOut }
        return (err as NSError).code == NSURLErrorTimedOut
    }

    static func isTimeout(_ error: Error) -> Bool {
        if let api = error as? APIError { return api.isTimeout }
        if let urlError = error as? URLError { return urlError.code == .timedOut }
        return (error as NSError).code == NSURLErrorTimedOut
    }
}

struct AuthUser: Codable, Equatable {
    let login: String
    let role: String
    var appleLinked: Bool?
    var appleEmail: String?
    var appleUserId: String?

    var isAppleLinked: Bool { appleLinked == true }

    var appleDisplayName: String {
        if let email = appleEmail, !email.isEmpty { return email }
        if let id = appleUserId, !id.isEmpty { return "Apple ID · \(id.prefix(8))…" }
        return "Połączono z Apple ID"
    }
}

struct AuthLoginResponse: Codable {
    let ok: Bool
    let token: String
    let user: AuthUser
    let expiresIn: Int?
    let appleLinked: Bool?
}

struct FavoriteItem: Codable, Identifiable, Hashable {
    let id: String
    let type: String
    let url: String
    let title: String
    let thumbnail: String?
    let source: String?
    let detail: String?
    let duration: Double?

    var isMovie: Bool {
        let t = type.lowercased()
        return t == "movie" || t == "video" || t == "film"
    }

    var isMusic: Bool { !isMovie }
}

struct FavoritesResponse: Codable {
    let items: [FavoriteItem]
}

extension FavoriteItem {
    var musicPayload: MusicTrackPayload {
        MusicTrackPayload(
            url: url,
            title: title,
            artist: detail,
            album: nil,
            thumbnail: thumbnail,
            duration: duration,
            quality: nil,
            source: source,
            artistId: nil,
            albumId: nil
        )
    }
}

struct SearchResultItem: Codable, Identifiable, Hashable {
    var id: String { url }
    let title: String
    let url: String
    let thumbnail: String?
    let detail: String?
    let source: String?
    let uploader: String?
    let album: String?
    let duration: Double?
    let artistId: String?
    let albumId: String?
    let trackNumber: Int?
    /// EOS™LIBRARY / film catalog extras (optional for Apple Music rows).
    let quality: String?
    let rating: Double?
    let views: Double?
    let isSerial: Bool?
    let premium: Bool?
    let previewUrl: String?

    var artworkURL: URL? {
        guard let thumbnail, !thumbnail.isEmpty else { return nil }
        return URL(string: thumbnail)
    }

    var looksLikeSeries: Bool {
        if isSerial == true { return true }
        let hay = "\(title) \(detail ?? "") \(url)".lowercased()
        return hay.contains("serial") || hay.contains("/serial") || hay.contains("sezon")
    }

    /// Etykieta typu treści na kafelku (SERIAL / FILM).
    var contentTypeBadge: String? {
        looksLikeSeries ? "SERIAL" : "FILM"
    }

    func matchesCatalogKind(_ kind: FilmsCatalogKind) -> Bool {
        switch kind {
        case .all: return true
        case .film: return !looksLikeSeries
        case .serial: return looksLikeSeries
        }
    }
}

struct MusicArtist: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let genre: String?
    let thumbnail: String?
}

struct MusicAlbum: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let artist: String?
    let artistId: String?
    let thumbnail: String?
    let trackCount: Int?
    let releaseDate: String?

    var releaseYear: String? {
        guard let releaseDate, releaseDate.count >= 4 else { return nil }
        return String(releaseDate.prefix(4))
    }

    /// Heurystyka pod sortowanie: single na końcu listy albumów.
    var isSingleRelease: Bool {
        if let trackCount, trackCount <= 1 { return true }
        return title.range(of: "single", options: [.caseInsensitive, .diacriticInsensitive]) != nil
    }
}

struct MusicCatalogSearchResponse: Codable {
    let query: String
    let artists: [MusicArtist]
    let albums: [MusicAlbum]
    let songs: [SearchResultItem]
}

struct MusicArtistDetailResponse: Codable {
    let artist: MusicArtist
    let albums: [MusicAlbum]
    let topSongs: [SearchResultItem]
}

struct MusicAlbumDetailResponse: Codable {
    let album: MusicAlbum
    let tracks: [SearchResultItem]
}

struct MusicPlayTokenResponse: Codable {
    let jobId: String
    let token: String
    let expiresIn: Int?
}

struct JobStatusResponse: Codable {
    let jobId: String
    let status: String
    let progress: Double?
    let error: String?
    let ready: Bool?
    let kind: String?
    let intent: String?
    let url: String?
    let name: String?
    let phase: String?
    let persistent: Bool?
    let onServer: Bool?
    let mode: String?

    var isDurableServerCopy: Bool {
        let s = status.lowercased()
        if s == "done" { return true }
        if onServer == true || persistent == true { return true }
        if mode == "file" { return true }
        if mode == "stream-proxy" { return false }
        return false
    }

    /// yt-dlp / NAS file copy — not a live preview proxy.
    var looksLikeFileIngest: Bool {
        if mode == "stream-proxy" { return false }
        if intent == "download" { return true }
        if mode == "file", ready != true { return true }
        let s = status.lowercased()
        if s == "downloading" || s == "preparing" || s == "starting" || s == "queued" { return true }
        let p = (phase ?? "").lowercased()
        return p == "download" || p == "acquire" || p == "file" || p == "ingest"
    }

    var isPlayableServerStream: Bool {
        let s = status.lowercased()
        if s == "error" || s == "cancelled" { return false }
        if ready == true || s == "done" { return true }
        return isDurableServerCopy && s != "downloading"
    }
}

enum MusicPlayWaitPolicy {
    /// When `requireDurable`, keep polling past a live `ready` proxy until the MP3 is on the NAS.
    static func isSatisfied(_ job: JobStatusResponse, requireDurable: Bool) -> Bool {
        if job.status.lowercased() == "error" { return false }
        let ready = job.ready == true || job.status.lowercased() == "done"
        guard ready else { return false }
        if !requireDurable { return true }
        return job.isDurableServerCopy || job.status.lowercased() == "done"
    }
}

struct ActiveServerDownload: Codable, Identifiable, Equatable, Hashable {
    var id: String { jobId }
    let jobId: String
    let kind: String
    let status: String
    let progress: Double?
    let title: String
    let url: String
    let thumbnail: String?
    let error: String?
    let ready: Bool?
    let folderId: String?
    let assetId: String?
    let queuedAt: Double?
    let finishedAt: Double?
    let phase: String?
    let updatedAt: Double?

    var isMusic: Bool { kind == "music" }
    var isMovie: Bool { kind == "movie" }

    var isTerminal: Bool {
        let s = status.lowercased()
        return s == "done" || s == "error" || s == "cancelled"
    }

    var isFailed: Bool {
        let s = status.lowercased()
        return s == "error" || s == "cancelled"
    }

    /// Server is writing a durable MP3 (bulk „Zapis na serwer”), not a live preview.
    var looksLikeFileIngest: Bool {
        let s = status.lowercased()
        let p = (phase ?? "").lowercased()
        if s == "downloading" || s == "preparing" || s == "starting" || s == "queued" { return true }
        return p == "download" || p == "acquire" || p == "file" || p == "ingest"
    }

    var progressPercent: Double {
        let value = progress ?? 0
        return min(100, max(0, value <= 1 && value > 0 ? value * 100 : value))
    }
}

struct ActiveServerDownloadsResponse: Codable {
    let items: [ActiveServerDownload]
    let music: [ActiveServerDownload]
    let movies: [ActiveServerDownload]

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        items = try container.decodeIfPresent([ActiveServerDownload].self, forKey: .items) ?? []
        music = try container.decodeIfPresent([ActiveServerDownload].self, forKey: .music) ?? []
        movies = try container.decodeIfPresent([ActiveServerDownload].self, forKey: .movies) ?? []
    }
}

struct DownloadStartResponse: Codable {
    let jobId: String
    let assetId: String?
    let reused: Bool?
    let ready: Bool?
    let status: String?
    let progress: Double?
    let token: String?
    let persistent: Bool?
    let onServer: Bool?
    let mode: String?

    /// Durable MP3 on the EOS server — not a live preview stream.
    var isDurableServerCopy: Bool {
        let s = status?.lowercased() ?? ""
        if s == "done" { return true }
        if onServer == true || persistent == true { return true }
        if mode == "file" { return true }
        if mode == "stream-proxy" { return false }
        return false
    }
}

struct MusicAssetItem: Codable, Identifiable, Hashable {
    var id: String { assetId }
    let assetId: String
    let url: String?
    let title: String?
    let artist: String?
    let album: String?
    let thumbnail: String?
    let duration: Double?
    let bytes: Int?
    let bitrate: Int?
    let ready: Bool?
    let acquiredAt: Double?
}

struct MusicAssetsResponse: Codable {
    let count: Int
    let totalBytes: Int
    let items: [MusicAssetItem]
    let diskTotalBytes: Int?
    let diskFreeBytes: Int?
}

struct MusicFolder: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let trackCount: Int?
    let downloadedTrackCount: Int?
    let fileCount: Int?
    let thumbnail: String?
    let applePlaylistUrl: String?

    var artworkURL: URL? {
        guard let thumbnail, !thumbnail.isEmpty else { return nil }
        if thumbnail.hasPrefix("http://") || thumbnail.hasPrefix("https://") || thumbnail.hasPrefix("file:") {
            return URL(string: thumbnail)
        }
        if thumbnail.hasPrefix("/api/") {
            let base = AppConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            return URL(string: base + thumbnail)
        }
        return URL(string: thumbnail)
    }

    var countLabel: String {
        let total = trackCount ?? 0
        let onServer = downloadedTrackCount ?? fileCount ?? 0
        if total > 0, onServer > 0, onServer < total {
            return "\(onServer) z \(total) na serwerze"
        }
        if onServer > 0 { return "\(onServer) utworów" }
        return "\(total) utworów"
    }
}

struct MusicTrack: Codable, Identifiable, Hashable {
    var id: String { url }
    let folderId: String
    let url: String
    let title: String
    let artist: String?
    let album: String?
    let thumbnail: String?
    let duration: Double?
    let artistId: String?
    let albumId: String?
    let downloadJobId: String?
    let serverAssetId: String?
    /// Unix ms when the track was added to the library (server).
    let addedAt: Double?

    /// Trwała kopia w bibliotece EOS na serwerze (nie mylić z plikiem na iPhonie).
    var isOnServer: Bool {
        if let serverAssetId, !serverAssetId.isEmpty { return true }
        if let downloadJobId, !downloadJobId.isEmpty { return true }
        return false
    }

    var isDownloaded: Bool { isOnServer }

    /// Local-only synthetic row (not part of a server playlist).
    var isLocalOfflineOnly: Bool { folderId == Self.localOfflineFolderId }

    static let localOfflineFolderId = "local-offline"

    var durableJobId: String? {
        if let serverAssetId, !serverAssetId.isEmpty { return serverAssetId }
        if let downloadJobId, !downloadJobId.isEmpty { return downloadJobId }
        return nil
    }

    var artworkURL: URL? { thumbnail.flatMap(URL.init(string:)) }

    init(
        folderId: String,
        url: String,
        title: String,
        artist: String? = nil,
        album: String? = nil,
        thumbnail: String? = nil,
        duration: Double? = nil,
        artistId: String? = nil,
        albumId: String? = nil,
        downloadJobId: String? = nil,
        serverAssetId: String? = nil,
        addedAt: Double? = nil
    ) {
        self.folderId = folderId
        self.url = url
        self.title = title
        self.artist = artist
        self.album = album
        self.thumbnail = thumbnail
        self.duration = duration
        self.artistId = artistId
        self.albumId = albumId
        self.downloadJobId = downloadJobId
        self.serverAssetId = serverAssetId
        self.addedAt = addedAt
    }

    init(from playback: MusicPlaybackTrack, folderId: String) {
        self.init(
            folderId: folderId,
            url: playback.url,
            title: playback.title,
            artist: playback.artist,
            album: playback.album,
            thumbnail: playback.thumbnail,
            duration: playback.duration,
            artistId: playback.artistId,
            albumId: playback.albumId,
            downloadJobId: playback.downloadJobId,
            serverAssetId: playback.serverAssetId ?? playback.downloadJobId,
            addedAt: nil
        )
    }

    /// Builds a library row from a local offline file / index entry.
    static func fromOfflineEntry(_ entry: OfflineTrackEntry) -> MusicTrack {
        MusicTrack(
            folderId: localOfflineFolderId,
            url: entry.url,
            title: entry.title,
            artist: entry.artist,
            album: nil,
            downloadJobId: entry.downloadJobId,
            addedAt: entry.savedAt.timeIntervalSince1970 * 1000
        )
    }
}

struct MusicLibraryResponse: Codable {
    let folders: [MusicFolder]
    let tracks: [MusicTrack]
}

struct MusicFolderTracksResponse: Codable {
    let folder: MusicFolder
    let tracks: [MusicTrack]
}

struct MusicFolderCreateResponse: Codable {
    let folder: MusicFolder
}

struct MusicPlaylistImportResponse: Codable {
    let folder: MusicFolder
    let added: Int?
    let trackCount: Int?
}

struct MusicPlaybackTrack: Identifiable, Hashable {
    let id: String
    let url: String
    let title: String
    let artist: String?
    let album: String?
    let thumbnail: String?
    let duration: Double?
    let artistId: String?
    let albumId: String?
    let folderId: String?
    let downloadJobId: String?
    let serverAssetId: String?
    let playbackFileURL: URL?
    let externalRelativePath: String?
    let webDAVPath: String?
    let googleDriveFileId: String?
    let externalSourceId: UUID?

    var artworkURL: URL? { thumbnail.flatMap(URL.init(string:)) }

    /// Trwała kopia na serwerze EOS (nie mylić z plikiem lokalnym).
    var isOnServer: Bool {
        if let serverAssetId, !serverAssetId.isEmpty { return true }
        if let downloadJobId, !downloadJobId.isEmpty { return true }
        return false
    }

    var isExternal: Bool {
        if OpenedAudioRegistry.isOpenedLibraryURL(url) { return false }
        if playbackFileURL != nil { return true }
        if webDAVPath != nil || googleDriveFileId != nil || externalSourceId != nil { return true }
        return ExternalTrackReference.isLibraryURL(url)
    }

    var isOpenedLocalImport: Bool {
        OpenedAudioRegistry.isOpenedLibraryURL(url)
    }

    init(
        externalFile fileURL: URL?,
        externalRelativePath: String?,
        webDAVPath: String?,
        googleDriveFileId: String? = nil,
        sourceId: UUID,
        title: String,
        artist: String?,
        album: String?
    ) {
        let stableURL = ExternalTrackReference.libraryURL(
            sourceId: sourceId,
            relativePath: externalRelativePath,
            webDAVPath: webDAVPath,
            googleDriveFileId: googleDriveFileId
        )
        id = stableURL
        url = stableURL
        self.title = title
        self.artist = artist
        self.album = album
        thumbnail = nil
        duration = nil
        folderId = nil
        downloadJobId = nil
        serverAssetId = nil
        artistId = nil
        albumId = nil
        playbackFileURL = fileURL
        self.externalRelativePath = externalRelativePath
        self.webDAVPath = webDAVPath
        self.googleDriveFileId = googleDriveFileId
        externalSourceId = sourceId
    }

    init(from track: MusicTrack, downloadJobId overrideJobId: String? = nil) {
        if let ref = ExternalTrackReference.parse(track.url) {
            id = track.url
            url = track.url
            title = track.title
            artist = track.artist
            album = track.album
            thumbnail = track.thumbnail
            duration = track.duration
            folderId = track.folderId
            downloadJobId = overrideJobId ?? track.downloadJobId
            serverAssetId = track.serverAssetId ?? track.downloadJobId
            artistId = track.artistId
            albumId = track.albumId
            playbackFileURL = nil
            externalRelativePath = ref.relativePath
            webDAVPath = ref.webDAVPath
            googleDriveFileId = ref.googleDriveFileId
            externalSourceId = ref.sourceId
            return
        }

        id = track.url
        url = track.url
        title = track.title
        artist = track.artist
        album = track.album
        thumbnail = track.thumbnail
        duration = track.duration
        folderId = track.folderId
        downloadJobId = overrideJobId ?? track.downloadJobId
        serverAssetId = track.serverAssetId ?? track.downloadJobId
        artistId = track.artistId
        albumId = track.albumId
        playbackFileURL = OpenedAudioRegistry.isOpenedLibraryURL(track.url)
            ? OpenedAudioRegistry.localURL(for: track.url)
            : nil
        externalRelativePath = nil
        webDAVPath = nil
        googleDriveFileId = nil
        externalSourceId = nil
    }

    /// Single file opened via „Otwórz za pomocą” / Pliki.
    init(openedLocalFile fileURL: URL, libraryURL: String, title: String, artist: String? = nil, album: String? = nil, duration: Double? = nil) {
        id = libraryURL
        url = libraryURL
        self.title = title
        self.artist = artist
        self.album = album
        thumbnail = nil
        self.duration = duration
        folderId = nil
        downloadJobId = nil
        serverAssetId = nil
        artistId = nil
        albumId = nil
        playbackFileURL = fileURL
        externalRelativePath = nil
        webDAVPath = nil
        googleDriveFileId = nil
        externalSourceId = nil
    }

    init(from item: SearchResultItem, folderId: String? = nil) {
        id = item.url
        url = item.url
        title = item.title
        artist = item.uploader ?? item.detail
        album = item.album
        thumbnail = item.thumbnail
        duration = item.duration
        self.folderId = folderId
        downloadJobId = nil
        serverAssetId = nil
        artistId = item.artistId
        albumId = item.albumId
        playbackFileURL = nil
        externalRelativePath = nil
        webDAVPath = nil
        googleDriveFileId = nil
        externalSourceId = nil
    }

    init(from asset: MusicAssetItem) {
        let resolvedURL = {
            let raw = asset.url?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return raw.isEmpty ? "eosmusic://asset/\(asset.assetId)" : raw
        }()
        id = resolvedURL
        url = resolvedURL
        let rawTitle = asset.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        title = rawTitle.isEmpty ? "Utwór" : rawTitle
        artist = asset.artist
        album = asset.album
        thumbnail = asset.thumbnail
        duration = asset.duration
        folderId = nil
        downloadJobId = asset.assetId
        serverAssetId = asset.assetId
        artistId = nil
        albumId = nil
        playbackFileURL = nil
        externalRelativePath = nil
        webDAVPath = nil
        googleDriveFileId = nil
        externalSourceId = nil
    }
}

struct MusicPlaybackSession: Identifiable {
    let id = UUID()
    let queue: [MusicPlaybackTrack]
    let startIndex: Int
    let folderId: String?
    let folderName: String?
    let externalSourceId: UUID?

    init(
        queue: [MusicPlaybackTrack],
        startIndex: Int,
        folderId: String?,
        folderName: String?,
        externalSourceId: UUID? = nil
    ) {
        self.queue = queue
        self.startIndex = startIndex
        self.folderId = folderId
        self.folderName = folderName
        self.externalSourceId = externalSourceId
    }
}

struct MusicArtistRoute: Hashable, Identifiable {
    var id: String { artistId.isEmpty ? artistName : artistId }
    let artistId: String
    let artistName: String
}

struct MusicAlbumRoute: Hashable, Identifiable {
    var id: String {
        if !albumId.isEmpty { return albumId }
        return [albumTitle, artist].compactMap { $0 }.joined(separator: "|")
    }
    let albumId: String
    let albumTitle: String?
    let artist: String?
}

struct MusicTrackPayload: Codable {
    let url: String
    let title: String
    let artist: String?
    let album: String?
    let thumbnail: String?
    let duration: Double?
    let quality: String?
    let source: String?
    let artistId: String?
    let albumId: String?
}

extension MusicPlaybackTrack {
    /// Adres zapisywany w bibliotece serwera (nigdy `file://`).
    var libraryPersistURL: String {
        if ExternalTrackReference.isLibraryURL(url) { return url }
        if let sourceId = externalSourceId {
            return ExternalTrackReference.libraryURL(
                sourceId: sourceId,
                relativePath: externalRelativePath,
                webDAVPath: webDAVPath,
                googleDriveFileId: googleDriveFileId
            )
        }
        return url
    }

    var payload: MusicTrackPayload {
        MusicTrackPayload(
            url: libraryPersistURL,
            title: title,
            artist: artist,
            album: album,
            thumbnail: thumbnail,
            duration: duration,
            quality: "320 kbps",
            source: isOpenedLocalImport ? "opened-file" : (isExternal ? "external-file" : "apple-music"),
            artistId: artistId,
            albumId: albumId
        )
    }

    var favoriteItem: FavoriteItem {
        FavoriteItem(
            id: url,
            type: "music",
            url: url,
            title: title,
            thumbnail: thumbnail,
            source: "apple-music",
            detail: artist,
            duration: duration
        )
    }
}

extension MusicTrack {
    var payload: MusicTrackPayload {
        MusicTrackPayload(
            url: url,
            title: title,
            artist: artist,
            album: album,
            thumbnail: thumbnail,
            duration: duration,
            quality: "320 kbps",
            source: "apple-music",
            artistId: artistId,
            albumId: albumId
        )
    }

    var favoriteItem: FavoriteItem {
        FavoriteItem(
            id: url,
            type: "music",
            url: url,
            title: title,
            thumbnail: thumbnail,
            source: "apple-music",
            detail: artist,
            duration: duration
        )
    }
}

extension SearchResultItem {
    var payload: MusicTrackPayload {
        MusicTrackPayload(
            url: url,
            title: title,
            artist: uploader ?? detail,
            album: album,
            thumbnail: thumbnail,
            duration: duration,
            quality: "320 kbps",
            source: source ?? "apple-music",
            artistId: artistId,
            albumId: albumId
        )
    }

    var favoriteItem: FavoriteItem {
        FavoriteItem(
            id: url,
            type: "music",
            url: url,
            title: title,
            thumbnail: thumbnail,
            source: source ?? "apple-music",
            detail: uploader ?? detail,
            duration: duration
        )
    }

    var movieFavoriteItem: FavoriteItem {
        FavoriteItem(
            id: url,
            type: "movie",
            url: url,
            title: title,
            thumbnail: thumbnail,
            source: source ?? "cda-hd",
            detail: detail,
            duration: duration
        )
    }
}

// MARK: - Music download destination

/// Gdzie zapisać utwór: tylko serwer EOS lub serwer + to urządzenie.
enum MusicDownloadDestination: String, Equatable, CaseIterable {
    case server
    case serverAndPhone

    var label: String {
        switch self {
        case .server: return "Tylko serwer EOS"
        case .serverAndPhone: return "Serwer + to urządzenie"
        }
    }

    var detail: String {
        switch self {
        case .server: return "Trwała kopia na NAS — odtwarzanie online"
        case .serverAndPhone: return "Najpierw serwer, potem plik offline na urządzeniu"
        }
    }

    var systemImage: String {
        switch self {
        case .server: return "icloud.fill"
        case .serverAndPhone: return "icloud.and.arrow.down.fill"
        }
    }
}

enum MusicBulkQueuePhase: String, Equatable {
    case server
    case device
}

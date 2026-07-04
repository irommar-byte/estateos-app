import Foundation

enum AppConfig {
    /// Produkcja — EstateOS™ Media API (ten sam backend co panel www).
    static let apiBaseURL = URL(string: "https://lineage.mycloudnas.com/admin_pro/api/movies/proxy")!
    static let keychainService = "pl.nostalgie.movies.auth"
    static let keychainAccount = "session"
    static let appName = "EstateOS™ Media"
    static let brandMark = "ESTATEOS™"
    static let brandProduct = "MEDIA"
}

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
        case .network(let err): return err.localizedDescription
        }
    }
}

struct AuthUser: Codable, Equatable {
    let login: String
    let role: String
}

struct AuthLoginResponse: Codable {
    let ok: Bool
    let token: String
    let user: AuthUser
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
}

struct FavoritesResponse: Codable {
    let items: [FavoriteItem]
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
    let quality: String?
    let isSerial: Bool?
    let premium: Bool?
    let previewUrl: String?
    let artistId: String?
    let albumId: String?
    let trackNumber: Int?
}

struct MusicArtist: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let genre: String?
    let thumbnail: String?
    let url: String?
    let source: String?
}

struct MusicAlbum: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let artist: String?
    let artistId: String?
    let thumbnail: String?
    let trackCount: Int?
    let releaseDate: String?
    let url: String?
    let source: String?

    var releaseYear: String? {
        guard let releaseDate, releaseDate.count >= 4 else { return nil }
        return String(releaseDate.prefix(4))
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

struct MusicPlaylistSummary: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let trackCount: Int?
    let thumbnail: String?
    let url: String?
    let source: String?
}

struct MusicPlaylistCatalogResponse: Codable {
    let playlist: MusicPlaylistSummary
    let tracks: [SearchResultItem]
}

struct MusicPlaylistImportResponse: Codable {
    let ok: Bool?
    let playlist: MusicPlaylistSummary
    let folder: MusicFolder
    let added: Int?
    let skipped: Int?
    let trackCount: Int?
}

struct MusicPlaylistSyncResponse: Codable {
    let ok: Bool?
    let playlist: MusicPlaylistSummary?
    let folder: MusicFolder
    let added: Int?
    let skipped: Int?
    let remoteTrackCount: Int?
    let localTrackCount: Int?
}

struct MusicPlayTokenResponse: Codable {
    let jobId: String
    let token: String
    let expiresIn: Int?
}

struct SearchResponse: Codable {
    let query: String
    let source: String
    let sort: String?
    let results: [SearchResultItem]
    let page: Int?
    let pageSize: Int?
    let total: Int?
    let totalPages: Int?
    let hasMore: Bool?
}

struct VideoInfoResponse: Codable, Identifiable {
    var id: String { webpageUrl }

    let title: String
    let webpageUrl: String
    let thumbnail: String?
    let duration: Double?
    let uploader: String?
    let album: String?
    let isPlaylist: Bool?
    let isSeasoned: Bool?
    let isMusicTrack: Bool?
    let episodeCount: Int?
    let seasons: [SeasonInfo]?
    let episodes: [EpisodeItem]?

    var playableEpisodes: [EpisodeItem] {
        if let seasons, !seasons.isEmpty {
            return seasons.flatMap { $0.episodes ?? [] }
        }
        return episodes ?? []
    }
}

struct SeasonInfo: Codable, Identifiable {
    var id: Int { seasonNumber ?? 0 }
    let seasonNumber: Int?
    let title: String?
    let episodeCount: Int?
    let episodes: [EpisodeItem]?
}

struct EpisodeItem: Codable, Identifiable, Hashable {
    var id: String { url }
    let title: String
    let url: String
    let thumbnail: String?
    let duration: Double?
    let seasonNumber: Int?
    let episodeNumber: Int?
}

struct PreviewResponse: Codable {
    let jobId: String
    let instant: Bool?
    let mode: String?
}

struct PlayTokenResponse: Codable {
    let jobId: String
    let token: String
}

struct JobStatusResponse: Codable {
    let jobId: String
    let status: String
    let progress: Double?
    let name: String?
    let error: String?
    let purpose: String?
    let ready: Bool?
    let fullReady: Bool?
    let cdaFullPending: Bool?
    let downloadPath: String?
}

struct PlaybackSession: Identifiable, Hashable {
    let jobId: String
    let streamURL: URL
    let token: String

    var id: String { jobId }
}

struct DownloadStartResponse: Codable {
    let jobId: String
}

struct MusicFolder: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let trackCount: Int?
    let downloadedTrackCount: Int?
    let fileCount: Int?
    let thumbnail: String?
    let createdAt: Double?
    let updatedAt: Double?
    let applePlaylistUrl: String?
    let applePlaylistId: String?
    let applePlaylistSyncedAt: Double?

    var isLinkedApplePlaylist: Bool {
        guard let applePlaylistUrl, !applePlaylistUrl.isEmpty else { return false }
        return true
    }

    var artworkURL: URL? {
        thumbnail.flatMap(URL.init(string:))
    }

    /// Utwory faktycznie na serwerze (pliki MP3).
    var serverTrackCount: Int {
        if let downloadedTrackCount, downloadedTrackCount > 0 { return downloadedTrackCount }
        if let fileCount, fileCount > 0 { return fileCount }
        return trackCount ?? 0
    }

    var countLabel: String {
        let total = trackCount ?? 0
        let onServer = downloadedTrackCount ?? fileCount ?? 0
        if total > 0, onServer > 0, onServer < total {
            return "\(onServer) z \(total) na serwerze"
        }
        if onServer > 0 {
            return "\(onServer) utworów na serwerze"
        }
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
    let quality: String?
    let source: String?
    let previewUrl: String?
    let artistId: String?
    let albumId: String?
    let trackNumber: Int?
    let downloadJobId: String?
    let downloadedAt: Double?
    let addedAt: Double?

    var isDownloaded: Bool {
        guard let downloadJobId, !downloadJobId.isEmpty else { return false }
        return true
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
    let ok: Bool?
    let folder: MusicFolder
}

enum MusicSort: String, CaseIterable, Identifiable {
    case relevance = "relevance"
    case title = "title"
    case duration = "duration"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .relevance: return "Trafność"
        case .title: return "Tytuł A–Z"
        case .duration: return "Najdłuższe"
        }
    }
}

enum SearchSort: String, CaseIterable, Identifiable {
    case relevance = "relevance"
    case duration = "duration"
    case title = "title"
    case premiumFirst = "premium_first"
    case freeFirst = "free_first"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .relevance: return "Trafność"
        case .duration: return "Najdłuższe"
        case .title: return "Tytuł A–Z"
        case .premiumFirst: return "Premium pierwsze"
        case .freeFirst: return "Darmowe pierwsze"
        }
    }

    static func options(for source: SearchSource) -> [SearchSort] {
        switch source {
        case .cda, .all:
            return allCases
        default:
            return [.relevance, .duration, .title]
        }
    }
}

enum CdaAccessFilter: String, CaseIterable, Identifiable {
    case all = "all"
    case free = "free"
    case premium = "premium"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "Wszystkie"
        case .free: return "Darmowe"
        case .premium: return "Premium"
        }
    }
}

enum SearchSource: String, CaseIterable, Identifiable {
    case all = "all"
    case tvp = "tvp"
    case cda = "cda"
    case cdaHd = "cda-hd"
    case youtube = "youtube"
    case appleMusic = "apple-music"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "Wszystkie"
        case .tvp: return "TVP VOD"
        case .cda: return "CDA"
        case .cdaHd: return "CDA-HD"
        case .youtube: return "YouTube"
        case .appleMusic: return "Apple Music"
        }
    }

    var systemImage: String? {
        switch self {
        case .all: return "square.grid.2x2.fill"
        case .appleMusic: return "music.note.list"
        default: return nil
        }
    }
}

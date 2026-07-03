import Foundation

enum AppConfig {
    /// Produkcja — NOSTALGIE™ Movies API (ten sam backend co panel www).
    static let apiBaseURL = URL(string: "https://lineage.mycloudnas.com/admin_pro/api/movies/proxy")!
    static let keychainService = "pl.nostalgie.movies.auth"
    static let keychainAccount = "session"
    static let appName = "NOSTALGIE™ MOVIES"
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
    let createdAt: Double?
    let updatedAt: Double?
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
    let addedAt: Double?
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

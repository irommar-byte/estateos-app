import Foundation

typealias FilmsCatalogMode = OnlineMoviesCatalogMode
typealias FilmsCatalogKind = OnlineMoviesCatalogKind

enum OnlineMoviesCatalogMode: String, CaseIterable, Identifiable {
    case all = "all"
    case latest = "latest"
    case topRated = "top-rated"
    case mostPlayed = "most-played"
    case longest = "longest"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "Wszystkie"
        case .latest: return "Najnowsze"
        case .topRated: return "Najlepiej oceniane"
        case .mostPlayed: return "Popularne"
        case .longest: return "Najdłuższe"
        }
    }
}

enum OnlineMoviesCatalogKind: String, CaseIterable, Identifiable {
    case all = "all"
    case film = "film"
    case serial = "serial"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "Wszystko"
        case .film: return "Filmy"
        case .serial: return "Seriale"
        }
    }
}

struct FilmsHomeShelf: Codable, Identifiable, Hashable {
    let id: String
    let source: String
    let title: String
    let subtitle: String?
    let items: [SearchResultItem]
    let catalogMode: String?
    let catalogType: String?
    let browseUrl: String?
    let searchQuery: String?
    let cached: Bool?
}

struct FilmsHomeResponse: Codable {
    let ok: Bool?
    let generatedAt: String?
    let shelves: [FilmsHomeShelf]
}

struct CdaHdCatalogResponse: Codable {
    let mode: String?
    let type: String?
    let source: String?
    let page: Int
    let pageSize: Int
    let totalPages: Int?
    let totalItems: Int?
    let hasMore: Bool?
    let items: [SearchResultItem]
    let cached: Bool?
    let stale: Bool?
}

struct SearchResponse: Codable {
    let query: String?
    let source: String?
    let sort: String?
    let results: [SearchResultItem]
    let page: Int?
    let pageSize: Int?
    let total: Int?
    let totalPages: Int?
    let hasMore: Bool?

    enum CodingKeys: String, CodingKey {
        case query, source, sort, results, items, page, pageSize, total, totalPages, hasMore
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        query = try c.decodeIfPresent(String.self, forKey: .query)
        source = try c.decodeIfPresent(String.self, forKey: .source)
        sort = try c.decodeIfPresent(String.self, forKey: .sort)
        if let results = try c.decodeIfPresent([SearchResultItem].self, forKey: .results) {
            self.results = results
        } else {
            self.results = try c.decodeIfPresent([SearchResultItem].self, forKey: .items) ?? []
        }
        page = try c.decodeIfPresent(Int.self, forKey: .page)
        pageSize = try c.decodeIfPresent(Int.self, forKey: .pageSize)
        total = try c.decodeIfPresent(Int.self, forKey: .total)
        totalPages = try c.decodeIfPresent(Int.self, forKey: .totalPages)
        hasMore = try c.decodeIfPresent(Bool.self, forKey: .hasMore)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(query, forKey: .query)
        try c.encodeIfPresent(source, forKey: .source)
        try c.encodeIfPresent(sort, forKey: .sort)
        try c.encode(results, forKey: .results)
        try c.encodeIfPresent(page, forKey: .page)
        try c.encodeIfPresent(pageSize, forKey: .pageSize)
        try c.encodeIfPresent(total, forKey: .total)
        try c.encodeIfPresent(totalPages, forKey: .totalPages)
        try c.encodeIfPresent(hasMore, forKey: .hasMore)
    }
}

struct MovieDownload: Codable, Identifiable, Hashable {
    var id: String { url }
    let url: String
    let title: String
    let thumbnail: String?
    let source: String?
    let downloadJobId: String?
    let filename: String?
    let downloadedAt: Double?

    var isDownloaded: Bool {
        guard let downloadJobId, !downloadJobId.isEmpty else { return false }
        return true
    }

    var isOnServer: Bool { isDownloaded }

    var artworkURL: URL? {
        guard let thumbnail, !thumbnail.isEmpty else { return nil }
        return URL(string: thumbnail)
    }
}

struct MovieDownloadsResponse: Codable {
    let folder: String?
    let downloads: [MovieDownload]
}

struct MoviePlayTokenResponse: Codable {
    let jobId: String
    let token: String
    let expiresIn: Int?
}

struct CdaHdLink: Codable, Hashable, Identifiable {
    var id: String { url }
    let name: String
    let url: String
}

struct CdaHdRating: Codable, Hashable {
    let value: Double?
    let max: Double?
    let votes: Int?
    let barPercent: Double?
}

struct CdaHdMeta: Codable, Hashable {
    let title: String?
    let subtitle: String?
    let originalTitle: String?
    let description: String?
    let status: String?
    let year: Int?
    let duration: Double?
    let country: String?
    let thumbnail: String?
    let genres: [CdaHdLink]?
    let director: CdaHdLink?
    let creators: [CdaHdLink]?
    let cast: [CdaHdLink]?
    let networks: [CdaHdLink]?
    let studios: [CdaHdLink]?
    let firstAirDate: String?
    let lastAirDate: String?
    let seasonCount: Int?
    let episodeCount: Int?
    let rating: CdaHdRating?
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

struct MediaQualityOption: Codable, Hashable, Identifiable {
    let id: String
    let label: String
    let detail: String?
    let sizeBytes: Int?
    let sizeLabel: String?
    let height: Int?
    let bitrate: Int?

    var isBest: Bool { id == "best" }
}

struct MediaAudioOptions: Codable, Hashable {
    let options: [MediaQualityOption]?
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
    let source: String?
    let quality: String?
    let cdaHd: CdaHdMeta?
    let episodeCount: Int?
    let seasons: [SeasonInfo]?
    let episodes: [EpisodeItem]?
    let videoOptions: [MediaQualityOption]?
    let audioOptions: MediaAudioOptions?

    var playableEpisodes: [EpisodeItem] {
        if let seasons, !seasons.isEmpty {
            return seasons.flatMap { $0.episodes ?? [] }
        }
        return episodes ?? []
    }

    var isSeries: Bool {
        if isSeasoned == true { return true }
        if !(seasons ?? []).isEmpty { return true }
        if !(episodes ?? []).isEmpty { return true }
        return false
    }
}

struct OnlineMovieSelection: Identifiable, Hashable {
    var id: String { url }
    let title: String
    let url: String
    let thumbnail: String?
    let source: String?
    let detail: String?
    let duration: Double?
    let isSerial: Bool

    init(item: SearchResultItem) {
        title = item.title
        url = item.url
        thumbnail = item.thumbnail
        source = item.source ?? "cda-hd"
        detail = item.detail
        duration = item.duration
        isSerial = item.looksLikeSeries
    }

    init(download: MovieDownload) {
        title = download.title
        url = download.url
        thumbnail = download.thumbnail
        source = download.source ?? "cda-hd"
        detail = nil
        duration = nil
        isSerial = false
    }

    init(episode: EpisodeItem, source: String? = "cda-hd") {
        title = episode.title
        url = episode.url
        thumbnail = episode.thumbnail
        self.source = source
        detail = nil
        duration = episode.duration
        isSerial = false
    }
}

enum OnlineMovieTransferState: Equatable {
    case idle
    case onServer
    case acquiringServer(progress: Double)
    case downloadingPhone(progress: Double)
    case onPhone
    case failed(String)

    var isBusy: Bool {
        switch self {
        case .acquiringServer, .downloadingPhone: return true
        default: return false
        }
    }

    var progressPercent: Double {
        switch self {
        case .acquiringServer(let p), .downloadingPhone(let p): return p
        default: return 0
        }
    }
}

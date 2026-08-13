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

    /// Ścieżka względem MOVIES/ na serwerze, np. `Sherlock/Sezon 1/epizod.mp4`.
    var serverRelativePath: String? {
        guard let filename, !filename.isEmpty else { return nil }
        return filename
    }

    var seriesFolderName: String? {
        guard let path = serverRelativePath, path.contains("/") else { return nil }
        return path.split(separator: "/").first.map(String.init)
    }

    var seasonFolderName: String? {
        guard let path = serverRelativePath else { return nil }
        let parts = path.split(separator: "/").map(String.init)
        guard parts.count >= 2 else { return nil }
        return parts[1]
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

struct PreviewResponse: Codable {
    let jobId: String
    let instant: Bool?
    let mode: String?
    let purpose: String?
}

struct PlayTokenResponse: Codable {
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

    enum CodingKeys: String, CodingKey {
        case id, label, detail, sizeBytes, sizeLabel, height, bitrate
    }

    init(
        id: String,
        label: String,
        detail: String? = nil,
        sizeBytes: Int? = nil,
        sizeLabel: String? = nil,
        height: Int? = nil,
        bitrate: Int? = nil
    ) {
        self.id = id
        self.label = label
        self.detail = detail
        self.sizeBytes = sizeBytes
        self.sizeLabel = sizeLabel
        self.height = height
        self.bitrate = bitrate
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        label = try c.decode(String.self, forKey: .label)
        detail = try c.decodeIfPresent(String.self, forKey: .detail)
        sizeBytes = try c.decodeIfPresent(Int.self, forKey: .sizeBytes)
        sizeLabel = try c.decodeIfPresent(String.self, forKey: .sizeLabel)
        if let h = try? c.decode(Int.self, forKey: .height) {
            height = h
        } else {
            _ = try? c.decode(String.self, forKey: .height)
            height = nil
        }
        if let b = try? c.decode(Int.self, forKey: .bitrate) {
            bitrate = b
        } else {
            _ = try? c.decode(String.self, forKey: .bitrate)
            bitrate = nil
        }
    }

    static func defaultStreamTiers(duration: Double?) -> [MediaQualityOption] {
        let dur = (duration ?? 0) > 0 ? duration! : 45 * 60
        func estLabel(_ kbps: Int) -> String {
            let bytes = Double(kbps) * 1000 * dur / 8
            return "\(MediaByteFormat.label(bytes: Int(bytes))) ~"
        }
        return [
            MediaQualityOption(id: "best", label: "Najlepsza", detail: "Auto", sizeLabel: estLabel(5000)),
            MediaQualityOption(id: "1080", label: "1080p", detail: "Full HD", sizeLabel: estLabel(5000), height: 1080),
            MediaQualityOption(id: "720", label: "720p", detail: "HD", sizeLabel: estLabel(2800), height: 720),
            MediaQualityOption(id: "480", label: "480p", detail: "SD", sizeLabel: estLabel(1200), height: 480),
        ]
    }

    static func apiHeight(for option: MediaQualityOption, options: [MediaQualityOption]) -> Int {
        if option.isBest { return options.compactMap(\.height).max() ?? 720 }
        return option.height ?? 720
    }

    func estimatedBytes(duration: Double) -> Int {
        if let sizeBytes, sizeBytes > 0 { return sizeBytes }
        let seconds = max(duration, 60)
        let kbps: Int
        if let height {
            kbps = height >= 1080 ? 5000 : height >= 720 ? 2800 : 1200
        } else if isBest {
            kbps = 5000
        } else {
            kbps = 2800
        }
        return Int(Double(kbps) * 1000 * seconds / 8)
    }

    func totalEstimateLabel(itemCount: Int, totalDuration: Double) -> String {
        guard itemCount > 0 else { return "—" }
        let perItem = totalDuration > 0 ? totalDuration / Double(itemCount) : 45 * 60
        let bytes = estimatedBytes(duration: perItem) * itemCount
        return "\(MediaByteFormat.label(bytes: bytes)) ~"
    }

    var displaySizeLabel: String {
        if let sizeLabel, !sizeLabel.isEmpty { return sizeLabel }
        if let sizeBytes, sizeBytes > 0 { return MediaByteFormat.label(bytes: sizeBytes) }
        return "—"
    }
}

enum MediaByteFormat {
    static func label(bytes: Int) -> String {
        let value = Double(max(bytes, 0))
        if value >= 1_073_741_824 { return String(format: "%.1f GB", value / 1_073_741_824) }
        if value >= 1_048_576 { return String(format: "%.0f MB", value / 1_048_576) }
        if value >= 1024 { return String(format: "%.0f KB", value / 1024) }
        return "\(bytes) B"
    }
}

struct MediaDownloadFormat: Identifiable, Hashable {
    let id: String
    let kind: String
    let container: String
    let label: String

    static let videoMP4 = MediaDownloadFormat(id: "mp4", kind: "video", container: "mp4", label: "Wideo · MP4")
    static let videoWebM = MediaDownloadFormat(id: "webm", kind: "video", container: "webm", label: "Wideo · WebM")
    static let videoMKV = MediaDownloadFormat(id: "mkv", kind: "video", container: "mkv", label: "Wideo · MKV")
    static let audioMP3 = MediaDownloadFormat(id: "mp3", kind: "audio", container: "mp3", label: "Audio · MP3")
    static let audioM4A = MediaDownloadFormat(id: "m4a", kind: "audio", container: "m4a", label: "Audio · M4A")
}

struct MediaAudioOptions: Codable, Hashable {
    let mp3: [MediaQualityOption]?
    let m4a: [MediaQualityOption]?
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

extension VideoInfoResponse {
    var effectiveStreamOptions: [MediaQualityOption] {
        if let videoOptions, !videoOptions.isEmpty { return videoOptions }
        return MediaQualityOption.defaultStreamTiers(duration: duration)
    }

    var availableDownloadFormats: [MediaDownloadFormat] {
        if isMusicTrack == true { return [.audioMP3] }
        var formats: [MediaDownloadFormat] = [.videoMP4, .videoWebM, .videoMKV]
        if let mp3 = audioOptions?.mp3, !mp3.isEmpty { formats.append(.audioMP3) }
        if let m4a = audioOptions?.m4a, !m4a.isEmpty { formats.append(.audioM4A) }
        return formats
    }

    func qualityOptions(for format: MediaDownloadFormat) -> [MediaQualityOption] {
        switch format.kind {
        case "audio":
            if format.container == "m4a" { return audioOptions?.m4a ?? [] }
            return audioOptions?.mp3 ?? []
        default:
            return effectiveStreamOptions
        }
    }

    func defaultDownloadSelection() -> (format: MediaDownloadFormat, quality: MediaQualityOption) {
        let format = availableDownloadFormats.first ?? .videoMP4
        let qualities = qualityOptions(for: format)
        let quality = qualities.first(where: { $0.id == "720" })
            ?? qualities.first(where: { $0.isBest })
            ?? qualities.first
            ?? MediaQualityOption(id: "720", label: "720p", height: 720)
        return (format, quality)
    }
}

enum OnlineMovieDownloadDestination: Equatable {
    case server
    case serverAndPhone
}

/// Tytuł pliku na serwerze: `Serial · Sezon N · Odcinek` → folder `Serial/Sezon N/`.
func serverDownloadTitle(seriesTitle: String, episode: EpisodeItem) -> String {
    let show = seriesTitle.trimmingCharacters(in: .whitespacesAndNewlines)
    let ep = episode.title.trimmingCharacters(in: .whitespacesAndNewlines)
    if let sn = episode.seasonNumber, sn > 0 {
        return "\(show) · Sezon \(sn) · \(ep)"
    }
    return "\(show) · \(ep)"
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

    init(
        title: String,
        url: String,
        thumbnail: String?,
        source: String?,
        detail: String?,
        duration: Double?,
        isSerial: Bool
    ) {
        self.title = title
        self.url = url
        self.thumbnail = thumbnail
        self.source = source
        self.detail = detail
        self.duration = duration
        self.isSerial = isSerial
    }

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

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

extension FavoriteItem {
    var isMusicFavorite: Bool {
        let t = type.lowercased()
        if t == "music" || t == "track" || t == "song" || t == "album" || t == "artist" {
            return true
        }
        let s = (source ?? "").lowercased()
        if s.contains("apple") { return true }
        return url.localizedCaseInsensitiveContains("music.apple.com")
    }

    var mediaTypeLabel: String {
        if isMusicFavorite { return "MUZYKA" }
        if type == "series" { return "SERIAL" }
        return "FILM"
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
    let quality: String?
    let rating: Double?
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
    let isMirror: Bool?
    let mirrorSite: String?
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
    let episodeRuntime: String?
    let showType: String?
    let photos: [String]?
    let seasonCount: Int?
    let episodeCount: Int?
    let rating: CdaHdRating?
}

struct CdaHdBrowseResponse: Codable {
    let title: String
    let pageUrl: String
    let page: Int?
    let pageSize: Int?
    let hasMore: Bool?
    let items: [SearchResultItem]
}

struct CdaHdBrowseContext: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let pageURL: String
}

enum CdaHdCatalogMode: String, CaseIterable, Identifiable {
    case latest
    case topRated = "top-rated"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .latest: return "Najnowsze"
        case .topRated: return "Najlepiej oceniane"
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
    let cached: Bool?
}

struct FilmsHomeResponse: Codable {
    let ok: Bool?
    let generatedAt: String?
    let shelves: [FilmsHomeShelf]
}

struct CdaHdCatalogResponse: Codable {
    let mode: String
    let page: Int
    let pageSize: Int
    let totalPages: Int?
    let totalItems: Int
    let hasMore: Bool?
    let items: [SearchResultItem]
    let cached: Bool?
    let stale: Bool?
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

struct MediaQualityOption: Codable, Hashable, Identifiable {
    let id: String
    let label: String
    let detail: String?
    let sizeBytes: Int?
    let sizeLabel: String?
    let height: Int?
    let bitrate: Int?

    var isBest: Bool { id == "best" }

    var displaySubtitle: String {
        [detail, sizeLabel].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

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
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        label = try container.decode(String.self, forKey: .label)
        detail = try container.decodeIfPresent(String.self, forKey: .detail)
        sizeBytes = try container.decodeIfPresent(Int.self, forKey: .sizeBytes)
        sizeLabel = try container.decodeIfPresent(String.self, forKey: .sizeLabel)
        if let numericBitrate = try? container.decode(Int.self, forKey: .bitrate) {
            bitrate = numericBitrate
        } else {
            _ = try? container.decode(String.self, forKey: .bitrate)
            bitrate = nil
        }
        if let numericHeight = try? container.decode(Int.self, forKey: .height) {
            height = numericHeight
        } else {
            _ = try? container.decode(String.self, forKey: .height)
            height = nil
        }
    }

    static func defaultStreamTiers(duration: Double?) -> [MediaQualityOption] {
        let dur = (duration ?? 0) > 0 ? duration! : 45 * 60
        func estLabel(_ kbps: Int) -> String {
            let bytes = Double(kbps) * 1000 * dur / 8
            if bytes >= 1_073_741_824 { return String(format: "%.1f GB ~", bytes / 1_073_741_824) }
            if bytes >= 1_048_576 { return String(format: "%.0f MB ~", bytes / 1_048_576) }
            return String(format: "%.0f KB ~", bytes / 1024)
        }
        return [
            MediaQualityOption(id: "best", label: "Najlepsza", detail: "Auto", sizeLabel: estLabel(5000)),
            MediaQualityOption(id: "1080", label: "1080p", detail: "Full HD", sizeLabel: estLabel(5000), height: 1080),
            MediaQualityOption(id: "720", label: "720p", detail: "HD", sizeLabel: estLabel(2800), height: 720),
            MediaQualityOption(id: "480", label: "480p", detail: "SD", sizeLabel: estLabel(1200), height: 480),
        ]
    }

    static func apiHeight(for option: MediaQualityOption, options: [MediaQualityOption]) -> Int {
        if option.isBest {
            return options.compactMap(\.height).max() ?? 720
        }
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
        let perItemDuration = totalDuration > 0 ? totalDuration / Double(itemCount) : 45 * 60
        let bytes = estimatedBytes(duration: perItemDuration) * itemCount
        return "\(MediaByteFormat.label(bytes: bytes)) ~"
    }
}

enum MediaByteFormat {
    static func label(bytes: Int) -> String {
        let value = Double(max(bytes, 0))
        if value >= 1_073_741_824 {
            return String(format: "%.1f GB", value / 1_073_741_824)
        }
        if value >= 1_048_576 {
            return String(format: "%.0f MB", value / 1_048_576)
        }
        if value >= 1024 {
            return String(format: "%.0f KB", value / 1024)
        }
        return "\(bytes) B"
    }
}

struct MediaAudioOptions: Codable, Hashable {
    let mp3: [MediaQualityOption]?
    let m4a: [MediaQualityOption]?
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

extension VideoInfoResponse {
    var effectiveStreamOptions: [MediaQualityOption] {
        if let videoOptions, !videoOptions.isEmpty { return videoOptions }
        return MediaQualityOption.defaultStreamTiers(duration: duration)
    }

    var availableDownloadFormats: [MediaDownloadFormat] {
        if isMusicTrack == true {
            return [.audioMP3]
        }
        var formats: [MediaDownloadFormat] = [.videoMP4]
        if isMirror != true {
            formats.append(contentsOf: [.videoWebM, .videoMKV])
        }
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

    func defaultStreamQualityID() -> String {
        if effectiveStreamOptions.contains(where: { $0.id == "720" }) { return "720" }
        if let best = effectiveStreamOptions.first(where: { $0.isBest }) { return best.id }
        return effectiveStreamOptions.first?.id ?? "720"
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

struct MediaPlaybackContext: Identifiable {
    let id = UUID()
    let sourceURL: String
    let title: String
    let streamOptions: [MediaQualityOption]
    var session: PlaybackSession
    var selectedQualityID: String
}

struct PlaybackSession: Identifiable, Hashable {
    let jobId: String
    let streamURL: URL
    let token: String

    var id: String { jobId }
}

struct DownloadStartResponse: Codable {
    let jobId: String
    let reused: Bool?
    let ready: Bool?
    let status: String?
    let progress: Double?
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
}

struct MovieDownloadsResponse: Codable {
    let folder: String
    let downloads: [MovieDownload]
}

struct DownloadedMediaFolder: Identifiable, Hashable {
    enum Kind: String, Hashable {
        case film
        case series
    }

    let id: String
    let title: String
    let thumbnail: String?
    let source: String?
    let items: [MovieDownload]
    let kind: Kind

    var artworkURL: URL? {
        thumbnail.flatMap(URL.init(string:))
    }

    var countLabel: String {
        switch kind {
        case .film:
            return "Film · offline"
        case .series:
            return "\(items.count) odcinków · offline"
        }
    }

    var isSeries: Bool { kind == .series }
}

enum DownloadedMediaLibrary {
    private static let episodeSeparator = " · "

    static func folders(from downloads: [MovieDownload]) -> [DownloadedMediaFolder] {
        var seriesGroups: [String: [MovieDownload]] = [:]
        var films: [MovieDownload] = []

        for download in downloads where download.isDownloaded {
            if let range = download.title.range(of: episodeSeparator) {
                let seriesName = String(download.title[..<range.lowerBound]).trimmingCharacters(in: .whitespaces)
                seriesGroups[seriesName, default: []].append(download)
            } else {
                films.append(download)
            }
        }

        var folders: [DownloadedMediaFolder] = []

        for (name, items) in seriesGroups {
            let sorted = items.sorted { lhs, rhs in
                displayEpisodeTitle(for: lhs).localizedStandardCompare(displayEpisodeTitle(for: rhs)) == .orderedAscending
            }
            folders.append(
                DownloadedMediaFolder(
                    id: "series:\(name)",
                    title: name,
                    thumbnail: sorted.compactMap(\.thumbnail).first,
                    source: sorted.compactMap(\.source).first,
                    items: sorted,
                    kind: .series
                )
            )
        }

        for film in films.sorted(by: { $0.title.localizedStandardCompare($1.title) == .orderedAscending }) {
            folders.append(
                DownloadedMediaFolder(
                    id: "film:\(film.url)",
                    title: film.title,
                    thumbnail: film.thumbnail,
                    source: film.source,
                    items: [film],
                    kind: .film
                )
            )
        }

        return folders.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }

    static func displayEpisodeTitle(for download: MovieDownload) -> String {
        if let range = download.title.range(of: episodeSeparator) {
            return String(download.title[range.upperBound...]).trimmingCharacters(in: .whitespaces)
        }
        return download.title
    }
}

struct MoviePlayTokenResponse: Codable {
    let jobId: String
    let token: String
    let expiresIn: Int?
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

    /// Filmy / seriale — bez Apple Music (to osobna zakładka Muzyka).
    static var filmCases: [SearchSource] {
        [.all, .tvp, .cda, .cdaHd, .youtube]
    }

    var label: String {
        switch self {
        case .all: return "Wszystkie filmy"
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

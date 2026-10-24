import Foundation

/// Marka katalogu filmów online w UI (bez ujawniania źródła backendu).
enum EOSLibraryBrand {
    static let displayName = "EOS™LIBRARY"

    static func sanitize(_ text: String) -> String {
        text
            .replacingOccurrences(of: "CDA-HD", with: displayName, options: .caseInsensitive)
            .replacingOccurrences(of: "CDA HD", with: displayName, options: .caseInsensitive)
            .replacingOccurrences(of: "cda-hd", with: displayName, options: .caseInsensitive)
    }
}

typealias FilmsCatalogMode = OnlineMoviesCatalogMode
typealias FilmsCatalogKind = OnlineMoviesCatalogKind

/// Porównywanie URL odcinków / filmów (CDA-HD bywa z `-online`, `/` na końcu, www).
enum MovieURLMatching {
    static func normalizedKey(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard var components = URLComponents(string: trimmed) else {
            return trimmed.lowercased()
        }
        components.scheme = "https"
        components.host = components.host?
            .lowercased()
            .replacingOccurrences(of: #"^www\."#, with: "", options: .regularExpression)
        components.query = nil
        components.fragment = nil
        components.user = nil
        components.password = nil
        var path = components.path.lowercased()
        while path.count > 1, path.hasSuffix("/") {
            path.removeLast()
        }
        if path.hasSuffix("-online") {
            path = String(path.dropLast("-online".count))
        }
        components.path = path
        let host = components.host ?? ""
        return host.isEmpty ? path : "\(host)\(path)"
    }

    static func urlsMatch(_ lhs: String, _ rhs: String) -> Bool {
        guard !lhs.isEmpty, !rhs.isEmpty else { return false }
        if lhs == rhs { return true }
        return normalizedKey(lhs) == normalizedKey(rhs)
    }

    /// `/episode/westworld-sezon-1-odcinek-1-online` → `/tvshows/westworld/`
    static func inferredSeriesPageURL(from episodeURL: String) -> String? {
        guard let url = URL(string: episodeURL) else { return nil }
        let path = url.path.lowercased()
        guard path.contains("/episode/") else { return nil }
        guard var slug = path.split(separator: "/").last.map(String.init), !slug.isEmpty else { return nil }
        if slug.hasSuffix("-online") {
            slug = String(slug.dropLast("-online".count))
        }
        if let range = slug.range(of: #"-sezon-\d+"#, options: .regularExpression) {
            slug = String(slug[..<range.lowerBound])
        }
        slug = slug.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        guard !slug.isEmpty else { return nil }
        var components = URLComponents()
        components.scheme = url.scheme ?? "https"
        components.host = url.host
        components.path = "/tvshows/\(slug)/"
        return components.string
    }

    static func download(
        matching url: String,
        title: String? = nil,
        in downloads: [MovieDownload]
    ) -> MovieDownload? {
        if let exact = downloads.first(where: { urlsMatch($0.url, url) && $0.hasLandedFile }) {
            return exact
        }
        if let linked = downloads.first(where: { urlsMatch($0.url, url) && $0.hasPlayableJob }) {
            return linked
        }
        guard let distinctive = distinctiveEpisodeName(title), distinctive.count >= 8 else { return nil }
        let hits = downloads.filter { download in
            guard download.hasLandedFile || download.hasPlayableJob else { return false }
            let hay = foldedToken("\(download.title) \(download.filename ?? "")")
            return hay.contains(distinctive)
        }
        return hits.count == 1 ? hits[0] : nil
    }

    /// "Odcinek Trace Decay" / "Westworld · Sezon 1 · Trace Decay" → "trace decay"
    static func distinctiveEpisodeName(_ title: String?) -> String? {
        guard var text = title?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              text.count >= 6 else { return nil }
        if let last = text.split(separator: "·").last {
            text = last.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        text = text.replacingOccurrences(of: #"^odcinek\s+"#, with: "", options: .regularExpression)
        text = text.replacingOccurrences(of: #"^episode\s+"#, with: "", options: .regularExpression)
        let folded = foldedToken(text)
        return folded.count >= 8 ? folded : nil
    }

    static func foldedToken(_ text: String) -> String {
        text.lowercased()
            .replacingOccurrences(of: #"[^a-z0-9]+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

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

struct CdaHdBrowseResponse: Codable {
    let title: String?
    let pageUrl: String?
    let page: Int?
    let pageSize: Int?
    let items: [SearchResultItem]
    let hasMore: Bool?
}

enum MovieBrowseOrdering {
    enum Mode: String, CaseIterable, Identifiable {
        case newest
        case topRated

        var id: String { rawValue }

        var title: String {
            switch self {
            case .newest: return "Najnowsze"
            case .topRated: return "Najlepiej oceniane"
            }
        }
    }

    static func ordered(_ items: [SearchResultItem], mode: Mode) -> [SearchResultItem] {
        items.enumerated().sorted { lhs, rhs in
            switch mode {
            case .newest:
                let leftYear = lhs.element.releaseYear ?? -1
                let rightYear = rhs.element.releaseYear ?? -1
                if leftYear != rightYear { return leftYear > rightYear }
            case .topRated:
                let leftRating = lhs.element.rating ?? -1
                let rightRating = rhs.element.rating ?? -1
                if leftRating != rightRating { return leftRating > rightRating }
                let leftYear = lhs.element.releaseYear ?? -1
                let rightYear = rhs.element.releaseYear ?? -1
                if leftYear != rightYear { return leftYear > rightYear }
            }
            return lhs.offset < rhs.offset
        }.map(\.element)
    }
}

enum CdaHdBrowseLink {
    static func releaseYearURL(year: Int, referenceURL: String? = nil) -> String {
        var base = "https://cda-hd.cc"
        if let referenceURL,
           let url = URL(string: referenceURL),
           let scheme = url.scheme,
           let host = url.host {
            base = "\(scheme)://\(host)"
        }
        return "\(base)/release-year/\(year)/"
    }

    static func year(in title: String) -> Int? {
        guard let match = title.range(of: #"\((19|20)\d{2}\)"#, options: .regularExpression) else { return nil }
        return Int(title[match].dropFirst().dropLast())
    }
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

struct MovieSearchFacet: Codable, Identifiable, Hashable {
    var id: String { url }
    let name: String
    let url: String
    var role: String? = nil
    var thumbnail: String? = nil
    var year: Int? = nil
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
    let people: [MovieSearchFacet]
    let genres: [MovieSearchFacet]
    let years: [MovieSearchFacet]

    enum CodingKeys: String, CodingKey {
        case query, source, sort, results, items, page, pageSize, total, totalPages, hasMore, people, genres, years
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
        people = try c.decodeIfPresent([MovieSearchFacet].self, forKey: .people) ?? []
        genres = try c.decodeIfPresent([MovieSearchFacet].self, forKey: .genres) ?? []
        years = try c.decodeIfPresent([MovieSearchFacet].self, forKey: .years) ?? []
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
        try c.encode(people, forKey: .people)
        try c.encode(genres, forKey: .genres)
        try c.encode(years, forKey: .years)
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
    /// Rozmiar pliku na serwerze (bajty) — z `/api/movies/downloads`.
    let bytes: Int?

    var isDownloaded: Bool { hasLandedFile }

    /// Real file on EOS — not a job stub / queued download without bytes.
    /// Floor is high enough to reject truncated Fallout-style landings (few MB with a fake 1h moov).
    var hasLandedFile: Bool {
        if let bytes, bytes > 30_000_000 { return true }
        // Filename / downloadedAt alone is not enough — season queues marked stubs as "Pobrany".
        return false
    }

    /// Job already registered — play/token may use this even before byte count arrives.
    /// Must NOT be treated as "downloaded" for UI badges.
    var hasPlayableJob: Bool {
        guard let downloadJobId, !downloadJobId.isEmpty else { return false }
        return hasLandedFile || downloadedAt != nil || (filename?.isEmpty == false)
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

    var looksLikeEpisode: Bool {
        let path = url.lowercased()
        if path.contains("/episode/") { return true }
        if let filename, filename.localizedCaseInsensitiveContains("/Sezon ") { return true }
        let t = title.lowercased()
        return t.contains(" · sezon ") || t.contains(" · odcinek") || t.contains(" odc. ")
    }

    var favoriteItem: FavoriteItem {
        FavoriteItem(
            id: url,
            type: "movie",
            url: url,
            title: title,
            thumbnail: thumbnail,
            source: source ?? "cda-hd",
            detail: seriesFolderName,
            duration: nil
        )
    }
}

struct MovieDownloadsResponse: Codable {
    let folder: String?
    let downloads: [MovieDownload]
    let count: Int?
    let totalBytes: Int?

    var resolvedCount: Int { count ?? downloads.count }
    var resolvedTotalBytes: Int {
        if let totalBytes { return totalBytes }
        return downloads.reduce(0) { $0 + ($1.bytes ?? 0) }
    }
}

struct MoviePlayTokenResponse: Codable {
    let jobId: String
    let token: String
    let expiresIn: Int?
    let preparing: Bool?
    let playable: Bool?
    let error: String?
    let duration: Double?
}

struct PreviewResponse: Codable {
    let jobId: String
    let instant: Bool?
    let ready: Bool?
    let status: String?
    let mode: String?
    let purpose: String?

    var canPlayImmediately: Bool {
        if instant == true || ready == true { return true }
        if status?.lowercased() == "done" { return true }
        if mode == "instant" || mode == "stream-proxy" { return true }
        return false
    }
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

    func favoriteItem(seriesTitle: String) -> FavoriteItem {
        FavoriteItem(
            id: url,
            type: "movie",
            url: url,
            title: serverDownloadTitle(seriesTitle: seriesTitle, episode: self),
            thumbnail: thumbnail,
            source: "cda-hd",
            detail: seriesTitle,
            duration: duration
        )
    }
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

    /// Mirror pages used to invent 1080p/720p/480p from a fixed bitrate. Those rows are not real variants.
    var isInventedMirrorTier: Bool {
        MovieDownloadQualityPolicy.isInventedMirrorTier(detail: detail)
    }

    /// Size the server measured or derived from the real stream bitrate. Never a fixed 5 Mb/s guess.
    func knownSizeLabel(itemCount: Int, singleItemDuration: Double, totalDuration: Double) -> String? {
        guard !isInventedMirrorTier, let sizeBytes, sizeBytes > 0 else { return nil }
        let approximate = sizeLabel?.hasPrefix("ok.") == true
        let bytes: Int
        if itemCount > 1, singleItemDuration > 0, totalDuration > 0 {
            bytes = Int((Double(sizeBytes) * totalDuration / singleItemDuration).rounded())
        } else if itemCount > 1 {
            return nil
        } else {
            bytes = sizeBytes
        }
        let number = MediaByteFormat.label(bytes: bytes)
        return approximate ? "ok. \(number)" : number
    }

    var displaySizeLabel: String {
        if isInventedMirrorTier { return "—" }
        if let sizeLabel, !sizeLabel.isEmpty { return sizeLabel }
        if let sizeBytes, sizeBytes > 0 { return MediaByteFormat.label(bytes: sizeBytes) }
        return "—"
    }
}

enum MovieDownloadQualityPolicy {
    static func isInventedMirrorTier(detail: String?) -> Bool {
        let text = (detail ?? "").lowercased()
        return text.contains("szacunek") && text.contains("mirror")
    }

    static func offersDistinctVideoQuality(_ options: [MediaQualityOption]) -> Bool {
        let heights = Set(options.compactMap(\.height).filter { $0 > 0 })
        return heights.count > 1
    }

    /// Downloaded amount, with the real expected total only when the server measured one.
    static func progressBytesLabel(downloaded: Int, expected: Int?) -> String {
        let done = MediaByteFormat.label(bytes: max(downloaded, 0))
        guard let expected, expected > downloaded + 1_048_576 else { return done }
        return "\(done) / \(MediaByteFormat.label(bytes: expected))"
    }
}

enum MediaByteFormat {
    static func label(bytes: Int) -> String {
        let value = Double(max(bytes, 0))
        if value >= 1_073_741_824 { return String(format: "%.2f GB", value / 1_073_741_824) }
        if value >= 1_048_576 {
            let mb = value / 1_048_576
            return mb >= 100 ? String(format: "%.0f MB", mb) : String(format: "%.1f MB", mb)
        }
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
        (videoOptions ?? []).filter { !$0.isInventedMirrorTier }
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
        let quality = qualities.max(by: { ($0.height ?? 0) < ($1.height ?? 0) })
            ?? qualities.first(where: { $0.isBest })
            ?? qualities.first
            ?? MediaQualityOption(id: "best", label: "Najlepsza dostępna")
        return (format, quality)
    }
}

enum OnlineMovieDownloadDestination: Equatable, Hashable, CaseIterable {
    case server
    case serverAndPhone

    var label: String {
        switch self {
        case .server: return "Tylko serwer EOS"
        case .serverAndPhone: return "Serwer, potem to urządzenie"
        }
    }

    var detail: String {
        switch self {
        case .server: return "Trwała kopia w MOVIES/ — odtwarzanie z serwera"
        case .serverAndPhone: return "Najpierw serwer, potem plik offline na tym iPhonie"
        }
    }

    var systemImage: String {
        switch self {
        case .server: return "server.rack"
        case .serverAndPhone: return "iphone.and.arrow.down"
        }
    }
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
        isSerial = download.looksLikeEpisode
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

    init(favorite: FavoriteItem) {
        title = favorite.title
        url = favorite.url
        thumbnail = favorite.thumbnail
        source = favorite.source ?? "cda-hd"
        detail = favorite.detail
        duration = favorite.duration
        let path = favorite.url.lowercased()
        isSerial = path.contains("/tvshows/") || path.contains("/episode/")
    }

    var favoriteItem: FavoriteItem {
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

import Foundation

let videoExtensions: Set<String> = [
    "mkv", "avi", "mp4", "mov", "m4v", "wmv", "flv", "webm",
    "ts", "m2ts", "mpg", "mpeg", "vob", "3gp", "ogv", "rmvb"
]

func isVideoFileName(_ name: String) -> Bool {
    videoExtensions.contains((name as NSString).pathExtension.lowercased())
}

/// `inbox-ABCD1234-Title` (possibly nested from repeated Open In) → `Title`
func cleanedImportedMediaTitle(from url: URL) -> String {
    var name = url.deletingPathExtension().lastPathComponent
    let pattern = #"^inbox-[A-Fa-f0-9]{8}-"#
    while let range = name.range(of: pattern, options: .regularExpression) {
        name = String(name[range.upperBound...])
    }
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? url.lastPathComponent : trimmed
}

enum VideoSourceKind: String, Codable, Hashable {
    /// Security-scoped folder from Pliki / USB / iCloud.
    case folderBookmark
    /// Single file copied into the app Documents sandbox (always readable).
    case sandboxFile
}

struct ConnectedVideoFolder: Codable, Identifiable, Hashable {
    let id: UUID
    var name: String
    var connectedAt: Date
    var kind: VideoSourceKind
    /// Security-scoped bookmark for external folders. Nil for sandbox files.
    var folderBookmark: Data?
    /// Path relative to Documents, e.g. `Wideo/Imports/<id>/film.mov`.
    var sandboxRelativePath: String?

    enum CodingKeys: String, CodingKey {
        case id, name, connectedAt, kind, folderBookmark, sandboxRelativePath
    }

    init(
        id: UUID,
        name: String,
        connectedAt: Date,
        kind: VideoSourceKind,
        folderBookmark: Data? = nil,
        sandboxRelativePath: String? = nil
    ) {
        self.id = id
        self.name = name
        self.connectedAt = connectedAt
        self.kind = kind
        self.folderBookmark = folderBookmark
        self.sandboxRelativePath = sandboxRelativePath
    }

    /// Backward-compatible decode for entries saved before `kind` existed.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        connectedAt = try c.decode(Date.self, forKey: .connectedAt)
        folderBookmark = try c.decodeIfPresent(Data.self, forKey: .folderBookmark)
        sandboxRelativePath = try c.decodeIfPresent(String.self, forKey: .sandboxRelativePath)
        if let kind = try c.decodeIfPresent(VideoSourceKind.self, forKey: .kind) {
            self.kind = kind
        } else if sandboxRelativePath != nil {
            self.kind = .sandboxFile
        } else {
            self.kind = .folderBookmark
        }
    }
}

struct VideoItem: Identifiable, Hashable {
    let id: String
    let title: String
    let relativePath: String
    let fileURL: URL?
    let fileSize: Int64?
    let folderId: UUID
    var artworkURL: URL? = nil

    var displaySubtitle: String {
        let ext = (relativePath as NSString).pathExtension.uppercased()
        if let size = fileSize, size > 0 {
            return "\(ext) · \(ByteCountFormatter.string(fromByteCount: size, countStyle: .file))"
        }
        return ext.isEmpty ? relativePath : ext
    }
}

struct VideoPlaybackSession: Hashable {
    let items: [VideoItem]
    let startIndex: Int
    let folderName: String
    var durationHint: Double? = nil
    /// Catalog URL of the movie, stable across stream tokens.
    var resumeKey: String? = nil
    /// Open already at this position. `nil` starts at the beginning.
    var startAt: Double? = nil
}

enum MovieResumePolicy {
    static let minimumSeconds = 20.0
    static let endMargin = 45.0

    static func shouldOffer(position: Double, duration: Double?) -> Bool {
        guard position >= minimumSeconds else { return false }
        if let duration, duration > 60, position >= duration - endMargin { return false }
        return true
    }

    static func clockLabel(seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded()))
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let secs = total % 60
        if hours > 0 { return String(format: "%d:%02d:%02d", hours, minutes, secs) }
        return String(format: "%d:%02d", minutes, secs)
    }
}

enum MovieResumeStore {
    private struct Entry: Codable {
        var seconds: Double
        var duration: Double
    }

    private static let key = "eos.movieResume.v1"

    static func offerSeconds(for id: String) -> Double? {
        guard let entry = load()[id] else { return nil }
        let duration = entry.duration > 1 ? entry.duration : nil
        guard MovieResumePolicy.shouldOffer(position: entry.seconds, duration: duration) else { return nil }
        return entry.seconds
    }

    static func save(id: String, seconds: Double, duration: Double) {
        guard !id.isEmpty else { return }
        var map = load()
        if MovieResumePolicy.shouldOffer(position: seconds, duration: duration > 1 ? duration : nil)
            || (seconds >= MovieResumePolicy.minimumSeconds && duration <= 1) {
            map[id] = Entry(seconds: seconds, duration: duration)
        } else if seconds < 5 || (duration > 60 && seconds >= duration - MovieResumePolicy.endMargin) {
            map.removeValue(forKey: id)
        } else {
            return
        }
        persist(map)
    }

    static func clear(id: String) {
        var map = load()
        guard map.removeValue(forKey: id) != nil else { return }
        persist(map)
    }

    private static func load() -> [String: Entry] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [:] }
        return (try? JSONDecoder().decode([String: Entry].self, from: data)) ?? [:]
    }

    private static func persist(_ map: [String: Entry]) {
        guard let data = try? JSONEncoder().encode(map) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}

struct VideoTrackOption: Identifiable, Hashable {
    let id: Int
    let index: Int32
    let title: String
    let isSelected: Bool
}

/// Profesjonalne tryby kadrowania / proporcji (layout surface + VLC aspect).
enum VideoAspectMode: String, CaseIterable, Identifiable {
    case automatic
    case fitScreen
    case fillScreen
    case stretch
    case ratio16_9
    case ratio4_3
    case ratio21_9
    case ratio2_35
    case ratio2_39
    case ratio1_1
    case ratio3_2
    case ratio9_16

    var id: String { rawValue }

    var title: String {
        switch self {
        case .automatic: return "Automatyczny"
        case .fitScreen: return "Dopasuj"
        case .fillScreen: return "Wypełnij"
        case .stretch: return "Rozciągnij"
        case .ratio16_9: return "16:9"
        case .ratio4_3: return "4:3"
        case .ratio21_9: return "21:9"
        case .ratio2_35: return "2.35:1"
        case .ratio2_39: return "2.39:1"
        case .ratio1_1: return "1:1"
        case .ratio3_2: return "3:2"
        case .ratio9_16: return "9:16"
        }
    }

    var subtitle: String {
        switch self {
        case .automatic: return "Oryginalne proporcje pliku"
        case .fitScreen: return "Cały obraz · czarne pasy gdy trzeba"
        case .fillScreen: return "Pełny ekran · może przyciąć krawędzie"
        case .stretch: return "Wymusza ekran · bez zachowania proporcji"
        case .ratio16_9: return "HDTV · YouTube · Broadcast"
        case .ratio4_3: return "Klasyczny TV · DVD"
        case .ratio21_9: return "Ultraszeroki monitor"
        case .ratio2_35: return "Kino panoramiczne"
        case .ratio2_39: return "Anamorphic scope"
        case .ratio1_1: return "Kwadrat"
        case .ratio3_2: return "Fotografia · klasyczny film"
        case .ratio9_16: return "Pion · Stories · Reels"
        }
    }

    var systemImage: String {
        switch self {
        case .automatic: return "rectangle.dashed"
        case .fitScreen: return "arrow.down.right.and.arrow.up.left"
        case .fillScreen: return "arrow.up.left.and.arrow.down.right"
        case .stretch: return "arrow.up.backward.and.arrow.down.forward"
        case .ratio16_9, .ratio21_9, .ratio2_35, .ratio2_39: return "rectangle"
        case .ratio4_3, .ratio3_2: return "rectangle.portrait"
        case .ratio1_1: return "square"
        case .ratio9_16: return "rectangle.portrait"
        }
    }

    /// Stały stosunek szerokość/wysokość ramki, albo `nil` = użyj proporcji źródła / ekranu.
    var forcedAspect: CGFloat? {
        switch self {
        case .automatic, .fitScreen, .fillScreen, .stretch: return nil
        case .ratio16_9: return 16.0 / 9.0
        case .ratio4_3: return 4.0 / 3.0
        case .ratio21_9: return 21.0 / 9.0
        case .ratio2_35: return 2.35
        case .ratio2_39: return 2.39
        case .ratio1_1: return 1.0
        case .ratio3_2: return 3.0 / 2.0
        case .ratio9_16: return 9.0 / 16.0
        }
    }

    /// Krótka etykieta HUD (np. „Wypełnij”, „16:9”).
    var hudLabel: String {
        switch self {
        case .automatic: return "Auto"
        case .fitScreen: return "Dopasuj"
        case .fillScreen: return "Wypełnij"
        case .stretch: return "Rozciągnij"
        default: return title
        }
    }

    static var fitModes: [VideoAspectMode] { [.automatic, .fitScreen, .fillScreen, .stretch] }
    static var fixedRatios: [VideoAspectMode] {
        [.ratio16_9, .ratio4_3, .ratio21_9, .ratio2_35, .ratio2_39, .ratio3_2, .ratio1_1, .ratio9_16]
    }
}

struct VideoSignalInfo: Equatable {
    var container: String = ""
    var resolution: String = ""
    var width: Int = 0
    var height: Int = 0
    var frameRate: String = ""
    var videoCodec: String = ""
    var audioCodec: String = ""
    var bitrate: String = ""
    var sourceAspect: String = ""
    var isHDR: Bool = false
    var hdrLabel: String = "HDR"
    var audioChannels: String = ""
    var isLocal: Bool = true
    var bitrateBps: Int = 0

    var hasVideo: Bool { width > 0 || !resolution.isEmpty || !videoCodec.isEmpty }

    /// Krótka nazwa kodeka do chipów (HEVC zamiast pełnego FourCC).
    var videoCodecShort: String {
        Self.shortCodec(videoCodec)
    }

    var audioCodecShort: String {
        Self.shortCodec(audioCodec)
    }

    var summaryLine: String {
        [resolution, frameRate, videoCodecShort].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    static func shortCodec(_ raw: String) -> String {
        let s = raw.lowercased()
        if s.contains("hevc") || s.contains("h.265") || s.contains("h265") || s.contains("mpeg-h") { return "HEVC" }
        if s.contains("avc") || s.contains("h.264") || s.contains("h264") || s.contains("avc1") { return "H.264" }
        if s.contains("av1") { return "AV1" }
        if s.contains("vp9") { return "VP9" }
        if s.contains("vp8") { return "VP8" }
        if s.contains("prores") { return "ProRes" }
        if s.contains("aac") { return "AAC" }
        if s.contains("ac-3") || s.contains("ac3") || s.contains("a52") { return "Dolby Digital" }
        if s.contains("eac") || s.contains("ec-3") || s.contains("e-ac") { return "Dolby Digital+" }
        if s.contains("truehd") || s.contains("mlp") { return "TrueHD" }
        if s.contains("dts") { return "DTS" }
        if s.contains("flac") { return "FLAC" }
        if s.contains("opus") { return "Opus" }
        if s.contains("mp3") || (s.contains("mpeg") && s.contains("audio")) { return "MP3" }
        if raw.count > 18 { return String(raw.prefix(16)) + "…" }
        return raw
    }
}

enum VideoPlaybackRate: Double, CaseIterable, Identifiable {
    case half = 0.5
    case threeQuarters = 0.75
    case normal = 1.0
    case oneAndQuarter = 1.25
    case oneAndHalf = 1.5
    case double = 2.0

    var id: Double { rawValue }

    var title: String {
        if rawValue == 1.0 { return "1×" }
        if rawValue == Double(Int(rawValue)) { return "\(Int(rawValue))×" }
        return String(format: "%.2g×", rawValue)
    }
}

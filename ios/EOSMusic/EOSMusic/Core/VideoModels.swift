import Foundation

let videoExtensions: Set<String> = [
    "mkv", "avi", "mp4", "mov", "m4v", "wmv", "flv", "webm",
    "ts", "m2ts", "mpg", "mpeg", "vob", "3gp", "ogv", "rmvb"
]

func isVideoFileName(_ name: String) -> Bool {
    videoExtensions.contains((name as NSString).pathExtension.lowercased())
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
}

struct VideoTrackOption: Identifiable, Hashable {
    let id: Int
    let index: Int32
    let title: String
    let isSelected: Bool
}

/// Profesjonalne tryby kadrowania / proporcji (VLC `videoAspectRatio` + UIView contentMode).
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
        case .fitScreen: return "Dopasuj do ekranu"
        case .fillScreen: return "Wypełnij ekran"
        case .stretch: return "Rozciągnij"
        case .ratio16_9: return "16:9"
        case .ratio4_3: return "4:3"
        case .ratio21_9: return "21:9"
        case .ratio2_35: return "2.35:1 (Cinema)"
        case .ratio2_39: return "2.39:1 (Scope)"
        case .ratio1_1: return "1:1"
        case .ratio3_2: return "3:2"
        case .ratio9_16: return "9:16 (pion)"
        }
    }

    var subtitle: String {
        switch self {
        case .automatic: return "Oryginalne proporcje źródła"
        case .fitScreen: return "Cały obraz, czarne pasy jeśli trzeba"
        case .fillScreen: return "Wypełnia ekran (może przyciąć)"
        case .stretch: return "Wymusza rozmiar ekranu bez zachowania proporcji"
        case .ratio16_9: return "HDTV / YouTube"
        case .ratio4_3: return "Klasyczny TV / DVD"
        case .ratio21_9: return "Ultraszeroki monitor"
        case .ratio2_35: return "Kino panoramiczne"
        case .ratio2_39: return "Anamorphic scope"
        case .ratio1_1: return "Kwadrat"
        case .ratio3_2: return "Fotografia / klasyczny film"
        case .ratio9_16: return "Stories / pionowe nagranie"
        }
    }

    var systemImage: String {
        switch self {
        case .automatic: return "aspectratio"
        case .fitScreen: return "rectangle.arrowtriangle.2.inward"
        case .fillScreen: return "rectangle.arrowtriangle.2.outward"
        case .stretch: return "arrow.up.left.and.arrow.down.right"
        case .ratio16_9, .ratio21_9, .ratio2_35, .ratio2_39: return "rectangle"
        case .ratio4_3, .ratio3_2: return "rectangle.portrait"
        case .ratio1_1: return "square"
        case .ratio9_16: return "rectangle.portrait.fill"
        }
    }

    /// VLC aspect string, or nil to reset.
    var vlcAspectRatio: String? {
        switch self {
        case .automatic, .fitScreen, .fillScreen, .stretch: return nil
        case .ratio16_9: return "16:9"
        case .ratio4_3: return "4:3"
        case .ratio21_9: return "21:9"
        case .ratio2_35: return "235:100"
        case .ratio2_39: return "239:100"
        case .ratio1_1: return "1:1"
        case .ratio3_2: return "3:2"
        case .ratio9_16: return "9:16"
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

    var hasVideo: Bool { width > 0 || !resolution.isEmpty || !videoCodec.isEmpty }

    var summaryLine: String {
        [resolution, frameRate, videoCodec].filter { !$0.isEmpty }.joined(separator: " · ")
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

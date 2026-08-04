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

enum VideoAspectMode: String, CaseIterable, Identifiable {
    case fit
    case fill

    var id: String { rawValue }

    var title: String {
        switch self {
        case .fit: return "Dopasuj"
        case .fill: return "Wypełnij"
        }
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

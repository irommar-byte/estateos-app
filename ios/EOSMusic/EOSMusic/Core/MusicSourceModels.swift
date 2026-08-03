import Foundation

enum MusicSourceKind: String, Codable, CaseIterable, Identifiable {
    case localFolder
    case iCloudDrive
    case googleDrive
    case qnap

    var id: String { rawValue }

    var title: String {
        switch self {
        case .localFolder: return "Lokalny folder"
        case .iCloudDrive: return "iCloud Drive"
        case .googleDrive: return "Google Drive"
        case .qnap: return "QNAP"
        }
    }

    var subtitle: String {
        switch self {
        case .localFolder: return "Folder na iPhonie lub w aplikacji Pliki"
        case .iCloudDrive: return "Konto iCloud + folder muzyki"
        case .googleDrive: return "Logowanie Google + folder z Drive"
        case .qnap: return "NAS przez WebDAV"
        }
    }

    var systemImage: String {
        switch self {
        case .localFolder: return "folder.fill"
        case .iCloudDrive: return "icloud.fill"
        case .googleDrive: return "externaldrive.fill"
        case .qnap: return "server.rack"
        }
    }
}

struct ConnectedMusicSource: Codable, Identifiable, Hashable {
    let id: UUID
    var kind: MusicSourceKind
    var name: String
    var connectedAt: Date
    /// Zakładka folderu (iCloud / Google Drive) — security-scoped bookmark.
    var folderBookmark: Data?
    /// WebDAV (QNAP)
    var webDAVBaseURL: String?
    var webDAVUsername: String?
    var webDAVRootPath: String?
    var accountEmail: String?
    var googleDriveFolderId: String?

    var isWebDAV: Bool { kind == .qnap }
    var isGoogleDriveAPI: Bool { kind == .googleDrive && googleDriveFolderId != nil }
}

struct ExternalAudioTrack: Identifiable, Hashable {
    let id: String
    let title: String
    let artist: String?
    let album: String?
    let relativePath: String
    let fileURL: URL?
    let webDAVPath: String?
    let googleDriveFileId: String?
    let fileSize: Int64?

    func playbackTrack(sourceId: UUID) -> MusicPlaybackTrack {
        MusicPlaybackTrack(
            externalFile: fileURL,
            externalRelativePath: relativePath,
            webDAVPath: webDAVPath,
            googleDriveFileId: googleDriveFileId,
            sourceId: sourceId,
            title: title,
            artist: artist,
            album: album
        )
    }
}

private let audioExtensions: Set<String> = ["mp3", "m4a", "aac", "flac", "wav", "aiff", "aif", "alac"]

func isAudioFileName(_ name: String) -> Bool {
    audioExtensions.contains((name as NSString).pathExtension.lowercased())
}

func parseAudioTitle(from filename: String) -> (title: String, artist: String?) {
    let base = (filename as NSString).deletingPathExtension
    if let range = base.range(of: " - ") {
        let artist = String(base[..<range.lowerBound]).trimmingCharacters(in: .whitespaces)
        let title = String(base[range.upperBound...]).trimmingCharacters(in: .whitespaces)
        if !title.isEmpty { return (title, artist.isEmpty ? nil : artist) }
    }
    return (base, nil)
}

/// Prefer Artist/Album/Track.ext layout; fall back to filename "Artist - Title".
func parseAudioMetadata(filename: String, relativePath: String) -> (title: String, artist: String?, album: String?) {
    let parsed = parseAudioTitle(from: filename)
    let parts = relativePath
        .split(separator: "/")
        .map(String.init)
        .filter { !$0.isEmpty }
    guard parts.count >= 2 else {
        return (parsed.title, parsed.artist, nil)
    }
    let album = parts[parts.count - 2]
    let artistFromPath = parts.count >= 3 ? parts[parts.count - 3] : nil
    let artist = parsed.artist ?? artistFromPath
    return (parsed.title, artist, album)
}

extension Array where Element == ExternalAudioTrack {
    func sortedForBrowse() -> [ExternalAudioTrack] {
        sorted { lhs, rhs in
            let la = lhs.artist ?? "Nieznany wykonawca"
            let ra = rhs.artist ?? "Nieznany wykonawca"
            let artistCmp = la.localizedCaseInsensitiveCompare(ra)
            if artistCmp != .orderedSame { return artistCmp == .orderedAscending }
            let lb = lhs.album ?? ""
            let rb = rhs.album ?? ""
            let albumCmp = lb.localizedCaseInsensitiveCompare(rb)
            if albumCmp != .orderedSame { return albumCmp == .orderedAscending }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
    }
}

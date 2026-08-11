import AVFoundation
import CryptoKit
import Foundation

struct OpenedAudioImportResult {
    let localURL: URL
    let contentHash: String
    let libraryURL: String
    let title: String
    let artist: String?
    let album: String?
    let duration: Double?
}

enum OpenedAudioImportService {
    static func importFile(from source: URL) throws -> OpenedAudioImportResult {
        let accessed = source.startAccessingSecurityScopedResource()
        defer { if accessed { source.stopAccessingSecurityScopedResource() } }

        AppDocuments.ensureStructure()

        // Streaming hash + copy — duże miksy (50+ MB) nie ładujemy dwa razy do RAM.
        let hash = try sha256Hex(of: source)
        let ext = (source.lastPathComponent as NSString).pathExtension.lowercased()
        let normalizedExt = ext.isEmpty ? "mp3" : ext
        let dest = AppDocuments.audioImports
            .appendingPathComponent("\(hash).\(normalizedExt)", isDirectory: false)

        if !FileManager.default.fileExists(atPath: dest.path) {
            if source.standardizedFileURL == dest.standardizedFileURL {
                // Already in place.
            } else if source.path.hasPrefix(AppDocuments.audioImports.path) {
                try FileManager.default.moveItem(at: source, to: dest)
            } else {
                try FileManager.default.copyItem(at: source, to: dest)
            }
        } else if source.path.hasPrefix(AppDocuments.audioImports.path),
                  source.standardizedFileURL != dest.standardizedFileURL {
            // Posprzątaj tymczasowy inbox-* po stage z IncomingMediaRouter.
            try? FileManager.default.removeItem(at: source)
        }

        let parsed = parseAudioTitle(from: displayFileName(from: source))
        let embedded = readEmbeddedMetadata(from: dest)
        let title = embedded.title ?? parsed.title
        let artist = embedded.artist ?? parsed.artist
        let album = embedded.album

        OpenedAudioRegistry.register(
            localFile: dest,
            contentHash: hash,
            title: title,
            artist: artist,
            album: album
        )

        return OpenedAudioImportResult(
            localURL: dest,
            contentHash: hash,
            libraryURL: OpenedAudioRegistry.libraryURL(for: hash),
            title: title,
            artist: artist,
            album: album,
            duration: embedded.duration
        )
    }

    /// `inbox-abcd1234-Original Name.mp3` → `Original Name.mp3`
    private static func displayFileName(from source: URL) -> String {
        let name = source.lastPathComponent
        guard name.hasPrefix("inbox-") else { return name }
        let rest = name.dropFirst("inbox-".count)
        guard let dash = rest.firstIndex(of: "-") else { return name }
        let original = String(rest[rest.index(after: dash)...])
        return original.isEmpty ? name : original
    }

    private static func sha256Hex(of url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hasher = SHA256()
        while autoreleasepool(invoking: {
            let chunk = handle.readData(ofLength: 1024 * 1024)
            if chunk.isEmpty { return false }
            hasher.update(data: chunk)
            return true
        }) {}
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private struct EmbeddedMetadata {
        var title: String?
        var artist: String?
        var album: String?
        var duration: Double?
    }

    private static func readEmbeddedMetadata(from fileURL: URL) -> EmbeddedMetadata {
        let asset = AVURLAsset(url: fileURL)
        var meta = EmbeddedMetadata()
        for item in asset.commonMetadata {
            guard let key = item.commonKey?.rawValue else { continue }
            switch key {
            case AVMetadataKey.commonKeyTitle.rawValue:
                meta.title = item.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
            case AVMetadataKey.commonKeyArtist.rawValue:
                meta.artist = item.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
            case AVMetadataKey.commonKeyAlbumName.rawValue:
                meta.album = item.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
            default:
                break
            }
        }
        let seconds = CMTimeGetSeconds(asset.duration)
        if seconds.isFinite, seconds > 0 {
            meta.duration = seconds
        }
        return meta
    }
}

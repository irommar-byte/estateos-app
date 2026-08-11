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

        let data = try Data(contentsOf: source)
        let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        let ext = (source.lastPathComponent as NSString).pathExtension.lowercased()
        let normalizedExt = ext.isEmpty ? "mp3" : ext

        AppDocuments.ensureStructure()
        let dest = AppDocuments.audioImports
            .appendingPathComponent("\(hash).\(normalizedExt)", isDirectory: false)

        if !FileManager.default.fileExists(atPath: dest.path) {
            try data.write(to: dest, options: .atomic)
        }

        let parsed = parseAudioTitle(from: source.lastPathComponent)
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

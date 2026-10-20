import AVFoundation
import Foundation
import ImageIO
import Photos
import UIKit

struct ExportedResource {
    var role: String
    var file: URL
    var ext: String
    var hash: String
    var bytes: Int
}

enum OriginalExport {
    static func export(_ asset: PHAsset, wait: TimeInterval? = nil) async throws -> (resources: [ExportedResource], thumb: URL?) {
        let available = PHAssetResource.assetResources(for: asset)
        guard let primary = first(available, [.photo, .fullSizePhoto, .video, .fullSizeVideo]) else {
            throw LibraryError(message: "Brak oryginału w Rolce.")
        }
        var written: [URL] = []
        do {
            let primaryFile = try await write(primary, wait: wait)
            written.append(primaryFile)
            let primaryHash = try await Task.detached(priority: .utility) {
                try ContentHash.sha256(of: primaryFile)
            }.value
            let primaryExt = ext(of: primary, fallback: asset.mediaType == .video ? "mov" : "jpg")
            var resources = [
                ExportedResource(
                    role: "primary",
                    file: primaryFile,
                    ext: primaryExt,
                    hash: primaryHash,
                    bytes: size(primaryFile)
                ),
            ]
            if let paired = first(available, [.pairedVideo]) {
                let pairedFile = try await write(paired, wait: wait)
                written.append(pairedFile)
                let pairedHash = try await Task.detached(priority: .utility) {
                    try ContentHash.sha256(of: pairedFile)
                }.value
                resources.append(
                    ExportedResource(
                        role: "paired",
                        file: pairedFile,
                        ext: ext(of: paired, fallback: "mov"),
                        hash: pairedHash,
                        bytes: size(pairedFile)
                    )
                )
            }
            let thumb = await thumbnail(primary: primaryFile, video: asset.mediaType == .video)
            if let thumb { written.append(thumb) }
            return (resources, thumb)
        } catch {
            written.forEach { try? FileManager.default.removeItem(at: $0) }
            if asset.mediaType == .image, missing(error), let still = try? await renderedStill(asset) {
                let hash = try await Task.detached(priority: .utility) {
                    try ContentHash.sha256(of: still)
                }.value
                let thumb = await thumbnail(primary: still, video: false)
                return (
                    [ExportedResource(role: "primary", file: still, ext: "jpg", hash: hash, bytes: size(still))],
                    thumb
                )
            }
            if missing(error) {
                throw LibraryError(message: "Zdjęcie dopiero się zapisuje w Rolce. Stuknij chmurkę jeszcze raz za chwilę.")
            }
            throw error
        }
    }

    private static func missing(_ error: Error) -> Bool {
        let cocoa = error as NSError
        if cocoa.domain == NSCocoaErrorDomain, cocoa.code == NSFileNoSuchFileError || cocoa.code == NSFileReadNoSuchFileError {
            return true
        }
        let text = error.localizedDescription.lowercased()
        return text.contains("nie ma takiego pliku") || text.contains("no such file")
    }

    /// A photo that was just taken often has no HEIC file yet. The rendered still is already in Photos.
    private static func renderedStill(_ asset: PHAsset) async throws -> URL {
        let data: Data = try await withCheckedThrowingContinuation { continuation in
            let options = PHImageRequestOptions()
            options.isNetworkAccessAllowed = true
            options.deliveryMode = .highQualityFormat
            options.version = .current
            let gate = Once()
            let timeout = Task {
                try? await Task.sleep(for: .seconds(20))
                gate.finishData(continuation, LibraryError(message: "Zdjęcie dopiero się zapisuje w Rolce."))
            }
            PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, info in
                if (info?[PHImageResultIsDegradedKey] as? Bool) == true { return }
                timeout.cancel()
                if let data, !data.isEmpty {
                    gate.finishData(continuation, data)
                } else {
                    let error = (info?[PHImageErrorKey] as? Error) ?? LibraryError(message: "Zdjęcie dopiero się zapisuje w Rolce.")
                    gate.finishData(continuation, error)
                }
            }
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
        try data.write(to: url, options: .atomic)
        return url
    }

    private static func first(_ resources: [PHAssetResource], _ types: [PHAssetResourceType]) -> PHAssetResource? {
        for type in types {
            if let found = resources.first(where: { $0.type == type }) { return found }
        }
        return nil
    }

    private static func write(_ resource: PHAssetResource, wait: TimeInterval?) async throws -> URL {
        var last: Error = LibraryError(message: "Zdjęcie dopiero się zapisuje w Rolce.")
        for attempt in 0..<3 {
            do {
                return try await writeOnce(resource, wait: wait)
            } catch {
                last = error
                guard missing(error), attempt < 2 else { throw error }
                try? await Task.sleep(for: .milliseconds(800))
            }
        }
        throw last
    }

    private static func writeOnce(_ resource: PHAssetResource, wait: TimeInterval?) async throws -> URL {
        let ext = (resource.originalFilename as NSString).pathExtension
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + (ext.isEmpty ? "" : ".\(ext)"))
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let options = PHAssetResourceRequestOptions()
            options.isNetworkAccessAllowed = true
            let gate = Once()
            let standard: TimeInterval = resource.type == .video || resource.type == .fullSizeVideo || resource.type == .pairedVideo
                ? 8 * 60
                : 90
            let limit = UInt64((wait ?? standard) * 1_000_000_000)
            let timeout = Task {
                try? await Task.sleep(nanoseconds: limit)
                gate.finish(continuation, LibraryError(message: "Zdjęcie dopiero się zapisuje w Rolce. Stuknij chmurkę jeszcze raz za chwilę."))
            }
            PHAssetResourceManager.default().writeData(for: resource, toFile: url, options: options) { error in
                timeout.cancel()
                gate.finish(continuation, error)
            }
        }
        return url
    }

    private static func thumbnail(primary: URL, video: Bool) async -> URL? {
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
        if video {
            let clip = AVURLAsset(url: primary)
            let generator = AVAssetImageGenerator(asset: clip)
            generator.appliesPreferredTrackTransform = true
            generator.maximumSize = CGSize(width: 480, height: 480)
            // HDR and Dolby Vision clips are tone-mapped so the tile is not washed out or black.
            generator.dynamicRangePolicy = .forceSDR
            generator.requestedTimeToleranceBefore = .positiveInfinity
            generator.requestedTimeToleranceAfter = CMTime(seconds: 2, preferredTimescale: 600)
            let length = (try? await clip.load(.duration))?.seconds ?? 0
            let second = length.isFinite && length > 2 ? min(1.0, length * 0.1) : 0
            do {
                let image: CGImage
                if let picked = try? await generator.image(at: CMTime(seconds: second, preferredTimescale: 600)).image {
                    image = picked
                } else {
                    image = try await generator.image(at: .zero).image
                }
                guard let data = UIImage(cgImage: image).jpegData(compressionQuality: 0.82) else { return nil }
                try data.write(to: dest)
                return dest
            } catch {
                return nil
            }
        }
        guard let source = CGImageSourceCreateWithURL(primary as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceThumbnailMaxPixelSize: 480,
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
        ]
        guard let scaled = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        guard let data = UIImage(cgImage: scaled).jpegData(compressionQuality: 0.82) else { return nil }
        try? data.write(to: dest)
        return dest
    }

    private static func ext(of resource: PHAssetResource, fallback: String) -> String {
        let raw = (resource.originalFilename as NSString).pathExtension.lowercased()
        let cleaned = raw.filter { $0.isLetter || $0.isNumber }
        if cleaned.isEmpty || cleaned.count > 5 { return fallback }
        return cleaned
    }

    private static func size(_ url: URL) -> Int {
        (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.intValue ?? 0
    }
}

private final class Once: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false
    func finish(_ continuation: CheckedContinuation<Void, Error>, _ error: Error?) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
    }

    func finishData(_ continuation: CheckedContinuation<Data, Error>, _ result: Result<Data, Error>) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        continuation.resume(with: result)
    }

    func finishData(_ continuation: CheckedContinuation<Data, Error>, _ data: Data) {
        finishData(continuation, .success(data))
    }

    func finishData(_ continuation: CheckedContinuation<Data, Error>, _ error: Error) {
        finishData(continuation, .failure(error))
    }
}

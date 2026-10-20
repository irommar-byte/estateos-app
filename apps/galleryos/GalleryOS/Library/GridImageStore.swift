import AVFoundation
import Photos
import UIKit

/// Loads and caches grid previews independently of cell reuse.
/// iCloud downloads keep going even when the cell scrolls away; the next cell for that id gets the image instantly.
@MainActor
final class GridImageStore {
    static let shared = GridImageStore()

    private let manager = PHCachingImageManager()
    private var cache: [String: UIImage] = [:]
    private var order: [String] = []
    private var inflight = Set<String>()
    private var waiters: [String: [(UIImage) -> Void]] = [:]
    private var active = 0
    private var queue: [() -> Void] = []
    private let limit = 14
    private let capacity = 900

    private init() {
        manager.allowsCachingHighQualityImages = true
    }

    func cached(_ id: String) -> UIImage? {
        if let hit = cache[id] {
            touch(id)
            return hit
        }
        return nil
    }

    func remember(_ id: String, _ image: UIImage) {
        trimIfNeeded()
        cache[id] = image
        touch(id)
        inflight.remove(id)
        let callbacks = waiters.removeValue(forKey: id) ?? []
        for callback in callbacks { callback(image) }
    }

    /// Delivers a preview as soon as possible. Safe to call repeatedly for the same id.
    func load(
        id: String,
        asset: PHAsset?,
        fallback: UIImage?,
        pixel: CGSize,
        server: (() async -> UIImage?)?,
        deliver: @escaping (String, UIImage) -> Void
    ) {
        if let hit = cached(id) {
            deliver(id, hit)
            return
        }
        if let fallback {
            deliver(id, fallback)
        }
        waiters[id, default: []].append { image in deliver(id, image) }
        guard !inflight.contains(id) else { return }
        inflight.insert(id)

        enqueue { [weak self] done in
            guard let self else { done(); return }
            Task { @MainActor in
                let image = await self.fetch(id: id, asset: asset, pixel: pixel, server: server)
                if let image {
                    self.remember(id, image)
                } else {
                    self.inflight.remove(id)
                    self.waiters[id] = nil
                }
                done()
            }
        }
    }

    func prefetch(ids: [String], asset: (String) -> PHAsset?, pixel: CGSize) {
        let options = PHImageRequestOptions()
        options.deliveryMode = .fastFormat
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        let assets = ids.compactMap { asset($0) }
        guard !assets.isEmpty else { return }
        manager.startCachingImages(for: assets, targetSize: pixel, contentMode: .aspectFill, options: options)
        for id in ids where cache[id] == nil {
            load(id: id, asset: asset(id), fallback: nil, pixel: pixel, server: nil) { _, _ in }
        }
    }

    private func fetch(
        id: String,
        asset: PHAsset?,
        pixel: CGSize,
        server: (() async -> UIImage?)?
    ) async -> UIImage? {
        if let asset {
            // Prefer a usable local preview, then upgrade over the network.
            if let image = await request(asset: asset, pixel: pixel, network: false) {
                // Kick a background upgrade without blocking the first paint.
                if asset.mediaType != .video {
                    Task { @MainActor in
                        if let sharp = await self.request(asset: asset, pixel: pixel, network: true) {
                            self.remember(id, sharp)
                        }
                    }
                }
                return image
            }
            if let image = await request(asset: asset, pixel: pixel, network: true) { return image }
            if asset.mediaType == .video, let image = await videoFrame(asset: asset, pixel: pixel) {
                return image
            }
        }
        if let server, let image = await server() { return image }
        return nil
    }

    private func request(asset: PHAsset, pixel: CGSize, network: Bool) async -> UIImage? {
        await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.deliveryMode = network ? .highQualityFormat : .fastFormat
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = network
            options.isSynchronous = false
            var best: UIImage?
            var finished = false
            manager.requestImage(
                for: asset,
                targetSize: pixel,
                contentMode: .aspectFill,
                options: options
            ) { image, info in
                let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
                let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
                if let image { best = image }
                let complete: Bool
                if cancelled {
                    complete = true
                } else if network {
                    // Wait for the non-degraded frame when networking is allowed.
                    complete = !degraded || best == nil
                } else {
                    complete = true
                }
                guard complete, !finished else { return }
                finished = true
                continuation.resume(returning: best)
            }
        }
    }

    private func videoFrame(asset: PHAsset, pixel: CGSize) async -> UIImage? {
        await withCheckedContinuation { continuation in
            let options = PHVideoRequestOptions()
            options.isNetworkAccessAllowed = true
            options.deliveryMode = .fastFormat
            var finished = false
            manager.requestAVAsset(forVideo: asset, options: options) { avAsset, _, _ in
                guard let avAsset else {
                    guard !finished else { return }
                    finished = true
                    continuation.resume(returning: nil)
                    return
                }
                let generator = AVAssetImageGenerator(asset: avAsset)
                generator.appliesPreferredTrackTransform = true
                let side = max(pixel.width, pixel.height, 240)
                generator.maximumSize = CGSize(width: side, height: side)
                let time = CMTime(seconds: 0.35, preferredTimescale: 600)
                generator.generateCGImagesAsynchronously(forTimes: [NSValue(time: time)]) { _, cg, _, result, _ in
                    guard !finished else { return }
                    finished = true
                    guard result == .succeeded, let cg else {
                        continuation.resume(returning: nil)
                        return
                    }
                    continuation.resume(returning: UIImage(cgImage: cg))
                }
            }
        }
    }

    private func touch(_ id: String) {
        if let index = order.firstIndex(of: id) {
            order.remove(at: index)
        }
        order.append(id)
    }

    private func trimIfNeeded() {
        guard cache.count >= capacity else { return }
        let excess = cache.count - (capacity * 4 / 5)
        guard excess > 0 else { return }
        let doomed = Array(order.prefix(excess))
        order.removeFirst(min(excess, order.count))
        for id in doomed {
            cache.removeValue(forKey: id)
        }
    }

    private func enqueue(_ work: @escaping (@escaping () -> Void) -> Void) {
        if active < limit {
            active += 1
            work { [weak self] in self?.finish() }
            return
        }
        queue.append { work { [weak self] in self?.finish() } }
    }

    private func finish() {
        active = max(0, active - 1)
        guard !queue.isEmpty else { return }
        let next = queue.removeLast()
        active += 1
        next()
    }
}

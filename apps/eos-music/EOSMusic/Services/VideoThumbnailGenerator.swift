import AVFoundation
@preconcurrency import MobileVLCKit
import SwiftUI
import UIKit

struct VideoThumbnailFrame: Identifiable {
    let fraction: Double
    let image: UIImage

    var id: Int { Int((fraction * 10_000).rounded()) }
}

/// Produces a lightweight timeline filmstrip without seeking the active player.
/// AVFoundation is fast for Apple containers; VLC is the codec-complete local fallback.
@MainActor
final class VideoThumbnailGenerator: NSObject, ObservableObject, @preconcurrency VLCMediaThumbnailerDelegate {
    @Published private(set) var frames: [VideoThumbnailFrame] = []
    @Published private(set) var isGenerating = false

    private static let maxFrames = 20
    private static let publishEvery = 5

    private var generationID = UUID()
    private var sourceURL: URL?
    private var requestedCount = 20
    private var vlcIndex = 0
    private var activeThumbnailer: VLCMediaThumbnailer?
    /// Accumulates VLC frames before publishing to limit `@Published` churn.
    private var pendingFrames: [VideoThumbnailFrame] = []

    func generate(url: URL, duration: Double, count: Int = 20, httpHeaders: [String: String]? = nil) {
        let nextID = UUID()
        generationID = nextID
        sourceURL = url
        let thermal = ProcessInfo.processInfo.thermalState
        let lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        let budget: Int
        if thermal == .serious || thermal == .critical || lowPower {
            budget = 8
        } else if thermal == .fair {
            budget = 12
        } else {
            budget = max(8, min(Self.maxFrames, count))
        }
        requestedCount = url.isFileURL ? min(Self.maxFrames, budget) : min(6, budget)
        vlcIndex = 0
        activeThumbnailer = nil
        pendingFrames = frames
        if frames.isEmpty {
            isGenerating = true
        }

        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(VideoFilmstripPolicy.prepareTimeoutSeconds * 1_000_000_000))
            guard let self, self.generationID == nextID else { return }
            self.isGenerating = false
        }

        let ext = url.pathExtension.lowercased()
        let appleContainers = Set(["mp4", "mov", "m4v"])
        let path = url.path.lowercased()
        let looksLikeServerStream = path.contains("/api/movies/stream/")
            || path.contains("/api/play/")
            || path.contains("/api/file/")
        let bad = Set(["mkv", "avi", "wmv", "flv", "webm", "ts", "m2ts", "mpg", "mpeg", "vob"])
        if !url.isFileURL {
            generateRemote(url: url, duration: duration, id: nextID, httpHeaders: httpHeaders)
        } else if bad.contains(ext) {
            fetchNextVLCThumbnail(id: nextID)
        } else if appleContainers.contains(ext) || looksLikeServerStream {
            generateWithAVFoundation(url: url, duration: duration, id: nextID, httpHeaders: httpHeaders, allowVLCFallback: true)
        } else {
            fetchNextVLCThumbnail(id: nextID)
        }
    }

    func markPreparing() {
        if frames.isEmpty {
            isGenerating = true
        }
    }

    func finishPreparingIfNeeded() {
        isGenerating = false
    }

    func cancel() {
        generationID = UUID()
        activeThumbnailer?.delegate = nil
        activeThumbnailer = nil
        pendingFrames = []
        frames = []
        isGenerating = false
    }

    func nearestFrame(to fraction: Double) -> VideoThumbnailFrame? {
        frames.min { abs($0.fraction - fraction) < abs($1.fraction - fraction) }
    }

    func ingestLiveFrame(_ image: UIImage, fraction: Double) {
        merge(VideoThumbnailFrame(fraction: min(0.999, max(0, fraction)), image: image))
        if frames.count >= 3 {
            isGenerating = false
        }
    }

    private func merge(_ frame: VideoThumbnailFrame) {
        var next = frames.filter { abs($0.fraction - frame.fraction) > 0.03 }
        next.append(frame)
        next.sort { $0.fraction < $1.fraction }
        frames = Array(next.prefix(Self.maxFrames))
    }

    private func generateRemote(url: URL, duration: Double, id: UUID, httpHeaders: [String: String]?) {
        generateWithAVFoundation(
            url: url,
            duration: duration,
            id: id,
            httpHeaders: httpHeaders,
            allowVLCFallback: false
        )
    }

    private func generateWithAVFoundation(
        url: URL,
        duration: Double,
        id: UUID,
        httpHeaders: [String: String]?,
        allowVLCFallback: Bool
    ) {
        let count = requestedCount
        Task.detached(priority: .utility) { [weak self] in
            let output = await Self.extractAVFrames(
                url: url,
                duration: duration,
                count: count,
                headers: httpHeaders,
                budget: url.isFileURL ? 16 : 6
            )
            await MainActor.run {
                guard let self, self.generationID == id else { return }
                for frame in output {
                    self.merge(frame)
                }
                if output.count >= max(3, count / 2) {
                    self.isGenerating = false
                } else if allowVLCFallback, url.isFileURL {
                    self.fetchNextVLCThumbnail(id: id)
                } else {
                    self.isGenerating = false
                }
            }
        }
    }

    nonisolated private static func extractAVFrames(
        url: URL,
        duration: Double,
        count: Int,
        headers: [String: String]?,
        budget: TimeInterval
    ) async -> [VideoThumbnailFrame] {
        let asset: AVURLAsset
        if let headers, !headers.isEmpty {
            asset = AVURLAsset(url: url, options: ["AVURLAssetHTTPHeaderFieldsKey": headers])
        } else {
            asset = AVURLAsset(url: url)
        }

        let assetDuration: Double
        if duration > 1 {
            assetDuration = duration
        } else {
            assetDuration = await withTaskGroup(of: Double.self) { group in
                group.addTask {
                    (try? await asset.load(.duration).seconds) ?? 0
                }
                group.addTask {
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    return 0
                }
                let value = await group.next() ?? 0
                group.cancelAll()
                return value
            }
        }
        guard assetDuration.isFinite, assetDuration > 1 else { return [] }

        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 240, height: 140)
        generator.requestedTimeToleranceBefore = CMTime(seconds: 1.5, preferredTimescale: 600)
        generator.requestedTimeToleranceAfter = CMTime(seconds: 1.5, preferredTimescale: 600)

        let fractions = (0..<count).map { (Double($0) + 0.5) / Double(count) }
        let times = fractions.map {
            NSValue(time: CMTime(seconds: assetDuration * $0, preferredTimescale: 600))
        }

        return await withCheckedContinuation { continuation in
            let lock = NSLock()
            var output: [VideoThumbnailFrame] = []
            var remaining = count
            var resumed = false
            let finish: () -> Void = {
                lock.lock()
                defer { lock.unlock() }
                guard !resumed else { return }
                resumed = true
                continuation.resume(returning: output.sorted { $0.fraction < $1.fraction })
            }

            generator.generateCGImagesAsynchronously(forTimes: times) { requested, image, _, result, _ in
                lock.lock()
                if let image {
                    let fraction = requested.seconds / max(assetDuration, 0.001)
                    output.append(
                        VideoThumbnailFrame(
                            fraction: min(0.999, max(0, fraction)),
                            image: UIImage(cgImage: image)
                        )
                    )
                }
                remaining -= 1
                let done = remaining <= 0 || result == .cancelled
                lock.unlock()
                if done { finish() }
            }

            Task {
                try? await Task.sleep(nanoseconds: UInt64(budget * 1_000_000_000))
                generator.cancelAllCGImageGeneration()
                finish()
            }
        }
    }

    private func fetchNextVLCThumbnail(id: UUID) {
        guard generationID == id, let sourceURL else { return }
        guard sourceURL.isFileURL else {
            isGenerating = false
            return
        }
        guard vlcIndex < requestedCount, pendingFrames.count < Self.maxFrames else {
            publishPending(final: true)
            activeThumbnailer = nil
            isGenerating = false
            return
        }

        let media = VLCMedia(url: sourceURL)
        let thumbnailer = VLCMediaThumbnailer(media: media, andDelegate: self)
        thumbnailer.thumbnailWidth = 240
        thumbnailer.thumbnailHeight = 140
        thumbnailer.snapshotPosition = Float((Double(vlcIndex) + 0.5) / Double(requestedCount))
        activeThumbnailer = thumbnailer
        thumbnailer.fetchThumbnail()
    }

    private func publishPending(final: Bool) {
        guard !pendingFrames.isEmpty || final else { return }
        let sorted = pendingFrames.sorted { $0.fraction < $1.fraction }
        let capped = Array(sorted.prefix(Self.maxFrames))
        pendingFrames = capped
        if frames.isEmpty || final {
            for frame in capped {
                merge(frame)
            }
        }
        if final {
            isGenerating = false
        }
    }

    @objc func mediaThumbnailerDidTimeOut(_ mediaThumbnailer: VLCMediaThumbnailer) {
        guard mediaThumbnailer === activeThumbnailer else { return }
        vlcIndex += 1
        activeThumbnailer = nil
        fetchNextVLCThumbnail(id: generationID)
    }

    @objc func mediaThumbnailer(
        _ mediaThumbnailer: VLCMediaThumbnailer,
        didFinishThumbnail thumbnail: CGImage
    ) {
        guard mediaThumbnailer === activeThumbnailer else { return }
        let fraction = (Double(vlcIndex) + 0.5) / Double(requestedCount)
        if pendingFrames.count < Self.maxFrames {
            pendingFrames.append(VideoThumbnailFrame(fraction: fraction, image: UIImage(cgImage: thumbnail)))
        }
        vlcIndex += 1
        activeThumbnailer = nil

        let done = vlcIndex >= requestedCount || pendingFrames.count >= Self.maxFrames
        if done || pendingFrames.count % Self.publishEvery == 0 {
            publishPending(final: done)
        }
        if done {
            activeThumbnailer = nil
            isGenerating = false
            return
        }
        fetchNextVLCThumbnail(id: generationID)
    }
}

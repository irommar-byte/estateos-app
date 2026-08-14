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
/// AVFoundation is fast for Apple containers; VLC is the codec-complete fallback.
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

    func generate(url: URL, duration: Double, count: Int = 20) {
        let nextID = UUID()
        generationID = nextID
        sourceURL = url
        let thermal = ProcessInfo.processInfo.thermalState
        let lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        let budget: Int
        if thermal == .serious || thermal == .critical || lowPower {
            budget = 10
        } else if thermal == .fair {
            budget = 14
        } else {
            budget = max(12, min(Self.maxFrames, count))
        }
        requestedCount = min(Self.maxFrames, budget)
        vlcIndex = 0
        activeThumbnailer = nil
        pendingFrames = []
        frames = []
        isGenerating = true

        let appleContainers = Set(["mp4", "mov", "m4v"])
        if appleContainers.contains(url.pathExtension.lowercased()) {
            generateWithAVFoundation(url: url, duration: duration, id: nextID)
        } else {
            fetchNextVLCThumbnail(id: nextID)
        }
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
        guard !isGenerating else { return }
        let clamped = min(0.999, max(0, fraction))
        let bucket = (clamped * 16).rounded() / 16
        var next = frames.filter { abs($0.fraction - bucket) > 0.03 }
        next.append(VideoThumbnailFrame(fraction: bucket, image: image))
        next.sort { $0.fraction < $1.fraction }
        frames = Array(next.prefix(Self.maxFrames))
        isGenerating = false
    }

    private func generateWithAVFoundation(url: URL, duration: Double, id: UUID) {
        let count = requestedCount
        let maxFrames = Self.maxFrames
        Task.detached(priority: .utility) { [weak self] in
            let asset = AVURLAsset(url: url)
            let generator = AVAssetImageGenerator(asset: asset)
            generator.appliesPreferredTrackTransform = true
            generator.maximumSize = CGSize(width: 240, height: 140)
            generator.requestedTimeToleranceBefore = CMTime(seconds: 0.6, preferredTimescale: 600)
            generator.requestedTimeToleranceAfter = CMTime(seconds: 0.6, preferredTimescale: 600)

            let assetDuration = (try? await asset.load(.duration).seconds) ?? duration
            guard assetDuration.isFinite, assetDuration > 0 else {
                await self?.fallBackToVLC(id: id)
                return
            }

            var output: [VideoThumbnailFrame] = []
            for index in 0..<count {
                guard !Task.isCancelled else { return }
                guard output.count < maxFrames else { break }
                let fraction = (Double(index) + 0.5) / Double(count)
                let time = CMTime(seconds: assetDuration * fraction, preferredTimescale: 600)
                if let cg = try? generator.copyCGImage(at: time, actualTime: nil) {
                    output.append(VideoThumbnailFrame(fraction: fraction, image: UIImage(cgImage: cg)))
                }
            }

            await MainActor.run {
                guard let self, self.generationID == id else { return }
                if output.count >= max(3, count / 2) {
                    self.pendingFrames = []
                    self.frames = Array(output.prefix(Self.maxFrames))
                    self.isGenerating = false
                } else {
                    self.pendingFrames = []
                    self.frames = []
                    self.fetchNextVLCThumbnail(id: id)
                }
            }
        }
    }

    private func fallBackToVLC(id: UUID) {
        guard generationID == id else { return }
        pendingFrames = []
        frames = []
        fetchNextVLCThumbnail(id: id)
    }

    private func fetchNextVLCThumbnail(id: UUID) {
        guard generationID == id, let sourceURL else { return }
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
        frames = capped
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

import AVFoundation
import AVKit
import SwiftUI
import UIKit

/// Stable hybrid PiP: AVPlayer handles system PiP for Apple-compatible files,
/// while VLC remains the main player and resumes at the exact PiP position.
@MainActor
final class VideoPiPController: NSObject, ObservableObject {
    @Published private(set) var isActive = false
    @Published private(set) var isPreparing = false
    @Published private(set) var errorMessage: String?

    var onStarted: (() -> Void)?
    var onRestore: (() -> Void)?
    /// Used when system PiP cannot open the container (MKV/AVI…) — float as mini-player instead.
    var onFallbackMinimize: (() -> Void)?

    private let avPlayer = AVPlayer()
    private let playerLayer = AVPlayerLayer()
    private var controller: AVPictureInPictureController?
    private weak var hostView: UIView?
    private weak var engine: VideoPlaybackEngine?
    private var sourceWasPlaying = false
    private var isTransferringBack = false
    private var startTask: Task<Void, Never>?

    override init() {
        super.init()
        playerLayer.player = avPlayer
        playerLayer.videoGravity = .resizeAspect
        // Tiny but non-zero layer so AVKit can sample frames for PiP.
        playerLayer.frame = CGRect(x: 0, y: 0, width: 64, height: 36)
    }

    var isSystemSupported: Bool {
        AVPictureInPictureController.isPictureInPictureSupported()
    }

    func supportsCurrentItem(_ engine: VideoPlaybackEngine) -> Bool {
        guard isSystemSupported, let url = engine.currentPlayableURL else { return false }
        return Self.isApplePiPContainer(url)
    }

    /// AVPlayer PiP działa dla MP4/MOV/HLS. Streamy CDA-HD (`/api/play/…`) zwykle nie mają
    /// rozszerzenia w URL — wcześniej wpadały w fallback „tylko mini-player”.
    static func isApplePiPContainer(_ url: URL) -> Bool {
        let ext = url.pathExtension.lowercased()
        if ["mp4", "mov", "m4v", "m3u8"].contains(ext) { return true }

        let bad = ["mkv", "avi", "wmv", "flv", "webm", "ts", "m2ts", "mpg", "mpeg", "vob", "rmvb", "3gp", "ogv"]
        if bad.contains(ext) { return false }

        let scheme = (url.scheme ?? "").lowercased()
        guard scheme == "http" || scheme == "https" else { return false }

        let path = url.path.lowercased()
        if path.contains("/api/play/")
            || path.contains("/api/movies/stream/")
            || path.contains("/api/file/")
            || path.contains("/api/music/stream/") {
            return true
        }
        // Remote URL bez rozszerzenia — spróbuj PiP; przy nieudanym starcie i tak jest fallback.
        return ext.isEmpty
    }

    func attach(to host: UIView) {
        hostView = host
        if playerLayer.superlayer !== host.layer {
            playerLayer.removeFromSuperlayer()
            host.layer.addSublayer(playerLayer)
        }
        let bounds = host.bounds
        playerLayer.frame = bounds.width > 1 && bounds.height > 1
            ? bounds
            : CGRect(x: 0, y: 0, width: 64, height: 36)
        ensureController()
    }

    private func ensureController() {
        if controller == nil {
            guard let pip = AVPictureInPictureController(playerLayer: playerLayer) else { return }
            pip.delegate = self
            pip.canStartPictureInPictureAutomaticallyFromInline = false
            controller = pip
        }
    }

    func start(engine: VideoPlaybackEngine) async {
        guard !isActive, !isPreparing else { return }
        guard isSystemSupported else {
            errorMessage = "Picture in Picture nie jest obsługiwany na tym urządzeniu."
            return
        }
        guard let url = engine.currentPlayableURL else {
            errorMessage = "Film nie jest jeszcze gotowy do PiP."
            return
        }

        // Non-Apple containers: don't show a blocking alert — float via mini-player.
        guard Self.isApplePiPContainer(url) else {
            onFallbackMinimize?()
            return
        }

        isPreparing = true
        errorMessage = nil
        self.engine = engine
        sourceWasPlaying = engine.isPlaying
        ensureController()

        startTask?.cancel()
        startTask = Task { @MainActor [weak self] in
            guard let self else { return }
            defer {
                if !self.isActive {
                    self.isPreparing = false
                }
            }

            let asset = AVURLAsset(url: url)
            let playable = (try? await asset.load(.isPlayable)) == true
            guard !Task.isCancelled else { return }
            guard playable else {
                self.transferBackToVLC()
                self.onFallbackMinimize?()
                return
            }

            let item = AVPlayerItem(asset: asset)
            self.avPlayer.replaceCurrentItem(with: item)

            // Wait until AVPlayer can render — isPictureInPicturePossible is flaky before this.
            for _ in 0..<40 {
                if Task.isCancelled { return }
                if item.status == .readyToPlay { break }
                if item.status == .failed {
                    self.transferBackToVLC()
                    self.onFallbackMinimize?()
                    return
                }
                try? await Task.sleep(nanoseconds: 50_000_000)
            }
            guard item.status == .readyToPlay else {
                self.transferBackToVLC()
                self.onFallbackMinimize?()
                return
            }

            let target = CMTime(seconds: max(0, engine.currentTime), preferredTimescale: 600)
            await self.avPlayer.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero)
            guard !Task.isCancelled else { return }

            engine.pauseForPictureInPicture()
            if self.sourceWasPlaying {
                self.avPlayer.play()
            } else {
                await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                    self.avPlayer.preroll(atRate: 1) { _ in continuation.resume() }
                }
                self.avPlayer.pause()
            }

            if let host = self.hostView {
                self.attach(to: host)
            }

            for _ in 0..<30 {
                if Task.isCancelled { return }
                if let controller = self.controller, controller.isPictureInPicturePossible {
                    controller.startPictureInPicture()
                    // Give AVKit a moment; success is confirmed via delegate.
                    try? await Task.sleep(nanoseconds: 350_000_000)
                    if self.isActive || controller.isPictureInPictureActive {
                        return
                    }
                }
                try? await Task.sleep(nanoseconds: 60_000_000)
            }

            self.transferBackToVLC()
            self.errorMessage = "PiP nie jest jeszcze gotowy. Spróbuj ponownie za chwilę."
        }
        await startTask?.value
    }

    func stop() {
        startTask?.cancel()
        controller?.stopPictureInPicture()
    }

    func stopAndDiscard() {
        startTask?.cancel()
        engine = nil
        avPlayer.pause()
        avPlayer.replaceCurrentItem(with: nil)
        controller?.stopPictureInPicture()
        isPreparing = false
        isActive = false
    }

    func clearError() {
        errorMessage = nil
    }

    private func transferBackToVLC() {
        guard !isTransferringBack else { return }
        isTransferringBack = true
        let seconds = avPlayer.currentTime().seconds
        let shouldResume = avPlayer.rate > 0 || sourceWasPlaying
        let engineRef = engine
        avPlayer.pause()
        avPlayer.replaceCurrentItem(with: nil)
        if let engineRef {
            engineRef.resumeAfterPictureInPicture(
                at: seconds.isFinite ? seconds : engineRef.currentTime,
                resume: shouldResume
            )
            // Full player may just have reappeared — force video surface back on.
            engineRef.kickVideoOutput()
        }
        engine = nil
        isTransferringBack = false
    }
}

extension VideoPiPController: AVPictureInPictureControllerDelegate {
    nonisolated func pictureInPictureControllerDidStartPictureInPicture(
        _ pictureInPictureController: AVPictureInPictureController
    ) {
        Task { @MainActor in
            isPreparing = false
            isActive = true
            onStarted?()
        }
    }

    nonisolated func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        failedToStartPictureInPictureWithError error: Error
    ) {
        Task { @MainActor in
            isPreparing = false
            isActive = false
            transferBackToVLC()
            onFallbackMinimize?()
        }
    }

    nonisolated func pictureInPictureControllerDidStopPictureInPicture(
        _ pictureInPictureController: AVPictureInPictureController
    ) {
        Task { @MainActor in
            transferBackToVLC()
            isPreparing = false
            isActive = false
        }
    }

    nonisolated func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void
    ) {
        Task { @MainActor in
            onRestore?()
            // Wait a beat for fullScreenCover to attach VLC drawable before completion.
            try? await Task.sleep(nanoseconds: 120_000_000)
            completionHandler(true)
        }
    }
}

struct VideoPiPLayerHost: UIViewRepresentable {
    @ObservedObject var controller: VideoPiPController

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: CGRect(x: 0, y: 0, width: 64, height: 36))
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = false
        controller.attach(to: view)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        controller.attach(to: uiView)
    }
}

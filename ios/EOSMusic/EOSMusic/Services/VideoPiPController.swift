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
    /// Wideo leci na Apple TV / AirPlay — AVPlayer przejął stream (VLC w tle).
    @Published private(set) var isExternalPlaybackActive = false
    @Published private(set) var externalDeviceName: String?
    @Published private(set) var airPlayNotice: String?

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
    private var externalTask: Task<Void, Never>?
    private var routeObserver: NSObjectProtocol?
    private var timeObserver: Any?
    private var pipTimeObserver: Any?
    private var externalEndObserver: NSObjectProtocol?
    private var rateObserver: NSKeyValueObservation?

    override init() {
        super.init()
        avPlayer.allowsExternalPlayback = true
        avPlayer.usesExternalPlaybackWhileExternalScreenIsActive = true
        playerLayer.player = avPlayer
        playerLayer.videoGravity = .resizeAspect
        // Tiny but non-zero layer so AVKit can sample frames for PiP / AirPlay video.
        playerLayer.frame = CGRect(x: 0, y: 0, width: 64, height: 36)
        installRouteObserver()
        installExternalPlaybackObserver()
    }

    deinit {
        if let routeObserver {
            NotificationCenter.default.removeObserver(routeObserver)
        }
        if let externalEndObserver {
            NotificationCenter.default.removeObserver(externalEndObserver)
        }
        if let timeObserver {
            avPlayer.removeTimeObserver(timeObserver)
        }
        if let pipTimeObserver {
            avPlayer.removeTimeObserver(pipTimeObserver)
        }
        rateObserver?.invalidate()
    }

    var isSystemSupported: Bool {
        AVPictureInPictureController.isPictureInPictureSupported()
    }

    func supportsCurrentItem(_ engine: VideoPlaybackEngine) -> Bool {
        guard let url = engine.currentPlayableURL else { return false }
        return Self.isApplePiPContainer(url)
    }

    /// Przed wyborem trasy AirPlay — wczytaj AVPlayer, żeby TV dostało wideo, nie sam dźwięk z VLC.
    func prepareAirPlayHandoff(for engine: VideoPlaybackEngine) {
        guard supportsCurrentItem(engine) else {
            airPlayNotice = airPlayAudioOnlyHint(for: engine.currentPlayableURL)
            return
        }
        airPlayNotice = nil
        self.engine = engine
        externalTask?.cancel()
        externalTask = Task { @MainActor [weak self] in
            guard let self else { return }
            _ = await self.loadAVPlayerItem(from: engine, autoplay: false)
        }
    }

    func toggleExternalPlayPause() {
        guard isExternalPlaybackActive else { return }
        if avPlayer.rate > 0 {
            avPlayer.pause()
            engine?.syncExternalPlayback(time: avPlayer.currentTime().seconds, isPlaying: false)
        } else {
            avPlayer.play()
            engine?.syncExternalPlayback(time: avPlayer.currentTime().seconds, isPlaying: true)
        }
    }

    func externalSeek(to seconds: Double, resume: Bool) {
        guard isExternalPlaybackActive else { return }
        let target = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        avPlayer.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                if resume {
                    self.avPlayer.play()
                }
                self.engine?.syncExternalPlayback(
                    time: self.avPlayer.currentTime().seconds,
                    isPlaying: resume
                )
            }
        }
    }

    func externalNudgeSeek(by seconds: Double) {
        guard isExternalPlaybackActive else { return }
        let current = avPlayer.currentTime().seconds
        let target = max(0, current + seconds)
        externalSeek(to: target, resume: avPlayer.rate > 0 || engine?.isPlaying == true)
    }

    /// AVPlayer PiP działa dla MP4/MOV/HLS. Streamy EOS™LIBRARY (`/api/play/…`) zwykle nie mają
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

    // MARK: - AirPlay video (AVPlayer external playback)

    private func installRouteObserver() {
        routeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] note in
            Task { @MainActor in
                self?.handleAudioRouteChange(note)
            }
        }
    }

    private func installExternalPlaybackObserver() {
        externalEndObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: nil,
            queue: .main
        ) { [weak self] note in
            Task { @MainActor in
                guard let self,
                      let item = note.object as? AVPlayerItem,
                      item === self.avPlayer.currentItem else { return }
                self.engine?.markExternalPlaybackEnded()
            }
        }
    }

    private func handleAudioRouteChange(_ note: Notification) {
        guard let engine, engine.currentItem != nil else { return }

        if isExternalPlaybackActive {
            if !Self.isAirPlayVideoRoute(AVAudioSession.sharedInstance()) {
                endExternalPlayback(transferToVLC: true)
            }
            return
        }

        guard Self.isAirPlayVideoRoute(AVAudioSession.sharedInstance()) else { return }

        // User picked Apple TV — hand off video from VLC to AVPlayer.
        externalTask?.cancel()
        externalTask = Task { @MainActor [weak self] in
            await self?.beginExternalPlayback(engine: engine)
        }
    }

    private static func isAirPlayVideoRoute(_ session: AVAudioSession) -> Bool {
        session.currentRoute.outputs.contains { port in
            switch port.portType {
            case .airPlay, .HDMI, .AVB:
                return true
            default:
                return false
            }
        }
    }

    private static func airPlayOutputName(_ session: AVAudioSession) -> String? {
        session.currentRoute.outputs.first(where: {
            $0.portType == .airPlay || $0.portType == .HDMI
        })?.portName
    }

    private func airPlayAudioOnlyHint(for url: URL?) -> String {
        let ext = url?.pathExtension.lowercased() ?? ""
        if ["mkv", "avi", "wmv", "webm", "flv", "ts", "m2ts"].contains(ext) {
            return "Ten format (\(ext.uppercased())) — AirPlay przesyła tylko dźwięk. Pobierz MP4 albo użyj Lustrzanego odbicia ekranu."
        }
        return "Ten plik nie obsługuje AirPlay wideo w EOS. Spróbuj streamu z \(EOSLibraryBrand.displayName) / MP4 albo Lustrzane odbicie."
    }

    private func beginExternalPlayback(engine: VideoPlaybackEngine) async {
        guard !isExternalPlaybackActive, !isActive else { return }
        guard let url = engine.currentPlayableURL else { return }

        guard Self.isApplePiPContainer(url) else {
            airPlayNotice = airPlayAudioOnlyHint(for: url)
            return
        }

        isPreparing = true
        airPlayNotice = nil
        self.engine = engine
        sourceWasPlaying = engine.isPlaying

        AudioSession.activateForVideoPlayback()
        engine.suspendForAVKitHandoff()
        let loaded = await loadAVPlayerItem(from: engine, autoplay: sourceWasPlaying)
        guard loaded else {
            engine.resumeFromAVKitHandoff(at: engine.currentTime, resume: sourceWasPlaying)
            isPreparing = false
            airPlayNotice = "Nie udało się uruchomić AirPlay wideo dla tego źródła."
            return
        }

        if let host = hostView {
            attach(to: host)
        }
        for _ in 0..<25 {
            if avPlayer.isExternalPlaybackActive || Self.isAirPlayVideoRoute(AVAudioSession.sharedInstance()) {
                break
            }
            try? await Task.sleep(nanoseconds: 80_000_000)
        }

        isExternalPlaybackActive = true
        isPreparing = false
        externalDeviceName = Self.airPlayOutputName(AVAudioSession.sharedInstance())
        startExternalTimeObserver()
        objectWillChange.send()
    }

    private func endExternalPlayback(transferToVLC: Bool) {
        guard isExternalPlaybackActive || avPlayer.currentItem != nil else { return }
        stopExternalTimeObserver()

        let seconds = avPlayer.currentTime().seconds
        let shouldResume = avPlayer.rate > 0 || sourceWasPlaying
        let engineRef = engine

        avPlayer.pause()
        avPlayer.replaceCurrentItem(with: nil)
        isExternalPlaybackActive = false
        externalDeviceName = nil
        airPlayNotice = nil

        if transferToVLC, let engineRef {
            engineRef.resumeFromAVKitHandoff(
                at: seconds.isFinite ? seconds : engineRef.currentTime,
                resume: shouldResume
            )
        }
        objectWillChange.send()
    }

    @discardableResult
    private func loadAVPlayerItem(from engine: VideoPlaybackEngine, autoplay: Bool) async -> Bool {
        guard let url = engine.currentPlayableURL else { return false }

        let asset = AVURLAsset(url: url)
        let playable = (try? await asset.load(.isPlayable)) == true
        guard playable else { return false }

        let item = AVPlayerItem(asset: asset)
        avPlayer.replaceCurrentItem(with: item)

        for _ in 0..<40 {
            if item.status == .readyToPlay { break }
            if item.status == .failed { return false }
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
        guard item.status == .readyToPlay else { return false }

        let target = CMTime(seconds: max(0, engine.currentTime), preferredTimescale: 600)
        await avPlayer.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero)

        if autoplay {
            avPlayer.play()
            engine.syncExternalPlayback(time: engine.currentTime, isPlaying: true)
        } else {
            avPlayer.pause()
        }
        return true
    }

    private func startExternalTimeObserver() {
        stopExternalTimeObserver()
        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        timeObserver = avPlayer.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            Task { @MainActor in
                guard let self, self.isExternalPlaybackActive else { return }
                self.engine?.syncExternalPlayback(
                    time: time.seconds,
                    isPlaying: self.avPlayer.rate > 0
                )
            }
        }
    }

    private func stopExternalTimeObserver() {
        if let timeObserver {
            avPlayer.removeTimeObserver(timeObserver)
            self.timeObserver = nil
        }
    }

    private func startPiPTimeObserver() {
        stopPiPTimeObserver()
        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        pipTimeObserver = avPlayer.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            Task { @MainActor in
                guard let self, self.isActive else { return }
                self.engine?.syncExternalPlayback(
                    time: time.seconds,
                    isPlaying: self.avPlayer.rate > 0
                )
                self.engine?.enforceAVKitSuspension()
            }
        }
    }

    private func stopPiPTimeObserver() {
        if let pipTimeObserver {
            avPlayer.removeTimeObserver(pipTimeObserver)
            self.pipTimeObserver = nil
        }
        rateObserver?.invalidate()
        rateObserver = nil
    }

    /// AVPlayer musi mieć klatkę zanim PiP się otworzy — inaczej okno jest zamrożone.
    private func waitUntilAVPlayerHasVideo(maxSeconds: TimeInterval) async -> Bool {
        let deadline = Date().addingTimeInterval(maxSeconds)
        var lastTime = avPlayer.currentTime().seconds

        while Date() < deadline {
            if Task.isCancelled { return false }
            guard let item = avPlayer.currentItem else { return false }
            if item.status == .failed { return false }

            let ready = item.status == .readyToPlay
            let layerReady = playerLayer.isReadyForDisplay
            let t = avPlayer.currentTime().seconds
            let timeAdvancing = t.isFinite && abs(t - lastTime) > 0.05
            lastTime = t

            if ready && (layerReady || timeAdvancing || t > 0.2) {
                if sourceWasPlaying {
                    if avPlayer.rate > 0 || avPlayer.timeControlStatus == .playing {
                        return true
                    }
                } else if ready && layerReady {
                    return true
                }
            }

            if sourceWasPlaying, avPlayer.rate == 0, avPlayer.timeControlStatus != .playing {
                avPlayer.play()
            }
            try? await Task.sleep(nanoseconds: 60_000_000)
        }

        return avPlayer.currentItem?.status == .readyToPlay && playerLayer.isReadyForDisplay
    }

    private func ensureVLCSilentDuringPiP() {
        engine?.enforceAVKitSuspension()
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

            guard await self.loadAVPlayerItem(from: engine, autoplay: false) else {
                self.transferBackToVLC()
                self.onFallbackMinimize?()
                return
            }

            AudioSession.activateForVideoPlayback()
            engine.suspendForAVKitHandoff()

            if self.sourceWasPlaying {
                self.avPlayer.play()
                guard await self.waitUntilAVPlayerHasVideo(maxSeconds: 4.5) else {
                    self.transferBackToVLC()
                    self.onFallbackMinimize?()
                    return
                }
            } else {
                await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                    self.avPlayer.preroll(atRate: 1) { _ in continuation.resume() }
                }
                self.avPlayer.pause()
                _ = await self.waitUntilAVPlayerHasVideo(maxSeconds: 2.5)
            }

            if let host = self.hostView {
                self.attach(to: host)
            }
            self.ensureVLCSilentDuringPiP()

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
        externalTask?.cancel()
        stopPiPTimeObserver()
        stopExternalTimeObserver()
        endExternalPlayback(transferToVLC: false)
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
        stopPiPTimeObserver()
        stopExternalTimeObserver()
        let seconds = avPlayer.currentTime().seconds
        let shouldResume = avPlayer.rate > 0 || sourceWasPlaying
        let engineRef = engine
        avPlayer.pause()
        avPlayer.replaceCurrentItem(with: nil)
        if let engineRef {
            engineRef.resumeFromAVKitHandoff(
                at: seconds.isFinite ? seconds : engineRef.currentTime,
                resume: shouldResume
            )
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
            ensureVLCSilentDuringPiP()
            if sourceWasPlaying, avPlayer.rate == 0 {
                avPlayer.play()
            }
            startPiPTimeObserver()
            onStarted?()
        }
    }

    nonisolated func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        setPlaying playing: Bool
    ) {
        Task { @MainActor in
            ensureVLCSilentDuringPiP()
            if playing {
                avPlayer.play()
            } else {
                avPlayer.pause()
            }
            engine?.syncExternalPlayback(
                time: avPlayer.currentTime().seconds,
                isPlaying: playing
            )
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
            stopPiPTimeObserver()
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

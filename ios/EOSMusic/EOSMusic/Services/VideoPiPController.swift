import AVFoundation
import AVKit
import SwiftUI
import UIKit

enum VideoHandoffState: Equatable {
    case idle
    case preparingPiP
    case preparingAirPlay
    case pictureInPicture
    case airPlay
    case restoringVLC
    case failed(String)

    var isTransitioning: Bool {
        switch self {
        case .preparingPiP, .preparingAirPlay, .restoringVLC: return true
        default: return false
        }
    }

    var avPlayerOwnsTransport: Bool {
        switch self {
        case .pictureInPicture, .airPlay: return true
        default: return false
        }
    }
}

enum VideoHandoffPolicy {
    static func canSuspendVLC(
        avPlayerReady: Bool,
        hasVideoFrame: Bool,
        destinationAvailable: Bool
    ) -> Bool {
        avPlayerReady && hasVideoFrame && destinationAvailable
    }
}

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
    @Published private(set) var handoffState: VideoHandoffState = .idle

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
    /// Pełne zamknięcie playera — nie wznawiaj VLC po `stopPictureInPicture`.
    private var isDiscardingPlayback = false
    private var isEndingExternal = false
    private var startTask: Task<Void, Never>?
    private var externalTask: Task<Void, Never>?
    private var routeObserver: NSObjectProtocol?
    private var timeObserver: Any?
    private var pipTimeObserver: Any?
    private var externalEndObserver: NSObjectProtocol?
    private var rateObserver: NSKeyValueObservation?
    private var externalActiveObserver: NSKeyValueObservation?

    private func setHandoffState(_ state: VideoHandoffState) {
        handoffState = state
        isPreparing = state.isTransitioning && state != .restoringVLC
    }

    private func failHandoff(_ message: String, airPlay: Bool) {
        avPlayer.pause()
        avPlayer.isMuted = false
        if let engine, engine.isSuspendedForAVKit {
            engine.resumeFromAVKitHandoff(at: engine.currentTime, resume: sourceWasPlaying)
        }
        setHandoffState(.failed(message))
        if airPlay {
            airPlayNotice = message
        } else {
            errorMessage = message
        }
    }

    override init() {
        super.init()
        avPlayer.allowsExternalPlayback = true
        avPlayer.usesExternalPlaybackWhileExternalScreenIsActive = true
        playerLayer.player = avPlayer
        playerLayer.videoGravity = .resizeAspect
        // AVKit needs a real sampling surface (≥ ~160pt) or PiP/AirPlay video never becomes possible.
        playerLayer.frame = Self.sampleLayerFrame
        installRouteObserver()
        installExternalPlaybackObserver()
        installExternalActiveObserver()
    }

    private static let sampleLayerFrame = CGRect(x: 0, y: 0, width: 320, height: 180)

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
        externalActiveObserver?.invalidate()
    }

    var isSystemSupported: Bool {
        AVPictureInPictureController.isPictureInPictureSupported()
    }

    func supportsCurrentItem(_ engine: VideoPlaybackEngine) -> Bool {
        guard let url = engine.currentPlayableURL else { return false }
        return Self.isApplePiPContainer(url)
    }

    /// Przed wyborem trasy AirPlay — wczytaj AVPlayer, żeby TV dostało wideo, nie sam dźwięk z VLC.
    /// `userInitiated`: komunikat tylko gdy użytkownik sam kliknął AirPlay — nigdy przy starcie filmu.
    func prepareAirPlayHandoff(for engine: VideoPlaybackEngine, userInitiated: Bool = false) {
        guard supportsCurrentItem(engine) else {
            if userInitiated {
                airPlayNotice = airPlayAudioOnlyHint(for: engine.currentPlayableURL)
            }
            return
        }
        airPlayNotice = nil
        self.engine = engine
        if let host = hostView {
            attach(to: host)
        } else {
            ensureController()
        }
        AudioSession.activateForVideoPlayback()
        externalTask?.cancel()
        externalTask = Task { @MainActor [weak self] in
            guard let self else { return }
            guard await self.loadAVPlayerItem(from: engine, autoplay: false) else { return }
            await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                self.avPlayer.preroll(atRate: 1) { _ in continuation.resume() }
            }
            self.avPlayer.pause()
            _ = await self.waitUntilAVPlayerHasVideo(maxSeconds: 2.0)
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
        layoutSampleLayer(in: host)
        ensureController()
    }

    private func layoutSampleLayer(in host: UIView) {
        let bounds = host.bounds
        if bounds.width >= 160, bounds.height >= 90 {
            playerLayer.frame = bounds
        } else {
            playerLayer.frame = Self.sampleLayerFrame
            host.bounds = Self.sampleLayerFrame
        }
        playerLayer.contentsScale = host.window?.screen.scale ?? UIScreen.main.scale
    }

    private func ensureController() {
        if controller == nil {
            guard let pip = AVPictureInPictureController(playerLayer: playerLayer) else { return }
            pip.delegate = self
            pip.canStartPictureInPictureAutomaticallyFromInline = false
            if #available(iOS 16.0, *) {
                pip.requiresLinearPlayback = false
            }
            controller = pip
        }
    }

    private func installExternalActiveObserver() {
        externalActiveObserver = avPlayer.observe(\.isExternalPlaybackActive, options: [.new]) { [weak self] player, _ in
            Task { @MainActor in
                guard let self else { return }
                if player.isExternalPlaybackActive {
                    if !self.isExternalPlaybackActive, let engine = self.engine, !self.isActive {
                        await self.beginExternalPlayback(engine: engine)
                    } else {
                        self.isExternalPlaybackActive = true
                        self.externalDeviceName = Self.airPlayOutputName(AVAudioSession.sharedInstance())
                            ?? self.externalDeviceName
                    }
                } else if self.isExternalPlaybackActive {
                    self.endExternalPlayback(transferToVLC: true)
                }
            }
        }
    }

    /// Nagłówki HTTP dla streamów EOS (token w URL + sesja Bearer dla /api/file/).
    private static func authenticatedRequest(for url: URL) -> URLRequest? {
        var request = URLRequest(url: url)
        request.setValue(AppConfig.userAgent, forHTTPHeaderField: "User-Agent")
        let path = url.path.lowercased()
        if path.contains("/api/file/")
            || path.contains("/api/movies/stream/")
            || path.contains("/api/play/")
            || path.contains("/api/music/stream/")
        {
            if let token = SessionStore.load()?.token {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        }
        return request
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
            // HDMI/AVB na Macu i iPadzie z monitorem to zwykły ekran — nie Apple TV.
            port.portType == .airPlay
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
        guard !isExternalPlaybackActive, !isActive, !isPreparing else { return }
        guard let url = engine.currentPlayableURL else { return }

        guard Self.isApplePiPContainer(url) else {
            airPlayNotice = airPlayAudioOnlyHint(for: url)
            setHandoffState(.failed(airPlayNotice ?? "Nieobsługiwany format AirPlay."))
            return
        }

        setHandoffState(.preparingAirPlay)
        airPlayNotice = nil
        self.engine = engine
        sourceWasPlaying = engine.isPlaying

        AudioSession.activateForVideoPlayback(force: true)
        // Warm AVPlayer silently while VLC remains the sole audible source.
        avPlayer.isMuted = true
        let loaded = await loadAVPlayerItem(from: engine, autoplay: false)
        guard loaded else {
            failHandoff("Nie udało się uruchomić AirPlay wideo dla tego źródła.", airPlay: true)
            return
        }

        if let host = hostView {
            attach(to: host)
        }
        if sourceWasPlaying {
            avPlayer.play()
        } else {
            await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                avPlayer.preroll(atRate: 1) { _ in continuation.resume() }
            }
        }
        let hasVideo = await waitUntilAVPlayerHasVideo(maxSeconds: 5.0)
        avPlayer.pause()
        guard hasVideo else {
            failHandoff("AirPlay nie otrzymał klatki wideo. VLC pozostaje aktywny.", airPlay: true)
            return
        }

        for _ in 0..<40 {
            if avPlayer.isExternalPlaybackActive || Self.isAirPlayVideoRoute(AVAudioSession.sharedInstance()) {
                break
            }
            try? await Task.sleep(nanoseconds: 80_000_000)
        }

        let routeOK = Self.isAirPlayVideoRoute(AVAudioSession.sharedInstance())
        let avOK = avPlayer.isExternalPlaybackActive
        guard VideoHandoffPolicy.canSuspendVLC(
            avPlayerReady: avPlayer.currentItem?.status == .readyToPlay,
            hasVideoFrame: hasVideo,
            destinationAvailable: routeOK || avOK
        ) else {
            failHandoff("AirPlay wideo nie przejął streamu. Spróbuj ponownie albo użyj Lustrzanego odbicia.", airPlay: true)
            return
        }

        // Atomic ownership handoff: AVPlayer is ready first, only now silence VLC.
        engine.suspendForAVKitHandoff()
        avPlayer.isMuted = false
        if sourceWasPlaying || routeOK {
            avPlayer.play()
        }

        isExternalPlaybackActive = true
        setHandoffState(.airPlay)
        externalDeviceName = Self.airPlayOutputName(AVAudioSession.sharedInstance())
            ?? "AirPlay"
        startExternalTimeObserver()
        objectWillChange.send()
    }

    private func endExternalPlayback(transferToVLC: Bool) {
        guard !isEndingExternal else { return }
        guard isExternalPlaybackActive || avPlayer.currentItem != nil else { return }
        isEndingExternal = true
        defer { isEndingExternal = false }
        setHandoffState(.restoringVLC)
        stopExternalTimeObserver()

        let seconds = avPlayer.currentTime().seconds
        let shouldResume = avPlayer.rate > 0 || sourceWasPlaying
        let engineRef = engine

        avPlayer.pause()
        avPlayer.isMuted = false
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
        setHandoffState(.idle)
        objectWillChange.send()
    }

    @discardableResult
    private func loadAVPlayerItem(from engine: VideoPlaybackEngine, autoplay: Bool) async -> Bool {
        guard let url = engine.currentPlayableURL else { return false }

        let asset: AVURLAsset
        if let request = Self.authenticatedRequest(for: url) {
            asset = AVURLAsset(url: url, options: ["AVURLAssetHTTPHeaderFieldsKey": request.allHTTPHeaderFields ?? [:]])
        } else {
            asset = AVURLAsset(url: url)
        }
        let playable = (try? await asset.load(.isPlayable)) == true
        guard playable, !Task.isCancelled else { return false }

        let item = AVPlayerItem(asset: asset)
        avPlayer.replaceCurrentItem(with: item)

        for _ in 0..<40 {
            if Task.isCancelled { return false }
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

        // Non-Apple containers: brak systemowego PiP — poinformuj użytkownika.
        guard Self.isApplePiPContainer(url) else {
            errorMessage = "PiP wymaga MP4/MOV/HLS. Ten format (\(url.pathExtension.isEmpty ? "?" : url.pathExtension.uppercased())) — użyj Pobierz MP4 lub lustrzane odbicie."
            return
        }

        setHandoffState(.preparingPiP)
        errorMessage = nil
        self.engine = engine
        sourceWasPlaying = engine.isPlaying
        ensureController()

        startTask?.cancel()
        startTask = Task { @MainActor [weak self] in
            guard let self else { return }
            let asset: AVURLAsset
            if let request = Self.authenticatedRequest(for: url) {
                asset = AVURLAsset(url: url, options: ["AVURLAssetHTTPHeaderFieldsKey": request.allHTTPHeaderFields ?? [:]])
            } else {
                asset = AVURLAsset(url: url)
            }
            let playable = (try? await asset.load(.isPlayable)) == true
            guard !Task.isCancelled else { return }
            guard playable else {
                self.failHandoff("Ten stream nie obsługuje PiP w EOS — spróbuj MP4 lub pobierz na serwer.", airPlay: false)
                return
            }

            self.avPlayer.isMuted = true
            guard await self.loadAVPlayerItem(from: engine, autoplay: false) else {
                self.failHandoff("Nie udało się przygotować PiP dla tego źródła.", airPlay: false)
                return
            }

            AudioSession.activateForVideoPlayback()
            if self.sourceWasPlaying {
                self.avPlayer.play()
                guard await self.waitUntilAVPlayerHasVideo(maxSeconds: 8.0) else {
                    self.failHandoff("PiP: brak klatek wideo — VLC pozostaje aktywny.", airPlay: false)
                    return
                }
                self.avPlayer.pause()
            } else {
                await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                    self.avPlayer.preroll(atRate: 1) { _ in continuation.resume() }
                }
                self.avPlayer.pause()
                guard await self.waitUntilAVPlayerHasVideo(maxSeconds: 4.0) else {
                    self.failHandoff("PiP nie otrzymał gotowej klatki wideo.", airPlay: false)
                    return
                }
            }

            if let host = self.hostView {
                self.attach(to: host)
            } else {
                self.ensureController()
            }
            guard VideoHandoffPolicy.canSuspendVLC(
                avPlayerReady: self.avPlayer.currentItem?.status == .readyToPlay,
                hasVideoFrame: true,
                destinationAvailable: self.isSystemSupported
            ) else {
                self.failHandoff("PiP nie jest gotowy do bezpiecznego przejęcia obrazu.", airPlay: false)
                return
            }
            // AVPlayer has a frame; hand off audio/video ownership only now.
            engine.suspendForAVKitHandoff()
            self.avPlayer.isMuted = false
            if self.sourceWasPlaying {
                self.avPlayer.play()
            }
            self.ensureVLCSilentDuringPiP()

            for _ in 0..<50 {
                if Task.isCancelled { return }
                if let controller = self.controller, controller.isPictureInPicturePossible {
                    controller.startPictureInPicture()
                    // Give AVKit a moment; success is confirmed via delegate.
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    if self.isActive || controller.isPictureInPictureActive {
                        return
                    }
                }
                try? await Task.sleep(nanoseconds: 80_000_000)
            }

            self.failHandoff("PiP nie jest jeszcze gotowy. VLC zostało przywrócone.", airPlay: false)
        }
        await startTask?.value
    }

    func stop() {
        startTask?.cancel()
        controller?.stopPictureInPicture()
    }

    /// Pełne zatrzymanie PiP / AirPlay — bez wznawiania VLC (zatrzyma `engine.stop()`).
    func stopAndDiscard(engine: VideoPlaybackEngine? = nil) {
        isDiscardingPlayback = true
        startTask?.cancel()
        externalTask?.cancel()
        stopPiPTimeObserver()
        stopExternalTimeObserver()

        avPlayer.pause()
        avPlayer.isMuted = false
        avPlayer.replaceCurrentItem(with: nil)

        if isExternalPlaybackActive, let engine {
            engine.cancelAVKitHandoff()
        }

        let pipWasActive = isActive
        controller?.stopPictureInPicture()

        if let engine, engine.isSuspendedForAVKit {
            engine.cancelAVKitHandoff()
        }

        setHandoffState(.idle)
        isActive = false
        isExternalPlaybackActive = false
        externalDeviceName = nil
        airPlayNotice = nil
        self.engine = nil

        if !pipWasActive {
            isDiscardingPlayback = false
        }
    }

    func stopAndDiscard() {
        stopAndDiscard(engine: engine)
    }

    func clearError() {
        errorMessage = nil
    }

    func clearAirPlayNotice() {
        airPlayNotice = nil
    }

    private func transferBackToVLC() {
        guard !isDiscardingPlayback else { return }
        guard !isTransferringBack else { return }
        guard let engineRef = engine, engineRef.currentItem != nil else {
            engine = nil
            return
        }
        isTransferringBack = true
        setHandoffState(.restoringVLC)
        stopPiPTimeObserver()
        stopExternalTimeObserver()
        let seconds = avPlayer.currentTime().seconds
        let shouldResume = avPlayer.rate > 0 || sourceWasPlaying
        avPlayer.pause()
        avPlayer.isMuted = false
        avPlayer.replaceCurrentItem(with: nil)
        engineRef.resumeFromAVKitHandoff(
            at: seconds.isFinite ? seconds : engineRef.currentTime,
            resume: shouldResume
        )
        engineRef.kickVideoOutput()
        engine = nil
        isTransferringBack = false
        setHandoffState(.idle)
    }
}

extension VideoPiPController: AVPictureInPictureControllerDelegate {
    nonisolated func pictureInPictureControllerDidStartPictureInPicture(
        _ pictureInPictureController: AVPictureInPictureController
    ) {
        Task { @MainActor in
            isActive = true
            setHandoffState(.pictureInPicture)
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
            isActive = false
            transferBackToVLC()
            let message = "PiP niedostępny: \(error.localizedDescription)"
            errorMessage = message
            setHandoffState(.failed(message))
        }
    }

    nonisolated func pictureInPictureControllerDidStopPictureInPicture(
        _ pictureInPictureController: AVPictureInPictureController
    ) {
        Task { @MainActor in
            stopPiPTimeObserver()
            if !isDiscardingPlayback {
                transferBackToVLC()
            }
            isActive = false
            isDiscardingPlayback = false
            if !isTransferringBack {
                setHandoffState(.idle)
            }
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
        let view = UIView(frame: CGRect(x: 0, y: 0, width: 320, height: 180))
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = false
        view.isOpaque = false
        controller.attach(to: view)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        if uiView.bounds.width < 160 || uiView.bounds.height < 90 {
            uiView.bounds = CGRect(x: 0, y: 0, width: 320, height: 180)
        }
        controller.attach(to: uiView)
    }
}

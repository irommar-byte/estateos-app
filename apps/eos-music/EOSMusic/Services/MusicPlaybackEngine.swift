import AVFoundation
import Accelerate
import Combine
import MediaToolbox
import os
import SwiftUI
import UIKit

enum RepeatMode: String, CaseIterable {
    case off, all, one

    var label: String {
        switch self {
        case .off: return "Wył."
        case .all: return "Playlista"
        case .one: return "Utwór"
        }
    }

    var icon: String {
        switch self {
        case .off: return "repeat"
        case .all: return "repeat"
        case .one: return "repeat.1"
        }
    }

    var queueHint: String {
        switch self {
        case .off: return "Po ostatnim utworze odtwarzanie się zatrzyma."
        case .all: return "Po ostatnim utworze wraca na początek listy."
        case .one: return "Ten sam utwór odtwarza się w kółko."
        }
    }
}

/// One row in the visible playback order (respects shuffle).
struct PlaybackQueueRow: Identifiable, Equatable {
    let orderIndex: Int
    let displayNumber: Int
    let track: MusicPlaybackTrack
    let isCurrent: Bool
    let isPast: Bool

    var id: String { "\(orderIndex)-\(track.id)" }
}

@MainActor
final class MusicPlaybackEngine: ObservableObject {
    struct AudioReactiveFrame {
        static let islandBarCount = 5
        /// 24 bands — classic Winamp density without SwiftUI thrash (UIKit host).
        static let spectrumBandCountStandard = 24
        static let spectrumBandCountDense = 32
        static let spectrumBandCountMax = spectrumBandCountDense

        var level: Double = 0
        var bass: Double = 0
        var mid: Double = 0
        var treble: Double = 0
        var beat: Double = 0
        var islandBars: [Double] = Array(repeating: 0, count: islandBarCount)
        /// Surowe cele pasma 0…1 z analizy audio (bez envelope UI).
        var spectrumBands: [Double] = Array(repeating: 0, count: spectrumBandCountMax)
        var peakHold: [Double] = Array(repeating: 0, count: spectrumBandCountMax)
        var energy: Double = 0
        var activeSpectrumBands: Int = spectrumBandCountStandard

        /// Płynna siła wizualna: cichy dźwięk = mała, mocny = duża (z headroomem przeciw przesterowi).
        func visualDrive(isStrong: Bool, intensity: Double = 1) -> Double {
            let gain = (isStrong ? 0.88 : 0.76) * min(1, max(0, intensity))
            let base = level * 0.82 + bass * 0.1
            let punch = beat * 0.52
            let combined = (base + punch) * gain
            guard combined > 0.02 else { return 0 }
            return pow(min(1, combined), 1.18)
        }

        func spotIntensity(isStrong: Bool, intensity: Double = 1) -> Double {
            let drive = visualDrive(isStrong: isStrong, intensity: intensity)
            guard drive > 0.015 else { return 0 }
            return pow(min(1, drive * 0.5 + beat * 0.32), 1.12)
        }

        /// Cheap pseudo-reactive frame — no MTAudioProcessingTap / FFT (those pegged CPU ~110% on device).
        static func synthesize(at time: TimeInterval, isPlaying: Bool) -> AudioReactiveFrame {
            guard isPlaying else {
                var idle = AudioReactiveFrame()
                idle.level = 0.04
                idle.bass = 0.05
                idle.mid = 0.04
                idle.treble = 0.03
                idle.energy = 0.04
                idle.islandBars = [0.12, 0.18, 0.22, 0.16, 0.1]
                idle.activeSpectrumBands = spectrumBandCountStandard
                for i in 0..<spectrumBandCountStandard {
                    idle.spectrumBands[i] = 0.04 + Double(i % 3) * 0.01
                }
                return idle
            }

            // Fast, punchy pseudo-spectrum — high temporal energy so EQ feels live.
            let kick = max(0, sin(time * .pi * 4.6))
            let kickPulse = pow(kick, 3.4)
            let snare = max(0, sin(time * .pi * 4.6 + 1.05))
            let snarePulse = pow(snare, 4.2) * 0.7
            let hat = max(0, sin(time * .pi * 9.2 + 0.4))
            let hatPulse = pow(hat, 5.0) * 0.55
            let shimmer = 0.5 + 0.5 * sin(time * 17.5)
            let flutter = 0.5 + 0.5 * sin(time * 31.0)

            var frame = AudioReactiveFrame()
            frame.beat = min(1, kickPulse * 1.0 + snarePulse * 0.4)
            frame.bass = min(1, 0.22 + kickPulse * 0.85 + 0.1 * sin(time * 3.1))
            frame.mid = min(1, 0.18 + snarePulse * 0.7 + 0.22 * shimmer)
            frame.treble = min(1, 0.14 + hatPulse * 0.75 + 0.28 * flutter + snarePulse * 0.2)
            frame.level = min(1, frame.bass * 0.42 + frame.mid * 0.33 + frame.treble * 0.25)
            frame.energy = frame.level
            frame.activeSpectrumBands = spectrumBandCountStandard

            let count = spectrumBandCountStandard
            // Quantize time so bands "spark" in quick steps (~45 Hz motion).
            let spark = floor(time * 45.0)
            for i in 0..<count {
                let t = Double(i) / Double(max(1, count - 1))
                let bassWeight = exp(-t * 3.4)
                let midWeight = exp(-pow(t - 0.42, 2) * 11)
                let trebleWeight = exp(-pow(t - 0.88, 2) * 16)
                let wander = 0.42 + 0.58 * sin(time * (4.8 + t * 9.0) + Double(i) * 0.85)
                let seed = sin((spark + Double(i) * 17.13) * 12.9898) * 43758.5453
                let noise = seed - floor(seed)
                let punch = kickPulse * bassWeight * 1.15 + snarePulse * midWeight + hatPulse * trebleWeight
                let raw = (frame.bass * bassWeight + frame.mid * midWeight + frame.treble * trebleWeight) * wander
                    + punch * 0.75
                    + noise * (0.08 + trebleWeight * 0.22)
                    + 0.1 * sin(time * 22 + Double(i) * 1.3)
                frame.spectrumBands[i] = min(1, max(0.02, raw))
            }

            frame.islandBars = [
                min(1, frame.bass * 0.95),
                min(1, frame.bass * 0.35 + frame.mid * 0.55),
                min(1, frame.level * 0.85 + frame.beat * 0.2),
                min(1, frame.mid * 0.5 + frame.treble * 0.4),
                min(1, frame.treble * 0.8 + frame.beat * 0.15)
            ]
            return frame
        }

        func islandBar(at index: Int) -> Double {
            guard islandBars.indices.contains(index) else { return 0 }
            return islandBars[index]
        }

        func spectrumBand(at index: Int) -> Double {
            guard index < activeSpectrumBands, spectrumBands.indices.contains(index) else { return 0 }
            return spectrumBands[index]
        }

        func peak(at index: Int) -> Double {
            guard index < activeSpectrumBands, peakHold.indices.contains(index) else { return 0 }
            return peakHold[index]
        }
    }

    func setSpectrumBandCount(_ count: Int) {
        audioAnalyzer.setBandCount(count)
    }

    @Published private(set) var currentTrack: MusicPlaybackTrack?
    /// Embedded / hydrated cover bitmap — keeps iPad hero + mini-player from showing empty note placeholders.
    @Published private(set) var displayArtwork: UIImage?
    @Published private(set) var isPlaying = false
    @Published private(set) var isLoading = false
    /// Not @Published — buffering flicker must not rebuild FullPlayer / lists.
    private(set) var isBuffering = false {
        didSet { statusFlags.isBuffering = isBuffering }
    }
    let statusFlags = PlaybackStatusFlags()
    /// Cached only for seek / skip heuristics — UI reads `livePlaybackTime()` (no 0.5s publish).
    private(set) var currentTime: Double = 0
    private(set) var duration: Double = 0
    @Published var shuffleEnabled = false
    @Published var repeatMode: RepeatMode = .all
    @Published var errorMessage: String?
    @Published private(set) var playbackOrigin: MediaPlaybackOrigin = .unknown
    /// When true, never open network streams — local files only.
    var offlineOnly = false
    let visualizer = PlayerAudioVisualizer()

    /// Live AVPlayer clock — no Combine / @Published, safe to poll from scrubber TimelineView.
    func livePlaybackTime() -> Double {
        if let seconds = player?.currentTime().seconds, seconds.isFinite, seconds >= 0 {
            return seconds
        }
        return currentTime
    }

    func liveDuration() -> Double {
        if let seconds = player?.currentItem?.duration.seconds, seconds.isFinite, seconds > 0 {
            return seconds
        }
        return max(0, duration)
    }

    var audioFrame: AudioReactiveFrame { visualizer.frame }

    /// Lekka analiza PCM → visualizer (lock, bez SwiftUI publish).
    /// Mini: tylko RMS / island. Full Spectrum: FFT bin average na tickach publish.
    func syncVisualAnalysis(
        surface: PlayerVisualSurface,
        policy: PlayerVisualPolicy,
        needsSpectrum: Bool,
        isPlaying: Bool,
        isLoading: Bool
    ) {
        let wantsAnalysis = surface != .none
            && policy.enabled
            && isPlaying
            && !isLoading
            && policy.analyzerFPS > 0.5
        // Keep analyzing through brief ready-remote buffer blips — otherwise EQ dies while "Buforowanie…" flashes.

        let fps: Double
        if wantsAnalysis {
            switch surface {
            case .none:
                fps = 0
            case .mini:
                // Island bars only — keep cheap.
                fps = min(18, max(12, policy.analyzerFPS))
            case .full:
                fps = needsSpectrum
                    ? min(22, max(16, policy.analyzerFPS))
                    : min(16, max(12, policy.analyzerFPS))
            }
        } else {
            fps = 0
        }

        let active = wantsAnalysis && fps > 0.5
        visualAnalysisEnabled = active
        visualAnalysisFPS = fps
        visualNeedsSpectrum = active && needsSpectrum
        audioAnalyzer.setSpectrumEnabled(visualNeedsSpectrum)

        if active {
            audioAnalyzer.setAnalysisEnabled(true)
            audioAnalyzer.setPublishRate(fps: fps)
            if let item = player?.currentItem {
                audioAnalyzer.ensureAttached(to: item)
            }
        } else {
            // Soft off: stop EQ/FFT publish, but keep MTAudioProcessingTap attached while
            // audio is still playing. Detaching audioMix on scene resign/background causes
            // a ~1s stutter when switching apps or collapsing the player.
            audioAnalyzer.setAnalysisEnabled(false, publishEmptyOnDisable: false)
            audioAnalyzer.setPublishRate(fps: 0)
            audioAnalyzer.setSpectrumEnabled(false)
            if !isPlaying {
                audioAnalyzer.detach(from: player?.currentItem)
                visualizer.reset()
            }
        }
    }

    func stopVisualAnalysisHard() {
        visualAnalysisEnabled = false
        visualAnalysisFPS = 0
        audioAnalyzer.setAnalysisEnabled(false, publishEmptyOnDisable: true)
        audioAnalyzer.setPublishRate(fps: 0)
        audioAnalyzer.setSpectrumEnabled(false)
        audioAnalyzer.detach(from: player?.currentItem)
        audioAnalyzer.reset()
        visualizer.reset()
    }

    private func reattachVisualAnalysis(for item: AVPlayerItem) {
        guard visualAnalysisEnabled, visualAnalysisFPS > 0.5 else {
            audioAnalyzer.detach(from: item)
            return
        }
        audioAnalyzer.ensureAttached(to: item)
    }

    private var visualAnalysisEnabled = false
    private var visualAnalysisFPS: Double = 0
    private var visualNeedsSpectrum = false

    let folderId: String?
    let folderName: String?

    private var queue: [MusicPlaybackTrack] = []
    private var playOrder: [Int] = []
    private var orderCursor = 0 {
        didSet { currentQueueIndex = orderCursor }
    }
    /// Published mirror of `orderCursor` — drives queue UI without polling AVPlayer.
    @Published private(set) var currentQueueIndex = 0
    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var failObserver: NSObjectProtocol?
    private var statusObserver: NSKeyValueObservation?
    private var rateObserver: NSKeyValueObservation?
    private var timeControlObserver: NSKeyValueObservation?
    private var likelyToKeepUpObserver: NSKeyValueObservation?
    private var seekObserver: NSObjectProtocol?
    private var audioLifecycleObservers: [NSObjectProtocol] = []
    private var resumeAfterInterruption = false
    private var api: MusicAPIClient?
    private var jobLookup: ((String) -> String?)?
    private var libraryTrackLookup: ((String) -> MusicTrack?)?
    private var externalFileResolver: ((MusicPlaybackTrack) async throws -> URL)?
    private var onTeardown: (() -> Void)?
    private let nowPlaying = NowPlayingCenter.shared
    private var audioAnalyzer = PlayerAudioAnalyzer()
    private var supplementalNowPlayingMetadata: NowPlayingCenter.SupplementalMetadata?

    /// Anuluje zaległe `play()` po `stop()` lub zmianie utworu.
    private var sessionGeneration = 0
    private var activePlayTask: Task<Void, Never>?
    private var streamRecoveryAttempts = 0
    private var continuousPlayingSince: Date?
    private var stalledObserver: NSObjectProtocol?
    /// True while the user/engine intends continuous playback (survives temporary rate=0 stalls).
    private var playbackDesired = false
    private var activeStreamJobId: String?
    private var tokenExpiresAt: Date?
    /// Reuse play-tokens across skip/prefetch — avoids an extra RTT when the file is already on server.
    private var playTokenCache: [String: CachedPlayToken] = [:]
    private var streamOpenSignpost: OSSignpostID?
    private var currentStreamIsRemote = false
    /// Known-ready remote assets start snappy; cold/unready streams keep a safer buffer.
    private var currentStreamIsReadyRemote = false

    private struct CachedPlayToken {
        let token: String
        let expiresAt: Date?
    }

    init(session: MusicPlaybackSession) {
        queue = session.queue
        folderId = session.folderId
        folderName = session.folderName
        rebuildPlayOrder(shuffled: false, anchor: session.startIndex)
    }

    func configure(
        api: MusicAPIClient,
        jobLookup: @escaping (String) -> String?,
        libraryTrackLookup: ((String) -> MusicTrack?)? = nil,
        externalFileResolver: ((MusicPlaybackTrack) async throws -> URL)? = nil,
        onTeardown: (() -> Void)? = nil
    ) {
        self.api = api
        self.jobLookup = jobLookup
        self.libraryTrackLookup = libraryTrackLookup
        self.externalFileResolver = externalFileResolver
        self.onTeardown = onTeardown
        nowPlaying.activate(
            onNext: { [weak self] in Task { await self?.skipNext() } },
            onPrevious: { [weak self] in Task { await self?.skipPrevious() } },
            onPlay: { [weak self] in self?.resume() },
            onPause: { [weak self] in self?.pause() },
            onToggle: { [weak self] in self?.togglePlayPause() }
        )
        seekObserver = NotificationCenter.default.addObserver(
            forName: .musicPlayerSeekRequested,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let seconds = note.userInfo?["time"] as? Double else { return }
            Task { @MainActor in self?.seek(to: seconds) }
        }
        installAudioLifecycleObservers()
    }

    private func installAudioLifecycleObservers() {
        removeAudioLifecycleObservers()
        let center = NotificationCenter.default
        audioLifecycleObservers = [
            center.addObserver(forName: .eosAudioSessionNeedsResume, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in
                    guard let self, self.resumeAfterInterruption || self.playbackDesired else { return }
                    self.resumeAfterInterruption = false
                    self.playbackDesired = true
                    AudioSession.activateForPlayback(force: true)
                    guard self.currentTrack != nil, self.player != nil else { return }
                    // Only call play() if we actually stopped — avoids a restart hitch.
                    if (self.player?.rate ?? 0) < 0.01 {
                        self.player?.play()
                    }
                    self.syncPlayingState()
                    self.refreshNowPlaying(force: true)
                }
            },
            center.addObserver(forName: .eosAudioSessionInterrupted, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in
                    guard let self else { return }
                    self.resumeAfterInterruption = self.playbackDesired || self.isPlaying || (self.player?.rate ?? 0) > 0
                    self.syncPlayingState()
                    self.refreshNowPlaying(force: true)
                }
            },
            center.addObserver(forName: .eosAudioSessionRouteLost, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in
                    self?.playbackDesired = false
                    self?.pause()
                }
            },
        ]
    }

    private func removeAudioLifecycleObservers() {
        for observer in audioLifecycleObservers {
            NotificationCenter.default.removeObserver(observer)
        }
        audioLifecycleObservers = []
    }

    var queuePositionLabel: String {
        guard !queue.isEmpty else { return "" }
        return "\(orderCursor + 1) / \(playOrder.count)"
    }

    /// Playlist / folder name when playback started from a collection.
    var queueSourceTitle: String? {
        guard let folderName, !folderName.isEmpty else { return nil }
        return folderName
    }

    var playbackQueueRows: [PlaybackQueueRow] {
        playOrder.enumerated().map { idx, queueIndex in
            PlaybackQueueRow(
                orderIndex: idx,
                displayNumber: idx + 1,
                track: queue[queueIndex],
                isCurrent: idx == orderCursor,
                isPast: idx < orderCursor
            )
        }
    }

    /// Jump to a specific position in the current play order (0-based).
    func jumpToOrderIndex(_ index: Int) async {
        guard index >= 0, index < playOrder.count else { return }
        await playOrderIndex(index, generation: sessionGeneration)
        BluetoothMediaBrowser.shared.reloadQueue(from: self)
    }

    /// Wyślij metadane kolejki do BMW zanim pierwszy utwór zacznie grać (NBT czyta listę przy starcie sesji).
    func publishInitialCarMetadata() {
        guard !queue.isEmpty else { return }
        let queueIndex = playOrder[safe: orderCursor] ?? playOrder.first ?? 0
        let track = queue[queueIndex]
        nowPlaying.update(
            track: track,
            duration: max(0, track.duration ?? 0),
            elapsed: 0,
            isPlaying: false,
            queueIndex: orderCursor,
            queueCount: playOrder.count,
            collectionTitle: queueSourceTitle,
            collectionPersistentSeed: folderId ?? queueSourceTitle,
            externalContentIdentifier: BluetoothMediaBrowser.queueContentIdentifier(orderIndex: orderCursor),
            force: true
        )
        BluetoothMediaBrowser.shared.preparePlaybackSession(engine: self)
    }

    func start() async {
        guard !queue.isEmpty else {
            errorMessage = "Pusta playlista."
            return
        }
        activePlayTask?.cancel()
        let generation = sessionGeneration
        activePlayTask = Task {
            await playOrderIndex(orderCursor, generation: generation)
        }
        await activePlayTask?.value
    }

    func stop() {
        sessionGeneration += 1
        activePlayTask?.cancel()
        activePlayTask = nil
        teardownPlayer()
        currentTrack = nil
        displayArtwork = nil
        playbackOrigin = .unknown
        isPlaying = false
        isLoading = false
        isBuffering = false
        playbackDesired = false
        streamRecoveryAttempts = 0
        continuousPlayingSince = nil
        activeStreamJobId = nil
        tokenExpiresAt = nil
        currentTime = 0
        duration = 0
        nowPlaying.deactivate()
        stopVisualAnalysisHard()
        if let seekObserver {
            NotificationCenter.default.removeObserver(seekObserver)
        }
        seekObserver = nil
        removeAudioLifecycleObservers()
        onTeardown?()
        onTeardown = nil
    }

    func togglePlayPause() {
        guard let player else { return }
        if isPlaying {
            playbackDesired = false
            player.pause()
        } else {
            playbackDesired = true
            AudioSession.activateForPlayback()
            player.play()
        }
        syncPlayingState()
        refreshNowPlaying(force: true)
    }

    func pause() {
        playbackDesired = false
        player?.pause()
        syncPlayingState()
        refreshNowPlaying(force: true)
    }

    func resume() {
        playbackDesired = true
        AudioSession.activateForPlayback()
        player?.play()
        syncPlayingState()
        refreshNowPlaying(force: true)
    }

    func seek(to seconds: Double) {
        let time = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        player?.seek(to: time)
        currentTime = max(0, seconds)
        refreshNowPlaying(force: true)
    }

    func skipNext() async {
        guard !queue.isEmpty else { return }
        if orderCursor < playOrder.count - 1 {
            orderCursor += 1
        } else if repeatMode == .all {
            orderCursor = 0
        } else {
            return
        }
        await playOrderIndex(orderCursor, generation: sessionGeneration)
    }

    func skipPrevious() async {
        guard !queue.isEmpty else { return }
        if livePlaybackTime() > 3 {
            seek(to: 0)
            return
        }
        if orderCursor > 0 {
            orderCursor -= 1
        } else if repeatMode == .all {
            orderCursor = max(playOrder.count - 1, 0)
        } else {
            seek(to: 0)
            return
        }
        await playOrderIndex(orderCursor, generation: sessionGeneration)
    }

    func toggleShuffle() {
        shuffleEnabled.toggle()
        let anchor = playOrder[safe: orderCursor] ?? 0
        rebuildPlayOrder(shuffled: shuffleEnabled, anchor: anchor)
        BluetoothMediaBrowser.shared.reloadQueue(from: self)
    }

    func cycleRepeatMode() {
        switch repeatMode {
        case .off: repeatMode = .all
        case .all: repeatMode = .one
        case .one: repeatMode = .off
        }
        BluetoothMediaBrowser.shared.reloadQueue(from: self)
    }

    private func rebuildPlayOrder(shuffled: Bool, anchor: Int) {
        playOrder = Array(queue.indices)
        if shuffled {
            playOrder.shuffle()
            if let pos = playOrder.firstIndex(of: anchor) {
                playOrder.remove(at: pos)
                playOrder.insert(anchor, at: 0)
            }
        }
        orderCursor = playOrder.firstIndex(of: anchor) ?? 0
    }

    private func playOrderIndex(_ cursor: Int, generation: Int) async {
        guard generation == sessionGeneration, !Task.isCancelled else { return }
        guard cursor >= 0, cursor < playOrder.count else { return }
        orderCursor = cursor
        await play(at: playOrder[cursor], generation: generation)
    }

    private func play(at index: Int, generation: Int) async {
        guard generation == sessionGeneration, !Task.isCancelled else { return }
        guard index >= 0, index < queue.count else { return }

        let track = queue[index]
        if !track.isExternal, api == nil { return }

        teardownPlayer()

        currentTrack = track
        displayArtwork = nil
        playbackOrigin = .unknown
        isLoading = true
        isBuffering = false
        setPlaybackActivity(
            .resolvingStream,
            title: "Przygotowuję odtwarzanie",
            detail: track.title
        )
        errorMessage = nil
        streamRecoveryAttempts = 0
        continuousPlayingSince = nil
        activeStreamJobId = nil
        tokenExpiresAt = nil
        currentStreamIsReadyRemote = false
        currentTime = 0
        duration = track.duration ?? 0
        isPlaying = false
        supplementalNowPlayingMetadata = nil

        let openSignpost = EOSPerfLog.intervalBegin("StreamOpen")
        streamOpenSignpost = openSignpost
        EOSPerfLog.stream.info(
            "stream start title=\(track.title, privacy: .public) external=\(track.isExternal) onServer=\(self.isDownloaded(track))"
        )

        do {
            let streamURL = try await resolveStreamURL(for: track, forceRefresh: false)
            guard generation == sessionGeneration, !Task.isCancelled else {
                EOSPerfLog.intervalEnd("StreamOpen", id: openSignpost)
                streamOpenSignpost = nil
                return
            }
            loadStream(
                url: streamURL,
                track: track,
                queueIndex: index,
                generation: generation,
                resumeAt: 0,
                readyRemote: !streamURL.isFileURL && isDownloaded(track)
            )
            Task { [weak self] in
                await self?.prefetchUpcoming(from: index, generation: generation)
            }
        } catch {
            EOSPerfLog.intervalEnd("StreamOpen", id: openSignpost)
            streamOpenSignpost = nil
            guard generation == sessionGeneration else { return }
            isLoading = false
            isBuffering = false
            setPlaybackActivity(.error, title: "Nie można odtworzyć", detail: error.localizedDescription)
            errorMessage = error.localizedDescription
            isPlaying = false
        }
    }

    private func setPlaybackActivity(
        _ phase: PlaybackActivitySnapshot.Phase,
        title: String,
        detail: String = "",
        progress: Double? = nil
    ) {
        statusFlags.activity = PlaybackActivitySnapshot(
            phase: phase,
            title: title,
            detail: detail,
            progress: progress
        )
    }

    private func isDownloaded(_ track: MusicPlaybackTrack) -> Bool {
        if OfflineMusicStore.shared.isAvailable(track.url) { return true }
        if let jobId = track.serverAssetId, !jobId.isEmpty { return true }
        if let jobId = track.downloadJobId, !jobId.isEmpty { return true }
        if let jobId = jobLookup?(track.url), !jobId.isEmpty { return true }
        return false
    }

    private func resolveStreamURL(for track: MusicPlaybackTrack, forceRefresh: Bool) async throws -> URL {
        if track.isExternal {
            if let resolver = externalFileResolver {
                return try await resolver(track)
            }
            if let file = track.playbackFileURL {
                playbackOrigin = file.isFileURL ? .phone : .liveSource
                return file
            }
            throw APIError.server("Nie można odtworzyć pliku ze źródła.")
        }

        if let openedLocal = OpenedAudioRegistry.localURL(for: track.url) {
            activeStreamJobId = nil
            tokenExpiresAt = nil
            setPlaybackActivity(.openingLocal, title: "Importowany plik", detail: "Odtwarzam z iPhone'a")
            playbackOrigin = .phone
            return openedLocal
        }

        guard let api else { throw APIError.server("Brak połączenia z serwerem.") }

        if let local = OfflineMusicStore.shared.localURL(for: track.url) {
            let useLocal: Bool
            if offlineOnly {
                useLocal = true
            } else {
                // Wrong download / swapped file: ID3 says another song — prefer server stream while online.
                useLocal = !(await localFileConflicts(with: track, at: local))
            }
            if useLocal {
                activeStreamJobId = nil
                tokenExpiresAt = nil
                setPlaybackActivity(.openingLocal, title: "Plik lokalny", detail: "Odtwarzam z iPhone'a")
                playbackOrigin = .phone
                return local
            }
            EOSPerfLog.stream.warning(
                "local file metadata conflict title=\(track.title, privacy: .public) — streaming from server"
            )
        }

        if offlineOnly {
            throw APIError.server("Tryb Offline — utwór nie jest pobrany na to urządzenie.")
        }

        let knownIds = [track.serverAssetId, track.downloadJobId, jobLookup?(track.url)]
            .compactMap { $0 }
            .filter { !$0.isEmpty }

        // Ready-on-server path: reuse warm token, else one cheap play-token GET — never waitForReady.
        for jobId in knownIds {
            if !forceRefresh, let cached = cachedPlayToken(for: jobId) {
                activateStreamToken(jobId: jobId, token: cached.token, expiresAt: cached.expiresAt)
                setPlaybackActivity(
                    .onServerConnecting,
                    title: "Na serwerze EOS",
                    detail: "Łączę ze streamem (cache tokenu)"
                )
                EOSPerfLog.stream.debug("token cache hit job=\(jobId, privacy: .public)")
                playbackOrigin = .server
                return api.musicStreamURL(jobId: jobId, token: cached.token)
            }
            do {
                setPlaybackActivity(
                    .onServerConnecting,
                    title: "Na serwerze EOS",
                    detail: "Pobieram token odtwarzania…"
                )
                let token = try await api.musicPlayToken(jobId: jobId)
                rememberStreamToken(jobId: jobId, token: token.token, expiresIn: token.expiresIn)
                playbackOrigin = .server
                return api.musicStreamURL(jobId: jobId, token: token.token)
            } catch {
                // Stale id — try next / fall through to ensure.
                continue
            }
        }

        setPlaybackActivity(
            .preparingServer,
            title: "Przygotowanie na serwerze",
            detail: "Łączę z Apple Music / APLMate…",
            progress: 3
        )
        playbackOrigin = .liveSource
        let ensure = try await api.startMusicPlay(
            url: track.url,
            folderId: track.folderId,
            trackUrl: track.url
        )
        let jobId = ensure.jobId
        if let token = ensure.token, !token.isEmpty, ensure.ready == true {
            rememberStreamToken(jobId: jobId, token: token, expiresIn: nil)
            setPlaybackActivity(.onServerConnecting, title: "Stream gotowy", detail: "Otwieram odtwarzacz…")
            playbackOrigin = .liveSource
            return api.musicStreamURL(jobId: jobId, token: token)
        }
        if ensure.ready != true {
            try await api.waitForMusicPlayReady(jobId: jobId) { [weak self] progress, status in
                Task { @MainActor in
                    self?.setPlaybackActivity(
                        .preparingServer,
                        title: "Przygotowanie na serwerze",
                        detail: Self.serverStatusCaption(status),
                        progress: progress
                    )
                }
            }
        }
        setPlaybackActivity(.onServerConnecting, title: "Stream gotowy", detail: "Pobieram token…")
        let token = try await api.musicPlayToken(jobId: jobId)
        rememberStreamToken(jobId: jobId, token: token.token, expiresIn: token.expiresIn)
        playbackOrigin = .liveSource
        return api.musicStreamURL(jobId: jobId, token: token.token)
    }

    private static func serverStatusCaption(_ status: String) -> String {
        switch status {
        case "preparing": return "Analiza utworu Apple Music…"
        case "starting": return "Start zadania na serwerze…"
        case "downloading": return "Zapisuję trwałą kopię na serwerze…"
        case "done": return "Gotowe — łączę ze streamem"
        default: return status.isEmpty ? "Czekam na serwer…" : status
        }
    }

    private func localFileConflicts(with track: MusicPlaybackTrack, at fileURL: URL) async -> Bool {
        let asset = AVURLAsset(url: fileURL)
        guard let embedded = await parseEmbeddedMetadata(from: asset) else { return false }
        let conflicts = TrackMetadataEnricher.embeddedTitleConflicts(
            expectedTitle: track.title,
            embeddedTitle: embedded.title
        )
        if conflicts {
            EOSPerfLog.stream.warning(
                "ID3 mismatch expected=\(track.title, privacy: .public) embedded=\(embedded.title ?? "nil", privacy: .public)"
            )
        }
        return conflicts
    }

    private func rememberStreamToken(jobId: String, token: String, expiresIn: Int?) {
        let expiresAt = (expiresIn ?? 0) > 0
            ? Date().addingTimeInterval(TimeInterval(expiresIn!))
            : nil
        playTokenCache[jobId] = CachedPlayToken(token: token, expiresAt: expiresAt)
        activateStreamToken(jobId: jobId, token: token, expiresAt: expiresAt)
        if let expiresIn, expiresIn > 0 {
            EOSPerfLog.stream.debug("token stored job=\(jobId, privacy: .public) expiresIn=\(expiresIn)s")
        }
    }

    private func activateStreamToken(jobId: String, token: String, expiresAt: Date?) {
        _ = token
        activeStreamJobId = jobId
        tokenExpiresAt = expiresAt
    }

    private func cachedPlayToken(for jobId: String) -> CachedPlayToken? {
        guard let entry = playTokenCache[jobId] else { return nil }
        if let expiresAt = entry.expiresAt, Date().addingTimeInterval(45) >= expiresAt {
            playTokenCache.removeValue(forKey: jobId)
            return nil
        }
        return entry
    }

    private func tokenNeedsRefreshBeforeRemount() -> Bool {
        guard let tokenExpiresAt else { return false }
        // Refresh ~45s before expiry so remount does not race the cutoff.
        return Date().addingTimeInterval(45) >= tokenExpiresAt
    }

    private func isTokenAuthFailure(_ message: String) -> Bool {
        let lower = message.lowercased()
        return lower.contains("403")
            || lower.contains("401")
            || lower.contains("unauthorized")
            || lower.contains("forbidden")
    }

    /// Warm the next track so skip feels instant — never compete with active user downloads.
    private func prefetchUpcoming(from index: Int, generation: Int) async {
        guard generation == sessionGeneration, let api, !offlineOnly else { return }
        guard !MusicDownloadService.hasActiveDownloads else { return }
        let nextCursor = orderCursor + 1
        guard nextCursor >= 0, nextCursor < playOrder.count else { return }
        let qi = playOrder[nextCursor]
        guard queue.indices.contains(qi) else { return }
        let track = queue[qi]
        if track.isExternal { return }
        if OfflineMusicStore.shared.localURL(for: track.url) != nil { return }

        let knownIds = [track.serverAssetId, track.downloadJobId, jobLookup?(track.url)]
            .compactMap { $0 }
            .filter { !$0.isEmpty }

        if let jobId = knownIds.first {
            // Warm token into cache so skip/next feels instant for ready server files.
            if cachedPlayToken(for: jobId) != nil { return }
            if let token = try? await api.musicPlayToken(jobId: jobId) {
                rememberStreamToken(jobId: jobId, token: token.token, expiresIn: token.expiresIn)
            }
            return
        }

        _ = try? await api.startMusicPlay(
            url: track.url,
            folderId: track.folderId ?? folderId,
            trackUrl: track.url
        )
    }

    private func retryOpenIfNeeded(
        track: MusicPlaybackTrack,
        queueIndex: Int,
        generation: Int,
        reason: String
    ) async -> Bool {
        await attemptStreamRecovery(
            track: track,
            queueIndex: queueIndex,
            generation: generation,
            resumeAt: currentTime,
            reason: reason
        )
    }

    /// Remount stream after stall / mid-play failure, keeping position when possible.
    private func recoverFromStreamDisruption(
        track: MusicPlaybackTrack,
        queueIndex: Int,
        generation: Int,
        at seconds: Double,
        reason: String = "stall/disruption"
    ) async {
        let handled = await attemptStreamRecovery(
            track: track,
            queueIndex: queueIndex,
            generation: generation,
            resumeAt: seconds,
            reason: reason
        )
        if !handled {
            errorMessage = Self.friendlyPlaybackError(reason)
            isPlaying = false
            isLoading = false
            isBuffering = false
            refreshNowPlaying(force: true)
        }
    }

    @discardableResult
    private func attemptStreamRecovery(
        track: MusicPlaybackTrack,
        queueIndex: Int,
        generation: Int,
        resumeAt: Double,
        reason: String
    ) async -> Bool {
        guard generation == sessionGeneration, !track.isExternal else { return false }

        let authFailure = isTokenAuthFailure(reason)
        if StreamRecoveryPolicy.isFatalPlaybackError(reason), !authFailure {
            EOSPerfLog.stream.error("fatal stream error — stop retrying: \(reason, privacy: .public)")
            return false
        }

        guard let delay = StreamRecoveryPolicy.delayNanoseconds(afterAttempt: streamRecoveryAttempts) else {
            EOSPerfLog.stream.error("stream recovery exhausted after \(self.streamRecoveryAttempts) attempts")
            errorMessage = "Odtwarzanie przerwane."
            isPlaying = false
            isLoading = false
            isBuffering = false
            refreshNowPlaying(force: true)
            return true
        }

        let attempt = streamRecoveryAttempts
        streamRecoveryAttempts += 1
        continuousPlayingSince = nil
        isLoading = true
        errorMessage = nil

        let recoverySignpost = EOSPerfLog.intervalBegin("StreamRecovery")
        EOSPerfLog.stream.info(
            "stream recovery attempt=\(attempt + 1) resumeAt=\(resumeAt, format: .fixed(precision: 1)) reason=\(reason, privacy: .public) authRefresh=\(authFailure || self.tokenNeedsRefreshBeforeRemount())"
        )

        try? await Task.sleep(nanoseconds: delay)
        guard generation == sessionGeneration else {
            EOSPerfLog.intervalEnd("StreamRecovery", id: recoverySignpost)
            return true
        }

        AudioSession.activateForPlayback()
        do {
            let forceRefresh = authFailure || tokenNeedsRefreshBeforeRemount()
            let streamURL = try await resolveStreamURL(for: track, forceRefresh: forceRefresh)
            guard generation == sessionGeneration else {
                EOSPerfLog.intervalEnd("StreamRecovery", id: recoverySignpost)
                return true
            }
            loadStream(
                url: streamURL,
                track: track,
                queueIndex: queueIndex,
                generation: generation,
                resumeAt: max(0, resumeAt),
                readyRemote: !streamURL.isFileURL && isDownloaded(track)
            )
            EOSPerfLog.intervalEnd("StreamRecovery", id: recoverySignpost)
            return true
        } catch {
            EOSPerfLog.intervalEnd("StreamRecovery", id: recoverySignpost)
            let message = error.localizedDescription
            if StreamRecoveryPolicy.isFatalPlaybackError(message), !isTokenAuthFailure(message) {
                errorMessage = Self.friendlyPlaybackError(message)
                isLoading = false
                isPlaying = false
                isBuffering = false
                refreshNowPlaying(force: true)
                return true
            }
            errorMessage = Self.friendlyPlaybackError(message)
            isLoading = false
            isPlaying = false
            isBuffering = false
            refreshNowPlaying(force: true)
            return true
        }
    }

    private static func friendlyPlaybackError(_ raw: String) -> String {
        let lower = raw.lowercased()
        if lower.contains("nie można otworzyć")
            || lower.contains("cannot open")
            || lower.contains("couldn't be opened")
            || lower.contains("could not be opened")
            || lower.contains("operation stopped")
            || lower.contains("-11828")
            || lower.contains("-11800") {
            return "Nie udało się uruchomić streamu. Spróbuj ponownie za chwilę."
        }
        return raw
    }

    private func loadStream(
        url: URL,
        track: MusicPlaybackTrack,
        queueIndex: Int,
        generation: Int,
        resumeAt: Double,
        readyRemote: Bool = false
    ) {
        guard generation == sessionGeneration else { return }

        if readyRemote {
            setPlaybackActivity(.onServerConnecting, title: "Na serwerze EOS", detail: "Start odtwarzania…")
        } else if url.isFileURL {
            setPlaybackActivity(.openingLocal, title: "Plik lokalny", detail: "Buforuję audio…")
        } else {
            setPlaybackActivity(.connectingStream, title: "Łączę ze streamem", detail: track.title)
        }

        cleanupObservers()
        audioAnalyzer.detach(from: player?.currentItem)

        AudioSession.activateForPlayback()

        let item = AVPlayerItem(url: url)
        currentStreamIsRemote = !url.isFileURL
        currentStreamIsReadyRemote = readyRemote && currentStreamIsRemote
        if currentStreamIsReadyRemote {
            // File already on NAS/server — start ASAP; recovery path handles mid-track blips.
            item.preferredForwardBufferDuration = 0.5
        } else if currentStreamIsRemote {
            // Cold / still-preparing streams: larger buffer reduces mid-track death.
            item.preferredForwardBufferDuration = 6
        }
        // Push live frames off the audio thread into a lock — UIKit hosts poll (no SwiftUI storm).
        audioAnalyzer.setPublishHandler { [weak self] frame in
            self?.visualizer.apply(frame)
        }
        let newPlayer = AVPlayer(playerItem: item)
        // Local + ready-remote: snappy. Unready remote: wait for buffer.
        newPlayer.automaticallyWaitsToMinimizeStalling = currentStreamIsRemote && !currentStreamIsReadyRemote
        player = newPlayer
        reattachVisualAnalysis(for: item)
        Task { [weak self] in
            await self?.hydratePlaybackMetadata(from: item, queueIndex: queueIndex, generation: generation)
        }

        // NO periodic time observer — the old 0.5s tick published UI / Now Playing and
        // produced a metronomic hitch (EQ + controls freezing every half-second).
        // Scrubber polls `livePlaybackTime()`; lock screen advances via playbackRate.
        if let existing = timeObserver {
            newPlayer.removeTimeObserver(existing)
            timeObserver = nil
        }

        rateObserver = newPlayer.observe(\.rate, options: [.new]) { [weak self] player, _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                let t = player.currentTime().seconds
                if t.isFinite {
                    self.currentTime = max(0, t)
                }
                self.syncPlayingState()
                self.refreshNowPlaying(force: true)
            }
        }

        timeControlObserver = newPlayer.observe(\.timeControlStatus, options: [.new, .initial]) { [weak self] _, _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                self.updateBufferingState()
                self.syncPlayingState()
            }
        }

        likelyToKeepUpObserver = item.observe(\.isPlaybackLikelyToKeepUp, options: [.new, .initial]) { [weak self] _, _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                self.updateBufferingState()
            }
        }

        statusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                if item.status == .failed {
                    let raw = item.error?.localizedDescription ?? "Odtwarzanie nie powiodło się."
                    if await self.retryOpenIfNeeded(
                        track: track,
                        queueIndex: queueIndex,
                        generation: generation,
                        reason: raw
                    ) {
                        return
                    }
                    self.errorMessage = Self.friendlyPlaybackError(raw)
                    self.isPlaying = false
                    self.isLoading = false
                    self.isBuffering = false
                } else if item.status == .readyToPlay {
                    self.isLoading = false
                    let d = item.duration.seconds
                    if d.isFinite, d > 0 {
                        self.duration = d
                    }
                    self.updateBufferingState()
                    if !self.isBuffering {
                        self.setPlaybackActivity(.playing, title: "Odtwarzanie", detail: track.title)
                    }
                    if let signpost = self.streamOpenSignpost {
                        EOSPerfLog.intervalEnd("StreamOpen", id: signpost)
                        self.streamOpenSignpost = nil
                        EOSPerfLog.stream.info("stream ready title=\(track.title, privacy: .public)")
                    }
                    self.reattachVisualAnalysis(for: item)
                    self.syncPlayingState()
                    self.refreshNowPlaying(force: true)
                }
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                if self.repeatMode == .one {
                    self.seek(to: 0)
                    self.player?.play()
                    self.syncPlayingState()
                } else {
                    await self.skipNext()
                }
            }
        }

        failObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] note in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                let raw = (note.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error)?.localizedDescription
                    ?? "Odtwarzanie przerwane."
                if StreamRecoveryPolicy.isFatalPlaybackError(raw), !self.isTokenAuthFailure(raw) {
                    self.errorMessage = Self.friendlyPlaybackError(raw)
                    self.isPlaying = false
                    self.isLoading = false
                    self.isBuffering = false
                    self.refreshNowPlaying(force: true)
                    return
                }
                await self.recoverFromStreamDisruption(
                    track: track,
                    queueIndex: queueIndex,
                    generation: generation,
                    at: self.currentTime,
                    reason: raw
                )
            }
        }

        stalledObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemPlaybackStalled,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation, self.playbackDesired else { return }
                self.updateBufferingState()
                AudioSession.activateForPlayback()
                // Give the buffer a moment, then nudge play; remount if still dead.
                try? await Task.sleep(nanoseconds: 400_000_000)
                guard self.sessionGeneration == generation, self.playbackDesired else { return }
                self.player?.play()
                self.syncPlayingState()
                try? await Task.sleep(nanoseconds: 1_200_000_000)
                guard self.sessionGeneration == generation, self.playbackDesired else { return }
                if (self.player?.rate ?? 0) < 0.01 {
                    await self.recoverFromStreamDisruption(
                        track: track,
                        queueIndex: queueIndex,
                        generation: generation,
                        at: self.currentTime
                    )
                }
            }
        }

        playbackDesired = true
        updateBufferingState()
        if resumeAt > 0.5 {
            let seekTime = CMTime(seconds: resumeAt, preferredTimescale: 600)
            newPlayer.seek(to: seekTime) { [weak self] finished in
                Task { @MainActor in
                    guard let self, finished, self.sessionGeneration == generation else { return }
                    self.currentTime = resumeAt
                    self.player?.play()
                    self.syncPlayingState()
                    self.refreshNowPlaying(force: true)
                }
            }
        } else {
            newPlayer.play()
            syncPlayingState()
            refreshNowPlaying(force: true)
        }
    }

    private func updateBufferingState() {
        guard let player, currentStreamIsRemote, playbackDesired else {
            if isBuffering {
                isBuffering = false
                applyBufferingVisualSideEffects()
            }
            return
        }

        let waiting = player.timeControlStatus == .waitingToPlayAtSpecifiedRate
        let keepUp = player.currentItem?.isPlaybackLikelyToKeepUp ?? true
        let buffering: Bool
        if currentStreamIsReadyRemote {
            // Already on server — don't flash "Buforowanie…" during normal open.
            // Only show if we actually stall mid-track after playback has begun.
            let elapsed = livePlaybackTime()
            buffering = waiting && elapsed > 1.5 && (player.rate < 0.01 || !keepUp)
        } else {
            buffering = waiting || (!keepUp && (isPlaying || isLoading || player.rate < 0.01))
        }

        if isBuffering != buffering {
            isBuffering = buffering
            applyBufferingVisualSideEffects()
        }
        if buffering {
            let pct = streamBufferPercent()
            setPlaybackActivity(
                .buffering,
                title: "Buforowanie",
                detail: currentStreamIsReadyRemote
                    ? "Czekam na dane ze serwera EOS…"
                    : "Czekam na pierwsze dane streamu…",
                progress: pct
            )
        } else if !isLoading, player.currentItem?.status == .readyToPlay, isPlaying || playbackDesired {
            setPlaybackActivity(.playing, title: "Odtwarzanie", detail: currentTrack?.title ?? "")
        }
    }

    private func streamBufferPercent() -> Double? {
        guard let item = player?.currentItem else { return nil }
        let duration = item.duration.seconds
        guard duration.isFinite, duration > 0 else { return nil }
        let loaded = item.loadedTimeRanges
            .compactMap { $0.timeRangeValue.end.seconds }
            .max() ?? 0
        guard loaded.isFinite, loaded > 0 else { return nil }
        return min(100, max(0, (loaded / duration) * 100))
    }

    private func applyBufferingVisualSideEffects() {
        // Never tear down live EQ for ready-on-server streams — UI was freezing visuals on every blip.
        if currentStreamIsReadyRemote { return }
        if isBuffering {
            audioAnalyzer.setAnalysisEnabled(false, publishEmptyOnDisable: false)
            audioAnalyzer.setSpectrumEnabled(false)
        } else if visualAnalysisEnabled {
            audioAnalyzer.setAnalysisEnabled(true)
            audioAnalyzer.setSpectrumEnabled(visualNeedsSpectrum)
        }
    }

    private func syncPlayingState() {
        let rate = player?.rate ?? 0
        let playing = rate > 0.01
        if isPlaying != playing {
            isPlaying = playing
        }
        if playing {
            isLoading = false
            if continuousPlayingSince == nil {
                continuousPlayingSince = Date()
            } else if let start = continuousPlayingSince,
                      StreamRecoveryPolicy.shouldResetAttemptCount(
                        stablePlaybackDuration: Date().timeIntervalSince(start)
                      ) {
                if streamRecoveryAttempts > 0 {
                    EOSPerfLog.stream.debug("stream recovery attempts reset after stable playback")
                }
                streamRecoveryAttempts = 0
                continuousPlayingSince = Date()
            }
        } else if player?.timeControlStatus != .waitingToPlayAtSpecifiedRate {
            continuousPlayingSince = nil
        }
        updateBufferingState()
    }

    private func refreshNowPlaying(force: Bool = false) {
        guard let track = currentTrack else { return }
        // Prefer live AVPlayer clock — iOS advances lock-screen elapsed via playbackRate.
        let elapsed = livePlaybackTime()
        currentTime = elapsed
        nowPlaying.update(
            track: track,
            duration: liveDuration(),
            elapsed: elapsed,
            isPlaying: isPlaying,
            queueIndex: orderCursor,
            queueCount: playOrder.count,
            collectionTitle: queueSourceTitle,
            collectionPersistentSeed: folderId ?? queueSourceTitle,
            externalContentIdentifier: BluetoothMediaBrowser.queueContentIdentifier(orderIndex: orderCursor),
            repeatMode: repeatMode,
            shuffleEnabled: shuffleEnabled,
            supplemental: supplementalNowPlayingMetadata,
            force: force
        )
        // Nie przeładowuj drzewa BT przy każdym ticku czasu — NBT wtedy zostawia tylko bieżący utwór.
        if force {
            BluetoothMediaBrowser.shared.reloadQueue(from: self)
        } else {
            BluetoothMediaBrowser.shared.touchCurrentProgress(from: self)
        }
    }

    private func hydratePlaybackMetadata(from item: AVPlayerItem, queueIndex: Int, generation: Int) async {
        guard generation == sessionGeneration, queue.indices.contains(queueIndex) else { return }

        let embedded = await parseEmbeddedMetadata(from: item.asset)
        let baseTrack = queue[queueIndex]
        let libraryTrack = libraryTrackLookup?(baseTrack.url)
            ?? libraryTrackLookup?(baseTrack.libraryPersistURL)

        let enriched = await TrackMetadataEnricher.enrich(
            track: baseTrack,
            embedded: embedded,
            libraryTrack: libraryTrack,
            api: api
        )

        guard generation == sessionGeneration, !Task.isCancelled else { return }
        queue[queueIndex] = enriched
        if currentTrack?.id == enriched.id {
            currentTrack = enriched
            if let art = embedded?.artwork {
                displayArtwork = art
            } else if displayArtwork != nil, enriched.artworkURL == nil {
                displayArtwork = nil
            }
            if displayArtwork == nil, let artURL = enriched.artworkURL {
                let trackID = enriched.id
                Task { [weak self] in
                    let loaded = await ArtworkDecodeActor.shared.load(
                        url: artURL,
                        maxPixelSize: 512,
                        allowAnimated: false,
                        timeout: 12
                    )
                    guard let self, let image = loaded?.still else { return }
                    guard self.sessionGeneration == generation, self.currentTrack?.id == trackID else { return }
                    self.displayArtwork = image
                }
            }
        }
        if let embedded,
           TrackMetadataEnricher.embeddedTitleConflicts(expectedTitle: baseTrack.title, embeddedTitle: embedded.title) {
            // Keep lock-screen / Now Playing aligned with the tapped track, not rogue ID3.
            supplementalNowPlayingMetadata = NowPlayingCenter.SupplementalMetadata(
                title: nil,
                artist: nil,
                album: nil,
                artwork: embedded.artwork
            )
        } else {
            supplementalNowPlayingMetadata = embedded?.asSupplemental
        }
        refreshNowPlaying()
    }

    private func parseEmbeddedMetadata(from asset: AVAsset) async -> EmbeddedTrackMetadata? {
        let metadataItems: [AVMetadataItem]
        do {
            metadataItems = try await asset.load(.commonMetadata)
        } catch {
            return nil
        }

        var title: String?
        var artist: String?
        var album: String?
        var artwork: UIImage?

        for item in metadataItems {
            guard let key = item.commonKey?.rawValue else { continue }
            switch key {
            case AVMetadataKey.commonKeyTitle.rawValue:
                if title == nil { title = try? await item.load(.stringValue) }
            case AVMetadataKey.commonKeyArtist.rawValue:
                if artist == nil { artist = try? await item.load(.stringValue) }
            case AVMetadataKey.commonKeyAlbumName.rawValue:
                if album == nil { album = try? await item.load(.stringValue) }
            case AVMetadataKey.commonKeyArtwork.rawValue:
                if artwork == nil {
                    artwork = await artworkImage(from: item)
                }
            default:
                break
            }
        }

        if title == nil, artist == nil, album == nil, artwork == nil {
            return nil
        }
        return EmbeddedTrackMetadata(title: title, artist: artist, album: album, artwork: artwork)
    }

    private func artworkImage(from item: AVMetadataItem) async -> UIImage? {
        guard let value = try? await item.load(.value) else { return nil }
        if let data = value as? Data {
            return UIImage(data: data)
        }
        if let image = value as? UIImage {
            return image
        }
        if let dict = value as? [AnyHashable: Any],
           let data = dict["data"] as? Data {
            return UIImage(data: data)
        }
        return nil
    }

    private func teardownPlayer() {
        if let signpost = streamOpenSignpost {
            EOSPerfLog.intervalEnd("StreamOpen", id: signpost)
            streamOpenSignpost = nil
        }
        cleanupObservers()
        player?.pause()
        audioAnalyzer.detach(from: player?.currentItem)
        player?.replaceCurrentItem(with: nil)
        player = nil
        isBuffering = false
        currentStreamIsRemote = false
    }

    private func cleanupObservers() {
        if let timeObserver, let player {
            player.removeTimeObserver(timeObserver)
        }
        timeObserver = nil
        rateObserver?.invalidate()
        rateObserver = nil
        timeControlObserver?.invalidate()
        timeControlObserver = nil
        likelyToKeepUpObserver?.invalidate()
        likelyToKeepUpObserver = nil
        statusObserver?.invalidate()
        statusObserver = nil
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        if let failObserver { NotificationCenter.default.removeObserver(failObserver) }
        if let stalledObserver { NotificationCenter.default.removeObserver(stalledObserver) }
        endObserver = nil
        failObserver = nil
        stalledObserver = nil
    }
}

/// Real FFT 512 — jak Nullsoft FFT w vis_classic.
private final class WinampFFTProcessor {
    private let size = 512
    private let binCount = 256
    private let log2n: vDSP_Length = 9
    private let setup: FFTSetup?
    private var window: [Float]
    private var input: [Float]
    private var real: [Float]
    private var imag: [Float]
    private var magnitudes: [Float]

    init() {
        setup = vDSP_create_fftsetup(9, FFTRadix(kFFTRadix2))
        window = [Float](repeating: 0, count: 512)
        input = [Float](repeating: 0, count: 512)
        real = [Float](repeating: 0, count: 256)
        imag = [Float](repeating: 0, count: 256)
        magnitudes = [Float](repeating: 0, count: 256)
        vDSP_hann_window(&window, vDSP_Length(size), Int32(vDSP_HANN_NORM))
    }

    deinit {
        if let setup {
            vDSP_destroy_fftsetup(setup)
        }
    }

    func spectrumBytes(from samples: [Float], count: Int, scale: Float) -> [UInt8] {
        guard let setup else { return [UInt8](repeating: 0, count: binCount) }
        guard count >= 64 else { return [UInt8](repeating: 0, count: binCount) }
        let start = max(0, count - size)
        input.withUnsafeMutableBufferPointer { dst in
            dst.initialize(repeating: 0)
            let copyCount = min(size, count - start)
            _ = samples.withUnsafeBufferPointer { src in
                dst.baseAddress!.update(from: src.baseAddress!.advanced(by: start), count: copyCount)
            }
        }
        vDSP_vmul(input, 1, window, 1, &input, 1, vDSP_Length(size))

        real.withUnsafeMutableBufferPointer { realBP in
            imag.withUnsafeMutableBufferPointer { imagBP in
                var split = DSPSplitComplex(realp: realBP.baseAddress!, imagp: imagBP.baseAddress!)
                for index in 0..<binCount {
                    split.realp[index] = input[index * 2]
                    split.imagp[index] = input[index * 2 + 1]
                }
                vDSP_fft_zrip(setup, &split, 1, log2n, FFTDirection(FFT_FORWARD))
                var norm = Float(2.0 / Float(size))
                vDSP_vsmul(split.realp, 1, &norm, split.realp, 1, vDSP_Length(binCount))
                vDSP_vsmul(split.imagp, 1, &norm, split.imagp, 1, vDSP_Length(binCount))
                vDSP_zvabs(&split, 1, &magnitudes, 1, vDSP_Length(binCount))
            }
        }

        let invScale = max(0.08, scale)
        return magnitudes.map { mag in
            let compressed = log1pf(mag * 48.0 / invScale)
            let value = Int(compressed * 72.0)
            return UInt8(min(255, max(0, value)))
        }
    }
}

private final class PlayerAudioAnalyzer {
    private struct State {
        var lowLP: Float = 0
        var midLP: Float = 0
        var prevBass: Float = 0
        var kickEnvelope: Float = 0
        var visualEnvelope: Float = 0
        var lastPeak: Float = 0
        var lastPush: CFTimeInterval = 0
        var islandBars: [Float] = Array(repeating: 0, count: MusicPlaybackEngine.AudioReactiveFrame.islandBarCount)
        var bandTargets: [Int] = Array(repeating: 0, count: MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountMax)
        var energy: Float = 0
        var monoScratch: [Float] = Array(repeating: 0, count: 2048)
        var ringBuffer: [Float] = Array(repeating: 0, count: 512)
        var ringWrite = 0
        var ringFilled = 0
    }

    private var state = State()
    private let lock = NSLock()
    private var publishHandler: ((MusicPlaybackEngine.AudioReactiveFrame) -> Void)?
    /// Target publish rate (Hz). 0 = pause publishing.
    private var targetFPS: Double = 0
    private var analysisEnabled = false
    /// Full FFT/Goertzel only for Spectrum mixer; mini/vinyl use cheap RMS island path.
    private var spectrumEnabled = false
    private var activeBandCount = MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard
    private var sampleRate: Float = 44_100
    private let fft = WinampFFTProcessor()
    private let barTable32: [Int]
    private let barTable64: [Int]
    private let fftScale: Float = 1.4

    private var barTable: [Int] {
        activeBandCount >= MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountDense ? barTable64 : barTable32
    }

    private static func bandCenterHz(index: Int, count: Int) -> Float {
        let minHz: Float = 55
        let maxHz: Float = 16_000
        let t = Float(index) / Float(max(1, count - 1))
        return minHz * pow(maxHz / minHz, t)
    }

    private static func goertzelMagnitude(_ samples: [Float], count: Int, targetHz: Float, sampleRate: Float) -> Float {
        let n = min(count, samples.count)
        guard n > 16 else { return 0 }
        let k = Int(0.5 + Float(n) * targetHz / sampleRate)
        guard k > 0 else { return 0 }
        let w = 2 * Float.pi * Float(k) / Float(n)
        let coeff = 2 * cos(w)
        let cosW = cos(w)
        let sinW = sin(w)
        var s0: Float = 0
        var s1: Float = 0
        var s2: Float = 0
        for index in 0..<n {
            s0 = coeff * s1 - s2 + samples[index]
            s2 = s1
            s1 = s0
        }
        let real = s1 - s2 * cosW
        let imag = s2 * sinW
        return sqrt(real * real + imag * imag) / Float(n)
    }

    init() {
        barTable32 = Self.logBarTable(
            binCount: 256,
            sampleRate: 44_100,
            lastBarCutHz: 16_000,
            bars: MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard
        )
        barTable64 = Self.logBarTable(
            binCount: 256,
            sampleRate: 44_100,
            lastBarCutHz: 16_000,
            bars: MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountDense
        )
    }

    func setBandCount(_ count: Int) {
        lock.lock()
        activeBandCount = count >= MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountDense
            ? MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountDense
            : MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard
        state = State()
        lock.unlock()
    }

    fileprivate func setSampleRate(_ rate: Float) {
        lock.lock()
        sampleRate = max(8_000, rate)
        lock.unlock()
    }

    /// Logarytmiczna dystrybucja binów FFT — port vis_classic LogBarValueTable.
    private static func logBarTable(binCount: Int, sampleRate: Int, lastBarCutHz: Int, bars: Int) -> [Int] {
        var table = Array(repeating: 1, count: bars)
        var notAssigned = binCount - bars
        var lastAssign = bars - 1
        guard notAssigned > 0 else { return table }

        let fDiv = pow(Double(notAssigned), 1.0 / Double(bars))
        func assignCount(_ remaining: Int) -> Int {
            max(1, Int(Double(remaining) - Double(remaining) / fDiv + 0.5))
        }

        if lastBarCutHz > sampleRate / 10_000 {
            let halfSample = sampleRate / 2
            if halfSample > lastBarCutHz {
                let highBinDiv = Double(halfSample) / Double(halfSample - lastBarCutHz)
                if 1 + notAssigned - Int(Double(notAssigned) / fDiv) < Int(Double(binCount) / highBinDiv) {
                    table[bars - 1] = max(1, Int(Double(binCount) / highBinDiv))
                    notAssigned = binCount - (bars - 1) - table[bars - 1]
                    lastAssign = bars - 2
                }
            }
        }

        var assign = assignCount(notAssigned)
        while notAssigned > 0 {
            for index in stride(from: lastAssign, through: 0, by: -1) where notAssigned > 0 {
                table[index] += assign
                notAssigned -= assign
                assign = assignCount(notAssigned)
            }
        }
        return table
    }

    private static func averageLevel(low: Int, high: Int, spectrum: [UInt8]) -> Int {
        guard low < high, low >= 0, high <= spectrum.count else { return 0 }
        var sum = 0
        for index in low..<high { sum += Int(spectrum[index]) }
        return sum / (high - low)
    }

    /// Soft-knee 0…1 — widoczny ruch przy cichym materiale, miękki limit u góry.
    private static func softNormalize(_ value: Float, gain: Float) -> Float {
        let x = max(0, value * gain)
        return min(0.96, x / (1 + x * 0.36))
    }

    private weak var attachedItem: AVPlayerItem?
    private var attachTask: Task<Void, Never>?

    func setPublishRate(fps: Double) {
        lock.lock()
        targetFPS = max(0, min(30, fps))
        lock.unlock()
    }

    func setAnalysisEnabled(_ enabled: Bool, publishEmptyOnDisable: Bool = true) {
        lock.lock()
        analysisEnabled = enabled
        if !enabled {
            state = State()
        }
        lock.unlock()
        if !enabled, publishEmptyOnDisable {
            publishHandler?(MusicPlaybackEngine.AudioReactiveFrame())
        }
    }

    func setSpectrumEnabled(_ enabled: Bool) {
        lock.lock()
        spectrumEnabled = enabled
        lock.unlock()
    }

    func setPublishHandler(_ push: @escaping (MusicPlaybackEngine.AudioReactiveFrame) -> Void) {
        publishHandler = push
    }

    func attach(to item: AVPlayerItem, push: @escaping (MusicPlaybackEngine.AudioReactiveFrame) -> Void) {
        publishHandler = push
        attachedItem = item
        attachTask?.cancel()
        attachTask = Task { [weak self, weak item] in
            guard let self, let item, !Task.isCancelled else { return }
            let tracks = (try? await item.asset.loadTracks(withMediaType: .audio)) ?? []
            guard let audioTrack = tracks.first, !Task.isCancelled else { return }
            await MainActor.run {
                guard self.attachedItem === item else { return }
                self.installTap(on: item, audioTrack: audioTrack)
            }
        }
    }

    func ensureAttached(to item: AVPlayerItem) {
        guard let push = publishHandler else { return }
        lock.lock()
        let enabled = analysisEnabled
        let fps = targetFPS
        lock.unlock()
        guard enabled, fps > 0.5 else { return }
        if attachedItem === item, item.audioMix != nil { return }
        attach(to: item, push: push)
    }

    func detach(from item: AVPlayerItem?) {
        attachTask?.cancel()
        attachTask = nil
        attachedItem = nil
        item?.audioMix = nil
    }

    private func installTap(on item: AVPlayerItem, audioTrack: AVAssetTrack) {
        var callbacks = MTAudioProcessingTapCallbacks(
            version: kMTAudioProcessingTapCallbacksVersion_0,
            clientInfo: UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
            init: tapInit,
            finalize: tapFinalize,
            prepare: tapPrepare,
            unprepare: tapUnprepare,
            process: tapProcess
        )

        var tap: MTAudioProcessingTap?
        let status = MTAudioProcessingTapCreate(
            kCFAllocatorDefault,
            &callbacks,
            kMTAudioProcessingTapCreationFlag_PostEffects,
            &tap
        )
        guard status == noErr, let tap else { return }

        let params = AVMutableAudioMixInputParameters(track: audioTrack)
        params.setVolume(1.0, at: .zero)
        params.audioTapProcessor = tap
        let mix = AVMutableAudioMix()
        mix.inputParameters = [params]
        item.audioMix = mix
    }

    func reset() {
        lock.lock()
        state = State()
        lock.unlock()
    }

    fileprivate func consume(_ list: UnsafeMutablePointer<AudioBufferList>, frames: CMItemCount, time: CMTime) {
        let frameCount = Int(frames)
        guard frameCount > 0 else { return }

        let buffers = UnsafeMutableAudioBufferListPointer(list)
        guard let first = buffers.first, first.mData != nil else { return }
        let channels = max(1, Int(first.mNumberChannels))
        let samplePtr = first.mData!.assumingMemoryBound(to: Float.self)
        let sampleCount = frameCount * channels
        if sampleCount <= 0 { return }

        lock.lock()
        let enabled = analysisEnabled
        let fps = targetFPS
        let wantsSpectrum = spectrumEnabled
        lock.unlock()
        guard enabled, fps > 0.5 else { return }

        var sumSq: Float = 0
        var lowSq: Float = 0
        var midSq: Float = 0
        var highSq: Float = 0

        lock.lock()
        var local = state
        let bandCount = activeBandCount
        let table = barTable
        let sampleRateLocked = sampleRate
        let scratchCap = local.monoScratch.count
        var monoCount = 0

        // Downsample mono fill when we only need island RMS — still accurate enough for 5 bars.
        let step = wantsSpectrum ? channels : max(channels, channels * 2)
        for i in stride(from: 0, to: sampleCount, by: step) {
            var mono: Float = 0
            for c in 0..<channels {
                mono += samplePtr[i + c]
            }
            mono /= Float(channels)

            if wantsSpectrum, monoCount < scratchCap {
                local.monoScratch[monoCount] = mono
                monoCount += 1
            }
            if wantsSpectrum {
                local.ringBuffer[local.ringWrite % local.ringBuffer.count] = mono
                local.ringWrite += 1
                local.ringFilled = min(local.ringBuffer.count, local.ringFilled + 1)
            }

            local.lowLP += 0.02 * (mono - local.lowLP)
            local.midLP += 0.12 * (mono - local.midLP)

            let low = local.lowLP
            let high = mono - local.midLP
            let mid = local.midLP - local.lowLP

            sumSq += mono * mono
            lowSq += low * low
            midSq += mid * mid
            highSq += high * high
        }

        let samplesUsed = Float(max(1, (sampleCount + step - 1) / step))
        let inv = 1.0 / samplesUsed
        let rms = sqrt(sumSq * inv)
        let bass = sqrt(lowSq * inv)
        let mid = sqrt(midSq * inv)
        let treble = sqrt(highSq * inv)
        let bassTransient = max(0, bass - local.prevBass * 0.9)
        local.prevBass = local.prevBass * 0.74 + bass * 0.26

        let rawKick = bassTransient * max(bass, bassTransient)
        if rawKick > local.kickEnvelope {
            local.kickEnvelope += (rawKick - local.kickEnvelope) * 0.48
        } else {
            local.kickEnvelope *= 0.76
        }

        let instantLevel = min(1, rms * 4.8)
        if instantLevel > local.visualEnvelope {
            local.visualEnvelope += (instantLevel - local.visualEnvelope) * 0.78
        } else {
            let release = 0.68 + min(0.18, local.lastPeak * 0.28)
            local.visualEnvelope *= release
        }
        local.lastPeak = max(instantLevel, local.lastPeak * 0.91)

        let bassNorm = Self.softNormalize(bass, gain: 7.8)
        let midNorm = Self.softNormalize(mid, gain: 7.2)
        let trebleNorm = Self.softNormalize(treble, gain: 6.8)
        let beatNorm = min(1, local.kickEnvelope * 28)
        let targets: [Float] = [
            min(1, bassNorm * 0.88),
            min(1, bassNorm * 0.28 + midNorm * 0.58),
            min(1, instantLevel * 0.82 + beatNorm * 0.14),
            min(1, midNorm * 0.46 + trebleNorm * 0.4),
            min(1, trebleNorm * 0.72 + beatNorm * 0.18)
        ]
        for index in 0..<local.islandBars.count {
            let target = targets[index]
            var bar = local.islandBars[index]
            if target > bar {
                let attack: Float = min(0.96, (0.42 + Float(index) * 0.04 + beatNorm * 0.1) * 2.0)
                bar += (target - bar) * attack
            } else {
                let release: Float = instantLevel > 0.05 ? 0.28 : 0.44
                bar += (target - bar) * release
            }
            local.islandBars[index] = max(0, min(1, bar))
        }
        if instantLevel < 0.022 {
            for index in 0..<local.islandBars.count {
                local.islandBars[index] *= 0.48
            }
        }

        let energyTarget = min(1, instantLevel * 0.55 + bassNorm * 0.25 + beatNorm * 0.35)
        if energyTarget > local.energy {
            local.energy += (energyTarget - local.energy) * 0.55
        } else {
            local.energy *= 0.86
        }

        let now = CACurrentMediaTime()
        let interval = 1.0 / max(1.0, fps)
        let shouldPush = now - local.lastPush >= interval
        var publishFrame: MusicPlaybackEngine.AudioReactiveFrame?

        // FFT + Goertzel only on publish ticks and only when Spectrum UI needs it.
        if shouldPush, wantsSpectrum {
            var fftWindow = [Float](repeating: 0, count: local.ringBuffer.count)
            if local.ringFilled >= local.ringBuffer.count {
                let start = local.ringWrite % local.ringBuffer.count
                for index in 0..<local.ringBuffer.count {
                    fftWindow[index] = local.ringBuffer[(start + index) % local.ringBuffer.count]
                }
            } else if monoCount > 0 {
                let copyCount = min(monoCount, fftWindow.count)
                for index in 0..<copyCount {
                    fftWindow[index] = local.monoScratch[index]
                }
            }

            let goertzelSampleCount: Int
            if local.ringFilled >= local.ringBuffer.count {
                goertzelSampleCount = local.ringBuffer.count
            } else {
                goertzelSampleCount = min(monoCount, fftWindow.count)
            }

            let spectrum = fft.spectrumBytes(from: fftWindow, count: goertzelSampleCount, scale: fftScale)
            var low = 0
            for index in 0..<bandCount {
                let high = min(spectrum.count, low + table[index])
                // FFT bins only — Goertzel×N was cooking the CPU while music played.
                let newLevel = Self.averageLevel(low: low, high: high, spectrum: spectrum)
                local.bandTargets[index] = max(local.bandTargets[index], newLevel)
                low = high
            }

            if local.bandTargets.prefix(bandCount).max() ?? 0 < 8, instantLevel > 0.018 {
                let bassLevel = Int(min(255, bassNorm * 240))
                let midLevel = Int(min(255, midNorm * 230))
                let trebleLevel = Int(min(255, trebleNorm * 220))
                let bassEnd = max(1, bandCount / 4)
                let midEnd = max(bassEnd + 1, bandCount * 11 / 20)
                for index in 0..<bandCount {
                    let fallback: Int
                    if index < bassEnd {
                        fallback = bassLevel
                    } else if index < midEnd {
                        fallback = midLevel
                    } else {
                        fallback = trebleLevel
                    }
                    local.bandTargets[index] = max(local.bandTargets[index], fallback + (index * 3) % 11)
                }
            }
        }

        if shouldPush {
            local.lastPush = now

            var spectrumBands = Array(repeating: 0.0, count: MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountMax)
            if wantsSpectrum {
                for index in 0..<bandCount {
                    spectrumBands[index] = Double(local.bandTargets[index]) / 255.0
                    local.bandTargets[index] = 0
                }
            }

            let spectrumPeak = spectrumBands.prefix(bandCount).max() ?? 0
            let bassEnd = max(1, bandCount / 4)
            let midEnd = max(bassEnd + 1, bandCount * 11 / 20)
            let bassVU: Double
            let midVU: Double
            let trebleVU: Double
            if wantsSpectrum, spectrumPeak > 0 {
                bassVU = max(Double(bassNorm), spectrumBands.prefix(bassEnd).max() ?? 0)
                midVU = max(Double(midNorm), spectrumBands[bassEnd..<midEnd].max() ?? 0)
                trebleVU = max(Double(trebleNorm), spectrumBands[midEnd..<bandCount].max() ?? 0)
            } else {
                bassVU = Double(bassNorm)
                midVU = Double(midNorm)
                trebleVU = Double(trebleNorm)
            }

            publishFrame = MusicPlaybackEngine.AudioReactiveFrame(
                level: Double(local.visualEnvelope),
                bass: bassVU,
                mid: midVU,
                treble: trebleVU,
                beat: Double(beatNorm),
                islandBars: local.islandBars.map(Double.init),
                spectrumBands: spectrumBands,
                peakHold: spectrumBands,
                energy: Double(local.energy),
                activeSpectrumBands: wantsSpectrum ? bandCount : 0
            )
        }
        state = local
        lock.unlock()

        if let publishFrame {
            publishHandler?(publishFrame)
        }
    }
}

private func tapInit(
    tap: MTAudioProcessingTap,
    clientInfo: UnsafeMutableRawPointer?,
    tapStorageOut: UnsafeMutablePointer<UnsafeMutableRawPointer?>
) {
    tapStorageOut.pointee = clientInfo
}

private func tapFinalize(tap: MTAudioProcessingTap) {}
private func tapPrepare(tap: MTAudioProcessingTap, maxFrames: CMItemCount, processingFormat: UnsafePointer<AudioStreamBasicDescription>) {
    let storage = MTAudioProcessingTapGetStorage(tap)
    let analyzer = Unmanaged<PlayerAudioAnalyzer>.fromOpaque(storage).takeUnretainedValue()
    analyzer.setSampleRate(Float(processingFormat.pointee.mSampleRate))
}
private func tapUnprepare(tap: MTAudioProcessingTap) {}

private func tapProcess(
    tap: MTAudioProcessingTap,
    numberFrames: CMItemCount,
    flags: MTAudioProcessingTapFlags,
    bufferListInOut: UnsafeMutablePointer<AudioBufferList>,
    numberFramesOut: UnsafeMutablePointer<CMItemCount>,
    flagsOut: UnsafeMutablePointer<MTAudioProcessingTapFlags>
) {
    var timeRange = CMTimeRange.zero
    var localFlags: MTAudioProcessingTapFlags = 0
    let status = MTAudioProcessingTapGetSourceAudio(
        tap,
        numberFrames,
        bufferListInOut,
        &localFlags,
        &timeRange,
        numberFramesOut
    )
    guard status == noErr else { return }
    flagsOut.pointee = localFlags
    _ = flags

    let storage = MTAudioProcessingTapGetStorage(tap)
    let analyzer = Unmanaged<PlayerAudioAnalyzer>.fromOpaque(storage).takeUnretainedValue()
    analyzer.consume(bufferListInOut, frames: numberFramesOut.pointee, time: timeRange.start)
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

struct PlaybackActivitySnapshot: Equatable {
    enum Phase: Equatable {
        case idle
        case openingLocal
        case onServerConnecting
        case resolvingStream
        case preparingServer
        case connectingStream
        case buffering
        case playing
        case error

        var showsSpinner: Bool {
            switch self {
            case .idle, .playing, .onServerConnecting, .openingLocal: return false
            default: return true
            }
        }

        var systemImage: String? {
            switch self {
            case .onServerConnecting: return "checkmark.icloud.fill"
            case .openingLocal: return "iphone"
            case .error: return "exclamationmark.triangle.fill"
            default: return nil
            }
        }
    }

    var phase: Phase = .idle
    var title: String = ""
    var detail: String = ""
    /// 0…100 when known (serwer / bufor).
    var progress: Double?

    static let idle = PlaybackActivitySnapshot()
}

@MainActor
final class PlaybackStatusFlags: ObservableObject {
    @Published var isBuffering = false
    @Published var activity = PlaybackActivitySnapshot.idle
}

/// Thread-safe live audio frame store — UIKit polls; never triggers SwiftUI body rebuilds.
final class PlayerAudioVisualizer: ObservableObject, @unchecked Sendable {
    private let lock = NSLock()
    private var latest = MusicPlaybackEngine.AudioReactiveFrame()
    private var lastLiveAt: CFTimeInterval = 0

    var frame: MusicPlaybackEngine.AudioReactiveFrame { snapshot(isPlaying: true) }

    func snapshot(isPlaying: Bool = true) -> MusicPlaybackEngine.AudioReactiveFrame {
        lock.lock()
        let frame = latest
        let age = CACurrentMediaTime() - lastLiveAt
        lock.unlock()

        guard isPlaying else {
            return MusicPlaybackEngine.AudioReactiveFrame.synthesize(at: 0, isPlaying: false)
        }
        // Real PCM frames only — no fake “automatic waves”.
        if lastLiveAt > 0, age < 0.8 {
            return frame
        }
        return frame
    }

    func apply(_ frame: MusicPlaybackEngine.AudioReactiveFrame) {
        lock.lock()
        latest = frame
        lastLiveAt = CACurrentMediaTime()
        lock.unlock()
    }

    func reset() {
        lock.lock()
        latest = MusicPlaybackEngine.AudioReactiveFrame()
        lastLiveAt = 0
        lock.unlock()
    }
}

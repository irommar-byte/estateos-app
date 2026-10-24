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
        /// Dokładne momenty uderzeń (CACurrentMediaTime) wykryte w wątku audio — UI liczy z nich
        /// impulsy w każdej klatce, więc żadne uderzenie nie ginie między publikacjami.
        /// Poziom lewego / prawego kanału (0…1) — mierniki L/R.
        var levelL: Double = 0
        var levelR: Double = 0
        var kickAt: Double = 0
        var snareAt: Double = 0
        var hatAt: Double = 0
        var kickStrength: Double = 0
        var snareStrength: Double = 0
        var hatStrength: Double = 0

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
    /// Track id that `displayArtwork` belongs to — never reuse a previous cover on skip.
    @Published private(set) var displayArtworkTrackID: String?
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
    @Published var repeatMode: RepeatMode = .all {
        didSet { applyRepeatModeToPlayer() }
    }
    @Published var errorMessage: String?
    @Published private(set) var playbackOrigin: MediaPlaybackOrigin = .unknown
    /// When true, never open network streams — local files only.
    var offlineOnly = false
    let visualizer = PlayerAudioVisualizer()

    func displayArtwork(for track: MusicPlaybackTrack) -> UIImage? {
        displayArtworkTrackID == track.id ? displayArtwork : nil
    }

    private func clearDisplayArtwork() {
        // Każdy zapis @Published (nawet tej samej wartości) przebudowywał widoki całej aplikacji.
        if displayArtwork != nil { displayArtwork = nil }
        if displayArtworkTrackID != nil { displayArtworkTrackID = nil }
    }

    private func setDisplayArtwork(_ image: UIImage?, trackID: String) {
        displayArtwork = image
        displayArtworkTrackID = image == nil ? nil : trackID
    }

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
                fps = 15
            case .full:
                // Spektrum: 30 Hz z analizy, ekran interpoluje w 60–120 Hz (dynamika Winampa).
                fps = needsSpectrum
                    ? (policy.analyzerFPS >= 8 ? 30 : 15)
                    : (policy.analyzerFPS >= 6 ? 30 : 15)
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
            // Nie zakładaj tapu w trakcie grania — audioMix w locie ucina dźwięk na ~1 s
            // przy otwarciu playera. Tap jest zakładany zanim AVPlayer wystartuje.
            if let item = player?.currentItem, (player?.rate ?? 0) < 0.01, !playbackDesired {
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
        if item.audioMix != nil { return }
        if (player?.rate ?? 0) > 0.01 || playbackDesired { return }
        guard visualAnalysisEnabled, visualAnalysisFPS > 0.5 else { return }
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
    private var player: AVQueuePlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var itemAdvanceObserver: NSKeyValueObservation?
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
    private var playbackIdentity = PlaybackItemIdentity.none

    /// Anuluje zaległe `play()` po `stop()` lub zmianie utworu.
    private var sessionGeneration = 0
    private var activePlayTask: Task<Void, Never>?
    private var streamRecoveryAttempts = 0
    private var streamRecoveryInFlight = false
    private var firstByteWatchdog: Task<Void, Never>?
    private var continuousPlayingSince: Date?
    private var listenTrackURL: String?
    private var listenAccumulated: Double = 0
    private var listenLastTick: Date?
    private var listenCounted = false
    private var stalledObserver: NSObjectProtocol?
    /// True while the user/engine intends continuous playback (survives temporary rate=0 stalls).
    private var playbackDesired = false
    private var playbackBackgroundTask: UIBackgroundTaskIdentifier = .invalid
    private var boundItemID: ObjectIdentifier?
    private var itemQueueIndex: [ObjectIdentifier: Int] = [:]
    /// Podmiana elementu w kolejce — KVO nie może wtedy przestawić etykiety na chwilowy utwór.
    private var ignoreItemChanges = false
    private var lastHandoffAt = Date.distantPast
    private var tapInstallPermit = 0
    private var suppressAutoHandoffUntil = Date.distantPast
    private var activeStreamJobId: String?
    private var tokenExpiresAt: Date?
    /// Reuse play-tokens across skip/prefetch — avoids an extra RTT when the file is already on server.
    private var playTokenCache: [String: CachedPlayToken] = [:]
    private var streamOpenSignpost: OSSignpostID?
    private var currentStreamIsRemote = false
    /// Known-ready remote assets start snappy; cold/unready streams keep a safer buffer.
    private var currentStreamIsReadyRemote = false
    private let sessionCollectionId: String

    private struct CachedPlayToken {
        let token: String
        let expiresAt: Date?
    }

    private struct PrefetchedStream {
        let trackID: String
        let url: URL
        let readyRemote: Bool
        var item: AVPlayerItem?
        var createdAt = Date()

        /// Przygotowany wcześniej element żyje krótko: po zmianie kolejki, restarcie serwera
        /// albo zerwanym połączeniu AVPlayer potrafił na nim „grać” bez dźwięku przez minutę.
        var isFresh: Bool {
            guard let item else { return true }
            if item.status == .failed || item.error != nil { return false }
            return url.isFileURL || Date().timeIntervalSince(createdAt) < 45
        }
    }

    private var prefetchedStream: PrefetchedStream?
    private var playGate = false

    init(session: MusicPlaybackSession) {
        queue = session.queue
        folderId = session.folderId
        folderName = session.folderName
        sessionCollectionId = session.id.uuidString
        rebuildPlayOrder(shuffled: false, anchor: session.startIndex)
        PlayerAudioVisualizer.current = visualizer
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

    /// Liczba utworów w kolejce — tanio, bez budowania wierszy kolejki.
    var queueCount: Int { playOrder.count }

    /// Czy użytkownik chce, żeby grało (prawda także podczas chwilowego buforowania i przeskoku).
    /// UI używa tego do animacji „pauzy” okładki — bez mrugania przy zmianie utworu.
    var isPlaybackIntended: Bool { playbackDesired }

    var queuePositionLabel: String {
        guard !queue.isEmpty else { return "" }
        return "\(orderCursor + 1) / \(playOrder.count)"
    }

    /// Playlist / folder name when playback started from a collection.
    var queueSourceTitle: String? {
        if let folderName, !folderName.isEmpty { return folderName }
        guard !queue.isEmpty else { return nil }
        return "EOS Music"
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
        await runSerializedPlay { [weak self] generation in
            guard let self else { return }
            await self.playOrderIndex(index, generation: generation)
        }
        BluetoothMediaBrowser.shared.reloadQueue(from: self)
    }

    /// Wyślij metadane kolejki do BMW zanim pierwszy utwór zacznie grać (NBT czyta listę przy starcie sesji).
    func publishInitialCarMetadata() {
        guard !queue.isEmpty else { return }
        let queueIndex = playOrder[safe: orderCursor] ?? playOrder.first ?? 0
        let track = queue[queueIndex]
        if playbackIdentity == .none {
            beginPlaybackTransition(queueIndex: queueIndex)
        }
        nowPlaying.update(
            track: track,
            duration: max(0, track.duration ?? 0),
            elapsed: 0,
            isPlaying: false,
            queueIndex: orderCursor,
            queueCount: playOrder.count,
            collectionTitle: queueSourceTitle,
            collectionPersistentSeed: folderId ?? sessionCollectionId,
            externalContentIdentifier: BluetoothMediaBrowser.queueContentIdentifier(orderIndex: orderCursor),
            identity: playbackIdentity,
            force: true
        )
        BluetoothMediaBrowser.shared.preparePlaybackSession(engine: self)
    }

    func start() async {
        guard !queue.isEmpty else {
            errorMessage = "Pusta playlista."
            return
        }
        await runSerializedPlay { [weak self] generation in
            guard let self else { return }
            await self.playOrderIndex(self.orderCursor, generation: generation)
        }
    }

    func stop() {
        sessionGeneration += 1
        activePlayTask?.cancel()
        activePlayTask = nil
        finalizeListenSession()
        teardownPlayer()
        currentTrack = nil
        clearDisplayArtwork()
        playbackOrigin = .unknown
        isPlaying = false
        isLoading = false
        isBuffering = false
        playbackDesired = false
        endPlaybackBackgroundTask()
        streamRecoveryAttempts = 0
        continuousPlayingSince = nil
        activeStreamJobId = nil
        tokenExpiresAt = nil
        prefetchedStream = nil
        itemQueueIndex.removeAll()
        boundItemID = nil
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

    private func beginListenSession(for track: MusicPlaybackTrack) {
        listenTrackURL = track.url
        listenAccumulated = 0
        listenLastTick = isPlaying ? Date() : nil
        listenCounted = false
    }

    private func tickListenSession() {
        guard let track = currentTrack, listenTrackURL == track.url else { return }
        if isPlaying {
            let now = Date()
            if let last = listenLastTick {
                listenAccumulated += now.timeIntervalSince(last)
            }
            listenLastTick = now
            commitListenIfQualified(track: track)
        } else {
            listenLastTick = nil
        }
    }

    private func finalizeListenSession() {
        tickListenSession()
        if let track = currentTrack, listenTrackURL == track.url {
            commitListenIfQualified(track: track)
        }
        listenTrackURL = nil
        listenAccumulated = 0
        listenLastTick = nil
        listenCounted = false
    }

    private func commitListenIfQualified(track: MusicPlaybackTrack) {
        guard !listenCounted else { return }
        let duration = liveDuration()
        guard ListeningStatsPolicy.qualifies(accumulated: listenAccumulated, duration: duration) else { return }
        listenCounted = true
        let seconds = listenAccumulated
        let snapshot = track
        Task { @MainActor in
            ListeningStatsStore.shared.recordPlay(track: snapshot, listenedSeconds: seconds)
        }
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

    /// Po odblokowaniu / powrocie z tła: jeśli kolejka miała grać, nie zostawiaj ciszy.
    func resumeIfDesiredAfterForeground() {
        guard playbackDesired, player != nil else { return }
        AudioSession.activateForPlayback(force: true)
        syncDisplayedTrackToPlayer(generation: sessionGeneration)
        if let item = player?.currentItem {
            let elapsed = item.currentTime().seconds
            let length = item.duration.seconds
            if length.isFinite, elapsed.isFinite, length > 1, length - elapsed < 0.45 {
                Task { await self.skipNext() }
                return
            }
        }
        if (player?.rate ?? 0) < 0.01 {
            player?.play()
        }
        syncPlayingState()
        refreshNowPlaying(force: true)
        let generation = sessionGeneration
        Task { await self.prefetchUpcoming(from: self.playOrder[safe: self.orderCursor] ?? 0, generation: generation) }
    }

    /// Trzymaj proces przy życiu na granicy utworów, gdy ekran jest zablokowany.
    func prepareForBackground() {
        guard playbackDesired else { return }
        beginPlaybackBackgroundTask()
        let generation = sessionGeneration
        Task { await self.prefetchUpcoming(from: self.playOrder[safe: self.orderCursor] ?? 0, generation: generation) }
    }

    private func beginPlaybackBackgroundTask() {
        guard playbackBackgroundTask == .invalid else { return }
        playbackBackgroundTask = UIApplication.shared.beginBackgroundTask(withName: "eos-music-queue") { [weak self] in
            Task { @MainActor in
                self?.endPlaybackBackgroundTask()
            }
        }
    }

    private func endPlaybackBackgroundTask() {
        guard playbackBackgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(playbackBackgroundTask)
        playbackBackgroundTask = .invalid
    }

    /// Tap przed `play()`. Jeśli nie zdąży przed startem, nie zakładamy go w trakcie grania.
    private func installTapBeforePlay(_ item: AVPlayerItem) async {
        tapInstallPermit += 1
        let permit = tapInstallPermit
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            var resumed = false
            let finish = {
                if resumed { return }
                resumed = true
                continuation.resume()
            }
            Task { @MainActor in
                await self.audioAnalyzer.installBeforePlayback(item) {
                    self.tapInstallPermit == permit
                }
                finish()
            }
            Task {
                try? await Task.sleep(nanoseconds: 550_000_000)
                await MainActor.run {
                    if self.tapInstallPermit == permit {
                        self.tapInstallPermit += 1
                        self.installLateTap(item)
                    }
                    finish()
                }
            }
        }
    }

    /// Live stream: ścieżki audio znane są dopiero po pierwszych bajtach (kilka sekund),
    /// więc tap nie zdążał przed play() i efekty wizualne przy streamie nie działały wcale.
    /// Zakładamy go, gdy tylko ścieżka się pojawi — póki utwór jest na samym początku.
    private func installLateTap(_ item: AVPlayerItem) {
        Task { @MainActor [weak self, weak item] in
            guard let self, let item else { return }
            await self.audioAnalyzer.installBeforePlayback(item) { [weak self] in
                // Tylko zanim dźwięk ruszy. Podmiana audioMix na już grającym elemencie
                // potrafiła wyciszyć cały utwór.
                guard let self, let player = self.player, player.currentItem === item else { return false }
                return player.timeControlStatus != .playing
            }
        }
    }

    func seek(to seconds: Double) {
        let time = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        player?.seek(to: time)
        currentTime = max(0, seconds)
        refreshNowPlaying(force: true)
    }

    func skipNext() async {
        guard !queue.isEmpty else { return }
        suppressAutoHandoffUntil = Date().addingTimeInterval(1.2)
        beginPlaybackBackgroundTask()
        await runSerializedPlay { [weak self] generation in
            guard let self else { return }
            if self.orderCursor < self.playOrder.count - 1 {
                self.orderCursor += 1
            } else if self.repeatMode == .all {
                self.orderCursor = 0
            } else {
                return
            }
            await self.playOrderIndex(self.orderCursor, generation: generation)
        }
    }

    func skipPrevious() async {
        guard !queue.isEmpty else { return }
        if livePlaybackTime() > 3 {
            seek(to: 0)
            return
        }
        await runSerializedPlay { [weak self] generation in
            guard let self else { return }
            if self.orderCursor > 0 {
                self.orderCursor -= 1
            } else if self.repeatMode == .all {
                self.orderCursor = max(self.playOrder.count - 1, 0)
            } else {
                self.seek(to: 0)
                return
            }
            await self.playOrderIndex(self.orderCursor, generation: generation)
        }
    }

    /// Insert tracks to play immediately after the current item (Apple Music “Play Next”).
    ///
    /// Pracuje na lokalnej kopii kolejki: wcześniej domknięcie `removeAll` czytało `playOrder`
    /// w trakcie jego modyfikacji (Swift zatrzymuje wtedy aplikację), a usunięcie utworu sprzed
    /// bieżącego przesuwało wskaźnik na zły utwór.
    func insertNext(_ tracks: [MusicPlaybackTrack]) {
        guard !tracks.isEmpty else { return }
        let result = PlayNextQueueEdit.apply(
            playOrder: playOrder,
            cursor: orderCursor,
            inserting: tracks.map { enqueueUnique($0) }
        )
        playOrder = result.playOrder
        orderCursor = result.cursor
        queueRevision &+= 1
        invalidatePreparedNext()
        BluetoothMediaBrowser.shared.reloadQueue(from: self)
        let generation = sessionGeneration
        Task { await self.prefetchUpcoming(from: playOrder[safe: orderCursor] ?? 0, generation: generation) }
    }

    /// Append tracks to the end of the current play order (Apple Music “Play Later”).
    func appendLater(_ tracks: [MusicPlaybackTrack]) {
        guard !tracks.isEmpty else { return }
        for track in tracks {
            let qi = enqueueUnique(track)
            if !playOrder.contains(qi) {
                playOrder.append(qi)
            }
        }
        queueRevision &+= 1
        BluetoothMediaBrowser.shared.reloadQueue(from: self)
    }

    /// Zmienia się przy każdej edycji kolejki — widok kolejki odświeża się od razu
    /// (wcześniej przesunięty utwór „wracał”, bo lista nie wiedziała o zmianie).
    @Published private(set) var queueRevision = 0

    func removeFromQueue(orderIndex: Int) {
        guard playOrder.indices.contains(orderIndex), orderIndex != orderCursor else { return }
        playOrder.remove(at: orderIndex)
        if orderIndex < orderCursor {
            orderCursor -= 1
        }
        queueRevision &+= 1
        invalidatePreparedNext()
        BluetoothMediaBrowser.shared.reloadQueue(from: self)
    }

    /// Przesunięcie jak w `List.onMove` (indeks docelowy = „wstaw przed”, może być równy liczbie
    /// elementów). Bieżący utwór zostaje bieżącym niezależnie od tego, co przesunięto.
    func moveQueueItems(fromOffsets source: IndexSet, toOffset destination: Int) {
        guard !source.isEmpty, destination >= 0, destination <= playOrder.count else { return }
        let currentQueueIndex = playOrder.indices.contains(orderCursor) ? playOrder[orderCursor] : nil
        playOrder.move(fromOffsets: source, toOffset: destination)
        if let currentQueueIndex, let cursor = playOrder.firstIndex(of: currentQueueIndex) {
            orderCursor = cursor
        }
        queueRevision &+= 1
        invalidatePreparedNext()
        BluetoothMediaBrowser.shared.reloadQueue(from: self)
        let generation = sessionGeneration
        Task { await self.prefetchUpcoming(from: self.playOrder[safe: self.orderCursor] ?? 0, generation: generation) }
    }

    func moveQueueItem(from source: Int, to destination: Int) {
        guard playOrder.indices.contains(source), playOrder.indices.contains(destination) else { return }
        let value = playOrder.remove(at: source)
        playOrder.insert(value, at: destination)
        if source == orderCursor {
            orderCursor = destination
        } else if source < orderCursor, destination >= orderCursor {
            orderCursor -= 1
        } else if source > orderCursor, destination <= orderCursor {
            orderCursor += 1
        }
        queueRevision &+= 1
        invalidatePreparedNext()
        BluetoothMediaBrowser.shared.reloadQueue(from: self)
    }

    @discardableResult
    private func enqueueUnique(_ track: MusicPlaybackTrack) -> Int {
        if let existing = queue.firstIndex(where: { $0.id == track.id || $0.url == track.url }) {
            return existing
        }
        queue.append(track)
        return queue.count - 1
    }

    private func invalidatePreparedNext() {
        if let item = prefetchedStream?.item, let player, player.items().contains(where: { $0 === item }) {
            if item !== player.currentItem {
                player.remove(item)
            }
        }
        prefetchedStream = nil
    }

    private func runSerializedPlay(_ work: @escaping (Int) async -> Void) async {
        activePlayTask?.cancel()
        let generation = sessionGeneration
        let task = Task { @MainActor in
            await work(generation)
        }
        activePlayTask = task
        await task.value
    }

    func toggleShuffle() {
        shuffleEnabled.toggle()
        let anchor = playOrder[safe: orderCursor] ?? 0
        rebuildPlayOrder(shuffled: shuffleEnabled, anchor: anchor)
        queueRevision &+= 1
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

        beginPlaybackTransition(queueIndex: index)
        cleanupObservers()
        finalizeListenSession()

        currentTrack = track
        beginListenSession(for: track)
        clearDisplayArtwork()
        playbackOrigin = .unknown
        if let stale = prefetchedStream, stale.trackID == track.id, !stale.isFresh {
            invalidatePreparedNext()
        }
        let canReusePrepared = prefetchedStream?.trackID == track.id && prefetchedStream?.item != nil
        isLoading = !canReusePrepared
        isBuffering = false
        if !track.isExternal,
           isDownloaded(track),
           OpenedAudioRegistry.localURL(for: track.url) == nil,
           OfflineMusicStore.shared.localURL(for: track.url) == nil {
            setPlaybackActivity(.onServerConnecting, title: "Na serwerze EOS", detail: track.title)
        } else {
            setPlaybackActivity(
                .resolvingStream,
                title: "Przygotowuję odtwarzanie",
                detail: track.title
            )
        }
        errorMessage = nil
        streamRecoveryAttempts = 0
        continuousPlayingSince = nil
        activeStreamJobId = nil
        tokenExpiresAt = nil
        currentStreamIsReadyRemote = false
        currentTime = 0
        duration = track.duration ?? 0
        isPlaying = player?.rate ?? 0 > 0.01
        supplementalNowPlayingMetadata = nil
        refreshNowPlaying(force: true)

        let openSignpost = EOSPerfLog.intervalBegin("StreamOpen")
        streamOpenSignpost = openSignpost
        EOSPerfLog.stream.info(
            "stream start title=\(track.title, privacy: .public) external=\(track.isExternal) onServer=\(self.isDownloaded(track))"
        )

        do {
            let streamURL: URL
            let readyRemote: Bool
            if let hit = prefetchedStream, hit.trackID == track.id {
                prefetchedStream = nil
                streamURL = hit.url
                readyRemote = hit.readyRemote
                if !streamURL.isFileURL {
                    playbackOrigin = hit.readyRemote ? .server : .liveSource
                }
                EOSPerfLog.stream.debug("prefetch hit title=\(track.title, privacy: .public)")
            } else {
                streamURL = try await resolveStreamURL(for: track, forceRefresh: false)
                readyRemote = !streamURL.isFileURL && isDownloaded(track) && playbackOrigin == .server
            }
            guard generation == sessionGeneration, !Task.isCancelled else {
                EOSPerfLog.intervalEnd("StreamOpen", id: openSignpost)
                streamOpenSignpost = nil
                return
            }
            await loadStream(
                url: streamURL,
                track: track,
                queueIndex: index,
                generation: generation,
                resumeAt: 0,
                readyRemote: readyRemote
            )
            Task { [weak self] in
                await self?.prefetchUpcoming(from: index, generation: generation)
            }
            startWatchdog(track: track, queueIndex: index, generation: generation)
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

    /// Utwór „gra”, a czas stoi i nie ma dźwięku — po 7 s otwórz stream od nowa
    /// (zamiast czekać minutę na timeout AVPlayera).
    private func isStartStuck(generation: Int) -> Bool {
        guard generation == sessionGeneration, playbackDesired,
              let player, let item = player.currentItem else { return false }
        if item.status == .failed { return true }
        let pos = item.currentTime().seconds
        return player.timeControlStatus != .playing && (!pos.isFinite || pos < 0.5)
    }

    private func startWatchdog(track: MusicPlaybackTrack, queueIndex: Int, generation: Int) {
        Task { @MainActor [weak self] in
            // 1) Po 3,5 s: to samo, co robi odblokowanie ekranu — aktywna sesja audio + play().
            //    Na zablokowanym ekranie licznik szedł, a AVPlayer stał, bo sesja była nieaktywna.
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            guard let self, self.isStartStuck(generation: generation) else { return }
            AudioSession.activateForPlayback(force: true)
            self.player?.play()
            self.syncPlayingState()
            // 2) Po kolejnych 3,5 s dalej stoi — otwórz stream od nowa (tylko trwałe kopie;
            //    live stream ma prawo czekać na pierwsze bajty).
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            guard self.isStartStuck(generation: generation), let item = self.player?.currentItem else { return }
            let isFile = (item.asset as? AVURLAsset)?.url.isFileURL == true
            guard self.currentStreamIsReadyRemote || isFile else { return }
            EOSPerfLog.stream.info("start watchdog: remount title=\(track.title, privacy: .public)")
            self.prefetchedStream = nil
            await self.recoverFromStreamDisruption(
                track: track,
                queueIndex: queueIndex,
                generation: generation,
                at: 0,
                reason: "start watchdog"
            )
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

    private func resolveStreamURL(
        for track: MusicPlaybackTrack,
        forceRefresh: Bool,
        ignoreLocalFile: Bool = false
    ) async throws -> URL {
        if !ignoreLocalFile, let openedLocal = OpenedAudioRegistry.localURL(for: track.url) {
            activeStreamJobId = nil
            tokenExpiresAt = nil
            setPlaybackActivity(.openingLocal, title: "Importowany plik", detail: "Odtwarzam z iPhone'a")
            playbackOrigin = .phone
            return openedLocal
        }

        if !ignoreLocalFile, let local = OfflineMusicStore.shared.localURL(for: track.url) {
            if offlineOnly || track.isExternal {
                activeStreamJobId = nil
                tokenExpiresAt = nil
                setPlaybackActivity(.openingLocal, title: "Plik lokalny", detail: "Odtwarzam z iPhone'a")
                playbackOrigin = .phone
                return local
            }
            // Play immediately — ID3 mismatch check used to block start by 200–800ms.
            activeStreamJobId = nil
            tokenExpiresAt = nil
            setPlaybackActivity(.openingLocal, title: "Plik lokalny", detail: "Odtwarzam z iPhone'a")
            playbackOrigin = .phone
            let generation = sessionGeneration
            Task { [weak self] in
                await self?.remountIfLocalMetadataConflicts(track: track, local: local, generation: generation)
            }
            return local
        }

        // Folder / iCloud imports: prefer durable EOS stream so other devices can play
        // after upload — do not require the original security-scoped bookmark.
        if track.isExternal {
            if offlineOnly {
                throw APIError.server("Tryb Offline — utwór nie jest pobrany na to urządzenie.")
            }
            if let stream = try await resolveExternalViaServerIfPossible(
                track: track,
                forceRefresh: forceRefresh
            ) {
                return stream
            }
            if let resolver = externalFileResolver {
                do {
                    return try await resolver(track)
                } catch {
                    throw APIError.server(
                        "Nie można odtworzyć pliku z chmury. Poczekaj na „Zapis na serwer EOS” albo otwórz folder na tym urządzeniu."
                    )
                }
            }
            if let file = track.playbackFileURL {
                playbackOrigin = file.isFileURL ? .phone : .liveSource
                return file
            }
            throw APIError.server(
                "Nie można odtworzyć pliku z chmury. Utwór jeszcze nie jest dostępny na serwerze EOS."
            )
        }

        guard let api else { throw APIError.server("Brak połączenia z serwerem.") }

        if offlineOnly {
            throw APIError.server("Tryb Offline — utwór nie jest pobrany na to urządzenie.")
        }

        let knownIds = [track.downloadJobId, jobLookup?(track.url), track.serverAssetId]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        var seenIds = Set<String>()
        let uniqueIds = knownIds.filter { seenIds.insert($0).inserted }
        let verifyKnown = forceRefresh || streamRecoveryAttempts > 0

        // Utwór już leży na serwerze — graj od razu. Wcześniej najpierw szło pytanie o aktywne
        // pobierania; po zmianie kolejności playlisty serwer kolejkował jej utwory i odtwarzacz
        // czekał (do 10 min) na „zapis” utworu, który był gotowy od dawna.
        if !verifyKnown {
            for jobId in uniqueIds {
                guard let status = try? await api.fetchJobStatus(jobId: jobId),
                      status.isPlayableServerStream, status.isDurableServerCopy else { continue }
                bindDurableJobId(jobId, toTrackURL: track.url)
                playbackOrigin = .server
                return try await authenticatedStreamURL(
                    jobId: jobId,
                    track: track,
                    durable: true,
                    forceRefresh: false
                )
            }
        }

        // Play + „Zapis na serwer” of the same URL must share one job. A second live
        // play never gets first bytes while the NAS is busy ingesting.
        let shouldProbeActive =
            verifyKnown
            || MusicDownloadService.hasActiveDownloads
            || MusicDownloadService.isServerAcquireActive(track.url)
            || uniqueIds.isEmpty
        if shouldProbeActive, let active = await api.findActiveMusicJob(url: track.url), !active.jobId.isEmpty {
            // Kolejka zapisu playlisty może trzymać „queued” dla utworu, który już jest na dysku.
            // Serwer odda gotowy plik od ręki — nie czekaj na zadanie z kolejki.
            if active.looksLikeFileIngest, !active.isTerminal,
               let ensure = try? await api.startMusicPlay(url: track.url, folderId: track.folderId, trackUrl: track.url, intent: "play"),
               ensure.ready == true, ensure.isDurableServerCopy,
               let token = ensure.token, !token.isEmpty {
                bindDurableJobId(ensure.jobId, toTrackURL: track.url)
                rememberStreamToken(jobId: ensure.jobId, token: token, expiresIn: nil)
                playbackOrigin = .server
                setPlaybackActivity(.onServerConnecting, title: "Na serwerze EOS", detail: "Odtwarzam…")
                return api.musicStreamURL(jobId: ensure.jobId, token: token)
            }
            EOSPerfLog.stream.debug(
                "reuse active server job=\(active.jobId, privacy: .public) status=\(active.status, privacy: .public) ingest=\(active.looksLikeFileIngest)"
            )
            return try await openJobStream(
                jobId: active.jobId,
                track: track,
                preferDurable: active.looksLikeFileIngest && !active.isTerminal,
                waitIfNeeded: !active.isTerminal,
                forceRefresh: forceRefresh
            )
        }

        // Never open a competing live play job while this URL is being saved to NAS.
        if MusicDownloadService.isServerAcquireActive(track.url) {
            if let active = await api.findActiveMusicJob(url: track.url), !active.isTerminal {
                EOSPerfLog.stream.debug(
                    "play waits for server acquire job=\(active.jobId, privacy: .public)"
                )
                return try await openJobStream(
                    jobId: active.jobId,
                    track: track,
                    preferDurable: active.looksLikeFileIngest,
                    waitIfNeeded: true,
                    forceRefresh: forceRefresh
                )
            }
            for _ in 0..<40 {
                if let active = await api.findActiveMusicJob(url: track.url), !active.isTerminal {
                    EOSPerfLog.stream.debug(
                        "play picked up queued server acquire job=\(active.jobId, privacy: .public)"
                    )
                    return try await openJobStream(
                        jobId: active.jobId,
                        track: track,
                        preferDurable: active.looksLikeFileIngest,
                        waitIfNeeded: true,
                        forceRefresh: forceRefresh
                    )
                }
                try await Task.sleep(nanoseconds: 250_000_000)
            }
        }

        for jobId in uniqueIds {
            if let status = try? await api.fetchJobStatus(jobId: jobId) {
                if status.status.lowercased() == "error" || status.status.lowercased() == "cancelled" {
                    clearServerJobBinding(for: track)
                    continue
                }
                if status.looksLikeFileIngest, !status.isPlayableServerStream {
                    return try await openJobStream(
                        jobId: jobId,
                        track: track,
                        preferDurable: true,
                        waitIfNeeded: true,
                        forceRefresh: forceRefresh
                    )
                }
                if status.isPlayableServerStream {
                    return try await openJobStream(
                        jobId: jobId,
                        track: track,
                        preferDurable: status.isDurableServerCopy,
                        waitIfNeeded: false,
                        forceRefresh: forceRefresh || streamRecoveryAttempts > 0
                    )
                }
            }
        }

        setPlaybackActivity(
            .preparingServer,
            title: "Łączę ze źródłem",
            detail: "Otwieram live stream…",
            progress: 3
        )
        playbackOrigin = .liveSource
        let ensure = try await api.startMusicPlay(
            url: track.url,
            folderId: track.folderId,
            trackUrl: track.url,
            intent: "play"
        )
        var durable = ensure.isDurableServerCopy
        let jobId = ensure.jobId
        if durable {
            bindDurableJobId(jobId, toTrackURL: track.url)
        }
        let ingesting = ensure.status?.lowercased() == "downloading" || (ensure.mode == "file" && ensure.ready != true)
        if let token = ensure.token, !token.isEmpty, ensure.ready == true, !ingesting {
            rememberStreamToken(jobId: jobId, token: token, expiresIn: nil)
            if durable {
                setPlaybackActivity(.onServerConnecting, title: "Na serwerze EOS", detail: "Odtwarzam…")
                playbackOrigin = .server
            } else {
                setPlaybackActivity(.connectingStream, title: "Źródło", detail: "Otwieram stream…")
                playbackOrigin = .liveSource
            }
            return api.musicStreamURL(jobId: jobId, token: token)
        }
        if ensure.ready == true, durable, !ingesting {
            return try await authenticatedStreamURL(
                jobId: jobId,
                track: track,
                durable: true,
                forceRefresh: forceRefresh
            )
        }
        if ensure.ready != true || ingesting {
            let waited = try await api.waitForMusicPlayReady(
                jobId: jobId,
                timeoutSeconds: ingesting ? 600 : 180,
                requireDurable: ingesting
            ) { [weak self] progress, status in
                Task { @MainActor in
                    self?.setPlaybackActivity(
                        .preparingServer,
                        title: ingesting ? "Zapis na serwer EOS" : (durable ? "Przygotowanie na serwerze" : "Łączę ze źródłem"),
                        detail: Self.serverStatusCaption(status),
                        progress: progress
                    )
                }
            }
            durable = waited.isDurableServerCopy || durable
            if durable {
                bindDurableJobId(jobId, toTrackURL: track.url)
            }
        }
        return try await authenticatedStreamURL(
            jobId: jobId,
            track: track,
            durable: durable,
            forceRefresh: forceRefresh
        )
    }

    /// Cross-device path for `eosmusic://external/…` after upload: stream `/api/music/stream/{jobId}`.
    private func resolveExternalViaServerIfPossible(
        track: MusicPlaybackTrack,
        forceRefresh: Bool
    ) async throws -> URL? {
        guard let api else { return nil }

        let knownIds = [track.downloadJobId, jobLookup?(track.url), track.serverAssetId]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        var seen = Set<String>()
        let uniqueIds = knownIds.filter { seen.insert($0).inserted }

        if let jobId = uniqueIds.first {
            EOSPerfLog.stream.debug(
                "external via durable job=\(jobId, privacy: .public) url=\(track.url, privacy: .public)"
            )
            return try await openJobStream(
                jobId: jobId,
                track: track,
                preferDurable: true,
                waitIfNeeded: true,
                forceRefresh: forceRefresh
            )
        }

        if let active = await api.findActiveMusicJob(url: track.url), !active.jobId.isEmpty {
            EOSPerfLog.stream.debug(
                "external via active job=\(active.jobId, privacy: .public) status=\(active.status, privacy: .public)"
            )
            return try await openJobStream(
                jobId: active.jobId,
                track: track,
                preferDurable: active.looksLikeFileIngest || active.isTerminal,
                waitIfNeeded: !active.isTerminal,
                forceRefresh: forceRefresh
            )
        }

        if MusicDownloadService.isServerAcquireActive(track.url) {
            for _ in 0..<24 {
                try await Task.sleep(nanoseconds: 400_000_000)
                if let active = await api.findActiveMusicJob(url: track.url), !active.jobId.isEmpty {
                    return try await openJobStream(
                        jobId: active.jobId,
                        track: track,
                        preferDurable: true,
                        waitIfNeeded: true,
                        forceRefresh: forceRefresh
                    )
                }
                if !MusicDownloadService.isServerAcquireActive(track.url) { break }
            }
        }

        return nil
    }

    private func openJobStream(
        jobId: String,
        track: MusicPlaybackTrack,
        preferDurable: Bool,
        waitIfNeeded: Bool,
        forceRefresh: Bool
    ) async throws -> URL {
        guard let api else { throw APIError.server("Brak połączenia z serwerem.") }
        if preferDurable {
            setPlaybackActivity(
                .preparingServer,
                title: "Zapis na serwer EOS",
                detail: "Czekam aż plik będzie gotowy do odtwarzania…",
                progress: 4
            )
            playbackOrigin = .server
            let waited = try await api.waitForMusicPlayReady(
                jobId: jobId,
                timeoutSeconds: 600,
                requireDurable: true
            ) { [weak self] progress, status in
                Task { @MainActor in
                    self?.setPlaybackActivity(
                        .preparingServer,
                        title: "Zapis na serwer EOS",
                        detail: Self.serverStatusCaption(status),
                        progress: progress
                    )
                }
            }
            let durable = waited.isDurableServerCopy
            if durable {
                bindDurableJobId(jobId, toTrackURL: track.url)
            }
            return try await authenticatedStreamURL(
                jobId: jobId,
                track: track,
                durable: durable,
                forceRefresh: forceRefresh
            )
        }
        if waitIfNeeded {
            let waited = try await api.waitForMusicPlayReady(jobId: jobId) { [weak self] progress, status in
                Task { @MainActor in
                    self?.setPlaybackActivity(
                        .preparingServer,
                        title: "Łączę ze źródłem",
                        detail: Self.serverStatusCaption(status),
                        progress: progress
                    )
                }
            }
            let durable = waited.isDurableServerCopy
            if durable {
                bindDurableJobId(jobId, toTrackURL: track.url)
            }
            return try await authenticatedStreamURL(
                jobId: jobId,
                track: track,
                durable: durable,
                forceRefresh: forceRefresh
            )
        }
        return try await authenticatedStreamURL(
            jobId: jobId,
            track: track,
            durable: preferDurable,
            forceRefresh: forceRefresh
        )
    }

    private func authenticatedStreamURL(
        jobId: String,
        track: MusicPlaybackTrack,
        durable: Bool,
        forceRefresh: Bool
    ) async throws -> URL {
        guard let api else { throw APIError.server("Brak połączenia z serwerem.") }
        if durable {
            bindDurableJobId(jobId, toTrackURL: track.url)
            playbackOrigin = .server
            setPlaybackActivity(.onServerConnecting, title: "Na serwerze EOS", detail: "Odtwarzam…")
        } else {
            playbackOrigin = .liveSource
            setPlaybackActivity(.connectingStream, title: "Źródło", detail: "Otwieram stream…")
        }

        let needsFreshToken = forceRefresh || tokenNeedsRefreshBeforeRemount()
        if !needsFreshToken, let cached = cachedPlayToken(for: jobId) {
            activateStreamToken(jobId: jobId, token: cached.token, expiresAt: cached.expiresAt)
            EOSPerfLog.stream.debug("token cache hit job=\(jobId, privacy: .public)")
            return api.musicStreamURL(jobId: jobId, token: cached.token)
        }

        do {
            let token = try await api.musicPlayToken(jobId: jobId)
            rememberStreamToken(jobId: jobId, token: token.token, expiresIn: token.expiresIn)
            return api.musicStreamURL(jobId: jobId, token: token.token)
        } catch {
            EOSPerfLog.stream.error(
                "play-token fetch failed job=\(jobId, privacy: .public) error=\(error.localizedDescription, privacy: .public)"
            )
            throw error
        }
    }

    private static func isEOSMusicStream(_ url: URL) -> Bool {
        let path = url.path.lowercased()
        return path.contains("/api/music/stream/") || path.contains("/api/file/")
    }

    private func bindDurableJobId(_ jobId: String, toTrackURL url: String) {
        guard !jobId.isEmpty, let idx = queue.firstIndex(where: { $0.url == url }) else { return }
        let current = queue[idx]
        if current.serverAssetId == jobId || current.downloadJobId == jobId { return }
        queue[idx] = current.applying(downloadJobId: jobId)
    }

    private func clearServerJobBinding(for track: MusicPlaybackTrack) {
        guard let idx = queue.firstIndex(where: { $0.url == track.url }) else { return }
        let staleJobId = track.serverAssetId ?? track.downloadJobId
        queue[idx] = queue[idx].withoutServerJobIds()
        if let staleJobId, !staleJobId.isEmpty {
            playTokenCache.removeValue(forKey: staleJobId)
        }
    }

    private static func shouldReacquireAfterStreamFailure(_ reason: String) -> Bool {
        let lower = reason.lowercased()
        return lower.contains("404")
            || lower.contains("not found")
            || lower.contains("first-byte-timeout")
            || lower.contains("cannot open")
            || lower.contains("couldn't be opened")
            || lower.contains("could not be opened")
            || lower.contains("-11828")
            || lower.contains("-11800")
            || lower.contains("operation stopped")
    }

    private static func serverStatusCaption(_ status: String) -> String {
        switch status {
        case "preparing": return "Szukam źródła audio…"
        case "starting": return "Start streamu…"
        case "downloading": return "Zapisuję trwałą kopię na serwerze…"
        case "done": return "Gotowe — łączę ze streamem"
        default: return status.isEmpty ? "Czekam na serwer…" : status
        }
    }

    private func warmPlayTokenInBackground(jobId: String) {
        guard let api else { return }
        Task { [weak self] in
            guard let token = try? await api.musicPlayToken(jobId: jobId) else { return }
            await MainActor.run {
                self?.rememberStreamToken(jobId: jobId, token: token.token, expiresIn: token.expiresIn)
            }
        }
    }

    private func remountIfLocalMetadataConflicts(
        track: MusicPlaybackTrack,
        local: URL,
        generation: Int
    ) async {
        guard generation == sessionGeneration, currentTrack?.id == track.id else { return }
        guard await localFileConflicts(with: track, at: local) else { return }
        EOSPerfLog.stream.warning(
            "local file metadata conflict title=\(track.title, privacy: .public) — remounting server stream"
        )
        guard let queueIndex = queue.firstIndex(where: { $0.id == track.id }) else { return }
        do {
            let streamURL = try await resolveStreamURL(for: track, forceRefresh: false, ignoreLocalFile: true)
            guard generation == sessionGeneration, currentTrack?.id == track.id else { return }
            let resumeAt = livePlaybackTime()
            teardownPlayer()
            await loadStream(
                url: streamURL,
                track: track,
                queueIndex: queueIndex,
                generation: generation,
                resumeAt: resumeAt,
                readyRemote: !streamURL.isFileURL && isDownloaded(track)
            )
        } catch {
            EOSPerfLog.stream.error("local conflict remount failed: \(error.localizedDescription, privacy: .public)")
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

    /// Warm the next track so the queue advances without a gap — also while the phone is locked.
    private func prefetchUpcoming(from _: Int, generation: Int) async {
        guard generation == sessionGeneration, !offlineOnly else { return }
        let nextCursor: Int
        if orderCursor + 1 < playOrder.count {
            nextCursor = orderCursor + 1
        } else if repeatMode == .all, playOrder.count > 1 {
            nextCursor = 0
        } else {
            return
        }
        guard nextCursor >= 0, nextCursor < playOrder.count else { return }
        let qi = playOrder[nextCursor]
        guard queue.indices.contains(qi) else { return }
        let track = queue[qi]
        if prefetchedStream?.trackID == track.id, prefetchedStream?.item != nil { return }
        guard !MusicDownloadService.isServerAcquireActive(track.url) else { return }
        if let local = OfflineMusicStore.shared.localURL(for: track.url) {
            await preparePrefetchItem(trackID: track.id, url: local, readyRemote: false, generation: generation)
            return
        }
        if track.isExternal {
            if let resolver = externalFileResolver, let local = try? await resolver(track) {
                await preparePrefetchItem(trackID: track.id, url: local, readyRemote: false, generation: generation)
            }
            return
        }
        guard let api else { return }

        let knownIds = [track.downloadJobId, jobLookup?(track.url), track.serverAssetId]
            .compactMap { $0 }
            .filter { !$0.isEmpty }

        if let jobId = knownIds.first {
            if let status = try? await api.fetchJobStatus(jobId: jobId),
               status.looksLikeFileIngest, !status.isPlayableServerStream {
                return
            }
            if let cached = cachedPlayToken(for: jobId) {
                let url = api.musicStreamURL(jobId: jobId, token: cached.token)
                await preparePrefetchItem(trackID: track.id, url: url, readyRemote: true, generation: generation)
                return
            }
            if let token = try? await api.musicPlayToken(jobId: jobId) {
                rememberStreamToken(jobId: jobId, token: token.token, expiresIn: token.expiresIn)
                let url = api.musicStreamURL(jobId: jobId, token: token.token)
                await preparePrefetchItem(trackID: track.id, url: url, readyRemote: true, generation: generation)
                return
            }
        }

        if let ensure = try? await api.startMusicPlay(
            url: track.url,
            folderId: track.folderId ?? folderId,
            trackUrl: track.url,
            intent: "play"
        ) {
            guard generation == sessionGeneration else { return }
            if ensure.isDurableServerCopy {
                bindDurableJobId(ensure.jobId, toTrackURL: track.url)
            }
            // Tylko trwałe kopie z serwera — prefetch streamu na żywo uruchamiał drugi
            // yt-dlp równolegle z bieżącym utworem i blokował jego start.
            if let token = ensure.token, !token.isEmpty, ensure.ready == true, ensure.isDurableServerCopy {
                rememberStreamToken(jobId: ensure.jobId, token: token, expiresIn: nil)
                let url = api.musicStreamURL(jobId: ensure.jobId, token: token)
                await preparePrefetchItem(
                    trackID: track.id,
                    url: url,
                    readyRemote: ensure.isDurableServerCopy,
                    generation: generation
                )
            }
        }
    }

    private func preparePrefetchItem(trackID: String, url: URL, readyRemote: Bool, generation: Int) async {
        let item = makePlayerItem(url: url)
        applyBufferPolicy(to: item, readyRemote: readyRemote, isRemote: !url.isFileURL)
        _ = try? await item.asset.load(.isPlayable)
        guard generation == sessionGeneration else { return }
        await audioAnalyzer.installBeforePlayback(item)
        guard generation == sessionGeneration else { return }
        if let queueIndex = queue.firstIndex(where: { $0.id == trackID }) {
            rememberQueuedItem(item, queueIndex: queueIndex)
        }
        prefetchedStream = PrefetchedStream(trackID: trackID, url: url, readyRemote: readyRemote, item: item)
        if let player, item !== player.currentItem {
            for leftover in player.items() where leftover !== player.currentItem {
                player.remove(leftover)
            }
            player.insert(item, after: player.currentItem)
        }
    }

    private func adoptOrMakeItem(url: URL, trackID: String) -> AVPlayerItem {
        if let prepared = prefetchedStream, prepared.trackID == trackID, let item = prepared.item {
            prefetchedStream = nil
            return item
        }
        return makePlayerItem(url: url)
    }

    /// Mały bufor tylko na starcie (szybki Play). Po starcie `relaxForwardBufferAfterStart`
    /// oddaje decyzję AVPlayerowi — inaczej 0,4 s zapasu oznaczało przerwę przy każdym wahnięciu sieci.
    private func applyBufferPolicy(to item: AVPlayerItem, readyRemote: Bool, isRemote: Bool) {
        if readyRemote {
            item.preferredForwardBufferDuration = 0.4
        } else if isRemote {
            item.preferredForwardBufferDuration = 2.5
        }
    }

    private var relaxedBufferItemID: ObjectIdentifier?

    private func relaxForwardBufferAfterStart() {
        guard let player, player.timeControlStatus == .playing, let item = player.currentItem else { return }
        let oid = ObjectIdentifier(item)
        guard relaxedBufferItemID != oid else { return }
        relaxedBufferItemID = oid
        guard let asset = item.asset as? AVURLAsset, !asset.url.isFileURL else { return }
        // 0 = automatycznie: AVPlayer buforuje do przodu tyle, ile uzna za bezpieczne.
        item.preferredForwardBufferDuration = 0
        if !player.automaticallyWaitsToMinimizeStalling {
            player.automaticallyWaitsToMinimizeStalling = true
        }
    }

    /// „Powtarzaj utwór”: odtwarzacz nie może sam przejść do przygotowanego następnego utworu,
    /// bo wtedy grał następny, a ekran pokazywał poprzedni (albo muzyka stawała).
    private func applyRepeatModeToPlayer() {
        player?.actionAtItemEnd = repeatMode == .one ? .none : .advance
    }

    private func ensureQueuePlayer() -> AVQueuePlayer {
        if let player { return player }
        let created = AVQueuePlayer()
        created.actionAtItemEnd = repeatMode == .one ? .none : .advance
        created.allowsExternalPlayback = true
        created.usesExternalPlaybackWhileExternalScreenIsActive = false
        player = created
        return created
    }

    private func installItemOnQueue(_ item: AVPlayerItem, resumeAt: Double, queuePlayer: AVQueuePlayer) {
        if queuePlayer.currentItem === item { return }
        if queuePlayer.items().contains(where: { $0 === item }) {
            if queuePlayer.currentItem !== item {
                queuePlayer.advanceToNextItem()
            }
            return
        }
        if resumeAt > 0.5 {
            queuePlayer.removeAllItems()
            queuePlayer.insert(item, after: nil)
            return
        }
        if let current = queuePlayer.currentItem {
            for leftover in queuePlayer.items() where leftover !== current {
                queuePlayer.remove(leftover)
            }
            queuePlayer.insert(item, after: current)
            queuePlayer.advanceToNextItem()
        } else {
            queuePlayer.insert(item, after: nil)
        }
    }

    private func rememberQueuedItem(_ item: AVPlayerItem, queueIndex: Int) {
        itemQueueIndex[ObjectIdentifier(item)] = queueIndex
    }

    /// Etykieta, okładka i zamek biorą utwór z tego, co AVPlayer naprawdę gra — nie z osobnego licznika.
    private func syncDisplayedTrackToPlayer(generation: Int) {
        guard generation == sessionGeneration, !ignoreItemChanges else { return }
        guard let item = player?.currentItem else { return }
        let oid = ObjectIdentifier(item)
        if itemQueueIndex[oid] == nil,
           let primed = prefetchedStream,
           primed.item === item,
           let primedIndex = queue.firstIndex(where: { $0.id == primed.trackID }) {
            itemQueueIndex[oid] = primedIndex
        }
        guard let queueIndex = itemQueueIndex[oid], queue.indices.contains(queueIndex) else { return }
        guard let cursor = playOrder.firstIndex(of: queueIndex) else { return }
        boundItemID = oid
        let track = queue[queueIndex]
        guard currentTrack?.id != track.id || orderCursor != cursor else { return }
        orderCursor = cursor
        beginPlaybackTransition(queueIndex: queueIndex)
        currentTrack = track
        beginListenSession(for: track)
        clearDisplayArtwork()
        supplementalNowPlayingMetadata = nil
        let elapsed = item.currentTime().seconds
        currentTime = elapsed.isFinite ? max(0, elapsed) : 0
        let length = item.duration.seconds
        duration = length.isFinite && length > 0 ? length : (track.duration ?? 0)
        startWatchdog(track: track, queueIndex: queueIndex, generation: generation)
        isLoading = false
        refreshNowPlaying(force: true)
        watchEnd(of: item, generation: generation)
        let nextGeneration = sessionGeneration
        Task { await self.prefetchUpcoming(from: queueIndex, generation: nextGeneration) }
    }

    private func watchEnd(of item: AVPlayerItem, generation: Int) {
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
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
                    self.refreshNowPlaying(force: true)
                    return
                }
                guard !self.ignoreItemChanges else { return }
                self.beginPlaybackBackgroundTask()
                self.syncDisplayedTrackToPlayer(generation: generation)
                if let current = self.player?.currentItem, current !== item {
                    return
                }
                if let player = self.player, player.items().contains(where: { $0 !== item }) {
                    try? await Task.sleep(nanoseconds: 160_000_000)
                    guard self.sessionGeneration == generation, !self.ignoreItemChanges else { return }
                    self.syncDisplayedTrackToPlayer(generation: generation)
                    if let current = player.currentItem, current !== item {
                        return
                    }
                }
                await self.advanceIfPlaybackEnded(generation: generation)
            }
        }
    }

    /// Następny utwór startuje tylko wtedy, gdy player naprawdę stanął na końcu — bez podwójnego przeskoku.
    private func advanceIfPlaybackEnded(generation: Int) async {
        guard generation == sessionGeneration, playbackDesired, !ignoreItemChanges else { return }
        guard Date().timeIntervalSince(lastHandoffAt) > 0.45 else { return }
        if let current = player?.currentItem {
            let elapsed = current.currentTime().seconds
            let length = current.duration.seconds
            let ended = length.isFinite && elapsed.isFinite && length > 1 && length - elapsed < 0.35
            if !ended { return }
        }
        lastHandoffAt = Date()
        let hasNext = orderCursor < playOrder.count - 1 || repeatMode == .all
        guard hasNext else {
            playbackDesired = false
            syncPlayingState()
            refreshNowPlaying(force: true)
            endPlaybackBackgroundTask()
            return
        }
        await skipNext()
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
        if streamRecoveryInFlight { return true }
        streamRecoveryInFlight = true
        defer { streamRecoveryInFlight = false }

        firstByteWatchdog?.cancel()
        firstByteWatchdog = nil

        let authFailure = isTokenAuthFailure(reason)
        if StreamRecoveryPolicy.isFatalPlaybackError(reason), !authFailure {
            EOSPerfLog.stream.error("fatal stream error — stop retrying: \(reason, privacy: .public)")
            return false
        }

        // Ingest in flight: wait for the MP3 instead of remounting an empty live proxy.
        if let api, let active = await api.findActiveMusicJob(url: track.url),
           active.looksLikeFileIngest, !active.isTerminal {
            errorMessage = nil
            isLoading = true
            setPlaybackActivity(
                .preparingServer,
                title: "Zapis na serwer EOS",
                detail: "Czekam aż plik będzie gotowy do odtwarzania…",
                progress: active.progressPercent
            )
            EOSPerfLog.stream.info(
                "stream waits for ingest job=\(active.jobId, privacy: .public) reason=\(reason, privacy: .public)"
            )
            do {
                let waited = try await api.waitForMusicPlayReady(
                    jobId: active.jobId,
                    timeoutSeconds: 600,
                    requireDurable: true
                ) { [weak self] progress, status in
                    Task { @MainActor in
                        self?.setPlaybackActivity(
                            .preparingServer,
                            title: "Zapis na serwer EOS",
                            detail: Self.serverStatusCaption(status),
                            progress: progress
                        )
                    }
                }
                guard generation == sessionGeneration else { return true }
                bindDurableJobId(active.jobId, toTrackURL: track.url)
                let streamURL = try await authenticatedStreamURL(
                    jobId: active.jobId,
                    track: track,
                    durable: waited.isDurableServerCopy,
                    forceRefresh: false
                )
                guard generation == sessionGeneration else { return true }
                await loadStream(
                    url: streamURL,
                    track: track,
                    queueIndex: queueIndex,
                    generation: generation,
                    resumeAt: max(0, resumeAt),
                    readyRemote: true
                )
                streamRecoveryAttempts = 0
                return true
            } catch {
                EOSPerfLog.stream.error("ingest wait failed: \(error.localizedDescription, privacy: .public)")
            }
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

        if Self.shouldReacquireAfterStreamFailure(reason), let api {
            let knownIds = [track.downloadJobId, jobLookup?(track.url), track.serverAssetId]
                .compactMap { $0 }
                .filter { !$0.isEmpty }
            for jobId in knownIds {
                if let status = try? await api.fetchJobStatus(jobId: jobId) {
                    let s = status.status.lowercased()
                    if s == "error" || s == "cancelled" {
                        EOSPerfLog.stream.warning("clear broken server job=\(jobId, privacy: .public)")
                        try? await api.cancelJob(jobId: jobId)
                    }
                }
            }
            clearServerJobBinding(for: track)
            streamRecoveryAttempts = 0
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
            await loadStream(
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
    ) async {
        guard generation == sessionGeneration else { return }

        if readyRemote {
            setPlaybackActivity(.onServerConnecting, title: "Na serwerze EOS", detail: "Start odtwarzania…")
        } else if url.isFileURL {
            setPlaybackActivity(.openingLocal, title: "Plik lokalny", detail: "Buforuję audio…")
        } else {
            setPlaybackActivity(.connectingStream, title: "Łączę ze streamem", detail: track.title)
        }

        cleanupObservers()

        AudioSession.activateForPlayback()

        currentStreamIsRemote = !url.isFileURL
        currentStreamIsReadyRemote = readyRemote && currentStreamIsRemote

        let item = adoptOrMakeItem(url: url, trackID: track.id)
        applyBufferPolicy(to: item, readyRemote: currentStreamIsReadyRemote, isRemote: currentStreamIsRemote)
        audioAnalyzer.setPublishHandler { [weak self] frame in
            self?.visualizer.apply(frame)
        }

        let queuePlayer = ensureQueuePlayer()
        queuePlayer.automaticallyWaitsToMinimizeStalling = currentStreamIsRemote && !currentStreamIsReadyRemote
        ignoreItemChanges = true
        installItemOnQueue(item, resumeAt: resumeAt, queuePlayer: queuePlayer)
        await installTapBeforePlay(item)
        ignoreItemChanges = false
        rememberQueuedItem(item, queueIndex: queueIndex)
        guard generation == sessionGeneration else { return }

        Task { [weak self] in
            await self?.hydratePlaybackMetadata(from: item, queueIndex: queueIndex, generation: generation)
        }

        // NO periodic time observer — the old 0.5s tick published UI / Now Playing and
        // produced a metronomic hitch (EQ + controls freezing every half-second).
        // Scrubber polls `livePlaybackTime()`; lock screen advances via playbackRate.
        if let existing = timeObserver {
            queuePlayer.removeTimeObserver(existing)
            timeObserver = nil
        }

        rateObserver = queuePlayer.observe(\.rate, options: [.new]) { [weak self] player, _ in
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

        timeControlObserver = queuePlayer.observe(\.timeControlStatus, options: [.new, .initial]) { [weak self] _, _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                self.updateBufferingState()
                self.syncPlayingState()
                self.relaxForwardBufferAfterStart()
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
                    return
                }
                guard !self.ignoreItemChanges else { return }
                self.beginPlaybackBackgroundTask()
                self.syncDisplayedTrackToPlayer(generation: generation)
                if let current = self.player?.currentItem, current !== item {
                    return
                }
                if let player = self.player, player.items().contains(where: { $0 !== item }) {
                    try? await Task.sleep(nanoseconds: 160_000_000)
                    guard self.sessionGeneration == generation, !self.ignoreItemChanges else { return }
                    self.syncDisplayedTrackToPlayer(generation: generation)
                    if let current = player.currentItem, current !== item {
                        return
                    }
                }
                await self.advanceIfPlaybackEnded(generation: generation)
            }
        }

        rememberQueuedItem(item, queueIndex: queueIndex)
        boundItemID = ObjectIdentifier(item)
        itemAdvanceObserver = queuePlayer.observe(\.currentItem, options: [.new]) { [weak self] player, _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                guard !self.ignoreItemChanges, self.repeatMode != .one else { return }
                guard let current = player.currentItem else {
                    await self.advanceIfPlaybackEnded(generation: generation)
                    return
                }
                guard ObjectIdentifier(current) != self.boundItemID else { return }
                self.syncDisplayedTrackToPlayer(generation: generation)
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
            queuePlayer.seek(to: seekTime) { [weak self] finished in
                Task { @MainActor in
                    guard let self, finished, self.sessionGeneration == generation else { return }
                    self.currentTime = resumeAt
                    self.player?.play()
                    self.syncPlayingState()
                    self.refreshNowPlaying(force: true)
                }
            }
        } else {
            queuePlayer.play()
            syncPlayingState()
            refreshNowPlaying(force: true)
        }
        armFirstByteWatchdog(track: track, queueIndex: queueIndex, generation: generation)
    }

    private func armFirstByteWatchdog(
        track: MusicPlaybackTrack,
        queueIndex: Int,
        generation: Int
    ) {
        firstByteWatchdog?.cancel()
        firstByteWatchdog = nil
        guard currentStreamIsRemote, !currentStreamIsReadyRemote else { return }
        firstByteWatchdog = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: StreamRecoveryPolicy.firstByteTimeoutNanoseconds)
            guard let self, !Task.isCancelled, self.sessionGeneration == generation else { return }
            guard self.playbackDesired, self.currentStreamIsRemote, !self.currentStreamIsReadyRemote else { return }
            let loaded = self.streamLoadedSeconds()
            let elapsed = self.livePlaybackTime()
            guard elapsed < 0.4, loaded < 0.25 else { return }
            EOSPerfLog.stream.warning(
                "first-byte timeout title=\(track.title, privacy: .public) loaded=\(loaded, format: .fixed(precision: 2))"
            )
            await self.recoverFromStreamDisruption(
                track: track,
                queueIndex: queueIndex,
                generation: generation,
                at: max(0, elapsed),
                reason: "first-byte-timeout"
            )
        }
    }

    private func streamLoadedSeconds() -> Double {
        guard let item = player?.currentItem else { return 0 }
        let loaded = item.loadedTimeRanges
            .compactMap { $0.timeRangeValue.end.seconds }
            .max() ?? 0
        return loaded.isFinite ? max(0, loaded) : 0
    }

    private func makePlayerItem(url: URL) -> AVPlayerItem {
        var options: [String: Any] = [AVURLAssetHTTPUserAgentKey: AppConfig.userAgent]
        if Self.isEOSMusicStream(url) {
            var headers: [String: String] = ["User-Agent": AppConfig.userAgent]
            if let token = api?.sessionToken, !token.isEmpty {
                headers["Authorization"] = "Bearer \(token)"
            }
            options["AVURLAssetHTTPHeaderFieldsKey"] = headers
        }
        let asset = AVURLAsset(url: url, options: options)
        return AVPlayerItem(asset: asset, automaticallyLoadedAssetKeys: ["playable"])
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
            firstByteWatchdog?.cancel()
            firstByteWatchdog = nil
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
        PlayerAudioVisualizer.isPlayingNow = playing
        if playing {
            if isLoading { isLoading = false }
            endPlaybackBackgroundTask()
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
        tickListenSession()
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
            collectionPersistentSeed: folderId ?? sessionCollectionId,
            externalContentIdentifier: BluetoothMediaBrowser.queueContentIdentifier(orderIndex: orderCursor),
            repeatMode: repeatMode,
            shuffleEnabled: shuffleEnabled,
            supplemental: supplementalNowPlayingMetadata,
            identity: playbackIdentity,
            keepsSessionAlive: playbackDesired,
            force: force
        )
        // Nie przeładowuj drzewa BT przy każdym ticku czasu — NBT wtedy zostawia tylko bieżący utwór.
        if force {
            BluetoothMediaBrowser.shared.reloadQueue(from: self)
        } else {
            BluetoothMediaBrowser.shared.touchCurrentProgress(from: self)
        }
        tickListenSession()
        EOSIntentRuntime.shared.publishSnapshot()
    }

    private func beginPlaybackTransition(queueIndex: Int) {
        playbackIdentity = PlaybackItemIdentity(
            sessionGeneration: sessionGeneration,
            queueIndex: queueIndex,
            transitionID: UUID()
        )
        supplementalNowPlayingMetadata = nil
        clearDisplayArtwork()
    }

    private func hydratePlaybackMetadata(from item: AVPlayerItem, queueIndex: Int, generation: Int) async {
        let identity = playbackIdentity
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
        if let thumb = enriched.thumbnail, !thumb.isEmpty {
            ResolvedArtworkStore.remember(trackURL: enriched.libraryPersistURL, thumbnail: thumb)
            if enriched.url != enriched.libraryPersistURL {
                ResolvedArtworkStore.remember(trackURL: enriched.url, thumbnail: thumb)
            }
        }
        let identityStillCurrent = playbackIdentity == identity
        if identityStillCurrent, currentTrack?.id == enriched.id, playbackIdentity.queueIndex == queueIndex {
            currentTrack = enriched
            let useEmbeddedArt = embedded?.artwork != nil
                && TrackMetadataEnricher.shouldUseEmbeddedArtwork(
                    expectedTitle: baseTrack.title,
                    embeddedTitle: embedded?.title
                )
            if useEmbeddedArt, let art = embedded?.artwork {
                setDisplayArtwork(art, trackID: enriched.id)
            } else {
                clearDisplayArtwork()
            }
            if displayArtwork == nil, let artURL = enriched.artworkURL {
                let trackID = enriched.id
                let keepIdentity = identity
                Task { [weak self] in
                    let loaded = await ArtworkDecodeActor.shared.load(
                        url: artURL,
                        maxPixelSize: 512,
                        allowAnimated: false,
                        timeout: 12
                    )
                    guard let self, let image = loaded?.still else { return }
                    guard self.playbackIdentity == keepIdentity, self.currentTrack?.id == trackID else { return }
                    self.setDisplayArtwork(image, trackID: trackID)
                }
            }
        }
        guard identityStillCurrent else { return }
        if let embedded,
           TrackMetadataEnricher.embeddedTitleConflicts(expectedTitle: baseTrack.title, embeddedTitle: embedded.title) {
            supplementalNowPlayingMetadata = NowPlayingCenter.SupplementalMetadata(
                title: nil,
                artist: nil,
                album: nil,
                artwork: nil
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
        firstByteWatchdog?.cancel()
        firstByteWatchdog = nil
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
        itemAdvanceObserver?.invalidate()
        itemAdvanceObserver = nil
        if let failObserver { NotificationCenter.default.removeObserver(failObserver) }
        if let stalledObserver { NotificationCenter.default.removeObserver(stalledObserver) }
        endObserver = nil
        failObserver = nil
        stalledObserver = nil
    }
}

/// Real FFT 512 — jak Nullsoft FFT w vis_classic.
/// Wszystkie bufory są przydzielone raz — `process` działa w wątku audio bez alokacji.
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
    /// Wynik ostatniego `process` (0…255 na bin).
    private(set) var spectrum: [UInt8]

    init() {
        setup = vDSP_create_fftsetup(9, FFTRadix(kFFTRadix2))
        window = [Float](repeating: 0, count: 512)
        input = [Float](repeating: 0, count: 512)
        real = [Float](repeating: 0, count: 256)
        imag = [Float](repeating: 0, count: 256)
        magnitudes = [Float](repeating: 0, count: 256)
        spectrum = [UInt8](repeating: 0, count: 256)
        vDSP_hann_window(&window, vDSP_Length(size), Int32(vDSP_HANN_NORM))
    }

    deinit {
        if let setup {
            vDSP_destroy_fftsetup(setup)
        }
    }

    /// Liczy widmo z `samples[0..<count]` (bierze ostatnie 512 próbek) do `spectrum`.
    func process(samples: UnsafeBufferPointer<Float>, count: Int, scale: Float) {
        let n = size
        let bins = binCount
        let fftSetup = setup
        spectrum.withUnsafeMutableBufferPointer { out in
            guard let fftSetup, count >= 64, let src = samples.baseAddress else {
                out.update(repeating: 0)
                return
            }
            let start = max(0, count - n)
            let copyCount = min(n, count - start)
            input.withUnsafeMutableBufferPointer { inBP in
                window.withUnsafeBufferPointer { winBP in
                    guard let inBase = inBP.baseAddress, let winBase = winBP.baseAddress else { return }
                    inBP.update(repeating: 0)
                    inBase.update(from: src.advanced(by: start), count: copyCount)
                    vDSP_vmul(inBase, 1, winBase, 1, inBase, 1, vDSP_Length(n))
                }
                real.withUnsafeMutableBufferPointer { realBP in
                    imag.withUnsafeMutableBufferPointer { imagBP in
                        magnitudes.withUnsafeMutableBufferPointer { magBP in
                            guard let realBase = realBP.baseAddress,
                                  let imagBase = imagBP.baseAddress,
                                  let magBase = magBP.baseAddress else { return }
                            var split = DSPSplitComplex(realp: realBase, imagp: imagBase)
                            for index in 0..<bins {
                                realBase[index] = inBP[index * 2]
                                imagBase[index] = inBP[index * 2 + 1]
                            }
                            vDSP_fft_zrip(fftSetup, &split, 1, log2n, FFTDirection(FFT_FORWARD))
                            var norm = Float(2.0 / Float(n))
                            vDSP_vsmul(realBase, 1, &norm, realBase, 1, vDSP_Length(bins))
                            vDSP_vsmul(imagBase, 1, &norm, imagBase, 1, vDSP_Length(bins))
                            vDSP_zvabs(&split, 1, magBase, 1, vDSP_Length(bins))
                        }
                    }
                }
            }
            let invScale = max(0.08, scale)
            magnitudes.withUnsafeBufferPointer { magBP in
                for index in 0..<bins {
                    let compressed = log1pf(magBP[index] * 56.0 / invScale)
                    out[index] = UInt8(min(255, max(0, Int(compressed * 108.0))))
                }
            }
        }
    }
}

/// Analiza PCM dla wizualizacji (wyspa, spektrum).
///
/// Zasady wątku audio (realtime): `consume` nigdy nie czeka na blokadę (`try()` — jeśli
/// główny wątek akurat zmienia ustawienia, pomijamy jeden bufor), nie alokuje pamięci przy
/// każdym buforze (stan i bufory przydzielone raz) i nie woła API systemu (głośność jest
/// odczytywana na głównym wątku). Wcześniej kopiowanie stanu (CoW tablic), blokowanie i
/// zapytanie o głośność w wątku audio dawały trzaski i zacięcia.
final class PlayerAudioAnalyzer {
    private final class AnalyzerState {
        var lowLP: Float = 0
        var midLP: Float = 0
        var prevBass: Float = 0
        var kickEnvelope: Float = 0
        var visualEnvelope: Float = 0
        var lastPeak: Float = 0
        var lastPush: CFTimeInterval = 0
        var islandBars: [Float] = Array(repeating: 0, count: MusicPlaybackEngine.AudioReactiveFrame.islandBarCount)
        var islandTargets: [Float] = Array(repeating: 0, count: MusicPlaybackEngine.AudioReactiveFrame.islandBarCount)
        var bandTargets: [Int] = Array(repeating: 0, count: MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountMax)
        var energy: Float = 0
        var spectrumAGC: Double = 0.2
        var monoScratch: [Float] = Array(repeating: 0, count: 2048)
        var ringBuffer: [Float] = Array(repeating: 0, count: 512)
        var fftWindow: [Float] = Array(repeating: 0, count: 512)
        var ringWrite = 0
        var ringFilled = 0
        // Detekcja uderzeń: średnie kroczące energii pasm + ostatnie zdarzenia.
        var bassAvg: Float = 0
        var midAvg: Float = 0
        var hiAvg: Float = 0
        var prevBassE: Float = 0
        var prevSnareE: Float = 0
        var prevHiE: Float = 0
        var kickAt: Double = 0
        var snareAt: Double = 0
        var hatAt: Double = 0
        var kickStrength: Double = 0
        var snareStrength: Double = 0
        var hatStrength: Double = 0
    }

    private var state = AnalyzerState()
    private let lock = NSLock()
    private var publishHandler: ((MusicPlaybackEngine.AudioReactiveFrame) -> Void)?
    /// Target publish rate (Hz). 0 = pause publishing.
    private var targetFPS: Double = 0
    private var analysisEnabled = false
    /// Full FFT only for Spectrum mixer; mini/vinyl use cheap RMS island path.
    private var spectrumEnabled = false
    private var activeBandCount = MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard
    private var sampleRate: Float = 44_100
    private let fft = WinampFFTProcessor()
    private let barTable32: [Int]
    private let barTable64: [Int]
    private let fftScale: Float = 0.95
    /// Głośność systemu (0…1) — aktualizowana na głównym wątku, czytana w wątku audio.
    private var outputVolume: Float = 1
    private var volumeObservation: NSKeyValueObservation?
    /// Ile buforów pominięto, bo blokada była zajęta (diagnostyka / testy).
    private(set) var skippedBuffers = 0

    private static func bandCenterHz(index: Int, count: Int) -> Float {
        let minHz: Float = 55
        let maxHz: Float = 16_000
        let t = Float(index) / Float(max(1, count - 1))
        return minHz * pow(maxHz / minHz, t)
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
        let session = AVAudioSession.sharedInstance()
        outputVolume = session.outputVolume
        volumeObservation = session.observe(\.outputVolume, options: [.new]) { [weak self] session, _ in
            let volume = session.outputVolume
            guard let self else { return }
            self.lock.lock()
            self.outputVolume = volume
            self.lock.unlock()
        }
    }

    deinit {
        volumeObservation?.invalidate()
    }

    func setBandCount(_ count: Int) {
        let fresh = AnalyzerState()
        lock.lock()
        activeBandCount = count >= MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountDense
            ? MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountDense
            : MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard
        state = fresh
        lock.unlock()
    }

    func setSampleRate(_ rate: Float) {
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

    private static func softNormalize(_ value: Float, gain: Float) -> Float {
        let x = max(0, value * gain)
        // Softer knee so loud passages reach the top of the VU, quiet ones still move.
        return min(1, x / (1 + x * 0.18))
    }

    /// PCM tap is post-mix at unity, so bars must follow the speaker volume.
    private static func playbackVolumeGain(_ volume: Float) -> Double {
        0.28 + 0.82 * min(1, max(0, Double(volume)))
    }

    /// Keep headroom: quiet stays quiet, peaks can hit the top. No compression that pegs every bar.
    private static func liftVisual(_ value: Double, volumeGain: Double, extra: Double = 1.0) -> Double {
        let v = min(1, max(0, value))
        guard v > 0.001 else { return 0 }
        let shaped = pow(v, 0.9)
        return min(1, shaped * extra * (0.78 + 0.32 * volumeGain))
    }

    private weak var attachedItem: AVPlayerItem?
    private var attachTask: Task<Void, Never>?

    func setPublishRate(fps: Double) {
        lock.lock()
        targetFPS = max(0, min(30, fps))
        lock.unlock()
    }

    func setAnalysisEnabled(_ enabled: Bool, publishEmptyOnDisable: Bool = true) {
        let fresh: AnalyzerState? = enabled ? nil : AnalyzerState()
        lock.lock()
        analysisEnabled = enabled
        if let fresh {
            state = fresh
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

    /// Zakłada audio tap zanim utwór zacznie grać. Późniejsze włączenie wizualizacji
    /// nie dotyka `audioMix`, więc otwarcie playera nie przerywa dźwięku.
    @MainActor
    func installBeforePlayback(
        _ item: AVPlayerItem,
        shouldApply: @MainActor () -> Bool = { true }
    ) async {
        if item.audioMix != nil { return }
        let tracks = (try? await item.asset.loadTracks(withMediaType: .audio)) ?? []
        guard shouldApply(), item.audioMix == nil, let audioTrack = tracks.first else { return }
        installTap(on: item, audioTrack: audioTrack)
        attachedItem = item
    }

    func detach(from item: AVPlayerItem?) {
        attachTask?.cancel()
        attachTask = nil
        attachedItem = nil
        item?.audioMix = nil
    }

    private func installTap(on item: AVPlayerItem, audioTrack: AVAssetTrack) {
        // Tap trzyma silną referencję do analizatora (zwalnianą w tapFinalize) — wątek audio
        // może jeszcze przetwarzać bufor po zmianie sesji/odtwarzacza.
        let retained = Unmanaged.passRetained(self)
        var callbacks = MTAudioProcessingTapCallbacks(
            version: kMTAudioProcessingTapCallbacksVersion_0,
            clientInfo: retained.toOpaque(),
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
        guard status == noErr, let tap else {
            retained.release()
            return
        }

        let params = AVMutableAudioMixInputParameters(track: audioTrack)
        params.setVolume(1.0, at: .zero)
        params.audioTapProcessor = tap
        let mix = AVMutableAudioMix()
        mix.inputParameters = [params]
        item.audioMix = mix
    }

    func reset() {
        let fresh = AnalyzerState()
        lock.lock()
        state = fresh
        lock.unlock()
    }

    /// Wywoływane w wątku audio (realtime) — patrz opis klasy.
    func consume(_ list: UnsafeMutablePointer<AudioBufferList>, frames: CMItemCount, time: CMTime) {
        let frameCount = Int(frames)
        guard frameCount > 0 else { return }

        let buffers = UnsafeMutableAudioBufferListPointer(list)
        guard let first = buffers.first, let rawData = first.mData else { return }
        let channels = max(1, Int(first.mNumberChannels))
        let samplePtr = rawData.assumingMemoryBound(to: Float.self)
        let sampleCount = frameCount * channels
        if sampleCount <= 0 { return }

        // Nigdy nie czekaj w wątku audio — jeśli główny wątek trzyma blokadę, pomiń ten bufor.
        guard lock.try() else {
            skippedBuffers &+= 1
            return
        }
        let enabled = analysisEnabled
        let fps = targetFPS
        let wantsSpectrum = spectrumEnabled
        guard enabled, fps > 0.5 else {
            lock.unlock()
            return
        }

        let local = state
        let bandCount = activeBandCount
        let volume = outputVolume
        let scratchCap = local.monoScratch.count
        let ringCount = local.ringBuffer.count
        var monoCount = 0

        var sumSq: Float = 0
        var lowSq: Float = 0
        var midSq: Float = 0
        var highSq: Float = 0
        var leftSq: Float = 0
        var rightSq: Float = 0
        var lowLP = local.lowLP
        var midLP = local.midLP
        var ringWrite = local.ringWrite
        var ringFilled = local.ringFilled

        // Downsample mono fill when we only need island RMS — still accurate enough for 5 bars.
        let step = wantsSpectrum ? channels : max(channels, channels * 2)
        local.monoScratch.withUnsafeMutableBufferPointer { scratch in
            local.ringBuffer.withUnsafeMutableBufferPointer { ring in
                var i = 0
                while i < sampleCount {
                    var mono: Float = 0
                    for c in 0..<channels {
                        mono += samplePtr[i + c]
                    }
                    mono /= Float(channels)
                    let l = samplePtr[i]
                    let r = channels > 1 ? samplePtr[i + 1] : l
                    leftSq += l * l
                    rightSq += r * r

                    if wantsSpectrum {
                        if monoCount < scratchCap {
                            scratch[monoCount] = mono
                            monoCount += 1
                        }
                        ring[ringWrite % ringCount] = mono
                        ringWrite &+= 1
                        ringFilled = min(ringCount, ringFilled + 1)
                    }

                    lowLP += 0.02 * (mono - lowLP)
                    midLP += 0.12 * (mono - midLP)

                    let low = lowLP
                    let high = mono - midLP
                    let mid = midLP - lowLP

                    sumSq += mono * mono
                    lowSq += low * low
                    midSq += mid * mid
                    highSq += high * high
                    i += step
                }
            }
        }
        local.lowLP = lowLP
        local.midLP = midLP
        local.ringWrite = ringWrite % (ringCount * 1024)
        local.ringFilled = ringFilled

        let samplesUsed = Float(max(1, (sampleCount + step - 1) / step))
        let inv = 1.0 / samplesUsed
        let rms = sqrt(sumSq * inv)
        let bass = sqrt(lowSq * inv)
        let mid = sqrt(midSq * inv)
        let treble = sqrt(highSq * inv)
        // --- Onsety: stopa (bas), werbel (środek+góra), hi-hat (góra) — adaptacyjny próg ---
        let nowT = CACurrentMediaTime()
        let bassE = bass * bass
        let snareE = mid * mid + treble * treble * 0.5
        let hiE = treble * treble
        if local.bassAvg == 0 { local.bassAvg = bassE; local.midAvg = snareE; local.hiAvg = hiE }
        if bassE > local.bassAvg * 1.55, bassE > local.prevBassE, bassE > 0.00004, nowT - local.kickAt > 0.14 {
            local.kickAt = nowT
            local.kickStrength = Double(min(1, (bassE / max(local.bassAvg, 0.000001) - 1) / 2.5))
        }
        if snareE > local.midAvg * 1.7, snareE > local.prevSnareE, snareE > 0.00003, nowT - local.snareAt > 0.12 {
            local.snareAt = nowT
            local.snareStrength = Double(min(1, (snareE / max(local.midAvg, 0.000001) - 1) / 2.5))
        }
        if hiE > local.hiAvg * 1.9, hiE > local.prevHiE, hiE > 0.00001, nowT - local.hatAt > 0.07 {
            local.hatAt = nowT
            local.hatStrength = Double(min(1, (hiE / max(local.hiAvg, 0.000001) - 1) / 3))
        }
        local.bassAvg = local.bassAvg * 0.96 + bassE * 0.04
        local.midAvg = local.midAvg * 0.96 + snareE * 0.04
        local.hiAvg = local.hiAvg * 0.95 + hiE * 0.05
        local.prevBassE = bassE
        local.prevSnareE = snareE
        local.prevHiE = hiE

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

        let bassNorm = Self.softNormalize(bass, gain: 11.2)
        let midNorm = Self.softNormalize(mid, gain: 10.4)
        let trebleNorm = Self.softNormalize(treble, gain: 9.8)
        let beatNorm = min(1, local.kickEnvelope * 13)
        local.islandTargets[0] = min(1, bassNorm * 0.88)
        local.islandTargets[1] = min(1, bassNorm * 0.28 + midNorm * 0.58)
        local.islandTargets[2] = min(1, instantLevel * 0.82 + beatNorm * 0.14)
        local.islandTargets[3] = min(1, midNorm * 0.46 + trebleNorm * 0.4)
        local.islandTargets[4] = min(1, trebleNorm * 0.72 + beatNorm * 0.18)
        for index in 0..<local.islandBars.count {
            let target = local.islandTargets[index]
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

        // FFT only on publish ticks and only when Spectrum UI needs it.
        if shouldPush, wantsSpectrum {
            let windowCount = local.fftWindow.count
            let analyzedCount: Int
            if local.ringFilled >= ringCount {
                let start = local.ringWrite % ringCount
                local.ringBuffer.withUnsafeBufferPointer { ring in
                    local.fftWindow.withUnsafeMutableBufferPointer { window in
                        for index in 0..<windowCount {
                            window[index] = ring[(start + index) % ringCount]
                        }
                    }
                }
                analyzedCount = ringCount
            } else {
                let copyCount = min(monoCount, windowCount)
                local.monoScratch.withUnsafeBufferPointer { scratch in
                    local.fftWindow.withUnsafeMutableBufferPointer { window in
                        window.update(repeating: 0)
                        for index in 0..<copyCount {
                            window[index] = scratch[index]
                        }
                    }
                }
                analyzedCount = copyCount
            }

            local.fftWindow.withUnsafeBufferPointer { window in
                fft.process(samples: window, count: analyzedCount, scale: fftScale)
            }
            let spectrum = fft.spectrum
            let table = activeBandCount >= MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountDense ? barTable64 : barTable32
            var low = 0
            for index in 0..<bandCount {
                let high = min(spectrum.count, low + table[index])
                let newLevel = Self.averageLevel(low: low, high: high, spectrum: spectrum)
                local.bandTargets[index] = max(local.bandTargets[index], newLevel)
                low = high
            }

            var maxTarget = 0
            for index in 0..<bandCount { maxTarget = max(maxTarget, local.bandTargets[index]) }
            if maxTarget < 8, instantLevel > 0.018 {
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

            // Klatka dla UI powstaje tylko na tikach publikacji (≤12/s), nie przy każdym buforze.
            var spectrumBands = Array(repeating: 0.0, count: MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountMax)
            if wantsSpectrum {
                for index in 0..<bandCount {
                    spectrumBands[index] = Double(local.bandTargets[index]) / 255.0
                    local.bandTargets[index] = 0
                }
            }

            let volumeGain = Self.playbackVolumeGain(volume)
            var spectrumPeak = 0.0
            for index in 0..<bandCount { spectrumPeak = max(spectrumPeak, spectrumBands[index]) }
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
            if wantsSpectrum {
                // Slow AGC so the loudest band can reach the top while others stay independent.
                local.spectrumAGC = max(local.spectrumAGC * 0.978, spectrumPeak, 0.1)
                let denom = max(0.1, local.spectrumAGC)
                for index in 0..<bandCount {
                    spectrumBands[index] = min(1, spectrumBands[index] / denom)
                }
            }

            var islands = Array(repeating: 0.0, count: local.islandBars.count)
            for index in 0..<islands.count {
                islands[index] = Self.liftVisual(Double(local.islandBars[index]), volumeGain: volumeGain, extra: 1.0)
            }

            publishFrame = MusicPlaybackEngine.AudioReactiveFrame(
                level: Self.liftVisual(Double(local.visualEnvelope), volumeGain: volumeGain, extra: 1.0),
                bass: Self.liftVisual(bassVU, volumeGain: volumeGain, extra: 1.04),
                mid: Self.liftVisual(midVU, volumeGain: volumeGain, extra: 1.02),
                treble: Self.liftVisual(trebleVU, volumeGain: volumeGain, extra: 1.02),
                beat: min(1, Double(beatNorm)),
                islandBars: islands,
                spectrumBands: spectrumBands,
                peakHold: spectrumBands,
                energy: Self.liftVisual(Double(local.energy), volumeGain: volumeGain, extra: 1.0),
                activeSpectrumBands: wantsSpectrum ? bandCount : 0,
                levelL: Self.liftVisual(Double(min(1, sqrt(leftSq * inv) * 4.8)), volumeGain: volumeGain),
                levelR: Self.liftVisual(Double(min(1, sqrt(rightSq * inv) * 4.8)), volumeGain: volumeGain),
                kickAt: local.kickAt,
                snareAt: local.snareAt,
                hatAt: local.hatAt,
                kickStrength: local.kickStrength,
                snareStrength: local.snareStrength,
                hatStrength: local.hatStrength
            )
        }
        let handler = publishHandler
        lock.unlock()

        if let publishFrame {
            handler?(publishFrame)
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

/// Zwalnia referencję przekazaną w `installTap` (passRetained).
private func tapFinalize(tap: MTAudioProcessingTap) {
    let storage = MTAudioProcessingTapGetStorage(tap)
    Unmanaged<PlayerAudioAnalyzer>.fromOpaque(storage).release()
}

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
    /// Wizualizator bieżącej sesji — czytany przez wskaźnik „teraz gra” w listach.
    nonisolated(unsafe) static weak var current: PlayerAudioVisualizer?
    /// Czy faktycznie gra (pauza = słupki stoją płasko jak w iOS).
    nonisolated(unsafe) static var isPlayingNow = false

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

/// Czysta logika „Zagraj jako następny” — testowalna bez AVPlayera.
enum PlayNextQueueEdit {
    struct Result: Equatable {
        let playOrder: [Int]
        let cursor: Int
    }

    /// - Parameters:
    ///   - playOrder: kolejność odtwarzania (indeksy do `queue`)
    ///   - cursor: pozycja bieżącego utworu w `playOrder`
    ///   - inserting: indeksy utworów do wstawienia zaraz po bieżącym (w tej kolejności)
    static func apply(playOrder: [Int], cursor: Int, inserting: [Int]) -> Result {
        var order = playOrder
        var current = min(max(0, cursor), max(0, order.count - 1))
        let currentQueueIndex = order.indices.contains(current) ? order[current] : nil
        var insertAt = order.isEmpty ? 0 : current + 1
        for qi in inserting {
            // Bieżący utwór zostaje tam, gdzie jest — duplikat w kolejce rozjechałby etykietę z dźwiękiem.
            if qi == currentQueueIndex { continue }
            if let existing = order.firstIndex(of: qi) {
                order.remove(at: existing)
                if existing < current { current -= 1 }
                if existing < insertAt { insertAt -= 1 }
            }
            order.insert(qi, at: min(insertAt, order.count))
            insertAt += 1
        }
        return Result(playOrder: order, cursor: order.isEmpty ? 0 : current)
    }
}


/// Zegar efektów: impuls po uderzeniu z uwzględnieniem opóźnienia wyjścia audio
/// (głośnik ~10 ms, Bluetooth do ~200 ms) — błysk wypada wtedy, gdy słychać uderzenie.
enum EOSBeatClock {
    private static var cachedLatency: Double = 0
    private static var latencyReadAt: Double = 0

    static var outputLatency: Double {
        let now = CACurrentMediaTime()
        if now - latencyReadAt > 1 {
            latencyReadAt = now
            let session = AVAudioSession.sharedInstance()
            cachedLatency = min(0.35, max(0, session.outputLatency + session.ioBufferDuration))
        }
        return cachedLatency
    }

    /// 0…1: 1 w chwili słyszalnego uderzenia, zanika wykładniczo (tau sekund).
    static func pulse(eventAt: Double, now: Double = CACurrentMediaTime(), tau: Double = 0.12) -> Double {
        guard eventAt > 0 else { return 0 }
        let dt = now - (eventAt + outputLatency)
        guard dt >= 0 else { return 0 }
        return exp(-dt / tau)
    }
}

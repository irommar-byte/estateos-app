import AVFoundation
import Combine
import MediaToolbox
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
}

@MainActor
final class MusicPlaybackEngine: ObservableObject {
    struct AudioReactiveFrame {
        static let islandBarCount = 5

        var level: Double = 0
        var bass: Double = 0
        var mid: Double = 0
        var treble: Double = 0
        var beat: Double = 0
        /// Wygładzone paski jak w Dynamic Island / ekranie blokady (5 słupków).
        var islandBars: [Double] = Array(repeating: 0, count: islandBarCount)

        /// Płynna siła wizualna: cichy dźwięk = mała, mocny = duża (z headroomem przeciw przesterowi).
        func visualDrive(isStrong: Bool) -> Double {
            let gain = isStrong ? 0.88 : 0.76
            let base = level * 0.82 + bass * 0.1
            let punch = beat * 0.38
            let combined = (base + punch) * gain
            guard combined > 0.02 else { return 0 }
            return pow(min(1, combined), 1.18)
        }

        func spotIntensity(isStrong: Bool) -> Double {
            let drive = visualDrive(isStrong: isStrong)
            guard drive > 0.015 else { return 0 }
            return pow(min(1, drive * 0.5 + beat * 0.32), 1.12)
        }

        func islandBar(at index: Int) -> Double {
            guard islandBars.indices.contains(index) else { return 0 }
            return islandBars[index]
        }
    }

    @Published private(set) var currentTrack: MusicPlaybackTrack?
    @Published private(set) var isPlaying = false
    @Published private(set) var isLoading = false
    @Published private(set) var currentTime: Double = 0
    @Published private(set) var duration: Double = 0
    @Published var shuffleEnabled = false
    @Published var repeatMode: RepeatMode = .all
    @Published var errorMessage: String?
    @Published private(set) var audioFrame = AudioReactiveFrame()

    let folderId: String?
    let folderName: String?

    private var queue: [MusicPlaybackTrack] = []
    private var playOrder: [Int] = []
    private var orderCursor = 0
    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var failObserver: NSObjectProtocol?
    private var statusObserver: NSKeyValueObservation?
    private var rateObserver: NSKeyValueObservation?
    private var seekObserver: NSObjectProtocol?
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
    }

    var queuePositionLabel: String {
        guard !queue.isEmpty else { return "" }
        return "\(orderCursor + 1) / \(queue.count)"
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
        isPlaying = false
        isLoading = false
        currentTime = 0
        nowPlaying.deactivate()
        audioAnalyzer.reset()
        audioFrame = AudioReactiveFrame()
        if let seekObserver {
            NotificationCenter.default.removeObserver(seekObserver)
        }
        seekObserver = nil
        onTeardown?()
        onTeardown = nil
    }

    func togglePlayPause() {
        guard let player else { return }
        if isPlaying {
            player.pause()
        } else {
            player.play()
        }
        syncPlayingState()
        refreshNowPlaying()
    }

    func pause() {
        player?.pause()
        syncPlayingState()
        refreshNowPlaying()
    }

    func resume() {
        player?.play()
        syncPlayingState()
        refreshNowPlaying()
    }

    func seek(to seconds: Double) {
        let time = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        player?.seek(to: time)
        currentTime = seconds
        refreshNowPlaying()
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
        if currentTime > 3 {
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
    }

    func cycleRepeatMode() {
        switch repeatMode {
        case .off: repeatMode = .all
        case .all: repeatMode = .one
        case .one: repeatMode = .off
        }
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
        isLoading = true
        errorMessage = nil
        currentTime = 0
        duration = track.duration ?? 0
        isPlaying = false
        supplementalNowPlayingMetadata = nil

        do {
            let streamURL = try await resolveStreamURL(for: track)
            guard generation == sessionGeneration, !Task.isCancelled else { return }
            let isLocal = streamURL.isFileURL
            loadStream(
                url: streamURL,
                track: track,
                queueIndex: index,
                generation: generation,
                preferFastStart: isLocal || isDownloaded(track) || track.isExternal
            )
        } catch {
            guard generation == sessionGeneration else { return }
            isLoading = false
            errorMessage = error.localizedDescription
            isPlaying = false
        }
    }

    private func isDownloaded(_ track: MusicPlaybackTrack) -> Bool {
        if OfflineMusicStore.shared.isAvailable(track.url) { return true }
        if let jobId = track.serverAssetId, !jobId.isEmpty { return true }
        if let jobId = track.downloadJobId, !jobId.isEmpty { return true }
        if let jobId = jobLookup?(track.url), !jobId.isEmpty { return true }
        return false
    }

    private func resolveStreamURL(for track: MusicPlaybackTrack) async throws -> URL {
        if track.isExternal {
            if let resolver = externalFileResolver {
                return try await resolver(track)
            }
            if let file = track.playbackFileURL {
                return file
            }
            throw APIError.server("Nie można odtworzyć pliku ze źródła.")
        }

        guard let api else { throw APIError.server("Brak połączenia z serwerem.") }

        if let local = OfflineMusicStore.shared.localURL(for: track.url) {
            return local
        }

        let knownIds = [track.serverAssetId, track.downloadJobId, jobLookup?(track.url)]
            .compactMap { $0 }
            .filter { !$0.isEmpty }

        for jobId in knownIds {
            do {
                let token = try await api.musicPlayToken(jobId: jobId)
                return api.musicStreamURL(jobId: jobId, token: token.token)
            } catch {
                // Stale id — fall through to ensure.
                continue
            }
        }

        let ensure = try await api.startMusicPlay(
            url: track.url,
            folderId: track.folderId,
            trackUrl: track.url
        )
        if ensure.ready != true {
            try await api.waitForMusicPlayReady(jobId: ensure.jobId)
        }
        let token = try await api.musicPlayToken(jobId: ensure.jobId)
        return api.musicStreamURL(jobId: ensure.jobId, token: token.token)
    }

    private func loadStream(url: URL, track: MusicPlaybackTrack, queueIndex: Int, generation: Int, preferFastStart: Bool) {
        guard generation == sessionGeneration else { return }

        cleanupObservers()
        AudioSession.activateForPlayback()

        let item = AVPlayerItem(url: url)
        audioAnalyzer.attach(to: item) { [weak self] frame in
            Task { @MainActor in
                self?.audioFrame = frame
            }
        }
        let newPlayer = AVPlayer(playerItem: item)
        newPlayer.automaticallyWaitsToMinimizeStalling = !preferFastStart
        player = newPlayer
        Task { [weak self] in
            await self?.hydratePlaybackMetadata(from: item, queueIndex: queueIndex, generation: generation)
        }

        timeObserver = newPlayer.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.25, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                self.currentTime = max(0, time.seconds)
                if self.duration <= 0, let d = newPlayer.currentItem?.duration.seconds, d.isFinite, d > 0 {
                    self.duration = d
                }
                self.syncPlayingState()
                self.refreshNowPlaying()
            }
        }

        rateObserver = newPlayer.observe(\.rate, options: [.new]) { [weak self] player, _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                self.syncPlayingState()
                self.refreshNowPlaying()
            }
        }

        statusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                if item.status == .failed {
                    self.errorMessage = item.error?.localizedDescription ?? "Odtwarzanie nie powiodło się."
                    self.isPlaying = false
                    self.isLoading = false
                } else if item.status == .readyToPlay {
                    self.isLoading = false
                    self.syncPlayingState()
                    self.audioAnalyzer.ensureAttached(to: item)
                    self.refreshNowPlaying()
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
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.sessionGeneration == generation else { return }
                self.errorMessage = "Odtwarzanie przerwane."
                self.isPlaying = false
            }
        }

        newPlayer.play()
        syncPlayingState()
        refreshNowPlaying()
    }

    private func syncPlayingState() {
        let rate = player?.rate ?? 0
        let playing = rate > 0.01
        if isPlaying != playing {
            isPlaying = playing
        }
        if playing {
            isLoading = false
        }
    }

    private func refreshNowPlaying() {
        guard let track = currentTrack else { return }
        nowPlaying.update(
            track: track,
            duration: duration,
            elapsed: currentTime,
            isPlaying: isPlaying,
            queueIndex: orderCursor,
            queueCount: queue.count,
            supplemental: supplementalNowPlayingMetadata
        )
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
        }
        supplementalNowPlayingMetadata = embedded?.asSupplemental
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
        cleanupObservers()
        player?.pause()
        audioAnalyzer.detach(from: player?.currentItem)
        player?.replaceCurrentItem(with: nil)
        player = nil
    }

    private func cleanupObservers() {
        if let timeObserver, let player {
            player.removeTimeObserver(timeObserver)
        }
        timeObserver = nil
        rateObserver?.invalidate()
        rateObserver = nil
        statusObserver?.invalidate()
        statusObserver = nil
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        if let failObserver { NotificationCenter.default.removeObserver(failObserver) }
        endObserver = nil
        failObserver = nil
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
    }

    private var state = State()
    private let lock = NSLock()
    private var push: ((MusicPlaybackEngine.AudioReactiveFrame) -> Void)?

    private weak var attachedItem: AVPlayerItem?
    private var attachTask: Task<Void, Never>?

    func attach(to item: AVPlayerItem, push: @escaping (MusicPlaybackEngine.AudioReactiveFrame) -> Void) {
        self.push = push
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
        guard item.audioMix == nil else { return }
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

        var sumSq: Float = 0
        var lowSq: Float = 0
        var midSq: Float = 0
        var highSq: Float = 0

        lock.lock()
        var local = state
        for i in stride(from: 0, to: sampleCount, by: channels) {
            var mono: Float = 0
            for c in 0..<channels {
                mono += samplePtr[i + c]
            }
            mono /= Float(channels)

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

        let inv = 1.0 / Float(max(1, frameCount))
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

        let instantLevel = min(1, rms * 5.2)
        if instantLevel > local.visualEnvelope {
            local.visualEnvelope += (instantLevel - local.visualEnvelope) * 0.82
        } else {
            let release = 0.72 + min(0.22, local.lastPeak * 0.34)
            local.visualEnvelope *= release
        }
        local.lastPeak = max(instantLevel, local.lastPeak * 0.93)

        let bassNorm = min(1, bass * 9.5)
        let midNorm = min(1, mid * 9.5)
        let trebleNorm = min(1, treble * 9.5)
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

        let now = CACurrentMediaTime()
        let shouldPush = now - local.lastPush >= (1.0 / 60.0)
        if shouldPush {
            local.lastPush = now
        }
        state = local
        lock.unlock()

        guard shouldPush else { return }
        let frame = MusicPlaybackEngine.AudioReactiveFrame(
            level: Double(local.visualEnvelope),
            bass: Double(bassNorm),
            mid: Double(midNorm),
            treble: Double(trebleNorm),
            beat: Double(beatNorm),
            islandBars: local.islandBars.map(Double.init)
        )
        push?(frame)
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
private func tapPrepare(tap: MTAudioProcessingTap, maxFrames: CMItemCount, processingFormat: UnsafePointer<AudioStreamBasicDescription>) {}
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

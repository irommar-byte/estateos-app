import SwiftUI
import AVFoundation
import Accelerate

/// Analiza audio z MTAudioProcessingTap — FFT, osobne pasma częstotliwości + bas.
final class MusicSpectrumTapProcessor: @unchecked Sendable {
    static let bandCount = 40
    private static let fftSize = 2048
    private static let log2n = vDSP_Length(11)

    struct Snapshot {
        let levels: [Float]
        let bass: Float
        let frameCounter: UInt64
    }

    private let lock = NSLock()
    private let fftSetup: FFTSetup
    private var window: [Float]
    private var ringBuffer: [Float]
    private var ringWrite = 0
    private var ringFilled = 0
    private var instantLevels = [Float](repeating: 0.04, count: bandCount)
    private var bandPeak = [Float](repeating: 0.12, count: bandCount)
    private var bassInstant: Float = 0.04
    private var frameCounter: UInt64 = 0

    init() {
        fftSetup = vDSP_create_fftsetup(Self.log2n, FFTRadix(kFFTRadix2))!
        window = [Float](repeating: 0, count: Self.fftSize)
        vDSP_hann_window(&window, vDSP_Length(Self.fftSize), Int32(vDSP_HANN_NORM))
        ringBuffer = [Float](repeating: 0, count: Self.fftSize)
    }

    deinit {
        vDSP_destroy_fftsetup(fftSetup)
    }

    func snapshot() -> Snapshot {
        lock.lock()
        defer { lock.unlock() }
        return Snapshot(levels: instantLevels, bass: bassInstant, frameCounter: frameCounter)
    }

    func process(bufferList: UnsafeMutablePointer<AudioBufferList>, frameCount: CMItemCount) {
        guard frameCount > 0 else { return }

        let frames = min(Int(frameCount), 4096)
        var mono = [Float](repeating: 0, count: frames)
        guard fillMono(bufferList: bufferList, frames: frames, into: &mono) else { return }

        lock.lock()
        for sample in mono {
            ringBuffer[ringWrite] = sample
            ringWrite = (ringWrite + 1) % Self.fftSize
            ringFilled = min(ringFilled + 1, Self.fftSize)
        }

        guard ringFilled >= Self.fftSize / 2 else {
            lock.unlock()
            return
        }

        var ordered = [Float](repeating: 0, count: Self.fftSize)
        if ringFilled < Self.fftSize {
            for index in 0..<ringFilled {
                ordered[index] = ringBuffer[index]
            }
        } else {
            let tail = Self.fftSize - ringWrite
            if tail > 0 {
                ordered[0..<tail] = ringBuffer[ringWrite..<Self.fftSize]
                ordered[tail..<Self.fftSize] = ringBuffer[0..<ringWrite]
            } else {
                ordered = ringBuffer
            }
        }

        let levels = fftBandLevels(from: ordered)
        instantLevels = levels
        bassInstant = levels.prefix(6).max() ?? 0.04
        frameCounter += 1
        lock.unlock()
    }

    private func fillMono(
        bufferList: UnsafeMutablePointer<AudioBufferList>,
        frames: Int,
        into mono: inout [Float]
    ) -> Bool {
        var filled = false
        let buffers = UnsafeMutableAudioBufferListPointer(bufferList)

        for audioBuffer in buffers {
            guard let data = audioBuffer.mData else { continue }
            let byteSize = Int(audioBuffer.mDataByteSize)

            if byteSize >= frames * MemoryLayout<Float>.size {
                let ptr = data.assumingMemoryBound(to: Float.self)
                for index in 0..<frames {
                    mono[index] += ptr[index]
                }
                filled = true
            } else if byteSize >= frames * 2 * MemoryLayout<Int16>.size {
                let ptr = data.assumingMemoryBound(to: Int16.self)
                for index in 0..<frames {
                    let left = Float(ptr[index * 2]) / 32768.0
                    let right = Float(ptr[index * 2 + 1]) / 32768.0
                    mono[index] += (left + right) * 0.5
                }
                filled = true
            } else if byteSize >= frames * MemoryLayout<Int16>.size {
                let ptr = data.assumingMemoryBound(to: Int16.self)
                for index in 0..<frames {
                    mono[index] += Float(ptr[index]) / 32768.0
                }
                filled = true
            }
        }

        if filled, buffers.count > 1 {
            let scale = 1 / Float(buffers.count)
            for index in 0..<frames {
                mono[index] *= scale
            }
        }
        return filled
    }

    private func fftBandLevels(from samples: [Float]) -> [Float] {
        let n = Self.fftSize
        var windowed = samples
        vDSP_vmul(windowed, 1, window, 1, &windowed, 1, vDSP_Length(n))

        var realp = [Float](repeating: 0, count: n / 2)
        var imagp = [Float](repeating: 0, count: n / 2)
        for index in 0..<(n / 2) {
            realp[index] = windowed[index * 2]
            imagp[index] = windowed[index * 2 + 1]
        }

        var split = DSPSplitComplex(realp: &realp, imagp: &imagp)
        vDSP_fft_zrip(fftSetup, &split, 1, Self.log2n, FFTDirection(FFT_FORWARD))

        var magnitudes = [Float](repeating: 0, count: n / 2)
        vDSP_zvmags(&split, 1, &magnitudes, 1, vDSP_Length(n / 2))

        var levels = [Float](repeating: 0.04, count: Self.bandCount)
        let maxBin = magnitudes.count - 1

        for band in 0..<Self.bandCount {
            let t0 = Float(band) / Float(Self.bandCount)
            let t1 = Float(band + 1) / Float(Self.bandCount)
            let lo = 1 + Int(powf(t0, 1.75) * Float(maxBin - 1))
            let hi = max(lo + 1, 1 + Int(powf(t1, 1.75) * Float(maxBin - 1)))
            let end = min(maxBin, hi)

            var peak: Float = 0
            if lo < end {
                magnitudes.withUnsafeBufferPointer { ptr in
                    vDSP_maxv(ptr.baseAddress! + lo, 1, &peak, vDSP_Length(end - lo))
                }
            }

            let weighted = sqrtf(max(0, peak)) * Self.bandWeight(band)
            bandPeak[band] = max(weighted, bandPeak[band] * 0.993)
            let normalized = weighted / max(bandPeak[band], 0.045)
            levels[band] = Self.mapBandLevel(normalized)
        }

        return levels
    }

    private static func bandWeight(_ band: Int) -> Float {
        switch band {
        case 0..<5: return 1.05
        case 5..<16: return 0.92
        default: return 0.72
        }
    }

    private static func mapBandLevel(_ value: Float) -> Float {
        let x = min(1.4, max(0, value))
        return min(0.82, powf(x, 0.8) * 0.58)
    }
}

enum MusicSpectrumTapInstaller {
    private final class Context {
        let processor = MusicSpectrumTapProcessor()
    }

    @MainActor
    static func attach(to item: AVPlayerItem) async -> MusicSpectrumTapProcessor? {
        let asset = item.asset
        let tracks: [AVAssetTrack]
        do {
            tracks = try await asset.load(.tracks)
        } catch {
            return nil
        }
        guard let audioTrack = tracks.first(where: { $0.mediaType == .audio }) else {
            return nil
        }

        let context = Context()
        var callbacks = MTAudioProcessingTapCallbacks(
            version: kMTAudioProcessingTapCallbacksVersion_0,
            clientInfo: Unmanaged.passRetained(context).toOpaque(),
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
        guard status == noErr, let tapRef = tap else {
            return nil
        }

        let params = AVMutableAudioMixInputParameters(track: audioTrack)
        params.audioTapProcessor = tapRef
        let mix = AVMutableAudioMix()
        mix.inputParameters = [params]
        item.audioMix = mix
        return context.processor
    }

    private static let tapInit: MTAudioProcessingTapInitCallback = { _, clientInfo, tapStorageOut in
        tapStorageOut.pointee = clientInfo
    }

    private static let tapFinalize: MTAudioProcessingTapFinalizeCallback = { tap in
        let storage = MTAudioProcessingTapGetStorage(tap)
        Unmanaged<Context>.fromOpaque(storage).release()
    }

    private static let tapPrepare: MTAudioProcessingTapPrepareCallback = { _, _, _ in }

    private static let tapUnprepare: MTAudioProcessingTapUnprepareCallback = { _ in }

    private static let tapProcess: MTAudioProcessingTapProcessCallback = {
        tap,
        numberFrames,
        _,
        bufferListInOut,
        numberFramesOut,
        flagsOut in
        var timeRange = CMTimeRange()
        let status = MTAudioProcessingTapGetSourceAudio(
            tap,
            numberFrames,
            bufferListInOut,
            flagsOut,
            &timeRange,
            numberFramesOut
        )
        guard status == noErr else { return }

        let storage = MTAudioProcessingTapGetStorage(tap)
        let context = Unmanaged<Context>.fromOpaque(storage).takeUnretainedValue()
        context.processor.process(bufferList: bufferListInOut, frameCount: numberFramesOut.pointee)
    }
}

struct MusicPlaybackTrack: Identifiable, Hashable {
    let id: String
    let url: String
    let title: String
    let artist: String?
    let album: String?
    let thumbnail: String?
    let duration: Double?
    let folderId: String?
    let downloadJobId: String?

    var artworkURL: URL? {
        thumbnail.flatMap(URL.init(string:))
    }

    init(from track: MusicTrack) {
        id = track.url
        url = track.url
        title = track.title
        artist = track.artist
        album = track.album
        thumbnail = track.thumbnail
        duration = track.duration
        folderId = track.folderId
        downloadJobId = track.downloadJobId
    }

    init(from selection: MusicSelection) {
        id = selection.url
        url = selection.url
        title = selection.title
        artist = selection.artist
        album = selection.album
        thumbnail = selection.thumbnail
        duration = selection.duration
        folderId = selection.folderId
        downloadJobId = selection.downloadJobId
    }

    var trackPayload: MoviesAPIClient.MusicTrackPayload {
        MoviesAPIClient.MusicTrackPayload(
            url: url,
            title: title,
            artist: artist,
            album: album,
            thumbnail: thumbnail,
            duration: duration,
            quality: "320 kbps",
            source: "apple-music",
            previewUrl: nil,
            artistId: nil,
            albumId: nil,
            trackNumber: nil
        )
    }

    var favoriteItem: FavoriteItem {
        FavoriteItem(
            id: url,
            type: "music",
            url: url,
            title: title,
            thumbnail: thumbnail,
            source: "apple-music",
            detail: artist,
            duration: duration
        )
    }
}

struct MusicPlaybackSession: Identifiable {
    let id = UUID()
    let queue: [MusicPlaybackTrack]
    let startIndex: Int
    let folderId: String?
    let folderName: String?
}

enum MusicRepeatMode: String, CaseIterable {
    case off
    case all
    case one

    var icon: String {
        switch self {
        case .off: return "repeat"
        case .all: return "repeat"
        case .one: return "repeat.1"
        }
    }

    var label: String {
        switch self {
        case .off: return "Bez powtórki"
        case .all: return "Powtarzaj playlistę"
        case .one: return "Powtarzaj utwór"
        }
    }
}

@MainActor
final class MusicPlayerController: ObservableObject {
    @Published private(set) var currentTrack: MusicPlaybackTrack?
    @Published private(set) var currentIndex: Int = 0
    @Published private(set) var isPlaying = false
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var currentTime: Double = 0
    @Published private(set) var duration: Double = 0
    @Published var levels: [CGFloat] = Array(repeating: 0.04, count: MusicSpectrumTapProcessor.bandCount)
    @Published var peakLevels: [CGFloat] = Array(repeating: 0.04, count: MusicSpectrumTapProcessor.bandCount)
    @Published var bassLevel: CGFloat = 0.08
    @Published var beatHit: CGFloat = 0
    @Published private(set) var visualizerFrame: UInt64 = 0
    @Published var repeatMode: MusicRepeatMode = .all
    @Published var shuffleEnabled = false

    let queue: [MusicPlaybackTrack]
    let folderId: String?
    let folderName: String?

    private var api: MoviesAPIClient?
    private weak var appModel: AppModel?
    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var failObserver: NSObjectProtocol?
    private var displayLink: CADisplayLink?
    private var displayLinkDriver: VisualizerDisplayLinkDriver?
    private var spectrumProcessor: MusicSpectrumTapProcessor?
    private var playOrder: [Int] = []
    private var orderCursor = 0
    private var scanPhase = 0
    private var nowPlaying = MusicNowPlayingIntegration.shared
    private var seekObserver: NSObjectProtocol?
    private var beatPhase: Float = 0
    private var previousBass: Float = 0.06
    private var lastTapFrame: UInt64 = 0
    private var tapStaleFrames = 0

    init(session: MusicPlaybackSession) {
        queue = session.queue
        folderId = session.folderId
        folderName = session.folderName
        currentIndex = min(max(session.startIndex, 0), max(queue.count - 1, 0))
        rebuildPlayOrder(shuffled: false, anchor: currentIndex)
    }

    func configure(app: AppModel, onRemoteInteraction: @escaping () -> Void = {}) {
        api = app.api
        appModel = app

        nowPlaying.activate(
            onNext: { [weak self] in Task { await self?.skipNext() } },
            onPrevious: { [weak self] in Task { await self?.skipPrevious() } },
            onPlay: { [weak self] in
                guard let self, !self.isPlaying else { return }
                self.player?.play()
                self.isPlaying = true
                self.startVisualizer()
            },
            onPause: { [weak self] in
                guard let self, self.isPlaying else { return }
                self.player?.pause()
                self.isPlaying = false
                self.stopVisualizer()
            },
            onToggle: { [weak self] in self?.togglePlayPause() },
            onInteract: onRemoteInteraction
        )

        seekObserver = NotificationCenter.default.addObserver(
            forName: .musicPlayerSeekRequested,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let seconds = note.userInfo?["time"] as? Double else { return }
            Task { @MainActor in
                await self?.seek(to: seconds)
            }
        }
    }

    func stop() {
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        isPlaying = false
        cleanupPlayerObservers()
        stopVisualizer()
        decayLevels()
        nowPlaying.deactivate()
        if let seekObserver {
            NotificationCenter.default.removeObserver(seekObserver)
        }
        seekObserver = nil
    }

    var hasNext: Bool {
        guard !queue.isEmpty else { return false }
        if repeatMode == .one { return true }
        if orderCursor < playOrder.count - 1 { return true }
        return repeatMode == .all
    }

    var hasPrevious: Bool {
        guard !queue.isEmpty else { return false }
        if repeatMode == .one { return true }
        if orderCursor > 0 { return true }
        return repeatMode == .all
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
        await playOrderIndex(orderCursor)
    }

    func prepareImmediatePreview(track: MusicPlaybackTrack) {
        currentTrack = track
        if let idx = queue.firstIndex(where: { $0.id == track.id }) {
            currentIndex = idx
        }
        duration = track.duration ?? 0
        currentTime = 0
        isLoading = true
        errorMessage = nil
    }

    func togglePlayPause() {
        guard let player else { return }
        if isPlaying {
            player.pause()
            isPlaying = false
            stopVisualizer()
        } else {
            player.play()
            isPlaying = true
            startVisualizer()
        }
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
        await playOrderIndex(orderCursor)
    }

    func skipPrevious() async {
        guard !queue.isEmpty else { return }
        if let player, currentTime > 3 {
            await seekToStart()
            return
        }
        if orderCursor > 0 {
            orderCursor -= 1
        } else if repeatMode == .all {
            orderCursor = max(playOrder.count - 1, 0)
        } else {
            await seekToStart()
            return
        }
        await playOrderIndex(orderCursor)
    }

    func toggleShuffle() {
        shuffleEnabled.toggle()
        rebuildPlayOrder(shuffled: shuffleEnabled, anchor: currentIndex)
        if let idx = playOrder.firstIndex(of: currentIndex) {
            orderCursor = idx
        }
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

    private func playOrderIndex(_ cursor: Int) async {
        guard cursor >= 0, cursor < playOrder.count else { return }
        orderCursor = cursor
        let index = playOrder[cursor]
        await play(at: index)
    }

    private func play(at index: Int) async {
        guard index >= 0, index < queue.count, let api else { return }
        let track = queue[index]
        currentIndex = index
        currentTrack = track
        isLoading = true
        errorMessage = nil
        currentTime = 0
        duration = track.duration ?? 0

        do {
            let streamURL = try await resolveStreamURL(for: track, api: api)
            await loadStream(url: streamURL)
        } catch {
            do {
                let jobId = try await api.startMusicPlay(url: track.url)
                try await api.waitForMusicPlayReady(jobId: jobId)
                let tokenResponse = try await api.musicPlayToken(jobId: jobId)
                let streamURL = api.musicStreamURL(jobId: jobId, token: tokenResponse.token)
                await loadStream(url: streamURL)
            } catch {
                isLoading = false
                errorMessage = error.localizedDescription
                isPlaying = false
            }
        }
    }

    private func resolveStreamURL(for track: MusicPlaybackTrack, api: MoviesAPIClient) async throws -> URL {
        let jobId = track.downloadJobId
            ?? appModel?.downloadJobId(for: track.url)
        if let jobId, !jobId.isEmpty {
            do {
                let tokenResponse = try await api.musicPlayToken(jobId: jobId)
                return api.musicStreamURL(jobId: jobId, token: tokenResponse.token)
            } catch {
                // fall through to live stream
            }
        }
        let freshJobId = try await api.startMusicPlay(url: track.url)
        try await api.waitForMusicPlayReady(jobId: freshJobId)
        let tokenResponse = try await api.musicPlayToken(jobId: freshJobId)
        return api.musicStreamURL(jobId: freshJobId, token: tokenResponse.token)
    }

    private func loadStream(url: URL) async {
        cleanupPlayerObservers()
        PlayerAudioSession.activateForMusic()

        let item = AVPlayerItem(url: url)
        spectrumProcessor = await MusicSpectrumTapInstaller.attach(to: item)
        lastTapFrame = 0
        tapStaleFrames = 0

        if player == nil {
            player = AVPlayer(playerItem: item)
            if #available(tvOS 15.0, *) {
                player?.audiovisualBackgroundPlaybackPolicy = .continuesIfPossible
            }
        } else {
            player?.replaceCurrentItem(with: item)
        }

        guard let player else { return }

        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.35, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            guard let self, let track = self.currentTrack else { return }
            currentTime = max(0, time.seconds)
            if duration <= 0, let itemDuration = player.currentItem?.duration.seconds, itemDuration.isFinite {
                duration = itemDuration
            }
            nowPlaying.update(
                track: track,
                duration: duration,
                elapsed: currentTime,
                isPlaying: isPlaying,
                queueIndex: orderCursor,
                queueCount: queue.count
            )
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                if self.repeatMode == .one {
                    await self.seekToStart()
                } else if self.hasNext {
                    await self.skipNext()
                } else {
                    self.isPlaying = false
                    self.stopVisualizer()
                    self.decayLevels()
                }
            }
        }

        failObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.errorMessage = "Odtwarzanie przerwane."
                self?.isPlaying = false
            }
        }

        player.play()
        isPlaying = true
        isLoading = false
        startVisualizer()

        if let track = currentTrack {
            nowPlaying.update(
                track: track,
                duration: duration,
                elapsed: currentTime,
                isPlaying: true,
                queueIndex: orderCursor,
                queueCount: queue.count
            )
        }
    }

    private func seek(to seconds: Double) async {
        let time = CMTime(seconds: seconds, preferredTimescale: 600)
        await player?.seek(to: time)
        currentTime = seconds
    }

    private func seekToStart() async {
        await player?.seek(to: .zero)
        currentTime = 0
        player?.play()
        isPlaying = true
    }

    private func cleanupPlayerObservers() {
        if let timeObserver, let player {
            player.removeTimeObserver(timeObserver)
        }
        timeObserver = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        endObserver = nil
        if let failObserver {
            NotificationCenter.default.removeObserver(failObserver)
        }
        failObserver = nil
        spectrumProcessor = nil
    }

    private func tickVisualizer() {
        guard isPlaying else { return }

        var targets: [CGFloat]

        if let spectrumProcessor {
            let snapshot = spectrumProcessor.snapshot()
            if snapshot.frameCounter != lastTapFrame {
                lastTapFrame = snapshot.frameCounter
                tapStaleFrames = 0
                registerBeatHit(bass: snapshot.bass)
                targets = snapshot.levels.map { CGFloat($0) }
            } else {
                tapStaleFrames += 1
                if tapStaleFrames > 12 {
                    targets = syntheticTargets()
                    registerBeatHit(bass: Float(targets.prefix(6).max() ?? 0.08))
                } else {
                    targets = levels
                }
            }
        } else {
            targets = syntheticTargets()
            registerBeatHit(bass: Float(targets.prefix(6).max() ?? 0.08))
        }

        applyWinampLevels(targets: targets)
    }

    private func startVisualizer() {
        guard displayLink == nil else { return }
        lastTapFrame = 0
        tapStaleFrames = 0
        let driver = VisualizerDisplayLinkDriver { [weak self] in
            MainActor.assumeIsolated {
                self?.tickVisualizer()
            }
        }
        displayLinkDriver = driver
        let link = CADisplayLink(target: driver, selector: #selector(VisualizerDisplayLinkDriver.step(_:)))
        if #available(tvOS 15.0, *) {
            link.preferredFrameRateRange = CAFrameRateRange(minimum: 80, maximum: 120, preferred: 120)
        }
        link.preferredFramesPerSecond = 120
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    private func stopVisualizer() {
        displayLink?.invalidate()
        displayLink = nil
        displayLinkDriver = nil
    }

    private func decayLevels() {
        levels = levels.map { max(0.02, $0 * 0.72) }
        peakLevels = peakLevels.map { max(0.02, $0 * 0.72) }
        bassLevel = max(0.04, bassLevel * 0.72)
        beatHit = max(0, beatHit * 0.72)
        visualizerFrame &+= 1
    }

    private func syntheticTargets() -> [CGFloat] {
        beatPhase += 0.38
        return levels.indices.map { index in
            let band = Float(index)
            let kick = index < 6 ? pow(max(0, sin(beatPhase * 1.05)), 10) * 0.22 : 0
            let wave = abs(sin(beatPhase * (0.75 + band * 0.11) + band * 0.83)) * 0.22
            let sparkle = abs(sin(beatPhase * (1.8 + band * 0.17) + band * 1.9)) * 0.1
            return CGFloat(min(0.62, 0.05 + kick + wave + sparkle))
        }
    }

    private func registerBeatHit(bass: Float) {
        let delta = bass - previousBass
        previousBass = previousBass * 0.62 + bass * 0.38
        let kick = delta > 0.055 && bass > 0.22
        let heavy = bass > 0.58
        if kick || heavy {
            let punch = min(0.72, 0.22 + bass * 0.38 + max(0, delta) * 1.8)
            beatHit = max(beatHit, CGFloat(punch))
        }
        beatHit = max(0, beatHit * 0.58 - 0.012)
        bassLevel = max(CGFloat(bass * 0.75), bassLevel * 0.62 + CGFloat(bass * 0.38))
    }

    private func applyWinampLevels(targets: [CGFloat]) {
        var updated = levels
        var peaks = peakLevels
        for index in updated.indices {
            let target = min(0.84, targets[min(index, targets.count - 1)])
            if target >= updated[index] {
                updated[index] = updated[index] * 0.35 + target * 0.65
            } else {
                updated[index] = updated[index] * 0.48 + target * 0.52
            }
            updated[index] = max(0.03, min(0.84, updated[index]))

            if updated[index] >= peaks[index] - 0.006 {
                peaks[index] = updated[index]
            } else {
                peaks[index] = max(updated[index], peaks[index] * 0.965)
            }
        }
        levels = updated
        peakLevels = peaks
        visualizerFrame &+= 1
    }
}

private final class VisualizerDisplayLinkDriver: NSObject {
    private let handler: () -> Void

    init(handler: @escaping () -> Void) {
        self.handler = handler
    }

    @objc func step(_ link: CADisplayLink) {
        handler()
    }
}

struct SubwooferBeatView: View {
    @ObservedObject var player: MusicPlayerController

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 120.0)) { _ in
            let pulse = player.bassLevel
            let beatHit = player.beatHit
            let slam = min(0.68, max(beatHit, pulse * 0.28))

            ZStack {
                if slam > 0.22 {
                    Circle()
                        .stroke(Color.white.opacity(0.35 * slam), lineWidth: 1.5 + slam * 1.5)
                        .frame(width: 44 + slam * 36, height: 44 + slam * 36)
                        .blur(radius: slam * 1.5)
                }

                if slam > 0.28 {
                    Circle()
                        .stroke(NostalgieTheme.accent.opacity(0.55 * slam), lineWidth: 2)
                        .frame(width: 52 + slam * 32, height: 52 + slam * 32)
                }

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                NostalgieTheme.accent.opacity(0.22 + slam * 0.35),
                                NostalgieTheme.accentSecondary.opacity(0.1 + slam * 0.15),
                                Color.clear,
                            ],
                            center: .center,
                            startRadius: 2,
                            endRadius: 22 + slam * 20
                        )
                    )
                    .frame(width: 48 + slam * 26, height: 48 + slam * 26)

                Image(systemName: "hifispeaker.fill")
                    .font(.system(size: 20 + slam * 14, weight: .bold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                Color(red: 1, green: 0.35, blue: 0.45),
                                NostalgieTheme.accent,
                                Color.white.opacity(0.95),
                            ],
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )
                .shadow(color: NostalgieTheme.accent.opacity(0.35 + slam * 0.3), radius: 5 + slam * 10, y: 2)
                .scaleEffect(0.78 + slam * 0.38)
                .offset(y: -slam * 3)
            }
            .frame(width: 72, height: 68)
        }
    }
}

struct MusicOscillographView: View {
    @ObservedObject var player: MusicPlayerController

    private let barWidth: CGFloat = 6
    private let barGap: CGFloat = 3
    private let barMaxHeight: CGFloat = 80
    private let panelPadding: CGFloat = 10

    private var panelWidth: CGFloat {
        let count = CGFloat(MusicSpectrumTapProcessor.bandCount)
        return count * barWidth + max(0, count - 1) * barGap + panelPadding * 2
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 120.0)) { _ in
            let levels = player.levels
            let peaks = player.peakLevels
            let _ = player.visualizerFrame

            ZStack {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color.black.opacity(0.98), Color(red: 0.04, green: 0.06, blue: 0.08)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .stroke(
                                LinearGradient(
                                    colors: [Color.white.opacity(0.22), Color.white.opacity(0.06)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1
                            )
                    }
                    .shadow(color: Color.black.opacity(0.55), radius: 8, y: 4)

                Canvas { context, size in
                    let originX = panelPadding
                    let baseline = size.height - panelPadding

                    for index in 0..<min(levels.count, MusicSpectrumTapProcessor.bandCount) {
                        let level = levels[index]
                        let peak = peaks[min(index, peaks.count - 1)]
                        let x = originX + CGFloat(index) * (barWidth + barGap)
                        let barHeight = max(2, barMaxHeight * level)
                        let y = baseline - barHeight
                        let rect = CGRect(x: x, y: y, width: barWidth, height: barHeight)

                        let peakColor = winampPeakColor(level)
                        context.fill(
                            Path(roundedRect: rect, cornerRadius: 1),
                            with: .linearGradient(
                                Gradient(colors: [
                                    Color(red: 0.08, green: 0.72, blue: 0.14),
                                    peakColor,
                                    Color.white.opacity(0.88),
                                ]),
                                startPoint: CGPoint(x: rect.midX, y: rect.maxY),
                                endPoint: CGPoint(x: rect.midX, y: rect.minY)
                            )
                        )

                        if barHeight > 4 {
                            let cap = CGRect(x: x, y: y, width: barWidth, height: 1.5)
                            context.fill(Path(cap), with: .color(Color.white.opacity(0.55)))
                        }

                        let peakY = baseline - barMaxHeight * peak
                        if peak > level + 0.025 {
                            let hold = CGRect(x: x - 0.5, y: peakY - 1, width: barWidth + 1, height: 2)
                            context.fill(Path(hold), with: .color(Color.white.opacity(0.94)))
                            context.fill(
                                Path(hold),
                                with: .color(Color(red: 0.55, green: 0.92, blue: 1, opacity: 0.35))
                            )
                        }
                    }
                }
                .padding(.vertical, panelPadding * 0.5)
            }
            .frame(width: panelWidth, height: barMaxHeight + panelPadding * 2)
        }
    }

    private func winampPeakColor(_ level: CGFloat) -> Color {
        if level > 0.72 { return Color(red: 1, green: 0.22, blue: 0.14) }
        if level > 0.46 { return Color(red: 1, green: 0.78, blue: 0.1) }
        return Color(red: 0.12, green: 0.92, blue: 0.22)
    }
}

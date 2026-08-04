import Combine
import Foundation
import MobileVLCKit
import UIKit

@MainActor
final class VideoPlaybackEngine: NSObject, ObservableObject {
    @Published private(set) var queue: [VideoItem] = []
    @Published private(set) var currentIndex: Int = 0
    @Published private(set) var folderName: String = ""
    @Published private(set) var isPlaying = false
    @Published private(set) var isBuffering = false
    @Published private(set) var hasEnded = false
    @Published private(set) var currentTime: Double = 0
    @Published private(set) var duration: Double = 0
    @Published private(set) var errorMessage: String?
    @Published private(set) var audioTracks: [VideoTrackOption] = []
    @Published private(set) var subtitleTracks: [VideoTrackOption] = []
    @Published private(set) var subtitlesEnabled = false
    @Published private(set) var signalInfo = VideoSignalInfo()
    @Published var rate: VideoPlaybackRate = .normal {
        didSet { applyRate() }
    }
    @Published var aspectMode: VideoAspectMode = .automatic {
        didSet {
            guard oldValue != aspectMode else { return }
            applyAspect(force: true)
        }
    }

    /// True while the user is dragging the scrubber — blocks time sync from fighting the thumb.
    var isUserSeeking = false

    let player = VLCMediaPlayer()
    private weak var hostView: PlayerDrawableView?
    private var lastSubtitleIndex: Int32 = -1
    private var lastPublishedTime: Double = -1
    private var sourcesRef: VideoSourcesStore?
    private var bufferingRevealTask: Task<Void, Never>?
    private var isLocalFile = true
    private var aspectApplyTask: Task<Void, Never>?

    var currentItem: VideoItem? {
        guard queue.indices.contains(currentIndex) else { return nil }
        return queue[currentIndex]
    }

    var hasNext: Bool { currentIndex + 1 < queue.count }
    var hasPrevious: Bool { currentIndex > 0 }

    override init() {
        super.init()
        player.delegate = self
    }

    func attach(host: PlayerDrawableView) {
        hostView = host
        host.backgroundColor = .black
        host.clipsToBounds = true
        host.onBoundsChange = { [weak self] in
            Task { @MainActor in
                self?.applyAspect(force: false)
            }
        }
        player.drawable = host.videoSurface
        applyAspect(force: true)
    }

    func play(session: VideoPlaybackSession, sources: VideoSourcesStore) {
        sourcesRef = sources
        queue = session.items
        folderName = session.folderName
        currentIndex = min(max(0, session.startIndex), max(0, session.items.count - 1))
        errorMessage = nil
        hasEnded = false
        loadCurrent(autoplay: true)
    }

    func togglePlayPause() {
        // After EOS, MobileVLCKit ignores seek/play — must reload media.
        if hasEnded || player.state == .ended || (isNearEnd && !player.isPlaying) {
            replayFromStart()
            return
        }
        if player.isPlaying {
            player.pause()
            isPlaying = false
        } else {
            player.play()
            isPlaying = true
            hasEnded = false
        }
    }

    func replayFromStart() {
        hasEnded = false
        isPlaying = true
        currentTime = 0
        lastPublishedTime = 0
        errorMessage = nil
        // Hard remount — the only reliable restart after VLCMediaPlayerStateEnded.
        loadCurrent(autoplay: true)
    }

    func jumpBackward15() {
        if hasEnded || player.state == .ended {
            replayFromStart()
            return
        }
        let target = max(0, currentTime - 15)
        seek(to: target, resume: isPlaying)
    }

    func jumpForward15() {
        guard duration > 0 else { return }
        if hasEnded { return }
        let target = min(duration, currentTime + 15)
        if target >= duration - 0.15 {
            seek(to: duration, resume: false)
            markEnded()
        } else {
            seek(to: target, resume: isPlaying)
        }
    }

    func seek(to seconds: Double, resume: Bool? = nil) {
        if hasEnded || player.state == .ended {
            // Seeking from ended state is unreliable — remount then seek.
            let target = seconds
            let shouldResume = resume ?? true
            hasEnded = false
            loadCurrent(autoplay: false)
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 120_000_000)
                applySeek(to: target)
                if shouldResume {
                    player.play()
                    isPlaying = true
                }
            }
            return
        }
        let shouldResume = resume ?? isPlaying
        applySeek(to: seconds)
        if shouldResume {
            player.play()
            isPlaying = true
        }
    }

    private func applySeek(to seconds: Double) {
        let total = max(duration > 1 ? duration : (player.media?.length.value?.doubleValue ?? 0) / 1000.0, 0.001)
        let clamped = min(max(0, seconds), total)
        let ms = Int32((clamped * 1000.0).rounded())
        player.time = VLCTime(int: ms)
        player.position = Float(clamped / total)
        currentTime = clamped
        lastPublishedTime = clamped
        hasEnded = false
    }

    func playNext(sources: VideoSourcesStore) {
        sourcesRef = sources
        guard hasNext else {
            // Loop current when it's the only/last item — feels like “play again”.
            replayFromStart()
            return
        }
        currentIndex += 1
        loadCurrent(autoplay: true)
    }

    func playPrevious(sources: VideoSourcesStore) {
        sourcesRef = sources
        if currentTime > 3 {
            seek(to: 0, resume: true)
            return
        }
        guard hasPrevious else {
            seek(to: 0, resume: true)
            return
        }
        currentIndex -= 1
        loadCurrent(autoplay: true)
    }

    func playIndex(_ index: Int, sources: VideoSourcesStore) {
        sourcesRef = sources
        guard queue.indices.contains(index) else { return }
        currentIndex = index
        loadCurrent(autoplay: true)
    }

    func selectAudioTrack(_ index: Int32) {
        player.currentAudioTrackIndex = index
        refreshTracks()
    }

    func setSubtitlesEnabled(_ enabled: Bool) {
        if enabled {
            if lastSubtitleIndex >= 0 {
                player.currentVideoSubTitleIndex = lastSubtitleIndex
            } else if let first = subtitleTracks.first(where: { $0.index >= 0 }) {
                player.currentVideoSubTitleIndex = first.index
                lastSubtitleIndex = first.index
            }
        } else {
            let current = player.currentVideoSubTitleIndex
            if current >= 0 { lastSubtitleIndex = current }
            player.currentVideoSubTitleIndex = -1
        }
        subtitlesEnabled = enabled
        refreshTracks()
    }

    func selectSubtitleTrack(_ index: Int32) {
        if index < 0 {
            setSubtitlesEnabled(false)
            return
        }
        lastSubtitleIndex = index
        player.currentVideoSubTitleIndex = index
        subtitlesEnabled = true
        refreshTracks()
    }

    func stop() {
        player.stop()
        isPlaying = false
        hasEnded = false
        currentTime = 0
        duration = 0
        queue = []
        currentIndex = 0
        audioTracks = []
        subtitleTracks = []
        subtitlesEnabled = false
        sourcesRef = nil
    }

    // MARK: - Private

    private var isNearEnd: Bool {
        duration > 0 && currentTime >= max(0, duration - 0.4)
    }

    private func loadCurrent(autoplay: Bool) {
        guard let item = currentItem, let sources = sourcesRef else { return }
        do {
            let url = try sources.resolvePlayableURL(for: item)
            _ = sources.beginAccess(folderId: item.folderId)
            isLocalFile = url.isFileURL

            let media = VLCMedia(url: url)
            if isLocalFile {
                // Local Files / sandbox — keep decode light; avoid “forever buffering” UI.
                media.addOption(":file-caching=1200")
                media.addOption(":live-caching=300")
            } else {
                media.addOption(":network-caching=1500")
                media.addOption(":file-caching=1000")
            }

            // Tear down fully so .ended / .stopped can start cleanly again.
            bufferingRevealTask?.cancel()
            player.delegate = nil
            player.stop()
            player.media = nil
            player.delegate = self

            player.media = media
            if let host = hostView {
                player.drawable = host.videoSurface
            }
            applyRate()
            applyAspect(force: true)
            currentTime = 0
            lastPublishedTime = 0
            hasEnded = false
            errorMessage = nil
            // Never flash the spinner for local files — frame is usually ready immediately.
            isBuffering = false

            if autoplay {
                isPlaying = true
                // Deferred play is required after stop/ended on MobileVLCKit.
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 40_000_000)
                    self.player.play()
                    if !self.player.isPlaying {
                        try? await Task.sleep(nanoseconds: 100_000_000)
                        self.player.play()
                    }
                    self.isPlaying = true
                    self.clearBuffering()
                    self.refreshTracks()
                    self.refreshSignalInfo()
                    self.applyAspect(force: true)
                    self.syncTime(force: true)
                    // VLC often reports videoSize slightly after first frames.
                    try? await Task.sleep(nanoseconds: 250_000_000)
                    self.refreshSignalInfo()
                    self.applyAspect(force: true)
                }
            } else {
                isPlaying = false
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 150_000_000)
                    self.refreshTracks()
                    self.refreshSignalInfo()
                    self.applyAspect(force: true)
                    self.syncTime(force: true)
                }
            }
        } catch {
            errorMessage = error.localizedDescription
            isPlaying = false
            clearBuffering()
        }
    }

    private func noteBuffering() {
        // Local playback reports .buffering constantly (decoder warmup / keyframes).
        // Only show a spinner for remote streams, and only if it sticks.
        guard !isLocalFile else {
            clearBuffering()
            return
        }
        bufferingRevealTask?.cancel()
        bufferingRevealTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 700_000_000)
            guard !Task.isCancelled else { return }
            if self.player.state == .buffering || (!self.player.isPlaying && !self.hasEnded) {
                self.isBuffering = true
            }
        }
    }

    private func clearBuffering() {
        bufferingRevealTask?.cancel()
        bufferingRevealTask = nil
        if isBuffering { isBuffering = false }
    }

    private func markEnded() {
        hasEnded = true
        isPlaying = false
        clearBuffering()
        if duration > 0 { currentTime = duration }
    }

    private func refreshTracks() {
        let audioIndexes = (player.audioTrackIndexes as? [NSNumber]) ?? []
        let audioNames = (player.audioTrackNames as? [String]) ?? []
        let currentAudio = player.currentAudioTrackIndex
        audioTracks = zip(audioIndexes, paddedNames(audioNames, count: audioIndexes.count, prefix: "Lektor"))
            .compactMap { number, name in
                let idx = number.int32Value
                if idx < 0 { return nil }
                return VideoTrackOption(
                    id: Int(idx),
                    index: idx,
                    title: name,
                    isSelected: idx == currentAudio
                )
            }

        let subIndexes = (player.videoSubTitlesIndexes as? [NSNumber]) ?? []
        let subNames = (player.videoSubTitlesNames as? [String]) ?? []
        let currentSub = player.currentVideoSubTitleIndex
        subtitleTracks = zip(subIndexes, paddedNames(subNames, count: subIndexes.count, prefix: "Napisy"))
            .compactMap { number, name in
                let idx = number.int32Value
                if idx < 0 { return nil }
                return VideoTrackOption(
                    id: Int(idx),
                    index: idx,
                    title: name,
                    isSelected: idx == currentSub
                )
            }
        subtitlesEnabled = currentSub >= 0
        if currentSub >= 0 { lastSubtitleIndex = currentSub }
    }

    private func paddedNames(_ names: [String], count: Int, prefix: String) -> [String] {
        (0..<count).map { index in
            if index < names.count, !names[index].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return names[index]
            }
            return "\(prefix) \(index + 1)"
        }
    }

    private func applyRate() {
        player.rate = Float(rate.rawValue)
    }

    /// Layout-based aspect (AVPlayerLayer-style). VLC always fills `videoSurface`;
    /// we size/position that surface inside the host. Stretch also forces VLC DAR.
    func applyAspect(force: Bool) {
        guard let host = hostView else { return }
        let bounds = host.bounds
        guard bounds.width > 2, bounds.height > 2 else {
            // SwiftUI may attach before first layout — retry once.
            aspectApplyTask?.cancel()
            aspectApplyTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 50_000_000)
                applyAspect(force: true)
            }
            return
        }

        let vSize = player.videoSize
        let source: CGSize = {
            if vSize.width > 1, vSize.height > 1 { return vSize }
            if signalInfo.width > 0, signalInfo.height > 0 {
                return CGSize(width: signalInfo.width, height: signalInfo.height)
            }
            return .zero
        }()

        host.aspectMode = aspectMode
        host.sourceSize = source
        host.relayoutVideoSurface()

        // Reset VLC geometry; only stretch needs a forced display aspect.
        player.videoCropGeometry = nil
        player.scaleFactor = 0
        if aspectMode == .stretch {
            let w = max(1, Int(host.videoSurface.bounds.width.rounded()))
            let h = max(1, Int(host.videoSurface.bounds.height.rounded()))
            setVLCAspectRatio("\(w):\(h)")
        } else {
            player.videoAspectRatio = nil
        }

        if player.drawable as? UIView !== host.videoSurface || force {
            player.drawable = host.videoSurface
        }
    }

    private func setVLCAspectRatio(_ value: String) {
        value.withCString { cstr in
            // libvlc copies immediately; temporary pointer is safe.
            player.videoAspectRatio = UnsafeMutablePointer(mutating: cstr)
        }
    }

    func refreshSignalInfo() {
        var info = VideoSignalInfo()
        info.isLocal = isLocalFile
        if let item = currentItem {
            info.container = (item.relativePath as NSString).pathExtension.uppercased()
        }

        let size = player.videoSize
        if size.width > 1, size.height > 1 {
            info.width = Int(size.width.rounded())
            info.height = Int(size.height.rounded())
            info.resolution = "\(info.width)×\(info.height)"
            let gcd = greatestCommonDivisor(info.width, info.height)
            if gcd > 0 {
                info.sourceAspect = "\(info.width / gcd):\(info.height / gcd)"
            }
        }

        guard let media = player.media else {
            signalInfo = info
            return
        }

        let tracks = media.tracksInformation as? [[AnyHashable: Any]] ?? []
        for track in tracks {
            let type = (track[VLCMediaTracksInformationType] as? String) ?? ""
            if type == VLCMediaTracksInformationTypeVideo {
                if info.width == 0, let w = track[VLCMediaTracksInformationVideoWidth] as? NSNumber {
                    info.width = w.intValue
                }
                if info.height == 0, let h = track[VLCMediaTracksInformationVideoHeight] as? NSNumber {
                    info.height = h.intValue
                }
                if info.width > 0, info.height > 0, info.resolution.isEmpty {
                    info.resolution = "\(info.width)×\(info.height)"
                }
                if let num = track[VLCMediaTracksInformationFrameRate] as? NSNumber,
                   let den = track[VLCMediaTracksInformationFrameRateDenominator] as? NSNumber,
                   den.doubleValue > 0 {
                    let fps = num.doubleValue / den.doubleValue
                    info.frameRate = String(format: "%.2g fps", fps)
                }
                if let sar = track[VLCMediaTracksInformationSourceAspectRatio] as? NSNumber,
                   let sarDen = track[VLCMediaTracksInformationSourceAspectRatioDenominator] as? NSNumber,
                   sarDen.intValue > 0 {
                    info.sourceAspect = "\(sar.intValue):\(sarDen.intValue)"
                }
                if let fourcc = track[VLCMediaTracksInformationCodec] as? NSNumber {
                    let name = VLCMedia.codecName(forFourCC: fourcc.uint32Value, trackType: VLCMediaTracksInformationTypeVideo)
                    info.videoCodec = name.isEmpty ? fourCCString(fourcc.uint32Value) : name
                }
                if let br = track[VLCMediaTracksInformationBitrate] as? NSNumber, br.intValue > 0 {
                    info.bitrate = formatBitrate(br.intValue)
                }
                let desc = ((track[VLCMediaTracksInformationDescription] as? String) ?? "").lowercased()
                let codecLower = info.videoCodec.lowercased()
                let hdrHints = ["hdr", "pq", "hlg", "dolby vision", "dvhe", "dvh1", "hdr10"]
                if hdrHints.contains(where: { desc.contains($0) || codecLower.contains($0) }) {
                    info.isHDR = true
                    if desc.contains("dolby") || codecLower.contains("dv") {
                        info.hdrLabel = "Dolby Vision"
                    } else if desc.contains("hlg") {
                        info.hdrLabel = "HLG"
                    } else if desc.contains("hdr10+") {
                        info.hdrLabel = "HDR10+"
                    } else {
                        info.hdrLabel = "HDR"
                    }
                }
                // HEVC Main 10 / profile heuristics commonly used for HDR encodes.
                if !info.isHDR,
                   let profile = track[VLCMediaTracksInformationCodecProfile] as? NSNumber,
                   codecLower.contains("hevc") || codecLower.contains("h265") {
                    // Profile 2 is Main 10 — often HDR; show soft HDR badge only with 10-bit hint in description.
                    if profile.intValue >= 2, desc.contains("10") || desc.contains("main 10") {
                        info.isHDR = true
                        info.hdrLabel = "HDR10"
                    }
                }
            } else if type == VLCMediaTracksInformationTypeAudio {
                if info.audioCodec.isEmpty, let fourcc = track[VLCMediaTracksInformationCodec] as? NSNumber {
                    let name = VLCMedia.codecName(forFourCC: fourcc.uint32Value, trackType: VLCMediaTracksInformationTypeAudio)
                    info.audioCodec = name.isEmpty ? fourCCString(fourcc.uint32Value) : name
                }
                if let ch = track[VLCMediaTracksInformationAudioChannelsNumber] as? NSNumber, ch.intValue > 0 {
                    info.audioChannels = ch.intValue == 1 ? "Mono" : (ch.intValue == 2 ? "Stereo" : "\(ch.intValue) ch")
                }
                if info.bitrate.isEmpty, let br = track[VLCMediaTracksInformationBitrate] as? NSNumber, br.intValue > 0 {
                    info.bitrate = formatBitrate(br.intValue)
                }
            }
        }

        if info.resolution.isEmpty, info.width > 0, info.height > 0 {
            info.resolution = "\(info.width)×\(info.height)"
        }
        signalInfo = info
    }

    private func formatBitrate(_ bps: Int) -> String {
        if bps >= 1_000_000 {
            return String(format: "%.1f Mb/s", Double(bps) / 1_000_000.0)
        }
        if bps >= 1_000 {
            return String(format: "%.0f kb/s", Double(bps) / 1_000.0)
        }
        return "\(bps) b/s"
    }

    private func fourCCString(_ value: UInt32) -> String {
        let bytes: [UInt8] = [
            UInt8((value >> 24) & 0xff),
            UInt8((value >> 16) & 0xff),
            UInt8((value >> 8) & 0xff),
            UInt8(value & 0xff)
        ]
        let chars = bytes.map { b -> Character in
            let c = b >= 32 && b < 127 ? b : UInt8(Character("?").asciiValue ?? 63)
            return Character(UnicodeScalar(c))
        }
        return String(chars).trimmingCharacters(in: .whitespaces)
    }

    private func greatestCommonDivisor(_ a: Int, _ b: Int) -> Int {
        var x = abs(a), y = abs(b)
        while y != 0 { let t = x % y; x = y; y = t }
        return x
    }

    private func syncTime(force: Bool = false) {
        guard !isUserSeeking else { return }
        if let t = player.time.value?.doubleValue {
            let seconds = t / 1000.0
            if force || abs(seconds - lastPublishedTime) >= 0.2 {
                // Advancing clock ⇒ not stuck buffering.
                if abs(seconds - lastPublishedTime) >= 0.15 {
                    clearBuffering()
                }
                currentTime = seconds
                lastPublishedTime = seconds
            }
        }
        if let media = player.media, let d = media.length.value?.doubleValue, d > 0 {
            let seconds = d / 1000.0
            if force || abs(seconds - duration) >= 0.05 {
                duration = seconds
            }
        }
        let playing = player.isPlaying
        if playing != isPlaying { isPlaying = playing }
        if playing { clearBuffering() }
    }
}

extension VideoPlaybackEngine: VLCMediaPlayerDelegate {
    nonisolated func mediaPlayerStateChanged(_ aNotification: Notification) {
        Task { @MainActor in
            switch player.state {
            case .error:
                errorMessage = "Nie udało się odtworzyć pliku (kodek / HDR)."
                isPlaying = false
                clearBuffering()
                hasEnded = false
            case .buffering:
                noteBuffering()
            case .playing:
                clearBuffering()
                isPlaying = true
                hasEnded = false
                refreshTracks()
                refreshSignalInfo()
                applyAspect(force: true)
                syncTime(force: true)
            case .paused:
                isPlaying = false
                clearBuffering()
            case .ended:
                markEnded()
            case .stopped:
                // After natural end VLC often goes ended→stopped; keep hasEnded so Play remounts.
                isPlaying = false
                clearBuffering()
                if hasEnded || isNearEnd {
                    markEnded()
                }
            default:
                break
            }
        }
    }

    nonisolated func mediaPlayerTimeChanged(_ aNotification: Notification) {
        Task { @MainActor in
            syncTime(force: false)
        }
    }
}

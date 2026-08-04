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
    @Published var rate: VideoPlaybackRate = .normal {
        didSet { applyRate() }
    }
    @Published var aspectMode: VideoAspectMode = .fit {
        didSet { applyAspect() }
    }

    /// True while the user is dragging the scrubber — blocks time sync from fighting the thumb.
    var isUserSeeking = false

    let player = VLCMediaPlayer()
    private weak var drawable: UIView?
    private var lastSubtitleIndex: Int32 = -1
    private var lastPublishedTime: Double = -1
    private var sourcesRef: VideoSourcesStore?
    private var bufferingRevealTask: Task<Void, Never>?
    private var isLocalFile = true

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

    func attach(drawable: UIView) {
        self.drawable = drawable
        drawable.backgroundColor = .black
        drawable.contentMode = .scaleAspectFit
        player.drawable = drawable
        applyAspect()
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
        isBuffering = true
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
            player.drawable = drawable
            applyRate()
            applyAspect()
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
                    self.syncTime(force: true)
                }
            } else {
                isPlaying = false
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 150_000_000)
                    self.refreshTracks()
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

    private func applyAspect() {
        player.videoAspectRatio = nil
        player.videoCropGeometry = nil
        drawable?.contentMode = aspectMode == .fill ? .scaleAspectFill : .scaleAspectFit
        // Force redraw after rotation / aspect change.
        if let drawable {
            player.drawable = nil
            player.drawable = drawable
        }
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

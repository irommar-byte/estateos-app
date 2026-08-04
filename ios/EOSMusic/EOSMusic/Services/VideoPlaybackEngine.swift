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
        if hasEnded || player.state == .ended || isNearEnd {
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
        seek(to: 0, resume: true)
    }

    func jumpBackward15() {
        let target = max(0, currentTime - 15)
        seek(to: target, resume: isPlaying || hasEnded)
    }

    func jumpForward15() {
        guard duration > 0 else { return }
        let target = min(duration, currentTime + 15)
        if target >= duration - 0.15 {
            seek(to: duration, resume: false)
            markEnded()
        } else {
            seek(to: target, resume: isPlaying)
        }
    }

    func seek(to seconds: Double, resume: Bool? = nil) {
        let shouldResume = resume ?? isPlaying
        let total = max(duration, 0.001)
        let clamped = min(max(0, seconds), total)
        let ms = Int32((clamped * 1000.0).rounded())
        player.time = VLCTime(int: ms)
        // Also set position — more reliable on some short/local files.
        player.position = Float(clamped / total)
        currentTime = clamped
        lastPublishedTime = clamped
        hasEnded = false
        if shouldResume {
            if !player.isPlaying { player.play() }
            isPlaying = true
        }
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
            let media = VLCMedia(url: url)
            media.addOption(":file-caching=300")
            media.addOption(":network-caching=300")
            media.addOption(":avcodec-hw=any")
            player.stop()
            player.media = media
            player.drawable = drawable
            applyRate()
            applyAspect()
            currentTime = 0
            duration = 0
            lastPublishedTime = 0
            hasEnded = false
            if autoplay {
                player.play()
                isPlaying = true
            }
            errorMessage = nil
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 400_000_000)
                refreshTracks()
                syncTime(force: true)
            }
        } catch {
            errorMessage = error.localizedDescription
            isPlaying = false
        }
    }

    private func markEnded() {
        hasEnded = true
        isPlaying = false
        isBuffering = false
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
    }
}

extension VideoPlaybackEngine: VLCMediaPlayerDelegate {
    nonisolated func mediaPlayerStateChanged(_ aNotification: Notification) {
        Task { @MainActor in
            switch player.state {
            case .error:
                errorMessage = "Nie udało się odtworzyć pliku (kodek / HDR)."
                isPlaying = false
                isBuffering = false
                hasEnded = false
            case .buffering:
                isBuffering = true
            case .playing:
                isBuffering = false
                isPlaying = true
                hasEnded = false
                refreshTracks()
                syncTime(force: true)
            case .paused:
                isPlaying = false
                isBuffering = false
            case .ended:
                markEnded()
            case .stopped:
                isPlaying = false
                isBuffering = false
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

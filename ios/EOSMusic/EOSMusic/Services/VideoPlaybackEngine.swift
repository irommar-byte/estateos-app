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

    let player = VLCMediaPlayer()
    private weak var drawable: UIView?
    private var tick: AnyCancellable?
    private var lastSubtitleIndex: Int32 = -1

    var currentItem: VideoItem? {
        guard queue.indices.contains(currentIndex) else { return nil }
        return queue[currentIndex]
    }

    var hasNext: Bool { currentIndex + 1 < queue.count }
    var hasPrevious: Bool { currentIndex > 0 }

    override init() {
        super.init()
        player.delegate = self
        startTicker()
    }

    deinit {
        // VLCMediaPlayer tears down with the engine; avoid MainActor stop() from deinit.
    }

    func attach(drawable: UIView) {
        self.drawable = drawable
        player.drawable = drawable
        applyAspect()
    }

    func play(session: VideoPlaybackSession, sources: VideoSourcesStore) {
        queue = session.items
        folderName = session.folderName
        currentIndex = min(max(0, session.startIndex), max(0, session.items.count - 1))
        errorMessage = nil
        loadCurrent(sources: sources, autoplay: true)
    }

    func togglePlayPause() {
        if player.isPlaying {
            player.pause()
            isPlaying = false
        } else {
            player.play()
            isPlaying = true
        }
    }

    func jumpBackward15() {
        player.jumpBackward(15)
        syncTime()
    }

    func jumpForward15() {
        player.jumpForward(15)
        syncTime()
    }

    func seek(to seconds: Double) {
        guard duration > 0 else { return }
        let clamped = min(max(0, seconds), duration)
        let position = Float(clamped / duration)
        player.position = position
        currentTime = clamped
    }

    func playNext(sources: VideoSourcesStore) {
        guard hasNext else { return }
        currentIndex += 1
        loadCurrent(sources: sources, autoplay: true)
    }

    func playPrevious(sources: VideoSourcesStore) {
        if currentTime > 3 {
            seek(to: 0)
            return
        }
        guard hasPrevious else {
            seek(to: 0)
            return
        }
        currentIndex -= 1
        loadCurrent(sources: sources, autoplay: true)
    }

    func playIndex(_ index: Int, sources: VideoSourcesStore) {
        guard queue.indices.contains(index) else { return }
        currentIndex = index
        loadCurrent(sources: sources, autoplay: true)
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
        currentTime = 0
        duration = 0
        queue = []
        currentIndex = 0
        audioTracks = []
        subtitleTracks = []
        subtitlesEnabled = false
    }

    // MARK: - Private

    private func loadCurrent(sources: VideoSourcesStore, autoplay: Bool) {
        guard let item = currentItem else { return }
        do {
            let url = try sources.resolvePlayableURL(for: item)
            _ = sources.beginAccess(folderId: item.folderId)
            let media = VLCMedia(url: url)
            media.addOption(":network-caching=1000")
            media.addOption(":file-caching=1000")
            // Prefer hardware decode for HDR/HEVC when available.
            media.addOption(":avcodec-hw=any")
            player.media = media
            player.drawable = drawable
            applyRate()
            applyAspect()
            if autoplay {
                player.play()
                isPlaying = true
            }
            errorMessage = nil
            // Tracks appear after parse — refresh shortly.
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 700_000_000)
                refreshTracks()
            }
        } catch {
            errorMessage = error.localizedDescription
            isPlaying = false
        }
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
        switch aspectMode {
        case .fit:
            player.videoAspectRatio = nil
            player.videoCropGeometry = nil
        case .fill:
            // Fill by slight crop; VLC keeps aspect via crop string when possible.
            player.videoAspectRatio = nil
        }
        drawable?.contentMode = aspectMode == .fill ? .scaleAspectFill : .scaleAspectFit
    }

    private func startTicker() {
        tick = Timer.publish(every: 0.25, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.syncTime()
            }
    }

    private func syncTime() {
        if let t = player.time.value?.doubleValue {
            currentTime = t / 1000.0
        }
        if let media = player.media, let d = media.length.value?.doubleValue, d > 0 {
            duration = d / 1000.0
        }
        isPlaying = player.isPlaying
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
            case .buffering:
                isBuffering = true
            case .playing:
                isBuffering = false
                isPlaying = true
                refreshTracks()
            case .paused:
                isPlaying = false
                isBuffering = false
            case .ended:
                isPlaying = false
                isBuffering = false
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
            syncTime()
        }
    }
}

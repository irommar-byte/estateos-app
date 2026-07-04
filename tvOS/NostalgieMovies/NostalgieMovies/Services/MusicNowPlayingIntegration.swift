import MediaPlayer
import UIKit

@MainActor
final class MusicNowPlayingIntegration {
    static let shared = MusicNowPlayingIntegration()

    private var isActive = false

    func activate(
        onNext: @escaping () -> Void,
        onPrevious: @escaping () -> Void,
        onPlay: @escaping () -> Void,
        onPause: @escaping () -> Void,
        onToggle: @escaping () -> Void,
        onInteract: @escaping () -> Void = {}
    ) {
        let center = MPRemoteCommandCenter.shared()
        center.nextTrackCommand.isEnabled = true
        center.previousTrackCommand.isEnabled = true
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        center.changePlaybackPositionCommand.isEnabled = true

        center.nextTrackCommand.addTarget { _ in
            onInteract()
            Task { @MainActor in onNext() }
            return .success
        }
        center.previousTrackCommand.addTarget { _ in
            onInteract()
            Task { @MainActor in onPrevious() }
            return .success
        }
        center.playCommand.addTarget { _ in
            onInteract()
            Task { @MainActor in onPlay() }
            return .success
        }
        center.pauseCommand.addTarget { _ in
            onInteract()
            Task { @MainActor in onPause() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { _ in
            onInteract()
            Task { @MainActor in onToggle() }
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { event in
            onInteract()
            guard let seek = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            NotificationCenter.default.post(
                name: .musicPlayerSeekRequested,
                object: nil,
                userInfo: ["time": seek.positionTime]
            )
            return .success
        }

        isActive = true
    }

    func update(
        track: MusicPlaybackTrack,
        duration: Double,
        elapsed: Double,
        isPlaying: Bool,
        queueIndex: Int,
        queueCount: Int
    ) {
        guard isActive else { return }

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyMediaType: MPMediaType.music.rawValue,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: elapsed,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
        ]

        if let artist = track.artist, !artist.isEmpty {
            info[MPMediaItemPropertyArtist] = artist
        }
        if let album = track.album, !album.isEmpty {
            info[MPMediaItemPropertyAlbumTitle] = album
        }
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        if queueCount > 0 {
            info[MPNowPlayingInfoPropertyPlaybackQueueIndex] = queueIndex
            info[MPNowPlayingInfoPropertyPlaybackQueueCount] = queueCount
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        guard let url = track.artworkURL else { return }
        Task {
            guard let (data, _) = try? await URLSession.shared.data(from: url),
                  let image = UIImage(data: data) else { return }
            var updated = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? info
            updated[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            MPNowPlayingInfoCenter.default().nowPlayingInfo = updated
        }
    }

    func deactivate() {
        guard isActive else { return }
        let center = MPRemoteCommandCenter.shared()
        center.nextTrackCommand.removeTarget(nil)
        center.previousTrackCommand.removeTarget(nil)
        center.playCommand.removeTarget(nil)
        center.pauseCommand.removeTarget(nil)
        center.togglePlayPauseCommand.removeTarget(nil)
        center.changePlaybackPositionCommand.removeTarget(nil)
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        isActive = false
    }
}

extension Notification.Name {
    static let musicPlayerSeekRequested = Notification.Name("musicPlayerSeekRequested")
}

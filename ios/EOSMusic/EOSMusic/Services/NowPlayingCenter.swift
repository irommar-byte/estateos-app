import MediaPlayer
import UIKit

extension Notification.Name {
    static let musicPlayerSeekRequested = Notification.Name("eosmusic.player.seek")
}

@MainActor
final class NowPlayingCenter {
    struct SupplementalMetadata {
        let title: String?
        let artist: String?
        let album: String?
        let artwork: UIImage?
    }

    static let shared = NowPlayingCenter()

    private var isActive = false
    private var lastTrackID: String?
    private var artworkCache: [String: MPMediaItemArtwork] = [:]
    private var artworkLoadTask: Task<Void, Never>?

    func activate(
        onNext: @escaping () -> Void,
        onPrevious: @escaping () -> Void,
        onPlay: @escaping () -> Void,
        onPause: @escaping () -> Void,
        onToggle: @escaping () -> Void
    ) {
        let center = MPRemoteCommandCenter.shared()
        center.nextTrackCommand.removeTarget(nil)
        center.previousTrackCommand.removeTarget(nil)
        center.playCommand.removeTarget(nil)
        center.pauseCommand.removeTarget(nil)
        center.togglePlayPauseCommand.removeTarget(nil)
        center.changePlaybackPositionCommand.removeTarget(nil)

        center.nextTrackCommand.isEnabled = true
        center.previousTrackCommand.isEnabled = true
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        center.changePlaybackPositionCommand.isEnabled = true

        center.nextTrackCommand.addTarget { _ in
            Task { @MainActor in onNext() }
            return .success
        }
        center.previousTrackCommand.addTarget { _ in
            Task { @MainActor in onPrevious() }
            return .success
        }
        center.playCommand.addTarget { _ in
            Task { @MainActor in onPlay() }
            return .success
        }
        center.pauseCommand.addTarget { _ in
            Task { @MainActor in onPause() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { _ in
            Task { @MainActor in onToggle() }
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { event in
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
        queueCount: Int,
        supplemental: SupplementalMetadata? = nil
    ) {
        guard isActive else { return }

        let trackChanged = lastTrackID != track.id
        if trackChanged {
            lastTrackID = track.id
            artworkLoadTask?.cancel()
            artworkLoadTask = nil
        }

        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]

        info[MPMediaItemPropertyTitle] = resolvedText(supplemental?.title, fallback: track.title)
        info[MPMediaItemPropertyMediaType] = MPMediaType.music.rawValue
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = elapsed
        info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0
        info[MPNowPlayingInfoPropertyMediaType] = MPNowPlayingInfoMediaType.audio.rawValue

        if let artist = resolvedText(supplemental?.artist, fallback: track.artist) {
            info[MPMediaItemPropertyArtist] = artist
        } else {
            info.removeValue(forKey: MPMediaItemPropertyArtist)
        }
        if let album = resolvedText(supplemental?.album, fallback: track.album) {
            info[MPMediaItemPropertyAlbumTitle] = album
        } else {
            info.removeValue(forKey: MPMediaItemPropertyAlbumTitle)
        }
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        if queueCount > 0 {
            info[MPNowPlayingInfoPropertyPlaybackQueueIndex] = queueIndex
            info[MPNowPlayingInfoPropertyPlaybackQueueCount] = queueCount
        }

        if let embeddedArtwork = supplemental?.artwork {
            let artwork = MPMediaItemArtwork(boundsSize: embeddedArtwork.size) { _ in embeddedArtwork }
            artworkCache[track.id] = artwork
            info[MPMediaItemPropertyArtwork] = artwork
        } else if let cached = artworkCache[track.id] {
            info[MPMediaItemPropertyArtwork] = cached
        } else if trackChanged {
            info.removeValue(forKey: MPMediaItemPropertyArtwork)
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        if trackChanged || artworkCache[track.id] == nil {
            loadArtwork(for: track)
        }
    }

    private func loadArtwork(for track: MusicPlaybackTrack) {
        guard artworkCache[track.id] == nil, let url = track.artworkURL else { return }

        let trackID = track.id
        artworkLoadTask?.cancel()
        artworkLoadTask = Task {
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                guard !Task.isCancelled, let image = UIImage(data: data) else { return }
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                artworkCache[trackID] = artwork
                guard lastTrackID == trackID else { return }
                var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                info[MPMediaItemPropertyArtwork] = artwork
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            } catch {
                // brak okładki — zostaw metadane bez artwork
            }
        }
    }

    private func resolvedText(_ primary: String?, fallback: String?) -> String? {
        let trimmedPrimary = primary?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmedPrimary, !trimmedPrimary.isEmpty { return trimmedPrimary }
        let trimmedFallback = fallback?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmedFallback, !trimmedFallback.isEmpty { return trimmedFallback }
        return nil
    }

    func deactivate() {
        guard isActive else { return }
        artworkLoadTask?.cancel()
        artworkLoadTask = nil
        lastTrackID = nil

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

import MediaPlayer
import UIKit

extension Notification.Name {
    static let musicPlayerSeekRequested = Notification.Name("eosmusic.player.seek")
    static let eosSessionUnauthorized = Notification.Name("eosmusic.session.unauthorized")
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
    private var lastIdentity = PlaybackItemIdentity.none
    private var artworkCache: [UUID: MPMediaItemArtwork] = [:]
    private var artworkLoadTask: Task<Void, Never>?
    private var lastElapsedPublish: TimeInterval = -1
    private var lastPlayingPublish: Bool?
    private var lastDurationPublish: Double = -1

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
        UIApplication.shared.beginReceivingRemoteControlEvents()
    }

    func update(
        track: MusicPlaybackTrack,
        duration: Double,
        elapsed: Double,
        isPlaying: Bool,
        queueIndex: Int,
        queueCount: Int,
        collectionTitle: String? = nil,
        collectionPersistentSeed: String? = nil,
        externalContentIdentifier: String? = nil,
        repeatMode: RepeatMode = .off,
        shuffleEnabled: Bool = false,
        supplemental: SupplementalMetadata? = nil,
        identity: PlaybackItemIdentity,
        force: Bool = false
    ) {
        guard isActive else { return }
        _ = repeatMode
        _ = shuffleEnabled

        let identityChanged = lastIdentity != identity
        let playingChanged = lastPlayingPublish != isPlaying
        let durationChanged = abs(lastDurationPublish - duration) > 0.5
        let elapsedDue = force
            || identityChanged
            || playingChanged
            || lastElapsedPublish < 0
            || abs(elapsed - lastElapsedPublish) >= 1.0

        guard identityChanged || playingChanged || durationChanged || elapsedDue || force else { return }

        if identityChanged {
            lastIdentity = identity
            artworkLoadTask?.cancel()
            artworkLoadTask = nil
        }

        let persistentSeed: String
        if let externalContentIdentifier, !externalContentIdentifier.isEmpty {
            persistentSeed = externalContentIdentifier
        } else {
            persistentSeed = track.id
        }

        let artwork: MPMediaItemArtwork?
        if let embeddedArtwork = supplemental?.artwork {
            let item = MPMediaItemArtwork(boundsSize: embeddedArtwork.size) { _ in embeddedArtwork }
            artworkCache[identity.transitionID] = item
            artwork = item
        } else {
            artwork = artworkCache[identity.transitionID]
        }

        let info = NowPlayingInfoBuilder.make(
            title: NowPlayingInfoBuilder.resolvedText(supplemental?.title, fallback: track.title) ?? track.title,
            artist: NowPlayingInfoBuilder.resolvedText(supplemental?.artist, fallback: track.artist),
            album: NowPlayingInfoBuilder.resolvedText(collectionTitle, fallback: supplemental?.album)
                ?? NowPlayingInfoBuilder.resolvedText(supplemental?.album, fallback: track.album),
            duration: duration,
            elapsed: elapsed,
            isPlaying: isPlaying,
            queueIndex: queueIndex,
            queueCount: queueCount,
            persistentSeed: persistentSeed,
            collectionPersistentSeed: collectionPersistentSeed,
            externalContentIdentifier: externalContentIdentifier,
            artwork: artwork
        )

        let center = MPNowPlayingInfoCenter.default()
        center.nowPlayingInfo = info
        center.playbackState = isPlaying ? .playing : .paused
        lastElapsedPublish = elapsed
        lastPlayingPublish = isPlaying
        lastDurationPublish = duration

        if artwork == nil {
            loadArtwork(for: track, identity: identity)
        }
    }

    private func loadArtwork(for track: MusicPlaybackTrack, identity: PlaybackItemIdentity) {
        guard artworkCache[identity.transitionID] == nil, let url = track.artworkURL else { return }
        let keep = identity
        artworkLoadTask?.cancel()
        artworkLoadTask = Task {
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                guard !Task.isCancelled, let image = UIImage(data: data) else { return }
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                artworkCache[keep.transitionID] = artwork
                guard lastIdentity == keep else { return }
                var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                info[MPMediaItemPropertyArtwork] = artwork
                let center = MPNowPlayingInfoCenter.default()
                center.nowPlayingInfo = info
                if let playing = lastPlayingPublish {
                    center.playbackState = playing ? .playing : .paused
                }
            } catch {}
        }
    }

    func deactivate() {
        guard isActive else { return }
        artworkLoadTask?.cancel()
        artworkLoadTask = nil
        lastIdentity = .none
        lastElapsedPublish = -1
        lastPlayingPublish = nil
        lastDurationPublish = -1

        let center = MPRemoteCommandCenter.shared()
        center.nextTrackCommand.removeTarget(nil)
        center.previousTrackCommand.removeTarget(nil)
        center.playCommand.removeTarget(nil)
        center.pauseCommand.removeTarget(nil)
        center.togglePlayPauseCommand.removeTarget(nil)
        center.changePlaybackPositionCommand.removeTarget(nil)
        let nowPlaying = MPNowPlayingInfoCenter.default()
        nowPlaying.nowPlayingInfo = nil
        nowPlaying.playbackState = .stopped
        isActive = false
    }
}

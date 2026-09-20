import Foundation
import MediaPlayer

struct PlaybackItemIdentity: Equatable, Hashable {
    var sessionGeneration: Int
    var queueIndex: Int
    var transitionID: UUID

    static let none = PlaybackItemIdentity(sessionGeneration: -1, queueIndex: -1, transitionID: UUID())
}

enum NowPlayingInfoBuilder {
    static func make(
        title: String,
        artist: String?,
        album: String?,
        duration: Double,
        elapsed: Double,
        isPlaying: Bool,
        queueIndex: Int,
        queueCount: Int,
        persistentSeed: String,
        collectionPersistentSeed: String?,
        externalContentIdentifier: String?,
        artwork: MPMediaItemArtwork?
    ) -> [String: Any] {
        var info: [String: Any] = [:]
        info[MPMediaItemPropertyTitle] = title
        info[MPMediaItemPropertyMediaType] = NSNumber(value: MPMediaType.music.rawValue)
        info[MPNowPlayingInfoPropertyPlaybackRate] = NSNumber(value: isPlaying ? 1.0 : 0.0)
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = NSNumber(value: elapsed)
        info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = NSNumber(value: 1.0)
        info[MPNowPlayingInfoPropertyMediaType] = NSNumber(value: MPNowPlayingInfoMediaType.audio.rawValue)
        if let artist, !artist.isEmpty {
            info[MPMediaItemPropertyArtist] = artist
        }
        if let album, !album.isEmpty {
            info[MPMediaItemPropertyAlbumTitle] = album
        }
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = NSNumber(value: duration)
        }
        info[MPMediaItemPropertyPersistentID] = stablePersistentID(persistentSeed)
        if let collectionPersistentSeed, !collectionPersistentSeed.isEmpty {
            info[MPMediaItemPropertyAlbumPersistentID] = stablePersistentID(collectionPersistentSeed)
        }
        if queueCount > 1 {
            info[MPNowPlayingInfoPropertyPlaybackQueueIndex] = NSNumber(value: queueIndex)
            info[MPNowPlayingInfoPropertyPlaybackQueueCount] = NSNumber(value: queueCount)
            info[MPMediaItemPropertyAlbumTrackNumber] = NSNumber(value: queueIndex + 1)
            info[MPMediaItemPropertyAlbumTrackCount] = NSNumber(value: queueCount)
        }
        if let externalContentIdentifier, !externalContentIdentifier.isEmpty {
            info[MPNowPlayingInfoPropertyExternalContentIdentifier] = externalContentIdentifier
        }
        if let artwork {
            info[MPMediaItemPropertyArtwork] = artwork
        }
        return info
    }

    static func resolvedText(_ primary: String?, fallback: String?) -> String? {
        let trimmedPrimary = primary?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmedPrimary, !trimmedPrimary.isEmpty { return trimmedPrimary }
        let trimmedFallback = fallback?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmedFallback, !trimmedFallback.isEmpty { return trimmedFallback }
        return nil
    }

    static func stablePersistentID(_ seed: String) -> NSNumber {
        var hash: UInt64 = 5381
        for byte in seed.utf8 {
            hash = ((hash << 5) &+ hash) &+ UInt64(byte)
        }
        return NSNumber(value: hash)
    }
}

enum PlaybackIdentityGate {
    static func shouldPublishNowPlaying(captured: PlaybackItemIdentity, current: PlaybackItemIdentity) -> Bool {
        captured == current && current != .none
    }
}

enum AudioSessionLeaseMode: String, Equatable {
    case inactive
    case musicPlayback
    case videoPlayback
    case shazamCapture
}

enum AudioSessionLeasePolicy {
    static func shouldIgnoreOwnCategoryChange(current: AudioSessionLeaseMode) -> Bool {
        current == .shazamCapture
    }

    static func canStartMicrophone(hasLiveActivity: Bool, permissionGranted: Bool) -> Bool {
        hasLiveActivity && permissionGranted
    }
}

struct ShazamReducerState: Equatable {
    var phase: EOSShazamPhase = .idle
    var operationId: UUID?
    var message: String = ""

    mutating func begin(_ id: UUID) -> Bool {
        if phase == .listening || phase == .preparingActivity {
            message = "Już słucham"
            return false
        }
        operationId = id
        phase = .preparingActivity
        message = "Słucham…"
        return true
    }

    mutating func markListening(id: UUID) {
        guard operationId == id else { return }
        phase = .listening
    }

    mutating func finish(id: UUID, phase: EOSShazamPhase, message: String) {
        guard operationId == id else { return }
        self.phase = phase
        self.message = message
    }

    mutating func timeout(id: UUID) {
        guard operationId == id else { return }
        phase = .failed
        message = "Nie rozpoznano"
        operationId = nil
    }
}

struct PendingShazamAdd: Codable, Equatable {
    var id: String
    var title: String
    var artist: String?
    var appleMusicID: String?
    var isrc: String?
    var webURL: String?
    var createdAt: Date
}

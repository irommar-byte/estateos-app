import Foundation

enum EOSControlKind {
    static let shazam = "pl.nostalgie.eosmusic.control.shazam"
    static let playPause = "pl.nostalgie.eosmusic.control.playpause"
    static let next = "pl.nostalgie.eosmusic.control.next"
    static let favorite = "pl.nostalgie.eosmusic.control.favorite"

    static let all = [shazam, playPause, next, favorite]
}

enum EOSAppGroup {
    static let identifier = "group.pl.nostalgie.eosmusic"
    static let snapshotFileName = "eos-control-snapshot.json"
    static let schemaVersion = 1
    static let staleTTL: TimeInterval = 90
}

enum EOSControlWidgetStatus {
    static func text(_ message: String) -> String {
        message.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

enum ControlIntentPolicy {
    static func playPauseOutcome(desired: Bool, isPlaying: Bool, hasTrack: Bool, isLoggedIn: Bool) -> Result<Bool, EOSIntentRoutingError> {
        guard isLoggedIn else { return .failure(.notLoggedIn) }
        guard hasTrack else { return .failure(.noCurrentTrack) }
        return .success(desired)
    }

    static func favoriteOutcome(desired: Bool, isFavorite: Bool, hasTrack: Bool, isLoggedIn: Bool) -> Result<Bool, EOSIntentRoutingError> {
        guard isLoggedIn else { return .failure(.notLoggedIn) }
        guard hasTrack else { return .failure(.noCurrentTrack) }
        return .success(desired)
    }
}

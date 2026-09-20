import Foundation

enum EOSShazamPhase: String, Codable, Equatable {
    case idle
    case needsSetup
    case preparingActivity
    case listening
    case recognized
    case resolvingCatalog
    case adding
    case added
    case alreadyPresent
    case queuedOffline
    case failed
}

struct EOSControlSnapshot: Codable, Equatable {
    var schemaVersion: Int
    var revision: Int
    var updatedAt: Date
    var title: String
    var artist: String
    var trackURL: String
    var isPlaying: Bool
    var isFavorite: Bool
    var hasCurrentTrack: Bool
    var isLoggedIn: Bool
    var shazamPhase: EOSShazamPhase
    var shazamMessage: String
    var microphoneReady: Bool
    var queueAvailable: Bool
    var lastSafeError: String

    static let empty = EOSControlSnapshot(
        schemaVersion: EOSAppGroup.schemaVersion,
        revision: 0,
        updatedAt: .distantPast,
        title: "",
        artist: "",
        trackURL: "",
        isPlaying: false,
        isFavorite: false,
        hasCurrentTrack: false,
        isLoggedIn: false,
        shazamPhase: .idle,
        shazamMessage: "",
        microphoneReady: false,
        queueAvailable: false,
        lastSafeError: ""
    )

    var isStale: Bool {
        schemaVersion != EOSAppGroup.schemaVersion
            || Date().timeIntervalSince(updatedAt) > EOSAppGroup.staleTTL
    }

    var displayTitle: String {
        guard !isStale, hasCurrentTrack, !title.isEmpty else { return "EOS Music" }
        return title
    }

    var displayArtist: String {
        guard !isStale, hasCurrentTrack else { return "" }
        return artist
    }

    var shazamStatusText: String {
        switch shazamPhase {
        case .needsSetup:
            return "Dokończ konfigurację w EOS Music"
        case .preparingActivity, .listening:
            return "Słucham…"
        case .recognized, .resolvingCatalog, .adding:
            return shazamMessage.isEmpty ? "Rozpoznano" : shazamMessage
        case .added, .alreadyPresent, .queuedOffline, .failed:
            return shazamMessage
        case .idle:
            return microphoneReady ? "Shazam" : "Dokończ konfigurację w EOS Music"
        }
    }
}

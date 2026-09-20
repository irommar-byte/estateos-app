import Foundation
import OSLog

enum EOSLog {
    static let controlIntent = Logger(subsystem: "pl.nostalgie.eosmusic", category: "control-intent")
    static let shazam = Logger(subsystem: "pl.nostalgie.eosmusic", category: "shazam")
    static let audioSession = Logger(subsystem: "pl.nostalgie.eosmusic", category: "audio-session")
    static let liveActivity = Logger(subsystem: "pl.nostalgie.eosmusic", category: "live-activity")
    static let downloadQueue = Logger(subsystem: "pl.nostalgie.eosmusic", category: "download-queue")
}

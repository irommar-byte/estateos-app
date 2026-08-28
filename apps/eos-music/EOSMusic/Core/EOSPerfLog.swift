import Foundation
import os

/// Lightweight performance / reliability instrumentation for Apple-native QA.
enum EOSPerfLog {
    static let stream = Logger(subsystem: "pl.nostalgie.eosmusic", category: "stream")
    static let download = Logger(subsystem: "pl.nostalgie.eosmusic", category: "download")
    static let library = Logger(subsystem: "pl.nostalgie.eosmusic", category: "library")
    static let player = Logger(subsystem: "pl.nostalgie.eosmusic", category: "player")
    static let network = Logger(subsystem: "pl.nostalgie.eosmusic", category: "network")

    static let signposts = OSLog(subsystem: "pl.nostalgie.eosmusic", category: .pointsOfInterest)

    @discardableResult
    static func measure<T>(
        _ name: StaticString,
        log: OSLog = signposts,
        _ work: () throws -> T
    ) rethrows -> T {
        let id = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: name, signpostID: id)
        defer { os_signpost(.end, log: log, name: name, signpostID: id) }
        return try work()
    }

    static func intervalBegin(_ name: StaticString) -> OSSignpostID {
        let id = OSSignpostID(log: signposts)
        os_signpost(.begin, log: signposts, name: name, signpostID: id)
        return id
    }

    static func intervalEnd(_ name: StaticString, id: OSSignpostID) {
        os_signpost(.end, log: signposts, name: name, signpostID: id)
    }
}

/// Pure helpers covered by unit tests — offline gating + download FSM.
enum OfflinePlaybackPolicy {
    static func isOfflinePlaybackActive(offlineModeEnabled: Bool, isOnline: Bool) -> Bool {
        offlineModeEnabled || !isOnline
    }

    static func canPlayRemoteStream(offlineModeEnabled: Bool, isOnline: Bool, hasLocalFile: Bool) -> Bool {
        if hasLocalFile { return true }
        return !isOfflinePlaybackActive(offlineModeEnabled: offlineModeEnabled, isOnline: isOnline)
    }
}

enum DownloadRetryPolicy {
    /// Bounded exponential backoff with jitter. Returns nil when retries are exhausted.
    static func delayNanoseconds(afterAttempt attempt: Int, maxAttempts: Int = 5) -> UInt64? {
        guard attempt < maxAttempts else { return nil }
        let base: UInt64 = 1_000_000_000 // 1s
        let capped = min(base << attempt, 30_000_000_000)
        let jitter = UInt64.random(in: 0...(capped / 5))
        return capped + jitter
    }
}

enum StreamRecoveryPolicy {
    static let maxAttempts = 4
    static let stablePlaybackSeconds: Double = 30
    /// Live / ingest streams that never deliver the first packet.
    static let firstByteTimeoutNanoseconds: UInt64 = 8_000_000_000

    static func shouldResetAttemptCount(stablePlaybackDuration: Double) -> Bool {
        stablePlaybackDuration >= stablePlaybackSeconds
    }

    static func delayNanoseconds(afterAttempt attempt: Int) -> UInt64? {
        DownloadRetryPolicy.delayNanoseconds(afterAttempt: attempt, maxAttempts: maxAttempts)
    }

    static func isFatalPlaybackError(_ message: String) -> Bool {
        let lower = message.lowercased()
        // 404 during ingest is retryable — the stream endpoint appears once the file exists.
        return lower.contains("401")
            || lower.contains("403")
            || lower.contains("unauthorized")
            || lower.contains("forbidden")
    }
}

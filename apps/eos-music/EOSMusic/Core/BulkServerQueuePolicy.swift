import Foundation

/// NAS music ingest is one yt-dlp at a time. The WAN path to YouTube is about
/// 10 KB/s, so a second parallel grab starves the first and both look stuck.
enum BulkServerQueuePolicy {
    static let maxConcurrentServerJobs = 1
    static let stallSeconds: TimeInterval = 150
    static let meaningfulProgressDelta: Double = 0.25
    static let interTrackDelayNanoseconds: UInt64 = 250_000_000

    enum Action: Equatable {
        case start(index: Int)
        case wait
        case done
        case cancelled
    }

    static func nextAction(completed: Int, total: Int, cancelled: Bool, inFlight: Int) -> Action {
        if cancelled { return .cancelled }
        if total <= 0 || completed >= total { return .done }
        if completed + inFlight >= total { return .wait }
        if inFlight >= maxConcurrentServerJobs { return .wait }
        return .start(index: completed + inFlight)
    }

    static func isAcquireStalled(progress: Double, unchangedFor: TimeInterval) -> Bool {
        // The last few percent of a slow audio file can sit near the end while
        // ffmpeg tags the MP3. That is still a live transfer.
        if progress >= 96 {
            return unchangedFor > 120
        }
        return unchangedFor > stallSeconds
    }

    static func isFinalizeComplete(progress: Double, isDurable: Bool, isReady: Bool) -> Bool {
        _ = progress
        return isDurable || isReady
    }

    static func isMeaningfulProgress(from: Double, to: Double) -> Bool {
        abs(to - from) >= meaningfulProgressDelta
    }

    /// A catalog/play job id is not a durable MP3. Skip only real server files.
    static func shouldSkipAsAlreadyOnServer(
        isOffline: Bool,
        hasDurableAsset: Bool,
        wasConfirmedOnServer: Bool
    ) -> Bool {
        isOffline || hasDurableAsset || wasConfirmedOnServer
    }

    static func displayTotal(stickyTotal: Int, itemCount: Int, existingTotal: Int = 0) -> Int {
        max(stickyTotal, itemCount, existingTotal, 1)
    }

    /// Honest list progress: finished tracks + the 0…1 fraction of each live slot.
    static func overallFraction(completed: Int, total: Int, slotProgresses: [Double]) -> Double {
        guard total > 0 else { return 0 }
        let slots = slotProgresses
            .prefix(maxConcurrentServerJobs)
            .map { min(1, max(0, $0)) }
            .reduce(0, +)
        return min(1, (Double(max(0, completed)) + slots) / Double(total))
    }
}

enum ServerOwnedQueuePolicy {
    static func enqueueOnce(itemCount: Int) -> (calls: Int, batches: Int) {
        guard itemCount > 0 else { return (0, 0) }
        return (1, 1)
    }

    static func phoneMaySleepWhileServerContinues() -> Bool { true }

    static func cancelRemovesActiveAndPending() -> Bool { true }

    /// Playlist ingest stays on the NAS. A missing or idle batch is not a reason
    /// for the iPhone to start POST /api/download itself.
    static func shouldFallBackToPhoneAcquire(didEnqueue: Bool, batchId: String?) -> Bool {
        _ = didEnqueue
        _ = batchId
        return false
    }

    static func shouldAbandonIdleServerBatch(
        secondsWaiting: TimeInterval,
        completed: Int,
        hasActiveRemoteJob: Bool
    ) -> Bool {
        _ = secondsWaiting
        _ = completed
        _ = hasActiveRemoteJob
        return false
    }

    static func shouldReenqueueExistingBatch(_ batchId: String?) -> Bool {
        guard let batchId else { return true }
        return batchId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// A “+” / single-track session must not inherit a leftover playlist HUD.
    static func shouldAdoptRemoteBatch(plusSessionActive: Bool, alreadyOwnsStickyItems: Bool) -> Bool {
        !plusSessionActive && alreadyOwnsStickyItems
    }
}

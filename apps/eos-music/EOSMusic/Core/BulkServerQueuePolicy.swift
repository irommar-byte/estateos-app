import Foundation

/// NAS music ingest runs a small pool (2). Playlist download waits for a durable
/// copy (or a stall retry) before filling a free slot.
enum BulkServerQueuePolicy {
    static let maxConcurrentServerJobs = 2
    static let stallSeconds: TimeInterval = 18
    static let meaningfulProgressDelta: Double = 3
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
        guard progress < 96 else { return false }
        return unchangedFor > stallSeconds
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
}

enum ServerOwnedQueuePolicy {
    static func enqueueOnce(itemCount: Int) -> (calls: Int, batches: Int) {
        guard itemCount > 0 else { return (0, 0) }
        return (1, 1)
    }

    static func phoneMaySleepWhileServerContinues() -> Bool { true }

    static func cancelRemovesActiveAndPending() -> Bool { true }

    static let idleServerBatchFallbackSeconds: TimeInterval = 12

    /// Production without `/api/downloads/queue` (or an empty batchId) must not sit in a poll loop.
    static func shouldFallBackToPhoneAcquire(didEnqueue: Bool, batchId: String?) -> Bool {
        guard didEnqueue else { return true }
        guard let batchId else { return true }
        return batchId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Server accepted a batchId but never started a job — same stuck UI as a missing route.
    static func shouldAbandonIdleServerBatch(
        secondsWaiting: TimeInterval,
        completed: Int,
        hasActiveRemoteJob: Bool
    ) -> Bool {
        secondsWaiting >= idleServerBatchFallbackSeconds && completed <= 0 && !hasActiveRemoteJob
    }
}

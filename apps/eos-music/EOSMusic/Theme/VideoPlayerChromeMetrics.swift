import CoreGraphics
import Foundation

/// Video full-screen chrome must clear the Dynamic Island even when the
/// player view ignores the safe area (letterboxed portrait + true landscape).
enum VideoPlayerChromeMetrics {
    static let portraitTopClearance: CGFloat = 59
    static let landscapeTopClearance: CGFloat = 36
    static let islandGutter: CGFloat = 126
    static let barPadding: CGFloat = 16

    static func topInset(safeTop: CGFloat, width: CGFloat, height: CGFloat) -> CGFloat {
        if width > height {
            return max(safeTop, 12) + landscapeTopClearance
        }
        return max(safeTop, portraitTopClearance)
    }

    static func sideInset(safeSide: CGFloat) -> CGFloat {
        max(barPadding, safeSide)
    }
}

enum VideoFilmstripPolicy {
    static let prepareTimeoutSeconds: TimeInterval = 6

    static let liveCaptureInterval: TimeInterval = 8
    static let liveCaptureBuckets = 12

    /// Place live snapshots even when VLC has not published a feature length.
    static func placementDuration(known: Double, currentTime: Double) -> Double {
        if known > 1 { return known }
        return max(currentTime + 24, 90)
    }

    static func liveBucket(fraction: Double, buckets: Int = liveCaptureBuckets) -> Int {
        let clamped = min(0.999, max(0, fraction))
        let count = max(1, buckets)
        return min(count - 1, Int((clamped * Double(count)).rounded(.down)))
    }

    /// One VLC snapshot per slice of the film. Calling `saveVideoSnapshot` every second
    /// for a whole feature kills the video output after several minutes.
    static func shouldCaptureLiveFrame(
        currentTime: Double,
        lastCaptureAt: Double,
        isSeeking: Bool,
        knownDuration: Double = 0,
        occupiedBuckets: Set<Int> = []
    ) -> Bool {
        guard currentTime > 0.4, !isSeeking else { return false }
        guard currentTime - lastCaptureAt >= liveCaptureInterval else { return false }
        let span = placementDuration(known: knownDuration, currentTime: currentTime)
        let bucket = liveBucket(fraction: currentTime / max(span, 0.001))
        return !occupiedBuckets.contains(bucket)
    }

    /// MobileVLCKit raises NSException when the decoder has no frame (seek / AirPlay / start).
    static func canTakeVLCSnapshot(hasVideoSize: Bool, isSeeking: Bool, force: Bool) -> Bool {
        guard hasVideoSize else { return false }
        if isSeeking, !force { return false }
        return true
    }
}

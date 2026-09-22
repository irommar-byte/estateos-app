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

    /// Place live snapshots even when VLC has not published a feature length.
    static func placementDuration(known: Double, currentTime: Double) -> Double {
        if known > 1 { return known }
        return max(currentTime + 24, 90)
    }

    static func shouldCaptureLiveFrame(
        currentTime: Double,
        lastCaptureAt: Double,
        isSeeking: Bool
    ) -> Bool {
        guard currentTime > 0.4, !isSeeking else { return false }
        return currentTime - lastCaptureAt >= 1.2
    }
}

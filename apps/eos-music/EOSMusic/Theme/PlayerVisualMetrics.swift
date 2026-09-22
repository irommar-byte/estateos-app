import CoreGraphics
import Foundation

/// Canonical Now Playing metrics — Apple Music skeleton + EOS lamps.
/// Keep these as literals so XCTest can lock the grid without booting UI.
enum PlayerVisualMetrics {
    static let grid: CGFloat = 8
    static let contentInset: CGFloat = 20
    static let heroCornerRadius: CGFloat = 13
    static let heartHit: CGFloat = 44
    static let accessoryHit: CGFloat = 44
    static let landscapeIslandInset: CGFloat = 48
    static let landscapeLampGap: CGFloat = 18
    static let landscapeBankWidth: CGFloat = 52
    static let vinylSecondsPerRevolution: Double = 18
    static let beatWindow: TimeInterval = 0.075
    static let rytmWindow: TimeInterval = 0.090
    static let bassWindow: TimeInterval = 0.100
    static let hiWindow: TimeInterval = 0.065
    static let clipWindow: TimeInterval = 0.16
    static let strobeWindowMin: TimeInterval = 0.035
    static let strobeWindowMax: TimeInterval = 0.045
    static let analyzerFPSMin: Double = 12
    static let analyzerFPSMax: Double = 16
    static let sheetArmDelay: TimeInterval = 0.32

    static func landscapeSideInset(safeLeading: CGFloat, safeTrailing: CGFloat) -> CGFloat {
        max(safeLeading, safeTrailing, landscapeIslandInset)
    }

    static func landscapeDiscSize(canvas: CGSize, bankWidth: CGFloat = landscapeBankWidth) -> CGFloat {
        let inset = landscapeIslandInset
        let usableWidth = canvas.width - (inset * 2) - (bankWidth * 2) - (landscapeLampGap * 2)
        let byHeight = min(canvas.width, canvas.height) * 0.86
        return min(max(120, usableWidth), byHeight)
    }

    static func heroSide(
        width: CGFloat,
        availableHeight: CGFloat,
        showsMixer: Bool,
        isPad: Bool
    ) -> CGFloat {
        if showsMixer {
            return min(isPad ? 132 : 96, max(56, availableHeight * 0.16))
        }
        let reserved: CGFloat = isPad ? 260 : 288
        let leftover = max(160, availableHeight - reserved)
        return min(max(0, width - 40), leftover * 0.90, leftover)
    }

    static func strobeWindow(speed: Double) -> TimeInterval {
        let clamped = min(1, max(0, speed))
        return strobeWindowMax - (strobeWindowMax - strobeWindowMin) * clamped
    }

    static func analyzerFPS(preferred: Double) -> Double {
        guard preferred > 0.5 else { return analyzerFPSMin }
        return min(analyzerFPSMax, max(analyzerFPSMin, preferred))
    }
}

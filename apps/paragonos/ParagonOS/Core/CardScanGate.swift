import CoreGraphics
import Foundation

enum CardScanGate {
    struct Observation: Equatable {
        var hasBrand: Bool
        var hasCode: Bool
        var isSecondSide: Bool
        var hasNewCode: Bool
        var hasNewBrand: Bool
        var coverage: CGFloat
        var spreadX: CGFloat
        var spreadY: CGFloat
        var boxCount: Int
    }

    static func fillsFrame(
        coverage: CGFloat,
        spreadX: CGFloat,
        spreadY: CGFloat,
        boxCount: Int
    ) -> Bool {
        if coverage >= 0.32, spreadX >= 0.48, spreadY >= 0.38 {
            return true
        }
        if boxCount >= 2, spreadX >= 0.55, spreadY >= 0.40 {
            return true
        }
        return false
    }

    static func hasCardData(hasBrand: Bool, hasCode: Bool) -> Bool {
        hasBrand || hasCode
    }

    static func isReady(_ observation: Observation) -> Bool {
        guard fillsFrame(
            coverage: observation.coverage,
            spreadX: observation.spreadX,
            spreadY: observation.spreadY,
            boxCount: observation.boxCount
        ) else { return false }
        if observation.isSecondSide {
            return hasCardData(hasBrand: observation.hasBrand, hasCode: observation.hasCode)
                || observation.hasNewCode
                || observation.hasNewBrand
        }
        return hasCardData(hasBrand: observation.hasBrand, hasCode: observation.hasCode)
    }

    static func metrics(boxes: [CGRect], roi: CGRect) -> (coverage: CGFloat, spreadX: CGFloat, spreadY: CGFloat) {
        guard roi.width > 1, roi.height > 1, boxes.isEmpty == false else {
            return (0, 0, 0)
        }
        var union: CGRect?
        for box in boxes {
            let clipped = box.intersection(roi)
            guard clipped.isNull == false, clipped.width > 1, clipped.height > 1 else { continue }
            if let current = union {
                union = current.union(clipped)
            } else {
                union = clipped
            }
        }
        guard let union else { return (0, 0, 0) }
        let coverage = min(CGFloat(1), (union.width * union.height) / (roi.width * roi.height))
        let spreadX = min(CGFloat(1), union.width / roi.width)
        let spreadY = min(CGFloat(1), union.height / roi.height)
        return (coverage, spreadX, spreadY)
    }
}

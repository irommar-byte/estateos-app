import SwiftUI

/// Master timing constants — 1:1 with iOS `AppleSplashScreen.tsx` `T.*`.
enum SplashAnimationTimeline {
    static let logoStartMs: Double = 120
    static let logoLightMs: Double = 2600
    static let gapLogoToLine1Ms: Double = 0
    static let lineGapAfter1Ms: Double = 72
    static let sunGapAfter2Ms: Double = 56
    static let sunDurationMs: Double = 2750
    static let flyOutGapAfterSunMs: Double = 0
    static let flyOutMs: Double = 380
    static let doorDurationMs: Double = 1180
    static let doorSoundLeadMs: Double = 26

    static let line1StartAdvanceMs: Double = 2000
    static let flyOutEarlierMs: Double = 1200
    static let staggerMs: Double = 30

    static let breatheStartMs: Double = 2400
    static let bootstrapCapMs: Double = 8000
    static let catalogReadyCapMs: Double = 20000
    static let doorSoundVolume: Float = 0.24

    static let line1 = "TWÓJ OSOBISTY RADAR"
    static let taglines = [
        "Odkrywaj nieruchomości zanim zrobią to inni.",
        "Widzisz więcej. Decydujesz szybciej.",
        "Pierwszy widzisz. Pierwszy działasz.",
    ]
    static let taglineKey = "EstateOS_splash_tagline_slot"

    static let gold = Color(red: 212 / 255, green: 175 / 255, blue: 55 / 255)
    static let particleCountLegacy = 55
    static let particleCountHD = 75
    static let particleCountMax = 80

    /// Adaptive particle count — more on Apple TV 4K, fewer on older hardware.
    static func adaptiveParticleCount(screenHeight: CGFloat = 1080) -> Int {
        if screenHeight >= 2160 { return particleCountMax }
        if screenHeight >= 1080 { return particleCountHD }
        return particleCountLegacy
    }
    static let warmParticleRatio = 0.32

    static func seconds(_ ms: Double) -> Double { ms / 1000 }

    static func line1StartMs() -> Double {
        max(logoStartMs, logoStartMs + logoLightMs + gapLogoToLine1Ms - line1StartAdvanceMs)
    }

    static func line1DurationMs() -> Double {
        max(220, Double(line1.count) * staggerMs + 100)
    }

    static func line2StartMs(taglineLength: Int) -> Double {
        line1StartMs() + Double(line1.count) * staggerMs + lineGapAfter1Ms
    }

    static func line2DurationMs(taglineLength: Int) -> Double {
        max(220, Double(taglineLength) * staggerMs + 100)
    }

    static func sunStartMs(taglineLength: Int) -> Double {
        line2StartMs(taglineLength: taglineLength)
            + Double(taglineLength) * staggerMs
            + sunGapAfter2Ms
    }

    static func flyOutStartMs(taglineLength: Int) -> Double {
        max(0, sunStartMs(taglineLength: taglineLength) + sunDurationMs + flyOutGapAfterSunMs - flyOutEarlierMs)
    }

    static func doorOpenAtMs(taglineLength: Int) -> Double {
        flyOutStartMs(taglineLength: taglineLength) + flyOutMs
    }

    static func totalAnimationMs(taglineLength: Int) -> Double {
        doorOpenAtMs(taglineLength: taglineLength) + doorDurationMs
    }

    static func loadTaglineBoot() -> (text: String, nextSlot: Int) {
        let defaults = UserDefaults.standard
        let slot = defaults.integer(forKey: taglineKey)
        let idx = abs(slot) % taglines.count
        let next = (idx + 1) % taglines.count
        return (taglines[idx], next)
    }

    static func persistNextTaglineSlot(_ slot: Int) {
        UserDefaults.standard.set(slot, forKey: taglineKey)
    }
}

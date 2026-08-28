import Foundation

/// Debug-only launch timing metrics for cold-start tuning.
enum TvLaunchMetrics {
    private static let splashKey = "tvos.metrics.splashDuration"
    private static let bootstrapKey = "tvos.metrics.bootstrapDuration"
    private static let heroFocusKey = "tvos.metrics.heroFocusDuration"

    static var appLaunchTime: Date?

    static func markAppLaunch() {
        appLaunchTime = Date()
    }

    static func recordSplashEnd() {
        guard let start = appLaunchTime else { return }
        let ms = Date().timeIntervalSince(start) * 1000
        #if DEBUG
        UserDefaults.standard.set(ms, forKey: splashKey)
        print("[TvLaunchMetrics] splashDuration: \(Int(ms))ms")
        if ms > 6000 { print("[TvLaunchMetrics] WARN: splash > 6s") }
        #endif
    }

    static func recordBootstrapEnd() {
        guard let start = appLaunchTime else { return }
        let ms = Date().timeIntervalSince(start) * 1000
        #if DEBUG
        UserDefaults.standard.set(ms, forKey: bootstrapKey)
        print("[TvLaunchMetrics] bootstrapDuration: \(Int(ms))ms")
        #endif
    }

    static func recordHeroFocus() {
        guard let start = appLaunchTime else { return }
        let ms = Date().timeIntervalSince(start) * 1000
        #if DEBUG
        UserDefaults.standard.set(ms, forKey: heroFocusKey)
        print("[TvLaunchMetrics] timeToHeroFocus: \(Int(ms))ms")
        if ms > 6000 { print("[TvLaunchMetrics] WARN: hero focus > 6s") }
        #endif
    }

    static func recordExtendedHold() {
        #if DEBUG
        print("[TvLaunchMetrics] WARN: LivingHoldView activated (bootstrap > 8s cap)")
        #endif
    }
}

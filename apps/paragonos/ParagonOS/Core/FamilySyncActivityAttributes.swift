import ActivityKit
import Foundation

struct FamilySyncActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var phase: String
        var title: String
        var progress: Double

        static func running(_ title: String = "Wysyłanie", progress: Double = 0.12) -> Self {
            .init(phase: "running", title: title, progress: FamilyRingProgress.clamped(progress))
        }

        static func success(_ title: String = "Aktualne") -> Self {
            .init(phase: "success", title: title, progress: 1)
        }

        static func failure(_ title: String = "Spróbuj") -> Self {
            .init(phase: "failure", title: title, progress: 1)
        }

        var isRunning: Bool { phase == "running" }
        var isSuccess: Bool { phase == "success" }
        var isFailure: Bool { phase == "failure" }
        var symbolName: String {
            if isSuccess { return "checkmark" }
            if isFailure { return "exclamationmark" }
            return "icloud.fill"
        }
    }

    var topic: String
}

/// Progress carried from the app process to the Live Activity. It is calculated
/// from completed family-sync units rather than elapsed time, so the ring never
/// claims a percentage that has not actually been completed.
enum FamilyRingProgress {
    static func clamped(_ value: Double) -> Double {
        min(max(value, 0), 1)
    }
}

enum FamilySyncLiveActivityPolicy {
    static func prefersSystemIsland(
        isPhone: Bool,
        activitiesEnabled: Bool,
        hasDynamicIsland: Bool
    ) -> Bool {
        isPhone && activitiesEnabled && hasDynamicIsland
    }
}

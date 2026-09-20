import ActivityKit
import Foundation

@MainActor
final class ShazamLiveActivityController {
    static let shared = ShazamLiveActivityController()

    private var activity: Activity<ShazamActivityAttributes>?

    var hasActiveActivity: Bool {
        activity != nil || !Activity<ShazamActivityAttributes>.activities.isEmpty
    }

    func start(operationId: String) -> Bool {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
        endExisting()
        let state = ShazamActivityAttributes.ContentState(
            phase: .preparingActivity,
            message: "Słucham…",
            title: "",
            artist: "",
            startedAt: Date(),
            artworkURL: ""
        )
        do {
            activity = try Activity.request(
                attributes: ShazamActivityAttributes(operationId: operationId),
                content: ActivityContent(state: state, staleDate: Date().addingTimeInterval(45))
            )
            EOSLog.liveActivity.info("shazam activity started op=\(operationId, privacy: .public)")
            return activity != nil
        } catch {
            EOSLog.liveActivity.error("shazam activity failed \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    func update(phase: EOSShazamPhase, message: String, title: String = "", artist: String = "", artworkURL: String = "") {
        guard let activity else { return }
        let state = ShazamActivityAttributes.ContentState(
            phase: phase,
            message: message,
            title: title,
            artist: artist,
            startedAt: activity.content.state.startedAt,
            artworkURL: artworkURL
        )
        Task {
            await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(45)))
        }
    }

    func finish(phase: EOSShazamPhase, message: String, title: String = "", artist: String = "") {
        guard let activity else { return }
        self.activity = nil
        let state = ShazamActivityAttributes.ContentState(
            phase: phase,
            message: message,
            title: title,
            artist: artist,
            startedAt: activity.content.state.startedAt,
            artworkURL: activity.content.state.artworkURL
        )
        let alert = AlertConfiguration(
            title: LocalizedStringResource(stringLiteral: "EOS Music"),
            body: LocalizedStringResource(stringLiteral: message),
            sound: .default
        )
        Task {
            await activity.end(
                ActivityContent(state: state, staleDate: nil),
                dismissalPolicy: .after(Date().addingTimeInterval(16))
            )
            _ = alert
        }
    }

    func endExisting() {
        let current = activity
        activity = nil
        for item in Activity<ShazamActivityAttributes>.activities {
            Task { await item.end(nil, dismissalPolicy: .immediate) }
        }
        _ = current
    }
}

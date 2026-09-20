import ActivityKit
import Foundation

actor DownloadActivityPublishPipeline {
    private var generation = 0

    func nextGeneration() -> Int {
        generation += 1
        return generation
    }

    func currentGeneration() -> Int { generation }

    func invalidate() {
        generation += 1
    }
}

@MainActor
final class DownloadLiveActivityController {
    static let shared = DownloadLiveActivityController()

    private var activity: Activity<DownloadAttributes>?
    private var samples: [(at: Date, progress: Double)] = []
    private var lastPublishedPercent = -1
    private var lastPublishAt = Date.distantPast
    private var lastRevision = -1
    private var lastProgress = 0.0
    private var heldMinutes: Int?
    private var musicActive = false
    private var movieActive = false
    private var currentBatchId = ""
    private var tokenTask: Task<Void, Never>?
    private let pipeline = DownloadActivityPublishPipeline()

    func publishMusic(
        itemProgress: Double,
        overallProgress: Double,
        completed: Int,
        total: Int,
        phase: String,
        title: String,
        currentItems: [DownloadAttributes.CurrentItem] = [],
        remainingCount: Int = 0,
        serverETA: Double? = nil,
        batchId: String = "",
        revision: Int = 0
    ) {
        musicActive = total > 0 && overallProgress < 0.999 && phase != "Anulowanie"
        currentBatchId = batchId
        publish(
            itemProgress: itemProgress,
            overallProgress: overallProgress,
            completed: completed,
            total: total,
            phase: phase,
            title: title,
            currentItems: currentItems,
            remainingCount: remainingCount,
            serverETA: serverETA,
            batchId: batchId,
            revision: revision,
            finished: !musicActive && !movieActive
        )
    }

    func publishMovie(
        itemProgress: Double,
        overallProgress: Double,
        completed: Int,
        total: Int,
        phase: String,
        title: String
    ) {
        movieActive = total > 0 && overallProgress < 0.999
        if musicActive { return }
        publish(
            itemProgress: itemProgress,
            overallProgress: overallProgress,
            completed: completed,
            total: total,
            phase: phase,
            title: title,
            currentItems: [
                DownloadAttributes.CurrentItem(title: title, progress: min(1, max(0, itemProgress)))
            ],
            remainingCount: max(0, total - completed),
            serverETA: nil,
            batchId: "",
            revision: max(1, lastRevision + 1),
            finished: !movieActive
        )
    }

    func endMusic() {
        musicActive = false
        if !movieActive { endNow() }
    }

    func endMovie() {
        movieActive = false
        if !musicActive { endNow() }
    }

    private func publish(
        itemProgress: Double,
        overallProgress: Double,
        completed: Int,
        total: Int,
        phase: String,
        title: String,
        currentItems: [DownloadAttributes.CurrentItem],
        remainingCount: Int,
        serverETA: Double?,
        batchId: String,
        revision: Int,
        finished: Bool
    ) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        adoptExisting()
        guard DownloadQueueRevision.accept(
            current: lastRevision,
            incoming: revision,
            incomingProgress: overallProgress,
            currentProgress: lastProgress
        ) || lastRevision < 0 || finished else {
            return
        }

        let overall = min(1, max(0, overallProgress))
        let item = min(1, max(0, itemProgress))
        let percent = Int((overall * 100).rounded())
        let eta = resolveETA(overall: overall, remainingCount: remainingCount, serverETA: serverETA)
        let estimatedEnd = eta.map { Date().addingTimeInterval($0) }
        let items = Array(currentItems.prefix(2))
        let state = DownloadAttributes.ContentState(
            itemProgress: item,
            overallProgress: overall,
            completed: completed,
            total: max(total, 1),
            phase: phase,
            title: title,
            secondsRemaining: eta,
            isFinished: finished,
            currentItems: items,
            batchId: batchId,
            revision: revision,
            updatedAt: Date(),
            estimatedEndDate: estimatedEnd
        )
        let stale = Date().addingTimeInterval(40)
        let content = ActivityContent(state: state, staleDate: stale)

        if finished {
            endNow(final: state)
            return
        }

        lastRevision = revision
        lastProgress = overall

        if let activity {
            let now = Date()
            let shouldPush =
                percent != lastPublishedPercent
                || abs(activity.content.state.itemProgress - item) >= 0.009
                || activity.content.state.completed != completed
                || activity.content.state.title != title
                || now.timeIntervalSince(lastPublishAt) >= 4
            guard shouldPush else { return }
            lastPublishedPercent = percent
            lastPublishAt = now
            Task {
                let generation = await pipeline.nextGeneration()
                await activity.update(content)
                _ = generation
            }
            return
        }

        do {
            lastPublishedPercent = percent
            lastPublishAt = Date()
            if #available(iOS 16.2, *) {
                activity = try Activity.request(
                    attributes: DownloadAttributes(totalCount: max(total, 1)),
                    content: content,
                    pushType: .token
                )
            } else {
                activity = try Activity.request(
                    attributes: DownloadAttributes(totalCount: max(total, 1)),
                    content: content
                )
            }
            observePushToken()
        } catch {
            adoptExisting()
            if let activity {
                lastPublishedPercent = percent
                Task { await activity.update(content) }
            }
        }
    }

    private func observePushToken() {
        tokenTask?.cancel()
        guard let activity else { return }
        let batchId = currentBatchId
        tokenTask = Task {
            for await tokenData in activity.pushTokenUpdates {
                let token = tokenData.map { String(format: "%02x", $0) }.joined()
                let frequent = Self.allowsFrequentPushes()
                await MainActor.run {
                    NotificationCenter.default.post(
                        name: .eosLiveActivityPushToken,
                        object: nil,
                        userInfo: [
                            "token": token,
                            "batchId": batchId,
                            "activityId": activity.id,
                            "frequentPushesEnabled": frequent
                        ]
                    )
                }
            }
        }
    }

    private func adoptExisting() {
        let all = Activity<DownloadAttributes>.activities
        guard !all.isEmpty else { return }
        if let current = activity, all.contains(where: { $0.id == current.id }) {
            for extra in all where extra.id != current.id {
                Task { await extra.end(nil, dismissalPolicy: .immediate) }
            }
            return
        }
        activity = all.first
        for extra in all.dropFirst() {
            Task { await extra.end(nil, dismissalPolicy: .immediate) }
        }
        observePushToken()
    }

    private func endNow(final: DownloadAttributes.ContentState? = nil) {
        tokenTask?.cancel()
        tokenTask = nil
        Task { await pipeline.invalidate() }
        samples.removeAll()
        lastPublishedPercent = -1
        lastRevision = -1
        lastProgress = 0
        heldMinutes = nil
        let extras = Activity<DownloadAttributes>.activities.filter { $0.id != activity?.id }
        let activityId = activity?.id
        guard let activity else {
            for extra in extras {
                Task { await extra.end(nil, dismissalPolicy: .immediate) }
            }
            return
        }
        self.activity = nil
        if let activityId {
            NotificationCenter.default.post(
                name: .eosLiveActivityEnded,
                object: nil,
                userInfo: ["activityId": activityId, "batchId": currentBatchId]
            )
        }
        let state = final ?? DownloadAttributes.ContentState(
            itemProgress: 1,
            overallProgress: 1,
            completed: 1,
            total: 1,
            phase: "Na iPhonie",
            title: "Zakończono",
            secondsRemaining: 0,
            isFinished: true,
            currentItems: [],
            batchId: currentBatchId,
            revision: max(1, lastRevision),
            updatedAt: Date(),
            estimatedEndDate: nil
        )
        Task {
            await activity.end(
                ActivityContent(state: state, staleDate: nil),
                dismissalPolicy: .after(Date().addingTimeInterval(20))
            )
            for extra in extras {
                await extra.end(nil, dismissalPolicy: .immediate)
            }
        }
        currentBatchId = ""
    }

    private func resolveETA(overall: Double, remainingCount: Int, serverETA: Double?) -> Double? {
        let now = Date()
        samples.append((now, overall))
        samples.removeAll { now.timeIntervalSince($0.at) > 45 }

        var raw: Double?
        if let serverETA, serverETA.isFinite, serverETA > 0, serverETA < 36 * 3600 {
            raw = serverETA
        } else if samples.count >= 3 {
            let first = samples[0]
            let last = samples[samples.count - 1]
            let dt = last.at.timeIntervalSince(first.at)
            let dp = last.progress - first.progress
            if dt >= 2.5, dp > 0.002 {
                let remaining = (1 - last.progress) / (dp / dt)
                if remaining.isFinite, remaining > 0, remaining < 36 * 3600 {
                    raw = remaining
                }
            }
        }
        if raw == nil {
            raw = Double(max(1, remainingCount)) * 25
        }

        let minutes = max(1, Int(((raw ?? 60) / 60.0).rounded()))
        if let held = heldMinutes {
            if abs(minutes - held) >= 1 {
                heldMinutes = minutes
            }
        } else {
            heldMinutes = minutes
        }
        return Double(heldMinutes ?? minutes) * 60
    }
}

extension Notification.Name {
    static let eosLiveActivityPushToken = Notification.Name("eosmusic.liveactivity.pushToken")
    static let eosLiveActivityEnded = Notification.Name("eosmusic.liveactivity.ended")
}

extension DownloadLiveActivityController {
    static func allowsFrequentPushes() -> Bool {
        ActivityAuthorizationInfo().areActivitiesEnabled
    }
}

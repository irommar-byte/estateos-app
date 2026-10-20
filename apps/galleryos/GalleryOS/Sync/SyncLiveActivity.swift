import ActivityKit
import Foundation

@MainActor
final class SyncLiveActivity {
    static let shared = SyncLiveActivity()
    private var activity: Activity<SyncActivityAttributes>?
    private var endTask: Task<Void, Never>?
    private var greatestDone = 0
    private var stableTotal = 0
    private var publishedLine = ""
    private var publishedDone = -1
    private var publishedAt = Date.distantPast

    func update(done: Int, total: Int, bytesSent: Int64, bytesLeft: Int64, place: String) {
        stableTotal = max(stableTotal, total, 1)
        greatestDone = min(max(greatestDone, done), stableTotal)
        let line = TransferText.summary(
            done: greatestDone,
            total: stableTotal,
            bytesLeft: bytesLeft
        )
        guard line != publishedLine || activity == nil else { return }
        // Byte counts change every tick; iOS budgets Live Activity updates, so only a new
        // photo count goes out immediately.
        if activity != nil, greatestDone == publishedDone, Date().timeIntervalSince(publishedAt) < 1.5 { return }
        publishedLine = line
        publishedDone = greatestDone
        publishedAt = .now
        let percent = Int((Double(greatestDone) / Double(stableTotal) * 100).rounded())
        let state = SyncActivityAttributes.ContentState(
            done: greatestDone,
            total: stableTotal,
            percent: percent,
            bytesSent: max(bytesSent, 0),
            bytesLeft: bytesLeft,
            place: place,
            finished: false
        )
        let next = Task { [chain] in
            await chain?.value
            await self.apply(state, place: place)
        }
        chain = next
    }

    private var chain: Task<Void, Never>?

    private func apply(_ state: SyncActivityAttributes.ContentState, place: String) async {
        let content = ActivityContent(state: state, staleDate: nil)
        if let current = await singleActivity() {
            await current.update(content)
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        activity = try? Activity.request(
            attributes: SyncActivityAttributes(server: place),
            content: content,
            pushType: nil
        )
    }

    func collapseExtras() {
        Task { _ = await self.singleActivity() }
    }

    private func singleActivity() async -> Activity<SyncActivityAttributes>? {
        let running = Activity<SyncActivityAttributes>.activities
        let keeper = running.max { $0.content.state.done < $1.content.state.done } ?? activity
        for extra in running where extra.id != keeper?.id {
            await extra.end(nil, dismissalPolicy: .immediate)
        }
        activity = keeper
        return keeper
    }

    func finish(done: Int, total: Int, bytesSent: Int64, place: String) {
        stableTotal = max(stableTotal, total, 1)
        greatestDone = stableTotal
        let state = SyncActivityAttributes.ContentState(
            done: greatestDone,
            total: stableTotal,
            percent: 100,
            bytesSent: max(bytesSent, 0),
            bytesLeft: 0,
            place: place,
            finished: true
        )
        endTask?.cancel()
        endTask = Task { [weak self] in
            guard let current = await self?.singleActivity() else { return }
            await current.update(ActivityContent(state: state, staleDate: nil))
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            await self?.end()
        }
    }

    func end() async {
        endTask?.cancel()
        let running = Activity<SyncActivityAttributes>.activities
        let stored = activity
        activity = nil
        for item in running {
            await item.end(nil, dismissalPolicy: .immediate)
        }
        if let stored, !running.contains(where: { $0.id == stored.id }) {
            await stored.end(nil, dismissalPolicy: .immediate)
        }
        greatestDone = 0
        stableTotal = 0
        publishedLine = ""
    }
}

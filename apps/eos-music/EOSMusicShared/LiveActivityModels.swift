import ActivityKit
import Foundation

struct DownloadAttributes: ActivityAttributes {
    struct CurrentItem: Codable, Hashable {
        var title: String
        var progress: Double
    }

    public struct ContentState: Codable, Hashable {
        var itemProgress: Double
        var overallProgress: Double
        var completed: Int
        var total: Int
        var phase: String
        var title: String
        var secondsRemaining: Double?
        var isFinished: Bool
        var currentItems: [CurrentItem]
        var batchId: String
        var revision: Int
        var updatedAt: Date
        var estimatedEndDate: Date?

        var clampedOverall: Double { min(1, max(0, overallProgress)) }
        var clampedItem: Double { min(1, max(0, itemProgress)) }
        var percentInt: Int { Int((clampedOverall * 100).rounded()) }

        init(
            itemProgress: Double,
            overallProgress: Double,
            completed: Int,
            total: Int,
            phase: String,
            title: String,
            secondsRemaining: Double?,
            isFinished: Bool,
            currentItems: [CurrentItem] = [],
            batchId: String = "",
            revision: Int = 0,
            updatedAt: Date = Date(),
            estimatedEndDate: Date? = nil
        ) {
            self.itemProgress = itemProgress
            self.overallProgress = overallProgress
            self.completed = completed
            self.total = total
            self.phase = phase
            self.title = title
            self.secondsRemaining = secondsRemaining
            self.isFinished = isFinished
            self.currentItems = currentItems
            self.batchId = batchId
            self.revision = revision
            self.updatedAt = updatedAt
            self.estimatedEndDate = estimatedEndDate
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            itemProgress = try c.decodeIfPresent(Double.self, forKey: .itemProgress) ?? 0
            overallProgress = try c.decodeIfPresent(Double.self, forKey: .overallProgress) ?? 0
            completed = try c.decodeIfPresent(Int.self, forKey: .completed) ?? 0
            total = try c.decodeIfPresent(Int.self, forKey: .total) ?? 1
            phase = try c.decodeIfPresent(String.self, forKey: .phase) ?? "Na serwerze"
            title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
            secondsRemaining = try c.decodeIfPresent(Double.self, forKey: .secondsRemaining)
            isFinished = try c.decodeIfPresent(Bool.self, forKey: .isFinished) ?? false
            currentItems = try c.decodeIfPresent([CurrentItem].self, forKey: .currentItems) ?? []
            batchId = try c.decodeIfPresent(String.self, forKey: .batchId) ?? ""
            revision = try c.decodeIfPresent(Int.self, forKey: .revision) ?? 0
            updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt) ?? Date()
            estimatedEndDate = try c.decodeIfPresent(Date.self, forKey: .estimatedEndDate)
        }
    }

    var totalCount: Int
}

struct ShazamActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var phase: EOSShazamPhase
        var message: String
        var title: String
        var artist: String
        var startedAt: Date
        var artworkURL: String
    }

    var operationId: String
}

enum DownloadETAFormatter {
    static func compact(_ seconds: Double?) -> String? {
        guard let seconds, seconds.isFinite, seconds > 0, seconds < 36 * 3600 else { return nil }
        let total = Int(seconds.rounded())
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d", m, s)
    }

    static func expanded(_ seconds: Double?) -> String {
        guard let seconds, seconds.isFinite, seconds > 0, seconds < 36 * 3600 else {
            return "—"
        }
        let total = Int(seconds.rounded())
        if total < 60 { return "jeszcze < 1 min" }
        let m = max(1, Int((Double(total) / 60.0).rounded()))
        if m < 60 { return "jeszcze ok. \(m) min" }
        let h = m / 60
        let rem = m % 60
        if rem == 0 { return "jeszcze ok. \(h) godz." }
        return "jeszcze ok. \(h) godz. \(rem) min"
    }
}

enum DownloadQueueRevision {
    static func accept(current: Int, incoming: Int, incomingProgress: Double, currentProgress: Double) -> Bool {
        if incoming > current { return true }
        if incoming < current { return false }
        return incomingProgress + 0.0001 >= currentProgress
    }
}

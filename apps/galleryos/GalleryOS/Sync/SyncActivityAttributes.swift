import ActivityKit
import Foundation

struct SyncActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var done: Int
        var total: Int
        var percent: Int
        var bytesSent: Int64
        var bytesLeft: Int64
        var place: String
        var finished: Bool
    }

    var server: String
}

enum TransferText {
    static func groupedPublic(_ value: Int) -> String { grouped(value) }

    static func summary(done: Int, total: Int, bytesLeft: Int64) -> String {
        let totalSafe = max(total, 1)
        let doneSafe = min(max(done, 0), totalSafe)
        let percent = Int((Double(doneSafe) / Double(totalSafe) * 100).rounded())
        let photos = L("zostało \(grouped(totalSafe - doneSafe)) z \(grouped(totalSafe))")
        guard bytesLeft >= 0 else { return "\(percent)% · \(photos)" }
        return "\(percent)% · \(photos) · \(ByteText.amount(bytesLeft))"
    }

    private static func grouped(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Localization.locale
        if !Localization.isEnglish { formatter.groupingSeparator = " " }
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}

enum ByteText {
    static func amount(_ bytes: Int64) -> String {
        if bytes <= 0 { return "0 MB" }
        let value = Double(bytes)
        if value >= 1_073_741_824 {
            return String(format: "%.1f GB", value / 1_073_741_824)
        }
        if value >= 1_048_576 {
            return String(format: "%.0f MB", value / 1_048_576)
        }
        return String(format: "%.0f KB", value / 1024)
    }
}

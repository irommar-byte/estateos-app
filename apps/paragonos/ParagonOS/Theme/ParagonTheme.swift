import SwiftUI

enum ParagonTheme {
    static let osGreen = Color(red: 0.486, green: 1.0, blue: 0.227)

    static func statusColor(_ status: TicketLifecycleStatus) -> Color {
        switch status {
        case .active: return osGreen
        case .redeemed: return .secondary
        case .expired: return .red
        }
    }
}

enum MoneyFormat {
    static let pln: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "PLN"
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter
    }()

    static func string(_ amount: Double) -> String {
        pln.string(from: NSNumber(value: amount)) ?? String(format: "%.2f zł", amount)
    }
}

enum PolishDates {
    static let display: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    static let displayDateTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    static func relativeExpiry(_ date: Date, now: Date = .now) -> String {
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: now), to: Calendar.current.startOfDay(for: date)).day ?? 0
        if days < 0 { return "przeterminowany" }
        if days == 0 { return "wygasa dzisiaj" }
        if days == 1 { return "wygasa jutro" }
        return "za \(days) dni"
    }

    static func kwitekCount(_ count: Int) -> String {
        polishCount(count, one: "kwitek", few: "kwitki", many: "kwitków")
    }

    static func receiptCount(_ count: Int) -> String {
        polishCount(count, one: "paragon", few: "paragony", many: "paragonów")
    }

    static func daysUntil(_ date: Date, now: Date = .now) -> Int {
        Calendar.current.dateComponents(
            [.day],
            from: Calendar.current.startOfDay(for: now),
            to: Calendar.current.startOfDay(for: date)
        ).day ?? 0
    }

    static func relativeDeadline(_ date: Date, now: Date = .now) -> String {
        let days = daysUntil(date, now: now)
        if days < 0 { return "minął" }
        if days == 0 { return "dzisiaj" }
        if days == 1 { return "jutro" }
        return "za \(days) dni"
    }

    static func monthTitle(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.setLocalizedDateFormatFromTemplate("LLLL yyyy")
        return formatter.string(from: date)
    }

    static func monthName(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.setLocalizedDateFormatFromTemplate("LLLL")
        return formatter.string(from: date)
    }

    static func shortMonth(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.setLocalizedDateFormatFromTemplate("LLL")
        return formatter.string(from: date)
    }

    private static func polishCount(_ count: Int, one: String, few: String, many: String) -> String {
        let abs = Swift.abs(count)
        let mod10 = abs % 10
        let mod100 = abs % 100
        if abs == 1 { return "1 \(one)" }
        if (2...4).contains(mod10), (12...14).contains(mod100) == false {
            return "\(count) \(few)"
        }
        return "\(count) \(many)"
    }
}

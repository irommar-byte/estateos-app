import SwiftUI
import UIKit

enum ParagonMark {
    static let fill = UIColor(red: 0.486, green: 1.0, blue: 0.227, alpha: 1)

    static func image(side: CGFloat) -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)
        return renderer.image { _ in
            draw(in: CGRect(x: 0, y: 0, width: side, height: side))
        }
    }

    static func png(size: CGFloat) -> Data? {
        image(side: size).pngData()
    }

    static func draw(in rect: CGRect) {
        let path = UIBezierPath(roundedRect: rect, cornerRadius: rect.height * 0.235)
        fill.setFill()
        path.fill()
        let mark = "P" as NSString
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: rect.height * 0.46, weight: .bold),
            .foregroundColor: UIColor(red: 0.07, green: 0.12, blue: 0.05, alpha: 1)
        ]
        let textSize = mark.size(withAttributes: attrs)
        mark.draw(
            at: CGPoint(
                x: rect.midX - textSize.width / 2,
                y: rect.midY - textSize.height / 2 - rect.height * 0.03
            ),
            withAttributes: attrs
        )
    }
}

enum ParagonTheme {
    static let osGreen = Color(red: 0.486, green: 1.0, blue: 0.227)
    static let markGreen = osGreen
    static let warranty = Color(red: 0.22, green: 0.42, blue: 0.78)
    static let returning = Color(red: 0.78, green: 0.30, blue: 0.38)

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

    static func cardCount(_ count: Int) -> String {
        polishCount(count, one: "karta", few: "karty", many: "kart")
    }

    static func warrantyCount(_ count: Int) -> String {
        polishCount(count, one: "gwarancja", few: "gwarancje", many: "gwarancji")
    }

    static func returnCount(_ count: Int) -> String {
        polishCount(count, one: "zwrot", few: "zwroty", many: "zwrotów")
    }

    static func warrantyRemaining(_ date: Date, now: Date = .now) -> String {
        let days = daysUntil(date, now: now)
        if days < 0 { return "minęła" }
        if days == 0 { return "kończy się dzisiaj" }
        let months = Calendar.current.dateComponents(
            [.month],
            from: Calendar.current.startOfDay(for: now),
            to: Calendar.current.startOfDay(for: date)
        ).month ?? 0
        if months >= 2 { return "jeszcze \(months) mies." }
        return relativeDeadline(date, now: now)
    }
}

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        let r, g, b: Double
        switch cleaned.count {
        case 3:
            r = Double((int >> 8) & 0xF) / 15
            g = Double((int >> 4) & 0xF) / 15
            b = Double(int & 0xF) / 15
        case 6, 8:
            r = Double((int >> 16) & 0xFF) / 255
            g = Double((int >> 8) & 0xFF) / 255
            b = Double(int & 0xFF) / 255
        default:
            r = 0.25
            g = 0.25
            b = 0.25
        }
        self.init(red: r, green: g, blue: b)
    }

    var relativeLuminance: Double {
        let rgb = hexRGB
        func channel(_ value: Double) -> Double {
            value <= 0.03928 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
    }

    var hexRGB: (r: Double, g: Double, b: Double) {
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a)
        return (Double(r), Double(g), Double(b))
    }

    func shaded(brightness: Double, saturation: Double = 1) -> Color {
        var h: CGFloat = 0
        var s: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        UIColor(self).getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return Color(
            hue: Double(h),
            saturation: min(1, max(0, Double(s) * saturation)),
            brightness: min(1, max(0, Double(b) * brightness)),
            opacity: Double(a)
        )
    }
}

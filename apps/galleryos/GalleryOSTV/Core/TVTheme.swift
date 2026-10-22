import SwiftUI

enum TVTheme {
    static let accent = Color(red: 0.29, green: 0.56, blue: 1.0)
    static let background = Color(red: 0.03, green: 0.035, blue: 0.05)
    static let surface = Color.white.opacity(0.08)
    static let tileCorner: CGFloat = 20
    static let margin: CGFloat = 80
    static let spacing: CGFloat = 28
    static let spring = Animation.spring(response: 0.42, dampingFraction: 0.86)
}

struct TVWordmark: View {
    var size: CGFloat = 44

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text("Gallery").font(.system(size: size, weight: .semibold, design: .rounded))
            Text("OS").font(.system(size: size, weight: .bold, design: .rounded)).foregroundStyle(TVTheme.accent)
            Text("™")
                .font(.system(size: size * 0.4, weight: .semibold, design: .rounded))
                .foregroundStyle(TVTheme.accent)
                .baselineOffset(size * 0.3)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("GalleryOS")
    }
}

/// Button style that keeps the system focus lift but draws nothing else.
struct TVBareButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
    }
}

enum TVFormat {
    private static func formatter(_ template: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Localization.locale
        formatter.setLocalizedDateFormatFromTemplate(template)
        return formatter
    }

    private static let dayFormatter = formatter("EEEE d MMMM yyyy")
    private static let timeFormatter = formatter("HH:mm")
    private static let monthFormatter = formatter("LLL yyyy")
    private static let relative: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Localization.locale
        formatter.unitsStyle = .full
        return formatter
    }()

    static func dayTitle(_ date: Date) -> String {
        dayFormatter.string(from: date)
    }

    static func time(_ date: Date) -> String {
        timeFormatter.string(from: date)
    }

    /// „mar 2024 – paź 2026”, or a single month when both ends match.
    static func span(_ first: Date, _ last: Date) -> String {
        let from = monthFormatter.string(from: min(first, last))
        let to = monthFormatter.string(from: max(first, last))
        return from == to ? from : "\(from) – \(to)"
    }

    static func coordinate(_ latitude: Double, _ longitude: Double) -> String {
        let ns = latitude >= 0 ? "N" : "S"
        let ew = longitude >= 0 ? "E" : "W"
        return String(format: "%.2f° %@, %.2f° %@", abs(latitude), ns, abs(longitude), ew)
    }

    static func bytes(_ value: Int) -> String {
        guard value > 0 else { return "" }
        return ByteCountFormatter.string(fromByteCount: Int64(value), countStyle: .file)
    }

    static func updated(_ date: Date?) -> String {
        guard let date else { return L("jeszcze nie") }
        if abs(date.timeIntervalSinceNow) < 45 { return L("przed chwilą") }
        return relative.localizedString(for: date, relativeTo: .now)
    }
}

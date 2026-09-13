import Foundation

enum OpeningHours {
    static func display(from raw: String, at date: Date = .now) -> (isOpen: Bool?, label: String) {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.isEmpty == false else { return (nil, "") }
        if trimmed == "24/7" || trimmed.lowercased().contains("24/7") {
            return (true, "Otwarte całą dobę")
        }
        guard let interval = interval(from: trimmed, on: date) else {
            return (nil, pretty(trimmed))
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.dateFormat = "HH:mm"
        if date >= interval.start, date < interval.end {
            return (true, "Otwarte · do \(formatter.string(from: interval.end))")
        }
        if date < interval.start {
            return (false, "Zamknięte · od \(formatter.string(from: interval.start))")
        }
        return (false, "Zamknięte")
    }

    static func pretty(_ raw: String) -> String {
        raw
            .replacingOccurrences(of: "Mo", with: "Pn")
            .replacingOccurrences(of: "Tu", with: "Wt")
            .replacingOccurrences(of: "We", with: "Śr")
            .replacingOccurrences(of: "Th", with: "Cz")
            .replacingOccurrences(of: "Fr", with: "Pt")
            .replacingOccurrences(of: "Sa", with: "So")
            .replacingOccurrences(of: "Su", with: "Nd")
            .replacingOccurrences(of: "mon-sun", with: "Pn–Nd", options: .caseInsensitive)
            .replacingOccurrences(of: ":00:00", with: ":00")
    }

    static func flatten(_ value: Any?) -> String {
        if let text = value as? String { return text.trimmingCharacters(in: .whitespacesAndNewlines) }
        if let dict = value as? [String: Any] {
            return dict.keys.sorted().compactMap { key in
                let inner = flatten(dict[key])
                guard inner.isEmpty == false else { return nil }
                return "\(key): \(inner)"
            }.joined(separator: "; ")
        }
        return ""
    }

    static func interval(from raw: String, on date: Date, calendar: Calendar = OpeningHours.warsaw) -> (start: Date, end: Date)? {
        let weekday = calendar.component(.weekday, from: date) // 1 Sunday
        let osmDay = osmSymbol(weekday: weekday)
        for chunk in raw.split(separator: ";") {
            let piece = chunk.trimmingCharacters(in: .whitespacesAndNewlines)
            guard piece.isEmpty == false, piece.lowercased().contains("off") == false else { continue }
            if piece.lowercased().hasPrefix("mon-sun") || piece.lowercased().hasPrefix("mo-su") {
                if let times = parseTimes(in: piece, on: date, calendar: calendar) { return times }
            }
            if matches(day: osmDay, rule: piece), let times = parseTimes(in: piece, on: date, calendar: calendar) {
                return times
            }
        }
        if let times = parseTimes(in: raw, on: date, calendar: calendar), raw.contains(":") {
            if raw.contains("Mo") == false && raw.contains("mon") == false {
                return times
            }
        }
        return nil
    }

    static let warsaw: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Warsaw") ?? .current
        calendar.locale = Locale(identifier: "pl_PL")
        return calendar
    }()

    private static func osmSymbol(weekday: Int) -> String {
        switch weekday {
        case 1: return "Su"
        case 2: return "Mo"
        case 3: return "Tu"
        case 4: return "We"
        case 5: return "Th"
        case 6: return "Fr"
        default: return "Sa"
        }
    }

    private static func matches(day: String, rule: String) -> Bool {
        let head = rule.split(separator: " ").first.map(String.init) ?? rule
        let days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
        if let range = head.range(of: "-"), head.count <= 5 {
            let from = String(head[head.startIndex..<range.lowerBound])
            let to = String(head[range.upperBound...])
            guard let start = days.firstIndex(of: from), let end = days.firstIndex(of: to),
                  let current = days.firstIndex(of: day) else { return false }
            if start <= end { return (start...end).contains(current) }
            return current >= start || current <= end
        }
        return head.contains(day)
    }

    private static func parseTimes(in rule: String, on date: Date, calendar: Calendar) -> (start: Date, end: Date)? {
        let pattern = #"(\d{1,2}):(\d{2})(?::\d{2})?\s*[-–]\s*(\d{1,2}):(\d{2})(?::\d{2})?"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: rule, range: NSRange(rule.startIndex..., in: rule)),
              match.numberOfRanges >= 5,
              let r1 = Range(match.range(at: 1), in: rule),
              let r2 = Range(match.range(at: 2), in: rule),
              let r3 = Range(match.range(at: 3), in: rule),
              let r4 = Range(match.range(at: 4), in: rule),
              let sh = Int(rule[r1]), let sm = Int(rule[r2]),
              let eh = Int(rule[r3]), let em = Int(rule[r4])
        else { return nil }
        let day = calendar.startOfDay(for: date)
        guard let start = calendar.date(byAdding: DateComponents(hour: sh, minute: sm), to: day),
              let end = calendar.date(byAdding: DateComponents(hour: eh, minute: em), to: day)
        else { return nil }
        return (start, end)
    }
}

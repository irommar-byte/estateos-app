import Charts
import SwiftUI

enum HistoryGrain: String, CaseIterable, Identifiable {
    case year
    case month
    case day

    var id: String { rawValue }

    var title: String {
        switch self {
        case .year: return "Lata"
        case .month: return "Miesiące"
        case .day: return "Dni"
        }
    }
}

struct HistorySpendPoint: Identifiable, Equatable {
    var id: String
    var label: String
    var total: Double
    var secondary: Double
}

enum HistorySpend {
    static func receiptPoints(
        _ receipts: [Receipt],
        grain: HistoryGrain,
        year: Int,
        month: Int,
        calendar: Calendar = .current
    ) -> [HistorySpendPoint] {
        points(
            dates: receipts.map { ($0.issuedAt, $0.amount, 0.0) },
            grain: grain,
            year: year,
            month: month,
            calendar: calendar
        )
    }

    static func depositPoints(
        _ tickets: [Ticket],
        grain: HistoryGrain,
        year: Int,
        month: Int,
        now: Date = .now,
        calendar: Calendar = .current
    ) -> [HistorySpendPoint] {
        let rows: [(Date, Double, Double)] = tickets.compactMap { ticket in
            let status = ticket.resolvedStatus(now: now)
            guard status == .redeemed || status == .expired else { return nil }
            let date = ticket.redeemedAt ?? ticket.expiresAt ?? ticket.issuedAt
            let recovered = status == .redeemed ? ticket.amount : 0
            let lost = status == .expired ? ticket.amount : 0
            return (date, recovered, lost)
        }
        return points(dates: rows, grain: grain, year: year, month: month, calendar: calendar)
    }

    static func years(from dates: [Date], calendar: Calendar = .current, now: Date = .now) -> [Int] {
        var set = Set(dates.map { calendar.component(.year, from: $0) })
        set.insert(calendar.component(.year, from: now))
        return set.sorted()
    }

    private static func points(
        dates: [(Date, Double, Double)],
        grain: HistoryGrain,
        year: Int,
        month: Int,
        calendar: Calendar
    ) -> [HistorySpendPoint] {
        switch grain {
        case .year:
            let grouped = Dictionary(grouping: dates) { calendar.component(.year, from: $0.0) }
            let years = grouped.keys.sorted()
            return years.map { value in
                let rows = grouped[value] ?? []
                return HistorySpendPoint(
                    id: "y-\(value)",
                    label: String(value),
                    total: rows.reduce(0) { $0 + $1.1 },
                    secondary: rows.reduce(0) { $0 + $1.2 }
                )
            }
        case .month:
            return (1...12).map { value in
                let rows = dates.filter {
                    calendar.component(.year, from: $0.0) == year
                        && calendar.component(.month, from: $0.0) == value
                }
                return HistorySpendPoint(
                    id: "m-\(year)-\(value)",
                    label: shortMonth(value, calendar: calendar),
                    total: rows.reduce(0) { $0 + $1.1 },
                    secondary: rows.reduce(0) { $0 + $1.2 }
                )
            }
        case .day:
            let dayCount = calendar.range(of: .day, in: .month, for: date(year: year, month: month, day: 1, calendar: calendar))?.count ?? 30
            return (1...dayCount).map { value in
                let rows = dates.filter {
                    calendar.component(.year, from: $0.0) == year
                        && calendar.component(.month, from: $0.0) == month
                        && calendar.component(.day, from: $0.0) == value
                }
                return HistorySpendPoint(
                    id: "d-\(year)-\(month)-\(value)",
                    label: "\(value)",
                    total: rows.reduce(0) { $0 + $1.1 },
                    secondary: rows.reduce(0) { $0 + $1.2 }
                )
            }
        }
    }

    private static func date(year: Int, month: Int, day: Int, calendar: Calendar) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day)) ?? Date()
    }

    private static func shortMonth(_ month: Int, calendar: Calendar) -> String {
        let date = date(year: 2026, month: month, day: 1, calendar: calendar)
        return PolishDates.shortMonth(date)
    }
}

struct CascadeSpendChart: View {
    var points: [HistorySpendPoint]
    var showsSecondary: Bool
    var primaryTitle: String
    var secondaryTitle: String
    var signature: String

    @State private var folded = true
    @State private var revealed = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Chart {
                ForEach(Array(points.enumerated()), id: \.element.id) { index, point in
                    let visible = index < revealed
                    BarMark(
                        x: .value("Okres", point.label),
                        y: .value(primaryTitle, visible ? point.total : 0),
                        stacking: .unstacked
                    )
                    .foregroundStyle(ParagonTheme.osGreen.gradient)
                    .cornerRadius(5)
                    .position(by: .value("Seria", primaryTitle))
                    if showsSecondary {
                        BarMark(
                            x: .value("Okres", point.label),
                            y: .value(secondaryTitle, visible ? point.secondary : 0),
                            stacking: .unstacked
                        )
                        .foregroundStyle(Color.red.opacity(0.72).gradient)
                        .cornerRadius(5)
                        .position(by: .value("Seria", secondaryTitle))
                    }
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading)
            }
            .chartLegend(showsSecondary ? .visible : .hidden)
            .frame(height: 196)
            .rotation3DEffect(
                .degrees(folded ? 82 : 0),
                axis: (x: 1, y: 0, z: 0),
                anchor: .top,
                perspective: 0.62
            )
            .scaleEffect(x: 1, y: folded ? 0.16 : 1, anchor: .top)
            .opacity(folded ? 0.18 : 1)
            .shadow(color: .black.opacity(folded ? 0 : 0.12), radius: folded ? 0 : 14, y: folded ? 0 : 8)
        }
        .padding(.vertical, 6)
        .onAppear { cascade(reset: true) }
        .onChange(of: signature) { _, _ in
            cascade(reset: true)
        }
    }

    private func cascade(reset: Bool) {
        if reset {
            folded = true
            revealed = 0
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 80_000_000)
            withAnimation(.spring(duration: 0.72, bounce: 0.16)) {
                folded = false
            }
            let count = points.count
            guard count > 0 else { return }
            let step = max(18_000_000, 320_000_000 / UInt64(count))
            for index in 0..<count {
                try? await Task.sleep(nanoseconds: step)
                withAnimation(.spring(duration: 0.38, bounce: 0.22)) {
                    revealed = index + 1
                }
            }
        }
    }
}

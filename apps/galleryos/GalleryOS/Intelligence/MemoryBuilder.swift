import CoreLocation
import Foundation

/// Stories made from the library: this day years ago, trips away from home, a person's best
/// moments and the best of a busy month. Each is a short, curated slideshow with music.
struct Memory: Identifiable, Hashable {
    enum Kind: String { case onThisDay, trip, person, month }

    let id: String
    let kind: Kind
    var title: String
    let subtitle: String
    /// Curated, in time order.
    let photos: [String]
    let cover: String
    let mood: MemoryMood
    let start: Date
    let end: Date
    var latitude: Double?
    var longitude: Double?
    /// Every photo of a trip, not only the curated ones.
    var all: [String] = []
}

enum MemoryMood: String, CaseIterable {
    case warm, dreamy, tender, nostalgic
}

/// Picks the stories: shared by iPhone, iPad and Apple TV (the TV passes no scores and relies
/// on favourites and time). Pure and thread-safe; call it off the main actor.
enum MemoryBuilder {
    struct Lite: Sendable {
        let aesthetic: Float
        let utility: Bool
        let faces: Int
    }

    static func build(
        photos: [PhotoRef], insights: [String: Lite], people: [(Int64, String, [String])]
    ) -> (memories: [Memory], trips: [Memory]) {
        let calendar = Calendar.current
        let now = Date()
        let usable = photos.filter { !$0.traits.isVideo && insights[$0.id]?.utility != true }
            .sorted { $0.created < $1.created }
        guard !usable.isEmpty else { return ([], []) }
        let byID = Dictionary(usable.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var memories: [Memory] = []

        func score(_ photo: PhotoRef) -> Float {
            let insight = insights[photo.id]
            return (insight?.aesthetic ?? 0) + (photo.isFavorite ? 1 : 0) + Float(min(insight?.faces ?? 0, 3)) * 0.08
        }
        func cover(_ ids: [String]) -> String {
            ids.compactMap { byID[$0] }.max { score($0) < score($1) }?.id ?? ids[0]
        }
        func curate(_ list: [PhotoRef], limit: Int = 32) -> [String] {
            // One frame per moment (30 s), the best of it; then spread over time.
            var moments: [[PhotoRef]] = []
            for photo in list {
                if let last = moments.last?.last, photo.created.timeIntervalSince(last.created) < 30 {
                    moments[moments.count - 1].append(photo)
                } else {
                    moments.append([photo])
                }
            }
            let picks = moments.map { moment in moment.max { score($0) < score($1) }! }
            guard picks.count > limit else { return picks.map(\.id) }
            let step = Double(picks.count) / Double(limit)
            return (0..<limit).map { index -> String in
                let slice = picks[Int(Double(index) * step)..<min(picks.count, Int(Double(index + 1) * step))]
                return (slice.max { score($0) < score($1) } ?? slice.first!).id
            }
        }
        let dateFormat = Date.FormatStyle().day().month(.wide).year().locale(Localization.locale)
        let monthFormat = Date.FormatStyle().month(.wide).year().locale(Localization.locale)

        // This day in earlier years.
        let today = calendar.dateComponents([.month, .day], from: now)
        var byYear: [Int: [PhotoRef]] = [:]
        for photo in usable {
            let parts = calendar.dateComponents([.year, .month, .day], from: photo.created)
            guard let year = parts.year, year < calendar.component(.year, from: now),
                  parts.month == today.month, let day = parts.day, let todayDay = today.day,
                  abs(day - todayDay) <= 1 else { continue }
            byYear[year, default: []].append(photo)
        }
        for (year, list) in byYear.sorted(by: { $0.key > $1.key }) where list.count >= 6 {
            let ids = curate(list, limit: 24)
            let ago = calendar.component(.year, from: now) - year
            memories.append(Memory(
                id: "day-\(year)", kind: .onThisDay, title: L("Ten dzień"),
                subtitle: Self.yearsAgo(ago, list[0].created.formatted(dateFormat)),
                photos: ids, cover: cover(ids), mood: .nostalgic,
                start: list.first!.created, end: list.last!.created
            ))
        }

        // Trips: days far from home, next to each other.
        let trips = findTrips(usable, calendar: calendar).compactMap { list -> Memory? in
            guard list.count >= 10, let first = list.first, let last = list.last else { return nil }
            let ids = curate(list)
            let located = list.filter(\.hasLocation)
            let latitude = located.map { $0.latitude! }.reduce(0, +) / Double(max(located.count, 1))
            let longitude = located.map { $0.longitude! }.reduce(0, +) / Double(max(located.count, 1))
            let month = calendar.component(.month, from: first.created)
            let span = calendar.isDate(first.created, inSameDayAs: last.created)
                ? first.created.formatted(dateFormat)
                : "\(first.created.formatted(.dateTime.day().month(.abbreviated).locale(Localization.locale))) – \(last.created.formatted(dateFormat))"
            return Memory(
                id: "trip-\(Int(first.created.timeIntervalSince1970))", kind: .trip, title: L("Podróż"),
                subtitle: span, photos: ids, cover: cover(ids),
                mood: (5...9).contains(month) ? .warm : .dreamy,
                start: first.created, end: last.created, latitude: latitude, longitude: longitude,
                all: list.map(\.id)
            )
        }.reversed()
        let tripList = Array(trips)
        memories.append(contentsOf: tripList.prefix(6))

        // People's best moments.
        for (id, name, ids) in people.prefix(4) {
            let list = ids.compactMap { byID[$0] }.sorted { $0.created < $1.created }
            guard list.count >= 24 else { continue }
            let chosen = curate(list, limit: 28)
            memories.append(Memory(
                id: "person-\(id)", kind: .person, title: name.isEmpty ? L("Bliska osoba") : name,
                subtitle: L("Najpiękniejsze chwile"), photos: chosen, cover: cover(chosen), mood: .tender,
                start: list.first!.created, end: list.last!.created
            ))
        }

        // Busy months of the last two years.
        let recent = usable.filter { $0.created > now.addingTimeInterval(-730 * 86_400) }
        var months: [String: [PhotoRef]] = [:]
        for photo in recent {
            let parts = calendar.dateComponents([.year, .month], from: photo.created)
            months[String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0), default: []].append(photo)
        }
        for (key, list) in months.sorted(by: { $0.value.count > $1.value.count }).prefix(4) where list.count >= 40 {
            let ids = curate(list, limit: 28)
            let title = list[0].created.formatted(monthFormat)
            memories.append(Memory(
                id: "month-\(key)", kind: .month, title: title.prefix(1).uppercased() + String(title.dropFirst()),
                subtitle: L("Najlepsze z miesiąca"), photos: ids, cover: cover(ids), mood: .dreamy,
                start: list.first!.created, end: list.last!.created
            ))
        }
        return (memories, tripList)
    }

    /// Home is where most located photos are; a trip is a run of days whose photos are over
    /// 100 km from it, allowing one quiet day in between.
    private static func yearsAgo(_ years: Int, _ date: String) -> String {
        if years == 1 { return L("Rok temu · \(date)") }
        return Plural.pick(years, L("\(years) rok temu · \(date)"), L("\(years) lata temu · \(date)"), L("\(years) lat temu · \(date)"))
    }

    static func findTrips(_ photos: [PhotoRef], calendar: Calendar) -> [[PhotoRef]] {
        let located = photos.filter(\.hasLocation)
        guard located.count >= 20 else { return [] }
        var cells: [String: Int] = [:]
        for photo in located {
            cells[String(format: "%.1f,%.1f", photo.latitude!, photo.longitude!), default: 0] += 1
        }
        guard let homeKey = cells.max(by: { $0.value < $1.value })?.key else { return [] }
        let homeParts = homeKey.split(separator: ",").compactMap { Double($0) }
        guard homeParts.count == 2 else { return [] }
        let home = CLLocation(latitude: homeParts[0], longitude: homeParts[1])

        var days: [Date: [PhotoRef]] = [:]
        for photo in photos { days[calendar.startOfDay(for: photo.created), default: []].append(photo) }
        let awayDays = days.filter { _, list in
            let points = list.filter(\.hasLocation)
            guard !points.isEmpty else { return false }
            let far = points.filter {
                CLLocation(latitude: $0.latitude!, longitude: $0.longitude!).distance(from: home) > 100_000
            }
            return Double(far.count) / Double(points.count) >= 0.6
        }.keys.sorted()

        var trips: [[Date]] = []
        for day in awayDays {
            if let last = trips.last?.last, let gap = calendar.dateComponents([.day], from: last, to: day).day, gap <= 2 {
                trips[trips.count - 1].append(day)
            } else {
                trips.append([day])
            }
        }
        return trips.map { span in span.flatMap { days[$0] ?? [] }.sorted { $0.created < $1.created } }
    }
}

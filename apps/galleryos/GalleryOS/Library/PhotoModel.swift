import CoreGraphics
import Foundation
import ImageIO
import SwiftUI
import UIKit

struct PhotoTraits: OptionSet, Hashable {
    let rawValue: Int

    static let live = PhotoTraits(rawValue: 1 << 0)
    static let video = PhotoTraits(rawValue: 1 << 1)
    static let screenshot = PhotoTraits(rawValue: 1 << 2)
    static let panorama = PhotoTraits(rawValue: 1 << 3)
    static let portrait = PhotoTraits(rawValue: 1 << 4)
    static let selfie = PhotoTraits(rawValue: 1 << 5)
    static let raw = PhotoTraits(rawValue: 1 << 6)
    static let animated = PhotoTraits(rawValue: 1 << 7)

    var isVideo: Bool { contains(.video) }
}

enum AnimatedCache {
    static let images = NSCache<NSString, UIImage>()
}

enum AnimatedFrames {
    static func image(data: Data, maxSide: CGFloat, maxFrames: Int) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let count = min(CGImageSourceGetCount(source), max(1, maxFrames))
        if count <= 1 { return UIImage(data: data) }
        var frames: [UIImage] = []
        var duration = 0.0
        let side = max(64, maxSide)
        let options: [CFString: Any] = [
            kCGImageSourceThumbnailMaxPixelSize: side,
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true
        ]
        for index in 0..<count {
            guard let cg = CGImageSourceCreateThumbnailAtIndex(source, index, options as CFDictionary) else { continue }
            frames.append(UIImage(cgImage: cg))
            duration += delay(source, index: index)
        }
        guard !frames.isEmpty else { return nil }
        return UIImage.animatedImage(with: frames, duration: max(duration, 0.4))
    }

    private static func delay(_ source: CGImageSource, index: Int) -> Double {
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
              let gif = properties[kCGImagePropertyGIFDictionary] as? [CFString: Any] else { return 0.08 }
        let unclamped = gif[kCGImagePropertyGIFUnclampedDelayTime] as? Double
        let clamped = gif[kCGImagePropertyGIFDelayTime] as? Double
        let value = unclamped ?? clamped ?? 0.08
        return value < 0.02 ? 0.08 : value
    }
}

struct PhotoRef: Identifiable, Hashable {
    let id: String
    var created: Date
    var pixelWidth: Int
    var pixelHeight: Int
    var traits: PhotoTraits
    var isFavorite: Bool
    var latitude: Double?
    var longitude: Double?
    var duration: TimeInterval
    var cloudHash: String? = nil

    var aspect: CGFloat {
        guard pixelWidth > 0, pixelHeight > 0 else { return 1 }
        return CGFloat(pixelWidth) / CGFloat(pixelHeight)
    }

    var hasLocation: Bool { latitude != nil && longitude != nil }
}

struct PhotoDay: Identifiable, Hashable {
    var id: String { key }
    let key: String
    let date: Date
    let title: String
    var latitude: Double?
    var longitude: Double?
    var photos: [PhotoRef]
}

struct PhotoMonth: Identifiable, Hashable {
    let id: String
    let date: Date
    let title: String
    let yearTitle: String
    let count: Int
    let coverID: String
}

struct PhotoYear: Identifiable, Hashable {
    let id: String
    let year: Int
    let title: String
    let count: Int
    let coverID: String
}

struct GridModel: Equatable {
    var days: [PhotoDay]
    var months: [PhotoMonth]
    var years: [PhotoYear]
    var all: [PhotoRef]

    static let empty = GridModel(days: [], months: [], years: [], all: [])

    init(days: [PhotoDay], months: [PhotoMonth], years: [PhotoYear], all: [PhotoRef]) {
        self.days = days
        self.months = months
        self.years = years
        self.all = all
    }

    init(photos: [PhotoRef], calendar: Calendar = .current, now: Date = .now) {
        let sorted = photos.sorted { lhs, rhs in
            if lhs.created != rhs.created { return lhs.created < rhs.created }
            return lhs.id < rhs.id
        }
        let days = PhotoGrouping.days(from: sorted, calendar: calendar, now: now)
        self.init(
            days: days,
            months: PhotoGrouping.months(from: days, calendar: calendar),
            years: PhotoGrouping.years(from: days, calendar: calendar),
            all: sorted
        )
    }

    func arranged(_ sort: LibrarySort) -> GridModel {
        GridModel(photos: all.sorted { sort.places($0, before: $1) })
    }
}

enum PhotoZoom: Int, CaseIterable, Identifiable {
    case years, months, days, all

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .years: return "Lata"
        case .months: return "Miesiące"
        case .days: return "Dni"
        case .all: return "Wszystkie zdjęcia"
        }
    }

    func zoomed(out: Bool) -> PhotoZoom? {
        let next = rawValue + (out ? 1 : -1)
        return PhotoZoom(rawValue: next)
    }
}

enum LibrarySort: String, CaseIterable, Identifiable {
    case oldest
    case newest
    case longest
    case favorites
    case videos
    case largest

    var id: String { rawValue }

    var title: String {
        switch self {
        case .oldest: return "Od najstarszych"
        case .newest: return "Od najnowszych"
        case .longest: return "Od najdłuższych"
        case .favorites: return "Ulubione na górze"
        case .videos: return "Najpierw filmy"
        case .largest: return "Największe kadry"
        }
    }

    func places(_ lhs: PhotoRef, before rhs: PhotoRef) -> Bool {
        switch self {
        case .oldest:
            if lhs.created != rhs.created { return lhs.created < rhs.created }
            return lhs.id < rhs.id
        case .newest:
            if lhs.created != rhs.created { return lhs.created > rhs.created }
            return lhs.id > rhs.id
        case .longest:
            if lhs.duration != rhs.duration { return lhs.duration > rhs.duration }
            return lhs.created > rhs.created
        case .favorites:
            if lhs.isFavorite != rhs.isFavorite { return lhs.isFavorite && !rhs.isFavorite }
            return lhs.created > rhs.created
        case .videos:
            let left = lhs.traits.contains(.video)
            let right = rhs.traits.contains(.video)
            if left != right { return left && !right }
            return lhs.created > rhs.created
        case .largest:
            let left = lhs.pixelWidth * lhs.pixelHeight
            let right = rhs.pixelWidth * rhs.pixelHeight
            if left != right { return left > right }
            return lhs.created > rhs.created
        }
    }
}

enum PhotoGrouping {
    static func days(from photos: [PhotoRef], calendar: Calendar = .current, now: Date = .now) -> [PhotoDay] {
        var buckets: [Date: [PhotoRef]] = [:]
        for photo in photos {
            let start = calendar.startOfDay(for: photo.created)
            buckets[start, default: []].append(photo)
        }
        return buckets.keys.sorted().map { day in
            let items = buckets[day] ?? []
            let located = items.last { $0.hasLocation }
            return PhotoDay(
                key: dayKey(day, calendar: calendar),
                date: day,
                title: dayTitle(for: day, now: now, calendar: calendar),
                latitude: located?.latitude,
                longitude: located?.longitude,
                photos: items
            )
        }
    }

    static func months(from days: [PhotoDay], calendar: Calendar = .current) -> [PhotoMonth] {
        var order: [String] = []
        var grouped: [String: [PhotoDay]] = [:]
        for day in days {
            let parts = calendar.dateComponents([.year, .month], from: day.date)
            let key = String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0)
            if grouped[key] == nil { order.append(key) }
            grouped[key, default: []].append(day)
        }
        return order.compactMap { key in
            guard let slice = grouped[key], let first = slice.first else { return nil }
            let photos = slice.flatMap(\.photos)
            guard let cover = photos.last else { return nil }
            let parts = calendar.dateComponents([.year], from: first.date)
            return PhotoMonth(
                id: key,
                date: first.date,
                title: monthTitle(for: first.date, calendar: calendar),
                yearTitle: String(parts.year ?? 0),
                count: photos.count,
                coverID: cover.id
            )
        }
    }

    static func years(from days: [PhotoDay], calendar: Calendar = .current) -> [PhotoYear] {
        var order: [Int] = []
        var counts: [Int: Int] = [:]
        var covers: [Int: String] = [:]
        for day in days {
            let year = calendar.component(.year, from: day.date)
            if counts[year] == nil { order.append(year) }
            counts[year, default: 0] += day.photos.count
            if let cover = day.photos.last?.id {
                covers[year] = cover
            }
        }
        return order.compactMap { year in
            guard let cover = covers[year] else { return nil }
            return PhotoYear(id: String(year), year: year, title: String(year), count: counts[year] ?? 0, coverID: cover)
        }
    }

    static func dayTitle(for date: Date, now: Date = .now, calendar: Calendar = .current) -> String {
        if calendar.isDate(date, inSameDayAs: now) { return "Dzisiaj" }
        if let yesterday = calendar.date(byAdding: .day, value: -1, to: calendar.startOfDay(for: now)),
           calendar.isDate(date, inSameDayAs: yesterday) {
            return "Wczoraj"
        }
        let sameYear = calendar.component(.year, from: date) == calendar.component(.year, from: now)
        return format(date, template: sameYear ? "d MMMM" : "d MMMM yyyy", calendar: calendar)
    }

    static func monthTitle(for date: Date, calendar: Calendar = .current) -> String {
        let raw = format(date, template: "LLLL", calendar: calendar)
        guard let first = raw.first else { return raw }
        return first.uppercased() + raw.dropFirst()
    }

    /// A new `DateFormatter` per day blocked the main thread long enough for iOS to kill the app at launch.
    private static let formatterLock = NSLock()
    nonisolated(unsafe) private static var formatters: [String: DateFormatter] = [:]

    private static func format(_ date: Date, template: String, calendar: Calendar) -> String {
        let key = "\(template)|\(calendar.identifier)|\(calendar.timeZone.identifier)"
        formatterLock.lock()
        defer { formatterLock.unlock() }
        let formatter: DateFormatter
        if let cached = formatters[key] {
            formatter = cached
        } else {
            let created = DateFormatter()
            created.locale = Locale(identifier: "pl_PL")
            created.calendar = calendar
            created.timeZone = calendar.timeZone
            created.setLocalizedDateFormatFromTemplate(template)
            formatters[key] = created
            formatter = created
        }
        return formatter.string(from: date)
    }

    static func dayKey(_ date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

enum PhotoFormat {
    static func count(_ value: Int) -> String {
        let noun = noun(value)
        let number = grouped(value)
        return "\(number) \(noun)"
    }

    static func onMap(_ value: Int) -> String {
        if value == 1 { return "1 na mapie" }
        return "\(grouped(value)) na mapie"
    }

    /// Apple Photos place albums: „6 rzeczy”.
    static func things(_ value: Int) -> String {
        let number = grouped(value)
        if value == 1 { return "\(number) rzecz" }
        return "\(number) rzeczy"
    }

    static func noun(_ value: Int) -> String {
        if value == 1 { return "zdjęcie" }
        let mod10 = value % 10
        let mod100 = value % 100
        if (2...4).contains(mod10), !(12...14).contains(mod100) { return "zdjęcia" }
        return "zdjęć"
    }

    private static let numbers: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.groupingSeparator = "\u{00a0}"
        return formatter
    }()

    static func grouped(_ value: Int) -> String {
        numbers.string(from: NSNumber(value: value)) ?? String(value)
    }

    static func duration(_ seconds: TimeInterval) -> String {
        let total = max(0, Int(seconds.rounded()))
        if total >= 3600 {
            return String(format: "%d:%02d:%02d", total / 3600, (total % 3600) / 60, total % 60)
        }
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

/// The device this copy of GalleryOS is running on. Library copy says iPad on an iPad.
enum ThisDevice {
    private static var pad: Bool { UIDevice.current.userInterfaceIdiom == .pad }
    static var name: String { pad ? "iPad" : "iPhone" }
    /// iPada / iPhone’a
    static var genitive: String { pad ? "iPada" : "iPhone’a" }
    /// iPadzie / iPhonie
    static var locative: String { pad ? "iPadzie" : "iPhonie" }
    /// iPadem / iPhone’em
    static var instrumental: String { pad ? "iPadem" : "iPhone’em" }
    static var symbol: String { pad ? "ipad" : "iphone" }
    static var slashSymbol: String { pad ? "ipad.slash" : "iphone.slash" }
}

extension View {
    @ViewBuilder
    func galleryGlass<S: InsettableShape>(in shape: S, interactive: Bool = false) -> some View {
        if #available(iOS 26.0, tvOS 26.0, *) {
            if interactive {
                self.glassEffect(.regular.interactive(), in: shape)
            } else {
                self.glassEffect(.regular, in: shape)
            }
        } else {
            self.background(.ultraThinMaterial, in: shape)
        }
    }

    @ViewBuilder
    func galleryGlassButton(prominent: Bool = false) -> some View {
        if #available(iOS 26.0, tvOS 26.0, *) {
            if prominent {
                self.buttonStyle(.glassProminent)
            } else {
                self.buttonStyle(.glass)
            }
        } else if prominent {
            self.buttonStyle(.borderedProminent)
        } else {
            self.buttonStyle(.bordered)
        }
    }

    @ViewBuilder
    func galleryNavigationSubtitle(_ subtitle: String) -> some View {
        #if os(tvOS)
        self
        #else
        if #available(iOS 26.0, *) {
            self.navigationSubtitle(subtitle)
        } else {
            self
        }
        #endif
    }

    @ViewBuilder
    func galleryBottomBar<V: View>(edge: VerticalEdge = .bottom, @ViewBuilder content: () -> V) -> some View {
        if #available(iOS 26.0, tvOS 26.0, *) {
            self.safeAreaBar(edge: edge, content: content)
        } else {
            self.safeAreaInset(edge: edge, spacing: 0, content: content)
        }
    }
}

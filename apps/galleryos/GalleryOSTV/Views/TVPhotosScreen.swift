import SwiftUI

enum TVRoute: Hashable {
    case year(Int)
    case month(String)
    case album(String)
}

struct TVPhotosScreen: View {
    @EnvironmentObject private var library: TVLibrary
    @AppStorage("galleryos.tv.zoom") private var zoomRaw = PhotoZoom.days.rawValue
    @State private var path: [TVRoute] = []

    private var zoom: PhotoZoom { PhotoZoom(rawValue: zoomRaw) ?? .days }

    var body: some View {
        NavigationStack(path: $path) {
            content
                .animation(TVTheme.spring, value: zoomRaw)
                .navigationDestination(for: TVRoute.self) { route in
                    destination(route)
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch zoom {
        case .years:
            shelf {
                LazyVGrid(columns: TVGridLayout.coverColumns, spacing: TVTheme.spacing) {
                    ForEach(library.model.years.reversed()) { year in
                        NavigationLink(value: TVRoute.year(year.year)) {
                            TVCoverCard(
                                hash: hash(of: year.coverID),
                                title: year.title,
                                subtitle: PhotoFormat.count(year.count)
                            )
                        }
                        .buttonStyle(.card)
                    }
                }
            }
        case .months:
            shelf {
                monthGrid(library.model.months.reversed())
            }
        case .days:
            TVSectionsGrid(sections: daySections(library.model.days)) { header }
        case .all:
            TVSectionsGrid(sections: [
                TVSection(id: "all", title: "", subtitle: "", photos: library.model.all.reversed())
            ]) { header }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 18) {
            TVScreenHeader(
                title: L("Zdjęcia"),
                subtitle: PhotoFormat.count(library.photoCount),
                showsLink: true
            )
            TVZoomPicker(zoomRaw: $zoomRaw)
        }
    }

    private func shelf<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            header
                .padding(.horizontal, TVTheme.margin)
                .padding(.top, 8)
            ScrollView {
                content()
                    .padding(.horizontal, TVTheme.margin)
                    .padding(.top, 8)
                    .padding(.bottom, 64)
            }
            .clipped()
        }
        .animation(TVTheme.spring, value: zoomRaw)
    }

    @ViewBuilder
    private func destination(_ route: TVRoute) -> some View {
        switch route {
        case .year(let year):
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    TVScreenHeader(title: String(year), subtitle: "")
                    monthGrid(library.model.months.filter { $0.yearTitle == String(year) }.reversed())
                }
                .padding(.horizontal, TVTheme.margin)
                .padding(.top, 24)
                .padding(.bottom, 64)
            }
        case .month(let id):
            let days = library.model.days.filter { $0.key.hasPrefix(id) }
            TVSectionsGrid(sections: daySections(days)) {
                TVScreenHeader(
                    title: library.model.months.first { $0.id == id }.map { "\($0.title) \($0.yearTitle)" } ?? id,
                    subtitle: PhotoFormat.count(days.reduce(0) { $0 + $1.photos.count })
                )
            }
        case .album(let name):
            if let album = library.albums.first(where: { $0.name == name }) {
                TVAlbumGrid(album: album)
            }
        }
    }

    private func monthGrid(_ months: [PhotoMonth]) -> some View {
        LazyVGrid(columns: TVGridLayout.coverColumns, spacing: TVTheme.spacing) {
            ForEach(months) { month in
                NavigationLink(value: TVRoute.month(month.id)) {
                    TVCoverCard(
                        hash: hash(of: month.coverID),
                        title: "\(month.title) \(month.yearTitle)",
                        subtitle: PhotoFormat.count(month.count)
                    )
                }
                .buttonStyle(.card)
            }
        }
    }

    private func daySections(_ days: [PhotoDay]) -> [TVSection] {
        days.reversed().map { day in
            TVSection(id: day.key, title: day.title, subtitle: PhotoFormat.count(day.photos.count), photos: day.photos)
        }
    }

    private func hash(of id: String) -> String {
        id.hasPrefix("cloud:") ? String(id.dropFirst(6)) : id
    }
}

enum TVSectionMaker {
    /// Month sections for newest-first photos, e.g. „Październik 2026 · 12 zdjęć”.
    static func months(_ photos: [PhotoRef], prefix: String) -> [TVSection] {
        let calendar = Calendar.current
        var order: [String] = []
        var buckets: [String: [PhotoRef]] = [:]
        for photo in photos {
            let parts = calendar.dateComponents([.year, .month], from: photo.created)
            let key = String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0)
            if buckets[key] == nil { order.append(key) }
            buckets[key, default: []].append(photo)
        }
        return order.map { key in
            let items = buckets[key] ?? []
            let date = items.first?.created ?? .now
            let year = calendar.component(.year, from: date)
            return TVSection(
                id: "\(prefix)#\(key)",
                title: "\(PhotoGrouping.monthTitle(for: date, calendar: calendar)) \(year)",
                subtitle: PhotoFormat.count(items.count),
                photos: items
            )
        }
    }
}

/// Album or media type, split by month like the iPhone.
struct TVAlbumGrid: View {
    let album: TVAlbum

    var body: some View {
        TVSectionsGrid(sections: TVSectionMaker.months(album.photos, prefix: album.name)) {
            TVScreenHeader(
                title: album.name,
                subtitle: "\(PhotoFormat.count(album.photos.count)) · \(TVFormat.span(album.oldest, album.newest))"
            )
        }
    }
}

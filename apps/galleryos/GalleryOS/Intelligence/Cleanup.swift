import Accelerate
import Photos
import SwiftUI

/// Finds what can go: series of near-identical shots (the best one suggested to keep), blurred,
/// burnt-out or dark frames, closed eyes, accidental pocket shots and old screenshots. Nothing is
/// marked in advance and nothing is deleted without the user's choice; every photo can be looked at
/// full size first. Favourites are never suggested, and deleted photos wait in Recently Deleted.
struct CleanupReport {
    struct Series: Identifiable, Hashable {
        let id: String
        /// Best first.
        let photos: [String]
        var keep: String { photos[0] }
        var extras: ArraySlice<String> { photos.dropFirst() }
    }

    enum Category: String, CaseIterable, Identifiable {
        case blurred, exposure, eyes, accidental, screenshots
        var id: String { rawValue }

        var title: String {
            switch self {
            case .blurred: return L("Rozmazane")
            case .exposure: return L("Prześwietlone i ciemne")
            case .eyes: return L("Zamknięte oczy")
            case .accidental: return L("Przypadkowe zdjęcia")
            case .screenshots: return L("Stare zrzuty ekranu")
            }
        }

        var detail: String {
            switch self {
            case .blurred: return L("Poruszone albo nieostre kadry.")
            case .exposure: return L("Białe od słońca albo prawie czarne.")
            case .eyes: return L("Ktoś mrugnął w złym momencie.")
            case .accidental: return L("Kieszeń, podłoga, palec na obiektywie.")
            case .screenshots: return L("Zrzuty starsze niż 30 dni.")
            }
        }

        var symbol: String {
            switch self {
            case .blurred: return "camera.metering.unknown"
            case .exposure: return "sun.max.trianglebadge.exclamationmark"
            case .eyes: return "eye.slash"
            case .accidental: return "hand.raised.slash"
            case .screenshots: return "camera.viewfinder"
            }
        }
    }

    var series: [Series] = []
    var singles: [Category: [String]] = [:]
    var bytes: [String: Int64] = [:]

    var seriesExtras: [String] { series.flatMap { Array($0.extras) } }

    func size(of ids: [String]) -> Int64 {
        ids.reduce(0) { $0 + (bytes[$1] ?? 0) }
    }

    /// What the headline counts. Old screenshots stay a category of their own: many people keep them on purpose.
    var totalSuggested: [String] {
        let weak = singles.filter { $0.key != .screenshots }.values.flatMap { $0 }
        return Array(Set(seriesExtras + weak))
    }
}

@MainActor
final class CleanupCenter: ObservableObject {
    static let shared = CleanupCenter()
    @Published private(set) var report = CleanupReport()
    @Published private(set) var working = false
    private var builtRevision = -1
    private var builtHiding: Bool?
    var ready: Bool { builtRevision >= 0 && !working }

    func refresh(library: PhotoLibrary, force: Bool = false) async {
        let brain = PhotoIntelligence.shared
        guard force || builtRevision != brain.revision || builtHiding != library.hideScreenshots, !working else { return }
        working = true
        builtRevision = brain.revision
        builtHiding = library.hideScreenshots
        let photos = library.shownPhotos.filter { !$0.isFavorite && !library.isConcealed($0.id) }
        let insights = brain.insights
        let assets: [String: PHAsset] = Dictionary(photos.compactMap { photo in
            library.asset(id: photo.id).map { (photo.id, $0) }
        }, uniquingKeysWith: { first, _ in first })
        let built = await Task.detached(priority: .utility) {
            Self.build(photos: photos, insights: insights, assets: assets)
        }.value
        report = built
        working = false
    }

    /// One line for the Core: how much there is to look at.
    var summary: String {
        let ids = report.totalSuggested
        if ids.isEmpty {
            return working ? L("Szukam podobnych i nieudanych zdjęć…") : L("Podobne zdjęcia, nieudane kadry, stare zrzuty")
        }
        return L("\(PhotoCountWord.text(ids.count)) do przejrzenia · \(ByteText.amount(report.size(of: ids)))")
    }

    func forget(_ ids: Set<String>) {
        var next = report
        next.series = next.series.compactMap { series in
            let left = series.photos.filter { !ids.contains($0) }
            return left.count > 1 ? CleanupReport.Series(id: series.id, photos: left) : nil
        }
        for key in next.singles.keys {
            next.singles[key] = next.singles[key]?.filter { !ids.contains($0) }
        }
        report = next
    }

    // MARK: Building the report

    nonisolated private static func build(photos: [PhotoRef], insights: [String: PhotoInsight], assets: [String: PHAsset]) -> CleanupReport {
        var report = CleanupReport()
        let sorted = photos.filter { !$0.traits.isVideo }.sorted { $0.created < $1.created }

        // 1. Series: shots taken within seconds of each other that look the same.
        var group: [PhotoRef] = []
        func close() {
            defer { group.removeAll() }
            guard group.count > 1 else { return }
            let ranked = group.sorted { quality($0, insights[$0.id]) > quality($1, insights[$1.id]) }
            report.series.append(.init(id: ranked[0].id, photos: ranked.map(\.id)))
        }
        for photo in sorted where !photo.traits.contains(.screenshot) {
            guard let last = group.last else {
                group = [photo]
                continue
            }
            let gap = photo.created.timeIntervalSince(last.created)
            if gap <= 60, alike(last, photo, insights) {
                group.append(photo)
            } else {
                close()
                group = [photo]
            }
        }
        close()
        let inSeries = Set(report.series.flatMap(\.photos))

        // 2. Weak single frames (a series already offers its best one instead).
        let monthAgo = Date().addingTimeInterval(-30 * 86_400)
        for photo in sorted {
            if photo.traits.contains(.screenshot) {
                if photo.created < monthAgo { report.singles[.screenshots, default: []].append(photo.id) }
                continue
            }
            guard !inSeries.contains(photo.id), let insight = insights[photo.id] else { continue }
            if accidental(insight) {
                report.singles[.accidental, default: []].append(photo.id)
            } else if insight.sharpness > 0, insight.sharpness < 12, insight.aesthetic < -0.15, insight.utility == false {
                report.singles[.blurred, default: []].append(photo.id)
            } else if insight.aesthetic < 0, insight.highlights > 0.5 || (insight.brightness < 0.06 && insight.shadows > 0.65) {
                report.singles[.exposure, default: []].append(photo.id)
            } else if insight.eyesClosed, insight.faceCount <= 3 {
                report.singles[.eyes, default: []].append(photo.id)
            }
        }
        for key in report.singles.keys {
            report.singles[key]?.reverse()
        }
        report.series.reverse()

        // 3. How much space each suggestion frees.
        let wanted = Set(report.seriesExtras + report.singles.values.flatMap { $0 })
        let byID = Dictionary(photos.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for id in wanted {
            if let asset = assets[id] {
                let resources = PHAssetResource.assetResources(for: asset)
                let size = resources.reduce(Int64(0)) { sum, resource in
                    sum + ((resource.value(forKey: "fileSize") as? NSNumber)?.int64Value ?? 0)
                }
                report.bytes[id] = size
            }
            if (report.bytes[id] ?? 0) == 0, let photo = byID[id] {
                report.bytes[id] = Int64(Double(photo.pixelWidth * photo.pixelHeight) * 0.42)
            }
        }
        return report
    }

    nonisolated private static func accidental(_ insight: PhotoInsight) -> Bool {
        if insight.faceCount > 0 || insight.utility { return false }
        if insight.brightness < 0.05 && insight.contrast < 0.05 { return true }
        if insight.sharpness > 0, insight.sharpness < 6, insight.contrast < 0.07 { return true }
        let strongest = insight.labels.first?.1 ?? 0
        return insight.aesthetic < -0.35 && strongest < 0.25 && insight.contrast < 0.12
    }

    /// Two neighbouring shots are one series when their pictures nearly match (CLIP), or, without
    /// CLIP, when they are a burst: under three seconds apart with the same framing.
    nonisolated private static func alike(_ a: PhotoRef, _ b: PhotoRef, _ insights: [String: PhotoInsight]) -> Bool {
        if let left = insights[a.id]?.clip, let right = insights[b.id]?.clip, left.count == 512, right.count == 512 {
            return cosine(left, right) >= 0.93
        }
        let sameShape = abs(a.aspect - b.aspect) < 0.02
        return sameShape && b.created.timeIntervalSince(a.created) <= 3
    }

    nonisolated private static func cosine(_ a: [UInt16], _ b: [UInt16]) -> Float {
        var left = [Float](repeating: 0, count: 512)
        var right = [Float](repeating: 0, count: 512)
        a.withUnsafeBufferPointer { source in left.withUnsafeMutableBufferPointer { HalfFloats.unpack(source, into: $0) } }
        b.withUnsafeBufferPointer { source in right.withUnsafeMutableBufferPointer { HalfFloats.unpack(source, into: $0) } }
        var dot: Float = 0
        vDSP_dotpr(left, 1, right, 1, &dot, 512)
        return dot
    }

    /// The keeper: Apple's aesthetic score, sharpness, open eyes, sane exposure, the larger file.
    nonisolated static func quality(_ photo: PhotoRef, _ insight: PhotoInsight?) -> Float {
        var score: Float = photo.isFavorite ? 10 : 0
        guard let insight else { return score }
        score += insight.aesthetic
        score += min(1, log10(max(insight.sharpness, 1)) / 3) * 0.6
        if insight.eyesClosed { score -= 0.7 }
        score -= max(0, insight.highlights - 0.2) * 1.5
        score -= max(0, insight.shadows - 0.4)
        score += Float(photo.pixelWidth * photo.pixelHeight) / 50_000_000
        return score
    }
}

// MARK: Screens

enum CleanupRoute: Hashable {
    case overview
    case series
    case category(CleanupReport.Category)
}

extension View {
    func cleanupDestinations() -> some View {
        navigationDestination(for: CleanupRoute.self) { route in
            switch route {
            case .overview: CleanupScreen()
            case .series: SeriesReviewScreen()
            case .category(let category): CategoryReviewScreen(category: category)
            }
        }
    }
}

struct CleanupScreen: View {
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var center = CleanupCenter.shared
    @ObservedObject private var brain = PhotoIntelligence.shared

    private var categories: [CleanupReport.Category] {
        CleanupReport.Category.allCases.filter { $0 != .screenshots || !library.hideScreenshots }
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(ByteText.amount(center.report.size(of: center.report.totalSuggested)))
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .contentTransition(.numericText())
                    Text(L("tyle możesz odzyskać po przejrzeniu propozycji"))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if brain.running {
                        Text(L("Przejrzano \(brain.analyzedCount) z \(brain.totalCount) zdjęć — propozycji będzie przybywać."))
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
                .padding(.vertical, 6)
            }
            Section {
                NavigationLink(value: CleanupRoute.series) {
                    row(title: L("Podobne i serie"), detail: L("Najlepsze ujęcie jest podpowiedziane. Ty decydujesz, co zostaje."),
                        symbol: "square.stack.3d.down.right", ids: center.report.seriesExtras)
                }
                .disabled(center.report.series.isEmpty)
            }
            Section {
                ForEach(categories) { category in
                    let ids = center.report.singles[category] ?? []
                    NavigationLink(value: CleanupRoute.category(category)) {
                        row(title: category.title, detail: category.detail, symbol: category.symbol, ids: ids)
                    }
                    .disabled(ids.isEmpty)
                }
            } footer: {
                Text(L("Nic nie jest zaznaczone z góry. Stuknij zdjęcie, żeby obejrzeć je w całości. Ulubione nigdy nie trafiają na listę, a usunięte czekają w „Ostatnio usuniętych”."))
            }
        }
        .navigationTitle(L("Porządki"))
        .refreshable { await center.refresh(library: library, force: true) }
        .task { await center.refresh(library: library) }
        .overlay {
            if center.working, center.report.totalSuggested.isEmpty { ProgressView() }
        }
    }

    private func row(title: String, detail: String, symbol: String, ids: [String]) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(GalleryTheme.accent)
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(ids.count)").font(.headline.monospacedDigit())
                if !ids.isEmpty {
                    Text(ByteText.amount(center.report.size(of: ids))).font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// What the preview shows: which photos, starting where, and which one is suggested to keep.
struct CleanupPreviewRequest: Identifiable {
    let id = UUID()
    let ids: [String]
    let start: Int
    var keeper: String?
}

/// Every series as a strip. The suggested keeper wears a crown; nothing is marked until you
/// choose. Tap a photo to see it big next to the others, the circle marks it for removal.
struct SeriesReviewScreen: View {
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var center = CleanupCenter.shared
    @State private var marked: Set<String> = []
    @State private var deleting = false
    @State private var preview: CleanupPreviewRequest?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) {
                Text(L("Stuknij zdjęcie, żeby obejrzeć je w całości i porównać. Kółko zaznacza zdjęcie do usunięcia."))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                ForEach(center.report.series) { series in
                    seriesRow(series)
                }
            }
            .padding(16)
        }
        .navigationTitle(L("Podobne i serie"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(L("Zaznacz wszystkie oprócz najlepszych"), systemImage: "checkmark.circle") {
                        marked = Set(center.report.seriesExtras)
                    }
                    Button(L("Odznacz wszystko"), systemImage: "circle") { marked.removeAll() }
                        .disabled(marked.isEmpty)
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if !marked.isEmpty {
                DeleteBar(ids: Array(marked), bytes: center.report.size(of: Array(marked)), deleting: $deleting) {
                    await remove()
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.smooth(duration: 0.3), value: marked.isEmpty)
        .fullScreenCover(item: $preview) { request in
            CleanupPreview(request: request, marked: $marked)
                .environmentObject(library)
        }
    }

    private func seriesRow(_ series: CleanupReport.Series) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(seriesTitle(series))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                let extras = Set(series.extras)
                let chosen = !extras.isEmpty && extras.isSubset(of: marked)
                Button(chosen ? L("Cofnij") : L("Zostaw najlepsze")) {
                    if chosen { marked.subtract(extras) } else { marked.formUnion(extras); marked.remove(series.keep) }
                    UISelectionFeedbackGenerator().selectionChanged()
                }
                .font(.footnote.weight(.semibold))
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(series.photos.enumerated()), id: \.element) { offset, id in
                        CleanupThumb(id: id, side: 132)
                            .overlay(alignment: .topLeading) {
                                if id == series.keep { KeeperBadge().padding(6) }
                            }
                            .overlay {
                                if marked.contains(id) {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .strokeBorder(Color.red, lineWidth: 3)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                preview = CleanupPreviewRequest(ids: series.photos, start: offset, keeper: series.keep)
                            }
                            .overlay(alignment: .bottomTrailing) {
                                TickButton(on: marked.contains(id)) { toggle(id) }
                            }
                    }
                }
            }
        }
    }

    private func seriesTitle(_ series: CleanupReport.Series) -> String {
        guard let photo = library.photo(id: series.keep) else { return PhotoCountWord.text(series.photos.count) }
        return L("\(series.photos.count) podobnych · ") + photo.created.formatted(date: .abbreviated, time: .shortened)
    }

    private func toggle(_ id: String) {
        if marked.contains(id) { marked.remove(id) } else { marked.insert(id) }
        UISelectionFeedbackGenerator().selectionChanged()
    }

    private func remove() async {
        let ids = Array(marked)
        guard !ids.isEmpty else { return }
        deleting = true
        if await library.delete(ids: ids) {
            center.forget(Set(ids))
            marked.subtract(ids)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
        deleting = false
    }
}

struct CategoryReviewScreen: View {
    let category: CleanupReport.Category
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var center = CleanupCenter.shared
    @State private var marked: Set<String> = []
    @State private var deleting = false
    @State private var preview: CleanupPreviewRequest?

    private var ids: [String] { center.report.singles[category] ?? [] }

    var body: some View {
        ScrollView {
            Text(category.detail + L(" Stuknij zdjęcie, żeby obejrzeć je w całości. Kółko zaznacza zdjęcie do usunięcia."))
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 4)], spacing: 4) {
                ForEach(Array(ids.enumerated()), id: \.element) { offset, id in
                    CleanupThumb(id: id, side: 140, corner: 4, flexible: true)
                        .overlay {
                            if marked.contains(id) {
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .strokeBorder(Color.red, lineWidth: 3)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            preview = CleanupPreviewRequest(ids: ids, start: offset)
                        }
                        .overlay(alignment: .bottomTrailing) {
                            TickButton(on: marked.contains(id)) {
                                if marked.contains(id) { marked.remove(id) } else { marked.insert(id) }
                                UISelectionFeedbackGenerator().selectionChanged()
                            }
                        }
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle(category.title)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(!ids.isEmpty && marked.count == ids.count ? L("Odznacz") : L("Zaznacz wszystko")) {
                    marked = marked.count == ids.count ? [] : Set(ids)
                }
                .disabled(ids.isEmpty)
            }
        }
        .safeAreaInset(edge: .bottom) {
            if !marked.isEmpty {
                DeleteBar(ids: Array(marked), bytes: center.report.size(of: Array(marked)), deleting: $deleting) {
                    let chosen = Array(marked)
                    deleting = true
                    if await library.delete(ids: chosen) {
                        center.forget(Set(chosen))
                        marked.subtract(chosen)
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                    }
                    deleting = false
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.smooth(duration: 0.3), value: marked.isEmpty)
        .fullScreenCover(item: $preview) { request in
            CleanupPreview(request: request, marked: $marked)
                .environmentObject(library)
        }
    }
}

/// One photo at a time, full size and zoomable, with the others of its group in a strip below to
/// compare. The big button keeps it or marks it for removal; nothing is deleted here.
struct CleanupPreview: View {
    let request: CleanupPreviewRequest
    @Binding var marked: Set<String>
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    @State private var page: Int

    init(request: CleanupPreviewRequest, marked: Binding<Set<String>>) {
        self.request = request
        _marked = marked
        _page = State(initialValue: request.start)
    }

    private var currentID: String? {
        request.ids.indices.contains(page) ? request.ids[page] : nil
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            TabView(selection: $page) {
                ForEach(Array(request.ids.enumerated()), id: \.element) { offset, id in
                    CleanupBigPhoto(id: id)
                        .tag(offset)
                        .ignoresSafeArea()
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()
            VStack(spacing: 0) {
                topBar
                Spacer(minLength: 0)
                bottomBar
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden()
    }

    private var topBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .galleryGlass(in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(L("Zamknij"))
            Spacer()
            VStack(spacing: 2) {
                Text(L("\(page + 1) z \(request.ids.count)"))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                if let currentID, let photo = library.photo(id: currentID) {
                    Text(photo.created.formatted(date: .abbreviated, time: .standard))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .galleryGlass(in: Capsule())
            Spacer()
            Color.clear.frame(width: 40, height: 40)
        }
        .padding(.horizontal, 14)
        .padding(.top, 8)
    }

    private var bottomBar: some View {
        VStack(spacing: 12) {
            if let currentID, currentID == request.keeper {
                KeeperBadge(large: true)
            }
            if request.ids.count > 1 {
                ScrollViewReader { proxy in
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(Array(request.ids.enumerated()), id: \.element) { offset, id in
                                CleanupThumb(id: id, side: 54, corner: 8)
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                            .strokeBorder(marked.contains(id) ? Color.red : (offset == page ? Color.white : Color.clear), lineWidth: 2.5)
                                    }
                                    .overlay(alignment: .bottomTrailing) {
                                        if marked.contains(id) {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.system(size: 14, weight: .bold))
                                                .symbolRenderingMode(.palette)
                                                .foregroundStyle(.white, .red)
                                                .padding(2)
                                        }
                                    }
                                    .opacity(offset == page ? 1 : 0.7)
                                    .id(offset)
                                    .onTapGesture {
                                        withAnimation(.smooth(duration: 0.3)) { page = offset }
                                    }
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                    .onChange(of: page) { _, value in
                        withAnimation(.smooth(duration: 0.3)) { proxy.scrollTo(value, anchor: .center) }
                    }
                    .onAppear { proxy.scrollTo(page, anchor: .center) }
                }
            }
            if let currentID {
                let isMarked = marked.contains(currentID)
                Button {
                    if isMarked { marked.remove(currentID) } else { marked.insert(currentID) }
                    UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                } label: {
                    Label(isMarked ? L("Zostaw to zdjęcie") : L("Zaznacz do usunięcia"),
                          systemImage: isMarked ? "arrow.uturn.backward" : "trash")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .foregroundStyle(isMarked ? Color.primary : Color.white)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(isMarked ? AnyShapeStyle(Color.white.opacity(0.16)) : AnyShapeStyle(Color.red.gradient))
                        )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
                .animation(.smooth(duration: 0.2), value: isMarked)
            }
            Text(marked.isEmpty ? L("Nic nie jest zaznaczone.") : L("Zaznaczone do usunięcia: \(PhotoFormat.grouped(marked.count))"))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.bottom, 10)
        .padding(.top, 12)
        .background(
            LinearGradient(colors: [.clear, .black.opacity(0.75)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        )
    }
}

/// A photo as big as the screen allows, pinch and double tap to look closer.
private struct CleanupBigPhoto: View {
    let id: String
    @EnvironmentObject private var library: PhotoLibrary
    @State private var image: UIImage?

    var body: some View {
        ZoomablePicture(image: image ?? library.thumbnail(id: id))
            .overlay {
                if image == nil { ProgressView().tint(.white) }
            }
            .task(id: id) {
                if let asset = library.asset(id: id) {
                    image = await PhotoIntelligence.request(asset, side: 2400)
                } else {
                    image = await library.sharpPreview(id: id, side: 2048) ?? library.thumbnail(id: id)
                }
            }
    }
}

struct ZoomablePicture: UIViewRepresentable {
    let image: UIImage?

    func makeUIView(context: Context) -> ZoomView {
        ZoomView()
    }

    func updateUIView(_ view: ZoomView, context: Context) {
        view.show(image)
    }

    final class ZoomView: UIScrollView, UIScrollViewDelegate {
        private let picture = UIImageView()

        override init(frame: CGRect) {
            super.init(frame: frame)
            delegate = self
            minimumZoomScale = 1
            maximumZoomScale = 5
            showsVerticalScrollIndicator = false
            showsHorizontalScrollIndicator = false
            contentInsetAdjustmentBehavior = .never
            backgroundColor = .clear
            picture.contentMode = .scaleAspectFit
            addSubview(picture)
            let doubleTap = UITapGestureRecognizer(target: self, action: #selector(doubleTapped(_:)))
            doubleTap.numberOfTapsRequired = 2
            addGestureRecognizer(doubleTap)
        }

        required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

        func show(_ image: UIImage?) {
            guard picture.image !== image else { return }
            picture.image = image
            setNeedsLayout()
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            if zoomScale <= 1.001 {
                picture.frame = bounds
                contentSize = bounds.size
            }
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? { picture }

        @objc private func doubleTapped(_ gesture: UITapGestureRecognizer) {
            if zoomScale > 1.01 {
                setZoomScale(1, animated: true)
            } else {
                let point = gesture.location(in: picture)
                let size = CGSize(width: bounds.width / 2.5, height: bounds.height / 2.5)
                zoom(to: CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height), animated: true)
            }
        }
    }
}

/// "Najlepsze": the shot GalleryOS suggests keeping.
private struct KeeperBadge: View {
    var large = false

    var body: some View {
        Label(large ? L("Najlepsze ujęcie w serii") : L("Najlepsze"), systemImage: "crown.fill")
            .font(large ? .footnote.weight(.bold) : .caption2.weight(.bold))
            .padding(.horizontal, large ? 12 : 7)
            .padding(.vertical, large ? 6 : 4)
            .background(Capsule().fill(.yellow))
            .foregroundStyle(.black)
    }
}

/// The circle in the corner of a thumbnail: marks the photo for removal.
private struct TickButton: View {
    let on: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: on ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .symbolRenderingMode(.palette)
                .foregroundStyle(.white, on ? Color.red : Color.black.opacity(0.3))
                .padding(6)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(on ? L("Zostaw to zdjęcie") : L("Zaznacz do usunięcia"))
    }
}

private struct DeleteBar: View {
    let ids: [String]
    let bytes: Int64
    @Binding var deleting: Bool
    let action: () async -> Void

    var body: some View {
        Button {
            Task { await action() }
        } label: {
            HStack {
                if deleting { ProgressView().tint(.white) }
                Text(L("Usuń \(PhotoCountWord.text(ids.count)) · \(ByteText.amount(bytes))"))
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.red))
            .foregroundStyle(.white)
        }
        .disabled(ids.isEmpty || deleting)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.bar)
    }
}

/// A small square picture of a photo on this device or on the server.
struct CleanupThumb: View {
    let id: String
    var side: CGFloat = 120
    var corner: CGFloat = 12
    @EnvironmentObject private var library: PhotoLibrary
    @State private var image: UIImage?

    /// In a grid the cell decides the size; in a strip the picture has a fixed side.
    var flexible = false

    var body: some View {
        Group {
            if flexible {
                Color.clear.aspectRatio(1, contentMode: .fit).overlay { picture }
            } else {
                picture.frame(width: side, height: side)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        .task(id: id) { await load() }
    }

    private var picture: some View {
        ZStack {
            Rectangle().fill(Color(uiColor: .tertiarySystemFill))
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            }
        }
        .clipped()
    }

    private func load() async {
        do {
            if let asset = library.asset(id: id) {
                image = await PhotoIntelligence.request(asset, side: side * 2)
            } else {
                image = library.thumbnail(id: id)
                if image == nil { image = await LibraryEngine.shared.cloudThumb(id: id) }
            }
        }
    }
}

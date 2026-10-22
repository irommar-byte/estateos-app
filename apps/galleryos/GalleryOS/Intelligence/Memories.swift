import CoreLocation
import Photos
import SwiftUI

@MainActor
final class MemoryCenter: ObservableObject {
    static let shared = MemoryCenter()
    @Published private(set) var memories: [Memory] = []
    @Published private(set) var trips: [Memory] = []
    private var builtRevision = -1
    @Published private(set) var building = false
    var ready: Bool { builtRevision >= 0 && !building }
    private static let namesKey = "galleryos.trip-names.v1"

    func refresh(library: PhotoLibrary) async {
        let brain = PhotoIntelligence.shared
        let revision = brain.revision / 25 &+ library.generation
        guard revision != builtRevision, !building, !library.allPhotos.isEmpty else { return }
        building = true
        builtRevision = revision
        let photos = library.allPhotos.filter { !library.isConcealed($0.id) && !$0.traits.contains(.screenshot) }
        let insights = brain.insights.mapValues { MemoryBuilder.Lite(aesthetic: $0.aesthetic, utility: $0.utility, faces: $0.faceCount) }
        var personPhotos: [(PersonSummary, [String])] = []
        for person in brain.people where person.hasName || person.favorite {
            let ids = brain.photos(of: person.id)
            if ids.count >= 24 { personPhotos.append((person, ids)) }
        }
        let people = personPhotos.map { ($0.0.id, $0.0.name, $0.1) }
        let built = await Task.detached(priority: .utility) {
            MemoryBuilder.build(photos: photos, insights: insights, people: people)
        }.value
        // Shown at once; place names arrive one by one (a slow map lookup never holds them back).
        trips = built.trips
        memories = built.memories
        building = false
        for trip in built.trips {
            guard let title = await name(for: trip) else { continue }
            if let index = trips.firstIndex(where: { $0.id == trip.id }) { trips[index].title = title }
            if let index = memories.firstIndex(where: { $0.id == trip.id }) { memories[index].title = title }
        }
    }

    private func name(for trip: Memory) async -> String? {
        guard let latitude = trip.latitude, let longitude = trip.longitude else { return nil }
        let key = String(format: "%.2f,%.2f", latitude, longitude)
        var saved = UserDefaults.standard.dictionary(forKey: Self.namesKey) as? [String: String] ?? [:]
        if let hit = saved[key] { return hit }
        let location = CLLocation(latitude: latitude, longitude: longitude)
        // A map lookup that never answers must not hold the memories back: 8 seconds at most.
        let found: String? = await withCheckedContinuation { continuation in
            let gate = NameGate()
            Task { gate.resume(continuation, await PhotoLibrary.placeName(for: location)) }
            Task {
                try? await Task.sleep(for: .seconds(8))
                gate.resume(continuation, nil)
            }
        }
        guard let found else { return nil }
        let short = found.split(separator: ",").first.map(String.init) ?? found
        saved[key] = short
        UserDefaults.standard.set(saved, forKey: Self.namesKey)
        return short
    }
}

// MARK: Collections shelf

struct MemoriesShelf: View {
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var center = MemoryCenter.shared
    @State private var playing: Memory?

    var body: some View {
        Group {
            if !center.memories.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text(L("Wspomnienia"))
                        .font(.title3.weight(.bold))
                        .padding(.horizontal, 16)
                        .padding(.top, 6)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(center.memories) { memory in
                                Button { playing = memory } label: {
                                    MemoryCard(memory: memory, width: 260, height: 330)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
            }
            if !center.trips.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(L("Podróże")).font(.title3.weight(.bold))
                        Spacer()
                        NavigationLink(value: MemoryRoute.trips) { Text(L("Wszystkie")) }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 6)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(center.trips.prefix(10)) { trip in
                                NavigationLink(value: MemoryRoute.trip(trip.id)) {
                                    MemoryCard(memory: trip, width: 200, height: 150)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
            }
        }
        .task(id: library.generation &+ PhotoIntelligence.shared.revision / 25) {
            await center.refresh(library: library)
        }
        .fullScreenCover(item: $playing) { memory in
            MemoryPlayer(memory: memory).environmentObject(library)
        }
    }
}

enum MemoryRoute: Hashable {
    case trips
    case trip(String)
}

extension View {
    func memoryDestinations() -> some View {
        navigationDestination(for: MemoryRoute.self) { route in
            switch route {
            case .trips: TripsScreen()
            case .trip(let id): TripScreen(tripID: id)
            }
        }
    }
}

struct MemoryCard: View {
    let memory: Memory
    let width: CGFloat
    let height: CGFloat

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            MemoryImage(id: memory.cover, side: max(width, height) * 2)
                .frame(width: width, height: height)
                .clipped()
            LinearGradient(colors: [.clear, .black.opacity(0.65)], startPoint: .center, endPoint: .bottom)
            VStack(alignment: .leading, spacing: 3) {
                Text(memory.title)
                    .font(.system(size: height > 200 ? 26 : 19, weight: .bold, design: .serif))
                    .lineLimit(2)
                Text(memory.subtitle)
                    .font(.caption.weight(.medium))
                    .opacity(0.85)
                    .lineLimit(1)
            }
            .foregroundStyle(.white)
            .padding(14)
        }
        .frame(width: width, height: height)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.18), radius: 10, y: 5)
    }
}

/// A photo for memories: the device copy (downloaded from iCloud if needed) or the server preview.
struct MemoryImage: View {
    let id: String
    let side: CGFloat
    @EnvironmentObject private var library: PhotoLibrary
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Rectangle().fill(Color(white: 0.12))
            if let image {
                Image(uiImage: image).resizable().scaledToFill().transition(.opacity)
            }
        }
        .task(id: id) {
            let loaded = await MemoryImage.load(id, side: side, library: library)
            withAnimation(.easeOut(duration: 0.3)) { image = loaded }
        }
    }

    static func load(_ id: String, side: CGFloat, library: PhotoLibrary) async -> UIImage? {
        if let asset = library.asset(id: id) {
            return await withCheckedContinuation { continuation in
                let options = PHImageRequestOptions()
                options.deliveryMode = .highQualityFormat
                options.resizeMode = .fast
                options.isNetworkAccessAllowed = true
                let gate = MemoryGate()
                PHImageManager.default().requestImage(
                    for: asset, targetSize: CGSize(width: side, height: side), contentMode: .aspectFill, options: options
                ) { image, info in
                    if (info?[PHImageResultIsDegradedKey] as? Bool) == true { return }
                    gate.resume(continuation, image)
                }
            }
        }
        if let sharp = await library.sharpPreview(id: id, side: side) { return sharp }
        if let thumb = library.thumbnail(id: id) { return thumb }
        return await LibraryEngine.shared.cloudThumb(id: id)
    }
}

private final class MemoryGate: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false
    func resume(_ continuation: CheckedContinuation<UIImage?, Never>, _ image: UIImage?) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        continuation.resume(returning: image)
    }
}

// MARK: Trips

struct TripsScreen: View {
    @ObservedObject private var center = MemoryCenter.shared

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 14)], spacing: 14) {
                ForEach(center.trips) { trip in
                    NavigationLink(value: MemoryRoute.trip(trip.id)) {
                        GeometryReader { proxy in
                            MemoryCard(memory: trip, width: proxy.size.width, height: 200)
                        }
                        .frame(height: 200)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
        }
        .navigationTitle(L("Podróże"))
    }
}

struct TripScreen: View {
    let tripID: String
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var center = MemoryCenter.shared
    @State private var viewer: ViewerRequest?
    @State private var playing: Memory?

    private var trip: Memory? { center.trips.first { $0.id == tripID } }

    var body: some View {
        Group {
            if let trip {
                let wanted = Set(trip.all)
                let model = GridModel(photos: library.shownPhotos.filter { wanted.contains($0.id) })
                PhotoGrid(
                    model: model,
                    generation: library.generation,
                    zoom: .all,
                    selection: [],
                    selecting: false,
                    placeNames: library.placeNames,
                    synced: { library.isUploaded($0) },
                    anchor: nil,
                    asset: { library.asset(id: $0) },
                    thumb: { library.thumbnail(id: $0) },
                    loadThumb: { await LibraryEngine.shared.cloudThumb(id: $0) },
                    onOpen: { request in
                        let ids = model.all.map(\.id)
                        var transaction = Transaction()
                        transaction.disablesAnimations = true
                        withTransaction(transaction) {
                            viewer = ViewerRequest(ids: ids, index: ids.firstIndex(of: request.id) ?? 0,
                                                   origin: request.frame, image: request.image, source: request.source)
                        }
                    },
                    onSelect: { _ in },
                    onFavorite: { id in
                        library.setFavorite(!(library.photo(id: id)?.isFavorite ?? false), ids: [id])
                    },
                    onZoom: { _, _ in },
                    onVisiblePlaces: { requests in library.resolvePlaces(requests) },
                    sharp: { id, side in await library.sharpPreview(id: id, side: side) }
                )
                .safeAreaInset(edge: .top, spacing: 0) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(trip.title).font(.title2.weight(.bold))
                            Text("\(trip.subtitle) · \(PhotoCountWord.text(trip.all.count))")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            playing = trip
                        } label: {
                            Label(L("Odtwórz"), systemImage: "play.fill")
                                .font(.subheadline.weight(.semibold))
                        }
                        .buttonStyle(.borderedProminent)
                        .clipShape(Capsule())
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(.bar)
                }
                .ignoresSafeArea(edges: .bottom)
            } else {
                ContentUnavailableView(L("Podróż"), systemImage: "airplane")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $viewer) { request in
            PhotoViewerHost(request: request)
                .environmentObject(library)
                .presentationBackground(.clear)
        }
        .fullScreenCover(item: $playing) { memory in
            MemoryPlayer(memory: memory).environmentObject(library)
        }
    }
}

private final class NameGate: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false
    func resume(_ continuation: CheckedContinuation<String?, Never>, _ value: String?) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        continuation.resume(returning: value)
    }
}

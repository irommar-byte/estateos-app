import SwiftUI

/// Memories on Apple TV, built from the server library: this day in earlier years, trips away
/// from home and busy months. Each plays as a slideshow with drifting photos and music.
@MainActor
final class TVMemoryCenter: ObservableObject {
    static let shared = TVMemoryCenter()
    @Published private(set) var memories: [Memory] = []
    @Published private(set) var trips: [Memory] = []
    private var builtKey = ""

    func refresh(library: TVLibrary) async {
        let photos = library.model.all
        let key = "\(photos.count)-\(photos.first?.id ?? "")-\(Calendar.current.component(.day, from: .now))"
        guard key != builtKey, !photos.isEmpty else { return }
        builtKey = key
        let built = await Task.detached(priority: .utility) {
            MemoryBuilder.build(photos: photos, insights: [:], people: [])
        }.value
        let byID = Dictionary(photos.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        func titled(_ memory: Memory) -> Memory {
            guard memory.kind == .trip else { return memory }
            var copy = memory
            var counts: [String: Int] = [:]
            for id in memory.all.prefix(60) {
                guard let photo = byID[id], let name = library.placeName(for: photo) else { continue }
                let short = name.split(separator: ",").first.map(String.init) ?? name
                counts[short, default: 0] += 1
            }
            if let best = counts.max(by: { $0.value < $1.value })?.key { copy.title = best }
            return copy
        }
        trips = built.trips.map(titled)
        memories = built.memories.map(titled)
    }
}

struct TVMemoriesScreen: View {
    @EnvironmentObject private var library: TVLibrary
    @ObservedObject private var center = TVMemoryCenter.shared
    @State private var playing: Memory?

    private var byID: [String: PhotoRef] {
        Dictionary(library.model.all.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 52) {
                    TVScreenHeader(title: L("Wspomnienia"), subtitle: subtitle)
                    if center.memories.isEmpty && center.trips.isEmpty {
                        Text(L("Gdy biblioteka urośnie, pojawią się tu historie z wyjazdów i dni sprzed lat."))
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                    if !center.memories.isEmpty {
                        shelf(L("Dla Ciebie"), center.memories)
                    }
                    if !center.trips.isEmpty {
                        shelf(L("Podróże"), center.trips)
                    }
                }
                .padding(.horizontal, TVTheme.margin)
                .padding(.top, 24)
                .padding(.bottom, 64)
            }
        }
        .task(id: library.model.all.count) { await center.refresh(library: library) }
        .fullScreenCover(item: $playing) { memory in
            TVMemoryShow(memory: memory, photos: memory.photos.compactMap { byID[$0] })
        }
    }

    private var subtitle: String {
        let count = center.memories.count + center.trips.count
        return count == 0 ? "" : L("Historie ułożone z Twoich zdjęć")
    }

    private func shelf(_ title: String, _ list: [Memory]) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(title).font(.title2.weight(.bold))
            LazyVGrid(columns: TVGridLayout.coverColumns, spacing: TVTheme.spacing) {
                ForEach(list) { memory in
                    Button { playing = memory } label: {
                        TVCoverCard(
                            hash: byID[memory.cover]?.cloudHash ?? "",
                            title: memory.title,
                            subtitle: memory.subtitle,
                            detail: PhotoFormat.count(memory.kind == .trip ? memory.all.count : memory.photos.count)
                        )
                    }
                    .buttonStyle(.card)
                }
            }
            .focusSection()
        }
    }
}

/// The slideshow viewer with a title card and the memory's music.
private struct TVMemoryShow: View {
    let memory: Memory
    let photos: [PhotoRef]
    @StateObject private var music = MemoryMusic()
    @State private var context: TVViewerContext
    @State private var titleShown = true

    init(memory: Memory, photos: [PhotoRef]) {
        self.memory = memory
        self.photos = photos
        _context = State(initialValue: TVViewerContext(photos: photos, start: 0, slideshow: true))
    }

    var body: some View {
        ZStack {
            if photos.isEmpty {
                Text(L("Te zdjęcia nie są jeszcze dostępne na serwerze."))
                    .font(.title2)
            } else {
                TVViewer(context: context) { _ in }
            }
            if titleShown {
                ZStack {
                    LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .center, endPoint: .bottom)
                    VStack(spacing: 14) {
                        Spacer()
                        Text(memory.title)
                            .font(.system(size: 92, weight: .bold, design: .serif))
                            .shadow(radius: 20)
                        Text(memory.subtitle.uppercased())
                            .font(.title3.weight(.semibold))
                            .tracking(4)
                            .opacity(0.9)
                        Spacer().frame(height: 120)
                    }
                    .foregroundStyle(.white)
                }
                .ignoresSafeArea()
                .allowsHitTesting(false)
                .transition(.opacity)
            }
        }
        .onAppear { music.start(mood: memory.mood, muted: false) }
        .onDisappear { music.stop() }
        .task {
            try? await Task.sleep(for: .seconds(4))
            withAnimation(.easeInOut(duration: 1.2)) { titleShown = false }
        }
    }
}

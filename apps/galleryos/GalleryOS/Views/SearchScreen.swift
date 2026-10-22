import MapKit
import Photos
import SwiftUI
import Translation

struct SearchScreen: View {
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var brain = PhotoIntelligence.shared
    @Environment(\.dismiss) private var dismiss
    var showsClose = true
    @State private var query = ""
    @State private var viewer: ViewerRequest?
    @State private var showMap = false
    /// Computed after a short pause in typing, not on every redraw of the screen.
    @State private var results = GridModel.empty
    @State private var understood = SmartQuery()
    @State private var searching = false
    @AppStorage("galleryos.search.recent") private var recentRaw = ""
    /// Apple's on-device translation turns the scene words into English for CLIP.
    @State private var translation: TranslationSession.Configuration?
    @State private var translationSource = ""
    @State private var translated: [String: String] = [:]

    private var trimmed: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }

    private func search() async {
        guard !trimmed.isEmpty else {
            results = .empty
            understood = SmartQuery()
            return
        }
        try? await Task.sleep(for: .milliseconds(220))
        guard !Task.isCancelled else { return }
        searching = true
        let parsed = SmartSearch.parse(trimmed, library: library, brain: brain)
        understood = parsed
        var english = translated[parsed.scenePolish]
        if english == nil, parsed.hasScene, !parsed.unknownWords.isEmpty, brain.searchAvailable {
            // Some words are not in the built-in dictionary: ask Apple's translation, then search again.
            requestTranslation(parsed.scenePolish)
            english = parsed.dictionaryEnglish.isEmpty ? nil : parsed.dictionaryEnglish
        }
        let ids = await SmartSearch.run(parsed, english: english, library: library, brain: brain)
        guard !Task.isCancelled else { return }
        let byID = Dictionary(library.shownPhotos.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let ordered = ids.compactMap { byID[$0] }
        results = Self.relevanceGrid(ordered, scene: parsed.hasScene)
        searching = false
    }

    /// Scene searches keep their best-match order in one section; filters only (a person, a year)
    /// read better by date.
    private static func relevanceGrid(_ photos: [PhotoRef], scene: Bool) -> GridModel {
        guard scene, let first = photos.first else { return GridModel(photos: photos).arranged(.newest) }
        let dated = GridModel(photos: photos)
        let section = PhotoDay(key: "search.best", date: first.created, title: L("Najlepiej pasujące"),
                               latitude: nil, longitude: nil, photos: photos)
        return GridModel(days: [section], months: dated.months, years: dated.years, all: photos)
    }

    private func requestTranslation(_ text: String) {
        guard translationSource != text else { return }
        translationSource = text
        if translation == nil {
            translation = TranslationSession.Configuration(
                source: Locale.Language(identifier: Localization.language),
                target: Locale.Language(identifier: "en")
            )
        } else {
            translation?.invalidate()
        }
    }

    private func remember(_ text: String) {
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.count >= 2 else { return }
        var list = recent.filter { $0.caseInsensitiveCompare(value) != .orderedSame }
        list.insert(value, at: 0)
        recentRaw = list.prefix(8).joined(separator: "\n")
    }

    private var recent: [String] {
        recentRaw.split(separator: "\n").map(String.init)
    }

    var body: some View {
        NavigationStack {
            Group {
                if trimmed.isEmpty {
                    suggestions
                } else if results.all.isEmpty {
                    if searching {
                        ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        ContentUnavailableView.search(text: query)
                            .overlay(alignment: .bottom) { coverageNote.padding(.bottom, 24) }
                    }
                } else {
                    PhotoGrid(
                        model: results,
                        generation: library.generation &+ results.all.count,
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
                            remember(trimmed)
                            let ids = results.all.map(\.id)
                            let index = ids.firstIndex(of: request.id) ?? 0
                            var transaction = Transaction()
                            transaction.disablesAnimations = true
                            withTransaction(transaction) {
                                viewer = ViewerRequest(ids: ids, index: index, origin: request.frame, image: request.image, source: request.source)
                            }
                        },
                        onSelect: { _ in },
                        onFavorite: { id in
                            let current = library.photo(id: id)?.isFavorite ?? false
                            UIImpactFeedbackGenerator(style: current ? .light : .medium).impactOccurred()
                            library.setFavorite(!current, ids: [id])
                        },
                        onConceal: { library.setConcealed(true, ids: [$0]) },
                        onZoom: { _, _ in },
                        onVisiblePlaces: { _ in },
                        startsAtTop: true,
                        sharp: { id, side in await library.sharpPreview(id: id, side: side) }
                    )
                    .safeAreaInset(edge: .top, spacing: 0) { understoodBar }
                }
            }
            .navigationTitle(L("Szukaj"))
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always),
                        prompt: brain.searchAvailable ? L("Np. pies na plaży o zachodzie") : L("Zdjęcia, osoby, miejsca, rzeczy"))
            .onSubmit(of: .search) { remember(trimmed) }
            .task(id: query) { await search() }
            .onChange(of: library.generation) { _, _ in Task { await search() } }
            .translationTask(translation) { session in
                let source = translationSource
                guard !source.isEmpty, let response = try? await session.translate(source) else { return }
                translated[source] = response.targetText.lowercased()
                await search()
            }
            .toolbar {
                if showsClose {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(L("Zamknij")) { dismiss() }
                    }
                }
            }
            .syncControl(hidden: showsClose)
            .peopleDestinations()
            .fullScreenCover(isPresented: $showMap) {
                LibraryMapScreen()
                    .environmentObject(library)
            }
            .fullScreenCover(item: $viewer) { request in
                PhotoViewerHost(request: request)
                    .environmentObject(library)
                    .presentationBackground(.clear)
            }
        }
    }

    // MARK: What the search understood

    private var understoodBar: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !understood.chips.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(understood.chips) { chip in
                            Label(chip.title, systemImage: chip.symbol)
                                .font(.footnote.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Capsule().fill(GalleryTheme.accent.opacity(0.14)))
                                .foregroundStyle(GalleryTheme.accent)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            HStack(spacing: 6) {
                Text(PhotoCountWord.text(results.all.count))
                if searching { ProgressView().controlSize(.mini) }
                Spacer()
                Text(coverage).foregroundStyle(.tertiary)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 16)
        }
        .padding(.vertical, 8)
        .background(.bar)
    }

    @ViewBuilder
    private var coverageNote: some View {
        VStack(spacing: 4) {
            if brain.running, brain.totalCount > 0 {
                Text(L("Przejrzano \(brain.analyzedCount) z \(brain.totalCount) zdjęć. Wyniki będą coraz pełniejsze."))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Text(coverage)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 32)
    }

    /// How much of the library the search can see: analysed photos, picture vectors, scene labels.
    private var coverage: String {
        let stats = brain.searchStats
        return L("Indeks: \(stats.analyzed) · obraz \(stats.vectors) · sceny \(stats.labeled)\(brain.searchAvailable ? "" : L(" · bez CLIP"))")
    }

    // MARK: Before typing

    private var suggestions: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                if !brain.people.isEmpty {
                    section(L("Osoby")) {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(alignment: .top, spacing: 14) {
                                ForEach(brain.people.prefix(12)) { person in
                                    NavigationLink(value: PeopleRoute.person(person.id)) {
                                        VStack(spacing: 6) {
                                            FaceAvatar(face: person.coverFace, size: 64)
                                            Text(person.hasName ? person.name : " ")
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(.primary)
                                                .lineLimit(1)
                                                .frame(width: 72)
                                        }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                        .padding(.horizontal, -16)
                    }
                }
                if !recent.isEmpty {
                    section(L("Ostatnie")) {
                        VStack(alignment: .leading, spacing: 0) {
                            ForEach(recent, id: \.self) { item in
                                Button { query = item } label: {
                                    Label(item, systemImage: "clock.arrow.circlepath")
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.vertical, 10)
                                }
                                .buttonStyle(.plain)
                                Divider()
                            }
                            Button(L("Wyczyść ostatnie")) { recentRaw = "" }
                                .font(.footnote)
                                .padding(.top, 8)
                        }
                    }
                }
                if hasLocations {
                    Button { showMap = true } label: {
                        Label(L("Mapa zdjęć"), systemImage: "map")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(.bordered)
                }
                section(L("Odkrywaj")) {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], alignment: .leading, spacing: 10) {
                        ForEach(discover, id: \.0) { item in
                            Button { query = item.0 } label: {
                                Label(item.0, systemImage: item.1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
                Text(brain.searchAvailable
                     ? L("Opisz zdjęcie zwykłym zdaniem: kto, co, gdzie i kiedy. Na przykład „Ania nad morzem w lipcu”, „paragon z Biedronki” albo „góry zimą 2023”. Wszystko dzieje się na tym urządzeniu.")
                     : L("Wpisz osobę, miejsce, rok albo rzecz, np. „Kraków”, „2024” lub „pies”."))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding(16)
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.title3.weight(.bold))
            content()
        }
    }

    private var discover: [(String, String)] {
        var items: [(String, String)] = [
            (L("Ulubione"), "heart"), (L("Wideo"), "video"), (L("Selfie"), "person.crop.square"), (L("Portrety"), "cube"),
        ]
        if brain.searchAvailable {
            items += [
                (L("Zachód słońca"), "sun.horizon"), (L("Plaża"), "beach.umbrella"), (L("Góry"), "mountain.2"),
                (L("Śnieg"), "snowflake"), (L("Jedzenie"), "fork.knife"), (L("Zwierzęta"), "pawprint"),
                (L("Dokumenty"), "doc.text"), (L("Paragony"), "receipt"), (L("Urodziny"), "birthday.cake"),
                (L("Miasto nocą"), "building.2"),
            ]
        }
        return items
    }

    private var hasLocations: Bool {
        library.grid.all.contains { $0.latitude != nil }
    }
}

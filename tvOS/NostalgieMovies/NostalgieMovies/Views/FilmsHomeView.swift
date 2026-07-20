import SwiftUI

fileprivate enum FilmsHomeFocus: Hashable {
    case service(SearchSource)
    case showAll(String)
    case item(shelfID: String, itemID: String)
}

/// Zakładka Filmy — spójna nawigacja Siri Remote: serwis → półki → karty.
struct FilmsHomeView: View {
    @EnvironmentObject private var app: AppModel
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    @Binding var requestContentFocus: Bool

    @State private var shelves: [FilmsHomeShelf] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var serviceFilter: SearchSource = .all
    @State private var seriesInfo: VideoInfoResponse?
    @State private var selectedDetail: MediaSelection?
    @State private var presentedCatalog: SearchSource?
    @State private var openingSeries = false
    @State private var seriesAlert: String?
    @State private var didSetInitialFocus = false
    @FocusState private var focus: FilmsHomeFocus?

    /// Kolejność chipów = kolejność półek (CDA-HD pierwsze).
    private var serviceCases: [SearchSource] { [.all, .cdaHd, .cda, .tvp, .youtube] }

    private var visibleShelves: [FilmsHomeShelf] {
        if serviceFilter == .all { return shelves }
        return shelves.filter { shelfMatchesFilter($0) }
    }

    private func shelfMatchesFilter(_ shelf: FilmsHomeShelf) -> Bool {
        let key = shelf.source.lowercased()
        switch serviceFilter {
        case .all: return true
        case .cdaHd: return key.contains("cda-hd")
        case .cda: return key == "cda"
        case .tvp: return key.contains("tvp")
        case .youtube: return key.contains("youtube")
        case .appleMusic: return false
        }
    }

    var body: some View {
        homeContent
            .overlay { openingOverlay }
            .fullScreenCover(item: $selectedDetail) { detail in
                MediaDetailView(selection: detail) {
                    Task { await openSeries(url: detail.url) }
                }
                .environmentObject(app)
            }
            .fullScreenCover(item: $presentedCatalog) { src in
                LatestCdaHdCatalogView(source: src, initialMode: .all)
                    .environmentObject(app)
            }
            .fullScreenCover(item: $seriesInfo) { series in
                SeriesEpisodesView(info: series, backLabel: "Wróć do filmów") {
                    seriesInfo = nil
                }
                .environmentObject(app)
            }
            .alert("Nie udało się otworzyć serialu", isPresented: Binding(
                get: { seriesAlert != nil },
                set: { if !$0 { seriesAlert = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(seriesAlert ?? "")
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .task { await loadHome() }
            .onChange(of: requestContentFocus) { _, requested in
                guard requested else { return }
                focus = .service(serviceFilter)
                requestContentFocus = false
            }
            .onChange(of: focus) { _, newFocus in
                // Focus na chipie serwisu = od razu filtr (bez klika).
                if case .service(let src) = newFocus, serviceFilter != src {
                    serviceFilter = src
                }
            }
    }

    private var openingOverlay: some View {
        Group {
            if openingSeries {
                ZStack {
                    Color.black.opacity(0.55)
                    VStack(spacing: 16) {
                        ProgressView().scaleEffect(1.4)
                        Text("Ładuję odcinki…")
                            .font(NostalgieFont.rowTitle)
                            .foregroundStyle(.white)
                        Text("CDA-HD · to może potrwać do ~90 s")
                            .font(NostalgieFont.caption)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    .padding(28)
                    .background(NostalgieTheme.card, in: RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
                }
                .ignoresSafeArea()
            }
        }
    }

    private var homeContent: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    Color.clear.frame(height: 1).id("filmsTop")

                    ScreenTitle(
                        title: "Filmy",
                        subtitle: "Wybierz serwis, potem ↓ do półek"
                    )

                    if let errorMessage, !shelves.isEmpty {
                        Text(errorMessage)
                            .font(NostalgieFont.metadata)
                            .foregroundStyle(.orange)
                            .padding(.vertical, 4)
                    }

                    servicePicker
                        .id("servicePicker")
                        .focusSection()

                    if isLoading && shelves.isEmpty {
                        ProgressView("Ładuję katalogi…")
                            .padding(.top, 24)
                    } else if let errorMessage, shelves.isEmpty {
                        EmptyStateView(
                            icon: "exclamationmark.triangle",
                            title: "Nie udało się załadować",
                            message: errorMessage
                        )
                        Button("Spróbuj ponownie") { Task { await loadHome() } }
                            .buttonStyle(FocusCardButtonStyle())
                            .focusEffectDisabled()
                    } else if visibleShelves.isEmpty {
                        EmptyStateView(
                            icon: "film",
                            title: "Brak pozycji",
                            message: "Ten serwis nie zwrócił teraz wyników. Wybierz inny albo otwórz Szukaj."
                        )
                    } else {
                        ForEach(Array(visibleShelves.enumerated()), id: \.element.id) { index, shelf in
                            FilmsServiceShelf(
                                shelf: shelf,
                                focus: $focus,
                                isFirst: index == 0,
                                isLast: index == visibleShelves.count - 1,
                                onSelect: { item in Task { await openItem(item) } },
                                onShowAll: { presentedCatalog = sourceForShelf(shelf) },
                                onMoveUpFromFirst: {
                                    focus = .service(serviceFilter)
                                },
                                onMoveToShelf: { direction in
                                    moveShelf(from: index, direction: direction)
                                }
                            )
                            .id("shelf-\(shelf.id)")
                            .focusSection()
                        }
                    }

                    // Duży „podest” — focus nie cofa scrolla na górę przy ostatniej półce.
                    Color.clear
                        .frame(height: 220)
                        .id("filmsBottom")
                }
                .padding(.horizontal, NostalgieSpacing.screenH)
                .padding(.bottom, 120)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .onExitCommand {
                focusedTab.wrappedValue = navigationTab
            }
            .onChange(of: focus) { _, newFocus in
                guard let newFocus else { return }
                withAnimation(.easeOut(duration: 0.2)) {
                    switch newFocus {
                    case .service:
                        proxy.scrollTo("filmsTop", anchor: .top)
                    case .showAll(let shelfID), .item(let shelfID, _):
                        proxy.scrollTo("shelf-\(shelfID)", anchor: .center)
                    }
                }
            }
            .onAppear {
                if !didSetInitialFocus {
                    didSetInitialFocus = true
                    focus = .service(serviceFilter)
                }
            }
        }
    }

    private var servicePicker: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Serwis")
                .font(NostalgieFont.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.8)

            HStack(spacing: 14) {
                ForEach(Array(serviceCases.enumerated()), id: \.element.id) { index, src in
                    Button {
                        serviceFilter = src
                        focus = .service(src)
                    } label: {
                        if let icon = src.systemImage {
                            Label(src.filmsChipLabel, systemImage: icon)
                        } else {
                            Text(src.filmsChipLabel)
                        }
                    }
                    .buttonStyle(ChipButtonStyle(isSelected: serviceFilter == src))
                    .focusEffectDisabled()
                    .focused($focus, equals: .service(src))
                    .onMoveCommand { direction in
                        handleServiceMove(index: index, direction: direction)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func handleServiceMove(index: Int, direction: MoveCommandDirection) {
        switch direction {
        case .up:
            focusedTab.wrappedValue = navigationTab
        case .down:
            focusFirstItem(in: visibleShelves.first)
        case .left:
            let prev = max(0, index - 1)
            focus = .service(serviceCases[prev])
        case .right:
            let next = min(serviceCases.count - 1, index + 1)
            focus = .service(serviceCases[next])
        default:
            break
        }
    }

    private func moveShelf(from index: Int, direction: MoveCommandDirection) {
        switch direction {
        case .up:
            if index == 0 {
                focus = .service(serviceFilter)
            } else {
                focusFirstItem(in: visibleShelves[index - 1])
            }
        case .down:
            if index + 1 < visibleShelves.count {
                focusFirstItem(in: visibleShelves[index + 1])
            }
            // Ostatnia półka: zostań — nie wracaj na górę.
        default:
            break
        }
    }

    private func focusFirstItem(in shelf: FilmsHomeShelf?) {
        guard let shelf, let first = shelf.items.first else {
            focus = .service(serviceFilter)
            return
        }
        focus = .item(shelfID: shelf.id, itemID: first.id)
    }

    private func loadHome() async {
        let hadContent = !shelves.isEmpty
        if !hadContent { isLoading = true }
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await app.api.fetchFilmsHome(limit: 16)
            shelves = response.shelves
        } catch {
            errorMessage = error.localizedDescription
        }
    }


    private func sourceForShelf(_ shelf: FilmsHomeShelf) -> SearchSource {
        let key = shelf.source.lowercased()
        if key.contains("cda-hd") { return .cdaHd }
        if key == "cda" { return .cda }
        if key.contains("tvp") { return .tvp }
        if key.contains("youtube") { return .youtube }
        return .all
    }

    private func openItem(_ item: SearchResultItem) async {
        let looksLikeSeries =
            item.isSerial == true
            || item.url.localizedCaseInsensitiveContains("/tvshows/")
            || item.url.localizedCaseInsensitiveContains("/tvshow/")
        if looksLikeSeries {
            await openSeries(url: item.url, fallback: item)
            return
        }
        selectedDetail = MediaSelection(from: item)
    }

    private func openSeries(url: String, fallback: SearchResultItem? = nil) async {
        openingSeries = true
        seriesAlert = nil
        defer { openingSeries = false }
        do {
            let info = try await app.api.fetchInfo(url: url)
            if info.isPlaylist == true, !info.playableEpisodes.isEmpty {
                seriesInfo = info
                return
            }
            seriesAlert = "Nie znaleziono listy odcinków. Spróbuj ponownie za chwilę."
        } catch {
            seriesAlert = error.localizedDescription
        }
    }
}

private extension SearchSource {
    var filmsChipLabel: String {
        switch self {
        case .all: return "Wszystkie"
        case .cdaHd: return "CDA-HD"
        case .cda: return "CDA"
        case .tvp: return "TVP VOD"
        case .youtube: return "YouTube"
        case .appleMusic: return "Apple Music"
        }
    }
}

/// Półka jednego serwisu — własny tor focusu (bez wspólnego ID między półkami).
fileprivate struct FilmsServiceShelf: View {
    let shelf: FilmsHomeShelf
    var focus: FocusState<FilmsHomeFocus?>.Binding
    var isFirst: Bool
    var isLast: Bool
    let onSelect: (SearchResultItem) -> Void
    var onShowAll: (() -> Void)? = nil
    var onMoveUpFromFirst: (() -> Void)? = nil
    var onMoveToShelf: ((MoveCommandDirection) -> Void)? = nil

    @EnvironmentObject private var app: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(shelf.title)
                        .font(NostalgieFont.rounded(28, weight: .bold))
                    if let subtitle = shelf.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(NostalgieFont.metadata)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 8)
                SourceBadgeView(source: MediaCardCopy.normalizedSourceKey(shelf.source))
                if let onShowAll {
                    Button(action: onShowAll) {
                        Label("Wszystkie", systemImage: "square.grid.2x2")
                    }
                    .buttonStyle(FocusCardButtonStyle())
                    .focusEffectDisabled()
                    .focused(focus, equals: .showAll(shelf.id))
                    .onMoveCommand { direction in
                        if direction == .down, let first = shelf.items.first {
                            focus.wrappedValue = .item(shelfID: shelf.id, itemID: first.id)
                        } else if direction == .up {
                            onMoveToShelf?(.up)
                        } else if direction == .left || direction == .right {
                            // zostań na nagłówku
                        }
                    }
                }
            }

            if shelf.items.isEmpty {
                Text("Brak pozycji.")
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.secondary)
                    .frame(height: 80, alignment: .leading)
            } else {
                ScrollViewReader { hProxy in
                    ScrollView(.horizontal, showsIndicators: false) {
                        LazyHStack(spacing: 22) {
                            ForEach(Array(shelf.items.enumerated()), id: \.element.id) { index, item in
                                MediaCard(
                                    title: item.title,
                                    subtitle: MediaCardCopy.cleanedSubtitle(detail: item.detail, source: item.source),
                                    thumbnailURL: item.thumbnail.flatMap(URL.init(string:)),
                                    source: MediaCardCopy.normalizedSourceKey(item.source),
                                    typeLabel: (item.isSerial == true || item.url.localizedCaseInsensitiveContains("/tvshows/")) ? "SERIAL" : "FILM",
                                    quality: item.quality,
                                    duration: item.duration,
                                    isPremium: item.premium == true,
                                    isFavorite: app.isFavorite(item.url),
                                    layout: .shelf
                                ) {
                                    onSelect(item)
                                }
                                .frame(width: 280)
                                .id(item.id)
                                .focused(focus, equals: .item(shelfID: shelf.id, itemID: item.id))
                                .onMoveCommand { direction in
                                    handleItemMove(index: index, direction: direction)
                                }
                            }
                        }
                        .scrollTargetLayout()
                        .padding(.vertical, 10)
                    }
                    .fullBleedShelf()
                    .frame(height: 370)
                    .scrollPosition(id: Binding(
                        get: {
                            if case .item(let shelfID, let itemID) = focus.wrappedValue, shelfID == shelf.id {
                                return itemID
                            }
                            return nil
                        },
                        set: { newID in
                            if let newID {
                                focus.wrappedValue = .item(shelfID: shelf.id, itemID: newID)
                            }
                        }
                    ))
                    .scrollTargetBehavior(.viewAligned)
                }
            }
        }
    }

    private func handleItemMove(index: Int, direction: MoveCommandDirection) {
        switch direction {
        case .up:
            if onShowAll != nil {
                focus.wrappedValue = .showAll(shelf.id)
            } else if isFirst {
                onMoveUpFromFirst?()
            } else {
                onMoveToShelf?(.up)
            }
        case .down:
            onMoveToShelf?(.down)
        case .left:
            if index > 0 {
                let prev = shelf.items[index - 1]
                focus.wrappedValue = .item(shelfID: shelf.id, itemID: prev.id)
            }
        case .right:
            if index + 1 < shelf.items.count {
                let next = shelf.items[index + 1]
                focus.wrappedValue = .item(shelfID: shelf.id, itemID: next.id)
            }
        default:
            break
        }
    }
}

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
    @State private var cdaHdShelves: [FilmsHomeShelf] = []
    @State private var shelfPageByID: [String: Int] = [:]
    @State private var shelfHasMoreByID: [String: Bool] = [:]
    @State private var shelfLoadingMoreIDs: Set<String> = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var serviceFilter: SearchSource = .all
    @State private var seriesOpen: SeriesOpenRequest?
    @State private var selectedDetail: MediaSelection?
    @State private var presentedCatalog: SearchSource?
    @State private var presentedBrowse: CdaHdBrowseContext?
    @State private var presentedCatalogMode: FilmsCatalogMode = .all
    @State private var didSetInitialFocus = false
    @FocusState private var focus: FilmsHomeFocus?

    /// Kolejność chipów = kolejność półek (CDA-HD pierwsze).
    private var serviceCases: [SearchSource] { [.all, .cdaHd, .cda, .tvp, .youtube] }

    private var visibleShelves: [FilmsHomeShelf] {
        if serviceFilter == .cdaHd {
            return cdaHdShelves.isEmpty ? shelves.filter { shelfMatchesFilter($0) } : cdaHdShelves
        }
        if serviceFilter == .all { return shelves }
        return shelves.filter { shelfMatchesFilter($0) }
    }

    private var isCdaHdMode: Bool { serviceFilter == .cdaHd }

    private var homeTitle: String { isCdaHdMode ? "CDA-HD" : "Filmy" }

    private var homeSubtitle: String {
        if isCdaHdMode {
            return "Przesuwaj w prawo · gatunki jak w Apple TV+"
        }
        return "Wybierz serwis, potem ↓ do półek"
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
            .fullScreenCover(item: $selectedDetail) { detail in
                MediaDetailView(selection: detail) {
                    openSeries(url: detail.url, title: detail.title, thumbnail: detail.thumbnail)
                }
                .environmentObject(app)
            }
            .fullScreenCover(item: $presentedCatalog) { src in
                LatestCdaHdCatalogView(source: src, initialMode: presentedCatalogMode)
                    .environmentObject(app)
            }
            .fullScreenCover(item: $presentedBrowse) { ctx in
                CdaHdBrowseView(context: ctx)
                    .environmentObject(app)
            }
            .fullScreenCover(item: $seriesOpen) { req in
                SeriesEpisodesLoaderView(request: req, backLabel: "Wróć do filmów") {
                    seriesOpen = nil
                }
                .environmentObject(app)
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
            .onChange(of: serviceFilter) { _, src in
                if src == .cdaHd {
                    Task { await loadCdaHdHomeIfNeeded() }
                }
            }
    }


    private var homeContent: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    Color.clear.frame(height: 1).id("filmsTop")

                    ScreenTitle(
                        title: homeTitle,
                        subtitle: homeSubtitle
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
                                applePlusStyle: isCdaHdMode,
                                isLoadingMore: shelfLoadingMoreIDs.contains(shelf.id),
                                onSelect: { item in Task { await openItem(item) } },
                                onShowAll: { openShelfCollection(shelf) },
                                onLoadMore: { Task { await loadMoreItems(for: shelf) } },
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

    private func loadCdaHdHomeIfNeeded(force: Bool = false) async {
        if !force, !cdaHdShelves.isEmpty { return }
        do {
            let response = try await app.api.fetchCdaHdHome(limit: 22)
            let rows = response.shelves.filter { !$0.items.isEmpty }
            cdaHdShelves = rows
            for row in rows {
                shelfPageByID[row.id] = 1
                // Gatunki / katalogi mają kolejne strony; startujemy z założeniem hasMore.
                shelfHasMoreByID[row.id] = true
            }
            if focus == nil || focus == .service(.cdaHd) {
                focusFirstItem(in: cdaHdShelves.first)
            }
        } catch {
            if cdaHdShelves.isEmpty {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func updateShelfItems(_ shelfID: String, transform: (FilmsHomeShelf) -> FilmsHomeShelf) {
        if let idx = cdaHdShelves.firstIndex(where: { $0.id == shelfID }) {
            cdaHdShelves[idx] = transform(cdaHdShelves[idx])
            return
        }
        if let idx = shelves.firstIndex(where: { $0.id == shelfID }) {
            shelves[idx] = transform(shelves[idx])
        }
    }

    private func currentShelf(id: String) -> FilmsHomeShelf? {
        cdaHdShelves.first(where: { $0.id == id }) ?? shelves.first(where: { $0.id == id })
    }

    private func loadMoreItems(for shelf: FilmsHomeShelf) async {
        guard shelfHasMoreByID[shelf.id] != false else { return }
        guard !shelfLoadingMoreIDs.contains(shelf.id) else { return }
        shelfLoadingMoreIDs.insert(shelf.id)
        defer { shelfLoadingMoreIDs.remove(shelf.id) }

        let nextPage = (shelfPageByID[shelf.id] ?? 1) + 1
        let beforeCount = currentShelf(id: shelf.id)?.items.count ?? shelf.items.count
        do {
            let fresh: [SearchResultItem]
            let hasMore: Bool
            if let browse = shelf.browseUrl, !browse.isEmpty {
                let response = try await app.api.fetchCdaHdBrowse(url: browse, page: nextPage, limit: 24)
                fresh = response.items
                hasMore = response.hasMore ?? !response.items.isEmpty
            } else {
                let mode = FilmsCatalogMode(rawValue: shelf.catalogMode ?? "latest") ?? .latest
                let kind: FilmsCatalogKind
                switch shelf.catalogType {
                case "film": kind = .film
                case "serial": kind = .serial
                default: kind = .all
                }
                let response = try await app.api.fetchFilmsCatalog(
                    source: sourceForShelf(shelf),
                    mode: mode,
                    type: kind,
                    page: nextPage,
                    pageSize: 24
                )
                fresh = response.items
                hasMore = response.hasMore ?? (response.items.count >= 24)
            }

            shelfPageByID[shelf.id] = nextPage
            if fresh.isEmpty {
                shelfHasMoreByID[shelf.id] = false
                return
            }

            updateShelfItems(shelf.id) { $0.appending(fresh) }
            let afterCount = currentShelf(id: shelf.id)?.items.count ?? beforeCount
            let grew = afterCount > beforeCount
            shelfHasMoreByID[shelf.id] = grew ? hasMore : (hasMore || nextPage < 8)
            if !grew && !hasMore {
                shelfHasMoreByID[shelf.id] = false
            }
        } catch {
            // Zostaw hasMore — kolejny focus ponowi (wolny listing CDA-HD).
        }
    }

    private func openShelfCollection(_ shelf: FilmsHomeShelf) {
        if let browse = shelf.browseUrl, !browse.isEmpty {
            presentedBrowse = CdaHdBrowseContext(title: shelf.title, pageURL: browse)
            return
        }
        presentedCatalogMode = FilmsCatalogMode(rawValue: shelf.catalogMode ?? "all") ?? .all
        presentedCatalog = sourceForShelf(shelf)
    }

    private func loadHome() async {
        let hadContent = !shelves.isEmpty
        if !hadContent { isLoading = true }
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await app.api.fetchFilmsHome(limit: 16)
            shelves = response.shelves
            for row in response.shelves {
                if shelfPageByID[row.id] == nil {
                    shelfPageByID[row.id] = 1
                    shelfHasMoreByID[row.id] = true
                }
            }
            Task { await loadCdaHdHomeIfNeeded() }
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
            openSeries(url: item.url, fallback: item)
            return
        }
        selectedDetail = MediaSelection(from: item)
    }

    private func openSeries(url: String, title: String = "Serial", thumbnail: String? = nil, fallback: SearchResultItem? = nil) {
        seriesOpen = SeriesOpenRequest(
            url: url,
            title: fallback?.title ?? title,
            thumbnail: fallback?.thumbnail ?? thumbnail
        )
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
    var applePlusStyle: Bool = false
    var isLoadingMore: Bool = false
    let onSelect: (SearchResultItem) -> Void
    var onShowAll: (() -> Void)? = nil
    var onLoadMore: (() -> Void)? = nil
    var onMoveUpFromFirst: (() -> Void)? = nil
    var onMoveToShelf: ((MoveCommandDirection) -> Void)? = nil

    @EnvironmentObject private var app: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: applePlusStyle ? 22 : 14) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(shelf.title)
                        .font(NostalgieFont.rounded(applePlusStyle ? 34 : 28, weight: .bold))
                    if let subtitle = shelf.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(NostalgieFont.metadata)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 8)
                if !applePlusStyle {
                    SourceBadgeView(source: MediaCardCopy.normalizedSourceKey(shelf.source))
                }
                if let onShowAll {
                    Button(action: onShowAll) {
                        Label(applePlusStyle ? "Zobacz wszystkie" : "Wszystkie", systemImage: "square.grid.2x2")
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
                                .frame(width: applePlusStyle ? 300 : 280)
                                .id(item.id)
                                .focused(focus, equals: .item(shelfID: shelf.id, itemID: item.id))
                                .onMoveCommand { direction in
                                    handleItemMove(index: index, direction: direction)
                                }
                                .onChange(of: focus.wrappedValue) { _, newFocus in
                                    guard case .item(let shelfID, let itemID) = newFocus,
                                          shelfID == shelf.id,
                                          itemID == item.id else { return }
                                    // Dociągaj kolejne, zanim focus dojdzie do samego końca taśmy.
                                    if index >= max(0, shelf.items.count - 4) {
                                        onLoadMore?()
                                    }
                                }
                            }

                            if isLoadingMore {
                                ProgressView()
                                    .frame(width: 80, height: 180)
                            }
                        }
                        .scrollTargetLayout()
                        // Zapas pod scale focus (~1.12), żeby plakat/tytuł nie ucinały się od góry.
                        .padding(.vertical, applePlusStyle ? 40 : 28)
                    }
                    .fullBleedShelf()
                    .frame(height: applePlusStyle ? 480 : 430)
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
                if index + 1 >= shelf.items.count - 4 {
                    onLoadMore?()
                }
            } else {
                onLoadMore?()
            }
        default:
            break
        }
    }
}

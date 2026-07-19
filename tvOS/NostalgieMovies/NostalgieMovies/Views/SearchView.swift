import SwiftUI

private enum SearchFocus: Hashable {
    case query
    case searchButton
    case source(SearchSource)
    case access(CdaAccessFilter)
    case sort(SearchSort)
}

struct SearchView: View {
    @EnvironmentObject private var app: AppModel
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    @Binding var requestContentFocus: Bool

    @State private var query = ""
    @State private var source: SearchSource = .all
    @State private var sort: SearchSort = .relevance
    @State private var access: CdaAccessFilter = .all
    @State private var results: [SearchResultItem] = []
    @State private var page = 1
    @State private var totalResults = 0
    @State private var hasMore = false
    @State private var isLoading = false
    @State private var isLoadingMore = false
    @State private var errorMessage: String?
    @State private var seriesInfo: VideoInfoResponse?
    @State private var selectedDetail: MediaSelection?
    @State private var showLatestCatalog = false
    @State private var latestItems: [SearchResultItem] = []
    @State private var gridColumnCount = 4
    @FocusState private var latestFocusedID: String?
    @FocusState private var localFocus: SearchFocus?

    private let pageSize = 24
    private let cardMinimum: CGFloat = 300
    private let gridSpacing: CGFloat = 32
    private let columns = [GridItem(.adaptive(minimum: 300, maximum: 360), spacing: 32)]


    var body: some View {
        Group {
            if let series = seriesInfo {
                SeriesEpisodesView(info: series, backLabel: "Wróć do wyników") {
                    seriesInfo = nil
                }
                .environmentObject(app)
            } else {
                searchContent
                    .fullScreenCover(item: $selectedDetail) { detail in
                        MediaDetailView(selection: detail) {
                            Task { await openSeriesFromDetail(detail.url) }
                        }
                        .environmentObject(app)
                    }
                    .fullScreenCover(isPresented: $showLatestCatalog) {
                        LatestCdaHdCatalogView()
                            .environmentObject(app)
                    }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task {
            await app.refreshFavorites()
        }
        .onChange(of: requestContentFocus) { _, requested in
            guard requested else { return }
            localFocus = .query
            requestContentFocus = false
        }
    }

    private var searchContent: some View {
        ScrollViewReader { scrollProxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: NostalgieSpacing.section) {
                    Color.clear.frame(height: 1).id("searchTop")

                    ScreenTitle(title: "Filmy", subtitle: "Filmy i seriale — bez muzyki")

                    searchControls
                        .defaultFocus($localFocus, .query)

                    LatestCdaHdRow(
                        focusedItemID: $latestFocusedID,
                        onSelect: { item in
                            Task { await openLatestItem(item) }
                        },
                        onShowAll: { showLatestCatalog = true },
                        onMoveUp: { localFocus = .query },
                        onItemsChange: { latestItems = $0 }
                    )

                    GridColumnReader(minimumCardWidth: cardMinimum, spacing: gridSpacing, columnCount: $gridColumnCount)

                    if isLoading {
                        ProgressView("Szukam…")
                            .padding(.top, 8)
                    } else if let errorMessage {
                        EmptyStateView(
                            icon: "exclamationmark.magnifyingglass",
                            title: "Błąd wyszukiwania",
                            message: errorMessage
                        )
                    } else if !results.isEmpty {
                        resultsHeader
                        resultsGrid
                    } else if !query.trimmingCharacters(in: .whitespaces).isEmpty {
                        EmptyStateView(
                            icon: "magnifyingglass",
                            title: "Brak wyników",
                            message: "Spróbuj innej frazy, źródła lub sortowania."
                        )
                    }
                }
                .padding(.horizontal, NostalgieSpacing.screenH)
                .padding(.bottom, NostalgieSpacing.scrollBottom)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .onPlayPauseCommand {
                localFocus = .query
            }
            .onExitCommand {
                if !query.isEmpty || !results.isEmpty {
                    query = ""
                    results = []
                    totalResults = 0
                    localFocus = .query
                } else {
                    focusedTab.wrappedValue = navigationTab
                }
            }
            .onChange(of: localFocus) { _, focus in
                guard let focus else { return }
                switch focus {
                case .query, .searchButton, .source, .access, .sort:
                    withAnimation(NostalgieTheme.contentSpring) {
                        scrollProxy.scrollTo("searchTop", anchor: .top)
                    }
                }
            }
        }
    }

    private var searchControls: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 20) {
                HStack(spacing: 14) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Tytuł, serial, film…", text: $query)
                        .textFieldStyle(.plain)
                        .font(NostalgieFont.field)
                        .onSubmit {
                            Task { await runSearch(resetPage: true) }
                        }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .background(localFocus == .query ? NostalgieTheme.cardFocused : NostalgieTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous)
                        .stroke(localFocus == .query ? Color.white.opacity(0.9) : Color.white.opacity(0.08), lineWidth: localFocus == .query ? 3 : 1)
                }
                .focused($localFocus, equals: .query)
                .animation(NostalgieTheme.focusSpring, value: localFocus == .query)
                .onMoveCommand { direction in
                    if direction == .up {
                        focusedTab.wrappedValue = navigationTab
                    } else if direction == .down {
                        localFocus = .source(source)
                    }
                }

                Button {
                    Task { await runSearch(resetPage: true) }
                } label: {
                    Label("Szukaj", systemImage: "arrow.right.circle.fill")
                }
                .buttonStyle(FocusCardButtonStyle())
                .focused($localFocus, equals: .searchButton)
                .onMoveCommand { direction in
                    if direction == .up {
                        focusedTab.wrappedValue = navigationTab
                    } else if direction == .down {
                        localFocus = .source(source)
                    }
                }
                .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty || isLoading)
            }
            .frame(maxWidth: 980)

            filterRow(title: "Źródło") {
                ForEach(SearchSource.filmCases) { src in
                    Button {
                        source = src
                        if !SearchSort.options(for: src).contains(sort) {
                            sort = .relevance
                        }
                        if src != .cda && src != .all {
                            access = .all
                        }
                        Task { await runSearch(resetPage: true) }
                    } label: {
                        if let icon = src.systemImage {
                            Label(src.label, systemImage: icon)
                        } else {
                            Text(src.label)
                        }
                    }
                    .buttonStyle(ChipButtonStyle(isSelected: source == src))
                    .focused($localFocus, equals: .source(src))
                    .onMoveCommand { direction in
                        if direction == .up {
                            localFocus = .query
                        } else if direction == .down {
                            if showsCdaAccessFilter {
                                localFocus = .access(access)
                            } else if !results.isEmpty || totalResults > 0 {
                                localFocus = .sort(sort)
                            }
                        }
                    }
                }
            }

            if showsCdaAccessFilter {
                filterRow(title: "CDA — dostęp") {
                    ForEach(CdaAccessFilter.allCases) { option in
                        Button(option.label) {
                            access = option
                            Task { await runSearch(resetPage: true) }
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: access == option))
                        .focused($localFocus, equals: .access(option))
                        .onMoveCommand { direction in
                            if direction == .up {
                                localFocus = .source(source)
                            } else if direction == .down, !results.isEmpty || totalResults > 0 {
                                localFocus = .sort(sort)
                            } else if direction == .down {
                                localFocus = nil
                            }
                        }
                    }
                }
            }

            if !results.isEmpty || totalResults > 0 {
                filterRow(title: "Sortuj") {
                    ForEach(SearchSort.options(for: source)) { option in
                        Button(option.label) {
                            sort = option
                            Task { await runSearch(resetPage: true) }
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: sort == option))
                        .focused($localFocus, equals: .sort(option))
                        .onMoveCommand { direction in
                            if direction == .up {
                                if showsCdaAccessFilter {
                                    localFocus = .access(access)
                                } else {
                                    localFocus = .source(source)
                                }
                            } else if direction == .down, !results.isEmpty {
                                localFocus = nil
                            }
                        }
                    }
                }
            }
        }
    }

    private func filterRow<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(NostalgieFont.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.6)
            HStack(spacing: 12) {
                content()
            }
            .padding(.vertical, 2)
        }
    }

    private var resultsHeader: some View {
        HStack(spacing: 16) {
            Text(results.count >= totalResults && totalResults > 0
                ? "\(results.count) wyników"
                : "\(results.count) z \(totalResults) wyników")
                .font(NostalgieFont.metadata)
                .foregroundStyle(.secondary)
            if !app.favoriteURLs.isEmpty {
                Label("\(app.favoriteURLs.count) ulub.", systemImage: "heart.fill")
                    .foregroundStyle(.secondary)
                    .font(NostalgieFont.caption)
            }
            if isLoadingMore {
                ProgressView()
            }
            Spacer()
        }
    }

    private var resultsGrid: some View {
        LazyVGrid(columns: columns, spacing: gridSpacing) {
            ForEach(Array(results.enumerated()), id: \.element.id) { index, item in
                MediaCard(
                    title: item.title,
                    subtitle: MediaCardCopy.cleanedSubtitle(detail: item.detail, source: item.source),
                    thumbnailURL: item.thumbnail.flatMap(URL.init(string:)),
                    source: MediaCardCopy.normalizedSourceKey(item.source),
                    typeLabel: (item.isSerial == true || item.url.localizedCaseInsensitiveContains("/tvshows/")) ? "SERIAL" : "FILM",
                    quality: item.quality,
                    duration: item.duration,
                    isPremium: item.premium == true,
                    isFavorite: app.isFavorite(item.url)
                ) {
                    Task { await openSearchResult(item) }
                }
                .onGridMoveUp(columnCount: gridColumnCount, index: index) {
                    focusTargetAboveResults()
                }
                .onInfiniteScrollLoadMore(
                    itemID: item.id,
                    lastItemID: results.last?.id,
                    canLoadMore: hasMore,
                    isLoading: isLoadingMore
                ) {
                    Task { await loadMoreResults() }
                }
            }
        }
        .padding(.top, 4)
    }

    private var showsCdaAccessFilter: Bool {
        source == .cda || source == .all
    }

    private func focusTargetAboveResults() {
        if !results.isEmpty || totalResults > 0 {
            localFocus = .sort(sort)
        } else {
            localFocus = .searchButton
        }
    }

    private func loadMoreResults() async {
        guard hasMore, !isLoading, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        page += 1
        await runSearch(resetPage: false, append: true)
    }

    private func runSearch(resetPage: Bool, append: Bool = false) async {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        if resetPage {
            page = 1
            hasMore = false
        }
        if append {
            guard hasMore else { return }
        } else {
            isLoading = true
            errorMessage = nil
        }
        defer { if !append { isLoading = false } }
        do {
            let response = try await app.api.search(
                query: trimmed,
                source: source,
                page: page,
                pageSize: pageSize,
                sort: sort,
                access: showsCdaAccessFilter ? access : .all
            )
            if append {
                let existing = Set(results.map(\.id))
                results.append(contentsOf: response.results.filter { !existing.contains($0.id) })
            } else {
                results = response.results
            }
            totalResults = response.total ?? max(results.count, response.results.count)
            hasMore = response.hasMore ?? false
            if response.results.isEmpty {
                hasMore = false
            }
            page = response.page ?? page
        } catch {
            if append {
                page = max(1, page - 1)
                hasMore = false
            } else {
                errorMessage = error.localizedDescription
                results = []
                totalResults = 0
                hasMore = false
            }
        }
    }

    private func openSearchResult(_ item: SearchResultItem) async {
        let looksLikeSeries =
            item.isSerial == true
            || item.url.localizedCaseInsensitiveContains("/tvshows/")
            || item.url.localizedCaseInsensitiveContains("/tvshow/")
            || (item.detail?.localizedCaseInsensitiveContains("serial") == true)
        if looksLikeSeries {
            do {
                let info = try await app.api.fetchInfo(url: item.url)
                if info.isPlaylist == true, !info.playableEpisodes.isEmpty {
                    seriesInfo = info
                    return
                }
            } catch {
                errorMessage = error.localizedDescription
                return
            }
        }
        selectedDetail = MediaSelection(from: item)
    }

    private func openLatestItem(_ item: SearchResultItem) async {
        if item.isSerial == true {
            do {
                let info = try await app.api.fetchInfo(url: item.url)
                if info.isPlaylist == true, !info.playableEpisodes.isEmpty {
                    seriesInfo = info
                    return
                }
            } catch {
                errorMessage = error.localizedDescription
                return
            }
        }
        selectedDetail = MediaSelection(from: item)
    }

    private func openSeriesFromDetail(_ url: String) async {
        selectedDetail = nil
        do {
            let info = try await app.api.fetchInfo(url: url)
            if info.isPlaylist == true, !info.playableEpisodes.isEmpty {
                seriesInfo = info
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

import SwiftUI

private enum SearchFocus: Hashable {
    case query
    case searchButton
    case source(SearchSource)
    case access(CdaAccessFilter)
    case sort(SearchSort)
    case result(String)
}

/// Zakładka Szukaj — wyłącznie wyszukiwanie filmów/seriali z intuicyjnym focusem.
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
    @State private var openingSeries = false
    @State private var seriesAlert: String?
    @State private var errorMessage: String?
    @State private var seriesInfo: VideoInfoResponse?
    @State private var selectedDetail: MediaSelection?
    @State private var gridColumnCount = 4
    @State private var searchTask: Task<Void, Never>?
    @FocusState private var localFocus: SearchFocus?

    private let pageSize = 24
    private let cardMinimum: CGFloat = 300
    private let gridSpacing: CGFloat = 32
    private let columns = [GridItem(.adaptive(minimum: 300, maximum: 360), spacing: 32)]

    var body: some View {
        searchContent
            .overlay { openingOverlay }
            .fullScreenCover(item: $selectedDetail) { detail in
                MediaDetailView(selection: detail) {
                    Task { await openSeriesFromDetail(detail.url) }
                }
                .environmentObject(app)
            }
            .fullScreenCover(item: $seriesInfo) { series in
                SeriesEpisodesView(info: series, backLabel: "Wróć do wyszukiwania") {
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
            .task { await app.refreshFavorites() }
            .onChange(of: requestContentFocus) { _, requested in
                guard requested else { return }
                localFocus = .query
                requestContentFocus = false
            }
            .onDisappear { searchTask?.cancel() }
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
                    }
                    .padding(28)
                    .background(NostalgieTheme.card, in: RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
                }
                .ignoresSafeArea()
            }
        }
    }

    private var searchContent: some View {
        ScrollViewReader { scrollProxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: NostalgieSpacing.section) {
                    Color.clear.frame(height: 1).id("searchTop")

                    ScreenTitle(
                        title: "Szukaj",
                        subtitle: "Wybierz serwis, wpisz tytuł — nawigacja Siri Remote: ↑ zakładki · ↓ wyniki"
                    )

                    searchControls
                        .defaultFocus($localFocus, .query)
                        .focusSection()

                    GridColumnReader(minimumCardWidth: cardMinimum, spacing: gridSpacing, columnCount: $gridColumnCount)

                    resultsArea
                        .focusSection()
                }
                .padding(.horizontal, NostalgieSpacing.screenH)
                .padding(.bottom, NostalgieSpacing.scrollBottom)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .onPlayPauseCommand { localFocus = .query }
            .onExitCommand {
                if localFocus != .query && (!query.isEmpty || !results.isEmpty) {
                    localFocus = .query
                } else if !query.isEmpty || !results.isEmpty {
                    searchTask?.cancel()
                    query = ""
                    results = []
                    totalResults = 0
                    errorMessage = nil
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
                case .result(let id):
                    withAnimation(NostalgieTheme.contentSpring) {
                        scrollProxy.scrollTo(id, anchor: .center)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var resultsArea: some View {
        if isLoading {
            ProgressView("Szukam…")
                .padding(.top, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
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
                message: "Zmień frazę albo serwis (CDA-HD, CDA, TVP, YouTube)."
            )
        } else {
            EmptyStateView(
                icon: "text.magnifyingglass",
                title: "Gotowy do wyszukania",
                message: "Wpisz tytuł filmu lub serialu. Wyniki pokażą się poniżej według wybranego serwisu."
            )
        }
    }

    private var searchControls: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 20) {
                HStack(spacing: 14) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Tytuł filmu lub serialu…", text: $query)
                        .textFieldStyle(.plain)
                        .font(NostalgieFont.field)
                        .onSubmit { scheduleSearch(resetPage: true) }
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
                    } else if direction == .right {
                        localFocus = .searchButton
                    }
                }

                Button { scheduleSearch(resetPage: true) } label: {
                    Label("Szukaj", systemImage: "arrow.right.circle.fill")
                }
                .buttonStyle(FocusCardButtonStyle())
                .focusEffectDisabled()
                .focused($localFocus, equals: .searchButton)
                .onMoveCommand { direction in
                    if direction == .up {
                        focusedTab.wrappedValue = navigationTab
                    } else if direction == .down {
                        localFocus = .source(source)
                    } else if direction == .left {
                        localFocus = .query
                    }
                }
                .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty || isLoading)
            }
            .frame(maxWidth: 980)

            filterRow(title: "Serwis") {
                ForEach(SearchSource.filmCases) { src in
                    Button {
                        source = src
                        if !SearchSort.options(for: src).contains(sort) {
                            sort = .relevance
                        }
                        if src != .cda && src != .all {
                            access = .all
                        }
                        scheduleSearch(resetPage: true)
                    } label: {
                        if let icon = src.systemImage {
                            Label(src.label, systemImage: icon)
                        } else {
                            Text(src.label)
                        }
                    }
                    .buttonStyle(ChipButtonStyle(isSelected: source == src))
                    .focusEffectDisabled()
                    .focused($localFocus, equals: .source(src))
                    .onMoveCommand { direction in
                        if direction == .up {
                            localFocus = .query
                        } else if direction == .down {
                            focusBelowSources()
                        }
                    }
                }
            }

            if showsCdaAccessFilter {
                filterRow(title: "CDA — dostęp") {
                    ForEach(CdaAccessFilter.allCases) { option in
                        Button(option.label) {
                            access = option
                            scheduleSearch(resetPage: true)
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: access == option))
                        .focusEffectDisabled()
                        .focused($localFocus, equals: .access(option))
                        .onMoveCommand { direction in
                            if direction == .up {
                                localFocus = .source(source)
                            } else if direction == .down {
                                focusBelowAccess()
                            }
                        }
                    }
                }
            }

            if !results.isEmpty || totalResults > 0 {
                filterRow(title: "Sortowanie") {
                    ForEach(SearchSort.options(for: source)) { option in
                        Button(option.label) {
                            sort = option
                            scheduleSearch(resetPage: true)
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: sort == option))
                        .focusEffectDisabled()
                        .focused($localFocus, equals: .sort(option))
                        .onMoveCommand { direction in
                            if direction == .up {
                                if showsCdaAccessFilter {
                                    localFocus = .access(access)
                                } else {
                                    localFocus = .source(source)
                                }
                            } else if direction == .down {
                                focusFirstResult()
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
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    content()
                }
                .padding(.vertical, 2)
            }
        }
    }

    private var resultsHeader: some View {
        HStack(spacing: 16) {
            Text(results.count >= totalResults && totalResults > 0
                ? "\(results.count) wyników · \(source.label)"
                : "\(results.count) z \(totalResults) · \(source.label)")
                .font(NostalgieFont.metadata)
                .foregroundStyle(.secondary)
            if isLoadingMore { ProgressView() }
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
                .id(item.id)
                .focused($localFocus, equals: .result(item.id))
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

    // MARK: - Focus graph

    private func focusBelowSources() {
        if showsCdaAccessFilter {
            localFocus = .access(access)
        } else if !results.isEmpty || totalResults > 0 {
            localFocus = .sort(sort)
        } else {
            localFocus = .searchButton
        }
    }

    private func focusBelowAccess() {
        if !results.isEmpty || totalResults > 0 {
            localFocus = .sort(sort)
        } else {
            localFocus = .searchButton
        }
    }

    private func focusFirstResult() {
        if let first = results.first {
            localFocus = .result(first.id)
        }
    }

    private func focusTargetAboveResults() {
        if !results.isEmpty || totalResults > 0 {
            localFocus = .sort(sort)
        } else if showsCdaAccessFilter {
            localFocus = .access(access)
        } else {
            localFocus = .source(source)
        }
    }

    // MARK: - Search

    private func scheduleSearch(resetPage: Bool) {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        searchTask?.cancel()
        searchTask = Task { await runSearch(resetPage: resetPage) }
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
            try Task.checkCancellation()
            let response = try await app.api.search(
                query: trimmed,
                source: source,
                page: page,
                pageSize: pageSize,
                sort: sort,
                access: showsCdaAccessFilter ? access : .all
            )
            try Task.checkCancellation()
            if append {
                let existing = Set(results.map(\.id))
                results.append(contentsOf: response.results.filter { !existing.contains($0.id) })
            } else {
                results = response.results
                if let first = response.results.first {
                    localFocus = .result(first.id)
                }
            }
            totalResults = response.total ?? max(results.count, response.results.count)
            hasMore = response.hasMore ?? false
            if response.results.isEmpty { hasMore = false }
            page = response.page ?? page
        } catch is CancellationError {
        } catch let urlError as URLError where urlError.code == .cancelled {
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

    // MARK: - Open

    private func openSearchResult(_ item: SearchResultItem) async {
        let looksLikeSeries =
            item.isSerial == true
            || item.url.localizedCaseInsensitiveContains("/tvshows/")
            || item.url.localizedCaseInsensitiveContains("/tvshow/")
            || (item.detail?.localizedCaseInsensitiveContains("serial") == true)
        if looksLikeSeries {
            await loadSeries(url: item.url, fallbackToDetail: item)
            return
        }
        selectedDetail = MediaSelection(from: item)
    }

    private func openSeriesFromDetail(_ url: String) async {
        selectedDetail = nil
        await loadSeries(url: url, fallbackToDetail: nil)
    }

    private func loadSeries(url: String, fallbackToDetail: SearchResultItem?) async {
        openingSeries = true
        defer { openingSeries = false }
        do {
            let info = try await app.api.fetchInfo(url: url)
            if info.isPlaylist == true, !info.playableEpisodes.isEmpty {
                seriesInfo = info
                return
            }
            if let fallbackToDetail {
                selectedDetail = MediaSelection(from: fallbackToDetail)
            } else {
                seriesAlert = "Nie znaleziono odcinków tego serialu."
            }
        } catch {
            if let fallbackToDetail {
                selectedDetail = MediaSelection(from: fallbackToDetail)
            } else {
                seriesAlert = error.localizedDescription
            }
        }
    }
}

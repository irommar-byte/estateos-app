import SwiftUI

/// EOS™LIBRARY — półki w stylu Apple TV Movies.
struct OnlineMoviesHomeView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @State private var selection: OnlineMovieSelection?
    @State private var browseTarget: OnlineMoviesBrowseTarget?
    @State private var searchText = ""
    @State private var searchResults: [SearchResultItem] = []
    @State private var searchPeople: [MovieSearchFacet] = []
    @State private var searchGenres: [MovieSearchFacet] = []
    @State private var searchYears: [MovieSearchFacet] = []
    @State private var searchHasMore = false
    @State private var searchPage = 1
    @State private var isSearching = false
    @State private var isLoadingMoreSearch = false
    @State private var searchError: String?
    @State private var searchSort: MovieBrowseOrdering.Mode = .newest
    @State private var catalogMode: FilmsCatalogMode = .latest
    @State private var catalogKind: FilmsCatalogKind = .all
    @State private var showCatalog = false

    private var movies: OnlineMoviesController { app.onlineMovies }

    private var heroItem: SearchResultItem? {
        movies.shelves.first?.items.first
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 28) {
                if isSearchActive {
                    searchSection
                } else {
                    if let heroItem {
                        heroBanner(heroItem)
                    } else if movies.isLoadingHome {
                        ProgressView("Ładuję \(EOSLibraryBrand.displayName)…")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 80)
                    }

                    if !movieFavorites.isEmpty {
                        movieFavoritesShelf
                    }

                    if let error = movies.homeError, movies.shelves.isEmpty {
                        ContentUnavailableView(
                            "\(EOSLibraryBrand.displayName) niedostępne",
                            systemImage: "exclamationmark.triangle",
                            description: Text(error)
                        )
                        .frame(maxWidth: .infinity)
                        Button("Spróbuj ponownie") {
                            Task { await movies.refreshHome() }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(EOSTheme.accent)
                        .frame(maxWidth: .infinity)
                    }

                    ForEach(movies.shelves) { shelf in
                        OnlineMoviesShelfRow(
                            shelf: shelf,
                            onOpenCatalog: { mode, kind in
                                catalogMode = mode
                                catalogKind = kind
                                showCatalog = true
                            },
                            onSelect: { selection = OnlineMovieSelection(item: $0) },
                            onOpenYear: { year, url in
                                openReleaseYear(year, referenceURL: url)
                            }
                        )
                        .environmentObject(app)
                    }

                    if !movies.downloads.isEmpty {
                        downloadsShelf
                    }
                }

                Color.clear.frame(height: 40)
            }
            .padding(.bottom, 24)
        }
        .refreshable {
            await movies.refreshHome()
            await movies.refreshDownloads()
        }
        .eosScrollClearance()
        .searchable(text: $searchText, prompt: "Szukaj w \(EOSLibraryBrand.displayName)")
        .onChange(of: searchText) { _, value in
            Task { await runSearch(value) }
        }
        .task {
            if movies.shelves.isEmpty {
                await movies.refreshHome()
            }
            await movies.refreshDownloads()
        }
        .navigationDestination(item: $selection) { item in
            OnlineMovieDetailView(selection: item)
                .environmentObject(app)
                .environmentObject(video)
        }
        .navigationDestination(item: $browseTarget) { target in
            OnlineMoviesBrowseResultsView(title: target.name, pageURL: target.url)
                .environmentObject(app)
                .environmentObject(video)
        }
        .sheet(isPresented: $showCatalog) {
            NavigationStack {
                OnlineMoviesCatalogView(mode: catalogMode, initialKind: catalogKind)
                    .environmentObject(app)
                    .environmentObject(video)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(FilmsCatalogMode.allCases) { mode in
                        Button(mode.label) {
                            catalogMode = mode
                            catalogKind = .all
                            showCatalog = true
                        }
                    }
                } label: {
                    Image(systemName: "square.grid.2x2")
                }
            }
        }
        .overlay(alignment: .bottom) {
            if let status = movies.statusMessage {
                Text(status)
                    .font(EOSTypography.caption)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.bottom, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .onTapGesture { movies.statusMessage = nil }
            }
        }
        .animation(.easeOut(duration: 0.25), value: movies.statusMessage)
    }

    private var movieFavorites: [FavoriteItem] {
        app.favoriteItems.filter(\.isMovie)
    }

    private var isSearchActive: Bool {
        !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var visibleSearchResults: [SearchResultItem] {
        MovieBrowseOrdering.ordered(searchResults, mode: searchSort)
    }

    private func openReleaseYear(_ year: Int, referenceURL: String?) {
        browseTarget = OnlineMoviesBrowseTarget(
            name: "\(year)",
            url: CdaHdBrowseLink.releaseYearURL(year: year, referenceURL: referenceURL)
        )
    }

    private func heroBanner(_ item: SearchResultItem) -> some View {
        ZStack(alignment: .topTrailing) {
            Button {
                selection = OnlineMovieSelection(item: item)
            } label: {
                ZStack(alignment: .bottomLeading) {
                    OnlineMovieBackdrop(url: item.artworkURL)
                        .frame(maxWidth: .infinity)
                        .frame(height: 420)
                        .clipped()

                    LinearGradient(
                        colors: [
                            .clear,
                            Color.black.opacity(0.35),
                            Color.black.opacity(0.92),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )

                    VStack(alignment: .leading, spacing: 10) {
                        Text(EOSLibraryBrand.displayName)
                            .font(EOSTypography.captionBold)
                            .tracking(1.2)
                            .foregroundStyle(EOSTheme.accent)
                        Text(item.title)
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .lineLimit(3)
                        if let detail = item.detail, !detail.isEmpty {
                            Text(detail)
                                .font(EOSTypography.subheadline)
                                .foregroundStyle(.white.opacity(0.72))
                                .lineLimit(2)
                        }
                        HStack(spacing: 10) {
                            Label("Zobacz", systemImage: "play.fill")
                                .font(EOSTypography.subheadline.weight(.semibold))
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(.white, in: Capsule())
                                .foregroundStyle(.black)
                            if item.looksLikeSeries {
                                Text("SERIAL")
                                    .font(EOSTypography.microLabel.weight(.bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(EOSTheme.accent.opacity(0.9), in: Capsule())
                                    .foregroundStyle(.white)
                            } else {
                                Text("FILM")
                                    .font(EOSTypography.microLabel.weight(.bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.white.opacity(0.18), in: Capsule())
                                    .foregroundStyle(.white)
                            }
                        }
                        .padding(.top, 4)
                    }
                    .padding(20)
                }
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .padding(.horizontal, 16)
                .shadow(color: .black.opacity(0.35), radius: 24, y: 12)
            }
            .buttonStyle(.plain)

            if let year = item.releaseYear {
                Button {
                    openReleaseYear(year, referenceURL: item.url)
                } label: {
                    Text(String(year))
                        .font(EOSTypography.caption.weight(.bold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.ultraThinMaterial, in: Capsule())
                        .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
                .padding(.leading, 28)
                .padding(.top, 18)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }

            FavoriteButton(item: item.movieFavoriteItem, size: 18)
                .padding(10)
                .background(.ultraThinMaterial, in: Circle())
                .padding(.trailing, 28)
                .padding(.top, 18)
        }
    }

    private var movieFavoritesShelf: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ulubione")
                .font(EOSTypography.title3)
                .padding(.horizontal, 16)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(movieFavorites) { item in
                        MoviePosterWithHeart(
                            title: item.title,
                            thumbnail: item.thumbnail,
                            favoriteItem: item,
                            badge: "♥",
                            onYear: { year in
                                openReleaseYear(year, referenceURL: item.url)
                            }
                        ) {
                            selection = OnlineMovieSelection(favorite: item)
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    private var downloadsShelf: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Na serwerze")
                .font(EOSTypography.title3)
                .padding(.horizontal, 16)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(movies.downloads) { download in
                        MoviePosterWithHeart(
                            title: download.title,
                            thumbnail: download.thumbnail,
                            favoriteItem: download.favoriteItem,
                            badge: "SERWER",
                            onYear: { year in
                                openReleaseYear(year, referenceURL: download.url)
                            }
                        ) {
                            selection = OnlineMovieSelection(download: download)
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    private var searchSection: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack {
                Text("Wyniki")
                    .font(EOSTypography.title3)
                if isSearching {
                    ProgressView().controlSize(.small)
                }
            }
            .padding(.horizontal, 16)

            if let searchError {
                Text(searchError)
                    .font(EOSTypography.caption)
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 16)
            }

            if !searchPeople.isEmpty {
                searchFacetRow(title: "Osoby", items: searchPeople)
            }
            if !searchGenres.isEmpty {
                searchFacetRow(title: "Gatunki", items: searchGenres)
            }
            if !searchYears.isEmpty {
                searchFacetRow(title: "Lata", items: searchYears)
            }

            if !searchResults.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Filmy")
                        .font(EOSTypography.title3)
                        .padding(.horizontal, 16)
                    Picker("Kolejność", selection: $searchSort) {
                        ForEach(MovieBrowseOrdering.Mode.allCases) { mode in
                            Text(mode.title).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)

                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 110), spacing: 12)],
                        spacing: 16
                    ) {
                        ForEach(visibleSearchResults) { item in
                            MoviePosterWithHeart(item: item, showRating: true, onYear: { year in
                                openReleaseYear(year, referenceURL: item.url)
                            }) {
                                selection = OnlineMovieSelection(item: item)
                            }
                        }
                    }
                    .padding(.horizontal, 16)

                    if searchHasMore {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .onAppear {
                                Task { await loadMoreSearch() }
                            }
                    }
                }
            } else if !isSearching, searchError == nil, !searchPeople.isEmpty || !searchGenres.isEmpty || !searchYears.isEmpty {
                Text("Wybierz osobę, gatunek albo rok, żeby zobaczyć filmy.")
                    .font(EOSTypography.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
            }
        }
    }

    private func searchFacetRow(title: String, items: [MovieSearchFacet]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(EOSTypography.title3)
                .padding(.horizontal, 16)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(items) { item in
                        Button {
                            browseTarget = OnlineMoviesBrowseTarget(name: item.name, url: item.url)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.name)
                                    .font(EOSTypography.subheadline.weight(.semibold))
                                    .foregroundStyle(.primary)
                                    .lineLimit(2)
                                if let role = item.role, !role.isEmpty {
                                    Text(role)
                                        .font(EOSTypography.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .frame(minWidth: 132, alignment: .leading)
                            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    private func runSearch(_ query: String) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            searchResults = []
            searchPeople = []
            searchGenres = []
            searchYears = []
            searchHasMore = false
            searchPage = 1
            searchError = nil
            return
        }
        isSearching = true
        defer { isSearching = false }
        do {
            try await Task.sleep(nanoseconds: 160_000_000)
            guard searchText.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed else { return }
            let response = try await movies.search(query: trimmed, page: 1)
            searchResults = response.results
            searchPeople = response.people
            searchGenres = response.genres
            searchYears = response.years
            searchPage = response.page ?? 1
            searchHasMore = response.hasMore ?? false
            searchError = (
                searchResults.isEmpty
                    && searchPeople.isEmpty
                    && searchGenres.isEmpty
                    && searchYears.isEmpty
            ) ? "Brak wyników dla „\(trimmed)”." : nil
        } catch {
            searchError = error.localizedDescription
        }
    }

    private func loadMoreSearch() async {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard searchHasMore, !isSearching, !isLoadingMoreSearch, trimmed.count >= 2 else { return }
        isLoadingMoreSearch = true
        defer { isLoadingMoreSearch = false }
        do {
            let next = searchPage + 1
            let response = try await movies.search(query: trimmed, page: next)
            let fresh = response.results.filter { item in !searchResults.contains(where: { $0.id == item.id }) }
            searchResults.append(contentsOf: fresh)
            searchPage = next
            searchHasMore = (response.hasMore ?? false) && !fresh.isEmpty
        } catch {
            searchError = error.localizedDescription
        }
    }
}

struct OnlineMoviePosterCard: View {
    let title: String
    let thumbnail: String?
    var badge: String? = nil
    var rating: Double? = nil
    var showRating: Bool = false

    init(item: SearchResultItem, showRating: Bool = false) {
        title = item.title
        thumbnail = item.thumbnail
        badge = item.contentTypeBadge
        rating = item.rating
        self.showRating = showRating
    }

    init(title: String, thumbnail: String?, badge: String? = nil, rating: Double? = nil, showRating: Bool = false) {
        self.title = title
        self.thumbnail = thumbnail
        self.badge = badge
        self.rating = rating
        self.showRating = showRating
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                ZStack(alignment: .bottomLeading) {
                    OnlineMovieBackdrop(url: thumbnail.flatMap(URL.init(string:)))
                        .frame(width: 118, height: 177)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(Color.white.opacity(0.08), lineWidth: 1)
                        }
                        .shadow(color: .black.opacity(0.28), radius: 10, y: 6)

                    if showRating, let rating, rating > 0 {
                        Text(String(format: "%.1f ★", rating))
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(.black.opacity(0.72), in: Capsule())
                            .foregroundStyle(Color.yellow)
                            .padding(6)
                    }
                }

                if let badge {
                    Text(badge)
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(.black.opacity(0.72), in: Capsule())
                        .foregroundStyle(.white)
                        .padding(6)
                }
            }
            Text(title)
                .font(EOSTypography.caption.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(2)
                .frame(width: 118, alignment: .leading)
        }
    }
}

struct MoviePosterWithHeart: View {
    let title: String
    let thumbnail: String?
    let favoriteItem: FavoriteItem
    var badge: String? = nil
    var rating: Double? = nil
    var showRating: Bool = false
    var year: Int? = nil
    var onYear: ((Int) -> Void)? = nil
    let onSelect: () -> Void

    init(item: SearchResultItem, showRating: Bool = false, onYear: ((Int) -> Void)? = nil, onSelect: @escaping () -> Void) {
        title = item.title
        thumbnail = item.thumbnail
        favoriteItem = item.movieFavoriteItem
        badge = item.contentTypeBadge
        rating = item.rating
        self.showRating = showRating
        year = item.releaseYear
        self.onYear = onYear
        self.onSelect = onSelect
    }

    init(
        title: String,
        thumbnail: String?,
        favoriteItem: FavoriteItem,
        badge: String? = nil,
        rating: Double? = nil,
        showRating: Bool = false,
        year: Int? = nil,
        onYear: ((Int) -> Void)? = nil,
        onSelect: @escaping () -> Void
    ) {
        self.title = title
        self.thumbnail = thumbnail
        self.favoriteItem = favoriteItem
        self.badge = badge
        self.rating = rating
        self.showRating = showRating
        self.year = year ?? CdaHdBrowseLink.year(in: title)
        self.onYear = onYear
        self.onSelect = onSelect
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ZStack(alignment: .bottomTrailing) {
                Button(action: onSelect) {
                    OnlineMoviePosterCard(
                        title: title,
                        thumbnail: thumbnail,
                        badge: badge,
                        rating: rating,
                        showRating: showRating
                    )
                }
                .buttonStyle(.plain)

                FavoriteButton(item: favoriteItem, size: 14)
                    .padding(7)
                    .background(.ultraThinMaterial, in: Circle())
                    .padding(6)
            }

            if let year {
                yearButton(year)
            }
        }
    }

    @ViewBuilder
    private func yearButton(_ year: Int) -> some View {
        if let onYear {
            Button {
                onYear(year)
            } label: {
                Text(String(year))
                    .font(EOSTypography.caption.weight(.semibold))
                    .foregroundStyle(EOSTheme.accent)
            }
            .buttonStyle(.plain)
        } else {
            Text(String(year))
                .font(EOSTypography.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Taśma z nieskończonym przewijaniem

private struct OnlineMoviesShelfRow: View {
    @EnvironmentObject private var app: AppModel
    let shelf: FilmsHomeShelf
    let onOpenCatalog: (FilmsCatalogMode, FilmsCatalogKind) -> Void
    let onSelect: (SearchResultItem) -> Void
    let onOpenYear: (Int, String) -> Void

    @State private var items: [SearchResultItem] = []
    @State private var page = 1
    @State private var hasMore = false
    @State private var isLoadingMore = false

    private var catalogMode: FilmsCatalogMode? {
        shelf.catalogMode.flatMap(FilmsCatalogMode.init(rawValue:))
    }

    private var catalogKind: FilmsCatalogKind {
        guard let raw = shelf.catalogType?.lowercased() else { return .all }
        return FilmsCatalogKind(rawValue: raw) ?? .all
    }

    private var showRatings: Bool {
        catalogMode == .topRated || shelf.title.localizedCaseInsensitiveContains("ocen")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(EOSLibraryBrand.sanitize(shelf.title))
                        .font(EOSTypography.title3)
                    if let subtitle = shelf.subtitle, !subtitle.isEmpty {
                        Text(EOSLibraryBrand.sanitize(subtitle))
                            .font(EOSTypography.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if let mode = catalogMode {
                    Button("Wszystkie") {
                        onOpenCatalog(mode, catalogKind)
                    }
                    .font(EOSTypography.caption.weight(.semibold))
                    .foregroundStyle(EOSTheme.accent)
                }
            }
            .padding(.horizontal, 16)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(items) { item in
                        MoviePosterWithHeart(item: item, showRating: showRatings, onYear: { year in
                            onOpenYear(year, item.url)
                        }) {
                            onSelect(item)
                        }
                        .onAppear {
                            if item.id == items.last?.id {
                                Task { await loadMoreIfNeeded() }
                            }
                        }
                    }
                    if isLoadingMore {
                        ProgressView()
                            .frame(width: 40, height: 177)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
        .onAppear {
            if items.isEmpty {
                items = shelf.items.filtered(by: catalogKind)
                page = 1
                hasMore = catalogMode != nil
            }
        }
    }

    private func loadMoreIfNeeded() async {
        guard let mode = catalogMode, hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            var nextPage = page + 1
            var attempts = 0
            while attempts < 4 {
                let response = try await app.onlineMovies.fetchCatalog(mode: mode, type: catalogKind, page: nextPage)
                let fresh = response.items
                    .filtered(by: catalogKind)
                    .filter { item in !items.contains(where: { $0.id == item.id }) }
                items.append(contentsOf: fresh)
                page = nextPage
                hasMore = response.hasMore ?? (nextPage < (response.totalPages ?? nextPage))
                if !fresh.isEmpty || !hasMore { break }
                nextPage += 1
                attempts += 1
            }
        } catch {
            hasMore = false
        }
    }
}

private extension Array where Element == SearchResultItem {
    func filtered(by kind: FilmsCatalogKind) -> [SearchResultItem] {
        guard kind != .all else { return self }
        return filter { $0.matchesCatalogKind(kind) }
    }
}

struct OnlineMoviesCatalogView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @Environment(\.dismiss) private var dismiss
    let mode: FilmsCatalogMode
    var initialKind: FilmsCatalogKind = .all

    @State private var kind: FilmsCatalogKind
    @State private var items: [SearchResultItem] = []
    @State private var page = 1
    @State private var hasMore = false
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selection: OnlineMovieSelection?
    @State private var browseTarget: OnlineMoviesBrowseTarget?

    init(mode: FilmsCatalogMode, initialKind: FilmsCatalogKind = .all) {
        self.mode = mode
        self.initialKind = initialKind
        _kind = State(initialValue: initialKind)
    }

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 12)], spacing: 16) {
                ForEach(items) { item in
                    MoviePosterWithHeart(item: item, showRating: mode == .topRated, onYear: { year in
                        browseTarget = OnlineMoviesBrowseTarget(
                            name: "\(year)",
                            url: CdaHdBrowseLink.releaseYearURL(year: year, referenceURL: item.url)
                        )
                    }) {
                        selection = OnlineMovieSelection(item: item)
                    }
                    .onAppear {
                        if item.id == items.last?.id, hasMore, !isLoading {
                            Task { await loadMore() }
                        }
                    }
                }
            }
            .padding(16)

            if isLoading {
                ProgressView().padding()
            }
            if let errorMessage {
                Text(errorMessage).foregroundStyle(.orange).padding()
            }
        }
        .navigationTitle(mode.label)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Zamknij") { dismiss() }
            }
            ToolbarItem(placement: .principal) {
                Picker("Typ", selection: $kind) {
                    ForEach(FilmsCatalogKind.allCases) { k in
                        Text(k.label).tag(k)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 260)
            }
        }
        .onChange(of: kind) { _, _ in
            Task { await reload() }
        }
        .task(id: "\(mode.rawValue)|\(kind.rawValue)") { await reload() }
        .navigationDestination(item: $selection) { item in
            OnlineMovieDetailView(selection: item)
                .environmentObject(app)
                .environmentObject(video)
        }
        .navigationDestination(item: $browseTarget) { target in
            OnlineMoviesBrowseResultsView(title: target.name, pageURL: target.url)
                .environmentObject(app)
                .environmentObject(video)
        }
    }

    private func reload() async {
        isLoading = true
        errorMessage = nil
        page = 1
        defer { isLoading = false }
        do {
            let response = try await app.onlineMovies.fetchCatalog(mode: mode, type: kind, page: 1)
            items = response.items.filtered(by: kind)
            hasMore = response.hasMore ?? ((response.page) < (response.totalPages ?? response.page))
            if items.isEmpty, hasMore {
                await loadMore()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadMore() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            var next = page + 1
            var attempts = 0
            while attempts < 5 {
                let response = try await app.onlineMovies.fetchCatalog(mode: mode, type: kind, page: next)
                let fresh = response.items
                    .filtered(by: kind)
                    .filter { item in !items.contains(where: { $0.id == item.id }) }
                items.append(contentsOf: fresh)
                page = next
                hasMore = response.hasMore ?? (next < (response.totalPages ?? next))
                if !fresh.isEmpty || !hasMore { break }
                next += 1
                attempts += 1
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Filmografia aktora i gatunek

struct OnlineMoviesBrowseTarget: Identifiable, Hashable {
    var id: String { url.isEmpty ? name : url }
    let name: String
    let url: String
}

struct OnlineMoviesBrowseResultsView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    let title: String
    let pageURL: String

    @State private var items: [SearchResultItem] = []
    @State private var page = 1
    @State private var hasMore = false
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var errorMessage: String?
    @State private var selection: OnlineMovieSelection?
    @State private var sort: MovieBrowseOrdering.Mode = .newest
    @State private var nestedBrowse: OnlineMoviesBrowseTarget?

    private var visibleItems: [SearchResultItem] {
        MovieBrowseOrdering.ordered(items, mode: sort)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Kolejność", selection: $sort) {
                    ForEach(MovieBrowseOrdering.Mode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 12)], spacing: 16) {
                    ForEach(visibleItems) { item in
                        MoviePosterWithHeart(item: item, showRating: true, onYear: { year in
                            nestedBrowse = OnlineMoviesBrowseTarget(
                                name: "\(year)",
                                url: CdaHdBrowseLink.releaseYearURL(year: year, referenceURL: item.url)
                            )
                        }) {
                            selection = OnlineMovieSelection(item: item)
                        }
                    }
                }

                if hasMore {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .onAppear {
                            Task { await loadMore() }
                        }
                } else if isLoading, items.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.orange)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if !isLoading, items.isEmpty, errorMessage == nil {
                    ContentUnavailableView(
                        "Brak filmów",
                        systemImage: "film",
                        description: Text("Ta lista jest teraz pusta.")
                    )
                    .padding(.vertical, 40)
                }
            }
            .padding(16)
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        .navigationDestination(item: $selection) { item in
            OnlineMovieDetailView(selection: item)
                .environmentObject(app)
                .environmentObject(video)
        }
        .navigationDestination(item: $nestedBrowse) { target in
            OnlineMoviesBrowseResultsView(title: target.name, pageURL: target.url)
                .environmentObject(app)
                .environmentObject(video)
        }
    }

    private func reload() async {
        isLoading = true
        errorMessage = nil
        page = 1
        items = []
        hasMore = false
        defer { isLoading = false }
        do {
            let response = try await app.onlineMovies.fetchBrowse(url: pageURL, page: 1)
            items = response.items
            page = response.page ?? 1
            hasMore = response.hasMore ?? false
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadMore() async {
        guard hasMore, !isLoading, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let next = page + 1
            let response = try await app.onlineMovies.fetchBrowse(url: pageURL, page: next)
            let fresh = response.items.filter { item in !items.contains(where: { $0.id == item.id }) }
            items.append(contentsOf: fresh)
            page = next
            hasMore = (response.hasMore ?? false) && !fresh.isEmpty
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

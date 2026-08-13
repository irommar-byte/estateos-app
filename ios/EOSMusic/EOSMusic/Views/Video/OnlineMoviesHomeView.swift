import SwiftUI

/// EOS™LIBRARY — półki w stylu Apple TV Movies.
struct OnlineMoviesHomeView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @State private var selection: OnlineMovieSelection?
    @State private var searchText = ""
    @State private var searchResults: [SearchResultItem] = []
    @State private var isSearching = false
    @State private var searchError: String?
    @State private var catalogMode: FilmsCatalogMode = .latest
    @State private var showCatalog = false

    private var movies: OnlineMoviesController { app.onlineMovies }

    private var heroItem: SearchResultItem? {
        movies.shelves.first?.items.first
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 28) {
                if let heroItem {
                    heroBanner(heroItem)
                } else if movies.isLoadingHome {
                    ProgressView("Ładuję \(EOSLibraryBrand.displayName)…")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 80)
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

                if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    searchSection
                } else {
                    ForEach(movies.shelves) { shelf in
                        shelfRow(shelf)
                    }
                }

                if !movies.downloads.isEmpty {
                    downloadsShelf
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
        .sheet(isPresented: $showCatalog) {
            NavigationStack {
                OnlineMoviesCatalogView(mode: catalogMode)
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

    private func heroBanner(_ item: SearchResultItem) -> some View {
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
    }

    private func shelfRow(_ shelf: FilmsHomeShelf) -> some View {
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
                if let modeRaw = shelf.catalogMode,
                   let mode = FilmsCatalogMode(rawValue: modeRaw) {
                    Button("Wszystkie") {
                        catalogMode = mode
                        showCatalog = true
                    }
                    .font(EOSTypography.caption.weight(.semibold))
                    .foregroundStyle(EOSTheme.accent)
                }
            }
            .padding(.horizontal, 16)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(shelf.items) { item in
                        Button {
                            selection = OnlineMovieSelection(item: item)
                        } label: {
                            OnlineMoviePosterCard(item: item)
                        }
                        .buttonStyle(.plain)
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
                        Button {
                            selection = OnlineMovieSelection(download: download)
                        } label: {
                            OnlineMoviePosterCard(
                                title: download.title,
                                thumbnail: download.thumbnail,
                                badge: "SERWER"
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    private var searchSection: some View {
        VStack(alignment: .leading, spacing: 12) {
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

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 110), spacing: 12)],
                spacing: 16
            ) {
                ForEach(searchResults) { item in
                    Button {
                        selection = OnlineMovieSelection(item: item)
                    } label: {
                        OnlineMoviePosterCard(item: item)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func runSearch(_ query: String) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            searchResults = []
            searchError = nil
            return
        }
        isSearching = true
        defer { isSearching = false }
        do {
            try await Task.sleep(nanoseconds: 350_000_000)
            guard searchText.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed else { return }
            searchResults = try await movies.search(query: trimmed)
            searchError = searchResults.isEmpty ? "Brak wyników dla „\(trimmed)”." : nil
        } catch {
            searchError = error.localizedDescription
        }
    }
}

struct OnlineMoviePosterCard: View {
    let title: String
    let thumbnail: String?
    var badge: String? = nil

    init(item: SearchResultItem) {
        title = item.title
        thumbnail = item.thumbnail
        badge = item.looksLikeSeries ? "SERIAL" : nil
    }

    init(title: String, thumbnail: String?, badge: String? = nil) {
        self.title = title
        self.thumbnail = thumbnail
        self.badge = badge
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                OnlineMovieBackdrop(url: thumbnail.flatMap(URL.init(string:)))
                    .frame(width: 118, height: 177)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    }
                    .shadow(color: .black.opacity(0.28), radius: 10, y: 6)

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

struct OnlineMoviesCatalogView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @Environment(\.dismiss) private var dismiss
    let mode: FilmsCatalogMode

    @State private var kind: FilmsCatalogKind = .all
    @State private var items: [SearchResultItem] = []
    @State private var page = 1
    @State private var hasMore = false
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selection: OnlineMovieSelection?

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 12)], spacing: 16) {
                ForEach(items) { item in
                    Button {
                        selection = OnlineMovieSelection(item: item)
                    } label: {
                        OnlineMoviePosterCard(item: item)
                    }
                    .buttonStyle(.plain)
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
        .task { await reload() }
        .navigationDestination(item: $selection) { item in
            OnlineMovieDetailView(selection: item)
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
            items = response.items
            hasMore = response.hasMore ?? ((response.page) < (response.totalPages ?? response.page))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadMore() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let next = page + 1
            let response = try await app.onlineMovies.fetchCatalog(mode: mode, type: kind, page: next)
            for item in response.items where !items.contains(where: { $0.id == item.id }) {
                items.append(item)
            }
            page = next
            hasMore = response.hasMore ?? false
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

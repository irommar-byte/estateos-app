import SwiftUI

private enum FavoritesFocus: Hashable {
    case refresh
}

struct FavoritesView: View {
    @EnvironmentObject private var app: AppModel
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    @Binding var requestContentFocus: Bool

    @State private var items: [FavoriteItem] = []
    @State private var latestItems: [SearchResultItem] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var selectedDetail: MediaSelection?
    @State private var seriesInfo: VideoInfoResponse?
    @State private var reloadToken = UUID()
    @State private var openingSeries = false
    @State private var gridColumnCount = 4
    @FocusState private var localFocus: FavoritesFocus?
    @FocusState private var latestFocusedID: String?

    private let cardMinimum: CGFloat = 340
    private let gridSpacing: CGFloat = 40
    private let columns = [GridItem(.adaptive(minimum: 340, maximum: 380), spacing: 40)]

    var body: some View {
        Group {
            if let seriesInfo {
                SeriesEpisodesView(
                    info: seriesInfo,
                    backLabel: "Wróć do ulubionych",
                    navigationTab: navigationTab,
                    focusedTab: focusedTab
                ) {
                    self.seriesInfo = nil
                }
            } else {
                favoritesList
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .fullScreenCover(item: $selectedDetail) { detail in
            MediaDetailView(selection: detail) {
                Task { await openSeriesFromDetail(detail.url) }
            }
            .environmentObject(app)
        }
        .task(id: reloadToken) { await load() }
        .onChange(of: app.session?.token) { _, _ in
            reloadToken = UUID()
        }
        .onChange(of: requestContentFocus) { _, requested in
            guard requested else { return }
            focusFavoritesContent()
            requestContentFocus = false
        }
    }

    private var favoritesList: some View {
        ScrollViewReader { scrollProxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    Color.clear.frame(height: 1).id("favoritesTop")

                    HStack(alignment: .top) {
                        ScreenTitle(
                            title: "Twoje ulubione",
                            subtitle: isLoading ? nil : "\(items.count) pozycji"
                        )
                        Spacer()
                        if !isLoading {
                            Button {
                                Task { await load() }
                            } label: {
                                Label("Odśwież", systemImage: "arrow.clockwise")
                            }
                            .buttonStyle(FocusCardButtonStyle())
                            .focused($localFocus, equals: .refresh)
                            .onMoveCommand { direction in
                                if direction == .up {
                                    focusedTab.wrappedValue = navigationTab
                                } else if direction == .down {
                                    focusLatestShelf()
                                }
                            }
                        }
                    }

                    GridColumnReader(minimumCardWidth: cardMinimum, spacing: gridSpacing, columnCount: $gridColumnCount)

                    LatestCdaHdRow(
                        focusedItemID: $latestFocusedID,
                        onSelect: { item in
                            selectedDetail = MediaSelection(from: item)
                        },
                        onMoveUp: {
                            localFocus = .refresh
                        },
                        onMoveDown: {
                            latestFocusedID = nil
                            localFocus = nil
                        },
                        onItemsChange: { latestItems = $0 }
                    )

                    if isLoading {
                        ProgressView("Ładuję ulubione…")
                            .padding(.top, 12)
                    } else if let loadError {
                        EmptyStateView(
                            icon: "wifi.exclamationmark",
                            title: "Nie udało się załadować",
                            message: loadError,
                            actionTitle: "Odśwież"
                        ) {
                            Task { await load() }
                        }
                    } else if items.isEmpty {
                        EmptyStateView(
                            icon: "heart",
                            title: "Brak ulubionych",
                            message: "Dodaj filmy i seriale w panelu www (MOVIES) — pojawią się tutaj automatycznie.",
                            actionTitle: "Odśwież"
                        ) {
                            Task { await load() }
                        }
                    } else {
                        if openingSeries {
                            ProgressView("Ładuję odcinki…")
                        }
                        LazyVGrid(columns: columns, spacing: gridSpacing) {
                            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                                MediaCard(
                                    title: item.title,
                                    subtitle: MediaCardCopy.cleanedSubtitle(detail: item.detail, source: item.source),
                                    thumbnailURL: item.thumbnail.flatMap(URL.init(string:)),
                                    source: MediaCardCopy.normalizedSourceKey(item.source),
                                    typeLabel: item.type == "series" ? "SERIAL" : "FILM",
                                    quality: nil,
                                    duration: item.duration,
                                    isFavorite: true
                                ) {
                                    Task { await openItem(item) }
                                }
                                .onGridMoveUp(columnCount: gridColumnCount, index: index) {
                                    focusTargetAboveGrid()
                                }
                            }
                        }
                        .padding(.top, 4)
                    }
                }
                .padding(.bottom, 80)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .onChange(of: localFocus) { _, focus in
                guard focus != nil else { return }
                withAnimation(.easeOut(duration: 0.25)) {
                    scrollProxy.scrollTo("favoritesTop", anchor: .top)
                }
            }
        }
    }

    private func focusFavoritesContent() {
        guard !isLoading else { return }
        if !latestItems.isEmpty {
            focusLatestShelf()
        } else {
            localFocus = .refresh
        }
    }

    private func focusLatestShelf() {
        localFocus = nil
        if let first = latestItems.first {
            latestFocusedID = first.id
        }
    }

    private func focusTargetAboveGrid() {
        if !latestItems.isEmpty {
            focusLatestShelf()
        } else {
            localFocus = .refresh
        }
    }

    private func load() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            items = try await app.api.fetchFavorites()
            await app.refreshFavorites()
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func openItem(_ item: FavoriteItem) async {
        let selection = MediaSelection(
            from: SearchResultItem(
                title: item.title,
                url: item.url,
                thumbnail: item.thumbnail,
                detail: item.detail,
                source: item.source,
                uploader: nil,
                album: nil,
                duration: item.duration,
                quality: nil,
                isSerial: item.type == "series",
                premium: item.detail?.localizedCaseInsensitiveContains("premium") == true ? true : nil
            )
        )
        if item.type == "series" {
            openingSeries = true
            defer { openingSeries = false }
            do {
                let info = try await app.api.fetchInfo(url: item.url)
                if info.isPlaylist == true, !info.playableEpisodes.isEmpty {
                    seriesInfo = info
                    return
                }
            } catch {
                loadError = error.localizedDescription
                return
            }
        }
        selectedDetail = selection
    }

    private func openSeriesFromDetail(_ url: String) async {
        do {
            let info = try await app.api.fetchInfo(url: url)
            if info.isPlaylist == true, !info.playableEpisodes.isEmpty {
                seriesInfo = info
            }
        } catch {
            loadError = error.localizedDescription
        }
    }
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

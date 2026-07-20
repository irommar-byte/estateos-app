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
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var seriesOpen: SeriesOpenRequest?
    @State private var selectedDetail: MediaSelection?
    @State private var selectedMusic: MusicSelection?
    @State private var reloadToken = UUID()
    @State private var gridColumnCount = 4
    @FocusState private var localFocus: FavoritesFocus?

    private let cardMinimum: CGFloat = 300
    private let gridSpacing: CGFloat = 32
    private let columns = [GridItem(.adaptive(minimum: 300, maximum: 360), spacing: 32)]

    private var videoFavorites: [FavoriteItem] {
        items.filter { !$0.isMusicFavorite }
    }

    private var musicFavorites: [FavoriteItem] {
        items.filter(\.isMusicFavorite)
    }

    var body: some View {
        favoritesList
            .fullScreenCover(item: $selectedDetail) { detail in
                MediaDetailView(selection: detail) {
                    seriesOpen = SeriesOpenRequest(url: detail.url, title: detail.title, thumbnail: detail.thumbnail)
                }
                .environmentObject(app)
            }
            .fullScreenCover(item: $selectedMusic) { selection in
                MusicDetailView(
                    selection: selection,
                    folders: app.musicFolders
                )
                .environmentObject(app)
            }
            .fullScreenCover(item: $seriesOpen) { req in
                SeriesEpisodesLoaderView(request: req, backLabel: "Wróć do ulubionych") {
                    seriesOpen = nil
                }
                .environmentObject(app)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
                VStack(alignment: .leading, spacing: NostalgieSpacing.section) {
                    Color.clear.frame(height: 1).id("favoritesTop")

                    HStack(alignment: .top) {
                        ScreenTitle(
                            title: "Twoje ulubione",
                            subtitle: isLoading ? nil : "\(items.count) pozycji · osobno filmy i muzyka"
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
                                }
                            }
                        }
                    }

                    GridColumnReader(minimumCardWidth: cardMinimum, spacing: gridSpacing, columnCount: $gridColumnCount)

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
                            message: "Dodaj filmy z zakładki Filmy albo utwory z Muzyki — pojawią się w osobnych sekcjach.",
                            actionTitle: "Odśwież"
                        ) {
                            Task { await load() }
                        }
                    } else {
                        if !videoFavorites.isEmpty {
                            MusicSectionHeader(
                                title: "Filmy i seriale",
                                subtitle: "\(videoFavorites.count) w ulubionych"
                            )
                            LazyVGrid(columns: columns, spacing: gridSpacing) {
                                ForEach(Array(videoFavorites.enumerated()), id: \.element.id) { index, item in
                                    MediaCard(
                                        title: item.title,
                                        subtitle: MediaCardCopy.cleanedSubtitle(detail: item.detail, source: item.source),
                                        thumbnailURL: item.thumbnail.flatMap(URL.init(string:)),
                                        source: MediaCardCopy.normalizedSourceKey(item.source),
                                        typeLabel: item.mediaTypeLabel,
                                        quality: nil,
                                        duration: item.duration,
                                        isFavorite: true
                                    ) {
                                        Task { await openItem(item) }
                                    }
                                    .onGridMoveUp(columnCount: gridColumnCount, index: index) {
                                        localFocus = .refresh
                                    }
                                }
                            }
                            .padding(.top, 4)
                        }
                        if !musicFavorites.isEmpty {
                            MusicSectionHeader(
                                title: "Muzyka",
                                subtitle: "\(musicFavorites.count) w ulubionych"
                            )
                            .padding(.top, videoFavorites.isEmpty ? 4 : 20)
                            LazyVGrid(columns: columns, spacing: gridSpacing) {
                                ForEach(Array(musicFavorites.enumerated()), id: \.element.id) { index, item in
                                    MediaCard(
                                        title: item.title,
                                        subtitle: MediaCardCopy.cleanedSubtitle(detail: item.detail, source: item.source),
                                        thumbnailURL: item.thumbnail.flatMap(URL.init(string:)),
                                        source: MediaCardCopy.normalizedSourceKey(item.source),
                                        typeLabel: item.mediaTypeLabel,
                                        quality: nil,
                                        duration: item.duration,
                                        isFavorite: true
                                    ) {
                                        Task { await openItem(item) }
                                    }
                                }
                            }
                            .padding(.top, 4)
                        }
                    }
                }
                .padding(.horizontal, NostalgieSpacing.screenH)
                .padding(.bottom, NostalgieSpacing.scrollBottom)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .onChange(of: localFocus) { _, focus in
                guard focus != nil else { return }
                withAnimation(NostalgieTheme.contentSpring) {
                    scrollProxy.scrollTo("favoritesTop", anchor: .top)
                }
            }
        }
    }

    private func focusFavoritesContent() {
        guard !isLoading else { return }
        localFocus = .refresh
    }

    private func load() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            items = try await app.api.fetchFavorites()
            await app.refreshFavorites()
            await app.refreshMusicLibrary()
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func openItem(_ item: FavoriteItem) async {
        if item.isMusicFavorite {
            selectedMusic = MusicSelection(
                title: item.title,
                url: item.url,
                artist: item.detail,
                thumbnail: item.thumbnail,
                duration: item.duration,
                downloadJobId: app.downloadJobId(for: item.url)
            )
            return
        }

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
                rating: nil,
                views: nil,
                isSerial: item.type == "series",
                premium: item.detail?.localizedCaseInsensitiveContains("premium") == true ? true : nil,
                previewUrl: nil,
                artistId: nil,
                albumId: nil,
                trackNumber: nil
            )
        )
        if item.type == "series" {
            seriesOpen = SeriesOpenRequest(url: item.url, title: item.title, thumbnail: item.thumbnail)
            return
        }
        selectedDetail = selection
    }

    private func openSeriesFromDetail(_ url: String, title: String = "Serial", thumbnail: String? = nil) {
        selectedDetail = nil
        seriesOpen = SeriesOpenRequest(url: url, title: title, thumbnail: thumbnail)
    }
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

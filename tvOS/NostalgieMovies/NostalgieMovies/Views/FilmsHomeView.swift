import SwiftUI

private enum FilmsHomeFocus: Hashable {
    case service(SearchSource)
    case shelfHeader(String)
}

/// Zakładka Filmy — osobne działy / półki per serwis (CDA-HD, CDA, TVP, YouTube).
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
    @State private var showCdaHdCatalog = false
    @State private var openingSeries = false
    @FocusState private var localFocus: FilmsHomeFocus?
    @FocusState private var activeShelfItemID: String?

    private var visibleShelves: [FilmsHomeShelf] {
        if serviceFilter == .all { return shelves }
        return shelves.filter { shelfMatchesFilter($0) }
    }

    private func shelfMatchesFilter(_ shelf: FilmsHomeShelf) -> Bool {
        let key = shelf.source.lowercased()
        switch serviceFilter {
        case .all: return true
        case .cdaHd: return key == "cda-hd" || key.contains("cda-hd")
        case .cda: return key == "cda"
        case .tvp: return key == "tvp" || key.contains("tvp")
        case .youtube: return key == "youtube" || key.contains("youtube")
        case .appleMusic: return false
        }
    }

    var body: some View {
        Group {
            if let series = seriesInfo {
                SeriesEpisodesView(info: series, backLabel: "Wróć do filmów") {
                    seriesInfo = nil
                }
                .environmentObject(app)
            } else {
                homeContent
                    .overlay { openingOverlay }
                    .fullScreenCover(item: $selectedDetail) { detail in
                        MediaDetailView(selection: detail) {
                            Task { await openSeries(url: detail.url) }
                        }
                        .environmentObject(app)
                    }
                    .fullScreenCover(isPresented: $showCdaHdCatalog) {
                        LatestCdaHdCatalogView()
                            .environmentObject(app)
                    }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { await loadHome() }
        .onChange(of: requestContentFocus) { _, requested in
            guard requested else { return }
            activeShelfItemID = nil
            localFocus = .service(serviceFilter)
            requestContentFocus = false
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
                    }
                    .padding(28)
                    .background(NostalgieTheme.card, in: RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
                }
                .ignoresSafeArea()
            }
        }
    }

    private var homeContent: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: NostalgieSpacing.section) {
                ScreenTitle(
                    title: "Filmy",
                    subtitle: "Osobne działy serwisów — CDA-HD, CDA, TVP VOD, YouTube"
                )

                servicePicker
                    .defaultFocus($localFocus, .service(.all))
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
                        message: "Ten serwis nie zwrócił teraz wyników. Spróbuj ponownie lub przejdź do Szukaj."
                    )
                } else {
                    ForEach(Array(visibleShelves.enumerated()), id: \.element.id) { index, shelf in
                        FilmsServiceShelf(
                            shelf: shelf,
                            focusedItemID: $activeShelfItemID,
                            onSelect: { item in Task { await openItem(item) } },
                            onShowAll: shelf.source == "cda-hd" ? { showCdaHdCatalog = true } : nil,
                            onMoveUp: {
                                activeShelfItemID = nil
                                if index == 0 {
                                    localFocus = .service(serviceFilter)
                                } else {
                                    let prev = visibleShelves[index - 1]
                                    activeShelfItemID = prev.items.first?.id
                                }
                            },
                            onMoveDown: {
                                activeShelfItemID = nil
                                if index + 1 < visibleShelves.count {
                                    let next = visibleShelves[index + 1]
                                    activeShelfItemID = next.items.first?.id
                                }
                            }
                        )
                        .focusSection()
                    }
                }
            }
            .padding(.horizontal, NostalgieSpacing.screenH)
            .padding(.bottom, NostalgieSpacing.scrollBottom)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onExitCommand {
            focusedTab.wrappedValue = navigationTab
        }
        .refreshable { await loadHome() }
    }

    private var servicePicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Serwis")
                .font(NostalgieFont.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.6)

            HStack(spacing: 12) {
                ForEach(SearchSource.filmCases) { src in
                    Button {
                        serviceFilter = src
                    } label: {
                        if let icon = src.systemImage {
                            Label(src.label, systemImage: icon)
                        } else {
                            Text(src.label)
                        }
                    }
                    .buttonStyle(ChipButtonStyle(isSelected: serviceFilter == src))
                    .focusEffectDisabled()
                    .focused($localFocus, equals: .service(src))
                    .onMoveCommand { direction in
                        if direction == .up {
                            focusedTab.wrappedValue = navigationTab
                        } else if direction == .down {
                            activeShelfItemID = visibleShelves.first?.items.first?.id
                            localFocus = nil
                        }
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func loadHome() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await app.api.fetchFilmsHome(limit: 16)
            shelves = response.shelves
        } catch {
            errorMessage = error.localizedDescription
            if shelves.isEmpty {
                // keep empty
            }
        }
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
        defer { openingSeries = false }
        do {
            let info = try await app.api.fetchInfo(url: url)
            if info.isPlaylist == true, !info.playableEpisodes.isEmpty {
                seriesInfo = info
                return
            }
            if let fallback {
                selectedDetail = MediaSelection(from: fallback)
            }
        } catch {
            if let fallback {
                selectedDetail = MediaSelection(from: fallback)
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }
}

/// Półka jednego serwisu — EstateOS-style rail.
struct FilmsServiceShelf: View {
    let shelf: FilmsHomeShelf
    var focusedItemID: FocusState<String?>.Binding
    let onSelect: (SearchResultItem) -> Void
    var onShowAll: (() -> Void)? = nil
    var onMoveUp: (() -> Void)? = nil
    var onMoveDown: (() -> Void)? = nil

    @EnvironmentObject private var app: AppModel
    @FocusState private var showAllFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                MusicSectionHeader(
                    title: shelf.title,
                    subtitle: shelf.subtitle ?? sourceHint
                )
                Spacer()
                SourceBadgeView(source: MediaCardCopy.normalizedSourceKey(shelf.source))
                if let onShowAll {
                    Button(action: onShowAll) {
                        Label("Wszystkie", systemImage: "square.grid.2x2")
                    }
                    .buttonStyle(FocusCardButtonStyle())
                    .focusEffectDisabled()
                    .focused($showAllFocused)
                    .onMoveCommand { direction in
                        if direction == .down {
                            showAllFocused = false
                            focusedItemID.wrappedValue = shelf.items.first?.id
                        } else if direction == .up {
                            onMoveUp?()
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
                TVHorizontalShelf(
                    items: shelf.items,
                    focusedID: focusedItemID,
                    cardWidth: 280,
                    cardSpacing: 22,
                    onMoveUp: {
                        if onShowAll != nil {
                            showAllFocused = true
                        } else {
                            onMoveUp?()
                        }
                    },
                    onMoveDown: onMoveDown
                ) { item, _ in
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
                }
            }
        }
    }

    private var sourceHint: String {
        "\(shelf.items.count) pozycji"
    }
}

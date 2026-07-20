import SwiftUI

private enum CatalogFocus: Hashable {
    case mode(CdaHdCatalogMode)
}

struct LatestCdaHdCatalogView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var mode: CdaHdCatalogMode = .latest
    @State private var page = 1
    @State private var items: [SearchResultItem] = []
    @State private var hasMore = true
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var errorMessage: String?
    @State private var selectedDetail: MediaSelection?
    @State private var seriesInfo: VideoInfoResponse?
    @State private var openingSeries = false
    @State private var gridColumnCount = 4
    @FocusState private var localFocus: CatalogFocus?

    private let pageSize = 20
    private let cardMinimum: CGFloat = 220
    private let gridSpacing: CGFloat = 28
    private let columns = [GridItem(.adaptive(minimum: 220, maximum: 260), spacing: 28)]

    var body: some View {
        Group {
            if let series = seriesInfo {
                SeriesEpisodesView(info: series, backLabel: "Wróć do CDA-HD") {
                    seriesInfo = nil
                }
                .environmentObject(app)
            } else {
                catalogContent
                    .overlay {
                        if openingSeries {
                            ZStack {
                                Color.black.opacity(0.55)
                                VStack(spacing: 16) {
                                    ProgressView().scaleEffect(1.4)
                                    Text("Ładuję odcinki…")
                                        .font(NostalgieFont.rowTitle)
                                        .foregroundStyle(.white)
                                    Text("To może potrwać do ~25 s")
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
        }
    }

    private var catalogContent: some View {
        ZStack {
            NostalgieAmbientBackground()

            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Button(action: { dismiss() }) {
                        Label("Wróć", systemImage: "chevron.left")
                    }
                    .buttonStyle(BackLinkButtonStyle())
                    Spacer()
                }

                ScreenTitle(
                    title: "CDA-HD",
                    subtitle: mode == .topRated
                        ? "Najlepiej oceniane filmy i seriale"
                        : "Najnowsze premiery",
                    level: .page
                )

                modePicker

                Text("\(items.count) pozycji")
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.secondary)

                if isLoading && items.isEmpty {
                    ProgressView("Wczytuję listę…")
                        .padding(.top, 12)
                } else if let errorMessage, items.isEmpty {
                    Text(errorMessage)
                        .foregroundStyle(NostalgieTheme.accent)
                        .font(NostalgieFont.body)
                } else if items.isEmpty {
                    Text("Brak pozycji.")
                        .foregroundStyle(.secondary)
                        .font(NostalgieFont.body)
                } else {
                    GridColumnReader(minimumCardWidth: cardMinimum, spacing: gridSpacing, columnCount: $gridColumnCount)

                    ScrollView(.vertical, showsIndicators: false) {
                        LazyVGrid(columns: columns, spacing: gridSpacing) {
                            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                                MediaCard(
                                    title: MediaCardCopy.decodedTitle(item.title),
                                    subtitle: catalogSubtitle(for: item),
                                    thumbnailURL: item.thumbnail.flatMap(URL.init(string:)),
                                    source: MediaCardCopy.normalizedSourceKey(item.source),
                                    typeLabel: (item.isSerial == true || item.url.localizedCaseInsensitiveContains("/tvshows/")) ? "SERIAL" : "FILM",
                                    quality: item.quality,
                                    duration: item.duration,
                                    isFavorite: app.isFavorite(item.url)
                                ) {
                                    Task { await openItem(item) }
                                }
                                .onGridMoveUp(columnCount: gridColumnCount, index: index) {
                                    localFocus = .mode(mode)
                                }
                                .onInfiniteScrollLoadMore(
                                    itemID: item.id,
                                    lastItemID: items.last?.id,
                                    canLoadMore: hasMore,
                                    isLoading: isLoadingMore
                                ) {
                                    Task { await loadMore() }
                                }
                            }

                            if isLoadingMore {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 24)
                            }
                        }
                        .padding(.bottom, NostalgieSpacing.scrollBottom)
                    }
                }
            }
            .padding(.horizontal, NostalgieSpacing.screenH)
            .padding(.top, NostalgieSpacing.screenTop)
        }
        .ignoresSafeArea()
        .onExitCommand { dismiss() }
        .task(id: mode) { await reload() }
        .fullScreenCover(item: $selectedDetail) { detail in
            MediaDetailView(selection: detail)
                .environmentObject(app)
        }
    }

    private var modePicker: some View {
        HStack(spacing: 12) {
            ForEach(CdaHdCatalogMode.allCases) { option in
                Button {
                    guard mode != option else { return }
                    mode = option
                } label: {
                    Label(option.label, systemImage: option == .topRated ? "star.fill" : "clock.fill")
                }
                .buttonStyle(ChipButtonStyle(isSelected: mode == option))
                .focused($localFocus, equals: .mode(option))
            }
        }
    }

    private func catalogSubtitle(for item: SearchResultItem) -> String {
        let base = MediaCardCopy.cleanedSubtitle(detail: item.detail, source: item.source)
        if mode == .topRated, let rating = item.rating ?? ratingFromQuality(item.quality) {
            return "★ \(String(format: "%.1f", rating)) · \(base)"
        }
        return base
    }

    private func ratingFromQuality(_ quality: String?) -> Double? {
        guard let quality, let value = quality.split(separator: "/").first else { return nil }
        return Double(value)
    }

    private func reload() async {
        page = 1
        hasMore = true
        items = []
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        await fetchPage(reset: true)
    }

    private func loadMore() async {
        guard hasMore, !isLoading, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        page += 1
        await fetchPage(reset: false)
    }

    private func fetchPage(reset: Bool) async {
        do {
            let response = try await app.api.fetchCdaHdCatalog(mode: mode, page: page, pageSize: pageSize)
            if reset {
                items = response.items
            } else {
                let existing = Set(items.map(\.id))
                items.append(contentsOf: response.items.filter { !existing.contains($0.id) })
            }
            hasMore = response.hasMore ?? false
            if response.items.isEmpty {
                hasMore = false
            }
        } catch {
            // Awaryjnie: /latest (szybki cache) zamiast wiecznego spinnera.
            if reset && mode == .latest {
                if let fallback = try? await app.api.fetchCdaHdLatest(limit: pageSize), !fallback.isEmpty {
                    items = fallback
                    hasMore = false
                    errorMessage = nil
                    return
                }
            }
            if reset {
                errorMessage = error.localizedDescription
                items = []
            }
            hasMore = false
            if !reset { page = max(1, page - 1) }
        }
    }

    private func openItem(_ item: SearchResultItem) async {
        let looksLikeSeries =
            item.isSerial == true
            || item.url.localizedCaseInsensitiveContains("/tvshows/")
            || item.url.localizedCaseInsensitiveContains("/tvshow/")
            || (item.detail?.localizedCaseInsensitiveContains("serial") == true)
        if looksLikeSeries {
            openingSeries = true
            defer { openingSeries = false }
            do {
                let info = try await app.api.fetchInfo(url: item.url)
                if info.isPlaylist == true, !info.playableEpisodes.isEmpty {
                    seriesInfo = info
                    return
                }
                errorMessage = "Nie znaleziono odcinków — spróbuj ponownie za chwilę."
                return
            } catch {
                errorMessage = error.localizedDescription
                return
            }
        }
        selectedDetail = MediaSelection(from: item)
    }
}

import SwiftUI

private enum CatalogFocus: Hashable {
    case mode(FilmsCatalogMode)
    case kind(FilmsCatalogKind)
}

/// Katalog serwisu: sortowanie + Filmy/Seriale (CDA-HD, CDA, TVP, YouTube, Wszystkie).
struct LatestCdaHdCatalogView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    var source: SearchSource = .cdaHd
    var initialMode: FilmsCatalogMode = .latest

    @State private var mode: FilmsCatalogMode = .latest
    @State private var kind: FilmsCatalogKind = .all
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
    @State private var didApplyInitial = false
    @FocusState private var localFocus: CatalogFocus?

    private let pageSize = 20
    private let cardMinimum: CGFloat = 220
    private let gridSpacing: CGFloat = 28
    private let columns = [GridItem(.adaptive(minimum: 220, maximum: 260), spacing: 28)]

    private var titleText: String {
        switch source {
        case .all: return "Wszystkie serwisy"
        case .cdaHd: return "CDA-HD"
        case .cda: return "CDA"
        case .tvp: return "TVP VOD"
        case .youtube: return "YouTube"
        case .appleMusic: return "Muzyka"
        }
    }

    private var subtitleText: String {
        let sort = mode.label
        let type = kind == .all ? "filmy i seriale" : kind.label.lowercased()
        return "\(sort) · \(type)"
    }

    var body: some View {
        Group {
            if let series = seriesInfo {
                SeriesEpisodesView(info: series, backLabel: "Wróć do katalogu") {
                    seriesInfo = nil
                }
                .environmentObject(app)
            } else {
                catalogContent
                    .overlay { openingOverlay }
            }
        }
        .onAppear {
            if !didApplyInitial {
                mode = initialMode
                didApplyInitial = true
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

    private var catalogContent: some View {
        ZStack {
            NostalgieAmbientBackground()

            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Button(action: { dismiss() }) {
                        Label("Wróć", systemImage: "chevron.left")
                    }
                    .buttonStyle(BackLinkButtonStyle())
                    Spacer()
                }

                ScreenTitle(title: titleText, subtitle: subtitleText, level: .page)

                kindPicker
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
                    Text("Brak pozycji dla tych filtrów.")
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
                                    typeLabel: isSerial(item) ? "SERIAL" : "FILM",
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
        .task(id: "\(source.rawValue)|\(mode.rawValue)|\(kind.rawValue)") { await reload() }
        .fullScreenCover(item: $selectedDetail) { detail in
            MediaDetailView(selection: detail)
                .environmentObject(app)
        }
    }

    private var kindPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Typ")
                .font(NostalgieFont.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.6)
            HStack(spacing: 12) {
                ForEach(FilmsCatalogKind.allCases) { option in
                    Button {
                        kind = option
                    } label: {
                        Label(option.label, systemImage: option.systemImage)
                    }
                    .buttonStyle(ChipButtonStyle(isSelected: kind == option))
                    .focusEffectDisabled()
                    .focused($localFocus, equals: .kind(option))
                    .onMoveCommand { direction in
                        if direction == .down {
                            localFocus = .mode(mode)
                        }
                    }
                }
            }
        }
    }

    private var modePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Sortowanie")
                .font(NostalgieFont.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.6)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(FilmsCatalogMode.allCases) { option in
                        Button {
                            mode = option
                        } label: {
                            Label(option.label, systemImage: option.systemImage)
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: mode == option))
                        .focusEffectDisabled()
                        .focused($localFocus, equals: .mode(option))
                        .onMoveCommand { direction in
                            if direction == .up {
                                localFocus = .kind(kind)
                            }
                        }
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private func isSerial(_ item: SearchResultItem) -> Bool {
        item.isSerial == true || item.url.localizedCaseInsensitiveContains("/tvshows/")
    }

    private func catalogSubtitle(for item: SearchResultItem) -> String {
        let base = MediaCardCopy.cleanedSubtitle(detail: item.detail, source: item.source)
        if mode == .topRated, let rating = item.rating ?? ratingFromQuality(item.quality) {
            return "★ \(String(format: "%.1f", rating)) · \(base)"
        }
        if mode == .longest, let duration = item.duration, duration > 0 {
            return "\(MediaDurationFormat.label(for: duration) ?? "") · \(base)"
        }
        if mode == .mostPlayed, let views = item.views, views > 0 {
            return "\(Int(views)) odtw. · \(base)"
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
            let response = try await app.api.fetchFilmsCatalog(
                source: source,
                mode: mode,
                type: kind,
                page: page,
                pageSize: pageSize
            )
            if reset {
                items = response.items
            } else {
                let existing = Set(items.map(\.id))
                items.append(contentsOf: response.items.filter { !existing.contains($0.id) })
            }
            hasMore = response.hasMore ?? false
            if response.items.isEmpty { hasMore = false }
        } catch {
            if reset && source == .cdaHd && mode == .latest {
                if let fallback = try? await app.api.fetchCdaHdLatest(limit: pageSize), !fallback.isEmpty {
                    items = filterLocally(fallback)
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

    private func filterLocally(_ list: [SearchResultItem]) -> [SearchResultItem] {
        switch kind {
        case .all: return list
        case .film: return list.filter { !isSerial($0) }
        case .serial: return list.filter { isSerial($0) }
        }
    }

    private func openItem(_ item: SearchResultItem) async {
        let looksLikeSeries =
            isSerial(item)
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

/// Alias czytelniejszy w FilmsHome.
typealias FilmsCatalogView = LatestCdaHdCatalogView

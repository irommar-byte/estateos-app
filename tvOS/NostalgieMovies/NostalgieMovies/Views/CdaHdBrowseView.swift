import SwiftUI

struct CdaHdBrowseView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let context: CdaHdBrowseContext

    @State private var items: [SearchResultItem] = []
    @State private var page = 1
    @State private var hasMore = true
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var errorMessage: String?
    @State private var selectedDetail: MediaSelection?

    private let pageSize = 20

    var body: some View {
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

                ScreenTitle(title: context.title, subtitle: "CDA-HD · \(items.count) pozycji", level: .page)

                if isLoading && items.isEmpty {
                    ProgressView("Wczytuję listę…")
                } else if let errorMessage, items.isEmpty {
                    Text(errorMessage)
                        .foregroundStyle(NostalgieTheme.accent)
                        .font(NostalgieFont.body)
                } else if items.isEmpty {
                    Text("Brak wyników.")
                        .foregroundStyle(.secondary)
                        .font(NostalgieFont.body)
                } else {
                    ScrollView {
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 220, maximum: 260), spacing: 22)],
                            spacing: 22
                        ) {
                            ForEach(items) { item in
                                MediaCard(
                                    title: MediaCardCopy.decodedTitle(item.title),
                                    subtitle: MediaCardCopy.cleanedSubtitle(detail: item.detail, source: item.source),
                                    thumbnailURL: item.thumbnail.flatMap(URL.init(string:)),
                                    source: MediaCardCopy.normalizedSourceKey(item.source),
                                    typeLabel: (item.isSerial == true || item.url.localizedCaseInsensitiveContains("/tvshows/")) ? "SERIAL" : "FILM",
                                    quality: item.quality,
                                    duration: item.duration,
                                    isPremium: item.premium == true,
                                    isFavorite: app.isFavorite(item.url)
                                ) {
                                    selectedDetail = MediaSelection(from: item)
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
        .task { await reload() }
        .fullScreenCover(item: $selectedDetail) { detail in
            MediaDetailView(selection: detail)
                .environmentObject(app)
        }
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
            let response = try await app.api.fetchCdaHdBrowse(
                url: context.pageURL,
                page: page,
                limit: pageSize
            )
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
            if reset {
                errorMessage = error.localizedDescription
                items = []
            }
            hasMore = false
            if !reset { page = max(1, page - 1) }
        }
    }
}

import SwiftUI

struct LatestCdaHdRow: View {
    @EnvironmentObject private var app: AppModel
    var focusedItemID: FocusState<String?>.Binding
    let onSelect: (SearchResultItem) -> Void
    var onShowAll: (() -> Void)? = nil
    var onMoveUp: (() -> Void)? = nil
    var onMoveDown: (() -> Void)? = nil
    var onItemsChange: (([SearchResultItem]) -> Void)? = nil

    @State private var items: [SearchResultItem] = []
    @State private var isLoading = true
    @FocusState private var showAllFocused: Bool

    private let shelfLimit = 20

    var body: some View {
        VStack(alignment: .leading, spacing: NostalgieSpacing.section) {
            HStack(alignment: .firstTextBaseline) {
                MusicSectionHeader(title: "Najnowsze z CDA-HD", subtitle: "\(shelfLimit) pozycji")
                Spacer()
                if let onShowAll {
                    Button(action: onShowAll) {
                        Label("Zobacz wszystkie", systemImage: "square.grid.2x2")
                    }
                    .buttonStyle(FocusCardButtonStyle())
                    .focused($showAllFocused)
                    .onMoveCommand { direction in
                        if direction == .down {
                            showAllFocused = false
                            if let first = items.first {
                                focusedItemID.wrappedValue = first.id
                            }
                        } else if direction == .up {
                            onMoveUp?()
                        }
                    }
                }
            }

            if isLoading {
                ProgressView()
                    .frame(height: 370)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else if items.isEmpty {
                Text("Brak pozycji do wyświetlenia.")
                    .foregroundStyle(.secondary)
                    .font(NostalgieFont.metadata)
                    .frame(height: 80, alignment: .leading)
            } else {
                TVHorizontalShelf(
                    items: items,
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
                        isFavorite: app.isFavorite(item.url),
                        layout: .shelf
                    ) {
                        onSelect(item)
                    }
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await app.api.fetchCdaHdLatest(limit: shelfLimit)
            onItemsChange?(items)
            // Nie kradnij focusu przy ładowaniu — użytkownik schodzi ↓ z filtrów / query.
        } catch {
            items = []
            onItemsChange?([])
        }
    }
}

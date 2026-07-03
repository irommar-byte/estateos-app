import SwiftUI

struct LatestCdaHdRow: View {
    @EnvironmentObject private var app: AppModel
    var focusedItemID: FocusState<String?>.Binding
    let onSelect: (SearchResultItem) -> Void
    var onMoveUp: (() -> Void)? = nil
    var onMoveDown: (() -> Void)? = nil
    var onItemsChange: (([SearchResultItem]) -> Void)? = nil

    @State private var items: [SearchResultItem] = []
    @State private var isLoading = true

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Najnowsze z CDA-HD")
                .font(.title3.weight(.semibold))

            if isLoading {
                ProgressView()
                    .frame(height: 370)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else if items.isEmpty {
                Text("Brak pozycji do wyświetlenia.")
                    .foregroundStyle(.secondary)
                    .font(.callout)
                    .frame(height: 80, alignment: .leading)
            } else {
                TVHorizontalShelf(
                    items: items,
                    focusedID: focusedItemID,
                    cardWidth: 300,
                    cardSpacing: 28,
                    onMoveUp: onMoveUp,
                    onMoveDown: onMoveDown
                ) { item, _ in
                    MediaCard(
                        title: item.title,
                        subtitle: MediaCardCopy.cleanedSubtitle(detail: item.detail, source: item.source),
                        thumbnailURL: item.thumbnail.flatMap(URL.init(string:)),
                        source: MediaCardCopy.normalizedSourceKey(item.source),
                        typeLabel: (item.isSerial == true) ? "SERIAL" : "FILM",
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
            items = try await app.api.fetchCdaHdLatest(limit: 10)
            onItemsChange?(items)
            if focusedItemID.wrappedValue == nil, let first = items.first {
                focusedItemID.wrappedValue = first.id
            }
        } catch {
            items = []
            onItemsChange?([])
        }
    }
}

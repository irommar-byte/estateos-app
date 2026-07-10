import SwiftUI

/// Przejście focusu w górę z pierwszego rzędu siatki (tvOS ScrollView nie wypuszcza focusu sam).
struct GridMoveUpModifier: ViewModifier {
    let columnCount: Int
    let index: Int
    let action: () -> Void

    func body(content: Content) -> some View {
        content.onMoveCommand { direction in
            guard direction == .up else { return }
            let columns = max(columnCount, 1)
            if index / columns == 0 {
                action()
            }
        }
    }
}

extension View {
    func onGridMoveUp(columnCount: Int, index: Int, perform action: @escaping () -> Void) -> some View {
        modifier(GridMoveUpModifier(columnCount: columnCount, index: index, action: action))
    }

    @available(*, deprecated, message: "Use onGridMoveUp(columnCount:index:perform:)")
    func onGridMoveUp(isTopRow: Bool, perform action: @escaping () -> Void) -> some View {
        modifier(GridMoveUpModifier(columnCount: 1, index: isTopRow ? 0 : 1, action: action))
    }
}

enum GridFocusHelper {
    static func columnCount(for width: CGFloat, minimumCardWidth: CGFloat = 340, spacing: CGFloat = 40) -> Int {
        max(1, Int((width + spacing) / (minimumCardWidth + spacing)))
    }
}

struct GridColumnReader: View {
    let minimumCardWidth: CGFloat
    let spacing: CGFloat
    @Binding var columnCount: Int

    var body: some View {
        GeometryReader { proxy in
            Color.clear
                .onAppear { update(proxy.size.width) }
                .onChange(of: proxy.size.width) { _, width in update(width) }
        }
        .frame(height: 1)
    }

    private func update(_ width: CGFloat) {
        guard width > 80 else { return }
        columnCount = GridFocusHelper.columnCount(
            for: width,
            minimumCardWidth: minimumCardWidth,
            spacing: spacing
        )
    }
}

// MARK: - Horizontal shelf (CDA-HD row, carousels)

/// Pozioma półka z przewijaniem, wyrównaniem focusu i wyjściem ↑/↓ — tvOS 17+.
struct TVHorizontalShelf<Item: Identifiable, Content: View>: View where Item.ID: Hashable {
    let items: [Item]
    var focusedID: FocusState<Item.ID?>.Binding
    var cardWidth: CGFloat = 300
    var cardSpacing: CGFloat = 32
    var onMoveUp: (() -> Void)?
    var onMoveDown: (() -> Void)?
    @ViewBuilder let content: (Item, Bool) -> Content

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: cardSpacing) {
                ForEach(items) { item in
                    content(item, focusedID.wrappedValue == item.id)
                        .frame(width: cardWidth)
                        .id(item.id)
                        .focused(focusedID, equals: item.id)
                        .onMoveCommand { direction in
                            switch direction {
                            case .up:
                                onMoveUp?()
                            case .down:
                                onMoveDown?()
                            default:
                                break
                            }
                        }
                }
            }
            .scrollTargetLayout()
            .padding(.vertical, 12)
        }
        .scrollPosition(id: scrollIDBinding)
        .scrollTargetBehavior(.viewAligned)
        .fullBleedShelf()
        .frame(height: 370)
    }

    private var scrollIDBinding: Binding<Item.ID?> {
        Binding(
            get: { focusedID.wrappedValue },
            set: { focusedID.wrappedValue = $0 }
        )
    }
}

// MARK: - Infinite scroll (doładowanie przy dojechaniu na dół)

extension View {
    /// Wywołuje `loadMore` gdy ostatnia karta staje się widoczna.
    func onInfiniteScrollLoadMore(
        itemID: String,
        lastItemID: String?,
        canLoadMore: Bool,
        isLoading: Bool,
        loadMore: @escaping () -> Void
    ) -> some View {
        onAppear {
            guard canLoadMore, !isLoading, itemID == lastItemID else { return }
            loadMore()
        }
    }
}

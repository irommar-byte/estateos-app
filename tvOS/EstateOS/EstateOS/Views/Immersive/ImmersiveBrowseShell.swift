import SwiftUI

protocol ImmersiveItem: Identifiable {
    var immersiveTitle: String { get }
    var immersivePriceText: String { get }
    var immersiveSubtitleText: String { get }
    var immersiveLocationLine: String { get }
    var immersiveCountry: ResolvedLocalityCountry { get }
    var immersiveImageURL: URL? { get }
    var immersiveAccent: Color { get }
    var immersiveBadgeText: String? { get }
}

extension EstateOffer: ImmersiveItem {
    var immersiveTitle: String { title }
    var immersivePriceText: String { EOSFormat.pricePLN(price) }
    var immersiveSubtitleText: String {
        [displayPricePerSqm, area.map { "\(Int($0)) m²" }].compactMap { $0 }.joined(separator: "  ·  ")
    }
    var immersiveLocationLine: String { displayLocation }
    var immersiveCountry: ResolvedLocalityCountry { resolvedCountry }
    var immersiveImageURL: URL? { EOSOfferMedia.primaryImageURL(for: self) }
    var immersiveAccent: Color { EOSPalette.home }
    var immersiveBadgeText: String? { transactionLabel }
}

extension CarListing: ImmersiveItem {
    var immersiveTitle: String { displayHeadline }
    var immersivePriceText: String { displayPrice }
    var immersiveSubtitleText: String { displaySpecs }
    var immersiveLocationLine: String { city }
    var immersiveCountry: ResolvedLocalityCountry { resolvedCountry }
    var immersiveImageURL: URL? { EOSOfferMedia.imageURL(from: imageUrl) }
    var immersiveAccent: Color { EOSPalette.car }
    var immersiveBadgeText: String? { featured ? "PROMO" : nil }
}

struct ImmersiveBrowseShell<Item: ImmersiveItem>: View {
    let items: [Item]
    @State private var selectedIndex: Int
    @State private var slideDirection: SlideDirection = .none
    @FocusState private var focused: Bool
    @State private var showHint = true

    var accent: Color
    var hintText: String
    var onShow: (Item) -> Void
    var onDismiss: () -> Void
    var trailingActions: ((Item) -> AnyView)? = nil

    enum SlideDirection { case none, forward, back }

    init(
        items: [Item],
        startIndex: Int,
        accent: Color,
        hintText: String,
        onShow: @escaping (Item) -> Void,
        onDismiss: @escaping () -> Void,
        trailingActions: ((Item) -> AnyView)? = nil
    ) {
        self.items = items
        self.accent = accent
        self.hintText = hintText
        self.onShow = onShow
        self.onDismiss = onDismiss
        self.trailingActions = trailingActions
        _selectedIndex = State(initialValue: min(max(0, startIndex), max(0, items.count - 1)))
    }

    private var current: Item { items[selectedIndex] }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            ImmersiveBackdrop(url: current.immersiveImageURL, accent: accent)
                .id(current.id)
                .transition(backdropTransition)
                .ignoresSafeArea()

            LinearGradient(
                colors: [.black.opacity(0.15), .clear, .black.opacity(0.35), .black.opacity(0.92)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack {
                Spacer()
                glassPanel
                    .padding(.horizontal, 64)
                    .padding(.bottom, 56)
            }
        }
        .focusable()
        .focused($focused)
        .onAppear {
            prefetchAdjacent(around: selectedIndex)
            focused = true
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                withAnimation(.easeOut(duration: 0.4)) { showHint = false }
            }
        }
        .onMoveCommand(perform: handleMove)
        .onExitCommand { onDismiss() }
    }

    private var glassPanel: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                Text("\(selectedIndex + 1) / \(items.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.55))
                Spacer()
                if let badge = current.immersiveBadgeText {
                    Text(badge.uppercased())
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                        .tracking(1.1)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Capsule(style: .continuous).fill(accent.opacity(0.34)))
                        .overlay(Capsule(style: .continuous).stroke(Color.white.opacity(0.22), lineWidth: 1))
                }
            }

            ImmersiveAdaptiveTitle(text: current.immersiveTitle, maxSize: 56, minSize: 28)
                .foregroundStyle(.white)
                .id("title-\(current.id)")

            VStack(alignment: .leading, spacing: 10) {
                Text(current.immersivePriceText)
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(accent)
                if !current.immersiveSubtitleText.isEmpty {
                    Text(current.immersiveSubtitleText)
                        .font(.system(size: 22, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.86))
                }
                EOSCountryLocationLabel(
                    locationLine: current.immersiveLocationLine,
                    country: current.immersiveCountry,
                    font: .system(size: 20, weight: .medium, design: .rounded),
                    foreground: .white.opacity(0.78)
                )
            }
            .id("meta-\(current.id)")

            HStack(spacing: 18) {
                Button("POKAŻ") { onShow(current) }
                    .buttonStyle(EOSDetailActionButtonStyle(accent: accent))
                    .focusEffectDisabled()
                    .accessibilityLabel("Pokaż szczegóły")

                if let trailingActions {
                    trailingActions(current)
                }

                Spacer()

                if showHint {
                    Text(hintText)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.45))
                        .transition(.opacity)
                }
            }
        }
        .padding(40)
        .eosGlass(cornerRadius: 34, opacity: 0.48)
        .animation(.spring(response: 0.52, dampingFraction: 0.84), value: selectedIndex)
    }

    private var backdropTransition: AnyTransition {
        switch slideDirection {
        case .forward, .back:
            return .asymmetric(
                insertion: .opacity.combined(with: .scale(scale: 1.04)),
                removal: .opacity
            )
        case .none:
            return .opacity
        }
    }

    private func prefetchAdjacent(around index: Int) {
        var urls: [URL] = []
        for i in [index - 1, index, index + 1] where i >= 0 && i < items.count {
            if let u = items[i].immersiveImageURL { urls.append(u) }
        }
        EOSImageCache.prefetch(urls: urls)
    }

    private func handleMove(_ direction: MoveCommandDirection) {
        switch direction {
        case .left:
            guard selectedIndex > 0 else { return }
            slideDirection = .back
            withAnimation(.spring(response: 0.58, dampingFraction: 0.86)) { selectedIndex -= 1 }
            prefetchAdjacent(around: selectedIndex)
        case .right:
            guard selectedIndex < items.count - 1 else { return }
            slideDirection = .forward
            withAnimation(.spring(response: 0.58, dampingFraction: 0.86)) { selectedIndex += 1 }
            prefetchAdjacent(around: selectedIndex)
        case .down:
            onDismiss()
        default:
            break
        }
    }
}

private struct ImmersiveBackdrop: View {
    let url: URL?
    let accent: Color

    var body: some View {
        GeometryReader { proxy in
            EOSCachedRemoteImage(url: url, contentMode: .fill) {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [Color(white: 0.14), accent.opacity(0.12), Color(white: 0.06)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
        }
    }
}

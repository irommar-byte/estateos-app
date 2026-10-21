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

/// Full-screen browse (Top Shelf "Play", "Przeglądaj na pełnym ekranie") — 2026-10 redesign.
///
/// A slideshow you can lean back to: the photo fills the screen and drifts slowly, the essentials
/// sit bottom-left, a thin progress line shows the next slide coming.
///   ◀ ▶ previous / next · Select — open the offer · ⏯ — pause / play the slideshow
///   ▲ — add to favourites · ▼ or MENU — close
struct ImmersiveBrowseShell<Item: ImmersiveItem>: View {
    let items: [Item]
    @State private var selectedIndex: Int
    @State private var forward = true
    @State private var playing = true
    @State private var progress: CGFloat = 0
    @State private var ticker: Task<Void, Never>?
    @FocusState private var focused: Bool
    @Environment(\.eosAmbientMotion) private var ambientMotion

    var accent: Color
    var hintText: String
    var onShow: (Item) -> Void
    var onDismiss: () -> Void
    var isFavorite: ((Item) -> Bool)? = nil
    var onToggleFavorite: ((Item) -> Void)? = nil

    private static var slideSeconds: Double { 9 }

    init(
        items: [Item],
        startIndex: Int,
        accent: Color,
        hintText: String,
        onShow: @escaping (Item) -> Void,
        onDismiss: @escaping () -> Void,
        isFavorite: ((Item) -> Bool)? = nil,
        onToggleFavorite: ((Item) -> Void)? = nil
    ) {
        self.items = items
        self.accent = accent
        self.hintText = hintText
        self.onShow = onShow
        self.onDismiss = onDismiss
        self.isFavorite = isFavorite
        self.onToggleFavorite = onToggleFavorite
        _selectedIndex = State(initialValue: min(max(0, startIndex), max(0, items.count - 1)))
    }

    private var current: Item { items[selectedIndex] }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Color.black.ignoresSafeArea()

            EOSBackdrop(url: current.immersiveImageURL)
                .id(current.id)
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .offset(x: forward ? 60 : -60)),
                    removal: .opacity
                ))

            LinearGradient(
                stops: [
                    .init(color: .black.opacity(0.35), location: 0),
                    .init(color: .clear, location: 0.25),
                    .init(color: .clear, location: 0.5),
                    .init(color: .black.opacity(0.88), location: 1),
                ],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            Button { onShow(current) } label: { Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity) }
                .buttonStyle(ImmersiveStageStyle())
                .focused($focused)
                .onMoveCommand(perform: handleMove)
                .onPlayPauseCommand(perform: togglePlay)
                .onExitCommand { onDismiss() }
                .accessibilityLabel("\(current.immersiveTitle), \(current.immersivePriceText). Naciśnij, aby otworzyć.")

            info
                .padding(.horizontal, 90)
                .padding(.bottom, 70)
                .allowsHitTesting(false)
        }
        .overlay(alignment: .topTrailing) { counter.padding(.top, 60).padding(.trailing, 90) }
        .onAppear {
            prefetchAdjacent(around: selectedIndex)
            focused = true
            restartTicker()
        }
        .onDisappear { ticker?.cancel() }
    }

    // MARK: Pieces

    private var info: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                if let badge = current.immersiveBadgeText {
                    Text(badge.uppercased())
                        .font(.system(size: 17, weight: .heavy))
                        .tracking(1.6)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(Capsule().fill(accent.opacity(0.32)))
                        .overlay(Capsule().strokeBorder(Color.white.opacity(0.22), lineWidth: 1))
                }
                if isFavorite?(current) == true {
                    Image(systemName: "heart.fill").foregroundStyle(.pink)
                }
            }
            ImmersiveAdaptiveTitle(text: current.immersiveTitle, maxSize: 72, minSize: 34)
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.4), radius: 20, y: 4)
            HStack(alignment: .firstTextBaseline, spacing: 22) {
                Text(current.immersivePriceText)
                    .font(.system(size: 44, weight: .semibold))
                if !current.immersiveSubtitleText.isEmpty {
                    Text(current.immersiveSubtitleText)
                        .font(.system(size: 24, weight: .medium))
                        .foregroundStyle(.white.opacity(0.8))
                }
            }
            .foregroundStyle(.white)
            EOSCountryLocationLabel(
                locationLine: current.immersiveLocationLine,
                country: current.immersiveCountry,
                font: .system(size: 22, weight: .medium),
                foreground: .white.opacity(0.75)
            )

            HStack(spacing: 26) {
                hint("hand.tap", "zobacz")
                hint("arrow.left.and.right", "kolejne")
                hint("playpause", playing ? "pauza" : "pokaz slajdów")
                if onToggleFavorite != nil { hint("arrow.up", "ulubione") }
                hint("arrow.down", "zamknij")
            }
            .padding(.top, 18)
        }
        .id(current.id)
        .transition(.opacity)
        .animation(.easeOut(duration: 0.45), value: selectedIndex)
        .frame(maxWidth: 1400, alignment: .leading)
    }

    private func hint(_ icon: String, _ text: String) -> some View {
        Label(text, systemImage: icon)
            .font(.system(size: 19, weight: .medium))
            .foregroundStyle(.white.opacity(0.6))
    }

    private var counter: some View {
        HStack(spacing: 16) {
            Image(systemName: playing ? "play.fill" : "pause.fill")
                .font(.system(size: 16, weight: .bold))
            Text("\(selectedIndex + 1) / \(items.count)")
                .font(.system(size: 20, weight: .semibold).monospacedDigit())
            Capsule()
                .fill(Color.white.opacity(0.2))
                .frame(width: 140, height: 4)
                .overlay(alignment: .leading) {
                    Capsule().fill(Color.white).frame(width: 140 * progress, height: 4)
                }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 22)
        .padding(.vertical, 12)
        .eosGlassPanel(Capsule())
        .environment(\.colorScheme, .dark)
    }

    // MARK: Remote

    private func handleMove(_ direction: MoveCommandDirection) {
        switch direction {
        case .left: step(-1)
        case .right: step(1)
        case .up: onToggleFavorite?(current)
        case .down: onDismiss()
        default: break
        }
    }

    private func step(_ delta: Int) {
        let next = selectedIndex + delta
        guard items.indices.contains(next) else {
            if delta > 0, playing, items.count > 1 { go(to: 0, forward: true) }
            return
        }
        go(to: next, forward: delta > 0)
    }

    private func go(to index: Int, forward: Bool) {
        self.forward = forward
        withAnimation(.spring(response: 0.7, dampingFraction: 0.9)) { selectedIndex = index }
        prefetchAdjacent(around: index)
        restartTicker()
    }

    private func togglePlay() {
        playing.toggle()
        restartTicker()
    }

    /// Slideshow clock: fills the progress line, then moves to the next photo.
    private func restartTicker() {
        ticker?.cancel()
        progress = 0
        guard playing, items.count > 1 else { return }
        let seconds = Self.slideSeconds
        withAnimation(.linear(duration: seconds)) { progress = 1 }
        ticker = Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            guard !Task.isCancelled else { return }
            step(1)
        }
    }

    private func prefetchAdjacent(around index: Int) {
        var urls: [URL] = []
        for i in [index - 1, index, index + 1, index + 2] where i >= 0 && i < items.count {
            if let u = items[i].immersiveImageURL { urls.append(u) }
        }
        EOSImageCache.prefetch(urls: urls, size: .screen)
    }
}

private struct ImmersiveStageStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.contentShape(Rectangle())
    }
}

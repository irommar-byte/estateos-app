import SwiftUI
import UIKit

struct LoyaltyLogo: View {
    let program: LoyaltyProgram
    var size: CGFloat = 44
    var visual: LoyaltyVisual?
    var sitsOnBrandColor: Bool = false
    var wideWordmark: Bool = false
    @State private var loaded: LoyaltyVisual?
    @State private var fieldMark: UIImage?

    private var shown: LoyaltyVisual {
        visual ?? loaded ?? LoyaltyVisual(image: nil, usesBrandMark: LoyaltyBrandArt.hasMark(program.id), color: program.brandColor)
    }

    private var onDark: Bool { program.brandColor.relativeLuminance <= 0.62 }
    private var spec: LoyaltyBrandKit.Spec { LoyaltyBrandKit.spec(for: program.id) }

    var body: some View {
        Group {
            if wideWordmark {
                wordmark
                    .frame(height: size)
                    .frame(maxWidth: size * 4.4, alignment: .leading)
            } else {
                iconBadge
            }
        }
        .task(id: "\(program.id)-\(sitsOnBrandColor)-\(wideWordmark)") {
            if visual == nil {
                loaded = await LoyaltyLogoStore.shared.visual(for: program)
            }
            let source = visual ?? loaded
            if sitsOnBrandColor, let image = source?.image {
                fieldMark = PassArtwork.adapted(
                    image,
                    onDarkBackground: onDark,
                    backgroundHex: program.cardColorHex,
                    forceWhite: spec.whiteOnBrand
                )
            } else {
                fieldMark = nil
            }
        }
        .accessibilityHidden(true)
    }

    private var wordmark: some View {
        mark
            .scaledToFit()
    }

    private var iconBadge: some View {
        ZStack {
            if sitsOnBrandColor == false {
                RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                    .fill(Color.white)
            }
            mark
        }
        .frame(width: size, height: size)
        .overlay {
            if sitsOnBrandColor == false {
                RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.6)
            }
        }
        .shadow(color: sitsOnBrandColor ? .clear : .black.opacity(0.08), radius: 2, y: 1)
    }

    @ViewBuilder
    private var mark: some View {
        if sitsOnBrandColor, let fieldMark, PassArtwork.opaqueRatio(fieldMark) > 0.04 {
            Image(uiImage: fieldMark)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .padding(size * (program.id == "biedronka" ? 0.12 : 0.06))
        } else if sitsOnBrandColor && LoyaltyBrandArt.hasMark(program.id) {
            LoyaltyBrandMark(program: program, size: size * 0.92, onBrandField: true)
        } else if let image = shown.image {
            Image(uiImage: image)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .padding(size * 0.12)
        } else if shown.usesBrandMark {
            LoyaltyBrandMark(program: program, size: size * 0.86)
        } else {
            Text(program.monogram)
                .font(.system(size: size * 0.32, weight: .bold, design: .rounded))
                .foregroundStyle(program.onColor)
                .padding(size * 0.12)
                .background(program.brandColor, in: RoundedRectangle(cornerRadius: size * 0.16, style: .continuous))
        }
    }
}

struct LoyaltyCardPass: View {
    enum Style {
        case stack
        case detail
    }

    let card: LoyaltyCard
    var style: Style = .detail
    var showsBarcode: Bool = false
    var isExpanded: Bool = false
    var showsCode: Bool = false
    var showsChevron: Bool = false
    var foilActive: Bool = false
    @State private var visual: LoyaltyVisual?

    private var program: LoyaltyProgram { card.program }
    private var cardColor: Color { program.brandColor }
    private var onDark: Bool { cardColor.relativeLuminance <= 0.62 }
    private var onColor: Color { onDark ? Color.white : Color.black }

    private var corner: CGFloat { 16 }

    var body: some View {
        Group {
            if style == .stack {
                stackStrip
            } else {
                detailBody
            }
        }
        .task(id: card.programID) {
            visual = await LoyaltyLogoStore.shared.visual(for: program)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    /// Header uses the original mark: wordmark alone, or icon + original name — never a second system title on a wordmark.
    private struct LoyaltyBrandHeader: View {
        let program: LoyaltyProgram
        var visual: LoyaltyVisual?
        var height: CGFloat

        var body: some View {
            let face = LoyaltyBrandKit.composeForeground(
                program: program,
                logo: visual?.image,
                size: CGSize(width: max(320, height * 10), height: height),
                placement: .leading,
                onBrandField: true,
                scale: 3
            )
            Image(uiImage: face)
                .resizable()
                .interpolation(.medium)
                .scaledToFit()
                .frame(height: height, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Wallet pass face: brand header, chip, metal PAN — matches Apple Wallet card chrome.
    private var stackStrip: some View {
        ZStack(alignment: .topLeading) {
            passChrome
            VStack(alignment: .leading, spacing: 0) {
                LoyaltyBrandHeader(program: program, visual: visual, height: 34)
                Spacer(minLength: 10)
                CreditCardChip(onDark: onDark)
                    .padding(.bottom, 18)
                if card.barcodePayload.isEmpty == false {
                    EmbossedMetalText(
                        text: LoyaltyCardPass.groupedCode(card.barcodePayload),
                        fontSize: 17,
                        gyroSheen: true
                    )
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 18)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: Self.stackHeight, alignment: .top)
        .contentShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }

    private var detailBody: some View {
        ZStack(alignment: .topLeading) {
            passChrome
            VStack(alignment: .leading, spacing: 0) {
                LoyaltyBrandHeader(program: program, visual: visual, height: 34)
                Spacer(minLength: 10)
                CreditCardChip(onDark: onDark)
                    .padding(.bottom, 16)
                if card.barcodePayload.isEmpty == false {
                    EmbossedMetalText(
                        text: LoyaltyCardPass.groupedCode(card.barcodePayload),
                        fontSize: 22,
                        gyroSheen: foilActive
                    )
                } else {
                    Text("Brak kodu")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(onColor.opacity(0.7))
                }
                if showsBarcode, card.barcodePayload.isEmpty == false {
                    barcodeWell
                        .padding(.top, 14)
                }
                if card.holderName.isEmpty == false {
                    Text(card.holderName.uppercased())
                        .font(.caption.weight(.medium))
                        .tracking(0.8)
                        .foregroundStyle(onColor.opacity(0.72))
                        .padding(.top, showsBarcode ? 10 : 10)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 18)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }

    /// Face ≈ Apple Wallet pass proportions; peek matches native header strip.
    static let stackHeight: CGFloat = 212
    static let stackPeek: CGFloat = 54

    static func groupedCode(_ payload: String) -> String {
        let raw = payload.filter { $0.isNumber || $0.isLetter }
        guard raw.count >= 8 else { return payload }
        var parts: [String] = []
        var i = raw.startIndex
        while i < raw.endIndex {
            let end = raw.index(i, offsetBy: 4, limitedBy: raw.endIndex) ?? raw.endIndex
            parts.append(String(raw[i..<end]))
            i = end
        }
        return parts.joined(separator: "  ")
    }

    private var accessibilityText: String {
        let code = card.barcodePayload.isEmpty ? "brak kodu" : card.barcodePayload
        return "\(card.displayName), \(code), karta lojalnościowa"
    }

    @ViewBuilder
    private var passChrome: some View {
        let shape = RoundedRectangle(cornerRadius: corner, style: .continuous)
        shape
            .fill(passGradient)
            .overlay {
                // Soft plastic edge — static, no motion sensors.
                shape
                    .strokeBorder(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.48),
                                Color.white.opacity(0.10),
                                Color.black.opacity(0.28)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 0.8
                    )
            }
            .overlay(alignment: .top) {
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.20),
                        Color.white.opacity(0.06),
                        Color.clear
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 72)
                .clipShape(shape)
                .allowsHitTesting(false)
            }
            .shadow(
                color: .black.opacity(style == .stack ? 0 : 0.22),
                radius: style == .stack ? 0 : 18,
                y: style == .stack ? 0 : 10
            )
    }

    private var barcodeWell: some View {
        VStack(spacing: 8) {
            if let image = BarcodePresenter.image(
                payload: card.barcodePayload,
                symbology: card.barcodeSymbology,
                width: card.barcodeSymbology == .qr ? 360 : 720,
                height: card.barcodeSymbology == .qr ? 360 : 160
            ) {
                Image(uiImage: image)
                    .resizable()
                    .interpolation(.none)
                    .scaledToFit()
                    .frame(maxHeight: card.barcodeSymbology == .qr ? 150 : 78)
                    .padding(.horizontal, 8)
            }
            Text(card.barcodePayload)
                .font(.caption2.monospaced())
                .foregroundStyle(.black.opacity(0.72))
                .lineLimit(2)
                .minimumScaleFactor(0.7)
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var passGradient: LinearGradient {
        LinearGradient(
            colors: [
                cardColor.shaded(brightness: 1.10, saturation: 0.96),
                cardColor.shaded(brightness: 0.92, saturation: 1.0),
                cardColor.shaded(brightness: 0.68, saturation: 1.05)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

/// Static EMV-style chip — gold plate with contact pads.
private struct CreditCardChip: View {
    var onDark: Bool

    var body: some View {
        RoundedRectangle(cornerRadius: 4, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        Color(red: 0.94, green: 0.84, blue: 0.52),
                        Color(red: 0.70, green: 0.55, blue: 0.26),
                        Color(red: 0.90, green: 0.78, blue: 0.42)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .strokeBorder(Color.black.opacity(0.22), lineWidth: 0.5)
            }
            .overlay {
                VStack(spacing: 3) {
                    HStack(spacing: 3) {
                        chipPad; chipPad
                    }
                    HStack(spacing: 3) {
                        chipPad; chipPad
                    }
                }
                .padding(5)
            }
            .frame(width: 36, height: 28)
            .shadow(color: .black.opacity(onDark ? 0.38 : 0.14), radius: 1.2, y: 0.6)
            .accessibilityHidden(true)
    }

    private var chipPad: some View {
        RoundedRectangle(cornerRadius: 1, style: .continuous)
            .fill(Color.black.opacity(0.16))
            .frame(maxWidth: .infinity)
            .frame(height: 6)
    }
}

/// Metallic embossed digits. Gyro sheen is a GPU streak — the plastic face never tilts.
struct EmbossedMetalText: View {
    let text: String
    var fontSize: CGFloat = 22
    var gyroSheen: Bool = false

    var body: some View {
        MetalPANLabel(text: text, fontSize: fontSize, gyroActive: gyroSheen)
            .frame(height: fontSize * 1.35)
            .accessibilityHidden(true)
    }
}

enum LoyaltyPassStackMetrics {
    static let cardHeight = LoyaltyCardPass.stackHeight
    /// Collapsed Wallet peek — logo strip only.
    static let peek = LoyaltyCardPass.stackPeek
    /// Pull-apart is subtle (Wallet rubber-band), not a full fan.
    static let expandedStep: CGFloat = peek + 34

    static func step(spread: CGFloat) -> CGFloat {
        let t = WalletFan.clamp(spread)
        // Soft ease — early pull stays tight.
        let eased = t * t * (3 - 2 * t)
        return peek + (expandedStep - peek) * eased
    }

    static func stackHeight(count: Int, spread: CGFloat) -> CGFloat {
        guard count > 0 else { return 0 }
        if count == 1 { return cardHeight }
        return cardHeight + CGFloat(count - 1) * step(spread: spread)
    }

    static func yOffset(index: Int, spread: CGFloat) -> CGFloat {
        CGFloat(index) * step(spread: spread)
    }

    static func collapsedHeight(count: Int) -> CGFloat {
        stackHeight(count: count, spread: 0)
    }

    static func fanSpacing(count: Int, viewport: CGFloat) -> CGFloat {
        guard count > 1 else { return 0 }
        let minSpacing: CGFloat = 8
        let maxSpacing: CGFloat = 14
        let cardsHeight = CGFloat(count) * cardHeight
        let gaps = CGFloat(count - 1)
        let leftover = viewport - cardsHeight
        if viewport <= 0 || leftover < minSpacing * gaps {
            return minSpacing
        }
        return min(maxSpacing, leftover / gaps)
    }

    static func rowHeight(index: Int, count: Int, expanded: Bool) -> CGFloat {
        if expanded { return cardHeight }
        if index == count - 1 { return cardHeight }
        return peek
    }
}

enum WalletFan {
    static func clamp(_ x: CGFloat) -> CGFloat { min(1, max(0, x)) }

    /// Slow rubber: ~240pt of pull → capped apart; strong resistance after.
    static func spread(fromPull pull: CGFloat) -> CGFloat {
        let travel = max(0, pull)
        let linear = travel / 240
        if linear <= 1 { return clamp(linear * 0.72) }
        return clamp(0.72 + (linear - 1) * 0.12)
    }
}

/// Continuous Apple Wallet–style stack.
/// Pull-down rubber-band + Wallet long-press drag (finger-locked, one slot at a time).
struct LoyaltyPassStack: View {
    let cards: [LoyaltyCard]
    var zoomNamespace: Namespace.ID
    var scrollOffsetY: CGFloat = 0
    @Binding var spread: CGFloat
    @Binding var openingID: UUID?
    @Binding var isReordering: Bool
    var onOpen: (LoyaltyCard) -> Void
    /// Persist final UUID order once — never mid-drag.
    var onCommitOrder: ([UUID]) -> Void = { _ in }

    @State private var displayOrder: [UUID] = []
    @State private var rubber: CGFloat = 0
    @State private var wasOverscrolling = false
    @State private var draggingID: UUID?
    /// Raw finger translation from long-press recognition (never rewritten on swap).
    @State private var dragTranslation: CGFloat = 0
    /// Index in the pile when the drag started (fixed for the whole gesture).
    @State private var dragHomeIndex: Int = 0
    /// Fan spacing frozen at drag start — never collapses under the finger.
    @State private var dragLayoutSpread: CGFloat = 0
    /// Translation at which the last adjacent swap happened (hysteresis anchor).
    @State private var swapAnchor: CGFloat = 0
    @State private var slotTick: Int = 0
    @State private var didReorder = false

    private var cardByID: [UUID: LoyaltyCard] {
        Dictionary(cards.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    }

    private var orderedCards: [LoyaltyCard] {
        let lookup = cardByID
        let ordered = displayOrder.compactMap { lookup[$0] }
        if ordered.count == cards.count { return ordered }
        return cards
    }

    private var liveSpread: CGFloat {
        // Keep the same spacing the user saw when they pressed — collapsing to 0
        // teleports the lifted card to the top of the pile.
        if draggingID != nil { return dragLayoutSpread }
        return WalletFan.clamp(max(spread, rubber))
    }

    private var step: CGFloat {
        LoyaltyPassStackMetrics.step(spread: liveSpread)
    }

    /// Deliberate one-slot push; never multi-slot teleport.
    private var swapThreshold: CGFloat { max(40, step * 0.62) }

    var body: some View {
        let stack = orderedCards
        let height = LoyaltyPassStackMetrics.stackHeight(count: stack.count, spread: liveSpread)
        let liftPad: CGFloat = draggingID == nil ? 0 : 20
        ZStack(alignment: .top) {
            ForEach(Array(stack.enumerated()), id: \.element.persistentModelID) { index, card in
                cardFace(card, index: index, count: stack.count)
                    .offset(y: cardOffset(index: index, cardID: card.id) + liftPad)
                    .zIndex(zIndex(for: card, index: index))
            }
        }
        .frame(height: height + liftPad * 2, alignment: .top)
        .frame(maxWidth: .infinity)
        // Do not put a full-stack contentShape here — it steals ScrollView pans.
        .padding(.vertical, draggingID == nil ? 0 : 6)
        .onAppear { syncDisplayOrderIfNeeded() }
        .onChange(of: cards.map(\.id)) { _, _ in
            syncDisplayOrderIfNeeded()
        }
        .onChange(of: scrollOffsetY) { _, y in
            handleOverscroll(y)
        }
        .onChange(of: draggingID) { _, id in
            isReordering = id != nil
        }
        .onDisappear {
            // Never leave scroll locked if the view goes away mid-drag.
            if draggingID != nil {
                draggingID = nil
                dragTranslation = 0
                isReordering = false
            }
        }
        .sensoryFeedback(.selection, trigger: slotTick)
        .accessibilityElement(children: .contain)
        .accessibilityHint("Przytrzymaj i przeciągnij kartę, aby zmienić kolejność.")
    }

    private func syncDisplayOrderIfNeeded() {
        guard draggingID == nil else { return }
        let ids = cards.map(\.id)
        if displayOrder != ids {
            displayOrder = ids
        }
    }

    private func cardOffset(index: Int, cardID: UUID) -> CGFloat {
        // Dragged card stays under the finger from its home slot — no teleport on swap.
        if cardID == draggingID {
            let home = LoyaltyPassStackMetrics.yOffset(index: dragHomeIndex, spread: liveSpread)
            return home + dragTranslation
        }
        return LoyaltyPassStackMetrics.yOffset(index: index, spread: liveSpread)
    }

    private func zIndex(for card: LoyaltyCard, index: Int) -> Double {
        if card.id == draggingID { return 9_000 }
        if openingID == card.id { return 8_000 }
        return Double(index)
    }

    private func handleOverscroll(_ y: CGFloat) {
        guard draggingID == nil else { return }
        if y < -4 {
            wasOverscrolling = true
            var t = Transaction()
            t.disablesAnimations = true
            withTransaction(t) {
                rubber = WalletFan.spread(fromPull: -y)
            }
        } else if wasOverscrolling, y >= -1 {
            wasOverscrolling = false
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            withAnimation(PassStackMotion.wallet) {
                rubber = 0
                spread = 0
            }
        } else if y >= 0, rubber > 0, wasOverscrolling == false {
            rubber = 0
        }
    }

    private func cardFace(_ card: LoyaltyCard, index: Int, count: Int) -> some View {
        let depth = Double(count - 1 - index)
        let isDragging = draggingID == card.id
        let lifted = isDragging
        // Only the visible peek (or full face while lifted / last) owns touches —
        // UIKit strip lets ScrollView keep the first finger pan.
        let hitHeight: CGFloat = {
            if isDragging { return LoyaltyPassStackMetrics.cardHeight }
            if index == count - 1 { return LoyaltyPassStackMetrics.cardHeight }
            return LoyaltyPassStackMetrics.peek + 10
        }()

        return LoyaltyCardPass(
            card: card,
            style: .stack,
            foilActive: false
        )
        .compositingGroup()
        .overlay(alignment: .top) {
            if index > 0, isDragging == false {
                VStack(spacing: 0) {
                    Color.black.opacity(0.45)
                        .frame(height: 1)
                    LinearGradient(
                        colors: [
                            Color.black.opacity(0.42),
                            Color.black.opacity(0.14),
                            .clear
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 22)
                }
                .clipShape(
                    UnevenRoundedRectangle(
                        topLeadingRadius: 16,
                        bottomLeadingRadius: 0,
                        bottomTrailingRadius: 0,
                        topTrailingRadius: 16,
                        style: .continuous
                    )
                )
                .allowsHitTesting(false)
            }
        }
        .shadow(
            color: .black.opacity(lifted ? 0.46 : 0.38 + min(0.16, depth * 0.02)),
            radius: lifted ? 22 : 16,
            y: lifted ? 12 : 8
        )
        .shadow(color: .black.opacity(0.22), radius: 3, y: 1.5)
        .scaleEffect(lifted ? 1.03 : 1, anchor: .top)
        .matchedTransitionSource(id: card.id, in: zoomNamespace)
        .frame(height: LoyaltyPassStackMetrics.cardHeight, alignment: .top)
        .allowsHitTesting(false)
        .overlay(alignment: .top) {
            WalletCardHitStrip(
                isReordering: isDragging,
                onTap: {
                    guard draggingID == nil else { return }
                    openingID = card.id
                    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                    onOpen(card)
                },
                onBeginReorder: {
                    guard draggingID == nil else { return }
                    beginReorder(card: card, index: index)
                },
                onDrag: { translation in
                    guard draggingID == card.id else { return }
                    applyDrag(translation: translation)
                },
                onEnd: {
                    guard draggingID == card.id else { return }
                    endReorder()
                }
            )
            .frame(height: hitHeight)
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(card.displayName)
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Otwiera kartę. Przytrzymaj i przeciągnij, aby zmienić kolejność.")
        }
        .animation(draggingID == nil ? nil : PassStackMotion.reorder, value: displayOrder)
    }

    private func beginReorder(card: LoyaltyCard, index: Int) {
        syncDisplayOrderIfNeeded()
        dragLayoutSpread = WalletFan.clamp(max(spread, rubber))
        draggingID = card.id
        dragHomeIndex = displayOrder.firstIndex(of: card.id) ?? index
        dragTranslation = 0
        swapAnchor = 0
        didReorder = false
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    private func endReorder() {
        let order = displayOrder
        let changed = didReorder
        withAnimation(PassStackMotion.reorder) {
            draggingID = nil
            dragTranslation = 0
            swapAnchor = 0
        }
        didReorder = false
        if changed {
            onCommitOrder(order)
        }
    }

    /// Finger-locked drag; swap at most one adjacent slot when past hysteresis threshold.
    private func applyDrag(translation: CGFloat) {
        dragTranslation = translation
        guard let id = draggingID,
              let current = displayOrder.firstIndex(of: id)
        else { return }

        let deltaFromAnchor = translation - swapAnchor
        guard abs(deltaFromAnchor) >= swapThreshold else { return }

        let direction = deltaFromAnchor > 0 ? 1 : -1
        let dest = current + direction
        guard dest >= 0, dest < displayOrder.count else { return }

        var next = displayOrder
        next.remove(at: current)
        next.insert(id, at: dest)
        withAnimation(PassStackMotion.reorder) {
            displayOrder = next
        }
        // Anchor advances by one step so the next swap needs another deliberate push.
        swapAnchor += CGFloat(direction) * step
        didReorder = true
        slotTick &+= 1
    }
}

/// Peek hit target that yields vertical pans to UIScrollView until long-press arms reorder.
private struct WalletCardHitStrip: UIViewRepresentable {
    var isReordering: Bool
    var onTap: () -> Void
    var onBeginReorder: () -> Void
    var onDrag: (CGFloat) -> Void
    var onEnd: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WalletCardHitView {
        let view = WalletCardHitView()
        view.coordinator = context.coordinator
        context.coordinator.owner = view
        return view
    }

    func updateUIView(_ uiView: WalletCardHitView, context: Context) {
        let coordinator = context.coordinator
        coordinator.onTap = onTap
        coordinator.onBeginReorder = onBeginReorder
        coordinator.onDrag = onDrag
        coordinator.onEnd = onEnd
        uiView.coordinator = coordinator
        uiView.isReordering = isReordering
        uiView.bindDelegates()
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        weak var owner: WalletCardHitView?
        var onTap: () -> Void = {}
        var onBeginReorder: () -> Void = {}
        var onDrag: (CGFloat) -> Void = { _ in }
        var onEnd: () -> Void = {}
        var armed = false
        private var dragOriginY: CGFloat = 0

        @objc func handleTap(_ gr: UITapGestureRecognizer) {
            guard armed == false, owner?.isReordering != true else { return }
            onTap()
        }

        @objc func handleLongPress(_ gr: UILongPressGestureRecognizer) {
            guard let view = owner else { return }
            switch gr.state {
            case .began:
                armed = true
                dragOriginY = gr.location(in: view.window).y
                onBeginReorder()
            case .changed:
                guard armed else { return }
                let y = gr.location(in: view.window).y
                onDrag(y - dragOriginY)
            case .ended, .cancelled, .failed:
                if armed {
                    armed = false
                    onEnd()
                }
            default:
                break
            }
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            // Let the scroll view pan while we wait for long-press.
            if gestureRecognizer is UILongPressGestureRecognizer {
                return armed == false
            }
            if gestureRecognizer is UITapGestureRecognizer {
                return true
            }
            return false
        }

        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            if gestureRecognizer is UITapGestureRecognizer {
                return armed == false && owner?.isReordering != true
            }
            return true
        }
    }
}

private final class WalletCardHitView: UIView {
    weak var coordinator: WalletCardHitStrip.Coordinator?
    var isReordering = false

    private let tap = UITapGestureRecognizer()
    private let longPress = UILongPressGestureRecognizer()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isAccessibilityElement = false

        tap.addTarget(self, action: #selector(forwardTap(_:)))
        tap.cancelsTouchesInView = false
        addGestureRecognizer(tap)

        longPress.minimumPressDuration = 0.42
        longPress.allowableMovement = 14
        longPress.cancelsTouchesInView = false
        longPress.delaysTouchesBegan = false
        longPress.delaysTouchesEnded = false
        longPress.addTarget(self, action: #selector(forwardLongPress(_:)))
        addGestureRecognizer(longPress)
        // Do not make tap wait on long-press — that delays every open by ~0.4s.
    }

    required init?(coder: NSCoder) { nil }

    func bindDelegates() {
        tap.delegate = coordinator
        longPress.delegate = coordinator
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        bindDelegates()
    }

    @objc private func forwardTap(_ gr: UITapGestureRecognizer) {
        coordinator?.handleTap(gr)
    }

    @objc private func forwardLongPress(_ gr: UILongPressGestureRecognizer) {
        // Once armed, cancel touches into the scroll view so reorder owns the finger.
        if gr.state == .began {
            longPress.cancelsTouchesInView = true
        } else if gr.state == .ended || gr.state == .cancelled || gr.state == .failed {
            longPress.cancelsTouchesInView = false
        }
        coordinator?.handleLongPress(gr)
    }
}

struct LoyaltyPassPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(
                configuration.isPressed && UIAccessibility.isReduceMotionEnabled == false
                    ? ParagonTheme.pressScale
                    : 1,
                anchor: .top
            )
            .animation(ParagonTheme.pressAnimation, value: configuration.isPressed)
    }
}

struct StackChevron: View {
    var isExpanded: Bool
    var tint: Color

    var body: some View {
        Image(systemName: "chevron.compact.down")
            .font(.title3.weight(.bold))
            .foregroundStyle(
                LinearGradient(
                    colors: [
                        tint.opacity(0.95),
                        tint.opacity(0.55),
                        tint
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .shadow(color: .white.opacity(0.55), radius: 1.2, y: -0.5)
            .shadow(color: .black.opacity(0.28), radius: 0, y: 1)
            .overlay {
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0.15),
                        .init(color: Color.white.opacity(0.9), location: 0.42),
                        .init(color: .clear, location: 0.7)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .mask(
                    Image(systemName: "chevron.compact.down")
                        .font(.title3.weight(.bold))
                )
                .blendMode(.plusLighter)
            }
            .rotationEffect(.degrees(isExpanded ? 180 : 0))
            .accessibilityHidden(true)
    }
}

enum PassStackMotion {
    static var response: Double { ParagonTheme.springResponse }
    static var damping: Double { ParagonTheme.springDamping }

    static var snappy: Animation { ParagonTheme.snappy }

    static var expand: Animation {
        UIAccessibility.isReduceMotionEnabled
            ? .easeOut(duration: 0.16)
            : .spring(response: 0.34, dampingFraction: 0.86)
    }

    /// Apple Wallet rubber-band settle — soft return after pull.
    static var wallet: Animation {
        UIAccessibility.isReduceMotionEnabled
            ? .easeOut(duration: 0.22)
            : .spring(response: 0.55, dampingFraction: 0.86)
    }

    /// Instant Wallet slot shuffle while dragging.
    static var reorder: Animation {
        UIAccessibility.isReduceMotionEnabled
            ? .easeOut(duration: 0.12)
            : .interactiveSpring(response: 0.28, dampingFraction: 0.86, blendDuration: 0.08)
    }
}

struct LoyaltyProgramGroup: Identifiable {
    var id: String { programID }
    let programID: String
    let cards: [LoyaltyCard]

    static func groups(from cards: [LoyaltyCard]) -> [LoyaltyProgramGroup] {
        var order: [String] = []
        var buckets: [String: [LoyaltyCard]] = [:]
        for card in cards {
            let key = card.programID.isEmpty ? card.displayName.lowercased() : card.programID
            if buckets[key] == nil { order.append(key) }
            buckets[key, default: []].append(card)
        }
        return order.map { LoyaltyProgramGroup(programID: $0, cards: buckets[$0] ?? []) }
    }
}

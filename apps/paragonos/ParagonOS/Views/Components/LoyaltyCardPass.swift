import SwiftUI
import UIKit

struct LoyaltyLogo: View {
    let program: LoyaltyProgram
    var size: CGFloat = 44
    var visual: LoyaltyVisual?
    var sitsOnBrandColor: Bool = false
    @State private var loaded: LoyaltyVisual?
    @State private var fieldMark: UIImage?

    private var shown: LoyaltyVisual {
        visual ?? loaded ?? LoyaltyVisual(image: nil, usesBrandMark: LoyaltyBrandArt.hasMark(program.id), color: program.brandColor)
    }

    private var onDark: Bool { program.brandColor.relativeLuminance <= 0.62 }

    var body: some View {
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
        .task(id: "\(program.id)-\(sitsOnBrandColor)") {
            if visual == nil {
                loaded = await LoyaltyLogoStore.shared.visual(for: program)
            }
            let source = visual ?? loaded
            if sitsOnBrandColor, let image = source?.image {
                fieldMark = PassArtwork.adapted(
                    image,
                    onDarkBackground: onDark,
                    backgroundHex: program.cardColorHex
                )
            } else {
                fieldMark = nil
            }
        }
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private var mark: some View {
        if sitsOnBrandColor, let fieldMark, PassArtwork.opaqueRatio(fieldMark) > 0.04 {
            Image(uiImage: fieldMark)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .padding(size * (program.id == "biedronka" ? 0.04 : 0.06))
        } else if sitsOnBrandColor && LoyaltyBrandArt.hasMark(program.id) {
            LoyaltyBrandMark(program: program, size: size * 0.92)
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
    @State private var visual: LoyaltyVisual?

    private var program: LoyaltyProgram { card.program }
    private var cardColor: Color { program.brandColor }
    private var onDark: Bool { cardColor.relativeLuminance <= 0.62 }
    private var onColor: Color { onDark ? Color.white : Color.black }

    private var corner: CGFloat { 22 }

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

    private var stackStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                LoyaltyLogo(program: program, size: 40, visual: visual, sitsOnBrandColor: true)
                Text(card.displayName)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(onColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 8)
                if showsChevron {
                    StackChevron(isExpanded: isExpanded, tint: onColor)
                }
            }
            if card.barcodePayload.isEmpty == false {
                EmbossedMetalText(
                    text: card.barcodePayload,
                    font: .system(size: 22, weight: .semibold, design: .rounded),
                    monospaced: true
                )
                .lineLimit(1)
                .minimumScaleFactor(0.55)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: Self.stackHeight, alignment: .top)
        .background { passChrome }
        .contentShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }

    private var detailBody: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 12) {
                LoyaltyLogo(program: program, size: 48, visual: visual, sitsOnBrandColor: true)
                Text(card.displayName)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(onColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                Spacer(minLength: 8)
            }

            if card.barcodePayload.isEmpty == false {
                EmbossedMetalText(
                    text: card.barcodePayload,
                    font: .system(size: 24, weight: .semibold, design: .rounded),
                    monospaced: true
                )
            } else {
                Text("Brak kodu")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(onColor.opacity(0.7))
            }

            if showsBarcode, card.barcodePayload.isEmpty == false {
                barcodeWell
            } else if card.holderName.isEmpty == false {
                Text(card.holderName)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(onColor.opacity(0.78))
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { passChrome }
        .contentShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }

    static let stackHeight: CGFloat = 136
    static let stackPeek: CGFloat = 70

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
                shape
                    .strokeBorder(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.42),
                                Color.white.opacity(0.08),
                                Color.black.opacity(0.22)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: 1
                    )
            }
            .overlay {
                GyroFoilOverlay(cornerRadius: corner, intensity: style == .detail ? 0.82 : 0.58)
                    .clipShape(shape)
                    .allowsHitTesting(false)
            }
            .overlay(alignment: .top) {
                LinearGradient(
                    colors: [Color.white.opacity(0.26), Color.white.opacity(0)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 44)
                .clipShape(shape)
                .allowsHitTesting(false)
            }
            .shadow(color: .black.opacity(style == .stack ? 0.22 : 0.1), radius: style == .stack ? 8 : 6, y: style == .stack ? 3 : 4)
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
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var passGradient: LinearGradient {
        LinearGradient(
            colors: [
                cardColor.shaded(brightness: 1.16, saturation: 0.96),
                cardColor,
                cardColor.shaded(brightness: 0.68, saturation: 1.06)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

struct EmbossedMetalText: View {
    let text: String
    var font: Font = .title3.weight(.bold)
    var monospaced: Bool = false

    var body: some View {
        let styled: Font = monospaced ? font.monospaced() : font
        Text(text)
            .font(styled)
            .foregroundStyle(
                LinearGradient(
                    colors: [
                        Color(white: 0.82),
                        Color(white: 0.96),
                        Color(white: 0.62)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .shadow(color: .black.opacity(0.28), radius: 0, y: 1)
            .overlay {
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .white.opacity(0.0), location: 0.28),
                        .init(color: .white.opacity(0.72), location: 0.46),
                        .init(color: .white.opacity(0.0), location: 0.64),
                        .init(color: .clear, location: 1)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .mask(Text(text).font(styled))
                .blendMode(.plusLighter)
            }
            .accessibilityHidden(true)
    }
}

enum LoyaltyPassStackMetrics {
    static let cardHeight = LoyaltyCardPass.stackHeight
    static let peek = LoyaltyCardPass.stackPeek

    static func collapsedHeight(count: Int) -> CGFloat {
        guard count > 0 else { return 0 }
        return cardHeight + CGFloat(count - 1) * peek
    }

    static func fanSpacing(count: Int, viewport: CGFloat) -> CGFloat {
        guard count > 1 else { return 0 }
        let minSpacing: CGFloat = 10
        let maxSpacing: CGFloat = 20
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

struct LoyaltyPassStack: View {
    let cards: [LoyaltyCard]
    var zoomNamespace: Namespace.ID
    var viewportHeight: CGFloat = 0
    @Binding var isExpanded: Bool
    @Binding var openingID: UUID?
    var onOpen: (LoyaltyCard) -> Void
    var onCheckout: (LoyaltyCard) -> Void

    var body: some View {
        VStack(spacing: isExpanded ? LoyaltyPassStackMetrics.fanSpacing(count: cards.count, viewport: viewportHeight) : 0) {
            ForEach(Array(cards.enumerated()), id: \.element.id) { index, card in
                cardRow(card, index: index)
                    .frame(
                        height: LoyaltyPassStackMetrics.rowHeight(index: index, count: cards.count, expanded: isExpanded),
                        alignment: .top
                    )
                    .contentShape(Rectangle())
                    .zIndex(openingID == card.id ? 1000 : Double(index))
                    .offset(y: openingID == card.id ? -28 : 0)
                    .id(card.id)
            }
        }
        .animation(PassStackMotion.snappy, value: isExpanded)
        .animation(PassStackMotion.snappy, value: openingID)
        .onChange(of: cards.map(\.id)) { _, _ in
            if cards.count <= 1 {
                isExpanded = false
            }
        }
    }

    private func cardRow(_ card: LoyaltyCard, index: Int) -> some View {
        let showChevron = index == cards.count - 1 && cards.count > 1
        let chevronTint = card.program.brandColor.relativeLuminance <= 0.62 ? Color.white : Color.black
        return ZStack(alignment: .topTrailing) {
            Button {
                openingID = card.id
                UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                onOpen(card)
            } label: {
                LoyaltyCardPass(
                    card: card,
                    style: .stack,
                    isExpanded: isExpanded
                )
            }
            .buttonStyle(LoyaltyPassPressStyle())
            .matchedTransitionSource(id: card.id, in: zoomNamespace)
            .accessibilityHint("Otwiera kartę")
            if showChevron {
                Button {
                    toggleStack()
                } label: {
                    StackChevron(isExpanded: isExpanded, tint: chevronTint)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .padding(.top, 8)
                .padding(.trailing, 8)
                .accessibilityLabel(isExpanded ? "Zwiń stos" : "Rozsuń karty")
            }
        }
        .contextMenu {
            Button {
                onCheckout(card)
            } label: {
                Label("Pokaż przy kasie", systemImage: "barcode")
            }
        }
    }

    private func toggleStack() {
        UIImpactFeedbackGenerator(style: isExpanded ? .light : .soft).impactOccurred()
        withAnimation(PassStackMotion.snappy) {
            isExpanded.toggle()
        }
    }
}

struct LoyaltyPassPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.985 : 1, anchor: .top)
            .animation(.easeOut(duration: 0.14), value: configuration.isPressed)
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
    static let snappy = Animation.spring(response: 0.36, dampingFraction: 0.86)
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

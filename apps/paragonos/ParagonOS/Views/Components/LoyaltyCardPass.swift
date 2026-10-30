import CoreMotion
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
    @State private var barcodeImage: UIImage?

    private var program: LoyaltyProgram { card.program }

    private var numberLabel: some View {
        EngravedText(
            text: Text("NUMER KARTY").font(.system(size: 10, weight: .semibold)).tracking(1.6),
            onDark: onDark
        )
        .opacity(0.86)
        .padding(.bottom, 5)
    }
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
            if let cached = LoyaltyVisualCache.map[program.id] {
                visual = cached
                return
            }
            let loaded = await LoyaltyLogoStore.shared.visual(for: program)
            LoyaltyVisualCache.map[program.id] = loaded
            withAnimation(.smooth(duration: 0.3)) { visual = loaded }
        }
        .task(id: showsBarcode ? "\(card.barcodePayload)|\(card.barcodeSymbology)" : "") {
            guard showsBarcode else { return }
            barcodeImage = BarcodePresenter.image(
                payload: card.barcodePayload,
                symbology: card.barcodeSymbology,
                width: card.barcodeSymbology == .qr ? 360 : 720,
                height: card.barcodeSymbology == .qr ? 360 : 160
            )
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    /// Header shows the brand's own logo: a wordmark straight on the field when it reads well,
    /// otherwise on a white plate, or a logo tile next to the name. Resolved once, not per frame.
    private struct LoyaltyBrandHeader: View {
        let program: LoyaltyProgram
        var visual: LoyaltyVisual?
        var onDark: Bool
        var height: CGFloat
        @State private var layout: BrandHeaderLayout?

        private var ink: Color { onDark ? .white : Color.black.opacity(0.86) }

        var body: some View {
            Group {
                switch layout ?? BrandHeaderLayout.placeholder(program: program, visual: visual) {
                case .wordmark(let image):
                    Image(uiImage: image)
                        .resizable()
                        .interpolation(.high)
                        .scaledToFit()
                        .frame(maxHeight: height * 0.8)
                        .shadow(color: .black.opacity(onDark ? 0.16 : 0), radius: 1, y: 0.5)
                case .platedWordmark(let image):
                    Image(uiImage: image)
                        .resizable()
                        .interpolation(.high)
                        .scaledToFit()
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .frame(maxHeight: height)
                        .background(.white, in: Capsule())
                        .overlay { Capsule().strokeBorder(BrandInlay.bezel, lineWidth: 1.2) }
                        .shadow(color: .white.opacity(0.22), radius: 0, y: 0.8)
                case .tile(let image, let fullBleed):
                    named { BrandTile(image: image, fullBleed: fullBleed, size: height) }
                case .brandMark:
                    named { LoyaltyBrandMark(program: program, size: height, onBrandField: true) }
                case .monogram:
                    named {
                        Text(program.monogram)
                            .font(.system(size: height * 0.38, weight: .bold, design: .rounded))
                            .foregroundStyle(ink)
                            .frame(width: height, height: height)
                            .background(ink.opacity(0.16), in: RoundedRectangle(cornerRadius: height * 0.26, style: .continuous))
                    }
                }
            }
            .frame(height: height, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .transition(.opacity)
            .animation(.smooth(duration: 0.28), value: layout)
            .task(id: visual?.image.map { ObjectIdentifier($0) }) {
                layout = BrandHeaderLayout.resolve(program: program, visual: visual)
            }
        }

        private func named<Mark: View>(@ViewBuilder _ mark: () -> Mark) -> some View {
            HStack(spacing: 10) {
                mark()
                EngravedText(
                    text: Text(program.name).font(.system(size: 17, weight: .semibold, design: .rounded)),
                    onDark: onDark
                )
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            }
        }
    }

    private struct BrandTile: View {
        let image: UIImage
        var fullBleed: Bool
        var size: CGFloat

        var body: some View {
            let shape = RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
            Image(uiImage: image)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .padding(fullBleed ? 0 : size * 0.14)
                .frame(width: size, height: size)
                .background(.white, in: shape)
                .clipShape(shape)
                .overlay { shape.strokeBorder(BrandInlay.bezel, lineWidth: 1.2) }
                .shadow(color: .white.opacity(0.22), radius: 0, y: 0.8)
        }
    }

    /// Wallet pass face: brand header, chip, metal PAN — matches Apple Wallet card chrome.
    private var stackStrip: some View {
        ZStack(alignment: .topLeading) {
            passChrome
            VStack(alignment: .leading, spacing: 0) {
                LoyaltyBrandHeader(program: program, visual: visual ?? LoyaltyVisualCache.map[program.id], onDark: onDark, height: 34)
                Spacer(minLength: 10)
                if card.barcodePayload.isEmpty == false {
                    numberLabel
                    EmbossedMetalText(
                        text: LoyaltyCardPass.groupedCode(card.barcodePayload),
                        fontSize: 17,
                        gyroSheen: false
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 18)
            // Never wider than the card: content shrinks, the card doesn't grow.
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: Self.stackHeight, alignment: .top)
        .contentShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }

    private var detailBody: some View {
        ZStack(alignment: .topLeading) {
            passChrome
            VStack(alignment: .leading, spacing: 0) {
                LoyaltyBrandHeader(program: program, visual: visual ?? LoyaltyVisualCache.map[program.id], onDark: onDark, height: 34)
                Spacer(minLength: 10)
                if card.barcodePayload.isEmpty == false {
                    numberLabel
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
                        .transition(.scale(scale: 0.96, anchor: .top).combined(with: .opacity))
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
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
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

    /// Anodized brushed-metal plate: brand-tinted metal, hairline grain, light bands,
    /// machined double bevel. The static part is flattened once; only the gyro sheen moves.
    @ViewBuilder
    private var passChrome: some View {
        let shape = RoundedRectangle(cornerRadius: corner, style: .continuous)
        ZStack {
            ZStack {
                shape.fill(passGradient)
                Image(uiImage: BrushedMetal.image)
                    .resizable()
                    .blendMode(.overlay)
                    .opacity(0.32)
                // Anisotropic light bands of brushed metal.
                LinearGradient(
                    stops: [
                        .init(color: .white.opacity(0.0), location: 0.0),
                        .init(color: .white.opacity(0.16), location: 0.16),
                        .init(color: .white.opacity(0.0), location: 0.34),
                        .init(color: .white.opacity(0.07), location: 0.6),
                        .init(color: .white.opacity(0.0), location: 0.8)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                RadialGradient(
                    colors: [Color.white.opacity(0.22), Color.white.opacity(0.0)],
                    center: .topLeading,
                    startRadius: 0,
                    endRadius: 320
                )
                LinearGradient(
                    colors: [.clear, .black.opacity(0.22)],
                    startPoint: .center,
                    endPoint: .bottom
                )
            }
            .clipShape(shape)
            .drawingGroup()

            if foilActive && style == .detail {
                GyroFoilOverlay(cornerRadius: corner, intensity: 0.34, isActive: true)
                    .clipShape(shape)
            }

            // Machined edge: bright outer lip, then a dark chamfer catching the shade.
            shape.strokeBorder(
                LinearGradient(
                    colors: [Color.white.opacity(0.62), Color.white.opacity(0.14), Color.black.opacity(0.45)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                lineWidth: 1
            )
            RoundedRectangle(cornerRadius: corner - 1.4, style: .continuous)
                .inset(by: 1.4)
                .strokeBorder(
                    LinearGradient(
                        colors: [Color.black.opacity(0.32), Color.white.opacity(0.22)],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 0.7
                )
        }
        .allowsHitTesting(false)
        .shadow(
            color: .black.opacity(style == .stack ? 0 : 0.34),
            radius: style == .stack ? 0 : 22,
            y: style == .stack ? 0 : 14
        )
    }

    private var barcodeWell: some View {
        VStack(spacing: 8) {
            if let image = barcodeImage {
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

/// Brushed-metal hairlines: per-row brightness smeared along the brush direction. Generated once.
enum BrushedMetal {
    static let image: UIImage = {
        let width = 512, height = 160
        var pixels = [UInt8](repeating: 128, count: width * height)
        for y in 0..<height {
            let row = Double.random(in: -0.05...0.05)
            var noise = [Double](repeating: 0, count: width)
            for x in 0..<width { noise[x] = Double.random(in: -1...1) }
            // Box blur along x so strokes look brushed, not sandy.
            var acc = 0.0
            let window = 28
            for x in 0..<(width + window) {
                acc += noise[x % width]
                if x >= window { acc -= noise[(x - window) % width] }
                if x >= window {
                    let v = 0.5 + row + (acc / Double(window)) * 0.32
                    pixels[y * width + (x - window)] = UInt8(max(0, min(255, v * 255)))
                }
            }
        }
        guard let provider = CGDataProvider(data: Data(pixels) as CFData),
              let cg = CGImage(
                width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 8, bytesPerRow: width,
                space: CGColorSpaceCreateDeviceGray(),
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue),
                provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent
              )
        else { return UIImage() }
        return UIImage(cgImage: cg)
    }()
}

/// Laser engraving on anodized metal: the cut reveals bright bare metal, its upper wall in shadow.
struct EngravedText: View {
    let text: Text
    var onDark: Bool

    var body: some View {
        text
            .foregroundStyle(
                LinearGradient(
                    colors: onDark
                        ? [Color(white: 0.99), Color(white: 0.76)]
                        : [Color(white: 0.30), Color(white: 0.10)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .shadow(color: .black.opacity(onDark ? 0.55 : 0.22), radius: 0, x: 0, y: -0.7)
            .shadow(color: .white.opacity(onDark ? 0.26 : 0.5), radius: 0, x: 0, y: 0.8)
    }
}

/// Metallic embossed digits. Gyro sheen is a GPU streak — the plastic face never tilts.
struct EmbossedMetalText: View {
    let text: String
    var fontSize: CGFloat = 22
    var gyroSheen: Bool = false
    @State private var width: CGFloat = 0

    /// Long numbers shrink to the card's width instead of pushing the card wider than the screen.
    private var fitted: CGFloat {
        guard width > 0 else { return fontSize }
        let natural = (text as NSString).size(withAttributes: [.font: MetalPANView.roundedMono(fontSize)]).width
        guard natural > width else { return fontSize }
        return max(10, floor(fontSize * width / natural * 0.97))
    }

    private var digits: some View {
        Text(text)
            .font(.system(size: fitted, weight: .semibold, design: .rounded).monospacedDigit())
            .lineLimit(1)
            .minimumScaleFactor(0.4)
    }

    var body: some View {
        // Native SwiftUI metal: always fits its width and is safe under 3D flips.
        // On the open card (`gyroSheen`) the digits float above the plate with tilt parallax.
        let tilt = gyroSheen ? CardTilt.shared : nil
        let tx = CGFloat(tilt?.x ?? 0)
        let ty = CGFloat(tilt?.y ?? 0)
        ZStack(alignment: .leading) {
            if gyroSheen {
                // Cast shadow on the plate: shifts opposite to the digits, so they read as raised.
                digits
                    .foregroundStyle(Color.black.opacity(0.38))
                    .blur(radius: 1.8)
                    .offset(x: -tx * 3, y: 2.4 - ty * 2)
            }
            digits
                .foregroundStyle(
                    LinearGradient(
                        stops: [
                            .init(color: Color(red: 0.92, green: 0.91, blue: 0.87), location: 0),
                            .init(color: Color(red: 1.0, green: 0.99, blue: 0.96), location: 0.22),
                            .init(color: Color(red: 0.55, green: 0.54, blue: 0.51), location: 0.52),
                            .init(color: Color(red: 0.95, green: 0.93, blue: 0.88), location: 0.76),
                            .init(color: Color(red: 0.66, green: 0.64, blue: 0.59), location: 1)
                        ],
                        startPoint: UnitPoint(x: 0.5 + tx * 0.5, y: -ty * 0.4),
                        endPoint: UnitPoint(x: 0.5 - tx * 0.5, y: 1 - ty * 0.4)
                    )
                )
                .overlay {
                    if gyroSheen {
                        // Specular glint gliding across the metal as the phone tilts.
                        LinearGradient(
                            colors: [.clear, .white.opacity(0.8), .clear],
                            startPoint: UnitPoint(x: 0.2 + 0.6 * tx - 0.18, y: 0),
                            endPoint: UnitPoint(x: 0.2 + 0.6 * tx + 0.18, y: 1)
                        )
                        .mask { digits }
                        .blendMode(.plusLighter)
                    }
                }
                .shadow(color: .black.opacity(0.45), radius: 0, x: 0, y: 1)
                .shadow(color: .white.opacity(0.35), radius: 0, x: 0, y: -0.5)
                .offset(x: tx * 5, y: ty * 3.5)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: fontSize * 1.35)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .onAppear { if gyroSheen { CardTilt.shared.start() } }
        .onDisappear { if gyroSheen { CardTilt.shared.stop() } }
        .accessibilityHidden(true)
    }
}

/// Smoothed device tilt for parallax on the open card. Runs only while someone listens;
/// the rest position slowly follows how the phone is held, so the effect never sticks.
@MainActor
@Observable
final class CardTilt {
    static let shared = CardTilt()

    private(set) var x: Double = 0
    private(set) var y: Double = 0
    @ObservationIgnored private let manager = CMMotionManager()
    @ObservationIgnored private var listeners = 0
    @ObservationIgnored private var rest: (roll: Double, pitch: Double)?

    func start() {
        listeners += 1
        guard listeners == 1, manager.isDeviceMotionAvailable,
              UIAccessibility.isReduceMotionEnabled == false else { return }
        rest = nil
        manager.deviceMotionUpdateInterval = 1 / 60
        manager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let self, let motion else { return }
            let roll = motion.attitude.roll
            let pitch = motion.attitude.pitch
            var base = self.rest ?? (roll, pitch)
            base.roll += (roll - base.roll) * 0.012
            base.pitch += (pitch - base.pitch) * 0.012
            self.rest = base
            let tx = max(-1, min(1, (roll - base.roll) / 0.32))
            let ty = max(-1, min(1, (pitch - base.pitch) / 0.32))
            self.x += (tx - self.x) * 0.2
            self.y += (ty - self.y) * 0.2
        }
    }

    func stop() {
        listeners = max(0, listeners - 1)
        guard listeners == 0 else { return }
        manager.stopDeviceMotionUpdates()
        x = 0
        y = 0
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
    @State private var dragStartOrder: [UUID] = []
    @State private var pullOutArmed = false

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
        let slot = LoyaltyPassStackMetrics.yOffset(index: index, spread: liveSpread)
        guard draggingID == nil, let openID = openingID,
              let openIndex = orderedCards.firstIndex(where: { $0.id == openID })
        else { return slot }
        _ = openIndex
        // The chosen card rides up to the top of the pile; every other card — in front of it
        // and behind it — slides down out of its way. Coming back, it drops from the top
        // into its old slot while the cards behind rise under it and those in front close over it.
        if cardID == openID { return -PassStackMotion.slideOutLift }
        return slot + pocketDrop
    }

    /// How far the other cards drop so the card at the top is completely free.
    private var pocketDrop: CGFloat {
        LoyaltyPassStackMetrics.cardHeight - PassStackMotion.slideOutLift + PassStackMotion.pocketGap
    }

    /// The opening card keeps its place in the pile: it slides out from behind the
    /// cards in front of it and back in behind them, never jumping on top.
    private func zIndex(for card: LoyaltyCard, index: Int) -> Double {
        if card.id == draggingID { return 9_000 }
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

    @Environment(CardFlight.self) private var flight: CardFlight?

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
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { rect in
            flight?.updateStackFrame(card.id, rect)
        }
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
        .background {
            // Cards under it hide most of a card's shadow, and the top-edge gradient already
            // draws the shade cast on the card above. Blur only where it shows.
            if lifted || index == count - 1 || liveSpread > 0.05 || openingID == card.id {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.black)
                    .shadow(
                        color: .black.opacity(lifted ? 0.46 : 0.36 + min(0.14, depth * 0.02)),
                        radius: lifted ? 22 : 14,
                        y: lifted ? 12 : 8
                    )
            }
        }
        .scaleEffect(lifted ? (pullOutArmed ? 1.07 : 1.03) : 1, anchor: .top)
        .matchedTransitionSource(id: card.id, in: zoomNamespace)
        .opacity(flight?.hiddenID == card.id ? 0 : 1)
        .frame(height: LoyaltyPassStackMetrics.cardHeight, alignment: .top)
        .allowsHitTesting(false)
        .overlay(alignment: .top) {
            WalletCardHitStrip(
                isReordering: isDragging,
                onTap: {
                    guard draggingID == nil else { return }
                    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                    if UIAccessibility.isReduceMotionEnabled {
                        openingID = card.id
                        onOpen(card)
                        return
                    }
                    // Pull the card up out of its pocket, then open it.
                    withAnimation(PassStackMotion.slideOut) { openingID = card.id }
                    DispatchQueue.main.asyncAfter(deadline: .now() + PassStackMotion.slideOutPause) { onOpen(card) }
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
        dragStartOrder = displayOrder
        pullOutArmed = false
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    /// Lifted this far above the top of the pile, the card comes out on release.
    private static let pullOutDistance: CGFloat = 70

    private func updatePullOut(translation: CGFloat) {
        let top = LoyaltyPassStackMetrics.yOffset(index: dragHomeIndex, spread: liveSpread) + translation
        let armed = top < -Self.pullOutDistance
        guard armed != pullOutArmed else { return }
        withAnimation(PassStackMotion.slideOut) { pullOutArmed = armed }
        UIImpactFeedbackGenerator(style: armed ? .rigid : .soft).impactOccurred()
    }

    /// Released above the pile: it flies out from under the finger; the pile keeps its order.
    private func pullOut(_ id: UUID) {
        guard let card = cards.first(where: { $0.id == id }) else { return }
        openingID = id
        onOpen(card)
        var instant = Transaction()
        instant.disablesAnimations = true
        withTransaction(instant) {
            displayOrder = dragStartOrder
            draggingID = nil
            dragTranslation = 0
            swapAnchor = 0
            pullOutArmed = false
        }
        didReorder = false
    }

    private func endReorder() {
        if pullOutArmed, let id = draggingID {
            pullOut(id)
            return
        }
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
        updatePullOut(translation: translation)
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
    /// How far a tapped card rises out of the stack before it opens.
    static let slideOutLift: CGFloat = 22
    /// Clear space left between the risen card and the cards that dropped away.
    static let pocketGap: CGFloat = 18

    /// The card slides up out of the pile: quick, with a short settle.
    static var slideOut: Animation { .spring(response: 0.46, dampingFraction: 0.78) }
    static let slideOutPause: Double = 0.36

    /// Back into its pocket: slides down behind the front cards, which close over it.
    static var slideIn: Animation { .spring(response: 0.56, dampingFraction: 0.76) }

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

/// Recessed bezel around a logo plate: shade on the upper wall, light on the lower lip.
enum BrandInlay {
    static let bezel = LinearGradient(
        colors: [Color.black.opacity(0.38), Color.black.opacity(0.08), Color.white.opacity(0.35)],
        startPoint: .top,
        endPoint: .bottom
    )
}

/// Logos already resolved this session, so a fresh copy of a card (e.g. the flying one)
/// shows its real logo on the first frame.
@MainActor
enum LoyaltyVisualCache {
    static var map: [String: LoyaltyVisual] = [:]
}

/// How a card header shows its brand. Picked once per logo (pixel checks are cached), never per frame.
enum BrandHeaderLayout: Equatable {
    case wordmark(UIImage)
    case platedWordmark(UIImage)
    case tile(UIImage, fullBleed: Bool)
    case brandMark
    case monogram

    @MainActor private static var cache: [String: BrandHeaderLayout] = [:]

    @MainActor
    static func placeholder(program: LoyaltyProgram, visual: LoyaltyVisual?) -> BrandHeaderLayout {
        if let hit = cache[key(program, visual)] { return hit }
        return LoyaltyBrandArt.hasMark(program.id) ? .brandMark : .monogram
    }

    @MainActor
    static func resolve(program: LoyaltyProgram, visual: LoyaltyVisual?) -> BrandHeaderLayout {
        let key = key(program, visual)
        if let hit = cache[key] { return hit }
        let result: BrandHeaderLayout
        if let image = visual?.image, PassArtwork.opaqueRatio(image) > 0.03 {
            let aspect = image.size.width / max(image.size.height, 1)
            if aspect >= 1.7 {
                let contrast = PassArtwork.contrastRatio(in: image, againstHex: program.cardColorHex)
                result = contrast >= 2.6 ? .wordmark(image) : .platedWordmark(image)
            } else {
                result = .tile(image, fullBleed: LogoQuality.looksLikeTile(image))
            }
        } else if visual?.usesBrandMark == true || LoyaltyBrandArt.hasMark(program.id) {
            result = .brandMark
        } else {
            result = .monogram
        }
        cache[key] = result
        return result
    }

    private static func key(_ program: LoyaltyProgram, _ visual: LoyaltyVisual?) -> String {
        let size = visual?.image.map { "\(Int($0.size.width))x\(Int($0.size.height))" } ?? "none"
        return "\(program.id)-\(program.cardColorHex)-\(size)"
    }
}


/// Choreographs a card rising out of the stack, flipping to its back and landing in the
/// detail view — and the way back: flip to the front, fly down, drop into its slot.
@MainActor
@Observable
final class CardFlight {
    enum Phase { case idle, opening, open, dragging, closing }

    private(set) var card: LoyaltyCard?
    private(set) var phase: Phase = .idle
    private(set) var source: CGRect = .zero
    private(set) var target: CGRect = .zero
    var progress: Double = 0
    /// Finger offset while the open card is pulled down to put it back.
    var dragOffset: CGFloat = 0
    @ObservationIgnored private var stackFrames: [UUID: CGRect] = [:]
    @ObservationIgnored private var landed: (() -> Void)?
    @ObservationIgnored private var started = false

    /// Detail opened by a flight: it shows a custom back that flies the card home.
    var presentedID: UUID? { phase == .idle ? nil : card?.id }
    /// The real card stays invisible in the stack and the detail while its double flies.
    var hiddenID: UUID? { card?.id }
    var isFlying: Bool { phase == .opening || phase == .dragging || phase == .closing }

    /// Twice as slow as a standard push, with a springy landing (slight overshoot, settle).
    static var opening: Animation { .spring(response: 0.78, dampingFraction: 0.8) }
    static var closing: Animation { .spring(response: 0.66, dampingFraction: 0.82) }

    func updateStackFrame(_ id: UUID, _ rect: CGRect) {
        stackFrames[id] = rect
        if phase == .closing, id == card?.id { source = rect }
    }

    func open(_ card: LoyaltyCard, push: () -> Void, landed: @escaping () -> Void) {
        guard UIAccessibility.isReduceMotionEnabled == false, let frame = stackFrames[card.id] else {
            push()
            landed()
            return
        }
        self.card = card
        self.landed = landed
        source = frame
        target = .zero
        progress = 0
        started = false
        phase = .opening
        var instant = Transaction()
        instant.disablesAnimations = true
        withTransaction(instant) { push() }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(1.2))
            if self.phase == .opening, self.started == false { self.phase = .open }
        }
    }

    /// The detail reports where its card sits; the flight lands exactly there.
    func reportTarget(_ rect: CGRect) {
        guard rect.width > 0, phase == .opening || phase == .open else { return }
        target = rect
        guard phase == .opening, started == false else { return }
        started = true
        // Next turn, so the flying double exists at the stack position before it moves.
        DispatchQueue.main.async {
            withAnimation(Self.opening) { self.progress = 1 } completion: {
                if self.phase == .opening { self.phase = .open }
            }
        }
    }

    func close(pop: () -> Void) {
        guard let card, phase == .open, target.width > 0, let frame = stackFrames[card.id] else {
            pop()
            finish()
            return
        }
        source = frame
        progress = 1
        phase = .closing
        var instant = Transaction()
        instant.disablesAnimations = true
        withTransaction(instant) { pop() }
        DispatchQueue.main.async {
            withAnimation(Self.closing) { self.progress = 0 } completion: { self.finish() }
        }
    }

    /// The open card follows the finger above everything (bars included).
    func dragChanged(_ offset: CGFloat) {
        guard phase == .open || phase == .dragging, target.width > 0 else { return }
        phase = .dragging
        progress = 1
        dragOffset = offset
    }

    /// Far enough: it flies home from where it was let go. Not enough: springs back.
    func dragEnded(commit: Bool, pop: () -> Void) {
        guard phase == .dragging else { return }
        if commit {
            target = target.offsetBy(dx: 0, dy: dragOffset)
            dragOffset = 0
            phase = .open
            close(pop: pop)
        } else {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.62)) { dragOffset = 0 } completion: {
                if self.phase == .dragging { self.phase = .open }
            }
        }
    }

    func finish() {
        let done = landed
        card = nil
        phase = .idle
        progress = 0
        target = .zero
        landed = nil
        dragOffset = 0
        done?()
    }
}

/// Sits above the whole app (bars included) while a card flies.
struct CardFlightOverlay: View {
    @Environment(CardFlight.self) private var flight: CardFlight?

    var body: some View {
        if let flight, flight.isFlying, let card = flight.card, flight.target.width > 0, flight.source.width > 0 {
            FlyingCard(card: card, source: flight.source, target: flight.target, progress: flight.progress, drag: flight.dragOffset)
                .allowsHitTesting(false)
        }
    }
}

private struct FlyingCard: View, Animatable {
    let card: LoyaltyCard
    let source: CGRect
    let target: CGRect
    var progress: Double
    var drag: CGFloat

    var animatableData: AnimatablePair<Double, CGFloat> {
        get { AnimatablePair(progress, drag) }
        set { progress = newValue.first; drag = newValue.second }
    }

    var body: some View {
        let p = CGFloat(progress)
        let arc = CGFloat(sin(Double.pi * min(1, max(0, progress))))
        // The flip happens mid-flight, eased, so the card turns while it travels.
        let t = min(1, max(0, (progress - 0.12) / 0.7))
        let angle = 180 * t * t * (3 - 2 * t)
        let showsBack = angle > 90
        ZStack(alignment: .top) {
            LoyaltyCardPass(card: card, style: .stack)
                .opacity(showsBack ? 0 : 1)
            LoyaltyCardPass(card: card, showsBarcode: true)
                .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
                .opacity(showsBack ? 1 : 0)
        }
        .frame(
            width: source.width + (target.width - source.width) * p,
            height: source.height + (target.height - source.height) * p,
            alignment: .top
        )
        .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0), perspective: 0.42)
        .scaleEffect(1 + 0.06 * arc - min(max(drag, 0), 240) / 240 * 0.06)
        .shadow(color: .black.opacity(0.16 + 0.24 * arc), radius: 10 + 22 * arc, y: 8 + 16 * arc)
        .position(
            x: source.midX + (target.midX - source.midX) * p,
            y: source.midY + (target.midY - source.midY) * p - 48 * arc + drag
        )
    }
}

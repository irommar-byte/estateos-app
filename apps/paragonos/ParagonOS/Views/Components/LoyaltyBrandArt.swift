import SwiftUI
import UIKit

/// Canonical brand face for in-app cards and Wallet strips.
/// Bundled original art always wins. No remote favicons. No generic system wordmarks when a mark exists.
enum LoyaltyBrandKit {
    enum Face: Equatable {
        /// PNG/vector *is* the name (Auchan, Payback). Don't print a second title.
        case wordmark
        /// Icon + original name (Biedronka ladybug + wordmark).
        case markAndName
        /// Complete lockup already contains text (IKEA oval, Lidl).
        case lockup
    }

    enum Placement: Equatable {
        case leading
        case centered
    }

    struct Spec: Equatable {
        var face: Face
        var hex: String?
        /// Original strip word when `face == .markAndName`.
        var stripWord: String?
        /// White silhouette on the brand field (red/blue cards).
        var whiteOnBrand: Bool
        /// Remote favicons are never used for catalog brands with a kit face.
        var allowsRemote: Bool
    }

    /// Symbols that are not the name — ladybug, siren, shell. The original word is drawn beside them.
    private static let symbolNeedsName: Set<String> = [
        "biedronka", "starbucks", "shell", "bp", "circlek", "silpo", "stokrotka"
    ]

    static func spec(for id: String) -> Spec {
        let catalog = LoyaltyCatalog.program(id: id)
        let hex = LoyaltyBrandArt.hex(for: id) ?? catalog?.color
        let bundled = bundledLogo(for: id)
        let face = inferredFace(id: id, bundled: bundled)
        return Spec(
            face: face,
            hex: hex,
            stripWord: originalWord(for: id),
            whiteOnBrand: false,
            allowsRemote: catalog == nil
        )
    }

    static func inferredFace(id: String, bundled: UIImage?) -> Face {
        switch id {
        case "biedronka":
            return .markAndName
        case "ikea", "lidlplus", "kaufland", "orlen":
            return .lockup
        case "mcdonalds", "auchan", "payback", "kfc", "rossmann", "wog", "atb", "selgros", "okko",
             "xkom", "action", "dyson", "house":
            return .wordmark
        default:
            break
        }
        if symbolNeedsName.contains(id) {
            return .markAndName
        }
        if let bundled {
            let trimmed = LogoCropper.trim(bundled)
            let aspect = trimmed.size.width / max(trimmed.size.height, 1)
            if LogoQuality.looksLikeTile(trimmed) == false, aspect >= 1.45 {
                return .wordmark
            }
            if LogoQuality.looksLikeTile(trimmed) == false {
                return .lockup
            }
        }
        return hasMark(id) && symbolNeedsName.contains(id) ? .markAndName : .wordmark
    }

    static func originalWord(for id: String) -> String? {
        switch id {
        case "biedronka":
            return "biedronka"
        case "hebe":
            return "hebe"
        case "orlen":
            return "ORLEN"
        case "rossmann", "rossmannclub":
            return "ROSSMANN"
        default:
            return LoyaltyCatalog.program(id: id)?.name
        }
    }

    static func hasMark(_ id: String) -> Bool {
        LoyaltyBrandArt.hasMark(id)
    }

    static func bundledLogo(for id: String) -> UIImage? {
        let url = Bundle.main.url(forResource: id, withExtension: "png", subdirectory: "BrandLogos")
            ?? Bundle.main.url(forResource: id, withExtension: "png")
        guard let url, let image = UIImage(contentsOfFile: url.path) else { return nil }
        return image
    }

    private static var faceCache: [String: UIImage] = [:]

    /// Single face used by in-app cards and Apple Wallet `strip.png`.
    @MainActor
    static func composeForeground(
        program: LoyaltyProgram,
        logo: UIImage?,
        size: CGSize,
        placement: Placement,
        onBrandField: Bool = true,
        scale: CGFloat = 3
    ) -> UIImage {
        let key = "\(program.id)-\(Int(size.width))x\(Int(size.height))-\(placement == .leading ? "L" : "C")-\(onBrandField ? "1" : "0")-s\(Int(scale))-v10"
        if let cached = faceCache[key] { return cached }
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = max(1, scale)
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let image = renderer.image { _ in
            let spec = spec(for: program.id)
            let height = max(8, size.height * (spec.face == .markAndName ? 0.78 : 0.86))
            guard var content = contentImage(
                program: program,
                logo: logo,
                spec: spec,
                height: height,
                onBrandField: false
            ) else { return }
            if onBrandField {
                let ring = PassArtwork.strokeInk(for: content, fieldHex: program.cardColorHex)
                let stroke = max(1.6, min(content.size.height * 0.09, size.height * 0.07))
                content = PassArtwork.halo(content, color: ring, width: stroke)
            }
            let insetX: CGFloat = placement == .centered ? 0.08 : 0.02
            let insetY: CGFloat = placement == .centered ? 0.16 : 0.08
            let box = CGSize(
                width: max(8, size.width * (1 - insetX * 2)),
                height: max(8, size.height * (1 - insetY * 2))
            )
            let fit = min(box.width / max(content.size.width, 1), box.height / max(content.size.height, 1))
            let drawn = CGSize(width: content.size.width * fit, height: content.size.height * fit)
            let x: CGFloat
            switch placement {
            case .leading:
                x = size.width * insetX
            case .centered:
                x = (size.width - drawn.width) / 2
            }
            let y = (size.height - drawn.height) / 2
            content.draw(in: CGRect(origin: CGPoint(x: x, y: y), size: drawn))
        }
        faceCache[key] = image
        return image
    }

    @MainActor
    private static func contentImage(
        program: LoyaltyProgram,
        logo: UIImage?,
        spec: Spec,
        height: CGFloat,
        onBrandField: Bool
    ) -> UIImage? {
        switch spec.face {
        case .wordmark:
            if let mark = preparedMark(
                program: program,
                logo: logo,
                spec: spec,
                height: height,
                onBrandField: false,
                forceWhite: false
            ), acceptsForeground(mark, spec: spec, hex: program.cardColorHex) {
                return mark
            }
            return originalWordImage(
                word: spec.stripWord ?? program.name,
                id: program.id,
                height: height,
                color: wordColor(program: program, spec: spec, onBrandField: false)
            )
        case .lockup:
            if let mark = preparedMark(
                program: program,
                logo: logo,
                spec: spec,
                height: height,
                onBrandField: false,
                forceWhite: false
            ), acceptsForeground(mark, spec: spec, hex: program.cardColorHex) {
                return mark
            }
            return originalWordImage(
                word: spec.stripWord ?? program.name,
                id: program.id,
                height: height,
                color: wordColor(program: program, spec: spec, onBrandField: false)
            )
        case .markAndName:
            return markAndNameImage(
                program: program,
                logo: logo,
                spec: spec,
                height: height,
                onBrandField: onBrandField
            )
        }
    }

    @MainActor
    private static func markAndNameImage(
        program: LoyaltyProgram,
        logo: UIImage?,
        spec: Spec,
        height: CGFloat,
        onBrandField: Bool
    ) -> UIImage? {
        let mark = preparedMark(
            program: program,
            logo: logo,
            spec: spec,
            height: height,
            onBrandField: false,
            forceWhite: false
        )
        let word = spec.stripWord ?? program.name
        let wordImage = originalWordImage(
            word: word,
            id: program.id,
            height: height * 0.78,
            color: wordColor(program: program, spec: spec, onBrandField: false)
        )
        let markSize = mark.map { fittedSize($0, height: height) } ?? .zero
        let wordSize = wordImage.size
        let gap: CGFloat = height * 0.16
        let canvas = CGSize(
            width: max(1, markSize.width + (mark == nil ? 0 : gap) + wordSize.width),
            height: max(height, wordSize.height)
        )
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 3
        let renderer = UIGraphicsImageRenderer(size: canvas, format: format)
        return renderer.image { _ in
            var x: CGFloat = 0
            if let mark {
                let origin = CGPoint(x: x, y: (canvas.height - markSize.height) / 2)
                mark.draw(in: CGRect(origin: origin, size: markSize))
                x += markSize.width + gap
            }
            let origin = CGPoint(x: x, y: (canvas.height - wordSize.height) / 2)
            wordImage.draw(in: CGRect(origin: origin, size: wordSize))
        }
    }

    @MainActor
    private static func preparedMark(
        program: LoyaltyProgram,
        logo: UIImage?,
        spec: Spec,
        height: CGFloat,
        onBrandField _: Bool,
        forceWhite _: Bool
    ) -> UIImage? {
        let bundled = bundledLogo(for: program.id)
        let candidates: [UIImage]
        if spec.allowsRemote {
            candidates = [logo, bundled].compactMap { $0 }
        } else {
            candidates = [bundled].compactMap { $0 }
        }
        for raw in candidates {
            let trimmed = LogoCropper.trim(raw)
            guard isUsable(trimmed, for: spec.face) else { continue }
            if PassArtwork.opaqueRatio(trimmed) > 0.03 {
                return trimmed
            }
        }
        guard LoyaltyBrandArt.hasMark(program.id) else { return nil }
        guard let raster = LoyaltyBrandArt.raster(program: program, dimension: max(220, height * 5), onBrandField: false) else {
            return nil
        }
        let trimmed = LogoCropper.trim(raster)
        return PassArtwork.opaqueRatio(trimmed) > 0.03 ? trimmed : raster
    }

    static func acceptsForeground(_ image: UIImage, spec: Spec, hex: String) -> Bool {
        let fill = PassArtwork.opaqueRatio(image)
        guard fill > 0.06 else { return false }
        return isUsable(image, for: spec.face)
    }

    static func isUsable(_ image: UIImage, for face: Face) -> Bool {
        let trimmed = LogoCropper.trim(image)
        guard PassArtwork.opaqueRatio(trimmed) > 0.03 else { return false }
        if LogoQuality.looksLikeTile(trimmed) {
            return face != .wordmark
        }
        if face == .wordmark {
            let aspect = trimmed.size.width / max(trimmed.size.height, 1)
            if aspect < 1.28, LogoQuality.looksLikeTile(trimmed) { return false }
        }
        return true
    }

    static func wordColor(program: LoyaltyProgram, spec: Spec, onBrandField: Bool) -> UIColor {
        if ["wog", "selgros"].contains(program.id) {
            return .white
        }
        return UIColor(Color(hex: spec.hex ?? LoyaltyBrandArt.hex(for: program.id) ?? program.color))
    }

    static func originalWordImage(word: String, id: String, height: CGFloat, color: UIColor) -> UIImage {
        let font = wordFont(for: id, height: height)
        let kern = wordKern(for: id, height: height)
        let text = NSAttributedString(
            string: word,
            attributes: [
                .font: font,
                .foregroundColor: color,
                .kern: kern
            ]
        )
        let size = text.size()
        let canvas = CGSize(width: max(1, ceil(size.width) + 2), height: max(1, ceil(size.height) + 2))
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 3
        let renderer = UIGraphicsImageRenderer(size: canvas, format: format)
        return renderer.image { _ in
            text.draw(at: CGPoint(x: 1, y: 1))
        }
    }

    static func wordFont(for id: String, height: CGFloat) -> UIFont {
        switch id {
        case "auchan":
            return UIFont(name: "Futura-Bold", size: height * 0.92)
                ?? UIFont.systemFont(ofSize: height * 0.88, weight: .heavy)
        case "payback":
            return UIFont(name: "AvenirNext-Bold", size: height * 0.84)
                ?? UIFont.systemFont(ofSize: height * 0.82, weight: .bold)
        case "biedronka", "zabka", "hebe":
            let base = UIFont.systemFont(ofSize: height * 0.78, weight: .bold)
            if let rounded = base.fontDescriptor.withDesign(.rounded) {
                return UIFont(descriptor: rounded, size: height * 0.78)
            }
            return base
        case "rossmann", "rossmannclub":
            return UIFont(name: "TimesNewRomanPS-BoldMT", size: height * 0.72)
                ?? UIFont.systemFont(ofSize: height * 0.70, weight: .semibold)
        case "orlen":
            return UIFont.systemFont(ofSize: height * 0.78, weight: .heavy)
        case "decathlon":
            return UIFont.systemFont(ofSize: height * 0.70, weight: .bold)
        default:
            return UIFont.systemFont(ofSize: height * 0.72, weight: .bold)
        }
    }

    static func wordKern(for id: String, height: CGFloat) -> CGFloat {
        switch id {
        case "auchan": return height * -0.048
        case "payback": return height * -0.036
        case "biedronka", "zabka", "hebe": return height * -0.018
        case "orlen": return height * 0.08
        case "decathlon": return height * 0.06
        default: return height * -0.01
        }
    }

    private static func fittedSize(_ image: UIImage, height: CGFloat) -> CGSize {
        let scale = height / max(image.size.height, 1)
        return CGSize(width: image.size.width * scale, height: height)
    }
}

enum LoyaltyBrandArt {
    static func hex(for id: String) -> String? {
        switch id {
        case "biedronka": return "#E30613"
        case "orlen": return "#E45A28"
        case "lotos": return "#0A2F6B"
        case "lidlplus": return "#0050AA"
        case "kaufland": return "#8B0A2E"
        case "zabka": return "#78BE20"
        case "rossmann", "rossmannclub": return "#C8102E"
        case "sephora": return "#000000"
        case "shell": return "#FBCE07"
        case "bp": return "#00965E"
        case "carrefour": return "#004E9F"
        case "circlek": return "#E1251B"
        case "ikea": return "#0058A3"
        case "decathlon": return "#0082C3"
        case "mcdonalds": return "#DA291C"
        case "starbucks": return "#00704A"
        case "hebe": return "#E1007A"
        case "allegro": return "#FF5A00"
        case "inpost": return "#FFD100"
        case "empik": return "#E30613"
        case "action": return "#FF6A00"
        case "xkom": return "#111111"
        case "dyson": return "#4B0D6B"
        case "house": return "#111111"
        case "dino": return "#009639"
        case "netto": return "#F6C700"
        case "aldi": return "#00005F"
        case "auchan": return "#E4002B"
        case "payback": return "#0033A0"
        case "costa": return "#6B1F32"
        case "kfc": return "#E4002B"
        case "stokrotka": return "#2E9E48"
        case "selgros": return "#F39200"
        case "okko": return "#111111"
        case "wog": return "#00A651"
        case "ukrnafta": return "#0033A0"
        case "socar": return "#E30613"
        case "silpo": return "#F15A22"
        case "atb": return "#1A1A1A"
        case "novus": return "#6BBF44"
        case "varus": return "#F15A22"
        case "fora": return "#FFCC00"
        case "metro": return "#003865"
        case "epicentr": return "#F15A24"
        case "rozetka": return "#00A046"
        case "comfy": return "#FF6A00"
        case "foxtrot": return "#F37021"
        case "eva": return "#E91E8C"
        case "novaposhta": return "#ED1C24"
        default: return nil
        }
    }

    static func accent(for id: String) -> Color? {
        hex(for: id).map { Color(hex: $0) }
    }

    static func hasMark(_ id: String) -> Bool {
        switch id {
        case "biedronka", "orlen", "lotos", "lidlplus", "kaufland", "zabka",
             "rossmann", "rossmannclub", "sephora", "shell", "bp", "carrefour",
             "circlek", "ikea", "mcdonalds", "starbucks", "hebe", "allegro",
             "inpost", "empik", "dino", "netto", "aldi", "auchan", "costa", "kfc", "stokrotka",
             "selgros", "okko", "wog", "silpo", "atb", "payback",
             "xkom", "action", "dyson", "house":
            return true
        default:
            return false
        }
    }

    @MainActor
    static func raster(program: LoyaltyProgram, dimension: CGFloat, onBrandField: Bool = false) -> UIImage? {
        let view = LoyaltyBrandMark(program: program, size: dimension, onBrandField: onBrandField)
            .frame(width: dimension, height: dimension)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 3
        renderer.isOpaque = false
        return renderer.uiImage
    }
}

struct LoyaltyBrandMark: View {
    let program: LoyaltyProgram
    var size: CGFloat
    var onBrandField: Bool = false

    private var wordInk: Color {
        if let hex = LoyaltyBrandKit.spec(for: program.id).hex ?? LoyaltyBrandArt.hex(for: program.id) {
            return Color(hex: hex)
        }
        return program.brandColor
    }

    var body: some View {
        Group {
            switch program.id {
            case "biedronka": biedronka
            case "orlen": orlen
            case "lotos": lotos
            case "lidlplus": lidl
            case "kaufland": letter("K", ink: Color(hex: "#8B0A2E"))
            case "zabka": zabka
            case "rossmann", "rossmannclub": letter("R", ink: Color(hex: "#C8102E"))
            case "sephora": letter("S", ink: .black)
            case "shell": shell
            case "bp": bp
            case "carrefour": carrefour
            case "circlek": letter("K", ink: Color(hex: "#E1251B"))
            case "ikea": ikea
            case "mcdonalds": letter("M", ink: Color(hex: "#DA291C"))
            case "starbucks": letter("★", ink: Color(hex: "#00704A"))
            case "hebe": letter("H", ink: Color(hex: "#E1007A"))
            case "allegro": letter("a", ink: Color(hex: "#FF5A00"))
            case "inpost": letter("in", ink: Color(hex: "#111111"))
            case "empik": letter("e", ink: Color(hex: "#E30613"))
            case "dino": letter("D", ink: Color(hex: "#009639"))
            case "netto": letter("N", ink: Color(hex: "#C7A000"))
            case "aldi": letter("A", ink: Color(hex: "#00005F"))
            case "auchan": auchan
            case "payback": payback
            case "costa": letter("C", ink: Color(hex: "#6B1F32"))
            case "kfc": letter("KFC", ink: Color(hex: "#E4002B"))
            case "stokrotka": stokrotka
            case "selgros": letter("S", ink: .white)
            case "okko": okko
            case "wog": letter("WOG", ink: .white)
            case "silpo": silpo
            case "atb": letter("ATB", ink: Color(hex: "#FFCC00"))
            case "xkom":
                Text("x-kom")
                    .font(.system(size: size * 0.28, weight: .heavy, design: .rounded))
                    .tracking(-0.8)
                    .foregroundStyle(Color(hex: "#111111"))
                    .minimumScaleFactor(0.4)
                    .lineLimit(1)
            case "action":
                Text("Action")
                    .font(.custom("Futura-Bold", size: size * 0.32))
                    .tracking(-0.8)
                    .foregroundStyle(Color(hex: "#FF6A00"))
                    .minimumScaleFactor(0.4)
                    .lineLimit(1)
            case "dyson":
                Text("dyson")
                    .font(.system(size: size * 0.30, weight: .semibold, design: .serif))
                    .tracking(-1.0)
                    .foregroundStyle(Color(hex: "#4B0D6B"))
                    .minimumScaleFactor(0.4)
                    .lineLimit(1)
            case "house":
                Text("HOUSE")
                    .font(.custom("AvenirNext-Bold", size: size * 0.26))
                    .tracking(1.4)
                    .foregroundStyle(Color(hex: "#111111"))
                    .minimumScaleFactor(0.4)
                    .lineLimit(1)
            default:
                Text(program.monogram)
                    .font(.system(size: size * 0.36, weight: .bold, design: .rounded))
                    .foregroundStyle(program.onColor)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private var auchan: some View {
        Text("Auchan")
            .font(.custom("Futura-Bold", size: size * 0.42))
            .tracking(-1.1)
            .foregroundStyle(wordInk)
            .minimumScaleFactor(0.5)
            .lineLimit(1)
    }

    private var payback: some View {
        Text("Payback")
            .font(.custom("AvenirNext-Bold", size: size * 0.38))
            .tracking(-0.8)
            .foregroundStyle(wordInk)
            .minimumScaleFactor(0.5)
            .lineLimit(1)
    }

    private func letter(_ value: String, ink: Color) -> some View {
        Text(value)
            .font(.system(size: size * (value.count > 2 ? 0.26 : 0.46), weight: .heavy, design: .rounded))
            .foregroundStyle(ink)
            .minimumScaleFactor(0.55)
            .lineLimit(1)
    }

    private var biedronka: some View {
        Canvas { context, canvas in
            let s = min(canvas.width, canvas.height) * 0.84
            let cx = canvas.width / 2
            let cy = canvas.height / 2 + s * 0.02
            let red = Color(hex: "#E30613")
            let ink = Color.black
            let face = Color.white

            context.fill(
                Path(ellipseIn: CGRect(x: cx - s * 0.48, y: cy - s * 0.48, width: s * 0.96, height: s * 0.96)),
                with: .color(.white)
            )

            func ellipse(_ rect: CGRect, fill: Color, stroke: Color? = ink, line: CGFloat = 0.045) {
                let path = Path(ellipseIn: rect)
                context.fill(path, with: .color(fill))
                if let stroke {
                    context.stroke(path, with: .color(stroke), lineWidth: s * line)
                }
            }

            var leftAntenna = Path()
            leftAntenna.move(to: CGPoint(x: cx - s * 0.06, y: cy - s * 0.34))
            leftAntenna.addQuadCurve(to: CGPoint(x: cx - s * 0.22, y: cy - s * 0.48), control: CGPoint(x: cx - s * 0.20, y: cy - s * 0.36))
            var rightAntenna = Path()
            rightAntenna.move(to: CGPoint(x: cx + s * 0.08, y: cy - s * 0.34))
            rightAntenna.addQuadCurve(to: CGPoint(x: cx + s * 0.24, y: cy - s * 0.48), control: CGPoint(x: cx + s * 0.22, y: cy - s * 0.36))
            context.stroke(leftAntenna, with: .color(ink), lineWidth: s * 0.028)
            context.stroke(rightAntenna, with: .color(ink), lineWidth: s * 0.028)
            ellipse(CGRect(x: cx - s * 0.255, y: cy - s * 0.51, width: s * 0.07, height: s * 0.07), fill: ink, stroke: nil)
            ellipse(CGRect(x: cx + s * 0.205, y: cy - s * 0.51, width: s * 0.07, height: s * 0.07), fill: ink, stroke: nil)

            let body = CGRect(x: cx - s * 0.34, y: cy - s * 0.16, width: s * 0.68, height: s * 0.58)
            ellipse(body, fill: red, line: 0.05)

            var suture = Path()
            suture.move(to: CGPoint(x: cx, y: cy - s * 0.10))
            suture.addLine(to: CGPoint(x: cx, y: cy + s * 0.40))
            context.stroke(suture, with: .color(ink), lineWidth: s * 0.038)

            let spots: [(CGFloat, CGFloat, CGFloat)] = [
                (-0.14, 0.02, 0.085),
                (0.14, 0.02, 0.085),
                (-0.18, 0.20, 0.075),
                (0.18, 0.20, 0.075),
                (-0.08, 0.32, 0.06),
                (0.08, 0.32, 0.06)
            ]
            for (dx, dy, r) in spots {
                ellipse(
                    CGRect(x: cx + dx * s - r * s, y: cy + dy * s - r * s, width: r * s * 2, height: r * s * 2),
                    fill: ink,
                    stroke: nil
                )
            }

            let head = CGRect(x: cx - s * 0.20, y: cy - s * 0.42, width: s * 0.40, height: s * 0.36)
            ellipse(head, fill: face, line: 0.048)
            ellipse(CGRect(x: cx - s * 0.11, y: cy - s * 0.32, width: s * 0.075, height: s * 0.09), fill: ink, stroke: nil)
            ellipse(CGRect(x: cx + s * 0.035, y: cy - s * 0.32, width: s * 0.075, height: s * 0.09), fill: ink, stroke: nil)
            ellipse(CGRect(x: cx + s * 0.10, y: cy - s * 0.22, width: s * 0.045, height: s * 0.04), fill: Color(hex: "#E30613"), stroke: nil)

            var smile = Path()
            smile.addArc(
                center: CGPoint(x: cx + s * 0.01, y: cy - s * 0.22),
                radius: s * 0.10,
                startAngle: .degrees(18),
                endAngle: .degrees(155),
                clockwise: false
            )
            context.stroke(smile, with: .color(ink), lineWidth: s * 0.028)
        }
        .padding(size * 0.18)
    }

    private var orlen: some View {
        let paint = Color(hex: "#E45A28")
        return ZStack {
            OrlenWing()
                .fill(paint)
            OrlenWing()
                .fill(paint)
                .scaleEffect(x: -1, y: 1, anchor: .center)
                .offset(x: size * 0.015)
        }
        .padding(size * 0.06)
    }

    private var lotos: some View {
        ZStack {
            Circle().fill(Color(hex: "#0A2F6B"))
            Circle()
                .fill(Color(hex: "#E30613"))
                .frame(width: size * 0.42, height: size * 0.42)
                .offset(y: -size * 0.04)
            Circle()
                .fill(Color.white)
                .frame(width: size * 0.16, height: size * 0.16)
                .offset(y: -size * 0.04)
        }
        .padding(size * 0.08)
    }

    private var lidl: some View {
        ZStack {
            VStack(spacing: 0) {
                Color(hex: "#FFF000")
                Color(hex: "#E30613").frame(height: size * 0.28)
            }
            .clipShape(RoundedRectangle(cornerRadius: size * 0.18, style: .continuous))
            Circle()
                .fill(Color(hex: "#FFF000"))
                .frame(width: size * 0.58, height: size * 0.58)
                .overlay {
                    Text("L")
                        .font(.system(size: size * 0.32, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color(hex: "#0050AA"))
                }
                .offset(y: -size * 0.06)
        }
        .padding(size * 0.04)
    }

    private var zabka: some View {
        ZStack {
            Circle().fill(Color(hex: "#78BE20"))
            Image(systemName: "leaf.fill")
                .font(.system(size: size * 0.46, weight: .bold))
                .foregroundStyle(.white)
                .rotationEffect(.degrees(-25))
        }
        .padding(size * 0.08)
    }

    private var shell: some View {
        ZStack {
            Circle().fill(Color(hex: "#FBCE07"))
            Image(systemName: "fanblades.fill")
                .font(.system(size: size * 0.5, weight: .bold))
                .foregroundStyle(Color(hex: "#DD1D21"))
        }
        .padding(size * 0.08)
    }

    private var bp: some View {
        ZStack {
            Circle().fill(Color(hex: "#00965E"))
            Circle()
                .fill(Color(hex: "#FFD200"))
                .frame(width: size * 0.42, height: size * 0.42)
        }
        .padding(size * 0.08)
    }

    private var carrefour: some View {
        ZStack {
            Circle().trim(from: 0.5, to: 1).fill(Color(hex: "#E30613")).rotationEffect(.degrees(40))
            Circle().trim(from: 0.5, to: 1).fill(Color(hex: "#004E9F")).rotationEffect(.degrees(220))
            Text("C")
                .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
        .padding(size * 0.08)
    }

    private var ikea: some View {
        ZStack {
            Capsule()
                .fill(Color(hex: "#FFDA1A"))
                .frame(width: size * 0.92, height: size * 0.48)
            Text("IKEA")
                .font(.system(size: size * 0.2, weight: .heavy, design: .rounded))
                .foregroundStyle(Color(hex: "#0058A3"))
        }
    }

    private var stokrotka: some View {
        ZStack {
            Circle().fill(Color(hex: "#2E9E48"))
            ForEach(0..<8, id: \.self) { index in
                Capsule()
                    .fill(Color.white.opacity(0.95))
                    .frame(width: size * 0.12, height: size * 0.32)
                    .offset(y: -size * 0.12)
                    .rotationEffect(.degrees(Double(index) * 45))
            }
            Circle()
                .fill(Color(hex: "#F6C700"))
                .frame(width: size * 0.2, height: size * 0.2)
        }
        .padding(size * 0.06)
    }

    private var okko: some View {
        ZStack {
            Capsule()
                .fill(Color(hex: "#FFCC00"))
                .frame(width: size * 0.42, height: size * 0.72)
                .rotationEffect(.degrees(28))
            Text("OKKO")
                .font(.system(size: size * 0.16, weight: .heavy, design: .rounded))
                .foregroundStyle(Color(hex: "#FFCC00"))
                .offset(y: size * 0.34)
        }
    }

    private var silpo: some View {
        Canvas { context, canvas in
            let s = min(canvas.width, canvas.height) * 0.70
            let cx = canvas.width / 2
            let cy = canvas.height / 2 + s * 0.06
            let orange = Color(hex: "#F15A22")
            context.fill(
                Path(ellipseIn: CGRect(x: cx - s * 0.34, y: cy - s * 0.24, width: s * 0.68, height: s * 0.54)),
                with: .color(.white)
            )
            var left = Path()
            left.move(to: CGPoint(x: cx - s * 0.22, y: cy - s * 0.10))
            left.addLine(to: CGPoint(x: cx - s * 0.32, y: cy - s * 0.42))
            left.addLine(to: CGPoint(x: cx - s * 0.04, y: cy - s * 0.18))
            left.closeSubpath()
            var right = Path()
            right.move(to: CGPoint(x: cx + s * 0.22, y: cy - s * 0.10))
            right.addLine(to: CGPoint(x: cx + s * 0.32, y: cy - s * 0.42))
            right.addLine(to: CGPoint(x: cx + s * 0.04, y: cy - s * 0.18))
            right.closeSubpath()
            context.fill(left, with: .color(.white))
            context.fill(right, with: .color(.white))
            context.fill(
                Path(ellipseIn: CGRect(x: cx - s * 0.12, y: cy - s * 0.10, width: s * 0.09, height: s * 0.09)),
                with: .color(orange)
            )
            context.fill(
                Path(ellipseIn: CGRect(x: cx + s * 0.03, y: cy - s * 0.10, width: s * 0.09, height: s * 0.09)),
                with: .color(orange)
            )
        }
    }
}

private struct OrlenWing: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var path = Path()
        path.move(to: CGPoint(x: w * 0.50, y: h * 0.18))
        path.addCurve(
            to: CGPoint(x: w * 0.10, y: h * 0.40),
            control1: CGPoint(x: w * 0.34, y: h * 0.12),
            control2: CGPoint(x: w * 0.14, y: h * 0.22)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.20, y: h * 0.82),
            control1: CGPoint(x: w * 0.05, y: h * 0.56),
            control2: CGPoint(x: w * 0.08, y: h * 0.74)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.48, y: h * 0.56),
            control1: CGPoint(x: w * 0.34, y: h * 0.90),
            control2: CGPoint(x: w * 0.42, y: h * 0.70)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.50, y: h * 0.18),
            control1: CGPoint(x: w * 0.46, y: h * 0.42),
            control2: CGPoint(x: w * 0.52, y: h * 0.30)
        )
        path.closeSubpath()
        return path
    }
}

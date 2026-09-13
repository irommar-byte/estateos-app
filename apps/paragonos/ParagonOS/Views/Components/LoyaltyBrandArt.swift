import SwiftUI
import UIKit

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
        case "mcdonalds": return "#DA291C"
        case "starbucks": return "#00704A"
        case "hebe": return "#E1007A"
        case "allegro": return "#FF5A00"
        case "inpost": return "#FFD100"
        case "empik": return "#E30613"
        case "dino": return "#009639"
        case "netto": return "#F6C700"
        case "aldi": return "#00005F"
        case "auchan": return "#E4002B"
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
             "selgros", "okko", "wog", "silpo", "atb":
            return true
        default:
            return false
        }
    }

    @MainActor
    static func raster(program: LoyaltyProgram, dimension: CGFloat) -> UIImage? {
        let view = LoyaltyBrandMark(program: program, size: dimension)
            .frame(width: dimension, height: dimension)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 1
        renderer.isOpaque = false
        return renderer.uiImage
    }
}

struct LoyaltyBrandMark: View {
    let program: LoyaltyProgram
    var size: CGFloat

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
            case "auchan": letter("A", ink: Color(hex: "#E4002B"))
            case "costa": letter("C", ink: Color(hex: "#6B1F32"))
            case "kfc": letter("KFC", ink: Color(hex: "#E4002B"))
            case "stokrotka": stokrotka
            case "selgros": letter("S", ink: .white)
            case "okko": okko
            case "wog": letter("WOG", ink: .white)
            case "silpo": silpo
            case "atb": letter("ATB", ink: Color(hex: "#FFCC00"))
            default:
                Text(program.monogram)
                    .font(.system(size: size * 0.36, weight: .bold, design: .rounded))
                    .foregroundStyle(program.onColor)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
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
            let s = min(canvas.width, canvas.height)
            let cx = canvas.width / 2
            let cy = canvas.height / 2 + s * 0.06
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
            let s = min(canvas.width, canvas.height)
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

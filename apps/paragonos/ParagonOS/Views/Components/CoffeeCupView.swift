import SwiftUI

struct CoffeeCupView: View {
    var size: CoffeeSize
    var selected: Bool
    var drinking: Bool
    var reduceMotion: Bool
    var compact: Bool = false
    var showsCaption: Bool = true
    var steamAt: Date? = nil

    private var well: CGFloat { compact ? 68 : 96 }

    private var artScale: CGFloat {
        switch size {
        case .small: return 0.70
        case .medium: return 0.84
        case .large: return 0.96
        }
    }

    private var bodyWidth: CGFloat {
        switch size {
        case .small: return 0.38
        case .medium: return 0.42
        case .large: return 0.46
        }
    }

    private var bodyHeight: CGFloat {
        switch size {
        case .small: return 0.36
        case .medium: return 0.40
        case .large: return 0.44
        }
    }

    var body: some View {
        VStack(spacing: compact ? 6 : 8) {
            wellView
            if showsCaption {
                Text(LocalizedStringKey(size.title))
                    .font(compact ? .caption2.weight(.semibold) : .caption.weight(.semibold))
                    .foregroundStyle(selected ? .primary : .secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var wellView: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.white.opacity(selected ? 0.55 : 0.38),
                            Color.primary.opacity(selected ? 0.05 : 0.035)
                        ],
                        center: .center,
                        startRadius: 4,
                        endRadius: well * 0.62
                    )
                )
            Circle()
                .strokeBorder(
                    selected ? ParagonTheme.osGreen.opacity(0.78) : Color.primary.opacity(0.08),
                    lineWidth: selected ? 1.5 : 1
                )
                .shadow(
                    color: selected ? ParagonTheme.osGreen.opacity(0.22) : .clear,
                    radius: selected ? 5 : 0
                )

            cupArt
                .scaleEffect(artScale)
                .scaleEffect(selected && reduceMotion == false ? 1.03 : 1)
                .offset(y: selected && reduceMotion == false ? -1 : 0)
                .animation(
                    reduceMotion ? nil : ParagonTheme.snappy,
                    value: selected
                )
                .animation(
                    reduceMotion ? nil : .easeInOut(duration: 0.32),
                    value: drinking
                )
        }
        .frame(width: well, height: well)
    }

    private var cupArt: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let unit = min(w, h)
            ZStack {
                if reduceMotion == false {
                    SteamWisp(active: selected, dense: selected, clock: steamAt)
                        .frame(width: unit * 0.42, height: unit * 0.20)
                        .offset(y: -unit * 0.34)
                        .opacity(selected ? (drinking ? 0.18 : 1) : 0)
                }

                    Ellipse()
                    .fill(.black.opacity(0.14))
                    .frame(width: unit * bodyWidth * 0.90, height: unit * 0.055)
                    .offset(y: unit * (bodyHeight * 0.62))
                    .blur(radius: 0.6)

                CeramicHandle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(white: 0.94),
                                Color(white: 0.74),
                                Color(white: 0.62)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay {
                        CeramicHandle()
                            .stroke(Color.black.opacity(0.08), lineWidth: 0.6)
                    }
                    .frame(width: unit * 0.16, height: unit * bodyHeight * 0.62)
                    .offset(x: unit * (bodyWidth * 0.42), y: unit * 0.01)

                CeramicBody()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.98, green: 0.97, blue: 0.94),
                                Color(red: 0.88, green: 0.86, blue: 0.82),
                                Color(red: 0.74, green: 0.71, blue: 0.66)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: unit * bodyWidth, height: unit * bodyHeight)
                    .overlay {
                        CeramicBody()
                            .fill(
                                LinearGradient(
                                    colors: [Color.white.opacity(0.55), Color.white.opacity(0)],
                                    startPoint: .leading,
                                    endPoint: .center
                                )
                            )
                    }
                    .overlay {
                        CeramicBody()
                            .stroke(Color.black.opacity(0.07), lineWidth: 0.5)
                    }
                    .shadow(color: .black.opacity(0.10), radius: 3, y: 2)

                Ellipse()
                    .fill(Color(white: 0.93))
                    .overlay {
                        Ellipse()
                            .strokeBorder(Color.white.opacity(0.8), lineWidth: unit * 0.016)
                    }
                    .frame(width: unit * (bodyWidth - 0.02), height: unit * 0.12)
                    .offset(y: -unit * (bodyHeight * 0.38))

                Ellipse()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(red: 0.62, green: 0.40, blue: 0.22),
                                Color(red: 0.22, green: 0.10, blue: 0.04)
                            ],
                            center: .center,
                            startRadius: 1,
                            endRadius: unit * 0.16
                        )
                    )
                    .overlay(alignment: .topLeading) {
                        Ellipse()
                            .fill(Color.white.opacity(0.22))
                            .frame(width: unit * 0.08, height: unit * 0.028)
                            .offset(x: unit * 0.06, y: unit * 0.018)
                    }
                    .frame(
                        width: unit * (bodyWidth - 0.08) * (drinking ? 0.72 : 1),
                        height: unit * (drinking ? 0.045 : 0.075)
                    )
                    .offset(y: -unit * (bodyHeight * (drinking ? 0.32 : 0.38)))
                    .opacity(drinking ? 0.45 : 1)
            }
            .frame(width: w, height: h)
            .padding(unit * 0.06)
        }
        .frame(width: well, height: well)
        .offset(x: -well * 0.02)
    }
}

private struct CeramicBody: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let topInset: CGFloat = 2
        let bottomInset = rect.width * 0.16
        path.move(to: CGPoint(x: rect.minX + 4, y: rect.minY + topInset + 8))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX - 4, y: rect.minY + topInset + 8),
            control: CGPoint(x: rect.midX, y: rect.minY)
        )
        path.addLine(to: CGPoint(x: rect.maxX - bottomInset, y: rect.maxY - 6))
        path.addQuadCurve(
            to: CGPoint(x: rect.minX + bottomInset, y: rect.maxY - 6),
            control: CGPoint(x: rect.midX, y: rect.maxY)
        )
        path.closeSubpath()
        return path
    }
}

private struct CeramicHandle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let outer = CGRect(
            x: rect.minX,
            y: rect.minY + rect.height * 0.06,
            width: rect.width,
            height: rect.height * 0.88
        )
        let inner = outer.insetBy(dx: rect.width * 0.34, dy: rect.height * 0.18)
        path.addArc(
            center: CGPoint(x: outer.minX, y: outer.midY),
            radius: outer.height / 2,
            startAngle: .degrees(-78),
            endAngle: .degrees(78),
            clockwise: false
        )
        path.addArc(
            center: CGPoint(x: inner.minX, y: inner.midY),
            radius: inner.height / 2,
            startAngle: .degrees(72),
            endAngle: .degrees(-72),
            clockwise: true
        )
        path.closeSubpath()
        return path
    }
}

struct SteamWisp: View {
    var active: Bool
    var dense: Bool
    var clock: Date? = nil

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 24, paused: active == false || clock != nil)) { timeline in
            Canvas { context, size in
                let t = (clock ?? timeline.date).timeIntervalSinceReferenceDate
                for index in 0..<3 {
                    let phase = t / (3.6 + Double(index) * 0.5)
                    let loop = phase.truncatingRemainder(dividingBy: 1)
                    var path = Path()
                    let x = size.width * (0.30 + CGFloat(index) * 0.16)
                    path.move(to: CGPoint(x: x, y: size.height))
                    path.addCurve(
                        to: CGPoint(x: x + CGFloat(sin(loop * .pi * 2) * 3.2), y: 2),
                        control1: CGPoint(x: x + 4, y: size.height * 0.55),
                        control2: CGPoint(x: x - 3.5, y: size.height * 0.28)
                    )
                    let opacity = (dense ? 0.48 : 0.22) * (1 - loop)
                    context.stroke(
                        path,
                        with: .color(Color(red: 0.58, green: 0.54, blue: 0.50).opacity(opacity)),
                        style: StrokeStyle(lineWidth: dense ? 1.6 : 1.1, lineCap: .round)
                    )
                }
            }
        }
        .allowsHitTesting(false)
        .opacity(active ? 1 : 0)
    }
}

struct CoffeeCupStrip: View {
    var selected: CoffeeSize? = .medium
    var drinking: CoffeeSize? = nil
    var steamAt: Date = Date(timeIntervalSinceReferenceDate: 100)
    var compact: Bool = false

    var body: some View {
        HStack(alignment: .bottom, spacing: compact ? 8 : 12) {
            ForEach(CoffeeSize.allCases) { size in
                VStack(spacing: compact ? 6 : 8) {
                    CoffeeCupView(
                        size: size,
                        selected: selected == size,
                        drinking: drinking == size,
                        reduceMotion: false,
                        compact: compact,
                        steamAt: steamAt
                    )
                    Text(size.fallbackPrice)
                        .font(compact ? .caption2.weight(.semibold).monospacedDigit() : .caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(selected == size ? .secondary : .tertiary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(24)
        .frame(width: compact ? 360 : 390, height: compact ? 200 : 240)
        .background(Color(.secondarySystemGroupedBackground))
    }
}

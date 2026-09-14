import SwiftUI

struct CoffeeCupView: View {
    var size: CoffeeSize
    var selected: Bool
    var drinking: Bool
    var reduceMotion: Bool
    var compact: Bool = false

    private var scale: CGFloat {
        switch size {
        case .small: return 0.78
        case .medium: return 0.92
        case .large: return 1
        }
    }

    var body: some View {
        VStack(spacing: compact ? 6 : 10) {
            ZStack(alignment: .top) {
                if reduceMotion == false {
                    SteamWisp(active: selected, dense: selected)
                        .frame(width: 56, height: compact ? 22 : 34)
                        .offset(y: compact ? -2 : -6)
                        .opacity(drinking ? 0.18 : 1)
                }
                cup
                    .scaleEffect(selected && reduceMotion == false ? 1.05 : 1)
                    .animation(
                        reduceMotion ? nil : .spring(response: 0.52, dampingFraction: 0.88),
                        value: selected
                    )
            }
            .frame(height: compact ? 72 : 108)
            .scaleEffect(scale, anchor: .bottom)
            Text(LocalizedStringKey(size.title))
                .font(compact ? .caption2.weight(.semibold) : .caption.weight(.semibold))
                .foregroundStyle(selected ? .primary : .secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var cup: some View {
        ZStack {
            Ellipse()
                .fill(.black.opacity(0.18))
                .frame(width: 58, height: 10)
                .offset(y: 42)
                .blur(radius: 1.2)

            CeramicHandle()
                .stroke(
                    LinearGradient(
                        colors: [
                            Color(white: 0.92),
                            Color(white: 0.72),
                            Color(white: 0.58)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    style: StrokeStyle(lineWidth: 5.5, lineCap: .round)
                )
                .frame(width: 22, height: 28)
                .offset(x: 34, y: 4)

            CeramicBody()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.97, green: 0.96, blue: 0.93),
                            Color(red: 0.86, green: 0.84, blue: 0.80),
                            Color(red: 0.72, green: 0.69, blue: 0.64)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 62, height: 58)
                .overlay {
                    CeramicBody()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.55),
                                    Color.white.opacity(0)
                                ],
                                startPoint: .leading,
                                endPoint: .center
                            )
                        )
                }
                .overlay(alignment: .bottom) {
                    CeramicBody()
                        .stroke(Color.black.opacity(0.08), lineWidth: 0.6)
                }
                .shadow(color: .black.opacity(0.12), radius: 6, y: 4)

            coffeeFill
                .frame(width: 50, height: drinking ? 10 : 36)
                .clipShape(CoffeeSurfaceClip())
                .offset(y: drinking ? 16 : 6)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.28), value: drinking)

            Ellipse()
                .strokeBorder(Color.white.opacity(0.7), lineWidth: 2.4)
                .background(Ellipse().fill(Color(white: 0.94).opacity(0.35)))
                .frame(width: 58, height: 16)
                .offset(y: -24)

            if selected {
                Circle()
                    .stroke(ParagonTheme.osGreen.opacity(0.7), lineWidth: 1.4)
                    .frame(width: 84, height: 84)
                    .shadow(color: ParagonTheme.osGreen.opacity(0.35), radius: 6)
                    .allowsHitTesting(false)
            }
        }
        .frame(width: 96, height: 96)
    }

    private var coffeeFill: some View {
        ZStack(alignment: .top) {
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.42, green: 0.24, blue: 0.12),
                            Color(red: 0.18, green: 0.08, blue: 0.03)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            Ellipse()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.72, green: 0.52, blue: 0.30),
                            Color(red: 0.38, green: 0.20, blue: 0.08)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(height: 12)
                .overlay(alignment: .topLeading) {
                    Ellipse()
                        .fill(Color.white.opacity(0.22))
                        .frame(width: 16, height: 5)
                        .offset(x: 8, y: 2)
                }
        }
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
        path.move(to: CGPoint(x: rect.minX + 2, y: rect.minY + 4))
        path.addQuadCurve(
            to: CGPoint(x: rect.minX + 2, y: rect.maxY - 4),
            control: CGPoint(x: rect.maxX, y: rect.midY)
        )
        return path
    }
}

private struct CoffeeSurfaceClip: Shape {
    func path(in rect: CGRect) -> Path {
        CeramicBody().path(in: rect.insetBy(dx: 2, dy: 2))
    }
}

struct SteamWisp: View {
    var active: Bool
    var dense: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 24, paused: active == false)) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                for index in 0..<3 {
                    let phase = t / (4.2 + Double(index) * 0.6)
                    let loop = phase.truncatingRemainder(dividingBy: 1)
                    var path = Path()
                    let x = size.width * (0.28 + CGFloat(index) * 0.18)
                    path.move(to: CGPoint(x: x, y: size.height))
                    path.addCurve(
                        to: CGPoint(x: x + CGFloat(sin(loop * .pi * 2) * 6), y: 4),
                        control1: CGPoint(x: x + 8, y: size.height * 0.55),
                        control2: CGPoint(x: x - 7, y: size.height * 0.28)
                    )
                    let opacity = (dense ? 0.55 : 0.28) * (1 - loop)
                    context.stroke(
                        path,
                        with: .color(Color(red: 0.62, green: 0.58, blue: 0.54).opacity(opacity)),
                        style: StrokeStyle(lineWidth: dense ? 2.4 : 1.4, lineCap: .round)
                    )
                }
            }
        }
        .allowsHitTesting(false)
        .opacity(active ? 1 : 0.28)
    }
}

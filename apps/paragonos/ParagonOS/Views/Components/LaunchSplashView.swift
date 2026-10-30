import SwiftUI
import UIKit

/// Cinematic, quiet launch: emerald aurora out of graphite, a silver mark that sharpens
/// and turns once under a passing light, the wordmark settling in, gold dust, then the
/// whole scene leans in and dissolves into the app. Driven by one clock for smoothness.
struct LaunchSplashView: View {
    enum Style {
        case full
        case brief
        case none
    }

    var style: Style = .full
    var onFinished: () -> Void

    @State private var startedAt: Date?
    @State private var splashTask: Task<Void, Never>?

    private enum Cue {
        static let mark: Double = 0.15
        static let wordmark: Double = 0.45
        static let sweep: Double = 0.95
        static let chime: Double = 1.25
        static let exit: Double = 1.95
        static let end: Double = 2.55
    }

    var body: some View {
        if style == .none {
            Color.clear
                .ignoresSafeArea()
                .onAppear { onFinished() }
        } else {
            TimelineView(.animation(paused: startedAt == nil)) { timeline in
                let t = startedAt.map { timeline.date.timeIntervalSince($0) } ?? 0
                scene(at: style == .brief ? max(t, Cue.exit - 0.35) : t)
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)
            .environment(\.colorScheme, .dark)
            .onAppear {
                startedAt = .now
                splashTask = Task { await run() }
            }
            .onDisappear {
                splashTask?.cancel()
                splashTask = nil
            }
        }
    }

    // MARK: Choreography

    private static func smooth(_ t: Double, _ a: Double, _ b: Double) -> Double {
        let x = min(1, max(0, (t - a) / max(0.001, b - a)))
        return x * x * (3 - 2 * x)
    }

    private static func easeOut(_ x: Double) -> Double {
        let v = 1 - min(1, max(0, x))
        return 1 - v * v * v * v
    }

    @ViewBuilder
    private func scene(at t: Double) -> some View {
        let aurora = Self.smooth(t, 0, 0.7)
        let exit = Self.smooth(t, Cue.exit, Cue.end)
        let mark = Self.easeOut(Self.smooth(t, Cue.mark, Cue.mark + 0.75))
        let word = Self.easeOut(Self.smooth(t, Cue.wordmark, Cue.wordmark + 0.7))
        let tagline = Self.smooth(t, Cue.wordmark + 0.45, Cue.wordmark + 1.0)
        let sweep = Self.smooth(t, Cue.sweep, Cue.sweep + 0.6)
        GeometryReader { geo in
            ZStack {
                Color(red: 0.035, green: 0.039, blue: 0.043)
                MeshGradient(
                    width: 3,
                    height: 3,
                    points: [
                        .init(0, 0), .init(0.5, 0), .init(1, 0),
                        .init(0, 0.5), .init(Float(0.5 + 0.05 * sin(t * 0.9)), Float(0.46 + 0.04 * cos(t * 0.7))), .init(1, 0.5),
                        .init(0, 1), .init(0.5, 1), .init(1, 1)
                    ],
                    colors: [
                        .black, Color(red: 0.03, green: 0.14, blue: 0.10), .black,
                        Color(red: 0.05, green: 0.20, blue: 0.14), Color(red: 0.10, green: 0.34, blue: 0.24),
                        Color(red: 0.20, green: 0.16, blue: 0.08),
                        .black, Color(red: 0.04, green: 0.12, blue: 0.09), .black
                    ]
                )
                .opacity(0.85 * aurora)

                GoldDust(time: t, strength: Self.smooth(t, 0.6, 1.2) * (1 - Self.smooth(t, 1.8, 2.4)))

                VStack(spacing: 20) {
                    SilverMark(turn: Self.easeOut(Self.smooth(t, Cue.mark, Cue.mark + 1.5)), sweep: sweep)
                        .frame(width: 104, height: 104)
                        .scaleEffect(0.82 + 0.18 * mark)
                        .blur(radius: 14 * (1 - mark))
                        .opacity(mark)
                    BrandWordmark(size: .largeTitle, primary: .white, os: Color(red: 0.42, green: 0.86, blue: 0.64))
                        .tracking(10 * (1 - word))
                        .blur(radius: 8 * (1 - word))
                        .opacity(word)
                        .overlay { LightSweep(progress: sweep).mask { BrandWordmark(size: .largeTitle) } }
                    Text("Kwitki wracają. Kaucja też.")
                        .font(.footnote.weight(.medium))
                        .tracking(0.6)
                        .foregroundStyle(.white.opacity(0.62))
                        .opacity(tagline)
                }
                .scaleEffect(1 + 0.12 * exit)
                .blur(radius: 16 * exit)
                .opacity(1 - exit)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .opacity(1 - Self.smooth(t, Cue.exit + 0.15, Cue.end))
        }
    }

    private func run() async {
        if style == .brief || UIAccessibility.isReduceMotionEnabled {
            try? await Task.sleep(for: .seconds(Cue.end - (Cue.exit - 0.35)))
            guard Task.isCancelled == false else { return }
            onFinished()
            return
        }
        LaunchSounds.prepare()
        try? await Task.sleep(for: .seconds(Cue.mark + 0.1))
        guard Task.isCancelled == false else { return }
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        try? await Task.sleep(for: .seconds(Cue.chime - Cue.mark - 0.1))
        guard Task.isCancelled == false else { return }
        LaunchSounds.cashRegister()
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred(intensity: 0.8)
        try? await Task.sleep(for: .seconds(Cue.end - Cue.chime))
        guard Task.isCancelled == false else { return }
        onFinished()
    }
}

enum LaunchSplashPolicy {
    static let seenKey = "paragonos.didShowLaunchSplash"
    static var skipNext = false

    static var style: LaunchSplashView.Style {
        if skipNext {
            skipNext = false
            return .none
        }
        if UIAccessibility.isReduceMotionEnabled { return .brief }
        return .full
    }

    static func markSeen() {
        UserDefaults.standard.set(true, forKey: seenKey)
    }
}

/// Brushed-silver recycling mark with a thin champagne ring and an emerald halo.
private struct SilverMark: View {
    var turn: Double
    var sweep: Double

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [Color(red: 0.16, green: 0.52, blue: 0.36).opacity(0.35), .clear],
                                     center: .center, startRadius: 4, endRadius: 70))
                .scaleEffect(1.5)
            Circle()
                .stroke(
                    LinearGradient(colors: [Color(red: 0.95, green: 0.86, blue: 0.66), Color(red: 0.55, green: 0.45, blue: 0.28)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    lineWidth: 1.2
                )
            RecyclingArrows()
                .stroke(
                    LinearGradient(
                        stops: [
                            .init(color: Color(white: 0.98), location: 0),
                            .init(color: Color(white: 0.62), location: 0.45),
                            .init(color: Color(white: 0.92), location: 0.7),
                            .init(color: Color(white: 0.55), location: 1)
                        ],
                        startPoint: .top, endPoint: .bottom
                    ),
                    style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round)
                )
                .padding(22)
                .rotationEffect(.degrees(120 * turn))
                .shadow(color: .black.opacity(0.5), radius: 0, y: 1)
            LightSweep(progress: sweep)
                .mask { RecyclingArrows().stroke(style: StrokeStyle(lineWidth: 5, lineCap: .round)).padding(22).rotationEffect(.degrees(120 * turn)) }
        }
    }
}

/// A soft diagonal band of light passing once across whatever it masks.
private struct LightSweep: View {
    var progress: Double

    var body: some View {
        GeometryReader { geo in
            LinearGradient(
                colors: [.clear, .white.opacity(0.85), .clear],
                startPoint: .leading, endPoint: .trailing
            )
            .frame(width: geo.size.width * 0.45)
            .rotationEffect(.degrees(18))
            .offset(x: (geo.size.width * 1.6) * progress - geo.size.width * 0.5)
            .opacity(progress > 0 && progress < 1 ? 1 : 0)
        }
        .allowsHitTesting(false)
    }
}

/// Fine champagne dust drifting outward from the mark.
private struct GoldDust: View {
    var time: Double
    var strength: Double

    var body: some View {
        Canvas { context, size in
            guard strength > 0.01 else { return }
            let center = CGPoint(x: size.width / 2, y: size.height / 2 - 40)
            for i in 0..<46 {
                let seed = Double(i) * 12.9898
                let angle = (seed.truncatingRemainder(dividingBy: 6.283)) + time * 0.08
                let speed = 18 + (seed * 7).truncatingRemainder(dividingBy: 36)
                let r = 60 + speed * time
                let p = CGPoint(x: center.x + cos(angle) * r, y: center.y + sin(angle) * r * 0.8)
                let s = 0.8 + (seed * 3).truncatingRemainder(dividingBy: 1.8)
                let twinkle = 0.5 + 0.5 * sin(time * 3 + seed)
                context.fill(
                    Path(ellipseIn: CGRect(x: p.x - s / 2, y: p.y - s / 2, width: s, height: s)),
                    with: .color(Color(red: 1, green: 0.88, blue: 0.62).opacity(0.75 * strength * twinkle))
                )
            }
        }
        .allowsHitTesting(false)
    }
}

private struct RecyclingArrows: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) * 0.42
        for index in 0..<3 {
            let start = Double(index) * 120.0
            let end = start + 78
            let startRad = (start - 90) * .pi / 180
            path.move(
                to: CGPoint(
                    x: center.x + cos(startRad) * radius,
                    y: center.y + sin(startRad) * radius
                )
            )
            path.addArc(
                center: center,
                radius: radius,
                startAngle: .degrees(start - 90),
                endAngle: .degrees(end - 90),
                clockwise: false
            )
            let heading = (end - 90) * .pi / 180
            let tip = CGPoint(
                x: center.x + cos(heading) * radius,
                y: center.y + sin(heading) * radius
            )
            let left = heading + .pi * 0.78
            let right = heading - .pi * 0.78
            path.move(to: CGPoint(x: tip.x + cos(left) * 7, y: tip.y + sin(left) * 7))
            path.addLine(to: tip)
            path.addLine(to: CGPoint(x: tip.x + cos(right) * 7, y: tip.y + sin(right) * 7))
        }
        return path
    }
}


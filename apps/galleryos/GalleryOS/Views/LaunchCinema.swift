import SwiftUI
import UIKit

/// Opening film: aurora and dust fade up, three photos fly in from depth, a light burst lands on
/// the bell of `LaunchChime`, the wordmark resolves letter by letter, then an iris opens onto the app.
struct LaunchCinema: View {
    var onFinish: () -> Void
    /// Same blue as GalleryTheme / TVTheme, so this film compiles in both apps.
    private static let accent = Color(red: 0.29, green: 0.56, blue: 1.0)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var started: Date?
    @State private var exitAt: TimeInterval?
    @State private var finished = false
    @State private var chime = LaunchChimePlayer()

    /// Phone composition stays 1:1. On a television the same film is enlarged so the cards fill the room.
    private static func stageScale(_ size: CGSize) -> CGFloat {
        #if os(tvOS)
        return max(1, min(size.width, size.height) / 520)
        #else
        _ = size
        return 1
        #endif
    }

    private static let exitStart: TimeInterval = 2.75
    private static let exitLength: TimeInterval = 0.62
    private static let skipLength: TimeInterval = 0.4
    #if os(tvOS)
    private static let skipCaption = L("Naciśnij, aby pominąć")
    #else
    private static let skipCaption = L("Stuknij, aby pominąć")
    #endif

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 120.0, paused: started == nil || finished)) { context in
            let time = started.map { context.date.timeIntervalSince($0) } ?? 0
            GeometryReader { proxy in
                scene(time: time, size: proxy.size)
            }
        }
        .ignoresSafeArea()
        .contentShape(Rectangle())
        .onTapGesture { skip() }
        .modifier(LaunchSkipCommand(skip: skip))
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("GalleryOS™")
        .accessibilityHint(Self.skipCaption)
        // Dark only for the film itself; preferredColorScheme flipped the whole app under it.
        .environment(\.colorScheme, .dark)
        .task { await play() }
    }

    // MARK: Timeline

    private func exitProgress(_ time: TimeInterval) -> Double {
        if let exitAt { return ease((time - exitAt) / Self.skipLength) }
        return ease((time - Self.exitStart) / Self.exitLength)
    }

    @ViewBuilder
    private func scene(time: TimeInterval, size: CGSize) -> some View {
        let out = exitProgress(time)
        let t = reduceMotion ? 2.2 : time
        let scale = Self.stageScale(size)
        ZStack {
            Color.black
            aurora(t, out: out)
            dust(t, out: out, size: size)
            burst(t, out: out, size: size)
            cards(t, out: out)
                .scaleEffect(scale)
                .offset(y: -size.height * 0.07)
            VStack(spacing: 12) {
                Spacer()
                wordmark(t, out: out)
                    .scaleEffect(scale)
                #if os(tvOS)
                // On the television the hint sat over the wordmark; the remote's click still skips.
                Color.clear.frame(height: 34 * scale)
                #else
                Text(Self.skipCaption)
                    .font(scale > 1.2 ? .title3 : .footnote)
                    .foregroundStyle(.white.opacity(0.36))
                    .opacity(ease((t - 0.35) / 0.35) * (1 - out))
                    .padding(.bottom, 34 * scale)
                #endif
            }
            .padding(.top, size.height * 0.5)
        }
        .frame(width: size.width, height: size.height)
        .opacity(1 - ease((out - 0.15) / 0.85))
        .scaleEffect(1 + out * 0.04)
    }

    // MARK: Layers

    private func aurora(_ t: Double, out: Double) -> some View {
        let rise = ease((t - 0.02) / 0.95)
        let drift = Float(sin(t * 0.85) * 0.07)
        let sway = Float(cos(t * 0.6) * 0.05)
        let deep = Color(red: 0.02, green: 0.02, blue: 0.05)
        return ZStack {
            Group {
                if #available(iOS 18.0, *) {
                    MeshGradient(
                        width: 3,
                        height: 3,
                        points: [
                            [0, 0], [0.5 + sway, 0], [1, 0],
                            [0, 0.42 + drift], [0.5 - drift, 0.44 + sway], [1, 0.46 - drift],
                            [0, 1], [0.5 + drift, 1], [1, 1],
                        ],
                        colors: [
                            deep, Color(red: 0.06, green: 0.08, blue: 0.24), deep,
                            Color(red: 0.32, green: 0.12, blue: 0.52), Self.accent.opacity(0.9), Color(red: 0.10, green: 0.30, blue: 0.62),
                            deep, Color(red: 0.42, green: 0.18, blue: 0.10), deep,
                        ]
                    )
                } else {
                    LinearGradient(colors: [deep, Self.accent.opacity(0.55), deep], startPoint: .top, endPoint: .bottom)
                }
            }
            .opacity(0.85 * rise)
            .blur(radius: 26)
            .scaleEffect(1 + out * 0.4 + (1 - rise) * 0.15)
            RadialGradient(colors: [.clear, .black.opacity(0.78)], center: .center, startRadius: 120, endRadius: 520)
        }
        .drawingGroup()
    }

    private func dust(_ t: Double, out: Double, size: CGSize) -> some View {
        let fade = ease(t / 0.8) * (1 - out)
        return Canvas { context, canvas in
            for index in 0..<84 {
                let x = noise(index, 1) * canvas.width + sin(t * 0.35 + noise(index, 2) * 6) * 10
                let speed = 5 + noise(index, 3) * 16
                let rawY = noise(index, 4) * canvas.height - t * speed
                let y = rawY < 0 ? rawY + canvas.height : rawY
                let twinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (1.4 + noise(index, 5) * 3.2) + noise(index, 6) * 10))
                let diameter = 0.7 + noise(index, 7) * 1.9
                context.opacity = fade * twinkle * (0.18 + noise(index, 8) * 0.5)
                context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: diameter, height: diameter)), with: .color(.white))
            }
        }
        .allowsHitTesting(false)
    }

    /// Ring, flash and sparks, landing on the bell of the chime.
    private func burst(_ t: Double, out: Double, size: CGSize) -> some View {
        let since = t - LaunchChime.bloom
        let ring = ease(since / 1.0)
        let live = since > 0 ? 1.0 : 0.0
        let center = CGPoint(x: size.width / 2, y: size.height / 2 - size.height * 0.07)
        return ZStack {
            Circle()
                .fill(RadialGradient(colors: [.white.opacity(0.9), Self.accent.opacity(0.35), .clear], center: .center, startRadius: 0, endRadius: 170))
                .frame(width: 340, height: 340)
                .scaleEffect(0.6 + ring * 0.8)
                .opacity(live * exp(-max(0, since) * 4.2) * 0.75)
                .blendMode(.plusLighter)
                .position(center)
            Circle()
                .strokeBorder(
                    AngularGradient(colors: [.white, Self.accent, Color(red: 1, green: 0.8, blue: 0.45), .white], center: .center),
                    lineWidth: max(0.4, 2.6 * (1 - ring))
                )
                .frame(width: 90, height: 90)
                .scaleEffect(0.35 + ring * 6.2)
                .opacity(live * (1 - ring) * 0.95)
                .blendMode(.plusLighter)
                .position(center)
            Canvas { context, _ in
                guard since > 0, since < 1.8 else { return }
                context.blendMode = .plusLighter
                context.addFilter(.blur(radius: 0.6))
                for index in 0..<56 {
                    let angle = noise(index, 11) * 2 * .pi
                    let speed = 110 + noise(index, 12) * 300
                    let travel = 1 - exp(-since * 3.1)
                    let fall = since * since * 26
                    let point = CGPoint(
                        x: center.x + cos(angle) * speed * travel,
                        y: center.y + sin(angle) * speed * travel + fall
                    )
                    let life = max(0, 1 - since / (0.9 + noise(index, 13) * 0.9))
                    let flicker = 0.6 + 0.4 * sin(since * 24 + noise(index, 14) * 9)
                    let radius = 0.9 + noise(index, 15) * 2.1
                    let tint: Color = switch index % 3 {
                    case 0: .white
                    case 1: Color(red: 1, green: 0.84, blue: 0.5)
                    default: Color(red: 0.6, green: 0.78, blue: 1)
                    }
                    context.opacity = life * flicker * (1 - out)
                    context.fill(sparkle(at: point, radius: radius), with: .color(tint))
                }
            }
            .allowsHitTesting(false)
        }
    }

    private func sparkle(at point: CGPoint, radius: CGFloat) -> Path {
        var path = Path()
        let long = radius * 2.6
        path.move(to: CGPoint(x: point.x, y: point.y - long))
        path.addQuadCurve(to: CGPoint(x: point.x + long, y: point.y), control: point)
        path.addQuadCurve(to: CGPoint(x: point.x, y: point.y + long), control: point)
        path.addQuadCurve(to: CGPoint(x: point.x - long, y: point.y), control: point)
        path.addQuadCurve(to: CGPoint(x: point.x, y: point.y - long), control: point)
        path.addEllipse(in: CGRect(x: point.x - radius / 2, y: point.y - radius / 2, width: radius, height: radius))
        return path
    }

    private func cards(_ t: Double, out: Double) -> some View {
        ZStack {
            card(t, out: out, kind: 0, x: -84, y: 26, rotation: -15, delay: 0.06, z: 0)
            card(t, out: out, kind: 2, x: 90, y: 40, rotation: 17, delay: 0.17, z: 1)
            card(t, out: out, kind: 1, x: 4, y: -16, rotation: 6, delay: 0.29, z: 2)
        }
    }

    private func card(_ t: Double, out: Double, kind: Int, x: CGFloat, y: CGFloat, rotation: Double, delay: Double, z: Double) -> some View {
        let raw = min(1, max(0, (t - delay) / 1.05))
        let arrive = spring(raw)
        let clear = ease(raw * 1.4)
        let float = sin(t * 1.15 + Double(kind) * 1.7) * 3 * clear
        let direction: (CGFloat, CGFloat, Double) = switch kind {
        case 0: (-1.1, -0.7, -28)
        case 2: (1.1, -0.4, 24)
        default: (0.06, 1.1, 10)
        }
        let angle = rotation + (1 - arrive) * 48 + out * direction.2
        let scale = (0.34 + 0.66 * arrive) * (1 + out * 0.32)
        let posX = x + out * direction.0 * 520
        let posY = y + (1 - arrive) * 170 + float + out * direction.1 * 620
        let sheen = (t - delay - 0.95) / 0.75
        return cardFace(kind)
            .frame(width: 168, height: 214)
            .overlay { cardSheen(sheen) }
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .strokeBorder(
                        LinearGradient(colors: [.white.opacity(0.85), Self.accent.opacity(0.55), .white.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing),
                        lineWidth: 1.2
                    )
            }
            .shadow(color: .black.opacity(0.5), radius: 30, y: 24)
            .rotation3DEffect(.degrees(angle), axis: (x: 0.2, y: 1, z: 0.05), perspective: 0.5)
            .scaleEffect(scale)
            .blur(radius: (1 - clear) * 16 + out * 14)
            .offset(x: posX, y: posY)
            .opacity(clear * (1 - out * 0.9))
            .zIndex(z)
    }

    private func cardSheen(_ progress: Double) -> some View {
        GeometryReader { proxy in
            LinearGradient(colors: [.clear, .white.opacity(0.5), .clear], startPoint: .leading, endPoint: .trailing)
                .frame(width: proxy.size.width * 0.45)
                .rotationEffect(.degrees(20))
                .offset(x: -proxy.size.width * 0.6 + CGFloat(progress) * proxy.size.width * 1.8)
                .opacity(progress > 0 && progress < 1 ? 1 : 0)
                .blendMode(.plusLighter)
        }
        .allowsHitTesting(false)
    }

    @ViewBuilder
    private func cardFace(_ kind: Int) -> some View {
        switch kind {
        case 0:
            ZStack(alignment: .bottom) {
                LinearGradient(colors: [Color(red: 1, green: 0.62, blue: 0.28), Color(red: 0.95, green: 0.28, blue: 0.38), Color(red: 0.28, green: 0.18, blue: 0.55)], startPoint: .top, endPoint: .bottom)
                Circle()
                    .fill(.white.opacity(0.92))
                    .frame(width: 54, height: 54)
                    .offset(y: -78)
                Capsule()
                    .fill(Color.black.opacity(0.28))
                    .frame(width: 150, height: 46)
                    .offset(y: 8)
            }
        case 2:
            ZStack {
                LinearGradient(colors: [Color(red: 0.08, green: 0.05, blue: 0.16), Color(red: 0.45, green: 0.12, blue: 0.42)], startPoint: .top, endPoint: .bottom)
                bokeh(Color(red: 1, green: 0.78, blue: 0.35), x: -30, y: -20, size: 28)
                bokeh(.white, x: 24, y: -48, size: 16)
                bokeh(Self.accent, x: 36, y: 10, size: 22)
                bokeh(Color(red: 1, green: 0.35, blue: 0.55), x: -18, y: 36, size: 18)
            }
        default:
            ZStack(alignment: .bottom) {
                LinearGradient(colors: [Color(red: 0.45, green: 0.72, blue: 0.95), Color(red: 0.18, green: 0.42, blue: 0.72)], startPoint: .top, endPoint: .center)
                LinearGradient(colors: [Color(red: 0.10, green: 0.45, blue: 0.55), Color(red: 0.05, green: 0.18, blue: 0.32)], startPoint: .center, endPoint: .bottom)
                Path { path in
                    path.move(to: CGPoint(x: 18, y: 150))
                    path.addLine(to: CGPoint(x: 78, y: 92))
                    path.addLine(to: CGPoint(x: 118, y: 128))
                    path.addLine(to: CGPoint(x: 168, y: 70))
                    path.addLine(to: CGPoint(x: 168, y: 214))
                    path.addLine(to: CGPoint(x: 0, y: 214))
                    path.closeSubpath()
                }
                .fill(Color(red: 0.05, green: 0.16, blue: 0.22).opacity(0.85))
            }
        }
    }

    private func bokeh(_ color: Color, x: CGFloat, y: CGFloat, size: CGFloat) -> some View {
        Circle()
            .fill(color.opacity(0.85))
            .frame(width: size, height: size)
            .blur(radius: 1.2)
            .offset(x: x, y: y)
    }

    // MARK: Wordmark

    private static let letters: [(String, Bool)] = Array("Gallery").map { (String($0), false) } + Array("OS").map { (String($0), true) }

    private func wordmark(_ t: Double, out: Double) -> some View {
        let start = 0.18
        let count = Double(Self.letters.count)
        let sweep = (t - 0.95) / 0.7
        let tag = ease((t - 0.85) / 0.45)
        return VStack(spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                ForEach(Array(Self.letters.enumerated()), id: \.offset) { index, item in
                    let p = ease((t - start - Double(index) * 0.05) / 0.5)
                    Text(item.0)
                        .font(.system(size: 44, weight: item.1 ? .bold : .semibold))
                        .foregroundStyle(item.1 ? Self.accent : .white)
                        .opacity(p)
                        .blur(radius: (1 - p) * 12)
                        .scaleEffect(0.82 + 0.18 * p, anchor: .bottom)
                        .offset(x: (1 - p) * (Double(index) - count / 2) * 7, y: (1 - p) * 14)
                }
                Text("™")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Self.accent)
                    .baselineOffset(18)
                    .opacity(ease((t - start - count * 0.05) / 0.4))
            }
            .overlay {
                GeometryReader { proxy in
                    LinearGradient(colors: [.clear, .white.opacity(0.95), .clear], startPoint: .leading, endPoint: .trailing)
                        .frame(width: proxy.size.width * 0.35)
                        .offset(x: -proxy.size.width * 0.4 + CGFloat(sweep) * proxy.size.width * 1.45)
                        .opacity(sweep > 0 && sweep < 1 ? 1 : 0)
                }
                .blendMode(.plusLighter)
                .mask {
                    HStack(alignment: .firstTextBaseline, spacing: 0) {
                        Text("Gallery").font(.system(size: 44, weight: .semibold))
                        Text("OS").font(.system(size: 44, weight: .bold))
                        Text("™").font(.system(size: 17, weight: .semibold)).baselineOffset(18)
                    }
                }
            }
            .shadow(color: Self.accent.opacity(0.45 * ease((t - 1.1) / 0.6)), radius: 22)
            Text(L("Twoja biblioteka"))
                .font(.subheadline.weight(.medium))
                .tracking(3 * (1 - tag) + 0.6)
                .foregroundStyle(.white.opacity(0.7))
                .opacity(tag)
                .offset(y: (1 - tag) * 6)
        }
        .scaleEffect(1 + out * 0.12)
        .offset(y: -out * 30)
        .blur(radius: out * 10)
        .opacity(1 - out)
        .accessibilityHidden(true)
    }

    // MARK: Motion helpers

    private func ease(_ value: Double) -> Double {
        let x = min(1, max(0, value))
        return 1 - pow(1 - x, 3)
    }

    /// Damped spring: arrives with a ~6 % overshoot and settles.
    private func spring(_ x: Double) -> Double {
        guard x > 0 else { return 0 }
        guard x < 1 else { return 1 }
        return 1 - exp(-6 * x) * cos(7 * x)
    }

    private func noise(_ index: Int, _ salt: Int) -> Double {
        let value = sin(Double(index * 127 + salt * 311) * 12.9898) * 43_758.5453
        return value - floor(value)
    }

    // MARK: Playback

    private func play() async {
        let origin = Date()
        started = origin
        chime.start { Date().timeIntervalSince(origin) }
        if reduceMotion {
            try? await Task.sleep(for: .seconds(1.4))
            skip()
            return
        }
        do {
            try await Task.sleep(for: .seconds(LaunchChime.bloom))
            if exitAt == nil {
                #if os(iOS)
                UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.9)
                #endif
            }
            try await Task.sleep(for: .seconds(Self.exitStart + Self.exitLength - LaunchChime.bloom))
            complete()
        } catch {
            return
        }
    }

    private func skip() {
        guard !finished, exitAt == nil else { return }
        let now = started.map { Date().timeIntervalSince($0) } ?? 0
        guard now < Self.exitStart else { return }
        exitAt = now
        chime.fadeOut()
        Task {
            try? await Task.sleep(for: .seconds(Self.skipLength))
            complete()
        }
    }

    private func complete() {
        guard !finished else { return }
        finished = true
        onFinish()
    }
}

/// Play on the Siri Remote skips the film. A click also arrives as a tap once the view can take focus.
private struct LaunchSkipCommand: ViewModifier {
    var skip: () -> Void

    func body(content: Content) -> some View {
        #if os(tvOS)
        content
            .focusable()
            .focusEffectDisabled()
            .onPlayPauseCommand { skip() }
        #else
        content
        #endif
    }
}

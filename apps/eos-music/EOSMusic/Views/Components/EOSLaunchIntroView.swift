import SwiftUI

/// Kinowa animacja startu EOS™ Music (~1,7 s), potem RootView „przelatuje” przez nią do aplikacji.
///
/// Sekwencja: zorza w tle → szklany dysk wyłania się z rozmycia i obraca połysk →
/// fale dźwięku rozchodzą się od środka → cząsteczki światła zbiegają do dysku →
/// litery EOS wyostrzają się z rozmycia, napis MUSIC rozsuwa się, przez logo przechodzi błysk.
/// Wszystko na GPU (gradienty, Canvas) — bez ciężkich widoków.
struct EOSLaunchIntroView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var auroraOn = false
    @State private var discVisible = false
    @State private var discSpin = false
    @State private var wavesOn = false
    @State private var lettersVisible = false
    @State private var subtitleVisible = false
    @State private var shimmer = false
    @State private var landed = 0
    @State private var startDate = Date()

    private let wordmark = Array("EOS")

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            aurora
                .ignoresSafeArea()
                .allowsHitTesting(false)

            if !reduceMotion {
                ConvergingParticles(start: startDate)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .opacity(discVisible ? 1 : 0)
            }

            VStack(spacing: 26) {
                Spacer(minLength: 0)

                ZStack {
                    if !reduceMotion {
                        SoundWaveRings(active: wavesOn)
                    }
                    glassDisc
                }
                .frame(width: 220, height: 220)

                wordmarkBlock

                Spacer(minLength: 0)
                Spacer(minLength: 0)
            }
        }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: landed)
        .onAppear { runSequence() }
    }

    // MARK: - Tło: wolno obracająca się zorza w barwach marki

    private var aurora: some View {
        ZStack {
            AngularGradient(
                colors: [
                    EOSTheme.accent.opacity(0.55),
                    EOSTheme.accentSecondary.opacity(0.45),
                    Color(red: 0.15, green: 0.25, blue: 0.95).opacity(0.35),
                    EOSTheme.accent.opacity(0.55)
                ],
                center: .center
            )
            .frame(width: 620, height: 620)
            .blur(radius: 120)
            .rotationEffect(.degrees(auroraOn ? 160 : 0))
            .scaleEffect(auroraOn ? 1.15 : 0.6)
            .opacity(auroraOn ? 0.55 : 0)

            RadialGradient(
                colors: [.clear, .black.opacity(0.85)],
                center: .center,
                startRadius: 120,
                endRadius: 520
            )
        }
    }

    // MARK: - Szklany dysk z obracającym się połyskiem

    private var glassDisc: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color(white: 0.16), Color(white: 0.05), .black],
                        center: .center,
                        startRadius: 2,
                        endRadius: 70
                    )
                )
            // Rowki jak na płycie — bardzo subtelne.
            ForEach(0..<5, id: \.self) { i in
                Circle()
                    .stroke(Color.white.opacity(0.05), lineWidth: 0.6)
                    .padding(CGFloat(10 + i * 9))
            }
            // Obracający się refleks — „luksusowe szkło”.
            Circle()
                .fill(
                    AngularGradient(
                        colors: [
                            .clear, .white.opacity(0.32), .clear, .clear,
                            EOSTheme.accent.opacity(0.35), .clear, .clear
                        ],
                        center: .center
                    )
                )
                .rotationEffect(.degrees(discSpin ? 360 : 0))
                .blendMode(.plusLighter)
            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [.white.opacity(0.55), .white.opacity(0.05), EOSTheme.accent.opacity(0.6)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.2
                )
            Image(systemName: "waveform")
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(EOSTheme.gradient)
                .symbolEffect(.variableColor.iterative.reversing, options: .speed(0.8), isActive: discVisible && !reduceMotion)
                .shadow(color: EOSTheme.accent.opacity(0.8), radius: 14)
        }
        .frame(width: 128, height: 128)
        .shadow(color: EOSTheme.accent.opacity(discVisible ? 0.55 : 0), radius: 40)
        .shadow(color: .black.opacity(0.6), radius: 20, y: 14)
        .scaleEffect(discVisible ? 1 : 0.55)
        .blur(radius: discVisible ? 0 : 24)
        .opacity(discVisible ? 1 : 0)
    }

    // MARK: - Napis

    private var wordmarkBlock: some View {
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                ForEach(Array(wordmark.enumerated()), id: \.offset) { index, letter in
                    Text(String(letter))
                        .font(.system(size: 44, weight: .heavy, design: .rounded))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.white, Color(white: 0.78)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .blur(radius: lettersVisible ? 0 : 12)
                        .opacity(lettersVisible ? 1 : 0)
                        .offset(y: lettersVisible ? 0 : 18)
                        .scaleEffect(lettersVisible ? 1 : 1.4)
                        .animation(
                            reduceMotion
                                ? .easeOut(duration: 0.3)
                                : .spring(response: 0.6, dampingFraction: 0.74).delay(Double(index) * 0.08),
                            value: lettersVisible
                        )
                }
                Text("™")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(EOSTheme.accent)
                    .baselineOffset(20)
                    .opacity(subtitleVisible ? 1 : 0)
            }
            .overlay {
                if !reduceMotion {
                    LaunchShimmer(active: shimmer)
                        .mask(
                            HStack(spacing: 4) {
                                ForEach(Array(wordmark.enumerated()), id: \.offset) { _, letter in
                                    Text(String(letter))
                                        .font(.system(size: 44, weight: .heavy, design: .rounded))
                                }
                            }
                        )
                }
            }

            Text("MUSIC")
                .font(.system(size: 13, weight: .bold))
                .tracking(subtitleVisible ? 9 : 24)
                .foregroundStyle(.white.opacity(0.6))
                .opacity(subtitleVisible ? 1 : 0)
                .blur(radius: subtitleVisible ? 0 : 6)
        }
    }

    // MARK: - Sekwencja

    private func runSequence() {
        startDate = Date()
        if reduceMotion {
            withAnimation(.easeOut(duration: 0.35)) {
                auroraOn = true
                discVisible = true
                lettersVisible = true
                subtitleVisible = true
            }
            return
        }

        withAnimation(.easeOut(duration: 1.6)) { auroraOn = true }
        withAnimation(.spring(response: 0.7, dampingFraction: 0.72).delay(0.1)) { discVisible = true }
        withAnimation(.linear(duration: 2.4).repeatForever(autoreverses: false)) { discSpin = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.42) {
            landed += 1
            wavesOn = true
        }
        withAnimation(.easeOut(duration: 0.4).delay(0.45)) { lettersVisible = true }
        withAnimation(.spring(response: 0.9, dampingFraction: 0.85).delay(0.75)) { subtitleVisible = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.95) {
            withAnimation(.easeInOut(duration: 1.1)) { shimmer = true }
        }
    }
}

/// Wyjście z animacji startu: intro rośnie i rozmywa się, jakby kamera „przeleciała” przez logo.
struct EOSLaunchExitModifier: ViewModifier {
    let progress: Double // 0 = widoczne, 1 = zniknęło

    func body(content: Content) -> some View {
        content
            .scaleEffect(1 + progress * 0.35)
            .blur(radius: progress * 22)
            .opacity(1 - progress)
    }
}

extension AnyTransition {
    static var eosLaunchExit: AnyTransition {
        .asymmetric(
            insertion: .opacity,
            removal: .modifier(
                active: EOSLaunchExitModifier(progress: 1),
                identity: EOSLaunchExitModifier(progress: 0)
            )
        )
    }

    /// Wejście treści po intro: lekki „dolot” z rozmycia.
    static var eosContentReveal: AnyTransition {
        .modifier(
            active: EOSContentRevealModifier(progress: 0),
            identity: EOSContentRevealModifier(progress: 1)
        )
    }
}

struct EOSContentRevealModifier: ViewModifier {
    let progress: Double

    func body(content: Content) -> some View {
        content
            .scaleEffect(0.94 + progress * 0.06)
            .blur(radius: (1 - progress) * 10)
            .opacity(progress)
    }
}

// MARK: - Fale dźwięku

private struct SoundWaveRings: View {
    let active: Bool
    @State private var expand = false

    var body: some View {
        ZStack {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [EOSTheme.accent.opacity(0.7), EOSTheme.accentSecondary.opacity(0.4)],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: 1.4
                    )
                    .frame(width: 128, height: 128)
                    .scaleEffect(expand ? 2.1 : 1)
                    .opacity(expand ? 0 : 0.85)
                    .animation(
                        .easeOut(duration: 1.6)
                            .repeatForever(autoreverses: false)
                            .delay(Double(index) * 0.45),
                        value: expand
                    )
            }
        }
        .onChange(of: active) { _, on in if on { expand = true } }
    }
}

// MARK: - Cząsteczki światła zbiegające do środka

private struct ConvergingParticles: View {
    let start: Date

    private struct Particle {
        let angle: Double
        let startRadius: Double
        let speed: Double
        let size: Double
        let hueShift: Double
    }

    private let particles: [Particle] = {
        var gen = SystemRandomNumberGenerator()
        return (0..<56).map { _ in
            Particle(
                angle: Double.random(in: 0..<(2 * .pi), using: &gen),
                startRadius: Double.random(in: 180...420, using: &gen),
                speed: Double.random(in: 0.45...0.9, using: &gen),
                size: Double.random(in: 1.2...3.2, using: &gen),
                hueShift: Double.random(in: 0...1, using: &gen)
            )
        }
    }()

    var body: some View {
        TimelineView(.animation) { timeline in
            let t = timeline.date.timeIntervalSince(start)
            Canvas { context, size in
                let center = CGPoint(x: size.width / 2, y: size.height * 0.43)
                context.blendMode = .plusLighter
                for p in particles {
                    // Każda cząsteczka leci po lekkiej spirali do dysku i gaśnie przy krawędzi.
                    let travel = min(1, max(0, t * p.speed))
                    let eased = 1 - pow(1 - travel, 3)
                    let radius = p.startRadius * (1 - eased) + 64 * eased
                    let angle = p.angle + eased * 1.1
                    let x = center.x + cos(angle) * radius
                    let y = center.y + sin(angle) * radius
                    let fade = travel < 0.15 ? travel / 0.15 : (1 - eased) * 1.4
                    let alpha = max(0, min(1, fade))
                    guard alpha > 0.01 else { continue }
                    let color = p.hueShift > 0.5 ? EOSTheme.accent : EOSTheme.accentSecondary
                    let rect = CGRect(x: x - p.size, y: y - p.size, width: p.size * 2, height: p.size * 2)
                    context.fill(Path(ellipseIn: rect), with: .color(color.opacity(alpha)))
                    context.fill(
                        Path(ellipseIn: rect.insetBy(dx: -p.size * 2, dy: -p.size * 2)),
                        with: .color(color.opacity(alpha * 0.18))
                    )
                }
            }
        }
    }
}

private struct LaunchShimmer: View {
    let active: Bool

    var body: some View {
        LinearGradient(
            colors: [.clear, .white.opacity(0.95), .clear],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(width: 70)
        .rotationEffect(.degrees(18))
        .offset(x: active ? 200 : -200)
        .blendMode(.plusLighter)
    }
}

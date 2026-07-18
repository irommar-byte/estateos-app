import SwiftUI
import AVFoundation

/// Cinematic launch splash matching iOS `AppleSplashScreen` (logo, radar line, rotating tagline, gold sun, door open).
struct AppleSplashView: View {
    var onFinish: () -> Void

    private static let line1 = "TWÓJ OSOBISTY RADAR"
    private static let taglines = [
        "Odkrywaj nieruchomości zanim zrobią to inni.",
        "Widzisz więcej. Decydujesz szybciej.",
        "Pierwszy widzisz. Pierwszy działasz.",
    ]
    private static let taglineKey = "EstateOS_splash_tagline_slot"
    private static let gold = Color(red: 212 / 255, green: 175 / 255, blue: 55 / 255)

    @State private var logoOpacity: Double = 0
    @State private var logoScale: CGFloat = 0.88
    @State private var breatheScale: CGFloat = 1.0
    @State private var logoGlow: Double = 0
    @State private var glowPulse: Double = 1.0
    @State private var line1Opacity: Double = 0
    @State private var line2Opacity: Double = 0
    @State private var sunProgress: CGFloat = 0
    @State private var contentOpacity: Double = 1
    @State private var leftDoor: CGFloat = 0
    @State private var rightDoor: CGFloat = 0
    @State private var tagline: String = taglines[0]
    @State private var particles: [SplashParticle] = []
    @State private var audioPlayer: AVAudioPlayer?

    var body: some View {
        GeometryReader { geo in
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.04, green: 0.04, blue: 0.05),
                        .black,
                        .black,
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                ForEach(particles) { p in
                    Circle()
                        .fill(p.warm ? Self.gold.opacity(p.opacity) : Color.white.opacity(p.opacity))
                        .frame(width: p.size, height: p.size)
                        .position(x: p.x + p.drift, y: p.y)
                        .blur(radius: p.warm ? 1.2 : 0.4)
                }

                // Ambient glow behind logo
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Self.gold.opacity(0.16 * logoGlow * glowPulse), .clear],
                            center: .center,
                            startRadius: 20,
                            endRadius: min(geo.size.width, geo.size.height) * 0.28
                        )
                    )
                    .frame(width: 520, height: 520)
                    .offset(y: -geo.size.height * 0.08)
                    .opacity(logoGlow)
                    .scaleEffect(breatheScale)

                VStack(spacing: 28) {
                    Image("EstateOSLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: min(geo.size.width * 0.52, 820))
                        .opacity(logoOpacity)
                        .scaleEffect(logoScale * breatheScale)
                        .shadow(color: Self.gold.opacity(0.18 * logoGlow * glowPulse), radius: 28, y: 6)

                    Text(Self.line1)
                        .font(.system(size: 28, weight: .medium, design: .default))
                        .tracking(6)
                        .foregroundStyle(.white.opacity(0.92))
                        .opacity(line1Opacity)

                    Text(tagline)
                        .font(.system(size: 22, weight: .regular, design: .default))
                        .foregroundStyle(.white.opacity(0.72))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: min(geo.size.width * 0.7, 900))
                        .opacity(line2Opacity)

                    // Gold “sun” band
                    Capsule(style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Self.gold.opacity(0),
                                    Self.gold.opacity(0.85),
                                    Self.gold.opacity(0),
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: min(geo.size.width * 0.55, 720) * sunProgress, height: 3)
                        .opacity(Double(sunProgress))
                        .padding(.top, 8)
                }
                .offset(y: -20)
                .opacity(contentOpacity)

                // Door panels
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(Color.black)
                        .overlay(alignment: .trailing) {
                            Rectangle()
                                .fill(Self.gold.opacity(0.55))
                                .frame(width: 3)
                        }
                        .frame(width: geo.size.width / 2)
                        .offset(x: leftDoor)

                    Rectangle()
                        .fill(Color.black)
                        .overlay(alignment: .leading) {
                            Rectangle()
                                .fill(Self.gold.opacity(0.55))
                                .frame(width: 3)
                        }
                        .frame(width: geo.size.width / 2)
                        .offset(x: rightDoor)
                }
                .ignoresSafeArea()
                .allowsHitTesting(false)
            }
            .onAppear {
                seedParticles(in: geo.size)
                prepareTagline()
                runSequence(in: geo.size)
            }
            .task(id: particles.isEmpty ? 0 : 1) {
                guard !particles.isEmpty else { return }
                let height = geo.size.height
                let width = geo.size.width
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 32_000_000)
                    withAnimation(.linear(duration: 0.032)) {
                        for i in particles.indices {
                            particles[i].y -= particles[i].warm ? 0.55 : 0.75
                            particles[i].drift = sin(Double(particles[i].id) + particles[i].y / 40) * (particles[i].warm ? 6 : 4)
                            if particles[i].y < -20 {
                                particles[i].y = height + 20
                                particles[i].x = CGFloat.random(in: 0...width)
                            }
                        }
                    }
                }
            }
        }
        .ignoresSafeArea()
    }

    private func prepareTagline() {
        let defaults = UserDefaults.standard
        let slot = defaults.integer(forKey: Self.taglineKey)
        let idx = abs(slot) % Self.taglines.count
        tagline = Self.taglines[idx]
        defaults.set((idx + 1) % Self.taglines.count, forKey: Self.taglineKey)
    }

    private func seedParticles(in size: CGSize) {
        particles = (0..<22).map { i in
            let warm = i % 5 == 0
            return SplashParticle(
                id: i,
                x: CGFloat.random(in: 0...size.width),
                y: CGFloat.random(in: 0...size.height),
                size: CGFloat.random(in: warm ? 2.5...5 : 1.5...3.5),
                opacity: warm ? Double.random(in: 0.18...0.4) : Double.random(in: 0.22...0.5),
                drift: 0,
                warm: warm
            )
        }
    }

    private func runSequence(in size: CGSize) {
        // Logo — a premium ease-out-expo curve reads noticeably smoother than plain easeOut.
        withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 2.1).delay(0.12)) {
            logoOpacity = 1
            logoScale = 1
        }
        withAnimation(.easeOut(duration: 1.7).delay(0.68)) {
            logoGlow = 1
        }
        // Lines (advanced relative to logo, matching iOS feel)
        withAnimation(.easeOut(duration: 0.85).delay(0.75)) {
            line1Opacity = 1
        }
        withAnimation(.easeOut(duration: 0.9).delay(1.05)) {
            line2Opacity = 1
        }
        // Sun band
        withAnimation(.easeInOut(duration: 2.2).delay(1.3)) {
            sunProgress = 1
        }
        // Once settled, keep the mark breathing so the hold never reads as frozen.
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_400_000_000)
            guard contentOpacity > 0 else { return }
            withAnimation(.easeInOut(duration: 2.3).repeatForever(autoreverses: true)) {
                breatheScale = 1.018
                glowPulse = 1.35
            }
        }

        // Fly out + door
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 3_750_000_000)
            withAnimation(.easeOut(duration: 0.38)) {
                contentOpacity = 0
                logoOpacity = 0
            }
            playDoorSound()
            try? await Task.sleep(nanoseconds: 40_000_000)
            withAnimation(.easeInOut(duration: 1.1)) {
                leftDoor = -size.width / 2 - 40
                rightDoor = size.width / 2 + 40
            }
            try? await Task.sleep(nanoseconds: 1_150_000_000)
            onFinish()
        }
    }

    private func playDoorSound() {
        guard let url = Bundle.main.url(forResource: "door", withExtension: "mp3") else { return }
        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.volume = 0.55
            player.prepareToPlay()
            player.play()
            audioPlayer = player
        } catch {
            // Silent fail — splash must never block on audio.
        }
    }
}

private struct SplashParticle: Identifiable {
    let id: Int
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat
    var opacity: Double
    var drift: CGFloat
    var warm: Bool
}

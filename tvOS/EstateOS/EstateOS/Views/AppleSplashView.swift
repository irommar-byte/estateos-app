import SwiftUI
import AVFoundation

/// Cinematic launch splash matching iOS `AppleSplashScreen`.
struct AppleSplashView: View {
    @EnvironmentObject private var app: AppModel
    var onFinish: () -> Void

    @State private var taglineBoot: (text: String, nextSlot: Int)?
    @State private var logoOpacity: Double = 0
    @State private var logoScale: CGFloat = 0.88
    @State private var breatheScale: CGFloat = 1.0
    @State private var logoGlow: Double = 0
    @State private var glowPulse: Double = 1.0
    @State private var line1Progress: Double = 0
    @State private var line2Progress: Double = 0
    @State private var sunProgress: CGFloat = 0
    @State private var contentOpacity: Double = 1
    @State private var line1Lift: CGFloat = 0
    @State private var lowerLift: CGFloat = 0
    @State private var skipOpacity: Double = 1
    @State private var doorProgress: CGFloat = 0
    @State private var doorEdgeGlow: Double = 0
    @State private var particles: [SplashParticle] = []
    @State private var audioPlayer: AVAudioPlayer?
    @State private var animationFinished = false
    @State private var skipped = false
    @State private var didFinish = false
    @State private var sequenceStart = Date()
    @State private var didStartSequence = false

    private var taglineText: String { taglineBoot?.text ?? SplashAnimationTimeline.taglines[0] }
    private var taglineLength: Int { taglineText.count }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                background

                // iOS: doors zIndex 8 — behind logo/text content.
                doorPanels(in: geo.size)
                    .zIndex(1)

                if !particles.isEmpty {
                    TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
                        SplashParticleField(
                            particles: particles,
                            elapsed: timeline.date.timeIntervalSince(sequenceStart)
                        )
                    }
                    .ignoresSafeArea()
                    .zIndex(2)
                }

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                SplashAnimationTimeline.gold.opacity(0.16 * logoGlow * glowPulse),
                                .clear,
                            ],
                            center: .center,
                            startRadius: 20,
                            endRadius: min(geo.size.width, geo.size.height) * 0.28
                        )
                    )
                    .frame(width: logoSize(in: geo.size) * 0.68, height: logoSize(in: geo.size) * 0.68)
                    .offset(y: -geo.size.height * 0.08)
                    .opacity(logoGlow)
                    .scaleEffect(breatheScale)
                    .zIndex(3)

                splashContent(in: geo.size)
                    .zIndex(10)
            }
            .onAppear {
                guard !didStartSequence else { return }
                didStartSequence = true
                sequenceStart = Date()
                let boot = SplashAnimationTimeline.loadTaglineBoot()
                taglineBoot = boot
                particles = SplashParticleField.makeParticles(
                    in: geo.size,
                    count: SplashAnimationTimeline.adaptiveParticleCount(screenHeight: geo.size.height)
                )
                runSequence(in: geo.size, nextSlot: boot.nextSlot)
            }
        }
        .ignoresSafeArea()
        .onExitCommand {
            guard !skipped else { return }
            skipped = true
            withAnimation(.easeOut(duration: 0.2)) { skipOpacity = 0 }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 200_000_000)
                finishSplash(nextSlot: taglineBoot?.nextSlot ?? 0)
            }
        }
        .onChange(of: app.isBootstrapping) { _, bootstrapping in
            if !bootstrapping, animationFinished {
                finishSplash(nextSlot: taglineBoot?.nextSlot ?? 0)
            }
        }
    }

    private func logoSize(in size: CGSize) -> CGFloat {
        min(max(size.width * 0.42, 320), size.height * 0.48, 820)
    }

    private var background: some View {
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
            LinearGradient(
                colors: [
                    Color.white.opacity(0.045),
                    Color.white.opacity(0),
                    Color.black.opacity(0.35),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .ignoresSafeArea()
    }

    @ViewBuilder
    private func splashContent(in size: CGSize) -> some View {
        VStack(spacing: 28) {
            Image("EstateOSLogo")
                .resizable()
                .scaledToFit()
                .frame(width: logoSize(in: size), height: logoSize(in: size))
                .opacity(logoOpacity)
                .scaleEffect(logoScale * breatheScale)
                .shadow(
                    color: SplashAnimationTimeline.gold.opacity(0.18 * logoGlow * glowPulse),
                    radius: 28,
                    y: 6
                )
                .offset(y: line1Lift)

            ZStack {
                VStack(spacing: 14) {
                    SplashCharRevealView(
                        text: SplashAnimationTimeline.line1,
                        progress: line1Progress,
                        font: .system(size: 28, weight: .medium),
                        tracking: 6,
                        foreground: .white.opacity(0.92)
                    )

                    SplashTaglineRevealView(text: taglineText, progress: line2Progress)
                }
                .offset(y: lowerLift)

                sunSweepBand(width: size.width)
                    .allowsHitTesting(false)
            }
            .padding(.vertical, 14)
        }
        .offset(y: -20)
        .opacity(contentOpacity * skipOpacity)
    }

    @ViewBuilder
    private func sunSweepBand(width: CGFloat) -> some View {
        let travel = width * 0.52
        let x = -travel + CGFloat(sunProgress) * travel * 2
        let bandOpacity = sunProgress <= 0 ? 0.0 : min(1.0, Double(min(sunProgress / 0.08, (1 - sunProgress) / 0.08 + 1)))

        ZStack {
            LinearGradient(
                colors: [
                    .clear,
                    SplashAnimationTimeline.gold.opacity(0.2),
                    SplashAnimationTimeline.gold.opacity(0.55),
                    Color(red: 0.96, green: 0.82, blue: 0.59),
                    SplashAnimationTimeline.gold.opacity(0.62),
                    SplashAnimationTimeline.gold.opacity(0.22),
                    .clear,
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(width: width * 0.3, height: 120)

            LinearGradient(
                colors: [
                    .clear,
                    SplashAnimationTimeline.gold.opacity(0.1),
                    SplashAnimationTimeline.gold.opacity(0.26),
                    SplashAnimationTimeline.gold.opacity(0.42),
                    SplashAnimationTimeline.gold.opacity(0.16),
                    .clear,
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(width: width * 0.45, height: 130)
            .blendMode(.screen)
        }
        .offset(x: x)
        .opacity(bandOpacity)
    }

    @ViewBuilder
    private func doorPanels(in size: CGSize) -> some View {
        let half = size.width / 2
        let offset = doorProgress * (half + 50)
        ZStack {
            HStack(spacing: 0) {
                Rectangle()
                    .fill(Color.black)
                    .overlay(alignment: .trailing) {
                        Rectangle()
                            .fill(SplashAnimationTimeline.gold.opacity(0.55 * doorEdgeGlow))
                            .frame(width: 3)
                    }
                    .frame(width: half)
                    .offset(x: -offset)

                Rectangle()
                    .fill(Color.black)
                    .overlay(alignment: .leading) {
                        Rectangle()
                            .fill(SplashAnimationTimeline.gold.opacity(0.55 * doorEdgeGlow))
                            .frame(width: 3)
                    }
                    .frame(width: half)
                    .offset(x: offset)
            }
            .ignoresSafeArea()

            Rectangle()
                .fill(SplashAnimationTimeline.gold.opacity(0.85 * doorEdgeGlow))
                .frame(width: 4)
                .blur(radius: 2)
                .opacity(doorEdgeGlow)
        }
        .allowsHitTesting(false)
    }

    private func runSequence(in size: CGSize, nextSlot: Int) {
        let tl = SplashAnimationTimeline.self
        let tagLen = taglineLength

        withAnimation(.timingCurve(0.11, 0.008, 0.09, 1, duration: tl.seconds(tl.logoLightMs)).delay(tl.seconds(tl.logoStartMs))) {
            logoOpacity = 1
        }

        withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: tl.seconds(tl.logoLightMs * 0.88)).delay(tl.seconds(tl.logoStartMs))) {
            logoScale = 0.994
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64((tl.logoStartMs + tl.logoLightMs * 0.88) * 1_000_000))
            guard !skipped else { return }
            withAnimation(.spring(response: 0.55, dampingFraction: 0.72)) {
                logoScale = 1.0
            }
        }

        withAnimation(.easeOut(duration: tl.seconds(tl.logoLightMs * 0.75)).delay(tl.seconds(tl.logoStartMs + 600))) {
            logoGlow = 1
        }

        let line1Delay = tl.seconds(tl.line1StartMs())
        let line1Dur = tl.seconds(tl.line1DurationMs())
        withAnimation(.timingCurve(0.25, 0.1, 0.15, 1, duration: line1Dur).delay(line1Delay)) {
            line1Progress = 1
        }

        let line2Delay = tl.seconds(tl.line2StartMs(taglineLength: tagLen))
        let line2Dur = tl.seconds(tl.line2DurationMs(taglineLength: tagLen))
        withAnimation(.timingCurve(0.25, 0.1, 0.15, 1, duration: line2Dur).delay(line2Delay)) {
            line2Progress = 1
        }

        let sunDelay = tl.seconds(tl.sunStartMs(taglineLength: tagLen))
        withAnimation(.timingCurve(0.4, 0.02, 0.18, 1, duration: tl.seconds(tl.sunDurationMs)).delay(sunDelay)) {
            sunProgress = 1
        }

        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(tl.breatheStartMs * 1_000_000))
            guard !skipped, contentOpacity > 0 else { return }
            withAnimation(.easeInOut(duration: 2.3).repeatForever(autoreverses: true)) {
                breatheScale = 1.018
                glowPulse = 1.35
            }
        }

        let flyDelay = tl.flyOutStartMs(taglineLength: tagLen)
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(flyDelay * 1_000_000))
            guard !skipped else { return }
            withAnimation(.timingCurve(0.34, 0, 0.22, 1, duration: tl.seconds(tl.flyOutMs))) {
                contentOpacity = 0
                logoOpacity = 0
                line1Lift = -size.height * 0.52
                lowerLift = size.height * 0.52
            }

            try? await Task.sleep(nanoseconds: UInt64(tl.flyOutMs * 1_000_000))
            guard !skipped else { return }

            // Keep doors closed until the catalog is on screen — never reveal an empty showroom.
            await waitUntilCatalogReady()
            guard !skipped else { return }

            playDoorSound()
            try? await Task.sleep(nanoseconds: UInt64(tl.doorSoundLeadMs * 1_000_000))
            guard !skipped else { return }

            withAnimation(.linear(duration: 0.075)) { doorEdgeGlow = 1 }
            try? await Task.sleep(nanoseconds: 75_000_000)
            withAnimation(.easeInOut(duration: 0.085)) { doorEdgeGlow = 0.74 }

            withAnimation(.timingCurve(0.55, 0, 0.05, 1, duration: tl.seconds(tl.doorDurationMs))) {
                doorProgress = 1
            }
            withAnimation(.easeOut(duration: tl.seconds(tl.doorDurationMs * 0.62))) {
                doorEdgeGlow = 0
            }

            try? await Task.sleep(nanoseconds: UInt64(tl.doorDurationMs * 1_000_000))
            guard !skipped else { return }
            animationFinished = true
            SplashAnimationTimeline.persistNextTaglineSlot(nextSlot)
            finishSplash(nextSlot: nextSlot)
        }
    }

    private var catalogReady: Bool {
        !app.offers.isEmpty || !app.cars.isEmpty || !app.isBootstrapping
    }

    private func waitUntilCatalogReady() async {
        let cap = SplashAnimationTimeline.catalogReadyCapMs
        let start = Date()
        while !catalogReady && !skipped {
            if Date().timeIntervalSince(start) * 1000 >= cap { break }
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
    }

    private func finishSplash(nextSlot: Int) {
        guard !didFinish else { return }
        didFinish = true
        SplashAnimationTimeline.persistNextTaglineSlot(nextSlot)
        onFinish()
    }

    private func playDoorSound() {
        let url = Bundle.main.url(forResource: "door", withExtension: "mp3")
            ?? Bundle.main.url(forResource: "door", withExtension: "mp3", subdirectory: "Sounds")
        guard let url else { return }
        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.volume = SplashAnimationTimeline.doorSoundVolume
            player.prepareToPlay()
            player.play()
            audioPlayer = player
        } catch {}
    }
}

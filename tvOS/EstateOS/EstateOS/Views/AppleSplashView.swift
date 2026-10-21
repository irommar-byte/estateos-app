import SwiftUI
import AVFoundation

/// Cinematic launch splash — 1:1 with iOS `AppleSplashScreen.tsx`.
///
/// Sequence: logo light-up (opacity + scale breath + gold halo) → line 1 and the rotating tagline
/// reveal letter by letter → one golden band sweeps across the text → logo flies up, text flies
/// down → golden seam flashes and the black doors slide apart, revealing the showroom that is
/// already rendered underneath (RootView keeps HomeView mounted behind the splash).
///
/// tvOS-only additions: the doors wait until the catalog is loaded (never reveal an empty
/// showroom) and MENU skips the animation.
struct AppleSplashView: View {
    @EnvironmentObject private var app: AppModel
    /// Fires the moment the doors start to open — RootView starts the showroom reveal here.
    var onDoorsOpen: () -> Void = {}
    var onFinish: () -> Void

    @State private var taglineBoot: (text: String, nextSlot: Int)?
    @State private var logoOpacity: Double = 0
    @State private var logoScale: CGFloat = 0.88
    @State private var logoGlow: Double = 0
    @State private var line1Progress: Double = 0
    @State private var line2Progress: Double = 0
    @State private var sunProgress: CGFloat = 0
    @State private var exitLift: CGFloat = 0
    @State private var doorProgress: CGFloat = 0
    @State private var doorEdgeGlow: Double = 0
    @State private var particlesOpacity: Double = 1
    @State private var particles: [SplashParticle] = []
    @State private var audioPlayer: AVAudioPlayer?
    @State private var skipped = false
    @State private var didFinish = false
    @State private var didOpenDoors = false
    @State private var sequenceStart = Date()
    @State private var didStartSequence = false

    private typealias TL = SplashAnimationTimeline

    private var taglineText: String { taglineBoot?.text ?? TL.taglines[0] }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                doorPanels(in: geo.size)
                    .zIndex(1)

                if !particles.isEmpty {
                    TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
                        SplashParticleField(
                            particles: particles,
                            elapsed: timeline.date.timeIntervalSince(sequenceStart)
                        )
                    }
                    .opacity(particlesOpacity)
                    .ignoresSafeArea()
                    .zIndex(2)
                }

                splashContent(in: geo.size)
                    .zIndex(10)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .onAppear {
                guard !didStartSequence else { return }
                didStartSequence = true
                sequenceStart = Date()
                let boot = TL.loadTaglineBoot()
                taglineBoot = boot
                particles = SplashParticleField.makeParticles(
                    in: geo.size,
                    count: TL.adaptiveParticleCount(screenHeight: geo.size.height)
                )
                runSequence(in: geo.size, nextSlot: boot.nextSlot)
            }
        }
        .ignoresSafeArea()
        .onExitCommand { skip() }
    }

    // MARK: - Layout

    private func logoSize(in size: CGSize) -> CGFloat {
        min(max(size.width * 0.42, 320), size.height * 0.48, 820)
    }

    @ViewBuilder
    private func splashContent(in size: CGSize) -> some View {
        let logo = logoSize(in: size)
        VStack(spacing: 0) {
            ZStack {
                // Ambient glow ring behind the logo (iOS `logoGlowRing`).
                Circle()
                    .stroke(TL.gold.opacity(0.12), lineWidth: 1)
                    .frame(width: logo * 0.68, height: logo * 0.68)
                    .shadow(color: TL.gold.opacity(0.72), radius: 56)
                    .opacity(Self.glowRingOpacity(logoGlow))
                    .scaleEffect(0.55 + 0.47 * logoGlow)

                Image("EstateOSLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: logo, height: logo)
                    .opacity(logoOpacity)
                    .scaleEffect(logoScale)
            }
            .offset(y: -exitLift * size.height * 0.52)

            VStack(spacing: 14) {
                SplashCharRevealView(text: TL.line1, progress: line1Progress)
                SplashTaglineRevealView(text: taglineText, progress: line2Progress)
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 12)
            .overlay {
                SplashSunBand(progress: sunProgress, screenWidth: size.width)
            }
            .padding(.top, 26)
            .offset(y: exitLift * size.height * 0.52)
        }
        .frame(width: size.width, height: size.height)
        .allowsHitTesting(false)
    }

    /// iOS: interpolate(logoGlow, [0, 0.4, 1], [0, 0.6, 0.82]).
    private static func glowRingOpacity(_ g: Double) -> Double {
        if g <= 0 { return 0 }
        if g < 0.4 { return 0.6 * g / 0.4 }
        return 0.6 + 0.22 * min(1, (g - 0.4) / 0.6)
    }

    @ViewBuilder
    private func doorPanels(in size: CGSize) -> some View {
        let half = size.width / 2
        let offset = doorProgress * (half + 50)
        HStack(spacing: 0) {
            ZStack(alignment: .trailing) {
                Color.black
                LinearGradient(
                    stops: [
                        .init(color: .white.opacity(0.07), location: 0),
                        .init(color: .white.opacity(0.015), location: 0.45),
                        .init(color: .black.opacity(0.38), location: 1),
                    ],
                    startPoint: UnitPoint(x: 0.06, y: 0),
                    endPoint: .bottomTrailing
                )
                doorSeam
            }
            .frame(width: half)
            .offset(x: -offset)

            ZStack(alignment: .leading) {
                Color.black
                LinearGradient(
                    stops: [
                        .init(color: .black.opacity(0.38), location: 0),
                        .init(color: .white.opacity(0.015), location: 0.55),
                        .init(color: .white.opacity(0.07), location: 1),
                    ],
                    startPoint: .bottomLeading,
                    endPoint: UnitPoint(x: 0.94, y: 0)
                )
                doorSeam
            }
            .frame(width: half)
            .offset(x: offset)
        }
        .frame(width: size.width, height: size.height)
        .allowsHitTesting(false)
    }

    /// Golden crack on the inner door edge (iOS `doorInnerEdgeLeft/Right`).
    private var doorSeam: some View {
        Rectangle()
            .fill(Color(red: 212 / 255, green: 175 / 255, blue: 55 / 255))
            .frame(width: 2.5)
            .shadow(color: TL.gold, radius: 12)
            .opacity(doorEdgeGlow)
    }

    // MARK: - Sequence

    private func runSequence(in size: CGSize, nextSlot: Int) {
        let tagLen = taglineText.count

        // 1. Logo opacity — slow luxury reveal.
        withAnimation(.timingCurve(0.11, 0.008, 0.09, 1, duration: TL.seconds(TL.logoLightMs)).delay(TL.seconds(TL.logoStartMs))) {
            logoOpacity = 1
        }
        // 2. Logo scale 0.88 → 0.994, then a soft spring to 1.0.
        withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: TL.seconds(TL.logoLightMs * 0.88)).delay(TL.seconds(TL.logoStartMs))) {
            logoScale = 0.994
        }
        after(TL.logoStartMs + TL.logoLightMs * 0.88) {
            withAnimation(.interpolatingSpring(mass: 0.6, stiffness: 90, damping: 14)) { logoScale = 1 }
        }
        // 3. Gold halo ring.
        withAnimation(.easeOut(duration: TL.seconds(TL.logoLightMs * 0.75)).delay(TL.seconds(TL.logoStartMs + 600))) {
            logoGlow = 1
        }
        // 4–5. Letter-by-letter lines.
        withAnimation(.timingCurve(0.25, 0.1, 0.15, 1, duration: TL.seconds(TL.line1DurationMs())).delay(TL.seconds(TL.line1StartMs()))) {
            line1Progress = 1
        }
        withAnimation(.timingCurve(0.25, 0.1, 0.15, 1, duration: TL.seconds(TL.line2DurationMs(taglineLength: tagLen))).delay(TL.seconds(TL.line2StartMs(taglineLength: tagLen)))) {
            line2Progress = 1
        }
        // 6. Golden band.
        withAnimation(.timingCurve(0.4, 0.02, 0.18, 1, duration: TL.seconds(TL.sunDurationMs)).delay(TL.seconds(TL.sunStartMs(taglineLength: tagLen)))) {
            sunProgress = 1
        }

        // 7. Fly-out: logo up, text down.
        let flyOutAt = TL.flyOutStartMs(taglineLength: tagLen)
        after(flyOutAt) {
            withAnimation(.timingCurve(0.34, 0, 0.22, 1, duration: TL.seconds(TL.flyOutMs))) {
                exitLift = 1
            }
        }

        // 8–9. Doors.
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64((flyOutAt + TL.flyOutMs - TL.doorSoundLeadMs) * 1_000_000))
            guard !skipped else { return }
            await waitUntilCatalogReady()
            guard !skipped else { return }

            playDoorSound()
            try? await Task.sleep(nanoseconds: UInt64(TL.doorSoundLeadMs * 1_000_000))
            guard !skipped else { return }
            openDoors()

            try? await Task.sleep(nanoseconds: UInt64(TL.doorDurationMs * 1_000_000))
            guard !skipped else { return }
            finishSplash(nextSlot: nextSlot)
        }
    }

    private func openDoors() {
        guard !didOpenDoors else { return }
        didOpenDoors = true
        onDoorsOpen()

        // Seam micro-pulse: 1 → 0.74 → long fade.
        withAnimation(.easeOut(duration: 0.075)) { doorEdgeGlow = 1 }
        after(75) {
            withAnimation(.easeInOut(duration: 0.085)) { doorEdgeGlow = 0.74 }
        }
        after(160) {
            withAnimation(.easeOut(duration: TL.seconds(TL.doorDurationMs * 0.62))) { doorEdgeGlow = 0 }
        }
        withAnimation(.timingCurve(0.55, 0, 0.05, 1, duration: TL.seconds(TL.doorDurationMs))) {
            doorProgress = 1
        }
        withAnimation(.easeOut(duration: TL.seconds(TL.doorDurationMs * 0.7))) {
            particlesOpacity = 0
        }
    }

    private func after(_ ms: Double, _ body: @escaping @MainActor () -> Void) {
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(max(0, ms) * 1_000_000))
            guard !skipped else { return }
            body()
        }
    }

    private var catalogReady: Bool {
        !app.offers.isEmpty || !app.cars.isEmpty || !app.isBootstrapping
    }

    private func waitUntilCatalogReady() async {
        let start = Date()
        while !catalogReady && !skipped {
            if Date().timeIntervalSince(start) * 1000 >= TL.catalogReadyCapMs { break }
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
    }

    private func skip() {
        guard !skipped, !didFinish else { return }
        skipped = true
        onDoorsOpen()
        withAnimation(.easeOut(duration: 0.35)) {
            exitLift = 1
            doorProgress = 1
            particlesOpacity = 0
            logoOpacity = 0
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 350_000_000)
            finishSplash(nextSlot: taglineBoot?.nextSlot ?? 0)
        }
    }

    private func finishSplash(nextSlot: Int) {
        guard !didFinish else { return }
        didFinish = true
        TL.persistNextTaglineSlot(nextSlot)
        onFinish()
    }

    private func playDoorSound() {
        let url = Bundle.main.url(forResource: "door", withExtension: "mp3")
            ?? Bundle.main.url(forResource: "door", withExtension: "mp3", subdirectory: "Sounds")
        guard let url else { return }
        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.volume = TL.doorSoundVolume
            player.prepareToPlay()
            player.play()
            audioPlayer = player
        } catch {}
    }
}

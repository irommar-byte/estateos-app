import QuartzCore
import SwiftUI
import UIKit

struct MusicOrientationSync: ViewModifier {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences
    @EnvironmentObject private var video: VideoAppModel
    @State private var showLandscape = false

    func body(content: Content) -> some View {
        content
            .onAppear { sync() }
            .onChange(of: app.playback.engine != nil) { _, _ in sync() }
            .onChange(of: video.isPlayerPresented) { _, _ in sync() }
            .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
                sync()
            }
            .fullScreenCover(isPresented: $showLandscape) {
                LandscapeNowPlayingView()
                    .environmentObject(app)
                    .environmentObject(ui)
                    .presentationBackground(.black)
                    .ignoresSafeArea()
            }
    }

    private func sync() {
        let musicActive = app.playback.engine != nil
        let videoActive = video.isPlayerPresented
        OrientationLock.shared.syncMask(
            musicSessionActive: musicActive && !videoActive,
            videoSessionActive: videoActive
        )
        let phoneLandscape = UIDevice.current.userInterfaceIdiom != .pad
            && UIDevice.current.orientation.isLandscape
        showLandscape = musicActive && !videoActive && phoneLandscape
    }
}

struct LandscapeNowPlayingView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let engine = app.playback.engine, let track = engine.currentTrack {
                content(engine: engine, track: track)
            }
        }
        .statusBarHidden(true)
        .ignoresSafeArea()
    }

    @ViewBuilder
    private func content(engine: MusicPlaybackEngine, track: MusicPlaybackTrack) -> some View {
        let preset = ui.playerMixerPowered ? ui.playerVisualPreset : .cover
        let policy = PlayerVisualPolicy.resolve(
            preset: preset == .off ? .cover : preset,
            intensity: ui.playerEffectsIntensity * ui.playerSensitivity,
            strobeEnabled: ui.playerStrobeEnabled || preset == .strobe,
            autoPerformance: ui.playerAutoPerformance,
            reduceMotion: reduceMotion,
            lowPower: ProcessInfo.processInfo.isLowPowerModeEnabled,
            thermal: ProcessInfo.processInfo.thermalState
        )
        GeometryReader { geo in
            let stageKind: LandscapeStageKind = {
                if preset == .vinyl { return .vinyl }
                if preset == .spectrum { return .spectrum }
                return .cover
            }()
            ZStack {
                LandscapeFullscreenStage(
                    engine: engine,
                    track: track,
                    policy: policy,
                    canvas: geo.size,
                    kind: stageKind,
                    strobe: policy.allowStrobe,
                    bandCount: ui.playerSpectrumBandCount >= 32 ? 32 : 24,
                    intensity: policy.intensityScale,
                    safeLeading: geo.safeAreaInsets.leading,
                    safeTrailing: geo.safeAreaInsets.trailing
                )
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 40)
                    .onEnded { value in
                        if value.translation.width < -70 {
                            Task { await engine.skipNext() }
                        } else if value.translation.width > 70 {
                            Task { await engine.skipPrevious() }
                        }
                    }
            )

            VStack {
                HStack {
                    Button {
                        app.minimizePlayer()
                    } label: {
                        Image(systemName: "chevron.down")
                            .font(.body.weight(.bold))
                            .foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(.ultraThinMaterial, in: Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Zwiń odtwarzacz")
                    Spacer()
                }
                .padding(.top, 16)
                .padding(.leading, 20)
                Spacer()
                HStack(spacing: 22) {
                    Button { Task { await engine.skipPrevious() } } label: {
                        Image(systemName: "backward.fill").font(.title2)
                    }
                    Button { engine.togglePlayPause() } label: {
                        Image(systemName: engine.isPlaying ? "pause.fill" : "play.fill").font(.largeTitle)
                    }
                    Button { Task { await engine.skipNext() } } label: {
                        Image(systemName: "forward.fill").font(.title2)
                    }
                }
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.55), radius: 8)
                .padding(.bottom, 16)
                Text(track.title)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .shadow(color: .black.opacity(0.7), radius: 6)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 14)
            }
        }
        .ignoresSafeArea()
    }
}

private enum LandscapeStageKind {
    case cover, vinyl, spectrum
}

private struct LandscapeFullscreenStage: View {
    @ObservedObject var engine: MusicPlaybackEngine
    let track: MusicPlaybackTrack
    let policy: PlayerVisualPolicy
    let canvas: CGSize
    let kind: LandscapeStageKind
    let strobe: Bool
    let bandCount: Int
    let intensity: Double
    let safeLeading: CGFloat
    let safeTrailing: CGFloat
    @StateObject private var driver = CoverBeatPulseDriver()

    var body: some View {
        let pulse = driver.pulse
        let live = engine.isPlaying && policy.enabled && policy.analyzerFPS > 0.5
        ZStack {
            Color.black
            LandscapeClubWings(beat: pulse.beat, rytm: pulse.rytm, strobe: strobe && live)
            switch kind {
            case .vinyl:
                vinylStage(pulse: pulse, live: live)
            case .spectrum:
                spectrumStage(pulse: pulse, live: live)
            case .cover:
                coverStage(pulse: pulse, live: live)
            }
        }
        .frame(width: canvas.width, height: canvas.height)
        .onAppear {
            driver.start(
                visualizer: engine.visualizer,
                isPlaying: live,
                fps: policy.analyzerFPS
            )
        }
        .onChange(of: live) { _, playing in
            driver.start(visualizer: engine.visualizer, isPlaying: playing, fps: policy.analyzerFPS)
        }
        .onDisappear { driver.stop() }
    }

    private var islandInset: CGFloat {
        PlayerVisualMetrics.landscapeSideInset(safeLeading: safeLeading, safeTrailing: safeTrailing)
    }

    private func coverStage(pulse: CoverBeatPulseDriver.Pulse, live: Bool) -> some View {
        let art = PlayerVisualMetrics.landscapeDiscSize(canvas: canvas)
        return HStack(spacing: PlayerVisualMetrics.landscapeLampGap) {
            CoverBeatLEDBank(
                label: "BEAT",
                color: ProMixerDeckView.labelGreen,
                intensity: pulse.beat
            )
            coverDisc(art: art, pulse: pulse, live: live)
            CoverBeatLEDBank(
                label: "RYTM",
                color: ProMixerDeckView.labelAmber,
                intensity: pulse.rytm
            )
        }
        .padding(.horizontal, islandInset)
        .frame(width: canvas.width, height: canvas.height)
    }

    private func spectrumStage(pulse: CoverBeatPulseDriver.Pulse, live: Bool) -> some View {
        let art = min(148, canvas.height * 0.42)
        return HStack(spacing: PlayerVisualMetrics.landscapeLampGap) {
            CoverBeatLEDBank(
                label: "BEAT",
                color: ProMixerDeckView.labelGreen,
                intensity: pulse.beat
            )
            VStack(spacing: 12) {
                ArtworkImage(
                    url: track.artworkURL,
                    size: art,
                    cornerRadius: 12,
                    allowAnimated: false,
                    fallbackImage: engine.displayArtwork(for: track),
                    identity: track.id,
                    placeholderTitle: track.title,
                    placeholderSubtitle: track.artist
                )
                .frame(width: art, height: art)
                WinampSpectrumHost(
                    visualizer: engine.visualizer,
                    isPlaying: live,
                    intensity: max(0.85, intensity),
                    bandCount: bandCount,
                    compact: false,
                    lightAppearance: false
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.bottom, 78)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            CoverBeatLEDBank(
                label: "RYTM",
                color: ProMixerDeckView.labelAmber,
                intensity: pulse.rytm
            )
        }
        .padding(.horizontal, islandInset)
        .padding(.vertical, 12)
        .frame(width: canvas.width, height: canvas.height)
    }

    private func coverDisc(art: CGFloat, pulse: CoverBeatPulseDriver.Pulse, live: Bool) -> some View {
        ZStack {
            ArtworkImage(
                url: track.artworkURL,
                size: art,
                cornerRadius: 10,
                allowAnimated: true,
                fallbackImage: engine.displayArtwork(for: track),
                identity: track.id,
                placeholderTitle: track.title,
                placeholderSubtitle: track.artist
            )
            LandscapeBlackFieldFlash(pulse: pulse, strobe: strobe && live)
                .frame(width: art, height: art)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .allowsHitTesting(false)
        }
        .frame(width: art, height: art)
    }

    private func vinylStage(pulse: CoverBeatPulseDriver.Pulse, live: Bool) -> some View {
        let disc = PlayerVisualMetrics.landscapeDiscSize(canvas: canvas)
        return HStack(spacing: PlayerVisualMetrics.landscapeLampGap) {
            CoverBeatLEDBank(
                label: "BEAT",
                color: ProMixerDeckView.labelGreen,
                intensity: pulse.beat
            )
            vinylDisc(disc: disc, pulse: pulse, live: live)
            CoverBeatLEDBank(
                label: "RYTM",
                color: ProMixerDeckView.labelAmber,
                intensity: pulse.rytm
            )
        }
        .padding(.horizontal, islandInset)
        .frame(width: canvas.width, height: canvas.height)
    }

    private func vinylDisc(disc: CGFloat, pulse: CoverBeatPulseDriver.Pulse, live: Bool) -> some View {
        ZStack {
            VinylPulseRings(size: disc, pulse: pulse)
            VinylCASpin(isSpinning: live && policy.analyzerFPS > 0.5) {
                ArtworkImage(
                    url: track.artworkURL,
                    size: disc,
                    cornerRadius: disc,
                    circleClip: true,
                    fallbackImage: engine.displayArtwork(for: track),
                    identity: track.id,
                    placeholderTitle: track.title,
                    placeholderSubtitle: track.artist
                )
                .overlay {
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.55),
                                    Color.white.opacity(0.08)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 2.2
                        )
                }
                .overlay {
                    Circle()
                        .stroke(Color.white.opacity(0.28), lineWidth: 1.6)
                        .frame(width: disc * 0.30, height: disc * 0.30)
                }
                .overlay {
                    Circle()
                        .fill(Color.black.opacity(0.90))
                        .frame(width: 22, height: 22)
                        .overlay {
                            Circle().fill(Color.white.opacity(0.22)).frame(width: 7, height: 7)
                        }
                }
            }
            .frame(width: disc, height: disc)
            LandscapeBlackFieldFlash(pulse: pulse, strobe: strobe && live)
                .frame(width: disc, height: disc)
                .clipShape(Circle())
                .allowsHitTesting(false)
        }
        .frame(width: disc, height: disc)
    }
}

/// Full-height club wings: green on the beat, amber on the rhythm.
/// One plusLighter pass, no blur — the black gutters become the strobe.
private struct LandscapeClubWings: View {
    var beat: Double
    var rytm: Double
    var strobe: Bool

    var body: some View {
        let punch = strobe ? 1.0 : 0.62
        ZStack {
            HStack(spacing: 0) {
                LinearGradient(
                    colors: [
                        ProMixerDeckView.labelGreen.opacity(min(0.96, beat * punch)),
                        ProMixerDeckView.labelGreen.opacity(beat * 0.42 * punch),
                        .clear
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                LinearGradient(
                    colors: [
                        .clear,
                        ProMixerDeckView.labelAmber.opacity(rytm * 0.42 * punch),
                        ProMixerDeckView.labelAmber.opacity(min(0.96, rytm * punch))
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            }
            HStack(spacing: 0) {
                Rectangle()
                    .fill(Color.white.opacity(strobe ? beat * 0.72 : 0))
                    .frame(maxWidth: strobe ? 36 : 0)
                Spacer(minLength: 0)
                Rectangle()
                    .fill(Color.white.opacity(strobe ? rytm * 0.68 : 0))
                    .frame(maxWidth: strobe ? 36 : 0)
            }
        }
        .blendMode(.plusLighter)
        .allowsHitTesting(false)
    }
}

private struct LandscapeBlackFieldFlash: View {
    let pulse: CoverBeatPulseDriver.Pulse
    let strobe: Bool

    var body: some View {
        let hit = max(pulse.beat, pulse.rytm * 0.85, pulse.bass * 0.45)
        let punch = strobe ? 0.78 : 0.14
        ZStack {
            Color.white.opacity(hit * punch)
            RadialGradient(
                colors: [
                    Color.white.opacity((strobe ? 0.88 : 0.20) * hit),
                    ProMixerDeckView.labelGreen.opacity(pulse.beat * (strobe ? 0.62 : 0.22)),
                    ProMixerDeckView.labelAmber.opacity(pulse.rytm * (strobe ? 0.52 : 0.18)),
                    .clear
                ],
                center: .center,
                startRadius: 8,
                endRadius: 420
            )
        }
        .blendMode(.plusLighter)
        .allowsHitTesting(false)
    }
}

struct VinylPulseRings: View {
    let size: CGFloat
    let pulse: CoverBeatPulseDriver.Pulse

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(
                    Color.white.opacity(0.10 + pulse.treble * 0.42),
                    lineWidth: 1.1 + pulse.treble * 2.4
                )
                .frame(width: size * 1.28, height: size * 1.28)
            Circle()
                .strokeBorder(
                    ProMixerDeckView.labelGreen.opacity(0.20 + pulse.beat * 0.70),
                    lineWidth: 3 + pulse.beat * 7
                )
                .frame(width: size * 1.10, height: size * 1.10)
            Circle()
                .strokeBorder(
                    ProMixerDeckView.labelAmber.opacity(0.16 + pulse.rytm * 0.64),
                    lineWidth: 2.4 + pulse.rytm * 6
                )
                .frame(width: size * 1.20, height: size * 1.20)
        }
        .allowsHitTesting(false)
    }
}

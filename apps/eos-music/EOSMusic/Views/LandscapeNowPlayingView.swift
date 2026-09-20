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
        showLandscape = musicActive && !videoActive && UIDevice.current.orientation.isLandscape
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
            strobeEnabled: false,
            autoPerformance: ui.playerAutoPerformance,
            reduceMotion: reduceMotion,
            lowPower: ProcessInfo.processInfo.isLowPowerModeEnabled,
            thermal: ProcessInfo.processInfo.thermalState
        )
        GeometryReader { geo in
            let vinyl = preset == .vinyl
            ZStack {
                LandscapeFullscreenStage(
                    engine: engine,
                    track: track,
                    policy: policy,
                    canvas: geo.size,
                    vinyl: vinyl
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

private struct LandscapeFullscreenStage: View {
    @ObservedObject var engine: MusicPlaybackEngine
    let track: MusicPlaybackTrack
    let policy: PlayerVisualPolicy
    let canvas: CGSize
    let vinyl: Bool
    @StateObject private var driver = CoverBeatPulseDriver()

    var body: some View {
        let pulse = driver.pulse
        let live = engine.isPlaying && policy.enabled && policy.analyzerFPS > 0.5
        ZStack {
            Color.black
            if vinyl {
                vinylStage(pulse: pulse, live: live)
            } else {
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

    private func coverStage(pulse: CoverBeatPulseDriver.Pulse, live: Bool) -> some View {
        let fill = max(canvas.width, canvas.height)
        return ZStack {
            ArtworkImage(
                url: track.artworkURL,
                size: fill,
                cornerRadius: 0,
                allowAnimated: true,
                fallbackImage: engine.displayArtwork
            )
            .frame(width: canvas.width, height: canvas.height)
            .clipped()
            .scaleEffect(1 + CGFloat(pulse.bass) * 0.014)
            .brightness(pulse.beat * 0.04)

            HStack(spacing: 0) {
                CoverBeatWash(
                    flash: pulse.beat,
                    accent: ProMixerDeckView.labelGreen,
                    isLeft: true,
                    drive: pulse.drive,
                    cornerRadius: 0,
                    isLight: false
                )
                CoverBeatWash(
                    flash: pulse.rytm,
                    accent: ProMixerDeckView.labelAmber,
                    isLeft: false,
                    drive: pulse.drive,
                    cornerRadius: 0,
                    isLight: false
                )
            }
            .frame(width: canvas.width, height: canvas.height)
            .blendMode(.plusLighter)
            .allowsHitTesting(false)

            HStack(spacing: 0) {
                ProMixerDeckView.labelGreen.opacity(pulse.beat * 0.28)
                ProMixerDeckView.labelAmber.opacity(pulse.rytm * 0.24)
            }
            .frame(width: canvas.width, height: canvas.height)
            .blendMode(.plusLighter)
            .allowsHitTesting(false)

            HStack {
                CoverBeatLEDBank(
                    label: "BEAT",
                    color: ProMixerDeckView.labelGreen,
                    intensity: pulse.beat
                )
                .padding(.leading, 14)
                Spacer(minLength: 0)
                CoverBeatLEDBank(
                    label: "RYTM",
                    color: ProMixerDeckView.labelAmber,
                    intensity: pulse.rytm
                )
                .padding(.trailing, 14)
            }
            .frame(width: canvas.width, height: canvas.height)
        }
        .frame(width: canvas.width, height: canvas.height)
        .clipped()
        .animation(.easeOut(duration: 0.055), value: pulse.beat)
        .animation(.easeOut(duration: 0.065), value: pulse.rytm)
    }

    private func vinylStage(pulse: CoverBeatPulseDriver.Pulse, live: Bool) -> some View {
        let disc = min(canvas.width, canvas.height) * 0.96
        return ZStack {
            RadialGradient(
                colors: [
                    ProMixerDeckView.labelGreen.opacity(0.16 + pulse.beat * 0.42),
                    ProMixerDeckView.labelAmber.opacity(0.10 + pulse.rytm * 0.34),
                    Color.black
                ],
                center: .center,
                startRadius: disc * 0.12,
                endRadius: max(canvas.width, canvas.height) * 0.72
            )
            .scaleEffect(1 + CGFloat(pulse.bass) * 0.04)

            Circle()
                .strokeBorder(ProMixerDeckView.labelGreen.opacity(0.18 + pulse.beat * 0.72), lineWidth: 5 + pulse.beat * 10)
                .frame(width: disc * 1.08, height: disc * 1.08)
                .blur(radius: 1.4)
            Circle()
                .strokeBorder(ProMixerDeckView.labelAmber.opacity(0.14 + pulse.rytm * 0.62), lineWidth: 3 + pulse.rytm * 8)
                .frame(width: disc * 1.18, height: disc * 1.18)
                .blur(radius: 2)

            LandscapeSpin(isSpinning: live && policy.analyzerFPS > 0.5) {
                ArtworkImage(
                    url: track.artworkURL,
                    size: disc,
                    cornerRadius: disc,
                    circleClip: true,
                    fallbackImage: engine.displayArtwork
                )
                .overlay {
                    Circle()
                        .stroke(Color.white.opacity(0.18), lineWidth: 2)
                        .frame(width: disc * 0.28, height: disc * 0.28)
                }
                .overlay {
                    Circle()
                        .fill(Color.black.opacity(0.88))
                        .frame(width: 22, height: 22)
                }
                .scaleEffect(1 + CGFloat(pulse.bass) * 0.02)
                .shadow(color: EOSTheme.accent.opacity(0.18 + pulse.beat * 0.35), radius: 28)
            }
        }
        .animation(.easeOut(duration: 0.07), value: pulse.beat)
        .animation(.easeOut(duration: 0.08), value: pulse.rytm)
    }
}

private struct LandscapeSpin<Content: View>: View {
    let isSpinning: Bool
    @ViewBuilder let content: Content
    @State private var angle: Double = 0

    var body: some View {
        content
            .rotationEffect(.degrees(angle))
            .onAppear { apply(isSpinning) }
            .onChange(of: isSpinning) { _, spinning in apply(spinning) }
    }

    private func apply(_ spinning: Bool) {
        if spinning {
            withAnimation(.linear(duration: 11).repeatForever(autoreverses: false)) {
                angle += 360
            }
        } else {
            var t = Transaction()
            t.disablesAnimations = true
            withTransaction(t) { angle = angle.truncatingRemainder(dividingBy: 360) }
        }
    }
}

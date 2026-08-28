import QuartzCore
import SwiftUI

/// Pioneer-style cue lamps: short pulse on onset, otherwise dark. Not an envelope follower.
@MainActor
final class DJConsoleLampEngine {
    struct Output {
        var beat: Double = 0
        var rytm: Double = 0
        var bass: Double = 0
        var treble: Double = 0
        var eos: Double = 0
        var out: Double = 0
        var clip: Double = 0
    }

    private var prevBeat = 0.0
    private var prevMid = 0.0
    private var prevHigh = 0.0
    private var beatFlashUntil: CFTimeInterval = 0
    private var rytmFlashUntil: CFTimeInterval = 0
    private var bassFlashUntil: CFTimeInterval = 0
    private var trebleFlashUntil: CFTimeInterval = 0
    private var clipHoldUntil: CFTimeInterval = 0
    private var beatCount = 0
    private var clipArm = 0
    private var recentBeat: [Double] = []

    func process(
        frame: MusicPlaybackEngine.AudioReactiveFrame,
        isPlaying: Bool,
        onServer: Bool = false
    ) -> Output {
        let now = CACurrentMediaTime()
        let eos: Double = onServer ? 0.42 : 0
        guard isPlaying else {
            prevBeat = 0
            prevMid = 0
            prevHigh = 0
            beatCount = 0
            clipArm = 0
            recentBeat.removeAll(keepingCapacity: true)
            return Output(beat: 0, rytm: 0, bass: 0, treble: 0, eos: eos, out: 0, clip: 0)
        }

        let beat = frame.beat
        let mid = frame.mid
        let high = frame.treble
        let bassEnv = frame.bass
        recentBeat.append(beat)
        if recentBeat.count > 36 { recentBeat.removeFirst(recentBeat.count - 36) }
        let peak = max(recentBeat.max() ?? beat, 0.08)
        let floor = max(0.10, min(0.34, peak * 0.38))
        let delta = max(0.05, peak * 0.20)

        let rising = beat > prevBeat + delta && beat > floor
        let midPulse = mid > prevMid + delta * 0.55 && mid > floor * 0.72
        let highSpark = high > prevHigh + delta * 0.42 && high > floor * 0.55
        let bassThump = bassEnv > 0.62 && beat > prevBeat
        prevBeat = beat
        prevMid = mid
        prevHigh = high

        if rising {
            beatFlashUntil = now + 0.09
            beatCount += 1
            if beatCount % 2 == 1 {
                rytmFlashUntil = now + 0.11
            }
        } else if midPulse {
            rytmFlashUntil = now + 0.10
        }

        if bassThump {
            bassFlashUntil = now + 0.14
        }
        if highSpark {
            trebleFlashUntil = now + 0.07
        }

        if frame.level > 0.93, frame.bass > 0.88 {
            clipArm += 1
        } else {
            clipArm = 0
        }
        if clipArm >= 2 {
            clipHoldUntil = now + 0.18
        }

        return Output(
            beat: now < beatFlashUntil ? 1 : 0,
            rytm: now < rytmFlashUntil ? 1 : 0,
            bass: now < bassFlashUntil ? 1 : min(1, bassEnv * 0.55),
            treble: now < trebleFlashUntil ? 1 : 0,
            eos: eos,
            out: frame.level > 0.05 ? 0.38 : 0,
            clip: now < clipHoldUntil ? 1 : 0
        )
    }
}

enum CoverPulseStyle {
    /// Full split BEAT | RYTM behind cover (cover preset).
    case split
    /// Softer rings + side flashes around a stable cover (spectrum preset).
    case halo
}

/// Okładka z rytmicznymi połówkami / pierścieniami — GPU gradients, niski FPS z policy.
struct CoverSplitBeatPulseView: View {
    let artworkURL: URL?
    var fallbackImage: UIImage?
    let isPlaying: Bool
    let visualizer: PlayerAudioVisualizer
    let policy: PlayerVisualPolicy
    var canvasSize: CGFloat = 286
    var cornerRadius: CGFloat = 16
    var style: CoverPulseStyle = .split

    @Environment(\.colorScheme) private var colorScheme
    @State private var lamps = DJConsoleLampEngine()

    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        if !policy.enabled || !isPlaying {
            staticCover
        } else {
            let fps = max(8, min(16, policy.analyzerFPS > 0 ? policy.analyzerFPS : 12))
            TimelineView(.animation(minimumInterval: 1.0 / fps, paused: !isPlaying)) { _ in
                animatedCover
            }
        }
    }

    private var staticCover: some View {
        ArtworkImage(
            url: artworkURL,
            size: canvasSize * 0.88,
            cornerRadius: cornerRadius,
            allowAnimated: true,
            fallbackImage: fallbackImage
        )
        .overlay { coverBezel }
        .shadow(color: .black.opacity(isLight ? 0.12 : 0.28), radius: isLight ? 18 : 16, y: isLight ? 10 : 8)
        .shadow(color: EOSTheme.accent.opacity(isLight ? 0.10 : 0.12), radius: 28, y: 4)
        .frame(width: canvasSize, height: canvasSize)
    }

    private var animatedCover: some View {
        let audio = visualizer.snapshot(isPlaying: isPlaying)
        let lampOut = lamps.process(frame: audio, isPlaying: isPlaying)
        let beatFlash = lampOut.beat
        let rytmFlash = lampOut.rytm
        let bassFlash = lampOut.bass
        let trebleFlash = lampOut.treble
        let drive = audio.visualDrive(isStrong: true, intensity: max(0.55, policy.intensityScale))
        let scale = policy.intensityScale

        return ZStack {
            // Deep bass bloom — soft, cheap radial.
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            ProMixerDeckView.labelGreen.opacity((isLight ? 0.10 : 0.16) * bassFlash * scale),
                            ProMixerDeckView.labelAmber.opacity((isLight ? 0.06 : 0.10) * rytmFlash * scale),
                            .clear
                        ],
                        center: .center,
                        startRadius: canvasSize * 0.12,
                        endRadius: canvasSize * 0.72
                    )
                )
                .frame(width: canvasSize * 1.35, height: canvasSize * 1.35)
                .scaleEffect(1 + CGFloat(bassFlash) * 0.05)
                .blur(radius: isLight ? 22 : 16)

            if style == .split {
                HStack(spacing: 0) {
                    backgroundHalf(
                        flash: beatFlash,
                        accent: ProMixerDeckView.labelGreen,
                        isLeft: true,
                        drive: drive
                    )
                    backgroundHalf(
                        flash: rytmFlash,
                        accent: ProMixerDeckView.labelAmber,
                        isLeft: false,
                        drive: drive
                    )
                }
                .frame(width: canvasSize * 1.18, height: canvasSize * 1.18)
                .blur(radius: isLight ? 16 : 13)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius + 8, style: .continuous))
            } else {
                // Halo mode — concentric rings instead of split smear.
                Circle()
                    .strokeBorder(
                        ProMixerDeckView.labelGreen.opacity((isLight ? 0.22 : 0.35) * beatFlash * scale),
                        lineWidth: 3 + beatFlash * 4
                    )
                    .frame(width: canvasSize * 1.08, height: canvasSize * 1.08)
                    .blur(radius: 1.5)
                Circle()
                    .strokeBorder(
                        ProMixerDeckView.labelAmber.opacity((isLight ? 0.18 : 0.30) * rytmFlash * scale),
                        lineWidth: 2 + rytmFlash * 3
                    )
                    .frame(width: canvasSize * 1.18, height: canvasSize * 1.18)
                    .blur(radius: 2)
            }

            // Treble sparkles — thin edge highlights (no particles).
            RoundedRectangle(cornerRadius: cornerRadius + 4, style: .continuous)
                .strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.white.opacity(trebleFlash * (isLight ? 0.55 : 0.7)),
                            ProMixerDeckView.labelGreen.opacity(trebleFlash * 0.35),
                            Color.clear,
                            ProMixerDeckView.labelAmber.opacity(trebleFlash * 0.3),
                            Color.white.opacity(trebleFlash * (isLight ? 0.45 : 0.55))
                        ],
                        center: .center
                    ),
                    lineWidth: 1.4
                )
                .frame(width: canvasSize * 0.98, height: canvasSize * 0.98)
                .opacity(0.35 + trebleFlash * 0.65)
                .blur(radius: trebleFlash > 0.5 ? 0.5 : 1.2)

            ArtworkImage(
                url: artworkURL,
                size: canvasSize * 0.90,
                cornerRadius: cornerRadius,
                allowAnimated: true,
                fallbackImage: fallbackImage
            )
            .overlay { coverBezel }
            .scaleEffect(1 + CGFloat(bassFlash) * 0.012 * scale)
            .shadow(
                color: ProMixerDeckView.labelGreen.opacity(isLight ? 0.14 + beatFlash * 0.42 : 0.20 + beatFlash * 0.50),
                radius: 10 + beatFlash * 20,
                x: isLight ? -2 : 0,
                y: 6
            )
            .shadow(
                color: ProMixerDeckView.labelAmber.opacity(isLight ? 0.12 + rytmFlash * 0.36 : 0.16 + rytmFlash * 0.42),
                radius: 10 + rytmFlash * 18,
                x: isLight ? 2 : 0,
                y: 6
            )
            .shadow(
                color: .black.opacity(isLight ? 0.10 : 0.22),
                radius: isLight ? 16 : 12,
                y: isLight ? 10 : 6
            )
        }
        .frame(width: canvasSize, height: canvasSize)
        .animation(.easeOut(duration: 0.07), value: beatFlash)
        .animation(.easeOut(duration: 0.08), value: rytmFlash)
    }

    private var coverBezel: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .strokeBorder(
                LinearGradient(
                    colors: isLight
                        ? [Color.white.opacity(0.98), Color.black.opacity(0.06), EOSTheme.accent.opacity(0.12)]
                        : [Color.white.opacity(0.34), Color.white.opacity(0.06)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                lineWidth: isLight ? 1.4 : 1.2
            )
    }

    @ViewBuilder
    private func backgroundHalf(
        flash: Double,
        accent: Color,
        isLeft: Bool,
        drive: Double
    ) -> some View {
        let base = isLight ? 0.12 : 0.14
        let lit = base + flash * (isLight ? 0.78 : 0.88) + drive * 0.08
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        accent.opacity(lit),
                        accent.opacity(lit * 0.38),
                        accent.opacity(lit * 0.08)
                    ],
                    startPoint: isLeft ? .leading : .trailing,
                    endPoint: .center
                )
            )
            .scaleEffect(1 + CGFloat(flash) * 0.06 + CGFloat(drive) * 0.015)
            .brightness(flash * (isLight ? 0.22 : 0.32))
            .saturation(1 + flash * 0.28)
    }
}

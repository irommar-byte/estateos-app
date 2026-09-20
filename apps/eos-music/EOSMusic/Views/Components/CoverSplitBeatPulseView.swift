import QuartzCore
import SwiftUI
import UIKit

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
            beatFlashUntil = now + 0.11
            beatCount += 1
            if beatCount % 2 == 1 {
                rytmFlashUntil = now + 0.13
            }
        } else if midPulse {
            rytmFlashUntil = now + 0.12
        }

        if bassThump {
            bassFlashUntil = now + 0.14
        }
        if highSpark {
            trebleFlashUntil = now + 0.08
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

/// Polls the audio tap and turns onsets into visible BEAT/RYTM flashes.
/// `PlayerAudioVisualizer` does not publish — SwiftUI must poll via CADisplayLink.
@MainActor
final class CoverBeatPulseDriver: NSObject, ObservableObject {
    struct Pulse: Equatable {
        var beat = 0.0
        var rytm = 0.0
        var bass = 0.0
        var treble = 0.0
        var drive = 0.0
    }

    @Published private(set) var pulse = Pulse()

    private let lamps = DJConsoleLampEngine()
    private weak var visualizer: PlayerAudioVisualizer?
    private var displayLink: CADisplayLink?
    private var isPlaying = false
    private var lastDraw: CFTimeInterval = 0
    private var minInterval: CFTimeInterval = 1.0 / 14
    private var beatDecay = 0.0
    private var rytmDecay = 0.0

    override init() {
        super.init()
    }

    func start(visualizer: PlayerAudioVisualizer, isPlaying: Bool, fps: Double) {
        self.visualizer = visualizer
        self.isPlaying = isPlaying
        let rate = fps > 0.5 ? max(12, min(16, fps)) : 12
        minInterval = 1.0 / rate
        if isPlaying {
            guard displayLink == nil else { return }
            let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
            link.preferredFrameRateRange = CAFrameRateRange(
                minimum: 10,
                maximum: 16,
                preferred: Float(rate)
            )
            link.add(to: .main, forMode: .common)
            displayLink = link
        } else {
            stop()
            beatDecay = 0
            rytmDecay = 0
            pulse = Pulse()
        }
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    deinit { displayLink?.invalidate() }

    @objc private func tick(_ link: CADisplayLink) {
        if link.timestamp - lastDraw < minInterval { return }
        lastDraw = link.timestamp
        let frame = visualizer?.snapshot(isPlaying: isPlaying) ?? MusicPlaybackEngine.AudioReactiveFrame()
        let out = lamps.process(frame: frame, isPlaying: isPlaying)
        beatDecay = max(out.beat, beatDecay * 0.52, frame.beat * 0.28)
        rytmDecay = max(out.rytm, rytmDecay * 0.52, frame.mid * 0.24)
        let next = Pulse(
            beat: min(1, beatDecay),
            rytm: min(1, rytmDecay),
            bass: max(out.bass, frame.bass * 0.72),
            treble: max(out.treble, frame.treble * 0.45),
            drive: frame.visualDrive(isStrong: true, intensity: 1)
        )
        if next != pulse {
            pulse = next
        }
    }
}

enum CoverPulseStyle {
    /// Full split BEAT | RYTM behind cover (cover preset).
    case split
    /// Softer rings + side flashes around a stable cover (spectrum preset).
    case halo
}

/// Okładka z rytmicznymi połówkami — CADisplayLink + lampy BEAT/RYTM.
struct CoverSplitBeatPulseView: View {
    let artworkURL: URL?
    var fallbackImage: UIImage?
    let isPlaying: Bool
    var visualizer: PlayerAudioVisualizer
    let policy: PlayerVisualPolicy
    var canvasSize: CGFloat = 286
    var cornerRadius: CGFloat = 16
    var style: CoverPulseStyle = .split

    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var driver = CoverBeatPulseDriver()

    private var isLight: Bool { colorScheme == .light }
    private var live: Bool { policy.enabled && isPlaying && policy.analyzerFPS > 0.5 }

    var body: some View {
        Group {
            if live {
                animatedCover
                    .drawingGroup(opaque: false)
            } else {
                staticCover
            }
        }
        .onAppear { syncDriver() }
        .onChange(of: live) { _, _ in syncDriver() }
        .onDisappear { driver.stop() }
    }

    private func syncDriver() {
        driver.start(visualizer: visualizer, isPlaying: live, fps: policy.analyzerFPS)
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
        let pulse = driver.pulse
        let scale = max(0.62, policy.intensityScale)

        return ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            ProMixerDeckView.labelGreen.opacity((isLight ? 0.14 : 0.22) * pulse.bass * scale),
                            ProMixerDeckView.labelAmber.opacity((isLight ? 0.10 : 0.16) * pulse.rytm * scale),
                            .clear
                        ],
                        center: .center,
                        startRadius: canvasSize * 0.10,
                        endRadius: canvasSize * 0.78
                    )
                )
                .frame(width: canvasSize * 1.42, height: canvasSize * 1.42)
                .scaleEffect(1 + CGFloat(pulse.bass) * 0.07)
                .blur(radius: isLight ? 20 : 14)

            if style == .split {
                HStack(spacing: 0) {
                    CoverBeatWash(
                        flash: pulse.beat,
                        accent: ProMixerDeckView.labelGreen,
                        isLeft: true,
                        drive: pulse.drive,
                        cornerRadius: cornerRadius,
                        isLight: isLight
                    )
                    CoverBeatWash(
                        flash: pulse.rytm,
                        accent: ProMixerDeckView.labelAmber,
                        isLeft: false,
                        drive: pulse.drive,
                        cornerRadius: cornerRadius,
                        isLight: isLight
                    )
                }
                .frame(width: canvasSize * 1.22, height: canvasSize * 1.22)
                .blur(radius: isLight ? 12 : 10)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius + 10, style: .continuous))

                HStack(spacing: 0) {
                    CoverBeatRail(flash: pulse.beat, accent: ProMixerDeckView.labelGreen)
                    Spacer(minLength: 0)
                    CoverBeatRail(flash: pulse.rytm, accent: ProMixerDeckView.labelAmber)
                }
                .frame(width: canvasSize * 1.08, height: canvasSize * 0.92)
            } else {
                Circle()
                    .strokeBorder(
                        ProMixerDeckView.labelGreen.opacity((isLight ? 0.28 : 0.42) * pulse.beat * scale),
                        lineWidth: 3 + pulse.beat * 7
                    )
                    .frame(width: canvasSize * 1.08, height: canvasSize * 1.08)
                    .blur(radius: 1.2)
                Circle()
                    .strokeBorder(
                        ProMixerDeckView.labelAmber.opacity((isLight ? 0.22 : 0.36) * pulse.rytm * scale),
                        lineWidth: 2 + pulse.rytm * 6
                    )
                    .frame(width: canvasSize * 1.20, height: canvasSize * 1.20)
                    .blur(radius: 1.8)
            }

            RoundedRectangle(cornerRadius: cornerRadius + 4, style: .continuous)
                .strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.white.opacity(pulse.treble * (isLight ? 0.62 : 0.78)),
                            ProMixerDeckView.labelGreen.opacity(pulse.treble * 0.42),
                            Color.clear,
                            ProMixerDeckView.labelAmber.opacity(pulse.treble * 0.38),
                            Color.white.opacity(pulse.treble * (isLight ? 0.50 : 0.62))
                        ],
                        center: .center
                    ),
                    lineWidth: 1.6
                )
                .frame(width: canvasSize * 0.98, height: canvasSize * 0.98)
                .opacity(0.28 + pulse.treble * 0.72)
                .blur(radius: pulse.treble > 0.5 ? 0.4 : 1.1)

            ArtworkImage(
                url: artworkURL,
                size: canvasSize * 0.90,
                cornerRadius: cornerRadius,
                allowAnimated: true,
                fallbackImage: fallbackImage
            )
            .overlay { coverBezel }
            .overlay {
                HStack(spacing: 0) {
                    ProMixerDeckView.labelGreen.opacity(pulse.beat * (isLight ? 0.16 : 0.22))
                    ProMixerDeckView.labelAmber.opacity(pulse.rytm * (isLight ? 0.14 : 0.20))
                }
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                .blendMode(.plusLighter)
                .allowsHitTesting(false)
            }
            .scaleEffect(1 + CGFloat(pulse.bass) * 0.018 * scale)
            .brightness(pulse.beat * 0.045 * scale)
            .shadow(
                color: ProMixerDeckView.labelGreen.opacity(isLight ? 0.16 + pulse.beat * 0.62 : 0.24 + pulse.beat * 0.72),
                radius: 8 + pulse.beat * 26,
                x: isLight ? -3 : -2,
                y: 6
            )
            .shadow(
                color: ProMixerDeckView.labelAmber.opacity(isLight ? 0.14 + pulse.rytm * 0.52 : 0.18 + pulse.rytm * 0.62),
                radius: 8 + pulse.rytm * 22,
                x: isLight ? 3 : 2,
                y: 6
            )
            .shadow(
                color: .black.opacity(isLight ? 0.10 : 0.22),
                radius: isLight ? 16 : 12,
                y: isLight ? 10 : 6
            )
        }
        .frame(width: canvasSize, height: canvasSize)
        .animation(.easeOut(duration: 0.055), value: pulse.beat)
        .animation(.easeOut(duration: 0.065), value: pulse.rytm)
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
}

struct CoverBeatWash: View {
    var flash: Double
    var accent: Color
    var isLeft: Bool
    var drive: Double
    var cornerRadius: CGFloat
    var isLight: Bool

    var body: some View {
        let base = isLight ? 0.16 : 0.18
        let lit = base + flash * (isLight ? 0.86 : 0.96) + drive * 0.10
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        accent.opacity(min(1, lit)),
                        accent.opacity(lit * 0.42),
                        accent.opacity(lit * 0.06)
                    ],
                    startPoint: isLeft ? .leading : .trailing,
                    endPoint: .center
                )
            )
            .scaleEffect(1 + CGFloat(flash) * 0.08 + CGFloat(drive) * 0.02)
            .brightness(flash * (isLight ? 0.28 : 0.40))
            .saturation(1 + flash * 0.38)
    }
}

struct CoverBeatRail: View {
    var flash: Double
    var accent: Color

    var body: some View {
        Capsule(style: .continuous)
            .fill(accent)
            .frame(width: 7 + flash * 5)
            .frame(maxHeight: .infinity)
            .opacity(0.12 + flash * 0.88)
            .shadow(color: accent.opacity(flash * 0.85), radius: 8 + flash * 10)
            .scaleEffect(x: 1, y: 0.72 + flash * 0.28)
    }
}

/// Podłużne diody jak na mikserze — większe na pełny ekran w poziomie.
struct CoverBeatLEDBank: View {
    let label: String
    let color: Color
    let intensity: Double
    var segments: Int = 5

    var body: some View {
        VStack(spacing: 7) {
            Text(label)
                .font(.system(size: 9, weight: .bold, design: .default))
                .tracking(1.2)
                .foregroundStyle(color.opacity(intensity > 0.08 ? 0.95 : 0.42))

            VStack(spacing: 5) {
                ForEach(0..<segments, id: \.self) { index in
                    let threshold = Double(index) / Double(max(segments, 1))
                    let on = intensity > threshold * 0.72
                    let lit = on ? min(1, 0.35 + intensity * 0.75) : 0.08
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.black.opacity(0.92),
                                    Color.black.opacity(0.72)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: 1.2, style: .continuous)
                                .fill(color.opacity(lit))
                                .padding(.horizontal, 3)
                                .padding(.vertical, 2)
                                .shadow(color: on ? color.opacity(0.7 * intensity) : .clear, radius: on ? 6 : 0)
                        }
                        .overlay {
                            RoundedRectangle(cornerRadius: 2, style: .continuous)
                                .stroke(Color.white.opacity(0.14), lineWidth: 0.6)
                        }
                        .frame(width: 36, height: 13)
                }
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 8)
        .background {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.black.opacity(0.38))
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Color.white.opacity(0.10), lineWidth: 0.6)
                }
        }
        .accessibilityLabel("\(label) \(Int((intensity * 100).rounded()))%")
    }
}

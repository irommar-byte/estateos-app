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
        /// Tempo z odstępów między stopami (0 = jeszcze nieznane).
        var bpm: Int = 0
        /// Mierniki L/R: szybki wzrost, opadanie ~1,5 poziomu/s jak w sprzęcie.
        var left: Double = 0
        var right: Double = 0
    }

    private var leftHold = 0.0
    private var rightHold = 0.0
    private var lastProcess = 0.0

    private var lastKickAt: Double = 0
    private var kickIntervals: [Double] = []
    private var bpm = 0
    private var clipSince: Double = 0

    /// Diody liczone z dokładnych momentów uderzeń (wątek audio) + opóźnienia wyjścia.
    /// BEAT = stopa, RYTM = werbel/klaśnięcie, BASS = poziom basu + błysk na stopę, HI = hi-hat.
    func process(
        frame: MusicPlaybackEngine.AudioReactiveFrame,
        isPlaying: Bool,
        onServer: Bool = false
    ) -> Output {
        let now = CACurrentMediaTime()
        let eos: Double = onServer ? 0.55 : 0
        guard isPlaying else {
            kickIntervals.removeAll()
            bpm = 0
            return Output(eos: eos)
        }

        if frame.kickAt > 0, frame.kickAt != lastKickAt {
            if lastKickAt > 0 {
                let interval = frame.kickAt - lastKickAt
                if interval > 0.25, interval < 1.5 {
                    kickIntervals.append(interval)
                    if kickIntervals.count > 16 { kickIntervals.removeFirst() }
                    if kickIntervals.count >= 4 {
                        let sorted = kickIntervals.sorted()
                        var tempo = 60 / sorted[sorted.count / 2]
                        while tempo < 70 { tempo *= 2 }
                        while tempo > 180 { tempo /= 2 }
                        bpm = Int(tempo.rounded())
                    }
                }
            }
            lastKickAt = frame.kickAt
        }

        let dt = lastProcess == 0 ? 1.0 / 60 : min(0.1, now - lastProcess)
        lastProcess = now
        leftHold = max(frame.levelL, leftHold - dt * 1.5)
        rightHold = max(frame.levelR, rightHold - dt * 1.5)

        let kick = EOSBeatClock.pulse(eventAt: frame.kickAt, now: now, tau: 0.09)
        let snare = EOSBeatClock.pulse(eventAt: frame.snareAt, now: now, tau: 0.08)
        let hat = EOSBeatClock.pulse(eventAt: frame.hatAt, now: now, tau: 0.05)

        if frame.level > 0.94 {
            if clipSince == 0 { clipSince = now }
        } else {
            clipSince = 0
        }

        return Output(
            beat: kick,
            rytm: snare,
            bass: min(1, max(kick, frame.bass * 0.85)),
            treble: hat,
            eos: eos,
            out: min(1, frame.level * 1.15),
            clip: clipSince > 0 && now - clipSince > 0.08 ? 1 : 0,
            bpm: bpm,
            left: leftHold,
            right: rightHold
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
        let rate = PlayerVisualMetrics.analyzerFPS(preferred: fps)
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
                Circle()
                    .strokeBorder(
                        ProMixerDeckView.labelAmber.opacity((isLight ? 0.22 : 0.36) * pulse.rytm * scale),
                        lineWidth: 2 + pulse.rytm * 6
                    )
                    .frame(width: canvasSize * 1.20, height: canvasSize * 1.20)
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
            .shadow(
                color: .black.opacity(isLight ? 0.12 : 0.28),
                radius: isLight ? 16 : 12,
                y: isLight ? 8 : 6
            )
        }
        .frame(width: canvasSize, height: canvasSize)
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

// MARK: - Klubowa okładka (stopa / bas / werbel / hi-hat — każdy efekt na swój sygnał)

/// Okładka jak w klubie, liczona w każdej klatce (60–120 Hz) z dokładnych momentów uderzeń:
/// • stopa  → okładka „uderza” (skala) + błysk światła od dołu,
/// • bas    → pulsująca poświata wokół w kolorach EOS,
/// • werbel → rozchodzący się pierścień światła + krótki biały flesz,
/// • hi-hat → iskry na krawędzi,
/// • lasery obracają się w tempie utworu (szybciej przy mocniejszym basie).
struct ClubCoverView: UIViewRepresentable {
    let artworkURL: URL?
    var fallbackImage: UIImage?
    let isPlaying: Bool
    let visualizer: PlayerAudioVisualizer
    var canvasSize: CGFloat
    var cornerRadius: CGFloat
    var strobe: Bool = false

    func makeUIView(context: Context) -> ClubCoverUIView {
        let view = ClubCoverUIView()
        update(view)
        return view
    }

    func updateUIView(_ uiView: ClubCoverUIView, context: Context) { update(uiView) }

    private func update(_ view: ClubCoverUIView) {
        view.configure(
            artworkURL: artworkURL,
            fallbackImage: fallbackImage,
            isPlaying: isPlaying,
            visualizer: visualizer,
            canvasSize: canvasSize,
            cornerRadius: cornerRadius,
            strobe: strobe
        )
    }

    static func dismantleUIView(_ uiView: ClubCoverUIView, coordinator: ()) { uiView.stop() }
}

final class ClubCoverUIView: UIView {
    private weak var visualizer: PlayerAudioVisualizer?
    private var isPlaying = false
    private var strobe = false
    private var cornerRadius: CGFloat = 16
    private var artKey = ""
    private var link: CADisplayLink?
    private var laserAngle: CGFloat = 0
    private var bassSmooth: CGFloat = 0
    private var lastTick: CFTimeInterval = 0
    private var lastSnareSeen: Double = 0
    private var ringAge: CGFloat = 10

    private let laserLayer = CAGradientLayer()
    private let beamMask = CAGradientLayer()
    private let strobeWall = CAGradientLayer()
    private var beamsAreStrobe: Bool?

    /// 16 cienkich promieni (jak lasery w klubie); w trybie strobo białe i ostrzejsze.
    private func applyBeams(strobe: Bool) {
        guard beamsAreStrobe != strobe else { return }
        beamsAreStrobe = strobe
        let accent = UIColor(EOSTheme.accent), second = UIColor(EOSTheme.accentSecondary)
        var colors: [CGColor] = []
        var locations: [NSNumber] = []
        let beams = 16
        for b in 0..<beams {
            let start = Double(b) / Double(beams)
            let width = strobe ? 0.012 : 0.02
            let c = strobe ? UIColor.white : (b % 2 == 0 ? accent : second)
            colors += [UIColor.clear.cgColor, c.withAlphaComponent(strobe ? 0.9 : 0.75).cgColor, UIColor.clear.cgColor]
            locations += [NSNumber(value: start), NSNumber(value: start + width), NSNumber(value: start + width * 2)]
        }
        laserLayer.colors = colors
        laserLayer.locations = locations
        strobeWall.type = .radial
        strobeWall.colors = [UIColor.white.cgColor, (strobe ? UIColor.white : accent).withAlphaComponent(0.35).cgColor, UIColor.clear.cgColor]
        strobeWall.startPoint = CGPoint(x: 0.5, y: 0.5)
        strobeWall.endPoint = CGPoint(x: 1, y: 1)
    }
    private let glowLayer = CAGradientLayer()
    private let artLayer = CALayer()
    private let artShadow = CALayer()
    private let kickLight = CAGradientLayer()
    private let flashLayer = CALayer()
    private let ringLayer = CAShapeLayer()
    private var sparks: [CALayer] = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        backgroundColor = .clear
        let accent = UIColor(EOSTheme.accent), second = UIColor(EOSTheme.accentSecondary)

        laserLayer.type = .conic
        laserLayer.startPoint = CGPoint(x: 0.5, y: 0.5)
        laserLayer.endPoint = CGPoint(x: 0.5, y: 0)
        applyBeams(strobe: false)
        laserLayer.opacity = 0
        // Okrągłe wygaszenie: promienie gasną miękko ku krawędzi (bez kwadratowych rogów).
        beamMask.type = .radial
        beamMask.colors = [UIColor.white.cgColor, UIColor.white.withAlphaComponent(0.7).cgColor, UIColor.clear.cgColor]
        beamMask.locations = [0, 0.45, 1]
        beamMask.startPoint = CGPoint(x: 0.5, y: 0.5)
        beamMask.endPoint = CGPoint(x: 1, y: 1)
        laserLayer.mask = beamMask
        strobeWall.opacity = 0
        strobeWall.cornerCurve = .continuous
        layer.addSublayer(strobeWall)
        layer.addSublayer(laserLayer)

        glowLayer.type = .radial
        glowLayer.colors = [accent.withAlphaComponent(0.85).cgColor, second.withAlphaComponent(0.4).cgColor, UIColor.clear.cgColor]
        glowLayer.startPoint = CGPoint(x: 0.5, y: 0.5)
        glowLayer.endPoint = CGPoint(x: 1, y: 1)
        layer.addSublayer(glowLayer)

        artShadow.shadowColor = UIColor.black.cgColor
        artShadow.shadowOpacity = 0.55
        artShadow.shadowRadius = 22
        artShadow.shadowOffset = CGSize(width: 0, height: 14)
        layer.addSublayer(artShadow)

        artLayer.masksToBounds = true
        artLayer.contentsGravity = .resizeAspectFill
        artLayer.backgroundColor = UIColor(white: 0.12, alpha: 1).cgColor
        artLayer.cornerCurve = .continuous
        artShadow.addSublayer(artLayer)

        kickLight.colors = [UIColor.white.withAlphaComponent(0.55).cgColor, accent.withAlphaComponent(0.25).cgColor, UIColor.clear.cgColor]
        kickLight.startPoint = CGPoint(x: 0.5, y: 1)
        kickLight.endPoint = CGPoint(x: 0.5, y: 0.35)
        kickLight.opacity = 0
        artLayer.addSublayer(kickLight)

        flashLayer.backgroundColor = UIColor.white.cgColor
        flashLayer.opacity = 0
        artLayer.addSublayer(flashLayer)

        ringLayer.fillColor = UIColor.clear.cgColor
        ringLayer.strokeColor = UIColor.white.cgColor
        ringLayer.lineWidth = 3
        ringLayer.opacity = 0
        ringLayer.shadowOpacity = 0
        layer.addSublayer(ringLayer)

        for i in 0..<14 {
            let spark = CALayer()
            spark.backgroundColor = (i % 2 == 0 ? UIColor.white : second).cgColor
            spark.cornerRadius = 2.5
            spark.bounds = CGRect(x: 0, y: 0, width: 5, height: 5)
            spark.opacity = 0
            layer.addSublayer(spark)
            sparks.append(spark)
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    func configure(artworkURL: URL?, fallbackImage: UIImage?, isPlaying: Bool, visualizer: PlayerAudioVisualizer,
                   canvasSize: CGFloat, cornerRadius: CGFloat, strobe: Bool) {
        self.visualizer = visualizer
        self.isPlaying = isPlaying
        self.strobe = strobe
        applyBeams(strobe: strobe)
        self.cornerRadius = cornerRadius
        let key = artworkURL?.absoluteString ?? "fallback-\(fallbackImage.map { ObjectIdentifier($0).hashValue } ?? 0)"
        if key != artKey {
            artKey = key
            if let fallbackImage { artLayer.contents = fallbackImage.cgImage }
            if let artworkURL {
                Task { [weak self] in
                    let loaded = await ArtworkDecodeActor.shared.load(url: artworkURL, maxPixelSize: 900, allowAnimated: false, timeout: 12)
                    await MainActor.run {
                        guard let self, self.artKey == key, let image = loaded?.still else { return }
                        self.artLayer.contents = image.cgImage
                    }
                }
            }
        }
        setNeedsLayout()
        if link == nil, window != nil { start() }
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { stop() } else { start() }
    }

    func start() {
        guard link == nil else { return }
        let l = CADisplayLink(target: ClubWeakTarget(self), selector: #selector(ClubWeakTarget.tick(_:)))
        l.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 120, preferred: 60)
        l.add(to: .main, forMode: .common)
        link = l
    }

    func stop() {
        link?.invalidate()
        link = nil
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin(); CATransaction.setDisableActions(true)
        let side = min(bounds.width, bounds.height) * 0.86
        let art = CGRect(x: bounds.midX - side / 2, y: bounds.midY - side / 2, width: side, height: side)
        artShadow.bounds = CGRect(origin: .zero, size: art.size)
        artShadow.position = CGPoint(x: art.midX, y: art.midY)
        artShadow.shadowPath = UIBezierPath(roundedRect: artShadow.bounds, cornerRadius: cornerRadius).cgPath
        artLayer.frame = artShadow.bounds
        artLayer.cornerRadius = cornerRadius
        kickLight.frame = artLayer.bounds
        flashLayer.frame = artLayer.bounds
        let big = max(bounds.width, bounds.height) * 1.5
        laserLayer.bounds = CGRect(x: 0, y: 0, width: big, height: big)
        laserLayer.position = CGPoint(x: bounds.midX, y: bounds.midY)
        beamMask.frame = laserLayer.bounds
        strobeWall.bounds = CGRect(x: 0, y: 0, width: big * 0.8, height: big * 0.8)
        strobeWall.position = CGPoint(x: bounds.midX, y: bounds.midY)
        glowLayer.bounds = CGRect(x: 0, y: 0, width: side * 1.5, height: side * 1.5)
        glowLayer.position = CGPoint(x: bounds.midX, y: bounds.midY)
        ringLayer.frame = bounds
        ringLayer.path = UIBezierPath(roundedRect: art, cornerRadius: cornerRadius).cgPath
        CATransaction.commit()
    }

    fileprivate func step(_ link: CADisplayLink) {
        let now = CACurrentMediaTime()
        let dt = CGFloat(lastTick == 0 ? 1.0 / 60 : min(0.05, link.timestamp - lastTick))
        lastTick = link.timestamp
        let f = visualizer?.snapshot(isPlaying: isPlaying) ?? MusicPlaybackEngine.AudioReactiveFrame()
        let playing = isPlaying

        let kick = CGFloat(playing ? EOSBeatClock.pulse(eventAt: f.kickAt, now: now, tau: 0.11) * max(0.55, f.kickStrength) : 0)
        let snare = CGFloat(playing ? EOSBeatClock.pulse(eventAt: f.snareAt, now: now, tau: 0.09) * max(0.5, f.snareStrength) : 0)
        let hat = CGFloat(playing ? EOSBeatClock.pulse(eventAt: f.hatAt, now: now, tau: 0.06) : 0)
        let bassTarget = CGFloat(playing ? f.bass : 0)
        bassSmooth += (bassTarget - bassSmooth) * min(1, dt * (bassTarget > bassSmooth ? 18 : 5))

        // Nowy werbel → pierścień startuje od krawędzi okładki
        if playing, f.snareAt != lastSnareSeen, EOSBeatClock.pulse(eventAt: f.snareAt, now: now) > 0 {
            lastSnareSeen = f.snareAt
            ringAge = 0
        }
        ringAge += dt

        laserAngle += dt * (0.35 + bassSmooth * 1.6 + kick * 2.2)

        CATransaction.begin(); CATransaction.setDisableActions(true)
        artShadow.transform = CATransform3DMakeScale(1 + kick * 0.045 + bassSmooth * 0.012, 1 + kick * 0.045 + bassSmooth * 0.012, 1)
        kickLight.opacity = Float(kick * 0.9)
        flashLayer.opacity = Float(snare * (strobe ? 0.55 : 0.28))
        glowLayer.opacity = Float(0.25 + bassSmooth * 0.6 + kick * 0.35)
        let glowScale = 0.85 + bassSmooth * 0.25 + kick * 0.12
        glowLayer.transform = CATransform3DMakeScale(glowScale, glowScale, 1)
        laserLayer.transform = CATransform3DMakeRotation(laserAngle, 0, 0, 1)
        laserLayer.opacity = Float(playing ? min(0.9, 0.1 + bassSmooth * 0.35 + snare * 0.5 + (strobe ? kick * 0.4 : 0)) : 0)
        // Strobo: ściana światła za okładką błyska dokładnie na stopę i werbel.
        strobeWall.opacity = Float(strobe && playing ? min(1, kick * 0.85 + snare * 0.6) : 0)

        let ringT = min(1, ringAge / 0.45)
        ringLayer.opacity = Float(ringT < 1 ? (1 - ringT) * 0.9 : 0)
        let ringScale = 1 + ringT * 0.18
        ringLayer.transform = CATransform3DMakeScale(ringScale, ringScale, 1)
        ringLayer.bounds = bounds
        ringLayer.position = CGPoint(x: bounds.midX, y: bounds.midY)

        let side = artShadow.bounds.width * (1 + kick * 0.045)
        for (i, spark) in sparks.enumerated() {
            let a = CGFloat(i) / CGFloat(sparks.count) * .pi * 2 + laserAngle * 0.4
            let r = side * 0.5 * 1.08
            spark.position = CGPoint(x: bounds.midX + cos(a) * r, y: bounds.midY + sin(a) * r)
            spark.opacity = Float(hat * ((i % 3 == Int(laserAngle * 3) % 3) ? 1 : 0.35))
        }
        CATransaction.commit()
    }
}

private final class ClubWeakTarget: NSObject {
    weak var view: ClubCoverUIView?
    init(_ view: ClubCoverUIView) { self.view = view }
    @objc func tick(_ link: CADisplayLink) {
        if let view { view.step(link) } else { link.invalidate() }
    }
}

import SwiftUI
import UIKit

/// Spektrum w stylu Apple, z dynamiką Winampa.
/// Rysowane na warstwach Core Animation (GPU) z CADisplayLink 60–120 Hz:
/// słupki wskakują natychmiast, opadają z „grawitacją”, a szczyty chwilę wiszą i spadają.
/// Liczba i szerokość słupków dopasowuje się do rozmiaru ekranu.
struct WinampSpectrumHost: UIViewRepresentable {
    var visualizer: PlayerAudioVisualizer
    var isPlaying: Bool
    var intensity: Double
    var bandCount: Int
    var barScale: Double = 1.0
    var speed: Double = 1.0
    var compact: Bool
    var lightAppearance: Bool = false

    func makeUIView(context: Context) -> WinampSpectrumUIView {
        let view = WinampSpectrumUIView()
        apply(to: view)
        return view
    }

    func updateUIView(_ uiView: WinampSpectrumUIView, context: Context) {
        apply(to: uiView)
    }

    private func apply(to view: WinampSpectrumUIView) {
        view.configure(
            visualizer: visualizer,
            isPlaying: isPlaying,
            intensity: intensity,
            bandCount: bandCount,
            barScale: barScale,
            speed: speed,
            compact: compact,
            lightAppearance: lightAppearance
        )
    }

    static func dismantleUIView(_ uiView: WinampSpectrumUIView, coordinator: ()) {
        uiView.stop()
    }
}

final class WinampSpectrumUIView: UIView {
    private weak var visualizer: PlayerAudioVisualizer?
    private var displayLink: CADisplayLink?
    private var isPlaying = false
    private var intensity: Double = 1
    private var bandCount = 24
    private var barScale: Double = 1
    private var speed: Double = 1
    private var lightAppearance = false

    private var levels: [Double] = []
    private var velocities: [Double] = []
    private var peaks: [Double] = []
    private var peakHold: [Double] = []
    private var peakVelocity: [Double] = []
    private var lastTime: CFTimeInterval = 0

    private let backgroundLayer = CALayer()
    private let gradientLayer = CAGradientLayer()
    private let barsMask = CALayer()
    private var barLayers: [CALayer] = []
    private var peakLayers: [CALayer] = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        isOpaque = false
        backgroundColor = .clear
        isUserInteractionEnabled = false
        layer.addSublayer(backgroundLayer)
        layer.addSublayer(gradientLayer)
        gradientLayer.mask = barsMask
        gradientLayer.startPoint = CGPoint(x: 0.5, y: 1)
        gradientLayer.endPoint = CGPoint(x: 0.5, y: 0)
        backgroundLayer.cornerCurve = .continuous
        applyColors()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(
        visualizer: PlayerAudioVisualizer,
        isPlaying: Bool,
        intensity: Double,
        bandCount: Int,
        barScale: Double,
        speed: Double,
        compact: Bool,
        lightAppearance: Bool
    ) {
        self.visualizer = visualizer
        self.isPlaying = isPlaying
        self.intensity = max(0.2, intensity)
        self.barScale = max(0.4, barScale)
        self.speed = max(0.4, speed)
        let count = bandCount >= 32 ? 32 : 24
        if count != self.bandCount || barLayers.isEmpty {
            self.bandCount = count
            rebuildBars()
        }
        if lightAppearance != self.lightAppearance {
            self.lightAppearance = lightAppearance
            applyColors()
        }
        startIfNeeded()
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { stop() } else { startIfNeeded() }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        backgroundLayer.frame = bounds
        backgroundLayer.cornerRadius = min(18, bounds.height * 0.08)
        gradientLayer.frame = bounds
        barsMask.frame = bounds
        layoutBars()
        CATransaction.commit()
    }

    // MARK: - Setup

    private func applyColors() {
        let accent = UIColor(EOSTheme.accent)
        let secondary = UIColor(EOSTheme.accentSecondary)
        gradientLayer.colors = [
            secondary.withAlphaComponent(0.95).cgColor,
            accent.cgColor,
            UIColor(red: 1, green: 0.62, blue: 0.55, alpha: 1).cgColor
        ]
        gradientLayer.locations = [0, 0.6, 1]
        backgroundLayer.backgroundColor = (lightAppearance
            ? UIColor.black.withAlphaComponent(0.04)
            : UIColor.white.withAlphaComponent(0.04)).cgColor
        let peakColor = lightAppearance
            ? UIColor.black.withAlphaComponent(0.55)
            : UIColor.white.withAlphaComponent(0.9)
        for peak in peakLayers { peak.backgroundColor = peakColor.cgColor }
    }

    private func rebuildBars() {
        barLayers.forEach { $0.removeFromSuperlayer() }
        peakLayers.forEach { $0.removeFromSuperlayer() }
        barLayers = (0..<bandCount).map { _ in
            let bar = CALayer()
            bar.backgroundColor = UIColor.white.cgColor
            bar.cornerCurve = .continuous
            barsMask.addSublayer(bar)
            return bar
        }
        peakLayers = (0..<bandCount).map { _ in
            let cap = CALayer()
            cap.cornerCurve = .continuous
            layer.addSublayer(cap)
            return cap
        }
        levels = Array(repeating: 0, count: bandCount)
        velocities = Array(repeating: 0, count: bandCount)
        peaks = Array(repeating: 0, count: bandCount)
        peakHold = Array(repeating: 0, count: bandCount)
        peakVelocity = Array(repeating: 0, count: bandCount)
        applyColors()
        setNeedsLayout()
    }

    private func startIfNeeded() {
        guard displayLink == nil, window != nil else { return }
        let link = CADisplayLink(target: WeakProxy(self), selector: #selector(WeakProxy.tick(_:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 120, preferred: 60)
        link.add(to: .main, forMode: .common)
        displayLink = link
        lastTime = 0
    }

    // MARK: - Animation (Winamp: natychmiastowy atak, grawitacyjne opadanie, wiszące szczyty)

    fileprivate func step(_ link: CADisplayLink) {
        let now = link.timestamp
        let dt = lastTime == 0 ? 1.0 / 60.0 : min(0.05, now - lastTime)
        lastTime = now

        let frame = visualizer?.snapshot(isPlaying: isPlaying)
        let gain = 1.05 * intensity * barScale
        let gravity = 5.5 * speed          // przyspieszenie opadania słupka (wysokości / s²)
        let peakGravity = 2.2 * speed
        var anyMotion = false

        for i in 0..<bandCount {
            let raw = isPlaying ? (frame?.spectrumBand(at: i) ?? 0) : 0
            let target = min(1, max(0, raw * gain))
            if target >= levels[i] {
                levels[i] = target
                velocities[i] = 0
            } else {
                velocities[i] += gravity * dt
                levels[i] = max(target, levels[i] - velocities[i] * dt)
            }

            if levels[i] >= peaks[i] {
                peaks[i] = levels[i]
                peakHold[i] = 0.32
                peakVelocity[i] = 0
            } else if peakHold[i] > 0 {
                peakHold[i] -= dt
            } else {
                peakVelocity[i] += peakGravity * dt
                peaks[i] = max(levels[i], peaks[i] - peakVelocity[i] * dt)
            }
            if levels[i] > 0.002 || peaks[i] > 0.002 { anyMotion = true }
        }

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layoutBars()
        CATransaction.commit()

        if !isPlaying, !anyMotion { stop() }
    }

    private func layoutBars() {
        guard !barLayers.isEmpty, bounds.width > 4, bounds.height > 4 else { return }
        let inset: CGFloat = max(6, bounds.width * 0.015)
        let usableW = bounds.width - inset * 2
        let usableH = bounds.height - inset * 2
        let gap = max(2, min(6, usableW / CGFloat(bandCount) * 0.22))
        let barW = max(2, (usableW - gap * CGFloat(bandCount - 1)) / CGFloat(bandCount))
        let radius = min(barW / 2, 5)
        let capH = max(2, min(4, usableH * 0.012))
        let minBar = max(3, capH)

        for i in 0..<bandCount {
            let x = inset + CGFloat(i) * (barW + gap)
            let h = max(minBar, CGFloat(levels[i]) * usableH)
            let bar = barLayers[i]
            bar.frame = CGRect(x: x, y: inset + usableH - h, width: barW, height: h)
            bar.cornerRadius = radius

            let cap = peakLayers[i]
            let peakY = inset + usableH - CGFloat(peaks[i]) * usableH - capH - 2
            cap.frame = CGRect(x: x, y: max(inset, peakY), width: barW, height: capH)
            cap.cornerRadius = capH / 2
            cap.opacity = peaks[i] > 0.03 ? 1 : 0
        }
    }
}

/// CADisplayLink trzyma silną referencję do celu — proxy pozwala zwolnić widok.
private final class WeakProxy: NSObject {
    weak var target: WinampSpectrumUIView?
    init(_ target: WinampSpectrumUIView) { self.target = target }
    @objc func tick(_ link: CADisplayLink) {
        if let target { target.step(link) } else { link.invalidate() }
    }
}

import QuartzCore
import SwiftUI
import UIKit

@MainActor
final class MixerLampDriver: NSObject, ObservableObject {
    @Published private(set) var output = DJConsoleLampEngine.Output()

    private let engine = DJConsoleLampEngine()
    private weak var visualizer: PlayerAudioVisualizer?
    private var displayLink: CADisplayLink?
    private var isPlaying = false
    private var onServer = false
    private var lastDraw: CFTimeInterval = 0

    override init() {
        super.init()
    }

    func start(visualizer: PlayerAudioVisualizer, isPlaying: Bool, onServer: Bool) {
        self.visualizer = visualizer
        self.isPlaying = isPlaying
        self.onServer = onServer
        if isPlaying {
            guard displayLink == nil else { return }
            let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
            link.preferredFrameRateRange = CAFrameRateRange(minimum: 8, maximum: 12, preferred: 10)
            link.add(to: .main, forMode: .common)
            displayLink = link
        } else {
            stop()
            output = engine.process(frame: MusicPlaybackEngine.AudioReactiveFrame(), isPlaying: false, onServer: onServer)
        }
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    deinit { displayLink?.invalidate() }

    @objc private func tick(_ link: CADisplayLink) {
        if link.timestamp - lastDraw < 1.0 / 12 { return }
        lastDraw = link.timestamp
        let frame = visualizer?.snapshot(isPlaying: isPlaying) ?? MusicPlaybackEngine.AudioReactiveFrame()
        output = engine.process(frame: frame, isPlaying: isPlaying, onServer: onServer)
    }
}

struct MixerLampHost: UIViewRepresentable {
    var visualizer: PlayerAudioVisualizer
    var isPlaying: Bool
    var onServer: Bool
    var compact: Bool

    func makeUIView(context: Context) -> MixerLampUIView {
        let view = MixerLampUIView()
        view.configure(visualizer: visualizer, isPlaying: isPlaying, onServer: onServer, compact: compact)
        return view
    }

    func updateUIView(_ uiView: MixerLampUIView, context: Context) {
        uiView.configure(visualizer: visualizer, isPlaying: isPlaying, onServer: onServer, compact: compact)
    }

    static func dismantleUIView(_ uiView: MixerLampUIView, coordinator: ()) {
        uiView.stop()
    }
}

final class MixerLampUIView: UIView {
    private weak var visualizer: PlayerAudioVisualizer?
    private var displayLink: CADisplayLink?
    private var isPlaying = false
    private var onServer = false
    private var compact = false
    private let engine = DJConsoleLampEngine()
    private var lastDraw: CFTimeInterval = 0
    private let leds: [(label: String, color: UIColor, layer: CALayer)] = {
        let specs: [(String, UIColor)] = [
            ("BEAT", UIColor(red: 0.22, green: 0.86, blue: 0.38, alpha: 1)),
            ("RYTM", UIColor(red: 1.0, green: 0.72, blue: 0.16, alpha: 1)),
            ("EOS", UIColor(red: 0.18, green: 0.72, blue: 0.95, alpha: 1)),
            ("OUT", UIColor(red: 0.22, green: 0.86, blue: 0.38, alpha: 1)),
            ("CLIP", UIColor(red: 0.98, green: 0.22, blue: 0.28, alpha: 1))
        ]
        return specs.map { spec in
            let layer = CALayer()
            layer.cornerRadius = 4
            layer.backgroundColor = spec.1.cgColor
            return (spec.0, spec.1, layer)
        }
    }()

    override init(frame: CGRect) {
        super.init(frame: frame)
        isOpaque = false
        backgroundColor = .clear
        leds.forEach { layer.addSublayer($0.layer) }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    deinit { stop() }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: compact ? 28 : 34)
    }

    func configure(visualizer: PlayerAudioVisualizer, isPlaying: Bool, onServer: Bool, compact: Bool) {
        self.visualizer = visualizer
        self.onServer = onServer
        self.compact = compact
        self.isPlaying = isPlaying
        if isPlaying { start() } else { stop(); apply(engine.process(frame: MusicPlaybackEngine.AudioReactiveFrame(), isPlaying: false, onServer: onServer)) }
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    private func start() {
        guard displayLink == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 8, maximum: 12, preferred: 10)
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    @objc private func tick(_ link: CADisplayLink) {
        if link.timestamp - lastDraw < 1.0 / 12 { return }
        lastDraw = link.timestamp
        let frame = visualizer?.snapshot(isPlaying: isPlaying) ?? MusicPlaybackEngine.AudioReactiveFrame()
        apply(engine.process(frame: frame, isPlaying: isPlaying, onServer: onServer))
    }

    private func apply(_ out: DJConsoleLampEngine.Output) {
        let values = [out.beat, out.rytm, out.eos, out.out, out.clip]
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        for (index, led) in leds.enumerated() {
            led.layer.opacity = Float(max(0.12, values[index]))
        }
        CATransaction.commit()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let w = bounds.width
        let h = bounds.height
        let lampW = min(36, w / 6)
        let xs: [CGFloat] = [8, 8 + lampW + 8, 8 + (lampW + 8) * 2, w - (lampW + 8) * 2, w - lampW - 8]
        for (index, led) in leds.enumerated() {
            led.layer.frame = CGRect(x: xs[safe: index] ?? 8, y: (h - 8) / 2, width: 8, height: 8)
        }
    }
}

struct MixerMeterHost: UIViewRepresentable {
    enum Channel { case left, right }
    var visualizer: PlayerAudioVisualizer
    var isPlaying: Bool
    var channel: Channel
    var drive: Double

    func makeUIView(context: Context) -> MixerMeterUIView {
        let view = MixerMeterUIView()
        view.configure(visualizer: visualizer, isPlaying: isPlaying, channel: channel, drive: drive)
        return view
    }

    func updateUIView(_ uiView: MixerMeterUIView, context: Context) {
        uiView.configure(visualizer: visualizer, isPlaying: isPlaying, channel: channel, drive: drive)
    }

    static func dismantleUIView(_ uiView: MixerMeterUIView, coordinator: ()) {
        uiView.stop()
    }
}

final class MixerMeterUIView: UIView {
    private weak var visualizer: PlayerAudioVisualizer?
    private var displayLink: CADisplayLink?
    private var isPlaying = false
    private var channel = MixerMeterHost.Channel.left
    private var drive = 0.4
    private let fill = CALayer()
    private var lastDraw: CFTimeInterval = 0

    override init(frame: CGRect) {
        super.init(frame: frame)
        isOpaque = false
        backgroundColor = UIColor(white: 0.08, alpha: 1)
        layer.cornerRadius = 3
        layer.masksToBounds = true
        fill.backgroundColor = UIColor.systemGreen.cgColor
        layer.addSublayer(fill)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    deinit { stop() }

    func configure(visualizer: PlayerAudioVisualizer, isPlaying: Bool, channel: MixerMeterHost.Channel, drive: Double) {
        self.visualizer = visualizer
        self.channel = channel
        self.drive = drive
        self.isPlaying = isPlaying
        if isPlaying { start() } else { stop(); setLevel(0.08) }
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    private func start() {
        guard displayLink == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 8, maximum: 12, preferred: 10)
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    @objc private func tick(_ link: CADisplayLink) {
        if link.timestamp - lastDraw < 1.0 / 12 { return }
        lastDraw = link.timestamp
        let frame = visualizer?.snapshot(isPlaying: isPlaying) ?? MusicPlaybackEngine.AudioReactiveFrame()
        let raw: Double
        switch channel {
        case .left:
            raw = max(frame.bass, frame.beat * 0.92, frame.level * 0.68)
        case .right:
            raw = max(frame.treble, frame.mid * 0.88, frame.level * 0.62)
        }
        setLevel(min(1, raw * (0.78 + drive * 0.52)))
    }

    private func setLevel(_ value: Double) {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        let h = bounds.height * CGFloat(value)
        fill.frame = CGRect(x: 0, y: bounds.height - h, width: bounds.width, height: h)
        CATransaction.commit()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        setLevel(0.12)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}


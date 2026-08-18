import SwiftUI
import UIKit

/// Mini-player / island EQ — UIKit CADisplayLink polls live visualizer (no SwiftUI TimelineView).
struct IslandBarsHost: UIViewRepresentable {
    var visualizer: PlayerAudioVisualizer
    var isPlaying: Bool
    var compact: Bool = true
    /// Full-player under artwork — larger capsule.
    var prominent: Bool = false

    func makeUIView(context: Context) -> IslandBarsUIView {
        let view = IslandBarsUIView()
        view.configure(visualizer: visualizer, isPlaying: isPlaying, compact: compact, prominent: prominent)
        return view
    }

    func updateUIView(_ uiView: IslandBarsUIView, context: Context) {
        uiView.configure(visualizer: visualizer, isPlaying: isPlaying, compact: compact, prominent: prominent)
    }

    static func dismantleUIView(_ uiView: IslandBarsUIView, coordinator: ()) {
        uiView.stop()
    }
}

final class IslandBarsUIView: UIView {
    private weak var visualizer: PlayerAudioVisualizer?
    private var displayLink: CADisplayLink?
    private var isPlaying = false
    private var compact = true
    private var prominent = false
    private var levels: [CGFloat] = Array(repeating: 0.2, count: 5)
    private var lastDrawAt: CFTimeInterval = 0
    private let targetFPS: CFTimeInterval = 24

    override init(frame: CGRect) {
        super.init(frame: frame)
        isOpaque = false
        backgroundColor = .clear
        contentMode = .redraw
        isUserInteractionEnabled = false
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit { stop() }

    func configure(visualizer: PlayerAudioVisualizer, isPlaying: Bool, compact: Bool, prominent: Bool = false) {
        self.visualizer = visualizer
        let playingChanged = self.isPlaying != isPlaying
        let sizeChanged = self.compact != compact || self.prominent != prominent
        self.isPlaying = isPlaying
        self.compact = compact
        self.prominent = prominent
        if sizeChanged {
            invalidateIntrinsicContentSize()
        }
        if isPlaying {
            start()
            if playingChanged {
                setNeedsDisplay()
            }
        } else {
            stop()
            levels = [0.35, 0.55, 0.85, 0.5, 0.4].map { $0 * 0.35 }
            setNeedsDisplay()
        }
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    private func start() {
        guard displayLink == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(onFrame(_:)))
        if #available(iOS 15.0, *) {
            link.preferredFrameRateRange = CAFrameRateRange(minimum: 20, maximum: 30, preferred: 24)
        } else {
            link.preferredFramesPerSecond = 24
        }
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    @objc private func onFrame(_ link: CADisplayLink) {
        guard link.timestamp - lastDrawAt >= (1.0 / targetFPS) - 0.002 else { return }
        lastDrawAt = link.timestamp
        let frame = visualizer?.snapshot(isPlaying: isPlaying) ?? .init()
        var next = levels
        for i in 0..<5 {
            let target = CGFloat(min(1, max(0, frame.islandBar(at: i))))
            if target > next[i] {
                next[i] += (target - next[i]) * 0.72
            } else {
                next[i] += (target - next[i]) * 0.38
            }
        }
        levels = next
        setNeedsDisplay()
    }

    override var intrinsicContentSize: CGSize {
        if prominent { return CGSize(width: 132, height: 40) }
        return compact ? CGSize(width: 58, height: 24) : CGSize(width: 72, height: 30)
    }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        let capsule = UIBezierPath(roundedRect: rect, cornerRadius: rect.height / 2)
        ctx.setFillColor(UIColor.black.withAlphaComponent(0.88).cgColor)
        ctx.addPath(capsule.cgPath)
        ctx.fillPath()
        ctx.setStrokeColor(UIColor.white.withAlphaComponent(0.1).cgColor)
        ctx.setLineWidth(0.6)
        ctx.addPath(capsule.cgPath)
        ctx.strokePath()

        let barCount = 5
        let spacing: CGFloat = prominent ? 4.2 : (compact ? 2.2 : 3.2)
        let barW: CGFloat = prominent ? 4.0 : (compact ? 2.4 : 2.8)
        let minH: CGFloat = prominent ? 5 : (compact ? 3 : 4)
        let maxH: CGFloat = prominent ? 26 : (compact ? 14 : 18)
        let totalW = CGFloat(barCount) * barW + CGFloat(barCount - 1) * spacing
        var x = (rect.width - totalW) / 2
        let midY = rect.midY
        ctx.setFillColor(UIColor.white.withAlphaComponent(isPlaying ? 0.94 : 0.45).cgColor)
        for i in 0..<barCount {
            let level = i < levels.count ? levels[i] : 0.2
            let h = minH + level * (maxH - minH)
            let bar = CGRect(x: x, y: midY - h / 2, width: barW, height: h)
            let path = UIBezierPath(roundedRect: bar, cornerRadius: 1.2)
            ctx.addPath(path.cgPath)
            ctx.fillPath()
            x += barW + spacing
        }
    }
}

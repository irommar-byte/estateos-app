import SwiftUI
import UIKit

/// Winamp EQ rendered on a dedicated UIView + CADisplayLink.
/// Avoids SwiftUI `TimelineView` body rebuilds that freeze the full player on device.
struct WinampSpectrumHost: UIViewRepresentable {
    var visualizer: PlayerAudioVisualizer
    var isPlaying: Bool
    var intensity: Double
    var bandCount: Int
    var compact: Bool

    func makeUIView(context: Context) -> WinampSpectrumUIView {
        let view = WinampSpectrumUIView()
        view.configure(
            visualizer: visualizer,
            isPlaying: isPlaying,
            intensity: intensity,
            bandCount: bandCount,
            compact: compact
        )
        return view
    }

    func updateUIView(_ uiView: WinampSpectrumUIView, context: Context) {
        uiView.configure(
            visualizer: visualizer,
            isPlaying: isPlaying,
            intensity: intensity,
            bandCount: bandCount,
            compact: compact
        )
    }

    static func dismantleUIView(_ uiView: WinampSpectrumUIView, coordinator: ()) {
        uiView.stop()
    }
}

final class WinampSpectrumUIView: UIView {
    private let envelope = WinampEnvelopeDriver()
    private weak var visualizer: PlayerAudioVisualizer?
    private var displayLink: CADisplayLink?
    private var isPlaying = false
    private var intensity: Double = 1
    private var bandCount = MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard
    private var compact = false
    private var lastDrawAt: CFTimeInterval = 0
    private let targetFPS: CFTimeInterval = 30
    private var snap: (
        levels: [Double],
        peaks: [Double],
        bass: Double,
        mid: Double,
        treble: Double,
        bassPeak: Double,
        midPeak: Double,
        treblePeak: Double
    ) = (
        levels: Array(repeating: 0, count: 24),
        peaks: Array(repeating: 0, count: 24),
        bass: 0, mid: 0, treble: 0,
        bassPeak: 0, midPeak: 0, treblePeak: 0
    )

    override init(frame: CGRect) {
        super.init(frame: frame)
        isOpaque = true
        backgroundColor = UIColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1)
        layer.cornerRadius = 8
        layer.masksToBounds = true
        layer.borderWidth = 0.5
        layer.borderColor = UIColor.white.withAlphaComponent(0.12).cgColor
        contentMode = .redraw
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        stop()
    }

    func configure(
        visualizer: PlayerAudioVisualizer,
        isPlaying: Bool,
        intensity: Double,
        bandCount: Int,
        compact: Bool
    ) {
        self.visualizer = visualizer
        let nextBands = max(8, min(MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountMax, bandCount))
        let bandChanged = self.bandCount != nextBands
        let playingChanged = self.isPlaying != isPlaying
        let compactChanged = self.compact != compact
        let intensityChanged = abs(self.intensity - intensity) > 0.01

        // Idempotent — SwiftUI may call updateUIView often; never restart the link needlessly.
        guard bandChanged || playingChanged || compactChanged || intensityChanged || (displayLink == nil && isPlaying) else {
            return
        }

        self.isPlaying = isPlaying
        self.intensity = intensity
        self.bandCount = nextBands
        self.compact = compact
        if bandChanged {
            envelope.reset()
        }
        if isPlaying {
            start()
        } else {
            tick(force: true)
            stop()
            setNeedsDisplay()
        }
        if compactChanged {
            invalidateIntrinsicContentSize()
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
            link.preferredFrameRateRange = CAFrameRateRange(minimum: 24, maximum: 60, preferred: 30)
        } else {
            link.preferredFramesPerSecond = 30
        }
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    @objc private func onFrame(_ link: CADisplayLink) {
        let minInterval = 1.0 / targetFPS
        guard link.timestamp - lastDrawAt >= minInterval - 0.002 else { return }
        lastDrawAt = link.timestamp
        tick(force: false)
        setNeedsDisplay()
    }

    private func tick(force: Bool) {
        _ = force
        // Live PCM frame from MTAudioProcessingTap → visualizer lock (real song energy).
        let frame = visualizer?.snapshot(isPlaying: isPlaying)
            ?? MusicPlaybackEngine.AudioReactiveFrame()
        snap = envelope.snapshot(
            at: CACurrentMediaTime(),
            frame: frame,
            bandCount: bandCount,
            intensity: intensity,
            isPlaying: isPlaying
        )
    }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: compact ? 150 : 208)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        setNeedsDisplay()
    }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        ctx.setFillColor(UIColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1).cgColor)
        ctx.fill(rect)

        let narrow = rect.width < 340
        let pad: CGFloat = narrow ? 6 : 10
        let headerH: CGFloat = narrow ? 12 : 16
        let labelH: CGFloat = narrow ? 10 : 14
        let gap: CGFloat = narrow ? 4 : 8
        let channelGap: CGFloat = narrow ? 4 : (rect.width < 390 ? 6 : 10)
        let bandLabelReserve: CGFloat = narrow ? 12 : 14
        let contentW = max(0, rect.width - pad * 2)
        var channelW = max(18, (contentW - channelGap * 2) / 3)
        if channelW * 3 + channelGap * 2 > contentW {
            channelW = max(14, (contentW - channelGap * 2) / 3)
        }

        let headerFontSize: CGFloat = narrow ? 9 : 11
        let titleFontSize: CGFloat = narrow ? 8 : 10
        let bandFontSize: CGFloat = narrow ? 6 : (compact ? 6 : 7)

        // Reserve EQ strip first — on iPhone the view is often ~150 pt tall; old math gave eqRect.height = 0.
        let minEQH: CGFloat = compact ? 36 : 44
        let usableH = max(0, rect.height - pad * 2 - headerH - bandLabelReserve)
        let eqH = max(minEQH, usableH * (compact ? 0.42 : 0.48))
        let vuBlockH = max(24, usableH - eqH - labelH - gap)
        let vuH = min(compact ? 48 : 62, vuBlockH)

        let headerAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: headerFontSize, weight: .heavy),
            .foregroundColor: UIColor(red: 0.45, green: 0.95, blue: 0.35, alpha: 0.9),
            .kern: 1.0
        ]
        let header = "SPECTRUM EQ" as NSString
        header.draw(at: CGPoint(x: pad, y: pad - 2), withAttributes: headerAttrs)
        let bandAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.monospacedDigitSystemFont(ofSize: narrow ? 8 : 9, weight: .semibold),
            .foregroundColor: UIColor(white: 0.45, alpha: 1)
        ]
        let bandText = "\(bandCount)" as NSString
        let bandSize = bandText.size(withAttributes: bandAttrs)
        bandText.draw(at: CGPoint(x: rect.maxX - pad - bandSize.width, y: pad), withAttributes: bandAttrs)

        let channels: [(String, Double, Double)] = [
            ("BASS", snap.bass, snap.bassPeak),
            ("MID", snap.mid, snap.midPeak),
            ("TREBLE", snap.treble, snap.treblePeak)
        ]

        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: titleFontSize, weight: .heavy),
            .foregroundColor: UIColor(white: 0.58, alpha: 1),
            .kern: 0.5
        ]

        let vuTop = pad + headerH
        for (i, ch) in channels.enumerated() {
            let x = pad + CGFloat(i) * (channelW + channelGap)
            let title = ch.0 as NSString
            let titleSize = title.size(withAttributes: titleAttrs)
            title.draw(
                at: CGPoint(x: x + (channelW - titleSize.width) / 2, y: vuTop),
                withAttributes: titleAttrs
            )

            let meter = CGRect(x: x, y: vuTop + labelH, width: channelW, height: vuH)
            ctx.setFillColor(UIColor.black.cgColor)
            ctx.setStrokeColor(UIColor.white.withAlphaComponent(0.14).cgColor)
            ctx.setLineWidth(0.5)
            let meterPath = UIBezierPath(roundedRect: meter, cornerRadius: 3)
            ctx.addPath(meterPath.cgPath)
            ctx.drawPath(using: .fillStroke)

            let inset = WinampSpectrumStyle.channelInset
            let level = WinampSpectrumStyle.quantizeLevel(isPlaying ? ch.1 : ch.1 * 0.15)
            let peak = WinampSpectrumStyle.quantizeLevel(isPlaying ? max(level, ch.2) : level)
            drawBarColumn(in: meter.insetBy(dx: inset, dy: inset), level: level, peak: peak, ctx: ctx)
        }

        let eqTop = vuTop + labelH + vuH + gap
        let eqRect = CGRect(x: pad, y: eqTop, width: contentW, height: max(minEQH, rect.height - eqTop - pad - bandLabelReserve))
        ctx.setFillColor(UIColor.black.withAlphaComponent(0.55).cgColor)
        ctx.fill(eqRect.insetBy(dx: -2, dy: -2))
        ctx.setStrokeColor(UIColor.white.withAlphaComponent(0.08).cgColor)
        ctx.setLineWidth(0.5)
        for tick in 1..<4 {
            let y = eqRect.minY + eqRect.height * CGFloat(tick) / 4
            ctx.move(to: CGPoint(x: eqRect.minX, y: y))
            ctx.addLine(to: CGPoint(x: eqRect.maxX, y: y))
            ctx.strokePath()
        }

        let levels = snap.levels.map { isPlaying ? $0 : $0 * 0.12 }
        let peaks = snap.peaks.map { isPlaying ? $0 : $0 * 0.12 }
        drawEQBars(in: eqRect.insetBy(dx: 2, dy: 2), levels: levels, peaks: peaks, ctx: ctx)

        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.monospacedDigitSystemFont(ofSize: bandFontSize, weight: .medium),
            .foregroundColor: UIColor(white: 0.55, alpha: 0.7)
        ]
        let step = max(1, bandCount / 6)
        let bandW = eqRect.width / CGFloat(max(1, bandCount))
        for index in 0..<bandCount {
            guard index % step == 0 || index == bandCount - 1 else { continue }
            let text = bandLabel(for: index) as NSString
            let size = text.size(withAttributes: labelAttrs)
            let x = eqRect.minX + CGFloat(index) * bandW + (bandW - size.width) / 2
            text.draw(at: CGPoint(x: x, y: rect.maxY - pad - size.height + 2), withAttributes: labelAttrs)
        }
    }

    private func bandLabel(for index: Int) -> String {
        let hz = 32.0 * pow(20_000.0 / 32.0, Double(index) / Double(max(1, bandCount - 1)))
        if hz >= 1000 {
            let k = hz / 1000
            return k >= 10 ? String(format: "%.0fk", k) : String(format: "%.1fk", k)
        }
        return String(format: "%.0f", hz)
    }

    private func drawBarColumn(in rect: CGRect, level: Double, peak: Double, ctx: CGContext) {
        guard rect.width > 0, rect.height > 0 else { return }
        let segments = WinampSpectrumStyle.segmentCount
        let lit = Int(round(min(1, max(0, level)) * Double(segments)))
        let peakLit = Int(round(min(1, max(0, peak)) * Double(segments)))
        let segmentH = max(1, floor(rect.height / CGFloat(segments)))

        for segment in 0..<lit {
            let y = rect.maxY - CGFloat(segment + 1) * segmentH
            let color = UIColor(WinampSpectrumStyle.barColor(segmentFromBottom: segment))
            ctx.setFillColor(color.cgColor)
            ctx.fill(CGRect(x: rect.minX, y: y, width: rect.width, height: segmentH - 0.5))
        }
        if peakLit > lit {
            let y = rect.maxY - CGFloat(peakLit) * segmentH
            let color = UIColor(WinampSpectrumStyle.peakColor(forLevel: Double(peakLit) / Double(segments)))
            ctx.setFillColor(color.cgColor)
            ctx.fill(CGRect(x: rect.minX, y: y, width: rect.width, height: segmentH - 0.5))
        }
    }

    private func drawEQBars(in rect: CGRect, levels: [Double], peaks: [Double], ctx: CGContext) {
        guard bandCount > 0, rect.width > 0, rect.height > 0 else { return }
        let spacing: CGFloat = 1
        let totalSpacing = spacing * CGFloat(max(0, bandCount - 1))
        let barW = max(1, (rect.width - totalSpacing) / CGFloat(bandCount))
        for index in 0..<bandCount {
            let x = rect.minX + CGFloat(index) * (barW + spacing)
            let level = index < levels.count ? levels[index] : 0
            let peak = index < peaks.count ? peaks[index] : 0
            drawBarColumn(
                in: CGRect(x: x, y: rect.minY, width: barW, height: rect.height),
                level: level,
                peak: peak,
                ctx: ctx
            )
        }
    }
}

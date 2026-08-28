import SwiftUI
import UIKit

/// Winamp EQ rendered on a dedicated UIView + CADisplayLink.
/// Avoids SwiftUI `TimelineView` body rebuilds that freeze the full player on device.
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
        return view
    }

    func updateUIView(_ uiView: WinampSpectrumUIView, context: Context) {
        uiView.configure(
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
    private let envelope = WinampEnvelopeDriver()
    private weak var visualizer: PlayerAudioVisualizer?
    private var displayLink: CADisplayLink?
    private var isPlaying = false
    private var intensity: Double = 1
    private var bandCount = MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard
    private var barScale: Double = 1.0
    private var speed: Double = 1.0
    private var compact = false
    private var lightAppearance = false
    private var lastDrawAt: CFTimeInterval = 0
    private var targetFPS: CFTimeInterval = 24
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
        applyChromeStyle(light: false)
        contentMode = .redraw
    }

    private func applyChromeStyle(light: Bool) {
        isOpaque = true
        lightAppearance = light
        if light {
            backgroundColor = UIColor(red: 0.93, green: 0.94, blue: 0.96, alpha: 1)
            layer.borderColor = UIColor.black.withAlphaComponent(0.08).cgColor
        } else {
            backgroundColor = UIColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1)
            layer.borderColor = UIColor.white.withAlphaComponent(0.12).cgColor
        }
        layer.cornerRadius = 8
        layer.masksToBounds = true
        layer.borderWidth = 0.5
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
        barScale: Double,
        speed: Double,
        compact: Bool,
        lightAppearance: Bool = false
    ) {
        self.visualizer = visualizer
        let nextBands = max(8, min(MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountMax, bandCount))
        let nextScale = min(1.5, max(0.5, barScale))
        let nextSpeed = min(1.6, max(0.4, speed))
        let bandChanged = self.bandCount != nextBands
        let scaleChanged = abs(self.barScale - nextScale) > 0.02
        let speedChanged = abs(self.speed - nextSpeed) > 0.03
        let playingChanged = self.isPlaying != isPlaying
        let compactChanged = self.compact != compact
        let intensityChanged = abs(self.intensity - intensity) > 0.01
        let appearanceChanged = self.lightAppearance != lightAppearance

        // Idempotent — SwiftUI may call updateUIView often; never restart the link needlessly.
        guard bandChanged || scaleChanged || speedChanged || playingChanged || compactChanged || intensityChanged || appearanceChanged || (displayLink == nil && isPlaying) else {
            return
        }

        self.isPlaying = isPlaying
        self.intensity = intensity
        self.bandCount = nextBands
        self.lightAppearance = lightAppearance
        if appearanceChanged {
            applyChromeStyle(light: lightAppearance)
        }
        self.barScale = nextScale
        self.speed = nextSpeed
        self.compact = compact
        self.targetFPS = min(24, max(16, 10 + 12 * nextSpeed))
        if bandChanged {
            envelope.reset()
        }
        if isPlaying {
            if speedChanged {
                stop()
            }
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
        let fps = max(16, min(24, targetFPS))
        if #available(iOS 15.0, *) {
            link.preferredFrameRateRange = CAFrameRateRange(
                minimum: 16,
                maximum: Float(min(30, fps + 4)),
                preferred: Float(fps)
            )
        } else {
            link.preferredFramesPerSecond = Int(fps.rounded())
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
            isPlaying: isPlaying,
            speed: speed
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
        if lightAppearance {
            ctx.setFillColor(UIColor(red: 0.93, green: 0.94, blue: 0.96, alpha: 1).cgColor)
        } else {
            ctx.setFillColor(UIColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1).cgColor)
        }
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

        // EQ bars get most of the height so they can jump to the top; BASS/MID/TREBLE stay compact.
        let minEQH: CGFloat = compact ? 52 : 64
        let usableH = max(0, rect.height - pad * 2 - headerH - bandLabelReserve)
        let vuH = min(compact ? 22 : 28, max(16, usableH * 0.18))
        let eqH = max(minEQH, usableH - vuH - labelH - gap)

        let headerColor = lightAppearance
            ? UIColor(red: 0.12, green: 0.58, blue: 0.22, alpha: 0.95)
            : UIColor(red: 0.45, green: 0.95, blue: 0.35, alpha: 0.9)
        let headerAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: headerFontSize, weight: .heavy),
            .foregroundColor: headerColor,
            .kern: 1.0
        ]
        let header = "SPECTRUM EQ" as NSString
        header.draw(at: CGPoint(x: pad, y: pad - 2), withAttributes: headerAttrs)
        let bandAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.monospacedDigitSystemFont(ofSize: narrow ? 8 : 9, weight: .semibold),
            .foregroundColor: lightAppearance ? UIColor(white: 0.38, alpha: 1) : UIColor(white: 0.45, alpha: 1)
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
            .foregroundColor: lightAppearance ? UIColor(white: 0.42, alpha: 1) : UIColor(white: 0.58, alpha: 1),
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
            ctx.setFillColor((lightAppearance ? UIColor(white: 0.88, alpha: 1) : UIColor.black).cgColor)
            ctx.setStrokeColor(
                (lightAppearance ? UIColor.black.withAlphaComponent(0.12) : UIColor.white.withAlphaComponent(0.14)).cgColor
            )
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
        let eqRect = CGRect(
            x: pad,
            y: eqTop,
            width: contentW,
            height: min(eqH, max(minEQH, rect.height - eqTop - pad - bandLabelReserve))
        )
        ctx.setFillColor(
            (lightAppearance ? UIColor.white.withAlphaComponent(0.72) : UIColor.black.withAlphaComponent(0.55)).cgColor
        )
        ctx.fill(eqRect.insetBy(dx: -2, dy: -2))
        ctx.setStrokeColor(
            (lightAppearance ? UIColor.black.withAlphaComponent(0.08) : UIColor.white.withAlphaComponent(0.08)).cgColor
        )
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
            .foregroundColor: lightAppearance ? UIColor(white: 0.48, alpha: 0.85) : UIColor(white: 0.55, alpha: 0.7)
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
        let gap: CGFloat = 0.5

        for segment in 0..<max(lit, peakLit) {
            let y1 = rect.maxY - CGFloat(segment) / CGFloat(segments) * rect.height
            let y0 = rect.maxY - CGFloat(segment + 1) / CGFloat(segments) * rect.height
            let slice = CGRect(x: rect.minX, y: y0, width: rect.width, height: max(0.5, y1 - y0 - gap))
            if segment < lit {
                ctx.setFillColor(UIColor(WinampSpectrumStyle.barColor(segmentFromBottom: segment)).cgColor)
                ctx.fill(slice)
            } else if segment + 1 == peakLit {
                ctx.setFillColor(UIColor(WinampSpectrumStyle.peakColor(forLevel: Double(peakLit) / Double(segments))).cgColor)
                ctx.fill(slice)
            }
        }
    }

    private func drawEQBars(in rect: CGRect, levels: [Double], peaks: [Double], ctx: CGContext) {
        guard bandCount > 0, rect.width > 0, rect.height > 0 else { return }
        let spacing: CGFloat = 1
        let totalSpacing = spacing * CGFloat(max(0, bandCount - 1))
        let baseBarW = max(1, (rect.width - totalSpacing) / CGFloat(bandCount))
        let barW = min(baseBarW * CGFloat(barScale), rect.width / max(1, CGFloat(bandCount) * 0.55))
        let clusterW = barW * CGFloat(bandCount) + totalSpacing
        let startX = rect.minX + max(0, (rect.width - clusterW) / 2)
        for index in 0..<bandCount {
            let x = startX + CGFloat(index) * (barW + spacing)
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

import SwiftUI

/// Classic Winamp spectrum — kolory, segmenty LED i rysowanie słupków.
enum WinampSpectrumStyle {
    /// Winamp vis_classic: falloffrate = 12 na skali 0…255.
    static let falloffRate = 12
    /// Domyślny peakchangerate = 80 klatek zaniku.
    static let peakChangeRate = 80
    /// Segmenty LED (Winamp clamp 0…15 → 16 stopni).
    static let segmentCount = 16

    /// Klasyczna paleta Winamp 2.x: zielony → żółty → czerwony (pozycja segmentu od dołu).
    static func barColor(segmentFromBottom: Int, totalSegments: Int = segmentCount) -> Color {
        let t = Double(segmentFromBottom) / Double(max(1, totalSegments - 1))
        if t < 0.55 {
            let u = t / 0.55
            return Color(
                red: u * 0.95,
                green: 0.78 + u * 0.22,
                blue: 0.02
            )
        }
        let u = (t - 0.55) / 0.45
        return Color(
            red: 0.95 + u * 0.05,
            green: max(0, 1.0 - u * 0.98),
            blue: 0.02 * (1 - u)
        )
    }

    /// Peak indicator — jasny żółto-biały jak w Winampie.
    static func peakColor(forLevel level: Double) -> Color {
        if level > 0.82 {
            return Color(red: 1, green: 1, blue: 0.92)
        }
        return Color(red: 1, green: 0.98, blue: 0.55)
    }

    static let background = Color.black
    static let gridLine = Color.white.opacity(0.08)
    static let labelSecondary = Color(white: 0.55)
    static let channelInset: CGFloat = 2
    /// Odświeżanie animacji słupków (Hz) — UIKit host; 24 Hz looks live without extra GPU heat.
    static let displayFPS: Double = 24
    /// Szybsze opadanie niż klasyczny vis_classic — EQ ma „latać”, nie pełzać.
    static let falloffNormPerSecond: Double = Double(falloffRate) * 96.0 / 255.0 * 1.85

    /// Kwantyzacja poziomu do dyskretnych segmentów LED.
    static func quantizeLevel(_ normalized: Double) -> Double {
        let clamped = min(1, max(0, normalized))
        let steps = Double(segmentCount)
        let quantized = floor(clamped * steps) / steps
        if clamped > 0.015, quantized == 0 {
            return 1 / steps
        }
        return quantized
    }
}

/// Envelope UI @ 120 Hz — szybki atak, Winamp-style opadanie (nie dotyczy próbkowania dźwięku).
struct WinampDisplayEnvelope {
    var levels: [Double]
    var peaks: [Double]
    var peakFallStep: [Double]
    var bassLevel: Double = 0
    var midLevel: Double = 0
    var trebleLevel: Double = 0
    var bassPeak: Double = 0
    var midPeak: Double = 0
    var treblePeak: Double = 0
    private var lastTime: TimeInterval?

    init(capacity: Int = MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountMax) {
        levels = Array(repeating: 0, count: capacity)
        peaks = Array(repeating: 0, count: capacity)
        peakFallStep = Array(repeating: 3.0 / 255.0, count: capacity)
    }

    mutating func reset() {
        levels = Array(repeating: 0, count: levels.count)
        peaks = Array(repeating: 0, count: peaks.count)
        peakFallStep = Array(repeating: 3.0 / 255.0, count: peakFallStep.count)
        bassLevel = 0
        midLevel = 0
        trebleLevel = 0
        bassPeak = 0
        midPeak = 0
        treblePeak = 0
        lastTime = nil
    }

    mutating func step(
        time: TimeInterval,
        frame: MusicPlaybackEngine.AudioReactiveFrame,
        bandCount: Int,
        intensity: Double,
        isPlaying: Bool,
        speed: Double = 1.0
    ) {
        let dt = min(0.04, lastTime.map { time - $0 } ?? (1.0 / WinampSpectrumStyle.displayFPS))
        lastTime = time
        let speedMul = min(1.85, max(0.35, speed))
        let gain = min(1.06, max(0.75, intensity))
        let fall = WinampSpectrumStyle.falloffNormPerSecond * dt * (isPlaying ? 1.75 : 0.4) * speedMul
        let peakFallBase = (8.0 / 255.0) * (dt * WinampSpectrumStyle.displayFPS) * speedMul

        for index in 0..<bandCount {
            let target = WinampSpectrumStyle.quantizeLevel(min(1, frame.spectrumBand(at: index) * gain))
            if target >= levels[index] {
                levels[index] = target
            } else {
                levels[index] = max(target, levels[index] - fall)
            }

            if levels[index] >= peaks[index] {
                peaks[index] = levels[index]
                peakFallStep[index] = peakFallBase
            } else {
                peaks[index] = max(levels[index], peaks[index] - peakFallStep[index])
                peakFallStep[index] = min(0.08, peakFallStep[index] * 1.12)
            }
        }

        let bassTarget = WinampSpectrumStyle.quantizeLevel(min(1, frame.bass * gain))
        let midTarget = WinampSpectrumStyle.quantizeLevel(min(1, max(frame.mid, frame.beat * 0.28) * gain))
        let trebleTarget = WinampSpectrumStyle.quantizeLevel(min(1, frame.treble * gain))
        bassLevel = advanceChannel(bassLevel, target: bassTarget, fall: fall)
        midLevel = advanceChannel(midLevel, target: midTarget, fall: fall)
        trebleLevel = advanceChannel(trebleLevel, target: trebleTarget, fall: fall)
        bassPeak = advancePeak(current: bassPeak, level: bassLevel, dt: dt)
        midPeak = advancePeak(current: midPeak, level: midLevel, dt: dt)
        treblePeak = advancePeak(current: treblePeak, level: trebleLevel, dt: dt)
    }

    private mutating func advanceChannel(_ level: Double, target: Double, fall: Double) -> Double {
        if target >= level { return target }
        return max(target, level - fall)
    }

    private mutating func advancePeak(current: Double, level: Double, dt: Double) -> Double {
        if level >= current { return level }
        let step = max(0.012, 0.55 * dt)
        return max(level, current - step)
    }
}

/// Sterownik envelope — mutacja poza @State SwiftUI (TimelineView @ 120 Hz).
final class WinampEnvelopeDriver {
    private var envelope = WinampDisplayEnvelope()

    func reset() {
        envelope.reset()
    }

    func snapshot(
        at time: TimeInterval,
        frame: MusicPlaybackEngine.AudioReactiveFrame,
        bandCount: Int,
        intensity: Double,
        isPlaying: Bool,
        speed: Double = 1.0
    ) -> (levels: [Double], peaks: [Double], bass: Double, mid: Double, treble: Double, bassPeak: Double, midPeak: Double, treblePeak: Double) {
        envelope.step(
            time: time,
            frame: frame,
            bandCount: bandCount,
            intensity: intensity,
            isPlaying: isPlaying,
            speed: speed
        )
        return (
            levels: Array(envelope.levels.prefix(bandCount)),
            peaks: Array(envelope.peaks.prefix(bandCount)),
            bass: envelope.bassLevel,
            mid: envelope.midLevel,
            treble: envelope.trebleLevel,
            bassPeak: envelope.bassPeak,
            midPeak: envelope.midPeak,
            treblePeak: envelope.treblePeak
        )
    }
}

/// Jeden słupek EQ — segmenty od dołu, pełna szerokość okna.
struct WinampBarColumn: View {
    let level: Double
    let peak: Double

    var body: some View {
        Canvas { gc, size in
            WinampSpectrumStyle.drawBarColumn(
                gc: &gc,
                in: CGRect(origin: .zero, size: size),
                level: level,
                peak: peak
            )
        }
    }
}

/// Pionowy VU w stylu Winamp (BASS / MID / TREBLE).
struct WinampSegmentedChannel: View {
    let level: Double
    let peak: Double
    var isPlaying: Bool = true

    var body: some View {
        let normalized = WinampSpectrumStyle.quantizeLevel(isPlaying ? level : level * 0.15)
        let peakNorm = WinampSpectrumStyle.quantizeLevel(isPlaying ? max(normalized, peak) : normalized)

        GeometryReader { geo in
            ZStack {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(Color.black)
                    .overlay {
                        RoundedRectangle(cornerRadius: 2, style: .continuous)
                            .stroke(Color.white.opacity(0.12), lineWidth: 0.5)
                    }

                Canvas { gc, size in
                    let inset = WinampSpectrumStyle.channelInset
                    WinampSpectrumStyle.drawBarColumn(
                        gc: &gc,
                        in: CGRect(
                            x: inset,
                            y: inset,
                            width: max(0, size.width - inset * 2),
                            height: max(0, size.height - inset * 2)
                        ),
                        level: normalized,
                        peak: peakNorm
                    )
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }
}

extension WinampSpectrumStyle {
    /// Draws one segmented LED column into `rect` (bottom-up).
    static func drawBarColumn(
        gc: inout GraphicsContext,
        in rect: CGRect,
        level: Double,
        peak: Double
    ) {
        guard rect.width > 0, rect.height > 0 else { return }
        let segments = segmentCount
        let lit = Int(round(min(1, max(0, level)) * Double(segments)))
        let peakLit = Int(round(min(1, max(0, peak)) * Double(segments)))
        let segmentH = max(1, floor(rect.height / CGFloat(segments)))

        for segment in 0..<lit {
            let y = rect.maxY - CGFloat(segment + 1) * segmentH
            let color = barColor(segmentFromBottom: segment)
            gc.fill(
                Path(CGRect(x: rect.minX, y: y, width: rect.width, height: segmentH)),
                with: .color(color)
            )
        }
        if peakLit > lit {
            let y = rect.maxY - CGFloat(peakLit) * segmentH
            let color = peakColor(forLevel: Double(peakLit) / Double(segments))
            gc.fill(
                Path(CGRect(x: rect.minX, y: y, width: rect.width, height: segmentH)),
                with: .color(color)
            )
        }
    }

    /// Draws a full EQ bank of segmented bars in one Canvas pass.
    static func drawEQBars(
        gc: inout GraphicsContext,
        in rect: CGRect,
        levels: [Double],
        peaks: [Double],
        bandCount: Int,
        spacing: CGFloat
    ) {
        guard bandCount > 0, rect.width > 0, rect.height > 0 else { return }
        let totalSpacing = spacing * CGFloat(max(0, bandCount - 1))
        let barWidth = max(1, (rect.width - totalSpacing) / CGFloat(bandCount))
        for index in 0..<bandCount {
            let level = levels.indices.contains(index) ? levels[index] : 0
            let peak = peaks.indices.contains(index) ? peaks[index] : 0
            let x = rect.minX + CGFloat(index) * (barWidth + spacing)
            drawBarColumn(
                gc: &gc,
                in: CGRect(x: x, y: rect.minY, width: barWidth, height: rect.height),
                level: level,
                peak: peak
            )
        }
    }
}


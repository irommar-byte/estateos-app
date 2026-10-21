import SwiftUI

/// Per-character reveal with word grouping — matches iOS `SplashWordWrappedLine` / `SplashChar`.
///
/// `Animatable` is the important part: SwiftUI interpolates `progress` frame by frame, so every
/// letter fades and rises inside its own slice of the timeline (the iOS 30 ms stagger). Without it
/// SwiftUI only interpolates the final per-letter opacity, and the whole line cross-fades at once.
struct SplashCharRevealView: View, Animatable {
    let text: String
    var progress: Double
    /// iOS: AvenirNext-Medium 13.5 pt, letterSpacing 2.75 — scaled ×2 for the 10-foot screen.
    var font: Font = SplashCharRevealView.splashFont
    var kerning: CGFloat = 7.5
    var foreground: Color = Color(red: 248 / 255, green: 248 / 255, blue: 252 / 255).opacity(0.98)
    var wordSpacing: CGFloat = 26

    static let splashFont: Font = .custom("AvenirNext-Medium", size: 36)

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    private struct WordSpan: Identifiable {
        let id: Int
        let word: String
        let startIndex: Int
    }

    private var wordSpans: [WordSpan] {
        var result: [WordSpan] = []
        let chars = Array(text)
        var i = 0
        var wordId = 0
        while i < chars.count {
            while i < chars.count, chars[i].isWhitespace { i += 1 }
            guard i < chars.count else { break }
            let start = i
            while i < chars.count, !chars[i].isWhitespace { i += 1 }
            result.append(WordSpan(id: wordId, word: String(chars[start..<i]), startIndex: start))
            wordId += 1
        }
        return result
    }

    var body: some View {
        let total = max(text.count, 1)
        HStack(spacing: wordSpacing) {
            ForEach(wordSpans) { span in
                HStack(spacing: 0) {
                    ForEach(Array(span.word.enumerated()), id: \.offset) { offset, ch in
                        charView(ch: ch, index: span.startIndex + offset, total: total)
                    }
                }
            }
        }
        .fixedSize()
    }

    @ViewBuilder
    private func charView(ch: Character, index: Int, total: Int) -> some View {
        let start = Double(index) / Double(total)
        let end = Double(index + 1) / Double(total)
        // iOS: opacity 0→1 and translateY 14→0 across [start, end]; scale 0.88→1 across the first 5 %.
        let t = Self.ramp(progress, from: start, to: end)
        let s = Self.ramp(progress, from: start, to: min(end, start + 0.05))
        Text(String(ch))
            .font(font)
            .kerning(kerning)
            .foregroundStyle(foreground)
            .shadow(color: .black.opacity(0.42), radius: 5, x: 0, y: 1)
            .opacity(t)
            .offset(y: (1 - t) * 14)
            .scaleEffect(0.88 + 0.12 * s)
    }

    private static func ramp(_ value: Double, from start: Double, to end: Double) -> Double {
        guard end > start else { return value >= start ? 1 : 0 }
        return min(1, max(0, (value - start) / (end - start)))
    }
}

/// Second splash line — on iOS it uses exactly the same character style as line 1.
struct SplashTaglineRevealView: View, Animatable {
    let text: String
    var progress: Double

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        SplashCharRevealView(text: text, progress: progress)
    }
}

/// The single golden light band that sweeps across both lines (iOS `sunBandWrap`).
///
/// On a phone the iOS band travels ±52 % of the screen — which is about the width of the text.
/// On a TV the same formula sent it across 2000 pt, so it spent most of its time beside the
/// letters. Here it travels exactly across the text block: it enters at the first letter's
/// left, crosses every letter and leaves after the last one.
struct SplashSunBand: View, Animatable {
    var progress: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        GeometryReader { geo in
            let textWidth = geo.size.width
            let band = max(textWidth * 0.34, 300)
            let travel = textWidth / 2 + band / 2
            ZStack {
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: Color(red: 100 / 255, green: 62 / 255, blue: 22 / 255).opacity(0.2), location: 0.18),
                        .init(color: Color(red: 168 / 255, green: 112 / 255, blue: 38 / 255).opacity(0.55), location: 0.38),
                        .init(color: Color(red: 245 / 255, green: 210 / 255, blue: 150 / 255), location: 0.5),
                        .init(color: Color(red: 195 / 255, green: 138 / 255, blue: 48 / 255).opacity(0.62), location: 0.58),
                        .init(color: Color(red: 130 / 255, green: 82 / 255, blue: 28 / 255).opacity(0.22), location: 0.78),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(width: band, height: geo.size.height * 1.12)

                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: Color(red: 248 / 255, green: 220 / 255, blue: 140 / 255).opacity(0.10), location: 0.2),
                        .init(color: Color(red: 1, green: 235 / 255, blue: 170 / 255).opacity(0.26), location: 0.43),
                        .init(color: Color(red: 1, green: 235 / 255, blue: 170 / 255).opacity(0.42), location: 0.5),
                        .init(color: Color(red: 224 / 255, green: 180 / 255, blue: 80 / 255).opacity(0.16), location: 0.58),
                        .init(color: Color(red: 180 / 255, green: 130 / 255, blue: 40 / 255).opacity(0.06), location: 0.78),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(width: band * 1.5, height: geo.size.height * 1.18)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .offset(x: -travel + progress * travel * 2)
            .opacity(Self.bandOpacity(progress))
        }
        .blendMode(.screen)
        .allowsHitTesting(false)
    }

    /// iOS: interpolate(sunSweep, [0, 0.08, 0.92, 1], [0, 0.94, 0.94, 0]).
    private static func bandOpacity(_ p: CGFloat) -> Double {
        let v = Double(p)
        if v <= 0 { return 0 }
        if v < 0.08 { return 0.94 * v / 0.08 }
        if v <= 0.92 { return 0.94 }
        if v < 1 { return 0.94 * (1 - v) / 0.08 }
        return 0
    }
}

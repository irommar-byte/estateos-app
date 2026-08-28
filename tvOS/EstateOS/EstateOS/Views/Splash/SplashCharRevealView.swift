import SwiftUI

/// Per-character reveal with word grouping — matches iOS `SplashWordWrappedLine`.
struct SplashCharRevealView: View {
    let text: String
    let progress: Double
    var font: Font = .system(size: 28, weight: .medium)
    var tracking: CGFloat = 6
    var foreground: Color = .white.opacity(0.92)
    var wordSpacing: CGFloat = 10

    private struct WordSpan: Identifiable {
        let id: Int
        let word: String
        let startIndex: Int
    }

    private var wordSpans: [WordSpan] {
        var result: [WordSpan] = []
        var i = 0
        let chars = Array(text)
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
    }

    @ViewBuilder
    private func charView(ch: Character, index: Int, total: Int) -> some View {
        let start = Double(index) / Double(total)
        let end = Double(index + 1) / Double(total)
        let t = clamped(progress, from: start, to: end)
        Text(String(ch))
            .font(font)
            .tracking(index == 0 ? tracking : 0)
            .foregroundStyle(foreground)
            .opacity(t)
            .offset(y: (1 - t) * 14)
            .scaleEffect(0.88 + t * 0.12)
    }

    private func clamped(_ value: Double, from start: Double, to end: Double) -> Double {
        guard end > start else { return value >= start ? 1 : 0 }
        return min(1, max(0, (value - start) / (end - start)))
    }
}

struct SplashTaglineRevealView: View {
    let text: String
    let progress: Double

    var body: some View {
        SplashCharRevealView(
            text: text,
            progress: progress,
            font: .system(size: 22, weight: .regular),
            tracking: 0,
            foreground: .white.opacity(0.72),
            wordSpacing: 8
        )
        .multilineTextAlignment(.center)
        .frame(maxWidth: 900)
    }
}

import SwiftUI

/// Auto-scrolling label when text is wider than the available width (seamless loop).
struct MarqueeText: View {
    let text: String
    var font: Font = .body
    var uiFont: UIFont? = nil
    var foreground: Color = .primary
    var spacing: CGFloat = 36
    var speedPointsPerSecond: CGFloat = 28
    var pauseBeforeLoop: TimeInterval = 1.1

    @State private var textWidth: CGFloat = 0
    @State private var containerWidth: CGFloat = 0
    @State private var offset: CGFloat = 0
    @State private var loopTask: Task<Void, Never>?

    private var shouldScroll: Bool {
        textWidth > 1 && containerWidth > 1 && textWidth > containerWidth + 2
    }

    var body: some View {
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            Color.clear.frame(height: 0)
        } else {
            GeometryReader { geo in
                let width = geo.size.width
                ZStack(alignment: .leading) {
                    // Measurement + static fallback (also used when it fits).
                    Text(text)
                        .font(font)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .opacity(shouldScroll ? 0 : 1)
                        .background(
                            GeometryReader { textGeo in
                                Color.clear.preference(key: MarqueeTextWidthKey.self, value: textGeo.size.width)
                            }
                        )

                    if shouldScroll {
                        HStack(spacing: spacing) {
                            Text(text)
                                .font(font)
                                .lineLimit(1)
                                .fixedSize(horizontal: true, vertical: false)
                            Text(text)
                                .font(font)
                                .lineLimit(1)
                                .fixedSize(horizontal: true, vertical: false)
                                .accessibilityHidden(true)
                        }
                        .foregroundStyle(foreground)
                        .offset(x: offset)
                        .allowsHitTesting(false)
                    }
                }
                .frame(width: width, alignment: .leading)
                .clipped()
                .foregroundStyle(foreground)
                .onAppear {
                    containerWidth = width
                    restartLoopIfNeeded()
                }
                .onChange(of: width) { _, newWidth in
                    containerWidth = newWidth
                    restartLoopIfNeeded()
                }
                .onChange(of: text) { _, _ in
                    offset = 0
                    restartLoopIfNeeded()
                }
            }
            .frame(height: lineHeight)
            .onPreferenceChange(MarqueeTextWidthKey.self) { width in
                textWidth = width
                restartLoopIfNeeded()
            }
            .onDisappear {
                loopTask?.cancel()
                loopTask = nil
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(text)
        }
    }

    private var lineHeight: CGFloat {
        if let uiFont { return ceil(uiFont.lineHeight) + 2 }
        return 22
    }

    private func restartLoopIfNeeded() {
        loopTask?.cancel()
        offset = 0
        guard shouldScroll else { return }

        let travel = textWidth + spacing
        let duration = max(2.5, Double(travel / speedPointsPerSecond))

        loopTask = Task { @MainActor in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(pauseBeforeLoop * 1_000_000_000))
                guard !Task.isCancelled, shouldScroll else { return }
                withAnimation(.linear(duration: duration)) {
                    offset = -travel
                }
                try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
                guard !Task.isCancelled else { return }
                var transaction = Transaction()
                transaction.disablesAnimations = true
                withTransaction(transaction) {
                    offset = 0
                }
            }
        }
    }
}

private struct MarqueeTextWidthKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

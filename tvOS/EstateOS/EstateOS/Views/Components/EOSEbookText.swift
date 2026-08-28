import SwiftUI

/// Gentle vertical drift for long preview text (e-book feel).
struct EOSEbookText: View {
    let text: String
    var font: Font = .body
    var lineSpacing: CGFloat = 5

    @State private var drift = false
    @State private var contentHeight: CGFloat = 0
    @State private var viewportHeight: CGFloat = 0

    private var overflow: CGFloat {
        max(0, contentHeight - viewportHeight)
    }

    var body: some View {
        GeometryReader { geo in
            ScrollView(.vertical, showsIndicators: false) {
                Text(text)
                    .font(font)
                    .foregroundStyle(.white.opacity(0.88))
                    .lineSpacing(lineSpacing)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        GeometryReader { inner in
                            Color.clear.preference(key: EbookHeightKey.self, value: inner.size.height)
                        }
                    )
                    .offset(y: drift && overflow > 8 ? -overflow : 0)
                    .animation(
                        overflow > 8
                            ? .linear(duration: max(10, Double(overflow) / 12)).repeatForever(autoreverses: true)
                            : .default,
                        value: drift
                    )
            }
            .onAppear {
                viewportHeight = geo.size.height
                drift = true
            }
            .onChange(of: geo.size.height) { _, h in
                viewportHeight = h
            }
        }
        .onPreferenceChange(EbookHeightKey.self) { contentHeight = $0 }
        .clipped()
    }
}

struct EbookHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

import SwiftUI

/// Title that scales down to fit width without clipping glyphs vertically.
struct EOSAdaptiveTitle: View {
    let text: String
    var maxLines: Int = 2
    var weight: Font.Weight = .bold
    var design: Font.Design = .rounded
    var maxSize: CGFloat = 28
    var minSize: CGFloat = 16

    private var reservedHeight: CGFloat {
        ceil(maxSize * 1.35) * CGFloat(max(1, maxLines))
    }

    var body: some View {
        Text(text)
            .font(.system(size: maxSize, weight: weight, design: design))
            .lineLimit(maxLines)
            .minimumScaleFactor(min(1, minSize / max(maxSize, 1)))
            .multilineTextAlignment(.leading)
            .truncationMode(.tail)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, minHeight: reservedHeight, alignment: .topLeading)
    }
}

import SwiftUI

/// Title that scales down to fit without breaking words mid-token.
struct EOSAdaptiveTitle: View {
    let text: String
    var maxLines: Int = 2
    var weight: Font.Weight = .bold
    var design: Font.Design = .rounded
    var maxSize: CGFloat = 28
    var minSize: CGFloat = 16

    private var sizes: [CGFloat] {
        stride(from: maxSize, through: minSize, by: -1).map { $0 }
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            ForEach(sizes, id: \.self) { size in
                Text(text)
                    .font(.system(size: size, weight: weight, design: design))
                    .lineLimit(maxLines)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

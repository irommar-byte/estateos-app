import SwiftUI

struct ImmersiveAdaptiveTitle: View {
    let text: String
    var maxSize: CGFloat = 52
    var minSize: CGFloat = 24

    private var sizes: [CGFloat] {
        stride(from: maxSize, through: minSize, by: -2).map { $0 }
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            ForEach(sizes, id: \.self) { size in
                Text(text)
                    .font(.system(size: size, weight: .bold, design: .rounded))
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

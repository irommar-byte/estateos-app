import SwiftUI

enum AppMotif: Equatable {
    case deposit
    case receipt

    var symbols: [String] {
        switch self {
        case .deposit:
            return [
                "arrow.3.trianglehead.clockwise",
                "waterbottle.fill",
                "arrow.trianglehead.clockwise",
                "arrow.3.trianglehead.clockwise"
            ]
        case .receipt:
            return [
                "doc.text.fill",
                "doc.text.viewfinder",
                "checkmark.seal.fill",
                "doc.plaintext.fill"
            ]
        }
    }
}

struct MotifBackground: View {
    var kind: AppMotif
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { geo in
            let columns = 5
            let rows = 8
            let cellW = geo.size.width / CGFloat(columns)
            let cellH = geo.size.height / CGFloat(rows)
            let tint = colorScheme == .dark
                ? ParagonTheme.osGreen.opacity(0.10)
                : Color.primary.opacity(0.055)
            ZStack {
                ForEach(0..<(columns * rows), id: \.self) { index in
                    let column = index % columns
                    let row = index / columns
                    Image(systemName: kind.symbols[index % kind.symbols.count])
                        .font(.system(size: row.isMultiple(of: 2) ? 28 : 22, weight: .semibold))
                        .foregroundStyle(tint)
                        .rotationEffect(.degrees(row.isMultiple(of: 2) ? -18 : 14))
                        .position(
                            x: CGFloat(column) * cellW + cellW * 0.52 + (row.isMultiple(of: 2) ? -10 : 8),
                            y: CGFloat(row) * cellH + cellH * 0.48
                        )
                        .opacity(index % 5 == 0 ? 0.35 : 1)
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

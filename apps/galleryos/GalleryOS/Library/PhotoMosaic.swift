import CoreGraphics
import Foundation

enum PhotoMosaic {
    /// Wiersze jak w Zdjęciach: pełna szerokość, wysokość blisko `targetHeight`.
    /// Ostatni niedokończony wiersz zostaje przy lewej, bez rozciągania jednego portretu.
    static func frames(
        aspects: [CGFloat],
        width: CGFloat,
        targetHeight: CGFloat,
        spacing: CGFloat
    ) -> [CGRect] {
        let count = aspects.count
        var rects = [CGRect](repeating: .zero, count: count)
        guard count > 0, width > 1, targetHeight > 1 else { return rects }

        func aspect(_ index: Int) -> CGFloat { max(aspects[index], 0.35) }

        func rowHeight(_ row: [Int]) -> CGFloat {
            let sum = row.reduce(CGFloat(0)) { $0 + aspect($1) }
            let gaps = spacing * CGFloat(max(row.count - 1, 0))
            return (width - gaps) / max(sum, 0.01)
        }

        var y: CGFloat = 0
        var index = 0
        while index < count {
            var row = [index]
            index += 1
            while index < count {
                let candidate = row + [index]
                if rowHeight(candidate) < targetHeight { break }
                row = candidate
                index += 1
            }
            let natural = rowHeight(row)
            let isLast = index >= count
            if isLast, natural > targetHeight * 1.35 {
                var x: CGFloat = 0
                for item in row {
                    let itemWidth = aspect(item) * targetHeight
                    rects[item] = CGRect(x: x, y: y, width: itemWidth, height: targetHeight)
                    x += itemWidth + spacing
                }
                y += targetHeight
            } else {
                var x: CGFloat = 0
                for (offset, item) in row.enumerated() {
                    let itemWidth: CGFloat
                    if offset == row.count - 1 {
                        itemWidth = max(1, width - x)
                    } else {
                        itemWidth = aspect(item) * natural
                    }
                    rects[item] = CGRect(x: x, y: y, width: itemWidth, height: natural)
                    x += itemWidth + spacing
                }
                y += natural
            }
            if index < count { y += spacing }
        }
        return rects
    }
}

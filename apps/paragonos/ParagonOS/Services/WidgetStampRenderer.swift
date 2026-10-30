import SwiftUI
import UIKit

enum WidgetStampRenderer {
    @MainActor
    static func png(program: LoyaltyProgram, dimension: CGFloat = 96) -> Data? {
        tile(program: program, dimension: dimension)?.pngData()
    }

    @MainActor
    static func tile(program: LoyaltyProgram, dimension: CGFloat = 96) -> UIImage? {
        let view = WidgetStampTile(program: program, dimension: dimension)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        renderer.isOpaque = false
        return renderer.uiImage
    }

    @MainActor
    static func grid(
        cells: [(program: LoyaltyProgram, caption: String)],
        emptyCount: Int,
        columns: Int = 3,
        cell: CGFloat = 96
    ) -> UIImage? {
        let view = WidgetStampGridPreview(cells: cells, emptyCount: emptyCount, columns: columns, cell: cell)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        renderer.isOpaque = false
        return renderer.uiImage
    }
}

struct WidgetStampTile: View {
    let program: LoyaltyProgram
    var dimension: CGFloat

    var body: some View {
        let hex = program.cardColorHex
        let corner = ParagonWidgetKind.stampCorner * (dimension / 96)
        RoundedRectangle(cornerRadius: corner, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        Color(hex: hex).opacity(0.94),
                        Color(hex: hex),
                        Color.black.opacity(0.18)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay {
                Group {
                    if LoyaltyBrandArt.hasMark(program.id) {
                        LoyaltyBrandMark(program: program, size: dimension * 0.78, onBrandField: true)
                    } else {
                        Text(program.monogram)
                            .font(.system(size: dimension * 0.32, weight: .bold, design: .rounded))
                            .foregroundStyle(program.onColor)
                    }
                }
            }
            .frame(width: dimension, height: dimension)
    }
}

struct WidgetStampGridPreview: View {
    var cells: [(program: LoyaltyProgram, caption: String)]
    var emptyCount: Int
    var columns: Int
    var cell: CGFloat

    var body: some View {
        let spacing: CGFloat = 10
        let captionH: CGFloat = 16
        let total = cells.count + emptyCount
        let rows = Int(ceil(Double(total) / Double(max(columns, 1))))
        let width = CGFloat(columns) * cell + CGFloat(max(columns - 1, 0)) * spacing + 24
        let height = CGFloat(rows) * (cell + captionH + 4) + CGFloat(max(rows - 1, 0)) * spacing + 24
        let items: [GridPreviewItem] = cells.enumerated().map { .card($0.offset, $0.element.program, $0.element.caption) }
            + (0..<emptyCount).map { .empty(cells.count + $0) }
        VStack(spacing: spacing) {
            ForEach(0..<rows, id: \.self) { row in
                HStack(spacing: spacing) {
                    ForEach(0..<columns, id: \.self) { column in
                        let index = row * columns + column
                        if index < items.count {
                            cellView(items[index])
                        } else {
                            Color.clear.frame(width: cell, height: cell + captionH + 4)
                        }
                    }
                }
            }
        }
        .padding(12)
        .frame(width: width, height: height)
        .background(Color(.secondarySystemGroupedBackground))
    }

    private enum GridPreviewItem {
        case card(Int, LoyaltyProgram, String)
        case empty(Int)
    }

    @ViewBuilder
    private func cellView(_ item: GridPreviewItem) -> some View {
        switch item {
        case .card(_, let program, let caption):
            VStack(spacing: 4) {
                WidgetStampTile(program: program, dimension: cell)
                Text(caption)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .frame(width: cell)
            }
        case .empty:
            VStack(spacing: 4) {
                RoundedRectangle(cornerRadius: ParagonWidgetKind.stampCorner, style: .continuous)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1.2, dash: [5, 4]))
                    .foregroundStyle(.secondary)
                    .frame(width: cell, height: cell)
                    .overlay {
                        Image(systemName: "plus")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                Text("Skanuj")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
                    .frame(width: cell)
            }
        }
    }
}

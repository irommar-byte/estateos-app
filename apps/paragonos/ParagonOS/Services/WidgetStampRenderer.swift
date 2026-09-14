import SwiftUI
import UIKit

enum WidgetStampRenderer {
    @MainActor
    static func png(program: LoyaltyProgram, dimension: CGFloat = 96) -> Data? {
        if LoyaltyBrandArt.hasMark(program.id),
           let raster = LoyaltyBrandArt.raster(program: program, dimension: dimension),
           let data = raster.pngData() {
            return data
        }
        return monogram(program: program, dimension: dimension)?.pngData()
    }

    @MainActor
    private static func monogram(program: LoyaltyProgram, dimension: CGFloat) -> UIImage? {
        let view = Text(program.monogram)
            .font(.system(size: dimension * 0.38, weight: .bold, design: .rounded))
            .foregroundStyle(program.onColor)
            .frame(width: dimension, height: dimension)
            .background(program.brandColor)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        renderer.isOpaque = true
        return renderer.uiImage
    }
}

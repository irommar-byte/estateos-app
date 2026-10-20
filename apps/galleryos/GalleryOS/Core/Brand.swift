import SwiftUI

enum Brand {
    static let displayName = "GalleryOS™"
    static let legalName = "GalleryOS"
    static let bundleID = "pl.galleryos.app"
    static let urlScheme = "galleryos"
    static let teamID = "NW3YW69KL9"
}

struct BrandWordmark: View {
    var size: Font = .title2

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text("Gallery")
                .font(size.weight(.semibold))
                .foregroundStyle(.primary)
            Text("OS")
                .font(size.weight(.bold))
                .foregroundStyle(GalleryTheme.accent)
            Text("™")
                .font(.caption.weight(.semibold))
                .foregroundStyle(GalleryTheme.accent)
                .baselineOffset(6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Brand.displayName)
    }
}

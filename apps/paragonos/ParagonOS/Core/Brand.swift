import Foundation
import SwiftUI

enum Brand {
    static let displayName = "ParagonOS™"
    static let legalName = "ParagonOS"
    static let slogan = "Kaucje i paragony w jednym miejscu. Terminy, gwarancje, rodzina."
    static let bundleID = "pl.paragonos.app"
    static let iCloudContainer = "iCloud.pl.paragonos.app"
    static let urlScheme = "paragonos"
    static let teamID = "NW3YW69KL9"

    static let disclaimer = "ParagonOS™ nie jest powiązany z Biedronką, Lidlem, Kauflandem ani innymi sieciami. Nie gwarantujemy, że kasa zeskanuje kod z ekranu telefonu."
}

struct BrandWordmark: View {
    var size: Font = .title2
    var primary: Color = .primary
    var os: Color = ParagonTheme.osGreen

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text("Paragon")
                .font(size.weight(.semibold))
                .foregroundStyle(primary)
            Text("OS")
                .font(size.weight(.bold))
                .foregroundStyle(os)
            Text("™")
                .font(.caption.weight(.semibold))
                .foregroundStyle(os)
                .baselineOffset(6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Brand.displayName)
    }
}

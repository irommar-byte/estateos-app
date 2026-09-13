import SwiftUI
import UIKit

enum RetailerBrand {
    static func policy(for id: String) -> RetailerPolicy {
        RetailerCatalog.policy(id: id)
    }

    static func color(for id: String) -> Color {
        if let program = LoyaltyCatalog.program(id: id) ?? (id == "lidl" ? LoyaltyCatalog.program(id: "lidlplus") : nil) {
            return program.brandColor
        }
        switch id {
        case "biedronka": return Color(red: 0.91, green: 0.18, blue: 0.12)
        case "lidl": return Color(red: 0.0, green: 0.31, blue: 0.67)
        case "kaufland": return Color(red: 0.48, green: 0.04, blue: 0.14)
        case "netto": return Color(red: 0.98, green: 0.80, blue: 0.0)
        case "stokrotka": return Color(red: 0.18, green: 0.62, blue: 0.29)
        case "carrefour": return Color(red: 0.0, green: 0.31, blue: 0.61)
        case "aldi": return Color(red: 0.0, green: 0.0, blue: 0.37)
        case "auchan": return Color(red: 0.78, green: 0.0, blue: 0.28)
        case "dino": return Color(red: 0.0, green: 0.59, blue: 0.25)
        case "zabka": return Color(red: 0.47, green: 0.75, blue: 0.13)
        default: return Color(white: 0.42)
        }
    }

    static func cardColor(for id: String) -> Color {
        switch id {
        case "netto": return Color(red: 0.14, green: 0.13, blue: 0.08)
        default: return color(for: id)
        }
    }

    static func onColor(for id: String) -> Color {
        id == "netto" ? Color.black : Color.white
    }
}

struct RetailerLogo: View {
    let retailerID: String
    var size: CGFloat = 36

    var body: some View {
        LoyaltyLogo(program: LoyaltyCatalog.programForRetailer(retailerID), size: size)
    }
}

struct RetailerNameRow: View {
    let retailerID: String
    var size: CGFloat = 28

    var body: some View {
        Label {
            Text(RetailerCatalog.policy(id: retailerID).name)
        } icon: {
            RetailerLogo(retailerID: retailerID, size: size)
        }
    }
}

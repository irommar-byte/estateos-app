import SwiftUI
import UIKit

enum RetailerBrand {
    static func policy(for id: String) -> RetailerPolicy {
        RetailerCatalog.policy(id: id)
    }

    static func color(for id: String) -> Color {
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
        Group {
            if UIImage(named: assetName) != nil {
                Image(assetName)
                    .resizable()
                    .scaledToFit()
                    .padding(size * 0.08)
            } else {
                drawnMark
            }
        }
        .frame(width: size, height: size)
        .background(RetailerBrand.color(for: retailerID))
        .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .strokeBorder(.white.opacity(0.18), lineWidth: 0.5)
        }
        .accessibilityHidden(true)
    }

    private var assetName: String { "RetailerLogo-\(retailerID)" }

    @ViewBuilder
    private var drawnMark: some View {
        switch retailerID {
        case "biedronka":
            biedronka
        case "lidl":
            lidl
        case "kaufland":
            letter("K", weight: .heavy)
        case "netto":
            letter("N", weight: .heavy, color: .black)
        case "stokrotka":
            stokrotka
        case "carrefour":
            carrefour
        case "aldi":
            letter("A", weight: .bold)
        case "auchan":
            letter("A", weight: .heavy)
        case "dino":
            letter("D", weight: .heavy)
        default:
            Image(systemName: "storefront.fill")
                .font(.system(size: size * 0.42, weight: .semibold))
                .foregroundStyle(.white)
        }
    }

    private func letter(_ value: String, weight: Font.Weight, color: Color? = nil) -> some View {
        Text(value)
            .font(.system(size: size * 0.52, weight: weight, design: .rounded))
            .foregroundStyle(color ?? RetailerBrand.onColor(for: retailerID))
    }

    private var biedronka: some View {
        ZStack {
            Circle()
                .fill(Color.white.opacity(0.12))
                .frame(width: size * 0.72, height: size * 0.72)
            Circle()
                .fill(Color.black.opacity(0.88))
                .frame(width: size * 0.16, height: size * 0.16)
                .offset(y: -size * 0.12)
            Circle()
                .fill(Color.black.opacity(0.88))
                .frame(width: size * 0.14, height: size * 0.14)
                .offset(x: -size * 0.13, y: size * 0.08)
            Circle()
                .fill(Color.black.opacity(0.88))
                .frame(width: size * 0.14, height: size * 0.14)
                .offset(x: size * 0.13, y: size * 0.08)
        }
    }

    private var lidl: some View {
        ZStack {
            VStack(spacing: 0) {
                Color(red: 0.0, green: 0.31, blue: 0.67)
                Color(red: 0.98, green: 0.85, blue: 0.08)
                    .frame(height: size * 0.28)
                Color(red: 0.83, green: 0.09, blue: 0.15)
                    .frame(height: size * 0.16)
            }
            Text("L")
                .font(.system(size: size * 0.42, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .offset(y: -size * 0.08)
        }
    }

    private var stokrotka: some View {
        ZStack {
            ForEach(0..<8, id: \.self) { index in
                Capsule()
                    .fill(Color.white.opacity(0.92))
                    .frame(width: size * 0.12, height: size * 0.32)
                    .offset(y: -size * 0.12)
                    .rotationEffect(.degrees(Double(index) * 45))
            }
            Circle()
                .fill(Color(red: 0.98, green: 0.78, blue: 0.12))
                .frame(width: size * 0.2, height: size * 0.2)
        }
    }

    private var carrefour: some View {
        ZStack {
            Circle()
                .trim(from: 0.5, to: 1)
                .fill(Color(red: 0.89, green: 0.12, blue: 0.16))
                .rotationEffect(.degrees(35))
                .frame(width: size * 0.7, height: size * 0.7)
            Circle()
                .trim(from: 0.5, to: 1)
                .fill(Color.white)
                .rotationEffect(.degrees(215))
                .frame(width: size * 0.7, height: size * 0.7)
            Text("C")
                .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
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

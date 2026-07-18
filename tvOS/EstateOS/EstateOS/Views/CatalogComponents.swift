import SwiftUI

struct CarsRailView: View {
    let cars: [CarListing]
    let onSelect: (CarListing) -> Void
    @EnvironmentObject private var app: AppModel

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 28) {
                ForEach(cars.prefix(80)) { car in
                    Button {
                        onSelect(car)
                    } label: {
                        CarCardView(car: car, distanceLabel: app.distanceLabel(forCity: car.city))
                            .frame(width: 460)
                    }
                    .buttonStyle(EOSPosterButtonStyle())
                    .focusEffectDisabled()
                    .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                }
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 2)
        }
        .focusSection()
    }
}

struct CarCardView: View {
    let car: CarListing
    var distanceLabel: String? = nil
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            EOSOfferThumbnail(url: EOSOfferMedia.imageURL(from: car.imageUrl), height: 240)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if car.featured {
                        Text("PROMO")
                            .font(.caption2.weight(.black))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(Color.cyan.opacity(0.92)))
                            .foregroundStyle(.black)
                            .padding(10)
                    }
                }
                .overlay(alignment: .bottomLeading) {
                    HStack(spacing: 8) {
                        if !car.city.isEmpty {
                            Text(car.city)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Capsule().fill(.black.opacity(0.55)))
                        }
                        if let distanceLabel {
                            Text(distanceLabel)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Capsule().fill(Color.cyan.opacity(0.85)))
                                .foregroundStyle(.black)
                        }
                    }
                    .padding(10)
                }

            Text(car.displayHeadline)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: 60, alignment: .topLeading)

            Text(car.displayPrice)
                .font(.title2.bold())
                .foregroundStyle(Color.cyan)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            EOSListingStatsRow(
                views: car.viewsCount,
                favorites: car.favoritesCount,
                accent: .cyan
            )

            Text(car.displaySpecs)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .eosPosterCard(cornerRadius: 22, accent: .cyan)
    }
}

struct BrandSwitcher: View {
    @Binding var brand: CatalogBrand
    var onChange: (CatalogBrand) -> Void = { _ in }

    var body: some View {
        HStack(spacing: 14) {
            ForEach(CatalogBrand.allCases) { item in
                Button {
                    guard brand != item else { return }
                    brand = item
                    onChange(item)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: item.accent)
                            .font(.title2.weight(.semibold))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.shortTitle)
                                .font(.headline.weight(.bold))
                            Text(item == .home ? "Mieszkania · domy · działki" : "Marki · paliwo · skrzynia")
                                .font(.caption2.weight(.medium))
                                .opacity(0.72)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 14)
                    .frame(minWidth: 260, alignment: .leading)
                }
                .buttonStyle(EOSBrandButtonStyle(
                    selected: brand == item,
                    accent: item == .home ? .green : .cyan
                ))
                .focusEffectDisabled()
            }
        }
        .padding(12)
        .eosGlass(cornerRadius: 24, opacity: 0.3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }
}

struct ShowroomHeroCard: View {
    let title: String
    let subtitle: String
    let badge: String
    let imageURL: URL?
    let accent: Color
    let primaryTitle: String
    let secondaryTitle: String?
    let onPrimary: () -> Void
    let onSecondary: (() -> Void)?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            EOSOfferThumbnail(url: imageURL, height: 420)
                .overlay(
                    LinearGradient(
                        colors: [
                            .clear,
                            .black.opacity(0.2),
                            .black.opacity(0.55),
                            .black.opacity(0.9),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

            VStack(alignment: .leading, spacing: 16) {
                Text(badge)
                    .font(.caption.weight(.black))
                    .tracking(1.3)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(accent.opacity(0.9)))
                    .foregroundStyle(.black)

                EOSAdaptiveTitle(text: title, maxLines: 2, maxSize: 42, minSize: 26)
                    .foregroundStyle(.white)

                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.title3.weight(.medium))
                        .foregroundStyle(.white.opacity(0.86))
                        .lineLimit(2)
                }

                HStack(spacing: 16) {
                    Button(primaryTitle, action: onPrimary)
                        .buttonStyle(EOSDetailActionButtonStyle(accent: accent))
                        .focusEffectDisabled()

                    if let secondaryTitle, let onSecondary {
                        Button(secondaryTitle, action: onSecondary)
                            .buttonStyle(EOSDetailChromeButtonStyle())
                            .focusEffectDisabled()
                    }
                }
            }
            .padding(36)
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.16), lineWidth: 1)
        )
        .eosGlass(cornerRadius: 28, opacity: 0.18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }
}

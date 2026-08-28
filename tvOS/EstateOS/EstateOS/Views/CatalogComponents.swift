import SwiftUI


struct CarsCatalogView: View {
    let cars: [CarListing]
    let sectionTitle: String
    let onSelect: (CarListing) -> Void
    @EnvironmentObject private var app: AppModel

    private var items: [CarListing] { Array(cars.prefix(80)) }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 22) {
                ForEach(items) { car in
                    carButton(car)
                }
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 2)
        }
        .focusSection()
    }

    private func carButton(_ car: CarListing) -> some View {
        Button {
            app.noteShowroomSection(sectionTitle)
            onSelect(car)
        } label: {
            CarCardView(
                car: car,
                isFavorite: app.isFavoriteCar(car.id),
                distanceLabel: app.distanceLabel(forCity: car.city),
                imageHeight: 180,
                compact: true
            )
            .frame(width: 360)
            .background(CarFocusSectionProbe(title: sectionTitle))
        }
        .buttonStyle(EOSPosterButtonStyle(focusScale: 1.0))
        .focusEffectDisabled()
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct CarFocusSectionProbe: View {
    let title: String
    @EnvironmentObject private var app: AppModel
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .onChange(of: isFocused) { _, focused in
                if focused { app.noteShowroomSection(title) }
            }
    }
}

struct CarListRowView: View {
    let car: CarListing
    var distanceLabel: String? = nil

    var body: some View {
        HStack(spacing: 16) {
            EOSOfferThumbnail(url: EOSOfferMedia.imageURL(from: car.imageUrl), height: 96)
                .frame(width: 160)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                Text(car.displayHeadline)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Text(car.displayPrice)
                    .font(.title3.bold())
                    .foregroundStyle(EOSPalette.car)
                HStack {
                    EOSListingStatsRow(views: car.viewsCount, favorites: car.favoritesCount, accent: EOSPalette.car)
                    Spacer()
                    if let distanceLabel {
                        Text(distanceLabel).font(.caption.weight(.semibold)).foregroundStyle(EOSPalette.car)
                    } else if !car.city.isEmpty {
                        Text(car.city).font(.caption).foregroundStyle(.secondary)
                    }
                }
                Text(car.displaySpecs)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(white: 0.09).opacity(0.96)))
    }
}

struct CarsRailView: View {
    let cars: [CarListing]
    let onSelect: (CarListing) -> Void
    @EnvironmentObject private var app: AppModel

    var body: some View {
        CarsCatalogView(cars: cars, sectionTitle: "Samochody", onSelect: onSelect)
    }
}

struct CarCardView: View {
    let car: CarListing
    var isFavorite: Bool = false
    var distanceLabel: String? = nil
    var imageHeight: CGFloat = 180
    var compact: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 10 : 14) {
            EOSOfferThumbnail(url: EOSOfferMedia.imageURL(from: car.imageUrl), height: imageHeight)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if car.featured {
                        EOSMediaBadge(
                            text: "PROMO",
                            fill: EOSPalette.car.opacity(0.92),
                            stroke: Color.clear,
                            foreground: .black,
                            fontSize: 12
                        )
                        .padding(10)
                    }
                }
                .overlay(alignment: .topTrailing) {
                    if isFavorite {
                        Image(systemName: "heart.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.pink)
                            .padding(10)
                            .background(Circle().fill(.black.opacity(0.45)))
                            .padding(10)
                    }
                }
                .overlay(alignment: .bottomLeading) {
                    HStack(spacing: 8) {
                        if !car.city.isEmpty {
                            EOSMediaBadge(text: car.city)
                        }
                        if let distanceLabel {
                            EOSMediaBadge(
                                text: distanceLabel,
                                fill: EOSPalette.car.opacity(0.9),
                                stroke: Color.clear,
                                foreground: .black
                            )
                        }
                    }
                    .padding(10)
                }

            Text(car.displayHeadline)
                .font(.system(size: compact ? 18 : 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: compact ? 44 : 60, alignment: .topLeading)

            Text(car.displayPrice)
                .font(compact ? .title3.bold() : .title2.bold())
                .foregroundStyle(EOSPalette.car)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            EOSListingStatsRow(
                views: car.viewsCount,
                favorites: car.favoritesCount,
                accent: EOSPalette.car
            )

            Text(car.displaySpecs)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .eosPosterCard(cornerRadius: 22, accent: EOSPalette.car)
    }
}

struct BrandSwitcher: View {
    @Binding var brand: CatalogBrand
    var onChange: (CatalogBrand) -> Void = { _ in }

    var body: some View {
        HStack {
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                ForEach(CatalogBrand.allCases) { item in
                    Button {
                        guard brand != item else { return }
                        brand = item
                        onChange(item)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: item.accent)
                                .font(.body.weight(.semibold))
                            Text(item.shortTitle)
                                .font(.subheadline.weight(.semibold))
                        }
                        .padding(.horizontal, 22)
                        .padding(.vertical, 12)
                        .frame(minWidth: 200)
                    }
                    .buttonStyle(EOSBrandButtonStyle(
                        selected: brand == item,
                        accent: EOSPalette.accent(for: item)
                    ))
                    .focusEffectDisabled()
                }
            }
            .padding(6)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        .focusSection()
    }
}

struct ShowroomHeroCard: View {
    @Environment(\.isFocused) private var isFocused
    let title: String
    let subtitle: String
    let badge: String
    let imageURL: URL?
    let accent: Color
    let primaryTitle: String
    let secondaryTitle: String?
    var heroNamespace: Namespace.ID? = nil
    var heroTransitionID: String? = nil
    let onPrimary: () -> Void
    let onSecondary: (() -> Void)?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            heroImage
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
                    .background(Capsule().fill(Color.white.opacity(0.14)))
                    .overlay(Capsule().stroke(accent.opacity(0.5), lineWidth: 1))
                    .foregroundStyle(EOSPalette.textPrimary)

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
                        .accessibilityLabel("Pokaż szczegóły oferty")

                    if let secondaryTitle, let onSecondary {
                        Button(secondaryTitle, action: onSecondary)
                            .buttonStyle(EOSDetailChromeButtonStyle())
                            .focusEffectDisabled()
                            .accessibilityLabel("Immersyjny przegląd ofert")
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
        .scaleEffect(isFocused ? 1.04 : 1.0)
        .animation(.easeOut(duration: 0.18), value: isFocused)
        .focusSection()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Karta showroom: \(title)")
    }

    @ViewBuilder
    private var heroImage: some View {
        let thumb = EOSOfferThumbnail(url: imageURL, height: 420)
        if let heroNamespace, let heroTransitionID {
            thumb.matchedGeometryEffect(id: heroTransitionID, in: heroNamespace)
        } else {
            thumb
        }
    }
}

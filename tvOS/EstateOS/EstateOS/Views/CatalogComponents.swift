import SwiftUI


struct CarsCatalogView: View {
    let cars: [CarListing]
    let layout: ShowroomLayoutMode
    let sectionTitle: String
    let onSelect: (CarListing) -> Void
    @EnvironmentObject private var app: AppModel

    private var items: [CarListing] { Array(cars.prefix(80)) }

    var body: some View {
        switch layout {
        case .rails:
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 22) {
                    ForEach(items) { car in
                        carButton(car, width: 360, imageHeight: 180, focusScale: 1.0)
                    }
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 2)
            }
            .focusSection()
        case .tiles:
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 32)], spacing: 32) {
                ForEach(items) { car in
                    carButton(car, width: nil, imageHeight: 140, focusScale: 1.07)
                        .padding(18)
                }
            }
            .padding(.vertical, 10)
            .focusSection()
        case .list:
            LazyVStack(spacing: 22) {
                ForEach(items) { car in
                    Button {
                        app.noteShowroomSection(sectionTitle)
                        onSelect(car)
                    } label: {
                        CarListRowView(car: car, distanceLabel: app.distanceLabel(forCity: car.city))
                            .eosListRowFocus(accent: .cyan)
                            .background(CarFocusSectionProbe(title: sectionTitle))
                    }
                    .buttonStyle(EOSPosterButtonStyle(focusScale: 1.05))
                    .focusEffectDisabled()
                    .padding(.vertical, 10)
                    .padding(.horizontal, 8)
                }
            }
            .padding(.vertical, 8)
            .focusSection()
        }
    }

    private func carButton(_ car: CarListing, width: CGFloat?, imageHeight: CGFloat, focusScale: CGFloat) -> some View {
        Button {
            app.noteShowroomSection(sectionTitle)
            onSelect(car)
        } label: {
            CarCardView(car: car, isFavorite: app.isFavoriteCar(car.id), distanceLabel: app.distanceLabel(forCity: car.city), imageHeight: imageHeight, compact: true)
                .frame(width: width)
                .background(CarFocusSectionProbe(title: sectionTitle))
        }
        .buttonStyle(EOSPosterButtonStyle(focusScale: focusScale))
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
                    .foregroundStyle(.cyan)
                HStack {
                    EOSListingStatsRow(views: car.viewsCount, favorites: car.favoritesCount, accent: .cyan)
                    Spacer()
                    if let distanceLabel {
                        Text(distanceLabel).font(.caption.weight(.semibold)).foregroundStyle(.cyan)
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
        CarsCatalogView(cars: cars, layout: .rails, sectionTitle: "Samochody", onSelect: onSelect)
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
                        Text("PROMO")
                            .font(.caption2.weight(.black))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(Color.cyan.opacity(0.92)))
                            .foregroundStyle(.black)
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
                .font(.system(size: compact ? 18 : 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: compact ? 44 : 60, alignment: .topLeading)

            Text(car.displayPrice)
                .font(compact ? .title3.bold() : .title2.bold())
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
        HStack {
            Spacer(minLength: 0)
            HStack(spacing: 12) {
                ForEach(CatalogBrand.allCases) { item in
                    Button {
                        guard brand != item else { return }
                        brand = item
                        onChange(item)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: item.accent)
                                .font(.title3.weight(.semibold))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.shortTitle)
                                    .font(.subheadline.weight(.bold))
                                Text(item == .home ? "Mieszkania · domy · działki" : "Marki · paliwo · skrzynia")
                                    .font(.system(size: 10, weight: .medium))
                                    .opacity(0.7)
                            }
                        }
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                        .frame(minWidth: 220, alignment: .leading)
                    }
                    .buttonStyle(EOSBrandButtonStyle(
                        selected: brand == item,
                        accent: item == .home ? .green : .cyan
                    ))
                    .focusEffectDisabled()
                }
            }
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(.ultraThinMaterial.opacity(0.28))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(0.12), lineWidth: 1)
            )
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
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

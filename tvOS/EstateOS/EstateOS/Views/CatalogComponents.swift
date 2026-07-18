import SwiftUI

struct CarsRailView: View {
    let cars: [CarListing]
    let onSelect: (CarListing) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 28) {
                ForEach(cars.prefix(80)) { car in
                    Button {
                        onSelect(car)
                    } label: {
                        CarCardView(car: car)
                            .frame(width: 480)
                    }
                    .buttonStyle(.plain)
                    .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .hoverEffect(.highlight)
                    .eosFocusParallax(lift: 16, scale: 1.07)
                }
            }
            .padding(.vertical, 8)
        }
    }
}

struct CarCardView: View {
    let car: CarListing
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            EOSOfferThumbnail(url: EOSOfferMedia.imageURL(from: car.imageUrl), height: 240)
                .overlay(alignment: .topLeading) {
                    if car.featured {
                        Text("PROMO")
                            .font(.caption2.weight(.black))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(Color.cyan.opacity(0.9)))
                            .foregroundStyle(.black)
                            .padding(10)
                    }
                }
                .overlay(alignment: .bottomLeading) {
                    if !car.city.isEmpty {
                        Text(car.city)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(.ultraThinMaterial.opacity(0.55))
                            .clipShape(Capsule())
                            .padding(10)
                    }
                }

            EOSAdaptiveTitle(text: car.displayHeadline, maxLines: 2, maxSize: 22, minSize: 15)
                .foregroundStyle(.white)

            Text(car.displayPrice)
                .font(.title3.bold())
                .foregroundStyle(Color.cyan)

            Text(car.displaySpecs)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(18)
        .eosGlass(cornerRadius: 22, opacity: isFocused ? 0.52 : 0.34)
        .animation(.easeOut(duration: 0.28).delay(isFocused ? 0.04 : 0), value: isFocused)
    }
}

struct BrandSwitcher: View {
    @Binding var brand: CatalogBrand
    var onChange: (CatalogBrand) -> Void

    var body: some View {
        HStack(spacing: 10) {
            ForEach(CatalogBrand.allCases) { item in
                Button {
                    brand = item
                    onChange(item)
                } label: {
                    Label(item.shortTitle, systemImage: item.accent)
                        .font(.headline.weight(.bold))
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .tint(brand == item ? (item == .home ? Color.green : Color.cyan) : Color.white.opacity(0.12))
                .foregroundStyle(brand == item ? .black : .white)
            }
        }
        .padding(8)
        .eosGlass(cornerRadius: 18, opacity: 0.28)
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
                        colors: [.clear, .black.opacity(0.25), .black.opacity(0.88)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

            VStack(alignment: .leading, spacing: 16) {
                Text(badge)
                    .font(.caption.weight(.black))
                    .tracking(1.2)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(accent.opacity(0.85)))
                    .foregroundStyle(.black)

                EOSAdaptiveTitle(text: title, maxLines: 2, maxSize: 42, minSize: 26)
                    .foregroundStyle(.white)

                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.title3.weight(.medium))
                        .foregroundStyle(.white.opacity(0.82))
                        .lineLimit(2)
                }

                HStack(spacing: 16) {
                    Button(primaryTitle, action: onPrimary)
                        .buttonStyle(.borderedProminent)
                        .tint(accent)
                        .foregroundStyle(.black)

                    if let secondaryTitle, let onSecondary {
                        Button(secondaryTitle, action: onSecondary)
                            .buttonStyle(.bordered)
                    }
                }
            }
            .padding(36)
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .eosGlass(cornerRadius: 28, opacity: 0.22)
        .focusSection()
    }
}

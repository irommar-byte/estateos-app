import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var app: AppModel
    @FocusState private var queryFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(app.catalogBrand == .home ? "Szukaj nieruchomości" : "Szukaj samochodów")
                .font(.system(size: 36, weight: .bold, design: .rounded))

            TextField(
                app.catalogBrand == .home
                    ? "Miasto, dzielnica, tytuł oferty"
                    : "Marka, model, miasto, paliwo…",
                text: Binding(
                    get: { app.catalogBrand == .home ? app.searchQuery : app.carSearchQuery },
                    set: { newValue in
                        if app.catalogBrand == .home {
                            app.searchQuery = newValue
                        } else {
                            app.carSearchQuery = newValue
                        }
                    }
                )
            )
            .textFieldStyle(.plain)
            .font(.title3)
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .eosGlass(cornerRadius: 16, opacity: 0.34)
            .focused($queryFocused)

            if app.catalogBrand == .home {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(HomeFilterChip.allCases) { chip in
                            Button(chip.title) { app.selectHomeFilter(chip) }
                                .buttonStyle(EOSChipButtonStyle(selected: app.homeFilterChip == chip, accent: .green))
                                .focusEffectDisabled()
                        }
                    }
                }
                .focusSection()
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        Button("Wszystkie typy") { app.clearHomePropertyTypes() }
                            .buttonStyle(EOSChipButtonStyle(selected: app.selectedHomePropertyTypes.isEmpty, accent: .green))
                            .focusEffectDisabled()
                        ForEach(app.homePropertyTypeCounts, id: \.kind) { item in
                            Button("\(item.kind.title) (\(item.count))") {
                                app.toggleHomePropertyType(item.kind)
                            }
                            .buttonStyle(EOSChipButtonStyle(
                                selected: app.selectedHomePropertyTypes.contains(item.kind),
                                accent: .green
                            ))
                            .focusEffectDisabled()
                        }
                    }
                }
                .focusSection()
                homeResults
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(CarFilterChip.allCases) { chip in
                            Button(chip.title) { app.selectCarFilter(chip) }
                                .buttonStyle(EOSChipButtonStyle(selected: app.carFilterChip == chip, accent: .cyan))
                                .focusEffectDisabled()
                        }
                    }
                }
                .focusSection()
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        Button("Wszystkie marki") { app.clearCarMakes() }
                            .buttonStyle(EOSChipButtonStyle(selected: app.selectedCarMakes.isEmpty, accent: .cyan))
                            .focusEffectDisabled()
                        ForEach(Array(app.popularCarMakes.prefix(12)), id: \.name) { item in
                            Button("\(item.name) (\(item.count))") {
                                app.toggleCarMake(item.name)
                            }
                            .buttonStyle(EOSChipButtonStyle(
                                selected: app.selectedCarMakes.contains(where: {
                                    $0.caseInsensitiveCompare(item.name) == .orderedSame
                                }),
                                accent: .cyan
                            ))
                            .focusEffectDisabled()
                        }
                    }
                }
                .focusSection()
                carResults
            }
        }
        .padding(24)
        .eosGlass(cornerRadius: 28, opacity: 0.26)
        .focusSection()
        .onAppear { queryFocused = true }
        .onChange(of: app.catalogBrand) { _, _ in
            queryFocused = true
        }
    }

    private var homeResults: some View {
        let items = app.filteredOffersForBrowse
        return ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: 16) {
                if items.isEmpty {
                    Text("Brak wyników. Zmień frazę lub filtr.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 24)
                }
                ForEach(items.prefix(80)) { offer in
                    Button {
                        app.openDetail(offer)
                    } label: {
                        HStack(spacing: 18) {
                            EOSOfferThumbnail(
                                url: EOSOfferMedia.primaryImageURL(for: offer),
                                height: 96
                            )
                            .frame(width: 150)

                            VStack(alignment: .leading, spacing: 6) {
                                Text(offer.title)
                                    .font(.headline)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                    .foregroundStyle(.white)
                                HStack(spacing: 8) {
                                    Text(offer.displayLocation)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    if let d = app.distanceLabel(forCity: offer.city) {
                                        Text(d)
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.green)
                                    }
                                }
                                Text(offer.transactionLabel)
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(.green.opacity(0.9))
                            }
                            Spacer(minLength: 16)
                            Text(EOSFormat.pricePLN(offer.price))
                                .font(.title3.weight(.bold))
                                .foregroundStyle(.green)
                        }
                        .padding(16)
                        .eosGlass(cornerRadius: 18, opacity: 0.32)
                    }
                    .buttonStyle(EOSPosterButtonStyle())
                    .focusEffectDisabled()
                }
            }
        }
    }

    private var carResults: some View {
        let items = app.filteredCars
        return ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: 16) {
                if items.isEmpty {
                    Text("Brak wyników. Zmień frazę lub filtr.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 24)
                }
                ForEach(items.prefix(80)) { car in
                    Button {
                        app.openCarDetail(car)
                    } label: {
                        HStack(spacing: 18) {
                            EOSOfferThumbnail(
                                url: EOSOfferMedia.imageURL(from: car.imageUrl),
                                height: 96
                            )
                            .frame(width: 150)

                            VStack(alignment: .leading, spacing: 6) {
                                Text(car.displayHeadline)
                                    .font(.headline)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                    .foregroundStyle(.white)
                                HStack(spacing: 8) {
                                    Text(car.city.isEmpty ? car.displaySpecs : "\(car.city) · \(car.displaySpecs)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                    if let d = app.distanceLabel(forCity: car.city) {
                                        Text(d)
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.cyan)
                                    }
                                }
                            }
                            Spacer(minLength: 16)
                            Text(car.displayPrice)
                                .font(.title3.weight(.bold))
                                .foregroundStyle(.cyan)
                        }
                        .padding(16)
                        .eosGlass(cornerRadius: 18, opacity: 0.32)
                    }
                    .buttonStyle(EOSPosterButtonStyle())
                    .focusEffectDisabled()
                }
            }
        }
    }
}

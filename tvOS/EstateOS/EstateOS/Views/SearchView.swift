import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var app: AppModel
    @FocusState private var queryFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline) {
                Text(app.catalogBrand == .home ? "Szukaj nieruchomości" : "Szukaj samochodów")
                    .font(.system(size: 30, weight: .semibold))
                Spacer(minLength: 12)
                Text(resultCountLabel)
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.secondary)
            }

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

            Text("Filtry Home / Car ustawiasz nad listą — tu wpisz frazę.")
                .font(.caption)
                .foregroundStyle(.tertiary)

            Group {
                if app.catalogBrand == .home {
                    homeResults
                } else {
                    carResults
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .onAppear {
            if app.searchQuery.isEmpty, app.carSearchQuery.isEmpty {
                queryFocused = true
            }
        }
    }

    private var resultCountLabel: String {
        if app.catalogBrand == .home {
            return "\(app.filteredOffersForBrowse.count) wyników"
        }
        return "\(app.filteredCars.count) wyników"
    }

    private var homeResults: some View {
        let items = app.filteredOffersForBrowse
        return ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: 14) {
                if app.isLoadingOffers, app.offers.isEmpty {
                    ProgressView("Ładowanie…")
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 24)
                } else if items.isEmpty {
                    Text("Brak wyników. Zmień frazę lub filtry nad listą.")
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
                                        .lineLimit(1)
                                    if let d = app.distanceLabel(forCity: offer.city) {
                                        Text(d)
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(EOSPalette.home)
                                    }
                                }
                            }
                            Spacer(minLength: 16)
                            Text(EOSFormat.pricePLN(offer.price))
                                .font(.title3.weight(.bold))
                                .foregroundStyle(EOSPalette.home)
                        }
                        .padding(16)
                        .eosGlass(cornerRadius: 18, opacity: 0.32)
                        .eosFocusRing(cornerRadius: 18, accent: EOSPalette.home)
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
            LazyVStack(spacing: 14) {
                if app.isLoadingCars, app.cars.isEmpty {
                    ProgressView("Ładowanie…")
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 24)
                } else if items.isEmpty {
                    Text("Brak wyników. Zmień frazę lub filtry nad listą.")
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
                                            .foregroundStyle(EOSPalette.car)
                                    }
                                }
                            }
                            Spacer(minLength: 16)
                            Text(car.displayPrice)
                                .font(.title3.weight(.bold))
                                .foregroundStyle(EOSPalette.car)
                        }
                        .padding(16)
                        .eosGlass(cornerRadius: 18, opacity: 0.32)
                        .eosFocusRing(cornerRadius: 18, accent: EOSPalette.car)
                    }
                    .buttonStyle(EOSPosterButtonStyle())
                    .focusEffectDisabled()
                }
            }
        }
    }
}

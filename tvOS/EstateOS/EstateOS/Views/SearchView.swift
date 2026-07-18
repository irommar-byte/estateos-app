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
                homeResults
            } else {
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
                                Text(offer.displayLocation)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
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
                    .buttonStyle(.plain)
                    .eosFocusParallax(lift: 10, scale: 1.03)
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
                                Text(car.displaySpecs)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                            Spacer(minLength: 16)
                            Text(car.displayPrice)
                                .font(.title3.weight(.bold))
                                .foregroundStyle(.cyan)
                        }
                        .padding(16)
                        .eosGlass(cornerRadius: 18, opacity: 0.32)
                    }
                    .buttonStyle(.plain)
                    .eosFocusParallax(lift: 10, scale: 1.03)
                }
            }
        }
    }
}

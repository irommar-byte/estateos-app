import SwiftUI

struct HomeFavoritesView: View {
    @EnvironmentObject private var app: AppModel
    @Binding var tab: HomeTab

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 28) {
                favoritesHeader(title: "Ulubione nieruchomości", syncing: app.isLoadingFavorites)

                if app.isLoadingFavorites {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("Synchronizacja ulubionych…")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                } else if app.session == nil {
                    favoritesEmpty(
                        lines: ["Zaloguj się, aby synchronizować ulubione z iPhone i WWW."],
                        cta: "Zaloguj się",
                        action: { app.openLoginSheet() },
                        accent: EOSPalette.home
                    )
                } else {
                    let favs = app.favoriteOffers.isEmpty
                        ? app.offers.filter { app.isFavorite($0.id) }
                        : app.favoriteOffers
                    if favs.isEmpty {
                        favoritesEmpty(
                            lines: [
                                "Brak ulubionych nieruchomości.",
                                "Otwórz ofertę i dodaj do ulubionych."
                            ],
                            cta: "Przejdź do showroomu",
                            action: { tab = .showroom },
                            accent: EOSPalette.home
                        )
                    } else {
                        OffersRailView(offers: favs, onSelect: app.openDetail)
                    }
                }

                favoritesHeader(title: "Ulubione samochody", syncing: false)
                    .padding(.top, 12)

                if app.favoriteCars.isEmpty {
                    favoritesEmpty(
                        lines: [
                            "Brak ulubionych aut.",
                            "Oznacz sercem auto w szczegółach — zapisujemy lokalnie."
                        ],
                        cta: "Przejdź do katalogu Car",
                        action: {
                            app.setCatalogBrand(.car)
                            tab = .showroom
                        },
                        accent: EOSPalette.car
                    )
                } else {
                    CarsRailView(cars: app.favoriteCars, onSelect: app.openCarDetail)
                }
            }
            .padding(.bottom, 40)
        }
    }

    private func favoritesHeader(title: String, syncing: Bool) -> some View {
        HStack(spacing: 12) {
            Text(title)
                .font(.system(size: 28, weight: .semibold))
            if syncing {
                Text("Sync")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.pink.opacity(0.35)))
                    .accessibilityLabel("Trwa synchronizacja ulubionych")
            }
        }
    }

    private func favoritesEmpty(
        lines: [String],
        cta: String,
        action: @escaping () -> Void,
        accent: Color
    ) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(Array(lines.prefix(2).enumerated()), id: \.offset) { _, line in
                Text(line)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Button(cta, action: action)
                .buttonStyle(EOSDetailActionButtonStyle(accent: accent))
                .focusEffectDisabled()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }
}

import SwiftUI

/// Ulubione (2026-10): the same cinematic language as the showroom — the photo of the card in
/// focus fills the screen once focus rests, rails of lockups below. Offers sync with the
/// account (iPhone, estateos.pl); cars are kept on this Apple TV.
struct HomeFavoritesView: View {
    @EnvironmentObject private var app: AppModel
    @Binding var tab: HomeTab

    @State private var spotlight = ShowroomSpotlight()
    @FocusState private var primary: Bool

    private typealias C = ShowroomCategory

    private var favoriteOffers: [EstateOffer] {
        app.favoriteOffers.isEmpty ? app.offers.filter { app.isFavorite($0.id) } : app.favoriteOffers
    }

    private var sections: [ShowroomSection] {
        var result: [ShowroomSection] = []
        let offers = favoriteOffers
        if !offers.isEmpty {
            result.append(ShowroomSection(
                id: "fav-homes", title: "Nieruchomości", items: offers.map(ShowroomItem.init(offer:)),
                icon: "heart.fill", tint: C.favorite, caption: "Zsynchronizowane z iPhone’em i estateos.pl"
            ))
        }
        if !app.favoriteCars.isEmpty {
            result.append(ShowroomSection(
                id: "fav-cars", title: "Samochody", items: app.favoriteCars.map(ShowroomItem.init(car:)),
                icon: "car.fill", tint: C.favorite, caption: "Zapisane na tym Apple TV"
            ))
        }
        let recent = app.recentOffers.prefix(16).map(ShowroomItem.init(offer:))
        if !recent.isEmpty { result.append(.recent(items: Array(recent))) }
        return result
    }

    var body: some View {
        let rails = sections
        ZStack(alignment: .topLeading) {
            ShowroomBackdrop(spotlight: spotlight, fallback: rails.first?.items.first?.imageURL)
            EOSBackdropScrim()
            Color.black.opacity(rails.isEmpty ? 0.35 : 0.15).ignoresSafeArea()

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 56) {
                    header
                    if app.isLoadingFavorites && favoriteOffers.isEmpty {
                        HStack(spacing: 16) {
                            ProgressView()
                            Text("Synchronizuję ulubione…")
                                .font(.system(size: 24, weight: .medium))
                                .foregroundStyle(.white.opacity(0.7))
                        }
                    }
                    if app.session == nil {
                        emptyCard(
                            icon: "heart.text.square", tint: C.favorite,
                            title: "Ulubione z iPhone’a, tutaj",
                            text: "Zaloguj się, a oferty oznaczone sercem na iPhonie i na estateos.pl pojawią się na telewizorze.",
                            cta: "Zaloguj się", action: app.openLoginSheet
                        )
                    }
                    if rails.isEmpty, app.session != nil, !app.isLoadingFavorites {
                        emptyCard(
                            icon: "heart", tint: C.favorite,
                            title: "Nic tu jeszcze nie ma",
                            text: "Otwórz ofertę i naciśnij serce — wróci tu na każdym urządzeniu.",
                            cta: "Przeglądaj nieruchomości", action: { tab = .showroom }
                        )
                    }
                    ForEach(rails) { section in
                        ShowroomRail(section: section, spotlight: spotlight)
                    }
                }
                .padding(.top, EOSShellMetrics.contentTopInset + 40)
                .padding(.bottom, 80)
            }
            .scrollClipDisabled()
        }
        .onAppear { spotlight.reset(to: sections.first?.items.first) }
        .onDisappear { spotlight.cancelPending() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Ulubione")
                .font(.system(size: 76, weight: .bold))
                .tracking(-1)
            HStack(spacing: 14) {
                countChip("\(favoriteOffers.count)", "nieruchomości", icon: "house.fill")
                countChip("\(app.favoriteCars.count)", "samochodów", icon: "car.fill")
                if app.isLoadingFavorites && !favoriteOffers.isEmpty {
                    ProgressView().scaleEffect(0.7)
                }
            }
        }
        .foregroundStyle(.white)
        .shadow(color: .black.opacity(0.35), radius: 20, y: 4)
    }

    private func countChip(_ value: String, _ label: String, icon: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 18, weight: .semibold))
            Text(value).font(.system(size: 22, weight: .bold))
            Text(label).font(.system(size: 20, weight: .medium)).opacity(0.75)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .eosGlassPanel(Capsule())
    }

    private func emptyCard(icon: String, tint: Color, title: String, text: String, cta: String, action: @escaping () -> Void) -> some View {
        HStack(alignment: .center, spacing: 36) {
            Image(systemName: icon)
                .font(.system(size: 60, weight: .light))
                .foregroundStyle(tint)
                .frame(width: 120, height: 120)
                .background(Circle().fill(tint.opacity(0.14)))
            VStack(alignment: .leading, spacing: 12) {
                Text(title).font(.system(size: 36, weight: .bold))
                Text(text)
                    .font(.system(size: 23))
                    .foregroundStyle(.white.opacity(0.72))
                    .frame(maxWidth: 820, alignment: .leading)
                Button(cta, action: action)
                    .eosButton()
                    .focused($primary)
                    .padding(.top, 8)
            }
        }
        .foregroundStyle(.white)
        .padding(40)
        .eosGlassPanel(cornerRadius: 40)
        .focusSection()
    }
}

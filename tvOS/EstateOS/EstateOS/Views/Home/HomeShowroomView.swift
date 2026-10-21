import SwiftUI

/// One thing the showroom can feature — an offer or a car — in a shape the hero and rails share.
struct ShowroomItem: Identifiable {
    let id: String
    let eyebrow: String
    let title: String
    let meta: String
    let price: String
    let imageURL: URL?
    let badge: String?
    let offer: EstateOffer?
    let car: CarListing?

    init(offer: EstateOffer) {
        id = "home-\(offer.id)"
        eyebrow = offer.isWithinLast24Hours
            ? "NOWOŚĆ · \(offer.transactionLabel.uppercased())"
            : [offer.transactionLabel, offer.displayPropertyType].compactMap { $0 }.joined(separator: " · ").uppercased()
        title = offer.title
        meta = [
            offer.displayLocation.isEmpty ? nil : offer.displayLocation,
            offer.area.map { "\(Int($0)) m²" },
            offer.rooms.map { String(format: "%.0f pok.", $0) },
        ].compactMap { $0 }.joined(separator: " · ")
        price = EOSFormat.pricePLN(offer.price)
        imageURL = EOSOfferMedia.primaryImageURL(for: offer)
        badge = offer.priceDiscountBadgeText
        self.offer = offer
        car = nil
    }

    init(car: CarListing) {
        id = "car-\(car.id)"
        eyebrow = car.featured ? "WYRÓŻNIONE AUTO" : "SAMOCHÓD"
        title = car.displayHeadline
        meta = [car.displaySpecs, car.city].filter { !$0.isEmpty }.joined(separator: " · ")
        price = car.displayPrice
        imageURL = EOSOfferMedia.imageURL(from: car.imageUrl)
        badge = nil
        offer = nil
        self.car = car
    }

    var cardSubtitle: String {
        [price, offer?.displayLocation ?? car?.city].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

struct ShowroomSection: Identifiable {
    let id: String
    let title: String
    let items: [ShowroomItem]
}

/// What the big photo and hero text are "about".
///
/// Flying across cards changes nothing on screen except the focus lift. Only when focus
/// RESTS on a card (~0.35 s) is its screen-size photo fetched and decoded in the background;
/// then the title, price and photo change together in one cross-fade — the same feel as the
/// Apple TV app. It lives outside the showroom's view state, so a focus change never
/// re-renders the rails.
@MainActor
final class ShowroomSpotlight: ObservableObject {
    @Published private(set) var item: ShowroomItem?
    private var pending: Task<Void, Never>?

    static let restDelayNs: UInt64 = 350_000_000

    func reset(to item: ShowroomItem?) {
        pending?.cancel()
        self.item = item
    }

    func focus(_ item: ShowroomItem) {
        pending?.cancel()
        guard item.id != self.item?.id else { return }
        pending = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.restDelayNs)
            guard !Task.isCancelled else { return }
            if let url = item.imageURL {
                _ = await EOSImageCache.load(url, size: .screen)
            }
            guard !Task.isCancelled, let self else { return }
            withAnimation(EOSMotion.spotlightText) { self.item = item }
        }
    }

    func cancelPending() { pending?.cancel() }
}

/// Sections are built from the whole catalog (filters, sorting) — expensive. They are rebuilt
/// only when the catalog or filters actually change, never on a focus move.
final class ShowroomMemo {
    var key = ""
    var sections: [ShowroomSection] = []
    var featured: ShowroomItem?
}

/// Showroom (Nieruchomości or Samochody): full-screen photo of the offer in focus, its title and
/// price on the left, rails of lockups underneath. Focus moves only by the tvOS focus engine.
struct HomeShowroomView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.eosLaunchRevealed) private var revealed
    @Environment(\.eosLaunchFinished) private var launchFinished

    let brand: CatalogBrand
    var onOpenFilters: () -> Void

    // Plain @State (not @StateObject): this view must NOT re-render when the spotlight changes.
    @State private var spotlight = ShowroomSpotlight()
    @State private var memo = ShowroomMemo()
    @FocusState private var primaryFocused: Bool

    private var accent: Color { brand == .car ? EOSPalette.car : Color(red: 0.17, green: 0.82, blue: 0.54) }

    var body: some View {
        let snapshot = refreshedMemo()

        ZStack(alignment: .topLeading) {
            ShowroomBackdrop(spotlight: spotlight, fallback: snapshot.featured?.imageURL)
            EOSBackdropScrim()

            if isLoading {
                ProgressView(brand == .home ? "Ładowanie nieruchomości…" : "Ładowanie samochodów…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if snapshot.featured != nil {
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 64) {
                        ShowroomHero(
                            spotlight: spotlight,
                            fallback: snapshot.featured,
                            newest: snapshot.sections.first?.items ?? [],
                            brand: brand,
                            accent: accent,
                            primaryFocused: $primaryFocused,
                            onOpenFilters: onOpenFilters
                        )
                        .containerRelativeFrame(.vertical, alignment: .bottomLeading) { h, _ in h * 0.66 }

                        ForEach(snapshot.sections) { section in
                            ShowroomRail(section: section, spotlight: spotlight)
                        }
                    }
                    .padding(.bottom, 80)
                    .opacity(revealed ? 1 : 0)
                    .offset(y: revealed ? 0 : 48)
                    .animation(EOSMotion.launchReveal.delay(0.25), value: revealed)
                }
                .scrollClipDisabled()
            } else {
                emptyState
            }
        }
        .defaultFocus($primaryFocused, true)
        .onAppear {
            if spotlight.item == nil { spotlight.reset(to: snapshot.featured) }
            if launchFinished { claimPrimaryFocus() }
        }
        .onDisappear { spotlight.cancelPending() }
        .onChange(of: launchFinished) { _, finished in
            if finished { claimPrimaryFocus() }
        }
        .onChange(of: snapshot.featured?.id) { _, _ in
            spotlight.reset(to: memo.featured)
        }
    }

    // MARK: Memo

    private var catalogSignature: String {
        let firstHome = app.offers.first?.id ?? 0
        let firstCar = app.cars.first?.id ?? 0
        return [
            "\(brand)", "\(app.offers.count)", "\(firstHome)", "\(app.cars.count)", "\(firstCar)",
            app.homeFilterSummary, app.carFilterSummary,
            "\(app.isHomeFilteringActive)", "\(app.isCarFilteringActive)",
            "\(app.favoriteOfferIds.count)", "\(app.favoriteCarIds.count)", "\(app.session != nil)",
        ].joined(separator: "|")
    }

    private func refreshedMemo() -> ShowroomMemo {
        let key = catalogSignature
        if memo.key != key {
            memo.key = key
            memo.sections = makeSections()
            memo.featured = featuredItem()
        }
        return memo
    }

    // MARK: Empty / loading

    private var isLoading: Bool {
        brand == .home
            ? (app.isLoadingOffers && app.offers.isEmpty)
            : (app.isLoadingCars && app.cars.isEmpty)
    }

    private var emptyState: some View {
        let filtering = brand == .home ? app.isHomeFilteringActive : app.isCarFilteringActive
        return VStack(alignment: .leading, spacing: 20) {
            Text(filtering ? "Brak wyników dla tych filtrów" : (brand == .home ? "Brak nieruchomości w katalogu" : "Brak samochodów w katalogu"))
                .font(.system(size: 44, weight: .bold))
            Text(filtering ? "Zmień filtry albo wróć do wszystkich ofert." : "Spróbuj odświeżyć katalog za chwilę.")
                .font(.system(size: 26))
                .foregroundStyle(.white.opacity(0.7))
            HStack(spacing: 24) {
                if filtering {
                    Button("Wyczyść filtry") {
                        withAnimation { brand == .home ? app.clearHomeFilters() : app.clearCarFilters() }
                    }
                    .eosButton()
                    .focused($primaryFocused)
                    Button("Filtry", action: onOpenFilters).eosButton()
                } else {
                    Button("Odśwież") {
                        Task {
                            if brand == .home { try? await app.refreshOffers() } else { try? await app.refreshCars() }
                        }
                    }
                    .eosButton()
                    .focused($primaryFocused)
                }
            }
            .padding(.top, 12)
        }
        .padding(48)
        .eosGlassPanel(cornerRadius: 40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Data

    private func featuredItem() -> ShowroomItem? {
        switch brand {
        case .home:
            let filtering = app.isHomeFilteringActive
            let filtered = app.filteredOffersForBrowse
            let offer = filtering ? filtered.first : (app.showroomHomeNewest.first ?? filtered.first)
            return offer.map(ShowroomItem.init(offer:))
        case .car:
            let car = app.showroomCarFeatured.first ?? app.showroomCarFresh.first ?? app.filteredCars.first
            return car.map(ShowroomItem.init(car:))
        }
    }

    private func makeSections() -> [ShowroomSection] {
        var result: [ShowroomSection] = []
        func add(_ title: String, offers: [EstateOffer], limit: Int = 40) {
            let items = offers.prefix(limit).map(ShowroomItem.init(offer:))
            if !items.isEmpty { result.append(ShowroomSection(id: title, title: title, items: Array(items))) }
        }
        func add(_ title: String, cars: [CarListing], limit: Int = 40) {
            let items = cars.prefix(limit).map(ShowroomItem.init(car:))
            if !items.isEmpty { result.append(ShowroomSection(id: title, title: title, items: Array(items))) }
        }

        switch brand {
        case .home:
            if app.isHomeFilteringActive {
                add("Wyniki · \(app.homeFilterSummary)", offers: app.filteredOffersForBrowse, limit: 80)
            } else {
                add("Nowe w ostatnich 24 h", offers: app.showroomHomeNewest, limit: 24)
                if app.session != nil {
                    let favs = app.favoriteOffers.isEmpty ? app.offers.filter { app.isFavorite($0.id) } : app.favoriteOffers
                    add("Twoje ulubione", offers: favs, limit: 28)
                }
                add("Polecane", offers: app.filteredOffersForBrowse)
                add("Warszawa i okolice", offers: app.showroomHomeWarsaw)
                add("Segment premium", offers: app.showroomHomePremium)
                add("Przecenione", offers: app.showroomHomeDiscounted)
                add("Na wynajem", offers: app.showroomHomeRent)
            }
        case .car:
            if app.isCarFilteringActive {
                add("Wyniki · \(app.carFilterSummary)", cars: app.filteredCars, limit: 80)
            } else {
                add("Nowe auta · 24 h", cars: app.showroomCarFresh, limit: 24)
                add("Twoje ulubione auta", cars: app.favoriteCars, limit: 28)
                add("Wyróżnione", cars: app.carsFeatured, limit: 28)
                add("Wszystkie samochody", cars: app.filteredCars, limit: 48)
                add("Automatyczna skrzynia", cars: app.showroomCarAutomatic)
                add("Elektryczne i hybrydy", cars: app.showroomCarElectricHybrid)
            }
        }
        return result
    }

    private func claimPrimaryFocus() {
        Task { @MainActor in
            // Let the view become enabled first, then take focus.
            try? await Task.sleep(nanoseconds: 80_000_000)
            primaryFocused = true
        }
    }
}

// MARK: - Backdrop (observes the spotlight on its own)

private struct ShowroomBackdrop: View {
    @ObservedObject var spotlight: ShowroomSpotlight
    let fallback: URL?

    var body: some View {
        EOSBackdrop(url: spotlight.item?.imageURL ?? fallback)
    }
}

// MARK: - Hero (observes the spotlight on its own)

private struct ShowroomHero: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject var spotlight: ShowroomSpotlight
    let fallback: ShowroomItem?
    let newest: [ShowroomItem]
    let brand: CatalogBrand
    let accent: Color
    var primaryFocused: FocusState<Bool>.Binding
    var onOpenFilters: () -> Void

    var body: some View {
        let item = spotlight.item ?? fallback
        VStack(alignment: .leading, spacing: 16) {
            Spacer(minLength: 0)
            if let item {
                VStack(alignment: .leading, spacing: 16) {
                    Text(item.eyebrow)
                        .font(.system(size: 20, weight: .bold))
                        .tracking(2)
                        .foregroundStyle(accent)
                        .lineLimit(1)
                    Text(item.title)
                        .font(.system(size: 76, weight: .bold))
                        .tracking(-1)
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .minimumScaleFactor(0.6)
                        .shadow(color: .black.opacity(0.35), radius: 24, y: 4)
                    if !item.meta.isEmpty {
                        Text(item.meta)
                            .font(.system(size: 28, weight: .medium))
                            .foregroundStyle(.white.opacity(0.86))
                            .lineLimit(1)
                    }
                    HStack(alignment: .firstTextBaseline, spacing: 18) {
                        Text(item.price)
                            .font(.system(size: 44, weight: .semibold))
                            .foregroundStyle(.white)
                        if let badge = item.badge {
                            EOSGlassBadge(text: badge, tint: Color(red: 0.5, green: 0.86, blue: 0.66))
                        }
                    }
                }
                .id(item.id)
                .transition(.opacity.combined(with: .offset(y: 8)))

                HStack(spacing: 24) {
                    Button { open(item) } label: {
                        Label(brand == .home ? "Zobacz ofertę" : "Zobacz auto", systemImage: "arrow.up.forward")
                    }
                    .eosButton()
                    .focused(primaryFocused)

                    if newest.count > 1 {
                        Button { openImmersive(newest) } label: {
                            Label("Przeglądaj nowe", systemImage: "rectangle.stack")
                        }
                        .eosButton()
                    }

                    Button { toggleFavorite(item) } label: {
                        Image(systemName: isFavorite(item) ? "heart.fill" : "heart")
                            .accessibilityLabel(isFavorite(item) ? "Usuń z ulubionych" : "Dodaj do ulubionych")
                    }
                    .eosButton()

                    Button(action: onOpenFilters) {
                        Label(filterLabel, systemImage: "line.3.horizontal.decrease")
                    }
                    .eosButton()
                }
                .padding(.top, 22)
            }
        }
        .frame(maxWidth: 1180, alignment: .leading)
        .focusSection()
    }

    private var filterLabel: String {
        let count = brand == .home ? app.homeSecondaryFilterCount : app.carSecondaryFilterCount
        let active = brand == .home ? app.isHomeFilteringActive : app.isCarFilteringActive
        if count > 0 { return "Filtry · \(count)" }
        return active ? "Filtry · aktywne" : "Filtry"
    }

    private func open(_ item: ShowroomItem) {
        if let offer = item.offer { app.openDetail(offer) }
        if let car = item.car { app.openCarDetail(car) }
    }

    private func isFavorite(_ item: ShowroomItem) -> Bool {
        if let offer = item.offer { return app.isFavorite(offer.id) }
        if let car = item.car { return app.isFavoriteCar(car.id) }
        return false
    }

    private func toggleFavorite(_ item: ShowroomItem) {
        if let offer = item.offer { Task { await app.toggleFavorite(offer) } }
        if let car = item.car { app.toggleFavoriteCar(car) }
    }

    private func openImmersive(_ items: [ShowroomItem]) {
        if brand == .home {
            app.openImmersiveBrowse(at: 0, from: items.compactMap(\.offer))
        } else {
            app.openImmersiveCarBrowse(at: 0, from: items.compactMap(\.car))
        }
    }
}

// MARK: - Rail

private struct ShowroomRail: View {
    @EnvironmentObject private var app: AppModel
    let section: ShowroomSection
    let spotlight: ShowroomSpotlight   // not observed: cards only report focus

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 14) {
                Text(section.title)
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundStyle(.white)
                Text("\(section.items.count)")
                    .font(.system(size: 24, weight: .medium).monospacedDigit())
                    .foregroundStyle(.white.opacity(0.6))
            }
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 48) {
                    ForEach(section.items) { item in
                        EOSPosterCard(
                            imageURL: item.imageURL,
                            title: item.title,
                            subtitle: item.cardSubtitle,
                            width: 400,
                            onFocus: { spotlight.focus(item) },
                            action: { open(item) }
                        ) {
                            if let badge = item.badge {
                                EOSGlassBadge(text: badge, tint: Color(red: 0.5, green: 0.86, blue: 0.66))
                            }
                        }
                        .contextMenu {
                            Button(isFavorite(item) ? "Usuń z ulubionych" : "Dodaj do ulubionych") { toggleFavorite(item) }
                            Button("Przeglądaj na pełnym ekranie") { openImmersive(startingAt: item) }
                        }
                    }
                }
                .padding(.vertical, 36)
            }
            .scrollClipDisabled()
        }
        .focusSection()
        .onAppear {
            EOSImageCache.prefetch(urls: section.items.prefix(8).compactMap(\.imageURL), size: .card)
        }
    }

    private func open(_ item: ShowroomItem) {
        if let offer = item.offer { app.openDetail(offer) }
        if let car = item.car { app.openCarDetail(car) }
    }

    private func isFavorite(_ item: ShowroomItem) -> Bool {
        if let offer = item.offer { return app.isFavorite(offer.id) }
        if let car = item.car { return app.isFavoriteCar(car.id) }
        return false
    }

    private func toggleFavorite(_ item: ShowroomItem) {
        if let offer = item.offer { Task { await app.toggleFavorite(offer) } }
        if let car = item.car { app.toggleFavoriteCar(car) }
    }

    private func openImmersive(startingAt start: ShowroomItem) {
        let index = section.items.firstIndex { $0.id == start.id } ?? 0
        if start.offer != nil {
            app.openImmersiveBrowse(at: index, from: section.items.compactMap(\.offer))
        } else {
            app.openImmersiveCarBrowse(at: index, from: section.items.compactMap(\.car))
        }
    }
}

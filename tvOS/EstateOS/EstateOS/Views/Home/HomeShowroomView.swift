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
    /// Category signature: glyph, tint and a one-line explanation under the title.
    var icon: String = "square.grid.2x2"
    var tint: Color = .white
    var caption: String = ""
    /// EstateOS Intelligence rail — drawn with the iridescent Siri-style brand.
    var isIntelligence = false
    /// Rails about the viewer (Dla Ciebie, Ostatnio oglądane) — never feed the hero's "Przeglądaj".
    var isPersonal = false

    static func intelligence(items: [ShowroomItem], caption: String) -> ShowroomSection {
        ShowroomSection(
            id: "intelligence-for-you", title: "Dla Ciebie", items: items,
            icon: "brain", tint: EOSIntelligence.violet, caption: caption, isIntelligence: true, isPersonal: true
        )
    }

    static func recent(items: [ShowroomItem]) -> ShowroomSection {
        ShowroomSection(
            id: "recently-viewed", title: "Ostatnio oglądane", items: items,
            icon: "clock.arrow.circlepath", tint: ShowroomCategory.neutral,
            caption: "Wróć tam, gdzie skończyłeś", isPersonal: true
        )
    }
}

/// Category palette — muted, close in lightness, so rails feel like chapters of one book.
enum ShowroomCategory {
    static let fresh = Color(red: 0.36, green: 0.84, blue: 0.62)      // nowe
    static let favorite = Color(red: 1.00, green: 0.45, blue: 0.58)   // ulubione
    static let picked = Color(red: 0.98, green: 0.80, blue: 0.42)     // polecane / wyróżnione
    static let place = Color(red: 0.48, green: 0.72, blue: 1.00)      // lokalizacja
    static let premium = Color(red: 0.86, green: 0.74, blue: 0.52)    // premium
    static let deal = Color(red: 1.00, green: 0.58, blue: 0.40)       // przecenione
    static let rent = Color(red: 0.70, green: 0.62, blue: 1.00)       // wynajem
    static let neutral = Color(white: 0.85)
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
                    LazyVStack(alignment: .leading, spacing: 72) {
                        ShowroomHero(
                            spotlight: spotlight,
                            fallback: snapshot.featured,
                            newest: snapshot.sections.first(where: { !$0.isPersonal })?.items ?? [],
                            brand: brand,
                            accent: accent,
                            primaryFocused: $primaryFocused,
                            onOpenFilters: onOpenFilters
                        )
                        .containerRelativeFrame(.vertical, alignment: .bottomLeading) { h, _ in h * 0.66 }

                        ForEach(Array(snapshot.sections.enumerated()), id: \.element.id) { index, section in
                            ShowroomRail(section: section, spotlight: spotlight)
                            if index == 0, brand == .home, app.session == nil {
                                IntelligenceInviteCard { app.openLoginSheet() }
                            }
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
            "\(app.intelligenceOfferIds.count)", "\(app.intelligenceOfferIds.first ?? 0)",
            app.recentOfferIds.prefix(12).map(String.init).joined(separator: ","),
            app.recentCarIds.prefix(12).map(String.init).joined(separator: ","),
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
        typealias C = ShowroomCategory
        func section(_ title: String, _ items: [ShowroomItem], icon: String, tint: Color, caption: String) {
            guard !items.isEmpty else { return }
            result.append(ShowroomSection(id: title, title: title, items: items, icon: icon, tint: tint, caption: caption))
        }
        func add(_ title: String, offers: [EstateOffer], limit: Int = 40, icon: String, tint: Color, caption: String) {
            section(title, offers.prefix(limit).map(ShowroomItem.init(offer:)), icon: icon, tint: tint, caption: caption)
        }
        func add(_ title: String, cars: [CarListing], limit: Int = 40, icon: String, tint: Color, caption: String) {
            section(title, cars.prefix(limit).map(ShowroomItem.init(car:)), icon: icon, tint: tint, caption: caption)
        }

        switch brand {
        case .home:
            if app.isHomeFilteringActive {
                add("Wyniki wyszukiwania", offers: app.filteredOffersForBrowse, limit: 80,
                    icon: "line.3.horizontal.decrease", tint: C.neutral, caption: app.homeFilterSummary)
            } else {
                let picks = app.intelligenceOffers.prefix(24).map(ShowroomItem.init(offer:))
                if !picks.isEmpty {
                    result.append(.intelligence(items: Array(picks), caption: "Dobrane przez EstateOS Intelligence do Twojego gustu"))
                }
                let recent = app.recentOffers.prefix(16).map(ShowroomItem.init(offer:))
                if !recent.isEmpty { result.append(.recent(items: Array(recent))) }
                add("Nowe w ostatnich 24 h", offers: app.showroomHomeNewest, limit: 24,
                    icon: "clock.badge.checkmark", tint: C.fresh, caption: "Dodane w ciągu doby")
                if app.session != nil {
                    let favs = app.favoriteOffers.isEmpty ? app.offers.filter { app.isFavorite($0.id) } : app.favoriteOffers
                    add("Twoje ulubione", offers: favs, limit: 28,
                        icon: "heart.fill", tint: C.favorite, caption: "Zapisane na iPhonie, w przeglądarce i tutaj")
                }
                add("Polecane", offers: app.filteredOffersForBrowse,
                    icon: "star.fill", tint: C.picked, caption: "Wybór EstateOS")
                add("Warszawa i okolice", offers: app.showroomHomeWarsaw,
                    icon: "mappin.and.ellipse", tint: C.place, caption: "Stolica i miejscowości wokół")
                add("Segment premium", offers: app.showroomHomePremium,
                    icon: "crown.fill", tint: C.premium, caption: "Najbardziej wyjątkowe nieruchomości")
                add("Przecenione", offers: app.showroomHomeDiscounted,
                    icon: "tag.fill", tint: C.deal, caption: "Cena spadła w ostatnim czasie")
                add("Na wynajem", offers: app.showroomHomeRent,
                    icon: "key.fill", tint: C.rent, caption: "Mieszkania i domy do wynajęcia")
            }
        case .car:
            if app.isCarFilteringActive {
                add("Wyniki wyszukiwania", cars: app.filteredCars, limit: 80,
                    icon: "line.3.horizontal.decrease", tint: C.neutral, caption: app.carFilterSummary)
            } else {
                let recent = app.recentCars.prefix(16).map(ShowroomItem.init(car:))
                if !recent.isEmpty { result.append(.recent(items: Array(recent))) }
                add("Nowe auta · 24 h", cars: app.showroomCarFresh, limit: 24,
                    icon: "clock.badge.checkmark", tint: C.fresh, caption: "Dodane w ciągu doby")
                add("Twoje ulubione auta", cars: app.favoriteCars, limit: 28,
                    icon: "heart.fill", tint: C.favorite, caption: "Zapisane na tym Apple TV")
                add("Wyróżnione", cars: app.carsFeatured, limit: 28,
                    icon: "star.fill", tint: C.picked, caption: "Wybór EstateOS Car")
                add("Wszystkie samochody", cars: app.filteredCars, limit: 48,
                    icon: "car.fill", tint: C.neutral, caption: "Cały katalog")
                add("Automatyczna skrzynia", cars: app.showroomCarAutomatic,
                    icon: "gearshape.2.fill", tint: C.place, caption: "Wygodnie w mieście i w trasie")
                add("Elektryczne i hybrydy", cars: app.showroomCarElectricHybrid,
                    icon: "bolt.fill", tint: C.fresh, caption: "Napęd elektryczny i hybrydowy")
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

struct ShowroomBackdrop: View {
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

struct ShowroomRail: View {
    @EnvironmentObject private var app: AppModel
    let section: ShowroomSection
    let spotlight: ShowroomSpotlight   // not observed: cards only report focus

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ShowroomSectionHeader(section: section)
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
                            if section.isIntelligence {
                                IntelligenceBadge()
                            } else if let badge = item.badge {
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

// MARK: - Section header

/// Chapter header for a rail: tinted glyph in a glass disc, bold title with count, one-line
/// caption, and a hairline in the category colour fading out to the right.
struct ShowroomSectionHeader: View {
    let section: ShowroomSection

    var body: some View {
        if section.isIntelligence {
            IntelligenceSectionHeader(count: section.items.count, caption: section.caption)
        } else {
            categoryHeader
        }
    }

    private var categoryHeader: some View {
        HStack(alignment: .center, spacing: 22) {
            Image(systemName: section.icon)
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(section.tint)
                .frame(width: 60, height: 60)
                .background(Circle().fill(section.tint.opacity(0.16)))
                .background(Circle().fill(.ultraThinMaterial))
                .overlay(Circle().strokeBorder(section.tint.opacity(0.45), lineWidth: 1.5))
                .shadow(color: section.tint.opacity(0.25), radius: 14)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 14) {
                    Text(section.title)
                        .font(.system(size: 36, weight: .bold))
                        .tracking(-0.4)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text("\(section.items.count)")
                        .font(.system(size: 20, weight: .semibold).monospacedDigit())
                        .foregroundStyle(section.tint)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(section.tint.opacity(0.16)))
                }
                if !section.caption.isEmpty {
                    Text(section.caption)
                        .font(.system(size: 21, weight: .medium))
                        .foregroundStyle(.white.opacity(0.62))
                        .lineLimit(1)
                }
            }
            .fixedSize()

            LinearGradient(
                colors: [section.tint.opacity(0.55), section.tint.opacity(0.0)],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 1.5)
            .frame(maxWidth: 520)
            .padding(.leading, 8)
        }
        .padding(.top, 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(section.title), \(section.items.count) ofert. \(section.caption)")
    }
}


// MARK: - EstateOS Intelligence brand (mirrors src/lib/discovery/intelligenceBrand.ts)

/// "Gasoline on water" iridescence — the same Siri palette as the iPhone app.
enum EOSIntelligence {
    static func hex(_ v: UInt32) -> Color {
        Color(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
    static let base: [Color] = [0xFF2D55, 0xBF5AF2, 0x5E5CE6, 0x64D2FF, 0x30D158, 0xFFD60A, 0xFF9F0A, 0xFF2D55].map(hex)
    static let hot: [Color] = [0xFF375F, 0xFFD60A, 0x64D2FF, 0xBF5AF2, 0xFF375F].map(hex)
    static let cool: [Color] = [0x64D2FF, 0x5E5CE6, 0x30D158, 0xBF5AF2, 0x64D2FF].map(hex)
    static let violet = hex(0xBF5AF2)
}

/// Living orb: rotating oil-on-water ring, soft rainbow glow, white brain glyph in a dark core.
struct EOSIntelligenceOrb: View {
    var size: CGFloat = 60
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var spin = false
    @State private var breathe = false

    var body: some View {
        ZStack {
            Circle()
                .fill(AngularGradient(colors: EOSIntelligence.base, center: .center))
                .blur(radius: size * 0.32)
                .opacity(breathe ? 0.85 : 0.55)
                .scaleEffect(breathe ? 1.25 : 1.05)
            Circle()
                .fill(AngularGradient(colors: EOSIntelligence.base, center: .center))
                .rotationEffect(.degrees(spin ? 360 : 0))
            Circle()
                .fill(AngularGradient(colors: EOSIntelligence.cool, center: .center))
                .rotationEffect(.degrees(spin ? -360 : 0))
                .blendMode(.screen)
                .opacity(0.6)
                .padding(size * 0.06)
            Circle()
                .fill(Color.black.opacity(0.62))
                .padding(size * 0.14)
            Image(systemName: "brain")
                .font(.system(size: size * 0.36, weight: .semibold))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 9).repeatForever(autoreverses: false)) { spin = true }
            withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) { breathe = true }
        }
        .accessibilityHidden(true)
    }
}

/// Rail header for "Dla Ciebie": orb, iridescent title, brand eyebrow, rainbow hairline.
struct IntelligenceSectionHeader: View {
    let count: Int
    let caption: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shimmer = false

    var body: some View {
        HStack(alignment: .center, spacing: 22) {
            EOSIntelligenceOrb(size: 64)

            VStack(alignment: .leading, spacing: 4) {
                Text("ESTATEOS™ INTELLIGENCE")
                    .font(.system(size: 16, weight: .heavy))
                    .tracking(2.6)
                    .foregroundStyle(.white.opacity(0.7))
                HStack(alignment: .firstTextBaseline, spacing: 14) {
                    Text("Dla Ciebie")
                        .font(.system(size: 38, weight: .bold))
                        .tracking(-0.4)
                        .foregroundStyle(
                            LinearGradient(
                                colors: EOSIntelligence.hot,
                                startPoint: shimmer ? .topLeading : .leading,
                                endPoint: shimmer ? .trailing : .bottomTrailing
                            )
                        )
                        .hueRotation(.degrees(shimmer ? 40 : 0))
                    Text("\(count)")
                        .font(.system(size: 20, weight: .semibold).monospacedDigit())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(
                            Capsule().fill(
                                LinearGradient(colors: EOSIntelligence.cool, startPoint: .leading, endPoint: .trailing)
                            ).opacity(0.45)
                        )
                }
                if !caption.isEmpty {
                    Text(caption)
                        .font(.system(size: 21, weight: .medium))
                        .foregroundStyle(.white.opacity(0.65))
                        .lineLimit(1)
                }
            }
            .fixedSize()

            LinearGradient(colors: EOSIntelligence.base + [.clear], startPoint: .leading, endPoint: .trailing)
                .frame(height: 2)
                .frame(maxWidth: 560)
                .opacity(0.8)
                .padding(.leading, 8)
        }
        .padding(.top, 8)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 4).repeatForever(autoreverses: true)) { shimmer = true }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("EstateOS Intelligence, Dla Ciebie, \(count) ofert. \(caption)")
    }
}

/// Small iridescent capsule on cards picked by Intelligence.
struct IntelligenceBadge: View {
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "sparkles")
                .font(.system(size: 14, weight: .bold))
            Text("Dla Ciebie")
                .font(.system(size: 16, weight: .bold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            Capsule().fill(
                LinearGradient(colors: EOSIntelligence.hot, startPoint: .leading, endPoint: .trailing)
            ).opacity(0.85)
        )
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.35), lineWidth: 1))
        .shadow(color: EOSIntelligence.violet.opacity(0.45), radius: 10)
    }
}

/// Signed-out invitation in place of the "Dla Ciebie" rail.
struct IntelligenceInviteCard: View {
    var onLogin: () -> Void

    var body: some View {
        HStack(spacing: 36) {
            EOSIntelligenceOrb(size: 120)
            VStack(alignment: .leading, spacing: 10) {
                Text("ESTATEOS™ INTELLIGENCE")
                    .font(.system(size: 16, weight: .heavy))
                    .tracking(2.6)
                    .foregroundStyle(.white.opacity(0.7))
                Text("Oferty dobrane do Twojego gustu")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(LinearGradient(colors: EOSIntelligence.hot, startPoint: .leading, endPoint: .trailing))
                Text("Zaloguj się przez iPhone’a — Intelligence pokaże tu propozycje, które uczy się z tego, co lubisz.")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(.white.opacity(0.75))
                    .lineLimit(2)
                    .frame(maxWidth: 900, alignment: .leading)
            }
            Spacer(minLength: 0)
            Button(action: onLogin) {
                Label("Zaloguj się", systemImage: "iphone")
            }
            .eosButton()
        }
        .padding(36)
        .background(
            RoundedRectangle(cornerRadius: 40, style: .continuous)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 40, style: .continuous)
                .strokeBorder(
                    AngularGradient(colors: EOSIntelligence.base, center: .center),
                    lineWidth: 2
                )
                .opacity(0.7)
        )
        .shadow(color: EOSIntelligence.violet.opacity(0.25), radius: 40, y: 10)
        .focusSection()
    }
}

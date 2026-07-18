import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var app: AppModel
    @State private var tab: Tab = .showroom
    @FocusState private var focusedTab: Tab?
    @FocusState private var accountFocusedItem: AccountFocus?
    @State private var accountContentFocus = false

    enum Tab: String, CaseIterable {
        case showroom = "Showroom"
        case search = "Szukaj"
        case favorites = "Ulubione"
        case account = "Konto"
    }

    private enum AccountFocus: Hashable {
        case refresh
        case login
        case topShelf(TopShelfPresentationStyle)
    }

    var body: some View {
        ZStack {
            background
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    brandAndFilters
                }
                .padding(.bottom, 16)
                .background(
                    // Opaque chrome — prevents any scroll bleed / ghosting under filters.
                    LinearGradient(
                        colors: [
                            app.catalogBrand == .car
                                ? Color(red: 0.04, green: 0.08, blue: 0.14)
                                : Color(red: 0.04, green: 0.06, blue: 0.1),
                            Color.black.opacity(0.98),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .padding(.horizontal, -52)
                    .padding(.top, -32)
                )
                .zIndex(2)

                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .zIndex(1)
            }
            .padding(.horizontal, 52)
            .padding(.vertical, 32)
        }
        .fullScreenCover(item: $app.selectedOffer) { offer in
            OfferDetailView(offer: offer)
                .environmentObject(app)
        }
        .fullScreenCover(item: $app.selectedCar) { car in
            CarDetailView(car: car)
                .environmentObject(app)
        }
        .onAppear {
            if focusedTab == nil { focusedTab = tab }
            if tab == .account { accountContentFocus = true }
        }
        .onChange(of: tab) { _, newTab in
            if newTab == .account { accountContentFocus = true }
        }
        .task {
            if app.offers.isEmpty { try? await app.refreshOffers() }
            if app.cars.isEmpty { try? await app.refreshCars() }
            if app.session != nil { await app.refreshFavorites() }
        }
    }

    private var background: some View {
        LinearGradient(
            colors: [
                app.catalogBrand == .car
                    ? Color(red: 0.04, green: 0.08, blue: 0.14)
                    : Color(red: 0.04, green: 0.06, blue: 0.1),
                Color.black,
                app.catalogBrand == .car
                    ? Color(red: 0.02, green: 0.06, blue: 0.1)
                    : Color(red: 0.02, green: 0.05, blue: 0.08),
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
        .animation(.easeOut(duration: 0.2), value: app.catalogBrand)
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text(app.catalogBrand == .home ? "EstateOS™ Home" : "EstateOS™ Car")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                Text(subtitle)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 24)
            HStack(spacing: 12) {
                ForEach(Tab.allCases, id: \.self) { item in
                    Button(item.rawValue) { tab = item }
                        .buttonStyle(EOSChipButtonStyle(
                            selected: tab == item,
                            accent: app.catalogBrand == .car ? .cyan : .green
                        ))
                        .focusEffectDisabled()
                        .focused($focusedTab, equals: item)
                }
            }
            .padding(8)
            .eosGlass(cornerRadius: 20, opacity: 0.26)
            .focusSection()
            .onMoveCommand { direction in
                if direction == .down, tab == .account {
                    accountContentFocus = true
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    private var subtitle: String {
        if let login = app.session?.user.login {
            return "Witaj, \(login) · przeglądaj z kanapy"
        }
        return "Showroom bez logowania · zaloguj, by synchronizować ulubione"
    }

    private var brandAndFilters: some View {
        VStack(alignment: .leading, spacing: 16) {
            BrandSwitcher(
                brand: Binding(
                    get: { app.catalogBrand },
                    set: { app.setCatalogBrand($0) }
                ),
                onChange: { _ in tab = .showroom }
            )

            if tab == .showroom || tab == .search {
                if app.catalogBrand == .home {
                    filterRowHome
                    homePropertyTypeRow
                } else {
                    filterRowCar
                    if !app.popularCarMakes.isEmpty {
                        carMakeRow
                    }
                }
            }
            if let msg = app.location.statusMessage, (app.carFilterChip == .nearest || app.homeFilterChip == .nearest) {
                Text(msg)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var filterRowHome: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(HomeFilterChip.allCases) { chip in
                    Button(chip.title) { app.selectHomeFilter(chip) }
                        .buttonStyle(EOSChipButtonStyle(selected: app.homeFilterChip == chip, accent: .green))
                        .focusEffectDisabled()
                }
            }
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    private var homePropertyTypeRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                Button("Wszystkie typy") { app.clearHomePropertyTypes() }
                    .buttonStyle(EOSChipButtonStyle(selected: app.selectedHomePropertyTypes.isEmpty, accent: .green))
                    .focusEffectDisabled()

                ForEach(app.homePropertyTypeCounts, id: \.kind) { item in
                    Button("\(item.kind.title) (\(item.count))") {
                        app.toggleHomePropertyType(item.kind)
                        tab = .showroom
                    }
                    .buttonStyle(EOSChipButtonStyle(
                        selected: app.selectedHomePropertyTypes.contains(item.kind),
                        accent: .green
                    ))
                    .focusEffectDisabled()
                }
            }
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    private var filterRowCar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(CarFilterChip.allCases) { chip in
                    Button(chip.title) { app.selectCarFilter(chip) }
                        .buttonStyle(EOSChipButtonStyle(selected: app.carFilterChip == chip, accent: .cyan))
                        .focusEffectDisabled()
                }
            }
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    private var carMakeRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                Button("Wszystkie marki") { app.clearCarMakes() }
                    .buttonStyle(EOSChipButtonStyle(selected: app.selectedCarMakes.isEmpty, accent: .cyan))
                    .focusEffectDisabled()

                ForEach(Array(app.popularCarMakes.prefix(16)), id: \.name) { item in
                    Button("\(item.name) (\(item.count))") {
                        app.toggleCarMake(item.name)
                        tab = .showroom
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
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    @ViewBuilder
    private var content: some View {
        let loading = app.catalogBrand == .home ? app.isLoadingOffers : app.isLoadingCars
        if loading && (app.catalogBrand == .home ? app.offers.isEmpty : app.cars.isEmpty) {
            ProgressView(app.catalogBrand == .home ? "Ładowanie nieruchomości…" : "Ładowanie samochodów…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            Group {
                switch tab {
                case .showroom:
                    showroomView
                case .search:
                    SearchView()
                        .environmentObject(app)
                case .favorites:
                    favoritesView
                case .account:
                    accountView
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private var showroomView: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 32) {
                if app.catalogBrand == .home {
                    homeShowroom
                } else {
                    carShowroom
                }
            }
            .padding(.top, 4)
            .padding(.bottom, 56)
        }
        // Must clip — scrollClipDisabled left ghost cards under sticky filters.
        .focusSection()
    }

    @ViewBuilder
    private var homeShowroom: some View {
        let filtered = app.filteredOffersForBrowse
        let filtering = app.isHomeFilteringActive
        let newest = filtering
            ? app.offersLast24Hours.filter { offer in filtered.contains(where: { $0.id == offer.id }) }
            : app.offersLast24Hours

        if let hero = (filtering ? filtered.first : (newest.first ?? filtered.first)) {
            ShowroomHeroCard(
                title: hero.title,
                subtitle: [EOSFormat.pricePLN(hero.price), hero.displayLocation].filter { !$0.isEmpty }.joined(separator: "  ·  "),
                badge: hero.transactionLabel.uppercased(),
                imageURL: EOSOfferMedia.primaryImageURL(for: hero),
                accent: .green,
                primaryTitle: "POKAŻ",
                secondaryTitle: newest.count > 1 ? "Immersyjny przegląd" : nil,
                onPrimary: { app.openDetail(hero) },
                onSecondary: newest.count > 1 ? { app.openImmersiveBrowse(at: 0, from: Array(newest.prefix(40))) } : nil
            )
            .id("home-hero-\(hero.id)-\(app.homeFilterChip.rawValue)")
        } else if filtering {
            emptyFilterBanner(
                title: "Brak nieruchomości w tym filtrze",
                subtitle: "Wybierz inny typ lub wróć do „Wszystkie”.",
                accent: .green
            ) {
                withAnimation { app.homeFilterChip = .all }
            }
        }

        if !newest.isEmpty {
            homeSection(
                filtering ? "Nowe · \(app.homeFilterChip.title)" : "Nowe w ostatnich 24h",
                offers: Array(newest.prefix(24)),
                immersive: true
            )
        }
        if !filtering, app.session != nil {
            let favs = app.favoriteOffers.isEmpty
                ? app.offers.filter { app.isFavorite($0.id) }
                : app.favoriteOffers
            if !favs.isEmpty {
                homeSection("Twoje ulubione", offers: Array(favs.prefix(28)), showsHeart: true)
            }
        }
        homeSection(
            filtering ? "Wyniki · \(app.homeFilterChip.title)" : "Polecane nieruchomości",
            offers: Array(filtered.prefix(40))
        )
        if !filtering {
            homeSection(
                "Warszawa i okolice",
                offers: Array(app.offers.filter { ($0.city ?? "").localizedCaseInsensitiveContains("warsz") }.prefix(28))
            )
            homeSection(
                "Segment premium",
                offers: Array(app.offers.filter { ($0.price ?? 0) >= 2_000_000 }.prefix(28))
            )
            homeSection(
                "Wynajem",
                offers: Array(app.offers.filter { ($0.transactionType ?? "").uppercased().contains("RENT") }.prefix(28))
            )
        }
    }

    @ViewBuilder
    private var carShowroom: some View {
        let filtered = app.filteredCars
        let filtering = app.isCarFilteringActive
        let featured = filtered.filter(\.featured)
        let fresh = filtered.filter(\.isWithinLast24Hours).sorted { $0.sortDate > $1.sortDate }
        let makeLabel: String = {
            if !app.selectedCarMakes.isEmpty {
                return app.selectedCarMakes.sorted().joined(separator: " · ")
            }
            return app.carFilterChip.title
        }()

        if let hero = (featured.first ?? fresh.first ?? filtered.first) {
            ShowroomHeroCard(
                title: hero.displayHeadline,
                subtitle: [hero.displayPrice, hero.displaySpecs].filter { !$0.isEmpty }.joined(separator: "  ·  "),
                badge: hero.featured ? "PROMO" : (app.selectedCarMakes.isEmpty ? "EstateOS™ Car" : makeLabel.uppercased()),
                imageURL: EOSOfferMedia.imageURL(from: hero.imageUrl),
                accent: .cyan,
                primaryTitle: "POKAŻ",
                secondaryTitle: fresh.count > 1 ? "Immersyjny przegląd" : nil,
                onPrimary: { app.openCarDetail(hero) },
                onSecondary: fresh.count > 1 ? { app.openImmersiveCarBrowse(at: 0, from: Array(fresh.prefix(40))) } : nil
            )
            .id("car-hero-\(hero.id)-\(app.selectedCarMakes.sorted().joined(separator: "-"))-\(app.carFilterChip.rawValue)")
        } else if filtering {
            emptyFilterBanner(
                title: "Brak aut dla „\(makeLabel)”",
                subtitle: "Zmień markę lub filtr paliwa — katalog odświeży się od razu.",
                accent: .cyan
            ) {
                withAnimation {
                    app.clearCarMakes()
                    app.carFilterChip = .all
                }
            }
        }

        if !fresh.isEmpty {
            carSection(
                filtering ? "Nowe · \(makeLabel)" : "Nowe auta · 24h",
                cars: Array(fresh.prefix(24)),
                immersive: true
            )
        }
        if !filtering, !app.favoriteCars.isEmpty {
            carSection("Twoje ulubione auta", cars: Array(app.favoriteCars.prefix(28)), showsHeart: true)
        }
        if !filtering, !app.carsFeatured.isEmpty {
            carSection("Wyróżnione", cars: Array(app.carsFeatured.prefix(28)))
        }
        carSection(
            filtering
                ? "Wyniki · \(makeLabel) · \(filtered.count)"
                : "Katalog samochodów",
            cars: Array(filtered.prefix(48))
        )
        if !filtering {
            carSection(
                "Automatyczna skrzynia",
                cars: Array(app.cars.filter { $0.transmission.localizedCaseInsensitiveContains("automat") }.prefix(28))
            )
            carSection(
                "Elektryczne i hybrydy",
                cars: Array(app.cars.filter {
                    let f = $0.fuelType.lowercased()
                    return f.contains("elektr") || f.contains("hybr") || f.contains("ev")
                }.prefix(28))
            )
        }
    }

    private func emptyFilterBanner(title: String, subtitle: String, accent: Color, reset: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title)
                .font(.system(size: 28, weight: .bold, design: .rounded))
            Text(subtitle)
                .foregroundStyle(.secondary)
            Button("Wyczyść filtry", action: reset)
                .buttonStyle(.borderedProminent)
                .tint(accent)
                .foregroundStyle(.black)
        }
        .padding(28)
        .frame(maxWidth: .infinity, alignment: .leading)
        .eosGlass(cornerRadius: 24, opacity: 0.34)
        .focusSection()
    }

    private func homeSection(_ title: String, offers: [EstateOffer], showsHeart: Bool = false, immersive: Bool = false) -> some View {
        Group {
            if !offers.isEmpty {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(spacing: 12) {
                        if showsHeart {
                            Image(systemName: "heart.fill").foregroundStyle(.pink)
                        }
                        Text(title)
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                        Spacer()
                        if immersive {
                            Button("Immersyjny przegląd") {
                                app.openImmersiveBrowse(at: 0, from: offers)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    OffersRailView(offers: offers, onSelect: app.openDetail)
                }
                .focusSection()
            }
        }
    }

    private func carSection(_ title: String, cars: [CarListing], showsHeart: Bool = false, immersive: Bool = false) -> some View {
        Group {
            if !cars.isEmpty {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        if showsHeart {
                            Image(systemName: "heart.fill").foregroundStyle(.pink)
                        }
                        Text(title)
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                        Spacer()
                        if immersive, cars.count > 1 {
                            Button("Immersyjny przegląd") {
                                app.openImmersiveCarBrowse(at: 0, from: cars)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    CarsRailView(cars: cars, onSelect: app.openCarDetail)
                }
                .focusSection()
            }
        }
    }

    private var favoritesView: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 28) {
                Text("Ulubione nieruchomości")
                    .font(.system(size: 36, weight: .bold, design: .rounded))

                if app.session == nil {
                    Text("Zaloguj się, aby synchronizować ulubione z iPhone i WWW.")
                        .foregroundStyle(.secondary)
                    Button("Zaloguj się") { app.openLoginSheet() }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                } else {
                    let favs = app.favoriteOffers.isEmpty
                        ? app.offers.filter { app.isFavorite($0.id) }
                        : app.favoriteOffers
                    if favs.isEmpty {
                        Text("Brak ulubionych. Otwórz ofertę i dodaj do ulubionych.")
                            .foregroundStyle(.secondary)
                    } else {
                        OffersRailView(offers: favs, onSelect: app.openDetail)
                    }
                }

                Text("Ulubione samochody")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .padding(.top, 12)
                if app.favoriteCars.isEmpty {
                    Text("Oznacz sercem auto w szczegółach — zapisujemy lokalnie na Apple TV.")
                        .foregroundStyle(.secondary)
                    Button("Przejdź do katalogu Car") {
                        app.setCatalogBrand(.car)
                        tab = .showroom
                    }
                    .buttonStyle(.bordered)
                } else {
                    CarsRailView(cars: app.favoriteCars, onSelect: app.openCarDetail)
                }
            }
            .padding(.bottom, 40)
        }
    }

    private var accountView: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    accountSection
                    topShelfSettingsSection
                }
                .padding(.bottom, 80)
            }
            .frame(maxHeight: .infinity)
            .onChange(of: accountFocusedItem) { _, item in
                guard let item else { return }
                withAnimation(.easeOut(duration: 0.25)) {
                    proxy.scrollTo(item, anchor: .center)
                }
            }
        }
        .onChange(of: accountContentFocus) { _, requested in
            guard requested else { return }
            accountFocusedItem = .refresh
            accountContentFocus = false
        }
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Konto")
                .font(.system(size: 40, weight: .bold, design: .rounded))
            Text(app.session?.user.login ?? "Tryb showroom bez logowania")
                .foregroundStyle(.secondary)
                .font(.title3)
            if app.session != nil {
                Label("\(app.favoriteOfferIds.count) Home · \(app.favoriteCarIds.count) Car w ulubionych", systemImage: "heart.fill")
                    .font(.callout)
                    .foregroundStyle(.pink.opacity(0.9))
            }
            Text("\(app.offers.count) nieruchomości · \(app.cars.count) samochodów w katalogu")
                .font(.callout)
                .foregroundStyle(.secondary)

            HStack(spacing: 14) {
                Button("Odśwież katalogi") {
                    Task {
                        try? await app.refreshOffers()
                        try? await app.refreshCars()
                        await app.refreshFavorites()
                    }
                }
                .buttonStyle(.bordered)
                .focused($accountFocusedItem, equals: .refresh)
                .id(AccountFocus.refresh)
                .onMoveCommand { direction in
                    if direction == .up { focusedTab = .account }
                }

                if app.session == nil {
                    Button("Zaloguj się") { app.openLoginSheet() }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                        .focused($accountFocusedItem, equals: .login)
                        .id(AccountFocus.login)
                } else {
                    Button("Wyloguj") { app.logout() }
                        .buttonStyle(.borderedProminent)
                        .tint(.red)
                        .focused($accountFocusedItem, equals: .login)
                        .id(AccountFocus.login)
                }
            }
        }
        .padding(28)
        .eosGlass(cornerRadius: 28, opacity: 0.38)
        .frame(maxWidth: 980, alignment: .leading)
    }

    private var topShelfSettingsSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Górny pasek Apple TV")
                .font(.system(size: 32, weight: .bold, design: .rounded))
            Text("Górny pasek: nieruchomości z 24h oraz wyróżnione samochody EstateOS™ Car.")
                .font(.body)
                .foregroundStyle(.secondary)

            ForEach(TopShelfPresentationStyle.allCases) { style in
                let focusID = AccountFocus.topShelf(style)
                Button {
                    app.setTopShelfStyle(style)
                } label: {
                    HStack(alignment: .top, spacing: 16) {
                        Image(systemName: app.topShelfStyle == style ? "largecircle.fill.circle" : "circle")
                            .font(.title2)
                            .foregroundStyle(app.topShelfStyle == style ? .green : .secondary)
                        VStack(alignment: .leading, spacing: 6) {
                            Text(style.title)
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(.white)
                            Text(style.subtitle)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer()
                    }
                    .padding(18)
                    .eosGlass(cornerRadius: 20, opacity: app.topShelfStyle == style ? 0.48 : 0.3)
                }
                .buttonStyle(.plain)
                .focused($accountFocusedItem, equals: focusID)
                .id(focusID)
            }

            Text("Po zmianie wróć na ekran główny Apple TV i ustaw fokus na ikonie EstateOS.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(28)
        .eosGlass(cornerRadius: 28, opacity: 0.38)
        .frame(maxWidth: 980, alignment: .leading)
    }
}

struct OffersRailView: View {
    let offers: [EstateOffer]
    let onSelect: (EstateOffer) -> Void
    @EnvironmentObject private var app: AppModel

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 28) {
                ForEach(offers.prefix(80)) { offer in
                    Button {
                        onSelect(offer)
                    } label: {
                        OfferCardView(
                            offer: offer,
                            isFavorite: app.isFavorite(offer.id),
                            distanceLabel: app.distanceLabel(forCity: offer.city)
                        )
                        .frame(width: 460)
                    }
                    .buttonStyle(EOSPosterButtonStyle())
                    .focusEffectDisabled()
                    .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                }
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 2)
        }
        .focusSection()
    }
}

struct OfferCardView: View {
    let offer: EstateOffer
    var isFavorite: Bool = false
    var distanceLabel: String? = nil
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            EOSOfferThumbnail(url: EOSOfferMedia.primaryImageURL(for: offer), height: 240)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
                        Text(offer.transactionLabel)
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(offer.isRentBadge ? Color.blue.opacity(0.85) : Color.green.opacity(0.85)))
                            .foregroundStyle(.white)
                        if let city = offer.city {
                            Text(city)
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
                                .background(Capsule().fill(Color.green.opacity(0.85)))
                                .foregroundStyle(.black)
                        }
                    }
                    .padding(10)
                }

            Text(offer.title)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: 60, alignment: .topLeading)

            Text(EOSFormat.pricePLN(offer.price))
                .font(.title2.bold())
                .foregroundStyle(.green)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            EOSListingStatsRow(
                views: offer.viewsCount,
                favorites: offer.favoritesCount,
                accent: .green
            )

            Text(offer.displayLocation)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .eosPosterCard(cornerRadius: 22, accent: .green)
    }
}

private extension EstateOffer {
    var isRentBadge: Bool {
        (transactionType ?? "").uppercased().contains("RENT")
    }
}

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
            VStack(alignment: .leading, spacing: 22) {
                header
                brandAndFilters
                content
            }
            .padding(.horizontal, 52)
            .padding(.vertical, 36)
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
        .animation(.easeInOut(duration: 0.35), value: app.catalogBrand)
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
            Spacer()
            HStack(spacing: 12) {
                ForEach(Tab.allCases, id: \.self) { item in
                    Button(item.rawValue) { tab = item }
                        .buttonStyle(.borderedProminent)
                        .tint(tab == item ? .white : .white.opacity(0.14))
                        .foregroundStyle(tab == item ? .black : .white)
                        .focused($focusedTab, equals: item)
                }
            }
            .padding(8)
            .eosGlass(cornerRadius: 20, opacity: 0.28)
            .onMoveCommand { direction in
                if direction == .down, tab == .account {
                    accountContentFocus = true
                }
            }
        }
    }

    private var subtitle: String {
        if let login = app.session?.user.login {
            return "Witaj, \(login) · przeglądaj z kanapy"
        }
        return "Showroom bez logowania · zaloguj, by synchronizować ulubione"
    }

    private var brandAndFilters: some View {
        HStack(alignment: .center, spacing: 18) {
            BrandSwitcher(brand: Binding(
                get: { app.catalogBrand },
                set: { app.setCatalogBrand($0) }
            ), onChange: { _ in })

            if tab == .showroom || tab == .search {
                if app.catalogBrand == .home {
                    filterRowHome
                } else {
                    filterRowCar
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var filterRowHome: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(HomeFilterChip.allCases) { chip in
                    Button(chip.title) { app.homeFilterChip = chip }
                        .buttonStyle(.borderedProminent)
                        .tint(app.homeFilterChip == chip ? .green : .white.opacity(0.12))
                        .foregroundStyle(app.homeFilterChip == chip ? .black : .white)
                }
            }
        }
        .focusSection()
    }

    private var filterRowCar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(CarFilterChip.allCases) { chip in
                    Button(chip.title) { app.carFilterChip = chip }
                        .buttonStyle(.borderedProminent)
                        .tint(app.carFilterChip == chip ? .cyan : .white.opacity(0.12))
                        .foregroundStyle(app.carFilterChip == chip ? .black : .white)
                }
            }
        }
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
            .padding(.bottom, 48)
        }
    }

    @ViewBuilder
    private var homeShowroom: some View {
        let filtered = app.filteredOffersForBrowse
        let newest = app.offersLast24Hours
        if let hero = (newest.first ?? filtered.first) {
            ShowroomHeroCard(
                title: hero.title,
                subtitle: [EOSFormat.pricePLN(hero.price), hero.displayLocation].filter { !$0.isEmpty }.joined(separator: "  ·  "),
                badge: hero.transactionLabel.uppercased(),
                imageURL: EOSOfferMedia.primaryImageURL(for: hero),
                accent: .green,
                primaryTitle: "Otwórz ofertę",
                secondaryTitle: newest.count > 1 ? "Immersyjny przegląd" : nil,
                onPrimary: { app.openDetail(hero) },
                onSecondary: newest.count > 1 ? { app.openImmersiveBrowse(at: 0, from: Array(newest.prefix(40))) } : nil
            )
        }
        if !newest.isEmpty {
            homeSection("Nowe w ostatnich 24h", offers: Array(newest.prefix(24)), immersive: true)
        }
        if app.session != nil {
            let favs = app.favoriteOffers.isEmpty
                ? app.offers.filter { app.isFavorite($0.id) }
                : app.favoriteOffers
            if !favs.isEmpty {
                homeSection("Twoje ulubione", offers: Array(favs.prefix(28)), showsHeart: true)
            }
        }
        homeSection(
            app.homeFilterChip == .all ? "Polecane nieruchomości" : "Wyniki · \(app.homeFilterChip.title)",
            offers: Array(filtered.prefix(40))
        )
        if app.homeFilterChip == .all {
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
        let fresh = app.carsLast24Hours
        if let hero = (app.carsFeatured.first ?? fresh.first ?? filtered.first) {
            ShowroomHeroCard(
                title: hero.displayHeadline,
                subtitle: [hero.displayPrice, hero.displaySpecs].filter { !$0.isEmpty }.joined(separator: "  ·  "),
                badge: hero.featured ? "PROMO" : "EstateOS™ Car",
                imageURL: EOSOfferMedia.imageURL(from: hero.imageUrl),
                accent: .cyan,
                primaryTitle: "Otwórz",
                secondaryTitle: fresh.count > 1 ? "Immersyjny przegląd" : nil,
                onPrimary: { app.openCarDetail(hero) },
                onSecondary: fresh.count > 1 ? { app.openImmersiveCarBrowse(at: 0, from: Array(fresh.prefix(40))) } : nil
            )
        }
        if !fresh.isEmpty {
            carSection("Nowe auta · 24h", cars: Array(fresh.prefix(24)), immersive: true)
        }
        if !app.favoriteCars.isEmpty {
            carSection("Twoje ulubione auta", cars: Array(app.favoriteCars.prefix(28)), showsHeart: true)
        }
        if !app.carsFeatured.isEmpty, app.carFilterChip == .all {
            carSection("Wyróżnione", cars: Array(app.carsFeatured.prefix(28)))
        }
        carSection(
            app.carFilterChip == .all ? "Katalog samochodów" : "Wyniki · \(app.carFilterChip.title)",
            cars: Array(filtered.prefix(48))
        )
        if app.carFilterChip == .all {
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

    private func homeSection(_ title: String, offers: [EstateOffer], showsHeart: Bool = false, immersive: Bool = false) -> some View {
        Group {
            if !offers.isEmpty {
                VStack(alignment: .leading, spacing: 16) {
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
            LazyHStack(spacing: 28) {
                ForEach(offers.prefix(80)) { offer in
                    Button {
                        onSelect(offer)
                    } label: {
                        OfferCardView(
                            offer: offer,
                            isFavorite: app.isFavorite(offer.id)
                        )
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

struct OfferCardView: View {
    let offer: EstateOffer
    var isFavorite: Bool = false
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            EOSOfferThumbnail(url: EOSOfferMedia.primaryImageURL(for: offer), height: 240)
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
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(.black.opacity(0.5)))
                        if let city = offer.city {
                            Text(city)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(.ultraThinMaterial.opacity(0.55))
                                .clipShape(Capsule())
                        }
                    }
                    .padding(10)
                }

            EOSAdaptiveTitle(text: offer.title, maxLines: 2, maxSize: 22, minSize: 15)
                .foregroundStyle(.white)

            Text(EOSFormat.pricePLN(offer.price))
                .font(.title3.bold())
                .foregroundStyle(.green)

            Text(offer.displayLocation)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .eosGlass(cornerRadius: 22, opacity: isFocused ? 0.52 : 0.34)
        .animation(.easeOut(duration: 0.28).delay(isFocused ? 0.04 : 0), value: isFocused)
    }
}

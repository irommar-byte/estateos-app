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
                VStack(alignment: .leading, spacing: EOSTvSpacing.chromeGap) {
                    header
                    brandAndFilters
                    if tab == .showroom {
                        layoutModeRow
                        activeSectionBanner
                    }
                }
                .padding(.bottom, 4)
                .background(
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
            .padding(.horizontal, EOSTvSpacing.screenHorizontal)
            .padding(.vertical, EOSTvSpacing.screenVertical)
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
        VStack(alignment: .center, spacing: EOSTvSpacing.chromeGap) {
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
            if let msg = app.location.statusMessage, (app.carNearest || app.homeNearest) {
                Text(msg)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var layoutModeRow: some View {
        HStack(spacing: 8) {
            Text("Układ")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            ForEach(ShowroomLayoutMode.allCases) { mode in
                Button {
                    app.setShowroomLayout(mode)
                } label: {
                    Label(mode.title, systemImage: mode.systemImage)
                }
                .buttonStyle(EOSMicroChipButtonStyle(
                    selected: app.showroomLayout == mode,
                    accent: app.catalogBrand == .car ? .cyan : .green
                ))
                .focusEffectDisabled()
            }
            Spacer(minLength: 0)
        }
        .focusSection()
    }

    private var activeSectionBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "rectangle.stack.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(app.catalogBrand == .car ? Color.cyan : Color.green)
            VStack(alignment: .leading, spacing: 1) {
                Text(app.showroomLayout.title)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                Text(app.activeShowroomSection.isEmpty ? "Wybierz ofertę poniżej" : app.activeShowroomSection)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(white: 0.1).opacity(0.92))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
    }

    private var filterRowHome: some View {
        VStack(alignment: .leading, spacing: 6) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    Button("Wszystkie") { app.clearHomeFilters() }
                        .buttonStyle(EOSMicroChipButtonStyle(
                            selected: !app.isHomeFilteringActive && !app.homeCitiesPickerExpanded,
                            accent: .green
                        ))
                        .focusEffectDisabled()

                    Button {
                        app.toggleHomeNearest()
                    } label: {
                        Label("Najbliżej", systemImage: "location.fill")
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.homeNearest, accent: .green))
                    .focusEffectDisabled()

                    Button {
                        app.toggleHomeCitiesPicker()
                    } label: {
                        Label(
                            app.selectedHomeCities.isEmpty
                                ? "Miejscowości"
                                : "Miejscowości (\(app.selectedHomeCities.count))",
                            systemImage: "building.2"
                        )
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(
                        selected: app.homeCitiesPickerExpanded || !app.selectedHomeCities.isEmpty,
                        accent: .green
                    ))
                    .focusEffectDisabled()

                    ForEach(HomeTransactionFilter.allCases) { kind in
                        Button(kind.title) { app.toggleHomeTransaction(kind) }
                            .buttonStyle(EOSMicroChipButtonStyle(
                                selected: app.selectedHomeTransactions.contains(kind),
                                accent: .green
                            ))
                            .focusEffectDisabled()
                    }

                    Button("Premium") { app.toggleHomePremium() }
                        .buttonStyle(EOSMicroChipButtonStyle(selected: app.homePremium, accent: .green))
                        .focusEffectDisabled()
                }
                .padding(.vertical, 2)
            }
            .focusSection()

            if app.homeCitiesPickerExpanded {
                homeCitiesRow
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var homeCitiesRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                Button("Wszystkie miejscowości") { app.clearHomeCities() }
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.selectedHomeCities.isEmpty, accent: .green))
                    .focusEffectDisabled()

                ForEach(app.homeCityCounts, id: \.name) { item in
                    Button("\(item.name) (\(item.count))") {
                        app.toggleHomeCity(item.name)
                        tab = .showroom
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(
                        selected: app.selectedHomeCities.contains(where: {
                            $0.caseInsensitiveCompare(item.name) == .orderedSame
                        }),
                        accent: .green
                    ))
                    .focusEffectDisabled()
                }
            }
            .padding(.vertical, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    private var homePropertyTypeRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                Button("Wszystkie typy") { app.clearHomePropertyTypes() }
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.selectedHomePropertyTypes.isEmpty, accent: .green))
                    .focusEffectDisabled()

                ForEach(app.homePropertyTypeCounts, id: \.kind) { item in
                    Button("\(item.kind.title) (\(item.count))") {
                        app.toggleHomePropertyType(item.kind)
                        tab = .showroom
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(
                        selected: app.selectedHomePropertyTypes.contains(item.kind),
                        accent: .green
                    ))
                    .focusEffectDisabled()
                }
            }
            .padding(.vertical, 2)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    private var filterRowCar: some View {
        VStack(alignment: .leading, spacing: 6) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    Button("Wszystkie") { app.clearCarFilters() }
                        .buttonStyle(EOSMicroChipButtonStyle(
                            selected: !app.isCarFilteringActive && !app.carCitiesPickerExpanded,
                            accent: .cyan
                        ))
                        .focusEffectDisabled()

                    Button {
                        app.toggleCarNearest()
                    } label: {
                        Label("Najbliżej", systemImage: "location.fill")
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.carNearest, accent: .cyan))
                    .focusEffectDisabled()

                    Button {
                        app.toggleCarCitiesPicker()
                    } label: {
                        Label(
                            app.selectedCarCities.isEmpty
                                ? "Miejscowości"
                                : "Miejscowości (\(app.selectedCarCities.count))",
                            systemImage: "building.2"
                        )
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(
                        selected: app.carCitiesPickerExpanded || !app.selectedCarCities.isEmpty,
                        accent: .cyan
                    ))
                    .focusEffectDisabled()

                    ForEach(CarAttributeFilter.allCases) { attr in
                        Button(attr.title) { app.toggleCarAttribute(attr) }
                            .buttonStyle(EOSMicroChipButtonStyle(
                                selected: app.selectedCarAttributes.contains(attr),
                                accent: .cyan
                            ))
                            .focusEffectDisabled()
                    }
                }
                .padding(.vertical, 2)
            }
            .focusSection()

            if app.carCitiesPickerExpanded {
                carCitiesRow
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var carCitiesRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                Button("Wszystkie miejscowości") { app.clearCarCities() }
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.selectedCarCities.isEmpty, accent: .cyan))
                    .focusEffectDisabled()

                ForEach(app.carCityCounts, id: \.name) { item in
                    Button("\(item.name) (\(item.count))") {
                        app.toggleCarCity(item.name)
                        tab = .showroom
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(
                        selected: app.selectedCarCities.contains(where: {
                            $0.caseInsensitiveCompare(item.name) == .orderedSame
                        }),
                        accent: .cyan
                    ))
                    .focusEffectDisabled()
                }
            }
            .padding(.vertical, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    private var carMakeRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                Button("Wszystkie marki") { app.clearCarMakes() }
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.selectedCarMakes.isEmpty, accent: .cyan))
                    .focusEffectDisabled()

                ForEach(Array(app.popularCarMakes.prefix(16)), id: \.name) { item in
                    Button("\(item.name) (\(item.count))") {
                        app.toggleCarMake(item.name)
                        tab = .showroom
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(
                        selected: app.selectedCarMakes.contains(where: {
                            $0.caseInsensitiveCompare(item.name) == .orderedSame
                        }),
                        accent: .cyan
                    ))
                    .focusEffectDisabled()
                }
            }
            .padding(.vertical, 2)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    @ViewBuilder
    private var content: some View {
        Group {
            switch tab {
            case .showroom:
                catalogLoadingGate { showroomView }
            case .search:
                catalogLoadingGate {
                    SearchView()
                        .environmentObject(app)
                }
            case .favorites:
                favoritesView
            case .account:
                accountView
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private func catalogLoadingGate<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        let loading = app.catalogBrand == .home ? app.isLoadingOffers : app.isLoadingCars
        let empty = app.catalogBrand == .home ? app.offers.isEmpty : app.cars.isEmpty
        if loading && empty {
            ProgressView(app.catalogBrand == .home ? "Ładowanie nieruchomości…" : "Ładowanie samochodów…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            content()
        }
    }

    private var showroomView: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: EOSTvSpacing.sectionGap) {
                if app.catalogBrand == .home {
                    if app.offers.isEmpty, !app.isLoadingOffers {
                        emptyCatalogBanner(
                            title: "Brak nieruchomości w katalogu",
                            subtitle: "Odśwież katalogi w zakładce Konto lub spróbuj ponownie za chwilę.",
                            accent: .green
                        )
                    } else {
                        homeShowroom
                    }
                } else if app.cars.isEmpty, !app.isLoadingCars {
                    emptyCatalogBanner(
                        title: "Brak samochodów w katalogu",
                        subtitle: "Odśwież katalogi w zakładce Konto lub spróbuj ponownie za chwilę.",
                        accent: .cyan
                    )
                } else {
                    carShowroom
                }
            }
            .padding(.top, 12)
            .padding(.bottom, 72)
        }
        .focusSection()
        .onAppear {
            if app.activeShowroomSection.isEmpty {
                app.noteShowroomSection(app.catalogBrand == .home ? "Nowe w ostatnich 24h" : "Nowe auta · 24h")
            }
        }
    }

    private func emptyCatalogBanner(title: String, subtitle: String, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title)
                .font(.system(size: 28, weight: .bold, design: .rounded))
            Text(subtitle)
                .foregroundStyle(.secondary)
            Button("Odśwież") {
                Task {
                    try? await app.refreshOffers()
                    try? await app.refreshCars()
                }
            }
            .buttonStyle(EOSDetailActionButtonStyle(accent: accent))
            .focusEffectDisabled()
        }
        .padding(28)
        .frame(maxWidth: .infinity, alignment: .leading)
        .eosGlass(cornerRadius: 24, opacity: 0.34)
        .focusSection()
    }

    @ViewBuilder
    private var homeShowroom: some View {
        let filtered = app.filteredOffersForBrowse
        let filtering = app.isHomeFilteringActive
        let newest = app.showroomHomeNewest

        if app.showroomLayout == .rails,
           let hero = (filtering ? filtered.first : (newest.first ?? filtered.first)) {
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
            .id("home-hero-\(hero.id)-\(app.homeFilterSummary)")
        } else if filtering {
            emptyFilterBanner(
                title: "Brak nieruchomości w tym filtrze",
                subtitle: "Wybierz inny typ lub wróć do „Wszystkie”.",
                accent: .green
            ) {
                withAnimation { app.clearHomeFilters() }
            }
        }

        if !newest.isEmpty {
            homeSection(
                filtering ? "Nowe · \(app.homeFilterSummary)" : "Nowe w ostatnich 24h",
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
            filtering ? "Wyniki · \(app.homeFilterSummary)" : "Polecane nieruchomości",
            offers: Array(filtered.prefix(40))
        )
        if !filtering {
            homeSection("Warszawa i okolice", offers: app.showroomHomeWarsaw)
            homeSection("Segment premium", offers: app.showroomHomePremium)
            homeSection("Wynajem", offers: app.showroomHomeRent)
        }
    }

    @ViewBuilder
    private var carShowroom: some View {
        let filtered = app.filteredCars
        let filtering = app.isCarFilteringActive
        let featured = app.showroomCarFeatured
        let fresh = app.showroomCarFresh
        let makeLabel = app.carFilterSummary

        if app.showroomLayout == .rails,
           let hero = (featured.first ?? fresh.first ?? filtered.first) {
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
            .id("car-hero-\(hero.id)-\(app.carFilterSummary)")
        } else if filtering {
            emptyFilterBanner(
                title: "Brak aut dla „\(makeLabel)”",
                subtitle: "Zmień markę lub filtr paliwa — katalog odświeży się od razu.",
                accent: .cyan
            ) {
                withAnimation {
                    app.clearCarFilters()
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
            carSection("Automatyczna skrzynia", cars: app.showroomCarAutomatic)
            carSection("Elektryczne i hybrydy", cars: app.showroomCarElectricHybrid)
        }
    }

    private func emptyFilterBanner(title: String, subtitle: String, accent: Color, reset: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title)
                .font(.system(size: 28, weight: .bold, design: .rounded))
            Text(subtitle)
                .foregroundStyle(.secondary)
            Button("Wyczyść filtry", action: reset)
                .buttonStyle(EOSDetailActionButtonStyle(accent: accent))
                .focusEffectDisabled()
        }
        .padding(28)
        .frame(maxWidth: .infinity, alignment: .leading)
        .eosGlass(cornerRadius: 24, opacity: 0.34)
        .focusSection()
    }

    private func homeSection(_ title: String, offers: [EstateOffer], showsHeart: Bool = false, immersive: Bool = false) -> some View {
        Group {
            if !offers.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    sectionHeader(title: title, count: offers.count, showsHeart: showsHeart, immersiveHome: immersive ? offers : nil, immersiveCars: nil)
                    OffersCatalogView(
                        offers: offers,
                        layout: app.showroomLayout,
                        sectionTitle: title,
                        onSelect: app.openDetail
                    )
                }
                .padding(.top, 8)
                .focusSection()
            }
        }
    }

    private func carSection(_ title: String, cars: [CarListing], showsHeart: Bool = false, immersive: Bool = false) -> some View {
        Group {
            if !cars.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    sectionHeader(
                        title: title,
                        count: cars.count,
                        showsHeart: showsHeart,
                        immersiveHome: nil,
                        immersiveCars: immersive && cars.count > 1 ? cars : nil
                    )
                    CarsCatalogView(
                        cars: cars,
                        layout: app.showroomLayout,
                        sectionTitle: title,
                        onSelect: app.openCarDetail
                    )
                }
                .padding(.top, 8)
                .focusSection()
            }
        }
    }

    @ViewBuilder
    private func sectionHeader(
        title: String,
        count: Int,
        showsHeart: Bool,
        immersiveHome: [EstateOffer]?,
        immersiveCars: [CarListing]?
    ) -> some View {
        HStack(spacing: 12) {
            if showsHeart {
                Image(systemName: "heart.fill").foregroundStyle(.pink)
            }
            Text(title)
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
            Text("\(count)")
                .font(.callout.weight(.bold).monospacedDigit())
                .foregroundStyle(.black)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Capsule().fill(app.catalogBrand == .car ? Color.cyan : Color.green))
            Spacer(minLength: 8)
            if let immersiveHome, immersiveHome.count > 1 {
                Button("Immersyjny przegląd") {
                    app.openImmersiveBrowse(at: 0, from: immersiveHome)
                }
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
            }
            if let immersiveCars, immersiveCars.count > 1 {
                Button("Immersyjny przegląd") {
                    app.openImmersiveCarBrowse(at: 0, from: immersiveCars)
                }
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
            }
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 2)
        // Solid backing so title never “disappears” into chrome/background.
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.black.opacity(0.55))
        )
        .onAppear { app.noteShowroomSection(title) }
    }

    private var favoritesView: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 28) {
                Text("Ulubione nieruchomości")
                    .font(.system(size: 32, weight: .bold, design: .rounded))

                if app.session == nil {
                    Text("Zaloguj się, aby synchronizować ulubione z iPhone i WWW.")
                        .foregroundStyle(.secondary)
                    Button("Zaloguj się") { app.openLoginSheet() }
                        .buttonStyle(EOSDetailActionButtonStyle(accent: .green))
                        .focusEffectDisabled()
                } else {
                    let favs = app.favoriteOffers.isEmpty
                        ? app.offers.filter { app.isFavorite($0.id) }
                        : app.favoriteOffers
                    if favs.isEmpty {
                        Text("Brak ulubionych. Otwórz ofertę i dodaj do ulubionych.")
                            .foregroundStyle(.secondary)
                        Button("Przejdź do showroomu") { tab = .showroom }
                            .buttonStyle(EOSDetailChromeButtonStyle())
                            .focusEffectDisabled()
                    } else {
                        OffersRailView(offers: favs, onSelect: app.openDetail)
                    }
                }

                Text("Ulubione samochody")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .padding(.top, 12)
                if app.favoriteCars.isEmpty {
                    Text("Oznacz sercem auto w szczegółach — zapisujemy lokalnie na Apple TV.")
                        .foregroundStyle(.secondary)
                    Button("Przejdź do katalogu Car") {
                        app.setCatalogBrand(.car)
                        tab = .showroom
                    }
                    .buttonStyle(EOSDetailActionButtonStyle(accent: .cyan))
                    .focusEffectDisabled()
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
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
                .focused($accountFocusedItem, equals: .refresh)
                .id(AccountFocus.refresh)
                .onMoveCommand { direction in
                    if direction == .up { focusedTab = .account }
                }

                if app.session == nil {
                    Button("Zaloguj się") { app.openLoginSheet() }
                        .buttonStyle(EOSDetailActionButtonStyle(accent: .green))
                        .focusEffectDisabled()
                        .focused($accountFocusedItem, equals: .login)
                        .id(AccountFocus.login)
                } else {
                    Button("Wyloguj") { app.logout() }
                        .buttonStyle(EOSDetailActionButtonStyle(accent: .pink))
                        .focusEffectDisabled()
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
                .focusEffectDisabled()
                .eosFocusRing(cornerRadius: 20, accent: .cyan)
                .focused($accountFocusedItem, equals: focusID)
                .id(focusID)
            }

            Text("Po zmianie wyjdź na ekran główny Apple TV (Menu) i ustaw fokus na ikonie EstateOS — dopiero wtedy Górny pasek przełącza się na kafelki.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(28)
        .eosGlass(cornerRadius: 28, opacity: 0.38)
        .frame(maxWidth: 980, alignment: .leading)
    }
}

struct OffersCatalogView: View {
    let offers: [EstateOffer]
    let layout: ShowroomLayoutMode
    let sectionTitle: String
    let onSelect: (EstateOffer) -> Void
    @EnvironmentObject private var app: AppModel

    private var items: [EstateOffer] { Array(offers.prefix(80)) }

    var body: some View {
        switch layout {
        case .rails:
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 22) {
                    ForEach(items) { offer in
                        offerButton(offer, width: 360, imageHeight: 180, compact: true, focusScale: 1.0)
                    }
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 2)
            }
            .focusSection()
        case .tiles:
            // Spacing + cell padding reserve room so focus scale never overlaps / clips.
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 32)], spacing: 32) {
                ForEach(items) { offer in
                    offerButton(offer, width: nil, imageHeight: 140, compact: true, focusScale: 1.07)
                        .padding(18)
                }
            }
            .padding(.vertical, 10)
            .focusSection()
        case .list:
            LazyVStack(spacing: 22) {
                ForEach(items) { offer in
                    Button {
                        app.noteShowroomSection(sectionTitle)
                        onSelect(offer)
                    } label: {
                        OfferListRowView(
                            offer: offer,
                            isFavorite: app.isFavorite(offer.id),
                            distanceLabel: app.distanceLabel(forCity: offer.city)
                        )
                        .eosListRowFocus(accent: .green)
                        .background(FocusSectionProbe(title: sectionTitle))
                    }
                    .buttonStyle(EOSPosterButtonStyle(focusScale: 1.05))
                    .focusEffectDisabled()
                    .padding(.vertical, 10)
                    .padding(.horizontal, 8)
                }
            }
            .padding(.vertical, 8)
            .focusSection()
        }
    }

    private func offerButton(
        _ offer: EstateOffer,
        width: CGFloat?,
        imageHeight: CGFloat,
        compact: Bool,
        focusScale: CGFloat
    ) -> some View {
        Button {
            app.noteShowroomSection(sectionTitle)
            onSelect(offer)
        } label: {
            OfferCardView(
                offer: offer,
                isFavorite: app.isFavorite(offer.id),
                distanceLabel: app.distanceLabel(forCity: offer.city),
                imageHeight: imageHeight,
                compact: compact
            )
            .frame(width: width)
            .background(FocusSectionProbe(title: sectionTitle))
        }
        .buttonStyle(EOSPosterButtonStyle(focusScale: focusScale))
        .focusEffectDisabled()
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

/// Updates sticky section banner when a poster inside the section becomes focused.
private struct FocusSectionProbe: View {
    let title: String
    @EnvironmentObject private var app: AppModel
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .onChange(of: isFocused) { _, focused in
                if focused { app.noteShowroomSection(title) }
            }
            .onAppear {
                if isFocused { app.noteShowroomSection(title) }
            }
    }
}

struct OffersRailView: View {
    let offers: [EstateOffer]
    let onSelect: (EstateOffer) -> Void
    @EnvironmentObject private var app: AppModel

    var body: some View {
        OffersCatalogView(
            offers: offers,
            layout: .rails,
            sectionTitle: "Oferty",
            onSelect: onSelect
        )
    }
}

struct OfferCardView: View {
    let offer: EstateOffer
    var isFavorite: Bool = false
    var distanceLabel: String? = nil
    var imageHeight: CGFloat = 180
    var compact: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 10 : 14) {
            EOSOfferThumbnail(url: EOSOfferMedia.primaryImageURL(for: offer), height: imageHeight)
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
                            .padding(.vertical, 2)
                            .background(Capsule().fill(offer.isRentBadge ? Color.blue.opacity(0.85) : Color.green.opacity(0.85)))
                            .foregroundStyle(.white)
                        if let city = offer.city {
                            Text(city)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(.black.opacity(0.55)))
                        }
                        if let distanceLabel {
                            Text(distanceLabel)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(Color.green.opacity(0.85)))
                                .foregroundStyle(.black)
                        }
                    }
                    .padding(10)
                }

            Text(offer.title)
                .font(.system(size: compact ? 18 : 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: compact ? 44 : 60, alignment: .topLeading)

            Text(EOSFormat.pricePLN(offer.price))
                .font(compact ? .title3.bold() : .title2.bold())
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


struct OfferListRowView: View {
    let offer: EstateOffer
    var isFavorite: Bool = false
    var distanceLabel: String? = nil

    var body: some View {
        HStack(spacing: 16) {
            EOSOfferThumbnail(url: EOSOfferMedia.primaryImageURL(for: offer), height: 96)
                .frame(width: 160)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(offer.transactionLabel)
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(offer.isRentBadge ? Color.blue.opacity(0.85) : Color.green.opacity(0.85)))
                    if isFavorite {
                        Image(systemName: "heart.fill").foregroundStyle(.pink).font(.caption)
                    }
                    if let distanceLabel {
                        Text(distanceLabel).font(.caption2.weight(.semibold)).foregroundStyle(.green)
                    }
                }
                Text(offer.title)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Text(EOSFormat.pricePLN(offer.price))
                    .font(.title3.bold())
                    .foregroundStyle(.green)
                HStack {
                    EOSListingStatsRow(views: offer.viewsCount, favorites: offer.favoritesCount, accent: .green)
                    Spacer()
                    Text(offer.displayLocation)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(white: 0.09).opacity(0.96))
        )
    }
}

private extension EstateOffer {
    var isRentBadge: Bool {
        (transactionType ?? "").uppercased().contains("RENT")
    }
}

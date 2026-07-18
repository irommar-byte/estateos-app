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

    private var brandAccent: Color { EOSPalette.accent(for: app.catalogBrand) }

    var body: some View {
        ZStack {
            background
            VStack(spacing: 0) {
                chromeDeck
                    .padding(.bottom, 18)
                    .zIndex(2)

                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
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

    /// One composed chrome — brand, nav, filters, layout as a single deck (symmetry + restraint).
    private var chromeDeck: some View {
        VStack(spacing: 16) {
            header
            BrandSwitcher(
                brand: Binding(
                    get: { app.catalogBrand },
                    set: { app.setCatalogBrand($0) }
                ),
                onChange: { _ in tab = .showroom }
            )

            if tab == .showroom || tab == .search {
                controlStrip
            }
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity, alignment: .center)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(.ultraThinMaterial.opacity(0.22))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(EOSPalette.hairlineSoft, lineWidth: 1)
        )
    }

    private var background: some View {
        ZStack {
            EOSPalette.canvas.ignoresSafeArea()
            LinearGradient(
                colors: [
                    EOSPalette.canvasTop.opacity(0.95),
                    EOSPalette.canvas,
                    EOSPalette.canvas,
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            // Soft vignette — no brand-tinted washes.
            RadialGradient(
                colors: [Color.white.opacity(0.04), .clear],
                center: .top,
                startRadius: 40,
                endRadius: 900
            )
            .ignoresSafeArea()
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 24) {
            HStack(spacing: 14) {
                Image("EstateOSLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 36)
                    .opacity(0.95)
                VStack(alignment: .leading, spacing: 3) {
                    Text(app.catalogBrand == .home ? "EstateOS™ Home" : "EstateOS™ Car")
                        .font(.system(size: 28, weight: .semibold, design: .default))
                        .foregroundStyle(EOSPalette.textPrimary)
                    Text(subtitle)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(EOSPalette.textTertiary)
                        .lineLimit(1)
                        .contentTransition(.opacity)
                        .id(subtitle)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                        .animation(.easeOut(duration: 0.22), value: subtitle)
                }
            }
            Spacer(minLength: 16)
            HStack(spacing: 8) {
                ForEach(Tab.allCases, id: \.self) { item in
                    Button(item.rawValue) { tab = item }
                        .buttonStyle(EOSChipButtonStyle(selected: tab == item, accent: brandAccent))
                        .focusEffectDisabled()
                        .focused($focusedTab, equals: item)
                }
            }
            .focusSection()
            .onMoveCommand { direction in
                if direction == .down, tab == .account {
                    accountContentFocus = true
                }
            }
        }
        .frame(maxWidth: .infinity)
        .focusSection()
    }

    private var subtitle: String {
        if tab == .showroom, !app.activeShowroomSection.isEmpty {
            return app.activeShowroomSection
        }
        if let login = app.session?.user.login {
            return "Witaj, \(login)"
        }
        return "Przeglądaj z kanapy"
    }

    private var controlStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            if app.catalogBrand == .home {
                filterRowHome
                homePropertyTypeRow
            } else {
                filterRowCar
                if !app.popularCarMakes.isEmpty {
                    carMakeRow
                }
            }
            if let msg = app.location.statusMessage, (app.carNearest || app.homeNearest) {
                Text(msg)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(EOSPalette.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var filterRowHome: some View {

        VStack(alignment: .leading, spacing: 6) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    Button("Wszystkie") { app.clearHomeFilters() }
                        .buttonStyle(EOSMicroChipButtonStyle(
                            selected: !app.isHomeFilteringActive && !app.homeCitiesPickerExpanded,
                            accent: EOSPalette.home
                        ))
                        .focusEffectDisabled()

                    Button {
                        app.toggleHomeNearest()
                    } label: {
                        Label("Najbliżej", systemImage: "location.fill")
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.homeNearest, accent: EOSPalette.home))
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
                        accent: EOSPalette.home
                    ))
                    .focusEffectDisabled()

                    ForEach(HomeTransactionFilter.allCases) { kind in
                        Button(kind.title) { app.toggleHomeTransaction(kind) }
                            .buttonStyle(EOSMicroChipButtonStyle(
                                selected: app.selectedHomeTransactions.contains(kind),
                                accent: EOSPalette.home
                            ))
                            .focusEffectDisabled()
                    }

                    Button("Premium") { app.toggleHomePremium() }
                        .buttonStyle(EOSMicroChipButtonStyle(selected: app.homePremium, accent: EOSPalette.home))
                        .focusEffectDisabled()

                    Button {
                        app.toggleHomeDiscounted()
                    } label: {
                        Label(
                            "Przecenione (\(app.homeDiscountedCount))",
                            systemImage: "percent"
                        )
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.homeDiscounted, accent: Color(red: 0.92, green: 0.32, blue: 0.28)))
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
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.selectedHomeCities.isEmpty, accent: EOSPalette.home))
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
                        accent: EOSPalette.home
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
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.selectedHomePropertyTypes.isEmpty, accent: EOSPalette.home))
                    .focusEffectDisabled()

                ForEach(app.homePropertyTypeCounts, id: \.kind) { item in
                    Button("\(item.kind.title) (\(item.count))") {
                        app.toggleHomePropertyType(item.kind)
                        tab = .showroom
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(
                        selected: app.selectedHomePropertyTypes.contains(item.kind),
                        accent: EOSPalette.home
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
                            accent: EOSPalette.car
                        ))
                        .focusEffectDisabled()

                    Button {
                        app.toggleCarNearest()
                    } label: {
                        Label("Najbliżej", systemImage: "location.fill")
                    }
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.carNearest, accent: EOSPalette.car))
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
                        accent: EOSPalette.car
                    ))
                    .focusEffectDisabled()

                    ForEach(CarAttributeFilter.allCases) { attr in
                        Button(attr.title) { app.toggleCarAttribute(attr) }
                            .buttonStyle(EOSMicroChipButtonStyle(
                                selected: app.selectedCarAttributes.contains(attr),
                                accent: EOSPalette.car
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
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.selectedCarCities.isEmpty, accent: EOSPalette.car))
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
                        accent: EOSPalette.car
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
                    .buttonStyle(EOSMicroChipButtonStyle(selected: app.selectedCarMakes.isEmpty, accent: EOSPalette.car))
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
                        accent: EOSPalette.car
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
                    .transition(.eosModeTransition)
            case .search:
                catalogLoadingGate {
                    SearchView()
                        .environmentObject(app)
                }
                .transition(.eosModeTransition)
            case .favorites:
                favoritesView
                    .transition(.eosModeTransition)
            case .account:
                accountView
                    .transition(.eosModeTransition)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .animation(.spring(response: 0.5, dampingFraction: 0.88, blendDuration: 0.25), value: tab)
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
                            accent: EOSPalette.home
                        )
                    } else {
                        homeShowroom
                    }
                } else if app.cars.isEmpty, !app.isLoadingCars {
                    emptyCatalogBanner(
                        title: "Brak samochodów w katalogu",
                        subtitle: "Odśwież katalogi w zakładce Konto lub spróbuj ponownie za chwilę.",
                        accent: EOSPalette.car
                    )
                } else {
                    carShowroom
                }
            }
            .transition(.eosModeTransition)
            .id(app.catalogBrand)
            .padding(.top, 12)
            .padding(.bottom, 72)
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.88, blendDuration: 0.25), value: app.catalogBrand)
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
                accent: EOSPalette.home,
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
                accent: EOSPalette.home
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
            homeSection("Przecenione", offers: app.showroomHomeDiscounted)
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
                accent: EOSPalette.car,
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
                accent: EOSPalette.car
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
                .font(.system(size: 26, weight: .semibold, design: .default))
                .foregroundStyle(EOSPalette.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
            Text("\(count)")
                .font(.caption.weight(.bold).monospacedDigit())
                .foregroundStyle(EOSPalette.textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Capsule().fill(Color.white.opacity(0.08)))
                .overlay(Capsule().stroke(EOSPalette.hairlineSoft, lineWidth: 1))
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
        .padding(.horizontal, 2)
        .padding(.vertical, 6)
        .onAppear { app.noteShowroomSection(title) }
    }

    private var favoritesView: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 28) {
                Text("Ulubione nieruchomości")
                    .font(.system(size: 28, weight: .semibold))

                if app.session == nil {
                    Text("Zaloguj się, aby synchronizować ulubione z iPhone i WWW.")
                        .foregroundStyle(.secondary)
                    Button("Zaloguj się") { app.openLoginSheet() }
                        .buttonStyle(EOSDetailActionButtonStyle(accent: EOSPalette.home))
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
                    .font(.system(size: 28, weight: .semibold))
                    .padding(.top, 12)
                if app.favoriteCars.isEmpty {
                    Text("Oznacz sercem auto w szczegółach — zapisujemy lokalnie na Apple TV.")
                        .foregroundStyle(.secondary)
                    Button("Przejdź do katalogu Car") {
                        app.setCatalogBrand(.car)
                        tab = .showroom
                    }
                    .buttonStyle(EOSDetailActionButtonStyle(accent: EOSPalette.car))
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
                .font(.system(size: 32, weight: .semibold))
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
                        .buttonStyle(EOSDetailActionButtonStyle(accent: EOSPalette.home))
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
                .font(.system(size: 28, weight: .semibold))
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
                .eosFocusRing(cornerRadius: 20, accent: EOSPalette.car)
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
                            showsOwnerStats: app.isOwner(of: offer),
                            distanceLabel: app.distanceLabel(forCity: offer.city)
                        )
                        .eosListRowFocus(accent: EOSPalette.home)
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
                showsOwnerStats: app.isOwner(of: offer),
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
    var showsOwnerStats: Bool = false
    var distanceLabel: String? = nil
    var imageHeight: CGFloat = 180
    var compact: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 10 : 14) {
            EOSOfferThumbnail(url: EOSOfferMedia.primaryImageURL(for: offer), height: imageHeight)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if let discount = offer.priceDiscountBadgeText {
                        EOSDiscountBadge(percentText: discount)
                            .padding(10)
                    }
                }
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
                    // One clean badge row — full words, never hyphenated; city lives in the footer.
                    HStack(spacing: 8) {
                        EOSMediaBadge(
                            text: offer.transactionBadgeText,
                            fill: (offer.isRentBadge
                                   ? Color(red: 0.45, green: 0.55, blue: 0.72)
                                   : EOSPalette.home).opacity(0.88),
                            stroke: Color.white.opacity(0.28)
                        )
                        if let distanceLabel {
                            EOSMediaBadge(
                                text: distanceLabel,
                                fill: Color.white.opacity(0.88),
                                stroke: Color.clear,
                                foreground: .black
                            )
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

            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(EOSFormat.pricePLN(offer.price))
                    .font(compact ? .title3.bold() : .title2.bold())
                    .foregroundStyle(EOSPalette.home)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                if let discount = offer.priceDiscountBadgeText {
                    Text(discount)
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(Color(red: 0.95, green: 0.42, blue: 0.36))
                        .lineLimit(1)
                        .fixedSize()
                }
            }

            if showsOwnerStats {
                EOSListingStatsRow(
                    views: offer.viewsCount,
                    favorites: offer.favoritesCount,
                    accent: EOSPalette.home
                )
            }

            Text(offer.displayLocation)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .eosPosterCard(cornerRadius: 22, accent: EOSPalette.home)
    }
}


struct OfferListRowView: View {
    let offer: EstateOffer
    var isFavorite: Bool = false
    var showsOwnerStats: Bool = false
    var distanceLabel: String? = nil

    var body: some View {
        HStack(spacing: 16) {
            EOSOfferThumbnail(url: EOSOfferMedia.primaryImageURL(for: offer), height: 96)
                .frame(width: 160)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if let discount = offer.priceDiscountBadgeText {
                        EOSDiscountBadge(percentText: discount)
                            .scaleEffect(0.85, anchor: .topLeading)
                            .padding(6)
                    }
                }

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    EOSMediaBadge(
                        text: offer.transactionBadgeText,
                        fill: (offer.isRentBadge
                               ? Color(red: 0.45, green: 0.55, blue: 0.72)
                               : EOSPalette.home).opacity(0.88),
                        stroke: Color.white.opacity(0.28),
                        fontSize: 11
                    )
                    if isFavorite {
                        Image(systemName: "heart.fill").foregroundStyle(.pink).font(.caption)
                    }
                    if let distanceLabel {
                        Text(distanceLabel)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(EOSPalette.home)
                            .lineLimit(1)
                            .fixedSize()
                    }
                }
                Text(offer.title)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Text(EOSFormat.pricePLN(offer.price))
                    .font(.title3.bold())
                    .foregroundStyle(EOSPalette.home)
                    .lineLimit(1)
                HStack {
                    if showsOwnerStats {
                        EOSListingStatsRow(views: offer.viewsCount, favorites: offer.favoritesCount, accent: EOSPalette.home)
                    }
                    Spacer()
                    Text(offer.displayLocation)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
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

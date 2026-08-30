import SwiftUI

struct HomeShowroomView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var heroTransition: HeroTransitionCoordinator
    var showroomFocus: FocusState<HomeShowroomFocus?>.Binding
    var chromeFocus: FocusState<HomeChromeFocus?>.Binding
    var heroNamespace: Namespace.ID

    @State private var heroAppeared = false
    @State private var firstRailAppeared = false

    var body: some View {
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
            showroomFocus.wrappedValue = .hero
        }
        .onChange(of: app.catalogBrand) { _, _ in
            heroAppeared = false
            showroomFocus.wrappedValue = .hero
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                heroAppeared = true
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

        if let hero = (filtering ? filtered.first : (newest.first ?? filtered.first)) {
            heroCardHome(hero: hero, filtering: filtering, newest: newest)
        } else if filtering {
            emptyFilterBanner(
                title: "Brak nieruchomości w tym filtrze",
                subtitle: "Wybierz inny typ lub wróć do „Wszystkie”.",
                accent: EOSPalette.home
            ) { withAnimation { app.clearHomeFilters() } }
        }

        if !newest.isEmpty {
            homeSection(
                filtering ? "Nowe · \(app.homeFilterSummary)" : "Nowe w ostatnich 24h",
                offers: Array(newest.prefix(24)),
                immersive: true,
                isFirstRail: true
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

    private func heroCardHome(hero: EstateOffer, filtering: Bool, newest: [EstateOffer]) -> some View {
        let imageURL = EOSOfferMedia.primaryImageURL(for: hero)
        let transitionID = HeroTransitionID.home(hero.id).stringValue
        return ShowroomHeroCard(
            title: hero.title,
            subtitle: [EOSFormat.pricePLN(hero.price), hero.displayLocation].filter { !$0.isEmpty }.joined(separator: "  ·  "),
            badge: hero.transactionLabel.uppercased(),
            imageURL: imageURL,
            accent: EOSPalette.home,
            primaryTitle: "POKAŻ",
            secondaryTitle: newest.count > 1 ? "Immersyjny przegląd" : nil,
            heroNamespace: heroNamespace,
            heroTransitionID: transitionID,
            showroomFocus: showroomFocus,
            onPrimary: {
                heroTransition.begin(id: .home(hero.id), imageURL: imageURL)
                app.openDetail(hero)
            },
            onSecondary: newest.count > 1 ? { app.openImmersiveBrowse(at: 0, from: Array(newest.prefix(40))) } : nil
        )
        .id("home-hero-\(hero.id)-\(app.homeFilterSummary)")
        .scaleEffect(heroAppeared ? 1 : 0.98)
        .animation(.easeOut(duration: 0.35), value: heroAppeared)
        .onMoveCommand { direction in
            switch direction {
            case .up: chromeFocus.wrappedValue = .moreFilters
            case .down: showroomFocus.wrappedValue = .firstRail
            default: break
            }
        }
        .onAppear {
            heroAppeared = true
            TvLaunchMetrics.recordHeroFocus()
            if let url = imageURL { EOSImageCache.prefetch(urls: [url]) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Wyróżniona oferta: \(hero.title), \(EOSFormat.pricePLN(hero.price))")
    }

    @ViewBuilder
    private var carShowroom: some View {
        let filtered = app.filteredCars
        let filtering = app.isCarFilteringActive
        let featured = app.showroomCarFeatured
        let fresh = app.showroomCarFresh
        let makeLabel = app.carFilterSummary

        if let hero = (featured.first ?? fresh.first ?? filtered.first) {
            heroCardCar(hero: hero, filtering: filtering, fresh: fresh, makeLabel: makeLabel)
        } else if filtering {
            emptyFilterBanner(
                title: "Brak aut dla „\(makeLabel)”",
                subtitle: "Zmień markę lub filtr paliwa — katalog odświeży się od razu.",
                accent: EOSPalette.car
            ) { withAnimation { app.clearCarFilters() } }
        }

        if !fresh.isEmpty {
            carSection(
                filtering ? "Nowe · \(makeLabel)" : "Nowe auta · 24h",
                cars: Array(fresh.prefix(24)),
                immersive: true,
                isFirstRail: true
            )
        }
        if !filtering, !app.favoriteCars.isEmpty {
            carSection("Twoje ulubione auta", cars: Array(app.favoriteCars.prefix(28)), showsHeart: true)
        }
        if !filtering, !app.carsFeatured.isEmpty {
            carSection("Wyróżnione", cars: Array(app.carsFeatured.prefix(28)))
        }
        carSection(
            filtering ? "Wyniki · \(makeLabel) · \(filtered.count)" : "Katalog samochodów",
            cars: Array(filtered.prefix(48))
        )
        if !filtering {
            carSection("Automatyczna skrzynia", cars: app.showroomCarAutomatic)
            carSection("Elektryczne i hybrydy", cars: app.showroomCarElectricHybrid)
        }
    }

    private func heroCardCar(hero: CarListing, filtering: Bool, fresh: [CarListing], makeLabel: String) -> some View {
        let imageURL = EOSOfferMedia.imageURL(from: hero.imageUrl)
        let transitionID = HeroTransitionID.car(hero.id).stringValue
        return ShowroomHeroCard(
            title: hero.displayHeadline,
            subtitle: [hero.displayPrice, hero.displaySpecs].filter { !$0.isEmpty }.joined(separator: "  ·  "),
            badge: hero.featured ? "PROMO" : (app.selectedCarMakes.isEmpty ? "EstateOS™ Car" : makeLabel.uppercased()),
            imageURL: imageURL,
            accent: EOSPalette.car,
            primaryTitle: "POKAŻ",
            secondaryTitle: fresh.count > 1 ? "Immersyjny przegląd" : nil,
            heroNamespace: heroNamespace,
            heroTransitionID: transitionID,
            showroomFocus: showroomFocus,
            onPrimary: {
                heroTransition.begin(id: .car(hero.id), imageURL: imageURL)
                app.openCarDetail(hero)
            },
            onSecondary: fresh.count > 1 ? { app.openImmersiveCarBrowse(at: 0, from: Array(fresh.prefix(40))) } : nil
        )
        .id("car-hero-\(hero.id)-\(app.carFilterSummary)")
        .scaleEffect(heroAppeared ? 1 : 0.98)
        .animation(.easeOut(duration: 0.35), value: heroAppeared)
        .onMoveCommand { direction in
            switch direction {
            case .up: chromeFocus.wrappedValue = .moreFilters
            case .down: showroomFocus.wrappedValue = .firstRail
            default: break
            }
        }
        .onAppear {
            heroAppeared = true
            if let url = imageURL { EOSImageCache.prefetch(urls: [url]) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Wyróżnione auto: \(hero.displayHeadline), \(hero.displayPrice)")
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

    private func homeSection(_ title: String, offers: [EstateOffer], showsHeart: Bool = false, immersive: Bool = false, isFirstRail: Bool = false) -> some View {
        Group {
            if !offers.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    sectionHeader(title: title, count: offers.count, showsHeart: showsHeart, immersiveHome: immersive ? offers : nil, immersiveCars: nil)
                    OffersCatalogView(offers: offers, sectionTitle: title, onSelect: app.openDetail)
                }
                .padding(.top, 8)
                .focusSection()
                .if(isFirstRail) { view in
                    view
                        .focused(showroomFocus, equals: .firstRail)
                        .onMoveCommand { direction in
                            if direction == .up { showroomFocus.wrappedValue = .hero }
                        }
                }
                .onAppear {
                    let urls = offers.prefix(6).compactMap { EOSOfferMedia.primaryImageURL(for: $0) }
                    EOSImageCache.prefetch(urls: urls)
                }
            }
        }
    }

    private func carSection(_ title: String, cars: [CarListing], showsHeart: Bool = false, immersive: Bool = false, isFirstRail: Bool = false) -> some View {
        Group {
            if !cars.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    sectionHeader(title: title, count: cars.count, showsHeart: showsHeart, immersiveHome: nil, immersiveCars: immersive && cars.count > 1 ? cars : nil)
                    CarsCatalogView(cars: cars, sectionTitle: title, onSelect: app.openCarDetail)
                }
                .padding(.top, 8)
                .focusSection()
                .if(isFirstRail) { view in
                    view
                        .focused(showroomFocus, equals: .firstRail)
                        .onMoveCommand { direction in
                            if direction == .up { showroomFocus.wrappedValue = .hero }
                        }
                }
                .onAppear {
                    let urls = cars.prefix(6).compactMap { EOSOfferMedia.imageURL(from: $0.imageUrl) }
                    EOSImageCache.prefetch(urls: urls)
                }
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
            if showsHeart { Image(systemName: "heart.fill").foregroundStyle(.pink) }
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
                Button("Immersyjny przegląd") { app.openImmersiveBrowse(at: 0, from: immersiveHome) }
                    .buttonStyle(EOSDetailChromeButtonStyle())
                    .focusEffectDisabled()
            }
            if let immersiveCars, immersiveCars.count > 1 {
                Button("Immersyjny przegląd") { app.openImmersiveCarBrowse(at: 0, from: immersiveCars) }
                    .buttonStyle(EOSDetailChromeButtonStyle())
                    .focusEffectDisabled()
            }
        }
        .padding(.horizontal, 2)
        .padding(.vertical, 6)
        .onAppear { app.noteShowroomSection(title) }
    }
}

private extension View {
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition { transform(self) } else { self }
    }
}

private struct RailStaggerModifier: ViewModifier {
    let index: Int
    @State private var appeared = false

    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 12)
            .onAppear {
                withAnimation(.easeOut(duration: 0.4).delay(Double(index) * 0.08)) {
                    appeared = true
                }
            }
    }
}

private extension View {
    func railStagger(index: Int) -> some View {
        modifier(RailStaggerModifier(index: index))
    }
}


import Foundation
import Combine
import SwiftUI
#if canImport(TVServices)
import TVServices
#endif

@MainActor
final class AppModel: ObservableObject {
    @Published var session: EstateSession?
    @Published var isBootstrapping = true
    /// True while the launch splash is on screen (RootView clears it).
    @Published var splashActive = true
    @Published var offers: [EstateOffer] = []
    @Published var selectedOffer: EstateOffer?
    @Published var globalError: String?
    @Published var isLoadingOffers = false
    @Published var searchQuery = ""
    @Published var isLoginSheetPresented = false
    @Published var loginPairingCode = ""
    @Published var passkeyPairingCode = ""
    @Published var immersiveBrowse: ImmersiveBrowseContext?
    @Published var topShelfStyle: TopShelfPresentationStyle = TvPreferences.topShelfStyle
    @Published var activeShowroomSection: String = ""
    @Published var pairingStatusMessage: String?
    @Published var favoriteOfferIds: Set<Int> = []
    @Published var favoriteOffers: [EstateOffer] = []
    @Published var isLoadingFavorites = false
    @Published var catalogBrand: CatalogBrand = .home
    @Published var cars: [CarListing] = []
    @Published var selectedCar: CarListing?
    @Published var isLoadingCars = false
    @Published var carSearchQuery = ""
    @Published var homeNearest = false
    @Published var homePremium = false
    @Published var homeDiscounted = false
    @Published var selectedHomeTransactions: Set<HomeTransactionFilter> = []
    @Published var selectedHomeCities: Set<String> = []
    @Published var homeCitiesPickerExpanded = false
    @Published var carNearest = false
    @Published var selectedCarAttributes: Set<CarAttributeFilter> = []
    @Published var selectedCarCities: Set<String> = []
    @Published var carCitiesPickerExpanded = false
    @Published var selectedCarMakes: Set<String> = []
    /// Extended criteria edited on the filter screen (location cascade, ranges, amenities, sort).
    @Published var homeCriteria = HomeCriteria()
    @Published var carCriteria = CarCriteria()
    @Published var selectedHomePropertyTypes: Set<HomePropertyKind> = []
    @Published var favoriteCarIds: Set<Int> = TvPreferences.favoriteCarIds
    let location = TvLocationService.shared

    let api = EstateAPIClient()
    private var tvPairPollTask: Task<Void, Never>?
    private var locationBag = Set<AnyCancellable>()
    private var pendingDeepLinkOfferId: Int?
    private var pendingDeepLinkCarId: Int?
    private var pendingDeepLinkURL: URL?

    func bootstrap() async {
        defer { isBootstrapping = false; TvLaunchMetrics.recordBootstrapEnd() }
        bindLocationRefresh()
        if offers.isEmpty, let cached = TvCatalogCache.loadOffers() {
            offers = cached
            TvCatalogCache.isUsingCachedCatalog = true
        }
        if cars.isEmpty, let cached = TvCatalogCache.loadCars() {
            cars = cached
            TvCatalogCache.isUsingCachedCatalog = true
        }
        warmPrefetchCatalogImages()
        if !offers.isEmpty || !cars.isEmpty {
            // Cached catalog is already on screen: keep the main thread free for the splash
            // and refresh from the network right after it.
            await waitForSplashEnd()
        }
        TopShelfArtBaker.enqueue(offers: offers, cars: cars)
        async let offersTask: Void = { try? await refreshOffers() }()
        async let carsTask: Void = { try? await refreshCars() }()
        async let favoritesTask: Void = { await refreshFavoritesIfNeeded() }()
        _ = await (offersTask, carsTask, favoritesTask)
#if canImport(TVServices)
        TVTopShelfContentProvider.topShelfContentDidChange()
#endif
        await fulfillPendingDeepLink()
        if let saved = SessionStore.load() {
            api.setToken(saved.token)
            session = saved
            do {
                _ = try await api.me()
                await refreshFavorites()
            } catch {
                logout()
            }
        }
        consumePendingDeepLink()
    }

    func login(login: String, password: String) async {
        do {
            let session = try await api.login(login: login, password: password)
            self.session = session
            pairingStatusMessage = nil
            try await refreshOffers()
            try? await refreshCars()
            await refreshFavorites()
            closeLoginSheet()
        } catch {
            globalError = TvErrorMessages.message(for: error)
        }
    }

    func setTopShelfStyle(_ style: TopShelfPresentationStyle) {
        topShelfStyle = style
        TvPreferences.topShelfStyle = style
        // HeadBoard often queries before the App Group write is visible — notify twice.
        notifyTopShelfDidChange()
        Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            notifyTopShelfDidChange()
        }
    }

    private func notifyTopShelfDidChange() {
#if canImport(TVServices)
        TVTopShelfContentProvider.topShelfContentDidChange()
#endif
    }

    func noteShowroomSection(_ title: String) {
        guard !title.isEmpty, activeShowroomSection != title else { return }
        activeShowroomSection = title
    }

    func logout() {
        SessionStore.clear()
        session = nil
        selectedOffer = nil
        selectedCar = nil
        immersiveBrowse = nil
        favoriteOfferIds = []
        favoriteOffers = []
        api.setToken(nil)
        Task {
            try? await refreshOffers()
            try? await refreshCars()
        }
    }

    func isFavorite(_ offerId: Int) -> Bool {
        favoriteOfferIds.contains(offerId)
    }

    func refreshFavorites() async {
        guard session != nil else {
            favoriteOfferIds = []
            favoriteOffers = []
            return
        }
        isLoadingFavorites = true
        defer { isLoadingFavorites = false }
        do {
            let response = try await api.fetchFavorites()
            let ids = Set(response.offerIds ?? [])
            favoriteOfferIds = ids
            let remote = response.offers ?? []
            if !remote.isEmpty {
                favoriteOffers = remote
            } else {
                favoriteOffers = offers.filter { ids.contains($0.id) }
            }
        } catch {
            // Keep cached favorites on transient errors.
        }
    }

    func toggleFavorite(_ offer: EstateOffer) async {
        guard session != nil else {
            openLoginSheet()
            return
        }
        let adding = !isFavorite(offer.id)
        if adding {
            favoriteOfferIds.insert(offer.id)
            if !favoriteOffers.contains(where: { $0.id == offer.id }) {
                favoriteOffers.insert(offer, at: 0)
            }
        } else {
            favoriteOfferIds.remove(offer.id)
            favoriteOffers.removeAll { $0.id == offer.id }
        }
        do {
            try await api.setFavorite(offerId: offer.id, added: adding)
        } catch {
            if adding {
                favoriteOfferIds.remove(offer.id)
                favoriteOffers.removeAll { $0.id == offer.id }
            } else {
                favoriteOfferIds.insert(offer.id)
                if !favoriteOffers.contains(where: { $0.id == offer.id }) {
                    favoriteOffers.insert(offer, at: 0)
                }
            }
            globalError = TvErrorMessages.message(for: error)
        }
    }

    func isFavoriteCar(_ carId: Int) -> Bool {
        favoriteCarIds.contains(carId)
    }

    var favoriteCars: [CarListing] {
        cars.filter { favoriteCarIds.contains($0.id) }
    }

    func toggleFavoriteCar(_ car: CarListing) {
        let adding = !favoriteCarIds.contains(car.id)
        if adding {
            favoriteCarIds.insert(car.id)
        } else {
            favoriteCarIds.remove(car.id)
        }
        TvPreferences.favoriteCarIds = favoriteCarIds
        Task { await api.bumpCarFavoriteCount(id: car.id, favorited: adding) }
    }

    func refreshOffers() async throws {
        isLoadingOffers = true
        defer { isLoadingOffers = false }
        do {
            offers = try await api.fetchOffers()
            TvCatalogCache.saveOffers(offers)
            TvCatalogCache.isUsingCachedCatalog = false
            warmPrefetchCatalogImages()
            TopShelfArtBaker.enqueue(offers: offers)
#if canImport(TVServices)
            TVTopShelfContentProvider.topShelfContentDidChange()
#endif
        } catch {
            if offers.isEmpty, let cached = TvCatalogCache.loadOffers() {
                offers = cached
                TvCatalogCache.isUsingCachedCatalog = true
            } else {
                globalError = TvErrorMessages.message(for: error)
            }
            throw error
        }
    }

    var filteredOffers: [EstateOffer] {
        api.searchOffers(query: searchQuery, source: offers)
    }

    func recordRecentSearch(_ query: String, brand: CatalogBrand? = nil) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return }
        let target = brand ?? catalogBrand
        var list = recentSearches(for: target)
        list.removeAll { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
        list.insert(trimmed, at: 0)
        list = Array(list.prefix(3))
        switch target {
        case .home: TvPreferences.recentSearchesHome = list
        case .car: TvPreferences.recentSearchesCar = list
        }
        objectWillChange.send()
    }

    func recentSearches(for brand: CatalogBrand) -> [String] {
        switch brand {
        case .home: return TvPreferences.recentSearchesHome
        case .car: return TvPreferences.recentSearchesCar
        }
    }

    var homeSecondaryFilterCount: Int {
        var count = selectedHomeTransactions.count
        if homePremium { count += 1 }
        if homeDiscounted { count += 1 }
        count += selectedHomePropertyTypes.count
        count += selectedHomeCities.isEmpty ? 0 : 1
        count += homeCriteria.activeCount
        return count
    }

    var carSecondaryFilterCount: Int {
        selectedCarAttributes.count + selectedCarMakes.count
            + (selectedCarCities.isEmpty ? 0 : 1) + carCriteria.activeCount
    }


    var offersLast24Hours: [EstateOffer] {
        offers
            .filter(\.isWithinLast24Hours)
            .sorted { $0.sortDate > $1.sortDate }
    }


    func setCatalogBrand(_ brand: CatalogBrand) {
        catalogBrand = brand
        selectedCarMakes = []
        selectedHomePropertyTypes = []
        selectedHomeTransactions = []
        selectedHomeCities = []
        selectedCarAttributes = []
        selectedCarCities = []
        homeNearest = false
        homePremium = false
        homeDiscounted = false
        carNearest = false
        homeCitiesPickerExpanded = false
        carCitiesPickerExpanded = false
        if brand == .car, cars.isEmpty {
            Task { try? await refreshCars() }
        }
    }

    private func bindLocationRefresh() {
        guard locationBag.isEmpty else { return }
        location.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &locationBag)
    }

    func clearHomeFilters() {
        homeNearest = false
        homePremium = false
        homeDiscounted = false
        selectedHomeTransactions = []
        selectedHomeCities = []
        selectedHomePropertyTypes = []
        homeCitiesPickerExpanded = false
        homeCriteria = HomeCriteria()
    }

    func clearCarFilters() {
        carNearest = false
        selectedCarAttributes = []
        selectedCarCities = []
        selectedCarMakes = []
        carCitiesPickerExpanded = false
        carCriteria = CarCriteria()
    }

    func toggleHomeNearest() {
        homeNearest.toggle()
        if homeNearest { location.requestIfNeeded() }
    }

    func toggleHomePremium() {
        homePremium.toggle()
    }

    func toggleHomeDiscounted() {
        homeDiscounted.toggle()
    }

    /// Engagement stats (views / favorites) are private to the listing owner.
    func isOwner(of offer: EstateOffer) -> Bool {
        guard let ownerId = offer.userId, let me = session?.user.id else { return false }
        return ownerId == me
    }

    func toggleHomeTransaction(_ kind: HomeTransactionFilter) {
        if selectedHomeTransactions.contains(kind) {
            selectedHomeTransactions.remove(kind)
        } else {
            selectedHomeTransactions.insert(kind)
        }
    }

    func toggleHomeCity(_ city: String) {
        let key = city.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else { return }
        if let existing = selectedHomeCities.first(where: { $0.caseInsensitiveCompare(key) == .orderedSame }) {
            selectedHomeCities.remove(existing)
        } else {
            selectedHomeCities.insert(key)
        }
    }

    func clearHomeCities() {
        selectedHomeCities = []
    }

    func toggleHomeCitiesPicker() {
        homeCitiesPickerExpanded.toggle()
        if homeCitiesPickerExpanded { carCitiesPickerExpanded = false }
    }

    func toggleCarNearest() {
        carNearest.toggle()
        if carNearest { location.requestIfNeeded() }
    }

    func toggleCarAttribute(_ attr: CarAttributeFilter) {
        if selectedCarAttributes.contains(attr) {
            selectedCarAttributes.remove(attr)
        } else {
            selectedCarAttributes.insert(attr)
        }
    }

    func toggleCarCity(_ city: String) {
        let key = city.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else { return }
        if let existing = selectedCarCities.first(where: { $0.caseInsensitiveCompare(key) == .orderedSame }) {
            selectedCarCities.remove(existing)
        } else {
            selectedCarCities.insert(key)
        }
    }

    func clearCarCities() {
        selectedCarCities = []
    }

    func toggleCarCitiesPicker() {
        carCitiesPickerExpanded.toggle()
        if carCitiesPickerExpanded { homeCitiesPickerExpanded = false }
    }

    func toggleCarMake(_ make: String) {
        let key = make.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else { return }
        if selectedCarMakes.contains(key) {
            selectedCarMakes.remove(key)
        } else {
            selectedCarMakes.insert(key)
        }
    }

    func clearCarMakes() {
        selectedCarMakes = []
    }

    func toggleHomePropertyType(_ kind: HomePropertyKind) {
        if selectedHomePropertyTypes.contains(kind) {
            selectedHomePropertyTypes.remove(kind)
        } else {
            selectedHomePropertyTypes.insert(kind)
        }
    }

    func clearHomePropertyTypes() {
        selectedHomePropertyTypes = []
    }

    func distanceLabel(forCity city: String?) -> String? {
        guard let user = location.coordinate else { return nil }
        return PolishPlaceCoordinates.distanceLabel(
            km: PolishPlaceCoordinates.distanceKm(from: user, toPlace: city)
        )
    }

    func distanceKm(forCity city: String?) -> Double? {
        guard let user = location.coordinate else { return nil }
        return PolishPlaceCoordinates.distanceKm(from: user, toPlace: city)
    }

    func refreshCars() async throws {
        isLoadingCars = true
        defer { isLoadingCars = false }
        do {
            cars = try await api.fetchCars()
            TvCatalogCache.saveCars(cars)
            TvCatalogCache.isUsingCachedCatalog = false
            warmPrefetchCatalogImages()
            TopShelfArtBaker.enqueue(cars: cars)
#if canImport(TVServices)
            TVTopShelfContentProvider.topShelfContentDidChange()
#endif
        } catch {
            if cars.isEmpty, let cached = TvCatalogCache.loadCars() {
                cars = cached
                TvCatalogCache.isUsingCachedCatalog = true
            } else {
                globalError = TvErrorMessages.message(for: error)
            }
            throw error
        }
    }

    private func matchesHomePropertyType(_ offer: EstateOffer, kind: HomePropertyKind) -> Bool {
        let p = (offer.propertyType ?? "").uppercased()
        switch kind {
        case .flat:
            return p.contains("FLAT") || p.contains("APART") || p.contains("MIESZ")
        case .house:
            return p.contains("HOUSE") || p.contains("HOME") || p.contains("DOM")
        case .plot:
            return p.contains("PLOT") || p.contains("LAND") || p.contains("DZIAL")
        case .commercial:
            return p.contains("COMMERCIAL") || p.contains("LOKAL") || p.contains("OFFICE")
        }
    }

    var filteredOffersForBrowse: [EstateOffer] {
        var base = filteredOffers
        if !selectedHomeTransactions.isEmpty {
            base = base.filter { offer in
                let tx = (offer.transactionType ?? "").uppercased()
                return selectedHomeTransactions.contains { kind in
                    switch kind {
                    case .sale:
                        return tx.contains("SELL") || tx.contains("SALE") || tx.isEmpty
                    case .rent:
                        return tx.contains("RENT")
                    }
                }
            }
        }
        if homePremium {
            base = base.filter { ($0.price ?? 0) >= 1_500_000 }
        }
        if homeDiscounted {
            base = base.filter { $0.isPriceReduced(minPercent: 2) }
        }
        if !selectedHomeCities.isEmpty {
            base = base.filter { offer in
                let city = (offer.city ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                guard !city.isEmpty else { return false }
                return selectedHomeCities.contains { $0.caseInsensitiveCompare(city) == .orderedSame }
            }
        }
        if !selectedHomePropertyTypes.isEmpty {
            base = base.filter { offer in
                selectedHomePropertyTypes.contains { matchesHomePropertyType(offer, kind: $0) }
            }
        }
        base = homeCriteria.apply(to: base)
        if homeNearest || homeCriteria.sort == .nearest {
            return sortOffersByDistance(base)
        }
        return homeCriteria.sort.sorted(base)
    }

    var homeFilterSummary: String {
        var parts: [String] = []
        if homeNearest { parts.append("Najbliżej") }
        for kind in HomeTransactionFilter.allCases where selectedHomeTransactions.contains(kind) {
            parts.append(kind.title)
        }
        if homePremium { parts.append("Premium") }
        if homeDiscounted { parts.append("Przecenione") }
        if !selectedHomeCities.isEmpty {
            parts.append(selectedHomeCities.sorted().joined(separator: " · "))
        }
        parts.append(contentsOf: homeCriteria.summaryParts)
        return parts.isEmpty ? "Wszystkie" : parts.joined(separator: " · ")
    }

    var carFilterSummary: String {
        var parts: [String] = []
        if carNearest { parts.append("Najbliżej") }
        for attr in CarAttributeFilter.allCases where selectedCarAttributes.contains(attr) {
            parts.append(attr.title)
        }
        if !selectedCarCities.isEmpty {
            parts.append(selectedCarCities.sorted().joined(separator: " · "))
        }
        if !selectedCarMakes.isEmpty {
            parts.append(selectedCarMakes.sorted().joined(separator: " · "))
        }
        parts.append(contentsOf: carCriteria.summaryParts)
        return parts.isEmpty ? "Wszystkie" : parts.joined(separator: " · ")
    }

    var homeCityCounts: [(name: String, count: Int)] {
        var counts: [String: Int] = [:]
        for offer in offers {
            let city = (offer.city ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !city.isEmpty else { continue }
            // Normalize display key by first-seen casing of lowercase group
            if let existing = counts.keys.first(where: { $0.caseInsensitiveCompare(city) == .orderedSame }) {
                counts[existing, default: 0] += 1
            } else {
                counts[city] = 1
            }
        }
        return counts.keys.sorted {
            let c0 = counts[$0] ?? 0
            let c1 = counts[$1] ?? 0
            if c0 != c1 { return c0 > c1 }
            return $0.localizedCaseInsensitiveCompare($1) == .orderedAscending
        }
        .map { (name: $0, count: counts[$0] ?? 0) }
    }

    var carCityCounts: [(name: String, count: Int)] {
        var counts: [String: Int] = [:]
        for car in cars {
            let city = car.city.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !city.isEmpty else { continue }
            if let existing = counts.keys.first(where: { $0.caseInsensitiveCompare(city) == .orderedSame }) {
                counts[existing, default: 0] += 1
            } else {
                counts[city] = 1
            }
        }
        return counts.keys.sorted {
            let c0 = counts[$0] ?? 0
            let c1 = counts[$1] ?? 0
            if c0 != c1 { return c0 > c1 }
            return $0.localizedCaseInsensitiveCompare($1) == .orderedAscending
        }
        .map { (name: $0, count: counts[$0] ?? 0) }
    }


    // MARK: - Showroom section slices (Set-based, cheap to re-read)

    var showroomHomeNewest: [EstateOffer] {
        let filtered = filteredOffersForBrowse
        if isHomeFilteringActive {
            let ids = Set(filtered.map(\.id))
            return offersLast24Hours.filter { ids.contains($0.id) }
        }
        return offersLast24Hours
    }

    var showroomHomeWarsaw: [EstateOffer] {
        Array(offers.filter { ($0.city ?? "").localizedCaseInsensitiveContains("warsz") }.prefix(28))
    }

    var showroomHomePremium: [EstateOffer] {
        Array(offers.filter { ($0.price ?? 0) >= 2_000_000 }.prefix(28))
    }

    var showroomHomeRent: [EstateOffer] {
        Array(offers.filter { ($0.transactionType ?? "").uppercased().contains("RENT") }.prefix(28))
    }

    var showroomCarFresh: [CarListing] {
        filteredCars.filter(\.isWithinLast24Hours).sorted { $0.sortDate > $1.sortDate }
    }

    var showroomCarFeatured: [CarListing] {
        filteredCars.filter(\.featured)
    }

    var showroomCarAutomatic: [CarListing] {
        Array(cars.filter { $0.transmission.localizedCaseInsensitiveContains("automat") }.prefix(28))
    }

    var showroomCarElectricHybrid: [CarListing] {
        Array(cars.filter {
            let f = $0.fuelType.lowercased()
            return f.contains("elektr") || f.contains("hybr") || f.contains("ev")
        }.prefix(28))
    }

    var popularCarMakes: [(name: String, count: Int)] {
        var counts: [String: Int] = [:]
        for car in cars {
            let make = car.make.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !make.isEmpty else { continue }
            counts[make, default: 0] += 1
        }
        return counts.keys.sorted {
            let c0 = counts[$0] ?? 0
            let c1 = counts[$1] ?? 0
            if c0 != c1 { return c0 > c1 }
            return $0.localizedCaseInsensitiveCompare($1) == .orderedAscending
        }
        .map { (name: $0, count: counts[$0] ?? 0) }
    }

    var homePropertyTypeCounts: [(kind: HomePropertyKind, count: Int)] {
        HomePropertyKind.allCases.map { kind in
            (kind, offers.filter { matchesHomePropertyType($0, kind: kind) }.count)
        }
    }

    var isCarFilteringActive: Bool {
        carNearest
            || !selectedCarAttributes.isEmpty
            || !selectedCarMakes.isEmpty
            || !selectedCarCities.isEmpty
            || carCriteria.isActive
    }

    var isHomeFilteringActive: Bool {
        homeNearest
            || homePremium
            || homeDiscounted
            || !selectedHomeTransactions.isEmpty
            || !selectedHomeCities.isEmpty
            || !selectedHomePropertyTypes.isEmpty
            || homeCriteria.isActive
    }

    /// Offers currently discounted by ≥2% (catalog-wide, for the filter chip count).
    var homeDiscountedCount: Int {
        offers.filter { $0.isPriceReduced(minPercent: 2) }.count
    }

    var showroomHomeDiscounted: [EstateOffer] {
        Array(offers.filter { $0.isPriceReduced(minPercent: 2) }.prefix(28))
    }

    var filteredCars: [CarListing] {
        var base = api.searchCars(query: carSearchQuery, source: cars)
        if !selectedCarMakes.isEmpty {
            base = base.filter { car in
                let make = car.make.trimmingCharacters(in: .whitespacesAndNewlines)
                return selectedCarMakes.contains(where: { $0.caseInsensitiveCompare(make) == .orderedSame })
            }
        }
        if !selectedCarCities.isEmpty {
            base = base.filter { car in
                let city = car.city.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !city.isEmpty else { return false }
                return selectedCarCities.contains { $0.caseInsensitiveCompare(city) == .orderedSame }
            }
        }
        if !selectedCarAttributes.isEmpty {
            let fuels: Set<CarAttributeFilter> = selectedCarAttributes.intersection([.petrol, .diesel, .electric, .hybrid])
            let wantsFeatured = selectedCarAttributes.contains(.featured)
            let wantsAuto = selectedCarAttributes.contains(.automatic)
            base = base.filter { car in
                if wantsFeatured, !car.featured { return false }
                if wantsAuto, !car.transmission.localizedCaseInsensitiveContains("automat") { return false }
                if !fuels.isEmpty {
                    let fuel = car.fuelType.lowercased()
                    let match = fuels.contains { attr in
                        switch attr {
                        case .petrol: return fuel.contains("benz")
                        case .diesel: return fuel.contains("diesel") || fuel.contains("olej")
                        case .electric: return fuel.contains("elektr") || fuel.contains("ev")
                        case .hybrid: return fuel.contains("hybr")
                        default: return false
                        }
                    }
                    if !match { return false }
                }
                return true
            }
        }
        base = carCriteria.apply(to: base)
        if carNearest || carCriteria.sort == .nearest {
            return sortCarsByDistance(base)
        }
        return carCriteria.sort.sorted(base)
    }

    private func sortCarsByDistance(_ list: [CarListing]) -> [CarListing] {
        guard location.coordinate != nil else { return list }
        return list.sorted {
            let d0 = distanceKm(forCity: $0.city) ?? Double.greatestFiniteMagnitude
            let d1 = distanceKm(forCity: $1.city) ?? Double.greatestFiniteMagnitude
            if d0 != d1 { return d0 < d1 }
            return $0.id < $1.id
        }
    }

    private func sortOffersByDistance(_ list: [EstateOffer]) -> [EstateOffer] {
        guard location.coordinate != nil else { return list }
        return list.sorted {
            let d0 = distanceKm(forCity: $0.city) ?? Double.greatestFiniteMagnitude
            let d1 = distanceKm(forCity: $1.city) ?? Double.greatestFiniteMagnitude
            if d0 != d1 { return d0 < d1 }
            return $0.id < $1.id
        }
    }

    var carsFeatured: [CarListing] {
        cars.filter(\.featured)
    }

    var carsLast24Hours: [CarListing] {
        cars.filter(\.isWithinLast24Hours).sorted { $0.sortDate > $1.sortDate }
    }

    private func waitForSplashEnd() async {
        let start = Date()
        while splashActive, Date().timeIntervalSince(start) < 30 {
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        try? await Task.sleep(nanoseconds: 600_000_000)
    }

    /// The photo the showroom opens on — the splash waits for it before opening the doors.
    var launchHeroImageURL: URL? {
        let offer = showroomHomeNewest.first ?? filteredOffersForBrowse.first ?? offers.first
        return offer.flatMap { EOSOfferMedia.primaryImageURL(for: $0) }
    }

    func warmPrefetchCatalogImages() {
        var urls: [URL] = []
        for offer in offers.prefix(6) {
            if let u = EOSOfferMedia.primaryImageURL(for: offer) { urls.append(u) }
        }
        for car in cars.prefix(6) {
            if let u = EOSOfferMedia.imageURL(from: car.imageUrl) { urls.append(u) }
        }
        EOSImageCache.prefetch(urls: Array(urls.prefix(12)), size: .card)
    }

    private func refreshFavoritesIfNeeded() async {
        if session != nil { await refreshFavorites() }
    }

    func openCarDetail(_ car: CarListing) {
        selectedCar = car
        Task { await api.recordCarView(id: car.id) }
    }

    func closeCarDetail() {
        selectedCar = nil
    }

    func searchSpotlight(query: String) async throws -> SpotlightSearchResponse {
        try await api.searchSpotlight(query: query)
    }

    func openSpotlightOffer(id: Int) async {
        if let offer = offers.first(where: { $0.id == id }) {
            setCatalogBrand(.home)
            openDetail(offer)
            return
        }
        if let offer = try? await api.offerDetail(id: id, fallbackOffers: offers) {
            setCatalogBrand(.home)
            openDetail(offer)
        }
    }

    func recordSpotlightSearch(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return }
        var list = TvPreferences.recentSpotlightSearches
        list.removeAll { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
        list.insert(trimmed, at: 0)
        TvPreferences.recentSpotlightSearches = Array(list.prefix(6))
        objectWillChange.send()
    }

    func openDetail(_ offer: EstateOffer) {
        selectedOffer = offer
        Task {
            await api.recordOfferView(id: offer.id)
            await refreshSelectedOfferDetail(id: offer.id)
        }
    }

    @MainActor
    func refreshSelectedOfferDetail(id: Int) async {
        guard selectedOffer?.id == id else { return }
        // Catalog list often has VERIFY-only "description" — pull the full body.
        if OfferPresentation.plainDescription(from: selectedOffer?.description) != nil {
            return
        }
        do {
            let full = try await api.offerDetail(id: id, fallbackOffers: offers)
            guard selectedOffer?.id == id else { return }
            selectedOffer = full
            if let idx = offers.firstIndex(where: { $0.id == id }) {
                offers[idx] = full
            }
        } catch {
            // Keep list payload; UI shows loading / empty opis.
        }
    }

    func closeDetail() {
        selectedOffer = nil
    }

    func openImmersiveBrowse(at index: Int, from source: [EstateOffer]? = nil) {
        let pool = source ?? offersLast24Hours
        guard !pool.isEmpty else { return }
        let clamped = min(max(0, index), pool.count - 1)
        immersiveBrowse = ImmersiveBrowseContext(kind: .homes(pool), startIndex: clamped)
    }

    func openImmersiveCarBrowse(at index: Int, from source: [CarListing]? = nil) {
        let pool = source ?? (carsLast24Hours.isEmpty ? filteredCars : carsLast24Hours)
        guard !pool.isEmpty else { return }
        let clamped = min(max(0, index), pool.count - 1)
        immersiveBrowse = ImmersiveBrowseContext(kind: .cars(pool), startIndex: clamped)
    }

    func closeImmersiveBrowse() {
        immersiveBrowse = nil
    }

    func handleDeepLink(_ url: URL) {
        pendingDeepLinkURL = url
        Task { await fulfillPendingDeepLink() }
    }

    func fulfillPendingDeepLink() async {
        guard let url = pendingDeepLinkURL else { return }
        let immersive = TvDeepLink.opensImmersive(from: url)

        if let carId = TvDeepLink.carId(from: url) {
            var car = cars.first(where: { $0.id == carId })
            if car == nil {
                car = try? await api.carDetail(id: carId, fallback: cars)
            }
            guard let car else { return }
            pendingDeepLinkURL = nil
            pendingDeepLinkCarId = nil
            setCatalogBrand(.car)
            if immersive {
                let pool = carsLast24Hours.isEmpty ? cars : carsLast24Hours
                if let index = pool.firstIndex(where: { $0.id == car.id }) {
                    openImmersiveCarBrowse(at: index, from: pool)
                } else {
                    openImmersiveCarBrowse(at: 0, from: [car])
                }
            } else {
                openCarDetail(car)
            }
            return
        }

        guard let offerId = TvDeepLink.offerId(from: url) else {
            pendingDeepLinkURL = nil
            return
        }

        var offer = offers.first(where: { $0.id == offerId })
        if offer == nil {
            offer = try? await api.offerDetail(id: offerId, fallbackOffers: offers)
        }
        guard let offer else { return }
        pendingDeepLinkURL = nil
        pendingDeepLinkOfferId = nil
        setCatalogBrand(.home)
        if immersive {
            let pool = offersLast24Hours
            if let index = pool.firstIndex(where: { $0.id == offer.id }) {
                openImmersiveBrowse(at: index, from: pool)
            } else {
                openImmersiveBrowse(at: 0, from: [offer])
            }
        } else {
            openDetail(offer)
        }
    }

    private var pendingDeepLinkImmersive = false
    private var pendingDeepLinkCarImmersive = false

    private func consumePendingDeepLink() {
        Task { await fulfillPendingDeepLink() }
    }

    func openLoginSheet() {
        isLoginSheetPresented = true
        pairingStatusMessage = "Oczekiwanie na iPhone (Passkey lub login)…"
        Task {
            await prepareTvPairCodes()
            startTvPairPolling()
        }
    }

    func closeLoginSheet() {
        isLoginSheetPresented = false
        pairingStatusMessage = nil
        tvPairPollTask?.cancel()
        tvPairPollTask = nil
    }

    func refreshTvPairCode(mode: String) async {
        do {
            let response = try await api.startTvPairing(mode: mode)
            if mode == "passkey" {
                passkeyPairingCode = response.pairCode
            } else {
                loginPairingCode = response.pairCode
            }
        } catch {
            globalError = TvErrorMessages.message(for: error)
        }
    }

    private func prepareTvPairCodes() async {
        await refreshTvPairCode(mode: "password")
        await refreshTvPairCode(mode: "passkey")
    }

    private func startTvPairPolling() {
        tvPairPollTask?.cancel()
        tvPairPollTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                if !self.isLoginSheetPresented || self.session != nil {
                    return
                }
                await self.pollPairCode(self.passkeyPairingCode)
                if self.session == nil {
                    await self.pollPairCode(self.loginPairingCode)
                }
                try? await Task.sleep(nanoseconds: 1_600_000_000)
            }
        }
    }

    private func pollPairCode(_ pairCode: String) async {
        let code = pairCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !code.isEmpty else { return }
        do {
            let status = try await api.pollTvPairing(pairCode: code)
            if status.success,
               String(status.status ?? "").lowercased() == "approved",
               let token = status.token,
               let user = status.user {
                let session = EstateSession(token: token, user: user)
                self.session = session
                self.api.setToken(token)
                try? SessionStore.save(session)
                self.pairingStatusMessage = "Zalogowano przez iPhone."
                self.isLoginSheetPresented = false
                try? await self.refreshOffers()
                await self.refreshFavorites()
                tvPairPollTask?.cancel()
                tvPairPollTask = nil
            }
        } catch {
            // Polling should be resilient; ignore transient status/network errors.
        }
    }
}

struct ImmersiveBrowseContext: Identifiable {
    enum Kind {
        case homes([EstateOffer])
        case cars([CarListing])
    }

    let id = UUID()
    let kind: Kind
    let startIndex: Int
}


enum HomeTransactionFilter: String, CaseIterable, Identifiable {
    case sale, rent
    var id: String { rawValue }
    var title: String {
        switch self {
        case .sale: return "Sprzedaż"
        case .rent: return "Wynajem"
        }
    }
}

enum HomePropertyKind: String, CaseIterable, Identifiable {
    case flat, house, plot, commercial
    var id: String { rawValue }
    var title: String {
        switch self {
        case .flat: return "Mieszkanie"
        case .house: return "Dom"
        case .plot: return "Działka"
        case .commercial: return "Lokal użytkowy"
        }
    }
    var icon: String {
        switch self {
        case .flat: return "building.2"
        case .house: return "house"
        case .plot: return "leaf"
        case .commercial: return "storefront"
        }
    }
}

enum CarAttributeFilter: String, CaseIterable, Identifiable {
    case featured, petrol, diesel, electric, hybrid, automatic
    var id: String { rawValue }
    var title: String {
        switch self {
        case .featured: return "Wyróżnione"
        case .petrol: return "Benzyna"
        case .diesel: return "Diesel"
        case .electric: return "Elektryczne"
        case .hybrid: return "Hybryda"
        case .automatic: return "Automat"
        }
    }
}


// MARK: - Extended filter criteria (filter screen, 2026-10)

/// A closed numeric range picked from presets; nil bound = no limit.
struct FilterRange: Hashable {
    var min: Double?
    var max: Double?
    var isActive: Bool { min != nil || max != nil }
    func contains(_ value: Double?) -> Bool {
        guard isActive else { return true }
        guard let value else { return false }
        if let min, value < min { return false }
        if let max, value > max { return false }
        return true
    }
}

enum HomeAmenity: String, CaseIterable, Identifiable, Hashable {
    case balcony, elevator, parking, storage, garden, airConditioning, furnished
    var id: String { rawValue }
    var title: String {
        switch self {
        case .balcony: return "Balkon lub taras"
        case .elevator: return "Winda"
        case .parking: return "Miejsce parkingowe"
        case .storage: return "Komórka lokatorska"
        case .garden: return "Ogród"
        case .airConditioning: return "Klimatyzacja"
        case .furnished: return "Umeblowane"
        }
    }
    var icon: String {
        switch self {
        case .balcony: return "sun.max"
        case .elevator: return "arrow.up.arrow.down.square"
        case .parking: return "parkingsign.circle"
        case .storage: return "shippingbox"
        case .garden: return "leaf"
        case .airConditioning: return "snowflake"
        case .furnished: return "sofa"
        }
    }
    func matches(_ x: EstateOfferExtras) -> Bool {
        switch self {
        case .balcony: return x.hasBalcony
        case .elevator: return x.hasElevator
        case .parking: return x.hasParking
        case .storage: return x.hasStorage
        case .garden: return x.hasGarden
        case .airConditioning: return x.hasAirConditioning
        case .furnished: return x.isFurnished
        }
    }
}

enum HomeFloorFilter: String, CaseIterable, Identifiable, Hashable {
    case groundFloor, notGround, notTop, highFloor
    var id: String { rawValue }
    var title: String {
        switch self {
        case .groundFloor: return "Parter"
        case .notGround: return "Bez parteru"
        case .notTop: return "Nie ostatnie piętro"
        case .highFloor: return "Od 4. piętra"
        }
    }
    func matches(_ x: EstateOfferExtras) -> Bool {
        guard let floor = x.floor else { return false }
        switch self {
        case .groundFloor: return floor <= 0
        case .notGround: return floor > 0
        case .notTop: return x.totalFloors.map { floor < $0 } ?? true
        case .highFloor: return floor >= 4
        }
    }
}

enum HomeSort: String, CaseIterable, Identifiable, Hashable {
    case newest, cheapest, priciest, largest, cheapestPerSqm, nearest
    var id: String { rawValue }
    var title: String {
        switch self {
        case .newest: return "Najnowsze"
        case .cheapest: return "Najtańsze"
        case .priciest: return "Najdroższe"
        case .largest: return "Największe"
        case .cheapestPerSqm: return "Najniższa cena za m²"
        case .nearest: return "Najbliżej mnie"
        }
    }
    var icon: String {
        switch self {
        case .newest: return "clock"
        case .cheapest: return "arrow.down"
        case .priciest: return "arrow.up"
        case .largest: return "square.resize.up"
        case .cheapestPerSqm: return "chart.bar"
        case .nearest: return "location"
        }
    }
    func sorted(_ list: [EstateOffer]) -> [EstateOffer] {
        func price(_ o: EstateOffer) -> Double { o.extras.pricePln ?? o.price ?? .greatestFiniteMagnitude }
        switch self {
        case .newest, .nearest: return list
        case .cheapest: return list.sorted { price($0) < price($1) }
        case .priciest: return list.sorted { (($0.extras.pricePln ?? $0.price) ?? 0) > (($1.extras.pricePln ?? $1.price) ?? 0) }
        case .largest: return list.sorted { ($0.area ?? 0) > ($1.area ?? 0) }
        case .cheapestPerSqm:
            return list.sorted { ($0.pricePerSqm ?? .greatestFiniteMagnitude) < ($1.pricePerSqm ?? .greatestFiniteMagnitude) }
        }
    }
}

struct HomeCriteria: Hashable {
    var countries: Set<String> = []
    var districts: Set<String> = []
    var price = FilterRange()
    var area = FilterRange()
    var minRooms: Int?
    var floors: Set<HomeFloorFilter> = []
    var minYearBuilt: Int?
    var amenities: Set<HomeAmenity> = []
    var sort: HomeSort = .newest

    var activeCount: Int {
        var n = 0
        if !countries.isEmpty { n += 1 }
        if !districts.isEmpty { n += 1 }
        if price.isActive { n += 1 }
        if area.isActive { n += 1 }
        if minRooms != nil { n += 1 }
        n += floors.count
        if minYearBuilt != nil { n += 1 }
        n += amenities.count
        return n
    }

    var isActive: Bool { activeCount > 0 || sort != .newest }

    var summaryParts: [String] {
        var p: [String] = []
        if !districts.isEmpty { p.append(districts.sorted().joined(separator: ", ")) }
        if price.isActive { p.append(FilterFormat.range(price, unit: "zł", money: true)) }
        if area.isActive { p.append(FilterFormat.range(area, unit: "m²", money: false)) }
        if let minRooms { p.append("\(minRooms)+ pok.") }
        if let minYearBuilt { p.append("od \(minYearBuilt) r.") }
        p.append(contentsOf: floors.map(\.title).sorted())
        p.append(contentsOf: amenities.map(\.title).sorted())
        if sort != .newest { p.append(sort.title) }
        return p
    }

    func apply(to list: [EstateOffer]) -> [EstateOffer] {
        guard activeCount > 0 else { return list }
        return list.filter(matches)
    }

    func matches(_ o: EstateOffer) -> Bool {
        if !countries.isEmpty, !countries.contains(o.resolvedCountry.name) { return false }
        if !districts.isEmpty {
            guard let d = o.displayDistrict, districts.contains(d) else { return false }
        }
        if !price.contains(o.extras.pricePln ?? o.price) { return false }
        if !area.contains(o.area) { return false }
        if let minRooms, Int(o.rooms ?? 0) < minRooms { return false }
        if !floors.isEmpty, !floors.allSatisfy({ $0.matches(o.extras) }) { return false }
        if let minYearBuilt {
            guard let y = o.extras.yearBuilt, y >= minYearBuilt else { return false }
        }
        if !amenities.allSatisfy({ $0.matches(o.extras) }) { return false }
        return true
    }
}

enum CarTransmissionFilter: String, CaseIterable, Identifiable, Hashable {
    case automatic, manual
    var id: String { rawValue }
    var title: String { self == .automatic ? "Automatyczna" : "Manualna" }
    func matches(_ car: CarListing) -> Bool {
        let t = car.transmission.lowercased()
        let isAuto = t.contains("automat") || t.contains("auto") || t.contains("dsg") || t.contains("cvt")
        return self == .automatic ? isAuto : !isAuto && !t.isEmpty
    }
}

enum CarSort: String, CaseIterable, Identifiable, Hashable {
    case newest, cheapest, priciest, youngest, lowestMileage, nearest
    var id: String { rawValue }
    var title: String {
        switch self {
        case .newest: return "Najnowsze ogłoszenia"
        case .cheapest: return "Najtańsze"
        case .priciest: return "Najdroższe"
        case .youngest: return "Najnowszy rocznik"
        case .lowestMileage: return "Najmniejszy przebieg"
        case .nearest: return "Najbliżej mnie"
        }
    }
    var icon: String {
        switch self {
        case .newest: return "clock"
        case .cheapest: return "arrow.down"
        case .priciest: return "arrow.up"
        case .youngest: return "calendar"
        case .lowestMileage: return "speedometer"
        case .nearest: return "location"
        }
    }
    func sorted(_ list: [CarListing]) -> [CarListing] {
        switch self {
        case .newest, .nearest: return list
        case .cheapest: return list.sorted { $0.pricePln < $1.pricePln }
        case .priciest: return list.sorted { $0.pricePln > $1.pricePln }
        case .youngest: return list.sorted { $0.year > $1.year }
        case .lowestMileage: return list.sorted { $0.mileageKm < $1.mileageKm }
        }
    }
}

struct CarCriteria: Hashable {
    var countries: Set<String> = []
    var models: Set<String> = []
    var price = FilterRange()
    var year = FilterRange()
    var maxMileage: Int?
    var transmissions: Set<CarTransmissionFilter> = []
    var bodyTypes: Set<String> = []
    var sort: CarSort = .newest

    var activeCount: Int {
        var n = 0
        if !countries.isEmpty { n += 1 }
        if !models.isEmpty { n += 1 }
        if price.isActive { n += 1 }
        if year.isActive { n += 1 }
        if maxMileage != nil { n += 1 }
        n += transmissions.count
        if !bodyTypes.isEmpty { n += 1 }
        return n
    }

    var isActive: Bool { activeCount > 0 || sort != .newest }

    var summaryParts: [String] {
        var p: [String] = []
        if !models.isEmpty { p.append(models.sorted().joined(separator: ", ")) }
        if price.isActive { p.append(FilterFormat.range(price, unit: "zł", money: true)) }
        if year.isActive { p.append(FilterFormat.yearRange(year)) }
        if let maxMileage { p.append("do \(FilterFormat.grouped(maxMileage)) km") }
        p.append(contentsOf: transmissions.map(\.title).sorted())
        if !bodyTypes.isEmpty { p.append(bodyTypes.sorted().joined(separator: ", ")) }
        if sort != .newest { p.append(sort.title) }
        return p
    }

    func apply(to list: [CarListing]) -> [CarListing] {
        guard activeCount > 0 else { return list }
        return list.filter(matches)
    }

    func matches(_ car: CarListing) -> Bool {
        if !countries.isEmpty, !countries.contains(car.resolvedCountry.name) { return false }
        if !models.isEmpty, !models.contains(car.model.trimmingCharacters(in: .whitespacesAndNewlines)) { return false }
        if !price.contains(car.pricePln) { return false }
        if !year.contains(car.year > 0 ? Double(car.year) : nil) { return false }
        if let maxMileage, car.mileageKm > maxMileage { return false }
        if !transmissions.isEmpty, !transmissions.contains(where: { $0.matches(car) }) { return false }
        if !bodyTypes.isEmpty, !bodyTypes.contains(car.bodyType.trimmingCharacters(in: .whitespacesAndNewlines)) { return false }
        return true
    }
}

enum FilterFormat {
    static func grouped(_ value: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = " "
        return f.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    /// 450 000 → "450 tys.", 1 250 000 → "1,25 mln"
    static func money(_ v: Double) -> String {
        if v >= 1_000_000 {
            let m = v / 1_000_000
            let text = m == m.rounded() ? String(format: "%.0f", m) : String(format: "%.2f", m)
                .replacingOccurrences(of: "0$", with: "", options: .regularExpression)
            return text.replacingOccurrences(of: ".", with: ",") + " mln"
        }
        if v >= 10_000 { return "\(Int(v / 1000)) tys." }
        return grouped(Int(v))
    }

    static func value(_ v: Double, money isMoney: Bool) -> String {
        isMoney ? money(v) : grouped(Int(v))
    }

    static func range(_ r: FilterRange, unit: String, money isMoney: Bool) -> String {
        switch (r.min, r.max) {
        case let (lo?, hi?): return "\(value(lo, money: isMoney))–\(value(hi, money: isMoney)) \(unit)"
        case let (lo?, nil): return "od \(value(lo, money: isMoney)) \(unit)"
        case let (nil, hi?): return "do \(value(hi, money: isMoney)) \(unit)"
        default: return "Dowolnie"
        }
    }

    static func yearRange(_ r: FilterRange) -> String {
        switch (r.min, r.max) {
        case let (lo?, hi?): return "\(Int(lo))–\(Int(hi))"
        case let (lo?, nil): return "od \(Int(lo))"
        case let (nil, hi?): return "do \(Int(hi))"
        default: return "Dowolny"
        }
    }
}

// MARK: - "Może Ci się spodobać" — similar listings (2026-10)
//
// Local, instant and for everyone (no login): built from the catalog already on the device.
// EstateOS Intelligence (`/api/mobile/v1/discovery/feed`) needs a signed-in user, so it can be
// added later as an extra "Dla Ciebie" row for logged-in viewers.

extension AppModel {
    func similarSections(for offer: EstateOffer) -> [ShowroomSection] {
        typealias C = ShowroomCategory
        let isRent = (offer.transactionType ?? "").uppercased().contains("RENT")
        let kind = HomePropertyKind.allCases.first { matchesHomePropertyType(offer, kind: $0) }
        let price = offer.extras.pricePln ?? offer.price
        let city = (offer.city ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let district = offer.displayDistrict

        let pool = offers.filter { other in
            guard other.id != offer.id else { return false }
            let otherRent = (other.transactionType ?? "").uppercased().contains("RENT")
            guard otherRent == isRent else { return false }
            if let kind, !matchesHomePropertyType(other, kind: kind) { return false }
            return true
        }
        func priceGap(_ o: EstateOffer) -> Double {
            guard let price, let p = o.extras.pricePln ?? o.price else { return .greatestFiniteMagnitude }
            return abs(p - price)
        }

        var used = Set<Int>()
        var result: [ShowroomSection] = []
        func add(_ title: String, _ list: [EstateOffer], icon: String, tint: Color, caption: String) {
            let fresh = list.filter { !used.contains($0.id) }.prefix(20)
            guard !fresh.isEmpty else { return }
            fresh.forEach { used.insert($0.id) }
            result.append(ShowroomSection(
                id: "similar-\(title)", title: title,
                items: fresh.map(ShowroomItem.init(offer:)),
                icon: icon, tint: tint, caption: caption
            ))
        }

        if !city.isEmpty {
            let nearby = pool
                .filter { ($0.city ?? "").caseInsensitiveCompare(city) == .orderedSame }
                .sorted { a, b in
                    let da = district != nil && a.displayDistrict == district
                    let db = district != nil && b.displayDistrict == district
                    if da != db { return da }
                    return priceGap(a) < priceGap(b)
                }
            add("W tej samej okolicy", nearby, icon: "mappin.and.ellipse", tint: C.place,
                caption: [district, city].compactMap { $0 }.joined(separator: ", "))
        }

        if let price, price > 0 {
            let similarPrice = pool
                .filter { priceGap($0) <= price * 0.2 }
                .sorted { priceGap($0) < priceGap($1) }
            add("W podobnej cenie", similarPrice, icon: "tag.fill", tint: C.picked,
                caption: "± 20% od \(FilterFormat.money(price)) zł")
        }

        if let area = offer.area, area > 0 {
            let rooms = offer.rooms.map { Int($0) }
            let layout = pool
                .filter { o in
                    guard let a = o.area, abs(a - area) <= area * 0.2 else { return false }
                    if let rooms { return Int(o.rooms ?? 0) == rooms }
                    return true
                }
                .sorted { abs(($0.area ?? 0) - area) < abs(($1.area ?? 0) - area) }
            let roomsText = rooms.map { "\($0) pok. · " } ?? ""
            add("Podobny metraż i układ", layout, icon: "square.dashed", tint: C.fresh,
                caption: "\(roomsText)ok. \(Int(area)) m²")
        }

        if result.count < 2 {
            add("Nowe w ostatnich 24 h", showroomHomeNewest.filter { $0.id != offer.id },
                icon: "clock.badge.checkmark", tint: C.fresh, caption: "Dodane w ciągu doby")
        }
        return result
    }

    func similarSections(for car: CarListing) -> [ShowroomSection] {
        typealias C = ShowroomCategory
        let pool = cars.filter { $0.id != car.id }
        let make = car.make.trimmingCharacters(in: .whitespacesAndNewlines)
        let model = car.model.trimmingCharacters(in: .whitespacesAndNewlines)
        func gap(_ c: CarListing) -> Double { abs(c.pricePln - car.pricePln) }

        var used = Set<Int>()
        var result: [ShowroomSection] = []
        func add(_ title: String, _ list: [CarListing], icon: String, tint: Color, caption: String) {
            let fresh = list.filter { !used.contains($0.id) }.prefix(20)
            guard !fresh.isEmpty else { return }
            fresh.forEach { used.insert($0.id) }
            result.append(ShowroomSection(
                id: "similar-\(title)", title: title,
                items: fresh.map(ShowroomItem.init(car:)),
                icon: icon, tint: tint, caption: caption
            ))
        }

        let sameMake = pool.filter { $0.make.caseInsensitiveCompare(make) == .orderedSame }
        if !model.isEmpty {
            add("Ten sam model", sameMake
                    .filter { $0.model.caseInsensitiveCompare(model) == .orderedSame }
                    .sorted { abs($0.year - car.year) < abs($1.year - car.year) },
                icon: "car.fill", tint: C.place, caption: "\(make) \(model)")
        }
        if !make.isEmpty {
            add("Więcej aut marki \(make)", sameMake.sorted { gap($0) < gap($1) },
                icon: "star.fill", tint: C.picked, caption: "Inne modele tej marki")
        }
        if car.pricePln > 0 {
            add("W podobnej cenie", pool
                    .filter { gap($0) <= car.pricePln * 0.2 && (car.year == 0 || abs($0.year - car.year) <= 4) }
                    .sorted { gap($0) < gap($1) },
                icon: "tag.fill", tint: C.deal, caption: "± 20% od \(FilterFormat.money(car.pricePln)) zł")
        }
        if result.count < 2 {
            add("Nowe auta · 24 h", showroomCarFresh.filter { $0.id != car.id },
                icon: "clock.badge.checkmark", tint: C.fresh, caption: "Dodane w ciągu doby")
        }
        return result
    }

    /// Loads the full description of an offer opened from "Może Ci się spodobać".
    func loadFullOfferIfNeeded(id: Int) async {
        guard let current = offers.first(where: { $0.id == id }),
              OfferPresentation.plainDescription(from: current.description) == nil else { return }
        guard let full = try? await api.offerDetail(id: id, fallbackOffers: offers) else { return }
        if let idx = offers.firstIndex(where: { $0.id == id }) { offers[idx] = full }
    }

    func recordView(of offer: EstateOffer) {
        Task { await api.recordOfferView(id: offer.id) }
    }

    func recordView(of car: CarListing) {
        Task { await api.recordCarView(id: car.id) }
    }
}

import Foundation
import Combine
#if canImport(TVServices)
import TVServices
#endif

@MainActor
final class AppModel: ObservableObject {
    @Published var session: EstateSession?
    @Published var isBootstrapping = true
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
    @Published var selectedHomePropertyTypes: Set<HomePropertyKind> = []
    @Published var favoriteCarIds: Set<Int> = TvPreferences.favoriteCarIds
    let location = TvLocationService.shared

    let api = EstateAPIClient()
    private var tvPairPollTask: Task<Void, Never>?
    private var locationBag = Set<AnyCancellable>()
    private var pendingDeepLinkOfferId: Int?
    private var pendingDeepLinkCarId: Int?

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
        async let offersTask: Void = { try? await refreshOffers() }()
        async let carsTask: Void = { try? await refreshCars() }()
        async let favoritesTask: Void = { await refreshFavoritesIfNeeded() }()
        _ = await (offersTask, carsTask, favoritesTask)
#if canImport(TVServices)
        TVTopShelfContentProvider.topShelfContentDidChange()
#endif
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
        // Ask tvOS to reload Top Shelf; user still must focus the app icon on the Home screen.
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
        return count
    }

    var carSecondaryFilterCount: Int {
        selectedCarAttributes.count + selectedCarMakes.count
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
    }

    func clearCarFilters() {
        carNearest = false
        selectedCarAttributes = []
        selectedCarCities = []
        selectedCarMakes = []
        carCitiesPickerExpanded = false
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
        if homeNearest {
            return sortOffersByDistance(base)
        }
        return base
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
    }

    var isHomeFilteringActive: Bool {
        homeNearest
            || homePremium
            || homeDiscounted
            || !selectedHomeTransactions.isEmpty
            || !selectedHomeCities.isEmpty
            || !selectedHomePropertyTypes.isEmpty
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
        if carNearest {
            return sortCarsByDistance(base)
        }
        return base
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

    func warmPrefetchCatalogImages() {
        var urls: [URL] = []
        for offer in offers.prefix(6) {
            if let u = EOSOfferMedia.primaryImageURL(for: offer) { urls.append(u) }
        }
        for car in cars.prefix(6) {
            if let u = EOSOfferMedia.imageURL(from: car.imageUrl) { urls.append(u) }
        }
        EOSImageCache.prefetch(urls: Array(urls.prefix(12)))
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
        if let carId = TvDeepLink.carId(from: url) {
            handleCarDeepLink(carId: carId, immersive: TvDeepLink.opensImmersive(from: url))
            return
        }
        guard let offerId = TvDeepLink.offerId(from: url) else { return }
        let immersive = TvDeepLink.opensImmersive(from: url)

        func resolve() {
            if immersive {
                let pool = offersLast24Hours
                if let index = pool.firstIndex(where: { $0.id == offerId }) {
                    pendingDeepLinkOfferId = nil
                    openImmersiveBrowse(at: index, from: pool)
                } else if let offer = offers.first(where: { $0.id == offerId }) {
                    pendingDeepLinkOfferId = nil
                    openImmersiveBrowse(at: 0, from: [offer])
                }
            } else if let offer = offers.first(where: { $0.id == offerId }) {
                pendingDeepLinkOfferId = nil
                openDetail(offer)
            }
        }

        if offers.isEmpty {
            pendingDeepLinkOfferId = offerId
            pendingDeepLinkImmersive = immersive
            Task {
                try? await refreshOffers()
                consumePendingDeepLink()
            }
        } else {
            resolve()
        }
    }

    private func handleCarDeepLink(carId: Int, immersive: Bool) {
        func resolve() {
            if immersive {
                let pool = carsLast24Hours.isEmpty ? cars : carsLast24Hours
                if let index = pool.firstIndex(where: { $0.id == carId }) {
                    pendingDeepLinkCarId = nil
                    openImmersiveCarBrowse(at: index, from: pool)
                } else if let car = cars.first(where: { $0.id == carId }) {
                    pendingDeepLinkCarId = nil
                    openImmersiveCarBrowse(at: 0, from: [car])
                }
            } else if let car = cars.first(where: { $0.id == carId }) {
                pendingDeepLinkCarId = nil
                openCarDetail(car)
            }
        }

        if cars.isEmpty {
            pendingDeepLinkCarId = carId
            pendingDeepLinkCarImmersive = immersive
            Task {
                try? await refreshCars()
                consumePendingDeepLink()
            }
        } else {
            resolve()
        }
    }

    private var pendingDeepLinkImmersive = false
    private var pendingDeepLinkCarImmersive = false

    private func consumePendingDeepLink() {
        if let carId = pendingDeepLinkCarId {
            let immersive = pendingDeepLinkCarImmersive
            pendingDeepLinkCarId = nil
            pendingDeepLinkCarImmersive = false
            if immersive {
                let pool = carsLast24Hours.isEmpty ? cars : carsLast24Hours
                if let index = pool.firstIndex(where: { $0.id == carId }) {
                    openImmersiveCarBrowse(at: index, from: pool)
                    return
                }
                if let car = cars.first(where: { $0.id == carId }) {
                    openImmersiveCarBrowse(at: 0, from: [car])
                    return
                }
            } else if let car = cars.first(where: { $0.id == carId }) {
                openCarDetail(car)
                return
            }
        }

        guard let offerId = pendingDeepLinkOfferId else { return }
        let immersive = pendingDeepLinkImmersive
        pendingDeepLinkOfferId = nil
        pendingDeepLinkImmersive = false

        if immersive {
            let pool = offersLast24Hours
            if let index = pool.firstIndex(where: { $0.id == offerId }) {
                openImmersiveBrowse(at: index, from: pool)
                return
            }
        }
        if let offer = offers.first(where: { $0.id == offerId }) {
            if immersive {
                openImmersiveBrowse(at: 0, from: [offer])
            } else {
                openDetail(offer)
            }
        }
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
    case flat, house, plot
    var id: String { rawValue }
    var title: String {
        switch self {
        case .flat: return "Mieszkanie"
        case .house: return "Dom"
        case .plot: return "Działka"
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

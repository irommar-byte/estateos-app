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
    @Published var pairingStatusMessage: String?
    @Published var favoriteOfferIds: Set<Int> = []
    @Published var favoriteOffers: [EstateOffer] = []
    @Published var isLoadingFavorites = false
    @Published var catalogBrand: CatalogBrand = .home
    @Published var cars: [CarListing] = []
    @Published var selectedCar: CarListing?
    @Published var isLoadingCars = false
    @Published var carSearchQuery = ""
    @Published var homeFilterChip: HomeFilterChip = .all
    @Published var carFilterChip: CarFilterChip = .all
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
        defer { isBootstrapping = false }
        bindLocationRefresh()
        try? await refreshOffers()
        try? await refreshCars()
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
            globalError = error.localizedDescription
        }
    }

    func setTopShelfStyle(_ style: TopShelfPresentationStyle) {
        topShelfStyle = style
        TvPreferences.topShelfStyle = style
#if canImport(TVServices)
        TVTopShelfContentProvider.topShelfContentDidChange()
#endif
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
            globalError = error.localizedDescription
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
        } catch {
            globalError = error.localizedDescription
            throw error
        }
    }

    var filteredOffers: [EstateOffer] {
        api.searchOffers(query: searchQuery, source: offers)
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

    func selectCarFilter(_ chip: CarFilterChip) {
        carFilterChip = chip
        if chip == .nearest {
            location.requestIfNeeded()
        }
    }

    func selectHomeFilter(_ chip: HomeFilterChip) {
        homeFilterChip = chip
        if chip == .nearest {
            location.requestIfNeeded()
        }
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
        } catch {
            globalError = error.localizedDescription
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
        switch homeFilterChip {
        case .all, .nearest:
            break
        case .sale:
            base = base.filter {
                let t = ($0.transactionType ?? "").uppercased()
                return t.contains("SELL") || t.contains("SALE") || t.isEmpty
            }
        case .rent:
            base = base.filter { ($0.transactionType ?? "").uppercased().contains("RENT") }
        case .warsaw:
            base = base.filter { ($0.city ?? "").localizedCaseInsensitiveContains("warsz") }
        case .luxury:
            base = base.filter { ($0.price ?? 0) >= 1_500_000 }
        }
        if !selectedHomePropertyTypes.isEmpty {
            base = base.filter { offer in
                selectedHomePropertyTypes.contains { matchesHomePropertyType(offer, kind: $0) }
            }
        }
        if homeFilterChip == .nearest {
            return sortOffersByDistance(base)
        }
        return base
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
        (carFilterChip != .all && carFilterChip != .nearest) || !selectedCarMakes.isEmpty || carFilterChip == .nearest
    }

    var isHomeFilteringActive: Bool {
        (homeFilterChip != .all && homeFilterChip != .nearest) || !selectedHomePropertyTypes.isEmpty || homeFilterChip == .nearest
    }

    var filteredCars: [CarListing] {
        var base = api.searchCars(query: carSearchQuery, source: cars)
        if !selectedCarMakes.isEmpty {
            base = base.filter { car in
                let make = car.make.trimmingCharacters(in: .whitespacesAndNewlines)
                return selectedCarMakes.contains(where: { $0.caseInsensitiveCompare(make) == .orderedSame })
            }
        }
        switch carFilterChip {
        case .all, .nearest:
            break
        case .featured:
            base = base.filter(\.featured)
        case .petrol:
            base = base.filter { $0.fuelType.localizedCaseInsensitiveContains("benz") }
        case .diesel:
            base = base.filter {
                $0.fuelType.localizedCaseInsensitiveContains("diesel")
                    || $0.fuelType.localizedCaseInsensitiveContains("olej")
            }
        case .electric:
            base = base.filter {
                $0.fuelType.localizedCaseInsensitiveContains("elektr")
                    || $0.fuelType.localizedCaseInsensitiveContains("ev")
            }
        case .hybrid:
            base = base.filter { $0.fuelType.localizedCaseInsensitiveContains("hybr") }
        case .automatic:
            base = base.filter { $0.transmission.localizedCaseInsensitiveContains("automat") }
        }
        if carFilterChip == .nearest {
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
            globalError = error.localizedDescription
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


enum HomeFilterChip: String, CaseIterable, Identifiable {
    case all, nearest, sale, rent, warsaw, luxury
    var id: String { rawValue }
    var title: String {
        switch self {
        case .all: return "Wszystkie"
        case .nearest: return "Najbliżej"
        case .sale: return "Sprzedaż"
        case .rent: return "Wynajem"
        case .warsaw: return "Warszawa"
        case .luxury: return "Premium"
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

enum CarFilterChip: String, CaseIterable, Identifiable {
    case all, nearest, featured, petrol, diesel, electric, hybrid, automatic
    var id: String { rawValue }
    var title: String {
        switch self {
        case .all: return "Wszystkie"
        case .nearest: return "Najbliżej"
        case .featured: return "Wyróżnione"
        case .petrol: return "Benzyna"
        case .diesel: return "Diesel"
        case .electric: return "Elektryczne"
        case .hybrid: return "Hybryda"
        case .automatic: return "Automat"
        }
    }
}

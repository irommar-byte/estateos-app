import Foundation

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

    let api = EstateAPIClient()
    private var tvPairPollTask: Task<Void, Never>?
    private var pendingDeepLinkOfferId: Int?

    func bootstrap() async {
        defer { isBootstrapping = false }
        try? await refreshOffers()
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
            await refreshFavorites()
            closeLoginSheet()
        } catch {
            globalError = error.localizedDescription
        }
    }

    func setTopShelfStyle(_ style: TopShelfPresentationStyle) {
        topShelfStyle = style
        TvPreferences.topShelfStyle = style
    }

    func logout() {
        SessionStore.clear()
        session = nil
        selectedOffer = nil
        immersiveBrowse = nil
        favoriteOfferIds = []
        favoriteOffers = []
        api.setToken(nil)
        Task { try? await refreshOffers() }
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

    func openDetail(_ offer: EstateOffer) {
        selectedOffer = offer
    }

    func closeDetail() {
        selectedOffer = nil
    }

    func openImmersiveBrowse(at index: Int, from source: [EstateOffer]? = nil) {
        let pool = source ?? offersLast24Hours
        guard !pool.isEmpty else { return }
        let clamped = min(max(0, index), pool.count - 1)
        immersiveBrowse = ImmersiveBrowseContext(offers: pool, startIndex: clamped)
    }

    func closeImmersiveBrowse() {
        immersiveBrowse = nil
    }

    func handleDeepLink(_ url: URL) {
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

    private var pendingDeepLinkImmersive = false

    private func consumePendingDeepLink() {
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
    let id = UUID()
    let offers: [EstateOffer]
    let startIndex: Int
}

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

    let api = EstateAPIClient()
    private var tvPairPollTask: Task<Void, Never>?

    func bootstrap() async {
        defer { isBootstrapping = false }
        try? await refreshOffers()
        if let saved = SessionStore.load() {
            api.setToken(saved.token)
            session = saved
            do {
                _ = try await api.me()
            } catch {
                logout()
            }
        }
    }

    func login(login: String, password: String) async {
        do {
            let session = try await api.login(login: login, password: password)
            self.session = session
            try await refreshOffers()
        } catch {
            globalError = error.localizedDescription
        }
    }

    func logout() {
        SessionStore.clear()
        session = nil
        selectedOffer = nil
        api.setToken(nil)
        Task { try? await refreshOffers() }
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

    func openDetail(_ offer: EstateOffer) {
        selectedOffer = offer
    }

    func closeDetail() {
        selectedOffer = nil
    }

    func openLoginSheet() {
        isLoginSheetPresented = true
        Task {
            await prepareTvPairCodes()
            startTvPairPolling()
        }
    }

    func closeLoginSheet() {
        isLoginSheetPresented = false
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
                self.isLoginSheetPresented = false
                try? await self.refreshOffers()
                tvPairPollTask?.cancel()
                tvPairPollTask = nil
            }
        } catch {
            // Polling should be resilient; ignore transient status/network errors.
        }
    }
}

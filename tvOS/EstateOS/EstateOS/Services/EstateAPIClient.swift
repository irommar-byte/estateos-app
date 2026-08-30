import Foundation

@MainActor
final class EstateAPIClient {
    private var token: String?

    func setToken(_ token: String?) {
        self.token = token
    }

    func login(login: String, password: String) async throws -> EstateSession {
        let normalizedLogin = login.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let response: EstateLoginEnvelope = try await request(
            "POST",
            path: "/api/mobile/v1/auth/login",
            body: [
                "email": normalizedLogin,
                "login": normalizedLogin,
                "identifier": normalizedLogin,
                "password": password,
            ],
            authorized: false
        )

        guard response.success != false,
              let token = response.token,
              let user = response.user else {
            throw APIError.server(response.error ?? response.message ?? "Nie udało się zalogować.")
        }

        let session = EstateSession(token: token, user: user)
        try SessionStore.save(session)
        self.token = token
        return session
    }

    func me() async throws -> EstateUser {
        struct MeEnvelope: Codable {
            let success: Bool?
            let user: EstateUser?
            let message: String?
        }
        let response: MeEnvelope = try await request("GET", path: "/api/mobile/v1/user/me")
        guard let user = response.user else {
            throw APIError.server(response.message ?? "Nie udało się pobrać profilu.")
        }
        return user
    }

    func searchSpotlight(query: String) async throws -> SpotlightSearchResponse {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return SpotlightSearchResponse(success: true, results: [], sections: [], tookMs: 0)
        }
        let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
        return try await request(
            "GET",
            path: "/api/mobile/v1/spotlight/search?q=\(encoded)",
            authorized: token != nil
        )
    }

    func fetchOffers() async throws -> [EstateOffer] {
        // Prefer full payloads — catalog=1 strips body copy to VERIFY tokens only.
        let endpoints = [
            "/api/mobile/v1/offers",
            "/api/offers",
            "/api/mobile/v1/offers?catalog=1",
        ]
        for path in endpoints {
            do {
                if let list: [EstateOffer] = try? await request("GET", path: path, authorized: false) {
                    return list
                }
                let env: EstateOfferListEnvelope = try await request("GET", path: path, authorized: false)
                if !env.resolvedOffers.isEmpty {
                    return env.resolvedOffers
                }
            } catch {
                continue
            }
        }
        throw APIError.server("Nie udało się pobrać ofert.")
    }

    func searchOffers(query: String, source: [EstateOffer]) -> [EstateOffer] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return source }
        return source.filter { offer in
            [
                offer.title,
                offer.description ?? "",
                offer.city ?? "",
                offer.district ?? "",
                offer.propertyType ?? "",
                offer.transactionType ?? "",
            ]
            .joined(separator: " ")
            .lowercased()
            .contains(q)
        }
    }

    func offerDetail(id: Int, fallbackOffers: [EstateOffer]) async throws -> EstateOffer {
        let detailPaths = [
            "/api/mobile/v1/offers/\(id)",
            "/api/offers/\(id)",
        ]
        for path in detailPaths {
            if let env: EstateOfferDetailEnvelope = try? await request("GET", path: path, authorized: false),
               let exact = env.resolvedOffer,
               OfferPresentation.plainDescription(from: exact.description) != nil {
                return exact
            }
            if let exact: EstateOffer = try? await request("GET", path: path, authorized: false),
               OfferPresentation.plainDescription(from: exact.description) != nil {
                return exact
            }
        }

        if let exact = fallbackOffers.first(where: { $0.id == id }),
           OfferPresentation.plainDescription(from: exact.description) != nil {
            return exact
        }

        let all = try await fetchOffers()
        if let exact = all.first(where: { $0.id == id }) {
            return exact
        }
        if let exact = fallbackOffers.first(where: { $0.id == id }) {
            return exact
        }
        throw APIError.server("Nie znaleziono oferty.")
    }


    func recordOfferView(id: Int) async {
        struct ViewEnvelope: Decodable { let success: Bool?; let viewsCount: Int? }
        do {
            let _: ViewEnvelope = try await request(
                "POST",
                path: "/api/offers/\(id)/view",
                body: ["source": "tvos"],
                authorized: false
            )
        } catch {}
    }

    func recordCarView(id: Int) async {
        struct ViewEnvelope: Decodable { let success: Bool?; let viewsCount: Int?; let favoritesCount: Int? }
        do {
            let _: ViewEnvelope = try await request(
                "POST",
                path: "/api/cars/\(id)/view",
                body: [:],
                authorized: false
            )
        } catch {}
    }

    func bumpCarFavoriteCount(id: Int, favorited: Bool) async {
        struct FavEnvelope: Decodable { let success: Bool?; let favoritesCount: Int? }
        do {
            let _: FavEnvelope = try await request(
                "POST",
                path: "/api/cars/\(id)/favorite-count",
                body: ["delta": favorited ? 1 : -1],
                authorized: false
            )
        } catch {}
    }



    func startTvPairing(mode: String, pairCode: String? = nil) async throws -> TvPairStartResponse {
        var body: [String: Any] = ["mode": mode]
        if let pairCode, !pairCode.isEmpty {
            body["pairCode"] = pairCode
        }
        return try await request(
            "POST",
            path: "/api/mobile/v1/tv/pair/start",
            body: body,
            authorized: false
        )
    }

    func pollTvPairing(pairCode: String) async throws -> TvPairStatusResponse {
        let encoded = pairCode.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? pairCode
        return try await request(
            "GET",
            path: "/api/mobile/v1/tv/pair/status?pairCode=\(encoded)",
            authorized: false
        )
    }

    func fetchCars() async throws -> [CarListing] {
        if let list: [CarListing] = try? await request("GET", path: "/api/cars", authorized: false) {
            return list
        }
        struct CarsEnvelope: Decodable {
            let cars: [CarListing]?
            let items: [CarListing]?
            let data: [CarListing]?
            var resolved: [CarListing] { cars ?? items ?? data ?? [] }
        }
        let env: CarsEnvelope = try await request("GET", path: "/api/cars", authorized: false)
        if !env.resolved.isEmpty { return env.resolved }
        throw APIError.server("Nie udało się pobrać ogłoszeń samochodowych.")
    }

    func carDetail(id: Int, fallback: [CarListing]) async throws -> CarListing {
        if let exact: CarListing = try? await request("GET", path: "/api/cars/\(id)", authorized: false) {
            return exact
        }
        if let exact = fallback.first(where: { $0.id == id }) {
            return exact
        }
        let all = try await fetchCars()
        if let exact = all.first(where: { $0.id == id }) {
            return exact
        }
        throw APIError.server("Nie znaleziono ogłoszenia auta.")
    }

    func searchCars(query: String, source: [CarListing]) -> [CarListing] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return source }
        return source.filter { car in
            [
                car.title, car.make, car.model, car.city, car.fuelType,
                car.transmission, car.bodyType, car.description ?? "",
                String(car.year),
            ]
            .joined(separator: " ")
            .lowercased()
            .contains(q)
        }
    }

    func fetchFavorites() async throws -> EstateFavoritesEnvelope {
        try await request("GET", path: "/api/favorites")
    }

    func setFavorite(offerId: Int, added: Bool) async throws {
        struct OkEnvelope: Decodable { let success: Bool? }
        let _: OkEnvelope = try await request(
            added ? "POST" : "DELETE",
            path: "/api/offers/\(offerId)/favorite"
        )
    }

    private func request<T: Decodable>(
        _ method: String,
        path: String,
        body: [String: Any]? = nil,
        authorized: Bool = true
    ) async throws -> T {
        let url = URL(string: AppConfig.apiBaseURL.absoluteString + path)!
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(AppConfig.userAgent, forHTTPHeaderField: "User-Agent")
        if authorized, let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.setValue(token, forHTTPHeaderField: "x-access-token")
        }
        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.decode
        }

        if let apiError = try? JSONDecoder().decode(APIErrorEnvelope.self, from: data),
           let message = apiError.resolvedMessage,
           !(200..<300).contains(http.statusCode) {
            throw APIError.server(message)
        }

        if http.statusCode == 401 {
            throw APIError.unauthorized
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server("Błąd serwera (\(http.statusCode)).")
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decode
        }
    }
}

struct EstateLoginEnvelope: Decodable {
    let success: Bool?
    let token: String?
    let user: EstateUser?
    let error: String?
    let message: String?
}

struct APIErrorEnvelope: Decodable {
    let success: Bool?
    let error: String?
    let message: String?

    var resolvedMessage: String? {
        if let error, !error.isEmpty { return error }
        if let message, !message.isEmpty { return message }
        return nil
    }
}

struct TvPairStartResponse: Decodable {
    let success: Bool
    let pairCode: String
    let mode: String?
    let expiresInSec: Int?
    let pollAfterMs: Int?
}

struct TvPairStatusResponse: Decodable {
    let success: Bool
    let status: String?
    let pairCode: String?
    let token: String?
    let user: EstateUser?
}

struct EstateFavoritesEnvelope: Decodable {
    let success: Bool?
    let offerIds: [Int]?
    let offers: [EstateOffer]?
}

enum APIError: LocalizedError {
    case unauthorized
    case decode
    case server(String)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Sesja wygasła. Zaloguj się ponownie."
        case .decode: return "Nie udało się odczytać odpowiedzi serwera."
        case .server(let msg): return msg
        }
    }
}

struct SpotlightSearchResponse: Decodable {
    let success: Bool?
    let results: [SpotlightResult]
    let sections: [SpotlightSection]
    let tookMs: Int?

    enum CodingKeys: String, CodingKey { case success, results, sections, tookMs }

    init(success: Bool?, results: [SpotlightResult], sections: [SpotlightSection], tookMs: Int?) {
        self.success = success
        self.results = results
        self.sections = sections
        self.tookMs = tookMs
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        success = try c.decodeIfPresent(Bool.self, forKey: .success)
        results = (try? c.decode([SpotlightResult].self, forKey: .results)) ?? []
        sections = (try? c.decode([SpotlightSection].self, forKey: .sections)) ?? []
        tookMs = try c.decodeIfPresent(Int.self, forKey: .tookMs)
    }
}

struct SpotlightSection: Decodable, Identifiable {
    var id: String { kind.rawValue + label }
    let kind: SpotlightResultKind
    let label: String
    let items: [SpotlightResult]
}

struct SpotlightResult: Decodable, Identifiable, Hashable {
    let id: String
    let kind: SpotlightResultKind
    let title: String
    let subtitle: String
    let detail: String?
    let imageUrl: String?
    let href: String
    let score: Double?

    var offerId: Int? {
        guard kind == .offer else { return nil }
        guard let match = href.range(of: #"/oferta/(\d+)"#, options: .regularExpression) else { return nil }
        let digits = href[match].split(separator: "/").last.flatMap { Int($0) }
        return digits
    }

    var absoluteURL: URL {
        if let url = URL(string: href), url.scheme != nil { return url }
        let path = href.hasPrefix("/") ? href : "/\(href)"
        return URL(string: "https://estateos.pl\(path)") ?? AppConfig.apiBaseURL
    }
}

enum SpotlightResultKind: String, Decodable, Hashable, CaseIterable {
    case offer, agent, agency

    var label: String {
        switch self {
        case .offer: return "Oferta"
        case .agency: return "Biuro"
        case .agent: return "Agent"
        }
    }

    var sectionLabel: String {
        switch self {
        case .offer: return "Oferty"
        case .agency: return "Biura"
        case .agent: return "Agenci"
        }
    }

    var iconName: String {
        switch self {
        case .offer: return "house.fill"
        case .agency: return "building.2.fill"
        case .agent: return "person.fill"
        }
    }
}

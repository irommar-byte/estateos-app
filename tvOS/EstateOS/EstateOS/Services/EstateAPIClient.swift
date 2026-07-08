import Foundation

@MainActor
final class EstateAPIClient {
    private var token: String?

    func setToken(_ token: String?) {
        self.token = token
    }

    func login(login: String, password: String) async throws -> EstateSession {
        let response: EstateLoginResponse = try await request(
            "POST",
            path: "/api/mobile/v1/auth/login",
            body: ["login": login, "password": password],
            authorized: false
        )
        let session = EstateSession(token: response.token, user: response.user)
        try SessionStore.save(session)
        token = response.token
        return session
    }

    func me() async throws -> EstateUser {
        struct MeEnvelope: Codable { let user: EstateUser }
        let response: MeEnvelope = try await request("GET", path: "/api/auth/me")
        return response.user
    }

    func fetchOffers() async throws -> [EstateOffer] {
        let endpoints = [
            "/api/mobile/v1/offers?catalog=1",
            "/api/mobile/v1/offers",
            "/api/offers",
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
        throw APIError.server("Could not fetch offers.")
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
        if let exact: EstateOffer = try? await request("GET", path: "/api/mobile/v1/offers/\(id)") {
            return exact
        }
        if let exact = fallbackOffers.first(where: { $0.id == id }) {
            return exact
        }
        let all = try await fetchOffers()
        if let exact = all.first(where: { $0.id == id }) {
            return exact
        }
        throw APIError.server("Offer not found.")
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
        }
        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.decode
        }
        if http.statusCode == 401 {
            throw APIError.unauthorized
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server("Server error (\(http.statusCode)).")
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decode
        }
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

enum APIError: LocalizedError {
    case unauthorized
    case decode
    case server(String)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Your session is no longer valid."
        case .decode: return "Could not parse server response."
        case .server(let msg): return msg
        }
    }
}

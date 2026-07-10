import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

struct GoogleDriveTokens: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresAt: Date
    let email: String
}

enum GoogleDriveAuthError: LocalizedError {
    case notConfigured
    case cancelled
    case noAuthCode
    case tokenExchange(String)
    case noSession

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Brak Google Client ID. Skonfiguruj OAuth w AppConfig.swift (Google Cloud Console → iOS client)."
        case .cancelled: return "Logowanie anulowane."
        case .noAuthCode: return "Brak kodu autoryzacji Google."
        case .tokenExchange(let msg): return msg
        case .noSession: return "Nie jesteś zalogowany do Google Drive."
        }
    }
}

@MainActor
final class GoogleDriveAuthService: NSObject, ObservableObject {
    static let shared = GoogleDriveAuthService()

    @Published private(set) var session: GoogleDriveTokens?

    private let keychainService = "pl.nostalgie.eosmusic.google"
    private let keychainAccount = "drive-session"
    private var authSession: ASWebAuthenticationSession?
    private var pendingVerifier: String?

    private override init() {
        super.init()
        session = loadSession()
    }

    var isSignedIn: Bool { session != nil }
    var email: String? { session?.email }

    var isConfigured: Bool {
        !AppConfig.googleOAuthClientID.isEmpty
    }

    func signIn() async throws {
        guard isConfigured else { throw GoogleDriveAuthError.notConfigured }

        let verifier = Self.randomVerifier()
        let challenge = Self.codeChallenge(for: verifier)
        pendingVerifier = verifier

        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: AppConfig.googleOAuthClientID),
            URLQueryItem(name: "redirect_uri", value: AppConfig.googleOAuthRedirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email https://www.googleapis.com/auth/drive.readonly"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "consent"),
        ]
        guard let authURL = components.url else { throw GoogleDriveAuthError.tokenExchange("Nieprawidłowy URL OAuth.") }

        let callbackURL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(url: authURL, callbackURLScheme: AppConfig.googleOAuthCallbackScheme) { url, error in
                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    continuation.resume(throwing: GoogleDriveAuthError.cancelled)
                    return
                }
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let url else {
                    continuation.resume(throwing: GoogleDriveAuthError.noAuthCode)
                    return
                }
                continuation.resume(returning: url)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.authSession = session
            session.start()
        }

        authSession = nil
        guard let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "code" })?
            .value else {
            throw GoogleDriveAuthError.noAuthCode
        }

        try await exchangeCode(code, verifier: verifier)
        pendingVerifier = nil
    }

    func signOut() {
        session = nil
        KeychainHelper.delete(service: keychainService, account: keychainAccount)
    }

    func accessToken() async throws -> String {
        guard var current = session else { throw GoogleDriveAuthError.noSession }
        if current.expiresAt.timeIntervalSinceNow > 120 {
            return current.accessToken
        }
        guard let refresh = current.refreshToken else { throw GoogleDriveAuthError.noSession }
        current = try await refreshTokens(refreshToken: refresh, email: current.email)
        session = current
        try saveSession(current)
        return current.accessToken
    }

    func handleOpenURL(_ url: URL) {
        // ASWebAuthenticationSession obsługuje callback automatycznie.
        _ = url
    }

    // MARK: - Private

    private func exchangeCode(_ code: String, verifier: String) async throws {
        var body: [String: String] = [
            "client_id": AppConfig.googleOAuthClientID,
            "code": code,
            "code_verifier": verifier,
            "grant_type": "authorization_code",
            "redirect_uri": AppConfig.googleOAuthRedirectURI,
        ]
        let tokens = try await tokenRequest(body: body)
        session = tokens
        try saveSession(tokens)
    }

    private func refreshTokens(refreshToken: String, email: String) async throws -> GoogleDriveTokens {
        let body: [String: String] = [
            "client_id": AppConfig.googleOAuthClientID,
            "refresh_token": refreshToken,
            "grant_type": "refresh_token",
        ]
        var refreshed = try await tokenRequest(body: body, fallbackEmail: email)
        if refreshed.refreshToken == nil {
            refreshed = GoogleDriveTokens(
                accessToken: refreshed.accessToken,
                refreshToken: refreshToken,
                expiresAt: refreshed.expiresAt,
                email: refreshed.email
            )
        }
        return refreshed
    }

    private func tokenRequest(body: [String: String], fallbackEmail: String? = nil) async throws -> GoogleDriveTokens {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = body.map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw GoogleDriveAuthError.tokenExchange("Brak odpowiedzi serwera Google.")
        }
        struct TokenResponse: Decodable {
            let access_token: String
            let refresh_token: String?
            let expires_in: Int?
            let error: String?
            let error_description: String?
        }
        let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
        if http.statusCode >= 400 {
            throw GoogleDriveAuthError.tokenExchange(decoded.error_description ?? decoded.error ?? "Błąd tokenu Google.")
        }

        var email = fallbackEmail ?? session?.email ?? ""
        if email.isEmpty, let idToken = body["id_token"] {
            email = Self.emailFromIDToken(idToken) ?? "Google Drive"
        }
        if email.isEmpty {
            email = try await fetchUserEmail(accessToken: decoded.access_token) ?? "Google Drive"
        }

        let expires = Date().addingTimeInterval(TimeInterval(decoded.expires_in ?? 3600))
        return GoogleDriveTokens(
            accessToken: decoded.access_token,
            refreshToken: decoded.refresh_token ?? session?.refreshToken,
            expiresAt: expires,
            email: email
        )
    }

    private func fetchUserEmail(accessToken: String) async throws -> String? {
        var request = URLRequest(url: URL(string: "https://www.googleapis.com/oauth2/v2/userinfo")!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode < 400 else { return nil }
        struct UserInfo: Decodable { let email: String? }
        return try JSONDecoder().decode(UserInfo.self, from: data).email
    }

    private func saveSession(_ tokens: GoogleDriveTokens) throws {
        let data = try JSONEncoder().encode(tokens)
        try KeychainHelper.save(data, service: keychainService, account: keychainAccount)
    }

    private func loadSession() -> GoogleDriveTokens? {
        guard let data = KeychainHelper.load(service: keychainService, account: keychainAccount) else { return nil }
        return try? JSONDecoder().decode(GoogleDriveTokens.self, from: data)
    }

    private static func randomVerifier() -> String {
        let chars = Array("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
        return String((0..<64).map { _ in chars.randomElement()! })
    }

    private static func codeChallenge(for verifier: String) -> String {
        let hash = SHA256.hash(data: Data(verifier.utf8))
        return Data(hash)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func emailFromIDToken(_ token: String) -> String? {
        let parts = token.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        var payload = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while payload.count % 4 != 0 { payload += "=" }
        guard let data = Data(base64Encoded: payload) else { return nil }
        struct Payload: Decodable { let email: String? }
        return (try? JSONDecoder().decode(Payload.self, from: data))?.email
    }
}

extension GoogleDriveAuthService: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first { $0.isKeyWindow }
        return window ?? ASPresentationAnchor()
    }
}

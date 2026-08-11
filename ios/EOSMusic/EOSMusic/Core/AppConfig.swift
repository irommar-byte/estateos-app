import Foundation

enum AppConfig {
    /// Nostalgie™ / EOS backend — ten sam co panel www i tvOS.
    static let apiBaseURL = URL(string: "https://lineage.mycloudnas.com/admin_pro/api/movies/proxy")!

    static let keychainService = "pl.nostalgie.eosmusic.auth"
    static let keychainAccount = "session"
    static let credentialsService = "pl.nostalgie.eosmusic.credentials"

    static let appDisplayName = "EOS™ Music"
    /// Miękki limit biblioteki na serwerze, gdy API nie zwraca statystyk dysku VPS.
    static let serverStorageQuotaBytes: Int64 = 100 * 1024 * 1024 * 1024
    static let appVersion = "1.0.0"
    static let userAgent = "EOSMusic-iOS/1.0"

    /// Wymagane w App Store Connect — polityka prywatności.
    static let privacyPolicyURL = URL(string: "https://lineage.mycloudnas.com/privacy")!
    static let supportURL = URL(string: "https://lineage.mycloudnas.com")!

    /// Google Cloud Console → Credentials → OAuth 2.0 Client ID (iOS).
    /// Uzupełnij `Resources/GoogleOAuth.plist` (klucz CLIENT_ID) lub Info.plist → GoogleOAuthClientID.
    static var googleOAuthClientID: String {
        if let url = Bundle.main.url(forResource: "GoogleOAuth", withExtension: "plist"),
           let data = try? Data(contentsOf: url),
           let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
           let id = plist["CLIENT_ID"] as? String {
            let trimmed = id.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty, !trimmed.contains("WKLEJ"), !trimmed.contains("YOUR") {
                return trimmed
            }
        }
        if let id = Bundle.main.object(forInfoDictionaryKey: "GoogleOAuthClientID") as? String {
            let trimmed = id.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty, !trimmed.contains("WKLEJ") { return trimmed }
        }
        return ""
    }
    static let googleOAuthRedirectURI = "pl.nostalgie.eosmusic:/oauth2redirect"
    static let googleOAuthCallbackScheme = "pl.nostalgie.eosmusic"
}

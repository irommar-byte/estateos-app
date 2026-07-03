import Foundation
import Security

enum KeychainHelper {
    static func save(_ data: Data, service: String, account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw APIError.server("Nie udało się zapisać sesji (Keychain \(status)).")
        }
    }

    static func load(service: String, account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return data
    }

    static func delete(service: String, account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

enum SessionStore {
    struct Session: Codable {
        let token: String
        let user: AuthUser
    }

    static func load() -> Session? {
        guard let data = KeychainHelper.load(service: AppConfig.keychainService, account: AppConfig.keychainAccount) else {
            return nil
        }
        return try? JSONDecoder().decode(Session.self, from: data)
    }

    static func save(_ session: Session) throws {
        let data = try JSONEncoder().encode(session)
        try KeychainHelper.save(data, service: AppConfig.keychainService, account: AppConfig.keychainAccount)
    }

    static func clear() {
        KeychainHelper.delete(service: AppConfig.keychainService, account: AppConfig.keychainAccount)
    }
}

enum CredentialsStore {
    private static let service = "\(AppConfig.keychainService).credentials"
    private static let account = "remembered"

    struct Remembered: Codable {
        let login: String
        let password: String
    }

    static func load() -> Remembered? {
        guard let data = KeychainHelper.load(service: service, account: account) else { return nil }
        return try? JSONDecoder().decode(Remembered.self, from: data)
    }

    static func save(login: String, password: String) throws {
        let remembered = Remembered(login: login, password: password)
        let data = try JSONEncoder().encode(remembered)
        try KeychainHelper.save(data, service: service, account: account)
    }

    static func clear() {
        KeychainHelper.delete(service: service, account: account)
    }
}

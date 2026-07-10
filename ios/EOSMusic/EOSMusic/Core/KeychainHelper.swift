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
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw APIError.server("Nie udało się zapisać danych (Keychain \(status)).")
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
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
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
    struct Remembered: Codable {
        let login: String
        let password: String
    }

    static func load() -> Remembered? {
        guard let data = KeychainHelper.load(service: AppConfig.credentialsService, account: "remembered") else {
            return nil
        }
        return try? JSONDecoder().decode(Remembered.self, from: data)
    }

    static func save(login: String, password: String) throws {
        let data = try JSONEncoder().encode(Remembered(login: login, password: password))
        try KeychainHelper.save(data, service: AppConfig.credentialsService, account: "remembered")
    }

    static func clear() {
        KeychainHelper.delete(service: AppConfig.credentialsService, account: "remembered")
    }
}

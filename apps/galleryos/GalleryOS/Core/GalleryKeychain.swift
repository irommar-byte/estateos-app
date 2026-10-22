import Foundation
import Security

enum GalleryKeychainError: Error {
    case status(OSStatus)
}

enum GalleryKeychain {
    static let service = "pl.galleryos.app"
    /// Shared by GalleryOS and GalleryOSTV. The entitlement uses the same suffix.
    static let accessGroup = "NW3YW69KL9.pl.galleryos.shared"

    /// Keeps a copy on this device and in iCloud Keychain.
    static func keep(_ value: String, account: String) {
        try? set(value, account: account)
        try? setShared(value, account: account)
    }

    static func set(_ value: String, account: String) throws {
        try set(Data(value.utf8), account: account)
    }

    static func set(_ data: Data, account: String) throws {
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
        guard status == errSecSuccess else { throw GalleryKeychainError.status(status) }
    }

    /// Stored in iCloud Keychain so a server password typed once follows the user to every device.
    static func setShared(_ value: String, account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
            kSecAttrSynchronizable as String: kSecAttrSynchronizableAny,
        ]
        SecItemDelete(query as CFDictionary)
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
            kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
            kSecValueData as String: Data(value.utf8),
        ]
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else { throw GalleryKeychainError.status(status) }
    }

    /// Adds a synced item only when none exists yet – for keys that must never be overwritten.
    static func addSharedIfMissing(_ value: Data, account: String) {
        guard data(account: account) == nil else { return }
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
            kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
            kSecValueData as String: value,
        ]
        SecItemAdd(add as CFDictionary, nil)
    }

    static func data(account: String) -> Data? {
        copy(account: account, group: accessGroup) ?? copy(account: account, group: nil)
    }

    private static func copy(account: String, group: String?) -> Data? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: kSecAttrSynchronizableAny,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        if let group {
            query[kSecAttrAccessGroup as String] = group
        }
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess else { return nil }
        return item as? Data
    }

    static func string(account: String) -> String? {
        data(account: account).flatMap { String(data: $0, encoding: .utf8) }
    }

    static func remove(account: String) {
        for group in [accessGroup, nil] as [String?] {
            var query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
                kSecAttrSynchronizable as String: kSecAttrSynchronizableAny,
            ]
            if let group {
                query[kSecAttrAccessGroup as String] = group
            }
            SecItemDelete(query as CFDictionary)
        }
    }

    static func deviceID() -> String {
        if let existing = string(account: "device-id"), !existing.isEmpty { return existing }
        let created = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
        try? set(created, account: "device-id")
        return created
    }
}

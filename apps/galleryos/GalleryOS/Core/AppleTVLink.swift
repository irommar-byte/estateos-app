import CryptoKit
import Foundation
import Security

/// Server description that is handed from the iPhone to Apple TV.
/// The password never travels in this struct; it is sent only inside `PairingPayload`.
struct AppleTVServer: Codable, Equatable {
    var id: String
    var title: String
    var kind: String
    var host: String
    var port: Int
    var username: String
    var directory: String
    var localHost: String
    var localPort: Int
    var localName: String
    var remoteHost: String

    init(
        id: String,
        title: String,
        kind: String,
        host: String,
        port: Int,
        username: String,
        directory: String,
        localHost: String,
        localPort: Int,
        localName: String,
        remoteHost: String
    ) {
        self.id = id
        self.title = title
        self.kind = kind
        self.host = host
        self.port = port
        self.username = username
        self.directory = directory
        self.localHost = localHost
        self.localPort = localPort
        self.localName = localName
        self.remoteHost = remoteHost
    }

    init(settings: DestinationSettings, id: String, title: String) {
        self.init(
            id: id,
            title: title,
            kind: settings.kind,
            host: settings.host,
            port: settings.port,
            username: settings.username,
            directory: settings.directory,
            localHost: settings.localHost,
            localPort: settings.localPort,
            localName: settings.localName,
            remoteHost: settings.remoteHost
        )
    }

    /// Kinds the Apple TV app can read from.
    var isSupportedOnTV: Bool {
        kind == DestinationKind.server || kind == DestinationKind.webdav
    }
}

struct PairingPayload: Codable, Equatable {
    var server: AppleTVServer
    var password: String
}

struct SealedPairing: Codable, Equatable {
    var ephemeral: String
    var box: String
}

enum PairingFailure: Error, Equatable {
    case badKey
    case badPayload
}

enum PairingCrypto {
    private static let salt = Data("galleryos.appletv.pairing.v1".utf8)

    static func normalize(code: String) -> String {
        code.uppercased().filter { $0.isLetter || $0.isNumber }
    }

    static func publicKeyText(_ key: P256.KeyAgreement.PrivateKey) -> String {
        key.publicKey.x963Representation.base64EncodedString()
    }

    private static func symmetricKey(_ secret: SharedSecret, code: String) -> SymmetricKey {
        secret.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: salt,
            sharedInfo: Data(normalize(code: code).utf8),
            outputByteCount: 32
        )
    }

    /// iPhone side: encrypts the server for the public key shown by the Apple TV.
    static func seal(_ payload: PairingPayload, devicePublicKey: String, code: String) throws -> SealedPairing {
        guard let raw = Data(base64Encoded: devicePublicKey),
              let recipient = try? P256.KeyAgreement.PublicKey(x963Representation: raw) else {
            throw PairingFailure.badKey
        }
        let ephemeral = P256.KeyAgreement.PrivateKey()
        let secret = try ephemeral.sharedSecretFromKeyAgreement(with: recipient)
        let key = symmetricKey(secret, code: code)
        let plain = try JSONEncoder().encode(payload)
        let sealed = try AES.GCM.seal(plain, using: key)
        guard let combined = sealed.combined else { throw PairingFailure.badPayload }
        return SealedPairing(
            ephemeral: ephemeral.publicKey.x963Representation.base64EncodedString(),
            box: combined.base64EncodedString()
        )
    }

    /// Apple TV side: decrypts what the iPhone sent.
    static func open(_ sealed: SealedPairing, with key: P256.KeyAgreement.PrivateKey, code: String) throws -> PairingPayload {
        guard let ephemeralRaw = Data(base64Encoded: sealed.ephemeral),
              let boxRaw = Data(base64Encoded: sealed.box),
              let ephemeral = try? P256.KeyAgreement.PublicKey(x963Representation: ephemeralRaw) else {
            throw PairingFailure.badKey
        }
        let secret = try key.sharedSecretFromKeyAgreement(with: ephemeral)
        let symmetric = symmetricKey(secret, code: code)
        let box = try AES.GCM.SealedBox(combined: boxRaw)
        let plain = try AES.GCM.open(box, using: symmetric)
        guard let payload = try? JSONDecoder().decode(PairingPayload.self, from: plain) else {
            throw PairingFailure.badPayload
        }
        return payload
    }
}

struct CloudHandoff: Codable, Equatable {
    var server: AppleTVServer
    var password: String
}

/// Same-Apple-ID path. The server and its password travel together in iCloud Key-Value Storage,
/// which both apps can read. The keychain copy stays too, but iOS and tvOS do not share a keychain
/// group, so the television cannot see a password that was saved only there.
enum CloudServerShare {
    static let profileKey = "galleryos.appletv.server.v1"
    static let handoffKey = "galleryos.appletv.handoff.v2"
    static let service = "pl.galleryos.app.appletv"
    static let enabledKey = "galleryos.appletv.icloud"

    static var isEnabled: Bool {
        get {
            if UserDefaults.standard.object(forKey: enabledKey) == nil { return true }
            return UserDefaults.standard.bool(forKey: enabledKey)
        }
        set { UserDefaults.standard.set(newValue, forKey: enabledKey) }
    }

    static func publish(_ server: AppleTVServer, password: String) {
        let handoff = CloudHandoff(server: server, password: password)
        guard let data = try? JSONEncoder().encode(handoff) else { return }
        storePassword(password, id: server.id)
        let store = NSUbiquitousKeyValueStore.default
        store.set(data, forKey: handoffKey)
        if let profile = try? JSONEncoder().encode(server) {
            store.set(profile, forKey: profileKey)
        }
        store.synchronize()
    }

    static func withdraw() {
        let store = NSUbiquitousKeyValueStore.default
        if let data = store.data(forKey: handoffKey),
           let handoff = try? JSONDecoder().decode(CloudHandoff.self, from: data) {
            removePassword(id: handoff.server.id)
        }
        store.removeObject(forKey: handoffKey)
        store.removeObject(forKey: profileKey)
        store.synchronize()
    }

    static func load() -> (server: AppleTVServer, password: String)? {
        let store = NSUbiquitousKeyValueStore.default
        store.synchronize()
        if let data = store.data(forKey: handoffKey),
           let handoff = try? JSONDecoder().decode(CloudHandoff.self, from: data),
           !handoff.password.isEmpty {
            return (handoff.server, handoff.password)
        }
        guard let data = store.data(forKey: profileKey),
              let server = try? JSONDecoder().decode(AppleTVServer.self, from: data),
              let password = readPassword(id: server.id), !password.isEmpty else { return nil }
        return (server, password)
    }

    private static func baseQuery(id: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: id,
            kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
        ]
    }

    private static func storePassword(_ password: String, id: String) {
        SecItemDelete(baseQuery(id: id) as CFDictionary)
        var add = baseQuery(id: id)
        add[kSecValueData as String] = Data(password.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    private static func removePassword(id: String) {
        SecItemDelete(baseQuery(id: id) as CFDictionary)
    }

    private static func readPassword(id: String) -> String? {
        var query = baseQuery(id: id)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

/// Transports that can hand out a URL plus headers for AVPlayer (videos stream instead of downloading).
protocol StreamingTransport {
    func streamTarget(_ relative: String) -> (url: URL, headers: [String: String])?
}

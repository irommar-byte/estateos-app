import CryptoKit
import CloudKit
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

/// The library connection, without the NAS password. The password lives in the shared iCloud keychain.
struct LibraryCloudProfile: Codable, Equatable {
    var place: String
    var kind: String
    var host: String
    var port: Int
    var username: String
    var directory: String
    var folderName: String
    var localHost: String
    var localPort: Int
    var localName: String
    var remoteHost: String
    var namedRemotePort: Int

    static let key = "galleryos.library.profile.v1"

    init(_ settings: DestinationSettings) {
        place = settings.place
        kind = settings.kind
        host = settings.host
        port = settings.port
        username = settings.username
        directory = settings.directory
        folderName = settings.folderName
        localHost = settings.localHost
        localPort = settings.localPort
        localName = settings.localName
        remoteHost = settings.remoteHost
        namedRemotePort = settings.namedRemotePort
    }

    func settings() -> DestinationSettings {
        var value = DestinationSettings(
            place: place,
            kind: kind,
            host: host,
            port: port,
            username: username,
            directory: directory,
            folderName: folderName,
            connected: false,
            localHost: localHost,
            localPort: localPort,
            localName: localName,
            remoteHost: remoteHost
        )
        value.namedRemotePort = namedRemotePort
        return value
    }

    static func publish(_ settings: DestinationSettings) {
        guard settings.kind == DestinationKind.webdav
            || settings.kind == DestinationKind.server
            || settings.kind == DestinationKind.immich else { return }
        guard !settings.host.isEmpty else { return }
        guard let data = try? JSONEncoder().encode(LibraryCloudProfile(settings)) else { return }
        let store = NSUbiquitousKeyValueStore.default
        store.set(data, forKey: key)
        store.synchronize()
        if let password = GalleryKeychain.string(account: "destination-password"), !password.isEmpty {
            GalleryKeychain.keep(password, account: "destination-password")
        }
    }

    static func load() -> DestinationSettings? {
        let store = NSUbiquitousKeyValueStore.default
        store.synchronize()
        guard let data = store.data(forKey: key),
              let profile = try? JSONDecoder().decode(LibraryCloudProfile.self, from: data),
              !profile.host.isEmpty else { return nil }
        return profile.settings()
    }
}

/// Whether GalleryOS and Apple TV may open. The clock and the receipt live in iCloud, so a reinstall does not start the three days again.
/// Links App Review requires next to every subscription offer.
/// The privacy address is the same one entered in App Store Connect → App Privacy.
enum GalleryLegal {
    static let terms = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    static let privacy = URL(string: "https://estateos.pl/galleryos/polityka-prywatnosci")!

    static func short(_ url: URL) -> String {
        (url.host ?? "").replacingOccurrences(of: "www.", with: "") + url.path
    }
}

enum GalleryAccess {
    static let trialKey = "galleryos.trial.start"
    static let untilKey = "galleryos.membership.until"
    static let lifetimeKey = "galleryos.membership.lifetime"
    static let trial: TimeInterval = 3 * 24 * 60 * 60

    static func noteStartIfNeeded() {
        let store = NSUbiquitousKeyValueStore.default
        store.synchronize()
        guard trialStart() == 0 else { return }
        let now = Date().timeIntervalSince1970
        UserDefaults.standard.set(now, forKey: earliestKey)
        store.set(now, forKey: trialKey)
        store.synchronize()
    }

    private static let earliestKey = "galleryos.trial.earliest"

    /// The earliest start any device has seen. A new device (often Apple TV) that opens before
    /// iCloud has delivered the old value writes "now" and could restart the free days for the
    /// whole Apple ID; the earlier start always wins and is written back.
    static func trialStart() -> TimeInterval {
        let store = NSUbiquitousKeyValueStore.default
        let cloud = store.double(forKey: trialKey)
        let local = UserDefaults.standard.double(forKey: earliestKey)
        guard let earliest = [cloud, local].filter({ $0 > 0 }).min() else { return 0 }
        if local != earliest { UserDefaults.standard.set(earliest, forKey: earliestKey) }
        if cloud != earliest {
            store.set(earliest, forKey: trialKey)
            store.synchronize()
        }
        return earliest
    }

    static func allowed() -> Bool {
        let store = NSUbiquitousKeyValueStore.default
        store.synchronize()
        if store.bool(forKey: lifetimeKey) { return true }
        if store.double(forKey: untilKey) > Date().timeIntervalSince1970 { return true }
        // Simulated end of the free days (for testing and App Review). Paid plans are unaffected.
        if simulateEnded { return false }
        let start = trialStart()
        guard start > 0 else { return true }
        return Date().timeIntervalSince1970 - start < trial
    }

    /// Shared through iCloud, so Apple TV and the iPad on the same Apple ID lock too. The real
    /// trial start is never touched: switching the simulation off brings back exactly the days left.
    static let simulateKey = "galleryos.trial.simulate-ended"

    static var simulateEnded: Bool {
        get {
            let store = NSUbiquitousKeyValueStore.default
            if store.object(forKey: simulateKey) != nil { return store.bool(forKey: simulateKey) }
            return UserDefaults.standard.bool(forKey: simulateKey)
        }
        set {
            UserDefaults.standard.set(newValue, forKey: simulateKey)
            let store = NSUbiquitousKeyValueStore.default
            store.set(newValue, forKey: simulateKey)
            store.synchronize()
        }
    }

    static var isLifetime: Bool { NSUbiquitousKeyValueStore.default.bool(forKey: lifetimeKey) }

    /// True while `statusLine` talks about the trial (running or just ended), not a purchase.
    static var showsTrialLine: Bool {
        let store = NSUbiquitousKeyValueStore.default
        if store.bool(forKey: lifetimeKey) { return false }
        if store.double(forKey: untilKey) > Date().timeIntervalSince1970 { return false }
        return !simulateEnded
    }

    /// Plain words for the plan screen: lifetime, paid until, trial days left, or ended.
    static var statusLine: String {
        let store = NSUbiquitousKeyValueStore.default
        if store.bool(forKey: lifetimeKey) { return L("GalleryOS™ Ultimate · aktywne") }
        let until = store.double(forKey: untilKey)
        if until > Date().timeIntervalSince1970 {
            let date = Date(timeIntervalSince1970: until).formatted(Date.FormatStyle(date: .abbreviated, time: .omitted).locale(Localization.locale))
            return L("Aktywne do \(date)")
        }
        if simulateEnded { return L("Symulacja: okres próbny minął") }
        let start = trialStart()
        guard start > 0 else { return L("Okres próbny") }
        let left = trial - (Date().timeIntervalSince1970 - start)
        if left <= 0 { return L("Okres próbny minął") }
        let days = Int(ceil(left / 86_400))
        return Plural.pick(days, L("Okres próbny · został \(days) dzień"), L("Okres próbny · zostały \(days) dni"), L("Okres próbny · zostało \(days) dni"))
    }

    static func publish(lifetime: Bool, until: Date?) {
        // Grows only: iPhone and Apple TV may each see a different purchase.
        let store = NSUbiquitousKeyValueStore.default
        if lifetime { store.set(true, forKey: lifetimeKey) }
        if let until, until.timeIntervalSince1970 > store.double(forKey: untilKey) {
            store.set(until.timeIntervalSince1970, forKey: untilKey)
        }
        store.synchronize()
    }
}

/// Same-Apple-ID path for Apple TV. The server profile is in iCloud Key-Value Storage.
/// The password is only in the shared keychain, which both apps can read.
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
        let store = NSUbiquitousKeyValueStore.default
        if let profile = try? JSONEncoder().encode(server) {
            store.set(profile, forKey: profileKey)
        }
        store.removeObject(forKey: handoffKey)
        store.synchronize()
        guard !password.isEmpty else { return }
        GalleryKeychain.keep(password, account: "destination-password")
        storePassword(password, id: server.id)
        // tvOS never receives iCloud Keychain items, so the keychain copy alone left Apple TV
        // asking for a code. Two ways that do reach it: the sealed copy in Key-Value Storage
        // (no CloudKit schema needed) and the private CloudKit record.
        Task {
            let sealed = await CloudSeal.publish(server, password: password)
            let failure = await CloudServerVault.save(server, password: password)
            let time = Date().formatted(date: .omitted, time: .shortened)
            let note: String
            if sealed || failure == nil {
                note = L("Gotowe w iCloud · \(time)")
            } else {
                note = failure ?? L("iCloud nie odpowiada")
            }
            await MainActor.run { UserDefaults.standard.set(note, forKey: CloudServerShare.noteKey) }
        }
    }

    /// One line for the iPhone: whether Apple TV can find the server in iCloud right now.
    static let noteKey = "galleryos.appletv.note"

    static func withdraw() {
        let store = NSUbiquitousKeyValueStore.default
        if let data = store.data(forKey: handoffKey),
           let handoff = try? JSONDecoder().decode(CloudHandoff.self, from: data) {
            removePassword(id: handoff.server.id)
        }
        store.removeObject(forKey: handoffKey)
        store.removeObject(forKey: profileKey)
        CloudSeal.remove()
        store.synchronize()
        UserDefaults.standard.removeObject(forKey: noteKey)
        Task { await CloudServerVault.remove() }
    }

    static func load() -> (server: AppleTVServer, password: String)? {
        let store = NSUbiquitousKeyValueStore.default
        store.synchronize()
        if let data = store.data(forKey: profileKey),
           let server = try? JSONDecoder().decode(AppleTVServer.self, from: data) {
            let password = GalleryKeychain.string(account: "destination-password")
                ?? readPassword(id: server.id)
                ?? ""
            if !password.isEmpty { return (server, password) }
        }
        if let data = store.data(forKey: handoffKey),
           let handoff = try? JSONDecoder().decode(CloudHandoff.self, from: data),
           !handoff.password.isEmpty {
            return (handoff.server, handoff.password)
        }
        return nil
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

/// Who is using this device, as a one-way fingerprint of the iCloud account. The real account id
/// never leaves the device; two people sharing one NAS get two different fingerprints.
enum GalleryOwner {
    private static let key = "galleryos.owner.v1"

    static var current: String {
        if let saved = UserDefaults.standard.string(forKey: key), !saved.isEmpty { return saved }
        return fallback
    }

    /// Used until iCloud answers; such photos are moved to the iCloud fingerprint afterwards.
    static var fallback: String {
        "device-" + GalleryKeychain.deviceID().prefix(12)
    }

    /// The same person on any of their devices: computed from the iCloud user record.
    static func refresh() async {
        guard let record = try? await CKContainer(identifier: "iCloud.pl.galleryos.app").userRecordID() else { return }
        let digest = SHA256.hash(data: Data(("galleryos|" + record.recordName).utf8))
        let print = "icloud-" + digest.prefix(10).map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(print, forKey: key)
    }

    static func owns(_ asset: LibraryAsset) -> Bool {
        guard let owner = asset.hiddenOwner else { return true }
        return owner == current || owner == fallback
    }

    /// True for this person's own fingerprint (iCloud, or the device one used before iCloud answered).
    static func isMe(_ fingerprint: String?) -> Bool {
        guard let fingerprint else { return false }
        return fingerprint == current || fingerprint == fallback
    }

    static let nameKey = "galleryos.owner.name"

    /// How this person is named on the server ("Marian"), next to every photo they send.
    static var displayName: String {
        let saved = UserDefaults.standard.string(forKey: nameKey)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return saved
    }

    static func setDisplayName(_ name: String) {
        UserDefaults.standard.set(name.trimmingCharacters(in: .whitespacesAndNewlines), forKey: nameKey)
    }
}

/// The server for Apple TV in the user's private iCloud database. Only devices signed in to the
/// same Apple ID can read it; the password is an encrypted field (CloudKit encryptedValues).
enum CloudServerVault {
    static let containerID = "iCloud.pl.galleryos.app"
    private static let container = CKContainer(identifier: containerID)
    private static let recordID = CKRecord.ID(recordName: "appletv-server")
    private static let recordType = "GalleryTVLink"

    enum Outcome {
        case found(AppleTVServer, String)
        case missing
        case failed(String)
    }

    /// nil when saved; otherwise a short reason the person can act on.
    static func save(_ server: AppleTVServer, password: String) async -> String? {
        guard !password.isEmpty, let profile = try? JSONEncoder().encode(server) else { return L("Brak hasła serwera.") }
        let database = container.privateCloudDatabase
        do {
            let record = (try? await database.record(for: recordID))
                ?? CKRecord(recordType: recordType, recordID: recordID)
            record["profile"] = profile
            record["updated"] = Date()
            record.encryptedValues["password"] = password
            let result = try await database.modifyRecords(saving: [record], deleting: [], savePolicy: .changedKeys)
            if case .failure(let error) = result.saveResults[recordID] { return describe(error) }
            return nil
        } catch {
            return describe(error)
        }
    }

    static func remove() async {
        _ = try? await container.privateCloudDatabase.deleteRecord(withID: recordID)
    }

    static func load() async -> (server: AppleTVServer, password: String)? {
        if case .found(let server, let password) = await fetch() { return (server, password) }
        return nil
    }

    static func fetch() async -> Outcome {
        do {
            let record = try await container.privateCloudDatabase.record(for: recordID)
            guard let profile = record["profile"] as? Data,
                  let server = try? JSONDecoder().decode(AppleTVServer.self, from: profile),
                  let password = record.encryptedValues["password"] as? String,
                  !password.isEmpty else { return .missing }
            return .found(server, password)
        } catch let error as CKError where error.code == .unknownItem {
            return .missing
        } catch {
            return .failed(describe(error))
        }
    }

    static func accountProblem() async -> String? {
        guard let status = try? await container.accountStatus() else { return nil }
        switch status {
        case .available: return nil
        case .noAccount: return L("To urządzenie nie jest zalogowane do iCloud.")
        case .restricted: return L("iCloud jest tu ograniczony (Czas przed ekranem albo profil zarządzania).")
        case .temporarilyUnavailable: return L("iCloud jest chwilowo niedostępny. Zaloguj się ponownie w Ustawieniach.")
        default: return nil
        }
    }

    static func describe(_ error: Error) -> String {
        guard let cloud = error as? CKError else { return error.localizedDescription }
        switch cloud.code {
        case .notAuthenticated: return L("Zaloguj się do iCloud w Ustawieniach.")
        case .networkUnavailable, .networkFailure, .serviceUnavailable, .requestRateLimited, .zoneBusy:
            return L("iCloud nie odpowiada, spróbuję ponownie.")
        case .quotaExceeded: return L("Brak miejsca w iCloud.")
        case .serverRejectedRequest, .invalidArguments, .unknownItem, .badContainer, .missingEntitlement, .permissionFailure:
            return L("CloudKit odrzucił zapis (kod \(cloud.code.rawValue)).")
        default: return "iCloud: \(cloud.localizedDescription)"
        }
    }
}

/// The server and its password for Apple TV, sealed with AES-GCM and kept in iCloud Key-Value
/// Storage. The key comes from this app's iCloud user record, which is the same on every device
/// with one Apple ID and is never stored next to the data. Needs no CloudKit schema, so it is the
/// first way Apple TV pairs by itself; the CloudKit record stays as the second.
enum CloudSeal {
    static let storeKey = "galleryos.appletv.sealed.v1"
    private static let nameKey = "galleryos.icloud.account-name"

    private struct Payload: Codable {
        var server: AppleTVServer
        var password: String
        var at: Date
    }

    private static func accountKey(fresh: Bool) async -> SymmetricKey? {
        if !fresh, let cached = UserDefaults.standard.string(forKey: nameKey), !cached.isEmpty {
            return derive(cached)
        }
        guard let record = try? await CKContainer(identifier: CloudServerVault.containerID).userRecordID() else {
            return nil
        }
        UserDefaults.standard.set(record.recordName, forKey: nameKey)
        return derive(record.recordName)
    }

    private static func derive(_ name: String) -> SymmetricKey {
        SymmetricKey(data: SHA256.hash(data: Data(("galleryos.appletv.seal|" + name).utf8)))
    }

    static func publish(_ server: AppleTVServer, password: String) async -> Bool {
        guard !password.isEmpty, let key = await accountKey(fresh: true),
              let plain = try? JSONEncoder().encode(Payload(server: server, password: password, at: Date())),
              let sealed = try? AES.GCM.seal(plain, using: key).combined else { return false }
        let store = NSUbiquitousKeyValueStore.default
        store.set(sealed, forKey: storeKey)
        return store.synchronize()
    }

    static var present: Bool {
        NSUbiquitousKeyValueStore.default.data(forKey: storeKey) != nil
    }

    static func open() async -> (server: AppleTVServer, password: String)? {
        guard let sealed = NSUbiquitousKeyValueStore.default.data(forKey: storeKey),
              let box = try? AES.GCM.SealedBox(combined: sealed) else { return nil }
        for fresh in [false, true] {
            guard let key = await accountKey(fresh: fresh) else { continue }
            if let plain = try? AES.GCM.open(box, using: key),
               let payload = try? JSONDecoder().decode(Payload.self, from: plain),
               !payload.password.isEmpty {
                return (payload.server, payload.password)
            }
        }
        return nil
    }

    static func remove() {
        NSUbiquitousKeyValueStore.default.removeObject(forKey: storeKey)
    }
}

/// Transports that can hand out a URL plus headers for AVPlayer (videos stream instead of downloading).
protocol StreamingTransport {
    func streamTarget(_ relative: String) -> (url: URL, headers: [String: String])?
}

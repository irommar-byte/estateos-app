import AuthenticationServices
import Foundation

struct ShareFriend: Decodable, Identifiable, Hashable {
    var name: String
    var online: Bool
    var id: String { name }
}

struct ShareItem: Codable, Hashable, Identifiable {
    var hash: String
    var ext: String
    var id: String { hash }
}

struct ShareAlbum: Decodable, Identifiable, Hashable {
    var id: String
    var title: String
    var owner: String
    var members: [String]
    var items: [ShareItem]
}

@MainActor
final class ShareAccount: ObservableObject {
    static let shared = ShareAccount()
    @Published var name: String
    @Published var givenName: String
    @Published var familyName: String
    @Published var host: String
    @Published var friends: [ShareFriend] = []
    @Published var albums: [ShareAlbum] = []
    @Published var message = ""
    @Published var inviteNote = ""
    @Published var needsPassword = false

    private init() {
        name = UserDefaults.standard.string(forKey: "galleryos.people-name") ?? ""
        givenName = UserDefaults.standard.string(forKey: "galleryos.people-given") ?? ""
        familyName = UserDefaults.standard.string(forKey: "galleryos.people-family") ?? ""
        host = UserDefaults.standard.string(forKey: "galleryos.people-host") ?? ""
    }

    var profileName: String {
        let full = [givenName, familyName].filter { !$0.isEmpty }.joined(separator: " ")
        return full.isEmpty ? name : full
    }

    var signedIn: Bool {
        GalleryKeychain.string(account: "people-token") != nil && !name.isEmpty
    }

    func saveHost(_ value: String) {
        host = value.trimmingCharacters(in: .whitespacesAndNewlines)
        UserDefaults.standard.set(host, forKey: "galleryos.people-host")
    }

    func enter(name: String, password: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2, password.count >= 4 else {
            message = "Nazwa ma mieć co najmniej 2 znaki, a hasło 4."
            return
        }
        await session(path: "/v1/people/enter", name: trimmed, password: password)
    }

    func signInWithPasskey() async {
        do {
            let start: PasskeyStart = try await postAnonymous("/v1/people/passkey/login/start", body: Data("{}".utf8))
            guard let challenge = Base64URL.decode(start.challenge) else {
                message = "Serwer nie przygotował Face ID."
                return
            }
            let assertion = try await PasskeyCeremony.shared.assert(challenge: challenge)
            let payload = try JSONEncoder().encode(PasskeyFinish(
                sessionId: start.sessionId,
                id: assertion.id,
                response: .assertion(assertion.response)
            ))
            let data = try await send("/v1/people/passkey/login/finish", method: "POST", body: payload, anonymous: true)
            try acceptSession(data)
            UserDefaults.standard.set(true, forKey: PasskeyCeremony.readyKey)
        } catch PasskeyError.cancelled {
            return
        } catch {
            let text = AccountFailure.message(for: error)
            message = text.isEmpty ? "Nie udało się wejść przez Face ID." : text
        }
    }

    func registerPasskey() async -> Bool {
        do {
            let start: PasskeyRegisterStart = try await post("/v1/people/passkey/register/start", body: Data("{}".utf8))
            guard let challenge = Base64URL.decode(start.challenge),
                  let userID = Base64URL.decode(start.userID) else {
                message = "Nie udało się przygotować klucza."
                return false
            }
            let made = try await PasskeyCeremony.shared.register(challenge: challenge, name: start.name, userID: userID)
            let payload = try JSONEncoder().encode(PasskeyFinish(
                sessionId: start.sessionId,
                id: made.id,
                response: .registration(made.response)
            ))
            _ = try await send("/v1/people/passkey/register/finish", method: "POST", body: payload)
            UserDefaults.standard.set(true, forKey: PasskeyCeremony.readyKey)
            UserDefaults.standard.set(true, forKey: PasskeyCeremony.offeredKey)
            message = ""
            return true
        } catch PasskeyError.cancelled {
            return false
        } catch {
            message = AccountFailure.message(for: error)
            return false
        }
    }

    private func post<T: Decodable>(_ path: String, body: Data) async throws -> T {
        let data = try await send(path, method: "POST", body: body)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func postAnonymous<T: Decodable>(_ path: String, body: Data) async throws -> T {
        let data = try await send(path, method: "POST", body: body, anonymous: true)
        return try JSONDecoder().decode(T.self, from: data)
    }

    func signIn(with apple: AppleIdentity.Credential) async {
        do {
            let payload = try JSONEncoder().encode(AppleDraft(
                identityToken: apple.token,
                nonce: apple.nonce,
                name: apple.name,
                givenName: apple.givenName,
                familyName: apple.familyName
            ))
            let data = try await send("/v1/people/apple", method: "POST", body: payload, anonymous: true)
            try acceptSession(data)
        } catch {
            message = AccountFailure.message(for: error)
        }
    }

    func signOut() {
        GalleryKeychain.remove(account: "people-token")
        name = ""
        givenName = ""
        familyName = ""
        inviteNote = ""
        UserDefaults.standard.set("", forKey: "galleryos.people-name")
        UserDefaults.standard.set("", forKey: "galleryos.people-given")
        UserDefaults.standard.set("", forKey: "galleryos.people-family")
        friends = []
        albums = []
    }

    func refresh() async {
        guard signedIn else { return }
        do {
            let friendsBody = try await get("/v1/people/friends")
            friends = (try? JSONDecoder().decode(FriendsBox.self, from: friendsBody).friends) ?? []
            let albumsBody = try await get("/v1/people/albums")
            albums = (try? JSONDecoder().decode(AlbumsBox.self, from: albumsBody).albums) ?? []
            message = ""
        } catch let failure as AccountHTTPError where failure.status == 401 {
            signOut()
            message = "Zaloguj się ponownie."
        } catch {
            message = ""
        }
    }

    func inviteCode() async throws -> String {
        let data = try await send("/v1/people/invites", method: "POST", body: Data("{}".utf8))
        return (try JSONDecoder().decode(CodeBox.self, from: data).code)
    }

    func accept(code: String) async {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            inviteNote = "Wpisz kod zaproszenia."
            return
        }
        do {
            let data = try await send("/v1/people/invites/accept", method: "POST", body: JSONEncoder().encode(["code": trimmed]))
            let friend = (try? JSONDecoder().decode(FriendBox.self, from: data).friend) ?? trimmed
            inviteNote = "Dodano: \(friend)"
            await refresh()
        } catch {
            inviteNote = AccountFailure.message(for: error)
        }
    }

    func upload(hash: String, kind: String, ext: String, file: URL) async throws {
        let path = "/v1/people/shares/\(hash)/\(kind)?ext=\(ext)"
        var request = try request(path, method: "PUT")
        request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await GalleryNetwork.shared.upload(for: request, fromFile: file)
        try throwHTTP(response, data: data, allowExists: true)
    }

    func createAlbum(title: String, members: [String], items: [ShareItem]) async throws {
        let payload = AlbumDraft(title: title, members: members, items: items)
        _ = try await send("/v1/people/albums", method: "POST", body: JSONEncoder().encode(payload))
        await refresh()
    }

    func publishLibrary() async {
        guard signedIn else { return }
        let settings = DestinationSettings.load()
        guard settings.connected, settings.kind != DestinationKind.none, settings.kind != DestinationKind.folder else { return }
        let profile = LibraryProfile(settings: settings)
        _ = try? await send("/v1/people/library", method: "PUT", body: JSONEncoder().encode(profile))
    }

    func pullLibrary() async -> DestinationSettings? {
        guard signedIn else { return nil }
        guard let data = try? await get("/v1/people/library"),
              let box = try? JSONDecoder().decode(LibraryBox.self, from: data),
              let library = box.library,
              !library.host.isEmpty else { return nil }
        return library.settings()
    }

    /// Apple TV pairing: asks the service for the public key behind the code shown on the TV.
    func pairLookup(code: String) async throws -> String {
        let clean = PairingCrypto.normalize(code: code)
        let body = try JSONEncoder().encode(["code": clean])
        let data = try await send("/v1/people/pair/lookup", method: "POST", body: body, anonymous: true)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let key = object["publicKey"] as? String, !key.isEmpty else {
            throw LibraryError(message: "Ten kod nie pasuje do żadnego Apple TV.")
        }
        return key
    }

    /// Sends the encrypted server to the Apple TV. The service only relays ciphertext.
    func pairClaim(code: String, sealed: SealedPairing) async throws {
        let clean = PairingCrypto.normalize(code: code)
        let body = try JSONEncoder().encode(PairClaim(code: clean, sealed: sealed))
        _ = try await send("/v1/people/pair/claim", method: "POST", body: body, anonymous: true)
    }

    func download(hash: String, kind: String, ext: String) async throws -> Data {
        try await get("/v1/people/shares/\(hash)/\(kind)?ext=\(ext)")
    }

    private func session(path: String, name: String, password: String) async {
        do {
            let payload = try JSONEncoder().encode(["name": name, "password": password])
            let data = try await send(path, method: "POST", body: payload, anonymous: true)
            try acceptSession(data)
        } catch {
            message = AccountFailure.message(for: error)
        }
    }

    private func acceptSession(_ data: Data) throws {
        let box = try JSONDecoder().decode(SessionBox.self, from: data)
        try GalleryKeychain.set(box.token, account: "people-token")
        name = box.name
        if let given = box.givenName, !given.isEmpty { givenName = given }
        if let family = box.familyName, !family.isEmpty { familyName = family }
        UserDefaults.standard.set(box.name, forKey: "galleryos.people-name")
        UserDefaults.standard.set(givenName, forKey: "galleryos.people-given")
        UserDefaults.standard.set(familyName, forKey: "galleryos.people-family")
        message = ""
        Task {
            await refresh()
            await publishLibrary()
            await AccountVault.restoreIfNeeded()
        }
    }

    private func get(_ path: String) async throws -> Data {
        let (data, response) = try await GalleryNetwork.shared.data(for: request(path, method: "GET"))
        try throwHTTP(response, data: data, allowExists: false)
        return data
    }

    private func send(_ path: String, method: String, body: Data, anonymous: Bool = false) async throws -> Data {
        var request = try request(path, method: method, anonymous: anonymous)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try throwHTTP(response, data: data, allowExists: false)
        return data
    }

    private func serviceRoot() -> String {
        "https://lineage.mycloudnas.com/galleryos"
    }

    private func request(_ path: String, method: String, anonymous: Bool = false) throws -> URLRequest {
        let root = serviceRoot()
        let suffix = path.hasPrefix("/") ? path : "/\(path)"
        guard let url = URL(string: root + suffix), url.host != nil else {
            throw LibraryError(message: "Serwis kont jest niedostępny.")
        }
        if let name = url.host { GalleryNetwork.shared.trust(name) }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 30
        if !anonymous, let token = GalleryKeychain.string(account: "people-token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func throwHTTP(_ response: URLResponse, data: Data, allowExists: Bool) throws {
        guard let http = response as? HTTPURLResponse else {
            throw LibraryError(message: "Brak odpowiedzi.")
        }
        if (200...299).contains(http.statusCode) { return }
        if allowExists, http.statusCode == 200 { return }
        let message = (try? JSONDecoder().decode(ErrorBox.self, from: data).error) ?? "Nie udało się."
        throw AccountHTTPError(status: http.statusCode, message: message)
    }
}

private struct SessionBox: Decodable {
    var token: String
    var name: String
    var givenName: String?
    var familyName: String?
    var displayName: String?
}
private struct AppleDraft: Encodable {
    var identityToken: String
    var nonce: String
    var name: String
    var givenName: String
    var familyName: String
}
private struct FriendBox: Decodable { var friend: String }

struct LibraryProfile: Codable {
    var place: String
    var kind: String
    var host: String
    var port: Int
    var username: String
    var directory: String
    var localHost: String
    var localPort: Int
    var localName: String
    var remoteHost: String
    var remotePort: Int
    var secret: String

    init(settings: DestinationSettings) {
        place = settings.place
        kind = settings.kind
        host = settings.host
        port = settings.port
        username = settings.username
        directory = settings.directory
        localHost = settings.localHost
        localPort = settings.localPort
        localName = settings.localName
        var remote = settings.remoteHost
        if remote.isEmpty, !settings.host.isEmpty, !GalleryNetwork.isLocalHost(settings.host) {
            remote = settings.host
        }
        remoteHost = remote
        remotePort = settings.namedRemotePort > 0 ? settings.namedRemotePort : settings.remotePort
        secret = GalleryKeychain.string(account: "destination-password") ?? ""
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        place = try container.decodeIfPresent(String.self, forKey: .place) ?? ""
        kind = try container.decodeIfPresent(String.self, forKey: .kind) ?? ""
        host = try container.decodeIfPresent(String.self, forKey: .host) ?? ""
        port = try container.decodeIfPresent(Int.self, forKey: .port) ?? 0
        username = try container.decodeIfPresent(String.self, forKey: .username) ?? ""
        directory = try container.decodeIfPresent(String.self, forKey: .directory) ?? ""
        localHost = try container.decodeIfPresent(String.self, forKey: .localHost) ?? ""
        localPort = try container.decodeIfPresent(Int.self, forKey: .localPort) ?? 0
        localName = try container.decodeIfPresent(String.self, forKey: .localName) ?? ""
        remoteHost = try container.decodeIfPresent(String.self, forKey: .remoteHost) ?? ""
        remotePort = try container.decodeIfPresent(Int.self, forKey: .remotePort) ?? 0
        secret = try container.decodeIfPresent(String.self, forKey: .secret) ?? ""
    }

    private enum CodingKeys: String, CodingKey {
        case place, kind, host, port, username, directory
        case localHost, localPort, localName, remoteHost, remotePort, secret
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(place, forKey: .place)
        try container.encode(kind, forKey: .kind)
        try container.encode(host, forKey: .host)
        try container.encode(port, forKey: .port)
        try container.encode(username, forKey: .username)
        try container.encode(directory, forKey: .directory)
        try container.encode(localHost, forKey: .localHost)
        try container.encode(localPort, forKey: .localPort)
        try container.encode(localName, forKey: .localName)
        try container.encode(remoteHost, forKey: .remoteHost)
        try container.encode(remotePort, forKey: .remotePort)
        try container.encode(secret, forKey: .secret)
    }

    func settings() -> DestinationSettings {
        var remote = remoteHost
        if remote.isEmpty, !host.isEmpty, !GalleryNetwork.isLocalHost(host) {
            remote = host
        }
        var settings = DestinationSettings(
            place: place,
            kind: kind,
            host: host,
            port: port,
            username: username,
            directory: directory,
            folderName: "",
            connected: false,
            localHost: localHost,
            localPort: localPort,
            localName: localName,
            remoteHost: remote
        )
        settings.namedRemotePort = remotePort
        if !secret.isEmpty {
            GalleryKeychain.keep(secret, account: "destination-password")
        }
        return settings
    }
}

private struct LibraryBox: Decodable {
    var library: LibraryProfile?
}
private struct CodeBox: Decodable { var code: String }
private struct FriendsBox: Decodable { var friends: [ShareFriend] }
private struct AlbumsBox: Decodable { var albums: [ShareAlbum] }
private struct ErrorBox: Decodable { var error: String }
private struct AlbumDraft: Encodable { var title: String; var members: [String]; var items: [ShareItem] }

struct AccountHTTPError: Error {
    var status: Int
    var message: String
}

enum AccountFailure {
    static func message(for error: Error) -> String {
        if let http = error as? AccountHTTPError { return http.message }
        let ns = error as NSError
        if ns.domain == ASAuthorizationError.errorDomain {
            if ns.code == ASAuthorizationError.canceled.rawValue { return "" }
            return "Apple nie otworzyło logowania. Zbuduj aplikację jeszcze raz w Xcode, żeby włączyć Apple ID."
        }
        if let url = error as? URLError {
            switch url.code {
            case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed:
                return "Brak sieci."
            case .cannotFindHost, .cannotConnectToHost, .timedOut, .dnsLookupFailed, .secureConnectionFailed, .serverCertificateUntrusted:
                return "Serwis kont nie odpowiada pod tym adresem."
            default:
                break
            }
        }
        if let library = error as? LibraryError { return library.message }
        let text = error.localizedDescription
        return text.isEmpty ? "Nie udało się zalogować." : text
    }
}

private struct PairClaim: Encodable {
    var code: String
    var sealed: SealedPairing
}

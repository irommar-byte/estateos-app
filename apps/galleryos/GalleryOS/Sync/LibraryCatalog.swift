import Foundation

enum DestinationKind {
    static let none = "none"
    static let server = "server"
    static let webdav = "webdav"
    static let sftp = "sftp"
    static let folder = "folder"
    static let immich = "immich"
}

struct DestinationSettings: Codable, Equatable {
    var place: String
    var kind: String
    var host: String
    var port: Int
    var username: String
    var directory: String
    var folderName: String
    var connected: Bool
    var localHost: String = ""
    var localPort: Int = 0
    var localName: String = ""
    var remoteHost: String = ""
    /// Port typed for the DDNS route. Zero means the app may choose one.
    var namedRemotePort: Int = 0

    /// Port for the DDNS route. A port learned at home (QNAP's plain-HTTP 5000) is rarely
    /// forwarded on the router, so it is never forced on the remote address.
    var remotePort: Int {
        if namedRemotePort > 0 { return namedRemotePort }
        guard port > 0 else { return 0 }
        if localPort > 0, port == localPort, !remoteHost.isEmpty { return 0 }
        return port
    }

    static let empty = DestinationSettings(
        place: LibraryPlace.thisPhone.rawValue,
        kind: DestinationKind.none,
        host: "",
        port: 0,
        username: "",
        directory: "",
        folderName: "",
        connected: false,
        localHost: "",
        localPort: 0,
        localName: "",
        remoteHost: ""
    )

    private enum CodingKeys: String, CodingKey {
        case place, kind, host, port, username, directory, folderName, connected
        case localHost, localPort, localName, remoteHost, namedRemotePort
    }

    init(place: String, kind: String, host: String, port: Int, username: String, directory: String, folderName: String, connected: Bool, localHost: String = "", localPort: Int = 0, localName: String = "", remoteHost: String = "") {
        self.place = place
        self.kind = kind
        self.host = host
        self.port = port
        self.username = username
        self.directory = directory
        self.folderName = folderName
        self.connected = connected
        self.localHost = localHost
        self.localPort = localPort
        self.localName = localName
        self.remoteHost = remoteHost
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        place = try container.decodeIfPresent(String.self, forKey: .place) ?? LibraryPlace.thisPhone.rawValue
        kind = try container.decodeIfPresent(String.self, forKey: .kind) ?? DestinationKind.none
        host = try container.decodeIfPresent(String.self, forKey: .host) ?? ""
        port = try container.decodeIfPresent(Int.self, forKey: .port) ?? 0
        username = try container.decodeIfPresent(String.self, forKey: .username) ?? ""
        directory = try container.decodeIfPresent(String.self, forKey: .directory) ?? ""
        folderName = try container.decodeIfPresent(String.self, forKey: .folderName) ?? ""
        connected = try container.decodeIfPresent(Bool.self, forKey: .connected) ?? false
        localHost = try container.decodeIfPresent(String.self, forKey: .localHost) ?? ""
        localPort = try container.decodeIfPresent(Int.self, forKey: .localPort) ?? 0
        localName = try container.decodeIfPresent(String.self, forKey: .localName) ?? ""
        remoteHost = try container.decodeIfPresent(String.self, forKey: .remoteHost) ?? ""
        namedRemotePort = try container.decodeIfPresent(Int.self, forKey: .namedRemotePort) ?? 0
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(place, forKey: .place)
        try container.encode(kind, forKey: .kind)
        try container.encode(host, forKey: .host)
        try container.encode(port, forKey: .port)
        try container.encode(username, forKey: .username)
        try container.encode(directory, forKey: .directory)
        try container.encode(folderName, forKey: .folderName)
        try container.encode(connected, forKey: .connected)
        try container.encode(localHost, forKey: .localHost)
        try container.encode(localPort, forKey: .localPort)
        try container.encode(localName, forKey: .localName)
        try container.encode(remoteHost, forKey: .remoteHost)
        try container.encode(namedRemotePort, forKey: .namedRemotePort)
    }

    private static let key = "galleryos.destination.v1"

    private static let cacheLock = NSLock()
    nonisolated(unsafe) private static var cached: (data: Data, value: DestinationSettings)?

    /// Read on every sync tick and grid cell, so the decoded value is reused until the stored bytes change.
    static func load() -> DestinationSettings {
        guard let data = UserDefaults.standard.data(forKey: key) else { return .empty }
        cacheLock.lock()
        defer { cacheLock.unlock() }
        if let cached, cached.data == data { return cached.value }
        guard let value = try? JSONDecoder().decode(DestinationSettings.self, from: data) else {
            return .empty
        }
        cached = (data, value)
        return value
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }
}

enum CatalogPaths {
    static let root = "GalleryOS"
    static let state = "GalleryOS/state"

    static func journal(device: String) -> String {
        "GalleryOS/state/journal-\(device).jsonl"
    }

    static func original(hash: String, ext: String) -> String {
        "GalleryOS/originals/\(bucket(hash))/\(hash).\(ext)"
    }

    static func thumb(hash: String) -> String {
        "GalleryOS/thumbs/\(bucket(hash))/\(hash).jpg"
    }

    static func bucket(_ hash: String) -> String {
        let prefix = hash.prefix(2)
        return prefix.count == 2 ? String(prefix) : "xx"
    }
}

struct LibraryResource: Codable, Equatable, Sendable {
    var role: String
    var hash: String
    var ext: String
    var bytes: Int
}

struct LibraryAsset: Codable, Equatable, Sendable {
    var hash: String
    var created: Date
    var pixelWidth: Int
    var pixelHeight: Int
    var traits: Int
    var favorite: Bool
    var latitude: Double?
    var longitude: Double?
    var duration: Double
    var deletedAt: Date?
    var albumNames: [String]
    var resources: [LibraryResource]
    var updatedAt: Date
    /// Kept on the server, but left out of every shared library. Only the Hidden album shows it.
    var hidden: Bool = false

    func photoRef() -> PhotoRef {
        PhotoRef(
            id: "cloud:\(hash)",
            created: created,
            pixelWidth: max(pixelWidth, 1),
            pixelHeight: max(pixelHeight, 1),
            traits: PhotoTraits(rawValue: traits),
            isFavorite: favorite,
            latitude: latitude,
            longitude: longitude,
            duration: duration,
            cloudHash: hash
        )
    }

    var primary: LibraryResource? {
        resources.first { $0.role == "primary" } ?? resources.first
    }

    var paired: LibraryResource? {
        resources.first { $0.role == "paired" }
    }
}

extension LibraryAsset {
    private enum CodingKeys: String, CodingKey {
        case hash, created, pixelWidth, pixelHeight, traits, favorite, latitude, longitude
        case duration, deletedAt, albumNames, resources, updatedAt, hidden
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            hash: try c.decode(String.self, forKey: .hash),
            created: try c.decode(Date.self, forKey: .created),
            pixelWidth: try c.decode(Int.self, forKey: .pixelWidth),
            pixelHeight: try c.decode(Int.self, forKey: .pixelHeight),
            traits: try c.decode(Int.self, forKey: .traits),
            favorite: try c.decode(Bool.self, forKey: .favorite),
            latitude: try c.decodeIfPresent(Double.self, forKey: .latitude),
            longitude: try c.decodeIfPresent(Double.self, forKey: .longitude),
            duration: try c.decode(Double.self, forKey: .duration),
            deletedAt: try c.decodeIfPresent(Date.self, forKey: .deletedAt),
            albumNames: try c.decode([String].self, forKey: .albumNames),
            resources: try c.decode([LibraryResource].self, forKey: .resources),
            updatedAt: try c.decode(Date.self, forKey: .updatedAt),
            hidden: try c.decodeIfPresent(Bool.self, forKey: .hidden) ?? false
        )
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(hash, forKey: .hash)
        try c.encode(created, forKey: .created)
        try c.encode(pixelWidth, forKey: .pixelWidth)
        try c.encode(pixelHeight, forKey: .pixelHeight)
        try c.encode(traits, forKey: .traits)
        try c.encode(favorite, forKey: .favorite)
        try c.encodeIfPresent(latitude, forKey: .latitude)
        try c.encodeIfPresent(longitude, forKey: .longitude)
        try c.encode(duration, forKey: .duration)
        try c.encodeIfPresent(deletedAt, forKey: .deletedAt)
        try c.encode(albumNames, forKey: .albumNames)
        try c.encode(resources, forKey: .resources)
        try c.encode(updatedAt, forKey: .updatedAt)
        if hidden { try c.encode(true, forKey: .hidden) }
    }
}

struct JournalLine: Codable, Equatable, Sendable {
    var seq: Int
    var device: String
    var at: Date
    var asset: LibraryAsset
}

enum LibraryRules {
    static let trashInterval: TimeInterval = 30 * 24 * 60 * 60

    static func merge(_ lines: [JournalLine]) -> [String: LibraryAsset] {
        let sorted = lines.sorted { lhs, rhs in
            if lhs.at != rhs.at { return lhs.at < rhs.at }
            if lhs.device != rhs.device { return lhs.device < rhs.device }
            return lhs.seq < rhs.seq
        }
        var result: [String: LibraryAsset] = [:]
        for line in sorted {
            guard !line.asset.hash.isEmpty else { continue }
            result[line.asset.hash] = line.asset
        }
        return result
    }

    static func isInTrash(_ asset: LibraryAsset, now: Date) -> Bool {
        guard let deleted = asset.deletedAt else { return false }
        return now.timeIntervalSince(deleted) < trashInterval
    }

    static func isVisible(_ asset: LibraryAsset) -> Bool {
        asset.deletedAt == nil && !asset.hidden
    }

    /// A movie, not a still and not a Live Photo. Duration keeps a one-frame clip from matching.
    static func isFilm(duration: Double, traits: PhotoTraits) -> Bool {
        traits.contains(.video) && duration >= 0.8
    }

    static func isFilm(_ photo: PhotoRef) -> Bool {
        isFilm(duration: photo.duration, traits: photo.traits)
    }

    static func isFilm(_ asset: LibraryAsset) -> Bool {
        isFilm(duration: asset.duration, traits: PhotoTraits(rawValue: asset.traits))
    }

    /// Same capture even when a second upload hashed the file differently.
    /// Portrait video often swaps width and height, and Photos rarely reports the real byte size.
    static func sameFilm(_ lhs: PhotoRef, _ rhs: PhotoRef) -> Bool {
        guard lhs.id != rhs.id else { return false }
        return sameCapture(
            created: lhs.created,
            duration: lhs.duration,
            width: lhs.pixelWidth,
            height: lhs.pixelHeight,
            traits: lhs.traits,
            otherCreated: rhs.created,
            otherDuration: rhs.duration,
            otherWidth: rhs.pixelWidth,
            otherHeight: rhs.pixelHeight,
            otherTraits: rhs.traits
        )
    }

    /// One tile per movie. The first copy stays where it already sits in the list.
    static func keepingOneFilm(_ photos: [PhotoRef]) -> [PhotoRef] {
        var result: [PhotoRef] = []
        var films: [PhotoRef] = []
        result.reserveCapacity(photos.count)
        for photo in photos {
            if isFilm(photo) {
                if films.contains(where: { sameFilm($0, photo) }) { continue }
                films.append(photo)
            }
            result.append(photo)
        }
        return result
    }

    static func sameFilm(_ photo: PhotoRef, _ asset: LibraryAsset) -> Bool {
        sameCapture(
            created: photo.created,
            duration: photo.duration,
            width: photo.pixelWidth,
            height: photo.pixelHeight,
            traits: photo.traits,
            otherCreated: asset.created,
            otherDuration: asset.duration,
            otherWidth: asset.pixelWidth,
            otherHeight: asset.pixelHeight,
            otherTraits: PhotoTraits(rawValue: asset.traits)
        )
    }

    static func sameFilm(_ lhs: LibraryAsset, _ rhs: LibraryAsset) -> Bool {
        guard lhs.hash != rhs.hash else { return false }
        return sameCapture(
            created: lhs.created,
            duration: lhs.duration,
            width: lhs.pixelWidth,
            height: lhs.pixelHeight,
            traits: PhotoTraits(rawValue: lhs.traits),
            otherCreated: rhs.created,
            otherDuration: rhs.duration,
            otherWidth: rhs.pixelWidth,
            otherHeight: rhs.pixelHeight,
            otherTraits: PhotoTraits(rawValue: rhs.traits)
        )
    }

    private static func sameCapture(
        created: Date,
        duration: Double,
        width: Int,
        height: Int,
        traits: PhotoTraits,
        otherCreated: Date,
        otherDuration: Double,
        otherWidth: Int,
        otherHeight: Int,
        otherTraits: PhotoTraits
    ) -> Bool {
        guard isFilm(duration: duration, traits: traits),
              isFilm(duration: otherDuration, traits: otherTraits) else { return false }
        guard abs(created.timeIntervalSince(otherCreated)) < 2 else { return false }
        guard abs(duration - otherDuration) < 0.45 else { return false }
        return dimensionsMatch(width, height, otherWidth, otherHeight)
    }

    private static func dimensionsMatch(_ width: Int, _ height: Int, _ otherWidth: Int, _ otherHeight: Int) -> Bool {
        if width <= 1 || height <= 1 || otherWidth <= 1 || otherHeight <= 1 { return true }
        let close = { (lhs: Int, rhs: Int) in abs(lhs - rhs) <= 16 }
        let straight = close(width, otherWidth) && close(height, otherHeight)
        let swapped = close(width, otherHeight) && close(height, otherWidth)
        return straight || swapped
    }
}

enum JournalCodec {
    static func encode(_ lines: [JournalLine]) -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        var data = Data()
        for line in lines {
            guard let row = try? encoder.encode(line) else { continue }
            data.append(row)
            data.append(0x0A)
        }
        return data
    }

    static func decode(_ data: Data) -> [JournalLine] {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let text = String(decoding: data, as: UTF8.self)
        return text.split(whereSeparator: \.isNewline).compactMap { row in
            guard let raw = row.data(using: .utf8) else { return nil }
            return try? decoder.decode(JournalLine.self, from: raw)
        }
    }
}

struct LibraryError: LocalizedError {
    var message: String
    var errorDescription: String? { message }
}

enum SyncPause {
    static let needsHTTPS = "Ten port wymaga połączenia szyfrowanego (HTTPS)."
    static let notGalleryServer = "Pod tym adresem nie ma serwera GalleryOS."

    static func message(for error: Error) -> String {
        if let library = error as? LibraryError { return readable(library.message) }
        if let url = error as? URLError {
            switch url.code {
            case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed:
                return "Brak sieci"
            case .appTransportSecurityRequiresSecureConnection:
                return needsHTTPS
            case .timedOut, .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed, .secureConnectionFailed:
                return "Serwer nie odpowiada. Sprawdź adres, port i czy jesteś w tej samej sieci."
            default:
                break
            }
        }
        return readable(error.localizedDescription)
    }

    /// A server fault page is never shown raw. QNAP answers plain HTTP on port 5001 with an HTML
    /// explanation that the port is SSL-only.
    static func explainServer(status: Int, data: Data) -> String {
        let raw = String(decoding: data.prefix(1500), as: UTF8.self)
        let lower = raw.lowercased()
        if lower.contains("ssl-enabled") || lower.contains("speaking plain http") || lower.contains("use the https scheme") {
            return needsHTTPS
        }
        if lower.contains("<html") || lower.contains("<!doctype") || lower.contains("<head") {
            return notGalleryServer
        }
        if status == 401 { return "Błędny login lub hasło." }
        return "Serwer odrzucił połączenie (\(status)). Sprawdź adres i port."
    }

    static func readable(_ text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        if lower.contains("ssl-enabled") || lower.contains("speaking plain http") || lower.contains("use the https scheme") {
            return needsHTTPS
        }
        if lower.contains("<html") || lower.contains("<!doctype") || lower.contains("<head") {
            return "Serwer odpowiedział stroną błędu. Sprawdź adres i port."
        }
        if trimmed.isEmpty { return "Nie udało się połączyć." }
        if trimmed.count > 220 { return "Nie udało się połączyć. Sprawdź adres, port i hasło." }
        return trimmed
    }
}

enum ConnectionURL {
    static let securePorts: Set<Int> = [443, 5001, 5006, 5443, 8443, 9443]

    /// QNAP Cloud, Synology QuickConnect and similar hostnames speak WebDAV, not the GalleryOS API.
    static func isCloudNAS(_ host: String) -> Bool {
        let name = bare(host).lowercased()
        let markers = ["myqnapcloud.com", "synology.me", "quickconnect.to", "direct.synology.com", "diskstation.me"]
        return markers.contains { name == $0 || name.hasSuffix(".\($0)") }
    }

    /// http and https for one host. A known SSL port (QNAP 5001) and any public host are tried encrypted first,
    /// so App Transport Security never rejects the first attempt.
    static func roots(host: String, port: Int, defaultPort: Int) -> [URL] {
        let trimmed = host.trimmingCharacters(in: .whitespacesAndNewlines)
        if let explicit = URL(string: trimmed),
           let scheme = explicit.scheme?.lowercased(), scheme == "http" || scheme == "https",
           explicit.host?.isEmpty == false {
            return [explicit]
        }
        let name = bare(trimmed)
        guard !name.isEmpty else { return [] }
        let chosen = port == 0 ? defaultPort : port
        let encryptedFirst = securePorts.contains(chosen) || !GalleryNetwork.isLocalHost(name)
        let schemes = encryptedFirst ? ["https", "http"] : ["http", "https"]
        return schemes.compactMap { URL(string: "\($0)://\(name):\(chosen)") }
    }

    static func bare(_ host: String) -> String {
        var name = host.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if let colon = name.lastIndex(of: ":"), name[name.index(after: colon)...].allSatisfy(\.isNumber) {
            name = String(name[..<colon])
        }
        return name
    }
}

import CryptoKit
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
    /// Who hid it: a one-way fingerprint of the iCloud account. Only that person sees it in Ukryte.
    var hiddenOwner: String? = nil
    /// The original and preview on the server are encrypted (VaultCrypto). Only the owner's key opens them.
    var sealed: Bool = false
    /// Fingerprint of the key that sealed it, so a device without that key knows to wait for it.
    var sealKey: String? = nil
    /// Who sent it to the server: the iCloud fingerprint (`GalleryOwner`), or "device:<id>" for
    /// photos sent before uploads were signed.
    var owner: String? = nil
    /// The sender's name as they chose it, and the device model it came from ("iPhone 17 Pro").
    var ownerName: String? = nil
    var device: String? = nil
    /// When the server received it.
    var uploadedAt: Date? = nil
    /// Who moved it to Recently Deleted.
    var deletedBy: String? = nil
    var deletedByName: String? = nil

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
        case hiddenOwner, sealed, sealKey
        case owner, ownerName, device, uploadedAt, deletedBy, deletedByName
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
        hiddenOwner = try c.decodeIfPresent(String.self, forKey: .hiddenOwner)
        sealed = try c.decodeIfPresent(Bool.self, forKey: .sealed) ?? false
        sealKey = try c.decodeIfPresent(String.self, forKey: .sealKey)
        owner = try c.decodeIfPresent(String.self, forKey: .owner)
        ownerName = try c.decodeIfPresent(String.self, forKey: .ownerName)
        device = try c.decodeIfPresent(String.self, forKey: .device)
        uploadedAt = try c.decodeIfPresent(Date.self, forKey: .uploadedAt)
        deletedBy = try c.decodeIfPresent(String.self, forKey: .deletedBy)
        deletedByName = try c.decodeIfPresent(String.self, forKey: .deletedByName)
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
        try c.encodeIfPresent(hiddenOwner, forKey: .hiddenOwner)
        if sealed { try c.encode(true, forKey: .sealed) }
        try c.encodeIfPresent(sealKey, forKey: .sealKey)
        try c.encodeIfPresent(owner, forKey: .owner)
        try c.encodeIfPresent(ownerName, forKey: .ownerName)
        try c.encodeIfPresent(device, forKey: .device)
        try c.encodeIfPresent(uploadedAt, forKey: .uploadedAt)
        try c.encodeIfPresent(deletedBy, forKey: .deletedBy)
        try c.encodeIfPresent(deletedByName, forKey: .deletedByName)
    }
}

/// End-to-end encryption for hidden photos. The key is created on the owner's device and kept in
/// the iCloud Keychain, so it reaches only the owner's own iPhone and iPad. The server, other
/// people using the same NAS and anyone browsing the NAS see only unreadable bytes.
///
/// File format: "GOSV" + version 1, chunk size (UInt32), then AES-256-GCM boxes of up to 1 MiB,
/// each prefixed by its length. Films of any size are sealed and opened without loading them whole.
enum VaultCrypto {
    private static let magic = Data("GOSV".utf8) + Data([1])
    private static let chunk = 1 << 20
    private static let account = "vault-key-v1"

    static func isSealed(_ data: Data) -> Bool {
        data.count >= magic.count && data.prefix(magic.count) == magic
    }

    /// The owner's key, if this device has it (created here or arrived through iCloud Keychain).
    static var key: SymmetricKey? {
        guard let stored = GalleryKeychain.data(account: account), stored.count == 32 else { return nil }
        return SymmetricKey(data: stored)
    }

    static var fingerprint: String? {
        guard let key else { return nil }
        return fingerprint(of: key)
    }

    static func fingerprint(of key: SymmetricKey) -> String {
        let digest = key.withUnsafeBytes { SHA256.hash(data: Data($0)) }
        return digest.prefix(6).map { String(format: "%02x", $0) }.joined()
    }

    /// Creates the key once. Never replaces an existing one: photos sealed with it would be lost.
    static func ensureKey() -> SymmetricKey? {
        if let key { return key }
        let fresh = SymmetricKey(size: .bits256)
        let data = fresh.withUnsafeBytes { Data($0) }
        GalleryKeychain.addSharedIfMissing(data, account: account)
        return key
    }

    static func seal(_ plain: Data, key: SymmetricKey) throws -> Data {
        var out = magic
        out.append(contentsOf: withUnsafeBytes(of: UInt32(chunk).bigEndian, Array.init))
        var offset = 0
        repeat {
            let end = min(plain.count, offset + chunk)
            let box = try AES.GCM.seal(plain.subdata(in: offset..<end), using: key)
            guard let combined = box.combined else { throw CocoaError(.coderInvalidValue) }
            out.append(contentsOf: withUnsafeBytes(of: UInt32(combined.count).bigEndian, Array.init))
            out.append(combined)
            offset = end
        } while offset < plain.count
        return out
    }

    /// Plain data passes through; sealed data is opened with the key, or nil without it.
    static func open(_ data: Data, key: SymmetricKey? = VaultCrypto.key) -> Data? {
        guard isSealed(data) else { return data }
        guard let key else { return nil }
        var index = data.startIndex + magic.count + 4
        var plain = Data()
        while index < data.endIndex {
            guard index + 4 <= data.endIndex else { return nil }
            let length = data[index..<index + 4].reduce(0) { ($0 << 8) | Int($1) }
            index += 4
            guard length > 28, index + length <= data.endIndex,
                  let box = try? AES.GCM.SealedBox(combined: data[index..<index + length]),
                  let piece = try? AES.GCM.open(box, using: key) else { return nil }
            plain.append(piece)
            index += length
        }
        return plain
    }

    static func sealFile(_ source: URL, to destination: URL, key: SymmetricKey) throws {
        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let input = try FileHandle(forReadingFrom: source)
        let output = try FileHandle(forWritingTo: destination)
        defer {
            try? input.close()
            try? output.close()
        }
        try output.write(contentsOf: magic)
        try output.write(contentsOf: withUnsafeBytes(of: UInt32(chunk).bigEndian, Array.init))
        var wroteOne = false
        while true {
            let piece = try input.chunk(chunk)
            if piece.isEmpty, wroteOne { break }
            try autoreleasepool {
                let box = try AES.GCM.seal(piece, using: key)
                guard let combined = box.combined else { throw CocoaError(.coderInvalidValue) }
                try output.write(contentsOf: withUnsafeBytes(of: UInt32(combined.count).bigEndian, Array.init))
                try output.write(contentsOf: combined)
            }
            wroteOne = true
            if piece.count < chunk { break }
        }
    }

    static func openFile(_ source: URL, to destination: URL, key: SymmetricKey) throws {
        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let input = try FileHandle(forReadingFrom: source)
        let output = try FileHandle(forWritingTo: destination)
        defer {
            try? input.close()
            try? output.close()
        }
        let head = try input.chunk(magic.count + 4)
        guard isSealed(head) else { throw CocoaError(.fileReadCorruptFile) }
        while true {
            let size = try input.chunk(4)
            if size.isEmpty { break }
            guard size.count == 4 else { throw CocoaError(.fileReadCorruptFile) }
            let length = size.reduce(0) { ($0 << 8) | Int($1) }
            let combined = try input.chunk(length)
            try autoreleasepool {
                let box = try AES.GCM.SealedBox(combined: combined)
                try output.write(contentsOf: try AES.GCM.open(box, using: key))
            }
        }
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
    /// "Deleted for good": a delete date at the very start of 1970. Never in Recently Deleted,
    /// never visible, never restored, on every device that reads the journal.
    static let purgedMark = Date(timeIntervalSince1970: 1)

    static func isPurged(_ asset: LibraryAsset) -> Bool {
        guard let deleted = asset.deletedAt else { return false }
        return deleted.timeIntervalSince1970 < 10
    }

    static func merge(_ lines: [JournalLine]) -> [String: LibraryAsset] {
        let sorted = lines.sorted { lhs, rhs in
            if lhs.at != rhs.at { return lhs.at < rhs.at }
            if lhs.device != rhs.device { return lhs.device < rhs.device }
            return lhs.seq < rhs.seq
        }
        var result: [String: LibraryAsset] = [:]
        var purgedAt: [String: Date] = [:]
        var firstSeen: [String: (at: Date, device: String)] = [:]
        for line in sorted {
            let hash = line.asset.hash
            guard !hash.isEmpty else { continue }
            if firstSeen[hash] == nil { firstSeen[hash] = (line.at, line.device) }
            if let purged = purgedAt[hash], !isPurged(line.asset) {
                // Deleted for good stays deleted: a later line from a device that had not heard of
                // it yet (a favourite set on an old copy) must not bring it back. Only a new upload,
                // made on purpose after the purge, does.
                guard let uploaded = line.asset.uploadedAt, uploaded > purged else { continue }
                purgedAt[hash] = nil
            }
            result[hash] = line.asset
            if isPurged(line.asset) { purgedAt[hash] = line.at }
        }
        // Photos sent before uploads were signed: the first journal that named them, and when.
        for (hash, first) in firstSeen {
            guard var asset = result[hash], asset.uploadedAt == nil || asset.owner == nil else { continue }
            if asset.uploadedAt == nil { asset.uploadedAt = first.at }
            if asset.owner == nil { asset.owner = "device:" + first.device }
            result[hash] = asset
        }
        return result
    }

    /// In Recently Deleted until its owner deletes it for good (by hand or after the time they chose).
    static func isInTrash(_ asset: LibraryAsset, now: Date) -> Bool {
        asset.deletedAt != nil && !isPurged(asset)
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

/// The same "2026-10-21T21:04:34Z" text as JSONEncoder's `.iso8601`, written and read by hand.
/// `.iso8601` goes through ICU for every date; the catalogue has several dates per photo and is
/// read and written thousands of times while copying, which kept a CPU core busy (iOS flagged
/// GalleryOS for 90 s of CPU in 3 minutes). Anything unusual still falls back to ICU.
enum FastDate {
    private static let fallback: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        return formatter
    }()

    private static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static func string(_ date: Date) -> String {
        var seconds = time_t(floor(date.timeIntervalSince1970))
        var parts = tm()
        gmtime_r(&seconds, &parts)
        var bytes = [UInt8](repeating: 0, count: 20)
        func put(_ value: Int32, _ at: Int, _ width: Int) {
            var number = Int(value)
            for index in stride(from: at + width - 1, through: at, by: -1) {
                bytes[index] = UInt8(48 + number % 10)
                number /= 10
            }
        }
        put(parts.tm_year + 1900, 0, 4); bytes[4] = 45
        put(parts.tm_mon + 1, 5, 2); bytes[7] = 45
        put(parts.tm_mday, 8, 2); bytes[10] = 84
        put(parts.tm_hour, 11, 2); bytes[13] = 58
        put(parts.tm_min, 14, 2); bytes[16] = 58
        put(parts.tm_sec, 17, 2); bytes[19] = 90
        return String(decoding: bytes, as: UTF8.self)
    }

    static func date(_ text: String) -> Date? {
        if let quick = text.utf8.withContiguousStorageIfAvailable({ parse($0) }) ?? parse(Array(text.utf8)) {
            return quick
        }
        return fallback.date(from: text) ?? fractional.date(from: text)
    }

    /// yyyy-MM-ddTHH:mm:ssZ only.
    private static func parse<C: RandomAccessCollection>(_ b: C) -> Date? where C.Element == UInt8, C.Index == Int {
        guard b.count == 20 else { return nil }
        let s = b.startIndex
        func n(_ at: Int, _ width: Int) -> Int? {
            var value = 0
            for index in (s + at)..<(s + at + width) {
                let c = b[index]
                guard c >= 48, c <= 57 else { return nil }
                value = value * 10 + Int(c - 48)
            }
            return value
        }
        guard b[s + 4] == 45, b[s + 7] == 45, b[s + 10] == 84, b[s + 13] == 58, b[s + 16] == 58, b[s + 19] == 90,
              let year = n(0, 4), let month = n(5, 2), let day = n(8, 2),
              let hour = n(11, 2), let minute = n(14, 2), let second = n(17, 2),
              (1...12).contains(month), (1...31).contains(day), hour < 24, minute < 60, second < 61 else { return nil }
        // Days from 1970-01-01 (Howard Hinnant's civil calendar algorithm).
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (month + 9) % 12
        let doy = (153 * mp + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        let days = era * 146_097 + doe - 719_468
        let total = days * 86_400 + hour * 3_600 + minute * 60 + second
        return Date(timeIntervalSince1970: TimeInterval(total))
    }

    static let encoding: JSONEncoder.DateEncodingStrategy = .custom { date, encoder in
        var container = encoder.singleValueContainer()
        try container.encode(string(date))
    }

    static let decoding: JSONDecoder.DateDecodingStrategy = .custom { decoder in
        let container = try decoder.singleValueContainer()
        let text = try container.decode(String.self)
        guard let date = date(text) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Expected ISO 8601 date")
        }
        return date
    }
}

enum JournalCodec {
    static func encode(_ lines: [JournalLine]) -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = FastDate.encoding
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
        decoder.dateDecodingStrategy = FastDate.decoding
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
    static let needsHTTPS = L("Ten port wymaga połączenia szyfrowanego (HTTPS).")
    static let notGalleryServer = L("Pod tym adresem nie ma serwera GalleryOS.")

    static func message(for error: Error) -> String {
        if let library = error as? LibraryError { return readable(library.message) }
        if let url = error as? URLError {
            switch url.code {
            case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed:
                return L("Brak sieci")
            case .appTransportSecurityRequiresSecureConnection:
                return needsHTTPS
            case .timedOut, .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed, .secureConnectionFailed:
                return L("Serwer nie odpowiada. Sprawdź adres, port i czy jesteś w tej samej sieci.")
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
        if lower.contains("ssl-enabled") || lower.contains("speaking plain http") || lower.contains("use the https scheme") { // l10n:skip
            return needsHTTPS
        }
        if lower.contains("<html") || lower.contains("<!doctype") || lower.contains("<head") {
            return notGalleryServer
        }
        if status == 401 { return L("Błędny login lub hasło.") }
        return L("Serwer odrzucił połączenie (\(status)). Sprawdź adres i port.")
    }

    static func readable(_ text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        if lower.contains("ssl-enabled") || lower.contains("speaking plain http") || lower.contains("use the https scheme") { // l10n:skip
            return needsHTTPS
        }
        if lower.contains("<html") || lower.contains("<!doctype") || lower.contains("<head") {
            return L("Serwer odpowiedział stroną błędu. Sprawdź adres i port.")
        }
        if trimmed.isEmpty { return L("Nie udało się połączyć.") }
        if trimmed.count > 220 { return L("Nie udało się połączyć. Sprawdź adres, port i hasło.") }
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

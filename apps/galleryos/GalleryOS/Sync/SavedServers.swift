import Foundation

enum LinkMode: String {
    case auto
    case home
    case remote

    static var current: LinkMode {
        get { LinkMode(rawValue: UserDefaults.standard.string(forKey: "galleryos.link.mode") ?? "") ?? .auto }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: "galleryos.link.mode") }
    }
}

struct SavedServer: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var host: String
    var port: Int
    var username: String
    var directory: String
    var localHost: String
    var localPort: Int
    var localName: String
    var remoteHost: String
    var place: String
    var kind: String
    var online: Bool
    var lastSeen: Date

    var title: String {
        if !localName.isEmpty { return localName }
        if !remoteHost.isEmpty { return remoteHost }
        return host
    }
}

@MainActor
final class SavedServerStore: ObservableObject {
    static let shared = SavedServerStore()
    @Published private(set) var servers: [SavedServer] = []
    private let key = "galleryos.saved-servers.v1"

    private init() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([SavedServer].self, from: data) else { return }
        var seen = Set<String>()
        servers = decoded.filter { seen.insert($0.id).inserted }
    }

    var online: SavedServer? { servers.first { $0.online } }

    func remember(_ settings: DestinationSettings, online: Bool) {
        let identity = "\(settings.username.lowercased())@\(settings.remoteHost.isEmpty ? settings.host : settings.remoteHost)".lowercased()
        var next = servers.map { server -> SavedServer in
            var copy = server
            if online { copy.online = false }
            return copy
        }
        let record = SavedServer(
            id: identity,
            name: settings.localName.isEmpty ? (settings.remoteHost.isEmpty ? settings.host : settings.remoteHost) : settings.localName,
            host: settings.host,
            port: settings.port,
            username: settings.username,
            directory: settings.directory,
            localHost: settings.localHost,
            localPort: settings.localPort,
            localName: settings.localName,
            remoteHost: settings.remoteHost,
            place: settings.place,
            kind: settings.kind,
            online: online,
            lastSeen: .now
        )
        if let index = next.firstIndex(where: { $0.id == identity }) {
            next[index] = record
        } else {
            next.insert(record, at: 0)
        }
        servers = next
        persist()
        if let password = GalleryKeychain.string(account: "destination-password"), !password.isEmpty {
            try? GalleryKeychain.setShared(password, account: "server-\(identity)")
        }
        AccountVault.note(serverID: identity)
    }

    func use(_ server: SavedServer) async {
        if let password = GalleryKeychain.string(account: "server-\(server.id)"), !password.isEmpty {
            try? GalleryKeychain.set(password, account: "destination-password")
        }
        var settings = settings(for: server)
        settings.connected = false
        settings.save()
        AccountVault.note(serverID: server.id)
        _ = try? await LibraryEngine.shared.connect()
    }

    func mark(online: Bool) {
        guard var current = servers.first(where: { $0.online }) ?? servers.first else { return }
        servers = servers.map { server in
            var copy = server
            copy.online = online && server.id == current.id
            return copy
        }
        current.online = online
        persist()
    }

    func settings(for server: SavedServer) -> DestinationSettings {
        DestinationSettings(
            place: server.place,
            kind: server.kind,
            host: server.host,
            port: server.port,
            username: server.username,
            directory: server.directory,
            folderName: "",
            connected: server.online,
            localHost: server.localHost,
            localPort: server.localPort,
            localName: server.localName,
            remoteHost: server.remoteHost
        )
    }

    func server(id: String) -> SavedServer? {
        servers.first { $0.id == id }
    }

    func password(for server: SavedServer) -> String? {
        GalleryKeychain.string(account: "server-\(server.id)")
    }

    func remove(_ server: SavedServer) {
        servers.removeAll { $0.id == server.id }
        persist()
        GalleryKeychain.remove(account: "server-\(server.id)")
    }

    /// Learns the in-home address for the active server so the next arrival switches to LAN instantly.
    func rememberHome(host: String, port: Int, name: String) {
        var settings = DestinationSettings.load()
        guard settings.connected else { return }
        settings.localHost = host
        settings.localPort = port
        settings.localName = name
        settings.save()
        remember(settings, online: true)
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(servers) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

enum AccountVault {
    private static func key(for account: String) -> String {
        "galleryos.account-server.\(account.lowercased())"
    }

    static func note(serverID: String) {
        let account = UserDefaults.standard.string(forKey: "galleryos.people-name") ?? ""
        guard !account.isEmpty else { return }
        UserDefaults.standard.set(serverID, forKey: key(for: account))
    }

    private static var restoring = false

    static func restoreIfNeeded() async {
        guard !restoring else { return }
        restoring = true
        defer { restoring = false }
        let current = DestinationSettings.load()
        let ready = current.connected && !current.host.isEmpty && current.kind != DestinationKind.none
        guard !ready else { return }
        let accountName = UserDefaults.standard.string(forKey: "galleryos.people-name") ?? ""
        guard !accountName.isEmpty else { return }
        var restored: DestinationSettings?
        var identity = ""
        if let id = UserDefaults.standard.string(forKey: key(for: accountName)),
           let server = await SavedServerStore.shared.server(id: id) {
            restored = await SavedServerStore.shared.settings(for: server)
            identity = id
        } else if let remote = await ShareAccount.shared.pullLibrary() {
            restored = remote
            identity = "\(remote.username.lowercased())@\(remote.remoteHost.isEmpty ? remote.host : remote.remoteHost)".lowercased()
        }
        guard var settings = restored else { return }
        settings.connected = false
        settings.save()
        let password = GalleryKeychain.string(account: "server-\(identity)")
            ?? GalleryKeychain.string(account: "destination-password")
        guard let password, !password.isEmpty else {
            await SavedServerStore.shared.remember(settings, online: false)
            await MainActor.run { ShareAccount.shared.needsPassword = true }
            return
        }
        try? GalleryKeychain.set(password, account: "destination-password")
        do {
            _ = try await LibraryEngine.shared.connect()
            await MainActor.run { ShareAccount.shared.needsPassword = false }
        } catch {
            await SavedServerStore.shared.remember(settings, online: false)
            await MainActor.run { ShareAccount.shared.needsPassword = true }
        }
    }
}

struct SpareDisk: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var bookmark: Data
}

@MainActor
final class SpareDisks: ObservableObject {
    static let shared = SpareDisks()
    @Published private(set) var disks: [SpareDisk] = []
    @Published private(set) var targetID: String = "server"
    private let file: URL
    private let targetKey = "galleryos.backup.target"

    private init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let folder = base.appendingPathComponent("GalleryOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        file = folder.appendingPathComponent("disks.json")
        if let data = try? Data(contentsOf: file),
           let stored = try? JSONDecoder().decode([SpareDisk].self, from: data) {
            disks = stored
        }
        targetID = UserDefaults.standard.string(forKey: targetKey) ?? "server"
        if targetID != "server", disks.contains(where: { $0.id == targetID }) == false {
            targetID = "server"
        }
    }

    func bookmarkForCopy() -> Data? {
        guard targetID != "server" else { return nil }
        return disks.first { $0.id == targetID }?.bookmark
    }

    func add(data: Data, name: String) -> String? {
        disks.append(SpareDisk(id: UUID().uuidString, name: name, bookmark: data))
        persist()
        return nil
    }

    func selectServer() {
        targetID = "server"
        UserDefaults.standard.set(targetID, forKey: targetKey)
    }

    func select(_ id: String) {
        guard disks.contains(where: { $0.id == id }) else { return }
        targetID = id
        UserDefaults.standard.set(targetID, forKey: targetKey)
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(disks) {
            try? data.write(to: file, options: .atomic)
        }
    }
}

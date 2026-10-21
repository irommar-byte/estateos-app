import Foundation

enum TVProfileStore {
    private static let key = "galleryos.tv.server.v1"
    private static let passwordAccount = "tv-password"

    static func load() -> (server: AppleTVServer, password: String)? {
        guard let data = UserDefaults.standard.data(forKey: key),
              let server = try? JSONDecoder().decode(AppleTVServer.self, from: data),
              let password = GalleryKeychain.string(account: passwordAccount) else { return nil }
        return (server, password)
    }

    static func save(_ server: AppleTVServer, password: String) {
        if let data = try? JSONEncoder().encode(server) {
            UserDefaults.standard.set(data, forKey: key)
        }
        try? GalleryKeychain.set(password, account: passwordAccount)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
        GalleryKeychain.remove(account: passwordAccount)
    }
}

/// How the Apple TV reached the library: over the home network or over the internet.
enum TVLinkRoute: Equatable {
    case home(String)
    case remote(String)
}

struct TVConnection {
    let transport: CatalogTransport
    let route: TVLinkRoute
}

/// Opens a transport for the server that was paired with the Apple TV.
enum TVConnector {
    static func connect(_ server: AppleTVServer, password: String) async throws -> TVConnection {
        switch server.kind {
        case DestinationKind.server:
            let transport = try await ServerTransport.login(
                host: server.host,
                port: server.port,
                username: server.username,
                password: password
            )
            let route: TVLinkRoute = isPrivate(server.host) ? .home(server.host) : .remote(server.host)
            return TVConnection(transport: transport, route: route)
        case DestinationKind.webdav:
            if !server.localHost.isEmpty {
                do {
                    let nearby = try await WebDAVTransport.open(
                        remoteHost: "",
                        localHost: server.localHost,
                        localPort: server.localPort,
                        localName: server.localName,
                        forcedPort: 0,
                        username: server.username,
                        password: password,
                        directory: server.directory
                    )
                    let name = server.localName.isEmpty ? server.localHost : server.localName
                    return TVConnection(transport: nearby.transport, route: .home(name))
                } catch {
                    let text = SyncPause.message(for: error)
                    if text.contains("hasło") || text.contains("dostępu") { throw error }
                }
            }
            let remote = server.remoteHost.isEmpty ? server.host : server.remoteHost
            // The LAN port (QNAP 5000) is usually not forwarded, so never force it over DDNS.
            let lanPortOnly = server.localPort > 0 && server.port == server.localPort && !server.remoteHost.isEmpty
            let link = try await WebDAVTransport.open(
                remoteHost: remote,
                localHost: "",
                localPort: 0,
                localName: "",
                forcedPort: lanPortOnly ? 0 : server.port,
                username: server.username,
                password: password,
                directory: server.directory
            )
            return TVConnection(transport: link.transport, route: .remote(remote))
        default:
            throw LibraryError(message: "Ten typ miejsca nie jest jeszcze dostępny na Apple TV. Wybierz na iPhonie serwer GalleryOS albo QNAP.")
        }
    }

    static func isPrivate(_ host: String) -> Bool {
        let value = host.lowercased()
        if value.hasSuffix(".local") || value == "localhost" { return true }
        let parts = value.split(separator: ".").compactMap { Int($0) }
        guard parts.count == 4 else { return false }
        if parts[0] == 10 || (parts[0] == 192 && parts[1] == 168) { return true }
        return parts[0] == 172 && (16...31).contains(parts[1])
    }
}

@MainActor
final class TVSession: ObservableObject {
    enum State: Equatable {
        case checking
        case needsPairing
        case ready
        case locked
    }

    @Published private(set) var state: State = .checking
    @Published private(set) var server: AppleTVServer?
    let library = TVLibrary()
    private var started = false
    private var cloudWatcher: NSObjectProtocol?

    func start() async {
        guard !started else { return }
        started = true
        if ProcessInfo.processInfo.arguments.contains("-TVPreview") {
            server = AppleTVServer(
                id: "preview", title: "TS253D", kind: DestinationKind.webdav,
                host: "rommar.myqnapcloud.com", port: 5001, username: "gallery",
                directory: "GalleryOS", localHost: "192.168.50.50", localPort: 5000,
                localName: "TS253D", remoteHost: "rommar.myqnapcloud.com"
            )
            state = .ready
            library.loadPreview()
            let args = ProcessInfo.processInfo.arguments
            if let index = args.firstIndex(of: "-TVTab"), args.indices.contains(args.index(after: index)) {
                UserDefaults.standard.set(args[args.index(after: index)], forKey: "galleryos.tv.preview-tab")
            }
            if let index = args.firstIndex(of: "-TVZoom"), args.indices.contains(args.index(after: index)),
               let zoom = Int(args[args.index(after: index)]) {
                UserDefaults.standard.set(zoom, forKey: "galleryos.tv.zoom")
            }
            return
        }
        GalleryAccess.noteStartIfNeeded()
        guard GalleryAccess.allowed() else {
            state = .locked
            return
        }
        if let saved = TVProfileStore.load() {
            adopt(saved.server, password: saved.password, persist: false)
            return
        }
        NSUbiquitousKeyValueStore.default.synchronize()
        if adoptFromCloud() { return }
        state = .needsPairing
        cloudWatcher = NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.state == .needsPairing else { return }
                _ = self.adoptFromCloud()
            }
        }
        Task { @MainActor [weak self] in
            while let self, self.state == .needsPairing, !Task.isCancelled {
                NSUbiquitousKeyValueStore.default.synchronize()
                if self.adoptFromCloud() { break }
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    @discardableResult
    private func adoptFromCloud() -> Bool {
        guard let cloud = CloudServerShare.load(), cloud.server.isSupportedOnTV else { return false }
        adopt(cloud.server, password: cloud.password, persist: true)
        return true
    }

    func adopt(_ server: AppleTVServer, password: String, persist: Bool = true) {
        if persist { TVProfileStore.save(server, password: password) }
        self.server = server
        state = .ready
        library.start(server: server, password: password)
    }

    func forget() {
        library.stop()
        TVProfileStore.clear()
        server = nil
        state = .needsPairing
    }
}

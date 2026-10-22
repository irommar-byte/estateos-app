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
                    if text.contains(L("hasło")) || text.contains(L("dostępu")) { throw error }
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
            throw LibraryError(message: L("Ten typ miejsca nie jest jeszcze dostępny na Apple TV. Wybierz na iPhonie serwer GalleryOS albo QNAP."))
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
    /// What the pairing screen says about iCloud while it waits for the iPhone.
    @Published private(set) var cloudNote = ""
    let library = TVLibrary()
    private var started = false
    private var cloudWatcher: NSObjectProtocol?
    private var accessWatcher: NSObjectProtocol?
    private var accessTicker: Task<Void, Never>?
    private var previewing = false

    func start() async {
        guard !started else { return }
        started = true
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-TVPreview") {
            server = AppleTVServer(
                id: "preview", title: "TS253D", kind: DestinationKind.webdav,
                host: "rommar.myqnapcloud.com", port: 5001, username: "gallery",
                directory: "GalleryOS", localHost: "192.168.50.50", localPort: 5000,
                localName: "TS253D", remoteHost: "rommar.myqnapcloud.com"
            )
            previewing = true
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
        #endif
        UserDefaults.standard.removeObject(forKey: Self.forgottenKey)
        NSUbiquitousKeyValueStore.default.synchronize()
        GalleryAccess.noteStartIfNeeded()
        await TVMembership.shared.refresh()
        watchAccess()
        guard GalleryAccess.allowed() else {
            lock()
            return
        }
        boot()
    }

    /// Runs whenever the app comes back to the screen: a plan bought on the iPhone (or here)
    /// opens the library without relaunching, and an expired one closes it.
    func recheckAccess(storeKit: Bool = true) async {
        guard started, !previewing else { return }
        if storeKit { await TVMembership.shared.refresh() }
        NSUbiquitousKeyValueStore.default.synchronize()
        let allowed = GalleryAccess.allowed()
        if state == .locked {
            if allowed { boot() }
        } else if !allowed {
            lock()
        }
    }

    private func lock() {
        library.stop()
        state = .locked
    }

    /// Always on, not only on the locked screen: the free days can end while the library is
    /// open, and the iPhone's trial simulation or a purchase arrives through iCloud.
    private func watchAccess() {
        guard accessWatcher == nil else { return }
        accessWatcher = NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in await self?.recheckAccess(storeKit: false) }
        }
        accessTicker = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 20_000_000_000)
                await self?.recheckAccess(storeKit: false)
            }
        }
    }

    private func boot() {
        if let saved = TVProfileStore.load() {
            adopt(saved.server, password: saved.password, persist: false)
            return
        }
        NSUbiquitousKeyValueStore.default.synchronize()
        if adoptFromCloud() { return }
        state = .needsPairing
        watchCloud()
    }

    /// While pairing is open, a server the iPhone publishes to iCloud is picked up by itself.
    private func watchCloud() {
        if cloudWatcher == nil {
            cloudWatcher = NotificationCenter.default.addObserver(
                forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor in
                    guard let self, self.state == .needsPairing else { return }
                    if self.adoptFromCloud() { return }
                    _ = await self.adoptFromSeal()
                }
            }
        }
        Task { @MainActor [weak self] in
            var tick = 0
            while let self, self.state == .needsPairing, !Task.isCancelled {
                NSUbiquitousKeyValueStore.default.synchronize()
                if self.adoptFromCloud() { break }
                // tvOS never receives iCloud Keychain items, so the password comes either sealed
                // in Key-Value Storage or from the private CloudKit record.
                if tick % 2 == 0, await self.adoptFromSeal() { break }
                if tick % 4 == 0, await self.adoptFromVault() { break }
                if tick % 5 == 0 { await self.diagnose() }
                tick += 1
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    private func adoptFromSeal() async -> Bool {
        guard let sealed = await CloudSeal.open(), sealed.server.isSupportedOnTV,
              sealed.server.id != forgottenID,
              state == .needsPairing else { return false }
        adopt(sealed.server, password: sealed.password, persist: true)
        return true
    }

    /// Plain words on the pairing screen: why Apple TV has not connected by itself yet.
    private func diagnose() async {
        guard state == .needsPairing else { return }
        if let problem = await CloudServerVault.accountProblem() {
            cloudNote = problem + L(" Ustawienia → Użytkownicy i konta → iCloud.")
            return
        }
        let store = NSUbiquitousKeyValueStore.default
        if CloudSeal.present {
            cloudNote = L("Dane serwera z iPhone’a już są – odczytuję je z iCloud…")
            return
        }
        if case .failed(let reason) = await CloudServerVault.fetch() {
            cloudNote = reason
            return
        }
        if store.data(forKey: CloudServerShare.profileKey) != nil {
            cloudNote = L("Serwer z iPhone’a już jest, czekam na zaszyfrowane hasło. Otwórz GalleryOS na iPhonie.")
        } else {
            cloudNote = L("iCloud działa. Otwórz GalleryOS na iPhonie z tym samym Apple ID i włącz Apple TV w menu synchronizacji.")
        }
    }

    private func adoptFromVault() async -> Bool {
        guard let vault = await CloudServerVault.load(), vault.server.isSupportedOnTV,
              vault.server.id != forgottenID,
              state == .needsPairing else { return false }
        adopt(vault.server, password: vault.password, persist: true)
        return true
    }

    @discardableResult
    private func adoptFromCloud() -> Bool {
        guard let cloud = CloudServerShare.load(), cloud.server.isSupportedOnTV,
              cloud.server.id != forgottenID else { return false }
        adopt(cloud.server, password: cloud.password, persist: true)
        return true
    }

    /// The iCloud server the viewer chose to forget: it must not come straight back.
    /// Older builds kept it for good, so after one "forget" Apple TV never paired by itself again.
    private static let forgottenKey = "galleryos.tv.forgotten-cloud-id"
    /// Only until the app is closed: after a relaunch the iPhone's server is welcome again.
    private var forgottenID: String?

    func adopt(_ server: AppleTVServer, password: String, persist: Bool = true) {
        if persist { TVProfileStore.save(server, password: password) }
        forgottenID = nil
        self.server = server
        cloudNote = ""
        state = .ready
        library.start(server: server, password: password)
    }

    func forget() {
        library.stop()
        TVProfileStore.clear()
        forgottenID = server?.id
        server = nil
        state = .needsPairing
        watchCloud()
    }
}

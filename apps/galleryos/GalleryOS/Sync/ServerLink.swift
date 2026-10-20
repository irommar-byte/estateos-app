import Foundation
import Network
import SwiftUI

enum LinkRoute: String, Equatable {
    case none
    case home
    case remote

    var title: String {
        switch self {
        case .home: "Sieć domowa"
        case .remote: "Zdalnie"
        case .none: "Szukam serwera"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house.fill"
        case .remote: "globe"
        case .none: "dot.radiowaves.left.and.right"
        }
    }

    var tint: Color {
        switch self {
        case .home: Color(red: 0.2, green: 0.78, blue: 0.45)
        case .remote: Color(red: 0.3, green: 0.58, blue: 1.0)
        case .none: Color(red: 1.0, green: 0.78, blue: 0.16)
        }
    }
}

enum LinkPhase: Equatable {
    case idle
    case connecting(LinkRoute)
    case connected(LinkRoute)
    case offline
    case unreachable(String)
}

enum NetworkKind: String {
    case unknown, none, wifi, wired, cellular, other

    var title: String {
        switch self {
        case .wifi: "Wi-Fi"
        case .wired: "Ethernet"
        case .cellular: "Sieć komórkowa"
        case .none: "Brak sieci"
        case .other: "Sieć"
        case .unknown: "Sprawdzam sieć"
        }
    }

    var symbol: String {
        switch self {
        case .wifi: "wifi"
        case .wired: "cable.connector"
        case .cellular: "antenna.radiowaves.left.and.right"
        case .none: "wifi.slash"
        case .other, .unknown: "network"
        }
    }

    var isLocal: Bool { self == .wifi || self == .wired }
}

struct LinkProbe: Equatable {
    var reachable: Bool?
    var millis: Int?
    var checking = false
}

struct LinkAnnouncement: Equatable, Identifiable {
    let id = UUID()
    let route: LinkRoute
    let title: String
    let detail: String
    var symbol: String?
    var tint: Color?
}

/// Decides between the home LAN and the DDNS address of the same server, follows the phone between
/// networks and publishes which route is live so every screen can show it.
@MainActor
final class ServerLink: ObservableObject {
    static let shared = ServerLink()

    @Published private(set) var phase: LinkPhase = .idle
    @Published private(set) var host = ""
    @Published private(set) var network = NetworkKind.unknown
    @Published private(set) var home = LinkProbe()
    @Published private(set) var remote = LinkProbe()
    @Published private(set) var learning = false
    @Published var announcement: LinkAnnouncement?

    private(set) var routeDirty = false
    private let monitor = NWPathMonitor()
    private var fingerprint = ""
    private var gateway = ""
    private var settle: Task<Void, Never>?
    private var away: [String: Date] = [:]
    private var lastRoute = LinkRoute.none
    private var lastLearn: Date?
    private let homeKey = "galleryos.home-networks"

    var route: LinkRoute {
        if case .connected(let route) = phase { return route }
        return .none
    }

    var isConnecting: Bool {
        if case .connecting = phase { return true }
        return false
    }

    var onKnownHomeNetwork: Bool {
        network.isLocal && !gateway.isEmpty && homeNetworks.contains(gateway)
    }

    private var homeNetworks: [String] {
        get { UserDefaults.standard.stringArray(forKey: homeKey) ?? [] }
        set { UserDefaults.standard.set(Array(newValue.suffix(6)), forKey: homeKey) }
    }

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let kind: NetworkKind
            if path.status != .satisfied {
                kind = .none
            } else if path.usesInterfaceType(.wifi) {
                kind = .wifi
            } else if path.usesInterfaceType(.wiredEthernet) {
                kind = .wired
            } else if path.usesInterfaceType(.cellular) {
                kind = .cellular
            } else {
                kind = .other
            }
            let gateways = path.gateways.map { "\($0)" }.sorted().joined(separator: ",")
            Task { @MainActor in self?.pathChanged(kind: kind, gateways: gateways) }
        }
        monitor.start(queue: DispatchQueue(label: "galleryos.link"))
        if DestinationSettings.load().connected { phase = .connecting(.none) }
    }

    private var started = false

    /// Resolves the route once at launch so the indicator is right even when nothing is uploading.
    func start() {
        guard !started else { return }
        started = true
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2))
            guard DestinationSettings.load().connected else {
                phase = .idle
                return
            }
            if case .connected = phase { return }
            await LibraryEngine.shared.checkRoute()
        }
    }

    // MARK: Network changes

    private func pathChanged(kind: NetworkKind, gateways: String) {
        network = kind
        gateway = kind.isLocal ? gateways : ""
        let next = "\(kind.rawValue)|\(gateways)"
        guard next != fingerprint else { return }
        let first = fingerprint.isEmpty
        fingerprint = next
        guard !first else { return }
        routeDirty = true
        home = LinkProbe()
        remote = LinkProbe()
        guard DestinationSettings.load().connected else { return }
        if kind == .none {
            phase = .offline
            return
        }
        withAnimation(GalleryTheme.snappy) { phase = .connecting(.none) }
        settle?.cancel()
        settle = Task { @MainActor in
            try? await Task.sleep(for: .seconds(1.2))
            guard !Task.isCancelled else { return }
            LibraryEngine.shared.reroute()
        }
    }

    /// Whether the engine should try the LAN address first.
    func shouldTryHome(_ mode: LinkMode, hasLocal: Bool) -> Bool {
        guard hasLocal else { return false }
        switch mode {
        case .home: return true
        case .remote: return false
        case .auto:
            guard network.isLocal || network == .unknown else { return false }
            if onKnownHomeNetwork { return true }
            if let failed = away[gateway], Date().timeIntervalSince(failed) < 600 { return false }
            return true
        }
    }

    // MARK: Engine reports

    func attempt(_ route: LinkRoute) {
        if case .connected(let current) = phase, current == route, !routeDirty { return }
        if case .connecting(let current) = phase, current == route { return }
        withAnimation(GalleryTheme.snappy) { phase = .connecting(route) }
    }

    func established(_ route: LinkRoute, host: String, millis: Int? = nil) {
        routeDirty = false
        if route == .home {
            away.removeValue(forKey: gateway)
            if !gateway.isEmpty, !homeNetworks.contains(gateway) {
                homeNetworks = homeNetworks + [gateway]
            }
            let probe = LinkProbe(reachable: true, millis: millis ?? home.millis)
            if home != probe { home = probe }
        } else if route == .remote {
            let probe = LinkProbe(reachable: true, millis: millis ?? remote.millis)
            if remote != probe { remote = probe }
        }
        let switched = lastRoute != .none && lastRoute != route
        lastRoute = route
        if self.host != host { self.host = host }
        if phase != .connected(route) {
            withAnimation(GalleryTheme.snappy) { phase = .connected(route) }
        }
        if switched {
            announce(route, host: host)
        }
        if route == .remote { learnHomeIfNeeded() }
    }

    func homeFailed() {
        if !gateway.isEmpty { away[gateway] = .now }
        let probe = LinkProbe(reachable: false, millis: nil)
        if home != probe { home = probe }
    }

    func failed(_ message: String) {
        let next: LinkPhase = network == .none ? .offline : .unreachable(message)
        guard phase != next else { return }
        withAnimation(GalleryTheme.snappy) { phase = next }
    }

    func reset() {
        routeDirty = true
        lastRoute = .none
        host = ""
        home = LinkProbe()
        remote = LinkProbe()
        phase = DestinationSettings.load().connected ? .connecting(.none) : .idle
    }

    private func announce(_ route: LinkRoute, host: String) {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        let title = route == .home ? "Jesteś w domu" : "Połączenie zdalne"
        let detail = route == .home ? "Sieć lokalna · \(host)" : "DDNS · \(host)"
        withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
            announcement = LinkAnnouncement(route: route, title: title, detail: detail)
        }
    }

    /// Drops the same glass pill for non-route news, e.g. the queue reaching 100 %.
    func announce(_ title: String, detail: String, symbol: String, tint: Color) {
        guard UIApplication.shared.applicationState == .active else { return }
        withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
            announcement = LinkAnnouncement(route: route, title: title, detail: detail, symbol: symbol, tint: tint)
        }
    }

    // MARK: Diagnostics

    func probeAll() async {
        let settings = DestinationSettings.load()
        guard settings.connected, settings.kind == DestinationKind.webdav else { return }
        let password = GalleryKeychain.string(account: "destination-password") ?? ""
        let localPort = settings.localPort > 0 ? settings.localPort : settings.port
        let remoteHost = settings.remoteHost.isEmpty ? settings.host : settings.remoteHost
        withAnimation(GalleryTheme.snappy) {
            home.checking = !settings.localHost.isEmpty && network.isLocal
            remote.checking = !remoteHost.isEmpty
        }
        let checkHome = !settings.localHost.isEmpty && network.isLocal
        async let homeResult: (ok: Bool, auth: Bool, millis: Int)? = !checkHome ? nil
            : WebDAVTransport.reach(host: settings.localHost, port: localPort, username: settings.username, password: password, timeout: 2.5)
        async let remoteResult: (ok: Bool, auth: Bool, millis: Int)? = remoteHost.isEmpty ? nil
            : WebDAVTransport.reach(host: remoteHost, port: settings.remotePort, username: settings.username, password: password, timeout: 10)
        let (h, r) = await (homeResult, remoteResult)
        withAnimation(GalleryTheme.snappy) {
            home = h.map { LinkProbe(reachable: $0.ok, millis: $0.ok ? $0.millis : nil) } ?? LinkProbe()
            remote = r.map { LinkProbe(reachable: $0.ok, millis: $0.ok ? $0.millis : nil) } ?? LinkProbe()
        }
        if h?.ok == true, route == .remote {
            routeDirty = true
            LibraryEngine.shared.reroute()
        }
    }

    // MARK: Home discovery

    /// While connected over DDNS on Wi-Fi, look for the same server on the LAN and remember it.
    func learnHomeIfNeeded(force: Bool = false) {
        guard !learning else { return }
        let settings = DestinationSettings.load()
        guard settings.connected, settings.kind == DestinationKind.webdav else { return }
        guard force || settings.localHost.isEmpty else { return }
        guard network.isLocal else { return }
        if !force, let lastLearn, Date().timeIntervalSince(lastLearn) < 1800 { return }
        lastLearn = .now
        learning = true
        Task { @MainActor in
            let found = await discoverHome(settings)
            learning = false
            if found {
                routeDirty = true
                LibraryEngine.shared.reroute()
            }
        }
    }

    private func discoverHome(_ settings: DestinationSettings) async -> Bool {
        let browser = NearbyPlaces()
        browser.start()
        try? await Task.sleep(for: .seconds(4))
        let places = browser.places
        browser.stop()
        let order = ["_webdavs._tcp.", "_webdav._tcp.", "_https._tcp.", "_http._tcp."]
        var seen = Set<String>()
        let candidates = places
            .filter { place in
                let name = place.name.lowercased()
                return !place.kind.contains("smb") && !name.contains("print") && !name.contains("laser")
            }
            .sorted { (order.firstIndex(of: $0.kind) ?? 9) < (order.firstIndex(of: $1.kind) ?? 9) }
            .filter { seen.insert($0.host.lowercased()).inserted }
        let password = GalleryKeychain.string(account: "destination-password") ?? ""
        let journal = CatalogPaths.journal(device: GalleryKeychain.deviceID())
        for place in candidates.prefix(6) {
            let webdav = place.kind.contains("webdav")
            guard let link = try? await WebDAVTransport.open(
                remoteHost: "",
                localHost: place.host,
                localPort: webdav ? place.port : 0,
                localName: place.name,
                forcedPort: 0,
                username: settings.username,
                password: password,
                directory: settings.directory
            ) else { continue }
            let same = (try? await link.transport.exists(journal)) == true
            await link.transport.close()
            guard same else { continue }
            SavedServerStore.shared.rememberHome(host: link.host, port: link.port, name: place.name)
            if !gateway.isEmpty, !homeNetworks.contains(gateway) {
                homeNetworks = homeNetworks + [gateway]
            }
            return true
        }
        return false
    }

    /// Forget the LAN address and the remembered home networks.
    func forgetHome() {
        homeNetworks = []
        var settings = DestinationSettings.load()
        settings.localHost = ""
        settings.localPort = 0
        settings.localName = ""
        settings.save()
        SavedServerStore.shared.remember(settings, online: settings.connected)
        home = LinkProbe()
        routeDirty = true
        LibraryEngine.shared.reroute()
    }
}

import Foundation

struct DiscoveredNasServer: Identifiable, Hashable {
    let id: String
    let displayName: String
    let host: String
    let port: Int
    let serviceType: String
    let serviceLabel: String

    var webDAVPort: Int {
        QnapWebDAVDefaults.suggestedPort(forServiceType: serviceType, discoveredPort: port)
    }

    var subtitle: String {
        if serviceType == "_smb._tcp." {
            return "\(host) · WebDAV :\(webDAVPort) (wykryto SMB :\(port))"
        }
        return "\(host):\(webDAVPort) · \(serviceLabel)"
    }
}

@MainActor
final class QnapDiscoveryService: NSObject, ObservableObject {
    @Published private(set) var servers: [DiscoveredNasServer] = []
    @Published private(set) var isSearching = false

    private var browsers: [NetServiceBrowser] = []
    private var resolving: [NetService] = []
    private var searchTask: Task<Void, Never>?

    private let serviceTypes = [
        "_webdavs._tcp.",
        "_webdav._tcp.",
        "_https._tcp.",
        "_http._tcp.",
        "_smb._tcp.",
    ]

    func start() {
        stop()
        isSearching = true
        servers = []

        for type in serviceTypes {
            let browser = NetServiceBrowser()
            browser.delegate = self
            browser.includesPeerToPeer = true
            browser.searchForServices(ofType: type, inDomain: "local.")
            browsers.append(browser)
        }

        searchTask = Task {
            try? await Task.sleep(nanoseconds: 8_000_000_000)
            if !Task.isCancelled { stop() }
        }
    }

    func stop() {
        searchTask?.cancel()
        searchTask = nil
        browsers.forEach { $0.stop() }
        browsers = []
        resolving.forEach { $0.stop() }
        resolving = []
        isSearching = false
    }

    private func addServer(_ server: DiscoveredNasServer) {
        // Jedno urządzenie — preferuj wpis WebDAV nad SMB/HTTP.
        if let existingIndex = servers.firstIndex(where: { $0.host == server.host }) {
            let existing = servers[existingIndex]
            if Self.servicePriority(server.serviceType) > Self.servicePriority(existing.serviceType) {
                servers[existingIndex] = server
            }
            return
        }
        servers.append(server)
        servers.sort {
            if Self.servicePriority($0.serviceType) != Self.servicePriority($1.serviceType) {
                return Self.servicePriority($0.serviceType) > Self.servicePriority($1.serviceType)
            }
            return $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending
        }
    }

    private static func servicePriority(_ type: String) -> Int {
        switch type {
        case "_webdavs._tcp.": return 5
        case "_webdav._tcp.": return 4
        case "_https._tcp.": return 3
        case "_http._tcp.": return 2
        case "_smb._tcp.": return 1
        default: return 0
        }
    }

    private static func serviceLabel(for type: String) -> String {
        switch type {
        case "_webdavs._tcp.": return "WebDAV (HTTPS)"
        case "_webdav._tcp.": return "WebDAV"
        case "_https._tcp.": return "HTTPS"
        case "_http._tcp.": return "HTTP"
        case "_smb._tcp.": return "SMB"
        default: return type.replacingOccurrences(of: "._tcp.", with: "")
        }
    }

    private static func cleanHost(_ host: String) -> String {
        var value = host
        if value.hasSuffix(".") { value.removeLast() }
        return value
    }

    private static func displayName(from serviceName: String) -> String {
        serviceName.replacingOccurrences(of: "\\032", with: " ")
    }

    private static func shouldInclude(displayName: String, serviceType: String) -> Bool {
        let lower = displayName.lowercased()
        if lower.contains("laserjet") || lower.contains("printer") || lower.contains("npi") { return false }
        if lower.hasPrefix("hp ") || lower.contains(" hp ") { return false }
        return true
    }
}

extension QnapDiscoveryService: NetServiceBrowserDelegate {
    nonisolated func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        Task { @MainActor in
            service.delegate = self
            resolving.append(service)
            service.resolve(withTimeout: 5)
        }
    }

    nonisolated func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch error: [String: NSNumber]) {
        Task { @MainActor in
            // Kontynuuj inne przeglądarki — część typów może być niedostępna.
        }
    }
}

extension QnapDiscoveryService: NetServiceDelegate {
    nonisolated func netServiceDidResolveAddress(_ sender: NetService) {
        let name = sender.name
        let type = sender.type
        let port = sender.port
        let hostName = sender.hostName

        Task { @MainActor in
            defer { resolving.removeAll { $0 === sender } }

            guard let hostName, port > 0 else { return }
            let host = Self.cleanHost(hostName)
            let label = Self.serviceLabel(for: type)
            let display = Self.displayName(from: name)

            guard Self.shouldInclude(displayName: display, serviceType: type) else { return }

            addServer(DiscoveredNasServer(
                id: "\(host):\(type)",
                displayName: display,
                host: host,
                port: port,
                serviceType: type,
                serviceLabel: label
            ))
        }
    }

    nonisolated func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
        Task { @MainActor in
            resolving.removeAll { $0 === sender }
        }
    }
}

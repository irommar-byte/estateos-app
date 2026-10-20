import Foundation

struct NearbyPlace: Identifiable, Hashable {
    var id: String { "\(kind)-\(host)-\(port)" }
    var name: String
    var host: String
    var port: Int
    var kind: String
}

final class NearbyPlaces: NSObject, ObservableObject, NetServiceBrowserDelegate, NetServiceDelegate {
    @Published private(set) var places: [NearbyPlace] = []
    private var browsers: [NetServiceBrowser] = []
    private var resolving: [NetService] = []

    func start() {
        guard browsers.isEmpty else { return }
        for type in ["_webdavs._tcp.", "_webdav._tcp.", "_https._tcp.", "_http._tcp.", "_smb._tcp."] {
            let browser = NetServiceBrowser()
            browser.delegate = self
            browser.searchForServices(ofType: type, inDomain: "local.")
            browsers.append(browser)
        }
    }

    func stop() {
        browsers.forEach { $0.stop() }
        browsers.removeAll()
        resolving.removeAll()
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        service.delegate = self
        resolving.append(service)
        service.resolve(withTimeout: 4)
    }

    func netServiceDidResolveAddress(_ sender: NetService) {
        let host = (sender.hostName ?? sender.name).trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let place = NearbyPlace(name: sender.name, host: host, port: sender.port, kind: sender.type)
        DispatchQueue.main.async {
            guard !self.places.contains(where: { $0.id == place.id }) else { return }
            self.places.append(place)
        }
        resolving.removeAll { $0 === sender }
    }
}

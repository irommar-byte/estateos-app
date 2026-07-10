import Foundation

/// URLSession akceptujący self-signed certyfikaty NAS w sieci lokalnej (.local / prywatne IP).
final class LocalNetworkURLSession: NSObject, URLSessionDelegate, @unchecked Sendable {
    static let shared = LocalNetworkURLSession()

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 12
        config.timeoutIntervalForResource = 20
        config.waitsForConnectivity = false
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await session.data(for: request)
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        let host = challenge.protectionSpace.host
        guard Self.isLocalHost(host) else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let trust = challenge.protectionSpace.serverTrust {
            completionHandler(.useCredential, URLCredential(trust: trust))
            return
        }

        completionHandler(.performDefaultHandling, nil)
    }

    static func isLocalHost(_ host: String) -> Bool {
        let lower = host.lowercased()
        if lower.hasSuffix(".local") { return true }
        if lower == "localhost" { return true }
        return isPrivateIPv4(lower)
    }

    private static func isPrivateIPv4(_ host: String) -> Bool {
        let parts = host.split(separator: ".").compactMap { Int($0) }
        guard parts.count == 4 else { return false }
        switch parts[0] {
        case 10: return true
        case 172: return parts[1] >= 16 && parts[1] <= 31
        case 192: return parts[1] == 168
        default: return false
        }
    }
}

enum QnapWebDAVDefaults {
    /// Kolejność prób dla typowego QNAP (WebDAV, nie SMB).
    static let probeCandidates: [(scheme: String, port: Int)] = [
        ("https", 5001),
        ("http", 5000),
        ("https", 443),
    ]

    static func suggestedPort(forServiceType type: String, discoveredPort: Int) -> Int {
        switch type {
        case "_webdavs._tcp.": return discoveredPort
        case "_webdav._tcp.": return discoveredPort
        case "_smb._tcp.": return 5001
        case "_https._tcp.": return discoveredPort == 443 ? 5001 : discoveredPort
        case "_http._tcp.": return (discoveredPort == 80 || discoveredPort == 8080) ? 5000 : discoveredPort
        default: return 5001
        }
    }

    static func probeOrder(preferredPort: Int?) -> [(scheme: String, port: Int)] {
        var result: [(String, Int)] = []
        func add(_ scheme: String, _ port: Int) {
            guard port > 0, port != 445, port != 139, port != 8080 else { return }
            if !result.contains(where: { $0.0 == scheme && $0.1 == port }) {
                result.append((scheme, port))
            }
        }

        if let preferredPort {
            switch preferredPort {
            case 5000: add("http", 5000)
            case 5001: add("https", 5001)
            case 443: add("https", 443)
            case 80: add("http", 5000)
            case 8080: add("http", 5000)
            default:
                if preferredPort != 445, preferredPort != 139, preferredPort != 8080 {
                    add("https", preferredPort)
                    add("http", preferredPort)
                }
            }
        }

        for item in probeCandidates {
            add(item.scheme, item.port)
        }
        return result
    }

    static func pathsToProbe(userPath: String) -> [String] {
        var paths: [String] = []
        func append(_ path: String) {
            let normalized = path.isEmpty ? "/" : (path.hasPrefix("/") ? path : "/\(path)")
            if !paths.contains(normalized) { paths.append(normalized) }
        }
        append(userPath)
        append("/")
        return paths
    }

    static func matchShare(named wanted: String, in folders: [WebDAVEntry]) -> WebDAVEntry? {
        let key = wanted.lowercased()
        return folders.first { $0.name.lowercased() == key }
            ?? folders.first { $0.name.lowercased().contains(key) || key.contains($0.name.lowercased()) }
    }

    static func buildBaseURL(host: String, scheme: String, port: Int, rootPath: String) -> URL? {
        let path = rootPath.isEmpty ? "" : (rootPath.hasSuffix("/") ? String(rootPath.dropLast()) : rootPath)
        return URL(string: "\(scheme)://\(host):\(port)\(path)")
    }
}

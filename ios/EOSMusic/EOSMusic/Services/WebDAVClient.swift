import Foundation

struct WebDAVEntry: Identifiable, Hashable {
    let id: String
    let name: String
    /// Ścieżka względem baseURL (np. "Rock/Album" lub "" dla korzenia).
    let relativePath: String
    let isDirectory: Bool
    let size: Int64?

    var path: String { relativePath }
}

enum WebDAVError: LocalizedError {
    case invalidURL
    case unauthorized
    case forbidden(availableShares: [String])
    case server(String)
    case parse

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Nieprawidłowy adres WebDAV."
        case .unauthorized: return "Błędny login lub hasło."
        case .forbidden(let shares):
            if shares.isEmpty {
                return "Brak dostępu (403). Sprawdź nazwę folderu QNAP i uprawnienia WebDAV użytkownika."
            }
            return "Brak dostępu do tego folderu. Dostępne udziały: \(shares.joined(separator: ", "))."
        case .server(let msg): return msg
        case .parse: return "Nie udało się odczytać listy plików."
        }
    }
}

struct WebDAVClient {
    let baseURL: URL
    let username: String
    let password: String
    var requestTimeout: TimeInterval = 12

    func list(relativePath: String = "") async throws -> [WebDAVEntry] {
        let target = url(forRelativePath: relativePath)
        var request = URLRequest(url: target)
        request.httpMethod = "PROPFIND"
        request.timeoutInterval = requestTimeout
        request.setValue("1", forHTTPHeaderField: "Depth")
        request.setValue("application/xml", forHTTPHeaderField: "Content-Type")
        request.setValue(authorizationHeader, forHTTPHeaderField: "Authorization")
        request.httpBody = """
        <?xml version="1.0" encoding="utf-8"?>
        <D:propfind xmlns:D="DAV:">
          <D:prop><D:displayname/><D:getcontentlength/><D:resourcetype/></D:prop>
        </D:propfind>
        """.data(using: .utf8)

        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse else { throw WebDAVError.server("Brak odpowiedzi.") }
        if http.statusCode == 401 { throw WebDAVError.unauthorized }
        if http.statusCode == 403 { throw WebDAVError.forbidden(availableShares: []) }
        if http.statusCode == 207 || (http.statusCode >= 200 && http.statusCode < 300) {
            return try parsePropfind(data, currentRelativePath: relativePath)
        }
        if http.statusCode >= 400 { throw WebDAVError.server("WebDAV błąd \(http.statusCode).") }
        return try parsePropfind(data, currentRelativePath: relativePath)
    }

    /// Pełna ścieżka WebDAV do pobrania / odtwarzania pliku.
    func absoluteWebDAVPath(forRelativePath relative: String) -> String {
        let base = baseURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let sub = relative.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if base.isEmpty { return "/" + sub }
        if sub.isEmpty { return "/" + base }
        return "/" + base + "/" + sub
    }

    /// PROPFIND na korzeniu — lista udziałów QNAP.
    func listShareFolders() async throws -> [WebDAVEntry] {
        try await list(relativePath: "").filter(\.isDirectory)
    }

    func downloadTemporaryFile(relativePath: String) async throws -> URL {
        let target = url(forRelativePath: relativePath)
        var request = URLRequest(url: target)
        request.timeoutInterval = requestTimeout
        request.setValue(authorizationHeader, forHTTPHeaderField: "Authorization")
        let (data, response) = try await perform(request)
        guard let http = response as? HTTPURLResponse, http.statusCode < 400 else {
            throw WebDAVError.server("Nie udało się pobrać pliku.")
        }
        let name = (relativePath as NSString).lastPathComponent
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "_" + name)
        try data.write(to: temp, options: .atomic)
        return temp
    }

    func streamURL(relativePath: String) -> URL {
        url(forRelativePath: relativePath)
    }

    private func url(forRelativePath relativePath: String) -> URL {
        let trimmed = relativePath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if trimmed.isEmpty { return baseURL }
        return baseURL.appendingPathComponent(trimmed, isDirectory: false)
    }
    private var authorizationHeader: String {
        let raw = "\(username):\(password)"
        let encoded = Data(raw.utf8).base64EncodedString()
        return "Basic \(encoded)"
    }

    private func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
        let host = baseURL.host ?? ""
        if LocalNetworkURLSession.isLocalHost(host) {
            return try await LocalNetworkURLSession.shared.data(for: request)
        }
        return try await URLSession.shared.data(for: request)
    }

    private func parsePropfind(_ data: Data, currentRelativePath: String) throws -> [WebDAVEntry] {
        guard let xml = String(data: data, encoding: .utf8) else { throw WebDAVError.parse }
        let basePath = baseURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let current = currentRelativePath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        var entries: [WebDAVEntry] = []
        var parts = xml.components(separatedBy: "<D:response")
        if parts.count <= 1 {
            parts = xml.components(separatedBy: "<response")
        }
        for part in parts.dropFirst() {
            guard let href = extractHref(in: part) else { continue }
            var decoded = href.removingPercentEncoding ?? href
            if let url = URL(string: decoded), url.scheme != nil {
                decoded = url.path
            }
            decoded = decoded.trimmingCharacters(in: CharacterSet(charactersIn: "/"))

            if !basePath.isEmpty {
                if decoded == basePath { continue }
                if decoded.hasPrefix(basePath + "/") {
                    decoded = String(decoded.dropFirst(basePath.count + 1))
                }
            }

            if decoded.isEmpty || decoded == current { continue }
            if !isDirectChild(decoded, parent: current) { continue }
            if shouldSkipWebDAVName((decoded as NSString).lastPathComponent) { continue }

            let name = (decoded as NSString).lastPathComponent
            if name.isEmpty || name == "." { continue }

            let isDir = part.contains("collection")
            let size = extractTag("getcontentlength", in: part).flatMap(Int64.init)
            entries.append(WebDAVEntry(
                id: decoded,
                name: name,
                relativePath: decoded,
                isDirectory: isDir,
                size: size
            ))
        }
        return entries
    }

    private func isDirectChild(_ path: String, parent: String) -> Bool {
        if parent.isEmpty { return !path.contains("/") }
        let prefix = parent + "/"
        guard path.hasPrefix(prefix) else { return false }
        return !path.dropFirst(prefix.count).contains("/")
    }

    private func shouldSkipWebDAVName(_ name: String) -> Bool {
        if name.hasPrefix(".") { return true }
        let lower = name.lowercased()
        let skip = ["@recycle", "#recycle", "@recently-snapshot", ".snapshot", "@sharebin", "homes"]
        return skip.contains(lower)
    }

    private func extractHref(in xml: String) -> String? {
        extractTag("href", in: xml) ?? extractTag("D:href", in: xml)
    }

    private func extractTag(_ tag: String, in xml: String) -> String? {
        let patterns = ["<\(tag)>", "<D:\(tag)>"]
        for openTag in patterns {
            guard let open = xml.range(of: openTag) else { continue }
            let afterOpen = xml[open.upperBound...]
            let closeTags = ["</\(tag)>", "</D:\(tag)>"]
            for closeTag in closeTags {
                if let close = afterOpen.range(of: closeTag) {
                    return String(afterOpen[..<close.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
        }
        return nil
    }
}

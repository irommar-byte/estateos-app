import Foundation

final class ServerTransport: CatalogTransport {
    let baseURL: URL
    private var token: String

    init(baseURL: URL, token: String) {
        self.baseURL = baseURL
        self.token = token
    }

    static func login(host: String, port: Int, username: String, password: String) async throws -> ServerTransport {
        let roots = ConnectionURL.roots(host: host, port: port, defaultPort: 8787)
        guard !roots.isEmpty else { throw LibraryError(message: "Nieprawidłowy adres serwera.") }
        GalleryNetwork.shared.trust(ConnectionURL.bare(host))
        var last = LibraryError(message: "Nie udało się połączyć z serwerem.")
        for root in roots {
            if let name = root.host { GalleryNetwork.shared.trust(name) }
            do {
                return try await openSession(at: root, username: username, password: password)
            } catch {
                last = error as? LibraryError ?? LibraryError(message: SyncPause.message(for: error))
                guard retryable(error), root != roots.last else { throw last }
            }
        }
        throw last
    }

    private static func openSession(at root: URL, username: String, password: String) async throws -> ServerTransport {
        var request = URLRequest(url: root.appendingPathComponent("v1/sessions"))
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["username": username, "password": password])
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try Self.validate(response, data: data)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let token = object?["token"] as? String, !token.isEmpty else {
            throw LibraryError(message: "Serwer nie zwrócił sesji.")
        }
        return ServerTransport(baseURL: root, token: token)
    }

    /// The other scheme is worth a try when the port refused the first one or answered with a web page.
    private static func retryable(_ error: Error) -> Bool {
        if let library = error as? LibraryError {
            return library.message == SyncPause.needsHTTPS || library.message == SyncPause.notGalleryServer
        }
        guard let url = error as? URLError else { return false }
        switch url.code {
        case .secureConnectionFailed, .appTransportSecurityRequiresSecureConnection, .cannotConnectToHost, .serverCertificateUntrusted:
            return true
        default:
            return false
        }
    }

    func writeFile(_ relative: String, from local: URL) async throws {
        guard let safe = CatalogPath.safe(relative) else {
            throw LibraryError(message: "Nieprawidłowa ścieżka biblioteki.")
        }
        if safe.contains("/originals/") {
            try await uploadOriginal(safe, from: local)
            return
        }
        var request = URLRequest(url: fileURL(safe))
        request.httpMethod = "PUT"
        request.timeoutInterval = 60
        authorize(&request)
        let (data, response) = try await GalleryNetwork.shared.upload(for: request, fromFile: local)
        try Self.validate(response, data: data)
    }

    func readFile(_ relative: String) async throws -> Data {
        guard let safe = CatalogPath.safe(relative) else {
            throw LibraryError(message: "Nieprawidłowa ścieżka biblioteki.")
        }
        var request = URLRequest(url: fileURL(safe))
        request.timeoutInterval = 60 * 20
        authorize(&request)
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try Self.validate(response, data: data)
        return data
    }

    func list(_ relative: String) async throws -> [String] {
        guard let safe = CatalogPath.safe(relative) ?? (relative.isEmpty ? "" : nil) else {
            throw LibraryError(message: "Nieprawidłowa ścieżka biblioteki.")
        }
        var parts = URLComponents(url: baseURL.appendingPathComponent("v1/list"), resolvingAgainstBaseURL: false)
        parts?.queryItems = [URLQueryItem(name: "path", value: safe)]
        guard let url = parts?.url else { throw LibraryError(message: "Nieprawidłowy adres serwera.") }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        authorize(&request)
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 404 { return [] }
        try Self.validate(response, data: data)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return object?["names"] as? [String] ?? []
    }

    func exists(_ relative: String) async throws -> Bool {
        if let count = try await byteCount(relative) { return count >= 0 }
        return false
    }

    func byteCount(_ relative: String) async throws -> Int? {
        guard let safe = CatalogPath.safe(relative) else { return nil }
        var request = URLRequest(url: fileURL(safe))
        request.httpMethod = "HEAD"
        request.timeoutInterval = 20
        authorize(&request)
        let (_, response) = try await GalleryNetwork.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { return nil }
        if http.statusCode == 404 { return nil }
        try Self.validate(response, data: Data())
        guard let length = http.value(forHTTPHeaderField: "Content-Length"), let value = Int(length) else { return nil }
        return value
    }

    func removeFile(_ relative: String) async throws {
        guard let safe = CatalogPath.safe(relative) else { return }
        var request = URLRequest(url: fileURL(safe))
        request.httpMethod = "DELETE"
        request.timeoutInterval = 20
        authorize(&request)
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 404 { return }
        try Self.validate(response, data: data)
    }

    func changes(cursor: Int) async throws -> (cursor: Int, lines: [JournalLine]) {
        var parts = URLComponents(url: baseURL.appendingPathComponent("v1/changes"), resolvingAgainstBaseURL: false)
        parts?.queryItems = [URLQueryItem(name: "cursor", value: String(cursor))]
        guard let url = parts?.url else { throw LibraryError(message: "Nieprawidłowy adres serwera.") }
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        authorize(&request)
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try Self.validate(response, data: data)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let next = object?["cursor"] as? Int ?? cursor
        let rawLines = object?["lines"] as? [[String: Any]] ?? []
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let lines: [JournalLine] = rawLines.compactMap { item in
            guard let data = try? JSONSerialization.data(withJSONObject: item) else { return nil }
            return try? decoder.decode(JournalLine.self, from: data)
        }
        return (next, lines)
    }

    private func uploadOriginal(_ relative: String, from local: URL) async throws {
        let size = (try FileManager.default.attributesOfItem(atPath: local.path)[.size] as? NSNumber)?.intValue ?? 0
        let hash = ((relative as NSString).lastPathComponent as NSString).deletingPathExtension
        var request = URLRequest(url: baseURL.appendingPathComponent("v1/assets"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        authorize(&request)
        request.httpBody = try JSONSerialization.data(withJSONObject: ["hash": hash, "bytes": size, "path": relative])
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try Self.validate(response, data: data)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        if object?["exists"] as? Bool == true {
            if let stored = try await byteCount(relative), stored == size, size > 0 { return }
            try? await removeFile(relative)
        }
        guard let uploadID = object?["id"] as? String else {
            throw LibraryError(message: "Serwer nie zarezerwował pliku.")
        }
        let handle = try FileHandle(forReadingFrom: local)
        defer { try? handle.close() }
        var offset = 0
        while true {
            let chunk = try handle.read(upToCount: 1024 * 1024) ?? Data()
            if chunk.isEmpty { break }
            var chunkRequest = URLRequest(url: baseURL.appendingPathComponent("v1/assets/\(uploadID)/chunks"))
            var components = URLComponents(url: chunkRequest.url!, resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "offset", value: String(offset))]
            chunkRequest.url = components?.url
            chunkRequest.httpMethod = "PUT"
            chunkRequest.timeoutInterval = 60
            chunkRequest.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
            authorize(&chunkRequest)
            chunkRequest.httpBody = chunk
            let (body, chunkResponse) = try await GalleryNetwork.shared.data(for: chunkRequest)
            try Self.validate(chunkResponse, data: body)
            offset += chunk.count
            if size > 0 {
                GalleryNetwork.shared.noteUpload(fraction: Double(offset) / Double(size))
            }
        }
        var commit = URLRequest(url: baseURL.appendingPathComponent("v1/assets/\(uploadID)/commit"))
        commit.httpMethod = "POST"
        commit.timeoutInterval = 30
        commit.setValue("application/json", forHTTPHeaderField: "Content-Type")
        authorize(&commit)
        commit.httpBody = try JSONSerialization.data(withJSONObject: ["path": relative])
        let (commitBody, commitResponse) = try await GalleryNetwork.shared.data(for: commit)
        try Self.validate(commitResponse, data: commitBody)
    }

    private func fileURL(_ relative: String) -> URL {
        baseURL.appendingPathComponent("v1/files").appendingPathComponent(relative)
    }

    private func authorize(_ request: inout URLRequest) {
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    private static func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw LibraryError(message: "Brak odpowiedzi.")
        }
        if http.statusCode == 401 { throw LibraryError(message: "Błędny login lub hasło.") }
        if http.statusCode >= 400 {
            throw LibraryError(message: SyncPause.explainServer(status: http.statusCode, data: data))
        }
    }
}

extension ServerTransport: StreamingTransport {
    func streamTarget(_ relative: String) -> (url: URL, headers: [String: String])? {
        guard let safe = CatalogPath.safe(relative) else { return nil }
        return (fileURL(safe), ["Authorization": "Bearer \(token)"])
    }
}

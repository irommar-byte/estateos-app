import Foundation

struct ImmichAsset {
    var id: String
    var deviceAssetID: String
    var fileName: String
    var created: Date
    var width: Int
    var height: Int
    var favorite: Bool
    var isVideo: Bool
    var latitude: Double?
    var longitude: Double?
}

final class ImmichClient {
    let baseURL: URL
    private var token: String?
    private let apiKey: String?

    init(baseURL: URL, token: String? = nil, apiKey: String? = nil) {
        self.baseURL = baseURL
        self.token = token
        self.apiKey = apiKey
    }

    static func connect(host: String, port: Int, username: String, password: String) async throws -> ImmichClient {
        let roots = ConnectionURL.roots(host: host, port: port, defaultPort: 2283)
        guard !roots.isEmpty else { throw LibraryError(message: "Nieprawidłowy adres Immich.") }
        GalleryNetwork.shared.trust(ConnectionURL.bare(host))
        var last = LibraryError(message: "Nie udało się połączyć z Immich.")
        for root in roots {
            if let name = root.host { GalleryNetwork.shared.trust(name) }
            do {
                return try await signIn(at: root, username: username, password: password)
            } catch {
                last = error as? LibraryError ?? LibraryError(message: SyncPause.message(for: error))
                let retry = last.message == SyncPause.needsHTTPS
                    || last.message == "Pod tym adresem nie ma Immich."
                    || (error as? URLError)?.code == .secureConnectionFailed
                    || (error as? URLError)?.code == .cannotConnectToHost
                guard retry, root != roots.last else { throw last }
            }
        }
        throw last
    }

    private static func signIn(at root: URL, username: String, password: String) async throws -> ImmichClient {
        if password.isEmpty {
            let client = ImmichClient(baseURL: root, apiKey: username)
            _ = try await client.list(page: 1)
            return client
        }
        var request = URLRequest(url: root.appendingPathComponent("api/auth/login"))
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": username, "password": password])
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try validate(response, data: data)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let token = object?["accessToken"] as? String else {
            throw LibraryError(message: "Immich nie zwrócił sesji.")
        }
        return ImmichClient(baseURL: root, token: token)
    }

    func upload(file: URL, asset: LibraryAsset, device: String) async throws {
        let checksum = try ContentHash.sha1(of: file)
        let boundary = "GalleryOS\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))"
        let body = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: body) }
        try writeMultipart(to: body, file: file, asset: asset, device: device, boundary: boundary)
        var request = URLRequest(url: baseURL.appendingPathComponent("api/assets"))
        request.httpMethod = "POST"
        request.timeoutInterval = 60 * 20
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(checksum, forHTTPHeaderField: "x-immich-checksum")
        authorize(&request)
        let (data, response) = try await GalleryNetwork.shared.upload(for: request, fromFile: body)
        try Self.validate(response, data: data)
    }

    func listAll() async throws -> [ImmichAsset] {
        var page = 1
        var result: [ImmichAsset] = []
        while page <= 40 {
            let batch = try await list(page: page)
            if batch.isEmpty { break }
            result.append(contentsOf: batch)
            page += 1
        }
        return result
    }

    func download(id: String, original: Bool) async throws -> Data {
        let path = original ? "api/assets/\(id)/original" : "api/assets/\(id)/thumbnail"
        var parts = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        if !original { parts?.queryItems = [URLQueryItem(name: "size", value: "preview")] }
        guard let url = parts?.url else { throw LibraryError(message: "Nieprawidłowy adres Immich.") }
        var request = URLRequest(url: url)
        request.timeoutInterval = 60 * 20
        authorize(&request)
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try Self.validate(response, data: data)
        return data
    }

    func namedPeople() async throws -> [String: [String]] {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/people"))
        request.timeoutInterval = 30
        authorize(&request)
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try Self.validate(response, data: data)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let people = object?["people"] as? [[String: Any]] ?? []
        var names: [String: [String]] = [:]
        for person in people {
            guard let id = person["id"] as? String, let name = person["name"] as? String, !name.isEmpty else { continue }
            let assets = try await assets(forPerson: id)
            for asset in assets {
                let key = asset.deviceAssetID.isEmpty ? asset.id : asset.deviceAssetID
                names[key, default: []].append(name)
            }
        }
        return names
    }

    private func list(page: Int) async throws -> [ImmichAsset] {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/search/metadata"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        authorize(&request)
        request.httpBody = try JSONSerialization.data(withJSONObject: ["size": 200, "page": page])
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try Self.validate(response, data: data)
        return Self.parseAssets(data)
    }

    private func assets(forPerson id: String) async throws -> [ImmichAsset] {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/search/metadata"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        authorize(&request)
        request.httpBody = try JSONSerialization.data(withJSONObject: ["personIds": [id], "size": 1000, "page": 1])
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try Self.validate(response, data: data)
        return Self.parseAssets(data)
    }

    private func writeMultipart(to url: URL, file: URL, asset: LibraryAsset, device: String, boundary: String) throws {
        FileManager.default.createFile(atPath: url.path, contents: nil)
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        let formatter = ISO8601DateFormatter()
        let created = formatter.string(from: asset.created)
        let name = file.lastPathComponent
        func field(_ key: String, _ value: String) {
            let text = "--\(boundary)\r\nContent-Disposition: form-data; name=\"\(key)\"\r\n\r\n\(value)\r\n"
            try? handle.write(contentsOf: Data(text.utf8))
        }
        field("deviceAssetId", asset.hash)
        field("deviceId", device)
        field("fileCreatedAt", created)
        field("fileModifiedAt", created)
        let header = "--\(boundary)\r\nContent-Disposition: form-data; name=\"assetData\"; filename=\"\(name)\"\r\nContent-Type: application/octet-stream\r\n\r\n"
        try handle.write(contentsOf: Data(header.utf8))
        let input = try FileHandle(forReadingFrom: file)
        defer { try? input.close() }
        while true {
            let chunk = try input.read(upToCount: 1024 * 1024) ?? Data()
            if chunk.isEmpty { break }
            try handle.write(contentsOf: chunk)
        }
        try handle.write(contentsOf: Data("\r\n--\(boundary)--\r\n".utf8))
    }

    private func authorize(_ request: inout URLRequest) {
        if let apiKey, !apiKey.isEmpty {
            request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        }
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private static func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw LibraryError(message: "Brak odpowiedzi.")
        }
        if http.statusCode == 401 { throw LibraryError(message: "Błędny login lub hasło.") }
        if http.statusCode >= 400 {
            let explained = SyncPause.explainServer(status: http.statusCode, data: data)
            if explained == SyncPause.needsHTTPS || explained == SyncPause.notGalleryServer {
                throw LibraryError(message: explained == SyncPause.needsHTTPS ? explained : "Pod tym adresem nie ma Immich.")
            }
            throw LibraryError(message: "Immich odrzucił połączenie (\(http.statusCode)).")
        }
    }

    private static func parseAssets(_ data: Data) -> [ImmichAsset] {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [] }
        let items: [[String: Any]]
        if let assets = object["assets"] as? [String: Any], let nested = assets["items"] as? [[String: Any]] {
            items = nested
        } else if let nested = object["items"] as? [[String: Any]] {
            items = nested
        } else {
            items = []
        }
        return items.compactMap(parse)
    }

    private static func parse(_ item: [String: Any]) -> ImmichAsset? {
        guard let id = item["id"] as? String else { return nil }
        let device = item["deviceAssetId"] as? String ?? id
        let name = item["originalFileName"] as? String ?? "photo.jpg"
        let created = ISO8601DateFormatter().date(from: item["fileCreatedAt"] as? String ?? "") ?? .now
        let exif = item["exifInfo"] as? [String: Any]
        let width = exif?["exifImageWidth"] as? Int ?? 1
        let height = exif?["exifImageHeight"] as? Int ?? 1
        let type = (item["type"] as? String ?? "").lowercased()
        return ImmichAsset(
            id: id,
            deviceAssetID: device,
            fileName: name,
            created: created,
            width: width,
            height: height,
            favorite: item["isFavorite"] as? Bool ?? false,
            isVideo: type == "video",
            latitude: exif?["latitude"] as? Double,
            longitude: exif?["longitude"] as? Double
        )
    }
}

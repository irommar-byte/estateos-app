import Foundation

@MainActor
final class MusicAPIClient {
    private var token: String?

    func setToken(_ token: String?) {
        self.token = token
    }

    // MARK: - Auth

    func login(login: String, password: String) async throws -> SessionStore.Session {
        let body = ["login": login, "password": password]
        let response: AuthLoginResponse = try await request("POST", path: "/api/auth/login", body: body, authorized: false)
        let session = SessionStore.Session(token: response.token, user: response.user)
        try SessionStore.save(session)
        token = response.token
        return session
    }

    func loginWithApple(identityToken: String, login: String? = nil, password: String? = nil, linkOnly: Bool = false) async throws -> SessionStore.Session {
        var body: [String: Any] = ["identityToken": identityToken]
        if let login { body["login"] = login }
        if let password { body["password"] = password }
        if linkOnly { body["linkOnly"] = true }
        // linkOnly uses the current Bearer session when available.
        let response: AuthLoginResponse = try await request(
            "POST",
            path: "/api/auth/apple",
            body: body,
            authorized: linkOnly
        )
        let session = SessionStore.Session(token: response.token, user: response.user)
        try SessionStore.save(session)
        token = response.token
        return session
    }

    func unlinkApple(appleUserId: String) async throws {
        struct Body: Encodable { let appleUserId: String }
        struct Ok: Codable { let ok: Bool? }
        let _: Ok = try await requestJSON("DELETE", path: "/api/auth/apple/link", encodable: Body(appleUserId: appleUserId), authorized: true)
    }

    func me() async throws -> AuthUser {
        struct Wrapper: Codable { let user: AuthUser }
        let json: Wrapper = try await request("GET", path: "/api/auth/me")
        return json.user
    }

    // MARK: - Library

    func fetchMusicLibrary() async throws -> MusicLibraryResponse {
        try await request("GET", path: "/api/music/library")
    }

    func createMusicFolder(name: String) async throws -> MusicFolder {
        let response: MusicFolderCreateResponse = try await request(
            "POST",
            path: "/api/music/folders",
            body: ["name": name]
        )
        return response.folder
    }

    func deleteMusicFolder(id: String) async throws {
        struct Ok: Codable { let ok: Bool? }
        let _: Ok = try await request("DELETE", path: "/api/music/folders/\(id)")
    }

    func updateMusicFolder(
        id: String,
        name: String? = nil,
        thumbnail: String? = nil,
        coverBase64: String? = nil
    ) async throws -> MusicFolder {
        struct Response: Codable {
            let ok: Bool?
            let folder: MusicFolder
        }
        var body: [String: Any] = [:]
        if let name { body["name"] = name }
        if let thumbnail { body["thumbnail"] = thumbnail }
        if let coverBase64 { body["coverBase64"] = coverBase64 }
        let response: Response = try await request("PATCH", path: "/api/music/folders/\(id)", body: body)
        return response.folder
    }

    func fetchFolderTracks(folderId: String) async throws -> MusicFolderTracksResponse {
        try await request("GET", path: "/api/music/folders/\(folderId)/tracks")
    }

    func addTrackToFolder(folderId: String, track: MusicTrackPayload) async throws -> MusicTrack {
        struct Body: Encodable { let track: MusicTrackPayload }
        struct Response: Codable { let track: MusicTrack }
        let response: Response = try await requestJSON(
            "POST",
            path: "/api/music/folders/\(folderId)/tracks",
            encodable: Body(track: track)
        )
        return response.track
    }

    func removeTrackFromFolder(folderId: String, url: String) async throws {
        struct Ok: Codable { let ok: Bool? }
        let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
        let _: Ok = try await request("DELETE", path: "/api/music/folders/\(folderId)/tracks?url=\(encoded)")
    }

    func reorderFolderTracks(folderId: String, urls: [String]) async throws -> MusicFolderTracksResponse {
        struct Body: Encodable { let urls: [String] }
        return try await requestJSON("PATCH", path: "/api/music/folders/\(folderId)/tracks/reorder", encodable: Body(urls: urls))
    }

    // MARK: - Favorites

    func fetchFavorites() async throws -> [FavoriteItem] {
        let response: FavoritesResponse = try await request("GET", path: "/api/favorites")
        return response.items
    }

    func addFavorite(_ item: FavoriteItem) async throws {
        struct Body: Encodable { let item: FavoriteItem }
        struct Ok: Codable { let ok: Bool? }
        let _: Ok = try await requestJSON("POST", path: "/api/favorites", encodable: Body(item: item))
    }

    func removeFavorite(url: String) async throws {
        struct Ok: Codable { let ok: Bool? }
        let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
        let _: Ok = try await request("DELETE", path: "/api/favorites?url=\(encoded)")
    }

    func streamURLRequest(jobId: String, token: String) -> URLRequest {
        let encoded = token.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? token
        let path = "/api/music/stream/\(jobId)?token=\(encoded)&t=\(Int(Date().timeIntervalSince1970))"
        return makeRequest(method: "GET", path: path, authorized: true)
    }

    // MARK: - Catalog

    func importMusicPlaylist(url: String, folderName: String? = nil) async throws -> MusicPlaylistImportResponse {
        var body: [String: Any] = ["url": url]
        if let folderName { body["folderName"] = folderName }
        return try await request("POST", path: "/api/music/playlists/import", body: body)
    }

    /// Back-compat alias.
    func importAppleMusicPlaylist(url: String, folderName: String? = nil) async throws -> MusicPlaylistImportResponse {
        try await importMusicPlaylist(url: url, folderName: folderName)
    }

    func syncAppleMusicPlaylist(folderId: String) async throws {
        struct Ok: Codable { let ok: Bool? }
        let _: Ok = try await request("POST", path: "/api/music/folders/\(folderId)/sync-playlist", body: [:])
    }

    func searchMusicCatalog(query: String) async throws -> MusicCatalogSearchResponse {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        return try await request("GET", path: "/api/music/catalog/search?q=\(encoded)")
    }

    func fetchMusicArtist(id: String) async throws -> MusicArtistDetailResponse {
        try await request("GET", path: "/api/music/catalog/artist/\(id)")
    }

    func fetchMusicAlbum(id: String) async throws -> MusicAlbumDetailResponse {
        try await request("GET", path: "/api/music/catalog/album/\(id)")
    }

    // MARK: - Playback

    func startMusicPlay(url: String, folderId: String? = nil, trackUrl: String? = nil) async throws -> DownloadStartResponse {
        var body: [String: Any] = ["url": url]
        if let folderId { body["folderId"] = folderId }
        if let trackUrl { body["trackUrl"] = trackUrl }
        return try await request("POST", path: "/api/music/play", body: body)
    }

    /// Upload pliku otwartego z Plików / „Otwórz w EOS Music” na serwer EOS.
    func uploadLocalMusicFile(
        url: String,
        folderId: String?,
        title: String,
        artist: String?,
        album: String?,
        fileName: String,
        fileData: Data
    ) async throws -> DownloadStartResponse {
        let body: [String: Any] = [
            "url": url,
            "folderId": folderId as Any,
            "title": title,
            "artist": artist as Any,
            "album": album as Any,
            "fileName": fileName,
            "fileBase64": fileData.base64EncodedString(),
        ]
        var req = makeRequest(method: "POST", path: "/api/music/upload-local", authorized: true)
        req.timeoutInterval = 300
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await perform(req)
    }

    func listMusicAssets() async throws -> MusicAssetsResponse {
        try await request("GET", path: "/api/music/assets")
    }

    func deleteMusicAsset(assetId: String) async throws {
        struct Ok: Codable { let ok: Bool? }
        let _: Ok = try await request("DELETE", path: "/api/music/assets/\(assetId)")
    }

    func waitForMusicPlayReady(
        jobId: String,
        timeoutSeconds: Int = 180,
        onProgress: ((Double, String) -> Void)? = nil
    ) async throws {
        let deadline = Date().addingTimeInterval(TimeInterval(timeoutSeconds))
        var poll = 0
        while Date() < deadline {
            let job = try await fetchJobStatus(jobId: jobId)
            if job.status == "error" {
                throw APIError.server(job.error ?? "Odtwarzanie nie powiodło się.")
            }
            let pct = max(0, min(100, job.progress ?? 0))
            onProgress?(pct, job.status)
            if job.ready == true || job.status == "done" { return }
            poll += 1
            // Fast polls while APLMate resolves / early stream opens.
            let ns: UInt64 = poll < 40 ? 200_000_000 : poll < 80 ? 400_000_000 : 1_000_000_000
            try await Task.sleep(nanoseconds: ns)
        }
        throw APIError.server("Przekroczono czas oczekiwania na przygotowanie utworu.")
    }

    func musicPlayToken(jobId: String) async throws -> MusicPlayTokenResponse {
        try await request("GET", path: "/api/music/play-token/\(jobId)")
    }

    func musicStreamURL(jobId: String, token: String) -> URL {
        let base = AppConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var components = URLComponents(string: base + "/api/music/stream/\(jobId)")!
        components.queryItems = [
            URLQueryItem(name: "token", value: token),
            URLQueryItem(name: "t", value: String(Int(Date().timeIntervalSince1970))),
        ]
        return components.url!
    }

    func startMusicDownload(url: String, folderId: String?, trackUrl: String?) async throws -> DownloadStartResponse {
        var body: [String: Any] = ["url": url]
        if let folderId { body["folderId"] = folderId }
        if let trackUrl { body["trackUrl"] = trackUrl }
        return try await request("POST", path: "/api/download", body: body)
    }

    // MARK: - CDA-HD / Online movies

    func fetchCdaHdHome(limit: Int = 22) async throws -> FilmsHomeResponse {
        try await request("GET", path: "/api/cda-hd/home?limit=\(limit)", authorized: true)
    }

    func fetchFilmsHome(limit: Int = 16) async throws -> FilmsHomeResponse {
        try await request("GET", path: "/api/films/home?limit=\(limit)", authorized: true)
    }

    func fetchCdaHdCatalog(
        mode: FilmsCatalogMode,
        type: FilmsCatalogKind = .all,
        page: Int = 1,
        pageSize: Int = 24
    ) async throws -> CdaHdCatalogResponse {
        try await request(
            "GET",
            path: "/api/films/catalog?source=cda-hd&mode=\(mode.rawValue)&type=\(type.rawValue)&page=\(page)&pageSize=\(pageSize)",
            authorized: true
        )
    }

    func searchCdaHd(query: String, page: Int = 1, pageSize: Int = 24) async throws -> SearchResponse {
        try await request(
            "POST",
            path: "/api/search",
            body: [
                "query": query,
                "source": "cda-hd",
                "page": page,
                "pageSize": pageSize,
                "limit": 48,
            ]
        )
    }

    func fetchVideoInfo(url: String) async throws -> VideoInfoResponse {
        try await request("POST", path: "/api/info", body: ["url": url])
    }

    func startMovieDownload(
        url: String,
        height: Int = 720,
        title: String? = nil,
        thumbnail: String? = nil,
        source: String? = nil,
        kind: String = "video",
        container: String = "mp4",
        audioBitrate: Int? = nil
    ) async throws -> DownloadStartResponse {
        var body: [String: Any] = [
            "url": url,
            "height": height == 0 ? "best" : height,
            "container": container,
            "kind": kind,
        ]
        if kind == "audio", let audioBitrate {
            body["audioBitrate"] = audioBitrate == 0 ? "best" : audioBitrate
        }
        if let title, !title.isEmpty { body["title"] = title }
        if let thumbnail, !thumbnail.isEmpty { body["thumbnail"] = thumbnail }
        if let source, !source.isEmpty { body["source"] = source }
        return try await request("POST", path: "/api/download", body: body)
    }

    func fetchMovieDownloads() async throws -> MovieDownloadsResponse {
        try await request("GET", path: "/api/movies/downloads")
    }

    func linkMovieDownload(
        url: String,
        title: String,
        downloadJobId: String,
        thumbnail: String? = nil,
        source: String? = nil,
        filename: String? = nil
    ) async throws -> MovieDownload {
        var body: [String: Any] = [
            "url": url,
            "title": title,
            "downloadJobId": downloadJobId,
        ]
        if let thumbnail, !thumbnail.isEmpty { body["thumbnail"] = thumbnail }
        if let source, !source.isEmpty { body["source"] = source }
        if let filename, !filename.isEmpty { body["filename"] = filename }
        struct Response: Codable { let download: MovieDownload }
        let response: Response = try await request("PATCH", path: "/api/movies/downloads/link", body: body)
        return response.download
    }

    func deleteMovieDownload(url: String) async throws {
        struct Ok: Codable { let ok: Bool? }
        let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
        let _: Ok = try await request("DELETE", path: "/api/movies/downloads?url=\(encoded)")
    }

    func moviePlayToken(jobId: String) async throws -> MoviePlayTokenResponse {
        try await request("GET", path: "/api/movies/play-token/\(jobId)")
    }

    func movieStreamURL(jobId: String, token: String) -> URL {
        let base = AppConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var components = URLComponents(string: base + "/api/movies/stream/\(jobId)")!
        components.queryItems = [
            URLQueryItem(name: "token", value: token),
            URLQueryItem(name: "t", value: String(Int(Date().timeIntervalSince1970))),
        ]
        return components.url!
    }

    func movieFileURL(jobId: String) -> URL {
        let base = AppConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: base + "/api/file/\(jobId)")!
    }

    /// Stream / podgląd bez trwałego pobierania (CDA-HD mirror → `/api/play`).
    func startPreview(url: String, height: Int = 720) async throws -> PreviewResponse {
        var body: [String: Any] = [
            "url": url,
            "playMode": "stream",
            "height": height == 0 ? "best" : height,
        ]
        return try await request("POST", path: "/api/preview", body: body)
    }

    func previewPlayToken(jobId: String) async throws -> PlayTokenResponse {
        try await request("GET", path: "/api/play-token/\(jobId)")
    }

    func waitForPreviewReady(
        jobId: String,
        timeoutSeconds: Int = 120,
        onProgress: ((Double) -> Void)? = nil
    ) async throws {
        let deadline = Date().addingTimeInterval(TimeInterval(timeoutSeconds))
        var poll = 0
        while Date() < deadline {
            let job = try await fetchJobStatus(jobId: jobId)
            if job.status == "error" {
                throw APIError.server(job.error ?? "Odtwarzanie nie powiodło się.")
            }
            onProgress?(max(0, min(100, job.progress ?? 0)))
            if job.ready == true || job.status == "done" { return }
            poll += 1
            let ns: UInt64 = poll < 40 ? 400_000_000 : 800_000_000
            try await Task.sleep(nanoseconds: ns)
        }
        throw APIError.server("Przekroczono czas oczekiwania na stream.")
    }

    func previewStreamURL(jobId: String, token: String) -> URL {
        let base = AppConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var components = URLComponents(string: base + "/api/play/\(jobId)")!
        components.queryItems = [
            URLQueryItem(name: "token", value: token),
            URLQueryItem(name: "t", value: String(Int(Date().timeIntervalSince1970))),
        ]
        return components.url!
    }

    func cancelJob(jobId: String) async throws {
        struct Ok: Codable { let ok: Bool? }
        let _: Ok = try await request("POST", path: "/api/cancel/\(jobId)")
    }

    func linkTrackDownload(folderId: String, url: String, downloadJobId: String) async throws -> MusicTrack {
        struct Response: Codable { let track: MusicTrack }
        let response: Response = try await request(
            "PATCH",
            path: "/api/music/folders/\(folderId)/tracks/download",
            body: ["url": url, "downloadJobId": downloadJobId]
        )
        return response.track
    }

    func fetchJobStatus(jobId: String) async throws -> JobStatusResponse {
        try await request("GET", path: "/api/job/\(jobId)")
    }

    // MARK: - HTTP

    private struct ServerErrorBody: Codable { let error: String? }

    private func requestJSON<T: Decodable, B: Encodable>(
        _ method: String,
        path: String,
        encodable: B,
        authorized: Bool = true
    ) async throws -> T {
        var req = makeRequest(method: method, path: path, authorized: authorized)
        req.httpBody = try JSONEncoder().encode(encodable)
        return try await perform(req)
    }

    private func request<T: Decodable>(
        _ method: String,
        path: String,
        body: [String: Any]? = nil,
        authorized: Bool = true
    ) async throws -> T {
        var req = makeRequest(method: method, path: path, authorized: authorized)
        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        return try await perform(req)
    }

    private func makeRequest(method: String, path: String, authorized: Bool) -> URLRequest {
        let base = AppConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let url = URL(string: base + path)!
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(AppConfig.userAgent, forHTTPHeaderField: "User-Agent")
        // Proxy + large libraries — fail fast instead of spinning for 60s+.
        if path.hasPrefix("/api/auth/") {
            req.timeoutInterval = 20
        } else if path.hasPrefix("/api/info") {
            req.timeoutInterval = 210
        } else if path.hasPrefix("/api/preview") {
            req.timeoutInterval = 180
        } else if path.hasPrefix("/api/cda-hd/home") || path.hasPrefix("/api/films/home") {
            req.timeoutInterval = 90
        } else if path.hasPrefix("/api/cda-hd/") || path.hasPrefix("/api/films/") || path.hasPrefix("/api/search") {
            req.timeoutInterval = 60
        } else if path.hasPrefix("/api/download") || path.hasPrefix("/api/job/") {
            req.timeoutInterval = 45
        } else if path.hasPrefix("/api/music/library") || path.hasPrefix("/api/music/assets") {
            req.timeoutInterval = 45
        } else {
            req.timeoutInterval = 30
        }
        if authorized, let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return req
    }

    private func perform<T: Decodable>(_ req: URLRequest) async throws -> T {
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse else { throw APIError.decode }

            if http.statusCode == 401 {
                if let err = try? JSONDecoder().decode(ServerErrorBody.self, from: data), let msg = err.error {
                    throw APIError.server(msg)
                }
                throw APIError.unauthorized
            }
            if http.statusCode >= 400 {
                if let err = try? JSONDecoder().decode(ServerErrorBody.self, from: data), let msg = err.error {
                    throw APIError.server(msg)
                }
                throw APIError.server("Błąd serwera (\(http.statusCode)).")
            }
            do {
                return try JSONDecoder().decode(T.self, from: data)
            } catch {
                throw APIError.decode
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.network(error)
        }
    }
}

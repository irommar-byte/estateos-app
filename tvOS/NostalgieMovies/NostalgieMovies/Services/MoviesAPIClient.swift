import Foundation

@MainActor
final class MoviesAPIClient {
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

    func me() async throws -> AuthUser {
        let json: [String: AuthUserWrapper] = try await request("GET", path: "/api/auth/me")
        return json["user"]!.user
    }

    private struct AuthUserWrapper: Codable {
        let user: AuthUser
    }

    // MARK: - Favorites

    func fetchFavorites() async throws -> [FavoriteItem] {
        let response: FavoritesResponse = try await request("GET", path: "/api/favorites")
        return response.items
    }

    func addFavorite(_ item: FavoriteItem) async throws {
        struct Body: Encodable { let item: FavoriteItem }
        let _: OkResponse = try await requestJSON("POST", path: "/api/favorites", encodable: Body(item: item))
    }

    func removeFavorite(url: String) async throws {
        let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
        let _: OkResponse = try await request("DELETE", path: "/api/favorites?url=\(encoded)")
    }

    func startDownload(
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
        let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
        let _: OkResponse = try await request("DELETE", path: "/api/movies/downloads?url=\(encoded)")
    }

    func moviePlayToken(jobId: String) async throws -> MoviePlayTokenResponse {
        try await request("GET", path: "/api/movies/play-token/\(jobId)")
    }

    func movieStreamURL(jobId: String, token: String) -> URL {
        AppConfig.apiBaseURL
            .appendingPathComponent("api/movies/stream/\(jobId)")
            .appending(queryItems: [
                URLQueryItem(name: "token", value: token),
                URLQueryItem(name: "t", value: String(Int(Date().timeIntervalSince1970))),
            ])
    }

    func startMusicDownload(url: String, folderId: String? = nil, trackUrl: String? = nil) async throws -> String {
        var body: [String: Any] = ["url": url]
        if let folderId { body["folderId"] = folderId }
        if let trackUrl { body["trackUrl"] = trackUrl }
        let response: DownloadStartResponse = try await request("POST", path: "/api/download", body: body)
        return response.jobId
    }

    func searchMusicCatalog(query: String) async throws -> MusicCatalogSearchResponse {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let response: MusicCatalogSearchResponse = try await request("GET", path: "/api/music/catalog/search?q=\(encoded)")
        return response
    }

    func fetchMusicArtist(id: String) async throws -> MusicArtistDetailResponse {
        try await request("GET", path: "/api/music/catalog/artist/\(id)")
    }

    func fetchMusicAlbum(id: String) async throws -> MusicAlbumDetailResponse {
        try await request("GET", path: "/api/music/catalog/album/\(id)")
    }

    func previewAppleMusicPlaylist(url: String) async throws -> MusicPlaylistCatalogResponse {
        let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
        let response: MusicPlaylistCatalogResponse = try await request(
            "GET",
            path: "/api/music/catalog/playlist?url=\(encoded)"
        )
        return response
    }

    func importAppleMusicPlaylist(url: String, folderId: String? = nil, folderName: String? = nil) async throws -> MusicPlaylistImportResponse {
        var body: [String: Any] = ["url": url]
        if let folderId { body["folderId"] = folderId }
        if let folderName { body["folderName"] = folderName }
        let response: MusicPlaylistImportResponse = try await request(
            "POST",
            path: "/api/music/playlists/import",
            body: body
        )
        return response
    }

    func syncAppleMusicPlaylist(folderId: String, url: String? = nil) async throws -> MusicPlaylistSyncResponse {
        var body: [String: Any] = [:]
        if let url, !url.isEmpty { body["url"] = url }
        return try await request("POST", path: "/api/music/folders/\(folderId)/sync-playlist", body: body.isEmpty ? nil : body)
    }

    func startMusicPlay(url: String) async throws -> String {
        let response: DownloadStartResponse = try await request(
            "POST",
            path: "/api/music/play",
            body: ["url": url]
        )
        return response.jobId
    }

    func waitForMusicPlayReady(
        jobId: String,
        timeoutSeconds: Int = 180,
        onProgress: ((Int) -> Void)? = nil
    ) async throws {
        let deadline = Date().addingTimeInterval(TimeInterval(timeoutSeconds))
        var poll = 0
        while Date() < deadline {
            let job = try await fetchJobStatus(jobId: jobId)
            if job.status == "error" {
                throw APIError.server(job.error ?? "Odtwarzanie nie powiodło się.")
            }
            if let progress = job.progress {
                onProgress?(Int(progress.rounded()))
            }
            if job.ready == true || job.status == "done" {
                return
            }
            poll += 1
            let delayNs: UInt64 = poll < 30 ? 500_000_000 : 1_000_000_000
            try await Task.sleep(nanoseconds: delayNs)
        }
        throw APIError.server("Przekroczono czas oczekiwania na przygotowanie utworu.")
    }

    func musicPlayToken(jobId: String) async throws -> MusicPlayTokenResponse {
        try await request("GET", path: "/api/music/play-token/\(jobId)")
    }

    func musicStreamURL(jobId: String, token: String) -> URL {
        AppConfig.apiBaseURL
            .appendingPathComponent("api/music/stream/\(jobId)")
            .appending(queryItems: [
                URLQueryItem(name: "token", value: token),
                URLQueryItem(name: "t", value: String(Int(Date().timeIntervalSince1970))),
            ])
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

    func searchAppleMusic(query: String, page: Int = 1, sort: MusicSort = .relevance) async throws -> SearchResponse {
        try await search(
            query: query,
            source: .appleMusic,
            page: page,
            pageSize: 24,
            sort: sort == .title ? .title : sort == .duration ? .duration : .relevance,
            access: .all
        )
    }

    func fetchMusicLibrary() async throws -> MusicLibraryResponse {
        try await request("GET", path: "/api/music/library")
    }

    func createMusicFolder(name: String, thumbnail: String? = nil) async throws -> MusicFolder {
        var body: [String: String] = ["name": name]
        if let thumbnail {
            body["thumbnail"] = thumbnail
        }
        let response: MusicFolderCreateResponse = try await request(
            "POST",
            path: "/api/music/folders",
            body: body
        )
        return response.folder
    }

    func renameMusicFolder(id: String, name: String) async throws -> MusicFolder {
        let response: MusicFolderCreateResponse = try await request(
            "PATCH",
            path: "/api/music/folders/\(id)",
            body: ["name": name]
        )
        return response.folder
    }

    func deleteMusicFolder(id: String) async throws {
        let _: OkResponse = try await request("DELETE", path: "/api/music/folders/\(id)")
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
        let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
        let _: OkResponse = try await request("DELETE", path: "/api/music/folders/\(folderId)/tracks?url=\(encoded)")
    }

    struct MusicTrackPayload: Codable {
        let url: String
        let title: String
        let artist: String?
        let album: String?
        let thumbnail: String?
        let duration: Double?
        let quality: String?
        let source: String?
        let previewUrl: String?
        let artistId: String?
        let albumId: String?
        let trackNumber: Int?
    }

    func fetchJobStatus(jobId: String) async throws -> JobStatusResponse {
        try await request("GET", path: "/api/job/\(jobId)")
    }

    func cancelJob(jobId: String) async throws {
        let _: OkResponse = try await request("POST", path: "/api/cancel/\(jobId)")
    }

    func downloadFileURL(jobId: String) -> URL {
        AppConfig.apiBaseURL.appendingPathComponent("api/file/\(jobId)")
    }

    // MARK: - Search & play

    func search(
        query: String,
        source: SearchSource,
        page: Int = 1,
        pageSize: Int = 24,
        sort: SearchSort = .relevance,
        access: CdaAccessFilter = .all
    ) async throws -> SearchResponse {
        let body: [String: Any] = [
            "query": query,
            "source": source.rawValue,
            "page": page,
            "pageSize": pageSize,
            "sort": sort.rawValue,
            "access": access.rawValue,
            "limit": source == .youtube ? 28 : 48,
        ]
        return try await request("POST", path: "/api/search", body: body)
    }

    func fetchFilmsHome(limit: Int = 16) async throws -> FilmsHomeResponse {
        try await request(
            "GET",
            path: "/api/films/home?limit=\(limit)",
            authorized: true
        )
    }

    func fetchCdaHdLatest(limit: Int = 20) async throws -> [SearchResultItem] {
        let response: LatestFeedResponse = try await request(
            "GET",
            path: "/api/cda-hd/latest?limit=\(limit)",
            authorized: true
        )
        return response.items
    }

    func fetchCdaHdCatalog(
        mode: CdaHdCatalogMode,
        page: Int = 1,
        pageSize: Int = 20,
        type: FilmsCatalogKind = .all
    ) async throws -> CdaHdCatalogResponse {
        try await fetchFilmsCatalog(source: .cdaHd, mode: mode, type: type, page: page, pageSize: pageSize)
    }

    func fetchFilmsCatalog(
        source: SearchSource,
        mode: FilmsCatalogMode = .latest,
        type: FilmsCatalogKind = .all,
        page: Int = 1,
        pageSize: Int = 20
    ) async throws -> FilmsCatalogResponse {
        let src = source == .all ? "all" : source.rawValue
        return try await request(
            "GET",
            path: "/api/films/catalog?source=\(src)&mode=\(mode.rawValue)&type=\(type.rawValue)&page=\(page)&pageSize=\(pageSize)",
            authorized: true
        )
    }

    func fetchCdaHdBrowse(url: String, page: Int = 1, limit: Int = 20) async throws -> CdaHdBrowseResponse {
        let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
        return try await request(
            "GET",
            path: "/api/cda-hd/browse?url=\(encoded)&page=\(page)&limit=\(limit)"
        )
    }

    private struct LatestFeedResponse: Codable {
        let items: [SearchResultItem]
    }

    func fetchInfo(url: String) async throws -> VideoInfoResponse {
        try await request("POST", path: "/api/info", body: ["url": url])
    }

    func startPreview(url: String, height: Int? = nil) async throws -> PreviewResponse {
        var body: [String: Any] = [
            "url": url,
            "playMode": "stream",
        ]
        if let height {
            body["height"] = height
        }
        return try await request("POST", path: "/api/preview", body: body)
    }

    func playToken(jobId: String) async throws -> PlayTokenResponse {
        try await request("GET", path: "/api/play-token/\(jobId)")
    }

    func waitForPreviewReady(
        jobId: String,
        timeoutSeconds: Int = 90,
        onProgress: ((Int) -> Void)? = nil
    ) async throws {
        let deadline = Date().addingTimeInterval(TimeInterval(timeoutSeconds))
        var poll = 0
        while Date() < deadline {
            let job = try await fetchJobStatus(jobId: jobId)
            if job.status == "error" {
                throw APIError.server(job.error ?? "Odtwarzanie nie powiodło się.")
            }
            if let progress = job.progress {
                onProgress?(Int(progress.rounded()))
            }
            if job.ready == true || job.status == "done" {
                return
            }
            poll += 1
            let delayNs: UInt64 = poll < 40 ? 400_000_000 : 800_000_000
            try await Task.sleep(nanoseconds: delayNs)
        }
        throw APIError.server("Przekroczono czas oczekiwania na przygotowanie odtwarzania.")
    }

    func streamURL(jobId: String, token: String) -> URL {
        AppConfig.apiBaseURL
            .appendingPathComponent("api/play/\(jobId)")
            .appending(queryItems: [
                URLQueryItem(name: "token", value: token),
                URLQueryItem(name: "t", value: String(Int(Date().timeIntervalSince1970))),
            ])
    }

    // MARK: - HTTP

    private struct OkResponse: Codable { let ok: Bool? }

    /// Dopasowany timeout na wolne endpointy (yt-dlp/Cloudflare potrafią się długo namyślać).
    private func timeoutInterval(forPath path: String) -> TimeInterval {
        if path.hasPrefix("/api/search") { return 40 }
        if path.hasPrefix("/api/info") { return 120 }
        if path.hasPrefix("/api/cda-hd/") { return 45 }
        return 30
    }

    private func requestJSON<T: Decodable, B: Encodable>(
        _ method: String,
        path: String,
        encodable: B,
        authorized: Bool = true
    ) async throws -> T {
        var url = AppConfig.apiBaseURL
        if path.hasPrefix("/") {
            url = URL(string: AppConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path)!
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = timeoutInterval(forPath: path)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("NostalgieMovies-tvOS/1.0", forHTTPHeaderField: "User-Agent")
        if authorized, let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = try JSONEncoder().encode(encodable)
        return try await perform(req)
    }

    private func request<T: Decodable>(
        _ method: String,
        path: String,
        body: [String: Any]? = nil,
        authorized: Bool = true
    ) async throws -> T {
        var url = AppConfig.apiBaseURL
        if path.hasPrefix("/") {
            url = URL(string: AppConfig.apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path)!
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = timeoutInterval(forPath: path)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("NostalgieMovies-tvOS/1.0", forHTTPHeaderField: "User-Agent")
        if authorized, let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        return try await perform(req)
    }

    private func perform<T: Decodable>(_ req: URLRequest) async throws -> T {
        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse else { throw APIError.decode }

            if http.statusCode == 401 {
                if let err = try? JSONDecoder().decode(ServerErrorBody.self, from: data), let msg = err.error {
                    if msg == "unauthorized" {
                        throw APIError.server("Serwer odrzucił żądanie — spróbuj ponownie za chwilę.")
                    }
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
        } catch let urlError as URLError where urlError.code == .timedOut {
            throw APIError.server("Serwer nie odpowiedział na czas — spróbuj ponownie za chwilę.")
        } catch {
            throw APIError.network(error)
        }
    }

    private struct ServerErrorBody: Codable {
        let error: String?
    }
}

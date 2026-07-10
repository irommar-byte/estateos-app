import Foundation

@MainActor
final class MusicSourcesStore: ObservableObject {
    @Published private(set) var sources: [ConnectedMusicSource] = []

    private let storageKey = "eosmusic.connected-sources"
    private let passwordService = "pl.nostalgie.eosmusic.sources"
    private var scopedRoots: [UUID: URL] = [:]

    init() {
        load()
    }

    func connectFolder(kind: MusicSourceKind, name: String, folderURL: URL, accountEmail: String? = nil) throws {
        let targetURL = folderURL.hasDirectoryPath ? folderURL : folderURL.deletingLastPathComponent()
        let didAccess = targetURL.startAccessingSecurityScopedResource()
        defer {
            if didAccess { targetURL.stopAccessingSecurityScopedResource() }
        }

        let bookmark = try targetURL.bookmarkData(
            options: [],
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
        let source = ConnectedMusicSource(
            id: UUID(),
            kind: kind,
            name: name,
            connectedAt: Date(),
            folderBookmark: bookmark,
            webDAVBaseURL: nil,
            webDAVUsername: nil,
            webDAVRootPath: nil,
            accountEmail: accountEmail,
            googleDriveFolderId: nil
        )
        sources.append(source)
        save()
    }

    func connectGoogleDriveFolder(name: String, folderId: String, email: String) {
        let source = ConnectedMusicSource(
            id: UUID(),
            kind: .googleDrive,
            name: name,
            connectedAt: Date(),
            folderBookmark: nil,
            webDAVBaseURL: nil,
            webDAVUsername: nil,
            webDAVRootPath: nil,
            accountEmail: email,
            googleDriveFolderId: folderId
        )
        sources.append(source)
        save()
    }

    func connectQNAP(name: String, host: String, port: Int, path: String, username: String, password: String) async throws {
        let trimmedHost = host.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
        guard !trimmedHost.isEmpty else { throw WebDAVError.invalidURL }

        var rootPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
        if rootPath.isEmpty { rootPath = "/" }
        if !rootPath.hasPrefix("/") { rootPath = "/" + rootPath }

        let portCandidates = QnapWebDAVDefaults.probeOrder(preferredPort: port)
        guard !portCandidates.isEmpty else { throw WebDAVError.invalidURL }

        var lastError: Error = WebDAVError.server("Nie udało się połączyć z WebDAV QNAP.")
        var discoveredShares: [String] = []

        for candidate in portCandidates {
            guard let rootBase = QnapWebDAVDefaults.buildBaseURL(
                host: trimmedHost,
                scheme: candidate.scheme,
                port: candidate.port,
                rootPath: "/"
            ) else { continue }

            let rootClient = WebDAVClient(baseURL: rootBase, username: username, password: password)

            let shares: [WebDAVEntry]
            do {
                shares = try await rootClient.listShareFolders()
                discoveredShares = shares.map(\.name)
            } catch WebDAVError.unauthorized {
                throw WebDAVError.unauthorized
            } catch {
                continue
            }

            let wantedShare = rootPath == "/" ? "" : String(rootPath.dropFirst())
            var pathsToTry = QnapWebDAVDefaults.pathsToProbe(userPath: rootPath)

            if !wantedShare.isEmpty, let match = QnapWebDAVDefaults.matchShare(named: wantedShare, in: shares) {
                let matched = "/" + match.name
                if !pathsToTry.contains(matched) { pathsToTry.insert(matched, at: 0) }
            } else if wantedShare.isEmpty, shares.count == 1, let only = shares.first {
                pathsToTry.insert("/" + only.name, at: 0)
            }

            for tryPath in pathsToTry {
                guard let base = QnapWebDAVDefaults.buildBaseURL(
                    host: trimmedHost,
                    scheme: candidate.scheme,
                    port: candidate.port,
                    rootPath: tryPath
                ) else { continue }

                let client = WebDAVClient(baseURL: base, username: username, password: password)
                do {
                    _ = try await client.list(relativePath: "")
                    try saveConnectedSource(
                        name: name,
                        host: trimmedHost,
                        base: base,
                        username: username,
                        password: password
                    )
                    return
                } catch WebDAVError.unauthorized {
                    throw WebDAVError.unauthorized
                } catch WebDAVError.forbidden {
                    continue
                } catch let error as URLError where error.code == .timedOut {
                    lastError = WebDAVError.server("Przekroczono czas połączenia (\(candidate.scheme)://\(trimmedHost):\(candidate.port)).")
                } catch {
                    lastError = error
                }
            }
        }

        if !discoveredShares.isEmpty {
            throw WebDAVError.forbidden(availableShares: discoveredShares)
        }
        throw lastError
    }

    private func saveConnectedSource(name: String, host: String, base: URL, username: String, password: String) throws {
        let source = ConnectedMusicSource(
            id: UUID(),
            kind: .qnap,
            name: name.isEmpty ? host : name,
            connectedAt: Date(),
            folderBookmark: nil,
            webDAVBaseURL: base.absoluteString,
            webDAVUsername: username,
            webDAVRootPath: "/",
            accountEmail: username,
            googleDriveFolderId: nil
        )
        try savePassword(password, for: source.id)
        sources.append(source)
        save()
    }

    func disconnect(_ source: ConnectedMusicSource) {
        endAccess(sourceId: source.id)
        deletePassword(for: source.id)
        sources.removeAll { $0.id == source.id }
        save()
    }

    func listTracks(
        for source: ConnectedMusicSource,
        onProgress: (@MainActor (Int, String) -> Void)? = nil
    ) async throws -> [ExternalAudioTrack] {
        if source.isWebDAV {
            return try await listWebDAVTracks(source: source, onProgress: onProgress)
        }
        if source.isGoogleDriveAPI {
            return try await listGoogleDriveTracks(source: source)
        }
        return try listFolderTracks(source: source)
    }

    func resolvePlayableFile(for track: MusicPlaybackTrack) async throws -> URL {
        if let file = track.playbackFileURL, FileManager.default.fileExists(atPath: file.path) {
            return try await ensureReadableExternalFile(file)
        }
        if let sourceId = track.externalSourceId,
           let relative = track.externalRelativePath,
           !relative.isEmpty,
           let root = beginAccess(sourceId: sourceId) {
            let candidate = root.appendingPathComponent(relative)
            if FileManager.default.fileExists(atPath: candidate.path) {
                return try await ensureReadableExternalFile(candidate)
            }
        }
        if let fileId = track.googleDriveFileId {
            let token = try await GoogleDriveAuthService.shared.accessToken()
            let client = GoogleDriveClient(accessToken: token)
            let filename = track.title + ".mp3"
            return try await client.downloadTemporaryFile(fileId: fileId, filename: filename)
        }
        guard let sourceId = track.externalSourceId,
              let webPath = track.webDAVPath,
              let source = sources.first(where: { $0.id == sourceId }),
              let base = source.webDAVBaseURL,
              let url = URL(string: base),
              let username = source.webDAVUsername else {
            throw APIError.server("Nie można odtworzyć pliku z chmury.")
        }
        let password = loadPassword(for: sourceId) ?? ""
        let client = WebDAVClient(baseURL: url, username: username, password: password)
        return try await client.downloadTemporaryFile(relativePath: webPath)
    }

    private func ensureReadableExternalFile(_ url: URL) async throws -> URL {
        var values = try? url.resourceValues(forKeys: [.isUbiquitousItemKey, .ubiquitousItemDownloadingStatusKey])
        if values?.isUbiquitousItem == true {
            do {
                try FileManager.default.startDownloadingUbiquitousItem(at: url)
            } catch {
                // Nie blokuj odtwarzania jeśli plik już jest lokalnie.
            }

            let timeout = Date().addingTimeInterval(12)
            while Date() < timeout {
                values = try? url.resourceValues(forKeys: [.ubiquitousItemDownloadingStatusKey])
                let status = values?.ubiquitousItemDownloadingStatus
                if status == URLUbiquitousItemDownloadingStatus.current ||
                    status == URLUbiquitousItemDownloadingStatus.downloaded {
                    break
                }
                try await Task.sleep(nanoseconds: 250_000_000)
            }
        }
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw APIError.server("Plik iCloud nie jest jeszcze dostępny offline.")
        }
        if !url.path.hasPrefix(AppDocuments.root.path) {
            let temp = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString + "_" + url.lastPathComponent)
            if FileManager.default.fileExists(atPath: temp.path) {
                try? FileManager.default.removeItem(at: temp)
            }
            try FileManager.default.copyItem(at: url, to: temp)
            return temp
        }
        return url
    }

    func beginAccess(sourceId: UUID) -> URL? {
        if let existing = scopedRoots[sourceId] {
            if FileManager.default.fileExists(atPath: existing.path) { return existing }
            existing.stopAccessingSecurityScopedResource()
            scopedRoots.removeValue(forKey: sourceId)
        }
        guard let sourceIndex = sources.firstIndex(where: { $0.id == sourceId }) else { return nil }
        let source = sources[sourceIndex]
        guard
              let bookmark = source.folderBookmark else { return nil }
        var isStale = false
        guard let url = try? URL(
            resolvingBookmarkData: bookmark,
            options: [.withoutUI],
            relativeTo: nil,
            bookmarkDataIsStale: &isStale
        ),
        url.startAccessingSecurityScopedResource() else { return nil }
        if isStale,
           let freshBookmark = try? url.bookmarkData(
            options: [],
            includingResourceValuesForKeys: nil,
            relativeTo: nil
           ) {
            sources[sourceIndex].folderBookmark = freshBookmark
            save()
        }
        scopedRoots[sourceId] = url
        return url
    }

    func endAccess(sourceId: UUID) {
        scopedRoots[sourceId]?.stopAccessingSecurityScopedResource()
        scopedRoots.removeValue(forKey: sourceId)
    }

    func endAllAccess() {
        for id in scopedRoots.keys { endAccess(sourceId: id) }
    }

    // MARK: - Private

    private func listFolderTracks(source: ConnectedMusicSource) throws -> [ExternalAudioTrack] {
        guard let root = beginAccess(sourceId: source.id) else {
            throw APIError.server("Brak dostępu do folderu. Połącz ponownie.")
        }
        var results: [ExternalAudioTrack] = []
        collectAudio(at: root, relativeTo: root, sourceId: source.id, into: &results)
        if results.isEmpty {
            // Provider chmurowy przez Files czasem chwilowo zwraca pustą listę/zerwanie.
            // Jedna szybka próba ponowna znacząco zmniejsza "spróbuj ponownie".
            collectAudio(at: root, relativeTo: root, sourceId: source.id, into: &results)
        }
        return results.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    private func collectAudio(at url: URL, relativeTo root: URL, sourceId: UUID, into results: inout [ExternalAudioTrack]) {
        guard let items = try? FileManager.default.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else { return }

        for item in items {
            let values = try? item.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey])
            if values?.isDirectory == true {
                collectAudio(at: item, relativeTo: root, sourceId: sourceId, into: &results)
                continue
            }
            guard isAudioFileName(item.lastPathComponent) else { continue }
            let relative = item.path.replacingOccurrences(of: root.path + "/", with: "")
            let parsed = parseAudioTitle(from: item.lastPathComponent)
            results.append(
                ExternalAudioTrack(
                    id: "\(sourceId.uuidString)|\(relative)",
                    title: parsed.title,
                    artist: parsed.artist,
                    album: (item.deletingLastPathComponent().lastPathComponent),
                    relativePath: relative,
                    fileURL: item,
                    webDAVPath: nil,
                    googleDriveFileId: nil,
                    fileSize: Int64(values?.fileSize ?? 0)
                )
            )
        }
    }

    private func listGoogleDriveTracks(source: ConnectedMusicSource) async throws -> [ExternalAudioTrack] {
        guard let folderId = source.googleDriveFolderId else { return [] }
        let token = try await GoogleDriveAuthService.shared.accessToken()
        let client = GoogleDriveClient(accessToken: token)
        let files = try await client.collectAudioFiles(folderId: folderId)
        return files.map { file in
            let parsed = parseAudioTitle(from: file.name)
            return ExternalAudioTrack(
                id: "\(source.id.uuidString)|\(file.id)",
                title: parsed.title,
                artist: parsed.artist,
                album: nil,
                relativePath: file.name,
                fileURL: nil,
                webDAVPath: nil,
                googleDriveFileId: file.id,
                fileSize: file.size
            )
        }
    }

    private func listWebDAVTracks(
        source: ConnectedMusicSource,
        onProgress: (@MainActor (Int, String) -> Void)? = nil
    ) async throws -> [ExternalAudioTrack] {
        guard let base = source.webDAVBaseURL,
              let url = URL(string: base),
              let username = source.webDAVUsername else { return [] }
        let password = loadPassword(for: source.id) ?? ""
        let client = WebDAVClient(baseURL: url, username: username, password: password)
        var tracks: [ExternalAudioTrack] = []
        var visited: Set<String> = []
        try await collectWebDAV(
            client: client,
            relativePath: "",
            depth: 0,
            sourceId: source.id,
            visited: &visited,
            into: &tracks,
            onProgress: onProgress
        )
        return tracks.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    private static let webDAVMaxDepth = 12
    private static let webDAVMaxTracks = 8_000

    private func collectWebDAV(
        client: WebDAVClient,
        relativePath: String,
        depth: Int,
        sourceId: UUID,
        visited: inout Set<String>,
        into tracks: inout [ExternalAudioTrack],
        onProgress: (@MainActor (Int, String) -> Void)?
    ) async throws {
        guard depth <= Self.webDAVMaxDepth else { return }
        guard tracks.count < Self.webDAVMaxTracks else { return }

        let key = relativePath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard visited.insert(key).inserted else { return }

        let entries = try await client.list(relativePath: relativePath)
        for entry in entries {
            if entry.isDirectory {
                try await collectWebDAV(
                    client: client,
                    relativePath: entry.relativePath,
                    depth: depth + 1,
                    sourceId: sourceId,
                    visited: &visited,
                    into: &tracks,
                    onProgress: onProgress
                )
            } else if isAudioFileName(entry.name) {
                let parsed = parseAudioTitle(from: entry.name)
                tracks.append(
                    ExternalAudioTrack(
                        id: "\(sourceId.uuidString)|\(entry.relativePath)",
                        title: parsed.title,
                        artist: parsed.artist,
                        album: nil,
                        relativePath: entry.relativePath,
                        fileURL: nil,
                        webDAVPath: entry.relativePath,
                        googleDriveFileId: nil,
                        fileSize: entry.size
                    )
                )
                if let onProgress {
                    let count = tracks.count
                    let folder = (entry.relativePath as NSString).deletingLastPathComponent
                    await onProgress(count, folder.isEmpty ? entry.name : folder)
                }
            }
            if tracks.count >= Self.webDAVMaxTracks { return }
        }
    }

    private func savePassword(_ password: String, for id: UUID) throws {
        try KeychainHelper.save(Data(password.utf8), service: passwordService, account: id.uuidString)
    }

    private func loadPassword(for id: UUID) -> String? {
        guard let data = KeychainHelper.load(service: passwordService, account: id.uuidString) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func deletePassword(for id: UUID) {
        KeychainHelper.delete(service: passwordService, account: id.uuidString)
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([ConnectedMusicSource].self, from: data) else {
            sources = []
            return
        }
        sources = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(sources) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}

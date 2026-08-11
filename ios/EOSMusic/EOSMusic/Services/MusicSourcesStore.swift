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
        let accessed = folderURL.startAccessingSecurityScopedResource()
        defer { if accessed { folderURL.stopAccessingSecurityScopedResource() } }

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: folderURL.path, isDirectory: &isDirectory) else {
            throw APIError.server("Wybrany element nie istnieje.")
        }

        if isDirectory.boolValue {
            try connectExternalFolder(kind: kind, name: name, folderURL: folderURL, accountEmail: accountEmail)
        } else {
            try connectSandboxFile(kind: kind, name: name, fileURL: folderURL, accountEmail: accountEmail)
        }
    }

    /// Re-link a folder after iOS revoked the security-scoped bookmark.
    func reconnectFolder(sourceId: UUID, folderURL: URL) throws {
        guard let index = sources.firstIndex(where: { $0.id == sourceId }) else {
            throw APIError.server("Nie znaleziono źródła.")
        }
        let existing = sources[index]
        endAccess(sourceId: sourceId)

        if existing.isSandboxFile, let rel = existing.sandboxRelativePath {
            let url = AppDocuments.root.appendingPathComponent(rel)
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
        }

        let accessed = folderURL.startAccessingSecurityScopedResource()
        defer { if accessed { folderURL.stopAccessingSecurityScopedResource() } }

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: folderURL.path, isDirectory: &isDirectory) else {
            throw APIError.server("Wybrany element nie istnieje.")
        }

        if isDirectory.boolValue {
            let bookmark = try makeFolderBookmark(from: folderURL)
            sources[index].storageKind = .folderBookmark
            sources[index].folderBookmark = bookmark
            sources[index].sandboxRelativePath = nil
        } else {
            guard isAudioFileName(folderURL.lastPathComponent) else {
                throw APIError.server("To nie jest obsługiwany plik audio.")
            }
            let rel = try copyIntoSandbox(fileURL: folderURL, sourceId: existing.id)
            sources[index].storageKind = .sandboxFile
            sources[index].folderBookmark = nil
            sources[index].sandboxRelativePath = rel
            sources[index].name = nameIfNeeded(existing.name, fileURL: folderURL)
        }
        save()
    }

    private func connectExternalFolder(
        kind: MusicSourceKind,
        name: String,
        folderURL: URL,
        accountEmail: String?
    ) throws {
        let bookmark = try makeFolderBookmark(from: folderURL)
        let display = name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? folderURL.lastPathComponent
            : name
        let source = ConnectedMusicSource(
            id: UUID(),
            kind: kind,
            name: display,
            connectedAt: Date(),
            folderBookmark: bookmark,
            storageKind: .folderBookmark,
            accountEmail: accountEmail
        )
        sources.append(source)
        sources.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        save()
    }

    private func connectSandboxFile(
        kind: MusicSourceKind,
        name: String,
        fileURL: URL,
        accountEmail: String?
    ) throws {
        guard isAudioFileName(fileURL.lastPathComponent) else {
            throw APIError.server("To nie jest obsługiwany plik audio (MP3, M4A, FLAC…).")
        }
        let id = UUID()
        let rel = try copyIntoSandbox(fileURL: fileURL, sourceId: id)
        let display = name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? (fileURL.deletingPathExtension().lastPathComponent)
            : name
        let source = ConnectedMusicSource(
            id: id,
            kind: kind,
            name: display,
            connectedAt: Date(),
            folderBookmark: nil,
            storageKind: .sandboxFile,
            sandboxRelativePath: rel,
            accountEmail: accountEmail
        )
        sources.append(source)
        sources.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        save()
    }

    private func copyIntoSandbox(fileURL: URL, sourceId: UUID) throws -> String {
        AppDocuments.ensureStructure()
        let dir = AppDocuments.musicSourceImports.appendingPathComponent(sourceId.uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let dest = dir.appendingPathComponent(fileURL.lastPathComponent)
        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        try FileManager.default.copyItem(at: fileURL, to: dest)
        return "Imports/Sources/\(sourceId.uuidString)/\(fileURL.lastPathComponent)"
    }

    private func nameIfNeeded(_ current: String, fileURL: URL) -> String {
        if isAudioFileName(current) {
            return (fileURL.deletingPathExtension().lastPathComponent)
        }
        return current
    }

    private func makeFolderBookmark(from folderURL: URL) throws -> Data {
        let picked = folderURL
        let didAccessPicked = picked.startAccessingSecurityScopedResource()
        defer {
            if didAccessPicked { picked.stopAccessingSecurityScopedResource() }
        }

        let values = try? picked.resourceValues(forKeys: [.isDirectoryKey])
        let isDirectory = values?.isDirectory == true || picked.hasDirectoryPath

        if isDirectory {
            return try picked.bookmarkData(
                options: [],
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )
        }

        let parent = picked.deletingLastPathComponent()
        let didAccessParent = parent.startAccessingSecurityScopedResource()
        defer {
            if didAccessParent { parent.stopAccessingSecurityScopedResource() }
        }
        if didAccessParent {
            return try parent.bookmarkData(
                options: [],
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )
        }
        return try picked.bookmarkData(
            options: [],
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
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
        if source.isSandboxFile, let rel = source.sandboxRelativePath {
            let fileURL = AppDocuments.root.appendingPathComponent(rel)
            try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent())
        }
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
        // Prefer HTTP streaming for AVPlayer — avoid buffering the whole file into a temp download.
        return client.streamURL(relativePath: webPath)
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

        if source.isSandboxFile, let rel = source.sandboxRelativePath {
            let url = AppDocuments.root.appendingPathComponent(rel)
            guard FileManager.default.fileExists(atPath: url.path) else { return nil }
            scopedRoots[sourceId] = url
            return url
        }

        guard let bookmark = source.folderBookmark else { return nil }
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
        if source.isSandboxFile {
            return try listSandboxFile(source)
        }
        guard let root = beginAccess(sourceId: source.id) else {
            throw APIError.server("Brak dostępu do folderu. Połącz ponownie.")
        }
        var isDir: ObjCBool = false
        if FileManager.default.fileExists(atPath: root.path, isDirectory: &isDir), !isDir.boolValue {
            return try listSandboxFile(fromExternalFile: root, source: source)
        }
        var results: [ExternalAudioTrack] = []
        collectAudio(at: root, relativeTo: root, sourceId: source.id, into: &results)
        if results.isEmpty {
            collectAudio(at: root, relativeTo: root, sourceId: source.id, into: &results)
        }
        return results.sortedForBrowse()
    }

    private func listSandboxFile(_ source: ConnectedMusicSource) throws -> [ExternalAudioTrack] {
        guard let rel = source.sandboxRelativePath else {
            throw APIError.server("Brak lokalnej kopii pliku.")
        }
        let url = AppDocuments.root.appendingPathComponent(rel)
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw APIError.server("Lokalna kopia zniknęła — dodaj plik ponownie.")
        }
        return try listSandboxFile(fromExternalFile: url, source: source)
    }

    private func listSandboxFile(fromExternalFile url: URL, source: ConnectedMusicSource) throws -> [ExternalAudioTrack] {
        guard isAudioFileName(url.lastPathComponent) else { return [] }
        let values = try? url.resourceValues(forKeys: [.fileSizeKey])
        let relative = url.lastPathComponent
        let meta = parseAudioMetadata(filename: url.lastPathComponent, relativePath: relative)
        return [
            ExternalAudioTrack(
                id: "\(source.id.uuidString)|\(relative)",
                title: meta.title,
                artist: meta.artist,
                album: meta.album,
                relativePath: relative,
                fileURL: url,
                webDAVPath: nil,
                googleDriveFileId: nil,
                fileSize: Int64(values?.fileSize ?? 0)
            )
        ]
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
            let meta = parseAudioMetadata(filename: item.lastPathComponent, relativePath: relative)
            results.append(
                ExternalAudioTrack(
                    id: "\(sourceId.uuidString)|\(relative)",
                    title: meta.title,
                    artist: meta.artist,
                    album: meta.album,
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
        sources = decoded.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(sources) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}

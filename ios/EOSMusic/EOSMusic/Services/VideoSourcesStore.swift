import Foundation

@MainActor
final class VideoSourcesStore: ObservableObject {
    @Published private(set) var folders: [ConnectedVideoFolder] = []

    private let storageKey = "eosmusic.video-folders.v2"
    private let legacyStorageKey = "eosmusic.video-folders"
    private var scopedRoots: [UUID: URL] = [:]

    init() {
        load()
    }

    func connectFolder(name: String, folderURL: URL) throws {
        let accessed = folderURL.startAccessingSecurityScopedResource()
        defer { if accessed { folderURL.stopAccessingSecurityScopedResource() } }

        let values = try? folderURL.resourceValues(forKeys: [.isDirectoryKey])
        let isDirectory = values?.isDirectory == true || folderURL.hasDirectoryPath

        if isDirectory {
            try connectExternalFolder(name: name, folderURL: folderURL)
        } else {
            try connectSandboxFile(name: name, fileURL: folderURL)
        }
    }

    func reconnectFolder(folderId: UUID, folderURL: URL) throws {
        guard let index = folders.firstIndex(where: { $0.id == folderId }) else {
            throw APIError.server("Nie znaleziono folderu wideo.")
        }
        let existing = folders[index]
        endAccess(folderId: folderId)
        if existing.kind == .sandboxFile, let rel = existing.sandboxRelativePath {
            let url = AppDocuments.root.appendingPathComponent(rel)
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
        }

        let accessed = folderURL.startAccessingSecurityScopedResource()
        defer { if accessed { folderURL.stopAccessingSecurityScopedResource() } }
        let values = try? folderURL.resourceValues(forKeys: [.isDirectoryKey])
        let isDirectory = values?.isDirectory == true || folderURL.hasDirectoryPath

        if isDirectory {
            let bookmark = try makeSecurityScopedBookmark(from: folderURL)
            folders[index].kind = .folderBookmark
            folders[index].folderBookmark = bookmark
            folders[index].sandboxRelativePath = nil
        } else {
            let id = existing.id
            let rel = try copyIntoSandbox(fileURL: folderURL, folderId: id)
            folders[index].kind = .sandboxFile
            folders[index].folderBookmark = nil
            folders[index].sandboxRelativePath = rel
            folders[index].name = nameIfNeeded(folders[index].name, fileURL: folderURL)
        }
        save()
        objectWillChange.send()
    }

    func disconnect(_ folder: ConnectedVideoFolder) {
        endAccess(folderId: folder.id)
        if folder.kind == .sandboxFile, let rel = folder.sandboxRelativePath {
            let fileURL = AppDocuments.root.appendingPathComponent(rel)
            try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent())
        }
        folders.removeAll { $0.id == folder.id }
        save()
        objectWillChange.send()
    }

    func listVideos(for folder: ConnectedVideoFolder) throws -> [VideoItem] {
        switch folder.kind {
        case .sandboxFile:
            return try listSandboxFile(folder)
        case .folderBookmark:
            guard let root = beginAccess(folderId: folder.id) else {
                throw APIError.server("Brak dostępu do folderu. Połącz ponownie (Pliki / USB).")
            }
            // Picked item was actually a file bookmark (legacy).
            var isDir: ObjCBool = false
            if FileManager.default.fileExists(atPath: root.path, isDirectory: &isDir), !isDir.boolValue {
                return [videoItem(fromFile: root, folderId: folder.id, relativePath: root.lastPathComponent)]
            }
            var results: [VideoItem] = []
            collectVideos(at: root, relativeTo: root, folderId: folder.id, into: &results)
            if results.isEmpty {
                collectVideos(at: root, relativeTo: root, folderId: folder.id, into: &results)
            }
            return results.sorted {
                $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
            }
        }
    }

    func resolvePlayableURL(for item: VideoItem) throws -> URL {
        if let folder = folders.first(where: { $0.id == item.folderId }), folder.kind == .sandboxFile {
            guard let rel = folder.sandboxRelativePath else {
                throw APIError.server("Brak lokalnej kopii filmu.")
            }
            let url = AppDocuments.root.appendingPathComponent(rel)
            guard FileManager.default.fileExists(atPath: url.path) else {
                throw APIError.server("Plik lokalny zniknął — dodaj film ponownie.")
            }
            return url
        }
        if let file = item.fileURL {
            if !file.isFileURL {
                return file
            }
            if FileManager.default.fileExists(atPath: file.path) {
                return file
            }
        }
        guard let root = beginAccess(folderId: item.folderId) else {
            throw APIError.server("Brak dostępu do folderu wideo.")
        }
        var isDir: ObjCBool = false
        if FileManager.default.fileExists(atPath: root.path, isDirectory: &isDir), !isDir.boolValue {
            return root
        }
        let candidate = root.appendingPathComponent(item.relativePath)
        guard FileManager.default.fileExists(atPath: candidate.path) else {
            throw APIError.server("Nie znaleziono pliku: \(item.relativePath)")
        }
        return candidate
    }

    @discardableResult
    func beginAccess(folderId: UUID) -> URL? {
        if let existing = scopedRoots[folderId] {
            if FileManager.default.fileExists(atPath: existing.path) { return existing }
            existing.stopAccessingSecurityScopedResource()
            scopedRoots.removeValue(forKey: folderId)
        }
        guard let index = folders.firstIndex(where: { $0.id == folderId }) else { return nil }
        let folder = folders[index]
        if folder.kind == .sandboxFile {
            guard let rel = folder.sandboxRelativePath else { return nil }
            let url = AppDocuments.root.appendingPathComponent(rel).deletingLastPathComponent()
            scopedRoots[folderId] = url
            return url
        }
        guard let bookmark = folder.folderBookmark,
              let url = resolveSecurityScopedURL(bookmark) else { return nil }

        if let fresh = try? makeSecurityScopedBookmark(from: url), fresh != bookmark {
            folders[index].folderBookmark = fresh
            save()
        }
        scopedRoots[folderId] = url
        return url
    }

    func endAccess(folderId: UUID) {
        guard let url = scopedRoots.removeValue(forKey: folderId) else { return }
        // Sandbox paths don't need stopAccessing.
        if folders.first(where: { $0.id == folderId })?.kind == .folderBookmark {
            url.stopAccessingSecurityScopedResource()
        }
    }

    func endAllAccess() {
        for id in Array(scopedRoots.keys) { endAccess(folderId: id) }
    }

    // MARK: - Connect helpers

    private func connectExternalFolder(name: String, folderURL: URL) throws {
        let bookmark = try makeSecurityScopedBookmark(from: folderURL)
        // Validate immediately while scope is live.
        var isStale = false
        guard let resolved = try? URL(
            resolvingBookmarkData: bookmark,
            options: [.withoutUI],
            relativeTo: nil,
            bookmarkDataIsStale: &isStale
        ), resolved.startAccessingSecurityScopedResource() else {
            throw APIError.server("iOS nie pozwolił zapisać dostępu do folderu. Wybierz folder jeszcze raz.")
        }
        resolved.stopAccessingSecurityScopedResource()

        let folder = ConnectedVideoFolder(
            id: UUID(),
            name: name,
            connectedAt: Date(),
            kind: .folderBookmark,
            folderBookmark: bookmark,
            sandboxRelativePath: nil
        )
        folders.append(folder)
        folders.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        save()
        objectWillChange.send()
    }

    private func connectSandboxFile(name: String, fileURL: URL) throws {
        guard isVideoFileName(fileURL.lastPathComponent) else {
            throw APIError.server("To nie jest obsługiwany plik wideo.")
        }
        let id = UUID()
        let rel = try copyIntoSandbox(fileURL: fileURL, folderId: id)
        let display = name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? (fileURL.deletingPathExtension().lastPathComponent)
            : name
        let folder = ConnectedVideoFolder(
            id: id,
            name: display,
            connectedAt: Date(),
            kind: .sandboxFile,
            folderBookmark: nil,
            sandboxRelativePath: rel
        )
        folders.append(folder)
        folders.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        save()
        objectWillChange.send()
    }

    private func copyIntoSandbox(fileURL: URL, folderId: UUID) throws -> String {
        AppDocuments.ensureStructure()
        let dir = AppDocuments.videoImports.appendingPathComponent(folderId.uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let dest = dir.appendingPathComponent(fileURL.lastPathComponent)
        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        try FileManager.default.copyItem(at: fileURL, to: dest)
        return "\(AppDocuments.videoFolderName)/Imports/\(folderId.uuidString)/\(fileURL.lastPathComponent)"
    }

    private func listSandboxFile(_ folder: ConnectedVideoFolder) throws -> [VideoItem] {
        guard let rel = folder.sandboxRelativePath else {
            throw APIError.server("Brak lokalnej kopii filmu.")
        }
        let url = AppDocuments.root.appendingPathComponent(rel)
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw APIError.server("Lokalna kopia filmu zniknęła — dodaj plik ponownie.")
        }
        return [videoItem(fromFile: url, folderId: folder.id, relativePath: url.lastPathComponent)]
    }

    private func videoItem(fromFile url: URL, folderId: UUID, relativePath: String) -> VideoItem {
        let values = try? url.resourceValues(forKeys: [.fileSizeKey])
        let title = (url.lastPathComponent as NSString).deletingPathExtension
        return VideoItem(
            id: "\(folderId.uuidString)|\(relativePath)",
            title: title.isEmpty ? url.lastPathComponent : title,
            relativePath: relativePath,
            fileURL: url,
            fileSize: Int64(values?.fileSize ?? 0),
            folderId: folderId
        )
    }

    private func nameIfNeeded(_ current: String, fileURL: URL) -> String {
        if isVideoFileName(current) {
            return (fileURL.lastPathComponent as NSString).deletingPathExtension
        }
        return current
    }

    // MARK: - Bookmarks

    private func makeSecurityScopedBookmark(from url: URL) throws -> Data {
        let picked = url
        let didAccessPicked = picked.startAccessingSecurityScopedResource()
        defer { if didAccessPicked { picked.stopAccessingSecurityScopedResource() } }

        let values = try? picked.resourceValues(forKeys: [.isDirectoryKey])
        let isDirectory = values?.isDirectory == true || picked.hasDirectoryPath
        if isDirectory {
            return try picked.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
        }

        // Prefer parent folder when iOS grants it; otherwise bookmark the file itself.
        let parent = picked.deletingLastPathComponent()
        let didAccessParent = parent.startAccessingSecurityScopedResource()
        defer { if didAccessParent { parent.stopAccessingSecurityScopedResource() } }
        if didAccessParent {
            return try parent.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
        }
        return try picked.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
    }

    private func resolveSecurityScopedURL(_ bookmark: Data) -> URL? {
        let optionSets: [URL.BookmarkResolutionOptions] = [[.withoutUI], []]
        for options in optionSets {
            var isStale = false
            guard let url = try? URL(
                resolvingBookmarkData: bookmark,
                options: options,
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            ) else { continue }
            if url.startAccessingSecurityScopedResource() {
                return url
            }
            // Rare: already readable without an extra startAccessing call.
            if FileManager.default.isReadableFile(atPath: url.path) {
                return url
            }
        }
        return nil
    }

    private func collectVideos(at url: URL, relativeTo root: URL, folderId: UUID, into results: inout [VideoItem]) {
        guard let items = try? FileManager.default.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else { return }

        for item in items {
            let values = try? item.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey])
            if values?.isDirectory == true {
                collectVideos(at: item, relativeTo: root, folderId: folderId, into: &results)
                continue
            }
            guard isVideoFileName(item.lastPathComponent) else { continue }
            let relative = item.path.replacingOccurrences(of: root.path + "/", with: "")
            results.append(videoItem(fromFile: item, folderId: folderId, relativePath: relative))
        }
    }

    // MARK: - Persistence

    private func load() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let decoded = try? JSONDecoder().decode([ConnectedVideoFolder].self, from: data) {
            folders = decoded
            return
        }
        // Migrate legacy bookmarks (all treated as folder bookmarks — may need reconnect for files).
        if let data = UserDefaults.standard.data(forKey: legacyStorageKey),
           let legacy = try? JSONDecoder().decode([LegacyVideoFolder].self, from: data) {
            folders = legacy.map {
                ConnectedVideoFolder(
                    id: $0.id,
                    name: $0.name,
                    connectedAt: $0.connectedAt,
                    kind: .folderBookmark,
                    folderBookmark: $0.folderBookmark,
                    sandboxRelativePath: nil
                )
            }
            save()
            UserDefaults.standard.removeObject(forKey: legacyStorageKey)
            return
        }
        folders = []
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(folders) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}

private struct LegacyVideoFolder: Codable {
    let id: UUID
    var name: String
    var connectedAt: Date
    var folderBookmark: Data
}

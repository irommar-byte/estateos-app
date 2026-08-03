import Foundation

@MainActor
final class VideoSourcesStore: ObservableObject {
    @Published private(set) var folders: [ConnectedVideoFolder] = []

    private let storageKey = "eosmusic.video-folders"
    private var scopedRoots: [UUID: URL] = [:]

    init() {
        load()
    }

    func connectFolder(name: String, folderURL: URL) throws {
        let bookmark = try makeFolderBookmark(from: folderURL)
        let folder = ConnectedVideoFolder(
            id: UUID(),
            name: name,
            connectedAt: Date(),
            folderBookmark: bookmark
        )
        folders.append(folder)
        folders.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        save()
    }

    func reconnectFolder(folderId: UUID, folderURL: URL) throws {
        guard let index = folders.firstIndex(where: { $0.id == folderId }) else {
            throw APIError.server("Nie znaleziono folderu wideo.")
        }
        endAccess(folderId: folderId)
        folders[index].folderBookmark = try makeFolderBookmark(from: folderURL)
        save()
    }

    func disconnect(_ folder: ConnectedVideoFolder) {
        endAccess(folderId: folder.id)
        folders.removeAll { $0.id == folder.id }
        save()
    }

    func listVideos(for folder: ConnectedVideoFolder) throws -> [VideoItem] {
        guard let root = beginAccess(folderId: folder.id) else {
            throw APIError.server("Brak dostępu do folderu. Połącz ponownie (Pliki / USB).")
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

    func resolvePlayableURL(for item: VideoItem) throws -> URL {
        if let file = item.fileURL, FileManager.default.fileExists(atPath: file.path) {
            return file
        }
        guard let root = beginAccess(folderId: item.folderId) else {
            throw APIError.server("Brak dostępu do folderu wideo.")
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
        var isStale = false
        guard let url = try? URL(
            resolvingBookmarkData: folders[index].folderBookmark,
            options: [.withoutUI],
            relativeTo: nil,
            bookmarkDataIsStale: &isStale
        ),
        url.startAccessingSecurityScopedResource() else { return nil }

        if isStale,
           let fresh = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) {
            folders[index].folderBookmark = fresh
            save()
        }
        scopedRoots[folderId] = url
        return url
    }

    func endAccess(folderId: UUID) {
        scopedRoots[folderId]?.stopAccessingSecurityScopedResource()
        scopedRoots.removeValue(forKey: folderId)
    }

    func endAllAccess() {
        for id in scopedRoots.keys { endAccess(folderId: id) }
    }

    // MARK: - Private

    private func makeFolderBookmark(from folderURL: URL) throws -> Data {
        let picked = folderURL
        let didAccessPicked = picked.startAccessingSecurityScopedResource()
        defer {
            if didAccessPicked { picked.stopAccessingSecurityScopedResource() }
        }

        let targetURL = picked.hasDirectoryPath ? picked : picked.deletingLastPathComponent()
        let needsParentAccess = targetURL.standardizedFileURL != picked.standardizedFileURL
        let didAccessParent = needsParentAccess ? targetURL.startAccessingSecurityScopedResource() : false
        defer {
            if didAccessParent { targetURL.stopAccessingSecurityScopedResource() }
        }

        let bookmarkURL = (didAccessParent || (targetURL.hasDirectoryPath && didAccessPicked)) ? targetURL : picked
        return try bookmarkURL.bookmarkData(
            options: [],
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
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
            let title = (item.lastPathComponent as NSString).deletingPathExtension
            results.append(
                VideoItem(
                    id: "\(folderId.uuidString)|\(relative)",
                    title: title.isEmpty ? item.lastPathComponent : title,
                    relativePath: relative,
                    fileURL: item,
                    fileSize: Int64(values?.fileSize ?? 0),
                    folderId: folderId
                )
            )
        }
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([ConnectedVideoFolder].self, from: data) else {
            folders = []
            return
        }
        folders = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(folders) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}

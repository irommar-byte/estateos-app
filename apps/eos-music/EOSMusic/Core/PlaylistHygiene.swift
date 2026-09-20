import Foundation

enum PlaylistFolderKind: String, Equatable {
    case primary
    case appleImport
    case spotifyImport
    case albumDump
    case playlist
    case shazam
}

enum PlaylistAutoAcquirePolicy: String, CaseIterable, Identifiable {
    case off
    case server
    case serverAndPhone

    var id: String { rawValue }

    var title: String {
        switch self {
        case .off: return "Wyłączone"
        case .server: return "Na serwer"
        case .serverAndPhone: return "Serwer i iPhone"
        }
    }

    var systemImage: String {
        switch self {
        case .off: return "arrow.down.circle"
        case .server: return "externaldrive.badge.icloud"
        case .serverAndPhone: return "iphone.and.arrow.forward"
        }
    }
}

enum PlaylistImportBadge: Equatable {
    case appleMusic
    case spotify

    var title: String {
        switch self {
        case .appleMusic: return "Apple Music"
        case .spotify: return "Spotify"
        }
    }

    var systemImage: String {
        switch self {
        case .appleMusic: return "applelogo"
        case .spotify: return "waveform"
        }
    }
}

enum PlaylistHygiene {
    static let primaryName = "Moja muzyka"
    static let shazamName = "SHAZAM"

    static func isPrimary(_ folder: MusicFolder) -> Bool {
        folder.name.localizedCaseInsensitiveCompare(primaryName) == .orderedSame
    }

    static func isShazam(_ folder: MusicFolder) -> Bool {
        folder.name.trimmingCharacters(in: .whitespacesAndNewlines)
            .localizedCaseInsensitiveCompare(shazamName) == .orderedSame
    }

    static func importBadge(for folder: MusicFolder) -> PlaylistImportBadge? {
        guard let raw = folder.applePlaylistUrl?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !raw.isEmpty else { return nil }
        if raw.contains("spotify.com") || raw.contains("spotify:") { return .spotify }
        if raw.contains("music.apple.com") || raw.contains("itunes.apple.com") { return .appleMusic }
        return .appleMusic
    }

    static func kind(for folder: MusicFolder, tracks: [MusicTrack]) -> PlaylistFolderKind {
        if isPrimary(folder) { return .primary }
        if isShazam(folder) { return .shazam }
        switch importBadge(for: folder) {
        case .appleMusic: return .appleImport
        case .spotify: return .spotifyImport
        case nil: break
        }
        if isAlbumDump(folder: folder, tracks: tracks) { return .albumDump }
        return .playlist
    }

    static func isAlbumDump(folder: MusicFolder, tracks: [MusicTrack]) -> Bool {
        let owned = tracks.filter { $0.folderId == folder.id }
        guard !owned.isEmpty else { return false }
        if importBadge(for: folder) != nil { return false }
        if isPrimary(folder) { return false }
        if isShazam(folder) { return false }

        let albums = owned.compactMap { $0.album?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !albums.isEmpty else { return false }

        let unique = Set(albums.map { $0.lowercased() })
        guard unique.count == 1, let album = albums.first else { return false }

        if owned.count == 1 { return true }
        return folder.name.localizedCaseInsensitiveCompare(album) == .orderedSame
    }
}

enum PlaylistAutoAcquireStore {
    private static let prefix = "playlist.autoAcquire."

    static func policy(for folderId: String) -> PlaylistAutoAcquirePolicy {
        let raw = UserDefaults.standard.string(forKey: prefix + folderId) ?? PlaylistAutoAcquirePolicy.off.rawValue
        return PlaylistAutoAcquirePolicy(rawValue: raw) ?? .off
    }

    static func set(_ policy: PlaylistAutoAcquirePolicy, for folderId: String) {
        UserDefaults.standard.set(policy.rawValue, forKey: prefix + folderId)
    }
}

enum PlaylistUSBBookmarkStore {
    private static let prefix = "playlist.usbBookmark."

    static func save(url: URL, folderId: String) {
        do {
            let data = try url.bookmarkData(
                options: [.minimalBookmark],
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )
            UserDefaults.standard.set(data, forKey: prefix + folderId)
        } catch {}
    }

    static func resolvedURL(for folderId: String) -> URL? {
        guard let data = UserDefaults.standard.data(forKey: prefix + folderId) else { return nil }
        var stale = false
        guard let url = try? URL(
            resolvingBookmarkData: data,
            options: [.withoutUI],
            relativeTo: nil,
            bookmarkDataIsStale: &stale
        ) else { return nil }
        if stale { save(url: url, folderId: folderId) }
        return url
    }

    static func displayName(for folderId: String) -> String? {
        resolvedURL(for: folderId)?.lastPathComponent
    }

    static func clear(folderId: String) {
        UserDefaults.standard.removeObject(forKey: prefix + folderId)
    }
}

enum PlaylistSortMode: String, CaseIterable, Identifiable {
    case name
    case recentlyAdded
    case custom

    var id: String { rawValue }

    var title: String {
        switch self {
        case .name: return "A–Z"
        case .recentlyAdded: return "Ostatnio dodane"
        case .custom: return "Własna kolejność"
        }
    }
}

enum PlaylistCustomOrderStore {
    private static let key = "playlist.customOrder"

    static func order() -> [String] {
        UserDefaults.standard.stringArray(forKey: key) ?? []
    }

    static func set(_ ids: [String]) {
        UserDefaults.standard.set(ids, forKey: key)
    }
}

import Foundation

/// Local recency for “Dodaj do playlisty” — most recently added-to folders float to the top.
enum RecentPlaylistUsage {
    private static let defaultsKey = "eos.music.recentPlaylistFolderIds"
    private static let maxEntries = 40

    /// Folder IDs, most recent first.
    static var orderedIds: [String] {
        UserDefaults.standard.stringArray(forKey: defaultsKey) ?? []
    }

    static func record(folderId: String) {
        let id = folderId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty else { return }
        var next = orderedIds.filter { $0 != id }
        next.insert(id, at: 0)
        if next.count > maxEntries {
            next = Array(next.prefix(maxEntries))
        }
        UserDefaults.standard.set(next, forKey: defaultsKey)
    }

    /// Stable sort: recent first (by recorded order), then keep the original relative order.
    static func sortFolders(_ folders: [MusicFolder]) -> [MusicFolder] {
        let rank = Dictionary(uniqueKeysWithValues: orderedIds.enumerated().map { ($0.element, $0.offset) })
        return folders.enumerated().sorted { lhs, rhs in
            let l = rank[lhs.element.id]
            let r = rank[rhs.element.id]
            switch (l, r) {
            case let (li?, ri?):
                if li != ri { return li < ri }
                return lhs.offset < rhs.offset
            case (_?, nil):
                return true
            case (nil, _?):
                return false
            case (nil, nil):
                return lhs.offset < rhs.offset
            }
        }.map(\.element)
    }
}

import SwiftUI
import UIKit

enum LibraryCategory: String, Identifiable, CaseIterable, Hashable {
    case playlists
    case artists
    case albums
    case songs
    case downloaded

    var id: String { rawValue }

    var title: String {
        switch self {
        case .playlists: return "Playlisty"
        case .artists: return "Wykonawcy"
        case .albums: return "Albumy"
        case .songs: return "Utwory"
        case .downloaded: return "Pobrane"
        }
    }

    var icon: String {
        switch self {
        case .playlists: return "music.note.list"
        case .artists: return "mic.fill"
        case .albums: return "square.stack.fill"
        case .songs: return "music.note"
        case .downloaded: return "arrow.down.circle.fill"
        }
    }
}

enum LibraryAccent {
    static let icon = Color(red: 0.98, green: 0.24, blue: 0.37)
}

struct LibraryCategoryRow: View {
    let icon: String
    let title: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(LibraryAccent.icon)
                .frame(width: 30, alignment: .center)

            Text(title)
                .font(.body)
                .foregroundStyle(.primary)

            Spacer(minLength: 8)

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

struct RecentLibraryItem: Identifiable, Hashable {
    enum Kind: Hashable {
        case folder(MusicFolder)
        case album(id: String)
    }

    let id: String
    let kind: Kind
    let title: String
    let subtitle: String
    let artworkURL: URL?
}

enum LibraryData {
    static func recentItems(folders: [MusicFolder], tracks: [MusicTrack], limit: Int = 8) -> [RecentLibraryItem] {
        var items: [RecentLibraryItem] = []
        var seen = Set<String>()

        for folder in folders where folder.artworkURL != nil {
            let key = "folder:\(folder.id)"
            guard seen.insert(key).inserted else { continue }
            items.append(RecentLibraryItem(
                id: key,
                kind: .folder(folder),
                title: folder.name,
                subtitle: folder.countLabel,
                artworkURL: folder.artworkURL
            ))
            if items.count >= limit { return items }
        }

        for track in tracks {
            let albumKey = track.albumId ?? track.album.map { "album:\($0)|\(track.artist ?? "")" }
            guard let albumKey else { continue }
            guard seen.insert(albumKey).inserted else { continue }
            guard track.albumId != nil || (track.album?.isEmpty == false) else { continue }
            items.append(RecentLibraryItem(
                id: albumKey,
                kind: .album(id: track.albumId ?? albumKey),
                title: track.album ?? track.title,
                subtitle: track.artist ?? "Nieznany wykonawca",
                artworkURL: track.artworkURL
            ))
            if items.count >= limit { return items }
        }

        for folder in folders where folder.artworkURL == nil {
            let key = "folder:\(folder.id)"
            guard seen.insert(key).inserted else { continue }
            items.append(RecentLibraryItem(
                id: key,
                kind: .folder(folder),
                title: folder.name,
                subtitle: folder.countLabel,
                artworkURL: nil
            ))
            if items.count >= limit { return items }
        }

        return items
    }

    static func artistGroups(from tracks: [MusicTrack]) -> [LibraryArtistGroup] {
        var map: [String: LibraryArtistGroup] = [:]
        for track in tracks {
            let name = track.artist?.trimmingCharacters(in: .whitespacesAndNewlines)
            let resolved = (name?.isEmpty == false) ? name! : "Nieznany wykonawca"
            let key = track.artistId ?? resolved.lowercased()
            if var existing = map[key] {
                existing.trackCount += 1
                if existing.artistId == nil, let artistId = track.artistId { existing.artistId = artistId }
                map[key] = existing
            } else {
                map[key] = LibraryArtistGroup(id: key, name: resolved, artistId: track.artistId, trackCount: 1)
            }
        }
        return map.values.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    static func albumGroups(from tracks: [MusicTrack]) -> [LibraryAlbumGroup] {
        var map: [String: LibraryAlbumGroup] = [:]
        for track in tracks {
            let title = track.album?.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let title, !title.isEmpty else { continue }
            let key = track.albumId ?? "\(title.lowercased())|\(track.artist ?? "")"
            if var existing = map[key] {
                existing.trackCount += 1
                map[key] = existing
            } else {
                map[key] = LibraryAlbumGroup(
                    id: key,
                    albumId: track.albumId,
                    title: title,
                    artist: track.artist,
                    artworkURL: track.artworkURL,
                    trackCount: 1
                )
            }
        }
        return map.values.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    static func downloadedTracks(from tracks: [MusicTrack], isOffline: (String) -> Bool) -> [MusicTrack] {
        var seen = Set<String>()
        return tracks
            .filter { isOffline($0.url) }
            .filter { seen.insert($0.url).inserted }
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    static func search(query: String, folders: [MusicFolder], tracks: [MusicTrack]) -> LibrarySearchResults {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard needle.count >= 2 else { return .empty }

        let matchingTracks = tracks.filter { track in
            matches(needle, track.title)
                || matches(needle, track.artist)
                || matches(needle, track.album)
        }

        let playlists = folders
            .filter { matches(needle, $0.name) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }

        var artists = artistGroups(from: tracks).filter { matches(needle, $0.name) }
        for group in artistGroups(from: matchingTracks) where !artists.contains(where: { $0.id == group.id }) {
            artists.append(group)
        }
        artists.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }

        var albums = albumGroups(from: tracks).filter {
            matches(needle, $0.title) || matches(needle, $0.artist)
        }
        for group in albumGroups(from: matchingTracks) where !albums.contains(where: { $0.id == group.id }) {
            albums.append(group)
        }
        albums.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }

        let songs = matchingTracks.sorted {
            $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
        }

        return LibrarySearchResults(
            playlists: playlists,
            artists: artists,
            albums: albums,
            songs: songs
        )
    }

    private static func matches(_ query: String, _ value: String?) -> Bool {
        guard let value else { return false }
        return value.localizedCaseInsensitiveContains(query)
    }
}

struct LibrarySearchResults {
    var playlists: [MusicFolder]
    var artists: [LibraryArtistGroup]
    var albums: [LibraryAlbumGroup]
    var songs: [MusicTrack]

    static let empty = LibrarySearchResults(playlists: [], artists: [], albums: [], songs: [])

    var isEmpty: Bool {
        playlists.isEmpty && artists.isEmpty && albums.isEmpty && songs.isEmpty
    }
}

struct LibraryArtistGroup: Identifiable, Hashable {
    let id: String
    let name: String
    var artistId: String?
    var trackCount: Int
}

struct LibraryAlbumGroup: Identifiable, Hashable {
    let id: String
    let albumId: String?
    let title: String
    let artist: String?
    let artworkURL: URL?
    var trackCount: Int
}

struct RecentLibraryCell: View {
    let item: RecentLibraryItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ArtworkImage(url: item.artworkURL, size: 160, cornerRadius: 8)
                .frame(maxWidth: .infinity)
                .aspectRatio(1, contentMode: .fit)

            Text(item.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(2)

            Text(item.subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}


// MARK: - Alphabet index (Apple Music style)

enum LibraryAlphabet {
    static let letters: [String] = (65...90).map { String(UnicodeScalar($0)!) } + ["#"]

    static func sectionKey(for name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = trimmed.first else { return "#" }
        let folded = String(first)
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "pl_PL"))
            .uppercased()
        guard let scalar = folded.unicodeScalars.first,
              CharacterSet.uppercaseLetters.contains(scalar) else {
            return "#"
        }
        return String(scalar)
    }

    static func group<T>(_ items: [T], name: (T) -> String) -> [(key: String, items: [T])] {
        let mapped = Dictionary(grouping: items) { sectionKey(for: name($0)) }
        let keys = letters.filter { mapped[$0] != nil }
        return keys.map { ($0, mapped[$0] ?? []) }
    }
}

struct AlphabetIndexBar: View {
    let available: Set<String>
    let onSelect: (String) -> Void

    @State private var dragLetter: String?
    private let letters = LibraryAlphabet.letters

    var body: some View {
        ZStack(alignment: .trailing) {
            GeometryReader { geo in
                let rowH = max(10, geo.size.height / CGFloat(letters.count))
                VStack(spacing: 0) {
                    ForEach(letters, id: \.self) { letter in
                        Text(letter)
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(
                                dragLetter == letter
                                    ? LibraryAccent.icon
                                    : (available.contains(letter) ? Color.secondary : Color.secondary.opacity(0.28))
                            )
                            .frame(maxWidth: .infinity)
                            .frame(height: rowH)
                    }
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            let idx = min(letters.count - 1, max(0, Int(value.location.y / rowH)))
                            let letter = letters[idx]
                            guard available.contains(letter) else { return }
                            if dragLetter != letter {
                                dragLetter = letter
                                UISelectionFeedbackGenerator().selectionChanged()
                                onSelect(letter)
                            }
                        }
                        .onEnded { _ in dragLetter = nil }
                )
            }
            .frame(width: 18)

            if let dragLetter {
                Text(dragLetter)
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(LibraryAccent.icon.gradient, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .offset(x: -36)
                    .transition(.scale.combined(with: .opacity))
                    .allowsHitTesting(false)
            }
        }
        .animation(.easeOut(duration: 0.12), value: dragLetter)
        .padding(.vertical, 4)
        .accessibilityLabel("Indeks alfabetyczny")
    }
}

struct AlphabetJumpOverlay: ViewModifier {
    let sections: [String]
    let proxy: ScrollViewProxy

    func body(content: Content) -> some View {
        content.overlay(alignment: .trailing) {
            AlphabetIndexBar(available: Set(sections)) { letter in
                withAnimation(.easeOut(duration: 0.12)) {
                    proxy.scrollTo(letter, anchor: .top)
                }
            }
            .padding(.trailing, 2)
        }
    }
}

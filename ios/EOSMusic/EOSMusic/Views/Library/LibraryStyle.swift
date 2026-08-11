import SwiftUI
import UIKit

enum LibraryCategory: String, Identifiable, CaseIterable, Hashable {
    case favorites
    case playlists
    case artists
    case albums
    case songs
    case downloaded

    var id: String { rawValue }

    var title: String {
        switch self {
        case .favorites: return "Ulubione"
        case .playlists: return "Playlisty"
        case .artists: return "Wykonawcy"
        case .albums: return "Albumy"
        case .songs: return "Utwory"
        case .downloaded: return "Pobrane"
        }
    }

    var icon: String {
        switch self {
        case .favorites: return "heart.fill"
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
    var subtitle: String? = nil

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

            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

struct LibraryDownloadedCategoryRow: View {
    let count: Int
    var storage: StorageSnapshot?

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: "arrow.down.circle.fill")
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(LibraryAccent.icon)
                .frame(width: 30, alignment: .center)

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Pobrane")
                        .font(.body)
                        .foregroundStyle(.primary)
                    Spacer(minLength: 8)
                    Text(count == 1 ? "1 utwór" : "\(count) utworów")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let storage {
                    StorageCapacityBar(snapshot: storage)
                }
            }

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
    let id: String
    let track: MusicTrack
    let title: String
    let subtitle: String
    let artworkURL: URL?
}

enum LibraryData {
    static func recentTracks(from tracks: [MusicTrack], limit: Int = 12) -> [RecentLibraryItem] {
        var seen = Set<String>()
        let ordered = tracks.sorted { lhs, rhs in
            let la = lhs.addedAt ?? 0
            let ra = rhs.addedAt ?? 0
            if la != ra { return la > ra }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
        var items: [RecentLibraryItem] = []
        for track in ordered {
            guard seen.insert(track.url).inserted else { continue }
            items.append(RecentLibraryItem(
                id: track.url,
                track: track,
                title: track.title,
                subtitle: [track.artist, track.album].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
                artworkURL: track.artworkURL
            ))
            if items.count >= limit { break }
        }
        return items
    }

    /// Legacy name used by older call sites — recently added songs only.
    static func recentItems(folders _: [MusicFolder], tracks: [MusicTrack], limit: Int = 12) -> [RecentLibraryItem] {
        recentTracks(from: tracks, limit: limit)
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

    /// Merges library downloads with local OfflineMusicStore files (works without API).
    @MainActor
    static func allLocalDownloads(from tracks: [MusicTrack], isOffline: (String) -> Bool) -> [MusicTrack] {
        var seen = Set<String>()
        var result: [MusicTrack] = []

        for track in tracks where isOffline(track.url) {
            guard seen.insert(track.url).inserted else { continue }
            result.append(track)
        }

        for entry in OfflineMusicStore.shared.entries.values {
            guard OfflineMusicStore.shared.isAvailable(entry.url) else { continue }
            guard seen.insert(entry.url).inserted else { continue }
            if let match = tracks.first(where: { $0.url == entry.url }) {
                result.append(match)
            } else {
                result.append(.fromOfflineEntry(entry))
            }
        }

        for fileURL in OfflineMusicStore.shared.allLocalAudioFiles() {
            let key = OfflineMusicStore.shared.entries.first(where: { $0.value.fileName == fileURL.lastPathComponent })?.key
                ?? "file:\(fileURL.lastPathComponent)"
            guard seen.insert(key).inserted else { continue }
            if let entry = OfflineMusicStore.shared.entries[key] {
                result.append(.fromOfflineEntry(entry))
            } else {
                let parsed = parseOfflineFileName(fileURL.deletingPathExtension().lastPathComponent)
                let date = (try? fileURL.resourceValues(forKeys: [.contentModificationDateKey])
                    .contentModificationDate) ?? Date()
                result.append(MusicTrack(
                    folderId: MusicTrack.localOfflineFolderId,
                    url: key,
                    title: parsed.title,
                    artist: parsed.artist,
                    addedAt: date.timeIntervalSince1970 * 1000
                ))
            }
        }

        return result.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    private static func parseOfflineFileName(_ name: String) -> (title: String, artist: String?) {
        if let range = name.range(of: " - ") {
            let artist = String(name[..<range.lowerBound]).trimmingCharacters(in: .whitespaces)
            let title = String(name[range.upperBound...]).trimmingCharacters(in: .whitespaces)
            if !artist.isEmpty, !title.isEmpty { return (title, artist) }
        }
        return (name, nil)
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

enum RecentLibraryLayout: String, CaseIterable, Identifiable {
    case tiles
    case large
    case list

    var id: String { rawValue }

    var title: String {
        switch self {
        case .tiles: return "Kafelki"
        case .large: return "Duże"
        case .list: return "Lista"
        }
    }

    var systemImage: String {
        switch self {
        case .tiles: return "square.grid.2x2"
        case .large: return "rectangle.grid.1x2"
        case .list: return "list.bullet"
        }
    }
}

struct RecentLibraryCell: View {
    let item: RecentLibraryItem
    var style: RecentLibraryLayout = .tiles

    var body: some View {
        switch style {
        case .list:
            listBody
        case .large:
            largeBody
        case .tiles:
            tilesBody
        }
    }

    private var tilesBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            ArtworkImage(url: item.artworkURL, size: 160, cornerRadius: 10)
                .frame(maxWidth: .infinity)
                .aspectRatio(1, contentMode: .fit)
                .shadow(color: .black.opacity(0.08), radius: 8, y: 3)

            Text(item.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(item.subtitle.isEmpty ? "Utwór" : item.subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var largeBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            ArtworkImage(url: item.artworkURL, size: 280, cornerRadius: 14)
                .frame(maxWidth: .infinity)
                .aspectRatio(1, contentMode: .fit)
                .shadow(color: .black.opacity(0.12), radius: 14, y: 6)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                Text(item.subtitle.isEmpty ? "Utwór" : item.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
    }

    private var listBody: some View {
        HStack(spacing: 14) {
            ArtworkImage(url: item.artworkURL, size: 56, cornerRadius: 8)
                .shadow(color: .black.opacity(0.06), radius: 4, y: 2)

            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(item.subtitle.isEmpty ? "Utwór" : item.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Image(systemName: "play.circle.fill")
                .font(.title3)
                .foregroundStyle(LibraryAccent.icon.opacity(0.9))
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

/// Shared header: large cover beside title (playlist / album).
struct LibraryEntityHeader: View {
    let title: String
    let subtitle: String?
    let artworkURL: URL?
    var showsPhotoPicker = false
    var onPickPhoto: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            ZStack(alignment: .bottomTrailing) {
                ArtworkImage(url: artworkURL, size: 112, cornerRadius: 12, allowAnimated: true)
                    .shadow(color: .black.opacity(0.12), radius: 10, y: 4)

                if showsPhotoPicker {
                    Button {
                        onPickPhoto?()
                    } label: {
                        Image(systemName: artworkURL == nil ? "camera.fill" : "pencil.circle.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(7)
                            .background(LibraryAccent.icon.gradient, in: Circle())
                            .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
                    }
                    .buttonStyle(.plain)
                    .offset(x: 6, y: 6)
                    .accessibilityLabel(artworkURL == nil ? "Dodaj okładkę" : "Zmień okładkę")
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.primary)
                    .lineLimit(3)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                if showsPhotoPicker, artworkURL == nil {
                    Button {
                        onPickPhoto?()
                    } label: {
                        Label("Wybierz zdjęcie", systemImage: "photo.on.rectangle")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(LibraryAccent.icon)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
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

import SwiftUI

// MARK: - Playlists

private enum PlaylistLayoutMode: String {
    case list
    case grid
}

struct LibraryPlaylistsView: View {
    @EnvironmentObject private var app: AppModel
    @AppStorage("ui.playlistsLayout") private var playlistsLayout = PlaylistLayoutMode.list.rawValue
    @State private var editMode: EditMode = .inactive
    @State private var folderToDelete: MusicFolder?
    @State private var errorMessage: String?
    @State private var playlistQuery = ""
    private let gridColumns = [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
    ]

    private var isGrid: Bool { playlistsLayout == PlaylistLayoutMode.grid.rawValue && editMode != .active }

    private var filteredFolders: [MusicFolder] {
        let q = playlistQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let base = app.musicFolders
        guard q.count >= 1 else { return base }
        return base.filter { $0.name.localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        Group {
            if app.musicFolders.isEmpty {
                ContentUnavailableView(
                    "Brak playlist",
                    systemImage: "music.note.list",
                    description: Text("Utwórz playlistę przyciskiem + w Bibliotece.")
                )
            } else {
                if isGrid {
                    ScrollView {
                        LazyVGrid(columns: gridColumns, spacing: 16) {
                            ForEach(filteredFolders) { folder in
                                NavigationLink(value: folder) {
                                    playlistCard(folder)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    }
                } else {
                    List {
                        ForEach(filteredFolders) { folder in
                            if editMode == .active {
                                playlistRow(folder)
                            } else {
                                NavigationLink(value: folder) {
                                    playlistRow(folder)
                                }
                            }
                        }
                        .onDelete(perform: deleteFolders)
                    }
                    .listStyle(.plain)
                }
            }
        }
        .navigationTitle("Playlisty")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $playlistQuery, prompt: "Szukaj w playlistach")
        .navigationDestination(for: MusicFolder.self) { folder in
            FolderDetailView(folder: folder)
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                EditButton()
                    .disabled(app.musicFolders.isEmpty || isGrid)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Widok", selection: $playlistsLayout) {
                        Label("Lista", systemImage: "list.bullet").tag(PlaylistLayoutMode.list.rawValue)
                        Label("Duże kafelki", systemImage: "square.grid.2x2").tag(PlaylistLayoutMode.grid.rawValue)
                    }
                } label: {
                    Image(systemName: isGrid ? "square.grid.2x2.fill" : "list.bullet")
                }
            }
        }
        .environment(\.editMode, $editMode)
        .alert("Usunąć playlistę?", isPresented: Binding(
            get: { folderToDelete != nil },
            set: { if !$0 { folderToDelete = nil } }
        )) {
            Button("Usuń", role: .destructive) {
                if let folder = folderToDelete {
                    Task { await confirmDelete(folder) }
                }
            }
            Button("Anuluj", role: .cancel) { folderToDelete = nil }
        } message: {
            if let folder = folderToDelete {
                Text("„\(folder.name)” zostanie usunięta z biblioteki.")
            }
        }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func playlistRow(_ folder: MusicFolder) -> some View {
        HStack(spacing: 14) {
            ArtworkImage(url: playlistArtwork(for: folder), size: 56, cornerRadius: 6)
            VStack(alignment: .leading, spacing: 3) {
                Text(folder.name)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(folder.countLabel)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private func playlistCard(_ folder: MusicFolder) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ArtworkImage(url: playlistArtwork(for: folder), size: 160, cornerRadius: 10)
                .frame(maxWidth: .infinity)
                .aspectRatio(1, contentMode: .fit)

            Text(folder.name)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(2)

            Text(folder.countLabel)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }

    private func playlistArtwork(for folder: MusicFolder) -> URL? {
        if let art = folder.artworkURL { return art }
        return app.musicTracks.first(where: { $0.folderId == folder.id })?.artworkURL
    }

    private func deleteFolders(at offsets: IndexSet) {
        guard let index = offsets.first, filteredFolders.indices.contains(index) else { return }
        folderToDelete = filteredFolders[index]
    }

    private func confirmDelete(_ folder: MusicFolder) async {
        folderToDelete = nil
        do {
            try await app.deleteMusicFolder(folder)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Artists

struct LibraryArtistsView: View {
    @EnvironmentObject private var app: AppModel
    @State private var query = ""

    private var groups: [LibraryArtistGroup] {
        let all = LibraryData.artistGroups(from: app.musicTracks)
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 1 else { return all }
        return all.filter { $0.name.localizedCaseInsensitiveContains(q) }
    }

    private var sections: [(key: String, items: [LibraryArtistGroup])] {
        LibraryAlphabet.group(groups) { $0.name }
    }

    var body: some View {
        Group {
            if groups.isEmpty {
                ContentUnavailableView(
                    query.isEmpty ? "Brak wykonawców" : "Brak wyników",
                    systemImage: "mic",
                    description: Text(query.isEmpty ? "Dodaj utwory do playlist." : "Spróbuj innej frazy w bibliotece.")
                )
            } else {
                ScrollViewReader { proxy in
                    List {
                        ForEach(sections, id: \.key) { section in
                            Section {
                                ForEach(section.items) { group in
                                    if let artistId = group.artistId {
                                        NavigationLink {
                                            ArtistDetailView(artistId: artistId, artistName: group.name)
                                        } label: {
                                            artistRow(group)
                                        }
                                    } else {
                                        NavigationLink {
                                            LibraryArtistSongsView(artistName: group.name)
                                        } label: {
                                            artistRow(group)
                                        }
                                    }
                                }
                            } header: {
                                Text(section.key)
                                    .font(.footnote.weight(.bold))
                                    .foregroundStyle(.secondary)
                                    .id(section.key)
                            }
                        }
                    }
                    .listStyle(.plain)
                    .modifier(AlphabetJumpOverlay(sections: sections.map(\.key), proxy: proxy))
                }
            }
        }
        .navigationTitle("Wykonawcy")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Szukaj w wykonawcach")
    }

    private func artistRow(_ group: LibraryArtistGroup) -> some View {
        HStack {
            Text(group.name)
                .font(.body)
            Spacer()
            Text("\(group.trackCount)")
                .font(.body)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

struct LibraryArtistSongsView: View {
    @EnvironmentObject private var app: AppModel
    let artistName: String

    private var tracks: [MusicTrack] {
        app.musicTracks.filter {
            ($0.artist ?? "Nieznany wykonawca") == artistName
        }
    }

    var body: some View {
        LibrarySongsListView(tracks: tracks, title: artistName)
    }
}

// MARK: - Albums

struct LibraryAlbumsView: View {
    @EnvironmentObject private var app: AppModel
    @State private var query = ""

    private var groups: [LibraryAlbumGroup] {
        let all = LibraryData.albumGroups(from: app.musicTracks)
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 1 else { return all }
        return all.filter {
            $0.title.localizedCaseInsensitiveContains(q)
                || ($0.artist?.localizedCaseInsensitiveContains(q) == true)
        }
    }

    private var sections: [(key: String, items: [LibraryAlbumGroup])] {
        LibraryAlphabet.group(groups) { $0.title }
    }

    var body: some View {
        Group {
            if groups.isEmpty {
                ContentUnavailableView(
                    query.isEmpty ? "Brak albumów" : "Brak wyników",
                    systemImage: "square.stack",
                    description: Text(query.isEmpty ? "Dodaj utwory z metadanymi albumu." : "Spróbuj innej frazy w bibliotece.")
                )
            } else {
                ScrollViewReader { proxy in
                    List {
                        ForEach(sections, id: \.key) { section in
                            Section {
                                ForEach(section.items) { group in
                                    if let albumId = group.albumId, !albumId.isEmpty {
                                        NavigationLink {
                                            AlbumDetailView(albumId: albumId)
                                        } label: {
                                            albumRow(group)
                                        }
                                    } else {
                                        NavigationLink {
                                            LibraryAlbumSongsView(albumTitle: group.title, artist: group.artist)
                                        } label: {
                                            albumRow(group)
                                        }
                                    }
                                }
                            } header: {
                                Text(section.key)
                                    .font(.footnote.weight(.bold))
                                    .foregroundStyle(.secondary)
                                    .id(section.key)
                            }
                        }
                    }
                    .listStyle(.plain)
                    .modifier(AlphabetJumpOverlay(sections: sections.map(\.key), proxy: proxy))
                }
            }
        }
        .navigationTitle("Albumy")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Szukaj w albumach")
    }

    private func albumRow(_ group: LibraryAlbumGroup) -> some View {
        HStack(spacing: 14) {
            ArtworkImage(url: group.artworkURL, size: 56, cornerRadius: 6)
            VStack(alignment: .leading, spacing: 3) {
                Text(group.title)
                    .font(.body)
                    .lineLimit(1)
                Text(group.artist ?? "Nieznany wykonawca")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 2)
    }
}

struct LibraryAlbumSongsView: View {
    @EnvironmentObject private var app: AppModel
    let albumTitle: String
    let artist: String?

    private var tracks: [MusicTrack] {
        app.musicTracks.filter { track in
            track.album == albumTitle && (artist == nil || track.artist == artist)
        }
    }

    private var artworkURL: URL? {
        tracks.first(where: { $0.artworkURL != nil })?.artworkURL
    }

    var body: some View {
        Group {
            if tracks.isEmpty {
                ContentUnavailableView("Brak utworów", systemImage: "square.stack", description: Text("Ten album nie ma utworów w bibliotece."))
            } else {
                List {
                    Section {
                        LibraryEntityHeader(
                            title: albumTitle,
                            subtitle: [artist, "\(tracks.count) utworów"].compactMap { $0 }.joined(separator: " · "),
                            artworkURL: artworkURL
                        )
                    }
                    .listRowBackground(Color.clear)

                    Section {
                        Button {
                            Task {
                                let folder = app.musicFolders.first(where: { $0.id == tracks[0].folderId })
                                await app.playTracks(tracks, startIndex: 0, folder: folder)
                            }
                        } label: {
                            Label("Odtwórz wszystko", systemImage: "play.fill")
                                .font(.headline)
                                .foregroundStyle(EOSTheme.accent)
                        }
                    }

                    Section {
                        ForEach(Array(tracks.enumerated()), id: \.element.url) { index, track in
                            Button {
                                Task {
                                    let folder = app.musicFolders.first(where: { $0.id == track.folderId })
                                    await app.playTracks(tracks, startIndex: index, folder: folder)
                                }
                            } label: {
                                TrackRowView(
                                    index: index + 1,
                                    title: track.title,
                                    subtitle: track.artist,
                                    duration: track.duration,
                                    artworkURL: track.artworkURL,
                                    isPlaying: app.playback.engine?.currentTrack?.url == track.url,
                                    downloadState: app.downloads.uiState(
                                        for: track.url,
                                        isDownloaded: app.isOfflineAvailable(track.url)
                                    )
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .background(EOSAmbientBackground())
        .navigationTitle(albumTitle)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Songs

struct LibrarySongsView: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        LibrarySongsListView(
            tracks: app.musicTracks.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending },
            title: "Utwory",
            enablesLibrarySearch: true
        )
    }
}

struct LibrarySongsListView: View {
    @EnvironmentObject private var app: AppModel
    let tracks: [MusicTrack]
    let title: String
    var enablesLibrarySearch: Bool = false

    @State private var query = ""
    @State private var sharePayload: SharePayload?

    private var filtered: [MusicTrack] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard enablesLibrarySearch, q.count >= 1 else { return tracks }
        return tracks.filter {
            $0.title.localizedCaseInsensitiveContains(q)
                || ($0.artist?.localizedCaseInsensitiveContains(q) == true)
                || ($0.album?.localizedCaseInsensitiveContains(q) == true)
        }
    }

    private var sections: [(key: String, items: [MusicTrack])] {
        LibraryAlphabet.group(filtered) { $0.title }
    }

    var body: some View {
        Group {
            if filtered.isEmpty {
                ContentUnavailableView(
                    query.isEmpty ? "Brak utworów" : "Brak wyników",
                    systemImage: "music.note",
                    description: query.isEmpty ? nil : Text("Tylko utwory z Twojej biblioteki.")
                )
            } else {
                ScrollViewReader { proxy in
                    List {
                        ForEach(sections, id: \.key) { section in
                            Section {
                                ForEach(Array(section.items.enumerated()), id: \.element.url) { _, track in
                                    songRow(track)
                                }
                            } header: {
                                Text(section.key)
                                    .font(.footnote.weight(.bold))
                                    .foregroundStyle(.secondary)
                                    .id(section.key)
                            }
                        }
                    }
                    .listStyle(.plain)
                    .modifier(AlphabetJumpOverlay(sections: sections.map(\.key), proxy: proxy))
                }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: enablesLibrarySearch ? "Szukaj w utworach" : "Szukaj")
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: payload.items)
        }
    }

    private func songRow(_ track: MusicTrack) -> some View {
        let index = filtered.firstIndex(where: { $0.url == track.url }).map { $0 + 1 } ?? 1
        return Button {
            Task { await play(track: track) }
        } label: {
            TrackRowView(
                index: index,
                title: track.title,
                subtitle: track.artist,
                duration: track.duration,
                artworkURL: track.artworkURL,
                isPlaying: app.playback.engine?.currentTrack?.url == track.url,
                downloadState: app.downloads.uiState(
                    for: track.url,
                    isDownloaded: app.isOfflineAvailable(track.url)
                )
            )
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                Task { await play(track: track) }
            } label: {
                Label("Odtwórz", systemImage: "play.fill")
            }
            Button {
                Task { await app.toggleFavorite(track.favoriteItem) }
            } label: {
                Label(
                    app.isFavorite(track.url) ? "Usuń z ulubionych" : "Dodaj do ulubionych",
                    systemImage: app.isFavorite(track.url) ? "heart.slash" : "heart"
                )
            }
            Button {
                sharePayload = .text(trackShareText(track))
            } label: {
                Label("Udostępnij", systemImage: "square.and.arrow.up")
            }
            if let local = OfflineMusicStore.shared.localURL(for: track.url) {
                Button {
                    sharePayload = .file(local)
                } label: {
                    Label("Wyślij plik", systemImage: "paperplane")
                }
            }
            if app.downloads.uiState(for: track.url, isDownloaded: app.isOfflineAvailable(track.url)) != .done {
                Button {
                    app.downloadTrack(track, folderId: track.folderId)
                } label: {
                    Label("Pobierz na iPhone", systemImage: "arrow.down.circle")
                }
            }
        }
    }

    private func trackShareText(_ track: MusicTrack) -> String {
        if let artist = track.artist, !artist.isEmpty {
            return "\(track.title) — \(artist)"
        }
        return track.title
    }

    private func play(track: MusicTrack) async {
        guard let index = filtered.firstIndex(where: { $0.url == track.url }) else { return }
        let folder = app.musicFolders.first(where: { $0.id == track.folderId })
        await app.playTracks(filtered, startIndex: index, folder: folder)
    }
}

private struct SharePayload: Identifiable {
    let id = UUID()
    let items: [Any]

    static func file(_ url: URL) -> SharePayload { SharePayload(items: [url]) }
    static func text(_ string: String) -> SharePayload { SharePayload(items: [string]) }
}

// MARK: - Downloaded

struct LibraryDownloadedView: View {
    @EnvironmentObject private var app: AppModel
    @State private var errorMessage: String?
    @State private var query = ""
    @State private var sharePayload: SharePayload?

    private var tracks: [MusicTrack] {
        let all = LibraryData.downloadedTracks(from: app.musicTracks) { app.isOfflineAvailable($0) }
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 1 else { return all }
        return all.filter {
            $0.title.localizedCaseInsensitiveContains(q)
                || ($0.artist?.localizedCaseInsensitiveContains(q) == true)
        }
    }

    private var sections: [(key: String, items: [MusicTrack])] {
        LibraryAlphabet.group(tracks) { $0.title }
    }

    var body: some View {
        Group {
            if tracks.isEmpty {
                ContentUnavailableView(
                    query.isEmpty ? "Brak pobranych utworów" : "Brak wyników",
                    systemImage: "arrow.down.circle",
                    description: Text(query.isEmpty
                        ? "Pobierz utwory z playlisty, aby odtwarzać offline i udostępniać pliki."
                        : "Szukaj tylko wśród pobranych z biblioteki.")
                )
            } else {
                ScrollViewReader { proxy in
                    List {
                        ForEach(sections, id: \.key) { section in
                            Section {
                                ForEach(Array(section.items.enumerated()), id: \.element.url) { index, track in
                                    Button {
                                        Task { await play(track: track) }
                                    } label: {
                                        TrackRowView(
                                            index: (tracks.firstIndex(where: { $0.url == track.url }) ?? index) + 1,
                                            title: track.title,
                                            subtitle: track.artist,
                                            duration: track.duration,
                                            artworkURL: track.artworkURL,
                                            isPlaying: app.playback.engine?.currentTrack?.url == track.url,
                                            downloadState: .done
                                        )
                                    }
                                    .buttonStyle(.plain)
                                    .contextMenu {
                                        Button {
                                            Task { await play(track: track) }
                                        } label: {
                                            Label("Odtwórz", systemImage: "play.fill")
                                        }
                                        Button {
                                            let text: String = {
                                                if let artist = track.artist, !artist.isEmpty {
                                                    return "\(track.title) — \(artist)"
                                                }
                                                return track.title
                                            }()
                                            sharePayload = .text(text)
                                        } label: {
                                            Label("Udostępnij", systemImage: "square.and.arrow.up")
                                        }
                                        if let local = OfflineMusicStore.shared.localURL(for: track.url) {
                                            Button {
                                                sharePayload = .file(local)
                                            } label: {
                                                Label("Wyślij plik", systemImage: "paperplane")
                                            }
                                        }
                                        Button(role: .destructive) {
                                            Task { await deleteDownloaded(track) }
                                        } label: {
                                            Label("Usuń z iPhone’a", systemImage: "trash")
                                        }
                                    }
                                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                        Button(role: .destructive) {
                                            Task { await deleteDownloaded(track) }
                                        } label: {
                                            Label("Usuń", systemImage: "trash")
                                        }
                                    }
                                }
                            } header: {
                                Text(section.key)
                                    .font(.footnote.weight(.bold))
                                    .foregroundStyle(.secondary)
                                    .id(section.key)
                            }
                        }
                    }
                    .listStyle(.plain)
                    .modifier(AlphabetJumpOverlay(sections: sections.map(\.key), proxy: proxy))
                }
            }
        }
        .navigationTitle("Pobrane")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Szukaj w pobranych")
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: payload.items)
        }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func play(track: MusicTrack) async {
        guard let index = tracks.firstIndex(where: { $0.url == track.url }) else { return }
        let folder = app.musicFolders.first(where: { $0.id == track.folderId })
        await app.playTracks(tracks, startIndex: index, folder: folder)
    }

    private func deleteDownloaded(_ track: MusicTrack) async {
        app.cancelDownload(for: track.url)
        app.removeOfflineDownload(for: track.url)
        do {
            try await app.removeTrackFromFolder(folderId: track.folderId, url: track.url)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

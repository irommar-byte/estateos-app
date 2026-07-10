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
    private let gridColumns = [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
    ]

    private var isGrid: Bool { playlistsLayout == PlaylistLayoutMode.grid.rawValue && editMode != .active }

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
                            ForEach(app.musicFolders) { folder in
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
                        ForEach(app.musicFolders) { folder in
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
        guard let index = offsets.first else { return }
        folderToDelete = app.musicFolders[index]
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

    private var groups: [LibraryArtistGroup] {
        LibraryData.artistGroups(from: app.musicTracks)
    }

    var body: some View {
        List {
            if groups.isEmpty {
                ContentUnavailableView("Brak wykonawców", systemImage: "mic", description: Text("Dodaj utwory do playlist."))
                    .listRowBackground(Color.clear)
            } else {
                ForEach(groups) { group in
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
            }
        }
        .listStyle(.plain)
        .navigationTitle("Wykonawcy")
        .navigationBarTitleDisplayMode(.large)
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

    private var groups: [LibraryAlbumGroup] {
        LibraryData.albumGroups(from: app.musicTracks)
    }

    var body: some View {
        List {
            if groups.isEmpty {
                ContentUnavailableView("Brak albumów", systemImage: "square.stack", description: Text("Dodaj utwory z metadanymi albumu."))
                    .listRowBackground(Color.clear)
            } else {
                ForEach(groups) { group in
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
            }
        }
        .listStyle(.plain)
        .navigationTitle("Albumy")
        .navigationBarTitleDisplayMode(.large)
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

    var body: some View {
        LibrarySongsListView(tracks: tracks, title: albumTitle)
    }
}

// MARK: - Songs

struct LibrarySongsView: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        LibrarySongsListView(
            tracks: app.musicTracks.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending },
            title: "Utwory"
        )
    }
}

struct LibrarySongsListView: View {
    @EnvironmentObject private var app: AppModel
    let tracks: [MusicTrack]
    let title: String

    var body: some View {
        Group {
            if tracks.isEmpty {
                ContentUnavailableView("Brak utworów", systemImage: "music.note")
            } else {
                List {
                    ForEach(Array(tracks.enumerated()), id: \.element.url) { index, track in
                        Button {
                            Task { await play(from: index) }
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
                .listStyle(.plain)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
    }

    private func play(from index: Int) async {
        let folder = app.musicFolders.first(where: { $0.id == tracks[index].folderId })
        await app.playTracks(tracks, startIndex: index, folder: folder)
    }
}

// MARK: - Downloaded

struct LibraryDownloadedView: View {
    @EnvironmentObject private var app: AppModel
    @State private var errorMessage: String?

    private var tracks: [MusicTrack] {
        LibraryData.downloadedTracks(from: app.musicTracks) { app.isOfflineAvailable($0) }
    }

    var body: some View {
        Group {
            if tracks.isEmpty {
                ContentUnavailableView(
                    "Brak pobranych utworów",
                    systemImage: "arrow.down.circle",
                    description: Text("Pobierz utwory z playlisty, aby odtwarzać offline.")
                )
            } else {
                List {
                    ForEach(Array(tracks.enumerated()), id: \.element.url) { index, track in
                        Button {
                            Task { await play(from: index) }
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
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                Task { await deleteDownloaded(track) }
                            } label: {
                                Label("Usuń utwór", systemImage: "trash")
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Pobrane")
        .navigationBarTitleDisplayMode(.large)
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func play(from index: Int) async {
        let folder = app.musicFolders.first(where: { $0.id == tracks[index].folderId })
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
import SwiftUI

private enum SearchScope: String, CaseIterable, Identifiable {
    case catalog
    case library

    var id: String { rawValue }

    var title: String {
        switch self {
        case .catalog: return "Cała Muzyka"
        case .library: return "Moja Biblioteka"
        }
    }
}

struct SearchCatalogView: View {
    @EnvironmentObject private var app: AppModel
    @State private var scope: SearchScope = .catalog
    @State private var query = ""
    @State private var catalogResults: MusicCatalogSearchResponse?
    @State private var libraryResults = LibrarySearchResults.empty
    @State private var isSearching = false
    @State private var errorMessage: String?
    @State private var searchTask: Task<Void, Never>?

    private func sortedAlbums(_ albums: [MusicAlbum]) -> [MusicAlbum] {
        albums.sorted { lhs, rhs in
            if lhs.isSingleRelease != rhs.isSingleRelease {
                return !lhs.isSingleRelease && rhs.isSingleRelease
            }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Picker("Zakres", selection: $scope) {
                        ForEach(SearchScope.allCases) { item in
                            Text(item.title).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.top, 4)

                    if isSearching {
                        ProgressView("Szukam…")
                            .frame(maxWidth: .infinity)
                            .padding(.top, 40)
                    } else if hasResults {
                        if scope == .catalog, let catalogResults {
                            catalogContent(catalogResults)
                        } else if scope == .library {
                            libraryContent(libraryResults)
                        }
                    } else if submittedQuery != nil {
                        ContentUnavailableView(
                            "Brak wyników",
                            systemImage: "magnifyingglass",
                            description: Text("Spróbuj innej frazy w „\(scope.title)”")
                        )
                        .padding(.top, 32)
                    } else {
                        ContentUnavailableView(
                            scope == .catalog ? "Cała Muzyka" : "Moja Biblioteka",
                            systemImage: scope == .catalog ? "music.note.list" : "books.vertical",
                            description: Text(scope == .catalog
                                ? "Wpisz wykonawcę, album lub utwór z katalogu Apple Music."
                                : "Szukaj w playlistach, wykonawcach, albumach i utworach.")
                        )
                        .padding(.top, 32)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
            .background(EOSAmbientBackground())
            .navigationTitle("Szukaj")
            .searchable(text: $query, prompt: "Wykonawca, album, utwór…")
            .onSubmit(of: .search) { scheduleSearch(immediate: true) }
            .onChange(of: query) { _, _ in scheduleSearch(immediate: false) }
            .onChange(of: scope) { _, _ in
                catalogResults = nil
                libraryResults = .empty
                scheduleSearch(immediate: true)
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var submittedQuery: String? {
        let q = query.trimmingCharacters(in: .whitespaces)
        return q.count >= 2 ? q : nil
    }

    private var hasResults: Bool {
        switch scope {
        case .catalog:
            return catalogResults != nil
        case .library:
            return submittedQuery != nil && !libraryResults.isEmpty
        }
    }

    @ViewBuilder
    private func catalogContent(_ data: MusicCatalogSearchResponse) -> some View {
        if data.artists.isEmpty && data.albums.isEmpty && data.songs.isEmpty {
            ContentUnavailableView(
                "Brak wyników",
                systemImage: "magnifyingglass",
                description: Text("Spróbuj innej frazy w Apple Music.")
            )
            .frame(maxWidth: .infinity)
            .padding(.top, 24)
        } else {
            if !data.artists.isEmpty {
                sectionHeader("Wykonawcy")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(data.artists) { artist in
                            NavigationLink {
                                ArtistDetailView(artistId: artist.id, artistName: artist.name)
                            } label: {
                                ArtistChip(artist: artist)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            if !data.albums.isEmpty {
                sectionHeader("Albumy")
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 12)], spacing: 12) {
                    ForEach(sortedAlbums(data.albums).prefix(12)) { album in
                        NavigationLink {
                            AlbumDetailView(albumId: album.id)
                        } label: {
                            AlbumGridCell(album: album)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if !data.songs.isEmpty {
                sectionHeader("Utwory")
                VStack(spacing: 0) {
                    ForEach(Array(data.songs.prefix(20).enumerated()), id: \.element.id) { index, song in
                        CatalogTrackRow(item: song, index: index, queue: Array(data.songs.prefix(20)))
                        if index < min(19, data.songs.count - 1) {
                            Divider().opacity(0.2)
                        }
                    }
                }
                .padding(12)
                .eosCard()
            }
        }
    }

    @ViewBuilder
    private func libraryContent(_ data: LibrarySearchResults) -> some View {
        if !data.playlists.isEmpty {
            sectionHeader("Playlisty")
            VStack(spacing: 0) {
                ForEach(Array(data.playlists.prefix(12).enumerated()), id: \.element.id) { index, folder in
                    NavigationLink {
                        FolderDetailView(folder: folder)
                    } label: {
                        HStack(spacing: 12) {
                            ArtworkImage(
                                url: folder.artworkURL ?? app.musicTracks.first(where: { $0.folderId == folder.id })?.artworkURL,
                                size: 48,
                                cornerRadius: 8
                            )
                            VStack(alignment: .leading, spacing: 2) {
                                Text(folder.name)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(EOSTheme.textPrimary)
                                    .lineLimit(1)
                                Text(folder.countLabel)
                                    .font(.caption)
                                    .foregroundStyle(EOSTheme.textSecondary)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(EOSTheme.textMuted)
                        }
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    if index < min(11, data.playlists.count - 1) {
                        Divider().opacity(0.2)
                    }
                }
            }
            .padding(12)
            .eosCard()
        }

        if !data.artists.isEmpty {
            sectionHeader("Wykonawcy")
            VStack(spacing: 0) {
                ForEach(Array(data.artists.prefix(12).enumerated()), id: \.element.id) { index, artist in
                    Group {
                        if let artistId = artist.artistId {
                            NavigationLink {
                                ArtistDetailView(artistId: artistId, artistName: artist.name)
                            } label: {
                                libraryArtistRow(artist)
                            }
                        } else {
                            NavigationLink {
                                LibraryArtistSongsView(artistName: artist.name)
                            } label: {
                                libraryArtistRow(artist)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    if index < min(11, data.artists.count - 1) {
                        Divider().opacity(0.2)
                    }
                }
            }
            .padding(12)
            .eosCard()
        }

        if !data.albums.isEmpty {
            sectionHeader("Albumy")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 12)], spacing: 12) {
                ForEach(data.albums.prefix(12)) { album in
                    Group {
                        if let albumId = album.albumId, !albumId.isEmpty {
                            NavigationLink {
                                AlbumDetailView(albumId: albumId)
                            } label: {
                                LibraryAlbumGridCell(group: album)
                            }
                        } else {
                            NavigationLink {
                                LibraryAlbumSongsView(albumTitle: album.title, artist: album.artist)
                            } label: {
                                LibraryAlbumGridCell(group: album)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }

        if !data.songs.isEmpty {
            sectionHeader("Utwory")
            VStack(spacing: 0) {
                ForEach(Array(data.songs.prefix(20).enumerated()), id: \.element.url) { index, track in
                    Button {
                        Task { await playLibraryTrack(track, in: data.songs) }
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
                    if index < min(19, data.songs.count - 1) {
                        Divider().opacity(0.2)
                    }
                }
            }
            .padding(12)
            .eosCard()
        }
    }

    private func libraryArtistRow(_ artist: LibraryArtistGroup) -> some View {
        HStack {
            Text(artist.name)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(EOSTheme.textPrimary)
            Spacer()
            Text("\(artist.trackCount)")
                .font(.caption)
                .foregroundStyle(EOSTheme.textSecondary)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(EOSTheme.textMuted)
        }
        .padding(.vertical, 8)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.caption.weight(.bold))
            .foregroundStyle(EOSTheme.textMuted)
            .tracking(1.2)
    }

    private func scheduleSearch(immediate: Bool) {
        searchTask?.cancel()
        let q = query.trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else {
            catalogResults = nil
            libraryResults = .empty
            isSearching = false
            return
        }

        searchTask = Task {
            if !immediate {
                try? await Task.sleep(nanoseconds: 350_000_000)
            }
            guard !Task.isCancelled else { return }
            await search(query: q)
        }
    }

    private func search(query: String) async {
        isSearching = true
        defer { isSearching = false }

        switch scope {
        case .catalog:
            do {
                catalogResults = try await app.api.searchMusicCatalog(query: query)
                libraryResults = .empty
            } catch {
                if !Task.isCancelled {
                    errorMessage = error.localizedDescription
                }
            }
        case .library:
            catalogResults = nil
            libraryResults = LibraryData.search(
                query: query,
                folders: app.musicFolders,
                tracks: app.musicTracks
            )
        }
    }

    private func playLibraryTrack(_ track: MusicTrack, in queue: [MusicTrack]) async {
        guard let index = queue.firstIndex(where: { $0.url == track.url }) else { return }
        let folder = app.musicFolders.first(where: { $0.id == track.folderId })
        await app.playTracks(queue, startIndex: index, folder: folder)
    }
}

private struct ArtistChip: View {
    let artist: MusicArtist

    var body: some View {
        VStack(spacing: 8) {
            ArtworkImage(url: artist.thumbnail.flatMap(URL.init(string:)), size: 72, cornerRadius: 36)
            Text(artist.name)
                .font(.caption.weight(.semibold))
                .foregroundStyle(EOSTheme.textPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .frame(width: 88)
        }
    }
}

private struct AlbumGridCell: View {
    let album: MusicAlbum

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ArtworkImage(url: album.thumbnail.flatMap(URL.init(string:)), size: 140, cornerRadius: 10)
            Text(album.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(EOSTheme.textPrimary)
                .lineLimit(2)
            Text([album.artist, album.releaseYear].compactMap { $0 }.joined(separator: " · "))
                .font(.caption2)
                .foregroundStyle(EOSTheme.textSecondary)
                .lineLimit(1)
        }
    }
}

private struct LibraryAlbumGridCell: View {
    let group: LibraryAlbumGroup

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ArtworkImage(url: group.artworkURL, size: 140, cornerRadius: 10)
            Text(group.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(EOSTheme.textPrimary)
                .lineLimit(2)
            Text([group.artist, "\(group.trackCount) utw."].compactMap { $0 }.joined(separator: " · "))
                .font(.caption2)
                .foregroundStyle(EOSTheme.textSecondary)
                .lineLimit(1)
        }
    }
}

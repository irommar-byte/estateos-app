import SwiftUI

// MARK: - Playlists

private enum PlaylistLayoutMode: String {
    case list
    case grid
}

struct LibraryPlaylistsView: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject private var stats = ListeningStatsStore.shared
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

    private var smartKinds: [SmartPlaylistKind] { SmartPlaylistKind.allCases }

    private var filteredFolders: [MusicFolder] {
        let q = playlistQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let base = app.libraryFoldersForBrowsing
        guard q.count >= 1 else { return base }
        return base.filter { $0.name.localizedCaseInsensitiveContains(q) }
    }

    private var matchingSmartKinds: [SmartPlaylistKind] {
        let q = playlistQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 1 else { return smartKinds }
        return smartKinds.filter {
            $0.title.localizedCaseInsensitiveContains(q) || $0.subtitle.localizedCaseInsensitiveContains(q)
        }
    }

    private func smartCount(_ kind: SmartPlaylistKind) -> Int {
        stats.entries(for: kind, library: app.libraryTracksForBrowsing).count
    }

    var body: some View {
        Group {
            if isGrid {
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        if !matchingSmartKinds.isEmpty {
                            smartSectionHeader
                            LazyVGrid(columns: gridColumns, spacing: 16) {
                                ForEach(matchingSmartKinds) { kind in
                                    NavigationLink(value: kind) {
                                        SmartPlaylistCard(kind: kind, trackCount: smartCount(kind))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        if !filteredFolders.isEmpty {
                            userPlaylistsHeader
                            LazyVGrid(columns: gridColumns, spacing: 16) {
                                ForEach(filteredFolders) { folder in
                                    NavigationLink(value: folder) {
                                        playlistCard(folder)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        } else if matchingSmartKinds.isEmpty {
                            emptyUserPlaylists
                        } else {
                            emptyUserPlaylists
                                .padding(.top, 8)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
            } else {
                List {
                    if !matchingSmartKinds.isEmpty {
                        Section {
                            ForEach(matchingSmartKinds) { kind in
                                NavigationLink(value: kind) {
                                    smartRow(kind)
                                }
                            }
                        } header: {
                            smartSectionHeader
                                .textCase(nil)
                                .padding(.bottom, 4)
                        } footer: {
                            Text("Te playlisty układają się same z Twoich odtworzeń. Przy utworze widać, ile razy go puściłeś.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if filteredFolders.isEmpty {
                        Section {
                            emptyUserPlaylists
                                .listRowBackground(Color.clear)
                        }
                    } else {
                        Section {
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
                        } header: {
                            userPlaylistsHeader
                                .textCase(nil)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Playlisty")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $playlistQuery, prompt: "Szukaj w playlistach")
        .eosScrollClearance()
        .navigationDestination(for: MusicFolder.self) { folder in
            FolderDetailView(folder: folder)
        }
        .navigationDestination(for: SmartPlaylistKind.self) { kind in
            SmartPlaylistDetailView(kind: kind)
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

    private var smartSectionHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Dla Ciebie")
                .font(.title3.weight(.bold))
                .foregroundStyle(.primary)
            Text("Automatyczne playlisty ze statystyk słuchania")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var userPlaylistsHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Moje playlisty")
                .font(.title3.weight(.bold))
                .foregroundStyle(.primary)
            Text("Twoje listy, które tworzysz ręcznie")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var emptyUserPlaylists: some View {
        ContentUnavailableView(
            app.isOfflinePlaybackActive ? "Brak playlist offline" : "Brak własnych playlist",
            systemImage: "music.note.list",
            description: Text(app.isOfflinePlaybackActive
                ? "Pobierz utwory z playlisty, aby zobaczyć ją w trybie Offline."
                : "Utwórz playlistę przyciskiem + w Bibliotece.")
        )
        .padding(.vertical, 12)
    }

    private func smartRow(_ kind: SmartPlaylistKind) -> some View {
        let accent = Color(red: kind.accent.r, green: kind.accent.g, blue: kind.accent.b)
        let count = smartCount(kind)
        return HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [accent, accent.opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 56, height: 56)
                .overlay {
                    Image(systemName: kind.systemImage)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(kind.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text("AUTO")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(accent.opacity(0.14), in: Capsule())
                }
                Text(kind.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                Text(count > 0 ? "\(count) utworów" : "Zbiera statystyki")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
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
            ArtworkImage(url: playlistArtwork(for: folder), size: 160, cornerRadius: 10, allowAnimated: true)
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
        return app.libraryTracksForBrowsing.first(where: { $0.folderId == folder.id })?.artworkURL
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
        let all = LibraryData.artistGroups(from: app.libraryTracksForBrowsing)
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
                    query.isEmpty
                        ? (app.isOfflinePlaybackActive ? "Brak wykonawców offline" : "Brak wykonawców")
                        : "Brak wyników",
                    systemImage: "mic",
                    description: Text(
                        query.isEmpty
                            ? (app.isOfflinePlaybackActive
                                ? "Pobierz utwory, aby zobaczyć wykonawców offline."
                                : "Dodaj utwory do playlist.")
                            : "Spróbuj innej frazy w bibliotece."
                    )
                )
            } else {
                ScrollViewReader { proxy in
                    List {
                        ForEach(sections, id: \.key) { section in
                            Section {
                                ForEach(section.items) { group in
                                    NavigationLink {
                                        artistDestination(for: group)
                                    } label: {
                                        artistRow(group)
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
        .eosScrollClearance()
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

    @ViewBuilder
    private func artistDestination(for group: LibraryArtistGroup) -> some View {
        ArtistBrowseDestination(artistId: group.artistId, artistName: group.name)
    }
}

struct LibraryArtistSongsView: View {
    @EnvironmentObject private var app: AppModel
    let artistName: String
    var artistId: String? = nil
    @State private var query = ""

    private var allTracks: [MusicTrack] {
        app.libraryTracksForBrowsing.filter { track in
            if let artistId, !artistId.isEmpty, track.artistId == artistId { return true }
            return (track.artist ?? "Nieznany wykonawca")
                .localizedCaseInsensitiveCompare(artistName) == .orderedSame
        }
    }

    private var artworkURL: URL? {
        allTracks.first(where: { $0.artworkURL != nil })?.artworkURL
    }

    /// Apple Music artist songs: album → title (dense flat list, no A–Z sections).
    private var sortedTracks: [MusicTrack] {
        allTracks.sorted { (lhs: MusicTrack, rhs: MusicTrack) -> Bool in
            let la = lhs.album ?? ""
            let ra = rhs.album ?? ""
            let albumCmp = la.localizedCaseInsensitiveCompare(ra)
            if albumCmp != .orderedSame { return albumCmp == .orderedAscending }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
    }

    private var filteredTracks: [MusicTrack] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 1 else { return sortedTracks }
        return sortedTracks.filter {
            $0.title.localizedCaseInsensitiveContains(q)
                || ($0.album?.localizedCaseInsensitiveContains(q) == true)
        }
    }

    var body: some View {
        Group {
            if allTracks.isEmpty {
                ContentUnavailableView(
                    "Brak utworów",
                    systemImage: "music.note",
                    description: Text(
                        app.isOfflinePlaybackActive
                            ? "Brak pobranych utworów tego artysty."
                            : "Brak utworów w bibliotece."
                    )
                )
            } else if filteredTracks.isEmpty {
                ContentUnavailableView.search(text: query)
            } else {
                List {
                    Section {
                        LibraryEntityHeader(
                            title: artistName,
                            subtitle: "\(allTracks.count) utworów",
                            artworkURL: artworkURL
                        )
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 8, trailing: 20))

                    Section {
                        Button {
                            Task { await play(at: 0) }
                        } label: {
                            Label("Odtwórz wszystko", systemImage: "play.fill")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(EOSTheme.accent)
                        }
                        .listRowInsets(EdgeInsets(top: 6, leading: 20, bottom: 6, trailing: 20))

                        Button {
                            Task { await playShuffled() }
                        } label: {
                            Label("Losowo", systemImage: "shuffle")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(EOSTheme.accent)
                        }
                        .listRowInsets(EdgeInsets(top: 6, leading: 20, bottom: 6, trailing: 20))
                    }

                    Section {
                        ForEach(Array(filteredTracks.enumerated()), id: \.element.url) { index, track in
                            HStack(spacing: 6) {
                                Button {
                                    Task { await play(at: index) }
                                } label: {
                                    TrackRowView(
                                        index: index + 1,
                                        title: track.title,
                                        subtitle: track.album,
                                        duration: track.duration,
                                        artworkURL: track.artworkURL,
                                        isPlaying: app.playback.engine?.currentTrack?.url == track.url,
                                        downloadState: app.downloads.uiState(
                                            for: track.url,
                                            isOnServer: app.isOnServer(track.url)
                                        )
                                    )
                                }
                                .buttonStyle(.plain)

                                TrackStorageActionButton(
                                    track: track.payload,
                                    folderId: track.folderId
                                )
                            }
                            .listRowInsets(EdgeInsets(top: 3, leading: 16, bottom: 3, trailing: 16))
                        }
                    } header: {
                        Text("\(filteredTracks.count) utworów")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .textCase(nil)
                    }
                }
                .listStyle(.plain)
                .environment(\.defaultMinListRowHeight, 52)
            }
        }
        .navigationTitle(artistName)
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Szukaj")
        .eosScrollClearance()
    }

    private func play(at index: Int) async {
        let queue = filteredTracks
        guard queue.indices.contains(index) else { return }
        let folder = app.musicFolders.first(where: { $0.id == queue[index].folderId })
        await app.playTracks(queue, startIndex: index, folder: folder)
    }

    private func playShuffled() async {
        var queue = filteredTracks
        guard !queue.isEmpty else { return }
        queue.shuffle()
        let folder = app.musicFolders.first(where: { $0.id == queue[0].folderId })
        await app.playTracks(queue, startIndex: 0, folder: folder)
    }
}

// MARK: - Albums

struct LibraryAlbumsView: View {
    @EnvironmentObject private var app: AppModel
    @State private var query = ""

    private var groups: [LibraryAlbumGroup] {
        let all = LibraryData.albumGroups(from: app.libraryTracksForBrowsing)
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
                    query.isEmpty
                        ? (app.isOfflinePlaybackActive ? "Brak albumów offline" : "Brak albumów")
                        : "Brak wyników",
                    systemImage: "square.stack",
                    description: Text(
                        query.isEmpty
                            ? (app.isOfflinePlaybackActive
                                ? "Pobierz utwory, aby zobaczyć albumy offline."
                                : "Dodaj utwory z metadanymi albumu.")
                            : "Spróbuj innej frazy w bibliotece."
                    )
                )
            } else {
                ScrollViewReader { proxy in
                    List {
                        ForEach(sections, id: \.key) { section in
                            Section {
                                ForEach(section.items) { group in
                                    NavigationLink {
                                        albumDestination(for: group)
                                    } label: {
                                        albumRow(group)
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
        .eosScrollClearance()
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
            Spacer(minLength: 8)
            Text("\(group.trackCount)")
                .font(.body)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private func albumDestination(for group: LibraryAlbumGroup) -> some View {
        AlbumBrowseDestination(
            albumId: group.albumId,
            albumTitle: group.title,
            artist: group.artist
        )
    }
}

struct LibraryAlbumSongsView: View {
    @EnvironmentObject private var app: AppModel
    let albumTitle: String
    let artist: String?

    private var tracks: [MusicTrack] {
        app.libraryTracksForBrowsing.filter { track in
            track.album?.localizedCaseInsensitiveCompare(albumTitle) == .orderedSame
                && (artist == nil || track.artist?.localizedCaseInsensitiveCompare(artist!) == .orderedSame)
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
                            HStack(spacing: 6) {
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
                                            isOnServer: app.isOnServer(track.url)
                                        )
                                    )
                                }
                                .buttonStyle(.plain)

                                TrackStorageActionButton(
                                    track: track.payload,
                                    folderId: track.folderId
                                )
                            }
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
            tracks: app.libraryTracksForBrowsing.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending },
            title: app.isOfflinePlaybackActive ? "Utwory · Offline" : "Utwory",
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
    @State private var filteredTracks: [MusicTrack] = []
    @State private var sections: [LibraryAlphabetSection<MusicTrack>] = []
    @State private var displayIndexByURL: [String: Int] = [:]

    private var sectionRebuildToken: String {
        "\(tracks.count)|\(query)|\(tracks.first?.url ?? "")|\(tracks.last?.url ?? "")"
    }

    var body: some View {
        Group {
            if filteredTracks.isEmpty {
                ContentUnavailableView(
                    query.isEmpty ? "Brak utworów" : "Brak wyników",
                    systemImage: "music.note",
                    description: query.isEmpty ? nil : Text("Tylko utwory z Twojej biblioteki.")
                )
            } else {
                ScrollViewReader { proxy in
                    List {
                        ForEach(sections) { section in
                            Section {
                                ForEach(section.items) { track in
                                    songRow(
                                        track,
                                        displayIndex: displayIndexByURL[track.url] ?? 1
                                    )
                                    .listRowInsets(EdgeInsets(top: 3, leading: 16, bottom: 3, trailing: 28))
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
                    .environment(\.defaultMinListRowHeight, 52)
                    .modifier(AlphabetJumpOverlay(sections: sections.map(\.key), proxy: proxy))
                }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: enablesLibrarySearch ? "Szukaj w utworach" : "Szukaj")
        .eosScrollClearance()
        .task(id: sectionRebuildToken) {
            rebuildSections()
        }
        .onChange(of: query) { _, _ in
            rebuildSections()
        }
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: payload.items)
        }
    }

    private func rebuildSections() {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let filtered: [MusicTrack]
        if enablesLibrarySearch, q.count >= 1 {
            filtered = tracks.filter {
                $0.title.localizedCaseInsensitiveContains(q)
                    || ($0.artist?.localizedCaseInsensitiveContains(q) == true)
                    || ($0.album?.localizedCaseInsensitiveContains(q) == true)
            }
        } else {
            filtered = tracks
        }
        filteredTracks = filtered
        sections = LibrarySnapshotBuilder.alphabetSections(from: filtered) { $0.title }
        displayIndexByURL = LibrarySnapshotBuilder.displayIndices(sections: sections)
    }

    private func songRow(_ track: MusicTrack, displayIndex: Int) -> some View {
        HStack(spacing: 6) {
            Button {
                Task { await play(track: track) }
            } label: {
                TrackRowView(
                    index: displayIndex,
                    title: track.title,
                    subtitle: track.artist,
                    duration: track.duration,
                    artworkURL: track.artworkURL,
                    isPlaying: app.playback.engine?.currentTrack?.url == track.url,
                    downloadState: app.downloads.uiState(
                        for: track.url,
                        isOnServer: app.isOnServer(track.url)
                    )
                )
            }
            .buttonStyle(.plain)

            TrackStorageActionButton(
                track: track.payload,
                folderId: track.folderId
            )
        }
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
            if app.downloads.uiState(for: track.url, isOnServer: track.isOnServer) != .done {
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
        guard let index = filteredTracks.firstIndex(where: { $0.url == track.url }) else { return }
        let folder = app.musicFolders.first(where: { $0.id == track.folderId })
        await app.playTracks(filteredTracks, startIndex: index, folder: folder)
    }
}

private struct SharePayload: Identifiable {
    let id = UUID()
    let items: [Any]

    static func file(_ url: URL) -> SharePayload { SharePayload(items: [url]) }
    static func files(_ urls: [URL]) -> SharePayload { SharePayload(items: urls) }
    static func text(_ string: String) -> SharePayload { SharePayload(items: [string]) }
}

// MARK: - Downloaded

private enum DownloadedBrowseMode: String, CaseIterable, Identifiable {
    case songs
    case artists
    case albums

    var id: String { rawValue }

    var title: String {
        switch self {
        case .songs: return "Utwory"
        case .artists: return "Wykonawcy"
        case .albums: return "Albumy"
        }
    }
}

struct LibraryDownloadedView: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject private var offlineStore = OfflineMusicStore.shared
    @State private var errorMessage: String?
    @State private var query = ""
    @State private var sharePayload: SharePayload?
    @State private var deviceStorage: StorageSnapshot?
    @State private var mode: DownloadedBrowseMode = .songs
    @State private var editMode: EditMode = .inactive
    @State private var selectedURLs: Set<String> = []
    @State private var trackPendingDelete: MusicTrack?
    @State private var pendingBulkDelete = false
    @State private var cachedTracks: [MusicTrack] = []
    @State private var cachedSections: [(key: String, items: [MusicTrack])] = []
    @State private var sizeByURL: [String: Int64] = [:]
    @State private var totalDownloadedBytes: Int64 = 0
    @State private var displayIndexByURL: [String: Int] = [:]

    private var filteredTracks: [MusicTrack] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 1 else { return cachedTracks }
        return cachedTracks.filter {
            $0.title.localizedCaseInsensitiveContains(q)
                || ($0.artist?.localizedCaseInsensitiveContains(q) == true)
                || ($0.album?.localizedCaseInsensitiveContains(q) == true)
        }
    }

    private var selectedTracks: [MusicTrack] {
        filteredTracks.filter { selectedURLs.contains($0.url) }
    }

    private var selectedBytes: Int64 {
        selectedTracks.reduce(Int64(0)) { $0 + (sizeByURL[$1.url] ?? 0) }
    }

    private var tracksCountLabel: String {
        let n = filteredTracks.count
        switch n {
        case 1: return "1 utwór"
        case 2...4: return "\(n) utwory"
        default: return "\(n) utworów"
        }
    }

    private var isSelecting: Bool { editMode == .active }

    var body: some View {
        Group {
            if cachedTracks.isEmpty {
                ContentUnavailableView(
                    "Brak pobranych utworów",
                    systemImage: "arrow.down.circle",
                    description: Text("Pobierz utwory z playlisty, aby odtwarzać offline i udostępniać pliki.")
                )
            } else if filteredTracks.isEmpty {
                ContentUnavailableView.search(text: query)
            } else {
                ScrollViewReader { proxy in
                    List(selection: $selectedURLs) {
                        Section {
                            if let deviceStorage {
                                StorageCapacityBar(snapshot: deviceStorage, showsLegend: true)
                                    .padding(.vertical, 2)
                            }
                            HStack {
                                Label(tracksCountLabel, systemImage: "arrow.down.circle.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(ByteCountFormatter.string(fromByteCount: totalDownloadedBytes, countStyle: .file))
                                    .font(.subheadline.monospacedDigit().weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }

                            if !isSelecting {
                                Button {
                                    Task { await play(track: filteredTracks[0]) }
                                } label: {
                                    Label("Odtwórz wszystko", systemImage: "play.fill")
                                        .font(.headline)
                                        .foregroundStyle(EOSTheme.accent)
                                }
                            } else {
                                selectionSummaryRow
                            }
                        } header: {
                            Text("Na tym iPhonie")
                        }

                        Section {
                            Picker("Sortowanie", selection: $mode) {
                                ForEach(DownloadedBrowseMode.allCases) { item in
                                    Text(item.title).tag(item)
                                }
                            }
                            .pickerStyle(.segmented)
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .disabled(isSelecting)
                        }

                        ForEach(cachedSections, id: \.key) { section in
                            if mode == .songs {
                                Section {
                                    ForEach(Array(section.items.enumerated()), id: \.element.url) { index, track in
                                        downloadedRow(
                                            track: track,
                                            indexInSection: index,
                                            sectionTracks: section.items,
                                            useLocalIndex: false
                                        )
                                        .tag(track.url)
                                    }
                                    .onDelete { offsets in
                                        deleteOffsets(offsets, in: section.items)
                                    }
                                } header: {
                                    Text(section.key)
                                        .font(.footnote.weight(.bold))
                                        .foregroundStyle(.secondary)
                                        .id(section.key)
                                }
                            } else {
                                Section {
                                    DisclosureGroup {
                                        ForEach(Array(section.items.enumerated()), id: \.element.url) { index, track in
                                            downloadedRow(
                                                track: track,
                                                indexInSection: index,
                                                sectionTracks: section.items,
                                                useLocalIndex: true
                                            )
                                            .tag(track.url)
                                        }
                                        .onDelete { offsets in
                                            deleteOffsets(offsets, in: section.items)
                                        }
                                    } label: {
                                        downloadedGroupHeader(sectionKey: section.key, tracks: section.items)
                                    }
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .environment(\.editMode, $editMode)
                    .modifier(AlphabetJumpOverlay(
                        sections: mode == .songs && !isSelecting ? cachedSections.map(\.key) : [],
                        proxy: proxy
                    ))
                }
            }
        }
        .navigationTitle(isSelecting ? "Wybierz utwory" : "Pobrane")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Szukaj w pobranych")
        .eosScrollClearance()
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                if isSelecting {
                    Button(selectedURLs.count == filteredTracks.count ? "Odznacz" : "Zaznacz wszystkie") {
                        if selectedURLs.count == filteredTracks.count {
                            selectedURLs.removeAll()
                        } else {
                            selectedURLs = Set(filteredTracks.map(\.url))
                        }
                        UISelectionFeedbackGenerator().selectionChanged()
                    }
                    .disabled(filteredTracks.isEmpty)
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                EditButton()
                    .disabled(cachedTracks.isEmpty)
            }
            ToolbarItemGroup(placement: .bottomBar) {
                if isSelecting {
                    Button {
                        shareSelected()
                    } label: {
                        Label("Udostępnij", systemImage: "square.and.arrow.up")
                    }
                    .disabled(selectedURLs.isEmpty)

                    Spacer()

                    Text(selectionToolbarLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    Spacer()

                    Button(role: .destructive) {
                        pendingBulkDelete = true
                    } label: {
                        Label("Usuń", systemImage: "trash")
                    }
                    .disabled(selectedURLs.isEmpty)
                }
            }
        }
        .onAppear {
            deviceStorage = StorageCapacityReader.deviceVolume()
            rebuildCache()
        }
        .onChange(of: offlineStore.entries.count) { _, _ in rebuildCache() }
        .onChange(of: app.musicTracks.count) { _, _ in rebuildCache() }
        .onChange(of: query) { _, _ in rebuildCache() }
        .onChange(of: mode) { _, _ in
            selectedURLs.removeAll()
            rebuildCache()
        }
        .onChange(of: editMode) { _, mode in
            if mode == .inactive {
                selectedURLs.removeAll()
            }
        }
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: payload.items)
        }
        .confirmationDialog(
            "Usunąć z iPhone’a?",
            isPresented: Binding(get: { trackPendingDelete != nil }, set: { if !$0 { trackPendingDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("Usuń lokalną kopię", role: .destructive) {
                if let track = trackPendingDelete {
                    Task { await deleteDownloaded(track) }
                }
                trackPendingDelete = nil
            }
            Button("Anuluj", role: .cancel) { trackPendingDelete = nil }
        } message: {
            if let track = trackPendingDelete {
                Text("„\(track.title)” zniknie z urządzenia. Kopia na serwerze EOS pozostanie.")
            }
        }
        .confirmationDialog(
            "Usunąć zaznaczone?",
            isPresented: $pendingBulkDelete,
            titleVisibility: .visible
        ) {
            Button(bulkDeleteButtonTitle, role: .destructive) {
                Task { await deleteSelected() }
            }
            Button("Anuluj", role: .cancel) {}
        } message: {
            Text(bulkDeleteMessage)
        }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var selectionSummaryRow: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(EOSTheme.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text(selectionToolbarLabel)
                    .font(.subheadline.weight(.semibold))
                if selectedBytes > 0 {
                    Text(ByteCountFormatter.string(fromByteCount: selectedBytes, countStyle: .file))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Dotknij utworów, aby zaznaczyć")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
            if !selectedURLs.isEmpty {
                Button("Odtwórz") {
                    Task { await playSelected() }
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(EOSTheme.accent)
            }
        }
    }

    private var selectionToolbarLabel: String {
        let n = selectedURLs.count
        switch n {
        case 0: return "Nic nie zaznaczono"
        case 1: return "1 zaznaczony"
        case 2...4: return "\(n) zaznaczone"
        default: return "\(n) zaznaczonych"
        }
    }

    private var bulkDeleteButtonTitle: String {
        let n = selectedURLs.count
        return n == 1 ? "Usuń 1 utwór" : "Usuń \(n) utworów"
    }

    private var bulkDeleteMessage: String {
        let n = selectedURLs.count
        let size = selectedBytes > 0
            ? " (\(ByteCountFormatter.string(fromByteCount: selectedBytes, countStyle: .file)))"
            : ""
        return "Zaznaczone utwory (\(n))\(size) znikną z urządzenia. Kopie na serwerze EOS pozostaną."
    }

    private func rebuildCache() {
        let tracks = app.downloadedLibraryTracks
        cachedTracks = tracks
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let filtered: [MusicTrack]
        if q.count >= 1 {
            filtered = tracks.filter {
                $0.title.localizedCaseInsensitiveContains(q)
                    || ($0.artist?.localizedCaseInsensitiveContains(q) == true)
                    || ($0.album?.localizedCaseInsensitiveContains(q) == true)
            }
        } else {
            filtered = tracks
        }

        sizeByURL = OfflineMusicStore.shared.cachedSizes(for: filtered.map(\.url))
        totalDownloadedBytes = sizeByURL.values.reduce(0, +)

        switch mode {
        case .songs:
            let sorted = filtered.sorted {
                $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
            }
            cachedSections = LibraryAlphabet.group(sorted) { $0.title }
            var indexMap: [String: Int] = [:]
            for (i, track) in sorted.enumerated() {
                indexMap[track.url] = i + 1
            }
            displayIndexByURL = indexMap
        case .artists:
            let sorted = filtered.sorted { lhs, rhs in
                let la = lhs.artist ?? "Nieznany wykonawca"
                let ra = rhs.artist ?? "Nieznany wykonawca"
                let cmp = la.localizedCaseInsensitiveCompare(ra)
                if cmp != .orderedSame { return cmp == .orderedAscending }
                return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
            }
            cachedSections = Dictionary(grouping: sorted) { track -> String in
                let name = track.artist?.trimmingCharacters(in: .whitespacesAndNewlines)
                return (name?.isEmpty == false) ? name! : "Nieznany wykonawca"
            }
            .map { (key: $0.key, items: $0.value) }
            .sorted { $0.key.localizedCaseInsensitiveCompare($1.key) == .orderedAscending }
            displayIndexByURL = [:]
        case .albums:
            let sorted = filtered.sorted { lhs, rhs in
                let la = lhs.album ?? "Bez albumu"
                let ra = rhs.album ?? "Bez albumu"
                let cmp = la.localizedCaseInsensitiveCompare(ra)
                if cmp != .orderedSame { return cmp == .orderedAscending }
                return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
            }
            cachedSections = Dictionary(grouping: sorted) { track -> String in
                let album = track.album?.trimmingCharacters(in: .whitespacesAndNewlines)
                guard let album, !album.isEmpty else { return "Bez albumu" }
                if let artist = track.artist, !artist.isEmpty {
                    return "\(album) · \(artist)"
                }
                return album
            }
            .map { (key: $0.key, items: $0.value) }
            .sorted { $0.key.localizedCaseInsensitiveCompare($1.key) == .orderedAscending }
            displayIndexByURL = [:]
        }
    }

    @ViewBuilder
    private func downloadedGroupHeader(sectionKey: String, tracks: [MusicTrack]) -> some View {
        let bytes = tracks.reduce(Int64(0)) { $0 + (sizeByURL[$1.url] ?? 0) }
        let sizeLabel = bytes > 0
            ? ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)
            : nil

        HStack(spacing: 14) {
            // Offline list: skip remote artwork fetches that stall scroll.
            ArtworkImage(
                url: nil,
                size: 52,
                cornerRadius: mode == .artists ? 26 : 8
            )
            .shadow(color: .black.opacity(0.08), radius: 4, y: 2)

            VStack(alignment: .leading, spacing: 3) {
                if mode == .albums {
                    let parts = sectionKey.split(separator: "·", maxSplits: 1).map {
                        $0.trimmingCharacters(in: .whitespacesAndNewlines)
                    }
                    Text(parts.first ?? sectionKey)
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                    if parts.count > 1, !parts[1].isEmpty {
                        Text(parts[1])
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                } else {
                    Text(sectionKey)
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                }

                Text([
                    "\(tracks.count) utworów",
                    sizeLabel
                ].compactMap { $0 }.joined(separator: " · "))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 4)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private func downloadedRow(
        track: MusicTrack,
        indexInSection: Int,
        sectionTracks: [MusicTrack],
        useLocalIndex: Bool
    ) -> some View {
        let displayIndex = useLocalIndex
            ? indexInSection + 1
            : (displayIndexByURL[track.url] ?? indexInSection + 1)
        let size = sizeByURL[track.url]
        let sizeLabel = size.map { ByteCountFormatter.string(fromByteCount: $0, countStyle: .file) }
        let subtitle: String = {
            switch mode {
            case .songs:
                return [track.artist, track.album].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
            case .artists:
                return track.album ?? "Utwór"
            case .albums:
                return track.artist ?? "Utwór"
            }
        }()

        Group {
            if isSelecting {
                TrackRowView(
                    index: displayIndex,
                    title: track.title,
                    subtitle: subtitle.isEmpty ? nil : subtitle,
                    duration: track.duration,
                    artworkURL: nil,
                    isPlaying: app.playback.engine?.currentTrack?.url == track.url,
                    downloadState: .done,
                    detailLabel: sizeLabel,
                    showsOfflineBadge: true
                )
                .contentShape(Rectangle())
            } else {
                Button {
                    Task { await playDownloaded(track: track, sectionTracks: sectionTracks) }
                } label: {
                    TrackRowView(
                        index: displayIndex,
                        title: track.title,
                        subtitle: subtitle.isEmpty ? nil : subtitle,
                        duration: track.duration,
                        artworkURL: nil,
                        isPlaying: app.playback.engine?.currentTrack?.url == track.url,
                        downloadState: .done,
                        detailLabel: sizeLabel,
                        showsOfflineBadge: true
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .contextMenu {
            if !isSelecting {
                Button {
                    Task { await playDownloaded(track: track, sectionTracks: sectionTracks) }
                } label: {
                    Label("Odtwórz", systemImage: "play.fill")
                }
                if let sizeLabel {
                    Text("Rozmiar: \(sizeLabel)")
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
                Button {
                    selectedURLs = [track.url]
                    editMode = .active
                } label: {
                    Label("Zaznacz…", systemImage: "checkmark.circle")
                }
                Button(role: .destructive) {
                    trackPendingDelete = track
                } label: {
                    Label("Usuń z iPhone’a", systemImage: "trash")
                }
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: !isSelecting) {
            if !isSelecting {
                Button(role: .destructive) {
                    trackPendingDelete = track
                } label: {
                    Label("Usuń", systemImage: "trash")
                }
                Button {
                    selectedURLs = [track.url]
                    editMode = .active
                } label: {
                    Label("Zaznacz", systemImage: "checkmark.circle")
                }
                .tint(EOSTheme.accent)
            }
        }
    }

    private func deleteOffsets(_ offsets: IndexSet, in sectionTracks: [MusicTrack]) {
        for index in offsets {
            guard sectionTracks.indices.contains(index) else { continue }
            Task { await deleteDownloaded(sectionTracks[index]) }
        }
    }

    /// Songs mode must use the full downloaded list (not one alphabet letter), keyed by URL.
    /// Artists/albums keep the section as the natural queue.
    private func playDownloaded(track: MusicTrack, sectionTracks: [MusicTrack]) async {
        let playQueue: [MusicTrack]
        switch mode {
        case .songs:
            playQueue = filteredTracks
        case .artists, .albums:
            playQueue = sectionTracks
        }
        await play(track: track, queue: playQueue)
    }

    private func play(track: MusicTrack, queue: [MusicTrack]? = nil) async {
        let playQueue = queue ?? filteredTracks
        guard let index = playQueue.firstIndex(where: { $0.url == track.url }) else {
            // Fallback: still start the tapped track even if list identity drifted.
            await app.playTracks([track], startIndex: 0, folder: app.musicFolders.first(where: { $0.id == track.folderId }))
            return
        }
        let folder = app.musicFolders.first(where: { $0.id == track.folderId })
        await app.playTracks(playQueue, startIndex: index, folder: folder)
    }

    private func playSelected() async {
        let queue = selectedTracks
        guard let first = queue.first else { return }
        await app.playTracks(queue, startIndex: 0, folder: app.musicFolders.first(where: { $0.id == first.folderId }))
    }

    private func shareSelected() {
        let urls = selectedTracks.compactMap { OfflineMusicStore.shared.localURL(for: $0.url) }
        guard !urls.isEmpty else {
            errorMessage = "Brak lokalnych plików do udostępnienia."
            return
        }
        sharePayload = .files(urls)
    }

    private func deleteSelected() async {
        let tracks = selectedTracks
        for track in tracks {
            await deleteDownloaded(track)
        }
        selectedURLs.removeAll()
        editMode = .inactive
        deviceStorage = StorageCapacityReader.deviceVolume()
    }

    private func deleteDownloaded(_ track: MusicTrack) async {
        app.cancelDownload(for: track.url)
        app.removeOfflineDownload(for: track.url)
        selectedURLs.remove(track.url)
        deviceStorage = StorageCapacityReader.deviceVolume()
    }
}

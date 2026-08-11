import SwiftUI

struct LibraryView: View {
    @EnvironmentObject private var app: AppModel
    @AppStorage("ui.recentLibraryLayout") private var recentLayoutRaw = RecentLibraryLayout.tiles.rawValue
    @State private var isRefreshing = false
    @State private var showCreateFolder = false
    @State private var showImportSheet = false
    @State private var newFolderName = ""
    @State private var importURL = ""
    @State private var isImporting = false
    @State private var importError: String?
    @State private var errorMessage: String?
    @State private var deviceStorage: StorageSnapshot?
    @State private var cachedRecentItems: [RecentLibraryItem] = []

    private var recentLayout: RecentLibraryLayout {
        RecentLibraryLayout(rawValue: recentLayoutRaw) ?? .tiles
    }

    private var recentColumns: [GridItem] {
        switch recentLayout {
        case .tiles:
            return [
                GridItem(.flexible(), spacing: 16),
                GridItem(.flexible(), spacing: 16),
            ]
        case .large:
            return [GridItem(.flexible(), spacing: 16)]
        case .list:
            return [GridItem(.flexible())]
        }
    }

    private var recentItems: [RecentLibraryItem] { cachedRecentItems }

    private var recentRebuildToken: String {
        let tracks = app.libraryTracksForBrowsing
        let limit = recentLayout == .large ? 8 : 12
        return "\(tracks.count)|\(limit)|\(app.isOfflinePlaybackActive)|\(tracks.first?.url ?? "")|\(tracks.last?.addedAt ?? 0)"
    }

    private var downloadedCount: Int {
        app.downloadedLibraryTracks.count
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    categoryList

                    if !recentItems.isEmpty {
                        recentSectionHeader
                            .padding(.horizontal, 20)
                            .padding(.top, 28)
                            .padding(.bottom, 14)

                        LazyVGrid(columns: recentColumns, spacing: recentLayout == .list ? 4 : 20) {
                            ForEach(recentItems) { item in
                                Button {
                                    Task { await playRecent(item.track) }
                                } label: {
                                    RecentLibraryCell(item: item, style: recentLayout)
                                }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    recentContextMenu(for: item)
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 48)
                        .animation(EOSMotion.snappy, value: recentLayoutRaw)
                    } else if app.isOfflinePlaybackActive {
                        ContentUnavailableView(
                            "Brak pobranych utworów",
                            systemImage: "arrow.down.circle",
                            description: Text("Pobierz utwory online, a potem włącz Offline u góry — będą tu dostępne bez internetu.")
                        )
                        .padding(.top, 40)
                        .padding(.bottom, 48)
                    }
                }
            }
            .background(Color(.systemBackground))
            .navigationTitle(app.isOfflinePlaybackActive ? "Biblioteka · Offline" : "Biblioteka")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: LibraryCategory.self) { category in
                destination(for: category)
            }
            .navigationDestination(for: MusicFolder.self) { folder in
                FolderDetailView(folder: folder)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Nowa playlista") { showCreateFolder = true }
                            .disabled(app.isOfflinePlaybackActive)
                        Button("Import playlisty") {
                            importError = nil
                            showImportSheet = true
                        }
                            .disabled(app.isOfflinePlaybackActive)
                        Button("Odśwież") { Task { await refresh() } }
                            .disabled(app.isOfflinePlaybackActive)
                    } label: {
                        Image(systemName: "plus")
                            .font(.body.weight(.semibold))
                    }
                }
            }
            .overlay(alignment: .top) {
                if app.isLibraryLoading && app.musicTracks.isEmpty && !app.isOfflinePlaybackActive {
                    ProgressView("Pierwsze ładowanie biblioteki…")
                        .padding(10)
                        .background(.ultraThinMaterial, in: Capsule())
                        .padding(.top, 8)
                }
            }
            .refreshable { await refresh() }
            .task(id: recentRebuildToken) {
                rebuildRecentItems()
            }
            .onAppear {
                deviceStorage = StorageCapacityReader.deviceVolume()
                if cachedRecentItems.isEmpty {
                    rebuildRecentItems()
                }
            }
            .alert("Nowa playlista", isPresented: $showCreateFolder) {
                TextField("Nazwa", text: $newFolderName)
                Button("Anuluj", role: .cancel) { newFolderName = "" }
                Button("Utwórz") { Task { await createFolder() } }
            }
            .sheet(isPresented: $showImportSheet) {
                importSheet
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func rebuildRecentItems() {
        let limit = recentLayout == .large ? 8 : 12
        cachedRecentItems = LibraryData.recentTracks(from: app.libraryTracksForBrowsing, limit: limit)
    }

    private var recentSectionHeader: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(app.isOfflinePlaybackActive ? "Niedawno pobrane" : "Ostatnio dodane")
                .font(.title2.weight(.bold))
                .foregroundStyle(.primary)
            Spacer(minLength: 8)
            Menu {
                Picker("Układ", selection: $recentLayoutRaw) {
                    ForEach(RecentLibraryLayout.allCases) { layout in
                        Label(layout.title, systemImage: layout.systemImage)
                            .tag(layout.rawValue)
                    }
                }
            } label: {
                Image(systemName: recentLayout.systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(LibraryAccent.icon)
                    .frame(width: 36, height: 36)
                    .background(Color(.secondarySystemBackground), in: Circle())
            }
            .accessibilityLabel("Układ ostatnio dodanych")
        }
    }

    @ViewBuilder
    private func recentContextMenu(for item: RecentLibraryItem) -> some View {
        Button {
            Task { await playRecent(item.track) }
        } label: {
            Label("Odtwórz", systemImage: "play.fill")
        }
        if let albumId = item.track.albumId, !albumId.isEmpty {
            NavigationLink {
                AlbumBrowseDestination(
                    albumId: albumId,
                    albumTitle: item.track.album,
                    artist: item.track.artist
                )
            } label: {
                Label("Pokaż album", systemImage: "square.stack")
            }
        } else if let album = item.track.album, !album.isEmpty {
            NavigationLink {
                LibraryAlbumSongsView(albumTitle: album, artist: item.track.artist)
            } label: {
                Label("Pokaż album", systemImage: "square.stack")
            }
        }
    }

    private var categoryList: some View {
        VStack(spacing: 0) {
            ForEach(Array(LibraryCategory.allCases.enumerated()), id: \.element.id) { index, category in
                NavigationLink(value: category) {
                    if category == .downloaded {
                        LibraryDownloadedCategoryRow(
                            count: downloadedCount,
                            storage: deviceStorage
                        )
                    } else {
                        LibraryCategoryRow(
                            icon: category.icon,
                            title: category.title,
                            subtitle: categorySubtitle(category)
                        )
                    }
                }
                .buttonStyle(.plain)

                if index < LibraryCategory.allCases.count - 1 {
                    Divider()
                        .padding(.leading, 66)
                }
            }
        }
        .padding(.top, 4)
    }

    private func categorySubtitle(_ category: LibraryCategory) -> String? {
        guard app.isOfflinePlaybackActive else { return nil }
        switch category {
        case .favorites:
            let n = app.favoriteItems.filter { $0.type == "music" && app.isOfflineAvailable($0.url) }.count
            return n > 0 ? "\(n) offline" : "Brak offline"
        case .playlists:
            let n = app.libraryFoldersForBrowsing.count
            return n > 0 ? "\(n)" : "Brak offline"
        case .artists:
            return "\(LibraryData.artistGroups(from: app.libraryTracksForBrowsing).count)"
        case .albums:
            return "\(LibraryData.albumGroups(from: app.libraryTracksForBrowsing).count)"
        case .songs:
            return "\(app.libraryTracksForBrowsing.count)"
        case .downloaded:
            return nil
        }
    }

    @ViewBuilder
    private func destination(for category: LibraryCategory) -> some View {
        switch category {
        case .favorites: FavoritesView()
        case .playlists: LibraryPlaylistsView()
        case .artists: LibraryArtistsView()
        case .albums: LibraryAlbumsView()
        case .songs: LibrarySongsView()
        case .downloaded: LibraryDownloadedView()
        }
    }

    private var importSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("https://music.apple.com/… lub open.spotify.com/…", text: $importURL)
                        .textContentType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .disabled(isImporting)
                } header: {
                    Text("Link playlisty")
                } footer: {
                    Text("Apple Music (publiczna playlista) albo Spotify. Prywatne „Ulubione” / Favourite Songs zwykle się nie dadzą zaimportować — udostępnij playlistę albo użyj publicznej.")
                }

                if let importError {
                    Section {
                        Text(importError)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await importPlaylist() }
                    } label: {
                        HStack {
                            Spacer()
                            if isImporting {
                                ProgressView()
                                    .padding(.trailing, 8)
                                Text("Importuję…")
                            } else {
                                Text("Importuj playlistę")
                            }
                            Spacer()
                        }
                    }
                    .disabled(isImporting || importURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .navigationTitle("Import playlisty")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") {
                        guard !isImporting else { return }
                        showImportSheet = false
                        importURL = ""
                        importError = nil
                    }
                    .disabled(isImporting)
                }
            }
            .interactiveDismissDisabled(isImporting)
        }
        .presentationDetents([.medium, .large])
    }

    private func playRecent(_ track: MusicTrack) async {
        let queue = recentItems.map(\.track)
        guard let index = queue.firstIndex(where: { $0.url == track.url }) else { return }
        let folder = app.musicFolders.first(where: { $0.id == track.folderId })
        await app.playTracks(queue, startIndex: index, folder: folder)
    }

    private func refresh() async {
        if app.isOfflinePlaybackActive {
            deviceStorage = StorageCapacityReader.deviceVolume()
            return
        }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            try await app.refreshMusicLibrary()
            try? await app.refreshFavorites()
        } catch {
            errorMessage = error.localizedDescription
        }
        deviceStorage = StorageCapacityReader.deviceVolume()
    }

    private func createFolder() async {
        let name = newFolderName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        do {
            _ = try await app.api.createMusicFolder(name: name)
            newFolderName = ""
            try await app.refreshMusicLibrary()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func importPlaylist() async {
        let url = importURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty, !isImporting else { return }
        importError = nil
        isImporting = true
        defer { isImporting = false }
        do {
            _ = try await app.api.importMusicPlaylist(url: url)
            importURL = ""
            importError = nil
            showImportSheet = false
            try await app.refreshMusicLibrary()
        } catch {
            importError = error.localizedDescription
        }
    }
}

import SwiftUI

struct LibraryView: View {
    @EnvironmentObject private var app: AppModel
    @State private var isRefreshing = false
    @State private var showCreateFolder = false
    @State private var showImportSheet = false
    @State private var newFolderName = ""
    @State private var importURL = ""
    @State private var errorMessage: String?

    private let recentColumns = [
        GridItem(.flexible(), spacing: 16),
        GridItem(.flexible(), spacing: 16),
    ]

    private var recentItems: [RecentLibraryItem] {
        LibraryData.recentTracks(from: app.musicTracks, limit: 12)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    categoryList

                    if !recentItems.isEmpty {
                        Text("Ostatnio dodane")
                            .font(.title2.weight(.bold))
                            .foregroundStyle(.primary)
                            .padding(.horizontal, 20)
                            .padding(.top, 28)
                            .padding(.bottom, 14)

                        LazyVGrid(columns: recentColumns, spacing: 20) {
                            ForEach(recentItems) { item in
                                Button {
                                    Task { await playRecent(item.track) }
                                } label: {
                                    RecentLibraryCell(item: item)
                                }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button {
                                        Task { await playRecent(item.track) }
                                    } label: {
                                        Label("Odtwórz", systemImage: "play.fill")
                                    }
                                    if let albumId = item.track.albumId, !albumId.isEmpty {
                                        NavigationLink {
                                            AlbumDetailView(albumId: albumId)
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
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 28)
                    }
                }
            }
            .background(Color(.systemBackground))
            .navigationTitle("Biblioteka")
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
                        Button("Import playlisty") { showImportSheet = true }
                        Button("Odśwież") { Task { await refresh() } }
                    } label: {
                        Image(systemName: "plus")
                            .font(.body.weight(.semibold))
                    }
                }
            }
            .overlay(alignment: .top) {
                if app.isLibraryLoading && app.musicTracks.isEmpty {
                    ProgressView("Ładuję bibliotekę…")
                        .padding(10)
                        .background(.ultraThinMaterial, in: Capsule())
                        .padding(.top, 8)
                }
            }
            .refreshable { await refresh() }
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

    private var categoryList: some View {
        VStack(spacing: 0) {
            ForEach(Array(LibraryCategory.allCases.enumerated()), id: \.element.id) { index, category in
                NavigationLink(value: category) {
                    LibraryCategoryRow(icon: category.icon, title: category.title)
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
                Section("Link Apple Music") {
                    TextField("https://music.apple.com/…", text: $importURL)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                }
                Section {
                    Button("Importuj playlistę") { Task { await importPlaylist() } }
                        .disabled(importURL.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .navigationTitle("Import playlisty")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { showImportSheet = false; importURL = "" }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func playRecent(_ track: MusicTrack) async {
        let queue = recentItems.map(\.track)
        guard let index = queue.firstIndex(where: { $0.url == track.url }) else { return }
        let folder = app.musicFolders.first(where: { $0.id == track.folderId })
        await app.playTracks(queue, startIndex: index, folder: folder)
    }

    private func refresh() async {
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            try await app.refreshMusicLibrary()
            try? await app.refreshFavorites()
        } catch {
            errorMessage = error.localizedDescription
        }
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
        let url = importURL.trimmingCharacters(in: .whitespaces)
        guard !url.isEmpty else { return }
        do {
            _ = try await app.api.importAppleMusicPlaylist(url: url)
            importURL = ""
            showImportSheet = false
            try await app.refreshMusicLibrary()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

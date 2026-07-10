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
        LibraryData.recentItems(folders: app.musicFolders, tracks: app.musicTracks)
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
                                recentLink(for: item)
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
            .navigationDestination(for: RecentLibraryItem.self) { item in
                recentDestination(for: item)
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
    private func recentLink(for item: RecentLibraryItem) -> some View {
        NavigationLink(value: item) {
            RecentLibraryCell(item: item)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func destination(for category: LibraryCategory) -> some View {
        switch category {
        case .playlists: LibraryPlaylistsView()
        case .artists: LibraryArtistsView()
        case .albums: LibraryAlbumsView()
        case .songs: LibrarySongsView()
        case .downloaded: LibraryDownloadedView()
        }
    }

    @ViewBuilder
    private func recentDestination(for item: RecentLibraryItem) -> some View {
        switch item.kind {
        case .folder(let folder):
            FolderDetailView(folder: folder)
        case .album(let id):
            if id.hasPrefix("album:") {
                let parts = id.dropFirst(6).split(separator: "|", maxSplits: 1)
                let title = String(parts.first ?? "")
                let artist = parts.count > 1 ? String(parts[1]) : nil
                LibraryAlbumSongsView(albumTitle: title, artist: artist)
            } else {
                AlbumDetailView(albumId: id)
            }
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

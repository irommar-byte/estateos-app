import SwiftUI

private enum MusicFocus: Hashable {
    case query
    case searchButton
    case newFolder
    case importPlaylist
    case folder(String)
    case artist(String)
    case album(String)
    case song(String)
}

struct MusicView: View {
    @EnvironmentObject private var app: AppModel
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    @Binding var requestContentFocus: Bool

    @State private var query = ""
    @State private var catalog: MusicCatalogSearchResponse?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var hasSearched = false
    @State private var selectedTrack: MusicSelection?
    @State private var selectedTrackContext: [MusicPlaybackTrack]?
    @State private var browseArtist: MusicArtist?
    @State private var browseAlbum: MusicAlbum?
    @State private var activeFolder: MusicFolder?
    @State private var showCreateFolder = false
    @State private var showImportPlaylist = false
    @State private var importPlaylistURL = ""
    @State private var importDownloadAfter = true
    @State private var startBatchDownloadOnFolderOpen = false
    @State private var newFolderName = ""
    @State private var createError: String?
    @State private var debounceTask: Task<Void, Never>?
    @State private var pendingScrollToResults = false
    @FocusState private var localFocus: MusicFocus?

    var body: some View {
        Group {
            if let album = browseAlbum {
                MusicAlbumView(
                    album: album,
                    onBack: { browseAlbum = nil },
                    onTrack: { track, context in
                        selectedTrackContext = context
                        selectedTrack = track
                    },
                    onOpenFolder: { folder, startBatch in
                        browseAlbum = nil
                        startBatchDownloadOnFolderOpen = startBatch
                        activeFolder = folder
                    }
                )
                .environmentObject(app)
            } else if let artist = browseArtist {
                MusicArtistView(
                    artist: artist,
                    onBack: { browseArtist = nil },
                    onAlbum: { browseAlbum = $0 },
                    onTrack: { track, context in
                        selectedTrackContext = context
                        selectedTrack = track
                    },
                    onOpenFolder: { folder, startBatch in
                        browseArtist = nil
                        startBatchDownloadOnFolderOpen = startBatch
                        activeFolder = folder
                    }
                )
                .environmentObject(app)
            } else if let folder = activeFolder {
                MusicFolderView(
                    folder: folder,
                    navigationTab: navigationTab,
                    focusedTab: focusedTab,
                    startBatchDownloadOnAppear: startBatchDownloadOnFolderOpen,
                    onBack: {
                        startBatchDownloadOnFolderOpen = false
                        activeFolder = nil
                    }
                )
                .environmentObject(app)
            } else {
                mainContent
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { await app.refreshMusicLibrary() }
        .onChange(of: requestContentFocus) { _, requested in
            guard requested else { return }
            localFocus = .query
            requestContentFocus = false
        }
        .onChange(of: query) { _, newValue in
            scheduleDebouncedSearch(for: newValue)
        }
        .fullScreenCover(item: $selectedTrack) { track in
            MusicDetailView(selection: track, folders: app.musicFolders, contextQueue: selectedTrackContext ?? []) {
                Task { await app.refreshMusicLibrary() }
            }
            .environmentObject(app)
        }
        .fullScreenCover(isPresented: $showCreateFolder) {
            MusicFolderCreateSheet(
                name: $newFolderName,
                onCancel: {
                    showCreateFolder = false
                    newFolderName = ""
                    createError = nil
                },
                onCreate: {
                    Task { await createFolder() }
                }
            )
            .environmentObject(app)
        }
        .fullScreenCover(isPresented: $showImportPlaylist) {
            MusicPlaylistImportSheet(
                url: $importPlaylistURL,
                downloadAfterImport: $importDownloadAfter,
                onCancel: {
                    showImportPlaylist = false
                    importPlaylistURL = ""
                },
                onImported: { folder, downloadAfter in
                    showImportPlaylist = false
                    importPlaylistURL = ""
                    startBatchDownloadOnFolderOpen = downloadAfter
                    activeFolder = folder
                }
            )
            .environmentObject(app)
        }
    }

    private var mainContent: some View {
        ScrollViewReader { scrollProxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: NostalgieSpacing.section) {
                    Color.clear.frame(height: 1).id("musicTop")

                    ScreenTitle(
                        title: "Muzyka",
                        subtitle: "Apple Music · wykonawca → album → pełny utwór MP3"
                    )

                    searchSection
                        .defaultFocus($localFocus, .query)

                    catalogSections

                    folderSection
                }
                .padding(.horizontal, NostalgieSpacing.screenH)
                .padding(.bottom, NostalgieSpacing.scrollBottom)
            }
            .onChange(of: pendingScrollToResults) { _, pending in
                guard pending else { return }
                pendingScrollToResults = false
                withAnimation(NostalgieTheme.contentSpring) {
                    scrollProxy.scrollTo("musicResults", anchor: .top)
                }
            }
            .onPlayPauseCommand {
                localFocus = .query
            }
            .onExitCommand {
                if !query.isEmpty {
                    query = ""
                    catalog = nil
                    hasSearched = false
                    localFocus = .query
                } else {
                    focusedTab.wrappedValue = .search
                }
            }
        }
    }

    @ViewBuilder
    private var catalogSections: some View {
        VStack(alignment: .leading, spacing: 22) {
            Color.clear.frame(height: 1).id("musicResults")

            if isLoading {
                ProgressView("Szukam w Apple Music…")
            } else if let errorMessage {
                EmptyStateView(icon: "exclamationmark.magnifyingglass", title: "Błąd", message: errorMessage)
            } else if let catalog {
                if !catalog.artists.isEmpty {
                    MusicSectionHeader(title: "Wykonawcy", subtitle: "Wybierz artystę, aby zobaczyć albumy")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 22) {
                            ForEach(catalog.artists) { artist in
                                MusicArtistCircleCard(artist: artist) {
                                    browseArtist = artist
                                }
                                .focused($localFocus, equals: .artist(artist.id))
                            }
                        }
                        .padding(.vertical, 10)
                    }
                    .fullBleedShelf()
                }

                if !catalog.albums.isEmpty {
                    MusicSectionHeader(title: "Albumy")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 22) {
                            ForEach(catalog.albums) { album in
                                MusicAlbumTile(album: album, size: 168) {
                                    browseAlbum = album
                                }
                                .focused($localFocus, equals: .album(album.id))
                            }
                        }
                        .padding(.vertical, 10)
                    }
                    .fullBleedShelf()
                }

                if !catalog.songs.isEmpty {
                    MusicSectionHeader(title: "Utwory")
                    LazyVStack(spacing: NostalgieSpacing.listRow) {
                        ForEach(Array(catalog.songs.prefix(16).enumerated()), id: \.element.id) { index, song in
                            MusicTrackRow(
                                index: index + 1,
                                title: song.title,
                                subtitle: [song.uploader, song.album].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
                                duration: song.duration,
                                showsPlayHint: true
                            ) {
                                selectedTrack = MusicSelection(from: song)
                            }
                            .focused($localFocus, equals: .song(song.url))
                        }
                    }
                }

                if catalog.artists.isEmpty && catalog.albums.isEmpty && catalog.songs.isEmpty && hasSearched {
                    EmptyStateView(
                        icon: "music.note",
                        title: "Brak wyników",
                        message: "Spróbuj innej frazy — np. «Nirvana» albo «Hey Jude Beatles»."
                    )
                }
            }
        }
    }

    private var folderSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Color.clear.frame(height: 1).id("musicFolders")

            MusicSectionHeader(
                title: "Playlisty i foldery",
                subtitle: "Import z Apple Music · pobieranie MP3 · odtwarzanie offline"
            )

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 16) {
                    MusicActionTile(
                        icon: "link.circle.fill",
                        title: "Importuj playlistę",
                        subtitle: "Link Apple Music"
                    ) {
                        importPlaylistURL = ""
                        importDownloadAfter = true
                        showImportPlaylist = true
                    }
                    .focused($localFocus, equals: .importPlaylist)

                    MusicActionTile(
                        icon: "plus.circle.fill",
                        title: "Nowy folder",
                        subtitle: "Pusta playlista"
                    ) {
                        newFolderName = ""
                        createError = nil
                        showCreateFolder = true
                    }
                    .focused($localFocus, equals: .newFolder)

                    ForEach(app.musicFolders) { folder in
                        MusicFolderCard(folder: folder) {
                            activeFolder = folder
                        }
                        .focused($localFocus, equals: .folder(folder.id))
                    }
                }
                .padding(.vertical, 10)
            }
            .fullBleedShelf()
        }
    }

    private var searchSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 20) {
                HStack(spacing: 14) {
                    Image(systemName: "music.note")
                        .foregroundStyle(.secondary)
                    TextField("Wykonawca, album, utwór…", text: $query)
                        .textFieldStyle(.plain)
                        .font(NostalgieFont.field)
                        .onSubmit { Task { await runSearch(scrollToResults: true) } }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .background(localFocus == .query ? NostalgieTheme.cardFocused : NostalgieTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous)
                        .stroke(localFocus == .query ? Color.white.opacity(0.9) : Color.white.opacity(0.08), lineWidth: localFocus == .query ? 3 : 1)
                }
                .focused($localFocus, equals: .query)
                .onMoveCommand { direction in
                    switch direction {
                    case .up: focusedTab.wrappedValue = navigationTab
                    case .down, .right: localFocus = .searchButton
                    default: break
                    }
                }

                Button { Task { await runSearch(scrollToResults: true) } } label: {
                    Label("Szukaj", systemImage: "arrow.right.circle.fill")
                }
                .buttonStyle(FocusCardButtonStyle())
                .focused($localFocus, equals: .searchButton)
                .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty || isLoading)
            }
            .frame(maxWidth: 980)

            if isLoading {
                Text("Szukam…").font(NostalgieFont.metadata).foregroundStyle(.secondary)
            } else if let catalog, hasSearched {
                Text("\(catalog.artists.count) wykonawców · \(catalog.albums.count) albumów · \(catalog.songs.count) utworów")
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func scheduleDebouncedSearch(for rawQuery: String) {
        debounceTask?.cancel()
        let trimmed = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            catalog = nil
            errorMessage = nil
            hasSearched = false
            return
        }
        debounceTask = Task {
            try? await Task.sleep(nanoseconds: 750_000_000)
            guard !Task.isCancelled else { return }
            await runSearch(scrollToResults: true)
        }
    }

    private func runSearch(scrollToResults: Bool) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return }
        debounceTask?.cancel()
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            catalog = try await app.api.searchMusicCatalog(query: trimmed)
            hasSearched = true
            if scrollToResults { pendingScrollToResults = true }
        } catch {
            catalog = nil
            hasSearched = true
            errorMessage = error.localizedDescription
            if scrollToResults { pendingScrollToResults = true }
        }
    }

    private func createFolder() async {
        let name = newFolderName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        do {
            _ = try await app.createMusicFolder(name: name)
            showCreateFolder = false
            newFolderName = ""
            createError = nil
        } catch {
            createError = error.localizedDescription
        }
    }
}

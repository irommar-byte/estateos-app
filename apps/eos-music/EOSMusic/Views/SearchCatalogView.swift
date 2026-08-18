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
    @State private var instantSuggestions: [SearchSuggestion] = []
    @State private var recentQueries: [String] = []
    @State private var isSearchingCatalog = false
    @State private var errorMessage: String?
    @State private var searchTask: Task<Void, Never>?
    @State private var sharePayload: LibrarySharePayload?

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
                VStack(alignment: .leading, spacing: 18) {
                    searchStatusStrip

                    if !app.isOfflinePlaybackActive {
                        Picker("Zakres", selection: $scope) {
                            ForEach(SearchScope.allCases) { item in
                                Text(item.title).tag(item)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    if !trimmedQuery.isEmpty {
                        suggestionsSection
                    } else if !recentQueries.isEmpty {
                        recentSection
                    }

                    if isSearchingCatalog && effectiveScope == .catalog && !app.isOfflinePlaybackActive {
                        catalogLoadingStrip
                    }

                    resultsBody
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
                .animation(EOSMotion.soft, value: trimmedQuery)
                .animation(EOSMotion.soft, value: isSearchingCatalog)
            }
            .background(EOSAmbientBackground())
            .eosScrollClearance()
            .navigationTitle(app.isOfflinePlaybackActive ? "Szukaj · Offline" : "Szukaj")
            .searchable(
                text: $query,
                prompt: app.isOfflinePlaybackActive
                    ? "Szukaj w pobranych…"
                    : (scope == .library ? "W bibliotece, wykonawca, album…" : "Apple Music, wykonawca, album…")
            )
            .onSubmit(of: .search) {
                scheduleSearch(immediate: true)
                if let q = submittedQuery { SearchRecentStore.remember(q) }
            }
            .onChange(of: query) { _, _ in refreshInstantContent() }
            .onChange(of: scope) { _, _ in resetAndSearch() }
            .onChange(of: app.isOfflinePlaybackActive) { _, offline in
                if offline { scope = .library }
                resetAndSearch()
            }
            .onAppear { recentQueries = SearchRecentStore.load() }
            .sheet(item: $sharePayload) { payload in
                ActivityView(activityItems: payload.items)
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    // MARK: - Status & banners

    @ViewBuilder
    private var searchStatusStrip: some View {
        if app.isOfflinePlaybackActive {
            HStack(spacing: 8) {
                Image(systemName: "airplane")
                    .foregroundStyle(EOSTheme.statusOffline)
                Text("Offline · szukasz tylko w pobranych utworach")
                    .font(EOSTypography.caption)
                    .foregroundStyle(EOSTheme.textSecondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(EOSTheme.statusOffline.opacity(0.08), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        } else if !app.network.isOnline {
            HStack(spacing: 8) {
                Image(systemName: "wifi.slash")
                    .foregroundStyle(EOSTheme.accent)
                Text("Brak sieci · włącz Offline albo poczekaj na połączenie")
                    .font(EOSTypography.caption)
                    .foregroundStyle(EOSTheme.textSecondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(EOSTheme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        } else if isSearchingCatalog {
            HStack(spacing: 8) {
                ProgressView()
                    .controlSize(.small)
                Text("Szukam w Apple Music…")
                    .font(EOSTypography.caption)
                    .foregroundStyle(EOSTheme.textSecondary)
            }
            .transition(.opacity.combined(with: .move(edge: .top)))
        }
    }

    private var catalogLoadingStrip: some View {
        VStack(spacing: 6) {
            ProgressView()
                .tint(EOSTheme.accent)
            Text("Odświeżam katalog online…")
                .font(EOSTypography.caption)
                .foregroundStyle(EOSTheme.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }

    // MARK: - Suggestions & recent

    @ViewBuilder
    private var suggestionsSection: some View {
        if !instantSuggestions.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("PODPOWIEDZI")
                    .font(EOSTypography.sectionLabel)
                    .foregroundStyle(EOSTheme.textMuted)
                    .tracking(1.1)

                FlowSuggestionGrid(suggestions: instantSuggestions) { suggestion in
                    query = suggestion.title
                    scheduleSearch(immediate: true)
                }
            }
            .transition(.opacity.combined(with: .scale(scale: 0.98)))
        }
    }

    @ViewBuilder
    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("OSTATNIE")
                .font(EOSTypography.sectionLabel)
                .foregroundStyle(EOSTheme.textMuted)
                .tracking(1.1)

            FlowSuggestionGrid(
                suggestions: recentQueries.map {
                    SearchSuggestion(id: "recent-\($0)", title: $0, subtitle: nil, icon: "clock.arrow.circlepath", kind: .recent)
                }
            ) { suggestion in
                query = suggestion.title
                scheduleSearch(immediate: true)
            }
        }
    }

    // MARK: - Results

    @ViewBuilder
    private var resultsBody: some View {
        if hasResults {
            if effectiveScope == .catalog, let catalogResults, !app.isOfflinePlaybackActive {
                if !instantLibraryResults.isEmpty {
                    sectionHeader("W twojej bibliotece")
                    libraryContent(instantLibraryResults, compact: true)
                        .padding(.bottom, 8)
                }
                catalogContent(catalogResults)
            } else if effectiveScope == .library || app.isOfflinePlaybackActive {
                libraryContent(libraryResults, compact: false)
            }
        } else if submittedQuery != nil {
            ContentUnavailableView(
                "Brak wyników",
                systemImage: "magnifyingglass",
                description: Text("Spróbuj innej frazy dla „\(submittedQuery ?? "")”")
            )
            .padding(.top, 28)
        } else if trimmedQuery.isEmpty {
            ContentUnavailableView(
                scope == .catalog ? "Cała Muzyka" : "Moja Biblioteka",
                systemImage: scope == .catalog ? "music.note.list" : "books.vertical",
                description: Text(scope == .catalog
                    ? "Wpisz 2–3 litery — podpowiedzi i wyniki pojawią się od razu."
                    : "Szukaj w playlistach, wykonawcach, albumach i utworach.")
            )
            .padding(.top, 28)
        }
    }

    // MARK: - Catalog / library sections (unchanged structure, refined type)

    @ViewBuilder
    private func catalogContent(_ data: MusicCatalogSearchResponse) -> some View {
        if data.artists.isEmpty && data.albums.isEmpty && data.songs.isEmpty {
            if instantLibraryResults.isEmpty {
                ContentUnavailableView(
                    "Brak w Apple Music",
                    systemImage: "magnifyingglass",
                    description: Text("Spróbuj innej frazy.")
                )
                .frame(maxWidth: .infinity)
                .padding(.top, 16)
            }
        } else {
            if !data.artists.isEmpty {
                sectionHeader("Wykonawcy")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(data.artists) { artist in
                            NavigationLink {
                                ArtistBrowseDestination(artistId: artist.id, artistName: artist.name)
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
    private func libraryContent(_ data: LibrarySearchResults, compact: Bool) -> some View {
        if data.isEmpty && compact {
            EmptyView()
        } else if !data.playlists.isEmpty {
            sectionHeader("Playlisty")
            VStack(spacing: 0) {
                ForEach(Array(data.playlists.prefix(compact ? 4 : 12).enumerated()), id: \.element.id) { index, folder in
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
                                    .font(EOSTypography.bodySemibold)
                                    .foregroundStyle(EOSTheme.textPrimary)
                                    .lineLimit(1)
                                Text(folder.countLabel)
                                    .font(EOSTypography.caption)
                                    .foregroundStyle(EOSTheme.textSecondary)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(EOSTypography.captionBold)
                                .foregroundStyle(EOSTheme.textMuted)
                        }
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    if index < min(compact ? 3 : 11, data.playlists.count - 1) {
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
                ForEach(Array(data.artists.prefix(compact ? 4 : 12).enumerated()), id: \.element.id) { index, artist in
                    NavigationLink {
                        ArtistBrowseDestination(artistId: artist.artistId, artistName: artist.name)
                    } label: {
                        libraryArtistRow(artist)
                    }
                    .buttonStyle(.plain)
                    if index < min(compact ? 3 : 11, data.artists.count - 1) {
                        Divider().opacity(0.2)
                    }
                }
            }
            .padding(12)
            .eosCard()
        }

        if !data.albums.isEmpty && !compact {
            sectionHeader("Albumy")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 12)], spacing: 12) {
                ForEach(data.albums.prefix(12)) { album in
                    NavigationLink {
                        AlbumBrowseDestination(
                            albumId: album.albumId,
                            albumTitle: album.title,
                            artist: album.artist
                        )
                    } label: {
                        LibraryAlbumGridCell(group: album)
                    }
                    .buttonStyle(.plain)
                }
            }
        }

        if !data.songs.isEmpty {
            sectionHeader("Utwory")
            VStack(spacing: 0) {
                ForEach(Array(data.songs.prefix(compact ? 6 : 20).enumerated()), id: \.element.url) { index, track in
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
                    if index < min(compact ? 5 : 19, data.songs.count - 1) {
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
                .font(EOSTypography.bodySemibold)
                .foregroundStyle(EOSTheme.textPrimary)
            Spacer()
            Text("\(artist.trackCount)")
                .font(EOSTypography.caption)
                .foregroundStyle(EOSTheme.textSecondary)
            Image(systemName: "chevron.right")
                .font(EOSTypography.captionBold)
                .foregroundStyle(EOSTheme.textMuted)
        }
        .padding(.vertical, 8)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(EOSTypography.sectionLabel)
            .foregroundStyle(EOSTheme.textMuted)
            .tracking(1.2)
            .padding(.top, 4)
    }

    // MARK: - Search logic

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespaces)
    }

    private var submittedQuery: String? {
        trimmedQuery.count >= minQueryLength ? trimmedQuery : nil
    }

    private var minQueryLength: Int {
        effectiveScope == .library || app.isOfflinePlaybackActive ? 1 : 2
    }

    private var effectiveScope: SearchScope {
        app.isOfflinePlaybackActive ? .library : scope
    }

    private var instantLibraryResults: LibrarySearchResults {
        guard trimmedQuery.count >= 1 else { return .empty }
        return LibraryData.search(
            query: trimmedQuery,
            folders: app.libraryFoldersForBrowsing,
            tracks: app.libraryTracksForBrowsing
        )
    }

    private var hasResults: Bool {
        switch effectiveScope {
        case .catalog:
            if app.isOfflinePlaybackActive { return submittedQuery != nil && !libraryResults.isEmpty }
            return (catalogResults != nil && !(catalogResults?.artists.isEmpty == true && catalogResults?.albums.isEmpty == true && catalogResults?.songs.isEmpty == true))
                || !instantLibraryResults.isEmpty
        case .library:
            return submittedQuery != nil && !libraryResults.isEmpty
        }
    }

    private func resetAndSearch() {
        catalogResults = nil
        libraryResults = .empty
        scheduleSearch(immediate: true)
    }

    private func refreshInstantContent() {
        let q = trimmedQuery
        instantSuggestions = LibraryData.quickSuggestions(
            query: q,
            folders: app.libraryFoldersForBrowsing,
            tracks: app.libraryTracksForBrowsing
        )

        if q.count >= 1 {
            libraryResults = instantLibraryResults
        } else {
            libraryResults = .empty
            catalogResults = nil
        }

        scheduleSearch(immediate: false)
    }

    private func scheduleSearch(immediate: Bool) {
        searchTask?.cancel()
        let q = trimmedQuery
        guard q.count >= minQueryLength else {
            catalogResults = nil
            if q.isEmpty { libraryResults = .empty }
            isSearchingCatalog = false
            app.isCatalogSearching = false
            return
        }

        if effectiveScope == .library || app.isOfflinePlaybackActive {
            libraryResults = LibraryData.search(
                query: q,
                folders: app.libraryFoldersForBrowsing,
                tracks: app.libraryTracksForBrowsing
            )
            isSearchingCatalog = false
            app.isCatalogSearching = false
            return
        }

        searchTask = Task {
            if !immediate {
                try? await Task.sleep(nanoseconds: 220_000_000)
            }
            guard !Task.isCancelled else { return }
            await searchCatalog(query: q)
        }
    }

    private func searchCatalog(query: String) async {
        guard !app.isOfflinePlaybackActive, app.network.isOnline else {
            libraryResults = LibraryData.search(
                query: query,
                folders: app.libraryFoldersForBrowsing,
                tracks: app.libraryTracksForBrowsing
            )
            return
        }

        isSearchingCatalog = true
        app.isCatalogSearching = true
        defer {
            isSearchingCatalog = false
            app.isCatalogSearching = false
        }

        libraryResults = LibraryData.search(
            query: query,
            folders: app.libraryFoldersForBrowsing,
            tracks: app.libraryTracksForBrowsing
        )

        do {
            catalogResults = try await app.api.searchMusicCatalog(query: query)
            SearchRecentStore.remember(query)
            recentQueries = SearchRecentStore.load()
        } catch {
            if !Task.isCancelled {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func playLibraryTrack(_ track: MusicTrack, in queue: [MusicTrack]) async {
        guard let index = queue.firstIndex(where: { $0.url == track.url }) else { return }
        let folder = app.musicFolders.first(where: { $0.id == track.folderId })
        await app.playTracks(queue, startIndex: index, folder: folder)
    }
}

// MARK: - Suggestion chips

private struct FlowSuggestionGrid: View {
    let suggestions: [SearchSuggestion]
    var onSelect: (SearchSuggestion) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(suggestions) { item in
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onSelect(item)
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: item.icon)
                                .font(EOSTypography.captionBold)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(item.title)
                                    .font(EOSTypography.captionBold)
                                    .lineLimit(1)
                                if let subtitle = item.subtitle, !subtitle.isEmpty {
                                    Text(subtitle)
                                        .font(EOSTypography.microLabel)
                                        .foregroundStyle(EOSTheme.textMuted)
                                        .lineLimit(1)
                                }
                            }
                        }
                        .foregroundStyle(EOSTheme.textPrimary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.ultraThinMaterial, in: Capsule())
                        .overlay {
                            Capsule()
                                .stroke(EOSTheme.cardBorder.opacity(0.6), lineWidth: 0.5)
                        }
                    }
                    .buttonStyle(EOSPressableStyle())
                }
            }
            .padding(.vertical, 2)
        }
    }
}

private struct LibrarySharePayload: Identifiable {
    let id = UUID()
    let items: [Any]
}

private struct ArtistChip: View {
    let artist: MusicArtist

    var body: some View {
        VStack(spacing: 8) {
            ArtworkImage(url: artist.thumbnail.flatMap(URL.init(string:)), size: 72, cornerRadius: 36)
            Text(artist.name)
                .font(EOSTypography.captionBold)
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
                .font(EOSTypography.captionBold)
                .foregroundStyle(EOSTheme.textPrimary)
                .lineLimit(2)
            Text([album.artist, album.releaseYear].compactMap { $0 }.joined(separator: " · "))
                .font(EOSTypography.caption2Medium)
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
                .font(EOSTypography.captionBold)
                .foregroundStyle(EOSTheme.textPrimary)
                .lineLimit(2)
            Text([group.artist, "\(group.trackCount) utw."].compactMap { $0 }.joined(separator: " · "))
                .font(EOSTypography.caption2Medium)
                .foregroundStyle(EOSTheme.textSecondary)
                .lineLimit(1)
        }
    }
}

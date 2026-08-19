import SwiftUI

struct ArtistDetailView: View {
    @EnvironmentObject private var app: AppModel
    let artistId: String
    let artistName: String

    @State private var detail: MusicArtistDetailResponse?
    @State private var isLoading = true
    @State private var errorMessage: String?

    private let albumColumns = [GridItem(.adaptive(minimum: 140), spacing: 12)]

    private var libraryTracks: [MusicTrack] {
        app.libraryTracksForBrowsing.filter { track in
            if track.artistId == artistId { return true }
            return (track.artist ?? "").localizedCaseInsensitiveCompare(artistName) == .orderedSame
        }
    }

    private var libraryAlbums: [LibraryAlbumGroup] {
        LibraryData.albumGroups(from: libraryTracks)
    }

    private var displayedLibrarySongs: [MusicTrack] {
        Array(libraryTracks.sorted { lhs, rhs in
            lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }.prefix(12))
    }

    private var sortedAlbums: [MusicAlbum] {
        guard let detail else { return [] }
        return detail.albums.sorted { lhs, rhs in
            if lhs.isSingleRelease != rhs.isSingleRelease {
                return !lhs.isSingleRelease && rhs.isSingleRelease
            }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
    }

    private var onlineAlbums: [MusicAlbum] {
        sortedAlbums.filter { !albumIsInLibrary($0) }
    }

    private var onlineTopSongs: [SearchResultItem] {
        (detail?.topSongs ?? []).filter { !songIsInLibrary($0) }
    }

    var body: some View {
        Group {
            if app.isOfflinePlaybackActive {
                LibraryArtistSongsView(artistName: artistName, artistId: artistId)
            } else {
                catalogBody
            }
        }
    }

    private var catalogBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                artistHeader

                if !libraryAlbums.isEmpty {
                    libraryAlbumsSection
                }

                if !libraryTracks.isEmpty {
                    librarySongsSection
                }

                if isLoading && detail == nil {
                    EOSLoadingView(title: "Ładuję artystę…")
                        .padding(.top, 8)
                        .transition(.opacity.combined(with: .scale(scale: 0.985)))
                } else if detail != nil {
                    if !onlineAlbums.isEmpty {
                        albumGrid(title: libraryAlbums.isEmpty ? "Albumy" : "Więcej albumów", albums: onlineAlbums)
                    }

                    if !onlineTopSongs.isEmpty {
                        Text(libraryTracks.isEmpty ? "Popularne utwory" : "Więcej utworów")
                            .font(.headline)
                            .foregroundStyle(EOSTheme.textPrimary)
                        VStack(spacing: 0) {
                            ForEach(Array(onlineTopSongs.enumerated()), id: \.element.id) { index, song in
                                CatalogTrackRow(item: song, index: index, queue: onlineTopSongs)
                            }
                        }
                        .padding(12)
                        .eosCard()
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 40)
            .transition(.opacity.combined(with: .move(edge: .bottom)))
        }
        .animation(EOSMotion.snappy, value: isLoading)
        .animation(EOSMotion.snappy, value: libraryTracks.count)
        .background(EOSAmbientBackground())
        .eosScrollClearance()
        .navigationTitle(detail?.artist.name ?? artistName)
        .navigationBarTitleDisplayMode(.large)
        .task {
            guard !app.isOfflinePlaybackActive else { return }
            await load()
        }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var artistArtworkURL: URL? {
        var candidates: [String] = []
        if let thumbnail = detail?.artist.thumbnail, !thumbnail.isEmpty {
            candidates.append(thumbnail)
        }
        candidates.append(contentsOf: sortedAlbums.compactMap(\.thumbnail).filter { !$0.isEmpty })
        candidates.append(contentsOf: (detail?.topSongs ?? []).compactMap(\.thumbnail).filter { !$0.isEmpty })
        candidates.append(contentsOf: libraryTracks.compactMap(\.thumbnail).filter { !$0.isEmpty })
        return candidates.first.flatMap { URL(string: $0) }
    }

    private var artistHeader: some View {
        let subtitle = [
            detail?.artist.genre,
            libraryTracks.isEmpty ? nil : "\(libraryTracks.count) w bibliotece",
        ]
        .compactMap { $0 }
        .filter { !$0.isEmpty }
        .joined(separator: " · ")

        return LibraryEntityHeader(
            title: detail?.artist.name ?? artistName,
            subtitle: subtitle.isEmpty ? nil : subtitle,
            artworkURL: artistArtworkURL
        )
    }

    private var libraryAlbumsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("W bibliotece")
                .font(.headline)
                .foregroundStyle(EOSTheme.textPrimary)
            LazyVGrid(columns: albumColumns, spacing: 12) {
                ForEach(libraryAlbums) { group in
                    NavigationLink {
                        AlbumBrowseDestination(
                            albumId: group.albumId,
                            albumTitle: group.title,
                            artist: group.artist ?? artistName
                        )
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            ArtworkImage(url: group.artworkURL, size: 140, cornerRadius: 10)
                            Text(group.title)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(EOSTheme.textPrimary)
                                .lineLimit(2)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var librarySongsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Utwory w bibliotece")
                .font(.headline)
                .foregroundStyle(EOSTheme.textPrimary)

            VStack(spacing: 0) {
                ForEach(Array(displayedLibrarySongs.enumerated()), id: \.element.url) { index, track in
                    HStack(spacing: 6) {
                        Button {
                            Task { await playLibrary(at: index) }
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
                }
            }
            .padding(12)
            .eosCard()

            if libraryTracks.count > displayedLibrarySongs.count {
                NavigationLink {
                    LibraryArtistSongsView(artistName: artistName, artistId: artistId)
                } label: {
                    Text("Wszystkie \(libraryTracks.count) utworów")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(EOSTheme.accent)
                }
            }
        }
    }

    private func albumGrid(title: String, albums: [MusicAlbum]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .foregroundStyle(EOSTheme.textPrimary)
            LazyVGrid(columns: albumColumns, spacing: 12) {
                ForEach(albums) { album in
                    NavigationLink {
                        AlbumBrowseDestination(
                            albumId: album.id,
                            albumTitle: album.title,
                            artist: album.artist ?? detail?.artist.name ?? artistName
                        )
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            ArtworkImage(url: album.thumbnail.flatMap(URL.init(string:)), size: 140, cornerRadius: 10)
                            Text(album.title)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(EOSTheme.textPrimary)
                                .lineLimit(2)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func albumIsInLibrary(_ album: MusicAlbum) -> Bool {
        libraryAlbums.contains { group in
            if let groupId = group.albumId, groupId == album.id { return true }
            let sameTitle = group.title.localizedCaseInsensitiveCompare(album.title) == .orderedSame
            let sameArtist = (group.artist ?? artistName)
                .localizedCaseInsensitiveCompare(album.artist ?? artistName) == .orderedSame
            return sameTitle && sameArtist
        }
    }

    private func songIsInLibrary(_ song: SearchResultItem) -> Bool {
        libraryTracks.contains { track in
            if track.url == song.url { return true }
            let sameTitle = track.title.localizedCaseInsensitiveCompare(song.title) == .orderedSame
            let sameArtist = (track.artist ?? artistName)
                .localizedCaseInsensitiveCompare(song.uploader ?? artistName) == .orderedSame
            return sameTitle && sameArtist
        }
    }

    private func playLibrary(at index: Int) async {
        let queue = displayedLibrarySongs
        guard queue.indices.contains(index) else { return }
        let folder = app.musicFolders.first(where: { $0.id == queue[index].folderId })
        await app.playTracks(queue, startIndex: index, folder: folder)
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            detail = try await app.api.fetchMusicArtist(id: artistId)
        } catch {
            if libraryTracks.isEmpty {
                errorMessage = error.localizedDescription
            }
        }
    }
}

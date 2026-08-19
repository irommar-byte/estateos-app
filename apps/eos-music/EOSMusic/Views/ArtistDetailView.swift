import SwiftUI

struct ArtistDetailView: View {
    @EnvironmentObject private var app: AppModel
    let artistId: String
    let artistName: String

    @State private var detail: MusicArtistDetailResponse?
    @State private var isLoading = true
    @State private var errorMessage: String?

    private let albumColumns = [GridItem(.adaptive(minimum: 140), spacing: 12)]
    private var sortedAlbums: [MusicAlbum] {
        guard let detail else { return [] }
        return detail.albums.sorted { lhs, rhs in
            if lhs.isSingleRelease != rhs.isSingleRelease {
                return !lhs.isSingleRelease && rhs.isSingleRelease
            }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
    }

    var body: some View {
        Group {
            if app.isOfflinePlaybackActive {
                // Catalog artist page is online-only; offline users land on local songs.
                LibraryArtistSongsView(artistName: artistName)
            } else {
                catalogBody
            }
        }
    }

    private var catalogBody: some View {
        ScrollView {
            if isLoading {
                EOSLoadingView(title: "Ładuję artystę…")
                    .padding(.top, 40)
                    .transition(.opacity.combined(with: .scale(scale: 0.985)))
            } else if let detail {
                VStack(alignment: .leading, spacing: 24) {
                    // Artist header with artwork
                    let artistArtworkURL: URL? = ([detail.artist.thumbnail]
                        + sortedAlbums.compactMap { $0.thumbnail }
                        + detail.topSongs.compactMap { $0.thumbnail }
                    ).first(where: { !($0?.isEmpty ?? true) })
                     .flatMap { $0 }
                     .flatMap(URL.init(string:))
                    LibraryEntityHeader(
                        title: detail.artist.name,
                        subtitle: detail.artist.genre,
                        artworkURL: artistArtworkURL
                    )

                    if !sortedAlbums.isEmpty {
                        Text("Albumy")
                            .font(.headline)
                            .foregroundStyle(EOSTheme.textPrimary)
                        LazyVGrid(columns: albumColumns, spacing: 12) {
                            ForEach(sortedAlbums) { album in
                                NavigationLink {
                                    AlbumBrowseDestination(
                                        albumId: album.id,
                                        albumTitle: album.title,
                                        artist: album.artist ?? detail.artist.name
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

                    if !detail.topSongs.isEmpty {
                        Text("Popularne utwory")
                            .font(.headline)
                            .foregroundStyle(EOSTheme.textPrimary)
                        VStack(spacing: 0) {
                            ForEach(Array(detail.topSongs.enumerated()), id: \.element.id) { index, song in
                                CatalogTrackRow(item: song, index: index, queue: detail.topSongs)
                            }
                        }
                        .padding(12)
                        .eosCard()
                    }
                }
                .padding(16)
                .padding(.bottom, 40)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .animation(EOSMotion.snappy, value: isLoading)
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

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            detail = try await app.api.fetchMusicArtist(id: artistId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

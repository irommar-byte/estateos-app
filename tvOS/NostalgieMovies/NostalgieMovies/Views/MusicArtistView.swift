import SwiftUI

struct MusicArtistView: View {
    @EnvironmentObject private var app: AppModel
    let artist: MusicArtist
    let onBack: () -> Void
    var onAlbum: (MusicAlbum) -> Void
    var onTrack: (MusicSelection, [MusicPlaybackTrack]) -> Void

    var onOpenFolder: ((MusicFolder, Bool) -> Void)? = nil

    @State private var detail: MusicArtistDetailResponse?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var browseAlbum: MusicAlbum?

    var body: some View {
        Group {
            if let album = browseAlbum {
                MusicAlbumView(
                    album: album,
                    onBack: { browseAlbum = nil },
                    onTrack: onTrack,
                    onOpenFolder: { folder, startBatch in
                        browseAlbum = nil
                        onOpenFolder?(folder, startBatch)
                    }
                )
                .environmentObject(app)
            } else {
                ZStack(alignment: .bottomLeading) {
                    MusicHeroBackdrop(imageURL: heroImageURL)

                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 28) {
                            header
                            content
                        }
                        .padding(.horizontal, NostalgieSpacing.screenH)
                        .padding(.bottom, NostalgieSpacing.scrollBottom)
                    }
                }
                .task { await load() }
                .onExitCommand(perform: onBack)
            }
        }
    }

    private var heroImageURL: URL? {
        (detail?.albums.first?.thumbnail ?? artist.thumbnail).flatMap(URL.init(string:))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: onBack) {
                Label("Wróć", systemImage: "chevron.left")
            }
            .buttonStyle(BackLinkButtonStyle())

            HStack(alignment: .center, spacing: 14) {
                artistAvatar(size: 72)

                VStack(alignment: .leading, spacing: 4) {
                    ScreenTitle(
                        title: detail?.artist.name ?? artist.name,
                        subtitle: detail?.artist.genre ?? artist.genre,
                        level: .detail
                    )
                    if let count = detail?.albums.count, count > 0 {
                        Text("\(count) albumów")
                            .font(NostalgieFont.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func artistAvatar(size: CGFloat) -> some View {
        let artistData = detail?.artist ?? artist
        if let url = artistData.thumbnail.flatMap(URL.init(string:)) {
            PosterRemoteImage(url: url)
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(Circle())
                .overlay { Circle().stroke(Color.white.opacity(0.12), lineWidth: 1) }
        } else {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [NostalgieTheme.accent.opacity(0.5), NostalgieTheme.accentSecondary.opacity(0.4)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)
                .overlay {
                    Image(systemName: "person.fill")
                        .font(NostalgieFont.rounded(size * 0.34))
                        .foregroundStyle(.white.opacity(0.85))
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView("Wczytuję katalog wykonawcy…")
        } else if let errorMessage {
            EmptyStateView(icon: "person.crop.circle.badge.exclamationmark", title: "Błąd", message: errorMessage)
        } else if let detail {
            if !detail.topSongs.isEmpty {
                MusicSectionHeader(title: "Popularne utwory", subtitle: "Pełny utwór MP3 · odtwórz lub pobierz")
                LazyVStack(spacing: NostalgieSpacing.listRow) {
                    ForEach(Array(detail.topSongs.prefix(12).enumerated()), id: \.element.id) { index, song in
                        MusicTrackRow(
                            index: index + 1,
                            title: song.title,
                            subtitle: song.album ?? "",
                            duration: song.duration,
                            showsPlayHint: true
                        ) {
                            let context = detail.topSongs.map { MusicPlaybackTrack(from: MusicSelection(from: $0)) }
                            onTrack(MusicSelection(from: song), context)
                        }
                    }
                }
            }

            if !detail.albums.isEmpty {
                MusicSectionHeader(title: "Albumy", subtitle: "Wszystkie wydania w Apple Music")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 24) {
                        ForEach(detail.albums) { album in
                            MusicAlbumTile(album: album, size: 168) {
                                browseAlbum = album
                            }
                        }
                    }
                    .padding(.vertical, 10)
                }
                .fullBleedShelf()
            }
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            detail = try await app.api.fetchMusicArtist(id: artist.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

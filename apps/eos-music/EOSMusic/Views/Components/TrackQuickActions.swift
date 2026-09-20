import SwiftUI

struct TrackQuickActionItem {
    let url: String
    let title: String
    let artist: String?
    let album: String?
    let albumId: String?
    let artistId: String?
    let payload: MusicTrackPayload
    let folderId: String?
    let playbackTrack: MusicPlaybackTrack
    let favoriteItem: FavoriteItem

    init(track: MusicTrack) {
        url = track.url
        title = track.title
        artist = track.artist
        album = track.album
        albumId = track.albumId
        artistId = track.artistId
        payload = track.payload
        folderId = track.folderId
        playbackTrack = MusicPlaybackTrack(from: track)
        favoriteItem = track.favoriteItem
    }

    init(item: SearchResultItem, folderId: String? = nil) {
        url = item.url
        title = item.title
        artist = item.uploader ?? item.detail
        album = item.album
        albumId = item.albumId
        artistId = item.artistId
        payload = item.payload
        self.folderId = folderId
        playbackTrack = MusicPlaybackTrack(from: item, folderId: folderId)
        favoriteItem = item.favoriteItem
    }

    init(track: MusicPlaybackTrack) {
        url = track.url
        title = track.title
        artist = track.artist
        album = track.album
        albumId = track.albumId
        artistId = track.artistId
        payload = track.payload
        folderId = track.folderId
        playbackTrack = track
        favoriteItem = track.favoriteItem
    }

    init(favorite: FavoriteItem, libraryTrack: MusicTrack? = nil) {
        url = favorite.url
        title = favorite.title
        artist = favorite.detail
        album = libraryTrack?.album
        albumId = libraryTrack?.albumId
        artistId = libraryTrack?.artistId
        payload = libraryTrack?.payload ?? MusicTrackPayload(
            url: favorite.url,
            title: favorite.title,
            artist: favorite.detail,
            album: nil,
            thumbnail: favorite.thumbnail,
            duration: favorite.duration,
            quality: "320 kbps",
            source: "apple-music",
            artistId: nil,
            albumId: nil
        )
        folderId = libraryTrack?.folderId
        playbackTrack = libraryTrack.map { MusicPlaybackTrack(from: $0) }
            ?? MusicPlaybackTrack(from: favorite)
        favoriteItem = favorite
    }
}

struct TrackQuickActionsModifier: ViewModifier {
    @EnvironmentObject private var app: AppModel
    let item: TrackQuickActionItem
    var play: (() -> Void)?
    var removeFromPlaylist: (() -> Void)?
    var removeFromQueue: (() -> Void)?
    var showsSwipe: Bool = true

    @State private var showAddToPlaylist = false
    @State private var sharePayload: SharePayload?

    func body(content: Content) -> some View {
        content
            .contextMenu { menu }
            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                if showsSwipe {
                    Button {
                        Task { await app.toggleFavorite(item.favoriteItem) }
                    } label: {
                        Label(
                            app.isFavorite(item.url) ? "Ulubione" : "Ulubione",
                            systemImage: app.isFavorite(item.url) ? "heart.slash" : "heart"
                        )
                    }
                    .tint(EOSTheme.accent)
                    Button {
                        showAddToPlaylist = true
                    } label: {
                        Label("Dodaj", systemImage: "text.badge.plus")
                    }
                    .tint(.indigo)
                }
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                if showsSwipe {
                    if let removeFromQueue {
                        Button(role: .destructive, action: removeFromQueue) {
                            Label("Usuń z kolejki", systemImage: "minus.circle")
                        }
                    } else if let removeFromPlaylist {
                        Button(role: .destructive, action: removeFromPlaylist) {
                            Label("Usuń", systemImage: "minus.circle")
                        }
                    }
                }
            }
            .sheet(isPresented: $showAddToPlaylist) {
                AddToPlaylistSheet(track: item.payload, trackTitle: item.title)
                    .environmentObject(app)
            }
            .sheet(item: $sharePayload) { payload in
                ActivityView(activityItems: payload.items)
            }
    }

    @ViewBuilder
    private var menu: some View {
        Button {
            if let play {
                play()
            }
        } label: {
            Label("Odtwórz", systemImage: "play.fill")
        }

        Button {
            app.playNext([item.playbackTrack])
        } label: {
            Label("Odtwórz jako następny", systemImage: "text.line.first.and.arrowtriangle.forward")
        }

        Button {
            app.playLater([item.playbackTrack])
        } label: {
            Label("Na później", systemImage: "text.badge.plus")
        }

        Button {
            showAddToPlaylist = true
        } label: {
            Label("Dodaj do playlisty", systemImage: "text.badge.plus")
        }

        Button {
            Task { await app.toggleFavorite(item.favoriteItem) }
        } label: {
            Label(
                app.isFavorite(item.url) ? "Usuń z ulubionych" : "Dodaj do ulubionych",
                systemImage: app.isFavorite(item.url) ? "heart.slash" : "heart"
            )
        }

        if let albumId = item.albumId, !albumId.isEmpty {
            NavigationLink {
                AlbumBrowseDestination(albumId: albumId, albumTitle: item.album, artist: item.artist)
            } label: {
                Label("Pokaż album", systemImage: "square.stack")
            }
        } else if let album = item.album, !album.isEmpty {
            NavigationLink {
                LibraryAlbumSongsView(albumTitle: album, artist: item.artist)
            } label: {
                Label("Pokaż album", systemImage: "square.stack")
            }
        }

        if let artistId = item.artistId, !artistId.isEmpty {
            NavigationLink {
                ArtistBrowseDestination(artistId: artistId, artistName: item.artist ?? "Wykonawca")
            } label: {
                Label("Pokaż wykonawcę", systemImage: "person.crop.square")
            }
        } else if let artist = item.artist, !artist.isEmpty {
            NavigationLink {
                LibraryArtistSongsView(artistName: artist)
            } label: {
                Label("Pokaż wykonawcę", systemImage: "person.crop.square")
            }
        }

        if app.isOfflineAvailable(item.url) {
            Button(role: .destructive) {
                app.removeOfflineDownload(for: item.url)
            } label: {
                Label("Usuń z iPhone’a", systemImage: "iphone.slash")
            }
        } else {
            Button {
                if let track = app.musicTracks.first(where: { $0.url == item.url }) {
                    app.downloadTrack(track, folderId: item.folderId ?? track.folderId)
                } else {
                    app.queuePlus(item.payload)
                }
            } label: {
                Label("Pobierz", systemImage: "arrow.down.circle")
            }
        }

        Button {
            sharePayload = .text(shareText)
        } label: {
            Label("Udostępnij", systemImage: "square.and.arrow.up")
        }

        if let local = OfflineMusicStore.shared.localURL(for: item.url) {
            Button {
                sharePayload = .file(local)
            } label: {
                Label("Wyślij plik", systemImage: "paperplane")
            }
        }

        if let removeFromPlaylist {
            Divider()
            Button(role: .destructive, action: removeFromPlaylist) {
                Label("Usuń z playlisty", systemImage: "minus.circle")
            }
        }

        if let removeFromQueue {
            Divider()
            Button(role: .destructive, action: removeFromQueue) {
                Label("Usuń z kolejki", systemImage: "minus.circle")
            }
        }
    }

    private var shareText: String {
        if let artist = item.artist, !artist.isEmpty {
            return "\(item.title) — \(artist)"
        }
        return item.title
    }
}

extension View {
    func trackQuickActions(
        _ item: TrackQuickActionItem,
        play: (() -> Void)? = nil,
        removeFromPlaylist: (() -> Void)? = nil,
        removeFromQueue: (() -> Void)? = nil,
        showsSwipe: Bool = true
    ) -> some View {
        modifier(TrackQuickActionsModifier(
            item: item,
            play: play,
            removeFromPlaylist: removeFromPlaylist,
            removeFromQueue: removeFromQueue,
            showsSwipe: showsSwipe
        ))
    }
}

private struct SharePayload: Identifiable {
    let id = UUID()
    let items: [Any]
    static func file(_ url: URL) -> SharePayload { SharePayload(items: [url]) }
    static func text(_ string: String) -> SharePayload { SharePayload(items: [string]) }
}

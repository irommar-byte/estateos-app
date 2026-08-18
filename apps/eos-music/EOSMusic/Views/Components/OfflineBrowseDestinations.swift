import SwiftUI

/// Routes artist navigation to local songs when offline, catalog when online.
struct ArtistBrowseDestination: View {
    @EnvironmentObject private var app: AppModel
    let artistId: String?
    let artistName: String

    var body: some View {
        if app.isOfflinePlaybackActive || artistId?.isEmpty != false {
            LibraryArtistSongsView(artistName: artistName)
        } else {
            ArtistDetailView(artistId: artistId!, artistName: artistName)
        }
    }
}

/// Routes album navigation to local track list when offline, catalog when online.
struct AlbumBrowseDestination: View {
    @EnvironmentObject private var app: AppModel
    let albumId: String?
    let albumTitle: String?
    let artist: String?

    var body: some View {
        if app.isOfflinePlaybackActive {
            offlineAlbumView
        } else if let albumId, !albumId.isEmpty {
            AlbumDetailView(albumId: albumId)
        } else if let albumTitle, !albumTitle.isEmpty {
            LibraryAlbumSongsView(albumTitle: albumTitle, artist: artist)
        } else {
            offlineUnavailable
        }
    }

    @ViewBuilder
    private var offlineAlbumView: some View {
        if let title = resolvedAlbumTitle, !title.isEmpty {
            LibraryAlbumSongsView(albumTitle: title, artist: resolvedArtist)
        } else {
            offlineUnavailable
        }
    }

    private var offlineUnavailable: some View {
        ContentUnavailableView(
            "Album niedostępny offline",
            systemImage: "airplane",
            description: Text("Ten album nie jest pobrany na urządzenie.")
        )
        .navigationTitle(albumTitle ?? "Album")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var resolvedAlbumTitle: String? {
        if let albumTitle, !albumTitle.isEmpty { return albumTitle }
        guard let albumId, !albumId.isEmpty else { return nil }
        return app.libraryTracksForBrowsing.first(where: { $0.albumId == albumId })?.album
    }

    private var resolvedArtist: String? {
        if let artist, !artist.isEmpty { return artist }
        guard let albumId, !albumId.isEmpty else { return nil }
        return app.libraryTracksForBrowsing.first(where: { $0.albumId == albumId })?.artist
    }
}

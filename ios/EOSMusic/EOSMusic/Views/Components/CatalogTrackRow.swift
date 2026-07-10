import SwiftUI

struct CatalogTrackRow: View {
    @EnvironmentObject private var app: AppModel
    let item: SearchResultItem
    let index: Int
    let queue: [SearchResultItem]
    @State private var showAddToPlaylist = false

    var body: some View {
        HStack(spacing: 8) {
            Button {
                Task { await app.playCatalogItems(queue, startIndex: index) }
            } label: {
                TrackRowView(
                    index: index + 1,
                    title: item.title,
                    subtitle: item.uploader ?? item.detail,
                    duration: item.duration,
                    artworkURL: item.thumbnail.flatMap(URL.init(string:)),
                    isPlaying: app.playback.engine?.currentTrack?.url == item.url
                )
            }
            .buttonStyle(.plain)

            FavoriteButton(item: item.favoriteItem, size: 16)
                .frame(width: 28)

            Button {
                showAddToPlaylist = true
            } label: {
                Image(systemName: "text.badge.plus")
                    .font(.body)
                    .foregroundStyle(EOSTheme.textSecondary)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
        }
        .contextMenu {
            Button {
                Task { await app.toggleFavorite(item.favoriteItem) }
            } label: {
                Label(
                    app.isFavorite(item.url) ? "Usuń z ulubionych" : "Dodaj do ulubionych",
                    systemImage: app.isFavorite(item.url) ? "heart.slash" : "heart"
                )
            }
            Button {
                showAddToPlaylist = true
            } label: {
                Label("Dodaj do playlisty", systemImage: "text.badge.plus")
            }
        }
        .sheet(isPresented: $showAddToPlaylist) {
            AddToPlaylistSheet(track: item.payload, trackTitle: item.title)
                .environmentObject(app)
        }
    }
}

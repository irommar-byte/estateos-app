import SwiftUI
import UIKit

struct CatalogTrackRow: View {
    @EnvironmentObject private var app: AppModel
    let item: SearchResultItem
    let index: Int
    let queue: [SearchResultItem]
    @State private var showAddToPlaylist = false
    @State private var sharePayload: SharePayload?
    @State private var rowError: String?

    private var inLibrary: Bool { app.isInLibrary(item.url) }
    private var libraryTrack: MusicTrack? { app.musicTracks.first(where: { $0.url == item.url }) }
    private var localFileURL: URL? { OfflineMusicStore.shared.localURL(for: item.url) }
    private var cloudState: TrackDownloadUIState {
        app.downloads.uiState(
            for: item.url,
            isOnServer: app.isOnServer(item.url)
        )
    }

    var body: some View {
        HStack(spacing: 6) {
            Button {
                Task { await app.playCatalogItems(queue, startIndex: index) }
            } label: {
                TrackRowView(
                    index: index + 1,
                    title: item.title,
                    subtitle: item.uploader ?? item.detail,
                    duration: item.duration,
                    artworkURL: item.thumbnail.flatMap(URL.init(string:)),
                    isPlaying: app.playback.engine?.currentTrack?.url == item.url,
                    downloadState: cloudState
                )
            }
            .buttonStyle(.plain)

            FavoriteButton(item: item.favoriteItem, size: 16)
                .frame(width: 28)

            TrackStorageActionButton(
                track: item.payload,
                folderId: libraryTrack?.folderId
            )
        }
        .trackQuickActions(
            TrackQuickActionItem(item: item, folderId: libraryTrack?.folderId),
            play: { Task { await app.playCatalogItems(queue, startIndex: index) } }
        )
        .sheet(isPresented: $showAddToPlaylist) {
            AddToPlaylistSheet(track: item.payload, trackTitle: item.title)
                .environmentObject(app)
        }
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: payload.items)
        }
        .alert("Błąd", isPresented: Binding(get: { rowError != nil }, set: { if !$0 { rowError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(rowError ?? "")
        }
    }

    private var shareText: String {
        let artist = item.uploader ?? item.detail
        if let artist, !artist.isEmpty {
            return "\(item.title) — \(artist)"
        }
        return item.title
    }
}

private struct SharePayload: Identifiable {
    let id = UUID()
    let items: [Any]

    static func file(_ url: URL) -> SharePayload { SharePayload(items: [url]) }
    static func text(_ string: String) -> SharePayload { SharePayload(items: [string]) }
}

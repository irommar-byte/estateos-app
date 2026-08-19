import SwiftUI
import UIKit

struct CatalogTrackRow: View {
    @EnvironmentObject private var app: AppModel
    let item: SearchResultItem
    let index: Int
    let queue: [SearchResultItem]
    @State private var showAddToPlaylist = false
    @State private var isAddingToLibrary = false
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
        .contextMenu {
            Button {
                Task { await app.playCatalogItems(queue, startIndex: index) }
            } label: {
                Label("Odtwórz", systemImage: "play.fill")
            }

            Button {
                Task { await app.toggleFavorite(item.favoriteItem) }
            } label: {
                Label(
                    app.isFavorite(item.url) ? "Usuń z ulubionych" : "Dodaj do ulubionych",
                    systemImage: app.isFavorite(item.url) ? "heart.slash" : "heart"
                )
            }

            if app.isOnServer(item.url) {
                Label("Na serwerze EOS", systemImage: "checkmark.icloud.fill")
            } else {
                Button {
                    Task { await addToLibrary() }
                } label: {
                    Label("Dodaj na serwer EOS", systemImage: "plus")
                }
            }

            Button {
                showAddToPlaylist = true
            } label: {
                Label("Dodaj do playlisty", systemImage: "text.badge.plus")
            }

            Button {
                sharePayload = .text(shareText)
            } label: {
                Label("Udostępnij", systemImage: "square.and.arrow.up")
            }

            if let localFileURL {
                Button {
                    sharePayload = .file(localFileURL)
                } label: {
                    Label("Wyślij plik", systemImage: "paperplane")
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

    private func addToLibrary() async {
        guard !app.isOnServer(item.url) else { return }
        isAddingToLibrary = true
        defer { isAddingToLibrary = false }
        do {
            try await app.addToLibrary(item.payload)
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } catch {
            rowError = error.localizedDescription
        }
    }
}

private struct SharePayload: Identifiable {
    let id = UUID()
    let items: [Any]

    static func file(_ url: URL) -> SharePayload { SharePayload(items: [url]) }
    static func text(_ string: String) -> SharePayload { SharePayload(items: [string]) }
}

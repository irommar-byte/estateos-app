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
    private var localFileURL: URL? { OfflineMusicStore.shared.localURL(for: item.url) }

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
                    downloadState: app.downloads.uiState(
                        for: item.url,
                        isDownloaded: app.isOfflineAvailable(item.url)
                    )
                )
            }
            .buttonStyle(.plain)

            FavoriteButton(item: item.favoriteItem, size: 16)
                .frame(width: 28)

            libraryAddButton
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

            if inLibrary {
                Label("W bibliotece", systemImage: "checkmark.circle.fill")
            } else {
                Button {
                    Task { await addToLibrary() }
                } label: {
                    Label("Dodaj do biblioteki", systemImage: "plus")
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

    @ViewBuilder
    private var libraryAddButton: some View {
        Button {
            Task { await addToLibrary() }
        } label: {
            Group {
                if isAddingToLibrary {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: inLibrary ? "checkmark.circle.fill" : "plus.circle.fill")
                        .font(.title3)
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(inLibrary ? LibraryAccent.icon : Color.secondary)
                }
            }
            .frame(width: 34, height: 34)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(inLibrary || isAddingToLibrary)
        .accessibilityLabel(inLibrary ? "W bibliotece" : "Dodaj do biblioteki")
    }

    private func addToLibrary() async {
        guard !inLibrary else { return }
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

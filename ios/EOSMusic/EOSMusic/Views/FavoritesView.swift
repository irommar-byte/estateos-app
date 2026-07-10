import SwiftUI

struct FavoritesView: View {
    @EnvironmentObject private var app: AppModel
    @State private var isLoading = true
    @State private var errorMessage: String?

    private var musicFavorites: [FavoriteItem] {
        app.favoriteItems.filter { $0.type == "music" }
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Wczytuję ulubione…")
            } else if musicFavorites.isEmpty {
                ContentUnavailableView(
                    "Brak ulubionych",
                    systemImage: "heart",
                    description: Text("Dotknij serduszka przy utworze, aby dodać go tutaj.")
                )
            } else {
                List {
                    Section("\(musicFavorites.count) utworów") {
                        ForEach(Array(musicFavorites.enumerated()), id: \.element.id) { index, item in
                            HStack(spacing: 8) {
                                Button {
                                    Task { await play(from: index) }
                                } label: {
                                    TrackRowView(
                                        index: index + 1,
                                        title: item.title,
                                        subtitle: item.detail,
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

                                FavoriteButton(item: item, size: 18)
                                    .frame(width: 32)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .background(EOSAmbientBackground())
        .navigationTitle("Ulubione")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
        .refreshable { await load() }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func load() async {
        isLoading = musicFavorites.isEmpty
        defer { isLoading = false }
        do {
            try await app.refreshFavorites()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func play(from index: Int) async {
        let items = musicFavorites.map { fav -> SearchResultItem in
            SearchResultItem(
                title: fav.title,
                url: fav.url,
                thumbnail: fav.thumbnail,
                detail: fav.detail,
                source: fav.source,
                uploader: fav.detail,
                album: nil,
                duration: fav.duration,
                artistId: nil,
                albumId: nil,
                trackNumber: nil
            )
        }
        await app.playCatalogItems(items, startIndex: index)
    }
}

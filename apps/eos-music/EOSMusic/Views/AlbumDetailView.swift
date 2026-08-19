import SwiftUI

struct AlbumDetailView: View {
    @EnvironmentObject private var app: AppModel
    let albumId: String

    @State private var detail: MusicAlbumDetailResponse?
    @State private var isLoading = true
    @State private var isAddingAlbum = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        Group {
            if app.isOfflinePlaybackActive {
                AlbumBrowseDestination(albumId: albumId, albumTitle: nil, artist: nil)
            } else {
                catalogBody
            }
        }
    }

    private var catalogBody: some View {
        Group {
            if isLoading {
                EOSLoadingView(title: "Ładuję album…")
                    .transition(.opacity.combined(with: .scale(scale: 0.985)))
            } else if let detail {
                List {
                    Section {
                        LibraryEntityHeader(
                            title: detail.album.title,
                            subtitle: [
                                detail.album.artist,
                                detail.album.releaseYear,
                                "\(detail.tracks.count) utworów",
                            ]
                            .compactMap { $0 }
                            .filter { !$0.isEmpty }
                            .joined(separator: " · "),
                            // Brak okładki albumu → użyj okładki pierwszego utworu.
                            artworkURL: ([detail.album.thumbnail]
                                + detail.tracks.compactMap { $0.thumbnail }
                            )
                            .first(where: { !($0?.isEmpty ?? true) })
                            .flatMap { $0 }
                            .flatMap(URL.init(string:))
                        )

                        if let artist = detail.album.artist, !artist.isEmpty,
                           let artistId = detail.album.artistId, !artistId.isEmpty {
                            NavigationLink {
                                ArtistBrowseDestination(artistId: artistId, artistName: artist)
                            } label: {
                                Label(artist, systemImage: "person.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(EOSTheme.accent)
                            }
                        }

                        Button {
                            Task { await app.playCatalogItems(detail.tracks, startIndex: 0) }
                        } label: {
                            Label("Odtwórz album", systemImage: "play.fill")
                                .font(.headline)
                                .foregroundStyle(EOSTheme.accent)
                        }

                        Button {
                            Task { await addAlbumToLibrary(detail) }
                        } label: {
                            HStack {
                                Label("Dodaj album do biblioteki", systemImage: "text.badge.plus")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(EOSTheme.accentSecondary)
                                Spacer()
                                if isAddingAlbum {
                                    ProgressView()
                                        .controlSize(.small)
                                } else if let queue = app.downloads.bulkServerQueue, queue.label == detail.album.title {
                                    Text("\(queue.completed)/\(queue.total)")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(EOSTheme.accent)
                                }
                            }
                        }
                        .disabled(isAddingAlbum || detail.tracks.isEmpty)

                        if let queue = app.downloads.bulkServerQueue, queue.label == detail.album.title {
                            ServerDownloadQueuePanel(
                                queue: queue,
                                isMinimized: Binding(
                                    get: { app.downloads.isBulkQueueMinimized },
                                    set: { app.downloads.isBulkQueueMinimized = $0 }
                                )
                            ) {
                                app.cancelBulkMusicQueue()
                            }
                        }
                    }
                    .listRowBackground(Color.clear)

                    Section("\(detail.tracks.count) utworów") {
                        ForEach(Array(detail.tracks.enumerated()), id: \.element.id) { index, track in
                            CatalogTrackRow(item: track, index: index, queue: detail.tracks)
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .eosScrollClearance()
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .animation(EOSMotion.snappy, value: isLoading)
        .background(EOSAmbientBackground())
        .navigationTitle(detail?.album.title ?? "Album")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard !app.isOfflinePlaybackActive else { return }
            await load()
        }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .alert("Biblioteka", isPresented: Binding(get: { successMessage != nil }, set: { if !$0 { successMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(successMessage ?? "")
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            detail = try await app.api.fetchMusicAlbum(id: albumId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func addAlbumToLibrary(_ detail: MusicAlbumDetailResponse) async {
        guard !detail.tracks.isEmpty else { return }
        isAddingAlbum = true
        defer { isAddingAlbum = false }
        do {
            _ = try await app.addAlbumToLibrary(
                albumTitle: detail.album.title,
                tracks: detail.tracks.map(\.payload)
            )
            successMessage = "Dodano „\(detail.album.title)” — utwory trafiają na serwer EOS po kolei."
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

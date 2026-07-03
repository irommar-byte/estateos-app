import SwiftUI

struct MusicFolderView: View {
    @EnvironmentObject private var app: AppModel
    let folder: MusicFolder
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    let onBack: () -> Void

    @State private var tracks: [MusicTrack] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedTrack: MusicSelection?
    @State private var downloadJob: DownloadJobState?
    @State private var downloadTitle = ""
    @FocusState private var focusedTrackID: String?

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 22) {
                header

                if isLoading {
                    ProgressView("Wczytuję utwory…")
                } else if let errorMessage {
                    EmptyStateView(icon: "exclamationmark.folder", title: "Błąd", message: errorMessage)
                } else if tracks.isEmpty {
                    EmptyStateView(
                        icon: "music.note.list",
                        title: "Pusty folder",
                        message: "Wyszukaj utwór w Apple Music i dodaj go do tego folderu."
                    )
                } else {
                    LazyVStack(spacing: 16) {
                        ForEach(tracks) { track in
                            MusicTrackCard(
                                title: track.title,
                                subtitle: [track.artist, track.album].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
                                thumbnailURL: track.thumbnail.flatMap(URL.init(string:)),
                                duration: track.duration,
                                quality: track.quality,
                                layout: .row
                            ) {
                                selectedTrack = MusicSelection(from: track)
                            }
                            .focused($focusedTrackID, equals: track.id)
                            .contextMenu {
                                Button("Pobierz MP3") {
                                    Task { await download(track) }
                                }
                                Button("Usuń z folderu", role: .destructive) {
                                    Task { await remove(track) }
                                }
                            }
                        }
                    }
                }
            }
            .padding(.bottom, 80)
        }
        .task { await load() }
        .fullScreenCover(item: $selectedTrack) { track in
            MusicDetailView(
                selection: track,
                folders: app.musicFolders.filter { $0.id != folder.id }
            ) {
                Task { await load() }
            }
            .environmentObject(app)
        }
        .fullScreenCover(item: $downloadJob) { job in
            MusicDownloadProgressView(jobId: job.id, title: downloadTitle) {
                downloadJob = nil
            }
            .environmentObject(app)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: onBack) {
                Label("Wróć do Muzyki", systemImage: "chevron.left")
            }
            .buttonStyle(FocusCardButtonStyle())
            .onMoveCommand { direction in
                if direction == .up {
                    focusedTab.wrappedValue = navigationTab
                }
            }

            ScreenTitle(
                title: folder.name,
                subtitle: "\(tracks.count) utworów · MP3 320 kbps"
            )
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await app.api.fetchFolderTracks(folderId: folder.id)
            tracks = response.tracks
            if focusedTrackID == nil {
                focusedTrackID = tracks.first?.id
            }
        } catch {
            tracks = []
            errorMessage = error.localizedDescription
        }
    }

    private func download(_ track: MusicTrack) async {
        downloadTitle = track.title
        do {
            let jobId = try await app.api.startMusicDownload(url: track.url)
            downloadJob = DownloadJobState(id: jobId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func remove(_ track: MusicTrack) async {
        do {
            try await app.api.removeTrackFromFolder(folderId: folder.id, url: track.url)
            await load()
            await app.refreshMusicLibrary()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

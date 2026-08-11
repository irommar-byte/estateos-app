import SwiftUI

struct OnlineMoviesDownloadsView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel

    @State private var selected: OnlineMovieSelection?
    @State private var pendingDelete: MovieDownload?

    private var movies: OnlineMoviesController { app.onlineMovies }

    var body: some View {
        Group {
            if movies.isLoadingDownloads && movies.downloads.isEmpty {
                ProgressView("Ładuję pobrane…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if movies.downloads.isEmpty {
                ContentUnavailableView(
                    "Brak filmów na serwerze",
                    systemImage: "externaldrive",
                    description: Text("Pobierz film z CDA-HD przyciskiem „Na serwer”.")
                )
            } else {
                List {
                    Section {
                        ForEach(movies.downloads) { download in
                            Button {
                                selected = OnlineMovieSelection(download: download)
                            } label: {
                                HStack(spacing: 12) {
                                    ArtworkImage(url: download.artworkURL, size: 64, cornerRadius: 10)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(download.title)
                                            .font(.body.weight(.semibold))
                                            .foregroundStyle(.primary)
                                            .multilineTextAlignment(.leading)
                                        HStack(spacing: 8) {
                                            OnlineMovieTransferBadge(state: movies.transferState(for: download.url))
                                            Text(download.source?.uppercased() ?? "CDA-HD")
                                                .font(.caption2.weight(.bold))
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer(minLength: 0)
                                    Image(systemName: "chevron.right")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.tertiary)
                                }
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    pendingDelete = download
                                } label: {
                                    Label("Usuń", systemImage: "trash")
                                }
                            }
                        }
                    } footer: {
                        Text("Pliki leżą na serwerze EOS. Możesz je odtworzyć strumieniowo albo ściągnąć na telefon.")
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .refreshable { await movies.refreshDownloads() }
        .task { await movies.refreshDownloads() }
        .navigationDestination(item: $selected) { selection in
            OnlineMovieDetailView(selection: selection)
                .environmentObject(app)
                .environmentObject(video)
        }
        .alert("Usunąć z serwera?", isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        )) {
            Button("Usuń", role: .destructive) {
                if let pendingDelete {
                    Task { await movies.deleteServerDownload(url: pendingDelete.url) }
                }
                pendingDelete = nil
            }
            Button("Anuluj", role: .cancel) { pendingDelete = nil }
        } message: {
            Text("Usunie plik z dysku serwera dla Twojego konta.")
        }
    }
}

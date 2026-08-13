import SwiftUI

struct OnlineMoviesDownloadsView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel

    @State private var selected: OnlineMovieSelection?
    @State private var pendingDelete: MovieDownload?

    private var movies: OnlineMoviesController { app.onlineMovies }

    private var grouped: [(series: String, items: [MovieDownload])] {
        let dict = Dictionary(grouping: movies.downloads) { download in
            download.seriesFolderName ?? "Filmy"
        }
        return dict.keys.sorted().map { key in
            (series: key, items: dict[key]!.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending })
        }
    }

    var body: some View {
        Group {
            if movies.isLoadingDownloads && movies.downloads.isEmpty {
                ProgressView("Ładuję pobrane…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if movies.downloads.isEmpty {
                ContentUnavailableView(
                    "Brak filmów na serwerze",
                    systemImage: "externaldrive",
                    description: Text("Pobierz z CDA-HD — pliki trafią do MOVIES/Serial/Sezon/ na VPS.")
                )
            } else {
                List {
                    if app.movieDownloads.hasActiveBatch {
                        Section {
                            MovieDownloadQueueBanner(service: app.movieDownloads)
                                .listRowBackground(Color.clear)
                        }
                    }

                    ForEach(grouped, id: \.series) { group in
                        Section {
                            ForEach(group.items) { download in
                                downloadRow(download)
                            }
                        } header: {
                            HStack {
                                Image(systemName: "folder.fill")
                                    .foregroundStyle(EOSTheme.accent)
                                Text(group.series)
                            }
                        } footer: {
                            if group.series != "Filmy" {
                                Text("Ścieżka: MOVIES/\(group.series)/…")
                            }
                        }
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

    private func downloadRow(_ download: MovieDownload) -> some View {
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
                        if let season = download.seasonFolderName {
                            Text(season.uppercased())
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let path = download.serverRelativePath {
                        Text(path)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
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
}

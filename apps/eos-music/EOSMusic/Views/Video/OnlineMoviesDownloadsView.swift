import SwiftUI

struct OnlineMoviesDownloadsView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel

    @State private var selected: OnlineMovieSelection?
    @State private var pendingDelete: MovieDownload?

    private var movies: OnlineMoviesController { app.onlineMovies }

    private var grouped: [(series: String, items: [MovieDownload])] {
        let dict = Dictionary(grouping: visibleDownloads) { download in
            download.seriesFolderName ?? "Filmy"
        }
        return dict.keys.sorted().map { key in
            (series: key, items: dict[key]!.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending })
        }
    }

    private var visibleDownloads: [MovieDownload] {
        if app.isOfflinePlaybackActive {
            return movies.downloads.filter { movies.isAvailableOffline(url: $0.url) }
        }
        return movies.downloads
    }

    var body: some View {
        Group {
            if movies.isLoadingDownloads && visibleDownloads.isEmpty {
                ProgressView("Ładuję pobrane…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if visibleDownloads.isEmpty {
                ContentUnavailableView(
                    app.isOfflinePlaybackActive ? "Brak filmów na iPhonie" : "Brak filmów na serwerze",
                    systemImage: app.isOfflinePlaybackActive ? "iphone.slash" : "externaldrive",
                    description: Text(
                        app.isOfflinePlaybackActive
                            ? "Tryb Offline pokazuje tylko kopie na tym urządzeniu. W Online pobierz z opcją „Serwer + iPhone” albo dodaj folder z plikami."
                            : "Pobierz z EOS™LIBRARY — pliki trafią do MOVIES/Serial/Sezon/ na VPS."
                    )
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
            OnlineDownloadedMediaDestination(selection: selection)
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

/// Pobrany odcinek serialu otwiera pełną listę sezonu, nie kartę „filmu”.
struct OnlineDownloadedMediaDestination: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel

    let selection: OnlineMovieSelection

    @State private var seriesInfo: VideoInfoResponse?
    @State private var isLoading = false
    @State private var loadError: String?

    private var looksLikeEpisode: Bool {
        selection.isSerial
            || selection.url.lowercased().contains("/episode/")
            || selection.title.lowercased().contains(" · sezon ")
            || selection.title.lowercased().contains(" · odcinek")
    }

    var body: some View {
        Group {
            if let seriesInfo, seriesInfo.isSeries, !seriesInfo.playableEpisodes.isEmpty {
                OnlineSeriesEpisodesView(info: seriesInfo, highlightEpisodeURL: selection.url)
            } else if isLoading {
                ProgressView("Wczytuję sezon…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                OnlineMovieDetailView(selection: selection)
            }
        }
        .task {
            guard looksLikeEpisode else { return }
            await loadSeries()
        }
    }

    private func loadSeries() async {
        isLoading = true
        defer { isLoading = false }
        var candidates: [String] = []
        if let inferred = MovieURLMatching.inferredSeriesPageURL(from: selection.url) {
            candidates.append(inferred)
        }
        candidates.append(selection.url)
        for url in candidates {
            do {
                let info = try await app.onlineMovies.fetchInfo(url: url)
                if info.isSeries, !info.playableEpisodes.isEmpty {
                    seriesInfo = info
                    loadError = nil
                    return
                }
            } catch {
                loadError = error.localizedDescription
            }
        }
    }
}

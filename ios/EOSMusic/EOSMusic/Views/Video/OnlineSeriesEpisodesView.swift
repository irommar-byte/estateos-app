import SwiftUI

private struct SeasonSection: Identifiable {
    let id: Int
    let number: Int
    let title: String
    let episodes: [EpisodeItem]
}

private struct PendingDownloadBatch: Identifiable {
    let id = UUID()
    let episodes: [EpisodeItem]
    let label: String
}

/// Lista odcinków serialu CDA-HD — pobieranie sezonu / całości + odtwarzanie w kolejce.
struct OnlineSeriesEpisodesView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @Environment(\.dismiss) private var dismiss

    let info: VideoInfoResponse

    @State private var selectedSeasonIndex = 0
    @State private var isSelectionMode = false
    @State private var selectedEpisodeIDs = Set<String>()
    @State private var pendingBatch: PendingDownloadBatch?
    @State private var playingEpisodeID: String?
    @State private var selectedHeight = 720

    private var movies: OnlineMoviesController { app.onlineMovies }
    private var downloads: MovieDownloadService { app.movieDownloads }
    private var displayTitle: String { info.cdaHd?.title ?? info.title }

    private var seasonSections: [SeasonSection] {
        if let seasons = info.seasons, !seasons.isEmpty {
            return seasons.enumerated().map { index, season in
                SeasonSection(
                    id: season.seasonNumber ?? index + 1,
                    number: season.seasonNumber ?? index + 1,
                    title: season.title ?? "Sezon \(season.seasonNumber ?? index + 1)",
                    episodes: season.episodes ?? []
                )
            }
        }
        let grouped = Dictionary(grouping: info.playableEpisodes) { $0.seasonNumber ?? 1 }
        return grouped.keys.sorted().map { sn in
            let episodes = (grouped[sn] ?? []).sorted { ($0.episodeNumber ?? 0) < ($1.episodeNumber ?? 0) }
            return SeasonSection(id: sn, number: sn, title: "Sezon \(sn)", episodes: episodes)
        }
    }

    private var selectedSeason: SeasonSection? {
        guard !seasonSections.isEmpty else { return nil }
        let idx = min(max(selectedSeasonIndex, 0), seasonSections.count - 1)
        return seasonSections[idx]
    }

    private var allEpisodes: [EpisodeItem] { seasonSections.flatMap(\.episodes) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerActions

                if seasonSections.count > 1 {
                    seasonPicker
                }

                if let batch = downloads.activeBatch, downloads.batchMatches(contextKey: info.webpageUrl) {
                    MovieDownloadQueueBanner(service: downloads)
                }

                episodeList
            }
            .padding(16)
        }
        .background(Color(.systemBackground))
        .navigationTitle(displayTitle)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $pendingBatch) { batch in
            MediaDownloadOptionsSheet(
                title: batch.label,
                info: info,
                itemCount: batch.episodes.count,
                totalDuration: episodesDuration(batch.episodes),
                itemsSubtitle: "\(batch.episodes.count) odc. · zapis w MOVIES/Serial/Sezon/"
            ) { format, quality, destination in
                startDownloadBatch(episodes: batch.episodes, format: format, quality: quality, destination: destination)
            }
        }
        .overlay {
            if playingEpisodeID != nil {
                ZStack {
                    Color.black.opacity(0.45).ignoresSafeArea()
                    ProgressView("Uruchamiam odcinek…")
                        .padding(24)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                }
            }
        }
    }

    private var headerActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                statChip("\(allEpisodes.count) odc.", icon: "list.number")
                statChip("\(downloadedCount) na serwerze", icon: "server.rack")
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    bulkButton("Cały serial") {
                        prepareDownload(allEpisodes.filter { !isDownloaded($0) }, label: displayTitle)
                    }
                    if let season = selectedSeason {
                        bulkButton("Ten sezon") {
                            prepareDownload(season.episodes.filter { !isDownloaded($0) }, label: "\(displayTitle) · \(season.title)")
                        }
                    }
                    Button(isSelectionMode ? "Anuluj wybór" : "Wybierz odcinki") {
                        isSelectionMode.toggle()
                        selectedEpisodeIDs.removeAll()
                    }
                    .font(EOSTypography.caption.weight(.semibold))
                    .buttonStyle(.bordered)

                    if isSelectionMode, !selectedEpisodeIDs.isEmpty {
                        bulkButton("Pobierz (\(selectedEpisodeIDs.count))") {
                            let eps = allEpisodes.filter { selectedEpisodeIDs.contains($0.id) }
                            prepareDownload(eps, label: "\(displayTitle) · wybrane")
                            isSelectionMode = false
                            selectedEpisodeIDs.removeAll()
                        }
                    }
                }
            }
        }
    }

    private var seasonPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(seasonSections.enumerated()), id: \.element.id) { index, season in
                    Button(season.title) {
                        selectedSeasonIndex = index
                    }
                    .font(EOSTypography.caption.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        selectedSeasonIndex == index ? EOSTheme.accent : EOSTheme.card,
                        in: Capsule()
                    )
                    .foregroundStyle(selectedSeasonIndex == index ? .white : .primary)
                }
            }
        }
    }

    private var episodeList: some View {
        let episodes = selectedSeason?.episodes ?? info.playableEpisodes
        return VStack(spacing: 10) {
            ForEach(episodes) { episode in
                episodeRow(episode)
            }
        }
    }

    private func episodeRow(_ episode: EpisodeItem) -> some View {
        let downloaded = isDownloaded(episode)
        let batchState = downloads.itemState(for: episode.url)
        return HStack(spacing: 12) {
            if isSelectionMode {
                Image(systemName: selectedEpisodeIDs.contains(episode.id) ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(selectedEpisodeIDs.contains(episode.id) ? EOSTheme.accent : .secondary)
                    .onTapGesture { toggleSelection(episode) }
            }

            OnlineMovieBackdrop(url: episode.thumbnail.flatMap(URL.init(string:)))
                .frame(width: 80, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 3) {
                Text(episode.title)
                    .font(EOSTypography.subheadline.weight(.semibold))
                    .lineLimit(2)
                HStack(spacing: 6) {
                    if downloaded {
                        Text("SERWER")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(EOSTheme.accent.opacity(0.85), in: Capsule())
                            .foregroundStyle(.white)
                    }
                    batchStatusLabel(batchState)
                }
            }

            Spacer()

            Button {
                Task { await playEpisode(episode) }
            } label: {
                Image(systemName: "play.circle.fill")
                    .font(.title2)
                    .foregroundStyle(EOSTheme.accent)
            }
            .disabled(playingEpisodeID != nil || movies.isPreparingStream)

            Menu {
                Button("Oglądaj") { Task { await playEpisode(episode) } }
                Button("Pobierz…") {
                    prepareDownload([episode], label: serverDownloadTitle(seriesTitle: displayTitle, episode: episode))
                }
                if downloaded {
                    Button("Usuń z serwera", role: .destructive) {
                        Task { await movies.deleteServerDownload(url: episode.url) }
                    }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .background(EOSTheme.card, in: RoundedRectangle(cornerRadius: 12))
        .contentShape(Rectangle())
        .onTapGesture {
            if isSelectionMode { toggleSelection(episode) }
        }
    }

    @ViewBuilder
    private func batchStatusLabel(_ state: MovieDownloadItemState) -> some View {
        switch state {
        case .downloading(let p):
            Text(String(format: "SERWER %.0f%%", p))
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(EOSTheme.accent)
        case .pullingPhone(let p):
            Text(String(format: "TEL %.0f%%", p))
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.green)
        case .pending:
            Text("KOLEJKA")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.orange)
        default:
            EmptyView()
        }
    }

    private func statChip(_ text: String, icon: String) -> some View {
        Label(text, systemImage: icon)
            .font(EOSTypography.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(EOSTheme.card, in: Capsule())
    }

    private func bulkButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(EOSTypography.caption.weight(.semibold))
            .buttonStyle(.borderedProminent)
            .tint(EOSTheme.accent)
    }

    private func prepareDownload(_ episodes: [EpisodeItem], label: String) {
        guard !episodes.isEmpty else { return }
        pendingBatch = PendingDownloadBatch(episodes: episodes, label: label)
    }

    private func startDownloadBatch(
        episodes: [EpisodeItem],
        format: MediaDownloadFormat,
        quality: MediaQualityOption,
        destination: OnlineMovieDownloadDestination
    ) {
        let options = info.qualityOptions(for: format)
        let items = episodes.map { ep in
            MovieDownloadQueueItem(
                url: ep.url,
                title: serverDownloadTitle(seriesTitle: displayTitle, episode: ep),
                thumbnail: ep.thumbnail ?? info.thumbnail,
                source: info.source ?? "cda-hd"
            )
        }
        downloads.startBatch(
            items: items,
            label: displayTitle,
            thumbnail: info.thumbnail,
            contextKey: info.webpageUrl,
            format: format,
            quality: quality,
            destination: destination
        )
    }

    private func playEpisode(_ episode: EpisodeItem) async {
        playingEpisodeID = episode.id
        defer { playingEpisodeID = nil }
        let selection = OnlineMovieSelection(episode: episode, source: info.source)
        movies.watchStream(
            selection: selection,
            height: selectedHeight,
            video: video,
            episodeQueue: allEpisodes,
            seriesTitle: displayTitle
        )
        // watchStream is async internally — give it a moment
        try? await Task.sleep(nanoseconds: 300_000_000)
    }

    private func isDownloaded(_ episode: EpisodeItem) -> Bool {
        app.isMovieDownloaded(url: episode.url)
    }

    private var downloadedCount: Int {
        allEpisodes.filter { isDownloaded($0) }.count
    }

    private func toggleSelection(_ episode: EpisodeItem) {
        if selectedEpisodeIDs.contains(episode.id) {
            selectedEpisodeIDs.remove(episode.id)
        } else {
            selectedEpisodeIDs.insert(episode.id)
        }
    }

    private func episodesDuration(_ episodes: [EpisodeItem]) -> Double {
        let sum = episodes.reduce(0.0) { $0 + ($1.duration ?? 0) }
        return sum > 0 ? sum : Double(episodes.count) * 45 * 60
    }
}

struct MovieDownloadQueueBanner: View {
    @ObservedObject var service: MovieDownloadService

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(service.isRunning ? "Pobieranie serialu" : "Kolejka filmów", systemImage: "arrow.down.circle.fill")
                    .font(EOSTypography.subheadline.weight(.semibold))
                Spacer()
                Text("\(service.completedCount)/\(service.totalCount)")
                    .font(EOSTypography.caption.monospacedDigit().weight(.bold))
                if service.isRunning {
                    Button("Stop") { service.cancelBatch() }
                        .font(EOSTypography.caption.weight(.semibold))
                } else {
                    Button("OK") { service.clearFinishedBatch() }
                        .font(EOSTypography.caption.weight(.semibold))
                }
            }
            ProgressView(value: service.overallProgress)
                .tint(EOSTheme.accent)
            if let title = service.activeItemTitle {
                Text("Teraz: \(title)")
                    .font(EOSTypography.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(12)
        .background(EOSTheme.card, in: RoundedRectangle(cornerRadius: 14))
    }
}

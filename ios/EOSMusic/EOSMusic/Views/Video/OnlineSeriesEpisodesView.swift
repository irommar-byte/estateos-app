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

/// Lista odcinków serialu EOS™LIBRARY — pobieranie sezonu / całości + odtwarzanie w kolejce.
struct OnlineSeriesEpisodesView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @Environment(\.dismiss) private var dismiss

    let info: VideoInfoResponse
    var highlightEpisodeURL: String? = nil

    @State private var selectedSeasonIndex = 0
    @State private var isSelectionMode = false
    @State private var selectedEpisodeIDs = Set<String>()
    @State private var pendingBatch: PendingDownloadBatch?
    @State private var playingEpisodeID: String?
    @State private var selectedHeight = 720
    @State private var playErrorMessage: String?
    @State private var retryEpisode: EpisodeItem?
    @State private var retryPreferSavedCopy = true

    private var movies: OnlineMoviesController { app.onlineMovies }
    private var downloads: MovieDownloadService { app.movieDownloads }
    private var displayTitle: String { info.cdaHd?.title ?? info.title }

    private var seasonSections: [SeasonSection] {
        let raw: [SeasonSection]
        if let seasons = info.seasons, !seasons.isEmpty {
            raw = seasons.enumerated().map { index, season in
                SeasonSection(
                    id: season.seasonNumber ?? index + 1,
                    number: season.seasonNumber ?? index + 1,
                    title: season.title ?? "Sezon \(season.seasonNumber ?? index + 1)",
                    episodes: season.episodes ?? []
                )
            }
        } else {
            let grouped = Dictionary(grouping: info.playableEpisodes) { $0.seasonNumber ?? 1 }
            raw = grouped.keys.sorted().map { sn in
                let episodes = (grouped[sn] ?? []).sorted { ($0.episodeNumber ?? 0) < ($1.episodeNumber ?? 0) }
                return SeasonSection(id: sn, number: sn, title: "Sezon \(sn)", episodes: episodes)
            }
        }
        guard app.isOfflinePlaybackActive else { return raw }
        return raw.compactMap { section in
            let episodes = section.episodes.filter { app.isMovieOnPhone(url: $0.url) }
            guard !episodes.isEmpty else { return nil }
            return SeasonSection(id: section.id, number: section.number, title: section.title, episodes: episodes)
        }
    }

    private var selectedSeason: SeasonSection? {
        guard !seasonSections.isEmpty else { return nil }
        let idx = min(max(selectedSeasonIndex, 0), seasonSections.count - 1)
        return seasonSections[idx]
    }

    private var allEpisodes: [EpisodeItem] { seasonSections.flatMap(\.episodes) }

    var body: some View {
        ScrollViewReader { proxy in
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerActions

                if seasonSections.count > 1 {
                    seasonPicker
                }

                episodeList
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollIndicators(.visible)
        .eosScrollClearance()
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
            if movies.playbackLaunchPhase.isBusy {
                ZStack {
                    Color.black.opacity(0.45).ignoresSafeArea()
                    VStack(spacing: 12) {
                        ProgressView()
                            .controlSize(.large)
                        Text(movies.playbackLaunchPhase.message ?? "Uruchamiam odcinek…")
                            .font(.subheadline.weight(.semibold))
                        if let progress = movies.playbackLaunchPhase.progress {
                            ProgressView(value: progress, total: 100)
                                .frame(width: 180)
                        }
                        Button("Anuluj") { movies.cancelStreamPrepare() }
                            .font(.caption.weight(.semibold))
                    }
                    .padding(24)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                }
            }
        }
        .task {
            await movies.refreshDownloads()
            selectHighlightedSeason()
            if let highlightEpisodeURL {
                try? await Task.sleep(nanoseconds: 80_000_000)
                proxy.scrollTo(highlightEpisodeURL, anchor: .center)
            }
        }
        .alert(
            "Odtwarzanie",
            isPresented: Binding(
                get: { playErrorMessage != nil },
                set: { if !$0 { playErrorMessage = nil } }
            )
        ) {
            if let retryEpisode {
                Button("Spróbuj ponownie") {
                    let preferSaved = retryPreferSavedCopy
                    playErrorMessage = nil
                    Task { await playEpisode(retryEpisode, preferSavedCopy: preferSaved) }
                }
            }
            Button("Anuluj", role: .cancel) {
                playErrorMessage = nil
                retryEpisode = nil
            }
        } message: {
            Text(playErrorMessage ?? "")
        }
        }
    }

    private var headerActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                statChip("\(allEpisodes.count) odc.", icon: "list.number")
                statChip("\(downloadedOnServerCount) serwer", icon: "server.rack")
                statChip("\(downloadedOnPhoneCount) iPhone", icon: "iphone")
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    if !app.isOfflinePlaybackActive {
                        bulkButton("Cały serial") {
                            prepareDownload(allEpisodes.filter { !app.isMovieOnPhone(url: $0.url) }, label: displayTitle)
                        }
                        if let season = selectedSeason {
                            bulkButton("Ten sezon") {
                                prepareDownload(season.episodes.filter { !app.isMovieOnPhone(url: $0.url) }, label: "\(displayTitle) · \(season.title)")
                            }
                        }
                    }
                    Button(isSelectionMode ? "Anuluj wybór" : "Wybierz odcinki") {
                        isSelectionMode.toggle()
                        selectedEpisodeIDs.removeAll()
                    }
                    .font(EOSTypography.caption.weight(.semibold))
                    .buttonStyle(.bordered)
                    .disabled(app.isOfflinePlaybackActive)

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
        let episodes = visibleEpisodes
        return VStack(spacing: 10) {
            if app.isOfflinePlaybackActive, episodes.isEmpty {
                ContentUnavailableView(
                    "Brak odcinków na iPhonie",
                    systemImage: "iphone.slash",
                    description: Text("W trybie Offline widać tylko odcinki skopiowane na to urządzenie (Serwer + iPhone).")
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            } else {
                ForEach(episodes) { episode in
                    episodeRow(episode)
                        .id(episode.url)
                }
            }
        }
    }

    private var visibleEpisodes: [EpisodeItem] {
        let episodes = selectedSeason?.episodes ?? info.playableEpisodes
        guard app.isOfflinePlaybackActive else { return episodes }
        return episodes.filter { app.isMovieOnPhone(url: $0.url) }
    }

    private func episodeRow(_ episode: EpisodeItem) -> some View {
        let onServer = isDownloaded(episode)
        let onPhone = app.isMovieOnPhone(url: episode.url)
        let batchState = downloads.itemState(for: episode.url)
        let highlighted = isHighlighted(episode)
        return HStack(spacing: 12) {
            if isSelectionMode {
                Image(systemName: selectedEpisodeIDs.contains(episode.id) ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(selectedEpisodeIDs.contains(episode.id) ? EOSTheme.accent : .secondary)
                    .onTapGesture { toggleSelection(episode) }
            }

            OnlineMovieBackdrop(url: episode.thumbnail.flatMap(URL.init(string:)))
                .frame(width: 80, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(alignment: .topLeading) {
                    if highlighted {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(EOSTheme.accent)
                            .background(.white, in: Circle())
                            .offset(x: -4, y: -4)
                    }
                }

            VStack(alignment: .leading, spacing: 3) {
                Text(episode.title)
                    .font(EOSTypography.subheadline.weight(.semibold))
                    .lineLimit(2)
                HStack(spacing: 6) {
                    if highlighted || onPhone || onServer {
                        Text(onPhone ? "Na iPhonie" : "Pobrany")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(onPhone ? Color.green : EOSTheme.accent)
                    }
                    if onPhone {
                        MovieStorageLocationBadge(kind: .phone)
                    } else if onServer {
                        MovieStorageLocationBadge(kind: .server)
                    }
                    batchStatusLabel(batchState)
                }
            }

            Spacer()

            Button {
                Task { await playEpisode(episode, preferSavedCopy: true) }
            } label: {
                Image(systemName: "play.circle.fill")
                    .font(.title2)
                    .foregroundStyle(EOSTheme.accent)
            }
            .disabled(movies.playbackLaunchPhase.isBusy)

            FavoriteButton(item: episode.favoriteItem(seriesTitle: displayTitle), size: 17)
                .frame(width: 32, height: 36)

            Menu {
                if !app.isOfflinePlaybackActive {
                    Button("Oglądaj ze źródła") {
                        Task { await playEpisode(episode, preferSavedCopy: false) }
                    }
                }
                if onServer, !app.isOfflinePlaybackActive {
                    Button("Odtwórz z serwera") {
                        Task { await playEpisode(episode, preferSavedCopy: true) }
                    }
                }
                if onPhone {
                    Button("Odtwórz z telefonu") {
                        Task { await playEpisode(episode, preferSavedCopy: true) }
                    }
                }
                if !app.isOfflinePlaybackActive {
                    Button("Pobierz…") {
                        prepareDownload([episode], label: serverDownloadTitle(seriesTitle: displayTitle, episode: episode))
                    }
                }
                Button {
                    Task { await app.toggleFavorite(episode.favoriteItem(seriesTitle: displayTitle)) }
                } label: {
                    Label(
                        app.isFavorite(episode.url) ? "Usuń z ulubionych" : "Dodaj do ulubionych",
                        systemImage: app.isFavorite(episode.url) ? "heart.slash" : "heart"
                    )
                }
                if onServer, !app.isOfflinePlaybackActive {
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
        .background(
            highlighted ? EOSTheme.accent.opacity(0.12) : EOSTheme.card,
            in: RoundedRectangle(cornerRadius: 12)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(highlighted ? EOSTheme.accent : .clear, lineWidth: 1.5)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            if isSelectionMode { toggleSelection(episode) }
        }
    }

    @ViewBuilder
    private func batchStatusLabel(_ state: MovieDownloadItemState) -> some View {
        switch state {
        case .downloading(let p):
            MovieStorageLocationBadge(kind: .serverProgress(p))
        case .pullingPhone(let p):
            MovieStorageLocationBadge(kind: .phoneProgress(p))
        case .pending:
            MovieStorageLocationBadge(kind: .queue)
        case .cancelled:
            MovieStorageLocationBadge(kind: .cancelled)
        case .failed:
            MovieStorageLocationBadge(kind: .error)
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
        let eligible = episodes.filter { ep in
            switch destination {
            case .server:
                return !isDownloaded(ep)
            case .serverAndPhone:
                return !app.isMovieOnPhone(url: ep.url)
            }
        }
        guard !eligible.isEmpty else { return }
        let items = eligible.map { ep in
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

    private func playEpisode(_ episode: EpisodeItem, preferSavedCopy: Bool = true) async {
        playingEpisodeID = episode.id
        defer { playingEpisodeID = nil }
        let selection = OnlineMovieSelection(episode: episode, source: info.source)
        let started: Bool

        if preferSavedCopy, app.isMovieOnPhone(url: episode.url) {
            started = await movies.playFromPhone(selection: selection, video: video)
        } else if preferSavedCopy, movies.jobId(for: episode.url, title: episode.title) != nil {
            started = await movies.playFromServer(selection: selection, video: video)
        } else {
            started = await movies.watchStream(
                selection: selection,
                height: selectedHeight,
                video: video,
                episodeQueue: allEpisodes,
                seriesTitle: displayTitle,
                preferSavedCopy: preferSavedCopy
            )
        }

        if !started, case .failed(let message) = movies.playbackLaunchPhase {
            retryEpisode = episode
            retryPreferSavedCopy = preferSavedCopy
            playErrorMessage = message
        }
    }

    private func isDownloaded(_ episode: EpisodeItem) -> Bool {
        app.isMovieDownloaded(url: episode.url, title: episode.title)
    }

    private func isHighlighted(_ episode: EpisodeItem) -> Bool {
        guard let highlightEpisodeURL else { return false }
        return MovieURLMatching.urlsMatch(episode.url, highlightEpisodeURL)
    }

    private func selectHighlightedSeason() {
        guard let highlightEpisodeURL else { return }
        if let index = seasonSections.firstIndex(where: { section in
            section.episodes.contains { MovieURLMatching.urlsMatch($0.url, highlightEpisodeURL) }
        }) {
            selectedSeasonIndex = index
        }
    }

    private var downloadedOnServerCount: Int {
        allEpisodes.filter { isDownloaded($0) }.count
    }

    private var downloadedOnPhoneCount: Int {
        allEpisodes.filter { app.isMovieOnPhone(url: $0.url) }.count
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
                Label(service.isRunning ? "Pobieranie" : "Kolejka filmów", systemImage: "arrow.down.circle.fill")
                    .font(EOSTypography.subheadline.weight(.semibold))
                Spacer()
                if let badge = service.activeItemPhaseBadge {
                    MovieStorageLocationBadge(
                        kind: badge == "iPHONE"
                            ? .phoneProgress(service.activeItemProgress ?? 0)
                            : .serverProgress(service.activeItemProgress ?? 0)
                    )
                }
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
                Text(title)
                    .font(EOSTypography.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            let detail = service.activeDetailLine
            if !detail.isEmpty {
                Text(detail)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(EOSTheme.card, in: RoundedRectangle(cornerRadius: 14))
    }
}

import SwiftUI

private struct SeasonSection: Identifiable {
    let id: Int
    let number: Int
    let title: String
    let episodes: [EpisodeItem]
}

private enum SeriesFocus: Hashable {
    case back
    case favorite
    case season(Int)
    case episode(String)
}

struct SeriesEpisodesView: View {
    @EnvironmentObject private var app: AppModel

    let info: VideoInfoResponse
    var backLabel: String = "Wróć"
    let onBack: () -> Void

    @State private var playbackContext: MediaPlaybackContext?
    @State private var playError: String?
    @State private var playingEpisodeID: String?
    @State private var selectedSeasonIndex = 0
    @State private var isSelectionMode = false
    @State private var selectedEpisodeIDs = Set<String>()
    @State private var showDownloadSheet = false
    @State private var pendingDownloadEpisodes: [EpisodeItem]?
    @State private var deletingEpisodeURL: String?
    @State private var browseContext: CdaHdBrowseContext?
    @State private var showCdaDetails = false
    @FocusState private var localFocus: SeriesFocus?

    private var downloadService: MovieDownloadService { app.movieDownloadService }

    private var cdaMeta: CdaHdMeta? { info.cdaHd }
    private var displayTitle: String { MediaCardCopy.decodedTitle(cdaMeta?.title ?? info.title) }
    private var posterURL: URL? { (cdaMeta?.thumbnail ?? info.thumbnail).flatMap(URL.init(string:)) }
    private var sourceLabel: String { MediaSourceMeta.normalize(info.uploader ?? info.source).label }

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
        return grouped.keys.sorted().map { seasonNumber in
            let episodes = (grouped[seasonNumber] ?? []).sorted {
                ($0.episodeNumber ?? 0) < ($1.episodeNumber ?? 0)
            }
            return SeasonSection(
                id: seasonNumber,
                number: seasonNumber,
                title: "Sezon \(seasonNumber)",
                episodes: episodes
            )
        }
    }

    private var selectedSeason: SeasonSection? {
        guard !seasonSections.isEmpty else { return nil }
        let index = min(max(selectedSeasonIndex, 0), seasonSections.count - 1)
        return seasonSections[index]
    }

    private var visibleEpisodes: [EpisodeItem] {
        selectedSeason?.episodes ?? info.playableEpisodes
    }

    private var allEpisodes: [EpisodeItem] {
        seasonSections.flatMap(\.episodes)
    }

    private var episodeCount: Int {
        cdaMeta?.episodeCount ?? info.episodeCount ?? allEpisodes.count
    }

    private var isBatchRunning: Bool {
        downloadService.isRunning && downloadService.batchMatches(contextKey: info.webpageUrl)
    }

    private var completedDownloadCount: Int {
        allEpisodes.filter { isEpisodeDownloaded($0) }.count
    }

    private var pendingDownloadCount: Int {
        allEpisodes.filter { !isEpisodeDownloaded($0) }.count
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            MusicHeroBackdrop(imageURL: posterURL)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    header

                    if seasonSections.count > 1 {
                        seasonPicker
                    }

                    if showCdaDetails, let cdaMeta {
                        cdaDetailsSection(cdaMeta)
                    }

                    episodePlaylist
                }
                .padding(.horizontal, NostalgieSpacing.screenH)
                .padding(.bottom, NostalgieSpacing.scrollBottom)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.black)
        .onExitCommand {
            if isSelectionMode {
                isSelectionMode = false
                selectedEpisodeIDs.removeAll()
            } else {
                onBack()
            }
        }
        .onAppear {
            selectedSeasonIndex = 0
        }
        .sheet(isPresented: $showDownloadSheet) {
            if let episodes = pendingDownloadEpisodes {
                MediaDownloadOptionsSheet(
                    title: displayTitle,
                    info: info,
                    itemCount: episodes.count,
                    totalDuration: episodesTotalDuration(episodes),
                    itemsSubtitle: "\(episodes.count) odcinków · wybierz jakość przed pobraniem"
                ) { format, quality in
                    startDownloadBatch(episodes: episodes, format: format, quality: quality)
                }
            }
        }
        .fullScreenCover(item: $playbackContext) { context in
            PlayerScreen(context: context)
        }
        .fullScreenCover(item: $browseContext) { context in
            CdaHdBrowseView(context: context)
                .environmentObject(app)
        }
        .alert("Odtwarzanie", isPresented: Binding(
            get: { playError != nil },
            set: { if !$0 { playError = nil } }
        )) {
            Button("OK", role: .cancel) { playError = nil }
        } message: {
            Text(playError ?? "")
        }
        .overlay {
            if playingEpisodeID != nil {
                ZStack {
                    Color.black.opacity(0.55)
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.4)
                        Text("Przygotowuję odcinek…")
                            .font(NostalgieFont.rowTitle)
                            .foregroundStyle(.white)
                    }
                    .padding(28)
                    .background(NostalgieTheme.card, in: RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
                }
                .ignoresSafeArea()
            }
        }
        .defaultFocus($localFocus, .back)
    }

    // MARK: - Header (jak MusicAlbumView)

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 16) {
                Button(action: onBack) {
                    Label(backLabel, systemImage: "chevron.left")
                }
                .buttonStyle(BackLinkButtonStyle())
                .focusEffectDisabled()
                .focused($localFocus, equals: .back)
                .onMoveCommand { direction in
                    if direction == .down {
                        if seasonSections.count > 1 {
                            localFocus = .season(selectedSeasonIndex)
                        } else if let first = visibleEpisodes.first {
                            localFocus = .episode(first.id)
                        }
                    }
                }

                Spacer()

                Button {
                    Task { await toggleSeriesFavorite() }
                } label: {
                    Label(
                        app.isFavorite(info.webpageUrl) ? "W ulubionych" : "Dodaj serial",
                        systemImage: app.isFavorite(info.webpageUrl) ? "heart.fill" : "heart"
                    )
                }
                .buttonStyle(ChipButtonStyle(isSelected: app.isFavorite(info.webpageUrl)))
                .focusEffectDisabled()
                .focused($localFocus, equals: .favorite)
                .onMoveCommand { direction in
                    if direction == .down {
                        if seasonSections.count > 1 {
                            localFocus = .season(selectedSeasonIndex)
                        } else if let first = visibleEpisodes.first {
                            localFocus = .episode(first.id)
                        }
                    } else if direction == .left {
                        localFocus = .back
                    }
                }
            }

            HStack(alignment: .center, spacing: 14) {
                seriesCoverThumb(size: 88)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        SourceBadgeView(source: MediaCardCopy.normalizedSourceKey(info.uploader ?? info.source))
                        Text("SERIAL")
                            .font(NostalgieFont.badge)
                            .glassCapsule(paddingH: 10, paddingV: 6)
                    }

                    ScreenTitle(
                        title: displayTitle,
                        subtitle: seriesSubtitle,
                        level: .detail
                    )

                    if let rating = cdaMeta?.rating, (rating.value ?? 0) > 0 {
                        CdaHdRatingView(rating: rating)
                    }
                }
            }

            if !visibleEpisodes.isEmpty {
                HStack(spacing: 12) {
                    if isSelectionMode {
                        Button {
                            prepareDownload(episodes: visibleEpisodes.filter { selectedEpisodeIDs.contains($0.id) })
                        } label: {
                            Label("Pobierz zaznaczone (\(selectedEpisodeIDs.count))", systemImage: "arrow.down.circle.fill")
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: false))
                        .disabled(selectedEpisodeIDs.isEmpty)

                        Button {
                            isSelectionMode = false
                            selectedEpisodeIDs.removeAll()
                        } label: {
                            Label("Anuluj", systemImage: "xmark.circle.fill")
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: false))
                    } else {
                        if pendingDownloadCount == 0, !allEpisodes.isEmpty {
                            Label("Wszystkie pobrane", systemImage: "checkmark.circle.fill")
                                .font(NostalgieFont.caption)
                                .foregroundStyle(.green)
                                .glassCapsule(paddingH: 10, paddingV: 5)
                        } else {
                            Button {
                                prepareDownload(episodes: allEpisodes.filter { !isEpisodeDownloaded($0) })
                            } label: {
                                Label("Pobierz cały serial", systemImage: "arrow.down.circle.fill")
                            }
                            .buttonStyle(ChipButtonStyle(isSelected: false))
                            .disabled(isBatchRunning)
                        }

                        Button {
                            isSelectionMode = true
                            selectedEpisodeIDs.removeAll()
                        } label: {
                            Label("Zaznacz", systemImage: "checklist")
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: false))

                        if cdaMeta != nil {
                            Button {
                                showCdaDetails.toggle()
                            } label: {
                                Label(showCdaDetails ? "Ukryj opis" : "O serialu", systemImage: "info.circle")
                            }
                            .buttonStyle(ChipButtonStyle(isSelected: showCdaDetails))
                        }
                    }
                }
            }
        }
    }

    private var seriesSubtitle: String {
        var parts: [String] = [sourceLabel]
        if seasonSections.count > 1 {
            parts.append("\(seasonSections.count) sezonów")
        }
        parts.append("\(episodeCount) odcinków")
        if let year = cdaMeta?.year {
            parts.append("\(year)")
        }
        if completedDownloadCount > 0 {
            parts.append("\(completedDownloadCount) pobranych")
        }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder
    private func seriesCoverThumb(size: CGFloat) -> some View {
        if let posterURL {
            PosterRemoteImage(url: posterURL)
                .scaledToFill()
                .frame(width: size, height: size * 1.45)
                .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous))
                .shadow(color: .black.opacity(0.35), radius: 16, y: 8)
        } else {
            RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous)
                .fill(NostalgieTheme.card)
                .frame(width: size, height: size * 1.45)
                .overlay {
                    Image(systemName: "tv.fill")
                        .font(NostalgieFont.rounded(28))
                        .foregroundStyle(.secondary)
                }
        }
    }

    // MARK: - Episodes playlist

    private var episodePlaylist: some View {
        VStack(alignment: .leading, spacing: 16) {
            MusicSectionHeader(
                title: seasonSections.count > 1 ? (selectedSeason?.title ?? "Odcinki") : "Odcinki",
                subtitle: "Odtwórz lub pobierz wybrane odcinki"
            )

            if visibleEpisodes.isEmpty {
                Text("Nie znaleziono odcinków.")
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.secondary)
            } else {
                LazyVStack(spacing: NostalgieSpacing.listRow) {
                    ForEach(Array(visibleEpisodes.enumerated()), id: \.element.id) { index, episode in
                        MusicTrackRow(
                            index: episode.episodeNumber ?? (index + 1),
                            title: episode.title,
                            subtitle: episodeRowSubtitle(episode),
                            duration: episode.duration,
                            showsPlayHint: !isSelectionMode && playingEpisodeID != episode.id,
                            isDownloaded: isEpisodeDownloaded(episode),
                            downloadState: downloadService.itemState(for: episode.url),
                            isActiveDownload: {
                                if case .downloading = downloadService.itemState(for: episode.url) { return true }
                                return false
                            }(),
                            isSelected: isSelectionMode ? selectedEpisodeIDs.contains(episode.id) : nil
                        ) {
                            if isSelectionMode {
                                toggleEpisodeSelection(episode)
                            } else {
                                Task { await playEpisode(episode) }
                            }
                        }
                        .focusEffectDisabled()
                        .focused($localFocus, equals: .episode(episode.id))
                        .onMoveCommand { direction in
                            if direction == .up, index == 0 {
                                if seasonSections.count > 1 {
                                    localFocus = .season(selectedSeasonIndex)
                                } else {
                                    localFocus = .favorite
                                }
                            }
                        }
                        .contextMenu {
                            Button("Odtwórz") {
                                Task { await playEpisode(episode) }
                            }
                            Button("Pobierz odcinek") {
                                prepareDownload(episodes: [episode])
                            }
                            .disabled(isEpisodeDownloaded(episode))
                            Button("Usuń pobranie", role: .destructive) {
                                Task { await deleteEpisodeDownload(episode) }
                            }
                            .disabled(!isEpisodeDownloaded(episode) || deletingEpisodeURL == episode.url)
                        }
                        .disabled(playingEpisodeID == episode.id)
                    }
                }
                .focusSection()
            }
        }
    }

    private func episodeRowSubtitle(_ episode: EpisodeItem) -> String {
        if let sn = episode.seasonNumber, let en = episode.episodeNumber, seasonSections.count > 1 {
            return "Sezon \(sn) · Odcinek \(en)"
        }
        if let en = episode.episodeNumber {
            return "Odcinek \(en)"
        }
        return sourceLabel
    }

    // MARK: - CDA-HD details

    @ViewBuilder
    private func cdaDetailsSection(_ meta: CdaHdMeta) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            if let description = meta.description, !description.isEmpty {
                Text(description)
                    .font(NostalgieFont.body)
                    .foregroundStyle(.white.opacity(0.84))
                    .lineSpacing(4)
            }

            if let creators = meta.creators, !creators.isEmpty {
                CdaHdLinkRow(label: "Twórca", links: creators, onTap: openBrowse(link:))
            }

            if let cast = meta.cast, !cast.isEmpty {
                MusicSectionHeader(title: "Obsada")
                VStack(spacing: NostalgieSpacing.listRow) {
                    ForEach(cast) { person in
                        CdaHdCastRow(name: person.name) {
                            openBrowse(title: person.name, url: person.url)
                        }
                    }
                }
            }

            if let photos = meta.photos, !photos.isEmpty {
                CdaHdPhotoShelf(photos: photos)
            }
        }
        .padding(.vertical, 8)
    }

    // MARK: - Season picker

    private var seasonPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Sezon")
                .font(NostalgieFont.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.6)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(seasonSections.enumerated()), id: \.element.id) { index, season in
                        Button {
                            selectedSeasonIndex = index
                            selectedEpisodeIDs.removeAll()
                            if let first = season.episodes.first {
                                localFocus = .episode(first.id)
                            }
                        } label: {
                            Text(season.title)
                                .lineLimit(1)
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: selectedSeasonIndex == index))
                        .focusEffectDisabled()
                        .focused($localFocus, equals: .season(index))
                        .onMoveCommand { direction in
                            if direction == .down, let first = (index == selectedSeasonIndex ? visibleEpisodes : season.episodes).first {
                                localFocus = .episode(first.id)
                            } else if direction == .up {
                                localFocus = .favorite
                            }
                        }
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .focusSection()
    }

    // MARK: - Actions

    private func episodesTotalDuration(_ episodes: [EpisodeItem]) -> Double {
        let sum = episodes.reduce(0.0) { $0 + ($1.duration ?? 0) }
        if sum > 0 { return sum }
        return Double(episodes.count) * 45 * 60
    }

    private func prepareDownload(episodes: [EpisodeItem]) {
        let pending = episodes.filter { !isEpisodeDownloaded($0) }
        guard !pending.isEmpty else { return }
        isSelectionMode = false
        selectedEpisodeIDs.removeAll()
        pendingDownloadEpisodes = pending
        showDownloadSheet = true
    }

    private func startDownloadBatch(
        episodes: [EpisodeItem],
        format: MediaDownloadFormat,
        quality: MediaQualityOption
    ) {
        pendingDownloadEpisodes = nil
        let options = info.qualityOptions(for: format)
        let items = episodes.map { episode in
            MovieDownloadQueueItem(
                url: episode.url,
                title: "\(displayTitle) · \(episode.title)",
                thumbnail: episode.thumbnail ?? info.thumbnail,
                source: info.uploader ?? info.source
            )
        }
        downloadService.startBatch(
            items: items,
            label: displayTitle,
            thumbnail: info.thumbnail ?? cdaMeta?.thumbnail,
            contextKey: info.webpageUrl,
            format: format,
            quality: quality,
            allQualityOptions: options
        )
    }

    private func deleteEpisodeDownload(_ episode: EpisodeItem) async {
        deletingEpisodeURL = episode.url
        defer { deletingEpisodeURL = nil }
        try? await downloadService.deleteDownload(url: episode.url)
    }

    private func toggleEpisodeSelection(_ episode: EpisodeItem) {
        if selectedEpisodeIDs.contains(episode.id) {
            selectedEpisodeIDs.remove(episode.id)
        } else {
            selectedEpisodeIDs.insert(episode.id)
        }
    }

    private func isEpisodeDownloaded(_ episode: EpisodeItem) -> Bool {
        if app.isMovieDownloaded(url: episode.url) { return true }
        if case .done = downloadService.itemState(for: episode.url) { return true }
        return false
    }

    private func openBrowse(link: CdaHdLink) {
        browseContext = CdaHdBrowseContext(title: link.name, pageURL: link.url)
    }

    private func openBrowse(title: String, url: String) {
        browseContext = CdaHdBrowseContext(title: title, pageURL: url)
    }

    private func toggleSeriesFavorite() async {
        let item = MediaSelection(from: info).favoriteItem
        do {
            if app.isFavorite(info.webpageUrl) {
                try await app.removeFavorite(url: info.webpageUrl)
            } else {
                try await app.addFavorite(item)
            }
        } catch {
            /* ignore */
        }
    }

    private func playEpisode(_ episode: EpisodeItem) async {
        guard playingEpisodeID == nil else { return }
        playingEpisodeID = episode.id
        defer { playingEpisodeID = nil }
        for attempt in 0..<2 {
            do {
                if let jobId = app.movieDownloadJobId(for: episode.url) {
                    let token = try await app.api.moviePlayToken(jobId: jobId)
                    let url = app.api.movieStreamURL(jobId: jobId, token: token.token)
                    let session = PlaybackSession(jobId: jobId, streamURL: url, token: token.token)
                    playbackContext = MediaPlaybackContext(
                        sourceURL: episode.url,
                        title: episode.title,
                        streamOptions: info.effectiveStreamOptions,
                        session: session,
                        selectedQualityID: info.defaultStreamQualityID()
                    )
                    return
                }

                var episodeInfo: VideoInfoResponse?
                do {
                    episodeInfo = try await app.api.fetchInfo(url: episode.url)
                } catch {
                    episodeInfo = nil
                }
                let context = try await MediaPlaybackLauncher.startPlayback(
                    api: app.api,
                    url: episode.url,
                    title: episode.title,
                    info: episodeInfo ?? info
                )
                playbackContext = context
                return
            } catch {
                if attempt == 0 {
                    try? await Task.sleep(nanoseconds: 600_000_000)
                    continue
                }
                playError = error.localizedDescription
            }
        }
    }
}

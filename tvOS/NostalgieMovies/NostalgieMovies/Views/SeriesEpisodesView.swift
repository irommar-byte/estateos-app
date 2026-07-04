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
}

struct SeriesEpisodesView: View {
    @EnvironmentObject private var app: AppModel

    let info: VideoInfoResponse
    var backLabel: String = "Wróć"
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    let onBack: () -> Void

    @State private var selectedDetail: MediaSelection?
    @State private var playbackSession: PlaybackSession?
    @State private var playError: String?
    @State private var playingEpisodeID: String?
    @State private var selectedSeasonIndex = 0
    @State private var gridColumnCount = 4
    @FocusState private var localFocus: SeriesFocus?

    private let cardMinimum: CGFloat = 340
    private let gridSpacing: CGFloat = 40
    private let columns = [GridItem(.adaptive(minimum: 340, maximum: 380), spacing: 40)]

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

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                toolbar
                metadataRow
                ScreenTitle(title: info.title, subtitle: seasonSubtitle)

                if seasonSections.count > 1 {
                    seasonPicker
                }

                GridColumnReader(minimumCardWidth: cardMinimum, spacing: gridSpacing, columnCount: $gridColumnCount)

                if let season = selectedSeason {
                    if season.episodes.isEmpty {
                        Text("Brak odcinków w tym sezonie.")
                            .foregroundStyle(.secondary)
                    } else {
                        episodeGrid(season.episodes)
                    }
                } else {
                    Text("Nie znaleziono odcinków.")
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, NostalgieSpacing.screenH)
            .padding(.bottom, NostalgieSpacing.scrollBottom)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .onExitCommand { onBack() }
        .onAppear {
            selectedSeasonIndex = 0
        }
        .fullScreenCover(item: $selectedDetail) { detail in
            MediaDetailView(selection: detail)
                .environmentObject(app)
        }
        .fullScreenCover(item: $playbackSession) { session in
            PlayerScreen(session: session)
        }
        .alert("Odtwarzanie", isPresented: Binding(
            get: { playError != nil },
            set: { if !$0 { playError = nil } }
        )) {
            Button("OK", role: .cancel) { playError = nil }
        } message: {
            Text(playError ?? "")
        }
    }

    private var toolbar: some View {
        HStack(spacing: 16) {
            Button(action: onBack) {
                Label(backLabel, systemImage: "chevron.left")
            }
            .buttonStyle(FocusCardButtonStyle())
            .focused($localFocus, equals: .back)
            .onMoveCommand { direction in
                if direction == .up {
                    focusedTab.wrappedValue = navigationTab
                }
            }

            Button {
                Task { await toggleSeriesFavorite() }
            } label: {
                Label(
                    app.isFavorite(info.webpageUrl) ? "W ulubionych" : "Dodaj serial",
                    systemImage: app.isFavorite(info.webpageUrl) ? "heart.fill" : "heart"
                )
            }
            .buttonStyle(FocusCardButtonStyle())
            .focused($localFocus, equals: .favorite)
            .onMoveCommand { direction in
                if direction == .up {
                    focusedTab.wrappedValue = navigationTab
                }
            }

            Spacer()
        }
    }

    private var metadataRow: some View {
        HStack(spacing: 12) {
            SourceBadgeView(source: MediaCardCopy.normalizedSourceKey(info.uploader))
            Text("SERIAL · \(info.seasons?.count ?? seasonSections.count) sez. · \(info.episodeCount ?? info.playableEpisodes.count) odc.")
                .font(NostalgieFont.metadata)
                .foregroundStyle(.secondary)
        }
    }

    private var seasonSubtitle: String {
        guard let season = selectedSeason else { return "Wybierz odcinek" }
        if seasonSections.count > 1 {
            return "\(season.title) · \(season.episodes.count) odcinków"
        }
        return "Wybierz odcinek · \(season.episodes.count) łącznie"
    }

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
                        } label: {
                            Text("Sezon \(season.number)")
                                .lineLimit(1)
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: selectedSeasonIndex == index))
                        .focused($localFocus, equals: .season(index))
                        .onMoveCommand { direction in
                            if direction == .up {
                                localFocus = .back
                            }
                        }
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private func focusTargetAboveGrid() {
        if seasonSections.count > 1 {
            localFocus = .season(selectedSeasonIndex)
        } else {
            localFocus = .back
        }
    }

    @ViewBuilder
    private func episodeGrid(_ episodes: [EpisodeItem]) -> some View {
        LazyVGrid(columns: columns, spacing: gridSpacing) {
            ForEach(Array(episodes.enumerated()), id: \.element.id) { index, episode in
                MediaCard(
                    title: episode.title,
                    subtitle: episodeSubtitle(episode),
                    thumbnailURL: (episode.thumbnail ?? info.thumbnail).flatMap(URL.init(string:)),
                    source: MediaCardCopy.normalizedSourceKey(info.uploader),
                    typeLabel: "ODC.",
                    quality: nil,
                    duration: episode.duration,
                    isFavorite: app.isFavorite(episode.url),
                    isLoading: playingEpisodeID == episode.id
                ) {
                    Task { await playEpisode(episode) }
                }
                .onGridMoveUp(isTopRow: index < gridColumnCount) {
                    focusTargetAboveGrid()
                }
            }
        }
        .padding(.top, 4)
    }

    private func episodeSubtitle(_ episode: EpisodeItem) -> String {
        if let sn = episode.seasonNumber, let en = episode.episodeNumber {
            return "Sezon \(sn) · Odcinek \(en)"
        }
        return MediaSourceMeta.normalize(info.uploader).label
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
                let preview = try await app.api.startPreview(url: episode.url)
                if preview.instant == false {
                    try await app.api.waitForPreviewReady(jobId: preview.jobId)
                }
                let token = try await app.api.playToken(jobId: preview.jobId)
                let url = app.api.streamURL(jobId: token.jobId, token: token.token)
                playbackSession = PlaybackSession(jobId: token.jobId, streamURL: url, token: token.token)
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

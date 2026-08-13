import SwiftUI

struct OnlineMovieDetailView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @Environment(\.dismiss) private var dismiss

    let selection: OnlineMovieSelection

    @State private var info: VideoInfoResponse?
    @State private var isLoadingInfo = false
    @State private var infoError: String?
    @State private var showDownloadSheet = false
    @State private var showSeriesEpisodes = false
    @State private var actorSelection: OnlineMoviesActorSelection?

    private var movies: OnlineMoviesController { app.onlineMovies }
    private var downloads: MovieDownloadService { app.movieDownloads }
    private var transfer: OnlineMovieTransferState { movies.transferState(for: selection.url) }
    private var meta: CdaHdMeta? { info?.cdaHd }

    private var displayTitle: String {
        meta?.title ?? selection.title
    }

    private var posterURL: URL? {
        (meta?.thumbnail ?? info?.thumbnail ?? selection.thumbnail).flatMap(URL.init(string:))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero

                VStack(alignment: .leading, spacing: 18) {
                    actionButtons

                    if transfer.isBusy {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 8) {
                                OnlineMovieTransferBadge(state: transfer)
                                Text(transferLabel)
                                    .font(EOSTypography.caption.weight(.semibold))
                                Spacer(minLength: 0)
                                Button("Anuluj") { movies.cancelTransfer(url: selection.url) }
                                    .font(EOSTypography.caption.weight(.semibold))
                            }
                            ProgressView(value: transfer.progressPercent, total: 100)
                                .tint(EOSTheme.accent)
                        }
                    }

                    if case .failed(let message) = transfer {
                        Text(message).font(EOSTypography.caption).foregroundStyle(.red)
                    }

                    descriptionBlock
                    castBlock

                    if let info, info.isSeries, !info.playableEpisodes.isEmpty {
                        seriesShortcut(info)
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.visible)
        .eosScrollClearance()
        .background(Color(.systemBackground))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $showSeriesEpisodes) {
            if let info {
                OnlineSeriesEpisodesView(info: info)
                    .environmentObject(app)
                    .environmentObject(video)
            }
        }
        .navigationDestination(item: $actorSelection) { actor in
            OnlineMoviesActorResultsView(actorName: actor.name)
                .environmentObject(app)
                .environmentObject(video)
        }
        .sheet(isPresented: $showDownloadSheet) {
            if let info {
                MediaDownloadOptionsSheet(
                    title: displayTitle,
                    info: info,
                    itemCount: 1,
                    totalDuration: info.duration,
                    itemsSubtitle: "1 pozycja · folder MOVIES/ na serwerze"
                ) { format, quality, destination in
                    startSingleDownload(format: format, quality: quality, destination: destination)
                }
            }
        }
        .task {
            await loadInfo()
            await movies.refreshDownloads()
        }
    }

    private var hero: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottomLeading) {
                OnlineMovieBackdrop(url: posterURL)
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()

                LinearGradient(
                    colors: [.clear, Color(.systemBackground).opacity(0.85), Color(.systemBackground)],
                    startPoint: .top,
                    endPoint: .bottom
                )

                VStack(alignment: .leading, spacing: 8) {
                    Text(EOSLibraryBrand.displayName)
                        .font(EOSTypography.captionBold)
                        .tracking(1.1)
                        .foregroundStyle(EOSTheme.accent)
                    Text(displayTitle)
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .lineLimit(3)
                        .minimumScaleFactor(0.85)
                    metaChips
                }
                .padding(20)
                .frame(maxWidth: geo.size.width, alignment: .leading)
            }
        }
        .frame(height: min(360, UIScreen.main.bounds.height * 0.42))
        .frame(maxWidth: .infinity)
        .clipped()
    }

    @ViewBuilder
    private var metaChips: some View {
        HStack(spacing: 8) {
            if let year = meta?.year { chip("\(year)") }
            if let duration = meta?.duration ?? selection.duration, duration > 0 {
                chip(formatDuration(duration))
            }
            if selection.isSerial || info?.isSeries == true { chip("Serial") }
            if let rating = meta?.rating?.value, rating > 0 {
                chip(String(format: "%.1f ★", rating))
            }
            OnlineMovieTransferBadge(state: transfer)
        }
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(EOSTypography.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.ultraThinMaterial, in: Capsule())
    }

    private var actionButtons: some View {
        VStack(spacing: 10) {
            if let info, info.isSeries, !info.playableEpisodes.isEmpty {
                Button {
                    showSeriesEpisodes = true
                } label: {
                    Label("Odcinki i sezony", systemImage: "list.bullet.rectangle.portrait")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(OnlineMoviePrimaryButton())
            } else {
                Button {
                    movies.watchStream(selection: selection, height: 720, video: video)
                } label: {
                    Label(movies.isPreparingStream ? "Uruchamiam…" : "Oglądaj", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(OnlineMoviePrimaryButton())
                .disabled(movies.isPreparingStream || transfer.isBusy)
            }

            if movies.isPreparingStream {
                ProgressView(value: movies.streamPrepareProgress, total: 100) {
                    Text("Przygotowuję stream…").font(EOSTypography.caption)
                }
                .tint(EOSTheme.accent)
                Button("Anuluj") { movies.cancelStreamPrepare() }
                    .font(EOSTypography.caption.weight(.semibold))
            }

            playbackButtons

            Button {
                if info != nil {
                    showDownloadSheet = true
                } else {
                    movies.downloadToServer(selection: selection)
                }
            } label: {
                Label("Pobierz", systemImage: "arrow.down.circle")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(OnlineMovieSecondaryButton(emphasized: true))
            .disabled(transfer.isBusy || movies.isPreparingStream || info == nil)
        }
    }

    @ViewBuilder
    private var playbackButtons: some View {
        if case .onPhone = transfer {
            Button { Task { await movies.playFromPhone(selection: selection, video: video) } } label: {
                Label("Odtwórz z telefonu", systemImage: "iphone").frame(maxWidth: .infinity)
            }
            .buttonStyle(OnlineMovieSecondaryButton())
        } else if case .onServer = transfer {
            Button { Task { await movies.playFromServer(selection: selection, video: video) } } label: {
                Label("Odtwórz z serwera", systemImage: "server.rack").frame(maxWidth: .infinity)
            }
            .buttonStyle(OnlineMovieSecondaryButton())
        }
    }

    @ViewBuilder
    private var descriptionBlock: some View {
        if let description = meta?.description, !description.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Opis").font(EOSTypography.headline)
                Text(description).font(EOSTypography.body).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else if isLoadingInfo {
            ProgressView("Wczytuję szczegóły…")
        } else if let infoError {
            Text(infoError).font(EOSTypography.caption).foregroundStyle(.orange)
        }
    }

    @ViewBuilder
    private var castBlock: some View {
        if let cast = meta?.cast, !cast.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Obsada")
                    .font(.system(.title3, design: .rounded, weight: .bold))
                    .tracking(0.3)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(cast.prefix(20)) { member in
                            Button {
                                actorSelection = OnlineMoviesActorSelection(name: member.name)
                            } label: {
                                OnlineMovieActorChip(name: member.name)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private func seriesShortcut(_ info: VideoInfoResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(info.playableEpisodes.count) odcinków · pobieraj sezon lub cały serial")
                .font(EOSTypography.caption)
                .foregroundStyle(.secondary)
            Button {
                showSeriesEpisodes = true
            } label: {
                Label("Otwórz listę odcinków", systemImage: "chevron.right")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(OnlineMovieSecondaryButton())
        }
    }

    private var transferLabel: String {
        switch transfer {
        case .acquiringServer(let p): return String(format: "Serwer · %.0f%%", p)
        case .downloadingPhone(let p): return String(format: "iPhone · %.0f%%", p)
        default: return "Pobieranie…"
        }
    }

    private func startSingleDownload(
        format: MediaDownloadFormat,
        quality: MediaQualityOption,
        destination: OnlineMovieDownloadDestination
    ) {
        guard let info else { return }
        let options = info.qualityOptions(for: format)
        let item = MovieDownloadQueueItem(
            url: selection.url,
            title: displayTitle,
            thumbnail: selection.thumbnail ?? info.thumbnail,
            source: selection.source
        )
        if destination == .serverAndPhone {
            movies.downloadToPhone(selection: selection, height: MediaQualityOption.apiHeight(for: quality, options: options), video: video)
            return
        }
        downloads.startBatch(
            items: [item],
            label: displayTitle,
            thumbnail: selection.thumbnail,
            contextKey: selection.url,
            format: format,
            quality: quality,
            destination: .server
        )
    }

    private func loadInfo() async {
        isLoadingInfo = true
        defer { isLoadingInfo = false }
        do {
            info = try await movies.fetchInfo(url: selection.url)
            infoError = nil
        } catch {
            infoError = error.localizedDescription
        }
    }

    private func formatDuration(_ seconds: Double) -> String {
        let total = Int(seconds.rounded())
        let h = total / 3600
        let m = (total % 3600) / 60
        if h > 0 { return "\(h) godz. \(m) min" }
        return "\(max(m, 1)) min"
    }
}

private struct OnlineMoviePrimaryButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(EOSTypography.headline)
            .padding(.vertical, 14)
            .foregroundStyle(.white)
            .background(EOSTheme.accent.opacity(configuration.isPressed ? 0.75 : 1), in: RoundedRectangle(cornerRadius: 14))
    }
}

struct OnlineMovieSecondaryButton: ButtonStyle {
    var emphasized = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(EOSTypography.subheadline.weight(.semibold))
            .padding(.vertical, 12)
            .foregroundStyle(emphasized ? .white : .primary)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(emphasized ? EOSTheme.accentSecondary.opacity(configuration.isPressed ? 0.7 : 1) : EOSTheme.card)
            )
    }
}

struct OnlineMovieBackdrop: View {
    let url: URL?
    @State private var image: UIImage?

    var body: some View {
        GeometryReader { geo in
            ZStack {
                LinearGradient(
                    colors: [EOSTheme.accent.opacity(0.35), EOSTheme.accentSecondary.opacity(0.4), .black.opacity(0.8)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height)
                        .clipped()
                } else {
                    Image(systemName: "film")
                        .font(.system(size: 42, weight: .medium))
                        .foregroundStyle(.white.opacity(0.55))
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipped()
        }
        .clipped()
        .task(id: url?.absoluteString) {
            guard let url else { image = nil; return }
            if let cached = RemoteImageCache.image(for: url, maxPixelSize: 900) {
                image = cached
                return
            }
            do {
                var request = URLRequest(url: url)
                request.timeoutInterval = 25
                let (data, _) = try await URLSession.shared.data(for: request)
                if let ui = UIImage(data: data) {
                    RemoteImageCache.store(ui, for: url, maxPixelSize: 900)
                    image = ui
                }
            } catch {
                image = nil
            }
        }
    }
}

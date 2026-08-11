import SwiftUI

struct OnlineMovieDetailView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @Environment(\.dismiss) private var dismiss

    let selection: OnlineMovieSelection

    @State private var info: VideoInfoResponse?
    @State private var isLoadingInfo = false
    @State private var infoError: String?
    @State private var selectedHeight = 720

    private var movies: OnlineMoviesController { app.onlineMovies }
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
                ZStack(alignment: .bottomLeading) {
                    OnlineMovieBackdrop(url: posterURL)
                        .frame(height: 360)
                        .frame(maxWidth: .infinity)
                        .clipped()

                    LinearGradient(
                        colors: [.clear, Color(.systemBackground).opacity(0.85), Color(.systemBackground)],
                        startPoint: .top,
                        endPoint: .bottom
                    )

                    VStack(alignment: .leading, spacing: 8) {
                        Text("CDA-HD")
                            .font(EOSTypography.captionBold)
                            .tracking(1.1)
                            .foregroundStyle(EOSTheme.accent)
                        Text(displayTitle)
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundStyle(.primary)
                        metaChips
                    }
                    .padding(20)
                }

                VStack(alignment: .leading, spacing: 18) {
                    actionButtons

                    if transfer.isBusy {
                        ProgressView(value: transfer.progressPercent, total: 100) {
                            Text(transferLabel)
                                .font(EOSTypography.caption)
                        }
                        .tint(EOSTheme.accent)
                        Button("Anuluj") {
                            movies.cancelTransfer(url: selection.url)
                        }
                        .font(EOSTypography.caption.weight(.semibold))
                    }

                    if case .failed(let message) = transfer {
                        Text(message)
                            .font(EOSTypography.caption)
                            .foregroundStyle(.red)
                    }

                    if let description = meta?.description, !description.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Opis")
                                .font(EOSTypography.headline)
                            Text(description)
                                .font(EOSTypography.body)
                                .foregroundStyle(.secondary)
                        }
                    } else if isLoadingInfo {
                        ProgressView("Wczytuję szczegóły…")
                    } else if let infoError {
                        Text(infoError)
                            .font(EOSTypography.caption)
                            .foregroundStyle(.orange)
                    }

                    if let cast = meta?.cast, !cast.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Obsada")
                                .font(EOSTypography.headline)
                            Text(cast.prefix(12).map(\.name).joined(separator: " · "))
                                .font(EOSTypography.callout)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if let info, info.isSeries, !info.playableEpisodes.isEmpty {
                        episodesSection(info)
                    }

                    qualityPicker
                }
                .padding(20)
            }
        }
        .background(Color(.systemBackground))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadInfo()
            await movies.refreshDownloads()
        }
    }

    @ViewBuilder
    private var metaChips: some View {
        HStack(spacing: 8) {
            if let year = meta?.year {
                chip("\(year)")
            }
            if let duration = meta?.duration ?? selection.duration, duration > 0 {
                chip(formatDuration(duration))
            }
            if selection.isSerial || info?.isSeries == true {
                chip("Serial")
            }
            if let rating = meta?.rating?.value, rating > 0 {
                chip(String(format: "%.1f ★", rating))
            }
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
            if case .onPhone = transfer {
                Button {
                    Task { await movies.playFromPhone(selection: selection, video: video) }
                } label: {
                    Label("Odtwórz z telefonu", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(OnlineMoviePrimaryButton())
            } else if case .onServer = transfer {
                Button {
                    Task { await movies.playFromServer(selection: selection, video: video) }
                } label: {
                    Label("Odtwórz z serwera", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(OnlineMoviePrimaryButton())
            }

            HStack(spacing: 10) {
                Button {
                    movies.downloadToServer(selection: selection, height: selectedHeight)
                } label: {
                    Label("Na serwer", systemImage: "server.rack")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(OnlineMovieSecondaryButton())
                .disabled(transfer.isBusy)

                Button {
                    movies.downloadToPhone(selection: selection, height: selectedHeight, video: video)
                } label: {
                    Label("Na iPhone", systemImage: "iphone.and.arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(OnlineMovieSecondaryButton(emphasized: true))
                .disabled(transfer.isBusy)
            }
        }
    }

    private var qualityPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Jakość pobierania")
                .font(EOSTypography.headline)
            Picker("Jakość", selection: $selectedHeight) {
                Text("480p").tag(480)
                Text("720p").tag(720)
                Text("1080p").tag(1080)
                Text("Najlepsza").tag(0)
            }
            .pickerStyle(.segmented)
        }
    }

    private func episodesSection(_ info: VideoInfoResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Odcinki")
                .font(EOSTypography.headline)

            if let seasons = info.seasons, !seasons.isEmpty {
                ForEach(seasons) { season in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(season.title ?? "Sezon \(season.seasonNumber ?? 0)")
                            .font(EOSTypography.subheadline.weight(.semibold))
                        ForEach(season.episodes ?? []) { episode in
                            episodeRow(episode)
                        }
                    }
                }
            } else {
                ForEach(info.playableEpisodes) { episode in
                    episodeRow(episode)
                }
            }
        }
    }

    private func episodeRow(_ episode: EpisodeItem) -> some View {
        let epSelection = OnlineMovieSelection(episode: episode, source: selection.source)
        return HStack(spacing: 12) {
            OnlineMovieBackdrop(url: episode.thumbnail.flatMap(URL.init(string:)))
                .frame(width: 72, height: 44)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(episode.title)
                    .font(EOSTypography.subheadline.weight(.semibold))
                    .lineLimit(2)
                if let duration = episode.duration, duration > 0 {
                    Text(formatDuration(duration))
                        .font(EOSTypography.caption2Medium)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Menu {
                Button("Na serwer") {
                    movies.downloadToServer(selection: epSelection, height: selectedHeight)
                }
                Button("Na iPhone") {
                    movies.downloadToPhone(selection: epSelection, height: selectedHeight, video: video)
                }
            } label: {
                Image(systemName: "arrow.down.circle")
                    .font(.title3)
                    .foregroundStyle(EOSTheme.accent)
            }
        }
        .padding(10)
        .background(EOSTheme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var transferLabel: String {
        switch transfer {
        case .acquiringServer(let p):
            return String(format: "Serwer · %.0f%%", p)
        case .downloadingPhone(let p):
            return String(format: "iPhone · %.0f%%", p)
        default:
            return "Pobieranie…"
        }
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
            .background(EOSTheme.accent.opacity(configuration.isPressed ? 0.75 : 1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct OnlineMovieSecondaryButton: ButtonStyle {
    var emphasized = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(EOSTypography.subheadline.weight(.semibold))
            .padding(.vertical, 12)
            .foregroundStyle(emphasized ? .white : .primary)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(emphasized ? EOSTheme.accentSecondary.opacity(configuration.isPressed ? 0.7 : 1) : EOSTheme.card)
            )
            .overlay {
                if !emphasized {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.primary.opacity(0.08), lineWidth: 1)
                }
            }
    }
}

struct OnlineMovieBackdrop: View {
    let url: URL?
    @State private var image: UIImage?

    var body: some View {
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
            } else {
                Image(systemName: "film")
                    .font(.system(size: 42, weight: .medium))
                    .foregroundStyle(.white.opacity(0.55))
            }
        }
        .task(id: url?.absoluteString) {
            guard let url else {
                image = nil
                return
            }
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

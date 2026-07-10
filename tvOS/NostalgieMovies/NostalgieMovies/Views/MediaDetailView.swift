import SwiftUI

struct MediaDetailView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let selection: MediaSelection
    let onOpenEpisodes: (() -> Void)?

    @State private var playbackContext: MediaPlaybackContext?
    @State private var showDownloadOptions = false
    @State private var statusMessage: String?
    @State private var statusIsError = false
    @State private var isFavorite: Bool
    @State private var isBusy = false
    @State private var mediaInfo: VideoInfoResponse?
    @State private var isLoadingInfo = false
    @State private var infoError: String?
    @State private var detailTab: CdaHdDetailTab = .description
    @State private var browseContext: CdaHdBrowseContext?
    @State private var localDownloadJobId: String?

    private enum CdaHdDetailTab: String, CaseIterable {
        case description = "Opis filmu"
        case cast = "Obsada"
    }

    init(selection: MediaSelection, onOpenEpisodes: (() -> Void)? = nil) {
        self.selection = selection
        self.onOpenEpisodes = onOpenEpisodes
        _isFavorite = State(initialValue: false)
    }

    private var cdaMeta: CdaHdMeta? { mediaInfo?.cdaHd }
    private var isCdaHdDetail: Bool { cdaMeta != nil || isCdaHdSource }

    private var isCdaHdSource: Bool {
        if case .cdaHd = MediaSourceMeta.normalize(selection.source) { return true }
        return false
    }

    private var displayTitle: String {
        MediaCardCopy.decodedTitle(cdaMeta?.title ?? selection.title)
    }

    private var displayDuration: Double? {
        if let duration = cdaMeta?.duration, duration > 0 { return duration }
        if let duration = mediaInfo?.duration, duration > 0 { return duration }
        if let duration = selection.duration, duration > 0 { return duration }
        return nil
    }

    private var effectiveDownloadJobId: String? {
        if let localDownloadJobId, !localDownloadJobId.isEmpty { return localDownloadJobId }
        return app.movieDownloadJobId(for: selection.url)
    }

    private var isDownloaded: Bool {
        effectiveDownloadJobId != nil
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            DetailBackdrop(url: backdropURL)

            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 0)

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 22) {
                        metadataRow
                        titleBlock

                        if isCdaHdDetail {
                            cdaHdMetaSection
                            cdaHdTabs
                            cdaHdTabContent
                        }

                        if let statusMessage {
                            statusBanner(statusMessage, isError: statusIsError)
                        }
                        if let infoError, cdaMeta == nil {
                            statusBanner(infoError, isError: true)
                        }

                        actionToolbar
                        serialHint
                    }
                    .frame(maxWidth: 1120, alignment: .leading)
                    .padding(.horizontal, NostalgieSpacing.screenH)
                    .padding(.bottom, 68)
                }
            }
        }
        .ignoresSafeArea()
        .onExitCommand { dismiss() }
        .task {
            isFavorite = app.isFavorite(selection.url)
            localDownloadJobId = app.movieDownloadJobId(for: selection.url)
            if !selection.isSerial {
                await loadMediaInfo()
            }
        }
        .onChange(of: app.movieDownloads) { _, _ in
            localDownloadJobId = app.movieDownloadJobId(for: selection.url)
        }
        .fullScreenCover(item: $playbackContext) { context in
            PlayerScreen(context: context)
        }
        .sheet(isPresented: $showDownloadOptions) {
            if let mediaInfo {
                MediaDownloadOptionsSheet(
                    title: displayTitle,
                    info: mediaInfo,
                    itemCount: 1,
                    totalDuration: displayDuration,
                    itemsSubtitle: "1 film · wybierz jakość przed pobraniem"
                ) { format, quality in
                    startDownload(format: format, quality: quality)
                }
            }
        }
        .fullScreenCover(item: $browseContext) { context in
            CdaHdBrowseView(context: context)
                .environmentObject(app)
        }
    }

    private var downloadService: MovieDownloadService { app.movieDownloadService }

    private var backdropURL: URL? {
        if let thumb = cdaMeta?.thumbnail ?? mediaInfo?.thumbnail ?? selection.thumbnail {
            return URL(string: thumb)
        }
        return nil
    }

    @ViewBuilder
    private var cdaHdMetaSection: some View {
        if let cdaMeta {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    if let year = cdaMeta.year {
                        metaChip("\(year)")
                    }
                    if let duration = displayDuration {
                        metaChip(formatDuration(duration), icon: "clock")
                    }
                }

                if let genres = cdaMeta.genres, !genres.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(genres) { genre in
                                CdaHdLinkChip(title: genre.name, icon: "tag.fill") {
                                    openBrowse(title: genre.name, url: genre.url)
                                }
                            }
                        }
                    }
                }

                if let rating = cdaMeta.rating, (rating.value ?? 0) > 0 {
                    CdaHdRatingView(rating: rating)
                }

                if let director = cdaMeta.director {
                    HStack(spacing: 10) {
                        Label("Reżyser", systemImage: "megaphone.fill")
                            .font(NostalgieFont.caption)
                            .foregroundStyle(.white.opacity(0.55))
                        CdaHdLinkChip(title: director.name, icon: "person.crop.circle") {
                            openBrowse(title: director.name, url: director.url)
                        }
                    }
                }

                if let country = cdaMeta.country, !country.isEmpty {
                    Label(country, systemImage: "globe")
                        .font(NostalgieFont.metadata)
                        .foregroundStyle(.white.opacity(0.62))
                }
            }
        } else if isLoadingInfo {
            ProgressView("Wczytuję opis filmu…")
        }
    }

    @ViewBuilder
    private var cdaHdTabs: some View {
        if cdaMeta != nil {
            HStack(spacing: 12) {
                ForEach(CdaHdDetailTab.allCases, id: \.self) { tab in
                    Button(tab.rawValue) {
                        withAnimation(NostalgieTheme.contentSpring) {
                            detailTab = tab
                        }
                    }
                    .buttonStyle(DetailToolbarButtonStyle(isSelected: detailTab == tab))
                }
            }
        }
    }

    @ViewBuilder
    private var cdaHdTabContent: some View {
        if let cdaMeta {
            switch detailTab {
            case .description:
                if let description = cdaMeta.description, !description.isEmpty {
                    Text(description)
                        .font(NostalgieFont.body)
                        .foregroundStyle(.white.opacity(0.82))
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text("Brak opisu filmu.")
                        .font(NostalgieFont.metadata)
                        .foregroundStyle(.secondary)
                }
            case .cast:
                if let cast = cdaMeta.cast, !cast.isEmpty {
                    VStack(spacing: NostalgieSpacing.listRow) {
                        ForEach(cast) { person in
                            CdaHdCastRow(name: person.name) {
                                openBrowse(title: person.name, url: person.url)
                            }
                        }
                    }
                } else {
                    Text("Brak listy obsady.")
                        .font(NostalgieFont.metadata)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func metaChip(_ text: String, icon: String? = nil) -> some View {
        Group {
            if let icon {
                Label(text, systemImage: icon)
            } else {
                Text(text)
            }
        }
        .font(NostalgieFont.caption)
        .foregroundStyle(.white.opacity(0.88))
        .glassCapsule(paddingH: 12, paddingV: 7)
    }

    private func openBrowse(title: String, url: String) {
        browseContext = CdaHdBrowseContext(title: title, pageURL: url)
    }

    private func loadMediaInfo() async {
        isLoadingInfo = true
        infoError = nil
        defer { isLoadingInfo = false }
        do {
            mediaInfo = try await app.api.fetchInfo(url: selection.url)
        } catch {
            infoError = error.localizedDescription
        }
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(displayTitle)
                .font(NostalgieFont.hero)
                .lineLimit(3)
                .minimumScaleFactor(0.72)
                .shadow(color: .black.opacity(0.45), radius: 12, y: 4)

            if let subtitle = cdaMeta?.subtitle, !subtitle.isEmpty {
                Text(MediaCardCopy.decodedTitle(subtitle))
                    .font(NostalgieFont.sectionTitle)
                    .foregroundStyle(.white.opacity(0.78))
                    .lineLimit(2)
            }

            HStack(spacing: 8) {
                if let detail = selection.detail, !detail.isEmpty, cdaMeta == nil {
                    Text(MediaCardCopy.cleanedSubtitle(detail: detail, source: selection.source))
                }
                if let duration = displayDuration {
                    if selection.detail != nil || cdaMeta != nil { Text("·").foregroundStyle(.secondary) }
                    Text(formatDuration(duration))
                }
            }
            .font(NostalgieFont.metadata)
            .foregroundStyle(.white.opacity(0.72))
            .lineLimit(2)
        }
    }

    private var metadataRow: some View {
        HStack(spacing: 12) {
            SourceBadgeView(source: MediaCardCopy.normalizedSourceKey(selection.source))
            if selection.isPremium {
                PremiumBadge()
            }
            MediaTypeBadge(label: typeBadgeLabel)
            if let quality = mediaInfo?.quality ?? selection.quality, !quality.isEmpty {
                Text(quality.uppercased())
                    .font(NostalgieFont.caption)
                    .tracking(0.6)
                    .foregroundStyle(.white.opacity(0.9))
                    .glassCapsule(paddingH: 10, paddingV: 6)
            }
            if isFavorite {
                Label("Ulubione", systemImage: "heart.fill")
                    .font(NostalgieFont.caption)
                    .foregroundStyle(NostalgieTheme.accent)
                    .glassCapsule(paddingH: 10, paddingV: 6)
            }
            if isDownloaded {
                Label("Pobrany", systemImage: "checkmark.circle.fill")
                    .font(NostalgieFont.caption)
                    .foregroundStyle(.green)
                    .glassCapsule(paddingH: 10, paddingV: 6)
            }
        }
    }

    private var typeBadgeLabel: String {
        if selection.isEpisode { return "ODCINEK" }
        if selection.isSerial { return "SERIAL" }
        return "FILM"
    }

    private func statusBanner(_ message: String, isError: Bool) -> some View {
        HStack(spacing: 10) {
            Image(systemName: isError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .foregroundStyle(isError ? Color.orange : NostalgieTheme.accent)
            Text(message)
                .font(NostalgieFont.body)
                .foregroundStyle(.white.opacity(0.85))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var actionToolbar: some View {
        HStack(spacing: 22) {
            Button {
                Task { await play() }
            } label: {
                Label("Odtwórz", systemImage: "play.fill")
                    .font(NostalgieFont.rounded(.title3, weight: .semibold))
            }
            .buttonStyle(DetailPlayButtonStyle())
            .disabled(isBusy)

            if selection.isSerial, onOpenEpisodes != nil {
                toolbarButton(title: "Odcinki", icon: "list.bullet") {
                    onOpenEpisodes?()
                    dismiss()
                }
            }

            toolbarButton(
                title: isFavorite ? "W ulubionych" : "Dodaj do ulubionych",
                icon: isFavorite ? "heart.fill" : "heart"
            ) {
                Task { await toggleFavorite() }
            }

            if isDownloaded {
                MediaDownloadedBadge()
                toolbarButton(title: "Usuń z dysku", icon: "trash") {
                    Task { await deleteDownloaded() }
                }
            } else if downloadService.isRunning && downloadService.batchMatches(contextKey: selection.url) {
                Label("Pobieranie…", systemImage: "arrow.down.circle")
                    .font(NostalgieFont.rowTitle)
                    .foregroundStyle(.green)
            } else {
                toolbarButton(title: "Pobierz", icon: "arrow.down.circle") {
                    if mediaInfo != nil {
                        showDownloadOptions = true
                    } else {
                        Task {
                            await loadMediaInfo()
                            if mediaInfo != nil { showDownloadOptions = true }
                        }
                    }
                }
                .disabled(selection.isSerial && onOpenEpisodes != nil)
            }
        }
    }

    @ViewBuilder
    private var serialHint: some View {
        if selection.isSerial, onOpenEpisodes != nil {
            Text("Aby pobrać serial, wybierz odcinek z listy.")
                .font(NostalgieFont.metadata)
                .foregroundStyle(.white.opacity(0.55))
                .padding(.top, 4)
        }
    }

    private func toolbarButton(title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(NostalgieFont.rowTitle)
        }
        .buttonStyle(DetailToolbarButtonStyle())
    }

    private func play() async {
        isBusy = true
        statusMessage = nil
        statusIsError = false
        defer { isBusy = false }
        do {
            if let jobId = effectiveDownloadJobId {
                let token = try await app.api.moviePlayToken(jobId: jobId)
                let url = app.api.movieStreamURL(jobId: jobId, token: token.token)
                let session = PlaybackSession(jobId: jobId, streamURL: url, token: token.token)
                playbackContext = MediaPlaybackContext(
                    sourceURL: selection.url,
                    title: displayTitle,
                    streamOptions: mediaInfo?.effectiveStreamOptions ?? MediaQualityOption.defaultStreamTiers(duration: displayDuration),
                    session: session,
                    selectedQualityID: mediaInfo?.defaultStreamQualityID() ?? "720"
                )
                return
            }

            if mediaInfo == nil {
                await loadMediaInfo()
            }
            statusIsError = false
            statusMessage = "Przygotowuję odtwarzanie…"
            let context = try await MediaPlaybackLauncher.startPlayback(
                api: app.api,
                url: selection.url,
                title: displayTitle,
                info: mediaInfo
            )
            statusMessage = nil
            playbackContext = context
        } catch {
            statusIsError = true
            statusMessage = error.localizedDescription
        }
    }

    private func toggleFavorite() async {
        do {
            if isFavorite {
                try await app.removeFavorite(url: selection.url)
                isFavorite = false
                statusIsError = false
                statusMessage = "Usunięto z ulubionych."
            } else {
                try await app.addFavorite(selection.favoriteItem)
                isFavorite = true
                statusIsError = false
                statusMessage = selection.isSerial ? "Serial dodany do ulubionych." : "Dodano do ulubionych."
            }
        } catch {
            statusIsError = true
            statusMessage = error.localizedDescription
        }
    }

    private func startDownload(format: MediaDownloadFormat, quality: MediaQualityOption) {
        statusMessage = nil
        statusIsError = false
        guard let mediaInfo else { return }
        let options = mediaInfo.qualityOptions(for: format)
        let item = MovieDownloadQueueItem(
            url: selection.url,
            title: displayTitle,
            thumbnail: selection.thumbnail ?? mediaInfo.thumbnail ?? cdaMeta?.thumbnail,
            source: selection.source
        )
        downloadService.startBatch(
            items: [item],
            label: displayTitle,
            thumbnail: selection.thumbnail ?? mediaInfo.thumbnail,
            contextKey: selection.url,
            format: format,
            quality: quality,
            allQualityOptions: options
        )
        statusIsError = false
        statusMessage = "Pobieranie w tle — możesz wrócić do listy."
    }

    private func deleteDownloaded() async {
        statusMessage = nil
        statusIsError = false
        do {
            try await downloadService.deleteDownload(url: selection.url)
            localDownloadJobId = nil
            statusIsError = false
            statusMessage = "Usunięto z biblioteki MOVIES."
        } catch {
            statusIsError = true
            statusMessage = error.localizedDescription
        }
    }

    private func formatDuration(_ sec: Double) -> String {
        let total = Int(sec)
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d", m, s)
    }
}

// MARK: - Backdrop

private struct DetailBackdrop: View {
    let url: URL?

    var body: some View {
        GeometryReader { geo in
            ZStack {
                if let url {
                    PosterRemoteImage(url: url)
                        .frame(width: geo.size.width, height: geo.size.height)
                        .clipped()
                        .blur(radius: 56, opaque: true)
                        .scaleEffect(1.12)
                        .overlay { Color.black.opacity(0.35) }
                } else {
                    NostalgieAmbientBackground()
                }

                LinearGradient(
                    colors: [
                        .black.opacity(0.15),
                        .black.opacity(0.35),
                        .black.opacity(0.82),
                        .black.opacity(0.95),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )

                LinearGradient(
                    colors: [.black.opacity(0.55), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            }
        }
        .ignoresSafeArea()
    }
}

struct DownloadJobState: Identifiable {
    let id: String
}

struct DownloadProgressView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let jobId: String
    let title: String
    var mediaUrl: String?
    var mediaTitle: String?
    var mediaThumbnail: String?
    var mediaSource: String?
    let onDone: () -> Void

    @State private var progress: Double = 0
    @State private var status = "starting"
    @State private var errorMessage: String?
    @State private var fileReady = false

    var body: some View {
        ZStack {
            NostalgieAmbientBackground()
            VStack(alignment: .leading, spacing: 24) {
                Text("Pobieranie filmu")
                    .font(NostalgieFont.pageTitle)
                Text(title)
                    .foregroundStyle(.secondary)
                    .font(NostalgieFont.field)

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(NostalgieTheme.accent)
                } else if fileReady {
                    Text("Film gotowy w folderze MOVIES — odtwarzaj bez ponownego pobierania.")
                        .foregroundStyle(.green)
                } else {
                    ProgressView(value: progress, total: 100) {
                        Text(statusLabel)
                    }
                    .progressViewStyle(.linear)
                }

                HStack(spacing: 20) {
                    if fileReady {
                        Button("Gotowe") { onDone(); dismiss() }
                            .buttonStyle(FocusCardButtonStyle())
                    } else {
                        Button("Anuluj") { Task { await cancel(); onDone(); dismiss() } }
                            .buttonStyle(FocusCardButtonStyle())
                    }
                    Button("W tle") { dismiss() }
                        .buttonStyle(FocusCardButtonStyle())
                }
            }
            .padding(72)
            .frame(maxWidth: 900, alignment: .leading)
        }
        .task { await poll() }
        .onExitCommand { onDone(); dismiss() }
    }

    private var statusLabel: String {
        switch status {
        case "done": return "Gotowe"
        case "error": return "Błąd"
        case "cancelled": return "Anulowano"
        default: return "Pobieram… \(Int(progress))%"
        }
    }

    private func poll() async {
        while !Task.isCancelled {
            do {
                let job = try await app.api.fetchJobStatus(jobId: jobId)
                progress = job.progress ?? 0
                status = job.status
                if job.ready == true {
                    fileReady = true
                    if let mediaUrl {
                        _ = try? await app.api.linkMovieDownload(
                            url: mediaUrl,
                            title: mediaTitle ?? title,
                            downloadJobId: jobId,
                            thumbnail: mediaThumbnail,
                            source: mediaSource
                        )
                        await app.refreshMovieDownloads()
                    }
                    return
                }
                if job.status == "error" {
                    errorMessage = job.error ?? "Pobieranie nie powiodło się."
                    return
                }
                if job.status == "cancelled" {
                    errorMessage = "Anulowano."
                    return
                }
            } catch {
                errorMessage = error.localizedDescription
                return
            }
            try? await Task.sleep(nanoseconds: 2_000_000_000)
        }
    }

    private func cancel() async {
        try? await app.api.cancelJob(jobId: jobId)
    }
}

import SwiftUI

struct MediaDetailView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let selection: MediaSelection
    let onOpenEpisodes: (() -> Void)?

    @State private var playbackSession: PlaybackSession?
    @State private var downloadJob: DownloadJobState?
    @State private var statusMessage: String?
    @State private var statusIsError = false
    @State private var isFavorite: Bool
    @State private var isBusy = false

    init(selection: MediaSelection, onOpenEpisodes: (() -> Void)? = nil) {
        self.selection = selection
        self.onOpenEpisodes = onOpenEpisodes
        _isFavorite = State(initialValue: false)
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            DetailBackdrop(url: selection.thumbnail.flatMap(URL.init(string:)))

            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 0)

                VStack(alignment: .leading, spacing: 26) {
                    metadataRow
                    titleBlock
                    if let statusMessage {
                        statusBanner(statusMessage, isError: statusIsError)
                    }
                    actionToolbar
                    serialHint
                }
                .frame(maxWidth: 1040, alignment: .leading)
                .padding(.horizontal, 90)
                .padding(.bottom, 76)
            }
        }
        .ignoresSafeArea()
        .onExitCommand { dismiss() }
        .task {
            isFavorite = app.isFavorite(selection.url)
        }
        .fullScreenCover(item: $playbackSession) { session in
            PlayerScreen(session: session)
        }
        .fullScreenCover(item: $downloadJob) { job in
            DownloadProgressView(jobId: job.id, title: selection.title) {
                downloadJob = nil
            }
        }
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(selection.title)
                .font(.system(size: 58, weight: .bold))
                .lineLimit(2)
                .minimumScaleFactor(0.75)
                .shadow(color: .black.opacity(0.45), radius: 12, y: 4)

            HStack(spacing: 8) {
                if let detail = selection.detail, !detail.isEmpty {
                    Text(MediaCardCopy.cleanedSubtitle(detail: detail, source: selection.source))
                }
                if let duration = selection.duration, duration > 0 {
                    if selection.detail != nil { Text("·").foregroundStyle(.secondary) }
                    Text(formatDuration(duration))
                }
            }
            .font(.title3)
            .foregroundStyle(.white.opacity(0.72))
            .lineLimit(1)
        }
    }

    private var metadataRow: some View {
        HStack(spacing: 12) {
            SourceBadgeView(source: MediaCardCopy.normalizedSourceKey(selection.source))
            if selection.isPremium {
                PremiumBadge()
            }
            MediaTypeBadge(label: typeBadgeLabel)
            if let quality = selection.quality, !quality.isEmpty {
                Text(quality.uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(0.8)
                    .foregroundStyle(.white.opacity(0.9))
                    .glassCapsule(paddingH: 12, paddingV: 8)
            }
            if isFavorite {
                Label("Ulubione", systemImage: "heart.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NostalgieTheme.accent)
                    .glassCapsule(paddingH: 12, paddingV: 8)
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
                .font(.callout)
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
                    .font(.title3.weight(.semibold))
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

            toolbarButton(title: "Pobierz", icon: "arrow.down.circle") {
                Task { await startDownload() }
            }
            .disabled(selection.isSerial && onOpenEpisodes != nil)
        }
    }

    @ViewBuilder
    private var serialHint: some View {
        if selection.isSerial, onOpenEpisodes != nil {
            Text("Aby pobrać serial, wybierz odcinek z listy.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.55))
                .padding(.top, 4)
        }
    }

    private func toolbarButton(title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.body.weight(.semibold))
        }
        .buttonStyle(DetailToolbarButtonStyle())
    }

    private func play() async {
        isBusy = true
        statusMessage = nil
        statusIsError = false
        defer { isBusy = false }
        do {
            let preview = try await app.api.startPreview(url: selection.url)
            if preview.instant == false {
                statusIsError = false
                statusMessage = "Przygotowuję odtwarzanie…"
                try await app.api.waitForPreviewReady(jobId: preview.jobId) { progress in
                    statusMessage = progress > 0
                        ? "Przygotowuję odtwarzanie… \(progress)%"
                        : "Przygotowuję odtwarzanie…"
                }
                statusMessage = nil
            }
            let token = try await app.api.playToken(jobId: preview.jobId)
            let url = app.api.streamURL(jobId: token.jobId, token: token.token)
            playbackSession = PlaybackSession(jobId: token.jobId, streamURL: url, token: token.token)
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

    private func startDownload() async {
        statusMessage = nil
        statusIsError = false
        do {
            let jobId = try await app.api.startDownload(url: selection.url, height: 720)
            downloadJob = DownloadJobState(id: jobId)
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
    let onDone: () -> Void

    @State private var progress: Double = 0
    @State private var status = "starting"
    @State private var errorMessage: String?
    @State private var fileReady = false

    var body: some View {
        ZStack {
            NostalgieAmbientBackground()
            VStack(alignment: .leading, spacing: 24) {
                Text("Pobieranie")
                    .font(.largeTitle.bold())
                Text(title)
                    .foregroundStyle(.secondary)
                    .font(.title3)

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(NostalgieTheme.accent)
                } else if fileReady {
                    Text("Plik gotowy na serwerze.")
                        .foregroundStyle(.green)
                    Text("Pobierz w panelu www (MOVIES) lub użyj linku w przeglądarce na komputerze.")
                        .foregroundStyle(.secondary)
                        .font(.callout)
                    Text(app.api.downloadFileURL(jobId: jobId).absoluteString)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
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

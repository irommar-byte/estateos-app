import SwiftUI

struct MusicDetailView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let selection: MusicSelection
    let folders: [MusicFolder]
    var contextQueue: [MusicPlaybackTrack] = []
    var folderName: String? = nil
    var onAddedToFolder: (() -> Void)?

    @State private var downloadJob: DownloadJobState?
    @State private var isPreparingPlay = false
    @State private var playProgress: Int = 0
    @State private var statusMessage: String?
    @State private var statusIsError = false
    @State private var isBusy = false
    @State private var localDownloadJobId: String?

    private var effectiveDownloadJobId: String? {
        if let localDownloadJobId, !localDownloadJobId.isEmpty { return localDownloadJobId }
        if let id = selection.downloadJobId, !id.isEmpty { return id }
        return app.downloadJobId(for: selection.url)
    }

    private var isTrackDownloaded: Bool {
        guard let effectiveDownloadJobId, !effectiveDownloadJobId.isEmpty else { return false }
        return true
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            musicBackdrop

            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 0)

                VStack(alignment: .leading, spacing: 24) {
                    metadataRow
                    titleBlock
                    if let statusMessage {
                        statusBanner(statusMessage, isError: statusIsError)
                    }
                    if isPreparingPlay {
                        ProgressView("Pobieram pełny utwór MP3… \(playProgress)%")
                    }
                    actionToolbar
                    folderPicker
                }
                .frame(maxWidth: 980, alignment: .leading)
                .padding(.horizontal, NostalgieSpacing.screenH)
                .padding(.bottom, 68)
            }
        }
        .ignoresSafeArea()
        .task {
            if localDownloadJobId == nil {
                localDownloadJobId = app.downloadJobId(for: selection.url)
            }
        }
        .onExitCommand { dismiss() }
        .fullScreenCover(item: $downloadJob) { job in
            MusicDownloadProgressView(
                jobId: job.id,
                title: selection.title,
                folderId: selection.folderId,
                trackUrl: selection.url
            ) {
                downloadJob = nil
                Task {
                    await app.refreshMusicLibrary()
                    localDownloadJobId = app.downloadJobId(for: selection.url)
                    onAddedToFolder?()
                }
            }
            .environmentObject(app)
        }
    }

    private var musicBackdrop: some View {
        MusicHeroBackdrop(imageURL: selection.thumbnail.flatMap(URL.init(string:)))
    }

    private var metadataRow: some View {
        HStack(spacing: 12) {
            SourceBadgeView(source: "apple-music")
            MediaTypeBadge(label: "MP3")
            Text((selection.quality ?? "320 kbps").uppercased())
                .font(.caption.weight(.bold))
                .tracking(0.8)
                .foregroundStyle(.white.opacity(0.9))
                .glassCapsule(paddingH: 12, paddingV: 8)
            if isTrackDownloaded {
                Label("Pobrany", systemImage: "checkmark.circle.fill")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.green)
                    .glassCapsule(paddingH: 12, paddingV: 8)
            }
        }
    }

    private var titleBlock: some View {
        HStack(alignment: .bottom, spacing: 28) {
            if let thumb = selection.thumbnail.flatMap(URL.init(string:)) {
                PosterRemoteImage(url: thumb)
                    .frame(width: 220, height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .shadow(color: .black.opacity(0.35), radius: 18, y: 8)
            }

            VStack(alignment: .leading, spacing: 10) {
                Text(selection.title)
                    .font(NostalgieFont.hero)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                if !selection.subtitle.isEmpty {
                    Text(selection.subtitle)
                        .font(NostalgieFont.metadata)
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(2)
                }
                if let duration = selection.duration, duration > 0,
                   let label = MediaDurationFormat.label(for: duration) {
                    Text(label)
                        .font(NostalgieFont.rowTitle)
                        .foregroundStyle(.white.opacity(0.55))
                }
            }
        }
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
        HStack(spacing: 18) {
            Button {
                startFullPlay()
            } label: {
                Label("Odtwórz", systemImage: "play.fill")
                    .font(NostalgieFont.rounded(.title3, weight: .semibold))
            }
            .buttonStyle(DetailPlayButtonStyle())
            .disabled(isBusy || isPreparingPlay)

            if isTrackDownloaded {
                MusicDownloadedBadge()
            } else {
                Button {
                    Task { await startDownload() }
                } label: {
                    Label("Pobierz MP3", systemImage: "arrow.down.circle.fill")
                        .font(NostalgieFont.rounded(.title3, weight: .semibold))
                }
                .buttonStyle(FocusCardButtonStyle())
                .disabled(isBusy || isPreparingPlay)
            }
        }
    }

    @ViewBuilder
    private var folderPicker: some View {
        if !folders.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Dodaj do folderu")
                    .font(NostalgieFont.rowTitle)
                    .foregroundStyle(.white.opacity(0.72))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 14) {
                        ForEach(folders) { folder in
                            Button {
                                Task { await addToFolder(folder) }
                            } label: {
                                Label(folder.name, systemImage: "folder.badge.plus")
                            }
                            .buttonStyle(ChipButtonStyle(isSelected: false))
                        }
                    }
                }
            }
        }
    }

    private func startFullPlay() {
        statusMessage = nil
        statusIsError = false

        let queue: [MusicPlaybackTrack]
        let startIndex: Int
        if contextQueue.isEmpty {
            queue = [MusicPlaybackTrack(from: selection)]
            startIndex = 0
        } else {
            queue = contextQueue
            startIndex = contextQueue.firstIndex(where: { $0.url == selection.url }) ?? 0
        }

        let session = MusicPlaybackSession(
            queue: queue,
            startIndex: startIndex,
            folderId: selection.folderId,
            folderName: folderName
        )
        dismiss()
        Task { await app.musicPlayback.play(session: session, app: app) }
    }

    private func openStream(jobId: String) {
        startFullPlay()
    }

    private func startDownload() async {
        statusMessage = nil
        statusIsError = false
        isBusy = true
        defer { isBusy = false }
        do {
            var folderId = selection.folderId ?? app.musicFolders.first?.id
            if folderId == nil {
                await app.refreshMusicLibrary()
                folderId = app.musicFolders.first?.id
            }
            guard let folderId else {
                statusIsError = true
                statusMessage = "Utwórz folder playlisty przed pobieraniem."
                return
            }
            _ = try await app.api.addTrackToFolder(folderId: folderId, track: selection.trackPayload)
            let jobId = try await app.api.startMusicDownload(
                url: selection.url,
                folderId: folderId,
                trackUrl: selection.url
            )
            downloadJob = DownloadJobState(id: jobId)
        } catch {
            statusIsError = true
            statusMessage = error.localizedDescription
        }
    }

    private func addToFolder(_ folder: MusicFolder) async {
        do {
            _ = try await app.api.addTrackToFolder(folderId: folder.id, track: selection.trackPayload)
            await app.refreshMusicLibrary()
            statusIsError = false
            statusMessage = "Dodano do «\(folder.name)»."
            onAddedToFolder?()
        } catch {
            statusIsError = true
            statusMessage = error.localizedDescription
        }
    }
}

struct MusicDownloadProgressView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let jobId: String
    let title: String
    var folderId: String?
    var trackUrl: String?
    let onDone: () -> Void

    @State private var progress: Double = 0
    @State private var status = "starting"
    @State private var errorMessage: String?
    @State private var fileReady = false

    var body: some View {
        ZStack {
            NostalgieAmbientBackground()
            VStack(alignment: .leading, spacing: 24) {
                Text("Pobieranie MP3")
                    .font(NostalgieFont.pageTitle)
                Text(title)
                    .foregroundStyle(.secondary)
                    .font(NostalgieFont.field)

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(NostalgieTheme.accent)
                } else if fileReady {
                    Text("MP3 gotowy — możesz odtwarzać z playlisty.")
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
        default: return "Przygotowuję MP3… \(Int(progress))%"
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
                    if let folderId, let trackUrl {
                        _ = try? await app.api.linkTrackDownload(
                            folderId: folderId,
                            url: trackUrl,
                            downloadJobId: jobId
                        )
                        await app.refreshMusicLibrary()
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

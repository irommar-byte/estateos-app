import SwiftUI

struct MusicDetailView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let selection: MusicSelection
    let folders: [MusicFolder]
    var onAddedToFolder: (() -> Void)?

    @State private var downloadJob: DownloadJobState?
    @State private var statusMessage: String?
    @State private var statusIsError = false
    @State private var isBusy = false

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
                    actionToolbar
                    folderPicker
                }
                .frame(maxWidth: 980, alignment: .leading)
                .padding(.horizontal, 90)
                .padding(.bottom, 76)
            }
        }
        .ignoresSafeArea()
        .onExitCommand { dismiss() }
        .fullScreenCover(item: $downloadJob) { job in
            MusicDownloadProgressView(jobId: job.id, title: selection.title) {
                downloadJob = nil
            }
        }
    }

    private var musicBackdrop: some View {
        GeometryReader { geo in
            ZStack {
                if let url = selection.thumbnail.flatMap(URL.init(string:)) {
                    PosterRemoteImage(url: url)
                        .frame(width: geo.size.width, height: geo.size.height)
                        .clipped()
                        .blur(radius: 56, opaque: true)
                        .scaleEffect(1.12)
                        .overlay { Color.black.opacity(0.42) }
                } else {
                    NostalgieAmbientBackground()
                }

                LinearGradient(
                    colors: [.black.opacity(0.15), .black.opacity(0.45), .black.opacity(0.92)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
        }
        .ignoresSafeArea()
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
                    .font(.system(size: 52, weight: .bold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                if !selection.subtitle.isEmpty {
                    Text(selection.subtitle)
                        .font(.title3)
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(2)
                }
                if let duration = selection.duration, duration > 0,
                   let label = MediaDurationFormat.label(for: duration) {
                    Text(label)
                        .font(.headline)
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
                Task { await startDownload() }
            } label: {
                Label("Pobierz MP3", systemImage: "arrow.down.circle.fill")
                    .font(.title3.weight(.semibold))
            }
            .buttonStyle(DetailPlayButtonStyle())
            .disabled(isBusy)
        }
    }

    @ViewBuilder
    private var folderPicker: some View {
        if !folders.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Dodaj do folderu")
                    .font(.headline)
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

    private func startDownload() async {
        statusMessage = nil
        statusIsError = false
        isBusy = true
        defer { isBusy = false }
        do {
            let jobId = try await app.api.startMusicDownload(url: selection.url)
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
                    .font(.largeTitle.bold())
                Text(title)
                    .foregroundStyle(.secondary)
                    .font(.title3)

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(NostalgieTheme.accent)
                } else if fileReady {
                    Text("MP3 gotowy na serwerze — 320 kbps z okładką.")
                        .foregroundStyle(.green)
                    Text("Pobierz plik w panelu www albo skopiuj link poniżej.")
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

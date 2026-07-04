import SwiftUI

struct MusicFolderView: View {
    @EnvironmentObject private var app: AppModel
    let folder: MusicFolder
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    var startBatchDownloadOnAppear: Bool = false
    let onBack: () -> Void

    @State private var tracks: [MusicTrack] = []
    @State private var currentFolder: MusicFolder?
    @State private var isLoading = true
    @State private var isSyncing = false
    @State private var syncMessage: String?
    @State private var showLinkPlaylistSheet = false
    @State private var linkPlaylistURL = ""
    @State private var errorMessage: String?
    @State private var selectedTrack: MusicSelection?
    @State private var trackDownloadStates: [String: TrackDownloadUIState] = [:]
    @State private var batchFinished = false
    @State private var batchErrorSummary: String?
    @State private var batchCancelled = false
    @State private var batchCurrentJobId: String?
    @State private var batchDownloadTask: Task<Void, Never>?
    @State private var activeDownloadingTrackURL: String?
    @State private var showCompleteBanner = false
    @State private var didAutoStartBatchDownload = false
    @FocusState private var focusedTrackID: String?

    private var pendingDownloadCount: Int {
        tracks.filter { !isTrackDownloaded($0) }.count
    }

    private var allTracksDownloaded: Bool {
        !tracks.isEmpty && pendingDownloadCount == 0
    }

    private var completedDownloadCount: Int {
        tracks.filter { isTrackDownloaded($0) }.count
    }

    private var isBatchRunning: Bool {
        batchDownloadTask != nil && !batchFinished && !batchCancelled
    }

    private var batchOverallProgress: Double {
        guard !tracks.isEmpty else { return 0 }
        var progress = Double(completedDownloadCount)
        if let activeDownloadingTrackURL,
           case .downloading(let pct) = trackDownloadStates[activeDownloadingTrackURL] {
            progress += pct / 100
        }
        return progress / Double(tracks.count)
    }

    var body: some View {
        ScrollViewReader { scrollProxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: NostalgieSpacing.section) {
                    header

                    if let syncMessage, !syncMessage.isEmpty {
                        syncBanner(syncMessage)
                    }

                    if isBatchRunning || showCompleteBanner {
                        inlineDownloadBanner
                    }

                    if let batchErrorSummary, !isBatchRunning {
                        batchErrorBanner(batchErrorSummary)
                    }

                    if isLoading {
                        ProgressView("Wczytuję utwory…")
                    } else if let errorMessage {
                        EmptyStateView(icon: "exclamationmark.folder", title: "Błąd", message: errorMessage)
                    } else if tracks.isEmpty {
                        EmptyStateView(
                            icon: "music.note.list",
                            title: "Pusty folder",
                            message: "Wyszukaj utwór w Apple Music i dodaj go do tego folderu."
                        )
                    } else {
                        LazyVStack(spacing: NostalgieSpacing.listRow) {
                            ForEach(Array(tracks.enumerated()), id: \.element.id) { index, track in
                                MusicTrackRow(
                                    index: index + 1,
                                    title: track.title,
                                    subtitle: [track.artist, track.album].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
                                    duration: track.duration,
                                    showsPlayHint: true,
                                    isDownloaded: track.isDownloaded,
                                    downloadState: trackDownloadStates[track.url] ?? .idle,
                                    isActiveDownload: activeDownloadingTrackURL == track.url
                                ) {
                                    selectedTrack = MusicSelection(from: track)
                                }
                                .id(track.url)
                                .focused($focusedTrackID, equals: track.id)
                                .contextMenu {
                                    Button("Odtwórz") {
                                        startFullPlay(track)
                                    }
                                    Button("Szczegóły utworu") {
                                        selectedTrack = MusicSelection(from: track)
                                    }
                                    Button("Pobierz MP3") {
                                        downloadSingleTrack(track)
                                    }
                                    .disabled(track.isDownloaded || isBatchRunning)
                                    Button("Usuń z folderu", role: .destructive) {
                                        Task { await remove(track) }
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, NostalgieSpacing.screenH)
                .padding(.bottom, NostalgieSpacing.scrollBottom)
            }
            .onChange(of: activeDownloadingTrackURL) { _, trackURL in
                guard let trackURL else { return }
                withAnimation(NostalgieTheme.contentSpring) {
                    scrollProxy.scrollTo(trackURL, anchor: .center)
                }
            }
        }
        .task { await load(initialBatchDownload: startBatchDownloadOnAppear && !didAutoStartBatchDownload) }
        .onDisappear {
            batchDownloadTask?.cancel()
        }
        .fullScreenCover(item: $selectedTrack) { track in
            MusicDetailView(
                selection: track,
                folders: app.musicFolders.filter { $0.id != folder.id },
                contextQueue: tracks.map { MusicPlaybackTrack(from: $0) },
                folderName: displayFolder.name
            ) {
                Task { await load() }
            }
            .environmentObject(app)
        }
        .fullScreenCover(isPresented: $showLinkPlaylistSheet) {
            MusicPlaylistImportSheet(
                url: $linkPlaylistURL,
                downloadAfterImport: .constant(false),
                targetFolderId: folder.id,
                linkExistingFolder: true,
                onCancel: {
                    showLinkPlaylistSheet = false
                    linkPlaylistURL = ""
                },
                onImported: { updated, _ in
                    showLinkPlaylistSheet = false
                    linkPlaylistURL = ""
                    currentFolder = updated
                    Task {
                        await load()
                        await syncPlaylist()
                    }
                }
            )
            .environmentObject(app)
        }
    }

    private var hasAppleMusicTracks: Bool {
        tracks.contains { ($0.source ?? "").contains("apple-music") }
    }

    private var canShowRefresh: Bool {
        displayFolder.isLinkedApplePlaylist || hasAppleMusicTracks
    }

    private var folderArtworkURL: URL? {
        if let url = displayFolder.artworkURL { return url }
        return tracks.first?.thumbnail.flatMap(URL.init(string:))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: onBack) {
                Label("Wróć do Muzyki", systemImage: "chevron.left")
            }
            .buttonStyle(BackLinkButtonStyle())
            .onMoveCommand { direction in
                if direction == .up {
                    focusedTab.wrappedValue = navigationTab
                }
            }

            HStack(alignment: .center, spacing: 14) {
                if let folderArtworkURL {
                    PosterRemoteImage(url: folderArtworkURL)
                        .scaledToFill()
                        .frame(width: 72, height: 72)
                        .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous))
                }

                VStack(alignment: .leading, spacing: 4) {
                    ScreenTitle(
                        title: displayFolder.name,
                        subtitle: playlistSubtitle,
                        level: .detail
                    )

                    HStack(spacing: 8) {
                        if canShowRefresh {
                            Button {
                                Task { await refreshPlaylist() }
                            } label: {
                                Label(isSyncing ? "Odświeżam…" : "Odśwież", systemImage: "arrow.clockwise")
                            }
                            .buttonStyle(ChipButtonStyle(isSelected: false))
                            .disabled(isSyncing || isBatchRunning)
                        }

                        if !tracks.isEmpty {
                            if isBatchRunning {
                                Button {
                                    Task { await cancelBatchDownload() }
                                } label: {
                                    Label("Anuluj", systemImage: "xmark.circle.fill")
                                }
                                .buttonStyle(ChipButtonStyle(isSelected: false))
                            } else if allTracksDownloaded {
                                Label("Pobrane", systemImage: "checkmark.circle.fill")
                                    .font(NostalgieFont.caption)
                                    .foregroundStyle(.green)
                                    .glassCapsule(paddingH: 10, paddingV: 5)
                            } else {
                                Button {
                                    beginBatchDownload()
                                } label: {
                                    Label("Pobierz wszystkie", systemImage: "arrow.down.circle.fill")
                                }
                                .buttonStyle(ChipButtonStyle(isSelected: false))
                            }
                        }
                    }
                }
            }
        }
    }

    private var displayFolder: MusicFolder {
        currentFolder ?? folder
    }

    private func syncBanner(_ message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundStyle(.green)
            Text(message)
                .font(NostalgieFont.body)
                .foregroundStyle(.white.opacity(0.85))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .glassPanel(.panel)
    }

    private var inlineDownloadBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                if showCompleteBanner && !isBatchRunning {
                    Label("Playlista gotowa — wszystkie utwory pobrane.", systemImage: "checkmark.circle.fill")
                        .font(NostalgieFont.rowTitle)
                        .foregroundStyle(.green)
                } else {
                    Text("Pobieranie playlisty")
                        .font(NostalgieFont.rowTitle)
                }
                Spacer()
                if isBatchRunning {
                    Text("\(Int(batchOverallProgress * 100))%")
                        .font(NostalgieFont.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }

            if isBatchRunning {
                HStack {
                    Text("\(completedDownloadCount) z \(tracks.count) utworów")
                        .font(NostalgieFont.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if let activeDownloadingTrackURL,
                       let title = tracks.first(where: { $0.url == activeDownloadingTrackURL })?.title {
                        Text(title)
                            .font(NostalgieFont.caption)
                            .lineLimit(1)
                            .foregroundStyle(.green)
                    }
                }

                ProgressView(value: batchOverallProgress, total: 1)
                    .progressViewStyle(.linear)
                    .tint(.green)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .glassPanel(.panel)
    }

    private func batchErrorBanner(_ message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text(message)
                .font(NostalgieFont.body)
                .foregroundStyle(.white.opacity(0.85))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .glassPanel(.panel)
    }

    private var playlistSubtitle: String {
        let total = tracks.count
        let onServer = displayFolder.serverTrackCount
        let downloaded = completedDownloadCount
        if isBatchRunning {
            return "\(total) utworów · pobieranie w toku…"
        }
        if onServer > 0, onServer < total {
            return "\(onServer) z \(total) na serwerze · odtwarzaj MP3 z playlisty"
        }
        if downloaded > 0, downloaded < total {
            return "\(downloaded) z \(total) pobranych · odtwarzaj MP3 z playlisty"
        }
        if downloaded > 0 {
            return "\(total) utworów · \(downloaded) pobranych · odtwarzaj MP3 z playlisty"
        }
        return "\(total) utworów · odtwarzaj pobrane MP3 z playlisty"
    }

    private func isTrackDownloaded(_ track: MusicTrack) -> Bool {
        track.isDownloaded || trackDownloadStates[track.url] == .done
    }

    private func syncDownloadStatesFromTracks() {
        for track in tracks where track.isDownloaded {
            trackDownloadStates[track.url] = .done
        }
    }

    private func beginBatchDownload() {
        batchCancelled = false
        batchFinished = false
        batchErrorSummary = nil
        showCompleteBanner = false
        batchDownloadTask?.cancel()
        batchDownloadTask = Task {
            await runBatchDownload()
        }
    }

    private func downloadSingleTrack(_ track: MusicTrack) {
        guard !isTrackDownloaded(track), !isBatchRunning else { return }
        batchCancelled = false
        batchFinished = false
        batchErrorSummary = nil
        showCompleteBanner = false
        batchDownloadTask?.cancel()
        batchDownloadTask = Task {
            await downloadOneTrack(track)
            activeDownloadingTrackURL = nil
            batchDownloadTask = nil
        }
    }

    private func load(initialBatchDownload: Bool = false) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await app.api.fetchFolderTracks(folderId: folder.id)
            currentFolder = response.folder
            tracks = response.tracks
            syncDownloadStatesFromTracks()
            await app.refreshMusicLibrary()
            if focusedTrackID == nil {
                focusedTrackID = tracks.first?.id
            }
            if initialBatchDownload, !tracks.isEmpty, !allTracksDownloaded {
                didAutoStartBatchDownload = true
                beginBatchDownload()
            }
        } catch {
            tracks = []
            errorMessage = error.localizedDescription
        }
    }

    private func startFullPlay(_ track: MusicTrack) {
        selectedTrack = nil
        let queue = tracks.map(MusicPlaybackTrack.init(from:))
        let startIndex = tracks.firstIndex(where: { $0.url == track.url }) ?? 0
        let session = MusicPlaybackSession(
            queue: queue,
            startIndex: startIndex,
            folderId: folder.id,
            folderName: displayFolder.name
        )
        Task { await app.musicPlayback.play(session: session, app: app) }
    }

    private func openStream(track: MusicTrack, jobId: String) {
        startFullPlay(track)
    }

    private func refreshPlaylist() async {
        if displayFolder.isLinkedApplePlaylist {
            await syncPlaylist()
        } else {
            showLinkPlaylistSheet = true
        }
    }

    private func syncPlaylist() async {
        guard !isSyncing else { return }
        isSyncing = true
        syncMessage = nil
        defer { isSyncing = false }
        do {
            let response = try await app.api.syncAppleMusicPlaylist(folderId: folder.id)
            currentFolder = response.folder
            await load()
            await app.refreshMusicLibrary()
            if let added = response.added, added > 0 {
                syncMessage = "Dodano \(added) nowych utworów na górę playlisty."
            } else {
                syncMessage = "Playlista aktualna — brak nowych utworów."
            }
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            syncMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func remove(_ track: MusicTrack) async {
        do {
            try await app.api.removeTrackFromFolder(folderId: folder.id, url: track.url)
            trackDownloadStates.removeValue(forKey: track.url)
            await load()
            await app.refreshMusicLibrary()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func pendingBatchTracks() -> [MusicTrack] {
        tracks.filter { track in
            !track.isDownloaded && trackDownloadStates[track.url] != .done
        }
    }

    private func runBatchDownload() async {
        for track in tracks where track.isDownloaded {
            trackDownloadStates[track.url] = .done
        }

        for track in pendingBatchTracks() {
            if Task.isCancelled || batchCancelled { break }
            await downloadOneTrack(track)
            if batchCancelled || Task.isCancelled { break }
        }

        if !batchCancelled && !Task.isCancelled {
            batchFinished = pendingBatchTracks().isEmpty
            if batchFinished {
                showCompleteBanner = true
                await load()
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                showCompleteBanner = false
            }
        }
        activeDownloadingTrackURL = nil
        batchDownloadTask = nil
    }

    private func downloadOneTrack(_ track: MusicTrack) async {
        activeDownloadingTrackURL = track.url
        trackDownloadStates[track.url] = .downloading(progress: 0)

        do {
            let jobId = try await app.api.startMusicDownload(
                url: track.url,
                folderId: folder.id,
                trackUrl: track.url
            )
            batchCurrentJobId = jobId
            try await waitForBatchDownload(jobId: jobId, trackUrl: track.url)
            _ = try? await app.api.linkTrackDownload(
                folderId: folder.id,
                url: track.url,
                downloadJobId: jobId
            )
            trackDownloadStates[track.url] = .done
            await app.refreshMusicLibrary()
        } catch {
            if batchCancelled || Task.isCancelled { return }
            trackDownloadStates[track.url] = .failed(error.localizedDescription)
            batchErrorSummary = "Nie udało się pobrać «\(track.title)»."
        }

        batchCurrentJobId = nil
    }

    private func waitForBatchDownload(jobId: String, trackUrl: String) async throws {
        let deadline = Date().addingTimeInterval(600)
        var poll = 0
        while Date() < deadline {
            if Task.isCancelled || batchCancelled {
                throw APIError.server("Anulowano.")
            }
            let job = try await app.api.fetchJobStatus(jobId: jobId)
            if let progress = job.progress {
                trackDownloadStates[trackUrl] = .downloading(progress: progress)
            }
            if job.status == "error" {
                throw APIError.server(job.error ?? "Pobieranie nie powiodło się.")
            }
            if job.ready == true || job.status == "done" {
                return
            }
            poll += 1
            let delayNs: UInt64 = poll < 30 ? 500_000_000 : 1_000_000_000
            try await Task.sleep(nanoseconds: delayNs)
        }
        throw APIError.server("Przekroczono czas oczekiwania na pobranie.")
    }

    private func cancelBatchDownload() async {
        batchCancelled = true
        if let batchCurrentJobId {
            try? await app.api.cancelJob(jobId: batchCurrentJobId)
        }
        batchDownloadTask?.cancel()
        batchDownloadTask = nil
        activeDownloadingTrackURL = nil
    }
}

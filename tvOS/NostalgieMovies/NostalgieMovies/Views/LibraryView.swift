import SwiftUI

private enum LibraryFocus: Hashable {
    case refresh
    case activeBatch
    case filmFolder(String)
    case musicFolder(String)
}

/// Multimedia library: offline films/series + offline music + live download progress.
struct LibraryView: View {
    @EnvironmentObject private var app: AppModel
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    @Binding var requestContentFocus: Bool

    @State private var activeFilmFolder: DownloadedMediaFolder?
    @State private var activeMusicFolder: MusicFolder?
    @State private var isRefreshing = false
    @FocusState private var localFocus: LibraryFocus?

    private var filmFolders: [DownloadedMediaFolder] {
        DownloadedMediaLibrary.folders(from: app.movieDownloads)
    }

    private var offlineMusicFolders: [MusicFolder] {
        app.musicFolders.filter { ($0.downloadedTrackCount ?? $0.fileCount ?? 0) > 0 }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    private var downloadedTrackCount: Int {
        app.musicTracks.filter(\.isDownloaded).count
    }

    private var downloadService: MovieDownloadService { app.movieDownloadService }

    var body: some View {
        Group {
            if let folder = activeFilmFolder {
                DownloadedMediaFolderView(
                    folder: folder,
                    navigationTab: navigationTab,
                    focusedTab: focusedTab,
                    onBack: { activeFilmFolder = nil }
                )
                .environmentObject(app)
            } else if let folder = activeMusicFolder {
                MusicFolderView(
                    folder: folder,
                    navigationTab: navigationTab,
                    focusedTab: focusedTab,
                    onBack: { activeMusicFolder = nil }
                )
                .environmentObject(app)
            } else {
                libraryContent
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { await refreshAll() }
        .onChange(of: requestContentFocus) { _, requested in
            guard requested else { return }
            localFocus = .refresh
            requestContentFocus = false
        }
    }

    private var libraryContent: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: NostalgieSpacing.section) {
                HStack(alignment: .firstTextBaseline) {
                    ScreenTitle(
                        title: "Biblioteka",
                        subtitle: "Offline · filmy, seriale i muzyka na serwerze"
                    )
                    Spacer()
                    Button {
                        Task { await refreshAll() }
                    } label: {
                        Label(isRefreshing ? "Odświeżam…" : "Odśwież", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(FocusCardButtonStyle())
                    .focused($localFocus, equals: .refresh)
                    .disabled(isRefreshing)
                    .onMoveCommand { direction in
                        if direction == .up {
                            focusedTab.wrappedValue = navigationTab
                        }
                    }
                }

                storageHint

                if downloadService.hasActiveBatch {
                    activeDownloadsSection
                        .focused($localFocus, equals: .activeBatch)
                }

                filmsSection
                musicSection
            }
            .padding(.horizontal, NostalgieSpacing.screenH)
            .padding(.bottom, NostalgieSpacing.scrollBottom)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onExitCommand {
            focusedTab.wrappedValue = navigationTab
        }
    }

    private var storageHint: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "externaldrive.fill.badge.checkmark")
                .font(NostalgieFont.rounded(22, weight: .semibold))
                .foregroundStyle(.green)
            VStack(alignment: .leading, spacing: 4) {
                Text("Gdzie są pliki?")
                    .font(NostalgieFont.rowTitle)
                Text("Filmy i seriale → folder MOVIES na serwerze. Muzyka → playlisty MP3. Po pobraniu odtwarzanie startuje natychmiast z dysku — bez streamu online.")
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(18)
        .glassPanel(.panel)
    }

    private var activeDownloadsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            MusicSectionHeader(
                title: "Trwa pobieranie",
                subtitle: progressSubtitle
            )
            MovieDownloadBatchBanner(showsDismissWhenFinished: true)
                .environmentObject(app)

            if let batch = downloadService.activeBatch {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(batch.items) { item in
                        downloadRow(item)
                    }
                }
                .padding(.top, 4)
            }
        }
    }

    private var progressSubtitle: String {
        if downloadService.isRunning {
            let pct = Int(downloadService.overallProgress * 100)
            return "\(pct)% · \(downloadService.completedCount)/\(downloadService.totalCount) · zapis do Biblioteki"
        }
        if downloadService.failedCount > 0 {
            return "Część nie powiodła się — sprawdź listę poniżej"
        }
        return "Gotowe — materiały są w sekcjach poniżej"
    }

    private func downloadRow(_ item: MovieDownloadQueueItem) -> some View {
        HStack(spacing: 14) {
            statusIcon(for: item.state)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(NostalgieFont.listTitle)
                    .lineLimit(1)
                Text(statusLabel(for: item.state))
                    .font(NostalgieFont.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if case .downloading(let progress) = item.state {
                Text("\(Int(progress.clampedProgressPercent))%")
                    .font(NostalgieFont.caption.monospacedDigit())
                    .foregroundStyle(.green)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(NostalgieTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    @ViewBuilder
    private func statusIcon(for state: MovieDownloadItemState) -> some View {
        switch state {
        case .pending:
            Image(systemName: "clock")
                .foregroundStyle(.secondary)
        case .downloading:
            ProgressView()
                .controlSize(.small)
        case .done, .skipped:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
        case .failed:
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(.orange)
        }
    }

    private func statusLabel(for state: MovieDownloadItemState) -> String {
        switch state {
        case .pending: return "W kolejce"
        case .downloading(let p): return "Pobieranie \(Int(p.clampedProgressPercent))% → MOVIES"
        case .done: return "Zapisano · gotowe offline"
        case .skipped: return "Już było w Bibliotece"
        case .failed(let msg): return msg
        }
    }

    private var filmsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            MusicSectionHeader(
                title: "Filmy i seriale offline",
                subtitle: filmFolders.isEmpty
                    ? "Pobierz z zakładki Filmy — pojawią się tutaj"
                    : "\(filmFolders.count) pozycji · odtwórz od razu"
            )

            if filmFolders.isEmpty {
                EmptyStateView(
                    icon: "film.stack",
                    title: "Brak pobranych filmów",
                    message: "W szczegółach filmu wybierz «Pobierz». Postęp zobaczysz tutaj, a potem odtworzysz offline jednym kliknięciem."
                )
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 16) {
                        ForEach(filmFolders) { folder in
                            DownloadedMediaFolderCard(folder: folder) {
                                activeFilmFolder = folder
                            }
                            .focused($localFocus, equals: .filmFolder(folder.id))
                        }
                    }
                    .padding(.vertical, 10)
                }
                .fullBleedShelf()
            }
        }
    }

    private var musicSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            MusicSectionHeader(
                title: "Muzyka offline",
                subtitle: downloadedTrackCount == 0
                    ? "Pobierz MP3 z zakładki Muzyka"
                    : "\(downloadedTrackCount) utworów · \(offlineMusicFolders.count) playlist"
            )

            if offlineMusicFolders.isEmpty {
                EmptyStateView(
                    icon: "opticaldisc",
                    title: "Brak pobranej muzyki",
                    message: "W playliście wybierz «Pobierz MP3» lub «Pobierz wszystkie». Utwory trafią tutaj do odtwarzania offline."
                )
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 16) {
                        ForEach(offlineMusicFolders) { folder in
                            MusicFolderCard(folder: folder) {
                                activeMusicFolder = folder
                            }
                            .focused($localFocus, equals: .musicFolder(folder.id))
                        }
                    }
                    .padding(.vertical, 10)
                }
                .fullBleedShelf()
            }
        }
    }

    private func refreshAll() async {
        isRefreshing = true
        defer { isRefreshing = false }
        async let movies: Void = app.refreshMovieDownloads()
        async let music: Void = app.refreshMusicLibrary()
        _ = await (movies, music)
    }
}

private extension Double {
    /// Job progress may arrive as 0…100 or (rarely) 0…1.
    var clampedProgressPercent: Double {
        if self <= 1.0 { return max(0, min(100, self * 100)) }
        return max(0, min(100, self))
    }
}

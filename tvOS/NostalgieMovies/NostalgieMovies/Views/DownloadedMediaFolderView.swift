import SwiftUI

struct DownloadedMediaFolderView: View {
    @EnvironmentObject private var app: AppModel

    let folder: DownloadedMediaFolder
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    let onBack: () -> Void

    @State private var playbackContext: MediaPlaybackContext?
    @State private var playError: String?
    @State private var playingURL: String?
    @State private var deletingURL: String?
    @State private var errorMessage: String?
    @FocusState private var focusedItemURL: String?

    private var liveFolder: DownloadedMediaFolder {
        DownloadedMediaLibrary.folders(from: app.movieDownloads).first(where: { $0.id == folder.id }) ?? folder
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            MusicHeroBackdrop(imageURL: liveFolder.artworkURL)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: NostalgieSpacing.section) {
                    header

                    if let errorMessage {
                        Text(errorMessage)
                            .font(NostalgieFont.metadata)
                            .foregroundStyle(.orange)
                    }

                    LazyVStack(spacing: NostalgieSpacing.listRow) {
                        ForEach(Array(liveFolder.items.enumerated()), id: \.element.id) { index, item in
                            MusicTrackRow(
                                index: liveFolder.isSeries ? (index + 1) : nil,
                                title: rowTitle(for: item),
                                subtitle: rowSubtitle(for: item),
                                duration: nil,
                                showsPlayHint: playingURL != item.url,
                                isDownloaded: true,
                                isSelected: nil
                            ) {
                                Task { await play(item) }
                            }
                            .focused($focusedItemURL, equals: item.url)
                            .contextMenu {
                                Button("Odtwórz") {
                                    Task { await play(item) }
                                }
                                Button("Usuń z dysku", role: .destructive) {
                                    Task { await delete(item) }
                                }
                                .disabled(deletingURL == item.url)
                            }
                            .disabled(playingURL == item.url || deletingURL == item.url)
                        }
                    }
                }
                .padding(.horizontal, NostalgieSpacing.screenH)
                .padding(.bottom, NostalgieSpacing.scrollBottom)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.black)
        .onExitCommand { onBack() }
        .onAppear {
            if focusedItemURL == nil {
                focusedItemURL = liveFolder.items.first?.url
            }
        }
        .onChange(of: app.movieDownloads) { _, _ in
            if liveFolder.items.isEmpty {
                onBack()
            }
        }
        .fullScreenCover(item: $playbackContext) { context in
            PlayerScreen(context: context)
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

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button(action: onBack) {
                Label("Wróć do Filmy", systemImage: "chevron.left")
            }
            .buttonStyle(BackLinkButtonStyle())
            .onMoveCommand { direction in
                if direction == .up {
                    focusedTab.wrappedValue = navigationTab
                }
            }

            HStack(alignment: .center, spacing: 14) {
                folderCover(size: liveFolder.isSeries ? 88 : 72)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        if let source = liveFolder.source {
                            SourceBadgeView(source: MediaCardCopy.normalizedSourceKey(source))
                        }
                        Text(liveFolder.isSeries ? "SERIAL" : "FILM")
                            .font(NostalgieFont.badge)
                            .glassCapsule(paddingH: 10, paddingV: 6)
                    }

                    ScreenTitle(
                        title: liveFolder.title,
                        subtitle: liveFolder.countLabel,
                        level: .detail
                    )

                    Label("Folder MOVIES · odtwarzanie offline", systemImage: "internaldrive.fill")
                        .font(NostalgieFont.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private func folderCover(size: CGFloat) -> some View {
        if let artworkURL = liveFolder.artworkURL {
            PosterRemoteImage(url: artworkURL)
                .scaledToFill()
                .frame(width: size, height: liveFolder.isSeries ? size * 1.45 : size * 1.45)
                .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous))
                .shadow(color: .black.opacity(0.35), radius: 16, y: 8)
        } else {
            RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous)
                .fill(NostalgieTheme.card)
                .frame(width: size, height: size * 1.45)
                .overlay {
                    Image(systemName: liveFolder.isSeries ? "tv.fill" : "film.fill")
                        .font(NostalgieFont.rounded(28))
                        .foregroundStyle(.secondary)
                }
        }
    }

    private func rowTitle(for item: MovieDownload) -> String {
        liveFolder.isSeries ? DownloadedMediaLibrary.displayEpisodeTitle(for: item) : item.title
    }

    private func rowSubtitle(for item: MovieDownload) -> String {
        let source = item.source.map { MediaSourceMeta.normalize($0).label } ?? "MOVIES"
        if liveFolder.isSeries {
            return source
        }
        return "\(source) · pobrany"
    }

    private func play(_ item: MovieDownload) async {
        guard playingURL == nil else { return }
        guard let jobId = item.downloadJobId else {
            playError = "Brak pliku na serwerze."
            return
        }
        playingURL = item.url
        defer { playingURL = nil }
        do {
            let token = try await app.api.moviePlayToken(jobId: jobId)
            let streamURL = app.api.movieStreamURL(jobId: jobId, token: token.token)
            let session = PlaybackSession(jobId: jobId, streamURL: streamURL, token: token.token)
            playbackContext = MediaPlaybackContext(
                sourceURL: item.url,
                title: rowTitle(for: item),
                streamOptions: MediaQualityOption.defaultStreamTiers(duration: nil),
                session: session,
                selectedQualityID: "best"
            )
        } catch {
            playError = error.localizedDescription
        }
    }

    private func delete(_ item: MovieDownload) async {
        deletingURL = item.url
        defer { deletingURL = nil }
        do {
            try await app.movieDownloadService.deleteDownload(url: item.url)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

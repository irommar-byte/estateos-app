import SwiftUI

struct MusicAlbumView: View {
    @EnvironmentObject private var app: AppModel
    let album: MusicAlbum
    let onBack: () -> Void
    var onTrack: (MusicSelection, [MusicPlaybackTrack]) -> Void
    var onOpenFolder: ((MusicFolder, Bool) -> Void)? = nil

    @State private var detail: MusicAlbumDetailResponse?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isSelectionMode = false
    @State private var selectedTrackIDs = Set<String>()
    @State private var isCreatingFolder = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            MusicHeroBackdrop(imageURL: album.thumbnail.flatMap(URL.init(string:)))

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    content
                }
                .padding(.horizontal, NostalgieSpacing.screenH)
                .padding(.bottom, NostalgieSpacing.scrollBottom)
            }
        }
        .task { await load() }
        .onExitCommand {
            if isSelectionMode {
                isSelectionMode = false
                selectedTrackIDs.removeAll()
            } else {
                onBack()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button(action: onBack) {
                Label("Wróć", systemImage: "chevron.left")
            }
            .buttonStyle(BackLinkButtonStyle())

            HStack(alignment: .center, spacing: 14) {
                albumCoverThumb(size: 72)

                VStack(alignment: .leading, spacing: 4) {
                    ScreenTitle(
                        title: detail?.album.title ?? album.title,
                        subtitle: [detail?.album.artist ?? album.artist, detail?.album.releaseYear ?? album.releaseYear]
                            .compactMap { $0 }
                            .filter { !$0.isEmpty }
                            .joined(separator: " · "),
                        level: .detail
                    )
                    if let count = detail?.tracks.count ?? album.trackCount, count > 0 {
                        Text("\(count) utworów")
                            .font(NostalgieFont.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if detail?.tracks.isEmpty == false {
                HStack(spacing: 12) {
                    if isSelectionMode {
                        Button {
                            Task { await downloadSelectedTracks() }
                        } label: {
                            Label(isCreatingFolder ? "Tworzę playlistę…" : "Pobierz zaznaczone (\(selectedTrackIDs.count))", systemImage: "arrow.down.circle.fill")
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: false))
                        .disabled(selectedTrackIDs.isEmpty || isCreatingFolder)

                        Button {
                            isSelectionMode = false
                            selectedTrackIDs.removeAll()
                        } label: {
                            Label("Anuluj", systemImage: "xmark.circle.fill")
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: false))
                        .disabled(isCreatingFolder)
                    } else {
                        Button {
                            Task {
                                guard let tracks = detail?.tracks else { return }
                                await createFolderAndDownload(tracks: tracks)
                            }
                        } label: {
                            Label(isCreatingFolder ? "Tworzę playlistę…" : "Pobierz cały album", systemImage: "arrow.down.circle.fill")
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: false))
                        .disabled(isCreatingFolder)

                        Button {
                            isSelectionMode = true
                            selectedTrackIDs.removeAll()
                        } label: {
                            Label("Zaznacz", systemImage: "checklist")
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: false))
                        .disabled(isCreatingFolder)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func albumCoverThumb(size: CGFloat) -> some View {
        let albumData = detail?.album ?? album
        if let url = albumData.thumbnail.flatMap(URL.init(string:)) {
            PosterRemoteImage(url: url)
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous))
        } else {
            RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous)
                .fill(NostalgieTheme.card)
                .frame(width: size, height: size)
                .overlay {
                    Image(systemName: "square.stack.fill")
                        .font(NostalgieFont.rounded(22))
                        .foregroundStyle(.secondary)
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView("Wczytuję album…")
        } else if let errorMessage {
            EmptyStateView(icon: "square.stack.fill", title: "Błąd", message: errorMessage)
        } else if let tracks = detail?.tracks, !tracks.isEmpty {
            MusicSectionHeader(title: "Utwory", subtitle: "Pełny MP3 320 kbps · odtwórz lub pobierz")
            LazyVStack(spacing: NostalgieSpacing.listRow) {
                ForEach(Array(tracks.enumerated()), id: \.element.id) { index, song in
                    MusicTrackRow(
                        index: song.trackNumber ?? (index + 1),
                        title: song.title,
                        subtitle: song.uploader ?? "",
                        duration: song.duration,
                        showsPlayHint: !isSelectionMode,
                        isSelected: isSelectionMode ? selectedTrackIDs.contains(song.id) : nil
                    ) {
                        if isSelectionMode {
                            if selectedTrackIDs.contains(song.id) {
                                selectedTrackIDs.remove(song.id)
                            } else {
                                selectedTrackIDs.insert(song.id)
                            }
                        } else {
                            let context = (detail?.tracks ?? []).map { MusicPlaybackTrack(from: MusicSelection(from: $0)) }
                            onTrack(MusicSelection(from: song), context)
                        }
                    }
                }
            }
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            detail = try await app.api.fetchMusicAlbum(id: album.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func downloadSelectedTracks() async {
        guard let tracks = detail?.tracks else { return }
        let selected = tracks.filter { selectedTrackIDs.contains($0.id) }
        await createFolderAndDownload(tracks: selected)
    }

    private func createFolderAndDownload(tracks: [SearchResultItem]) async {
        guard !tracks.isEmpty else { return }
        isCreatingFolder = true
        defer { isCreatingFolder = false }
        do {
            let folderName = detail?.album.title ?? album.title
            let folderThumbnail = detail?.album.thumbnail ?? album.thumbnail
            let folder = try await app.createMusicFolder(name: folderName, thumbnail: folderThumbnail)
            for track in tracks {
                try? await app.addTrackToFolder(folderId: folder.id, from: track)
            }
            onOpenFolder?(folder, true)
        } catch {
            errorMessage = "Nie udało się utworzyć playlisty: \(error.localizedDescription)"
        }
    }
}

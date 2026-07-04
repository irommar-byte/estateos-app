import SwiftUI

struct MusicSelection: Identifiable, Hashable {
    let id: String
    let title: String
    let url: String
    let artist: String?
    let album: String?
    let thumbnail: String?
    let duration: Double?
    let quality: String?
    let previewUrl: String?
    let artistId: String?
    let albumId: String?
    let trackNumber: Int?
    let downloadJobId: String?
    let folderId: String?

    init(
        id: String? = nil,
        title: String,
        url: String,
        artist: String? = nil,
        album: String? = nil,
        thumbnail: String? = nil,
        duration: Double? = nil,
        quality: String? = nil,
        previewUrl: String? = nil,
        artistId: String? = nil,
        albumId: String? = nil,
        trackNumber: Int? = nil,
        downloadJobId: String? = nil,
        folderId: String? = nil
    ) {
        self.id = id ?? url
        self.title = title
        self.url = url
        self.artist = artist
        self.album = album
        self.thumbnail = thumbnail
        self.duration = duration
        self.quality = quality
        self.previewUrl = previewUrl
        self.artistId = artistId
        self.albumId = albumId
        self.trackNumber = trackNumber
        self.downloadJobId = downloadJobId
        self.folderId = folderId
    }

    init(from item: SearchResultItem) {
        self.init(
            title: item.title,
            url: item.url,
            artist: item.uploader,
            album: item.album,
            thumbnail: item.thumbnail,
            duration: item.duration,
            quality: item.quality,
            previewUrl: item.previewUrl,
            artistId: item.artistId,
            albumId: item.albumId,
            trackNumber: item.trackNumber
        )
    }

    init(from track: MusicTrack) {
        self.init(
            title: track.title,
            url: track.url,
            artist: track.artist,
            album: track.album,
            thumbnail: track.thumbnail,
            duration: track.duration,
            quality: track.quality,
            previewUrl: track.previewUrl,
            artistId: track.artistId,
            albumId: track.albumId,
            trackNumber: track.trackNumber,
            downloadJobId: track.downloadJobId,
            folderId: track.folderId
        )
    }

    var subtitle: String {
        [artist, album].compactMap { value in
            guard let value, !value.isEmpty else { return nil }
            return value
        }.joined(separator: " · ")
    }

    var isDownloaded: Bool {
        guard let downloadJobId, !downloadJobId.isEmpty else { return false }
        return true
    }

    var canPreview: Bool { false }

    var trackPayload: MoviesAPIClient.MusicTrackPayload {
        MoviesAPIClient.MusicTrackPayload(
            url: url,
            title: title,
            artist: artist,
            album: album,
            thumbnail: thumbnail,
            duration: duration,
            quality: quality ?? "320 kbps",
            source: "apple-music",
            previewUrl: previewUrl,
            artistId: artistId,
            albumId: albumId,
            trackNumber: trackNumber
        )
    }
}

struct MusicPlaybackItem: Identifiable, Hashable {
    enum Source: Hashable {
        case fullStream(jobId: String, streamURL: URL, token: String)
    }

    let id: String
    let url: String
    let title: String
    let artist: String?
    let album: String?
    let artworkURL: URL?
    let source: Source

    init(
        id: String,
        url: String,
        title: String,
        artist: String?,
        album: String?,
        artworkURL: URL?,
        source: Source
    ) {
        self.id = id
        self.url = url
        self.title = title
        self.artist = artist
        self.album = album
        self.artworkURL = artworkURL
        self.source = source
    }

    init(track: MusicPlaybackTrack, jobId: String, streamURL: URL, token: String) {
        self.init(
            id: jobId,
            url: track.url,
            title: track.title,
            artist: track.artist,
            album: track.album,
            artworkURL: track.artworkURL,
            source: .fullStream(jobId: jobId, streamURL: streamURL, token: token)
        )
    }
}

struct MusicDownloadedBadge: View {
    var body: some View {
        Label("Pobrana", systemImage: "checkmark.circle.fill")
            .font(NostalgieFont.rowTitle)
            .foregroundStyle(.green)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .padding(.horizontal, 20)
            .padding(.vertical, 13)
            .background(NostalgieTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous)
                    .stroke(Color.green.opacity(0.35), lineWidth: 1)
            }
    }
}

enum TrackDownloadUIState: Equatable {
    case idle
    case downloading(progress: Double)
    case done
    case failed(String)
}

struct MusicDownloadCheckmark: View {
    @State private var appeared = false

    var body: some View {
        Image(systemName: "checkmark.circle.fill")
            .font(NostalgieFont.rounded(18))
            .foregroundStyle(.green)
            .scaleEffect(appeared ? 1 : 0.2)
            .opacity(appeared ? 1 : 0)
            .onAppear {
                withAnimation(NostalgieTheme.focusSpring) {
                    appeared = true
                }
            }
    }
}

struct MusicArtistCircleCard: View {
    let artist: MusicArtist
    let action: () -> Void
    var size: CGFloat = 152

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                artistArtwork(size: size)
                VStack(spacing: 1) {
                    Text(artist.name)
                        .font(NostalgieFont.rowTitle)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                        .multilineTextAlignment(.center)
                    Text(artist.genre?.isEmpty == false ? artist.genre! : " ")
                        .font(NostalgieFont.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(width: size + 24, height: 36)
            }
            .frame(width: size + 24)
        }
        .buttonStyle(MediaCardButtonStyle())
    }

    @ViewBuilder
    func artistArtwork(size: CGFloat) -> some View {
        if let url = artist.thumbnail.flatMap(URL.init(string:)) {
            PosterRemoteImage(url: url)
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(Circle())
                .overlay {
                    Circle().stroke(Color.white.opacity(0.12), lineWidth: 1)
                }
        } else {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [NostalgieTheme.accent.opacity(0.5), NostalgieTheme.accentSecondary.opacity(0.4)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)
                .overlay {
                    Image(systemName: "person.fill")
                        .font(.system(size: size * 0.34))
                        .foregroundStyle(.white.opacity(0.85))
                }
        }
    }
}

struct MusicAlbumTile: View {
    let album: MusicAlbum
    let size: CGFloat
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                albumCover(size: size)
                VStack(alignment: .leading, spacing: 2) {
                    Text(album.title)
                        .font(NostalgieFont.rowTitle)
                        .lineLimit(2)
                    Text([album.artist, album.releaseYear].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(NostalgieFont.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(width: size, height: 40, alignment: .topLeading)
            }
        }
        .buttonStyle(MediaCardButtonStyle())
    }

    @ViewBuilder
    func albumCover(size: CGFloat) -> some View {
        if let url = album.thumbnail.flatMap(URL.init(string:)) {
            PosterRemoteImage(url: url)
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
                .shadow(color: .black.opacity(0.35), radius: 10, y: 5)
        } else {
            RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous)
                .fill(NostalgieTheme.card)
                .frame(width: size, height: size)
                .overlay {
                    Image(systemName: "square.stack.fill")
                        .font(NostalgieFont.rounded(size * 0.22))
                        .foregroundStyle(.secondary)
                }
        }
    }
}

struct MusicTrackRow: View {
    let index: Int?
    let title: String
    let subtitle: String
    let duration: Double?
    let showsPlayHint: Bool
    var isDownloaded: Bool = false
    var downloadState: TrackDownloadUIState = .idle
    var isActiveDownload: Bool = false
    var isSelected: Bool? = nil
    let action: () -> Void

    private var showsDownloadedCheckmark: Bool {
        isDownloaded || downloadState == .done
    }

    private var activeDownloadProgress: Double? {
        if case .downloading(let progress) = downloadState { return progress }
        return nil
    }

    var body: some View {
        Button(action: action) {
            rowContent
        }
        .buttonStyle(ListRowButtonStyle())
    }

    @ViewBuilder
    private var rowContent: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 10) {
                Text(index.map(String.init) ?? "♪")
                    .font(NostalgieFont.rounded(15, weight: .semibold).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .frame(width: 28, alignment: .trailing)

                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(NostalgieFont.listTitle)
                        .lineLimit(1)
                    if !subtitle.isEmpty {
                        Text(subtitle)
                            .font(NostalgieFont.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 0)

                if let isSelected {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(NostalgieFont.rounded(18))
                        .foregroundStyle(isSelected ? NostalgieTheme.accentSecondary : .secondary)
                } else if showsDownloadedCheckmark {
                    MusicDownloadCheckmark()
                        .frame(width: 22)
                } else if let progress = activeDownloadProgress {
                    Text("\(Int(progress))%")
                        .font(NostalgieFont.caption.monospacedDigit())
                        .foregroundStyle(.green)
                        .frame(minWidth: 36, alignment: .trailing)
                } else if showsPlayHint {
                    Image(systemName: "play.circle.fill")
                        .font(NostalgieFont.rounded(18))
                        .foregroundStyle(NostalgieTheme.accent)
                }

                if let durationLabel = MediaDurationFormat.label(for: duration) {
                    Text(durationLabel)
                        .font(NostalgieFont.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .frame(minWidth: 44, alignment: .trailing)
                }
            }

            if let progress = activeDownloadProgress {
                ProgressView(value: progress, total: 100)
                    .progressViewStyle(.linear)
                    .tint(.green)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay {
            if isActiveDownload {
                RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous)
                    .stroke(Color.green.opacity(0.55), lineWidth: 1.5)
            }
        }
    }
}

struct MusicHeroBackdrop: View {
    let imageURL: URL?
    var cornerStyle: HeroCornerStyle = .rounded

    enum HeroCornerStyle {
        case rounded
        case circle
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                if let imageURL {
                    PosterRemoteImage(url: imageURL)
                        .frame(width: geo.size.width, height: geo.size.height)
                        .clipped()
                        .blur(radius: 64, opaque: true)
                        .scaleEffect(1.15)
                        .overlay { Color.black.opacity(0.48) }
                } else {
                    NostalgieAmbientBackground()
                }

                LinearGradient(
                    colors: [.black.opacity(0.05), .black.opacity(0.35), .black.opacity(0.92)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
        }
        .ignoresSafeArea()
    }
}

struct MusicActionTile: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void
    var size: CGFloat = 168

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous)
                        .fill(NostalgieTheme.card)
                    Image(systemName: icon)
                        .font(NostalgieFont.rounded(size * 0.24, weight: .semibold))
                        .foregroundStyle(NostalgieTheme.accentSecondary)
                }
                .frame(width: size, height: size)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(NostalgieFont.rowTitle)
                        .lineLimit(2)
                    Text(subtitle)
                        .font(NostalgieFont.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(width: size, height: 40, alignment: .topLeading)
            }
        }
        .buttonStyle(MediaCardButtonStyle())
    }
}

struct MusicFolderCard: View {
    let folder: MusicFolder
    let action: () -> Void
    var size: CGFloat = 168

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                folderCover

                VStack(alignment: .leading, spacing: 2) {
                    Text(folder.name)
                        .font(NostalgieFont.rowTitle)
                        .lineLimit(2)
                    Text(folder.countLabel)
                        .font(NostalgieFont.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(width: size, height: 40, alignment: .topLeading)
            }
        }
        .buttonStyle(MediaCardButtonStyle())
    }

    @ViewBuilder
    private var folderCover: some View {
        if let artworkURL = folder.artworkURL {
            PosterRemoteImage(url: artworkURL)
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                NostalgieTheme.accent.opacity(0.35),
                                NostalgieTheme.accentSecondary.opacity(0.28),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: size, height: size)
                Image(systemName: "folder.fill")
                    .font(NostalgieFont.rounded(size * 0.24, weight: .medium))
                    .foregroundStyle(.white.opacity(0.92))
            }
        }
    }
}

struct MusicTrackCard: View {
    let title: String
    let subtitle: String
    let thumbnailURL: URL?
    let duration: Double?
    let quality: String?
    let layout: Layout
    let action: () -> Void

    enum Layout {
        case grid
        case row
    }

    var body: some View {
        Button(action: action) {
            if layout == .row {
                rowLayout
            } else {
                gridLayout
            }
        }
        .buttonStyle(MediaCardButtonStyle())
    }

    private var gridLayout: some View {
        VStack(alignment: .leading, spacing: 14) {
            cover(size: nil)
                .aspectRatio(1, contentMode: .fit)
                .frame(maxWidth: .infinity)
            textBlock(titleFont: NostalgieFont.rowTitle)
        }
        .padding(10)
        .frame(minHeight: 280, alignment: .topLeading)
    }

    private var rowLayout: some View {
        HStack(spacing: 18) {
            cover(size: 120)
                .frame(width: 120, height: 120)
            textBlock(titleFont: NostalgieFont.rounded(.title3, weight: .semibold))
            Spacer(minLength: 0)
            if let quality, !quality.isEmpty {
                Text(quality.uppercased())
                    .font(NostalgieFont.caption)
                    .foregroundStyle(.white.opacity(0.85))
                    .glassCapsule(paddingH: 10, paddingV: 6)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassPanel(.panel)
    }

    private func cover(size: CGFloat?) -> some View {
        ZStack {
            PosterRemoteImage(url: thumbnailURL)
                .scaledToFill()
                .frame(maxWidth: size ?? .infinity, maxHeight: size ?? .infinity)
                .clipped()

            LinearGradient(
                colors: [.black.opacity(0.08), .clear, .black.opacity(0.55)],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack {
                HStack {
                    SourceBadgeView(source: "apple-music")
                    Spacer(minLength: 0)
                    if let durationLabel = MediaDurationFormat.label(for: duration) {
                        MediaDurationBadge(text: durationLabel)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(12)
        }
        .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.posterCornerRadius, style: .continuous))
    }

    private func textBlock(titleFont: Font) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(titleFont)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            Text(subtitle.isEmpty ? "Apple Music" : subtitle)
                .font(NostalgieFont.metadata)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct MusicFolderCreateSheet: View {
    @Binding var name: String
    let onCancel: () -> Void
    let onCreate: () -> Void

    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            NostalgieAmbientBackground()
            VStack(alignment: .leading, spacing: 22) {
                ScreenTitle(title: "Nowy folder", subtitle: "Utwórz playlistę / folder na utwory Apple Music.")

                NostalgieTextField(
                    placeholder: "np. Vege, Na imprezę",
                    text: $name,
                    isFocused: focused == true
                )
                .focused($focused)

                HStack(spacing: 18) {
                    Button("Anuluj", action: onCancel)
                        .buttonStyle(FocusCardButtonStyle())
                    Button("Utwórz", action: onCreate)
                        .buttonStyle(FocusCardButtonStyle())
                        .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .padding(72)
            .frame(maxWidth: 760, alignment: .leading)
        }
        .onAppear { focused = true }
        .onExitCommand(perform: onCancel)
    }
}

struct MusicPlaylistImportSheet: View {
    @EnvironmentObject private var app: AppModel

    @Binding var url: String
    @Binding var downloadAfterImport: Bool
    var targetFolderId: String? = nil
    var linkExistingFolder: Bool = false
    let onCancel: () -> Void
    let onImported: (MusicFolder, Bool) -> Void

    @State private var preview: MusicPlaylistCatalogResponse?
    @State private var isLoading = false
    @State private var isImporting = false
    @State private var errorMessage: String?
    @FocusState private var focusedField: Field?

    private enum Field {
        case url
        case importButton
    }

    var body: some View {
        ZStack {
            NostalgieAmbientBackground()
            VStack(alignment: .leading, spacing: 22) {
                ScreenTitle(
                    title: linkExistingFolder ? "Powiąż playlistę Apple Music" : "Import playlisty Apple Music",
                    subtitle: linkExistingFolder
                        ? "Wklej link playlisty — folder zostanie powiązany i zsynchronizowany z Apple Music."
                        : "Wklej link z music.apple.com — utwory trafią do nowej playlisty w aplikacji."
                )

                NostalgieTextField(
                    placeholder: "https://music.apple.com/pl/playlist/…",
                    text: $url,
                    isFocused: focusedField == .url
                )
                .focused($focusedField, equals: .url)
                .onSubmit { Task { await loadPreview() } }

                if isLoading {
                    ProgressView("Wczytuję playlistę…")
                } else if let preview {
                    playlistPreview(preview)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(NostalgieFont.body)
                        .foregroundStyle(NostalgieTheme.accent)
                }

                Toggle(isOn: $downloadAfterImport) {
                    Text("Po imporcie pobierz wszystkie utwory")
                        .font(NostalgieFont.rowTitle)
                }
                .toggleStyle(.automatic)
                .opacity(linkExistingFolder ? 0 : 1)
                .disabled(linkExistingFolder)

                HStack(spacing: 18) {
                    Button("Anuluj", action: onCancel)
                        .buttonStyle(FocusCardButtonStyle())
                    Button {
                        Task { await importPlaylist() }
                    } label: {
                        Label(
                            isImporting
                                ? (linkExistingFolder ? "Powiązuję…" : "Importuję…")
                                : (linkExistingFolder ? "Powiąż playlistę" : "Importuj playlistę"),
                            systemImage: linkExistingFolder ? "link" : "square.and.arrow.down.fill"
                        )
                    }
                    .buttonStyle(FocusCardButtonStyle())
                    .disabled(trimmedURL.isEmpty || isImporting || isLoading || preview == nil)
                    .focused($focusedField, equals: .importButton)
                }
            }
            .padding(72)
            .frame(maxWidth: 900, alignment: .leading)
        }
        .onAppear { focusedField = .url }
        .onExitCommand(perform: onCancel)
    }

    private var trimmedURL: String {
        url.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    @ViewBuilder
    private func playlistPreview(_ preview: MusicPlaylistCatalogResponse) -> some View {
        HStack(spacing: 18) {
            if let thumb = preview.playlist.thumbnail.flatMap(URL.init(string:)) {
                PosterRemoteImage(url: thumb)
                    .frame(width: 120, height: 120)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(preview.playlist.title)
                    .font(.title2.weight(.bold))
                    .lineLimit(2)
                Text("\(preview.tracks.count) utworów do importu")
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(18)
        .glassPanel(.card)
    }

    private func loadPreview() async {
        let value = trimmedURL
        guard !value.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            preview = try await app.api.previewAppleMusicPlaylist(url: value)
        } catch {
            preview = nil
            errorMessage = error.localizedDescription
        }
    }

    private func importPlaylist() async {
        let value = trimmedURL
        guard !value.isEmpty else { return }
        isImporting = true
        errorMessage = nil
        defer { isImporting = false }
        do {
            if preview == nil {
                preview = try await app.api.previewAppleMusicPlaylist(url: value)
            }
            let response = try await app.api.importAppleMusicPlaylist(
                url: value,
                folderId: targetFolderId
            )
            await app.refreshMusicLibrary()
            onImported(response.folder, linkExistingFolder ? false : downloadAfterImport)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

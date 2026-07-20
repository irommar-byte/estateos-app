import SwiftUI

/// Rozmyta okładka albumu w tle playera — delikatnie „oddycha” w rytm muzyki,
/// ze stroboskopem zsynchronizowanym z basem (bez rozjaśniania całego tła).
struct MusicPlayerBackdropView: View {
    @ObservedObject var player: MusicPlayerController
    let imageURL: URL?
    let strobeEnabled: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 120.0)) { timeline in
            let pulse = player.bassLevel
            let beatHit = player.beatHit
            let t = timeline.date.timeIntervalSinceReferenceDate

            // Delikatne oddalanie / przybliżanie — wolny oddech + puls basu
            let slowBreathe = sin(t * 0.62) * 0.024
            let bassZoom = pulse * 0.05 + beatHit * 0.065
            let strobeZoom = strobeEnabled ? beatHit * 0.045 : 0
            let livingScale = 1.10 + slowBreathe + bassZoom + strobeZoom

            // Ostre błyski stroboskopu — tylko na uderzeniach, bez rozjaśniania całego tła
            let strobeFlash = strobeEnabled ? min(1.0, beatHit * 1.15 + pulse * 0.08) : 0

            ZStack {
                MusicHeroBackdrop(
                    imageURL: imageURL,
                    blurRadius: 46,
                    darkOverlayOpacity: 0.42,
                    imageScale: livingScale
                )

                if strobeEnabled, strobeFlash > 0.28 {
                    // Pierścienie błysku od krawędzi — wyraźne, ale tło zostaje ciemne
                    RoundedRectangle(cornerRadius: 0, style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(strobeFlash * 0.85),
                                    NostalgieTheme.accent.opacity(strobeFlash * 0.65),
                                    Color.white.opacity(strobeFlash * 0.35),
                                    Color.clear,
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 3 + strobeFlash * 14
                        )
                        .padding(-8)
                        .blur(radius: 1.5 + strobeFlash * 2)
                        .ignoresSafeArea()
                        .blendMode(.screen)

                    // Krótki, ostry błysk — niska przezroczystość, bez wypłukiwania okładki
                    RadialGradient(
                        colors: [
                            Color.white.opacity(strobeFlash * 0.14),
                            NostalgieTheme.accentSecondary.opacity(strobeFlash * 0.10),
                            Color.clear,
                        ],
                        center: .center,
                        startRadius: 40,
                        endRadius: 680
                    )
                    .ignoresSafeArea()
                    .blendMode(.screen)
                }
            }
        }
    }
}

struct MusicPlayerScreen: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var app: AppModel
    @ObservedObject var player: MusicPlayerController
    @State private var showFolderPicker = false
    @State private var showCreateFolder = false
    @State private var newFolderName = ""
    @State private var isStrobeEnabled = false
    @State private var actionMessage: String?
    @State private var actionIsError = false
    @State private var browseArtist: MusicArtist?
    @State private var browseAlbum: MusicAlbum?
    @State private var activeFolder: MusicFolder?
    @FocusState private var focusedControl: PlayerControl?
    @FocusState private var musicTabFocus: HomeTabView.Tab?

    private enum PlayerControl: Hashable {
        case previous, playPause, next, favorite, addToFolder, openFolder, artist, album, shuffle, repeatMode, minimize, stop, strobe
        case folder(String), createFolder
    }

    init(player: MusicPlayerController) {
        self.player = player
    }

    private var currentTrack: MusicPlaybackTrack? { player.currentTrack }

    private var isFavorite: Bool {
        guard let url = currentTrack?.url else { return false }
        return app.isFavorite(url)
    }

    private var availableFolders: [MusicFolder] {
        app.musicFolders
    }

    private var currentPlaylistFolder: MusicFolder? {
        guard let folderId = player.folderId else { return nil }
        return app.musicFolders.first { $0.id == folderId }
    }

    var body: some View {
        Group {
            if let album = browseAlbum {
                MusicAlbumView(
                    album: album,
                    onBack: { browseAlbum = nil },
                    onTrack: { track, context in
                        Task {
                            await app.musicPlayback.play(
                                session: MusicPlaybackSession(
                                    queue: context,
                                    startIndex: context.firstIndex(where: { $0.id == track.url }) ?? 0,
                                    folderId: player.folderId,
                                    folderName: player.folderName
                                ),
                                app: app
                            )
                        }
                    }
                )
                .environmentObject(app)
            } else if let artist = browseArtist {
                MusicArtistView(
                    artist: artist,
                    onBack: { browseArtist = nil },
                    onAlbum: { browseAlbum = $0 },
                    onTrack: { track, context in
                        Task {
                            await app.musicPlayback.play(
                                session: MusicPlaybackSession(
                                    queue: context,
                                    startIndex: context.firstIndex(where: { $0.id == track.url }) ?? 0,
                                    folderId: player.folderId,
                                    folderName: player.folderName
                                ),
                                app: app
                            )
                        }
                    }
                )
                .environmentObject(app)
            } else {
                playerContent
            }
        }
        .fullScreenCover(item: $activeFolder) { folder in
            MusicFolderView(
                folder: folder,
                navigationTab: .music,
                focusedTab: $musicTabFocus,
                onBack: { activeFolder = nil }
            )
            .environmentObject(app)
        }
    }

    private var playerContent: some View {
        ZStack {
            MusicPlayerBackdropView(
                player: player,
                imageURL: currentTrack?.artworkURL,
                strobeEnabled: isStrobeEnabled
            )

            VStack(alignment: .leading, spacing: 22) {
                headerRow
                HStack(alignment: .bottom, spacing: 18) {
                    SubwooferBeatView(player: player, strobeEnabled: isStrobeEnabled)
                        .frame(width: 96, height: 96)
                        .focusable(false)
                    MusicOscillographView(player: player)
                        .focusable(false)
                    SubwooferBeatView(player: player, strobeEnabled: isStrobeEnabled)
                        .frame(width: 96, height: 96)
                        .focusable(false)
                    Spacer(minLength: 0)
                }
                mainRow
                    .focusable(false)
                progressSection
                    .focusable(false)
                transportRow
                actionsRow

                if showFolderPicker { folderPicker }

                if let actionMessage {
                    actionBanner(actionMessage, isError: actionIsError)
                }
                if let errorMessage = player.errorMessage {
                    actionBanner(errorMessage, isError: true)
                }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, NostalgieSpacing.screenH - 16)
            .padding(.top, NostalgieSpacing.screenTop - 8)
            .padding(.bottom, 40)
        }
        .defaultFocus($focusedControl, .playPause)
        .overlay {
            if player.isLoading {
                ProgressView("Przygotowuję odtwarzanie…")
                    .padding(24)
                    .glassPanel(.card)
            }
        }
        .task {
            if player.currentTrack == nil, !player.isLoading {
                await player.start()
            }
        }
        .onExitCommand { minimizePlayer() }
        .onPlayPauseCommand { player.togglePlayPause() }
        .fullScreenCover(isPresented: $showCreateFolder) {
            MusicFolderCreateSheet(
                name: $newFolderName,
                onCancel: {
                    showCreateFolder = false
                    newFolderName = ""
                },
                onCreate: { Task { await createFolderAndAdd() } }
            )
            .environmentObject(app)
        }
    }

    private var headerRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Label("Muzyka", systemImage: "music.note.circle.fill")
                    .font(NostalgieFont.caption)
                    .foregroundStyle(NostalgieTheme.accentSecondary)
                if let folderName = player.folderName, !folderName.isEmpty {
                    Text(folderName)
                        .font(NostalgieFont.rowTitle)
                        .lineLimit(1)
                        .foregroundStyle(.secondary)
                }
                Text(player.queuePositionLabel)
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.white.opacity(0.45))
            }
            Spacer()
            Button(action: minimizePlayer) {
                Label("Zwiń player", systemImage: "chevron.down.circle.fill")
                    .font(NostalgieFont.rounded(18))
                    .labelStyle(.iconOnly)
            }
            .buttonStyle(FocusCardButtonStyle())
            .focused($focusedControl, equals: .minimize)
            .onMoveCommand { direction in
                if direction == .down {
                    focusedControl = .playPause
                }
            }
        }
    }

    private func minimizePlayer() {
        app.musicPlayback.minimizePlayer()
        dismiss()
    }

    private var mainRow: some View {
        HStack(alignment: .center, spacing: 28) {
            artwork
            VStack(alignment: .leading, spacing: 8) {
                Text(currentTrack?.title ?? "—")
                    .font(NostalgieFont.rounded(34, weight: .bold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                if let artist = currentTrack?.artist, !artist.isEmpty {
                    Button {
                        Task { await openArtistCatalog() }
                    } label: {
                        Text(artist)
                            .font(NostalgieFont.rounded(.title3, weight: .medium))
                            .foregroundStyle(.white.opacity(0.78))
                            .lineLimit(1)
                    }
                    .buttonStyle(.plain)
                    .focused($focusedControl, equals: .artist)
                    .onMoveCommand { direction in
                        if direction == .down { focusedControl = .playPause }
                        if direction == .up { focusedControl = .minimize }
                    }
                }
                if let album = currentTrack?.album, !album.isEmpty {
                    Button {
                        Task { await openAlbumCatalog() }
                    } label: {
                        Text(album)
                            .font(NostalgieFont.metadata)
                            .foregroundStyle(.white.opacity(0.5))
                            .lineLimit(1)
                    }
                    .buttonStyle(.plain)
                    .disabled(currentTrack?.albumId == nil)
                    .focused($focusedControl, equals: .album)
                    .onMoveCommand { direction in
                        if direction == .down { focusedControl = .playPause }
                        if direction == .up { focusedControl = .minimize }
                    }
                }
                Label("MP3 · Apple Music", systemImage: "opticaldisc.fill")
                    .font(NostalgieFont.caption)
                    .foregroundStyle(.white.opacity(0.55))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var artwork: some View {
        Group {
            if let url = currentTrack?.artworkURL {
                PosterRemoteImage(url: url)
            } else {
                Color.clear.overlay {
                    Image(systemName: "music.note")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(width: 220, height: 220)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.12), lineWidth: 1)
        }
    }

    private var progressSection: some View {
        VStack(spacing: 8) {
            ProgressView(value: progressValue, total: 1)
                .progressViewStyle(.linear)
                .tint(NostalgieTheme.accent)
            HStack {
                Text(formatTime(player.currentTime))
                Spacer()
                Text(formatTime(max(player.duration, player.currentTime)))
            }
            .font(NostalgieFont.caption.monospacedDigit())
            .foregroundStyle(.secondary)
        }
    }

    private var progressValue: Double {
        guard player.duration > 0 else { return 0 }
        return min(1, max(0, player.currentTime / player.duration))
    }

    private var transportRow: some View {
        HStack(spacing: 12) {
            playerButton("Poprzedni", systemImage: "backward.fill", control: .previous, moveUp: .minimize, moveDown: .favorite) {
                Task { await player.skipPrevious() }
            }
            .disabled(!player.hasPrevious || player.isLoading)

            Button { player.togglePlayPause() } label: {
                Image(systemName: player.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(NostalgieFont.rounded(44))
            }
            .buttonStyle(DetailPlayButtonStyle())
            .disabled(player.isLoading || currentTrack == nil)
            .focused($focusedControl, equals: .playPause)
            .onMoveCommand { direction in
                switch direction {
                case .up:
                    focusedControl = .minimize
                case .down:
                    focusedControl = .favorite
                default:
                    break
                }
            }

            playerButton("Następny", systemImage: "forward.fill", control: .next, moveUp: .minimize, moveDown: .favorite) {
                Task { await player.skipNext() }
            }
            .disabled(!player.hasNext || player.isLoading)

            playerButton(
                player.shuffleEnabled ? "Losowo wł." : "Losowo",
                systemImage: player.shuffleEnabled ? "shuffle.circle.fill" : "shuffle",
                control: .shuffle,
                tint: player.shuffleEnabled ? .green : nil,
                moveUp: .minimize,
                moveDown: .favorite
            ) {
                player.toggleShuffle()
            }

            playerButton(
                player.repeatMode.label,
                systemImage: player.repeatMode.icon,
                control: .repeatMode,
                tint: player.repeatMode == .off ? nil : .green,
                moveUp: .minimize,
                moveDown: .favorite
            ) {
                player.cycleRepeatMode()
            }

            playerButton("Zatrzymaj", systemImage: "stop.fill", control: .stop, tint: .orange, moveUp: .minimize, moveDown: .favorite) {
                app.musicPlayback.stopPlayback()
            }
        }
    }

    private var actionsRow: some View {
        HStack(spacing: 12) {
            playerButton(
                isFavorite ? "Ulubione" : "Dodaj serce",
                systemImage: isFavorite ? "heart.fill" : "heart",
                control: .favorite,
                tint: isFavorite ? .pink : nil,
                moveUp: .playPause
            ) {
                Task { await toggleFavorite() }
            }
            .disabled(currentTrack == nil)

            playerButton("Do playlisty", systemImage: "folder.badge.plus", control: .addToFolder, moveUp: .playPause) {
                withAnimation(NostalgieTheme.contentSpring) { showFolderPicker.toggle() }
            }
            .disabled(currentTrack == nil)

            if currentPlaylistFolder != nil {
                playerButton("Otwórz playlistę", systemImage: "music.note.list", control: .openFolder, moveUp: .playPause) {
                    activeFolder = currentPlaylistFolder
                }
            }
            playerButton("Stroboskop", systemImage: "bolt.fill", control: .strobe, tint: isStrobeEnabled ? .yellow : nil, moveUp: .playPause) {
                isStrobeEnabled.toggle()
            }
        }
    }

    private func playerButton(
        _ title: String,
        systemImage: String,
        control: PlayerControl,
        tint: Color? = nil,
        moveUp: PlayerControl? = nil,
        moveDown: PlayerControl? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(NostalgieFont.rounded(.title3, weight: .semibold))
                    .foregroundStyle(tint ?? .primary)
                Text(title)
                    .font(NostalgieFont.caption)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(minWidth: 76)
            .padding(.horizontal, 8)
            .padding(.vertical, 10)
        }
        .buttonStyle(FocusCardButtonStyle())
        .focused($focusedControl, equals: control)
        .onMoveCommand { direction in
            switch direction {
            case .up:
                if let moveUp { focusedControl = moveUp }
            case .down:
                if let moveDown { focusedControl = moveDown }
            default:
                break
            }
        }
    }

    private var folderPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Dodaj do playlisty")
                .font(NostalgieFont.rowTitle)
                .foregroundStyle(.white.opacity(0.72))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    Button {
                        newFolderName = ""
                        showCreateFolder = true
                    } label: {
                        Label("Nowy folder", systemImage: "plus.circle.fill")
                    }
                    .buttonStyle(ChipButtonStyle(isSelected: false))
                    .focused($focusedControl, equals: .createFolder)

                    ForEach(availableFolders) { folder in
                        Button {
                            Task { await addToFolder(folder) }
                        } label: {
                            Label(folder.name, systemImage: "folder.fill")
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: false))
                        .focused($focusedControl, equals: .folder(folder.id))
                    }
                }
            }
        }
        .padding(14)
        .glassPanel(.panel)
    }

    private func actionBanner(_ message: String, isError: Bool) -> some View {
        HStack(spacing: 10) {
            Image(systemName: isError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .foregroundStyle(isError ? Color.orange : .green)
            Text(message)
                .font(NostalgieFont.body)
                .foregroundStyle(.white.opacity(0.85))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .glassPanel(.panel)
    }

    private func formatTime(_ seconds: Double) -> String {
        MediaDurationFormat.label(for: seconds) ?? "0:00"
    }

    private func toggleFavorite() async {
        guard let track = currentTrack else { return }
        do {
            if app.isFavorite(track.url) {
                try await app.removeFavorite(url: track.url)
                actionMessage = "Usunięto z ulubionych."
            } else {
                try await app.addFavorite(track.favoriteItem)
                actionMessage = "Dodano do ulubionych."
            }
            actionIsError = false
        } catch {
            actionMessage = error.localizedDescription
            actionIsError = true
        }
    }

    private func addToFolder(_ folder: MusicFolder) async {
        guard let track = currentTrack else { return }
        do {
            _ = try await app.api.addTrackToFolder(folderId: folder.id, track: track.trackPayload)
            await app.refreshMusicLibrary()
            actionMessage = "Dodano do «\(folder.name)»."
            actionIsError = false
        } catch {
            actionMessage = error.localizedDescription
            actionIsError = true
        }
    }

    private func createFolderAndAdd() async {
        let name = newFolderName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        do {
            let folder = try await app.createMusicFolder(name: name)
            showCreateFolder = false
            newFolderName = ""
            await addToFolder(folder)
        } catch {
            actionMessage = error.localizedDescription
            actionIsError = true
        }
    }

    private func openArtistCatalog() async {
        guard let track = currentTrack else { return }
        if let artistId = track.artistId, !artistId.isEmpty {
            browseArtist = MusicArtist(
                id: artistId,
                name: track.artist ?? "Wykonawca",
                genre: nil,
                thumbnail: track.thumbnail,
                url: nil,
                source: "apple-music"
            )
            return
        }
        guard let name = track.artist, !name.isEmpty else { return }
        do {
            let results = try await app.api.searchMusicCatalog(query: name)
            if let artist = results.artists.first(where: { $0.name.localizedCaseInsensitiveCompare(name) == .orderedSame })
                ?? results.artists.first {
                browseArtist = artist
            } else {
                actionMessage = "Nie znaleziono wykonawcy w Apple Music."
                actionIsError = true
            }
        } catch {
            actionMessage = error.localizedDescription
            actionIsError = true
        }
    }

    private func openAlbumCatalog() async {
        guard let track = currentTrack, let albumId = track.albumId, !albumId.isEmpty else { return }
        browseAlbum = MusicAlbum(
            id: albumId,
            title: track.album ?? "Album",
            artist: track.artist,
            artistId: track.artistId,
            thumbnail: track.thumbnail,
            trackCount: nil,
            releaseDate: nil,
            url: nil,
            source: "apple-music"
        )
    }
}

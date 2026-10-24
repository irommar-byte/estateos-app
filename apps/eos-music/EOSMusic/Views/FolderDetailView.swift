import SwiftUI
import PhotosUI

struct FolderDetailView: View {
    @EnvironmentObject private var app: AppModel
    let folder: MusicFolder

    @State private var tracks: [MusicTrack] = []
    @State private var isLoading = true
    @State private var isSyncing = false
    @State private var errorMessage: String?
    @State private var editMode: EditMode = .inactive
    @State private var trackToAdd: MusicTrackPayload?
    @State private var trackTitleForSheet = ""
    @State private var offlineRemovalURL: String?
    @State private var offlineRemovalTitle = ""
    @State private var coverPickerItem: PhotosPickerItem?
    @State private var isUploadingCover = false
    @State private var showCoverPicker = false
    @State private var showDownloadDestinationSheet = false
    @State private var downloadSheetTracks: [MusicTrack] = []
    @State private var selectedTrackIDs: Set<String> = []
    @StateObject private var usbExport = PlaylistUSBExportService()
    @State private var autoPolicy = PlaylistAutoAcquirePolicy.off
    @State private var pendingAutoPolicy: PlaylistAutoAcquirePolicy?
    @State private var isApplyingAutoPolicy = false

    @State private var rowTaps = 0

    private var isEditing: Bool { editMode == .active }

    private var liveFolder: MusicFolder {
        app.musicFolders.first(where: { $0.id == folder.id }) ?? folder
    }

    private var headerArtworkURL: URL? {
        if let url = liveFolder.artworkURL { return url }
        return tracks.first(where: { $0.artworkURL != nil })?.artworkURL
    }

    private var pendingCount: Int {
        tracks.filter { track in
            guard !app.isOfflineAvailable(track.url) else { return false }
            if app.isOnServer(track.url) || track.isOnServer { return false }
            let state = app.downloads.uiState(
                for: track.url,
                isOnServer: false
            )
            return state != .done
        }.count
    }

    /// Visible playlist rows — offline mode shows only downloaded tracks.
    private var displayTracks: [MusicTrack] {
        app.tracksMatchingOfflineAvailability(tracks)
    }

    private var selectedTracks: [MusicTrack] {
        displayTracks.filter { selectedTrackIDs.contains($0.url) }
    }

    var body: some View {
        Group {
            if isLoading {
                EOSLoadingView(title: "Wczytuję utwory…")
                    .transition(.opacity.combined(with: .scale(scale: 0.985)))
            } else if displayTracks.isEmpty {
                List {
                    Section {
                        playlistHeader
                    }
                    .listRowBackground(Color.clear)
                    ContentUnavailableView(
                        app.isOfflinePlaybackActive ? "Brak pobranych w tej playliście" : "Brak utworów",
                        systemImage: app.isOfflinePlaybackActive ? "airplane" : "music.note",
                        description: Text(app.isOfflinePlaybackActive
                            ? "Pobierz utwory online, aby odtwarzać tę playlistę offline."
                            : "Dodaj utwory z wyszukiwarki lub zsynchronizuj playlistę.")
                    )
                    .listRowBackground(Color.clear)
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .transition(.opacity)
            } else {
                List(selection: $selectedTrackIDs) {
                    if !isEditing {
                        Section {
                            playlistHeader
                        }
                        .listRowBackground(Color.clear)
                        .selectionDisabled(true)

                        Section {
                            // Jak w Apple Music: dwa równe przyciski pod okładką.
                            HStack(spacing: 12) {
                                PlaylistActionPill(title: "Odtwórz", systemImage: "play.fill") {
                                    Task { await playAll(from: 0) }
                                }
                                PlaylistActionPill(title: "Losowo", systemImage: "shuffle") {
                                    Task { await playShuffled() }
                                }
                            }
                            .disabled(displayTracks.isEmpty)
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))

                            if pendingCount > 0, !app.isOfflinePlaybackActive {
                                Button {
                                    openDownloadSheet(for: tracks)
                                } label: {
                                    Label("Pobierz wszystkie (\(pendingCount))", systemImage: "icloud.and.arrow.down")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(EOSTheme.accentSecondary)
                                }
                            }
                        }
                        .selectionDisabled(true)
                    } else if !app.isOfflinePlaybackActive, !selectedTracks.isEmpty {
                        Section {
                            Button {
                                openDownloadSheet(for: selectedTracks)
                            } label: {
                                Label(
                                    "Pobierz zaznaczone (\(selectedTracks.count))",
                                    systemImage: "icloud.and.arrow.down"
                                )
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(EOSTheme.accentSecondary)
                            }
                        }
                        .selectionDisabled(true)
                    }
                    Section(app.isOfflinePlaybackActive
                            ? "\(displayTracks.count) pobranych"
                            : "\(displayTracks.count) utworów") {
                        // Indeks z enumerated — wcześniej każdy wiersz szukał siebie w całej liście (kwadratowo).
                        ForEach(Array(displayTracks.enumerated()), id: \.element.id) { index, track in
                            trackRow(for: track, index: index)
                                .tag(track.url)
                        }
                        .onMove(perform: app.isOfflinePlaybackActive ? nil : moveTracks)
                        .onDelete(perform: app.isOfflinePlaybackActive ? nil : deleteTracks)
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .eosScrollClearance()
                .environment(\.editMode, $editMode)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .animation(EOSMotion.snappy, value: isLoading)
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: tracks.count)
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: rowTaps)
        .background(EOSAmbientBackground())
        .navigationTitle(liveFolder.name)
        .sheet(isPresented: $showDownloadDestinationSheet) {
            MusicDownloadDestinationSheet(
                title: folder.name,
                subtitle: downloadSheetTracks.count == tracks.count
                    ? "Pobierz \(pendingCount) utworów"
                    : "Pobierz zaznaczone (\(downloadSheetTracks.count))",
                trackCount: downloadSheetTracks.count == tracks.count
                    ? pendingCount
                    : downloadSheetTracks.count
            ) { destination in
                app.downloadAll(
                    in: downloadSheetTracks,
                    folderId: folder.id,
                    destination: destination,
                    label: downloadSheetTracks.count == tracks.count
                        ? folder.name
                        : "Zaznaczone utwory"
                )
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                EditButton()
                    .disabled(app.isOfflinePlaybackActive)
            }
            if isEditing, !selectedTracks.isEmpty, !app.isOfflinePlaybackActive {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Pobierz") {
                        openDownloadSheet(for: selectedTracks)
                    }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showCoverPicker = true
                    } label: {
                        Label(
                            headerArtworkURL == nil ? "Dodaj okładkę" : "Zmień okładkę",
                            systemImage: "photo.on.rectangle"
                        )
                    }
                    if PlaylistHygiene.importBadge(for: folder) == .appleMusic, !isEditing {
                        Button {
                            Task { await syncPlaylist() }
                        } label: {
                            Label("Synchronizuj Apple Music", systemImage: "arrow.triangle.2.circlepath")
                        }
                        .disabled(isSyncing)
                    }
                    Button {
                        exportToUSB()
                    } label: {
                        Label(usbRepeatTitle, systemImage: "externaldrive")
                    }
                    Picker("Auto-pobieranie", selection: $autoPolicy) {
                        ForEach(PlaylistAutoAcquirePolicy.allCases) { policy in
                            Text(policy.title).tag(policy)
                        }
                    }
                } label: {
                    if isUploadingCover || isSyncing {
                        ProgressView()
                    } else {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .photosPicker(isPresented: $showCoverPicker, selection: $coverPickerItem, matching: .images)
        .onChange(of: coverPickerItem) { _, item in
            guard let item else { return }
            Task { await uploadCover(from: item) }
        }
        .onChange(of: isEditing) { _, editing in
            if !editing { selectedTrackIDs.removeAll() }
        }
        .task {
            await load()
            await backfillCovers()
        }
        .sheet(item: $trackToAdd) { payload in
            AddToPlaylistSheet(track: payload, trackTitle: trackTitleForSheet)
                .environmentObject(app)
        }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .alert("Usunąć z urządzenia?", isPresented: Binding(get: { offlineRemovalURL != nil }, set: { if !$0 { offlineRemovalURL = nil } })) {
            Button("Usuń", role: .destructive) {
                if let url = offlineRemovalURL {
                    app.removeOfflineDownload(for: url)
                }
                offlineRemovalURL = nil
            }
            Button("Anuluj", role: .cancel) {
                offlineRemovalURL = nil
            }
        } message: {
            Text("„\(offlineRemovalTitle)” zostanie usunięty z telefonu. Utwór pozostanie w playliście.")
        }
        .alert(
            autoPolicyConfirmTitle,
            isPresented: Binding(
                get: { pendingAutoPolicy != nil },
                set: { if !$0 { cancelPendingAutoPolicy() } }
            )
        ) {
            Button(autoPolicyConfirmActionTitle) {
                confirmPendingAutoPolicy()
            }
            Button("Anuluj", role: .cancel) {
                cancelPendingAutoPolicy()
            }
        } message: {
            Text(autoPolicyConfirmMessage)
        }
    }

    private var autoPolicyConfirmTitle: String {
        switch pendingAutoPolicy {
        case .server: return "Pobrać na serwer?"
        case .serverAndPhone: return "Pobrać na serwer i iPhone?"
        default: return "Auto-pobieranie"
        }
    }

    private var autoPolicyConfirmActionTitle: String {
        guard let policy = pendingAutoPolicy else { return "Potwierdź" }
        let plan = app.playlistAutoAcquirePlan(tracks: tracks, policy: policy)
        switch policy {
        case .server:
            return plan.serverCount == 0 ? "Włącz" : "Pobierz"
        case .serverAndPhone:
            return plan.serverCount == 0 && plan.phoneCount == 0 ? "Włącz" : "Pobierz"
        case .off:
            return "Potwierdź"
        }
    }

    private var autoPolicyConfirmMessage: String {
        guard let policy = pendingAutoPolicy else { return "" }
        let plan = app.playlistAutoAcquirePlan(tracks: tracks, policy: policy)
        switch policy {
        case .off:
            return ""
        case .server:
            if plan.serverCount == 0 {
                return "Wszystkie utwory są już na serwerze. Włączyć tryb na przyszłość?"
            }
            return "Na pewno? \(plan.serverCount) \(utworowWord(plan.serverCount)) zostanie zapisanych na serwer EOS. Pobieranie pójdzie od razu do skutku."
        case .serverAndPhone:
            if plan.serverCount == 0, plan.phoneCount == 0 {
                return "Wszystko jest już na serwerze i na iPhonie. Włączyć tryb na przyszłość?"
            }
            var parts: [String] = []
            if plan.serverCount > 0 {
                parts.append("\(plan.serverCount) na serwer")
            }
            if plan.phoneCount > 0 {
                parts.append("\(plan.phoneCount) na iPhone")
            }
            return "Na pewno? \(parts.joined(separator: ", potem ")). Pobieranie startuje od razu i idzie do skutku."
        }
    }

    private func utworowWord(_ n: Int) -> String {
        let mod10 = n % 10
        let mod100 = n % 100
        if n == 1 { return "utwór" }
        if mod10 >= 2, mod10 <= 4, !(mod100 >= 12 && mod100 <= 14) { return "utwory" }
        return "utworów"
    }

    private func cancelPendingAutoPolicy() {
        guard !isApplyingAutoPolicy else { return }
        pendingAutoPolicy = nil
        autoPolicy = PlaylistAutoAcquireStore.policy(for: folder.id)
    }

    private func confirmPendingAutoPolicy() {
        guard let policy = pendingAutoPolicy else { return }
        isApplyingAutoPolicy = true
        pendingAutoPolicy = nil
        PlaylistAutoAcquireStore.set(policy, for: folder.id)
        autoPolicy = policy
        app.startPlaylistAutoAcquire(
            folderId: folder.id,
            folderName: liveFolder.name,
            tracks: tracks,
            policy: policy
        )
        isApplyingAutoPolicy = false
    }

    private var playlistHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            PlaylistHeroHeader(
                title: liveFolder.name,
                subtitle: app.playlistCountLabel(for: liveFolder, tracks: tracks),
                artworkURL: headerArtworkURL,
                onPickPhoto: { showCoverPicker = true }
            )
            HStack(spacing: 8) {
                if let badge = PlaylistHygiene.importBadge(for: liveFolder) {
                    PlaylistImportBadgeView(badge: badge)
                }
                if PlaylistHygiene.isPrimary(liveFolder) {
                    Text("Biblioteka")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.secondary.opacity(0.14), in: Capsule())
                }
            }
            Picker("Auto-pobieranie", selection: $autoPolicy) {
                ForEach(PlaylistAutoAcquirePolicy.allCases) { policy in
                    Text(policy.title).tag(policy)
                }
            }
            .pickerStyle(.segmented)
            if usbExport.isExporting {
                ProgressView(value: usbExport.progress) {
                    Text(usbExport.statusTitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .overlay(alignment: .center) {
            if isUploadingCover {
                ProgressView()
                    .padding(12)
                    .background(.ultraThinMaterial, in: Capsule())
            }
        }
        .onAppear { autoPolicy = PlaylistAutoAcquireStore.policy(for: folder.id) }
        .onChange(of: autoPolicy) { old, policy in
            guard !isApplyingAutoPolicy else { return }
            if policy == .off {
                PlaylistAutoAcquireStore.set(.off, for: folder.id)
                return
            }
            if policy == PlaylistAutoAcquireStore.policy(for: folder.id), pendingAutoPolicy == nil {
                // Already persisted (e.g. after confirm) — don't re-prompt.
                return
            }
            // Revert UI until user confirms; keep the intended policy in pending.
            isApplyingAutoPolicy = true
            autoPolicy = old
            isApplyingAutoPolicy = false
            pendingAutoPolicy = policy
        }
    }

    @ViewBuilder
    private func trackRow(for track: MusicTrack, index: Int) -> some View {
        let downloadState = app.downloads.uiState(
            for: track.url,
            isOnServer: app.isOnServer(track.url) || track.isOnServer
        )

        let rowContent = HStack(spacing: 8) {
            Group {
                if isEditing {
                    TrackRowView(
                        index: index + 1,
                        title: track.title,
                        subtitle: [track.artist, track.album].compactMap { $0 }.joined(separator: " · "),
                        duration: track.duration,
                        artworkURL: PlaylistArtworkBackfill.resolvedURL(for: track),
                        isPlaying: false,
                        downloadState: downloadState
                    )
                } else {
                    Button {
                        rowTaps += 1
                        Task { await playAll(from: index) }
                    } label: {
                        TrackRowView(
                            index: index + 1,
                            title: track.title,
                            subtitle: [track.artist, track.album].compactMap { $0 }.joined(separator: " · "),
                            duration: track.duration,
                            artworkURL: PlaylistArtworkBackfill.resolvedURL(for: track),
                            isPlaying: app.playback.engine?.currentTrack?.url == track.url,
                            downloadState: downloadState
                        )
                    }
                    .buttonStyle(EOSRowPressStyle())
                }
            }

            if !isEditing {
                FavoriteButton(item: track.favoriteItem, size: 16)
                    .frame(width: 28)

                TrackStorageActionButton(
                    track: track.payload,
                    folderId: folder.id,
                    frameSize: 36
                )
            }
        }

        if isEditing {
            rowContent
        } else {
            rowContent
                .trackQuickActions(
                    TrackQuickActionItem(track: track),
                    play: { Task { await playAll(from: index) } },
                    removeFromPlaylist: { Task { await removeTrack(track) } },
                    showsSwipe: false
                )
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) {
                        Task { await removeTrack(track) }
                    } label: {
                        Label("Usuń", systemImage: "trash")
                    }
                }
                .swipeActions(edge: .leading) {
                    Button {
                        Task { await app.toggleFavorite(track.favoriteItem) }
                    } label: {
                        Label("Ulubione", systemImage: app.isFavorite(track.url) ? "heart.slash" : "heart")
                    }
                    .tint(EOSTheme.accent)
                    if downloadState.isBusy {
                        Button {
                            app.cancelDownload(for: track.url)
                        } label: {
                            Label("Anuluj pobieranie", systemImage: "stop.fill")
                        }
                        .tint(.orange)
                    }
                }
        }
    }

    @ViewBuilder
    private func contextMenuItems(for track: MusicTrack) -> some View {
        Button {
            Task { await app.toggleFavorite(track.favoriteItem) }
        } label: {
            Label(
                app.isFavorite(track.url) ? "Usuń z ulubionych" : "Dodaj do ulubionych",
                systemImage: app.isFavorite(track.url) ? "heart.slash" : "heart"
            )
        }
        Button {
            trackTitleForSheet = track.title
            trackToAdd = track.payload
        } label: {
            Label("Dodaj do innej playlisty", systemImage: "text.badge.plus")
        }
        if app.downloads.isDownloading(track.url) {
            Button {
                app.cancelDownload(for: track.url)
            } label: {
                Label("Anuluj pobieranie", systemImage: "stop.fill")
            }
        } else if app.isOfflineAvailable(track.url) {
            Button(role: .destructive) {
                offlineRemovalTitle = track.title
                offlineRemovalURL = track.url
            } label: {
                Label("Usuń z urządzenia", systemImage: "trash")
            }
        } else {
            Button {
                app.downloadTrack(track, folderId: folder.id)
            } label: {
                Label("Pobierz offline", systemImage: "icloud.and.arrow.down")
            }
        }
        Button(role: .destructive) {
            Task { await removeTrack(track) }
        } label: {
            Label("Usuń z playlisty", systemImage: "minus.circle")
        }
    }

    private func uploadCover(from item: PhotosPickerItem) async {
        isUploadingCover = true
        defer {
            isUploadingCover = false
            coverPickerItem = nil
        }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                errorMessage = "Nie udało się odczytać zdjęcia."
                return
            }
            try await app.updateFolderCover(folderId: folder.id, imageData: data)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func moveTracks(from source: IndexSet, to destination: Int) {
        tracks.move(fromOffsets: source, toOffset: destination)
        Task {
            do {
                try await app.reorderTracks(in: folder.id, urls: tracks.map(\.url))
            } catch {
                errorMessage = error.localizedDescription
                await load()
            }
        }
    }

    private func deleteTracks(at offsets: IndexSet) {
        let toRemove = offsets.map { tracks[$0] }
        Task {
            for track in toRemove {
                await removeTrack(track)
            }
        }
    }

    private func removeTrack(_ track: MusicTrack) async {
        app.cancelDownload(for: track.url)
        do {
            try await app.removeTrackFromFolder(folderId: folder.id, url: track.url)
            tracks.removeAll { $0.url == track.url }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }

        // Prefer cached library tracks so Offline works without the API.
        let cached = app.musicTracks.filter { $0.folderId == folder.id }
        if !cached.isEmpty {
            tracks = PlaylistArtworkBackfill.overlayLocalCovers(cached)
        }

        if app.isOfflinePlaybackActive {
            if tracks.isEmpty {
                tracks = PlaylistArtworkBackfill.overlayLocalCovers(
                    app.downloadedLibraryTracks.filter { $0.folderId == folder.id }
                )
            }
            return
        }

        do {
            let response = try await app.api.fetchFolderTracks(folderId: folder.id)
            tracks = PlaylistArtworkBackfill.overlayLocalCovers(response.tracks)
            app.downloads.syncFromTracks(tracks)
        } catch {
            if tracks.isEmpty {
                errorMessage = error.localizedDescription
            }
            // Keep cached tracks when network fails.
        }
    }

    private func backfillCovers() async {
        tracks = PlaylistArtworkBackfill.overlayLocalCovers(tracks)
        guard !app.isOfflinePlaybackActive else { return }
        tracks = await PlaylistArtworkBackfill.fillMissing(tracks: tracks, api: app.api)
    }

    private func openDownloadSheet(for tracksToDownload: [MusicTrack]) {
        downloadSheetTracks = tracksToDownload
        showDownloadDestinationSheet = true
    }

    private func playAll(from index: Int) async {
        await app.playTracks(displayTracks, startIndex: index, folder: folder)
    }

    /// „Losowo”: start od przypadkowego utworu i włączone mieszanie kolejki.
    private func playShuffled() async {
        let list = displayTracks
        guard !list.isEmpty else { return }
        await app.playTracks(list, startIndex: Int.random(in: list.indices), folder: folder)
        if let engine = app.playback.engine, !engine.shuffleEnabled {
            engine.toggleShuffle()
        }
    }

    private var usbRepeatTitle: String {
        if let name = PlaylistUSBBookmarkStore.displayName(for: folder.id) {
            return "Zapisz znowu na \(name)"
        }
        return "Zapisz na USB / folderze"
    }

    private func exportToUSB() {
        if let url = PlaylistUSBBookmarkStore.resolvedURL(for: folder.id) {
            Task {
                await usbExport.export(
                    playlistName: liveFolder.name,
                    folderId: folder.id,
                    tracks: displayTracks,
                    destinationRoot: url,
                    app: app
                )
            }
            return
        }
        FolderPickerPresenter.present { url in
            Task {
                await usbExport.export(
                    playlistName: liveFolder.name,
                    folderId: folder.id,
                    tracks: displayTracks,
                    destinationRoot: url,
                    app: app
                )
            }
        }
    }

    private func syncPlaylist() async {
        isSyncing = true
        defer { isSyncing = false }
        do {
            try await app.api.syncAppleMusicPlaylist(folderId: folder.id)
            try await app.refreshMusicLibrary()
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

extension MusicTrackPayload: Identifiable {
    var id: String { url }
}


// MARK: - Nagłówek playlisty w stylu Apple Music

/// Duża, wyśrodkowana okładka z głębokim cieniem, tytuł i opis pod spodem.
private struct PlaylistHeroHeader: View {
    let title: String
    let subtitle: String?
    let artworkURL: URL?
    var onPickPhoto: (() -> Void)?

    @State private var appeared = false

    var body: some View {
        VStack(spacing: 14) {
            ZStack(alignment: .bottomTrailing) {
                ArtworkImage(
                    url: artworkURL,
                    size: 236,
                    cornerRadius: 14,
                    allowAnimated: true,
                    placeholderTitle: title
                )
                .shadow(color: .black.opacity(0.28), radius: 24, y: 14)
                .scaleEffect(appeared ? 1 : 0.92)
                .opacity(appeared ? 1 : 0)

                if let onPickPhoto {
                    Button(action: onPickPhoto) {
                        Image(systemName: artworkURL == nil ? "camera.fill" : "pencil")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 34, height: 34)
                            .background(.ultraThinMaterial, in: Circle())
                            .overlay(Circle().strokeBorder(Color.white.opacity(0.25), lineWidth: 0.5))
                    }
                    .buttonStyle(EOSPressableStyle(pressedScale: 0.88))
                    .padding(10)
                    .accessibilityLabel(artworkURL == nil ? "Dodaj okładkę" : "Zmień okładkę")
                }
            }

            VStack(spacing: 4) {
                Text(title)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(EOSTheme.textPrimary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(EOSTheme.accent)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }
            }
            .offset(y: appeared ? 0 : 8)
            .opacity(appeared ? 1 : 0)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 4)
        .onAppear {
            withAnimation(.spring(response: 0.55, dampingFraction: 0.82)) { appeared = true }
        }
    }
}

/// Przycisk „Odtwórz” / „Losowo” pod nagłówkiem playlisty.
private struct PlaylistActionPill: View {
    let title: String
    let systemImage: String
    let action: () -> Void
    @State private var taps = 0

    var body: some View {
        Button {
            taps += 1
            action()
        } label: {
            Label(title, systemImage: systemImage)
                .font(.headline)
                .foregroundStyle(EOSTheme.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.primary.opacity(0.07))
                )
                .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(EOSPressableStyle(pressedScale: 0.96))
        .sensoryFeedback(.impact(weight: .light), trigger: taps)
    }
}

/// Wiersz utworu: krótkie podświetlenie przy dotyku, jak w liście Apple Music.
struct EOSRowPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.primary.opacity(configuration.isPressed ? 0.08 : 0))
                    .padding(.horizontal, -6)
            )
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.18), value: configuration.isPressed)
    }
}

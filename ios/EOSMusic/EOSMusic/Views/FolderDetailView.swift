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
            let state = app.downloads.uiState(for: track.url, isDownloaded: track.isDownloaded)
            return state == .idle || state.isFailed
        }.count
    }

    var body: some View {
        Group {
            if isLoading {
                EOSLoadingView(title: "Wczytuję utwory…")
                    .transition(.opacity.combined(with: .scale(scale: 0.985)))
            } else if tracks.isEmpty {
                List {
                    Section {
                        playlistHeader
                    }
                    .listRowBackground(Color.clear)
                    ContentUnavailableView(
                        "Brak utworów",
                        systemImage: "music.note",
                        description: Text("Dodaj utwory z wyszukiwarki lub zsynchronizuj playlistę.")
                    )
                    .listRowBackground(Color.clear)
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .transition(.opacity)
            } else {
                List {
                    if !isEditing {
                        Section {
                            playlistHeader
                        }
                        .listRowBackground(Color.clear)

                        Section {
                            Button {
                                Task { await playAll(from: 0) }
                            } label: {
                                Label("Odtwórz wszystko", systemImage: "play.fill")
                                    .font(.headline)
                                    .foregroundStyle(EOSTheme.accent)
                            }

                            if pendingCount > 0 {
                                Button {
                                    app.downloadAll(in: tracks, folderId: folder.id)
                                } label: {
                                    Label("Pobierz wszystkie (\(pendingCount))", systemImage: "icloud.and.arrow.down")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(EOSTheme.accentSecondary)
                                }
                            }
                        }
                    }
                    Section("\(tracks.count) utworów") {
                        ForEach(tracks) { track in
                            trackRow(for: track)
                        }
                        .onMove(perform: moveTracks)
                        .onDelete(perform: deleteTracks)
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .environment(\.editMode, $editMode)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .animation(.snappy(duration: 0.25), value: isLoading)
        .animation(.snappy(duration: 0.25), value: tracks.count)
        .background(EOSAmbientBackground())
        .navigationTitle(liveFolder.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                EditButton()
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
                    if folder.applePlaylistUrl != nil, !isEditing {
                        Button {
                            Task { await syncPlaylist() }
                        } label: {
                            Label("Synchronizuj Apple Music", systemImage: "arrow.triangle.2.circlepath")
                        }
                        .disabled(isSyncing)
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
        .task { await load() }
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
    }

    private var playlistHeader: some View {
        LibraryEntityHeader(
            title: liveFolder.name,
            subtitle: liveFolder.countLabel,
            artworkURL: headerArtworkURL,
            showsPhotoPicker: true,
            onPickPhoto: { showCoverPicker = true }
        )
        .overlay(alignment: .center) {
            if isUploadingCover {
                ProgressView()
                    .padding(12)
                    .background(.ultraThinMaterial, in: Capsule())
            }
        }
    }

    @ViewBuilder
    private func trackRow(for track: MusicTrack) -> some View {
        let index = tracks.firstIndex(where: { $0.url == track.url }) ?? 0
        let downloadState = app.downloads.uiState(
            for: track.url,
            isOnServer: track.isOnServer
        )

        let rowContent = HStack(spacing: 8) {
            Group {
                if isEditing {
                    TrackRowView(
                        index: index + 1,
                        title: track.title,
                        subtitle: [track.artist, track.album].compactMap { $0 }.joined(separator: " · "),
                        duration: track.duration,
                        artworkURL: track.artworkURL,
                        isPlaying: false,
                        downloadState: downloadState
                    )
                } else {
                    Button {
                        Task { await app.playTracks(tracks, startIndex: index, folder: folder) }
                    } label: {
                        TrackRowView(
                            index: index + 1,
                            title: track.title,
                            subtitle: [track.artist, track.album].compactMap { $0 }.joined(separator: " · "),
                            duration: track.duration,
                            artworkURL: track.artworkURL,
                            isPlaying: app.playback.engine?.currentTrack?.url == track.url,
                            downloadState: downloadState
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            if !isEditing {
                FavoriteButton(item: track.favoriteItem, size: 16)
                    .frame(width: 28)

                DownloadCloudButton(
                    state: downloadState,
                    onDownload: { app.downloadTrack(track, folderId: folder.id) },
                    onCancel: { app.cancelDownload(for: track.url) },
                    onRemoveOffline: {
                        offlineRemovalTitle = track.title
                        offlineRemovalURL = track.url
                    }
                )
                .frame(width: 36)
            }
        }

        if isEditing {
            rowContent
        } else {
            rowContent
                .contextMenu {
                    contextMenuItems(for: track)
                }
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
            if app.isOfflineAvailable(track.url) {
                app.removeOfflineDownload(for: track.url)
            }
            tracks.removeAll { $0.url == track.url }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await app.api.fetchFolderTracks(folderId: folder.id)
            tracks = response.tracks
            app.downloads.syncFromTracks(tracks)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func playAll(from index: Int) async {
        await app.playTracks(tracks, startIndex: index, folder: folder)
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

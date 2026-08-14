import Combine
import Foundation
import SwiftUI

@MainActor
final class VideoAppModel: ObservableObject {
    @Published var isPlayerPresented = false
    @Published var libraryError: String?
    @Published private(set) var videosByFolder: [UUID: [VideoItem]] = [:]
    @Published private(set) var isScanning = false
    /// Bumps when folder list changes so views observing VideoAppModel always refresh.
    @Published private(set) var foldersVersion: Int = 0

    let sources = VideoSourcesStore()
    let engine = VideoPlaybackEngine()
    let pipController = VideoPiPController()

    /// Called by host app to pause music when video starts.
    var onWillStartPlayback: (() -> Void)?
    var onDidStopPlayback: (() -> Void)?
    /// iPad: music fullScreenCover must dismiss before video UI can mount.
    var deferPlayerPresentation = false

    private var cancellables = Set<AnyCancellable>()
    private var presentTask: Task<Void, Never>?

    init() {
        sources.objectWillChange
            .sink { [weak self] _ in
                self?.objectWillChange.send()
                self?.foldersVersion += 1
            }
            .store(in: &cancellables)
        Publishers.MergeMany(
            engine.$queue.map { _ in () }.eraseToAnyPublisher(),
            engine.$currentIndex.map { _ in () }.eraseToAnyPublisher(),
            engine.$isPlaying.map { _ in () }.eraseToAnyPublisher(),
            engine.$hasEnded.map { _ in () }.eraseToAnyPublisher(),
            engine.$errorMessage.map { _ in () }.eraseToAnyPublisher()
        )
        // Intentionally skip currentTime — VideoMiniPlayer / VideoPlayerView observe engine directly.
        .receive(on: RunLoop.main)
        .sink { [weak self] _ in self?.objectWillChange.send() }
        .store(in: &cancellables)
        pipController.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        pipController.onStarted = { [weak self] in
            self?.minimizePlayer()
        }
        pipController.onRestore = { [weak self] in
            self?.expandPlayer()
        }
        // Nie chowaj playera gdy PiP się nie uruchomi — użytkownik zostaje na pełnym ekranie z komunikatem.
        pipController.onFallbackMinimize = nil
    }

    var folders: [ConnectedVideoFolder] { sources.folders }

    func refreshFolder(_ folder: ConnectedVideoFolder) async {
        isScanning = true
        defer { isScanning = false }
        do {
            let items = try sources.listVideos(for: folder)
            videosByFolder[folder.id] = items
            libraryError = nil
        } catch {
            videosByFolder[folder.id] = []
            if folder.kind == .folderBookmark, isVideoFileName(folder.name) {
                libraryError = "Ten wpis pochodzi ze starego dodawania pliku i stracił dostęp. Usuń go (przytrzymaj) i dodaj film ponownie — zostanie skopiowany do aplikacji."
            } else {
                libraryError = error.localizedDescription
            }
        }
    }

    func play(folder: ConnectedVideoFolder, startIndex: Int) {
        let items = videosByFolder[folder.id] ?? (try? sources.listVideos(for: folder)) ?? []
        guard !items.isEmpty else {
            libraryError = "Brak plików wideo w folderze."
            return
        }
        videosByFolder[folder.id] = items
        beginPlayback(
            session: VideoPlaybackSession(
                items: items,
                startIndex: startIndex,
                folderName: folder.name
            )
        )
    }

    func playItem(_ item: VideoItem, in folder: ConnectedVideoFolder) {
        let items = videosByFolder[folder.id] ?? (try? sources.listVideos(for: folder)) ?? []
        videosByFolder[folder.id] = items
        let index = items.firstIndex(where: { $0.id == item.id }) ?? 0
        play(folder: folder, startIndex: index)
    }

    /// Stream / odtwórz pojedynczy plik (lokalny lub HTTP z EOS™LIBRARY).
    func playStandalone(url: URL, title: String, folderName: String = EOSLibraryBrand.displayName) {
        let item = VideoItem(
            id: url.absoluteString,
            title: title,
            relativePath: title,
            fileURL: url,
            fileSize: nil,
            folderId: UUID()
        )
        beginPlayback(
            session: VideoPlaybackSession(items: [item], startIndex: 0, folderName: folderName)
        )
    }

    /// Fire-and-forget entry used by local library and external-open flows.
    func beginPlayback(session: VideoPlaybackSession) {
        presentTask?.cancel()
        presentTask = Task { @MainActor [weak self] in
            guard let self else { return }
            await self.presentAndStart(session: session)
        }
    }

    /// Awaitable launch used by online movies. Success means that the player is visible,
    /// VLC owns a real drawable and the media start request has been accepted.
    func beginPlaybackAndWait(session: VideoPlaybackSession) async -> Bool {
        presentTask?.cancel()
        presentTask = nil
        await presentAndStart(session: session)
        guard !Task.isCancelled else { return false }
        return await engine.waitForPresentedPlayback()
    }

    private func presentAndStart(session: VideoPlaybackSession) async {
        pipController.clearAirPlayNotice()
        pipController.clearError()
        onWillStartPlayback?()
        let waitForMusicDismiss = deferPlayerPresentation
        deferPlayerPresentation = false
        OrientationLock.shared.unlockAll()

        if waitForMusicDismiss {
            // Let the music sheet/cover finish dismissal before mounting the video surface.
            try? await Task.sleep(nanoseconds: 450_000_000)
        }
        guard !Task.isCancelled else { return }
        isPlayerPresented = true
        // Yield one render pass. VideoPlaybackEngine will additionally wait for non-zero bounds.
        await Task.yield()
        guard !Task.isCancelled else { return }
        engine.play(session: session, sources: sources)
    }

    /// Gdy UI zniknie bez minimizePlayer() — zachowaj obraz na ukrytym drawable.
    func syncMinimizedStateAfterDismiss() {
        guard !isPlayerPresented, engine.currentItem != nil else { return }
        engine.parkDrawable()
    }

    func minimizePlayer() {
        engine.parkDrawable()
        isPlayerPresented = false
        OrientationLock.shared.lockPortrait()
    }

    func expandPlayer() {
        guard engine.currentItem != nil else { return }
        OrientationLock.shared.unlockAll()
        engine.prepareExpandRestore()
        isPlayerPresented = true
    }

    func stopAndClosePlayer() {
        presentTask?.cancel()
        presentTask = nil
        pipController.stopAndDiscard(engine: engine)
        engine.stop()
        onDidStopPlayback?()
        isPlayerPresented = false
        OrientationLock.shared.lockPortrait()
        AudioSession.deactivateLeavingForOtherApp()
        AudioSession.activateForPlayback()
    }

    /// Compatibility for older call sites that explicitly meant stop.
    func dismissPlayer() {
        stopAndClosePlayer()
    }

    func connectFolder(name: String, url: URL) throws {
        try sources.connectFolder(name: name, folderURL: url)
        foldersVersion += 1
        objectWillChange.send()
        if let folder = sources.folders.first(where: { $0.name == name })
            ?? sources.folders.last {
            Task { await refreshFolder(folder) }
        }
    }

    func openExternalVideo(at url: URL) async {
        do {
            let displayName = url.deletingPathExtension().lastPathComponent
            try connectFolder(name: displayName.isEmpty ? url.lastPathComponent : displayName, url: url)
            guard let folder = sources.folders.last else {
                libraryError = "Nie udało się dodać pliku wideo."
                return
            }
            await refreshFolder(folder)
            play(folder: folder, startIndex: 0)
            libraryError = nil
        } catch {
            libraryError = error.localizedDescription
        }
    }

    func disconnect(_ folder: ConnectedVideoFolder) {
        sources.disconnect(folder)
        videosByFolder.removeValue(forKey: folder.id)
        foldersVersion += 1
        objectWillChange.send()
    }
}

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

    private var cancellables = Set<AnyCancellable>()

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
        pipController.onFallbackMinimize = { [weak self] in
            self?.minimizePlayer()
        }
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
        onWillStartPlayback?()
        OrientationLock.shared.unlockAll()
        engine.play(
            session: VideoPlaybackSession(
                items: items,
                startIndex: startIndex,
                folderName: folder.name
            ),
            sources: sources
        )
        isPlayerPresented = true
    }

    func playItem(_ item: VideoItem, in folder: ConnectedVideoFolder) {
        let items = videosByFolder[folder.id] ?? (try? sources.listVideos(for: folder)) ?? []
        videosByFolder[folder.id] = items
        let index = items.firstIndex(where: { $0.id == item.id }) ?? 0
        play(folder: folder, startIndex: index)
    }

    /// Stream / odtwórz pojedynczy plik (lokalny lub HTTP z CDA-HD).
    func playStandalone(url: URL, title: String, folderName: String = "CDA-HD") {
        onWillStartPlayback?()
        OrientationLock.shared.unlockAll()
        let item = VideoItem(
            id: url.absoluteString,
            title: title,
            relativePath: title,
            fileURL: url,
            fileSize: nil,
            folderId: UUID()
        )
        engine.play(
            session: VideoPlaybackSession(items: [item], startIndex: 0, folderName: folderName),
            sources: sources
        )
        isPlayerPresented = true
    }

    func minimizePlayer() {
        engine.parkDrawable()
        isPlayerPresented = false
        OrientationLock.shared.lockPortrait()
    }

    func expandPlayer() {
        guard engine.currentItem != nil else { return }
        OrientationLock.shared.unlockAll()
        isPlayerPresented = true
    }

    func stopAndClosePlayer() {
        pipController.stopAndDiscard()
        engine.stop()
        isPlayerPresented = false
        OrientationLock.shared.lockPortrait()
        // VLC may have rewritten AVAudioSession — reclaim music-ready category.
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
        onWillStartPlayback?()
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

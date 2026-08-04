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
        engine.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
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
        OrientationLock.shared.preferLandscape()
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

    func dismissPlayer() {
        engine.stop()
        isPlayerPresented = false
        OrientationLock.shared.lockPortrait()
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

    func disconnect(_ folder: ConnectedVideoFolder) {
        sources.disconnect(folder)
        videosByFolder.removeValue(forKey: folder.id)
        foldersVersion += 1
        objectWillChange.send()
    }
}

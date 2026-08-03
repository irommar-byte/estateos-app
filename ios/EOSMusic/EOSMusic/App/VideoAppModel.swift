import Foundation
import SwiftUI

@MainActor
final class VideoAppModel: ObservableObject {
    @Published var isPlayerPresented = false
    @Published var libraryError: String?
    @Published private(set) var videosByFolder: [UUID: [VideoItem]] = [:]
    @Published private(set) var isScanning = false

    let sources = VideoSourcesStore()
    let engine = VideoPlaybackEngine()

    /// Called by host app to pause music when video starts.
    var onWillStartPlayback: (() -> Void)?

    func refreshFolder(_ folder: ConnectedVideoFolder) async {
        isScanning = true
        defer { isScanning = false }
        do {
            let items = try sources.listVideos(for: folder)
            videosByFolder[folder.id] = items
            libraryError = nil
        } catch {
            libraryError = error.localizedDescription
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
    }

    func disconnect(_ folder: ConnectedVideoFolder) {
        sources.disconnect(folder)
        videosByFolder.removeValue(forKey: folder.id)
    }
}

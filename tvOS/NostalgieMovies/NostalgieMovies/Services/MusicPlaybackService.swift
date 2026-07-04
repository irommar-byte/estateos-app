import SwiftUI
import UIKit

@MainActor
final class MusicPlaybackService: ObservableObject {
    @Published private(set) var controller: MusicPlayerController?
    @Published var isPlayerPresented = false
    @Published private(set) var hasActiveSession = false

    private var becameActiveObserver: NSObjectProtocol?

    func attachIfNeeded() {
        guard becameActiveObserver == nil else { return }
        becameActiveObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.handleAppBecameActive()
            }
        }
    }

    private func handleAppBecameActive() {
        guard hasActiveSession, controller != nil, !isPlayerPresented else { return }
        isPlayerPresented = true
    }

    func play(session: MusicPlaybackSession, app: AppModel) async {
        attachIfNeeded()
        controller?.stop()
        let newController = MusicPlayerController(session: session)
        newController.configure(app: app) { [weak self] in
            self?.presentPlayerIfActive()
        }
        controller = newController
        hasActiveSession = true
        isPlayerPresented = true

        if !session.queue.isEmpty {
            let idx = min(max(session.startIndex, 0), session.queue.count - 1)
            newController.prepareImmediatePreview(track: session.queue[idx])
        }

        await newController.start()
    }

    func minimizePlayer() {
        isPlayerPresented = false
    }

    func presentPlayerIfActive() {
        guard hasActiveSession, controller != nil else { return }
        isPlayerPresented = true
    }

    func stopPlayback() {
        controller?.stop()
        controller = nil
        hasActiveSession = false
        isPlayerPresented = false
    }

    var isPlaying: Bool {
        controller?.isPlaying ?? false
    }

    var currentTrackTitle: String? {
        controller?.currentTrack?.title
    }

    var currentTrackArtist: String? {
        controller?.currentTrack?.artist
    }
}

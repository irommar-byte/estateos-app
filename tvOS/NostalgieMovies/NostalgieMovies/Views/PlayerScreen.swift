import SwiftUI
import AVKit
import AVFoundation
import UIKit

struct PlayerScreen: View {
    let session: PlaybackSession
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VideoPlayerView(
            session: session,
            api: app.api,
            onBack: { dismiss() }
        )
        .ignoresSafeArea()
        .background(Color.black.ignoresSafeArea())
        .onExitCommand { dismiss() }
    }
}

struct VideoPlayerView: UIViewControllerRepresentable {
    let session: PlaybackSession
    let api: MoviesAPIClient
    let onBack: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(session: session, api: api, onBack: onBack)
    }

    func makeUIViewController(context: Context) -> PlayerViewController {
        PlayerAudioSession.activate()
        let controller = PlayerViewController()
        controller.onBack = onBack
        controller.coordinator = context.coordinator
        context.coordinator.attach(to: controller)
        return controller
    }

    func updateUIViewController(_ uiViewController: PlayerViewController, context: Context) {
        uiViewController.onBack = onBack
        uiViewController.coordinator = context.coordinator
    }

    final class Coordinator: NSObject {
        let session: PlaybackSession
        let api: MoviesAPIClient
        let onBack: () -> Void
        private weak var controller: PlayerViewController?
        private var upgradeTask: Task<Void, Never>?

        init(session: PlaybackSession, api: MoviesAPIClient, onBack: @escaping () -> Void) {
            self.session = session
            self.api = api
            self.onBack = onBack
        }

        func attach(to controller: PlayerViewController) {
            self.controller = controller
            let player = AVPlayer(url: session.streamURL)
            if #available(tvOS 15.0, *) {
                player.audiovisualBackgroundPlaybackPolicy = .continuesIfPossible
            }
            controller.player = player
            player.play()
            startFullUpgradePolling()
        }

        private func startFullUpgradePolling() {
            upgradeTask?.cancel()
            upgradeTask = Task { [weak self] in
                guard let self else { return }
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 4_000_000_000)
                    guard !Task.isCancelled else { return }
                    do {
                        let job = try await api.fetchJobStatus(jobId: session.jobId)
                        if job.fullReady == true {
                            await upgradeToFullStream()
                            return
                        }
                    } catch {
                        return
                    }
                }
            }
        }

        @MainActor
        private func upgradeToFullStream() {
            guard let controller, let player = controller.player else { return }
            let current = player.currentTime()
            let wasPlaying = player.rate > 0
            let upgraded = api.streamURL(jobId: session.jobId, token: session.token)
            let item = AVPlayerItem(url: upgraded)
            player.replaceCurrentItem(with: item)
            player.seek(to: current, toleranceBefore: .zero, toleranceAfter: .zero) { finished in
                guard finished, wasPlaying else { return }
                player.play()
            }
        }

        deinit {
            upgradeTask?.cancel()
        }
    }
}

enum PlayerAudioSession {
    static func activate() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .moviePlayback)
        try? session.setActive(true)
    }
}

final class PlayerViewController: AVPlayerViewController, AVPlayerViewControllerDelegate {
    var onBack: (() -> Void)?
    weak var coordinator: VideoPlayerView.Coordinator?
    private var isInPictureInPicture = false

    override func viewDidLoad() {
        super.viewDidLoad()
        delegate = self
        showsPlaybackControls = true
        allowsPictureInPicturePlayback = true
        #if os(iOS)
        if #available(iOS 14.0, *) {
            canStartPictureInPictureAutomaticallyFromInline = true
        }
        #endif
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if presses.contains(where: { $0.type == .menu }), !isInPictureInPicture {
            onBack?()
            return
        }
        super.pressesEnded(presses, with: event)
    }

    func playerViewControllerWillStartPictureInPicture(_ playerViewController: AVPlayerViewController) {
        isInPictureInPicture = true
    }

    func playerViewControllerDidStopPictureInPicture(_ playerViewController: AVPlayerViewController) {
        isInPictureInPicture = false
    }

    func playerViewController(
        _ playerViewController: AVPlayerViewController,
        restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void
    ) {
        isInPictureInPicture = false
        completionHandler(true)
    }
}

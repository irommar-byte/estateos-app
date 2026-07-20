import SwiftUI
import AVKit
import AVFoundation
import UIKit

struct PlayerScreen: View {
    @State var context: MediaPlaybackContext
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var showQualityPicker = false
    @State private var isSwitchingQuality = false
    @State private var qualityError: String?

    var body: some View {
        ZStack {
            VideoPlayerView(
                session: context.session,
                api: app.api,
                qualityControl: context.streamOptions.count > 1 ? PlayerQualityControl(
                    label: currentQualityLabel,
                    isEnabled: !isSwitchingQuality,
                    onTap: { showQualityPicker = true }
                ) : nil,
                onSessionChange: { context.session = $0 },
                onBack: { dismiss() }
            )
            .ignoresSafeArea()
        }
        .background(Color.black.ignoresSafeArea())
        .onExitCommand { dismiss() }
        .sheet(isPresented: $showQualityPicker) {
            MediaStreamQualitySheet(
                options: context.streamOptions,
                selectedID: context.selectedQualityID,
                isBusy: isSwitchingQuality
            ) { option in
                Task { await switchQuality(to: option) }
            }
        }
        .overlay(alignment: .bottom) {
            if let qualityError {
                Text(qualityError)
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.orange)
                    .padding()
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.bottom, 40)
            }
        }
    }

    private var currentQualityLabel: String {
        context.streamOptions.first(where: { $0.id == context.selectedQualityID })?.label ?? "Jakość"
    }

    @MainActor
    private func switchQuality(to option: MediaQualityOption) async {
        guard option.id != context.selectedQualityID else {
            showQualityPicker = false
            return
        }
        isSwitchingQuality = true
        qualityError = nil
        defer { isSwitchingQuality = false }

        do {
            let height = MediaQualityOption.apiHeight(for: option, options: context.streamOptions)
            let preview = try await app.api.startPreview(url: context.sourceURL, height: height)
            if preview.instant == false {
                try await app.api.waitForPreviewReady(jobId: preview.jobId)
            }
            let token = try await app.api.playToken(jobId: preview.jobId)
            let streamURL = app.api.streamURL(jobId: token.jobId, token: token.token)
            context.selectedQualityID = option.id
            context.session = PlaybackSession(jobId: token.jobId, streamURL: streamURL, token: token.token)
            showQualityPicker = false
        } catch {
            qualityError = error.localizedDescription
        }
    }
}

struct PlayerQualityControl: Equatable {
    let label: String
    let isEnabled: Bool
    let onTap: () -> Void

    static func == (lhs: PlayerQualityControl, rhs: PlayerQualityControl) -> Bool {
        lhs.label == rhs.label && lhs.isEnabled == rhs.isEnabled
    }
}

struct VideoPlayerView: UIViewControllerRepresentable {
    let session: PlaybackSession
    let api: MoviesAPIClient
    var qualityControl: PlayerQualityControl?
    let onSessionChange: (PlaybackSession) -> Void
    let onBack: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(api: api, onSessionChange: onSessionChange, onBack: onBack)
    }

    func makeUIViewController(context: Context) -> PlayerViewController {
        PlayerAudioSession.activate()
        let controller = PlayerViewController()
        controller.onBack = onBack
        controller.coordinator = context.coordinator
        context.coordinator.attach(to: controller, session: session)
        controller.updateQualityControl(qualityControl)
        return controller
    }

    func updateUIViewController(_ uiViewController: PlayerViewController, context: Context) {
        uiViewController.onBack = onBack
        uiViewController.coordinator = context.coordinator
        context.coordinator.replaceSessionIfNeeded(session, on: uiViewController)
        uiViewController.updateQualityControl(qualityControl)
    }

    final class Coordinator: NSObject {
        let api: MoviesAPIClient
        let onSessionChange: (PlaybackSession) -> Void
        let onBack: () -> Void
        private weak var controller: PlayerViewController?
        private var upgradeTask: Task<Void, Never>?
        private var activeJobId: String?

        init(api: MoviesAPIClient, onSessionChange: @escaping (PlaybackSession) -> Void, onBack: @escaping () -> Void) {
            self.api = api
            self.onSessionChange = onSessionChange
            self.onBack = onBack
        }

        func attach(to controller: PlayerViewController, session: PlaybackSession) {
            self.controller = controller
            activeJobId = session.jobId
            let player = AVPlayer(url: session.streamURL)
            if #available(tvOS 15.0, *) {
                player.audiovisualBackgroundPlaybackPolicy = .continuesIfPossible
            }
            controller.player = player
            player.play()
            startFullUpgradePolling(jobId: session.jobId, token: session.token)
        }

        func replaceSessionIfNeeded(_ session: PlaybackSession, on controller: PlayerViewController) {
            guard session.jobId != activeJobId else { return }
            guard let player = controller.player else { return }
            let current = player.currentTime()
            let wasPlaying = player.rate > 0
            activeJobId = session.jobId
            upgradeTask?.cancel()
            let item = AVPlayerItem(url: session.streamURL)
            player.replaceCurrentItem(with: item)
            player.seek(to: current, toleranceBefore: .zero, toleranceAfter: .zero) { finished in
                guard finished, wasPlaying else { return }
                player.play()
            }
            startFullUpgradePolling(jobId: session.jobId, token: session.token)
        }

        private func startFullUpgradePolling(jobId: String, token: String) {
            upgradeTask?.cancel()
            upgradeTask = Task { [weak self] in
                guard let self else { return }
                var sawPending = false
                var failures = 0
                // CDA: partial start → czekamy na pełny plik (do ~12 min).
                let deadline = Date().addingTimeInterval(12 * 60)
                while !Task.isCancelled, Date() < deadline {
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    guard !Task.isCancelled else { return }
                    do {
                        let job = try await api.fetchJobStatus(jobId: jobId)
                        failures = 0
                        if job.cdaFullPending == true {
                            sawPending = true
                        }
                        // Pełny film: albo explicit fullReady po pending, albo ready bez pending.
                        let isTrulyFull =
                            job.fullReady == true
                            && job.cdaFullPending != true
                        if isTrulyFull {
                            // Jeśli nigdy nie było partial — nie trzeba przeładowywać.
                            if sawPending || job.progress == 100 {
                                await upgradeToFullStream(jobId: jobId, token: token)
                            }
                            return
                        }
                    } catch {
                        failures += 1
                        if failures > 8 { return }
                    }
                }
            }
        }

        @MainActor
        private func upgradeToFullStream(jobId: String, token: String) {
            guard let controller, let player = controller.player else { return }
            let current = player.currentTime()
            let wasPlaying = player.rate > 0
            // Cache-bust: nowy parametr t wymusza świeży Content-Length pełnego pliku.
            let upgraded = api.streamURL(jobId: jobId, token: token)
            let item = AVPlayerItem(url: upgraded)
            player.replaceCurrentItem(with: item)
            player.seek(to: current, toleranceBefore: .zero, toleranceAfter: .zero) { finished in
                guard finished, wasPlaying else { return }
                player.play()
            }
            let updated = PlaybackSession(jobId: jobId, streamURL: upgraded, token: token)
            onSessionChange(updated)
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

    static func activateForMusic() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default)
        try? session.setActive(true)
    }
}

final class PlayerViewController: AVPlayerViewController, AVPlayerViewControllerDelegate {
    var onBack: (() -> Void)?
    weak var coordinator: VideoPlayerView.Coordinator?
    private var isInPictureInPicture = false
    private var qualityButton: UIButton?
    private var qualityControl: PlayerQualityControl?
    private var isTransportBarVisible = false
    private var shouldPreferQualityButton = false
    private let upwardFocusGuide = UIFocusGuide()
    private let qualityRailFocusGuide = UIFocusGuide()

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

    override var preferredFocusEnvironments: [UIFocusEnvironment] {
        if shouldPreferQualityButton,
           let qualityButton,
           qualityButton.isUserInteractionEnabled,
           !qualityButton.isHidden {
            return [qualityButton]
        }
        return super.preferredFocusEnvironments
    }

    override func didUpdateFocus(
        in context: UIFocusUpdateContext,
        with coordinator: UIFocusAnimationCoordinator
    ) {
        super.didUpdateFocus(in: context, with: coordinator)
        if context.nextFocusedView === qualityButton {
            shouldPreferQualityButton = false
        }
    }

    func updateQualityControl(_ control: PlayerQualityControl?) {
        loadViewIfNeeded()
        qualityControl = control
        guard let control else {
            qualityButton?.removeFromSuperview()
            qualityButton = nil
            upwardFocusGuide.isEnabled = false
            qualityRailFocusGuide.isEnabled = false
            return
        }

        let button: UIButton
        if let existing = qualityButton {
            button = existing
        } else {
            button = makeQualityButton()
            qualityButton = button
            if let overlay = contentOverlayView {
                overlay.addSubview(button)
                installUpwardFocusGuide(in: overlay, button: button)
                NSLayoutConstraint.activate([
                    button.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 36),
                    button.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -36),
                ])
            }
            setQualityButtonVisible(isTransportBarVisible, animated: false)
        }

        var config = button.configuration ?? UIButton.Configuration.plain()
        config.title = control.label
        config.image = UIImage(systemName: "slider.horizontal.3")
        config.imagePadding = 8
        config.baseForegroundColor = .white
        config.background.backgroundColor = UIColor.white.withAlphaComponent(0.14)
        config.background.cornerRadius = 22
        config.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 20, bottom: 12, trailing: 20)
        button.configuration = config
        button.isEnabled = control.isEnabled
        button.removeTarget(nil, action: nil, for: .allEvents)
        button.addAction(UIAction { [weak self] _ in
            self?.qualityControl?.onTap()
        }, for: .primaryActionTriggered)
        upwardFocusGuide.preferredFocusEnvironments = [button]
        qualityRailFocusGuide.preferredFocusEnvironments = [button]
        updateUpwardFocusGuide()
    }

    private func installUpwardFocusGuide(in overlay: UIView, button: UIButton) {
        guard upwardFocusGuide.owningView == nil else { return }
        overlay.addLayoutGuide(upwardFocusGuide)
        overlay.addLayoutGuide(qualityRailFocusGuide)
        NSLayoutConstraint.activate([
            upwardFocusGuide.leadingAnchor.constraint(equalTo: overlay.leadingAnchor),
            upwardFocusGuide.trailingAnchor.constraint(equalTo: overlay.trailingAnchor),
            upwardFocusGuide.bottomAnchor.constraint(equalTo: overlay.bottomAnchor, constant: -24),
            upwardFocusGuide.heightAnchor.constraint(equalToConstant: 200),

            qualityRailFocusGuide.widthAnchor.constraint(equalToConstant: 420),
            qualityRailFocusGuide.trailingAnchor.constraint(equalTo: overlay.trailingAnchor),
            qualityRailFocusGuide.topAnchor.constraint(equalTo: button.topAnchor),
            qualityRailFocusGuide.bottomAnchor.constraint(equalTo: overlay.bottomAnchor, constant: -80),
        ])
        upwardFocusGuide.preferredFocusEnvironments = [button]
        qualityRailFocusGuide.preferredFocusEnvironments = [button]
    }

    private func updateUpwardFocusGuide() {
        let enabled =
            isTransportBarVisible &&
            qualityButton?.isUserInteractionEnabled == true
        upwardFocusGuide.isEnabled = enabled
        qualityRailFocusGuide.isEnabled = enabled
    }

    private func focusQualityButton() {
        guard qualityButton?.isUserInteractionEnabled == true else { return }
        shouldPreferQualityButton = true
        setNeedsFocusUpdate()
        updateFocusIfNeeded()
    }

    private func makeQualityButton() -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.alpha = 0
        button.isUserInteractionEnabled = false
        button.setContentHuggingPriority(.required, for: .horizontal)
        return button
    }

    private func setQualityButtonVisible(_ visible: Bool, animated: Bool) {
        guard qualityButton != nil else { return }
        let changes = {
            self.qualityButton?.alpha = visible ? 1 : 0
            self.qualityButton?.isUserInteractionEnabled = visible && (self.qualityControl?.isEnabled ?? false)
            self.updateUpwardFocusGuide()
        }
        if animated {
            UIView.animate(withDuration: 0.25, animations: changes)
        } else {
            changes()
        }
    }

    func playerViewController(
        _ playerViewController: AVPlayerViewController,
        willTransitionToVisibilityOfTransportBar visible: Bool,
        with coordinator: AVPlayerViewControllerAnimationCoordinator
    ) {
        isTransportBarVisible = visible
        coordinator.addCoordinatedAnimations({
            self.setQualityButtonVisible(visible, animated: false)
        }, completion: nil)
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if presses.contains(where: { $0.type == .menu }), !isInPictureInPicture {
            onBack?()
            return
        }
        if presses.contains(where: { $0.type == .upArrow }),
           isTransportBarVisible,
           qualityButton != nil {
            focusQualityButton()
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

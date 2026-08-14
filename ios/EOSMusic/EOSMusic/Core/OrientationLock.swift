import Foundation
import UIKit

@MainActor
final class OrientationLock {
    static let shared = OrientationLock()

    private(set) var mask: UIInterfaceOrientationMask = .portrait
    private var generatingOrientation = false

    func lockPortrait() {
        mask = .portrait
        stopGenerating()
        request(orientations: .portrait)
    }

    func unlockAll() {
        followDeviceForVideo()
    }

    /// While a film is on screen, follow the physical device so landscape becomes true fullscreen.
    func followDeviceForVideo() {
        mask = .allButUpsideDown
        startGenerating()
        let requested: UIInterfaceOrientationMask
        switch UIDevice.current.orientation {
        case .landscapeLeft:
            requested = .landscapeRight
        case .landscapeRight:
            requested = .landscapeLeft
        case .portrait:
            requested = .portrait
        default:
            requested = .allButUpsideDown
        }
        request(orientations: requested)
    }

    func preferLandscape() {
        mask = .allButUpsideDown
        startGenerating()
        request(orientations: .landscape)
    }

    private func startGenerating() {
        guard !generatingOrientation else { return }
        generatingOrientation = true
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
    }

    private func stopGenerating() {
        guard generatingOrientation else { return }
        generatingOrientation = false
        UIDevice.current.endGeneratingDeviceOrientationNotifications()
    }

    private func request(orientations: UIInterfaceOrientationMask) {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first else { return }
        let prefs = UIWindowScene.GeometryPreferences.iOS(interfaceOrientations: orientations)
        scene.requestGeometryUpdate(prefs) { _ in }
        UIViewController.attemptRotationToDeviceOrientation()
    }
}

final class AppOrientationDelegate: NSObject, UIApplicationDelegate {
    weak var appModel: AppModel?
    weak var videoModel: VideoAppModel?
    /// Open In przy zimnym starcie potrafi dojść zanim View ustawi modele.
    private var pendingMediaURL: URL?

    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        OrientationLock.shared.mask
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        if url.scheme == "pl.nostalgie.eosmusic" {
            GoogleDriveAuthService.shared.handleOpenURL(url)
            return true
        }
        guard let appModel, let videoModel else {
            pendingMediaURL = url
            return true
        }
        return IncomingMediaRouter.handle(url, app: appModel, video: videoModel)
    }

    @MainActor
    func flushPendingMediaIfNeeded() {
        guard let url = pendingMediaURL, let appModel, let videoModel else { return }
        pendingMediaURL = nil
        _ = IncomingMediaRouter.handle(url, app: appModel, video: videoModel)
    }
}

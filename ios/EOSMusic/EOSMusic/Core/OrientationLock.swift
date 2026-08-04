import Foundation
import UIKit

@MainActor
final class OrientationLock {
    static let shared = OrientationLock()

    private(set) var mask: UIInterfaceOrientationMask = .portrait

    func lockPortrait() {
        mask = .portrait
        apply(orientation: .portrait)
    }

    func unlockAll() {
        mask = .allButUpsideDown
        // Do not force a specific orientation — follow the device (portrait for vertical videos).
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first else { return }
        let prefs = UIWindowScene.GeometryPreferences.iOS(interfaceOrientations: .allButUpsideDown)
        scene.requestGeometryUpdate(prefs) { _ in }
    }

    func preferLandscape() {
        mask = .landscape
        apply(orientation: .landscapeRight)
    }

    private func apply(orientation: UIInterfaceOrientation) {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first else { return }
        let prefs = UIWindowScene.GeometryPreferences.iOS(interfaceOrientations: orientation == .portrait ? .portrait : .landscape)
        scene.requestGeometryUpdate(prefs) { _ in }
        UIViewController.attemptRotationToDeviceOrientation()
    }
}

final class AppOrientationDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        OrientationLock.shared.mask
    }
}

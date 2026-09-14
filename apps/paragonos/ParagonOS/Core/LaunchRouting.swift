import Foundation
import UIKit

enum PendingLaunch {
    static let scanKey = "paragonos.pendingScanIntent"

    private static var suite: UserDefaults {
        UserDefaults(suiteName: AppGroup.id) ?? .standard
    }

    static func saveScan(_ intent: ScanIntent) {
        suite.set(intent.rawValue, forKey: scanKey)
        WalletScanBridge.pendingIntent = intent
        OpenScanBridge.pending = true
    }

    static func takeScan() -> ScanIntent? {
        if let intent = WalletScanBridge.pendingIntent {
            WalletScanBridge.pendingIntent = nil
            OpenScanBridge.pending = false
            suite.removeObject(forKey: scanKey)
            return intent
        }
        guard let raw = suite.string(forKey: scanKey),
              let intent = ScanIntent(rawValue: raw) else { return nil }
        suite.removeObject(forKey: scanKey)
        OpenScanBridge.pending = false
        return intent
    }

    static func clearScan() {
        suite.removeObject(forKey: scanKey)
        WalletScanBridge.pendingIntent = nil
        OpenScanBridge.pending = false
    }
}

final class ParagonSceneDelegate: NSObject, UIWindowSceneDelegate {
    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        if let shortcut = connectionOptions.shortcutItem {
            capture(shortcut)
        }
    }

    func windowScene(
        _ windowScene: UIWindowScene,
        performActionFor shortcutItem: UIApplicationShortcutItem,
        completionHandler: @escaping (Bool) -> Void
    ) {
        capture(shortcutItem)
        NotificationCenter.default.post(name: .paragonShortcut, object: shortcutItem)
        completionHandler(true)
    }

    private func capture(_ shortcut: UIApplicationShortcutItem) {
        HomeQuickActions.captureIncoming(shortcut)
    }
}

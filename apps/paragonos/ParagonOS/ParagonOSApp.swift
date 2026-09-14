import SwiftData
import SwiftUI

@main
struct ParagonOSApp: App {
    @UIApplicationDelegateAdaptor(ParagonAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var wallet = WalletModel()
    @StateObject private var lock = BiometricLock()
    @State private var showSplash = true
    @State private var splashStyle = LaunchSplashPolicy.style
    private let container: ModelContainer = Persistence.makeContainer()

    var body: some Scene {
        WindowGroup {
            ZStack {
                RootTabView()
                    .environmentObject(wallet)
                    .environmentObject(lock)
                    .tint(ParagonTheme.osGreen)
                    .onOpenURL { url in
                        handle(url: url)
                    }
                if lock.isLocked && showSplash == false {
                    LockCoverView(lock: lock) {
                        Task { _ = await lock.authenticate(enabled: true) }
                    }
                    .zIndex(2)
                    .transition(.opacity)
                }
                if showSplash {
                    LaunchSplashView(style: splashStyle) {
                        LaunchSplashPolicy.markSeen()
                        showSplash = false
                        if wallet.settings.lockWithBiometrics {
                            lock.lockIfNeeded(enabled: true)
                            Task { _ = await lock.authenticate(enabled: true) }
                        }
                    }
                    .zIndex(3)
                    .transition(.opacity)
                }
            }
            .animation(.easeOut(duration: 0.22), value: lock.isLocked)
            .onChange(of: scenePhase, handleScenePhase)
        }
        .modelContainer(container)
    }

    private func handleScenePhase(_ old: ScenePhase, _ phase: ScenePhase) {
        guard wallet.settings.lockWithBiometrics else { return }
        if phase != .active {
            lock.lockIfNeeded(enabled: true)
        } else if showSplash == false, lock.isLocked {
            Task { _ = await lock.authenticate(enabled: true) }
        }
    }

    private func handle(url: URL) {
        showSplash = false
        guard url.scheme == Brand.urlScheme else { return }
        let host = url.host ?? ""
        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if host == "scan" {
            switch path {
            case "deposit":
                wallet.openScanner(for: .deposit)
            case "receipt":
                wallet.openScanner(for: .receipt)
            case "loyalty":
                wallet.openScanner(for: .loyalty)
            default:
                wallet.askScanIntent = true
            }
            return
        }
        if host == "map" {
            wallet.requestedTab = .wallet
            wallet.walletPath.append(WalletRoute.bottleMap)
            return
        }
        if host == "checkout" {
            if path.hasPrefix("ticket/"), let id = UUID(uuidString: String(path.dropFirst(7))) {
                wallet.requestedTab = .wallet
                wallet.showCheckoutFor = id
            } else if path.hasPrefix("card/"), let id = UUID(uuidString: String(path.dropFirst(5))) {
                wallet.requestedTab = .cards
                wallet.showLoyaltyCheckoutFor = id
            }
            return
        }
        if host == "receipt", let id = UUID(uuidString: url.lastPathComponent) {
            wallet.pendingReceiptID = id
            return
        }
        if host == "card", let id = UUID(uuidString: url.lastPathComponent) {
            wallet.pendingLoyaltyID = id
            return
        }
        if host == "ticket", let id = UUID(uuidString: url.lastPathComponent) {
            wallet.pendingTicketID = id
        }
    }
}

enum Persistence {
    static func makeContainer() -> ModelContainer {
        let schema = Schema([Ticket.self, Receipt.self, LoyaltyCard.self, AppProfile.self])
        let inTests = NSClassFromString("XCTestCase") != nil
            || ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
        if inTests {
            let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true, cloudKitDatabase: .none)
            return try! ModelContainer(for: schema, configurations: [configuration])
        }
        let cloud = ModelConfiguration(
            schema: schema,
            cloudKitDatabase: .private(Brand.iCloudContainer)
        )
        do {
            return try ModelContainer(for: schema, configurations: [cloud])
        } catch {
            let message = error.localizedDescription
            Task { @MainActor in
                CloudSyncMonitor.shared.reportContainerFailureMessage(message)
            }
            let local = ModelConfiguration(schema: schema, cloudKitDatabase: .none)
            do {
                return try ModelContainer(for: schema, configurations: [local])
            } catch {
                let fallbackMessage = error.localizedDescription
                Task { @MainActor in
                    CloudSyncMonitor.shared.reportContainerFailureMessage(fallbackMessage)
                }
                let lastResort = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true, cloudKitDatabase: .none)
                return try! ModelContainer(for: schema, configurations: [lastResort])
            }
        }
    }
}

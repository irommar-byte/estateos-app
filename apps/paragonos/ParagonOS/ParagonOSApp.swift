import SwiftData
import SwiftUI

@main
struct ParagonOSApp: App {
    @UIApplicationDelegateAdaptor(ParagonAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var wallet = WalletModel()
    @StateObject private var lock = BiometricLock()
    @State private var showSplash = true
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
                    LaunchSplashView {
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
        guard url.scheme == Brand.urlScheme else { return }
        if url.host == "scan" {
            wallet.askScanIntent = true
            return
        }
        if url.host == "receipt", let id = UUID(uuidString: url.lastPathComponent) {
            wallet.pendingReceiptID = id
            return
        }
        if url.host == "ticket", let id = UUID(uuidString: url.lastPathComponent) {
            wallet.pendingTicketID = id
        }
    }
}

enum Persistence {
    static func makeContainer() -> ModelContainer {
        let schema = Schema([Ticket.self, Receipt.self, AppProfile.self])
        let inTests = NSClassFromString("XCTestCase") != nil
            || ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
        let useCloud = inTests == false && FileManager.default.ubiquityIdentityToken != nil
        let configuration: ModelConfiguration
        if inTests {
            configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true, cloudKitDatabase: .none)
        } else if useCloud {
            configuration = ModelConfiguration(schema: schema, cloudKitDatabase: .automatic)
        } else {
            configuration = ModelConfiguration(schema: schema, cloudKitDatabase: .none)
        }
        do {
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            let fallback = ModelConfiguration(schema: schema, isStoredInMemoryOnly: inTests, cloudKitDatabase: .none)
            return try! ModelContainer(for: schema, configurations: [fallback])
        }
    }
}

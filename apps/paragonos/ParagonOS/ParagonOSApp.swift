import SwiftData
import SwiftUI
import Foundation
import UIKit

@main
struct ParagonOSApp: App {
    @UIApplicationDelegateAdaptor(ParagonAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var wallet = WalletModel()
    @StateObject private var lock = BiometricLock()
    @State private var showSplash = ParagonUIDemo.isEnabled == false
    @State private var splashStyle = LaunchSplashPolicy.style
    private let container: ModelContainer = Persistence.makeContainer()

    var body: some Scene {
        WindowGroup {
            ZStack {
                RootTabView()
                    .environmentObject(wallet)
                    .environmentObject(lock)
                    .tint(ParagonTheme.osGreen)
                    .environment(\.locale, wallet.settings.language.locale)
                    .onAppear {
                        AppLocale.apply(wallet.settings.language)
                        if ParagonUIDemo.isEnabled {
                            wallet.settings.hasCompletedOnboarding = true
                            wallet.settings.save()
                            wallet.showOnboarding = false
                            wallet.chromeReady = true
                            if ProcessInfo.processInfo.arguments.contains("-paragon-ui-demo-map") {
                                wallet.requestedTab = .wallet
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                                    wallet.walletPath.append(WalletRoute.bottleMap)
                                }
                            } else {
                                wallet.requestedTab = .cards
                            }
                            ParagonUIDemo.seedLoyaltyCards(into: container.mainContext)
                        }
                    }
                    .onChange(of: wallet.settings.language) { _, language in
                        AppLocale.apply(language)
                    }
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
                        wallet.chromeReady = true
                        wallet.consumePendingLaunch()
                        if wallet.settings.lockWithBiometrics {
                            lock.lockIfNeeded(enabled: true)
                            authenticateIfLocked()
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
        if phase == .active, showSplash == false {
            wallet.consumePendingLaunch()
        }
        guard wallet.settings.lockWithBiometrics else { return }
        if phase != .active {
            lock.lockIfNeeded(enabled: true)
        } else {
            authenticateIfLocked()
        }
    }

    private func authenticateIfLocked() {
        guard showSplash == false, lock.isLocked else { return }
        Task { _ = await lock.authenticate(enabled: true) }
    }

    private func handle(url: URL) {
        guard url.scheme == Brand.urlScheme else { return }
        let host = url.host ?? ""
        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if host == "scan" || host == "checkout" {
            showSplash = false
            wallet.chromeReady = true
        }
        if host == "scan" {
            LaunchSplashPolicy.skipNext = true
            switch path {
            case "deposit":
                PendingLaunch.saveScan(.deposit)
                wallet.openScanner(for: .deposit)
            case "receipt":
                PendingLaunch.saveScan(.receipt)
                wallet.openScanner(for: .receipt)
            case "loyalty":
                PendingLaunch.saveScan(.loyalty)
                wallet.openScanner(for: .loyalty)
            default:
                wallet.askScanIntent = true
            }
            return
        }
        if host == "cards" {
            wallet.requestedTab = .cards
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
        let process = ProcessInfo.processInfo
        let inUnitTests = NSClassFromString("XCTestCase") != nil
            || process.environment["XCTestConfigurationFilePath"] != nil
        let inUIHarness = process.arguments.contains("-ui-testing")
            || process.arguments.contains("-paragon-ui-demo")
            || process.environment["PARAGON_UI_DEMO"] == "1"
        if inUnitTests || inUIHarness {
            let configuration = ModelConfiguration(
                schema: schema,
                isStoredInMemoryOnly: true,
                cloudKitDatabase: .none
            )
            return try! ModelContainer(for: schema, configurations: [configuration])
        }
        // iOS 27 SDK Swift overlay + SwiftData CloudKit mirroring abort the process on
        // iOS 26 (unsigned sim and missing `_userIdentity`). Keep mirroring on iOS 27
        // so existing iCloud stores (e.g. 15 Pro Max) still open. Family share is CKRecords.
        let mirroring: Bool = {
            #if targetEnvironment(simulator)
            return false
            #else
            return process.operatingSystemVersion.majorVersion >= 27
            #endif
        }()
        let preferred = ModelConfiguration(
            schema: schema,
            cloudKitDatabase: mirroring ? .private(Brand.iCloudContainer) : .none
        )
        do {
            return try ModelContainer(for: schema, configurations: [preferred])
        } catch {
            Task { @MainActor in
                CloudSyncMonitor.shared.reportContainerFailureMessage(error.localizedDescription)
            }
            let local = ModelConfiguration(schema: schema, cloudKitDatabase: .none)
            do {
                return try ModelContainer(for: schema, configurations: [local])
            } catch {
                Task { @MainActor in
                    CloudSyncMonitor.shared.reportContainerFailureMessage(error.localizedDescription)
                }
                let lastResort = ModelConfiguration(
                    schema: schema,
                    isStoredInMemoryOnly: true,
                    cloudKitDatabase: .none
                )
                return try! ModelContainer(for: schema, configurations: [lastResort])
            }
        }
    }
}

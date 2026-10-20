import SwiftUI
import UIKit

@main
struct GalleryOSApp: App {
    @UIApplicationDelegateAdaptor(GalleryAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var library = PhotoLibrary()
    @StateObject private var tvInbox = AppleTVInbox.shared
    @State private var intro = false
    @State private var guide = false
    /// Stays true until the first time a scene is actually on screen. A sync relaunch
    /// starts the process in the background, so this cannot be decided at init.
    @State private var introPending = true

    var body: some Scene {
        WindowGroup {
            ZStack {
                RootView()
                    .environmentObject(library)
                    .tint(GalleryTheme.accent)
                    .sheet(isPresented: $tvInbox.presenting) {
                        AppleTVPairingSheet()
                    }
                    .fullScreenCover(isPresented: $guide) {
                        SetupGuideView(firstRun: true)
                            .environmentObject(library)
                            .tint(GalleryTheme.accent)
                    }
                if intro {
                    LaunchCinema {
                        withAnimation(.easeIn(duration: 0.35)) {
                            intro = false
                        }
                    }
                    .transition(.opacity)
                    .zIndex(2)
                    .ignoresSafeArea()
                }
            }
            .onOpenURL { url in
                tvInbox.receive(url)
            }
            .task {
                AppleTVSharing.refreshIfEnabled()
            }
            .onChange(of: scenePhase, initial: true) { _, phase in
                guard introPending, phase == .active else { return }
                introPending = false
                intro = true
            }
        }
    }
}

final class GalleryAppDelegate: NSObject, UIApplicationDelegate {
    static var orientationLock: UIInterfaceOrientationMask = .portrait

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        SyncScheduler.register()
        GalleryNetwork.shared.prepareBackgroundUploads()
        SyncLiveActivity.shared.collapseExtras()
        return true
    }

    func application(
        _ application: UIApplication,
        handleEventsForBackgroundURLSession identifier: String,
        completionHandler: @escaping () -> Void
    ) {
        GalleryNetwork.shared.handleBackgroundEvents(completionHandler)
        Task { @MainActor in
            LibraryEngine.shared.resumeFromBackgroundTransfer()
        }
    }

    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        if UIDevice.current.userInterfaceIdiom == .pad { return .all }
        return Self.orientationLock
    }
}

enum GalleryOrientation {
    private static var ticket = 0

    static func allowViewer() -> Int {
        ticket += 1
        guard UIDevice.current.userInterfaceIdiom == .phone else { return ticket }
        GalleryAppDelegate.orientationLock = .allButUpsideDown
        refreshSupported(forcePortrait: false)
        return ticket
    }

    static func lockLibrary(ticket value: Int) {
        guard value == ticket else { return }
        guard UIDevice.current.userInterfaceIdiom == .phone else { return }
        GalleryAppDelegate.orientationLock = .portrait
        refreshSupported(forcePortrait: true)
    }

    private static func refreshSupported(forcePortrait: Bool) {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        for scene in scenes {
            let root = scene.keyWindow?.rootViewController
            var controller = root
            controller?.setNeedsUpdateOfSupportedInterfaceOrientations()
            while let presented = controller?.presentedViewController {
                controller = presented
                controller?.setNeedsUpdateOfSupportedInterfaceOrientations()
            }
            guard forcePortrait, root?.presentedViewController == nil else { continue }
            scene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { _ in }
        }
    }
}

import SwiftUI
import UIKit
import Combine

@main
struct EOSMusicApp: App {
    @UIApplicationDelegateAdaptor(AppOrientationDelegate.self) private var orientationDelegate
    @StateObject private var app = AppModel()
    @StateObject private var ui = UIPreferences()
    @StateObject private var video = VideoAppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .environmentObject(ui)
                .environmentObject(video)
                .preferredColorScheme(ui.appearance.preferredColorScheme)
                .task {
                    orientationDelegate.appModel = app
                    orientationDelegate.videoModel = video
                    video.onWillStartPlayback = {
                        app.playback.stop()
                        app.isFullPlayerPresented = false
                        AudioSession.activateForPlayback()
                    }
                    // Single ownership of AppModel.offlineModeEnabled ← UIPreferences.
                    app.configureOfflineMode(from: ui)
                    await app.bootstrap()
                }
                .onChange(of: ui.offlineModeEnabled) { _, value in
                    app.offlineModeEnabled = value
                }
                .onOpenURL { url in
                    if url.scheme == "pl.nostalgie.eosmusic" {
                        GoogleDriveAuthService.shared.handleOpenURL(url)
                        return
                    }
                    _ = IncomingMediaRouter.handle(url, app: app, video: video)
                }
                .onAppear {
                    AppDocuments.ensureStructure()
                    UIApplication.shared.beginReceivingRemoteControlEvents()
                    AudioSession.activateForPlayback()
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                    AudioSession.reinforceIfNeeded()
                }
        }
    }
}

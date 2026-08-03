import SwiftUI
import UIKit

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
                .id(ui.appearance.rawValue)
                .task {
                    video.onWillStartPlayback = {
                        app.playback.stop()
                        app.isFullPlayerPresented = false
                        AudioSession.activateForPlayback()
                    }
                    await app.bootstrap()
                }
                .onOpenURL { url in
                    GoogleDriveAuthService.shared.handleOpenURL(url)
                }
                .onAppear {
                    AppDocuments.ensureStructure()
                    UIApplication.shared.beginReceivingRemoteControlEvents()
                }
        }
    }
}

import SwiftUI
import UIKit

@main
struct EOSMusicApp: App {
    @StateObject private var app = AppModel()
    @StateObject private var ui = UIPreferences()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .environmentObject(ui)
                .preferredColorScheme(ui.appearance.preferredColorScheme)
                .id(ui.appearance.rawValue)
                .task { await app.bootstrap() }
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

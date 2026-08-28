import SwiftUI

@main
struct EstateOSTvApp: App {
    init() {
        TvLaunchMetrics.markAppLaunch()
        #if DEBUG
        EstateOSPhase2SelfTest.runAll()
        #endif
    }
    @StateObject private var appModel = AppModel()
    @StateObject private var heroTransition = HeroTransitionCoordinator()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appModel)
                .environmentObject(heroTransition)
                .task {
                    await appModel.bootstrap()
                }
                .onOpenURL { url in
                    appModel.handleDeepLink(url)
                }
        }
    }
}

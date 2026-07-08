import SwiftUI

@main
struct EstateOSTvApp: App {
    @StateObject private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appModel)
                .task {
                    await appModel.bootstrap()
                }
        }
    }
}

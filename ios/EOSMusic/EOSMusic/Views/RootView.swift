import SwiftUI

struct RootView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences

    var body: some View {
        ZStack {
            EOSAmbientBackground()

            if app.isBootstrapping {
                EOSLoadingView(title: "Ładuję…")
            } else if app.user == nil {
                LoginView()
            } else {
                MainTabView()
            }
        }
        .sheet(isPresented: $app.isFullPlayerPresented) {
            FullPlayerView()
                .environmentObject(app)
                .environmentObject(ui)
        }
    }
}

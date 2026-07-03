import SwiftUI

@main
struct NostalgieMoviesApp: App {
    @StateObject private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appModel)
                .task { await appModel.bootstrap() }
                .onOpenURL { url in
                    if let mediaURL = DeepLink.parseMediaURL(url) {
                        appModel.openDeepLinkMedia(url: mediaURL)
                    }
                }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        Group {
            if app.isBootstrapping {
                splash
            } else if app.session != nil {
                HomeTabView()
            } else {
                LoginView()
            }
        }
        .nostalgieScreen()
    }

    private var splash: some View {
        VStack(spacing: 28) {
            Image(systemName: "play.tv.fill")
                .font(.system(size: 56, weight: .light))
                .foregroundStyle(NostalgieTheme.accentSecondary)
            VStack(spacing: 6) {
                Text("NOSTALGIE™")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NostalgieTheme.accentSecondary)
                    .tracking(1.6)
                Text("MOVIES")
                    .font(.title.weight(.bold))
            }
            ProgressView()
                .padding(.top, 8)
        }
    }
}

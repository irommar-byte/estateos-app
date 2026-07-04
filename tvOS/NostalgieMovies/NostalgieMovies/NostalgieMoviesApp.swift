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
        VStack(spacing: 24) {
            Image(systemName: "play.tv.fill")
                .font(NostalgieFont.rounded(52, weight: .light))
                .foregroundStyle(NostalgieTheme.accentSecondary)
            VStack(spacing: 6) {
                Text(AppConfig.brandMark)
                    .font(NostalgieFont.caption)
                    .foregroundStyle(NostalgieTheme.accentSecondary)
                    .tracking(1.6)
                Text(AppConfig.brandProduct)
                    .font(NostalgieFont.rounded(.title, weight: .bold))
            }
            ProgressView()
                .padding(.top, 8)
        }
    }
}

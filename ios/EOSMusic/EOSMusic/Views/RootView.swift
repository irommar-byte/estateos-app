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
                .presentationDetents([.fraction(0.96), .large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(34)
                .presentationBackground {
                    ZStack {
                        EOSTheme.background.opacity(0.42)
                        Rectangle().fill(.ultraThinMaterial)
                        LinearGradient(
                            colors: [
                                EOSTheme.accentSecondary.opacity(0.14),
                                .clear,
                                EOSTheme.accent.opacity(0.1)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    }
                    .ignoresSafeArea()
                }
        }
    }
}

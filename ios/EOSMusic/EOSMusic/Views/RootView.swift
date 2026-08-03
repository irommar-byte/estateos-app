import SwiftUI

struct RootView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences
    @EnvironmentObject private var video: VideoAppModel

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
        .overlay(alignment: .top) {
            if let toast = app.toast {
                MusicToastBanner(toast: toast)
                    .padding(.top, 10)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onTapGesture { app.dismissToast() }
                    .zIndex(50)
            }
        }
        .animation(.spring(response: 0.38, dampingFraction: 0.86), value: app.toast?.id)
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
        .fullScreenCover(isPresented: $video.isPlayerPresented) {
            VideoPlayerView(engine: video.engine)
                .environmentObject(video)
                .environmentObject(app)
        }
    }
}

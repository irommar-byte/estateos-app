import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences
    @EnvironmentObject private var video: VideoAppModel

    private var prefersFullScreenPlayer: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }

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
        // Keep AVPlayerLayer alive outside the video fullScreenCover so PiP survives minimize.
        .background {
            VideoPiPLayerHost(controller: video.pipController)
                .frame(width: 64, height: 36)
                .opacity(0.02)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .animation(.spring(response: 0.38, dampingFraction: 0.86), value: app.toast?.id)
        .modifier(MusicPlayerPresentation(
            isPresented: $app.isFullPlayerPresented,
            useFullScreen: prefersFullScreenPlayer
        ) {
            FullPlayerView()
                .environmentObject(app)
                .environmentObject(ui)
        })
        .fullScreenCover(isPresented: $video.isPlayerPresented) {
            VideoPlayerView(engine: video.engine)
                .environmentObject(video)
                .environmentObject(app)
        }
        .confirmationDialog(
            "Otwórz plik",
            isPresented: Binding(
                get: { app.externalOpenPrompt != nil },
                set: { if !$0 { app.dismissExternalOpenPrompt() } }
            ),
            titleVisibility: .visible
        ) {
            if app.externalOpenPrompt?.suggestedAudio == true {
                Button("Odtwórz jako muzykę") {
                    Task { await app.resolveExternalOpen(as: .audio, video: video) }
                }
            }
            if app.externalOpenPrompt?.suggestedVideo == true {
                Button("Odtwórz jako wideo") {
                    Task { await app.resolveExternalOpen(as: .video, video: video) }
                }
            }
            Button("Anuluj", role: .cancel) {
                app.dismissExternalOpenPrompt()
            }
        } message: {
            if let prompt = app.externalOpenPrompt {
                Text(prompt.fileName)
            }
        }
    }
}

private struct MusicPlayerPresentation<PlayerContent: View>: ViewModifier {
    @Binding var isPresented: Bool
    let useFullScreen: Bool
    @ViewBuilder let playerContent: () -> PlayerContent

    func body(content: Content) -> some View {
        if useFullScreen {
            content.fullScreenCover(isPresented: $isPresented) {
                playerContent()
            }
        } else {
            content.sheet(isPresented: $isPresented) {
                playerContent()
                    .presentationDetents([.fraction(0.96), .large])
                    .presentationDragIndicator(.visible)
                    .presentationCornerRadius(34)
                    .presentationContentInteraction(.scrolls)
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
            .animation(EOSMotion.playerSheet, value: isPresented)
        }
    }
}

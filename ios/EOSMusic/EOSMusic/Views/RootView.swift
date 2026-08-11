import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences
    @EnvironmentObject private var video: VideoAppModel
    @State private var showLaunchIntro = true

    private var prefersFullScreenPlayer: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }

    var body: some View {
        ZStack {
            EOSAmbientBackground()

            if showLaunchIntro {
                EOSLaunchIntroView()
                    .transition(.opacity.combined(with: .scale(scale: 1.03)))
                    .zIndex(10)
            } else if app.user == nil {
                LoginView()
                    .transition(.opacity)
            } else {
                MainTabView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.55), value: showLaunchIntro)
        .task {
            // Guarantee the intro is visible long enough to read, even when the
            // cached session/library make bootstrap resolve almost instantly.
            let start = Date()
            while app.isBootstrapping {
                try? await Task.sleep(nanoseconds: 40_000_000)
            }
            let minimumDuration = 1.35
            let elapsed = Date().timeIntervalSince(start)
            if elapsed < minimumDuration {
                try? await Task.sleep(nanoseconds: UInt64((minimumDuration - elapsed) * 1_000_000_000))
            }
            showLaunchIntro = false
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
                            Color(red: 0.06, green: 0.06, blue: 0.08).opacity(0.96)
                            ProMixerStageBackground()
                                .opacity(0.35)
                            LinearGradient(
                                colors: [
                                    EOSTheme.accentSecondary.opacity(0.1),
                                    .clear,
                                    EOSTheme.accent.opacity(0.08)
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

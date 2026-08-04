import SwiftUI

// MARK: - Environment: mini-player clearance for nested Lists / ScrollViews

private struct MiniPlayerClearanceKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

extension EnvironmentValues {
    var miniPlayerClearance: CGFloat {
        get { self[MiniPlayerClearanceKey.self] }
        set { self[MiniPlayerClearanceKey.self] = newValue }
    }
}

struct MiniPlayerTabInset: ViewModifier {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel

    private var isVisible: Bool {
        app.playback.engine != nil && !app.isFullPlayerPresented && !video.isPlayerPresented
    }

    func body(content: Content) -> some View {
        content
            .environment(\.miniPlayerClearance, isVisible ? EOSLayout.miniPlayerScrollClearance : 0)
            .contentMargins(.bottom, isVisible ? EOSLayout.miniPlayerScrollClearance : 0, for: .scrollContent)
            .safeAreaInset(edge: .bottom, spacing: 6) {
                if isVisible {
                    MiniPlayerBar()
                        .padding(.horizontal, 10)
                        .padding(.bottom, 2)
                        .transition(
                            .asymmetric(
                                insertion: .move(edge: .bottom).combined(with: .opacity),
                                removal: .opacity
                            )
                        )
                }
            }
            .animation(EOSMotion.standard, value: isVisible)
    }
}

extension View {
    func miniPlayerTabInset() -> some View {
        modifier(MiniPlayerTabInset())
    }

    /// Extra bottom scroll room under the floating mini-player (for nested screens).
    func eosScrollClearance() -> some View {
        modifier(EOSScrollClearanceModifier())
    }
}

private struct EOSScrollClearanceModifier: ViewModifier {
    @Environment(\.miniPlayerClearance) private var clearance

    func body(content: Content) -> some View {
        content.contentMargins(.bottom, clearance, for: .scrollContent)
    }
}

struct MiniPlayerBar: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        if let engine = app.playback.engine {
            MiniPlayerContent(engine: engine)
                .environmentObject(app)
        }
    }
}

private struct MiniPlayerContent: View {
    @ObservedObject var engine: MusicPlaybackEngine
    @EnvironmentObject private var app: AppModel
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        if let track = engine.currentTrack {
            HStack(spacing: 12) {
                Button {
                    withAnimation(EOSMotion.standard) { app.expandPlayer() }
                } label: {
                    HStack(spacing: 12) {
                        ArtworkImage(url: track.artworkURL, size: 44, cornerRadius: 9)
                            .shadow(color: .black.opacity(0.18), radius: 4, y: 2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(track.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(EOSTheme.textPrimary)
                                .lineLimit(1)
                            Text(track.artist ?? "")
                                .font(.caption)
                                .foregroundStyle(EOSTheme.textSecondary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(EOSPressableStyle())

                if !track.isExternal {
                    DownloadCloudButton(
                        state: app.playbackCloudState(for: track),
                        size: 20,
                        onDownload: { app.downloadCurrentPlayback() },
                        onCancel: { app.cancelDownload(for: track.url) },
                        onRemoveOffline: { app.removeOfflineDownload(for: track.url) }
                    )
                }

                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    engine.togglePlayPause()
                } label: {
                    Group {
                        if engine.isLoading {
                            ProgressView()
                                .scaleEffect(0.85)
                        } else {
                            Image(systemName: engine.isPlaying ? "pause.fill" : "play.fill")
                                .font(.title3)
                                .contentTransition(.symbolEffect(.replace))
                        }
                    }
                    .foregroundStyle(EOSTheme.textPrimary)
                    .frame(width: 44, height: 44)
                }
                .buttonStyle(EOSPressableStyle())
                .disabled(engine.isLoading)

                Button {
                    Task { await engine.skipNext() }
                } label: {
                    Image(systemName: "forward.fill")
                        .foregroundStyle(EOSTheme.textSecondary)
                        .frame(width: 36, height: 44)
                }
                .buttonStyle(EOSPressableStyle())
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background {
                RoundedRectangle(cornerRadius: EOSLayout.miniPlayerCorner, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .shadow(
                        color: Color.black.opacity(colorScheme == .dark ? 0.45 : 0.16),
                        radius: 18,
                        x: 0,
                        y: 8
                    )
                    .shadow(
                        color: Color.black.opacity(colorScheme == .dark ? 0.2 : 0.06),
                        radius: 4,
                        x: 0,
                        y: 1
                    )
            }
            .overlay(
                RoundedRectangle(cornerRadius: EOSLayout.miniPlayerCorner, style: .continuous)
                    .strokeBorder(Color.primary.opacity(colorScheme == .dark ? 0.14 : 0.06), lineWidth: 0.5)
            )
        }
    }
}

/// Subtle scale on press — Apple Music–like micro interaction.
struct EOSPressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(EOSMotion.snappy, value: configuration.isPressed)
    }
}

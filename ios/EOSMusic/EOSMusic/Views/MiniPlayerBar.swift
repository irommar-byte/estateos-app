import SwiftUI

// MARK: - Environment: mini-player clearance for nested Lists / ScrollViews

private struct MiniPlayerClearanceKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

private struct EOSScrollActiveKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var miniPlayerClearance: CGFloat {
        get { self[MiniPlayerClearanceKey.self] }
        set { self[MiniPlayerClearanceKey.self] = newValue }
    }

    /// True while a parent scroll view is actively scrolling — pauses island bar TimelineView.
    var eosScrollActive: Bool {
        get { self[EOSScrollActiveKey.self] }
        set { self[EOSScrollActiveKey.self] = newValue }
    }
}

struct MiniPlayerTabInset: ViewModifier {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @State private var scrollActive = false

    private var showsVideo: Bool {
        video.engine.currentItem != nil && !video.isPlayerPresented
    }

    private var showsMusic: Bool {
        !showsVideo && app.playback.engine != nil && !app.isFullPlayerPresented
    }

    private var isVisible: Bool { showsVideo || showsMusic }

    func body(content: Content) -> some View {
        // Parent `safeAreaInset` (mini-player) positions the bar. Nested Lists inside
        // NavigationStack often ignore that inset — they read `miniPlayerClearance` via
        // `.eosScrollClearance()`. Don't also contentMargin here or root screens double-pad.
        let base = content
            .environment(\.miniPlayerClearance, isVisible ? EOSLayout.miniPlayerScrollClearance : 0)
            .environment(\.eosScrollActive, scrollActive)
            .safeAreaInset(edge: .bottom, spacing: 6) {
                if isVisible {
                    Group {
                        if showsVideo {
                            VideoMiniPlayerBar()
                        } else {
                            MiniPlayerBar()
                        }
                    }
                        .padding(.horizontal, 10)
                        .padding(.bottom, 2)
                        .transition(
                            .asymmetric(
                                insertion: .move(edge: .bottom).combined(with: .opacity),
                                removal: .move(edge: .bottom).combined(with: .opacity)
                            )
                        )
                }
            }
            .animation(EOSMotion.playerSheet, value: isVisible)
            .animation(EOSMotion.playerSheet, value: app.isFullPlayerPresented)

        if #available(iOS 18.0, *) {
            base.onScrollPhaseChange { _, phase in
                let active = phase != .idle
                if scrollActive != active { scrollActive = active }
            }
        } else {
            base
        }
    }
}

struct VideoMiniPlayerBar: View {
    @EnvironmentObject private var video: VideoAppModel
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        if let item = video.engine.currentItem {
            HStack(spacing: 12) {
                Button {
                    withAnimation(EOSMotion.standard) { video.expandPlayer() }
                } label: {
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .fill(Color.black)
                            Image(systemName: "film.fill")
                                .font(.title3)
                                .foregroundStyle(EOSTheme.accent)
                        }
                        .frame(width: 44, height: 44)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(EOSTheme.textPrimary)
                                .lineLimit(1)
                            Text(video.engine.folderName)
                                .font(.caption)
                                .foregroundStyle(EOSTheme.textSecondary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(EOSPressableStyle())

                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    video.engine.togglePlayPause()
                } label: {
                    Image(systemName: video.engine.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title3)
                        .foregroundStyle(EOSTheme.textPrimary)
                        .frame(width: 44, height: 44)
                        .contentTransition(.symbolEffect(.replace))
                }
                .buttonStyle(EOSPressableStyle())

                Button {
                    video.engine.playNext(sources: video.sources)
                } label: {
                    Image(systemName: "forward.fill")
                        .foregroundStyle(EOSTheme.textSecondary)
                        .frame(width: 36, height: 44)
                }
                .buttonStyle(EOSPressableStyle())

                Button {
                    video.stopAndClosePlayer()
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(EOSTheme.textSecondary)
                        .frame(width: 32, height: 44)
                }
                .buttonStyle(EOSPressableStyle())
                .accessibilityLabel("Zatrzymaj wideo")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background {
                RoundedRectangle(cornerRadius: EOSLayout.miniPlayerCorner, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .shadow(
                        color: Color.black.opacity(colorScheme == .dark ? 0.45 : 0.16),
                        radius: 18,
                        y: 8
                    )
            }
            .overlay(
                RoundedRectangle(cornerRadius: EOSLayout.miniPlayerCorner, style: .continuous)
                    .strokeBorder(Color.primary.opacity(colorScheme == .dark ? 0.14 : 0.06), lineWidth: 0.5)
            )
        }
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
        // Prefer safeAreaInset spacer — `List` in pushed NavigationStack often ignores
        // contentMargins, which left the last playlist row under the mini-player.
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            if clearance > 0 {
                Color.clear
                    .frame(height: clearance)
                    .accessibilityHidden(true)
            }
        }
    }
}

/// 5 słupków jak Dynamic Island — UIKit + live PCM (lata przy muzyce, bez TimelineView).
struct DynamicIslandMusicBars: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    var compact: Bool = true

    var body: some View {
        IslandBarsHost(visualizer: visualizer, isPlaying: isPlaying, compact: compact)
            .frame(width: compact ? 58 : 72, height: compact ? 24 : 30)
            .accessibilityHidden(true)
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
    @ObservedObject private var statusFlags: PlaybackStatusFlags
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences
    @Environment(\.colorScheme) private var colorScheme
    @State private var showQueueSheet = false

    init(engine: MusicPlaybackEngine) {
        self.engine = engine
        self._statusFlags = ObservedObject(wrappedValue: engine.statusFlags)
    }

    private var showsIslandBars: Bool {
        ui.playerVisualPreset != .off
    }

    var body: some View {
        if let track = engine.currentTrack {
            HStack(spacing: 10) {
                Button {
                    app.expandPlayer()
                } label: {
                    HStack(spacing: 10) {
                        ArtworkImage(
                            url: track.artworkURL,
                            size: 44,
                            cornerRadius: 9,
                            fallbackImage: engine.displayArtwork
                        )
                            .shadow(color: .black.opacity(0.18), radius: 4, y: 2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(track.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(EOSTheme.textPrimary)
                                .lineLimit(1)
                            if engine.isLoading || statusFlags.isBuffering || statusFlags.activity.phase.showsSpinner {
                                PlaybackActivityLine(activity: statusFlags.activity, compact: true)
                            } else {
                                Text(track.artist ?? "")
                                    .font(.caption)
                                    .foregroundStyle(EOSTheme.textSecondary)
                                    .lineLimit(1)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(EOSPressableStyle())

                if showsIslandBars {
                    DynamicIslandMusicBars(
                        visualizer: engine.visualizer,
                        isPlaying: engine.isPlaying && !engine.isLoading,
                        compact: true
                    )
                }

                if !track.isExternal {
                    DownloadCloudButton(
                        state: app.playbackCloudState(for: track),
                        size: 20,
                        onDownload: { app.downloadCurrentPlayback() },
                        onCancel: { app.cancelDownload(for: track.url) },
                        onRemoveOffline: { app.removeOfflineDownload(for: track.url) }
                    )
                }

                if engine.playbackQueueRows.count > 1 {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        showQueueSheet = true
                    } label: {
                        Text(engine.queuePositionLabel)
                            .font(EOSTypography.monoDigit)
                            .foregroundStyle(EOSTheme.textSecondary)
                            .frame(minWidth: 36, minHeight: 36)
                    }
                    .buttonStyle(EOSPressableStyle())
                    .accessibilityLabel("Kolejka, \(engine.queuePositionLabel)")
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
            .sheet(isPresented: $showQueueSheet) {
                PlaybackQueueSheet(engine: engine)
            }
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

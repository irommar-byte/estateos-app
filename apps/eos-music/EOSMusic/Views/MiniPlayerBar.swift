import SwiftUI

// MARK: - Environment: mini-player clearance for nested Lists / ScrollViews

private struct MiniPlayerClearanceKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

private struct EOSScrollActiveKey: EnvironmentKey {
    static let defaultValue = false
}

private struct MiniPlayerUsesSystemChromeKey: EnvironmentKey {
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

    /// iOS 26 tab accessory already draws Liquid Glass — skip our nested capsule.
    var miniPlayerUsesSystemChrome: Bool {
        get { self[MiniPlayerUsesSystemChromeKey.self] }
        set { self[MiniPlayerUsesSystemChromeKey.self] = newValue }
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
        // Stay mounted while the full player is up so collapse doesn't pop the bar back in.
        !showsVideo && app.playback.engine != nil
    }

    private var isVisible: Bool { showsVideo || showsMusic }

    func body(content: Content) -> some View {
        let base = content
            .environment(\.miniPlayerClearance, isVisible ? EOSLayout.miniPlayerScrollClearance : 0)
            .environment(\.eosScrollActive, scrollActive)

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

/// One dock — iPhone floats above tab icons; iPad pins to the absolute bottom edge.
struct MiniPlayerDock: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var tabBarLift: CGFloat = EOSLayout.tabBarItemRow

    private var showsVideo: Bool {
        video.engine.currentItem != nil && !video.isPlayerPresented
    }

    private var showsMusic: Bool {
        !showsVideo && app.playback.engine != nil
    }

    private var isPadBottomDock: Bool {
        UIDevice.current.userInterfaceIdiom == .pad || horizontalSizeClass == .regular
    }

    private var bottomPadding: CGFloat {
        guard showsVideo || showsMusic else { return 0 }
        // iPad: pin to the very bottom — no tab-icon overlap risk like on iPhone.
        if isPadBottomDock { return 4 }
        // iPhone: clear Biblioteka / Szukaj labels under the floating capsule.
        return 6 + max(tabBarLift, EOSLayout.tabBarItemRow)
    }

    var body: some View {
        Group {
            if showsVideo {
                VideoMiniPlayerBar()
            } else if showsMusic {
                MiniPlayerBar()
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, showsVideo || showsMusic ? (isPadBottomDock ? 10 : 12) : 0)
        .padding(.top, showsVideo || showsMusic ? (isPadBottomDock ? 2 : 6) : 0)
        .padding(.bottom, bottomPadding)
        .background {
            if !isPadBottomDock {
                TabBarHeightProbe { height in
                    if abs(tabBarLift - height) > 0.5 {
                        tabBarLift = height
                    }
                }
                .frame(width: 0, height: 0)
                .accessibilityHidden(true)
            }
        }
    }
}

struct VideoMiniPlayerBar: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        if let item = video.engine.currentItem {
            HStack(alignment: .center, spacing: 12) {
                Button {
                    withAnimation(EOSMotion.playerExpand) { video.expandPlayer() }
                } label: {
                    HStack(alignment: .center, spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.black)
                            Image(systemName: "film.fill")
                                .font(.title3)
                                .foregroundStyle(EOSTheme.accent)
                        }
                        .frame(width: EOSLayout.miniPlayerArt, height: EOSLayout.miniPlayerArt)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(EOSTheme.textPrimary)
                                .lineLimit(1)
                            Text(video.engine.folderName)
                                .font(.caption)
                                .foregroundStyle(EOSTheme.textSecondary)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                miniPlayerIconButton(systemName: video.engine.isPlaying ? "pause.fill" : "play.fill") {
                    if video.pipController.isActive || video.pipController.isExternalPlaybackActive {
                        video.pipController.toggleExternalPlayPause()
                    } else {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        video.engine.togglePlayPause()
                    }
                }

                miniPlayerIconButton(systemName: "forward.fill", secondary: true) {
                    Task {
                        await app.onlineMovies.advanceToNextStreamingEpisode(video: video)
                    }
                }

                miniPlayerIconButton(systemName: "xmark", secondary: true, size: 32) {
                    video.stopAndClosePlayer()
                }
                .accessibilityLabel("Zatrzymaj wideo")
            }
            .miniPlayerChrome(colorScheme: colorScheme)
        }
    }
}

extension View {
    func miniPlayerTabInset() -> some View {
        modifier(MiniPlayerTabInset())
    }

    /// Mini-player sits in the gap above the tab labels — never over them.
    /// iOS 26 `tabViewBottomAccessory` is too short and clips the title; we size our own bar.
    @ViewBuilder
    func eosMiniPlayerAboveTabBar() -> some View {
        if #available(iOS 26.0, *) {
            self
                .tabBarMinimizeBehavior(.never)
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    MiniPlayerDock()
                        .environment(\.miniPlayerUsesSystemChrome, false)
                }
        } else {
            self.safeAreaInset(edge: .bottom, spacing: 0) {
                MiniPlayerDock()
                    .environment(\.miniPlayerUsesSystemChrome, false)
            }
        }
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
    @Environment(\.colorScheme) private var colorScheme
    @State private var showQueueSheet = false

    init(engine: MusicPlaybackEngine) {
        self.engine = engine
        self._statusFlags = ObservedObject(wrappedValue: engine.statusFlags)
    }

    var body: some View {
        if let track = engine.currentTrack {
            HStack(alignment: .center, spacing: 10) {
                Button {
                    app.expandPlayer()
                } label: {
                    HStack(alignment: .center, spacing: 12) {
                        ArtworkImage(
                            url: track.artworkURL,
                            size: EOSLayout.miniPlayerArt,
                            cornerRadius: 8,
                            fallbackImage: engine.displayArtwork
                        )

                        VStack(alignment: .leading, spacing: 3) {
                            Text(track.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(EOSTheme.textPrimary)
                                .lineLimit(1)

                            HStack(spacing: 6) {
                                if showsActivity {
                                    if statusFlags.activity.phase.showsSpinner || engine.isLoading {
                                        ProgressView()
                                            .controlSize(.mini)
                                    }
                                    Text(activitySubtitle)
                                        .font(.caption)
                                        .foregroundStyle(EOSTheme.textSecondary)
                                        .lineLimit(1)
                                } else {
                                    Text(track.artist ?? "")
                                        .font(.caption)
                                        .foregroundStyle(EOSTheme.textSecondary)
                                        .lineLimit(1)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                TrackStorageActionButton(
                    track: track.payload,
                    folderId: track.folderId,
                    frameSize: 32
                )

                if engine.playbackQueueRows.count > 1 {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        showQueueSheet = true
                    } label: {
                        Text(engine.queuePositionLabel)
                            .font(.caption.weight(.semibold).monospacedDigit())
                            .foregroundStyle(EOSTheme.textSecondary)
                            .frame(minWidth: 32, minHeight: 32)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Kolejka, \(engine.queuePositionLabel)")
                }

                miniPlayerIconButton(
                    systemName: engine.isPlaying ? "pause.fill" : "play.fill",
                    disabled: engine.isLoading
                ) {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    engine.togglePlayPause()
                }

                miniPlayerIconButton(systemName: "forward.fill", secondary: true) {
                    Task { await engine.skipNext() }
                }
            }
            .miniPlayerChrome(colorScheme: colorScheme)
            .sheet(isPresented: $showQueueSheet) {
                PlaybackQueueSheet(engine: engine)
            }
        }
    }

    private var showsActivity: Bool {
        engine.isLoading || statusFlags.isBuffering || statusFlags.activity.phase.showsSpinner
    }

    private var activitySubtitle: String {
        let detail = statusFlags.activity.detail.trimmingCharacters(in: .whitespacesAndNewlines)
        if !detail.isEmpty { return detail }
        let title = statusFlags.activity.title.trimmingCharacters(in: .whitespacesAndNewlines)
        return title.isEmpty ? "Buforowanie…" : title
    }
}

@ViewBuilder
private func miniPlayerIconButton(
    systemName: String,
    secondary: Bool = false,
    size: CGFloat = 40,
    disabled: Bool = false,
    action: @escaping () -> Void
) -> some View {
    Button(action: action) {
        Image(systemName: systemName)
            .font(.system(size: secondary ? 17 : 20, weight: .semibold))
            .foregroundStyle(secondary ? EOSTheme.textSecondary : EOSTheme.textPrimary)
            .frame(width: size, height: size)
            .contentShape(Rectangle())
            .contentTransition(.symbolEffect(.replace))
    }
    .buttonStyle(.plain)
    .disabled(disabled)
}

private extension View {
    @ViewBuilder
    func miniPlayerChrome(colorScheme: ColorScheme) -> some View {
        self
            .padding(.leading, 10)
            .padding(.trailing, 8)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, minHeight: EOSLayout.miniPlayerHeight, alignment: .center)
            .modifier(EOSLiquidGlassChrome(
                cornerRadius: EOSLayout.miniPlayerCorner,
                colorScheme: colorScheme
            ))
    }
}

/// Reads the tab item row height so the mini-player sits above Biblioteka / Szukaj / …
private struct TabBarHeightProbe: UIViewRepresentable {
    var onChange: (CGFloat) -> Void

    func makeUIView(context: Context) -> ProbeView {
        let view = ProbeView()
        view.onChange = onChange
        return view
    }

    func updateUIView(_ uiView: ProbeView, context: Context) {
        uiView.onChange = onChange
    }

    final class ProbeView: UIView {
        var onChange: ((CGFloat) -> Void)?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            DispatchQueue.main.async { [weak self] in self?.report() }
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            report()
        }

        private func report() {
            var cursor: UIView? = self
            while let current = cursor {
                if let bar = current as? UITabBar {
                    let row = max(49, bar.bounds.height - bar.safeAreaInsets.bottom)
                    onChange?(row)
                    return
                }
                cursor = current.superview
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

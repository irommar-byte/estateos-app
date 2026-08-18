import AVKit
import SwiftUI
import UIKit

struct VideoPlayerView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @ObservedObject private var engine: VideoPlaybackEngine
    @State private var controlsVisible = true
    @State private var hideTask: Task<Void, Never>?
    @State private var showAudioSheet = false
    @State private var showSubtitleSheet = false
    @State private var showPlaylist = false
    @State private var showMore = false
    @State private var showAspectSheet = false
    @State private var scrubTime: Double = 0
    @State private var isScrubbing = false
    @State private var volumeHUD: String?
    @State private var volumeHUDTask: Task<Void, Never>?
    @State private var advanceTask: Task<Void, Never>?
    @FocusState private var keysFocused: Bool

    init(engine: VideoPlaybackEngine) {
        self.engine = engine
    }

    var body: some View {
        GeometryReader { geo in
            let landscape = geo.size.width > geo.size.height
            ZStack {
                Color.black.ignoresSafeArea()

                VLCVideoContainer(engine: engine)
                    .ignoresSafeArea()

                // Sampling surface for system PiP / AirPlay video (must stay in window hierarchy).
                VideoPiPLayerHost(controller: video.pipController)
                    .frame(width: 320, height: 180)
                    .opacity(0.01)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)

                // Tap empty video area to toggle controls — does not cover the chrome.
                Color.clear
                    .contentShape(Rectangle())
                    .padding(.top, 96)
                    .padding(.bottom, landscape ? 110 : 140)
                    .onTapGesture { toggleControls() }

                // Local files: never block the picture with a spinner.
                // Remote: only after prolonged buffering (engine debounces).
                if engine.isBuffering && engine.currentTime < 0.5 {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(1.05)
                        .padding(14)
                        .background(.black.opacity(0.35), in: Circle())
                        .allowsHitTesting(false)
                }

                if video.pipController.isExternalPlaybackActive {
                    VStack(spacing: 8) {
                        Image(systemName: "airplayvideo")
                            .font(.system(size: 42, weight: .semibold))
                        Text(video.pipController.externalDeviceName.map { "AirPlay · \($0)" } ?? "AirPlay")
                            .font(.headline)
                        Text("Obraz i dźwięk na zewnętrznym ekranie")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.75))
                    }
                    .foregroundStyle(.white)
                    .padding(24)
                    .background(.ultraThinMaterial.opacity(0.55), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .allowsHitTesting(false)
                }

                if let error = engine.errorMessage {
                    VStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.largeTitle)
                            .foregroundStyle(.yellow)
                        Text(error)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 24)
                    }
                    .allowsHitTesting(false)
                }

                if let volumeHUD {
                    Text(volumeHUD)
                        .font(.title2.weight(.bold).monospacedDigit())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 22)
                        .padding(.vertical, 14)
                        .background(.ultraThinMaterial.opacity(0.85), in: Capsule())
                        .transition(.opacity.combined(with: .scale(scale: 0.92)))
                        .allowsHitTesting(false)
                }

                if let notice = video.pipController.airPlayNotice {
                    playerNoticeBanner(title: "AirPlay", text: notice) {
                        video.pipController.clearAirPlayNotice()
                    }
                } else if let pipError = video.pipController.errorMessage {
                    playerNoticeBanner(title: "Picture in Picture", text: pipError) {
                        video.pipController.clearError()
                    }
                }

                if controlsVisible {
                    controlsOverlay(landscape: landscape)
                        .transition(.opacity)
                }

                // Captures keyboard when Simulator / Magic Keyboard / Mac is connected.
                VideoKeyCommandBridge(
                    onSpace: { handleKeyPlayPause() },
                    onLeft: { handleKeySeek(-10) },
                    onRight: { handleKeySeek(10) },
                    onUp: { handleKeyVolume(+10) },
                    onDown: { handleKeyVolume(-10) }
                )
                .frame(width: 1, height: 1)
                .opacity(0.01)
            }
            .focusable()
            .focused($keysFocused)
            .onKeyPress(.space) {
                handleKeyPlayPause()
                return .handled
            }
            .onKeyPress(.leftArrow) {
                handleKeySeek(-10)
                return .handled
            }
            .onKeyPress(.rightArrow) {
                handleKeySeek(10)
                return .handled
            }
            .onKeyPress(.upArrow) {
                handleKeyVolume(+10)
                return .handled
            }
            .onKeyPress(.downArrow) {
                handleKeyVolume(-10)
                return .handled
            }
        }
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
        .onAppear {
            OrientationLock.shared.followDeviceForVideo()
            controlsVisible = true
            scheduleHide()
            keysFocused = true
            // Tylko po schowaniu (PiP / mini) — NIE przy pierwszym Oglądaj.
            // scheduleExpandRestore zrywa drawable i robi czarny ekran z dźwiękiem w tle.
            if engine.needsExpandRestore {
                engine.scheduleExpandRestore()
            }
        }
        .onDisappear {
            hideTask?.cancel()
            volumeHUDTask?.cancel()
            advanceTask?.cancel()
            if !video.isPlayerPresented {
                video.syncMinimizedStateAfterDismiss()
            }
        }
        .onChange(of: engine.hasEnded) { _, ended in
            if ended {
                withAnimation(.easeInOut(duration: 0.2)) { controlsVisible = true }
                hideTask?.cancel()
                if engine.hasNext {
                    advanceTask?.cancel()
                    advanceTask = Task {
                        await app.onlineMovies.advanceToNextStreamingEpisode(video: video)
                    }
                }
            }
        }
        .sheet(isPresented: $showAudioSheet) {
            VideoAudioTrackSheet(engine: engine)
        }
        .sheet(isPresented: $showSubtitleSheet) {
            VideoSubtitleSheet(engine: engine)
        }
        .sheet(isPresented: $showPlaylist) {
            VideoPlaylistSheet(engine: engine, sources: video.sources)
        }
        .sheet(isPresented: $showAspectSheet) {
            VideoAspectSheet(engine: engine)
        }
        .confirmationDialog("Prędkość odtwarzania", isPresented: $showMore, titleVisibility: .visible) {
            ForEach(VideoPlaybackRate.allCases) { rate in
                Button(rate.title + (engine.rate == rate ? " ✓" : "")) {
                    engine.rate = rate
                }
            }
            Button("Anuluj", role: .cancel) {}
        }
    }

    @ViewBuilder
    private func playerNoticeBanner(title: String, text: String, dismiss: @escaping () -> Void) -> some View {
        VStack {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.caption.weight(.bold))
                    Text(text)
                        .font(.caption)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Button("OK", action: dismiss)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.white.opacity(0.18), in: Capsule())
            }
            .foregroundStyle(.white)
            .padding(14)
            .background(.ultraThinMaterial.opacity(0.92), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.top, 56)
            Spacer()
        }
        .allowsHitTesting(true)
        .zIndex(50)
    }

    private func handleKeyPlayPause() {
        engine.togglePlayPause()
        bumpControls()
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func handleKeySeek(_ delta: Double) {
        engine.nudgeSeek(by: delta)
        bumpControls()
    }

    private func handleKeyVolume(_ delta: Int) {
        let level = engine.nudgeVolume(by: delta)
        showVolumeHUD(level)
        bumpControls()
    }

    private func showVolumeHUD(_ level: Int) {
        withAnimation(.easeOut(duration: 0.12)) {
            volumeHUD = "Głośność \(level)%"
        }
        volumeHUDTask?.cancel()
        volumeHUDTask = Task {
            try? await Task.sleep(nanoseconds: 900_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.2)) { volumeHUD = nil }
        }
    }

    @ViewBuilder
    private func controlsOverlay(landscape: Bool) -> some View {
        VStack(spacing: 0) {
            topBar
                .padding(.horizontal, 16)
                .padding(.top, 8)

            Spacer(minLength: 0)

            centerTransport
                .padding(.bottom, 8)

            bottomBar(landscape: landscape)
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
                .padding(.top, 6)
                .background(
                    LinearGradient(
                        colors: [.clear, .black.opacity(0.72)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .ignoresSafeArea(edges: .bottom)
                    .allowsHitTesting(false)
                )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                colors: [.black.opacity(0.55), .clear],
                startPoint: .top,
                endPoint: .center
            )
            .frame(height: 120)
            .frame(maxHeight: .infinity, alignment: .top)
            .ignoresSafeArea(edges: .top)
            .allowsHitTesting(false)
        )
    }

    private var topBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Button {
                    video.minimizePlayer()
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.body.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(.ultraThinMaterial.opacity(0.55), in: Circle())
                }
                .accessibilityLabel("Schowaj player")

                VStack(alignment: .leading, spacing: 4) {
                    Text(engine.currentItem?.title ?? "Wideo")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    HStack(spacing: 8) {
                        BreathingSourceBadge(
                            origin: video.pipController.isExternalPlaybackActive ? .airPlay : engine.playbackOrigin,
                            compact: true
                        )
                        Text(engine.folderName)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.7))
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 8)

                Button {
                    Task {
                        await video.pipController.start(engine: engine)
                        bumpControls()
                    }
                } label: {
                    Group {
                        if video.pipController.isPreparing {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "pip.enter")
                                .font(.body.weight(.semibold))
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(.ultraThinMaterial.opacity(0.55), in: Circle())
                }
                .disabled(video.pipController.isPreparing || !video.pipController.isSystemSupported)
                .accessibilityLabel("Picture in Picture")
                .accessibilityHint("Odtwarzaj w małym oknie nad innymi aplikacjami")

                AirPlayRouteButton {
                    video.pipController.prepareAirPlayHandoff(for: engine, userInitiated: true)
                }
                    .frame(width: 40, height: 40)
                    .background(.ultraThinMaterial.opacity(0.55), in: Circle())
                    .accessibilityLabel("AirPlay")

                Button {
                    showAspectSheet = true
                    bumpControls()
                } label: {
                    Image(systemName: "aspectratio")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(.ultraThinMaterial.opacity(0.55), in: Circle())
                }
                .accessibilityLabel("Proporcje ekranu")

                Button {
                    showPlaylist = true
                    bumpControls()
                } label: {
                    Image(systemName: "list.bullet")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(.ultraThinMaterial.opacity(0.55), in: Circle())
                }

                Button {
                    showMore = true
                    bumpControls()
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.body.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(.ultraThinMaterial.opacity(0.55), in: Circle())
                }
            }

            VideoSignalBadgeBar(
                info: engine.signalInfo,
                aspectTitle: engine.aspectMode.hudLabel
            )
        }
    }

    private var centerTransport: some View {
        HStack(spacing: 28) {
            Button {
                engine.playPrevious(sources: video.sources)
                bumpControls()
            } label: {
                Image(systemName: "backward.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
            }

            Button {
                engine.jumpBackward15()
                bumpControls()
            } label: {
                Image(systemName: "gobackward.15")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(Color.white.opacity(0.14), in: Circle())
            }

            Button {
                engine.togglePlayPause()
                bumpControls()
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: playPauseIcon)
                        .font(.system(size: 64))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(.white)
                    if engine.hasEnded {
                        Text("Od początku")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: 88, height: 88)
            }

            Button {
                engine.jumpForward15()
                bumpControls()
            } label: {
                Image(systemName: "goforward.15")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(Color.white.opacity(0.14), in: Circle())
            }

            Button {
                engine.playNext(sources: video.sources)
                bumpControls()
            } label: {
                Image(systemName: "forward.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
            }
        }
    }

    private var playPauseIcon: String {
        if engine.hasEnded { return "play.circle.fill" }
        return engine.isPlaying ? "pause.circle.fill" : "play.circle.fill"
    }

    private func bottomBar(landscape: Bool) -> some View {
        VStack(spacing: landscape ? 8 : 12) {
            VideoScrubber(
                thumbnails: engine.thumbnailGenerator,
                value: isScrubbing ? scrubTime : engine.currentTime,
                duration: max(engine.duration, 0.001),
                onEditingChanged: { editing, time in
                    if editing {
                        isScrubbing = true
                        engine.isUserSeeking = true
                        hideTask?.cancel()
                        scrubTime = time
                    } else {
                        scrubTime = time
                        engine.seek(to: time, resume: true)
                        engine.isUserSeeking = false
                        isScrubbing = false
                        engine.captureScrubPreview()
                        bumpControls()
                    }
                }
            )
            .frame(maxWidth: .infinity)
            .frame(height: 78)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    Button {
                        showAudioSheet = true
                        bumpControls()
                    } label: {
                        playerChip(title: "Lektor", systemImage: "waveform", emphasized: false)
                    }

                    Button {
                        if engine.subtitleTracks.isEmpty {
                            showSubtitleSheet = true
                        } else {
                            engine.setSubtitlesEnabled(!engine.subtitlesEnabled)
                        }
                        bumpControls()
                    } label: {
                        playerChip(
                            title: engine.subtitlesEnabled ? "Napisy wł." : "Napisy",
                            systemImage: engine.subtitlesEnabled ? "captions.bubble.fill" : "captions.bubble",
                            emphasized: engine.subtitlesEnabled
                        )
                    }
                    .simultaneousGesture(
                        LongPressGesture(minimumDuration: 0.45).onEnded { _ in
                            showSubtitleSheet = true
                            bumpControls()
                        }
                    )

                    Button {
                        showAspectSheet = true
                        bumpControls()
                    } label: {
                        playerChip(title: engine.aspectMode.title, systemImage: "aspectratio", emphasized: false)
                    }

                    if engine.signalInfo.isHDR {
                        Text(engine.signalInfo.hdrLabel)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.black)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(Color.yellow, in: Capsule())
                    }

                    Text(engine.rate.title)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white.opacity(0.85))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(Color.white.opacity(0.12), in: Capsule())
                        .onTapGesture {
                            showMore = true
                            bumpControls()
                        }

                    Text("\(engine.currentIndex + 1)/\(max(engine.queue.count, 1))")
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.white.opacity(0.8))
                }
            }
        }
    }

    private func playerChip(title: String, systemImage: String, emphasized: Bool) -> some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
            Text(title)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .environment(\.locale, Locale(identifier: "en_US_POSIX"))
        }
        .font(.subheadline.weight(.bold))
        .foregroundStyle(emphasized ? Color.black : .white)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            emphasized ? EOSTheme.accent : Color.white.opacity(0.16),
            in: Capsule()
        )
    }

    private func toggleControls() {
        withAnimation(.easeInOut(duration: 0.18)) {
            controlsVisible.toggle()
        }
        if controlsVisible { scheduleHide() }
    }

    private func bumpControls() {
        withAnimation(.easeInOut(duration: 0.12)) { controlsVisible = true }
        scheduleHide()
    }

    private func scheduleHide() {
        hideTask?.cancel()
        hideTask = Task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard !Task.isCancelled, !isScrubbing, !showAudioSheet, !showSubtitleSheet, !showPlaylist, !showMore, !showAspectSheet, !engine.hasEnded else { return }
            withAnimation(.easeInOut(duration: 0.22)) {
                controlsVisible = false
            }
        }
    }
}

// MARK: - Full-width scrubber (smooth drag)

private struct VideoScrubber: View {
    @ObservedObject var thumbnails: VideoThumbnailGenerator
    let value: Double
    let duration: Double
    let onEditingChanged: (_ editing: Bool, _ time: Double) -> Void

    @State private var dragTime: Double?
    private var displayTime: Double { dragTime ?? value }
    private var progress: CGFloat {
        guard duration > 0 else { return 0 }
        return CGFloat(min(max(displayTime / duration, 0), 1))
    }

    var body: some View {
        VStack(spacing: 8) {
            if dragTime != nil {
                GeometryReader { geo in
                    previewBubble
                        .position(
                            x: min(max(84, geo.size.width * progress), max(84, geo.size.width - 84)),
                            y: geo.size.height / 2
                        )
                }
                .frame(height: 112)
            }

            HStack {
                Text(formatClock(displayTime))
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text(formatClock(duration))
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white.opacity(0.85))
            }

            GeometryReader { geo in
                let width = max(geo.size.width, 1)
                ZStack(alignment: .leading) {
                    filmstrip(width: width)

                    Rectangle()
                        .fill(EOSTheme.accent.opacity(0.26))
                        .frame(width: max(3, width * progress))

                    Rectangle()
                        .fill(Color.white)
                        .frame(width: 2, height: 48)
                        .shadow(color: .black.opacity(0.6), radius: 2)
                        .offset(x: min(max(0, width * progress - 1), width - 2))

                    Circle()
                        .fill(Color.white)
                        .frame(width: 16, height: 16)
                        .shadow(color: .black.opacity(0.45), radius: 3, y: 1)
                        .offset(x: min(max(0, width * progress - 8), width - 16))
                }
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .stroke(Color.white.opacity(0.28), lineWidth: 0.7)
                )
                .frame(maxHeight: .infinity, alignment: .center)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { gesture in
                            let ratio = min(max(gesture.location.x / width, 0), 1)
                            let time = Double(ratio) * duration
                            dragTime = time
                            onEditingChanged(true, time)
                        }
                        .onEnded { gesture in
                            let ratio = min(max(gesture.location.x / width, 0), 1)
                            let time = Double(ratio) * duration
                            dragTime = nil
                            onEditingChanged(false, time)
                        }
                )
            }
            .frame(height: 48)
        }
        .animation(.easeOut(duration: 0.14), value: dragTime != nil)
    }

    @ViewBuilder
    private func filmstrip(width: CGFloat) -> some View {
        if thumbnails.frames.isEmpty {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(Color.white.opacity(0.16))
                HStack(spacing: 5) {
                    Image(systemName: "film")
                    Text("Przesuń, aby wyszukać fragment")
                        .font(.caption2.weight(.semibold))
                }
                .foregroundStyle(.white.opacity(0.8))
            }
        } else {
            HStack(spacing: 1) {
                ForEach(thumbnails.frames) { frame in
                    Image(uiImage: frame.image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: max(14, width / CGFloat(thumbnails.frames.count)), height: 48)
                        .clipped()
                }
            }
        }
    }

    private var previewBubble: some View {
        VStack(spacing: 4) {
            Group {
                if let frame = thumbnails.nearestFrame(to: Double(progress)) {
                    Image(uiImage: frame.image)
                        .resizable()
                        .scaledToFill()
                } else {
                    ZStack {
                        Color.black
                        Image(systemName: "film")
                            .font(.title2)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
            }
            .frame(width: 152, height: 82)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

            Text(formatClock(displayTime))
                .font(.caption.monospacedDigit().weight(.bold))
                .foregroundStyle(.white)
        }
        .padding(4)
        .background(Color.black.opacity(0.88), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .stroke(Color.white.opacity(0.4), lineWidth: 0.7)
        )
        .shadow(color: .black.opacity(0.65), radius: 12, y: 5)
    }

    private func formatClock(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "0:00" }
        let total = Int(seconds.rounded())
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d", m, s)
    }
}

// MARK: - VLC drawable host

struct VLCVideoContainer: UIViewRepresentable {
    @ObservedObject var engine: VideoPlaybackEngine

    func makeUIView(context: Context) -> PlayerDrawableView {
        let view = PlayerDrawableView()
        engine.attach(host: view)
        return view
    }

    func updateUIView(_ uiView: PlayerDrawableView, context: Context) {
        if engine.player.drawable as? UIView !== uiView.videoSurface {
            engine.attach(host: uiView)
            return
        }
        if uiView.bounds.width > 8, uiView.bounds.height > 8 {
            uiView.relayoutVideoSurface()
        }
        if uiView.aspectMode != engine.aspectMode {
            engine.applyAspect(force: true)
        }
    }
}

/// Host clips; `videoSurface` is the actual VLC drawable and is framed for aspect modes
/// (same idea as `AVPlayerLayer.videoGravity`).
final class PlayerDrawableView: UIView {
    let videoSurface = UIView()
    var aspectMode: VideoAspectMode = .automatic
    var sourceSize: CGSize = .zero
    var onBoundsChange: (() -> Void)?

    private var lastReportedBounds: CGRect = .zero

    override init(frame: CGRect) {
        super.init(frame: frame)
        commonInit()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }

    private func commonInit() {
        backgroundColor = .black
        clipsToBounds = true
        videoSurface.backgroundColor = .black
        videoSurface.isUserInteractionEnabled = false
        addSubview(videoSurface)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        relayoutVideoSurface()
        if bounds != lastReportedBounds {
            lastReportedBounds = bounds
            onBoundsChange?()
        }
    }

    func relayoutVideoSurface() {
        let next = Self.surfaceFrame(mode: aspectMode, sourceSize: sourceSize, in: bounds)
        if videoSurface.frame != next {
            videoSurface.frame = next
        }
        // VLC attaches GL/Metal layers — keep them filling the surface.
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        videoSurface.layer.sublayers?.forEach { $0.frame = videoSurface.bounds }
        videoSurface.subviews.forEach { $0.frame = videoSurface.bounds }
        CATransaction.commit()
    }

    static func surfaceFrame(mode: VideoAspectMode, sourceSize: CGSize, in container: CGRect) -> CGRect {
        guard container.width > 1, container.height > 1 else { return container }

        switch mode {
        case .stretch:
            return container

        case .fillScreen:
            return scaledRect(
                aspect: sourceAspect(sourceSize, fallbackIn: container),
                in: container,
                fill: true
            )

        case .automatic, .fitScreen:
            return scaledRect(
                aspect: sourceAspect(sourceSize, fallbackIn: container),
                in: container,
                fill: false
            )

        case .ratio16_9, .ratio4_3, .ratio21_9, .ratio2_35, .ratio2_39, .ratio1_1, .ratio3_2, .ratio9_16:
            let aspect = mode.forcedAspect ?? sourceAspect(sourceSize, fallbackIn: container)
            return scaledRect(aspect: aspect, in: container, fill: false)
        }
    }

    private static func sourceAspect(_ source: CGSize, fallbackIn container: CGRect) -> CGFloat {
        if source.width > 1, source.height > 1 {
            return source.width / source.height
        }
        return container.width / container.height
    }

    private static func scaledRect(aspect: CGFloat, in container: CGRect, fill: Bool) -> CGRect {
        guard aspect > 0.01, aspect < 100 else { return container }
        let containerAspect = container.width / container.height
        let size: CGSize
        if fill {
            if aspect > containerAspect {
                let height = container.height
                size = CGSize(width: height * aspect, height: height)
            } else {
                let width = container.width
                size = CGSize(width: width, height: width / aspect)
            }
        } else {
            if aspect > containerAspect {
                let width = container.width
                size = CGSize(width: width, height: width / aspect)
            } else {
                let height = container.height
                size = CGSize(width: height * aspect, height: height)
            }
        }
        return CGRect(
            x: container.midX - size.width / 2,
            y: container.midY - size.height / 2,
            width: size.width,
            height: size.height
        )
    }
}

// MARK: - AirPlay + keyboard

struct AirPlayRouteButton: UIViewRepresentable {
    var onPrepare: () -> Void = {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onPrepare: onPrepare)
    }

    func makeUIView(context: Context) -> AVRoutePickerView {
        let picker = AVRoutePickerView()
        picker.tintColor = .white
        picker.activeTintColor = UIColor(EOSTheme.accent)
        picker.prioritizesVideoDevices = true
        // Warm AVPlayer before the system sheet appears (touch down, not only after pick).
        let down = UILongPressGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.warm))
        down.minimumPressDuration = 0
        down.cancelsTouchesInView = false
        down.delegate = context.coordinator
        picker.addGestureRecognizer(down)
        return picker
    }

    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {
        context.coordinator.onPrepare = onPrepare
        uiView.prioritizesVideoDevices = true
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var onPrepare: () -> Void
        init(onPrepare: @escaping () -> Void) { self.onPrepare = onPrepare }
        @objc func warm(_ gesture: UIGestureRecognizer) {
            if gesture.state == .began {
                onPrepare()
            }
        }
        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool { true }
    }
}

/// UIKit key commands — reliable in Simulator and with hardware keyboards.
struct VideoKeyCommandBridge: UIViewControllerRepresentable {
    var onSpace: () -> Void
    var onLeft: () -> Void
    var onRight: () -> Void
    var onUp: () -> Void
    var onDown: () -> Void

    func makeUIViewController(context: Context) -> VideoKeyCommandController {
        let vc = VideoKeyCommandController()
        vc.onSpace = onSpace
        vc.onLeft = onLeft
        vc.onRight = onRight
        vc.onUp = onUp
        vc.onDown = onDown
        return vc
    }

    func updateUIViewController(_ uiViewController: VideoKeyCommandController, context: Context) {
        uiViewController.onSpace = onSpace
        uiViewController.onLeft = onLeft
        uiViewController.onRight = onRight
        uiViewController.onUp = onUp
        uiViewController.onDown = onDown
        uiViewController.becomeFirstResponder()
    }
}

final class VideoKeyCommandController: UIViewController {
    var onSpace: (() -> Void)?
    var onLeft: (() -> Void)?
    var onRight: (() -> Void)?
    var onUp: (() -> Void)?
    var onDown: (() -> Void)?

    override var canBecomeFirstResponder: Bool { true }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        becomeFirstResponder()
    }

    override var keyCommands: [UIKeyCommand]? {
        [
            UIKeyCommand(input: " ", modifierFlags: [], action: #selector(space)),
            UIKeyCommand(input: UIKeyCommand.inputLeftArrow, modifierFlags: [], action: #selector(left)),
            UIKeyCommand(input: UIKeyCommand.inputRightArrow, modifierFlags: [], action: #selector(right)),
            UIKeyCommand(input: UIKeyCommand.inputUpArrow, modifierFlags: [], action: #selector(up)),
            UIKeyCommand(input: UIKeyCommand.inputDownArrow, modifierFlags: [], action: #selector(down)),
        ]
    }

    @objc private func space() { onSpace?() }
    @objc private func left() { onLeft?() }
    @objc private func right() { onRight?() }
    @objc private func up() { onUp?() }
    @objc private func down() { onDown?() }
}

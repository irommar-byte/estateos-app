import SwiftUI
import UIKit

struct VideoPlayerView: View {
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

                // Tap empty video area to toggle controls — does not cover the chrome.
                Color.clear
                    .contentShape(Rectangle())
                    .padding(.top, 96)
                    .padding(.bottom, landscape ? 110 : 140)
                    .onTapGesture { toggleControls() }

                // Local files: never block the picture with a spinner.
                // Remote: only after prolonged buffering (engine debounces).
                if engine.isBuffering {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(1.05)
                        .padding(14)
                        .background(.black.opacity(0.35), in: Circle())
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

                if controlsVisible {
                    controlsOverlay(landscape: landscape)
                        .transition(.opacity)
                }
            }
        }
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
        .onAppear {
            OrientationLock.shared.unlockAll()
            // Keep chrome visible at start so playback doesn't feel “stuck”.
            controlsVisible = true
            scheduleHide()
        }
        .onDisappear { hideTask?.cancel() }
        .onChange(of: engine.hasEnded) { _, ended in
            if ended {
                withAnimation(.easeInOut(duration: 0.2)) { controlsVisible = true }
                hideTask?.cancel()
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
                    video.dismissPlayer()
                } label: {
                    Image(systemName: "xmark")
                        .font(.body.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(.ultraThinMaterial.opacity(0.55), in: Circle())
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(engine.currentItem?.title ?? "Wideo")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(engine.folderName)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.7))
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

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
                        bumpControls()
                    }
                }
            )
            .frame(maxWidth: .infinity)
            .frame(height: 28)

            HStack(spacing: 10) {
                Button {
                    showAudioSheet = true
                    bumpControls()
                } label: {
                    Label("Lektor", systemImage: "waveform")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.white.opacity(0.16), in: Capsule())
                }

                Button {
                    if engine.subtitleTracks.isEmpty {
                        showSubtitleSheet = true
                    } else {
                        engine.setSubtitlesEnabled(!engine.subtitlesEnabled)
                    }
                    bumpControls()
                } label: {
                    Label(
                        engine.subtitlesEnabled ? "Napisy wł." : "Napisy",
                        systemImage: engine.subtitlesEnabled ? "captions.bubble.fill" : "captions.bubble"
                    )
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(engine.subtitlesEnabled ? Color.black : .white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        engine.subtitlesEnabled ? EOSTheme.accent : Color.white.opacity(0.16),
                        in: Capsule()
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
                    Label(engine.aspectMode.title, systemImage: "aspectratio")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.white.opacity(0.16), in: Capsule())
                }

                Spacer(minLength: 0)

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
    let value: Double
    let duration: Double
    let onEditingChanged: (_ editing: Bool, _ time: Double) -> Void

    @State private var dragTime: Double?
    @State private var trackWidth: CGFloat = 1

    private var displayTime: Double { dragTime ?? value }
    private var progress: CGFloat {
        guard duration > 0 else { return 0 }
        return CGFloat(min(max(displayTime / duration, 0), 1))
    }

    var body: some View {
        VStack(spacing: 4) {
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
                    Capsule()
                        .fill(Color.white.opacity(0.25))
                        .frame(height: 5)
                    Capsule()
                        .fill(EOSTheme.accent)
                        .frame(width: max(5, width * progress), height: 5)
                    Circle()
                        .fill(Color.white)
                        .frame(width: 18, height: 18)
                        .shadow(color: .black.opacity(0.35), radius: 2, y: 1)
                        .offset(x: max(0, width * progress - 9))
                }
                .frame(maxHeight: .infinity, alignment: .center)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { gesture in
                            trackWidth = width
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
            .frame(height: 24)
        }
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

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
    @State private var isSeeking = false
    @State private var scrubTime: Double = 0

    init(engine: VideoPlaybackEngine) {
        self.engine = engine
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.ignoresSafeArea()

                VLCVideoContainer(engine: engine)
                    .ignoresSafeArea()

                if engine.isBuffering {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(1.2)
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
                }

                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { toggleControls() }

                if controlsVisible {
                    controlsOverlay(size: geo.size)
                        .transition(.opacity)
                }
            }
        }
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
        .onAppear { scheduleHide() }
        .onDisappear { hideTask?.cancel() }
        .sheet(isPresented: $showAudioSheet) {
            VideoAudioTrackSheet(engine: engine)
        }
        .sheet(isPresented: $showSubtitleSheet) {
            VideoSubtitleSheet(engine: engine)
        }
        .sheet(isPresented: $showPlaylist) {
            VideoPlaylistSheet(engine: engine, sources: video.sources)
        }
        .confirmationDialog("Opcje odtwarzania", isPresented: $showMore, titleVisibility: .visible) {
            ForEach(VideoPlaybackRate.allCases) { rate in
                Button(rate.title + (engine.rate == rate ? " ✓" : "")) {
                    engine.rate = rate
                }
            }
            Button(engine.aspectMode == .fit ? "Wypełnij ekran" : "Dopasuj do ekranu") {
                engine.aspectMode = engine.aspectMode == .fit ? .fill : .fit
            }
            Button("Anuluj", role: .cancel) {}
        }
    }

    @ViewBuilder
    private func controlsOverlay(size: CGSize) -> some View {
        VStack(spacing: 0) {
            topBar
                .padding(.horizontal, 16)
                .padding(.top, 10)

            Spacer()

            centerTransport

            bottomBar
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
        }
        .background(
            LinearGradient(
                colors: [.black.opacity(0.55), .clear, .clear, .black.opacity(0.7)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)
        )
    }

    private var topBar: some View {
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
    }

    private var centerTransport: some View {
        HStack(spacing: 36) {
            Button {
                engine.playPrevious(sources: video.sources)
                bumpControls()
            } label: {
                Image(systemName: "backward.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
            }

            Button {
                engine.jumpBackward15()
                bumpControls()
            } label: {
                Image(systemName: "gobackward.15")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(Color.white.opacity(0.14), in: Circle())
            }
            .accessibilityLabel("Cofnij 15 sekund")

            Button {
                engine.togglePlayPause()
                bumpControls()
            } label: {
                Image(systemName: engine.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 72))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.white)
            }
            .accessibilityLabel(engine.isPlaying ? "Pauza" : "Odtwarzaj")

            Button {
                engine.jumpForward15()
                bumpControls()
            } label: {
                Image(systemName: "goforward.15")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(Color.white.opacity(0.14), in: Circle())
            }
            .accessibilityLabel("Do przodu 15 sekund")

            Button {
                engine.playNext(sources: video.sources)
                bumpControls()
            } label: {
                Image(systemName: "forward.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
            }
        }
        .padding(.bottom, 18)
    }

    private var bottomBar: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                Text(formatClock(isSeeking ? scrubTime : engine.currentTime))
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 52, alignment: .leading)

                Slider(
                    value: Binding(
                        get: { isSeeking ? scrubTime : engine.currentTime },
                        set: { scrubTime = $0 }
                    ),
                    in: 0...max(engine.duration, 1),
                    onEditingChanged: { editing in
                        isSeeking = editing
                        if editing {
                            hideTask?.cancel()
                            scrubTime = engine.currentTime
                        } else {
                            engine.seek(to: scrubTime)
                            bumpControls()
                        }
                    }
                )
                .tint(EOSTheme.accent)

                Text(formatClock(engine.duration))
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 52, alignment: .trailing)
            }

            HStack(spacing: 10) {
                // Lektor — wyraźny przycisk
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
                .accessibilityLabel("Zmień język lektora")

                // Napisy — szybki toggle + long-press sheet
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
                .accessibilityLabel("Napisy — tap włącz/wyłącz, przytrzymaj wybór ścieżki")

                Spacer(minLength: 0)

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
        withAnimation(.easeInOut(duration: 0.2)) {
            controlsVisible.toggle()
        }
        if controlsVisible { scheduleHide() }
    }

    private func bumpControls() {
        withAnimation(.easeInOut(duration: 0.15)) { controlsVisible = true }
        scheduleHide()
    }

    private func scheduleHide() {
        hideTask?.cancel()
        hideTask = Task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard !Task.isCancelled, !isSeeking, !showAudioSheet, !showSubtitleSheet, !showPlaylist, !showMore else { return }
            withAnimation(.easeInOut(duration: 0.25)) {
                controlsVisible = false
            }
        }
    }

    private func formatClock(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "0:00" }
        let total = Int(seconds.rounded())
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", m, s)
    }
}

// MARK: - VLC drawable host

struct VLCVideoContainer: UIViewRepresentable {
    @ObservedObject var engine: VideoPlaybackEngine

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        view.backgroundColor = .black
        view.clipsToBounds = true
        engine.attach(drawable: view)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        if engine.player.drawable as? UIView !== uiView {
            engine.attach(drawable: uiView)
        }
    }
}

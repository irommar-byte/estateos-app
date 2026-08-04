import AVFoundation
import SwiftUI

struct FullPlayerView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let engine = app.playback.engine {
            PlayerContent(engine: engine)
                .environmentObject(app)
        } else {
            Color.clear.onAppear { app.minimizePlayer() }
        }
    }
}

private struct PlayerContent: View {
    @ObservedObject var engine: MusicPlaybackEngine
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showAddToPlaylist = false
    @State private var showEffectsSheet = false
    @State private var artistRoute: MusicArtistRoute?
    @State private var albumRoute: MusicAlbumRoute?
    @State private var browseError: String?
    @State private var thermal = ProcessInfo.processInfo.thermalState
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled

    private var preset: PlayerVisualPreset { ui.playerVisualPreset }

    private var policy: PlayerVisualPolicy {
        PlayerVisualPolicy.resolve(
            preset: preset,
            intensity: ui.playerEffectsIntensity,
            strobeEnabled: ui.playerStrobeEnabled,
            autoPerformance: ui.playerAutoPerformance,
            reduceMotion: reduceMotion,
            lowPower: lowPower,
            thermal: thermal
        )
    }

    private var effectsActive: Bool { policy.enabled && preset != .off }

    var body: some View {
        NavigationStack {
            playerBody
                .navigationDestination(item: $artistRoute) { route in
                    ArtistDetailView(artistId: route.artistId, artistName: route.artistName)
                        .environmentObject(app)
                }
                .navigationDestination(item: $albumRoute) { route in
                    AlbumDetailView(albumId: route.albumId)
                        .environmentObject(app)
                }
        }
        .alert("Katalog", isPresented: Binding(get: { browseError != nil }, set: { if !$0 { browseError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(browseError ?? "")
        }
        .onAppear { syncAnalyzer() }
        .onDisappear {
            // Mini-player: keep light analysis off to save battery.
            engine.configureVisualAnalysis(enabled: false, fps: 0)
        }
        .onChange(of: ui.playerVisualPreset) { _, _ in syncAnalyzer() }
        .onChange(of: ui.playerEffectsIntensity) { _, _ in syncAnalyzer() }
        .onChange(of: ui.playerAutoPerformance) { _, _ in syncAnalyzer() }
        .onChange(of: ui.playerStrobeEnabled) { _, _ in syncAnalyzer() }
        .onChange(of: thermal) { _, _ in syncAnalyzer() }
        .onChange(of: lowPower) { _, _ in syncAnalyzer() }
        .onChange(of: reduceMotion) { _, _ in syncAnalyzer() }
        .onReceive(NotificationCenter.default.publisher(for: ProcessInfo.thermalStateDidChangeNotification)) { _ in
            thermal = ProcessInfo.processInfo.thermalState
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        }
    }

    private func syncAnalyzer() {
        let p = policy
        engine.configureVisualAnalysis(enabled: p.enabled && app.isFullPlayerPresented, fps: p.analyzerFPS)
    }

    @ViewBuilder
    private var playerBody: some View {
        GeometryReader { geo in
            let layout = PlayerLayout(height: geo.size.height, width: geo.size.width)
            ZStack {
                PlayerGlassBackground(
                    isPlaying: engine.isPlaying,
                    preset: preset,
                    policy: policy,
                    audio: engine.audioFrame
                )

                if effectsActive, policy.allowStrobe {
                    SafeStrobeOverlay(
                        isPlaying: engine.isPlaying,
                        beat: engine.audioFrame.beat,
                        intensity: policy.intensityScale
                    )
                }

                if let track = engine.currentTrack {
                    VStack(spacing: 0) {
                        playerChrome(track: track, layout: layout)

                        Spacer(minLength: layout.topGap)

                        RotatingDiscArtwork(
                            artworkURL: track.artworkURL,
                            isPlaying: engine.isPlaying,
                            preset: preset,
                            policy: policy,
                            audio: engine.audioFrame,
                            canvasSize: layout.discSize
                        )

                        if effectsActive {
                            CompactIslandVisualizer(
                                isPlaying: engine.isPlaying,
                                isStrong: preset.isStrong,
                                intensity: policy.intensityScale,
                                audio: engine.audioFrame,
                                compact: layout.tight,
                                timelineFPS: policy.timelineFPS
                            )
                            .padding(.top, layout.afterDiscGap)

                            if preset.showsMixer, !layout.tight {
                                FrequencyMixerView(
                                    audio: engine.audioFrame,
                                    intensity: policy.intensityScale,
                                    isPlaying: engine.isPlaying,
                                    accentPulse: preset == .pulse || preset == .aurora
                                )
                                .padding(.top, 10)
                                .padding(.horizontal, 4)
                                .transition(.opacity.combined(with: .move(edge: .bottom)))
                            }
                        }

                        trackMeta(track: track, layout: layout)
                            .padding(.top, layout.metaGap)

                        if engine.isLoading {
                            ProgressView("Łączę stream…")
                                .controlSize(.small)
                                .padding(.top, 6)
                                .foregroundStyle(EOSTheme.textSecondary)
                        }

                        if let error = engine.errorMessage {
                            Text(error)
                                .font(.caption2)
                                .foregroundStyle(EOSTheme.accent)
                                .multilineTextAlignment(.center)
                                .lineLimit(2)
                                .padding(.horizontal, 20)
                                .padding(.top, 4)
                        }

                        if let reason = policy.restrictionReason, effectsActive || preset != .off {
                            Text(reason)
                                .font(.caption2)
                                .foregroundStyle(EOSTheme.textMuted)
                                .multilineTextAlignment(.center)
                                .padding(.top, 4)
                        }

                        Spacer(minLength: layout.bottomGap)

                        playbackSlider(layout: layout)
                        transportControls(layout: layout)

                        if engine.repeatMode != .off {
                            Text("Powtórzenie: \(engine.repeatMode.label)")
                                .font(.caption2)
                                .foregroundStyle(EOSTheme.textMuted)
                                .padding(.top, 2)
                                .padding(.bottom, layout.safeBottom)
                        } else {
                            Color.clear.frame(height: layout.safeBottom)
                        }
                    }
                    .padding(.horizontal, layout.horizontalPadding)
                    .frame(maxWidth: layout.maxContentWidth)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        }
        .sheet(isPresented: $showAddToPlaylist) {
            if let track = engine.currentTrack {
                AddToPlaylistSheet(track: track.payload, trackTitle: track.title)
                    .environmentObject(app)
            }
        }
        .sheet(isPresented: $showEffectsSheet) {
            PlayerEffectsSheet()
                .environmentObject(ui)
        }
    }

    private func playerChrome(track: MusicPlaybackTrack, layout: PlayerLayout) -> some View {
        HStack(spacing: 4) {
            Button {
                app.minimizePlayer()
            } label: {
                Image(systemName: "chevron.down")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(EOSTheme.textSecondary)
                    .frame(width: 40, height: 40)
                    .background(.ultraThinMaterial, in: Circle())
            }
            Spacer()
            Text(engine.queuePositionLabel)
                .font(.caption.weight(.semibold))
                .foregroundStyle(EOSTheme.textMuted)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(.ultraThinMaterial, in: Capsule())
            Spacer()
            Button {
                showEffectsSheet = true
            } label: {
                Image(systemName: "slider.horizontal.3")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(effectsActive ? EOSTheme.accent : EOSTheme.textSecondary)
                    .frame(width: 40, height: 40)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .accessibilityLabel("Efekty playera")
            FavoriteButton(item: track.favoriteItem, size: 18)
                .frame(width: 40, height: 40)
                .background(.ultraThinMaterial, in: Circle())
            Button {
                showAddToPlaylist = true
            } label: {
                Image(systemName: "text.badge.plus")
                    .font(.body)
                    .foregroundStyle(EOSTheme.textSecondary)
                    .frame(width: 40, height: 40)
                    .background(.ultraThinMaterial, in: Circle())
            }
            if !track.isExternal {
                DownloadCloudButton(
                    state: app.playbackCloudState(for: track),
                    size: 20,
                    onDownload: { app.downloadCurrentPlayback() },
                    onCancel: { app.cancelDownload(for: track.url) },
                    onRemoveOffline: { app.removeOfflineDownload(for: track.url) }
                )
                .frame(width: 40, height: 40)
                .background(.ultraThinMaterial, in: Circle())
            }
        }
        .padding(.top, layout.chromeTop)
    }

    private func trackMeta(track: MusicPlaybackTrack, layout: PlayerLayout) -> some View {
        VStack(spacing: layout.tight ? 3 : 5) {
            Text(track.title)
                .font(layout.tight ? .title3.weight(.bold) : .title2.weight(.bold))
                .foregroundStyle(EOSTheme.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            if let artist = track.artist, !artist.isEmpty {
                Button {
                    Task { await openArtist(for: track) }
                } label: {
                    Text(artist)
                        .font(layout.tight ? .body : .title3)
                        .foregroundStyle(EOSTheme.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.9)
                }
                .buttonStyle(.plain)
            }
            if let album = track.album, !album.isEmpty {
                Button {
                    openAlbum(for: track)
                } label: {
                    Text(album)
                        .font(.footnote)
                        .foregroundStyle(EOSTheme.textMuted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.9)
                }
                .buttonStyle(.plain)
                .disabled(track.albumId?.isEmpty != false)
                .opacity(track.albumId?.isEmpty == false ? 1 : 0.55)
            }

            if track.isExternal {
                HStack(spacing: 6) {
                    Image(systemName: "iphone")
                        .font(.caption.weight(.semibold))
                    Text(track.playbackFileURL != nil ? "Plik lokalny" : "Źródło zewnętrzne")
                        .font(.caption.weight(.semibold))
                }
                .foregroundStyle(.green)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(Color.green.opacity(0.12), in: Capsule())
                .padding(.top, layout.tight ? 6 : 8)
            } else {
                PlayerStorageStatusBar(
                    state: app.playbackCloudState(for: track),
                    onServerHint: app.isOnServer(track.url) || track.isOnServer,
                    onDownload: { app.downloadCurrentPlayback() },
                    onCancel: { app.cancelDownload(for: track.url) },
                    onRemoveOffline: { app.removeOfflineDownload(for: track.url) }
                )
                .padding(.top, layout.tight ? 6 : 8)
                .padding(.horizontal, 4)
            }
        }
        .padding(.horizontal, 8)
    }

    private func playbackSlider(layout: PlayerLayout) -> some View {
        VStack(spacing: 6) {
            Slider(
                value: Binding(
                    get: { engine.currentTime },
                    set: { engine.seek(to: $0) }
                ),
                in: 0...max(engine.duration, 1)
            )
            .tint(EOSTheme.accent)
            HStack {
                Text(formatDuration(engine.currentTime))
                Spacer()
                Text(formatDuration(engine.duration))
            }
            .font(.caption2.monospacedDigit())
            .foregroundStyle(EOSTheme.textMuted)
        }
        .padding(.horizontal, 4)
        .padding(.bottom, layout.tight ? 6 : 10)
    }

    private func transportControls(layout: PlayerLayout) -> some View {
        HStack(spacing: layout.tight ? 22 : 28) {
            Button { engine.toggleShuffle() } label: {
                Image(systemName: "shuffle")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(engine.shuffleEnabled ? EOSTheme.accent : EOSTheme.textMuted)
            }
            Button { Task { await engine.skipPrevious() } } label: {
                Image(systemName: "backward.fill")
                    .font(.title3)
            }
            Button { engine.togglePlayPause() } label: {
                Image(systemName: engine.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: layout.playButtonSize))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(EOSTheme.textPrimary)
                    .shadow(color: EOSTheme.accent.opacity(0.18), radius: 12, y: 4)
            }
            Button { Task { await engine.skipNext() } } label: {
                Image(systemName: "forward.fill")
                    .font(.title3)
            }
            Button { engine.cycleRepeatMode() } label: {
                Image(systemName: engine.repeatMode.icon)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(engine.repeatMode != .off ? EOSTheme.accent : EOSTheme.textMuted)
            }
        }
        .foregroundStyle(EOSTheme.textPrimary)
        .padding(.vertical, layout.tight ? 4 : 8)
    }

    private func openAlbum(for track: MusicPlaybackTrack) {
        guard let albumId = track.albumId, !albumId.isEmpty else {
            browseError = "Brak powiązanego albumu w katalogu Apple Music."
            return
        }
        albumRoute = MusicAlbumRoute(albumId: albumId)
    }

    private func openArtist(for track: MusicPlaybackTrack) async {
        if let artistId = track.artistId, !artistId.isEmpty {
            artistRoute = MusicArtistRoute(
                artistId: artistId,
                artistName: track.artist ?? "Wykonawca"
            )
            return
        }
        guard let name = track.artist, !name.isEmpty else { return }
        do {
            let results = try await app.api.searchMusicCatalog(query: name)
            if let artist = results.artists.first(where: { $0.name.localizedCaseInsensitiveCompare(name) == .orderedSame })
                ?? results.artists.first {
                artistRoute = MusicArtistRoute(artistId: artist.id, artistName: artist.name)
            } else {
                browseError = "Nie znaleziono wykonawcy w Apple Music."
            }
        } catch {
            browseError = error.localizedDescription
        }
    }
}

private struct PlayerLayout {
    let height: CGFloat
    let width: CGFloat

    var tight: Bool { height < 680 }
    var compact: Bool { height < 760 }

    var discSize: CGFloat {
        if height < 620 { return 176 }
        if height < 700 { return 210 }
        if height < 780 { return 248 }
        return 286
    }

    var playButtonSize: CGFloat { tight ? 56 : (compact ? 62 : 68) }
    var topGap: CGFloat { tight ? 4 : (compact ? 8 : 14) }
    var afterDiscGap: CGFloat { tight ? 8 : 12 }
    var metaGap: CGFloat { tight ? 8 : 12 }
    var bottomGap: CGFloat { tight ? 6 : 12 }
    var chromeTop: CGFloat { tight ? 4 : 8 }
    var safeBottom: CGFloat { tight ? 6 : 10 }
    var horizontalPadding: CGFloat { width > 700 ? 28 : 16 }
    var maxContentWidth: CGFloat { 560 }
}

private struct PlayerGlassBackground: View {
    let isPlaying: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    let audio: MusicPlaybackEngine.AudioReactiveFrame

    var body: some View {
        let intensity = policy.intensityScale
        let drive = audio.visualDrive(isStrong: preset.isStrong, intensity: intensity)
        let beat = audio.beat * intensity

        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea()

            LinearGradient(
                colors: [
                    Color.white.opacity(0.14),
                    .clear,
                    EOSTheme.accent.opacity(0.06)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            if policy.enabled {
                switch preset {
                case .vinyl:
                    RadialGradient(
                        colors: [
                            EOSTheme.accentSecondary.opacity(isPlaying ? 0.12 * intensity : 0.06),
                            .clear
                        ],
                        center: .top,
                        startRadius: 20,
                        endRadius: 420
                    )
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                case .spectrum, .pulse:
                    SoftPlayerBackdrop(isPlaying: isPlaying, audio: audio, intensity: intensity, aurora: false)
                case .aurora:
                    SoftPlayerBackdrop(isPlaying: isPlaying, audio: audio, intensity: intensity, aurora: true)
                    AuroraWaves(isPlaying: isPlaying, drive: drive, beat: beat, fps: policy.timelineFPS)
                case .off:
                    EmptyView()
                }
            }
        }
    }
}

private struct AuroraWaves: View {
    let isPlaying: Bool
    let drive: Double
    let beat: Double
    let fps: Double

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / max(8, fps), paused: !isPlaying || fps < 1)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            Canvas { gc, size in
                for i in 0..<3 {
                    let phase = t * (0.35 + Double(i) * 0.12) + Double(i)
                    let y = size.height * (0.25 + 0.2 * CGFloat(i)) + CGFloat(sin(phase)) * 24
                    var path = Path()
                    path.move(to: CGPoint(x: 0, y: y))
                    for x in stride(from: 0, through: size.width, by: 12) {
                        let wave = sin(Double(x) * 0.012 + phase) * (18 + drive * 22 + beat * 10)
                        path.addLine(to: CGPoint(x: x, y: y + CGFloat(wave)))
                    }
                    let color = i % 2 == 0 ? EOSTheme.accent : EOSTheme.accentSecondary
                    gc.stroke(
                        path,
                        with: .color(color.opacity(0.12 + drive * 0.18)),
                        style: StrokeStyle(lineWidth: 3, lineCap: .round)
                    )
                }
            }
            .ignoresSafeArea()
        }
        .allowsHitTesting(false)
        .blendMode(.plusLighter)
    }
}

private struct RotatingDiscArtwork: View {
    let artworkURL: URL?
    let isPlaying: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    let audio: MusicPlaybackEngine.AudioReactiveFrame
    var canvasSize: CGFloat = 286

    var body: some View {
        let enabled = policy.enabled && preset != .off
        let strong = preset.isStrong
        let intensity = policy.intensityScale
        let drive = audio.visualDrive(isStrong: strong, intensity: intensity)
        let beat = min(1, (audio.beat * 1.35 + drive * 0.25) * intensity)
        let scale = canvasSize / 320
        let fps = max(1, policy.timelineFPS)

        if !enabled {
            ArtworkImage(url: artworkURL, size: canvasSize * 0.82, cornerRadius: 18)
                .shadow(color: EOSTheme.accent.opacity(0.12), radius: 16, y: 8)
        } else {
            ZStack {
                MusicReactiveHalo(
                    isPlaying: isPlaying,
                    isStrong: strong,
                    drive: drive,
                    beat: beat,
                    bars: preset == .spectrum || preset == .pulse ? audio.spectrumBands : audio.islandBars,
                    fps: fps
                )

                DiscSpinner(
                    artworkURL: artworkURL,
                    isSpinning: isPlaying && fps >= 8,
                    secondsPerRevolution: strong ? 9 : 11,
                    fps: fps
                )
                .equatable()
                .scaleEffect(isPlaying ? 1 + CGFloat(beat) * (strong ? 0.045 : 0.03) : 1)
                .animation(.interpolatingSpring(stiffness: 240, damping: 18), value: beat)
                .shadow(
                    color: EOSTheme.accent.opacity(isPlaying ? (0.16 + drive * 0.25 + beat * 0.2) : 0.08),
                    radius: 16 + CGFloat(beat) * 14,
                    y: 10
                )
            }
            .frame(width: 320, height: 320)
            .scaleEffect(scale)
            .frame(width: canvasSize, height: canvasSize)
        }
    }
}

/// Spin wrapper isolated from audio props so artwork task is not cancelled every beat.
private struct DiscSpinner: View, Equatable {
    let artworkURL: URL?
    let isSpinning: Bool
    let secondsPerRevolution: Double
    var fps: Double = 30

    static func == (lhs: DiscSpinner, rhs: DiscSpinner) -> Bool {
        lhs.artworkURL == rhs.artworkURL
            && lhs.isSpinning == rhs.isSpinning
            && lhs.secondsPerRevolution == rhs.secondsPerRevolution
            && abs(lhs.fps - rhs.fps) < 0.5
    }

    var body: some View {
        ContinuousSpin(isSpinning: isSpinning, secondsPerRevolution: secondsPerRevolution, fps: fps) {
            VinylDisc(artworkURL: artworkURL)
        }
    }
}

private struct ContinuousSpin<Content: View>: View {
    let isSpinning: Bool
    let secondsPerRevolution: Double
    var fps: Double = 30
    @ViewBuilder let content: Content

    @State private var spinStartedAt: Date?
    @State private var frozenTurns: Double = 0

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / max(8, fps), paused: !isSpinning)) { context in
            let turns: Double = {
                if isSpinning, let start = spinStartedAt {
                    return frozenTurns + context.date.timeIntervalSince(start) / max(0.1, secondsPerRevolution)
                }
                return frozenTurns
            }()
            return content.rotationEffect(.degrees(turns * 360))
        }
        .onAppear {
            if isSpinning, spinStartedAt == nil {
                spinStartedAt = Date()
            }
        }
        .onChange(of: isSpinning) { _, spinning in
            if spinning {
                spinStartedAt = Date()
            } else if let start = spinStartedAt {
                frozenTurns += Date().timeIntervalSince(start) / max(0.1, secondsPerRevolution)
                spinStartedAt = nil
            }
        }
    }
}

private struct VinylDisc: View {
    let artworkURL: URL?

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color(red: 0.12, green: 0.12, blue: 0.14),
                            Color.black.opacity(0.92)
                        ],
                        center: UnitPoint(x: 0.38, y: 0.3),
                        startRadius: 8,
                        endRadius: 140
                    )
                )
                .frame(width: 272, height: 272)
                .overlay {
                    VinylGroovesOverlay()
                        .mask {
                            ZStack {
                                Circle().fill(.white)
                                Circle()
                                    .fill(.black)
                                    .frame(width: 222, height: 222)
                                    .blendMode(.destinationOut)
                            }
                            .compositingGroup()
                            .frame(width: 272, height: 272)
                        }
                }

            ArtworkImage(url: artworkURL, size: 236, cornerRadius: 118, circleClip: true)
                .overlay {
                    Circle()
                        .stroke(Color.white.opacity(0.12), lineWidth: 1)
                }
                .overlay { SpindleHub() }
                .shadow(color: .black.opacity(0.35), radius: 6, y: 2)
        }
    }
}

private struct SpindleHub: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color(red: 0.16, green: 0.16, blue: 0.18),
                            Color.black.opacity(0.95)
                        ],
                        center: .center,
                        startRadius: 1,
                        endRadius: 36
                    )
                )
                .frame(width: 34, height: 34)

            Circle()
                .stroke(Color.white.opacity(0.16), lineWidth: 1)
                .frame(width: 24, height: 24)

            Circle()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.82, green: 0.84, blue: 0.88),
                            Color(red: 0.46, green: 0.48, blue: 0.54)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 8, height: 8)
        }
    }
}

private struct VinylGroovesOverlay: View {
    var body: some View {
        Canvas { gc, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let maxR = min(size.width, size.height) * 0.5 - 2
            let minR: CGFloat = maxR - 26
            var r = minR
            while r < maxR {
                let progress = (r - minR) / max(1, (maxR - minR))
                let alpha = 0.05 + (1 - progress) * 0.1
                var path = Path()
                path.addArc(center: center, radius: r, startAngle: .degrees(0), endAngle: .degrees(360), clockwise: false)
                gc.stroke(path, with: .color(.white.opacity(alpha)), lineWidth: 0.7)
                r += 2.2
            }
        }
        .allowsHitTesting(false)
    }
}

/// Beat-first halo — always moves while playing; punches on kick.
private struct MusicReactiveHalo: View {
    let isPlaying: Bool
    let isStrong: Bool
    let drive: Double
    let beat: Double
    let bars: [Double]
    var fps: Double = 24

    private let vinylRadius: CGFloat = 136

    var body: some View {
        let barCount = isStrong ? 64 : 44
        let maxExt: CGFloat = isStrong ? 52 : 34

        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            EOSTheme.accent.opacity(isPlaying ? 0.16 + beat * 0.28 + drive * 0.12 : 0.04),
                            EOSTheme.accentSecondary.opacity(isPlaying ? 0.1 + drive * 0.14 : 0.02),
                            .clear
                        ],
                        center: .center,
                        startRadius: 40,
                        endRadius: 175
                    )
                )
                .frame(width: 330, height: 330)
                .scaleEffect(isPlaying ? 1 + CGFloat(beat) * 0.06 + CGFloat(drive) * 0.03 : 1)
                .animation(.easeOut(duration: 0.09), value: beat)

            TimelineView(.animation(minimumInterval: 1.0 / max(8, fps), paused: !isPlaying || fps < 1)) { context in
                let t = context.date.timeIntervalSinceReferenceDate
                Canvas { gc, size in
                    let center = CGPoint(x: size.width / 2, y: size.height / 2)
                    for index in 0..<barCount {
                        let amp = barAmplitude(index: index, count: barCount, time: t)
                        guard amp > 0.012 else { continue }
                        let angle = (Double(index) / Double(barCount)) * (.pi * 2) - .pi / 2
                        let length = 2 + CGFloat(amp) * maxExt
                        let inner = vinylRadius + 1
                        let outer = inner + length
                        let cosA = CGFloat(cos(angle))
                        let sinA = CGFloat(sin(angle))
                        var path = Path()
                        path.move(to: CGPoint(x: center.x + cosA * inner, y: center.y + sinA * inner))
                        path.addLine(to: CGPoint(x: center.x + cosA * outer, y: center.y + sinA * outer))
                        let color = index % 2 == 0 ? EOSTheme.accent : EOSTheme.accentSecondary
                        gc.stroke(
                            path,
                            with: .color(color.opacity(0.28 + amp * 0.7)),
                            style: StrokeStyle(lineWidth: isStrong ? 2.4 : 1.8, lineCap: .round)
                        )
                    }
                }
                .frame(width: 330, height: 330)
            }

            Circle()
                .stroke(EOSTheme.accent.opacity(isPlaying ? 0.22 + beat * 0.25 : 0.1), lineWidth: 1.3)
                .frame(width: vinylRadius * 2, height: vinylRadius * 2)
                .scaleEffect(isPlaying ? 1 + CGFloat(beat) * 0.02 : 1)
        }
        .allowsHitTesting(false)
    }

    private func barAmplitude(index: Int, count: Int, time: TimeInterval) -> Double {
        guard isPlaying else { return 0 }
        let position = Double(index) / Double(count) * Double(max(bars.count, 1))
        let left = Int(position) % max(bars.count, 1)
        let right = (left + 1) % max(bars.count, 1)
        let blend = position - floor(position)
        let sampled = bars.isEmpty
            ? (0.22 + drive * 0.55)
            : bars[left] * (1 - blend) + bars[right] * blend

        // Idle shimmer so the ring never looks frozen when the track is quiet.
        let shimmer = 0.12 + 0.08 * sin(time * 6.5 + Double(index) * 0.45)
        let punch = beat * (0.35 + (index % 2 == 0 ? 0.28 : 0.12))
        let energy = min(1, max(sampled, drive * 0.55, shimmer) * 0.75 + punch)
        return pow(energy, isStrong ? 1.05 : 1.15)
    }
}

private struct CompactIslandVisualizer: View {
    @Environment(\.colorScheme) private var colorScheme
    let isPlaying: Bool
    let isStrong: Bool
    var intensity: Double = 1
    let audio: MusicPlaybackEngine.AudioReactiveFrame
    var compact: Bool = false
    var timelineFPS: Double = 24

    private let barCount = MusicPlaybackEngine.AudioReactiveFrame.islandBarCount

    var body: some View {
        let drive = audio.visualDrive(isStrong: isStrong, intensity: intensity)
        let beat = min(1, audio.beat * 1.4 * intensity)
        let pillFill = colorScheme == .light
            ? Color.black.opacity(0.9)
            : Color.black.opacity(0.78)
        let barColor = Color.white.opacity(0.95)
        let _ = timelineFPS // reserved for future TimelineView pacing

        HStack(spacing: compact ? 10 : 14) {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            EOSTheme.accent.opacity(isPlaying ? 0.6 + beat * 0.4 : 0.15),
                            EOSTheme.accent.opacity(0.05)
                        ],
                        center: .center,
                        startRadius: 1,
                        endRadius: 18
                    )
                )
                .frame(
                    width: 11 + CGFloat(drive + beat) * (isStrong ? 18 : 12),
                    height: 11 + CGFloat(drive + beat) * (isStrong ? 18 : 12)
                )
                .animation(.easeOut(duration: 0.08), value: beat)

            ZStack {
                Capsule(style: .continuous)
                    .fill(pillFill)
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 0.7)
                    )
                    .shadow(color: EOSTheme.accent.opacity(isPlaying ? 0.15 + beat * 0.25 : 0), radius: 8, y: 2)

                HStack(alignment: .center, spacing: 3.4) {
                    ForEach(0..<barCount, id: \.self) { index in
                        RoundedRectangle(cornerRadius: 1.4, style: .continuous)
                            .fill(barColor)
                            .frame(width: 2.8, height: barHeight(index: index, beat: beat))
                    }
                }
                .padding(.horizontal, 15)
            }
            .frame(width: 124, height: 38)
            .opacity(isPlaying ? 1 : 0.45)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            EOSTheme.accentSecondary.opacity(isPlaying ? 0.6 + beat * 0.4 : 0.15),
                            EOSTheme.accentSecondary.opacity(0.05)
                        ],
                        center: .center,
                        startRadius: 1,
                        endRadius: 18
                    )
                )
                .frame(
                    width: 11 + CGFloat(drive + beat) * (isStrong ? 18 : 12),
                    height: 11 + CGFloat(drive + beat) * (isStrong ? 18 : 12)
                )
                .animation(.easeOut(duration: 0.08), value: beat)
        }
        .frame(height: compact ? 40 : 48)
        .animation(nil, value: audio.islandBars)
    }

    private func barHeight(index: Int, beat: Double) -> CGFloat {
        let minH: CGFloat = 3
        let maxH: CGFloat = compact ? (isStrong ? 16 : 13) : (isStrong ? 20 : 16)
        let level = audio.islandBar(at: index)
        guard isPlaying else { return minH }
        let punch = index == 2 ? beat * 0.45 : beat * 0.18
        let idle = 0.08 + Double(index % 3) * 0.03
        return minH + CGFloat(min(1, max(level, idle) + punch)) * (maxH - minH)
    }
}

private struct SoftPlayerBackdrop: View {
    let isPlaying: Bool
    let audio: MusicPlaybackEngine.AudioReactiveFrame
    var intensity: Double = 1
    var aurora: Bool = false

    var body: some View {
        let drive = audio.visualDrive(isStrong: true, intensity: intensity)
        let beat = audio.beat * intensity
        ZStack {
            RadialGradient(
                colors: [
                    (aurora ? EOSTheme.accentSecondary : EOSTheme.accentSecondary)
                        .opacity(isPlaying ? 0.1 + drive * 0.1 + beat * 0.04 : 0.04),
                    .clear
                ],
                center: .top,
                startRadius: 20,
                endRadius: 380
            )
            RadialGradient(
                colors: [
                    EOSTheme.accent.opacity(isPlaying ? 0.07 + drive * 0.08 + beat * 0.03 : 0.03),
                    .clear
                ],
                center: aurora ? .bottomLeading : .bottomTrailing,
                startRadius: 10,
                endRadius: 340
            )
            if aurora {
                RadialGradient(
                    colors: [
                        Color.cyan.opacity(isPlaying ? 0.05 + drive * 0.06 : 0.02),
                        .clear
                    ],
                    center: .trailing,
                    startRadius: 8,
                    endRadius: 300
                )
            }
        }
        .ignoresSafeArea()
        .animation(.easeOut(duration: 0.18), value: drive)
        .allowsHitTesting(false)
    }
}

/// Compact spectrum mixer — Bass / Mid / Treble meters + 16-band EQ strip.
private struct FrequencyMixerView: View {
    let audio: MusicPlaybackEngine.AudioReactiveFrame
    let intensity: Double
    let isPlaying: Bool
    var accentPulse: Bool = false

    private let bandCount = MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCount

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                meter(title: "BASS", value: audio.bass * intensity, color: EOSTheme.accent)
                meter(title: "MID", value: audio.mid * intensity, color: EOSTheme.accentSecondary)
                meter(title: "TREBLE", value: audio.treble * intensity, color: Color.cyan)
            }

            Canvas { gc, size in
                let spacing: CGFloat = 3
                let width = max(2, (size.width - spacing * CGFloat(bandCount - 1)) / CGFloat(bandCount))
                for index in 0..<bandCount {
                    let level = min(1, audio.spectrumBand(at: index) * (0.85 + intensity * 0.35))
                    let peak = min(1, audio.peak(at: index) * (0.85 + intensity * 0.35))
                    let x = CGFloat(index) * (width + spacing)
                    let barH = max(2, CGFloat(level) * size.height * (isPlaying ? 1 : 0.25))
                    let rect = CGRect(x: x, y: size.height - barH, width: width, height: barH)
                    let color = index < 5
                        ? EOSTheme.accent
                        : (index < 11 ? EOSTheme.accentSecondary : Color.cyan)
                    gc.fill(Path(roundedRect: rect, cornerRadius: 2), with: .color(color.opacity(0.55 + level * 0.4)))

                    let peakY = size.height - max(2, CGFloat(peak) * size.height) - 1
                    let peakRect = CGRect(x: x, y: peakY, width: width, height: 2)
                    gc.fill(Path(roundedRect: peakRect, cornerRadius: 1), with: .color(.white.opacity(0.75)))
                }
            }
            .frame(height: 44)
            .padding(.horizontal, 4)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.black.opacity(0.28))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 0.6)
                    )
            )
            .shadow(
                color: accentPulse
                    ? EOSTheme.accent.opacity(isPlaying ? 0.18 + audio.beat * 0.2 * intensity : 0)
                    : .clear,
                radius: 10,
                y: 2
            )
            .animation(nil, value: audio.spectrumBands)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Mikser częstotliwości")
        .accessibilityValue(
            "Bass \(Int(audio.bass * 100)), Mid \(Int(audio.mid * 100)), Treble \(Int(audio.treble * 100))"
        )
    }

    private func meter(title: String, value: Double, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.1))
                    Capsule()
                        .fill(color.opacity(0.85))
                        .frame(width: max(4, geo.size.width * CGFloat(min(1, value))))
                }
            }
            .frame(height: 5)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Photosensitive-safe accent flash — max ~3 Hz, no full-screen white.
private struct SafeStrobeOverlay: View {
    let isPlaying: Bool
    let beat: Double
    let intensity: Double

    @State private var flash: Double = 0
    @State private var lastFlashAt: TimeInterval = 0

    private let minInterval: TimeInterval = 1.0 / 3.0

    var body: some View {
        RadialGradient(
            colors: [
                EOSTheme.accent.opacity(flash * 0.22 * intensity),
                EOSTheme.accentSecondary.opacity(flash * 0.1 * intensity),
                .clear
            ],
            center: .center,
            startRadius: 10,
            endRadius: 380
        )
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .blendMode(.plusLighter)
        .onChange(of: beat) { _, newBeat in
            guard isPlaying, newBeat > 0.62 else { return }
            let now = CACurrentMediaTime()
            guard now - lastFlashAt >= minInterval else { return }
            lastFlashAt = now
            withAnimation(.easeOut(duration: 0.05)) { flash = min(1, newBeat) }
            withAnimation(.easeOut(duration: 0.22).delay(0.05)) { flash = 0 }
        }
        .onChange(of: isPlaying) { _, playing in
            if !playing { flash = 0 }
        }
    }
}

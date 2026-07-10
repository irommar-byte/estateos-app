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
    @State private var showAddToPlaylist = false
    @State private var artistRoute: MusicArtistRoute?
    @State private var albumRoute: MusicAlbumRoute?
    @State private var browseError: String?

    private var effectsMode: PlayerEffectsMode {
        ui.playerEffectsMode
    }

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
    }

    @ViewBuilder
    private var playerBody: some View {
        ZStack {
            EOSAmbientBackground()
            if engine.currentTrack != nil, effectsMode != .off {
                DynamicPlayerBackdrop(
                    isPlaying: engine.isPlaying,
                    isStrong: effectsMode == .strong,
                    audio: engine.audioFrame
                )
                    .allowsHitTesting(false)
            }

            if let track = engine.currentTrack {
                VStack(spacing: 0) {
                    HStack {
                        Button {
                            app.minimizePlayer()
                        } label: {
                            Image(systemName: "chevron.down")
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(EOSTheme.textSecondary)
                                .frame(width: 44, height: 44)
                        }
                        Spacer()
                        Text(engine.queuePositionLabel)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(EOSTheme.textMuted)
                        Spacer()
                        FavoriteButton(item: track.favoriteItem, size: 20)
                            .frame(width: 44, height: 44)
                        Button {
                            showAddToPlaylist = true
                        } label: {
                            Image(systemName: "text.badge.plus")
                                .font(.title3)
                                .foregroundStyle(EOSTheme.textSecondary)
                                .frame(width: 44, height: 44)
                        }
                        if let folderId = engine.folderId,
                           let libraryTrack = app.trackForCurrentPlayback() {
                            DownloadCloudButton(
                                state: app.downloads.uiState(
                                    for: track.url,
                                    isDownloaded: app.isOfflineAvailable(track.url)
                                ),
                                size: 24,
                                onDownload: { app.downloadTrack(libraryTrack, folderId: folderId) },
                                onCancel: { app.cancelDownload(for: track.url) },
                                onRemoveOffline: { app.removeOfflineDownload(for: track.url) }
                            )
                            .frame(width: 44, height: 44)
                        } else {
                            Color.clear.frame(width: 44, height: 44)
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.top, 8)

                    Spacer(minLength: 12)

                    RotatingDiscArtwork(
                        artworkURL: track.artworkURL,
                        isPlaying: engine.isPlaying,
                        mode: effectsMode,
                        audio: engine.audioFrame
                    )
                    .padding(.bottom, 14)

                    if effectsMode != .off {
                        IslandMembraneVisualizer(
                            isPlaying: engine.isPlaying,
                            isStrong: effectsMode == .strong,
                            audio: engine.audioFrame
                        )
                            .padding(.horizontal, 24)
                            .padding(.bottom, 16)
                    }

                    VStack(spacing: 6) {
                        Text(track.title)
                            .font(.title2.weight(.bold))
                            .foregroundStyle(EOSTheme.textPrimary)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                        if let artist = track.artist, !artist.isEmpty {
                            Button {
                                Task { await openArtist(for: track) }
                            } label: {
                                Text(artist)
                                    .font(.title3)
                                    .foregroundStyle(EOSTheme.textSecondary)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.center)
                            }
                            .buttonStyle(.plain)
                        }
                        if let album = track.album, !album.isEmpty {
                            Button {
                                openAlbum(for: track)
                            } label: {
                                Text(album)
                                    .font(.subheadline)
                                    .foregroundStyle(EOSTheme.textMuted)
                                    .lineLimit(1)
                            }
                            .buttonStyle(.plain)
                            .disabled(track.albumId?.isEmpty != false)
                            .opacity(track.albumId?.isEmpty == false ? 1 : 0.55)
                        }
                    }
                    .padding(.horizontal, 24)

                    if engine.isLoading {
                        ProgressView("Przygotowuję stream…")
                            .padding(.top, 16)
                            .foregroundStyle(EOSTheme.textSecondary)
                    }

                    if let error = engine.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(EOSTheme.accent)
                            .padding(.top, 8)
                    }

                    Spacer(minLength: 20)

                    VStack(spacing: 8) {
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
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(EOSTheme.textMuted)
                    }
                    .padding(.horizontal, 24)

                    HStack(spacing: 28) {
                        Button { engine.toggleShuffle() } label: {
                            Image(systemName: "shuffle")
                                .foregroundStyle(engine.shuffleEnabled ? EOSTheme.accent : EOSTheme.textMuted)
                        }
                        Button { Task { await engine.skipPrevious() } } label: {
                            Image(systemName: "backward.fill")
                                .font(.title2)
                        }
                        Button { engine.togglePlayPause() } label: {
                            Image(systemName: engine.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                                .font(.system(size: 68))
                                .foregroundStyle(EOSTheme.textPrimary)
                        }
                        Button { Task { await engine.skipNext() } } label: {
                            Image(systemName: "forward.fill")
                                .font(.title2)
                        }
                        Button { engine.cycleRepeatMode() } label: {
                            Image(systemName: engine.repeatMode.icon)
                                .foregroundStyle(engine.repeatMode != .off ? EOSTheme.accent : EOSTheme.textMuted)
                        }
                    }
                    .foregroundStyle(EOSTheme.textPrimary)
                    .padding(.vertical, 24)

                    if engine.repeatMode != .off {
                        Text("Powtórzenie: \(engine.repeatMode.label)")
                            .font(.caption)
                            .foregroundStyle(EOSTheme.textMuted)
                            .padding(.bottom, 16)
                    }
                }
            }
        }
        .presentationDragIndicator(.visible)
        .presentationBackground(EOSTheme.background)
        .sheet(isPresented: $showAddToPlaylist) {
            if let track = engine.currentTrack {
                AddToPlaylistSheet(track: track.payload, trackTitle: track.title)
                    .environmentObject(app)
            }
        }
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

private struct RotatingDiscArtwork: View {
    let artworkURL: URL?
    let isPlaying: Bool
    let mode: PlayerEffectsMode
    let audio: MusicPlaybackEngine.AudioReactiveFrame

    var body: some View {
        let enabled = mode != .off
        let strong = mode == .strong
        if !enabled {
            ArtworkImage(url: artworkURL, size: 260, cornerRadius: 20)
                .shadow(color: EOSTheme.accent.opacity(0.12), radius: 16, y: 8)
        } else {
        ZStack {
            ButterflyHaloRing(
                isPlaying: isPlaying,
                isStrong: strong,
                audio: audio
            )

            TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: !isPlaying || !enabled)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let phase = t * 2 * .pi
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                EOSTheme.accentSecondary.opacity(enabled ? (strong ? 0.2 : 0.14) : 0),
                                EOSTheme.accent.opacity(enabled ? (strong ? 0.13 : 0.08) : 0),
                                .clear
                            ],
                            center: .center,
                            startRadius: 20,
                            endRadius: 210
                        )
                    )
                    .frame(width: 300, height: 300)

                Circle()
                    .stroke(EOSTheme.textMuted.opacity(0.25), lineWidth: 1.2)
                    .frame(width: 260, height: 260)

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.black.opacity(0.24),
                                Color.black.opacity(0.58),
                                Color.black.opacity(0.9)
                            ],
                            center: UnitPoint(x: 0.38, y: 0.3),
                            startRadius: 6,
                            endRadius: 140
                        )
                    )
                    .frame(width: 272, height: 272)
                    .overlay {
                        VinylGroovesOverlay()
                    }

                ArtworkImage(url: artworkURL, size: 238, cornerRadius: 119)
                    .overlay {
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
                                .frame(width: 36, height: 36)

                            Circle()
                                .stroke(Color.white.opacity(0.14), lineWidth: 1)
                                .frame(width: 26, height: 26)

                            Circle()
                                .stroke(Color.black.opacity(0.6), lineWidth: 1.2)
                                .frame(width: 16, height: 16)

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
                                .frame(width: 9, height: 9)
                                .shadow(color: .white.opacity(0.35), radius: 1, x: -0.4, y: -0.4)
                                .shadow(color: .black.opacity(0.45), radius: 1.4, x: 0.8, y: 0.8)
                        }
                    }
                    .rotationEffect(.degrees(isPlaying && enabled ? phase * (strong ? 20 : 14) : 0))
                    .shadow(color: EOSTheme.accent.opacity(enabled ? (strong ? 0.3 : 0.2) : 0.08), radius: 26, y: 16)
            }
            }
        }
        }
    }

private struct VinylGroovesOverlay: View {
    var body: some View {
        Canvas { gc, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let maxR = min(size.width, size.height) * 0.5 - 4
            let minR: CGFloat = 28
            var r = minR
            while r < maxR {
                let progress = (r - minR) / max(1, (maxR - minR))
                let alpha = 0.06 + (1 - progress) * 0.08
                var path = Path()
                path.addArc(center: center, radius: r, startAngle: .degrees(0), endAngle: .degrees(360), clockwise: false)
                gc.stroke(path, with: .color(.white.opacity(alpha)), lineWidth: 0.6)
                r += 2.4
            }

            // tiny etched ring around spindle area
            var innerRing = Path()
            innerRing.addArc(center: center, radius: 18, startAngle: .degrees(0), endAngle: .degrees(360), clockwise: false)
            gc.stroke(innerRing, with: .color(.white.opacity(0.16)), lineWidth: 0.8)
        }
        .blendMode(.screen)
        .mask(Circle().fill(.white))
    }
}
}

private struct ButterflyHaloRing: View {
    let isPlaying: Bool
    let isStrong: Bool
    let audio: MusicPlaybackEngine.AudioReactiveFrame

    private let barCount = 96
  /// Zewnętrzna krawędź winyla (272 pt średnicy) — nitki startują dokładnie stąd.
    private let vinylRadius: CGFloat = 136

    var body: some View {
        let baseOpacity: Double = isStrong ? 0.95 : 0.8
        let drive = audio.visualDrive(isStrong: isStrong)
        let maxExtension = isStrong ? 56.0 : 42.0

        ZStack {
            ForEach(0..<barCount, id: \.self) { index in
                let angle = (Double(index) / Double(barCount)) * (.pi * 2)
                let amplitude = ringAmplitude(index: index, drive: drive)
                RingPulseBar(
                    amplitude: amplitude,
                    maxExtension: maxExtension,
                    vinylRadius: vinylRadius,
                    angle: angle,
                    baseOpacity: baseOpacity,
                    isStrong: isStrong,
                    isPlaying: isPlaying
                )
            }

            Circle()
                .stroke(
                    EOSTheme.accentSecondary.opacity(isStrong ? 0.34 : 0.24),
                    lineWidth: isStrong ? 1.8 : 1.2
                )
                .frame(width: vinylRadius * 2, height: vinylRadius * 2)
                .blur(radius: 1.2)
        }
        .frame(width: 320, height: 320)
        .animation(nil, value: audio.islandBars)
        .animation(nil, value: audio.level)
        .allowsHitTesting(false)
    }

    private func ringAmplitude(index: Int, drive: Double) -> Double {
        guard isPlaying else { return 0 }
        let bars = audio.islandBars

        let position = Double(index) / Double(barCount) * Double(max(bars.count, 1))
        let left = Int(position) % max(bars.count, 1)
        let right = (left + 1) % max(bars.count, 1)
        let blend = position - floor(position)
        let level = bars.isEmpty ? drive : bars[left] * (1 - blend) + bars[right] * blend

        let wobble = sin(Double(index) * 0.73 + audio.beat * 7.2) * 0.06
        let punch = audio.beat * (0.18 + blend * 0.3)
        let energy = max(level, drive * 0.38) * 0.8 + punch * 0.22 + wobble
        guard energy > 0.008 else { return 0 }
        return pow(min(1, max(0, energy)), isStrong ? 1.45 : 1.55)
    }
}

/// Nitka wyrasta od zewnętrznej krawędzi winyla — długość płynnie reaguje na audio (cisza = krótka).
private struct RingPulseBar: View {
    let amplitude: Double
    let maxExtension: CGFloat
    let vinylRadius: CGFloat
    let angle: Double
    let baseOpacity: Double
    let isStrong: Bool
    let isPlaying: Bool

    @ViewBuilder
    var body: some View {
        let minLength: CGFloat = 1.2
        let length = minLength + CGFloat(amplitude) * maxExtension
        if isPlaying, amplitude > 0.006 {
            Capsule(style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            EOSTheme.accentSecondary.opacity(baseOpacity * (0.35 + amplitude * 0.65)),
                            EOSTheme.accent.opacity(baseOpacity * (0.22 + amplitude * 0.78))
                        ],
                        startPoint: .bottom,
                        endPoint: .top
                    )
                )
                .frame(width: 2.2, height: length)
                .shadow(color: EOSTheme.accent.opacity(amplitude * 0.32), radius: isStrong ? 4 : 2, y: 0)
                .offset(y: -(vinylRadius + length / 2))
                .rotationEffect(.radians(angle))
        }
    }
}

private struct IslandMembraneVisualizer: View {
    @Environment(\.colorScheme) private var colorScheme
    let isPlaying: Bool
    let isStrong: Bool
    let audio: MusicPlaybackEngine.AudioReactiveFrame

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: !isPlaying)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let drive = audio.visualDrive(isStrong: isStrong)

            HStack(alignment: .center, spacing: 0) {
                AudioMembraneView(
                    drive: drive,
                    beat: audio.beat,
                    isStrong: isStrong,
                    phase: t,
                    mirror: false
                )
                .frame(maxWidth: .infinity, alignment: .trailing)

                IslandWaveformAnalyzer(
                    audio: audio,
                    isStrong: isStrong
                )
                .padding(.horizontal, 10)

                AudioMembraneView(
                    drive: drive,
                    beat: audio.beat,
                    isStrong: isStrong,
                    phase: t,
                    mirror: true
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(height: isStrong ? 92 : 80)
        .opacity(isPlaying ? 0.98 : 0.35)
    }
}

/// Kompaktowy analizator jak w Dynamic Island (pigułka + 5 pasków, ten sam driver co wyspa).
private struct IslandWaveformAnalyzer: View {
    @Environment(\.colorScheme) private var colorScheme
    let audio: MusicPlaybackEngine.AudioReactiveFrame
    let isStrong: Bool

    private let barCount = MusicPlaybackEngine.AudioReactiveFrame.islandBarCount

    var body: some View {
        let drive = audio.visualDrive(isStrong: isStrong)
        let pillFill = colorScheme == .light
            ? Color.black.opacity(0.9)
            : Color.black.opacity(0.78)
        let barColor = colorScheme == .light
            ? Color.white.opacity(0.96)
            : Color.white.opacity(0.94)

        ZStack {
            Capsule(style: .continuous)
                .fill(pillFill)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(Color.white.opacity(colorScheme == .light ? 0.1 : 0.07), lineWidth: 0.7)
                )
                .shadow(color: EOSTheme.accent.opacity(drive > 0.02 ? 0.18 : 0), radius: 8, y: 2)

            HStack(alignment: .center, spacing: 3.4) {
                ForEach(0..<barCount, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 1.4, style: .continuous)
                        .fill(barColor)
                        .frame(width: 2.8, height: barHeight(index: index))
                }
            }
            .padding(.horizontal, 15)
        }
        .frame(width: 120, height: 37)
        .animation(nil, value: audio.islandBars)
    }

    private func barHeight(index: Int) -> CGFloat {
        let minH: CGFloat = 3
        let maxH: CGFloat = isStrong ? 18 : 16
        let level = audio.islandBar(at: index)
        guard level > 0.01 else { return minH }
        return minH + CGFloat(level) * (maxH - minH)
    }
}

/// Samo membrany — płynna skala od malutkiej do dużej zależnie od natężenia.
private struct AudioMembraneView: View {
    @Environment(\.colorScheme) private var colorScheme
    let drive: Double
    let beat: Double
    let isStrong: Bool
    let phase: TimeInterval
    let mirror: Bool

    var body: some View {
        let scale = membraneScale(drive: drive)
        let diameter = 26 + scale * (isStrong ? 52 : 44)
        let conePulse = 0.42 + scale * 0.58 + beat * 0.12
        let accent = colorScheme == .light
            ? Color(red: 0.92, green: 0.2, blue: 0.45)
            : EOSTheme.accent
        let rim = colorScheme == .light
            ? Color(red: 0.22, green: 0.22, blue: 0.26)
            : Color(red: 0.14, green: 0.14, blue: 0.17)

        ZStack {
            if drive > 0.02 {
                Circle()
                    .fill(accent.opacity(0.1 + Double(scale) * 0.22))
                    .frame(width: diameter + 18, height: diameter + 18)
                    .blur(radius: 8)
            }

            Circle()
                .fill(
                    RadialGradient(
                        colors: [rim.opacity(0.95), Color.black.opacity(0.92)],
                        center: .center,
                        startRadius: 2,
                        endRadius: diameter * 0.52
                    )
                )
                .frame(width: diameter, height: diameter)
                .overlay(
                    Circle()
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )

            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.white.opacity(0.28 + Double(scale) * 0.2),
                            Color.black.opacity(0.82)
                        ],
                        center: UnitPoint(x: 0.4, y: 0.35),
                        startRadius: 1,
                        endRadius: diameter * 0.22
                    )
                )
                .frame(width: diameter * 0.48, height: diameter * 0.48)
                .scaleEffect(conePulse)

            Circle()
                .stroke(accent.opacity(0.35 + Double(scale) * 0.45), lineWidth: 1.2)
                .frame(width: diameter * 0.72, height: diameter * 0.72)
        }
        .scaleEffect(x: mirror ? 1 : 1, y: 1)
        .offset(x: mirror ? sin(phase * 8) * CGFloat(drive) * 1.2 : -sin(phase * 8) * CGFloat(drive) * 1.2)
        .animation(.smooth(duration: 0.14), value: scale)
    }

    /// Płynne „stopnie” głośności: cicho → mała, głośniej → coraz większa.
    private func membraneScale(drive: Double) -> CGFloat {
        guard drive > 0.012 else { return 0 }
        let x = min(1, drive)
        let tiers: [CGFloat] = [0.22, 0.42, 0.64, 0.86, 1.0]
        let pos = x * CGFloat(tiers.count - 1)
        let i = min(tiers.count - 2, max(0, Int(pos)))
        let frac = pos - CGFloat(i)
        return tiers[i] + (tiers[i + 1] - tiers[i]) * frac
    }
}

private struct DynamicPlayerBackdrop: View {
    let isPlaying: Bool
    let isStrong: Bool
    let audio: MusicPlaybackEngine.AudioReactiveFrame

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0, paused: !isPlaying || !isStrong)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let drive = audio.visualDrive(isStrong: isStrong)
            let spots = audio.spotIntensity(isStrong: isStrong)
            let disco = drive > 0.02 ? (sin(t * 15.0) * 0.5 + 0.5) : 0
            ZStack {
                LinearGradient(
                    colors: [
                        EOSTheme.accentSecondary.opacity(0.06),
                        .clear,
                        EOSTheme.accent.opacity(0.06)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Rectangle()
                    .fill(.white.opacity(isStrong && isPlaying && drive > 0.02 ? ((0.012 + drive * 0.045 + disco * 0.02) * drive) : 0))
                    .blendMode(.screen)

                Rectangle()
                    .fill(EOSTheme.accent.opacity(isStrong && isPlaying && drive > 0.02 ? (0.008 + drive * 0.032) * drive : 0))
                    .blendMode(.softLight)

                if isStrong && isPlaying && spots > 0.02 {
                    CrossingSpotlights(phase: t, intensity: spots)
                }
            }
            .ignoresSafeArea()
        }
    }
}

private struct CrossingSpotlights: View {
    let phase: TimeInterval
    let intensity: Double

    var body: some View {
        ZStack {
            spotlight(angle: -36 + sin(phase * 2.2) * 8, opacity: 0.09 * intensity, offsetX: -80)
            spotlight(angle: 36 + sin(phase * 2.0 + .pi / 2) * 8, opacity: 0.09 * intensity, offsetX: 80)
            spotlight(angle: -18 + sin(phase * 2.8 + .pi / 4) * 7, opacity: 0.07 * intensity, offsetX: -150)
            spotlight(angle: 18 + sin(phase * 2.6 + .pi * 0.75) * 7, opacity: 0.07 * intensity, offsetX: 150)
        }
        .blendMode(.screen)
    }

    private func spotlight(angle: Double, opacity: Double, offsetX: CGFloat) -> some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [.white.opacity(opacity), .clear],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .frame(width: 150, height: 520)
            .blur(radius: 6)
            .rotationEffect(.degrees(angle))
            .offset(x: offsetX, y: -18)
    }
}

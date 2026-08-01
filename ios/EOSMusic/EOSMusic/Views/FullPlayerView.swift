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
            if engine.currentTrack != nil, effectsMode == .strong {
                SoftPlayerBackdrop(
                    isPlaying: engine.isPlaying,
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
                    .padding(.bottom, 18)

                    if effectsMode != .off {
                        CompactIslandVisualizer(
                            isPlaying: engine.isPlaying,
                            isStrong: effectsMode == .strong,
                            audio: engine.audioFrame
                        )
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
                        ProgressView("Łączę stream…")
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
        let drive = audio.visualDrive(isStrong: strong)
        let beat = min(1, audio.beat * 1.35 + drive * 0.25)

        if !enabled {
            ArtworkImage(url: artworkURL, size: 260, cornerRadius: 20)
                .shadow(color: EOSTheme.accent.opacity(0.12), radius: 16, y: 8)
        } else {
            ZStack {
                MusicReactiveHalo(
                    isPlaying: isPlaying,
                    isStrong: strong,
                    drive: drive,
                    beat: beat,
                    bars: audio.islandBars
                )

                // Stable identity: spin period does not depend on audioFrame (keeps cover loaded).
                DiscSpinner(
                    artworkURL: artworkURL,
                    isSpinning: isPlaying,
                    secondsPerRevolution: strong ? 9 : 11
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
        }
    }
}

/// Spin wrapper isolated from audio props so artwork task is not cancelled every beat.
private struct DiscSpinner: View, Equatable {
    let artworkURL: URL?
    let isSpinning: Bool
    let secondsPerRevolution: Double

    static func == (lhs: DiscSpinner, rhs: DiscSpinner) -> Bool {
        lhs.artworkURL == rhs.artworkURL
            && lhs.isSpinning == rhs.isSpinning
            && lhs.secondsPerRevolution == rhs.secondsPerRevolution
    }

    var body: some View {
        ContinuousSpin(isSpinning: isSpinning, secondsPerRevolution: secondsPerRevolution) {
            VinylDisc(artworkURL: artworkURL)
        }
    }
}

private struct ContinuousSpin<Content: View>: View {
    let isSpinning: Bool
    let secondsPerRevolution: Double
    @ViewBuilder let content: Content

    @State private var spinStartedAt: Date?
    @State private var frozenTurns: Double = 0

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !isSpinning)) { context in
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

            TimelineView(.animation(minimumInterval: 1.0 / 24.0, paused: !isPlaying)) { context in
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
    let audio: MusicPlaybackEngine.AudioReactiveFrame

    private let barCount = MusicPlaybackEngine.AudioReactiveFrame.islandBarCount

    var body: some View {
        let drive = audio.visualDrive(isStrong: isStrong)
        let beat = min(1, audio.beat * 1.4)
        let pillFill = colorScheme == .light
            ? Color.black.opacity(0.9)
            : Color.black.opacity(0.78)
        let barColor = Color.white.opacity(0.95)

        HStack(spacing: 14) {
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
        .frame(height: 52)
        .animation(nil, value: audio.islandBars)
    }

    private func barHeight(index: Int, beat: Double) -> CGFloat {
        let minH: CGFloat = 3
        let maxH: CGFloat = isStrong ? 22 : 17
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

    var body: some View {
        let drive = audio.visualDrive(isStrong: true)
        let beat = audio.beat
        ZStack {
            RadialGradient(
                colors: [
                    EOSTheme.accentSecondary.opacity(isPlaying ? 0.1 + drive * 0.1 + beat * 0.04 : 0.04),
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
                center: .bottomTrailing,
                startRadius: 10,
                endRadius: 340
            )
        }
        .ignoresSafeArea()
        .animation(.easeOut(duration: 0.18), value: drive)
        .allowsHitTesting(false)
    }
}

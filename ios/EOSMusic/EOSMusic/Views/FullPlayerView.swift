import AVFoundation
import SwiftUI

struct FullPlayerView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let engine = app.playback.engine {
            PlayerContent(engine: engine)
                .environmentObject(app)
                .background {
                    EOSTheme.background.ignoresSafeArea()
                }
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
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.colorScheme) private var colorScheme
    @State private var showAddToPlaylist = false
    @State private var showEffectsSheet = false
    @State private var showQueueSheet = false
    @State private var artistRoute: MusicArtistRoute?
    @State private var albumRoute: MusicAlbumRoute?
    @State private var browseError: String?
    @State private var thermal = ProcessInfo.processInfo.thermalState
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled

    init(engine: MusicPlaybackEngine) {
        self.engine = engine
        engine.setSpectrumBandCount(MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard)
    }

    private var preset: PlayerVisualPreset { ui.playerVisualPreset }

    private var policy: PlayerVisualPolicy {
        let effectivePreset: PlayerVisualPreset = ui.playerMixerPowered ? preset : .off
        let mixIntensity = ui.playerEffectsIntensity * ui.playerSensitivity * (ui.playerMixerPowered ? 1 : 0.15)
        return PlayerVisualPolicy.resolve(
            preset: effectivePreset,
            intensity: mixIntensity,
            strobeEnabled: ui.playerStrobeEnabled || effectivePreset == .strobe,
            autoPerformance: ui.playerAutoPerformance,
            reduceMotion: reduceMotion,
            lowPower: lowPower,
            thermal: thermal
        )
    }

    private var mixerIntensity: Double {
        policy.intensityScale * (0.65 + ui.playerDrive * 0.7)
    }

    private var effectsActive: Bool { policy.enabled && preset != .off }

    var body: some View {
        NavigationStack {
            playerBody
                .syncPlayerVisualAnalysis()
                .navigationDestination(item: $artistRoute) { route in
                    ArtistBrowseDestination(artistId: route.artistId, artistName: route.artistName)
                        .environmentObject(app)
                }
                .navigationDestination(item: $albumRoute) { route in
                    AlbumBrowseDestination(
                        albumId: route.albumId.isEmpty ? nil : route.albumId,
                        albumTitle: route.albumTitle,
                        artist: route.artist
                    )
                    .environmentObject(app)
                }
        }
        .alert("Katalog", isPresented: Binding(get: { browseError != nil }, set: { if !$0 { browseError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(browseError ?? "")
        }
        .onReceive(NotificationCenter.default.publisher(for: ProcessInfo.thermalStateDidChangeNotification)) { _ in
            thermal = ProcessInfo.processInfo.thermalState
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        }
    }

    @ViewBuilder
    private var playerBody: some View {
        GeometryReader { geo in
            let layout = PlayerLayout(
                height: geo.size.height,
                width: geo.size.width,
                horizontalSizeClass: horizontalSizeClass,
                preset: preset
            )
            ZStack {
                PlayerStageBackdrop(colorScheme: colorScheme)

                PlayerGlassBackground(
                    visualizer: engine.visualizer,
                    isPlaying: engine.isPlaying,
                    preset: preset,
                    policy: policy
                )

                if let track = engine.currentTrack {
                    if layout.wide {
                        widePlayerLayout(track: track, layout: layout)
                    } else {
                        narrowPlayerLayout(track: track, layout: layout)
                    }
                }

                // Stroboskop na wierzchu całej sceny — błyski widać na całym playerze.
                if policy.allowStrobe {
                    PlayerStrobeLayer(
                        visualizer: engine.visualizer,
                        isPlaying: engine.isPlaying && !engine.isLoading,
                        intensity: max(0.7, policy.intensityScale),
                        speed: ui.playerStrobeSpeed,
                        brightness: ui.playerStrobeBrightness,
                        sensitivity: ui.playerSensitivity,
                        trackID: engine.currentTrack?.id,
                        colorScheme: colorScheme
                    )
                    .allowsHitTesting(false)
                    .zIndex(20)
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
                .presentationDetents(UIDevice.current.userInterfaceIdiom == .pad ? [.large] : [.medium, .large])
        }
        .sheet(isPresented: $showQueueSheet) {
            PlaybackQueueSheet(engine: engine)
        }
    }

    private func narrowPlayerLayout(track: MusicPlaybackTrack, layout: PlayerLayout) -> some View {
        VStack(spacing: 0) {
            playerChrome(track: track, layout: layout)

            VStack(spacing: 0) {
                Spacer(minLength: layout.topGap)
                ProMixerNarrowConsole(
                    visualizer: engine.visualizer,
                    isPlaying: engine.isPlaying,
                    isLoading: engine.isLoading,
                    intensity: mixerIntensity,
                    drive: ui.playerDrive,
                    bandCount: MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard,
                    compactMixer: layout.compactMixer,
                    queueLabel: engine.queuePositionLabel,
                    onQueueTap: { showQueueSheet = true },
                    onServer: app.isOnServer(track.url) || track.isOnServer,
                    effectsActive: effectsActive,
                    preset: preset,
                    policy: policy,
                    artworkURL: track.artworkURL,
                    fallbackArtwork: engine.displayArtwork,
                    canvasSize: layout.discSize,
                    spectrumHeight: layout.spectrumBlockHeight,
                    expandSpectrum: layout.isPad
                ) {
                    trackMeta(track: track, layout: layout, includeStorage: false)
                } status: {
                    playerStatusSection(layout: layout)
                } storage: {
                    EmptyView()
                }
                Spacer(minLength: layout.bottomGap)
            }
            .frame(maxHeight: .infinity)

            playerBottomConsole(track: track, layout: layout)
            playerFooter(layout: layout)
        }
        .padding(.horizontal, layout.horizontalPadding)
        .frame(maxWidth: layout.maxContentWidth)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func widePlayerLayout(track: MusicPlaybackTrack, layout: PlayerLayout) -> some View {
        VStack(spacing: 0) {
            playerChrome(track: track, layout: layout)

            VStack(spacing: 0) {
                Spacer(minLength: layout.topGap)
                ProMixerWideConsole(
                    visualizer: engine.visualizer,
                    isPlaying: engine.isPlaying,
                    isLoading: engine.isLoading,
                    intensity: mixerIntensity,
                    drive: ui.playerDrive,
                    bandCount: MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard,
                    compactMixer: layout.compactMixer,
                    queueLabel: engine.queuePositionLabel,
                    onQueueTap: { showQueueSheet = true },
                    onServer: app.isOnServer(track.url) || track.isOnServer,
                    effectsActive: effectsActive,
                    preset: preset,
                    policy: policy,
                    artworkURL: track.artworkURL,
                    fallbackArtwork: engine.displayArtwork,
                    canvasSize: layout.discSize,
                    spectrumHeight: layout.spectrumBlockHeight
                ) {
                    trackMeta(track: track, layout: layout, includeStorage: false)
                } status: {
                    playerStatusSection(layout: layout)
                } storage: {
                    EmptyView()
                }
                Spacer(minLength: layout.bottomGap)
            }
            .frame(maxHeight: .infinity)

            playerBottomConsole(track: track, layout: layout)
            playerFooter(layout: layout)
        }
        .padding(.horizontal, layout.horizontalPadding)
        .frame(maxWidth: layout.maxContentWidth)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func playerArtworkSection(layout: PlayerLayout, track: MusicPlaybackTrack) -> some View {
        PlayerHeroArtwork(
            artworkURL: track.artworkURL,
            fallbackImage: engine.displayArtwork,
            isPlaying: engine.isPlaying && !engine.isLoading,
            preset: preset,
            policy: policy,
            canvasSize: layout.discSize
        )

        if effectsActive {
            // Live PCM island — never the old fake phase animation.
            IslandBarsHost(
                visualizer: engine.visualizer,
                isPlaying: engine.isPlaying && !engine.isLoading,
                compact: false,
                prominent: true
            )
            .frame(width: 132, height: 40)
            .padding(.top, layout.afterDiscGap)

            if preset.showsMixer {
                WinampSpectrumHost(
                    visualizer: engine.visualizer,
                    isPlaying: engine.isPlaying && !engine.isLoading,
                    intensity: policy.intensityScale,
                    bandCount: MusicPlaybackEngine.AudioReactiveFrame.spectrumBandCountStandard,
                    compact: layout.compactMixer
                )
                .frame(height: layout.compactMixer ? 176 : 208)
                .padding(.top, layout.afterDiscGap)
                .padding(.horizontal, 4)
                .shadow(color: .black.opacity(0.35), radius: 12, y: 6)
            }
        }
    }

    @ViewBuilder
    private func playerStatusSection(layout: PlayerLayout) -> some View {
        PlayerBufferingStatus(engine: engine)
            .padding(.top, 6)

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
    }

    @ViewBuilder
    private func playerFooter(layout: PlayerLayout) -> some View {
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
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                showQueueSheet = true
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "list.bullet")
                        .font(.caption2.weight(.semibold))
                    Text(engine.queuePositionLabel)
                        .font(EOSTypography.monoDigit)
                }
                .foregroundStyle(EOSTheme.textMuted)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(.ultraThinMaterial, in: Capsule())
            }
            .buttonStyle(EOSPressableStyle())
            .accessibilityLabel("Kolejka odtwarzania, \(engine.queuePositionLabel)")
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

    @ViewBuilder
    private func playerStorageBar(track: MusicPlaybackTrack, layout: PlayerLayout) -> some View {
        if !track.isExternal || track.isOpenedLocalImport {
            PlayerStorageStatusBar(
                state: app.playbackCloudState(for: track),
                onServerHint: app.isOnServer(track.url) || track.isOnServer,
                layout: .horizontal,
                onDownload: { app.downloadCurrentPlayback() },
                onCancel: { app.cancelDownload(for: track.url) },
                onRemoveOffline: { app.removeOfflineDownload(for: track.url) }
            )
            .padding(.horizontal, 2)
        }
    }

    private func trackMeta(track: MusicPlaybackTrack, layout: PlayerLayout, includeStorage: Bool = true) -> some View {
        VStack(spacing: layout.tight ? 3 : 5) {
            Text(track.title)
                .font(layout.wide ? .title2.weight(.bold) : (layout.tight ? .title3.weight(.bold) : .title2.weight(.bold)))
                .foregroundStyle(EOSTheme.textPrimary)
                .multilineTextAlignment(layout.wide ? .leading : .center)
                .frame(maxWidth: .infinity, alignment: layout.wide ? .leading : .center)
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
                        .frame(maxWidth: .infinity, alignment: layout.wide ? .leading : .center)
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
                        .frame(maxWidth: .infinity, alignment: layout.wide ? .leading : .center)
                }
                .buttonStyle(.plain)
                .disabled(track.albumId?.isEmpty != false)
                .opacity(track.albumId?.isEmpty == false ? 1 : 0.55)
            }

            if track.isExternal, !track.isOpenedLocalImport {
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
            }
        }
        .padding(.horizontal, 8)
    }

    private func playbackSlider(layout: PlayerLayout) -> some View {
        PlayerProgressSlider(engine: engine, tight: layout.tight)
    }

    /// Jedna spójna karta na dole playera: status utworu (zawsze widoczny),
    /// suwak i transport — z głębią 3D, biała na jasnym motywie.
    private func playerBottomConsole(track: MusicPlaybackTrack, layout: PlayerLayout) -> some View {
        VStack(spacing: layout.tight ? 4 : 6) {
            playerStorageBar(track: track, layout: layout)
            playbackSlider(layout: layout)
            ProMixerTransportDeck(
                engine: engine,
                playButtonSize: layout.playButtonSize,
                tight: layout.tight,
                bare: true
            )
        }
        .padding(.horizontal, 12)
        .padding(.top, layout.tight ? 10 : 12)
        .padding(.bottom, layout.tight ? 4 : 6)
        .background {
            PlayerBottomConsoleSurface(colorScheme: colorScheme)
        }
        .padding(.top, 6)
    }

    private func openAlbum(for track: MusicPlaybackTrack) {
        if app.isOfflinePlaybackActive {
            guard let album = track.album, !album.isEmpty else {
                browseError = "Brak metadanych albumu offline."
                return
            }
            albumRoute = MusicAlbumRoute(
                albumId: track.albumId ?? "",
                albumTitle: album,
                artist: track.artist
            )
            return
        }
        guard let albumId = track.albumId, !albumId.isEmpty else {
            browseError = "Brak powiązanego albumu w katalogu Apple Music."
            return
        }
        albumRoute = MusicAlbumRoute(albumId: albumId, albumTitle: track.album, artist: track.artist)
    }

    private func openArtist(for track: MusicPlaybackTrack) async {
        if app.isOfflinePlaybackActive {
            guard let name = track.artist, !name.isEmpty else {
                browseError = "Brak metadanych wykonawcy offline."
                return
            }
            artistRoute = MusicArtistRoute(artistId: "", artistName: name)
            return
        }
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
    let isPad: Bool
    let preset: PlayerVisualPreset

    init(height: CGFloat, width: CGFloat, horizontalSizeClass: UserInterfaceSizeClass?, preset: PlayerVisualPreset = .spectrum) {
        self.height = height
        self.width = width
        self.isPad = UIDevice.current.userInterfaceIdiom == .pad || horizontalSizeClass == .regular
        self.preset = preset
    }

    var wide: Bool { width >= 640 && width > height * 1.05 }
    var tight: Bool { isPad ? height < 580 : height < 680 }
    var compact: Bool { isPad ? height < 650 : height < 760 }
    var compactMixer: Bool { tight || height < 820 }

    var discSize: CGFloat {
        // Spectrum: mała okładka w headerze — nigdy nie rozjeżdża EQ.
        if preset.showsMixer {
            if wide { return min(128, max(88, height * 0.18)) }
            if tight { return 64 }
            if height < 620 { return 72 }
            if height < 700 { return 80 }
            if height < 780 { return 92 }
            return isPad ? 118 : 100
        }
        // Winyl / Okładka / Strobe — większy hero, ale nadal w ramce ekranu.
        if wide { return min(260, height * 0.36) }
        if height < 620 { return 148 }
        if height < 700 { return 176 }
        if height < 780 { return 210 }
        return isPad ? 250 : 228
    }

    var spectrumHeight: CGFloat {
        if wide {
            if height < 560 { return 120 }
            if height < 700 { return 150 }
            return isPad ? min(240, height * 0.22) : 176
        }
        if isPad {
            return min(280, max(160, height * 0.24))
        }
        // Min ~150 pt — poniżej WinampSpectrumUIView nie ma miejsca na paski EQ (eqRect → 0).
        if width < 340 { return 150 }
        if height < 620 { return 152 }
        if height < 700 { return 168 }
        if height < 780 { return 184 }
        return 200
    }

    /// Wysokość bloku EQ — na iPadzie i dużych ekranach wypełnia więcej sceny.
    var spectrumBlockHeight: CGFloat {
        if isPad {
            return min(320, max(170, height * 0.28))
        }
        if wide {
            return spectrumHeight
        }
        return spectrumHeight
    }

    var sideVUWidth: CGFloat {
        if width < 340 { return 20 }
        if width < 390 { return 22 }
        return isPad ? 32 : 26
    }

    var haloBarCount: Int {
        if wide { return 48 }
        if tight { return 36 }
        return 52
    }

    var playButtonSize: CGFloat { tight ? 50 : (compact ? 56 : 62) }
    var topGap: CGFloat { tight ? 2 : (compact ? 4 : 6) }
    var afterDiscGap: CGFloat { tight ? 4 : 8 }
    var metaGap: CGFloat { tight ? 4 : 8 }
    var bottomGap: CGFloat { tight ? 2 : (compact ? 4 : 6) }
    var chromeTop: CGFloat { tight ? 2 : 6 }
    var safeBottom: CGFloat { isPad ? 10 : (tight ? 2 : 6) }
    var horizontalPadding: CGFloat { wide ? 28 : (width > 700 ? 24 : (width < 340 ? 8 : 12)) }
    var maxContentWidth: CGFloat {
        if wide { return min(width - 32, 1200) }
        if isPad {
            return width > 820 ? min(width * 0.9, 960) : min(width * 0.94, 720)
        }
        return min(width - 16, 540)
    }
    var wideArtColumnWidth: CGFloat { min(420, width * 0.42) }
    var wideColumnGap: CGFloat { 32 }
}

private struct PlayerGlassBackground: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy

    var body: some View {
        let _ = visualizer
        ZStack {
            EOSTheme.background
                .ignoresSafeArea()

            // Soft ambient wash — GPU gradients, no TimelineView.
            PlayerAmbientWash(isPlaying: isPlaying && policy.enabled, preset: preset)
        }
    }
}

/// Slow breathing wash behind the player — looks rich, costs almost nothing.
private struct PlayerAmbientWash: View {
    let isPlaying: Bool
    let preset: PlayerVisualPreset
    @State private var pulse = false

    var body: some View {
        ZStack {
            RadialGradient(
                colors: [
                    (preset == .spectrum ? EOSTheme.accentSecondary : EOSTheme.accent)
                        .opacity(isPlaying ? (pulse ? 0.22 : 0.12) : 0.06),
                    .clear
                ],
                center: .topTrailing,
                startRadius: 20,
                endRadius: 420
            )
            RadialGradient(
                colors: [
                    EOSTheme.accent.opacity(isPlaying ? (pulse ? 0.16 : 0.08) : 0.04),
                    .clear
                ],
                center: .bottomLeading,
                startRadius: 10,
                endRadius: 380
            )
            LinearGradient(
                colors: [
                    Color.white.opacity(0.06),
                    .clear,
                    EOSTheme.accent.opacity(0.04)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .onAppear { syncPulse() }
        .onChange(of: isPlaying) { _, _ in syncPulse() }
    }

    private func syncPulse() {
        guard isPlaying else {
            withAnimation(.easeOut(duration: 0.4)) { pulse = false }
            return
        }
        withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) {
            pulse = true
        }
    }
}

/// Hero artwork restored — vinyl / cover / spectrum beauty without nested TimelineView storms.
private struct PlayerHeroArtwork: View {
    let artworkURL: URL?
    var fallbackImage: UIImage? = nil
    let isPlaying: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    var canvasSize: CGFloat = 286

    var body: some View {
        let enabled = policy.enabled && preset != .off
        Group {
            if !enabled {
                ArtworkImage(
                    url: artworkURL,
                    size: canvasSize * 0.82,
                    cornerRadius: 18,
                    allowAnimated: true,
                    fallbackImage: fallbackImage
                )
                    .shadow(color: EOSTheme.accent.opacity(0.14), radius: 16, y: 8)
            } else if preset == .vinyl {
                VinylHero(artworkURL: artworkURL, fallbackImage: fallbackImage, isPlaying: isPlaying, canvasSize: canvasSize)
            } else if preset == .cover {
                CoverHero(artworkURL: artworkURL, fallbackImage: fallbackImage, isPlaying: isPlaying, canvasSize: canvasSize, lively: true)
            } else {
                // Spectrum — rich cover + soft glow; EQ lives below in UIKit.
                CoverHero(artworkURL: artworkURL, fallbackImage: fallbackImage, isPlaying: isPlaying, canvasSize: canvasSize, lively: false)
            }
        }
        .frame(width: canvasSize, height: canvasSize)
    }
}

private struct VinylHero: View {
    let artworkURL: URL?
    var fallbackImage: UIImage? = nil
    let isPlaying: Bool
    var canvasSize: CGFloat = 286

    var body: some View {
        let scale = canvasSize / 320
        ZStack {
            SoftOrbGlow(isPlaying: isPlaying, strong: false)
                .frame(width: 330, height: 330)

            CheapSpin(isSpinning: isPlaying, secondsPerRevolution: 11) {
                VinylDisc(artworkURL: artworkURL, fallbackImage: fallbackImage)
            }
            .shadow(color: EOSTheme.accent.opacity(isPlaying ? 0.28 : 0.1), radius: isPlaying ? 20 : 12, y: 8)
        }
        .frame(width: 320, height: 320)
        .scaleEffect(scale)
        .frame(width: canvasSize, height: canvasSize)
    }
}

private struct CoverHero: View {
    let artworkURL: URL?
    var fallbackImage: UIImage? = nil
    let isPlaying: Bool
    var canvasSize: CGFloat = 286
    var lively: Bool = false
    @State private var breathe = false

    var body: some View {
        let pulse: CGFloat = isPlaying ? (breathe ? (lively ? 1.045 : 1.028) : 1.0) : 1
        let glow = isPlaying ? (breathe ? (lively ? 0.38 : 0.28) : 0.18) : 0.1

        ZStack {
            RoundedRectangle(cornerRadius: lively ? 22 : 24, style: .continuous)
                .fill(
                    RadialGradient(
                        colors: [
                            EOSTheme.accent.opacity(0.42 * glow),
                            EOSTheme.accentSecondary.opacity(0.22 * glow),
                            .clear
                        ],
                        center: .center,
                        startRadius: canvasSize * 0.1,
                        endRadius: canvasSize * 0.7
                    )
                )
                .frame(width: canvasSize * 1.14, height: canvasSize * 1.14)
                .blur(radius: lively ? 20 : 16)
                .scaleEffect(pulse)

            ArtworkImage(
                url: artworkURL,
                size: canvasSize * 0.84,
                cornerRadius: lively ? 16 : 18,
                allowAnimated: true,
                fallbackImage: fallbackImage
            )
            .scaleEffect(pulse)
            .shadow(color: EOSTheme.accent.opacity(glow), radius: 18, y: 10)
        }
        .onAppear { syncBreath() }
        .onChange(of: isPlaying) { _, _ in syncBreath() }
    }

    private func syncBreath() {
        guard isPlaying else {
            withAnimation(.easeOut(duration: 0.35)) { breathe = false }
            return
        }
        withAnimation(.easeInOut(duration: lively ? 1.35 : 1.8).repeatForever(autoreverses: true)) {
            breathe = true
        }
    }
}

private struct SoftOrbGlow: View {
    let isPlaying: Bool
    var strong: Bool = false
    @State private var pulse = false

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        (strong ? EOSTheme.accentSecondary : EOSTheme.accent)
                            .opacity(isPlaying ? (pulse ? 0.34 : 0.18) : 0.06),
                        EOSTheme.accentSecondary.opacity(isPlaying ? 0.12 : 0.03),
                        .clear
                    ],
                    center: .center,
                    startRadius: 40,
                    endRadius: 170
                )
            )
            .scaleEffect(isPlaying ? (pulse ? 1.06 : 1.0) : 1)
            .onAppear { sync() }
            .onChange(of: isPlaying) { _, _ in sync() }
    }

    private func sync() {
        guard isPlaying else {
            withAnimation(.easeOut(duration: 0.3)) { pulse = false }
            return
        }
        withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) {
            pulse = true
        }
    }
}

/// Compositor-friendly spin — no TimelineView / no per-frame SwiftUI invalidation.
private struct CheapSpin<Content: View>: View {
    let isSpinning: Bool
    let secondsPerRevolution: Double
    @ViewBuilder let content: Content
    @State private var angle: Double = 0

    var body: some View {
        content
            .rotationEffect(.degrees(angle))
            .onAppear { applySpin(isSpinning) }
            .onChange(of: isSpinning) { _, spinning in
                applySpin(spinning)
            }
    }

    private func applySpin(_ spinning: Bool) {
        if spinning {
            // Continue from current angle so pause/resume does not jump backwards.
            withAnimation(.linear(duration: max(0.1, secondsPerRevolution)).repeatForever(autoreverses: false)) {
                angle += 360
            }
        } else {
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                angle = angle.truncatingRemainder(dividingBy: 360)
            }
        }
    }
}

/// Decorative island pills under vinyl/cover — pure SwiftUI phase, no audio tap.
private struct PlayerIslandPills: View {
    let isPlaying: Bool
    var compact: Bool = false
    @State private var phase = false

    private let heights: [CGFloat] = [0.4, 0.7, 1.0, 0.65, 0.45]

    var body: some View {
        HStack(spacing: compact ? 10 : 14) {
            Circle()
                .fill(EOSTheme.accent.opacity(isPlaying ? 0.55 : 0.2))
                .frame(width: isPlaying && phase ? 16 : 11, height: isPlaying && phase ? 16 : 11)

            ZStack {
                Capsule(style: .continuous)
                    .fill(Color.black.opacity(0.82))
                    .overlay(Capsule().stroke(Color.white.opacity(0.08), lineWidth: 0.7))

                HStack(alignment: .center, spacing: 3.4) {
                    ForEach(0..<5, id: \.self) { index in
                        let base = heights[index]
                        let h = isPlaying
                            ? (phase ? base : base * 0.55) * (compact ? 16 : 20)
                            : 3
                        RoundedRectangle(cornerRadius: 1.4, style: .continuous)
                            .fill(Color.white.opacity(0.94))
                            .frame(width: 2.8, height: max(3, h))
                    }
                }
                .padding(.horizontal, 15)
            }
            .frame(width: 124, height: 38)
            .opacity(isPlaying ? 1 : 0.45)

            Circle()
                .fill(EOSTheme.accentSecondary.opacity(isPlaying ? 0.55 : 0.2))
                .frame(width: isPlaying && !phase ? 16 : 11, height: isPlaying && !phase ? 16 : 11)
        }
        .frame(height: compact ? 40 : 48)
        .onAppear { sync() }
        .onChange(of: isPlaying) { _, _ in sync() }
        .animation(.easeInOut(duration: 0.28), value: phase)
    }

    private func sync() {
        guard isPlaying else {
            phase = false
            return
        }
        withAnimation(.easeInOut(duration: 0.32).repeatForever(autoreverses: true)) {
            phase = true
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

private struct PlayerBufferingStatus: View {
    let engine: MusicPlaybackEngine
    @ObservedObject private var flags: PlaybackStatusFlags

    init(engine: MusicPlaybackEngine) {
        self.engine = engine
        self._flags = ObservedObject(wrappedValue: engine.statusFlags)
    }

    var body: some View {
        if engine.isLoading || flags.isBuffering || flags.activity.phase.showsSpinner {
            VStack(alignment: .leading, spacing: 6) {
                PlaybackActivityLine(activity: flags.activity)
                if flags.activity.phase == .idle {
                    ProgressView(engine.isLoading ? "Łączę stream…" : "Buforowanie…")
                        .controlSize(.small)
                        .foregroundStyle(EOSTheme.textSecondary)
                }
            }
        } else if flags.activity.phase == .onServerConnecting || flags.activity.phase == .openingLocal {
            PlaybackActivityLine(activity: flags.activity)
        }
    }
}

private struct PlayerProgressSlider: View {
    let engine: MusicPlaybackEngine
    var tight: Bool = false
    @State private var isScrubbing = false
    @State private var scrubTime: Double = 0

    var body: some View {
        // Poll AVPlayer directly at 10Hz — smooth enough to feel precise without
        // fighting the render loop; no 0.5s Combine publish that hitch-stepped the player.
        TimelineView(.periodic(from: .now, by: 0.1)) { _ in
            let time = isScrubbing ? scrubTime : engine.livePlaybackTime()
            let duration = max(engine.liveDuration(), 1)
            VStack(spacing: 6) {
                PrecisionScrubBar(
                    progress: duration > 0 ? min(1, max(0, time / duration)) : 0,
                    isScrubbing: isScrubbing,
                    accentTime: formatDuration(time),
                    onScrubChange: { fraction in
                        isScrubbing = true
                        scrubTime = fraction * duration
                    },
                    onScrubEnd: { fraction in
                        let target = fraction * duration
                        scrubTime = target
                        engine.seek(to: target)
                        isScrubbing = false
                    }
                )
                .frame(height: tight ? 26 : 32)

                HStack {
                    Text(formatDuration(time))
                    Spacer()
                    Text(formatDuration(duration))
                }
                .font(.caption2.monospacedDigit().weight(.semibold))
                .foregroundStyle(EOSTheme.textMuted)
            }
            .padding(.horizontal, 4)
            .padding(.bottom, tight ? 6 : 10)
        }
    }

    private func formatDuration(_ value: Double) -> String {
        guard value.isFinite, value >= 0 else { return "0:00" }
        let total = Int(value.rounded())
        let m = total / 60
        let s = total % 60
        return String(format: "%d:%02d", m, s)
    }
}

/// Pixel-precise scrub bar — tap anywhere to jump, drag for fine control,
/// with haptic ticks at grab/release like a real transport wheel.
private struct PrecisionScrubBar: View {
    let progress: Double
    let isScrubbing: Bool
    let accentTime: String
    let onScrubChange: (Double) -> Void
    let onScrubEnd: (Double) -> Void

    @State private var dragFraction: Double?
    @GestureState private var isPressing = false

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let trackHeight: CGFloat = isPressing || isScrubbing ? 8 : 5
            let shown = dragFraction ?? progress
            let knobDiameter: CGFloat = isPressing || isScrubbing ? 22 : 14

            ZStack(alignment: .leading) {
                // Wpuszczony tor — czytelny na obu motywach (wcześniej biały znikał na białym).
                Capsule()
                    .fill(Color.primary.opacity(0.1))
                    .overlay {
                        Capsule()
                            .stroke(Color.primary.opacity(0.06), lineWidth: 0.5)
                    }
                    .frame(height: trackHeight)

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [EOSTheme.accentSecondary, EOSTheme.accent],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: max(trackHeight, width * shown), height: trackHeight)
                    .shadow(color: EOSTheme.accent.opacity(isPressing || isScrubbing ? 0.55 : 0.22), radius: 6)

                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.white, Color(white: 0.92)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay {
                        Circle().stroke(EOSTheme.accent.opacity(0.5), lineWidth: 1.5)
                    }
                    .frame(width: knobDiameter, height: knobDiameter)
                    .shadow(color: .black.opacity(0.25), radius: 4, y: 2)
                    .offset(x: min(max(0, width * shown - knobDiameter / 2), max(0, width - knobDiameter)))

                if isPressing || isScrubbing {
                    Text(accentTime)
                        .font(.caption2.monospacedDigit().weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(EOSTheme.accent, in: Capsule())
                        .offset(
                            x: min(max(0, width * shown - 22), max(0, width - 44)),
                            y: -26
                        )
                        .transition(.opacity.combined(with: .scale(scale: 0.85)))
                }
            }
            .frame(maxHeight: .infinity, alignment: .center)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .updating($isPressing) { _, state, _ in state = true }
                    .onChanged { drag in
                        if dragFraction == nil {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        }
                        let fraction = min(1, max(0, drag.location.x / max(1, width)))
                        dragFraction = fraction
                        onScrubChange(fraction)
                    }
                    .onEnded { drag in
                        let fraction = min(1, max(0, drag.location.x / max(1, width)))
                        onScrubEnd(fraction)
                        dragFraction = nil
                        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                    }
            )
            .animation(.easeOut(duration: 0.15), value: isPressing || isScrubbing)
        }
    }
}

private struct PlayerStrobeLayer: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let intensity: Double
    var speed: Double = 0.8
    var brightness: Double = 0.72
    var sensitivity: Double = 0.78
    var trackID: String?
    var colorScheme: ColorScheme = .dark

    @StateObject private var beatDriver = StrobeBeatDriver()

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 45, paused: !isPlaying)) { context in
            let frame = visualizer.snapshot(isPlaying: isPlaying)
            let t = context.date.timeIntervalSinceReferenceDate
            let flash = beatDriver.flashAmount(
                at: t,
                beat: frame.beat,
                bass: frame.bass,
                level: frame.level,
                isPlaying: isPlaying,
                speed: speed,
                sensitivity: sensitivity
            )
            StrobeFlashView(
                flash: flash,
                isPlaying: isPlaying,
                intensity: intensity,
                brightness: brightness,
                colorScheme: colorScheme
            )
        }
        .onChange(of: trackID) { _, _ in
            beatDriver.reset()
        }
        .onChange(of: isPlaying) { _, playing in
            if !playing { beatDriver.reset() }
        }
    }
}

/// Klubowy stroboskop: ostre błyski zsynchronizowane z bitem + regulowana jasność.
private struct StrobeFlashView: View {
    let flash: Double
    let isPlaying: Bool
    let intensity: Double
    var brightness: Double = 0.72
    var colorScheme: ColorScheme = .dark

    var body: some View {
        let power = isPlaying ? min(1, flash * brightness * (0.55 + intensity * 0.65)) : 0
        let isLight = colorScheme == .light
        let flashCore = isLight ? Color.black : Color.white
        let flashAccent = isLight ? EOSTheme.accent : Color.white

        ZStack {
            flashCore.opacity(power * (isLight ? 0.5 : 0.38))
                .blendMode(isLight ? .multiply : .plusLighter)

            RadialGradient(
                colors: [
                    flashAccent.opacity(power * (isLight ? 0.62 : 0.82)),
                    EOSTheme.accent.opacity(power * 0.65),
                    EOSTheme.accentSecondary.opacity(power * 0.32),
                    .clear
                ],
                center: .center,
                startRadius: 8,
                endRadius: 520
            )
            .blendMode(isLight ? .normal : .plusLighter)

            HStack {
                Circle()
                    .fill(flashCore.opacity(power * 0.92))
                    .frame(width: 120, height: 120)
                    .blur(radius: 28)
                    .offset(x: -40, y: -20)
                Spacer()
                Circle()
                    .fill(EOSTheme.accent.opacity(power * 0.95))
                    .frame(width: 120, height: 120)
                    .blur(radius: 28)
                    .offset(x: 40, y: -20)
            }
            .frame(maxHeight: .infinity, alignment: .top)

            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(flashAccent.opacity(power * 0.92), lineWidth: 2.5)
                .padding(6)
                .blendMode(isLight ? .normal : .plusLighter)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

private struct RotatingDiscArtwork: View {
    let visualizer: PlayerAudioVisualizer
    let artworkURL: URL?
    let isPlaying: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    var canvasSize: CGFloat = 286
    var haloBarBudget: Int = 52

    var body: some View {
        let enabled = policy.enabled && preset != .off
        let fps = max(1, policy.timelineFPS)

        if !enabled {
            ArtworkImage(url: artworkURL, size: canvasSize * 0.82, cornerRadius: 18)
                .shadow(color: EOSTheme.accent.opacity(0.12), radius: 16, y: 8)
        } else if preset == .cover {
            TimelineView(.animation(minimumInterval: 1.0 / max(8, fps), paused: !isPlaying)) { _ in
                let audio = visualizer.snapshot(isPlaying: isPlaying)
                let intensity = policy.intensityScale
                let drive = audio.visualDrive(isStrong: true, intensity: intensity)
                let beat = min(1, (audio.beat * 1.35 + drive * 0.25) * intensity)
                PulsingCoverArtwork(
                    artworkURL: artworkURL,
                    isPlaying: isPlaying,
                    drive: drive,
                    beat: beat,
                    canvasSize: canvasSize,
                    lively: true
                )
            }
        } else if preset == .spectrum {
            // Spectrum EQ is enough — skip halo + pulsing cover (were freezing UI on device).
            ArtworkImage(url: artworkURL, size: canvasSize * 0.82, cornerRadius: 18)
                .shadow(color: EOSTheme.accent.opacity(0.14), radius: 16, y: 8)
                .frame(width: canvasSize, height: canvasSize)
        } else {
            TimelineView(.animation(minimumInterval: 1.0 / max(8, fps), paused: !isPlaying)) { context in
                let audio = visualizer.snapshot(isPlaying: isPlaying)
                let intensity = policy.intensityScale
                let drive = audio.visualDrive(isStrong: false, intensity: intensity)
                let beat = min(1, (audio.beat * 1.35 + drive * 0.25) * intensity)
                let scale = canvasSize / 320
                let _ = context.date
                ZStack {
                    MusicReactiveHalo(
                        isPlaying: isPlaying,
                        isStrong: false,
                        drive: drive,
                        beat: beat,
                        bars: audio.islandBars,
                        fps: fps,
                        barCount: min(haloBarBudget, 28)
                    )

                    DiscSpinner(
                        artworkURL: artworkURL,
                        isSpinning: isPlaying && fps >= 8,
                        secondsPerRevolution: 11,
                        fps: fps
                    )
                    .equatable()
                    .scaleEffect(isPlaying ? 1 + CGFloat(beat) * 0.028 : 1)
                    .shadow(
                        color: EOSTheme.accent.opacity(isPlaying ? (0.14 + drive * 0.2 + beat * 0.15) : 0.08),
                        radius: 14 + CGFloat(beat) * 10,
                        y: 8
                    )
                }
                .frame(width: 320, height: 320)
                .scaleEffect(scale)
                .frame(width: canvasSize, height: canvasSize)
            }
        }
    }
}

/// Proste, proste i wycentrowane zdjęcie albumu — reaguje na bas i bit bez przekrzywiania 3D.
private struct PulsingCoverArtwork: View {
    let artworkURL: URL?
    let isPlaying: Bool
    let drive: Double
    let beat: Double
    var canvasSize: CGFloat = 286
    var lively: Bool = false

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 12, paused: !isPlaying)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let breathe = isPlaying ? sin(t * 2.2) * (lively ? 0.015 : 0.006) : 0
            let pulse = isPlaying
                ? 1 + CGFloat(beat) * (lively ? 0.05 : 0.035) + CGFloat(drive) * 0.018 + CGFloat(breathe)
                : 1
            let glow = isPlaying ? (0.16 + drive * 0.22 + beat * 0.2) : 0.08

            ZStack {
                // Tło poświaty — symetryczne, bez obracania i kładzenia
                RoundedRectangle(cornerRadius: lively ? 22 : 24, style: .continuous)
                    .fill(
                        RadialGradient(
                            colors: [
                                EOSTheme.accent.opacity(0.32 * glow),
                                EOSTheme.accentSecondary.opacity(0.18 * glow),
                                .clear
                            ],
                            center: .center,
                            startRadius: canvasSize * 0.1,
                            endRadius: canvasSize * 0.6
                        )
                    )
                    .frame(width: canvasSize * 1.08, height: canvasSize * 1.08)
                    .blur(radius: lively ? 20 : 16)
                    .scaleEffect(pulse * 1.02)

                // Czysta, prosta okładka z podwójną ramką szkła
                ArtworkImage(
                    url: artworkURL,
                    size: canvasSize * 0.85,
                    cornerRadius: lively ? 18 : 20,
                    allowAnimated: true
                )
                .overlay {
                    RoundedRectangle(cornerRadius: lively ? 18 : 20, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [Color.white.opacity(0.4), Color.white.opacity(0.08)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                }
                .scaleEffect(pulse)
                .shadow(
                    color: .black.opacity(0.28),
                    radius: 16 + CGFloat(beat) * (lively ? 12 : 8),
                    y: 8
                )
                .shadow(
                    color: EOSTheme.accent.opacity(glow * 0.6),
                    radius: 20,
                    y: 4
                )
            }
            .animation(.easeOut(duration: 0.08), value: beat)
        }
        .frame(width: canvasSize, height: canvasSize)
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

/// Płyta winylowa "Picture Disc" — okładka zajmuje cały winyl, na środku przerywany pierścień i wrzeciono.
private struct VinylDisc: View {
    let artworkURL: URL?
    var fallbackImage: UIImage? = nil

    var body: some View {
        ZStack {
            // Cała płyta winylowa to okładka albumu (Picture Disc)
            ArtworkImage(
                url: artworkURL,
                size: 272,
                cornerRadius: 136,
                circleClip: true,
                allowAnimated: true,
                fallbackImage: fallbackImage
            )
            .overlay {
                // Mikroskopijne rowki winylowe na całej powierzchni
                VinylGroovesOverlay()
                    .clipShape(Circle())
            }
            .overlay {
                // Przerywany pierścień na środku płyty
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.92),
                                Color.white.opacity(0.25)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [8, 5])
                    )
                    .frame(width: 112, height: 108)
                    .shadow(color: .black.opacity(0.5), radius: 3)
            }
            .overlay { SpindleHub() }
            .shadow(color: .black.opacity(0.4), radius: 14, y: 6)
        }
    }
}

struct SpindleHub: View {
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

struct VinylGroovesOverlay: View {
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
    var barCount: Int = 52

    private let vinylRadius: CGFloat = 136

    var body: some View {
        let count = min(barCount, isStrong ? 64 : 48)
        let maxExt: CGFloat = isStrong ? 52 : 34

        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: isStrong ? [
                            WinampSpectrumStyle.barColor(segmentFromBottom: 4).opacity(isPlaying ? 0.14 + beat * 0.22 : 0.03),
                            WinampSpectrumStyle.barColor(segmentFromBottom: 12).opacity(isPlaying ? 0.08 + drive * 0.1 : 0.02),
                            .clear
                        ] : [
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
                    for index in 0..<count {
                        let amp = barAmplitude(index: index, count: count, time: t)
                        guard amp > 0.012 else { continue }
                        let angle = (Double(index) / Double(count)) * (.pi * 2) - .pi / 2
                        let length = 2 + CGFloat(amp) * maxExt
                        let inner = vinylRadius + 1
                        let outer = inner + length
                        let cosA = CGFloat(cos(angle))
                        let sinA = CGFloat(sin(angle))
                        var path = Path()
                        path.move(to: CGPoint(x: center.x + cosA * inner, y: center.y + sinA * inner))
                        path.addLine(to: CGPoint(x: center.x + cosA * outer, y: center.y + sinA * outer))
                        let segment = Int(Double(index) / Double(count) * Double(WinampSpectrumStyle.segmentCount))
                        let color = isStrong
                            ? WinampSpectrumStyle.barColor(segmentFromBottom: segment)
                            : (index % 2 == 0 ? EOSTheme.accent : EOSTheme.accentSecondary)
                        gc.stroke(
                            path,
                            with: .color(color.opacity(0.28 + amp * 0.7)),
                            style: StrokeStyle(lineWidth: isStrong ? 2.4 : 1.8, lineCap: .round)
                        )
                    }
                }
                .frame(width: 330, height: 330)
                .drawingGroup(opaque: false)
            }

            Circle()
                .stroke(
                    (isStrong ? WinampSpectrumStyle.barColor(segmentFromBottom: 8) : EOSTheme.accent)
                        .opacity(isPlaying ? 0.22 + beat * 0.25 : 0.1),
                    lineWidth: 1.3
                )
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
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let isStrong: Bool
    var intensity: Double = 1
    var compact: Bool = false
    var timelineFPS: Double = 24

    private let barCount = MusicPlaybackEngine.AudioReactiveFrame.islandBarCount

    var body: some View {
        let pillFill = colorScheme == .light
            ? Color.black.opacity(0.9)
            : Color.black.opacity(0.78)
        let barColor = Color.white.opacity(0.95)
        let fps = max(8, timelineFPS)

        TimelineView(.animation(minimumInterval: 1.0 / fps, paused: !isPlaying)) { _ in
            let audio = visualizer.snapshot(isPlaying: isPlaying)
            let drive = audio.visualDrive(isStrong: isStrong, intensity: intensity)
            let beat = min(1, audio.beat * 1.4 * intensity)

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
                                .frame(width: 2.8, height: barHeight(index: index, beat: beat, audio: audio))
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
            }
            .frame(height: compact ? 40 : 48)
        }
    }

    private func barHeight(
        index: Int,
        beat: Double,
        audio: MusicPlaybackEngine.AudioReactiveFrame
    ) -> CGFloat {
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

/// Spectrum mixer — Winamp VU + EQ in one Canvas. Polls visualizer (no @ObservedObject).
private struct FrequencyMixerView: View {
    let visualizer: PlayerAudioVisualizer
    let trackID: String?
    let intensity: Double
    let isPlaying: Bool
    let bandCount: Int
    var compact: Bool = false

    @State private var envelopeDriver = WinampEnvelopeDriver()

    var body: some View {
        VStack(spacing: compact ? 6 : 10) {
            HStack(spacing: compact ? 8 : 12) {
                ForEach(["BASS", "MID", "TREBLE"], id: \.self) { title in
                    Text(title)
                        .font(.caption2.weight(.heavy))
                        .foregroundStyle(WinampSpectrumStyle.labelSecondary)
                        .tracking(0.6)
                        .frame(maxWidth: .infinity)
                }
            }

            TimelineView(.animation(minimumInterval: 1.0 / WinampSpectrumStyle.displayFPS, paused: !isPlaying)) { timeline in
                let audio = visualizer.snapshot(isPlaying: isPlaying)
                let snap = envelopeDriver.snapshot(
                    at: timeline.date.timeIntervalSinceReferenceDate,
                    frame: audio,
                    bandCount: bandCount,
                    intensity: intensity,
                    isPlaying: isPlaying
                )

                Canvas { gc, size in
                    drawMixer(
                        gc: &gc,
                        size: size,
                        bass: snap.bass,
                        mid: snap.mid,
                        treble: snap.treble,
                        bassPeak: snap.bassPeak,
                        midPeak: snap.midPeak,
                        treblePeak: snap.treblePeak,
                        levels: snap.levels,
                        peaks: snap.peaks
                    )
                }
                .frame(height: compact ? 132 : 160)
            }

            HStack(spacing: 0) {
                ForEach(0..<bandCount, id: \.self) { index in
                    Text(bandLabel(for: index))
                        .font(.system(size: compact ? 6 : 7, weight: .medium, design: .monospaced))
                        .foregroundStyle(WinampSpectrumStyle.labelSecondary.opacity(0.65))
                        .frame(maxWidth: .infinity)
                        .lineLimit(1)
                        .minimumScaleFactor(0.4)
                }
            }
            .padding(.horizontal, 1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, compact ? 6 : 10)
        .background {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(WinampSpectrumStyle.background)
                .overlay {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                }
        }
        .onChange(of: trackID) { _, _ in
            envelopeDriver.reset()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Mikser częstotliwości Winamp")
    }

    private func drawMixer(
        gc: inout GraphicsContext,
        size: CGSize,
        bass: Double,
        mid: Double,
        treble: Double,
        bassPeak: Double,
        midPeak: Double,
        treblePeak: Double,
        levels: [Double],
        peaks: [Double]
    ) {
        let vuHeight = compact ? 58.0 : 72.0
        let gap: CGFloat = compact ? 6 : 10
        let channelGap: CGFloat = compact ? 8 : 12
        let channelW = (size.width - channelGap * 2) / 3
        let channels: [(Double, Double)] = [
            (bass, bassPeak),
            (mid, midPeak),
            (treble, treblePeak)
        ]

        for (i, ch) in channels.enumerated() {
            let x = CGFloat(i) * (channelW + channelGap)
            let meterRect = CGRect(x: x, y: 0, width: channelW, height: vuHeight)
            gc.fill(Path(roundedRect: meterRect, cornerRadius: 2), with: .color(.black))
            gc.stroke(
                Path(roundedRect: meterRect, cornerRadius: 2),
                with: .color(.white.opacity(0.12)),
                lineWidth: 0.5
            )
            let inset = WinampSpectrumStyle.channelInset
            let level = WinampSpectrumStyle.quantizeLevel(isPlaying ? ch.0 : ch.0 * 0.15)
            let peak = WinampSpectrumStyle.quantizeLevel(isPlaying ? max(level, ch.1) : level)
            WinampSpectrumStyle.drawBarColumn(
                gc: &gc,
                in: meterRect.insetBy(dx: inset, dy: inset),
                level: level,
                peak: peak
            )
        }

        let eqTop = vuHeight + gap
        let eqRect = CGRect(x: 0, y: eqTop, width: size.width, height: max(0, size.height - eqTop))
        for tick in 1..<4 {
            let y = eqRect.minY + eqRect.height * CGFloat(tick) / 4
            var path = Path()
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: size.width, y: y))
            gc.stroke(path, with: .color(WinampSpectrumStyle.gridLine), lineWidth: 0.5)
        }

        let inset = WinampSpectrumStyle.channelInset
        let drawRect = eqRect.insetBy(dx: inset, dy: inset)
        let scaledLevels = levels.map { isPlaying ? $0 : $0 * 0.12 }
        let scaledPeaks = peaks.map { isPlaying ? $0 : $0 * 0.12 }
        WinampSpectrumStyle.drawEQBars(
            gc: &gc,
            in: drawRect,
            levels: scaledLevels,
            peaks: scaledPeaks,
            bandCount: bandCount,
            spacing: 1
        )
    }

    private func bandLabel(for index: Int) -> String {
        let step = 4
        guard index % step == 0 || index == bandCount - 1 else { return "" }
        let hz = 32.0 * pow(20_000.0 / 32.0, Double(index) / Double(max(1, bandCount - 1)))
        if hz >= 1000 {
            let k = hz / 1000
            return k >= 10 ? String(format: "%.0fk", k) : String(format: "%.1fk", k)
        }
        return String(format: "%.0f", hz)
    }
}

/// Tło pełnego playera — jasny motyw: systemowe tło + delikatna poświata; ciemny: studio rack.
/// Tło dolnej konsoli playera — biała karta z miękkim światłem u góry na jasnym
/// motywie, ciemne szkło na ciemnym. Jedna bryła zamiast trzech luźnych elementów.
private struct PlayerBottomConsoleSurface: View {
    let colorScheme: ColorScheme

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        Group {
            if colorScheme == .dark {
                shape
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(white: 0.13).opacity(0.92),
                                Color(white: 0.07).opacity(0.94)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay {
                        shape.stroke(
                            LinearGradient(
                                colors: [Color.white.opacity(0.14), Color.white.opacity(0.03)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 1
                        )
                    }
                    .shadow(color: .black.opacity(0.45), radius: 22, y: -6)
            } else {
                shape
                    .fill(
                        LinearGradient(
                            colors: [Color.white, Color(white: 0.965)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay {
                        shape.stroke(
                            LinearGradient(
                                colors: [Color.white, Color.black.opacity(0.05)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 1
                        )
                    }
                    .shadow(color: .black.opacity(0.1), radius: 20, y: 10)
                    .shadow(color: EOSTheme.accent.opacity(0.05), radius: 30, y: 4)
            }
        }
    }
}

private struct PlayerStageBackdrop: View {
    let colorScheme: ColorScheme

    var body: some View {
        ZStack {
            if colorScheme == .dark {
                ProMixerStageBackground()
                    .ignoresSafeArea()
                    .opacity(0.92)
            } else {
                EOSTheme.background.ignoresSafeArea()
                RadialGradient(
                    colors: [EOSTheme.accentSecondary.opacity(0.08), .clear],
                    center: .topLeading,
                    startRadius: 0,
                    endRadius: 420
                )
                .ignoresSafeArea()
                RadialGradient(
                    colors: [EOSTheme.accent.opacity(0.06), .clear],
                    center: .bottomTrailing,
                    startRadius: 0,
                    endRadius: 360
                )
                .ignoresSafeArea()
            }
        }
    }
}

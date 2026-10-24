import AVFoundation
import QuartzCore
import SwiftUI

// MARK: - Pro DJ / rack mixer chrome

enum ProMixerDeckView {
    static let chassisFill = Color(red: 0.07, green: 0.07, blue: 0.08)
    static let bezelStroke = Color.white.opacity(0.14)
    static let screwColor = Color.white.opacity(0.22)
    static let labelGreen = Color(red: 0.22, green: 0.78, blue: 0.32)
    static let labelAmber = Color(red: 0.95, green: 0.62, blue: 0.08)
    static let labelRed = Color(red: 1, green: 0.22, blue: 0.18)

    static func isLight(_ scheme: ColorScheme) -> Bool { scheme == .light }
}

/// Szeroka konsola — iPad / Mac / landscape. Jedna czytelna kompozycja, zero overflow.
struct ProMixerWideConsole<Meta: View, Status: View, Storage: View>: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let isLoading: Bool
    let intensity: Double
    let drive: Double
    let bandCount: Int
    var barScale: Double = 1.0
    var speed: Double = 1.0
    var sideVUSegments: Int = 24
    let compactMixer: Bool
    let queueLabel: String
    var onQueueTap: (() -> Void)? = nil
    let onServer: Bool
    let effectsActive: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    let artworkURL: URL?
    let fallbackArtwork: UIImage?
    var artworkIdentity: String = ""
    var artworkTitle: String = ""
    var artworkArtist: String? = nil
    let canvasSize: CGFloat
    var spectrumHeight: CGFloat = 150
    @ViewBuilder var meta: () -> Meta
    @ViewBuilder var status: () -> Status
    @ViewBuilder var storage: () -> Storage
    @Environment(\.colorScheme) private var colorScheme

    private var live: Bool { isPlaying && !isLoading }
    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        VStack(spacing: 8) {
            ProMixerStatusRail(
                visualizer: visualizer,
                isPlaying: live,
                queueLabel: queueLabel,
                onQueueTap: onQueueTap,
                onServer: onServer,
                drive: drive
            )

            ProMixerChassis {
                VStack(spacing: 12) {
                    // Header: okładka + meta — zawsze w jednej linii, w pełni w chassis.
                    HStack(alignment: .center, spacing: 16) {
                        artworkBlock
                            .frame(width: canvasSize, height: canvasSize)
                            .clipped()

                        VStack(alignment: .leading, spacing: 8) {
                            meta()
                            status()
                            Spacer(minLength: 0)
                            if preset.showsMixer {
                                ProMixerNumericDisplay(visualizer: visualizer, isPlaying: live)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if preset.showsMixer {
                        GeometryReader { rowGeo in
                            let vuW = min(34, max(18, rowGeo.size.width * 0.075))
                            HStack(alignment: .bottom, spacing: rowGeo.size.width < 360 ? 6 : 10) {
                                ProMixerVerticalVU(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    channel: .left,
                                    width: vuW,
                                    compact: true,
                                    drive: drive,
                                    segmentCount: sideVUSegments
                                )
                                .frame(width: vuW, height: max(96, spectrumHeight))

                                WinampSpectrumHost(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    intensity: intensity,
                                    bandCount: bandCount,
                                    barScale: barScale,
                                    speed: speed,
                                    compact: rowGeo.size.width < 380,
                                    lightAppearance: isLight
                                )
                                .frame(maxWidth: .infinity)
                                .frame(height: max(96, spectrumHeight))

                                ProMixerVerticalVU(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    channel: .right,
                                    width: vuW,
                                    compact: true,
                                    drive: drive,
                                    segmentCount: sideVUSegments
                                )
                                .frame(width: vuW, height: max(96, spectrumHeight))
                            }
                        }
                        .frame(height: max(108, spectrumHeight + 8))
                        .padding(8)
                        .background { ProMixerSpectrumWell() }

                        ProMixerStereoBridge(visualizer: visualizer, isPlaying: live)
                    }
                }
                .padding(14)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            storage()

            if preset.showsMixer {
                ProMixerSpectrumTuneStrip(compact: compactMixer)
            }

            ProMixerControlStrip(compact: compactMixer)
        }
        .padding(6)
        .background { ProMixerStageBackground() }
    }

    @ViewBuilder
    private var artworkBlock: some View {
        if effectsActive {
            PlayerHeroArtworkBridge(
                artworkURL: artworkURL,
                fallbackImage: fallbackArtwork,
                identity: artworkIdentity,
                placeholderTitle: artworkTitle,
                placeholderSubtitle: artworkArtist,
                isPlaying: live,
                preset: preset,
                policy: policy,
                visualizer: visualizer,
                canvasSize: canvasSize
            )
        } else {
            ArtworkImage(
                url: artworkURL,
                size: canvasSize * 0.92,
                cornerRadius: 14,
                allowAnimated: true,
                fallbackImage: fallbackArtwork,
                identity: artworkIdentity,
                placeholderTitle: artworkTitle,
                placeholderSubtitle: artworkArtist
            )
            .shadow(color: EOSTheme.accent.opacity(0.16), radius: 12, y: 6)
        }
    }
}

/// Kompaktowa konsola — iPhone / iPad portrait. Wypełnia dostępną wysokość.
struct ProMixerNarrowConsole<Meta: View, Status: View, Storage: View>: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let isLoading: Bool
    let intensity: Double
    let drive: Double
    let bandCount: Int
    var barScale: Double = 1.0
    var speed: Double = 1.0
    var sideVUSegments: Int = 24
    let compactMixer: Bool
    let queueLabel: String
    var onQueueTap: (() -> Void)? = nil
    let onServer: Bool
    let effectsActive: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    let artworkURL: URL?
    let fallbackArtwork: UIImage?
    var artworkIdentity: String = ""
    var artworkTitle: String = ""
    var artworkArtist: String? = nil
    let canvasSize: CGFloat
    var spectrumHeight: CGFloat = 110
    var expandSpectrum: Bool = false
    @ViewBuilder var meta: () -> Meta
    @ViewBuilder var status: () -> Status
    @ViewBuilder var storage: () -> Storage
    @Environment(\.colorScheme) private var colorScheme

    private var live: Bool { isPlaying && !isLoading }
    private var isLight: Bool { colorScheme == .light }

    private var eqMinHeight: CGFloat {
        if expandSpectrum { return max(120, min(spectrumHeight, 220)) }
        return compactMixer ? 88 : 96
    }

    var body: some View {
        VStack(spacing: compactMixer ? 4 : 6) {
            ProMixerStatusRail(
                visualizer: visualizer,
                isPlaying: live,
                queueLabel: queueLabel,
                onQueueTap: onQueueTap,
                onServer: onServer,
                drive: drive,
                compact: compactMixer
            )

            ProMixerChassis {
                VStack(spacing: compactMixer ? 6 : 8) {
                    artworkThumb
                        .frame(width: canvasSize, height: canvasSize)
                        .frame(maxWidth: .infinity)
                        .clipped()

                    VStack(spacing: compactMixer ? 2 : 4) {
                        meta()
                        status()
                    }
                    .frame(maxWidth: .infinity)

                    if preset.showsMixer {
                        GeometryReader { rowGeo in
                            let vuW = min(expandSpectrum ? 34 : 24, max(14, rowGeo.size.width * 0.062))
                            HStack(alignment: .bottom, spacing: rowGeo.size.width < 360 ? 4 : 6) {
                                ProMixerVerticalVU(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    channel: .left,
                                    width: vuW,
                                    compact: !expandSpectrum,
                                    drive: drive,
                                    segmentCount: sideVUSegments
                                )
                                .frame(width: vuW, height: rowGeo.size.height)

                                WinampSpectrumHost(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    intensity: intensity,
                                    bandCount: bandCount,
                                    barScale: barScale,
                                    speed: speed,
                                    compact: compactMixer || rowGeo.size.width < 380,
                                    lightAppearance: isLight
                                )
                                .frame(maxWidth: .infinity)
                                .frame(height: rowGeo.size.height)

                                ProMixerVerticalVU(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    channel: .right,
                                    width: vuW,
                                    compact: !expandSpectrum,
                                    drive: drive,
                                    segmentCount: sideVUSegments
                                )
                                .frame(width: vuW, height: rowGeo.size.height)
                            }
                        }
                        .frame(minHeight: eqMinHeight)
                        .frame(maxHeight: .infinity)
                        .padding(compactMixer ? 5 : 8)
                        .background { ProMixerSpectrumWell() }
                        .layoutPriority(-1)

                        ProMixerStereoBridge(visualizer: visualizer, isPlaying: live, compact: compactMixer)
                    } else {
                        Spacer(minLength: 0)
                    }
                }
                .padding(compactMixer ? 8 : 12)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .frame(maxHeight: .infinity)

            storage()

            if preset.showsMixer {
                ProMixerSpectrumTuneStrip(compact: compactMixer)
                    .fixedSize(horizontal: false, vertical: true)
            }

            ProMixerControlStrip(compact: true)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(compactMixer ? 2 : 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background { ProMixerStageBackground() }
    }

    @ViewBuilder
    private var artworkThumb: some View {
        if effectsActive {
            PlayerHeroArtworkBridge(
                artworkURL: artworkURL,
                fallbackImage: fallbackArtwork,
                identity: artworkIdentity,
                placeholderTitle: artworkTitle,
                placeholderSubtitle: artworkArtist,
                isPlaying: live,
                preset: preset,
                policy: policy,
                visualizer: visualizer,
                canvasSize: canvasSize
            )
        } else {
            ArtworkImage(
                url: artworkURL,
                size: canvasSize * 0.92,
                cornerRadius: 14,
                allowAnimated: true,
                fallbackImage: fallbackArtwork,
                identity: artworkIdentity,
                placeholderTitle: artworkTitle,
                placeholderSubtitle: artworkArtist
            )
        }
    }
}

// Bridge — FullPlayerView types are private; duplicate minimal hero call via public ArtworkImage + preset routing in host.
private struct PlayerHeroArtworkBridge: View {
    let artworkURL: URL?
    var fallbackImage: UIImage?
    var identity: String = ""
    var placeholderTitle: String = ""
    var placeholderSubtitle: String? = nil
    let isPlaying: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    let visualizer: PlayerAudioVisualizer
    var canvasSize: CGFloat

    var body: some View {
        let enabled = policy.enabled && preset != .off
        Group {
            if !enabled {
                ArtworkImage(
                    url: artworkURL,
                    size: canvasSize * 0.82,
                    cornerRadius: 14,
                    allowAnimated: true,
                    fallbackImage: fallbackImage,
                    identity: identity,
                    placeholderTitle: placeholderTitle,
                    placeholderSubtitle: placeholderSubtitle
                )
            } else if preset == .vinyl {
                ProMixerVinylThumb(
                    artworkURL: artworkURL,
                    fallbackImage: fallbackImage,
                    isPlaying: isPlaying,
                    size: canvasSize,
                    visualizer: visualizer,
                    policy: policy
                )
                .id(identity)
            } else if preset == .cover {
                CoverSplitBeatPulseView(
                    artworkURL: artworkURL,
                    fallbackImage: fallbackImage,
                    isPlaying: isPlaying,
                    visualizer: visualizer,
                    policy: policy,
                    canvasSize: canvasSize,
                    cornerRadius: 16,
                    style: .split
                )
                .id(identity)
            } else {
                // Spectrum — rhythmic halo rings around cover (cheap GPU).
                CoverSplitBeatPulseView(
                    artworkURL: artworkURL,
                    fallbackImage: fallbackImage,
                    isPlaying: isPlaying,
                    visualizer: visualizer,
                    policy: policy,
                    canvasSize: canvasSize,
                    cornerRadius: 14,
                    style: .halo
                )
                .id(identity)
            }
        }
        .frame(width: canvasSize, height: canvasSize)
    }
}

/// Cover pulse that reliably starts on appear (see `MixerContinuousSpin`).
private struct MixerBreathingCover: View {
    let artworkURL: URL?
    var fallbackImage: UIImage?
    let isPlaying: Bool
    let canvasSize: CGFloat
    @State private var breathe = false

    var body: some View {
        ArtworkImage(
            url: artworkURL,
            size: canvasSize * 0.84,
            cornerRadius: 14,
            allowAnimated: true,
            fallbackImage: fallbackImage
        )
        .shadow(color: EOSTheme.accent.opacity(isPlaying ? (breathe ? 0.32 : 0.2) : 0.1), radius: 14, y: 6)
        .scaleEffect(isPlaying ? (breathe ? 1.025 : 1.0) : 1)
        .onAppear { sync() }
        .onChange(of: isPlaying) { _, _ in sync() }
    }

    private func sync() {
        guard isPlaying else {
            withAnimation(.easeOut(duration: 0.3)) { breathe = false }
            return
        }
        withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
            breathe = true
        }
    }
}

private struct ProMixerVinylThumb: View {
    let artworkURL: URL?
    var fallbackImage: UIImage?
    let isPlaying: Bool
    let size: CGFloat
    var visualizer: PlayerAudioVisualizer?
    var policy: PlayerVisualPolicy?

    var body: some View {
        let live = isPlaying && (policy?.analyzerFPS ?? 12) > 0.5
        ZStack {
            VinylPulseRings(size: size * 0.92, pulse: CoverBeatPulseDriver.Pulse())
            VinylCASpin(isSpinning: live) {
                ArtworkImage(
                    url: artworkURL,
                    size: size * 0.92,
                    cornerRadius: size * 0.46,
                    circleClip: true,
                    fallbackImage: fallbackImage
                )
                .overlay {
                    VinylGroovesOverlay()
                        .clipShape(Circle())
                }
                .overlay {
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.85),
                                    Color.white.opacity(0.28)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            style: StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [6, 4])
                        )
                        .frame(width: size * 0.36, height: size * 0.36)
                }
                .overlay {
                    SpindleHub()
                        .scaleEffect(0.65)
                }
            }
            .frame(width: size * 0.92, height: size * 0.92)
        }
    }
}

// MARK: - Chassis

private struct ProMixerSpectrumWell: View {
    @Environment(\.colorScheme) private var colorScheme

    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(
                isLight
                    ? LinearGradient(
                        colors: [
                            Color(white: 0.99),
                            Color(white: 0.955),
                            Color(red: 0.94, green: 0.93, blue: 0.95)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    : LinearGradient(
                        colors: [
                            Color(red: 0.05, green: 0.05, blue: 0.06),
                            Color.black.opacity(0.92)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
            )
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: isLight
                                ? [Color.white.opacity(0.95), Color.black.opacity(0.07), EOSTheme.accent.opacity(0.08)]
                                : [Color.white.opacity(0.08), Color.white.opacity(0.02)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: isLight ? 1 : 0.8
                    )
            }
            .shadow(color: .black.opacity(isLight ? 0.08 : 0), radius: isLight ? 12 : 8, y: isLight ? 6 : 4)
            .shadow(color: EOSTheme.accent.opacity(isLight ? 0.05 : 0), radius: 20, y: 2)
    }
}

private struct ProMixerChassis<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    @ViewBuilder var content: () -> Content

    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        content()
            .background {
                ZStack {
                    shape
                        .fill(
                            LinearGradient(
                                colors: isLight
                                    ? [
                                        Color.white,
                                        Color(red: 0.99, green: 0.985, blue: 0.99),
                                        Color(white: 0.955)
                                    ]
                                    : [
                                        Color(red: 0.13, green: 0.13, blue: 0.15),
                                        ProMixerDeckView.chassisFill,
                                        Color(red: 0.04, green: 0.04, blue: 0.05)
                                    ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    shape
                        .strokeBorder(
                            LinearGradient(
                                colors: isLight
                                    ? [Color.white, Color.black.opacity(0.05), EOSTheme.accent.opacity(0.08)]
                                    : [
                                        Color.white.opacity(0.28),
                                        Color.white.opacity(0.05),
                                        Color.black.opacity(0.55)
                                    ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: isLight ? 1.25 : 1.2
                        )
                    if !isLight {
                        RoundedRectangle(cornerRadius: 15, style: .continuous)
                            .inset(by: 3)
                            .stroke(Color.black.opacity(0.45), lineWidth: 1)
                    }
                }
                .shadow(color: .black.opacity(isLight ? 0.12 : 0.55), radius: isLight ? 22 : 24, y: isLight ? 12 : 14)
                .shadow(color: .black.opacity(isLight ? 0.05 : 0), radius: isLight ? 6 : 0, y: isLight ? 2 : 0)
                .shadow(color: EOSTheme.accent.opacity(isLight ? 0.06 : 0.08), radius: 40, y: 0)
            }
            .clipShape(shape)
            .overlay(alignment: .topLeading) { ProMixerScrew().padding(10) }
            .overlay(alignment: .topTrailing) { ProMixerScrew().padding(10) }
            .overlay(alignment: .bottomLeading) { ProMixerScrew().padding(10) }
            .overlay(alignment: .bottomTrailing) { ProMixerScrew().padding(10) }
    }
}

/// Jednolite tło studia — jasny: szaro-biała obudowa; ciemny: rack.
struct ProMixerStageBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(
                LinearGradient(
                    colors: isLight
                        ? [
                            Color.white,
                            Color(red: 0.985, green: 0.98, blue: 0.99),
                            Color(white: 0.955)
                        ]
                        : [
                            Color(red: 0.09, green: 0.09, blue: 0.11),
                            Color(red: 0.05, green: 0.05, blue: 0.07),
                            Color(red: 0.11, green: 0.08, blue: 0.12)
                        ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: isLight
                                ? [Color.white, Color.black.opacity(0.05), EOSTheme.accent.opacity(0.10)]
                                : [Color.white.opacity(0.12), Color.clear, EOSTheme.accent.opacity(0.15)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: isLight ? 1.15 : 1
                    )
            }
            .shadow(color: .black.opacity(isLight ? 0.12 : 0.35), radius: isLight ? 20 : 28, y: isLight ? 10 : 16)
            .shadow(color: EOSTheme.accent.opacity(isLight ? 0.05 : 0), radius: 28, y: 4)
    }
}

private struct ProMixerScrew: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: colorScheme == .light
                        ? [Color.white, Color(white: 0.78)]
                        : [Color(white: 0.35), Color(white: 0.12)],
                    center: .center,
                    startRadius: 0,
                    endRadius: 5
                )
            )
            .frame(width: 9, height: 9)
            .overlay {
                Circle()
                    .stroke(Color.black.opacity(colorScheme == .light ? 0.12 : 0.35), lineWidth: 0.5)
            }
            .overlay {
                Rectangle()
                    .fill(Color.black.opacity(colorScheme == .light ? 0.18 : 0.45))
                    .frame(width: 5, height: 0.6)
            }
            .shadow(color: .black.opacity(colorScheme == .light ? 0.08 : 0), radius: 1, y: 1)
    }
}

// MARK: - Status LED rail

struct ProMixerStatusRail: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let queueLabel: String
    var onQueueTap: (() -> Void)? = nil
    var onServer: Bool
    var drive: Double = 0.4
    var compact: Bool = false
    /// Stan buforowania — dioda NET (tylko szeroki ekran).
    var statusFlags: PlaybackStatusFlags? = nil
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.horizontalSizeClass) private var sizeClass
    @StateObject private var lamps = MixerLampDriver()
    @ObservedObject private var route = AudioRouteMonitor.shared

    /// iPad / szerokie okno: pasek mieści dodatkowe wskaźniki.
    private var wideRail: Bool { sizeClass == .regular }
    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        lampRow(lamps.output)
            .onAppear { lamps.start(visualizer: visualizer, isPlaying: isPlaying, onServer: onServer) }
            .onChange(of: isPlaying) { _, playing in
                lamps.start(visualizer: visualizer, isPlaying: playing, onServer: onServer)
            }
            .onChange(of: onServer) { _, value in
                lamps.start(visualizer: visualizer, isPlaying: isPlaying, onServer: value)
            }
            .onDisappear { lamps.stop() }
    }

    private func lampRow(_ out: DJConsoleLampEngine.Output) -> some View {
        HStack(spacing: 0) {
            HStack(spacing: compact ? 6 : 10) {
                ProMixerLED(label: "BEAT", color: ProMixerDeckView.labelGreen, intensity: out.beat)
                ProMixerLED(label: "RYTM", color: ProMixerDeckView.labelAmber, intensity: out.rytm)
                ProMixerLED(label: "BASS", color: ProMixerDeckView.labelGreen, intensity: out.bass)
                ProMixerLED(label: "EOS", color: Color(red: 0.18, green: 0.72, blue: 0.95), intensity: out.eos)
            }

            if wideRail {
                Spacer(minLength: 10)
                StereoLEDMeter(left: out.left, right: out.right, isLight: isLight)
            }

            Spacer(minLength: 4)

            HStack(spacing: 6) {
                BPMReadout(bpm: out.bpm, beat: out.beat, compact: compact)
                queueControl(compact: compact)
            }

            Spacer(minLength: 4)

            if wideRail {
                RouteLEDStrip(kind: route.kind, isLight: isLight)
                if let statusFlags {
                    NetLED(flags: statusFlags)
                        .padding(.leading, 8)
                }
                Spacer(minLength: 10)
            }

            HStack(spacing: compact ? 6 : 10) {
                ProMixerLED(label: "HI", color: Color(red: 0.55, green: 0.82, blue: 1.0), intensity: out.treble)
                ProMixerLED(label: "OUT", color: ProMixerDeckView.labelGreen, intensity: out.out)
                ProMixerLED(label: "CLIP", color: ProMixerDeckView.labelRed, intensity: out.clip)
            }
        }
        .padding(.horizontal, compact ? 10 : 12)
        .padding(.vertical, compact ? 7 : 9)
        .background { railBackground(bass: out.bass, kick: out.beat) }
    }

    /// Panel jak front sprzętu: ciemny lakier z fazą, szklana szybka u góry
    /// i krawędź w kolorze EOS, która żarzy się w rytm basu.
    private func railBackground(bass: Double, kick: Double) -> some View {
        let glow = min(1, bass * 0.7 + kick * 0.5)
        let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)
        return shape
            .fill(
                LinearGradient(
                    colors: isLight
                        ? [Color(white: 0.995), Color(white: 0.9)]
                        : [Color(white: 0.13), Color(white: 0.035)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay(alignment: .top) {
                // Szybka / szczotkowane aluminium: odblask na górnej połowie.
                shape
                    .fill(LinearGradient(colors: [Color.white.opacity(isLight ? 0.9 : 0.09), .clear], startPoint: .top, endPoint: .center))
                    .padding(1)
            }
            .overlay {
                shape.strokeBorder(isLight ? Color.black.opacity(0.1) : Color.black.opacity(0.8), lineWidth: isLight ? 1 : 2)
            }
            .overlay {
                shape.strokeBorder(
                    LinearGradient(
                        colors: [
                            EOSTheme.accent.opacity(0.35 + 0.65 * glow),
                            EOSTheme.accentSecondary.opacity(0.25 + 0.6 * glow),
                            EOSTheme.accent.opacity(0.35 + 0.65 * glow)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    lineWidth: 1.2
                )
            }
            .shadow(color: EOSTheme.accent.opacity((isLight ? 0.08 : 0.15) + (isLight ? 0.35 : 0.55) * glow), radius: 4 + 14 * glow)
            .shadow(color: .black.opacity(isLight ? 0.1 : 0.45), radius: isLight ? 12 : 8, y: isLight ? 6 : 4)
    }

    @ViewBuilder
    private func queueControl(compact: Bool) -> some View {
        let label = Group {
            Text(queueLabel)
                .font(.caption2.monospacedDigit().weight(.bold))
        }
        .foregroundStyle(ProMixerDeckView.labelGreen.opacity(0.95))
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(
                    isLight
                        ? Color.white.opacity(0.92)
                        : Color.black.opacity(0.72)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(ProMixerDeckView.labelGreen.opacity(isLight ? 0.35 : 0.28), lineWidth: 0.7)
                }
                .shadow(color: .black.opacity(isLight ? 0.06 : 0), radius: 2, y: 1)
        )

        if let onQueueTap {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onQueueTap()
            } label: {
                label
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Kolejka odtwarzania, \(queueLabel)")
        } else {
            label
        }
    }
}

/// Prostokątna dioda jak w prawdziwym sprzęcie: obudowa z fazą, kolorowa soczewka
/// (ciemna, gdy zgaszona), jasny rdzeń i rozbłysk światła wokół, gdy świeci.
private struct ProMixerLED: View {
    let label: String
    let color: Color
    let intensity: Double
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let isLight = colorScheme == .light
        let i = min(1, max(0, intensity))
        let on = i > 0.04
        VStack(spacing: 3) {
            Text(label)
                .font(.system(size: 6.5, weight: .bold, design: .rounded))
                .tracking(0.7)
                .foregroundStyle(on ? color.opacity(0.55 + 0.45 * i) : (isLight ? Color.black.opacity(0.38) : Color.white.opacity(0.32)))

            ZStack {
                // Obudowa
                RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                    .fill(LinearGradient(colors: isLight ? [Color(white: 0.72), Color(white: 0.9)] : [Color.black, Color(white: 0.16)], startPoint: .top, endPoint: .bottom))
                    .frame(width: 24, height: 10)
                // Soczewka: zgaszona = przyciemniony kolor; świecąca = gradient z białym rdzeniem.
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: on
                                ? [Color.white.opacity(0.55 * i + 0.1), color.opacity(0.75 + 0.25 * i), color.opacity(0.55 + 0.3 * i)]
                                : [color.opacity(0.22), color.opacity(0.1), color.opacity(0.16)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: 20, height: 6)
                    // Rozbłysk światła wokół soczewki
                    .shadow(color: color.opacity(on ? 0.85 * i : 0), radius: on ? 3 + 4 * i : 0)
                // Odblask szkła — widoczny także na zgaszonej diodzie
                Capsule()
                    .fill(Color.white.opacity(on ? 0.45 : 0.18))
                    .frame(width: 12, height: 1)
                    .offset(y: -1.6)
            }
        }
        .frame(minWidth: 24)
        .accessibilityLabel("\(label) \(on ? "on" : "off")")
    }
}

/// Wyświetlacz tempa: zielony LCD, kropka mruga na stopę.
private struct BPMReadout: View {
    let bpm: Int
    let beat: Double
    var compact: Bool = false

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(ProMixerDeckView.labelGreen.opacity(0.25 + 0.75 * beat))
                .frame(width: 5, height: 5)
                .shadow(color: ProMixerDeckView.labelGreen.opacity(beat), radius: 3 * beat)
            Text(bpm > 0 ? "\(bpm)" : "---")
                .font(.system(size: compact ? 11 : 12, weight: .bold, design: .monospaced))
                .contentTransition(.numericText())
                .animation(.snappy, value: bpm)
            Text("BPM")
                .font(.system(size: 6.5, weight: .bold))
                .opacity(0.7)
        }
        .foregroundStyle(ProMixerDeckView.labelGreen)
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.black.opacity(0.72))
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(ProMixerDeckView.labelGreen.opacity(0.28), lineWidth: 0.7))
        )
        .accessibilityLabel(bpm > 0 ? "Tempo \(bpm) BPM" : "Tempo nieznane")
    }
}

// MARK: - Side column (VU + content)

private enum ProMixerChannel { case left, right }

private struct ProMixerSideColumn<Content: View>: View {
    let title: String
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let channel: ProMixerChannel
    let width: CGFloat
    var compact: Bool = false
    var drive: Double = 0.4
    @ViewBuilder var content: () -> Content

    var body: some View {
        HStack(alignment: .top, spacing: compact ? 6 : 8) {
            if channel == .left {
                ProMixerVerticalVU(
                    visualizer: visualizer,
                    isPlaying: isPlaying,
                    channel: channel,
                    width: width,
                    compact: compact,
                    drive: drive
                )
            }

            VStack(spacing: compact ? 6 : 8) {
                Text(title)
                    .font(.system(size: compact ? 9 : 10, weight: .heavy, design: .monospaced))
                    .foregroundStyle(ProMixerDeckView.labelGreen.opacity(0.8))
                    .frame(maxWidth: .infinity, alignment: channel == .left ? .leading : .trailing)

                content()
            }
            .frame(maxWidth: .infinity)

            if channel == .right {
                ProMixerVerticalVU(
                    visualizer: visualizer,
                    isPlaying: isPlaying,
                    channel: channel,
                    width: width,
                    compact: compact,
                    drive: drive
                )
            }
        }
    }
}

private struct ProMixerVerticalVU: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let channel: ProMixerChannel
    let width: CGFloat
    var compact: Bool = false
    var drive: Double = 0.4
    var segmentCount: Int = 24
    @Environment(\.colorScheme) private var colorScheme

    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        MixerMeterHost(
            visualizer: visualizer,
            isPlaying: isPlaying,
            channel: channel == .left ? .left : .right,
            drive: drive
        )
        .frame(width: width)
        .frame(maxHeight: .infinity)
        .background(
            (isLight ? Color(white: 0.92) : Color.black.opacity(0.85)),
            in: RoundedRectangle(cornerRadius: 4)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 4)
                .stroke(
                    isLight ? Color.black.opacity(0.10) : Color.white.opacity(0.1),
                    lineWidth: 0.5
                )
        }
        .accessibilityHidden(true)
        .opacity(segmentCount > 0 && !compact || compact ? 1 : 1)
    }
}

// MARK: - Master section (center)

private struct ProMixerMasterSection: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let intensity: Double
    let bandCount: Int
    var barScale: Double = 1.0
    var speed: Double = 1.0
    var sideVUSegments: Int = 24
    let compactMixer: Bool
    let effectsActive: Bool
    @Environment(\.colorScheme) private var colorScheme

    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Text("MASTER")
                    .font(.system(size: 11, weight: .heavy, design: .monospaced))
                    .foregroundStyle(ProMixerDeckView.labelGreen)
                    .kerning(1.2)
                Spacer()
                ProMixerNumericDisplay(visualizer: visualizer, isPlaying: isPlaying)
            }

            if effectsActive {
                IslandBarsHost(
                    visualizer: visualizer,
                    isPlaying: isPlaying,
                    compact: false,
                    prominent: true
                )
                .frame(height: 40)
                .padding(.horizontal, 8)
                .background(Color.black.opacity(0.45), in: RoundedRectangle(cornerRadius: 6))
                .overlay {
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
                }

                WinampSpectrumHost(
                    visualizer: visualizer,
                    isPlaying: isPlaying,
                    intensity: intensity,
                    bandCount: bandCount,
                    barScale: barScale,
                    speed: speed,
                    compact: compactMixer,
                    lightAppearance: isLight
                )
                .frame(minHeight: compactMixer ? 180 : 220)
                .frame(maxHeight: .infinity)
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "waveform.path.ecg")
                        .font(.title)
                        .foregroundStyle(ProMixerDeckView.labelGreen.opacity(0.35))
                    Text("Włącz efekty · Spectrum")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(EOSTheme.textMuted)
                }
                .frame(maxWidth: .infinity, minHeight: 180)
                .background(Color.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
            }

            ProMixerStereoBridge(visualizer: visualizer, isPlaying: isPlaying)
        }
    }
}

private struct ProMixerNumericDisplay: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 0.25, paused: !isPlaying)) { _ in
            let frame = visualizer.snapshot(isPlaying: isPlaying)
            let db = isPlaying ? Int(-36 + frame.level * 36) : -60
            Text(String(format: "%+3d dB", db))
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(ProMixerDeckView.labelAmber)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.black.opacity(0.65), in: RoundedRectangle(cornerRadius: 3))
                .overlay {
                    RoundedRectangle(cornerRadius: 3)
                        .stroke(ProMixerDeckView.labelAmber.opacity(0.25), lineWidth: 0.5)
                }
        }
    }
}

private struct ProMixerStereoBridge: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    var compact: Bool = false

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 16, paused: !isPlaying)) { _ in
            let frame = visualizer.snapshot(isPlaying: isPlaying)
            HStack(spacing: compact ? 4 : 6) {
                stereoBar(level: frame.bass, label: "L")
                stereoBar(level: (frame.bass + frame.treble) / 2, label: "M")
                stereoBar(level: frame.treble, label: "R")
            }
        }
    }

    private func stereoBar(level: Double, label: String) -> some View {
        let norm = WinampSpectrumStyle.quantizeLevel(isPlaying ? level : level * 0.1)
        return VStack(spacing: compact ? 2 : 3) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color(white: 0.08))
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [ProMixerDeckView.labelGreen, ProMixerDeckView.labelAmber, ProMixerDeckView.labelRed],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: max(4, geo.size.width * norm))
                }
            }
            .frame(height: compact ? 5 : 6)
            Text(label)
                .font(.system(size: compact ? 7 : 8, weight: .heavy, design: .monospaced))
                .foregroundStyle(Color.white.opacity(0.45))
        }
    }
}

// MARK: - Beat chase strip

private struct ProMixerBeatChase: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    var compact: Bool = false

    private var ledCount: Int { compact ? 12 : 20 }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 14, paused: !isPlaying)) { timeline in
            let frame = visualizer.snapshot(isPlaying: isPlaying)
            let beat = frame.beat
            let energy = frame.energy
            let t = timeline.date.timeIntervalSinceReferenceDate
            let chase = isPlaying ? Int(t * 8) % ledCount : 0

            HStack(spacing: compact ? 3 : 4) {
                ForEach(0..<ledCount, id: \.self) { index in
                    let near = abs(index - chase) <= 1
                    let lit = isPlaying && (near || (beat > 0.6 && index % 3 == chase % 3))
                    Circle()
                        .fill(
                            lit
                                ? ProMixerDeckView.labelGreen.opacity(near ? 1 : 0.55 + energy * 0.3)
                                : Color(white: 0.07)
                        )
                        .frame(width: compact ? 6 : 7, height: compact ? 6 : 7)
                        .shadow(color: lit ? ProMixerDeckView.labelGreen.opacity(0.6) : .clear, radius: 3)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, compact ? 6 : 8)
            .padding(.horizontal, 10)
            .background {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(Color.black.opacity(0.65))
                    .overlay {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
                    }
            }
        }
    }
}

// MARK: - Spectrum bar count / size / speed

private struct ProMixerSpectrumTuneStrip: View {
    @EnvironmentObject private var ui: UIPreferences
    @Environment(\.colorScheme) private var colorScheme
    var compact: Bool = true

    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        HStack(spacing: compact ? 8 : 12) {
            Picker("Słupki", selection: $ui.playerSpectrumBandCount) {
                Text("16").tag(16)
                Text("24").tag(24)
                Text("32").tag(32)
            }
            .pickerStyle(.segmented)
            .controlSize(.small)
            .frame(maxWidth: compact ? 132 : 160)

            miniSlider(
                icon: "arrow.left.and.right",
                value: $ui.playerSpectrumBarScale,
                range: 0.5...1.5,
                accessibility: "Wielkość słupków"
            )

            miniSlider(
                icon: "hare.fill",
                value: $ui.playerSpectrumSpeed,
                range: 0.4...1.6,
                accessibility: "Szybkość słupków"
            )
        }
        .padding(.horizontal, compact ? 8 : 12)
        .padding(.vertical, compact ? 5 : 8)
        .background {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: isLight
                            ? [Color.white, Color(white: 0.95)]
                            : [Color(white: 0.12), Color(white: 0.06)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: isLight
                                    ? [Color.white, Color.black.opacity(0.07)]
                                    : [Color.white.opacity(0.14), Color.white.opacity(0.04)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 1
                        )
                }
        }
        .tint(ProMixerDeckView.labelGreen)
    }

    private func miniSlider(
        icon: String,
        value: Binding<Double>,
        range: ClosedRange<Double>,
        accessibility: String
    ) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(ProMixerDeckView.labelGreen.opacity(0.9))
                .frame(width: 14)
            Slider(value: value, in: range)
                .controlSize(.mini)
        }
        .accessibilityLabel(accessibility)
    }
}

// MARK: - Effect mode strip (ON + presets with LED)

/// Wybór efektu w stylu Apple: kapsuła z przesuwanym podświetleniem + przełączniki zasilania i stroboskopu.
/// Lekkie wypełnienia zamiast rozmycia materiałem (rozmycie zacinało player przy animacjach).
struct ProMixerControlStrip: View {
    @EnvironmentObject private var ui: UIPreferences
    @Environment(\.colorScheme) private var colorScheme
    var compact: Bool = false
    @Namespace private var selection

    private var isLight: Bool { colorScheme == .light }
    private var powered: Bool { ui.playerMixerPowered }
    private var height: CGFloat { compact ? 36 : 42 }

    private struct ModeItem: Identifiable {
        let preset: PlayerVisualPreset
        let title: String
        let icon: String
        var id: String { preset.rawValue }
    }

    private let modes: [ModeItem] = [
        ModeItem(preset: .vinyl, title: "Winyl", icon: "opticaldisc.fill"),
        ModeItem(preset: .cover, title: "Okładka", icon: "square.stack.fill"),
        ModeItem(preset: .spectrum, title: "EQ", icon: "waveform")
    ]

    var body: some View {
        HStack(spacing: compact ? 8 : 12) {
            roundToggle(
                systemName: "power",
                active: powered,
                label: powered ? "Wyłącz efekty" : "Włącz efekty"
            ) {
                ui.playerMixerPowered.toggle()
            }

            HStack(spacing: 0) {
                ForEach(modes) { item in
                    let mode = item.preset
                    let active = powered && ui.playerVisualPreset == mode
                    Button {
                        ui.playerVisualPreset = mode
                        ui.playerMixerPowered = true
                    } label: {
                        Label(item.title, systemImage: item.icon)
                            .labelStyle(.titleAndIcon)
                            .font(.system(size: compact ? 12 : 13, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                            .foregroundStyle(active ? EOSTheme.textPrimary : EOSTheme.textSecondary)
                            .frame(maxWidth: .infinity)
                            .frame(height: height - 6)
                            .background {
                                if active {
                                    Capsule()
                                        .fill(isLight ? Color.white : Color.white.opacity(0.16))
                                        .shadow(color: .black.opacity(isLight ? 0.12 : 0.3), radius: 4, y: 2)
                                        .matchedGeometryEffect(id: "mode", in: selection)
                                }
                            }
                            .contentShape(Capsule())
                    }
                    .buttonStyle(EOSPressableStyle(pressedScale: 0.95))
                    .sensoryFeedback(.selection, trigger: active)
                }
            }
            .padding(3)
            .background(Capsule().fill(Color.primary.opacity(isLight ? 0.06 : 0.09)))
            .overlay(Capsule().strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5))
            .animation(.spring(response: 0.34, dampingFraction: 0.8), value: ui.playerVisualPreset)
            .animation(.spring(response: 0.34, dampingFraction: 0.8), value: powered)

            roundToggle(
                systemName: "light.beacon.max.fill",
                active: powered && ui.playerStrobeEnabled,
                label: "Stroboskop"
            ) {
                ui.playerStrobeEnabled.toggle()
                ui.playerMixerPowered = true
            }
        }
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity)
    }

    private func roundToggle(systemName: String, active: Bool, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: compact ? 14 : 16, weight: .semibold))
                .foregroundStyle(active ? Color.white : EOSTheme.textSecondary)
                .frame(width: height, height: height)
                .background(
                    Circle().fill(active ? AnyShapeStyle(EOSTheme.accent) : AnyShapeStyle(Color.primary.opacity(isLight ? 0.06 : 0.09)))
                )
                .overlay(Circle().strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5))
                .contentTransition(.symbolEffect(.replace))
                .animation(.spring(response: 0.3, dampingFraction: 0.75), value: active)
        }
        .buttonStyle(EOSPressableStyle(pressedScale: 0.9))
        .sensoryFeedback(.impact(weight: .light), trigger: active)
        .accessibilityLabel(label)
    }
}

private struct ProMixerMasterPowerButton: View {
    @Binding var isOn: Bool
    var compact: Bool = false
    @Environment(\.colorScheme) private var colorScheme

    private var isLight: Bool { colorScheme == .light }
    private var knob: CGFloat { compact ? 42 : 52 }

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
            withAnimation(.spring(response: 0.32, dampingFraction: 0.7)) {
                isOn.toggle()
            }
        } label: {
            VStack(spacing: compact ? 3 : 5) {
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: isLight
                                    ? [Color.white, Color(white: 0.9), Color(white: 0.82)]
                                    : [Color(white: 0.24), Color(white: 0.08), Color.black],
                                center: .topLeading,
                                startRadius: 2,
                                endRadius: knob * 0.55
                            )
                        )
                        .frame(width: knob, height: knob)
                        .overlay {
                            Circle()
                                .stroke(
                                    LinearGradient(
                                        colors: isLight
                                            ? [Color.white, Color.black.opacity(0.1)]
                                            : [Color.white.opacity(0.3), Color.white.opacity(0.05)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 1.5
                                )
                        }
                        .shadow(color: .black.opacity(isLight ? 0.12 : 0.45), radius: isLight ? 8 : 10, y: 4)
                        .shadow(color: (isOn ? ProMixerDeckView.labelGreen : Color.clear).opacity(0.45), radius: 12, y: 0)

                    Circle()
                        .stroke(isOn ? ProMixerDeckView.labelGreen.opacity(0.85) : Color.secondary.opacity(0.25), lineWidth: 2.5)
                        .frame(width: knob * 0.77, height: knob * 0.77)

                    Image(systemName: "power")
                        .font(.system(size: compact ? 14 : 16, weight: .bold))
                        .foregroundStyle(isOn ? ProMixerDeckView.labelGreen : (isLight ? Color.secondary : Color.white.opacity(0.4)))

                    Circle()
                        .fill(isOn ? ProMixerDeckView.labelGreen : (isLight ? Color(white: 0.75) : Color(white: 0.15)))
                        .frame(width: compact ? 7 : 8, height: compact ? 7 : 8)
                        .shadow(color: isOn ? ProMixerDeckView.labelGreen.opacity(0.95) : .clear, radius: 5)
                        .offset(x: knob * 0.31, y: -knob * 0.31)
                }

                Text(isOn ? "ON" : "OFF")
                    .font(.system(size: compact ? 8 : 9, weight: .heavy, design: .monospaced))
                    .foregroundStyle(isOn ? ProMixerDeckView.labelGreen : (isLight ? Color.secondary : Color.white.opacity(0.45)))
            }
        }
        .buttonStyle(TransportPressStyle())
        .accessibilityLabel(isOn ? "Wyłącz efekty" : "Włącz efekty")
    }
}

// MARK: - Transport deck

struct ProMixerTransportDeck: View {
    @ObservedObject var engine: MusicPlaybackEngine
    let playButtonSize: CGFloat
    var tight: Bool = false
    /// Deck bez własnej obudowy — rodzic (dolna konsola playera) dostarcza tło.
    var bare: Bool = false

    @Environment(\.colorScheme) private var colorScheme
    @State private var backTaps = 0
    @State private var forwardTaps = 0
    @State private var toggleTaps = 0

    private var isLight: Bool { colorScheme == .light }

    /// Jak w Apple Music: duże, czyste glify — bez kul i pastylek. Shuffle i powtarzanie
    /// mniejsze, na skrajach, z akcentem gdy aktywne.
    var body: some View {
        HStack(spacing: 0) {
            modeButton("shuffle", active: engine.shuffleEnabled, label: engine.shuffleEnabled ? "Wyłącz losowo" : "Losowo") {
                engine.toggleShuffle()
            }
            Spacer(minLength: 4)
            skipButton("backward.fill", taps: backTaps, label: "Poprzedni") {
                backTaps += 1
                Task { await engine.skipPrevious() }
            }
            Spacer(minLength: 4)
            playPauseButton
            Spacer(minLength: 4)
            skipButton("forward.fill", taps: forwardTaps, label: "Następny") {
                forwardTaps += 1
                Task { await engine.skipNext() }
            }
            Spacer(minLength: 4)
            modeButton(engine.repeatMode.icon, active: engine.repeatMode != .off, label: "Powtarzanie: \(engine.repeatMode.label)") {
                engine.cycleRepeatMode()
            }
        }
        .foregroundStyle(EOSTheme.textPrimary)
        .padding(.horizontal, 8)
        .padding(.vertical, tight ? 4 : 10)
        .background {
            if !bare {
                deckChassis
            }
        }
        .padding(.vertical, tight ? 2 : 4)
        .sensoryFeedback(.impact(weight: .light), trigger: backTaps)
        .sensoryFeedback(.impact(weight: .light), trigger: forwardTaps)
        .sensoryFeedback(.impact(weight: .medium), trigger: toggleTaps)
    }

    // MARK: Play / pause

    private var playPauseButton: some View {
        Button {
            toggleTaps += 1
            engine.togglePlayPause()
        } label: {
            ZStack {
                if engine.isLoading {
                    ProgressView()
                        .controlSize(.large)
                        .tint(EOSTheme.textPrimary)
                        .transition(.opacity.combined(with: .scale(scale: 0.6)))
                } else {
                    Image(systemName: engine.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: playButtonSize * 0.62, weight: .bold))
                        .foregroundStyle(EOSTheme.textPrimary)
                        .contentTransition(.symbolEffect(.replace.downUp.byLayer))
                        .shadow(color: .black.opacity(isLight ? 0.08 : 0.35), radius: 8, y: 3)
                        .transition(.opacity.combined(with: .scale(scale: 0.6)))
                }
            }
            .frame(width: playButtonSize + 12, height: playButtonSize + 12)
            .contentShape(Circle())
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: engine.isLoading)
        }
        .buttonStyle(EOSGlyphPressStyle(highlightDiameter: playButtonSize + 18))
        .disabled(engine.isLoading)
        .accessibilityLabel(engine.isPlaying ? "Pauza" : "Odtwarzaj")
    }

    // MARK: Przeskok — strzałki „odbijają” w kierunku ruchu

    private func skipButton(_ systemName: String, taps: Int, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: playButtonSize * 0.42, weight: .semibold))
                .foregroundStyle(EOSTheme.textPrimary)
                .symbolEffect(.bounce.down.byLayer, value: taps)
                .frame(width: playButtonSize, height: playButtonSize)
                .contentShape(Circle())
        }
        .buttonStyle(EOSGlyphPressStyle(highlightDiameter: playButtonSize + 4))
        .accessibilityLabel(label)
    }

    // MARK: Losowo / powtarzanie

    private func modeButton(
        _ systemName: String,
        active: Bool,
        label: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(active ? EOSTheme.accent : EOSTheme.textSecondary)
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.bounce, value: active)
                .frame(width: 40, height: 40)
                .background {
                    Circle()
                        .fill(EOSTheme.accent.opacity(active ? 0.14 : 0))
                }
                .contentShape(Circle())
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: active)
        }
        .buttonStyle(EOSGlyphPressStyle(highlightDiameter: 42))
        .sensoryFeedback(.selection, trigger: active)
        .accessibilityLabel(label)
    }

    private var deckChassis: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(
                isLight
                    ? AnyShapeStyle(
                        LinearGradient(
                            colors: [Color.white, Color(white: 0.96)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    : AnyShapeStyle(Color.black.opacity(0.55))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(
                        isLight ? Color.black.opacity(0.06) : Color.white.opacity(0.1),
                        lineWidth: isLight ? 1 : 0.5
                    )
            }
            .shadow(color: .black.opacity(isLight ? 0.1 : 0.3), radius: 14, y: 8)
    }
}

/// Sprężysty docisk przycisków transportu — fizyczna reakcja jak na sprzęcie DJ.
struct TransportPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.88 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.spring(response: 0.28, dampingFraction: 0.55), value: configuration.isPressed)
    }
}


// MARK: - Wskaźniki szerokiego paska (iPad)

/// Bieżące wyjście audio — aktualizowane przy każdej zmianie trasy (słuchawki, BT, auto, AirPlay).
@MainActor
final class AudioRouteMonitor: ObservableObject {
    enum Kind: CaseIterable { case speaker, headphones, bluetooth, car, airplay }
    static let shared = AudioRouteMonitor()
    @Published private(set) var kind: Kind = .speaker
    private var token: NSObjectProtocol?

    private init() {
        refresh()
        token = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
    }

    func refresh() {
        let port = AVAudioSession.sharedInstance().currentRoute.outputs.first?.portType
        switch port {
        case .some(.airPlay): kind = .airplay
        case .some(.carAudio): kind = .car
        case .some(.bluetoothA2DP), .some(.bluetoothLE), .some(.bluetoothHFP): kind = .bluetooth
        case .some(.headphones), .some(.usbAudio), .some(.lineOut): kind = .headphones
        default: kind = .speaker
        }
    }
}

/// Mierniki L/R z 16 segmentów LED (zielony → bursztyn → czerwony), z prawdziwych kanałów.
private struct StereoLEDMeter: View {
    let left: Double
    let right: Double
    let isLight: Bool
    private let segments = 16

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            row("L", left)
            row("R", right)
        }
        .accessibilityLabel("Poziom lewy \(Int(left * 100)) procent, prawy \(Int(right * 100)) procent")
    }

    private func row(_ label: String, _ level: Double) -> some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.system(size: 7, weight: .heavy, design: .rounded))
                .foregroundStyle(isLight ? Color.black.opacity(0.45) : Color.white.opacity(0.45))
                .frame(width: 7)
            HStack(spacing: 2) {
                ForEach(0..<segments, id: \.self) { i in
                    let threshold = Double(i + 1) / Double(segments)
                    let lit = level >= threshold - 0.0001
                    let color = segColor(i)
                    RoundedRectangle(cornerRadius: 1, style: .continuous)
                        .fill(lit ? color : color.opacity(isLight ? 0.16 : 0.13))
                        .frame(width: 6, height: 5)
                        .brightness(lit ? 0.08 : 0)
                }
            }
        }
    }

    private func segColor(_ i: Int) -> Color {
        if i >= segments - 2 { return ProMixerDeckView.labelRed }
        if i >= segments - 5 { return ProMixerDeckView.labelAmber }
        return ProMixerDeckView.labelGreen
    }
}

/// Gdzie gra dźwięk: SPK / HP / BT / CAR / AIR — świeci aktualne wyjście.
private struct RouteLEDStrip: View {
    let kind: AudioRouteMonitor.Kind
    let isLight: Bool

    var body: some View {
        HStack(spacing: 6) {
            ForEach(AudioRouteMonitor.Kind.allCases, id: \.self) { item in
                ProMixerLED(label: label(item), color: Color(red: 0.25, green: 0.7, blue: 1.0), intensity: item == kind ? 1 : 0)
            }
        }
    }

    private func label(_ kind: AudioRouteMonitor.Kind) -> String {
        switch kind {
        case .speaker: return "SPK"
        case .headphones: return "HP"
        case .bluetooth: return "BT"
        case .car: return "CAR"
        case .airplay: return "AIR"
        }
    }
}

/// NET: mruga na bursztynowo, gdy stream się buforuje; zgaszona, gdy dane płyną.
private struct NetLED: View {
    @ObservedObject var flags: PlaybackStatusFlags

    var body: some View {
        TimelineView(.animation(minimumInterval: 0.25, paused: !flags.isBuffering)) { context in
            let blink = Int(context.date.timeIntervalSinceReferenceDate * 4) % 2 == 0
            ProMixerLED(label: "NET", color: ProMixerDeckView.labelAmber, intensity: flags.isBuffering ? (blink ? 1 : 0.25) : 0)
        }
    }
}

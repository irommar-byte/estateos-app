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
    let compactMixer: Bool
    let queueLabel: String
    var onQueueTap: (() -> Void)? = nil
    let onServer: Bool
    let effectsActive: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    let artworkURL: URL?
    let fallbackArtwork: UIImage?
    let canvasSize: CGFloat
    var spectrumHeight: CGFloat = 150
    @ViewBuilder var meta: () -> Meta
    @ViewBuilder var status: () -> Status
    @ViewBuilder var storage: () -> Storage

    private var live: Bool { isPlaying && !isLoading }

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
                                    drive: drive
                                )
                                .frame(width: vuW, height: max(96, spectrumHeight))

                                WinampSpectrumHost(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    intensity: intensity,
                                    bandCount: bandCount,
                                    compact: rowGeo.size.width < 380
                                )
                                .frame(maxWidth: .infinity)
                                .frame(height: max(96, spectrumHeight))

                                ProMixerVerticalVU(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    channel: .right,
                                    width: vuW,
                                    compact: true,
                                    drive: drive
                                )
                                .frame(width: vuW, height: max(96, spectrumHeight))
                            }
                        }
                        .frame(height: max(108, spectrumHeight + 8))
                        .padding(8)
                        .background {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color.black.opacity(0.88))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(Color.white.opacity(0.08), lineWidth: 0.8)
                                }
                        }

                        ProMixerStereoBridge(visualizer: visualizer, isPlaying: live)
                    }
                }
                .padding(14)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            storage()

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
                isPlaying: live,
                preset: preset,
                policy: policy,
                canvasSize: canvasSize
            )
        } else {
            ArtworkImage(
                url: artworkURL,
                size: canvasSize * 0.92,
                cornerRadius: 14,
                allowAnimated: true,
                fallbackImage: fallbackArtwork
            )
            .shadow(color: EOSTheme.accent.opacity(0.16), radius: 12, y: 6)
        }
    }
}

/// Kompaktowa konsola — iPhone. Wszystko w jednym ekranie, bez scrolla i overlapów.
struct ProMixerNarrowConsole<Meta: View, Status: View, Storage: View>: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let isLoading: Bool
    let intensity: Double
    let drive: Double
    let bandCount: Int
    let compactMixer: Bool
    let queueLabel: String
    var onQueueTap: (() -> Void)? = nil
    let onServer: Bool
    let effectsActive: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    let artworkURL: URL?
    let fallbackArtwork: UIImage?
    let canvasSize: CGFloat
    var spectrumHeight: CGFloat = 110
    var expandSpectrum: Bool = false
    @ViewBuilder var meta: () -> Meta
    @ViewBuilder var status: () -> Status
    @ViewBuilder var storage: () -> Storage

    private var live: Bool { isPlaying && !isLoading }

    var body: some View {
        VStack(spacing: compactMixer ? 6 : 8) {
            ProMixerStatusRail(
                visualizer: visualizer,
                isPlaying: live,
                queueLabel: queueLabel,
                onQueueTap: onQueueTap,
                onServer: onServer,
                drive: drive
            )

            ProMixerChassis {
                VStack(spacing: compactMixer ? 8 : 10) {
                    artworkThumb
                        .frame(width: canvasSize, height: canvasSize)
                        .frame(maxWidth: .infinity)
                        .clipped()

                    VStack(spacing: 4) {
                        meta()
                        status()
                    }
                    .frame(maxWidth: .infinity)

                    if preset.showsMixer {
                        GeometryReader { rowGeo in
                            let vuW = min(28, max(14, rowGeo.size.width * 0.068))
                            HStack(alignment: .bottom, spacing: rowGeo.size.width < 360 ? 4 : 6) {
                                ProMixerVerticalVU(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    channel: .left,
                                    width: vuW,
                                    compact: true,
                                    drive: drive
                                )
                                .frame(width: vuW, height: max(120, spectrumHeight))

                                WinampSpectrumHost(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    intensity: intensity,
                                    bandCount: bandCount,
                                    compact: compactMixer || rowGeo.size.width < 380
                                )
                                .frame(maxWidth: .infinity)
                                .frame(height: max(120, spectrumHeight))

                                ProMixerVerticalVU(
                                    visualizer: visualizer,
                                    isPlaying: live,
                                    channel: .right,
                                    width: vuW,
                                    compact: true,
                                    drive: drive
                                )
                                .frame(width: vuW, height: max(120, spectrumHeight))
                            }
                        }
                        .frame(height: max(128, spectrumHeight + 8))
                        .padding(8)
                        .background {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color.black.opacity(0.88))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(Color.white.opacity(0.08), lineWidth: 0.8)
                                }
                        }

                        ProMixerStereoBridge(visualizer: visualizer, isPlaying: live)
                    }
                }
                .padding(compactMixer ? 10 : 12)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            ProMixerControlStrip(compact: true)
        }
        .padding(4)
        .background { ProMixerStageBackground() }
    }

    @ViewBuilder
    private var artworkThumb: some View {
        if effectsActive {
            PlayerHeroArtworkBridge(
                artworkURL: artworkURL,
                fallbackImage: fallbackArtwork,
                isPlaying: live,
                preset: preset,
                policy: policy,
                canvasSize: canvasSize
            )
        } else {
            ArtworkImage(
                url: artworkURL,
                size: canvasSize * 0.92,
                cornerRadius: 14,
                allowAnimated: true,
                fallbackImage: fallbackArtwork
            )
        }
    }
}

// Bridge — FullPlayerView types are private; duplicate minimal hero call via public ArtworkImage + preset routing in host.
private struct PlayerHeroArtworkBridge: View {
    let artworkURL: URL?
    var fallbackImage: UIImage?
    let isPlaying: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
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
                    fallbackImage: fallbackImage
                )
            } else if preset == .vinyl {
                ProMixerVinylThumb(
                    artworkURL: artworkURL,
                    fallbackImage: fallbackImage,
                    isPlaying: isPlaying,
                    size: canvasSize
                )
            } else {
                MixerBreathingCover(
                    artworkURL: artworkURL,
                    fallbackImage: fallbackImage,
                    isPlaying: isPlaying,
                    canvasSize: canvasSize
                )
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

    var body: some View {
        MixerContinuousSpin(isSpinning: isPlaying, secondsPerRevolution: 11) {
            ZStack {
                // Picture Disc winyl — cała okładka
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
                    // Przerywany pierścień na środku
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [Color.white.opacity(0.9), Color.white.opacity(0.3)],
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
                .shadow(color: .black.opacity(0.38), radius: 8, y: 4)
            }
        }
    }
}

/// Reliable continuous spin — starts on appear even if `isSpinning` is already
/// true (a plain `.animation(value:)` never fires in that case, so the disc
/// appears frozen). Resumes from the current angle instead of jumping.
private struct MixerContinuousSpin<Content: View>: View {
    let isSpinning: Bool
    let secondsPerRevolution: Double
    @ViewBuilder let content: Content
    @State private var angle: Double = 0

    var body: some View {
        content
            .rotationEffect(.degrees(angle))
            .onAppear { applySpin(isSpinning) }
            .onChange(of: isSpinning) { _, spinning in applySpin(spinning) }
    }

    private func applySpin(_ spinning: Bool) {
        if spinning {
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

// MARK: - Chassis

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
                                    ? [Color.white, Color(white: 0.96), Color(white: 0.92)]
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
                                    ? [Color.white, Color.black.opacity(0.06)]
                                    : [
                                        Color.white.opacity(0.28),
                                        Color.white.opacity(0.05),
                                        Color.black.opacity(0.55)
                                    ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1.2
                        )
                    if !isLight {
                        RoundedRectangle(cornerRadius: 15, style: .continuous)
                            .inset(by: 3)
                            .stroke(Color.black.opacity(0.45), lineWidth: 1)
                    }
                }
                .shadow(color: .black.opacity(isLight ? 0.1 : 0.55), radius: isLight ? 18 : 24, y: isLight ? 10 : 14)
                .shadow(color: EOSTheme.accent.opacity(isLight ? 0.04 : 0.08), radius: 40, y: 0)
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
                        ? [Color.white, Color(white: 0.97), Color(white: 0.94)]
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
                                ? [Color.white, Color.black.opacity(0.06), EOSTheme.accent.opacity(0.08)]
                                : [Color.white.opacity(0.12), Color.clear, EOSTheme.accent.opacity(0.15)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            }
            .shadow(color: .black.opacity(isLight ? 0.1 : 0.35), radius: isLight ? 16 : 28, y: isLight ? 8 : 16)
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

private struct ProMixerStatusRail: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let queueLabel: String
    var onQueueTap: (() -> Void)? = nil
    var onServer: Bool
    var drive: Double = 0.4
    @Environment(\.colorScheme) private var colorScheme

    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 12, paused: !isPlaying)) { _ in
            let frame = visualizer.snapshot(isPlaying: isPlaying)
            let beat = frame.beat
            let level = frame.level
            let bass = frame.bass
            let clipThreshold = max(0.55, 0.92 - drive * 0.38)
            let clip = level > clipThreshold || bass > clipThreshold

            HStack(spacing: 6) {
                HStack(spacing: 8) {
                    ProMixerLED(label: "BEAT", color: ProMixerDeckView.labelGreen, lit: isPlaying && beat > 0.4, blink: beat > 0.7)
                    ProMixerLED(label: "RYTM", color: ProMixerDeckView.labelAmber, lit: isPlaying && bass > 0.25, blink: bass > 0.55)
                    ProMixerLED(label: "EOS", color: EOSTheme.accent, lit: onServer, blink: onServer && beat > 0.4)
                }

                Spacer(minLength: 2)

                queueControl(compact: false)

                Spacer(minLength: 2)

                HStack(spacing: 8) {
                    ProMixerLED(label: "OUT", color: ProMixerDeckView.labelGreen, lit: isPlaying && level > 0.04, blink: false)
                    ProMixerLED(label: "CLIP", color: ProMixerDeckView.labelRed, lit: clip, blink: clip)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: isLight
                                ? [Color.white, Color(white: 0.94)]
                                : [Color(white: 0.12), Color(white: 0.06)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(
                                LinearGradient(
                                    colors: isLight
                                        ? [Color.white, Color.black.opacity(0.08)]
                                        : [Color.white.opacity(0.18), Color.white.opacity(0.04)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                ),
                                lineWidth: 1
                            )
                    }
                    .shadow(color: .black.opacity(isLight ? 0.08 : 0.32), radius: isLight ? 4 : 6, y: isLight ? 2 : 3)
            }
        }
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
            RoundedRectangle(cornerRadius: 6)
                .fill(isLight ? Color(white: 0.92) : Color.black.opacity(0.7))
                .overlay {
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(ProMixerDeckView.labelGreen.opacity(isLight ? 0.35 : 0.25), lineWidth: 0.8)
                }
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

private struct ProMixerLED: View {
    let label: String
    let color: Color
    let lit: Bool
    var blink: Bool

    @State private var phase = false

    var body: some View {
        VStack(spacing: 3) {
            ZStack {
                Circle()
                    .stroke(Color.primary.opacity(0.15), lineWidth: 0.8)
                    .frame(width: 12, height: 12)

                Circle()
                    .fill(
                        RadialGradient(
                            colors: lit
                                ? [color.opacity(blink && phase ? 1 : 0.88), color.opacity(0.35)]
                                : [Color(uiColor: .tertiarySystemFill), Color(uiColor: .quaternarySystemFill)],
                            center: .center,
                            startRadius: 0,
                            endRadius: 6
                        )
                    )
                    .frame(width: 9, height: 9)
                    .shadow(color: lit ? color.opacity(blink && phase ? 0.95 : 0.55) : .clear, radius: 5)
            }

            Text(label)
                .font(.system(size: 7.5, weight: .bold, design: .monospaced))
                .foregroundStyle(lit ? Color.primary.opacity(0.85) : Color.secondary.opacity(0.55))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(minWidth: 26)
        .onAppear {
            guard blink else { return }
            withAnimation(.easeInOut(duration: 0.12).repeatForever(autoreverses: true)) {
                phase = true
            }
        }
        .onChange(of: blink) { _, active in
            if active {
                withAnimation(.easeInOut(duration: 0.12).repeatForever(autoreverses: true)) {
                    phase = true
                }
            } else {
                phase = false
            }
        }
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

    var body: some View {
        GeometryReader { geo in
            let segments = WinampSpectrumStyle.segmentCount
            let segmentH = max(3, min(compact ? 5 : 6, (geo.size.height - 8) / CGFloat(segments)))
            TimelineView(.animation(minimumInterval: 1.0 / 20, paused: !isPlaying)) { _ in
                let frame = visualizer.snapshot(isPlaying: isPlaying)
                let raw: Double = {
                    switch channel {
                    case .left: return frame.bass * (0.75 + drive * 0.35) + frame.beat * (0.2 + drive * 0.2)
                    case .right: return frame.treble * (0.75 + drive * 0.35) + frame.mid * (0.15 + drive * 0.15)
                    }
                }()
                let normalized = WinampSpectrumStyle.quantizeLevel(min(isPlaying ? raw : raw * 0.12, 1))
                let lit = Int(round(normalized * Double(segments)))

                VStack(spacing: 2) {
                    ForEach((0..<segments).reversed(), id: \.self) { segment in
                        let active = segment < lit
                        let isPeak = segment == lit && lit > 0
                        RoundedRectangle(cornerRadius: 1, style: .continuous)
                            .fill(
                                active
                                    ? WinampSpectrumStyle.barColor(segmentFromBottom: segment)
                                    : Color(white: 0.06)
                            )
                            .frame(height: segmentH)
                            .overlay {
                                if isPeak {
                                    RoundedRectangle(cornerRadius: 1, style: .continuous)
                                        .fill(WinampSpectrumStyle.peakColor(forLevel: normalized))
                                }
                            }
                            .shadow(color: active ? WinampSpectrumStyle.barColor(segmentFromBottom: segment).opacity(0.45) : .clear, radius: 2)
                    }
                }
                .padding(.horizontal, 4)
                .padding(.top, 4)
                .padding(.bottom, 2)
                .frame(width: width, height: geo.size.height, alignment: .bottom)
                .background(Color.black.opacity(0.85), in: RoundedRectangle(cornerRadius: 4))
                .overlay {
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                }
            }
        }
        .frame(width: width)
        .frame(maxHeight: .infinity, alignment: .bottom)
    }
}

// MARK: - Master section (center)

private struct ProMixerMasterSection: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let intensity: Double
    let bandCount: Int
    let compactMixer: Bool
    let effectsActive: Bool

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
                    compact: compactMixer
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

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 16, paused: !isPlaying)) { _ in
            let frame = visualizer.snapshot(isPlaying: isPlaying)
            HStack(spacing: 6) {
                stereoBar(level: frame.bass, label: "L")
                stereoBar(level: (frame.bass + frame.treble) / 2, label: "M")
                stereoBar(level: frame.treble, label: "R")
            }
        }
    }

    private func stereoBar(level: Double, label: String) -> some View {
        let norm = WinampSpectrumStyle.quantizeLevel(isPlaying ? level : level * 0.1)
        return VStack(spacing: 3) {
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
            .frame(height: 6)
            Text(label)
                .font(.system(size: 8, weight: .heavy, design: .monospaced))
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

// MARK: - Effect mode strip (ON + presets with LED)

struct ProMixerControlStrip: View {
    @EnvironmentObject private var ui: UIPreferences
    @Environment(\.colorScheme) private var colorScheme
    var compact: Bool = false

    private var isLight: Bool { colorScheme == .light }
    private var powered: Bool { ui.playerMixerPowered }

    var body: some View {
        HStack(spacing: compact ? 8 : 12) {
            ProMixerMasterPowerButton(isOn: $ui.playerMixerPowered)

            Rectangle()
                .fill(isLight ? Color.black.opacity(0.08) : Color.white.opacity(0.12))
                .frame(width: 1, height: compact ? 42 : 48)

            HStack(spacing: compact ? 6 : 8) {
                effectButton(.vinyl, title: "WINYL", icon: "opticaldisc.fill", led: ProMixerDeckView.labelAmber)
                effectButton(.cover, title: "OKŁADKA", icon: "square.stack.3d.up.fill", led: EOSTheme.accentSecondary)
                effectButton(.spectrum, title: "EQ", icon: "waveform.path.ecg", led: ProMixerDeckView.labelGreen)
                strobeToggleButton()
            }
            .opacity(powered ? 1 : 0.45)
            .allowsHitTesting(powered)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, compact ? 10 : 14)
        .padding(.vertical, compact ? 8 : 10)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: isLight
                            ? [Color.white, Color(white: 0.95)]
                            : [Color(white: 0.14), Color(white: 0.07)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: isLight
                                    ? [Color.white, Color.black.opacity(0.07)]
                                    : [Color.white.opacity(0.16), Color.white.opacity(0.04)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 1
                        )
                }
                .shadow(color: .black.opacity(isLight ? 0.08 : 0.35), radius: isLight ? 8 : 10, y: isLight ? 3 : 4)
        }
    }

    private func effectButton(_ preset: PlayerVisualPreset, title: String, icon: String, led: Color) -> some View {
        let active = powered && ui.playerVisualPreset == preset
        return Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            withAnimation(.spring(response: 0.3, dampingFraction: 0.72)) {
                ui.playerVisualPreset = preset
                ui.playerMixerPowered = true
            }
        } label: {
            VStack(spacing: 5) {
                ZStack(alignment: .topTrailing) {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: isLight
                                    ? (active ? [led.opacity(0.16), led.opacity(0.06)] : [Color.white, Color(white: 0.93)])
                                    : (active ? [led.opacity(0.28), led.opacity(0.1)] : [Color(white: 0.18), Color(white: 0.08)]),
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: compact ? 54 : 62, height: compact ? 40 : 46)
                        .overlay {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(
                                    active ? led.opacity(0.55) : (isLight ? Color.black.opacity(0.06) : Color.white.opacity(0.1)),
                                    lineWidth: active ? 1.4 : 1
                                )
                        }
                        .shadow(color: active ? led.opacity(0.35) : .black.opacity(isLight ? 0.06 : 0.25), radius: active ? 8 : 3, y: 2)

                    Image(systemName: icon)
                        .font(.system(size: compact ? 14 : 16, weight: .semibold))
                        .foregroundStyle(active ? led : (isLight ? Color.secondary : Color.white.opacity(0.55)))
                        .frame(width: compact ? 54 : 62, height: compact ? 40 : 46)

                    // Dioda LED — zapala się gdy efekt aktywny
                    Circle()
                        .fill(active ? led : (isLight ? Color(white: 0.82) : Color(white: 0.18)))
                        .frame(width: 7, height: 7)
                        .shadow(color: active ? led.opacity(0.9) : .clear, radius: 4)
                        .offset(x: -6, y: 6)
                }

                Text(title)
                    .font(.system(size: 8, weight: .heavy, design: .monospaced))
                    .foregroundStyle(active ? led : (isLight ? Color.secondary : Color.white.opacity(0.45)))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .buttonStyle(TransportPressStyle())
        .accessibilityLabel("\(title)\(active ? ", włączony" : "")")
    }

    private func strobeToggleButton() -> some View {
        let active = powered && ui.playerStrobeEnabled
        let led = EOSTheme.accent
        return Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            withAnimation(.spring(response: 0.3, dampingFraction: 0.72)) {
                ui.playerStrobeEnabled.toggle()
                ui.playerMixerPowered = true
            }
        } label: {
            VStack(spacing: 5) {
                ZStack(alignment: .topTrailing) {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: isLight
                                    ? (active ? [led.opacity(0.16), led.opacity(0.06)] : [Color.white, Color(white: 0.93)])
                                    : (active ? [led.opacity(0.28), led.opacity(0.1)] : [Color(white: 0.18), Color(white: 0.08)]),
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: compact ? 54 : 62, height: compact ? 40 : 46)
                        .overlay {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(
                                    active ? led.opacity(0.55) : (isLight ? Color.black.opacity(0.06) : Color.white.opacity(0.1)),
                                    lineWidth: active ? 1.4 : 1
                                )
                        }
                        .shadow(color: active ? led.opacity(0.35) : .black.opacity(isLight ? 0.06 : 0.25), radius: active ? 8 : 3, y: 2)

                    Image(systemName: "light.beacon.max.fill")
                        .font(.system(size: compact ? 14 : 16, weight: .semibold))
                        .foregroundStyle(active ? led : (isLight ? Color.secondary : Color.white.opacity(0.55)))
                        .frame(width: compact ? 54 : 62, height: compact ? 40 : 46)

                    Circle()
                        .fill(active ? led : (isLight ? Color(white: 0.82) : Color(white: 0.18)))
                        .frame(width: 7, height: 7)
                        .shadow(color: active ? led.opacity(0.9) : .clear, radius: 4)
                        .offset(x: -6, y: 6)
                }

                Text("STROBO")
                    .font(.system(size: 8, weight: .heavy, design: .monospaced))
                    .foregroundStyle(active ? led : (isLight ? Color.secondary : Color.white.opacity(0.45)))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .buttonStyle(TransportPressStyle())
        .accessibilityLabel("Stroboskop\(active ? ", włączony" : "")")
    }
}

/// Duży, piękny przełącznik ON/OFF całej elektroniki efektów.
private struct ProMixerMasterPowerButton: View {
    @Binding var isOn: Bool
    @Environment(\.colorScheme) private var colorScheme

    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
            withAnimation(.spring(response: 0.32, dampingFraction: 0.7)) {
                isOn.toggle()
            }
        } label: {
            VStack(spacing: 5) {
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: isLight
                                    ? [Color.white, Color(white: 0.9), Color(white: 0.82)]
                                    : [Color(white: 0.24), Color(white: 0.08), Color.black],
                                center: .topLeading,
                                startRadius: 2,
                                endRadius: 28
                            )
                        )
                        .frame(width: 52, height: 52)
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

                    // Pierścień statusu
                    Circle()
                        .stroke(isOn ? ProMixerDeckView.labelGreen.opacity(0.85) : Color.secondary.opacity(0.25), lineWidth: 2.5)
                        .frame(width: 40, height: 40)

                    Image(systemName: "power")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(isOn ? ProMixerDeckView.labelGreen : (isLight ? Color.secondary : Color.white.opacity(0.4)))

                    // Mała dioda LED w rogu
                    Circle()
                        .fill(isOn ? ProMixerDeckView.labelGreen : (isLight ? Color(white: 0.75) : Color(white: 0.15)))
                        .frame(width: 8, height: 8)
                        .shadow(color: isOn ? ProMixerDeckView.labelGreen.opacity(0.95) : .clear, radius: 5)
                        .offset(x: 16, y: -16)
                }

                Text(isOn ? "ON" : "OFF")
                    .font(.system(size: 9, weight: .heavy, design: .monospaced))
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

    private var isLight: Bool { colorScheme == .light }

    var body: some View {
        HStack(spacing: tight ? 16 : 22) {
            transportButton("shuffle", active: engine.shuffleEnabled) {
                engine.toggleShuffle()
            }
            transportButton("backward.fill", size: .title3) {
                Task { await engine.skipPrevious() }
            }

            playPauseButton

            transportButton("forward.fill", size: .title3) {
                Task { await engine.skipNext() }
            }
            transportButton(engine.repeatMode.icon, active: engine.repeatMode != .off) {
                engine.cycleRepeatMode()
            }
        }
        .foregroundStyle(EOSTheme.textPrimary)
        .padding(.horizontal, 16)
        .padding(.vertical, tight ? 8 : 12)
        .background {
            if !bare {
                deckChassis
            }
        }
        .padding(.vertical, tight ? 2 : 4)
    }

    // MARK: Play / pause — wypukła „kula” z głębią 3D, adaptacyjna do motywu

    private var playPauseButton: some View {
        Button {
            engine.togglePlayPause()
        } label: {
            ZStack {
                Circle()
                    .fill(playSphereFill)
                    .frame(width: playButtonSize + 8, height: playButtonSize + 8)
                    .overlay {
                        // Górny błysk — efekt wypukłości.
                        Circle()
                            .stroke(
                                LinearGradient(
                                    colors: isLight
                                        ? [Color.white, Color.white.opacity(0.15)]
                                        : [Color.white.opacity(0.35), Color.white.opacity(0.08)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1.5
                            )
                    }
                    .overlay(alignment: .top) {
                        Ellipse()
                            .fill(Color.white.opacity(isLight ? 0.85 : 0.16))
                            .frame(width: playButtonSize * 0.62, height: playButtonSize * 0.28)
                            .blur(radius: 5)
                            .offset(y: 5)
                            .allowsHitTesting(false)
                    }
                    .shadow(
                        color: .black.opacity(isLight ? 0.16 : 0.5),
                        radius: isLight ? 12 : 10,
                        y: isLight ? 7 : 6
                    )
                    .shadow(color: EOSTheme.accent.opacity(engine.isPlaying ? 0.4 : 0.14), radius: 16, y: 4)

                if engine.isLoading {
                    ProgressView()
                        .controlSize(.large)
                        .tint(isLight ? EOSTheme.accent : .white)
                } else {
                    Image(systemName: engine.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: playButtonSize * 0.38, weight: .bold))
                        .foregroundStyle(playGlyphStyle)
                        .contentTransition(.symbolEffect(.replace.downUp.byLayer))
                        .offset(x: engine.isPlaying ? 0 : 2)
                        .shadow(color: EOSTheme.accent.opacity(isLight ? 0.25 : 0), radius: 6, y: 2)
                }
            }
            .scaleEffect(engine.isPlaying ? 1 : 0.97)
            .animation(EOSMotion.snappy, value: engine.isPlaying)
        }
        .buttonStyle(TransportPressStyle())
        .disabled(engine.isLoading)
        .accessibilityLabel(engine.isPlaying ? "Pauza" : "Odtwarzaj")
    }

    private var playSphereFill: some ShapeStyle {
        if isLight {
            // Biała, wypukła kula — pasuje do jasnego motywu zamiast czarnego krążka.
            return AnyShapeStyle(
                RadialGradient(
                    colors: [
                        Color.white,
                        Color(white: 0.97),
                        Color(white: 0.88)
                    ],
                    center: .topLeading,
                    startRadius: 4,
                    endRadius: playButtonSize + 6
                )
            )
        }
        return AnyShapeStyle(
            RadialGradient(
                colors: [
                    Color(white: 0.22),
                    Color(white: 0.08),
                    Color.black
                ],
                center: .topLeading,
                startRadius: 4,
                endRadius: playButtonSize
            )
        )
    }

    private var playGlyphStyle: some ShapeStyle {
        if isLight {
            return AnyShapeStyle(
                LinearGradient(
                    colors: [EOSTheme.accent, EOSTheme.accentSecondary],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
        }
        return AnyShapeStyle(Color.white)
    }

    // MARK: Boczne przyciski — miękkie, wypukłe pastylki

    private func transportButton(
        _ systemName: String,
        active: Bool = false,
        size: Font = .body,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(size.weight(.semibold))
                .foregroundStyle(active ? EOSTheme.accent : EOSTheme.textSecondary)
                .symbolEffect(.bounce, value: active)
                .frame(width: 42, height: 42)
                .background {
                    Circle()
                        .fill(sideButtonFill(active: active))
                        .overlay {
                            Circle()
                                .stroke(
                                    LinearGradient(
                                        colors: isLight
                                            ? [Color.white.opacity(0.9), Color.black.opacity(0.05)]
                                            : [Color.white.opacity(0.14), Color.white.opacity(0.02)],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    ),
                                    lineWidth: 1
                                )
                        }
                        .shadow(
                            color: .black.opacity(isLight ? 0.1 : 0.35),
                            radius: isLight ? 5 : 6,
                            y: isLight ? 3 : 4
                        )
                        .shadow(
                            color: active ? EOSTheme.accent.opacity(0.28) : .clear,
                            radius: 8,
                            y: 2
                        )
                }
        }
        .buttonStyle(TransportPressStyle())
    }

    private func sideButtonFill(active: Bool) -> some ShapeStyle {
        if isLight {
            return AnyShapeStyle(
                LinearGradient(
                    colors: active
                        ? [EOSTheme.accent.opacity(0.14), EOSTheme.accent.opacity(0.06)]
                        : [Color.white, Color(white: 0.93)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
        return AnyShapeStyle(
            LinearGradient(
                colors: active
                    ? [EOSTheme.accent.opacity(0.24), EOSTheme.accent.opacity(0.1)]
                    : [Color.white.opacity(0.1), Color.white.opacity(0.03)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
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

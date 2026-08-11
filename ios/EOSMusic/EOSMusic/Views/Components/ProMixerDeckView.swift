import SwiftUI

// MARK: - Pro DJ / rack mixer chrome

enum ProMixerDeckView {
    static let chassisFill = Color(red: 0.07, green: 0.07, blue: 0.08)
    static let bezelStroke = Color.white.opacity(0.14)
    static let screwColor = Color.white.opacity(0.22)
    static let labelGreen = Color(red: 0.35, green: 0.95, blue: 0.38)
    static let labelAmber = Color(red: 1, green: 0.72, blue: 0.08)
    static let labelRed = Color(red: 1, green: 0.22, blue: 0.18)
}

/// Symetryczna konsola DJ — iPad / szeroki player.
struct ProMixerWideConsole<Meta: View, Status: View, Storage: View>: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let isLoading: Bool
    let intensity: Double
    let drive: Double
    let bandCount: Int
    let compactMixer: Bool
    let queueLabel: String
    let onServer: Bool
    let effectsActive: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    let artworkURL: URL?
    let fallbackArtwork: UIImage?
    let canvasSize: CGFloat
    @ViewBuilder var meta: () -> Meta
    @ViewBuilder var status: () -> Status
    @ViewBuilder var storage: () -> Storage

    var body: some View {
        VStack(spacing: 12) {
            ProMixerStatusRail(
                visualizer: visualizer,
                isPlaying: isPlaying && !isLoading,
                queueLabel: queueLabel,
                onServer: onServer,
                drive: drive
            )

            ProMixerChassis {
                GeometryReader { geo in
                    let stacked = geo.size.width < 640
                    Group {
                        if stacked {
                            stackedDeck
                        } else {
                            horizontalDeck
                        }
                    }
                    .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
                }
                .frame(minHeight: compactMixer ? 300 : 360)
            }

            storage()
                .padding(.horizontal, 2)

            ProMixerControlStrip(
                visualizer: visualizer,
                isPlaying: isPlaying && !isLoading,
                drive: drive
            )

            ProMixerBeatChase(
                visualizer: visualizer,
                isPlaying: isPlaying && !isLoading
            )
        }
        .padding(10)
        .background { ProMixerStageBackground() }
    }

    private var horizontalDeck: some View {
        HStack(alignment: .top, spacing: 12) {
            ProMixerSideColumn(
                title: "DECK A",
                visualizer: visualizer,
                isPlaying: isPlaying && !isLoading,
                channel: .left,
                width: 48,
                drive: drive
            ) {
                artworkBlock
            }
            .frame(minWidth: 140, maxWidth: .infinity)

            ProMixerMasterSection(
                visualizer: visualizer,
                isPlaying: isPlaying && !isLoading,
                intensity: intensity,
                bandCount: bandCount,
                compactMixer: compactMixer,
                effectsActive: effectsActive
            )
            .frame(minWidth: 260, maxWidth: .infinity)
            .layoutPriority(2)

            ProMixerSideColumn(
                title: "INFO",
                visualizer: visualizer,
                isPlaying: isPlaying && !isLoading,
                channel: .right,
                width: 48,
                drive: drive
            ) {
                VStack(alignment: .leading, spacing: 10) {
                    meta()
                    status()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(minWidth: 160, maxWidth: .infinity)
        }
        .padding(14)
    }

    private var stackedDeck: some View {
        VStack(spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                ProMixerSideColumn(
                    title: "L",
                    visualizer: visualizer,
                    isPlaying: isPlaying && !isLoading,
                    channel: .left,
                    width: 40,
                    compact: true,
                    drive: drive
                ) {
                    artworkBlock.scaleEffect(0.92)
                }
                ProMixerSideColumn(
                    title: "R",
                    visualizer: visualizer,
                    isPlaying: isPlaying && !isLoading,
                    channel: .right,
                    width: 40,
                    compact: true,
                    drive: drive
                ) {
                    VStack(alignment: .leading, spacing: 8) {
                        meta()
                        status()
                    }
                }
            }
            ProMixerMasterSection(
                visualizer: visualizer,
                isPlaying: isPlaying && !isLoading,
                intensity: intensity,
                bandCount: bandCount,
                compactMixer: true,
                effectsActive: effectsActive
            )
        }
        .padding(12)
    }

    @ViewBuilder
    private var artworkBlock: some View {
        if effectsActive {
            PlayerHeroArtworkBridge(
                artworkURL: artworkURL,
                fallbackImage: fallbackArtwork,
                isPlaying: isPlaying && !isLoading,
                preset: preset,
                policy: policy,
                canvasSize: canvasSize
            )
        } else {
            ArtworkImage(
                url: artworkURL,
                size: canvasSize * 0.82,
                cornerRadius: 14,
                fallbackImage: fallbackArtwork
            )
            .shadow(color: EOSTheme.accent.opacity(0.18), radius: 14, y: 6)
        }
    }
}

/// Kompaktowa konsola — iPhone.
struct ProMixerNarrowConsole<Meta: View, Status: View, Storage: View>: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let isLoading: Bool
    let intensity: Double
    let drive: Double
    let bandCount: Int
    let compactMixer: Bool
    let queueLabel: String
    let onServer: Bool
    let effectsActive: Bool
    let preset: PlayerVisualPreset
    let policy: PlayerVisualPolicy
    let artworkURL: URL?
    let fallbackArtwork: UIImage?
    let canvasSize: CGFloat
    @ViewBuilder var meta: () -> Meta
    @ViewBuilder var status: () -> Status
    @ViewBuilder var storage: () -> Storage

    var body: some View {
        VStack(spacing: 12) {
            ProMixerStatusRail(
                visualizer: visualizer,
                isPlaying: isPlaying && !isLoading,
                queueLabel: queueLabel,
                onServer: onServer,
                drive: drive
            )

            ProMixerChassis {
                VStack(spacing: 14) {
                    artworkThumb
                        .frame(maxWidth: .infinity)

                    VStack(spacing: 8) {
                        meta()
                        status()
                    }
                    .frame(maxWidth: .infinity)

                    if effectsActive {
                        IslandBarsHost(
                            visualizer: visualizer,
                            isPlaying: isPlaying && !isLoading,
                            compact: false,
                            prominent: true
                        )
                        .frame(height: 34)

                        WinampSpectrumHost(
                            visualizer: visualizer,
                            isPlaying: isPlaying && !isLoading,
                            intensity: intensity,
                            bandCount: bandCount,
                            compact: compactMixer
                        )
                        .frame(height: compactMixer ? 168 : 196)

                        ProMixerStereoBridge(visualizer: visualizer, isPlaying: isPlaying && !isLoading)
                            .padding(.horizontal, 2)
                    }
                }
                .padding(14)
            }

            storage()

            ProMixerControlStrip(
                visualizer: visualizer,
                isPlaying: isPlaying && !isLoading,
                drive: drive,
                compact: true
            )

            ProMixerBeatChase(
                visualizer: visualizer,
                isPlaying: isPlaying && !isLoading,
                compact: true
            )
        }
        .padding(8)
        .background { ProMixerStageBackground() }
    }

    @ViewBuilder
    private var artworkThumb: some View {
        if effectsActive {
            PlayerHeroArtworkBridge(
                artworkURL: artworkURL,
                fallbackImage: fallbackArtwork,
                isPlaying: isPlaying && !isLoading,
                preset: preset,
                policy: policy,
                canvasSize: canvasSize
            )
        } else {
            ArtworkImage(
                url: artworkURL,
                size: canvasSize * 0.82,
                cornerRadius: 14,
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
                Circle()
                    .fill(Color.black)
                    .frame(width: size * 0.92, height: size * 0.92)
                Circle()
                    .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    .frame(width: size * 0.92, height: size * 0.92)
                ArtworkImage(
                    url: artworkURL,
                    size: size * 0.38,
                    cornerRadius: size * 0.19,
                    fallbackImage: fallbackImage
                )
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
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .background {
                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.13, green: 0.13, blue: 0.15),
                                    ProMixerDeckView.chassisFill,
                                    Color(red: 0.04, green: 0.04, blue: 0.05)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.28),
                                    Color.white.opacity(0.05),
                                    Color.black.opacity(0.55)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1.2
                        )
                    RoundedRectangle(cornerRadius: 15, style: .continuous)
                        .inset(by: 3)
                        .stroke(Color.black.opacity(0.45), lineWidth: 1)
                }
                .shadow(color: .black.opacity(0.55), radius: 24, y: 14)
                .shadow(color: EOSTheme.accent.opacity(0.08), radius: 40, y: 0)
            }
            .overlay(alignment: .topLeading) { ProMixerScrew().padding(10) }
            .overlay(alignment: .topTrailing) { ProMixerScrew().padding(10) }
            .overlay(alignment: .bottomLeading) { ProMixerScrew().padding(10) }
            .overlay(alignment: .bottomTrailing) { ProMixerScrew().padding(10) }
    }
}

/// Jednolite tło studia — player wygląda jak jedna obudowa, nie wklejka.
struct ProMixerStageBackground: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
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
                            colors: [Color.white.opacity(0.12), Color.clear, EOSTheme.accent.opacity(0.15)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            }
            .shadow(color: .black.opacity(0.35), radius: 28, y: 16)
    }
}

private struct ProMixerScrew: View {
    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [Color(white: 0.35), Color(white: 0.12)],
                    center: .center,
                    startRadius: 0,
                    endRadius: 5
                )
            )
            .frame(width: 9, height: 9)
            .overlay {
                Circle()
                    .stroke(Color.black.opacity(0.35), lineWidth: 0.5)
            }
            .overlay {
                Rectangle()
                    .fill(Color.black.opacity(0.45))
                    .frame(width: 5, height: 0.6)
            }
    }
}

// MARK: - Status LED rail

private struct ProMixerStatusRail: View {
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    let queueLabel: String
    var onServer: Bool
    var drive: Double = 0.4

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 12, paused: !isPlaying)) { _ in
            let frame = visualizer.snapshot(isPlaying: isPlaying)
            let beat = frame.beat
            let level = frame.level
            let clipThreshold = max(0.55, 0.92 - drive * 0.38)
            let clip = level > clipThreshold || frame.bass > clipThreshold

            // ViewThatFits guarantees the rail never overflows its container —
            // it silently falls back to the compact variant on narrow phones.
            ViewThatFits(in: .horizontal) {
                fullRail(beat: beat, level: level, clip: clip)
                mediumRail(beat: beat, level: level, clip: clip)
                compactRail(beat: beat, clip: clip)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.black.opacity(0.72))
                    .overlay {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
                    }
            }
        }
    }

    private func fullRail(beat: Double, level: Double, clip: Bool) -> some View {
        HStack(spacing: 0) {
            HStack(spacing: 10) {
                ProMixerLED(label: "SIG", color: ProMixerDeckView.labelGreen, lit: isPlaying && level > 0.04, blink: beat > 0.55)
                ProMixerLED(label: "PK", color: ProMixerDeckView.labelAmber, lit: isPlaying && level > 0.35, blink: beat > 0.7)
                ProMixerLED(label: "▶", color: ProMixerDeckView.labelGreen, lit: isPlaying, blink: false)
                ProMixerLED(label: "EOS", color: EOSTheme.accent, lit: onServer, blink: onServer && beat > 0.4)
                ProMixerLED(label: "SYNC", color: ProMixerDeckView.labelAmber, lit: isPlaying, blink: beat > 0.85)
            }
            Spacer(minLength: 8)
            queuePill
            Spacer(minLength: 8)
            HStack(spacing: 10) {
                ProMixerLED(label: "OUT L", color: ProMixerDeckView.labelGreen, lit: isPlaying, blink: beat > 0.3)
                ProMixerLED(label: "OUT R", color: ProMixerDeckView.labelGreen, lit: isPlaying, blink: beat > 0.45)
                ProMixerLED(label: "CLIP", color: ProMixerDeckView.labelRed, lit: clip, blink: clip)
            }
        }
        .fixedSize(horizontal: true, vertical: false)
    }

    private func mediumRail(beat: Double, level: Double, clip: Bool) -> some View {
        HStack(spacing: 8) {
            HStack(spacing: 7) {
                ProMixerLED(label: "SIG", color: ProMixerDeckView.labelGreen, lit: isPlaying && level > 0.04, blink: beat > 0.55, showsLabel: false)
                ProMixerLED(label: "▶", color: ProMixerDeckView.labelGreen, lit: isPlaying, blink: false, showsLabel: false)
                ProMixerLED(label: "EOS", color: EOSTheme.accent, lit: onServer, blink: onServer && beat > 0.4, showsLabel: false)
            }
            queuePill
            HStack(spacing: 7) {
                ProMixerLED(label: "OUT", color: ProMixerDeckView.labelGreen, lit: isPlaying, blink: beat > 0.3, showsLabel: false)
                ProMixerLED(label: "CLIP", color: ProMixerDeckView.labelRed, lit: clip, blink: clip, showsLabel: false)
            }
        }
        .fixedSize(horizontal: true, vertical: false)
    }

    private func compactRail(beat: Double, clip: Bool) -> some View {
        HStack(spacing: 8) {
            ProMixerLED(label: "▶", color: ProMixerDeckView.labelGreen, lit: isPlaying, blink: false, showsLabel: false)
            ProMixerLED(label: "EOS", color: EOSTheme.accent, lit: onServer, blink: onServer && beat > 0.4, showsLabel: false)
            Text(queueLabel)
                .font(.caption2.monospacedDigit().weight(.bold))
                .foregroundStyle(ProMixerDeckView.labelGreen.opacity(0.85))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .layoutPriority(1)
            Spacer(minLength: 4)
            ProMixerLED(label: "CLIP", color: ProMixerDeckView.labelRed, lit: clip, blink: clip, showsLabel: false)
        }
    }

    private var queuePill: some View {
        Text(queueLabel)
            .font(.caption.monospacedDigit().weight(.bold))
            .foregroundStyle(ProMixerDeckView.labelGreen.opacity(0.85))
            .lineLimit(1)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 4))
    }
}

private struct ProMixerLED: View {
    let label: String
    let color: Color
    let lit: Bool
    var blink: Bool
    var showsLabel: Bool = true

    @State private var phase = false

    var body: some View {
        VStack(spacing: 3) {
            Circle()
                .fill(
                    RadialGradient(
                        colors: lit
                            ? [color.opacity(blink && phase ? 1 : 0.85), color.opacity(0.35)]
                            : [Color(white: 0.12), Color(white: 0.04)],
                        center: .center,
                        startRadius: 0,
                        endRadius: 6
                    )
                )
                .frame(width: 10, height: 10)
                .shadow(color: lit ? color.opacity(blink && phase ? 0.9 : 0.5) : .clear, radius: 4)
            if showsLabel {
                Text(label)
                    .font(.system(size: 7, weight: .heavy, design: .monospaced))
                    .foregroundStyle(Color.white.opacity(lit ? 0.7 : 0.35))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .frame(width: showsLabel ? 34 : 16)
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

    private let segments = WinampSpectrumStyle.segmentCount

    var body: some View {
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
                        .frame(height: compact ? 5 : 6)
                        .overlay {
                            if isPeak {
                                RoundedRectangle(cornerRadius: 1, style: .continuous)
                                    .fill(WinampSpectrumStyle.peakColor(forLevel: normalized))
                            }
                        }
                        .shadow(color: active ? WinampSpectrumStyle.barColor(segmentFromBottom: segment).opacity(0.45) : .clear, radius: 2)
                }
            }
            .padding(4)
            .frame(width: width)
            .background(Color.black.opacity(0.85), in: RoundedRectangle(cornerRadius: 4))
            .overlay {
                RoundedRectangle(cornerRadius: 4)
                    .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
            }
        }
        .frame(height: compact ? 118 : 148)
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

// MARK: - Mixer knobs (POWER / DRIVE / SENS)

struct ProMixerControlStrip: View {
    @EnvironmentObject private var ui: UIPreferences
    let visualizer: PlayerAudioVisualizer
    let isPlaying: Bool
    var drive: Double = 0.4
    var compact: Bool = false

    var body: some View {
        HStack(spacing: compact ? 10 : 16) {
            ProMixerPowerKnob(isOn: $ui.playerMixerPowered)
            ProMixerRotaryKnob(
                label: "DRIVE",
                value: $ui.playerDrive,
                tint: ProMixerDeckView.labelAmber,
                clipLit: drive > 0.72
            )
            ProMixerRotaryKnob(
                label: "SENS",
                value: $ui.playerSensitivity,
                tint: ProMixerDeckView.labelGreen,
                clipLit: false
            )
            Spacer(minLength: 0)
            if !compact {
                ProMixerRotaryKnob(
                    label: "PWR",
                    value: $ui.playerEffectsIntensity,
                    tint: EOSTheme.accent,
                    clipLit: false
                )
            }
        }
        .padding(.horizontal, compact ? 8 : 12)
        .padding(.vertical, compact ? 8 : 10)
        .background {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.black.opacity(0.5))
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
                }
        }
        .opacity(ui.playerMixerPowered ? 1 : 0.55)
    }
}

private struct ProMixerPowerKnob: View {
    @Binding var isOn: Bool

    var body: some View {
        Button {
            withAnimation(.spring(response: 0.28, dampingFraction: 0.72)) {
                isOn.toggle()
            }
        } label: {
            VStack(spacing: 5) {
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color(white: 0.22), Color(white: 0.06)],
                                center: .topLeading,
                                startRadius: 2,
                                endRadius: 22
                            )
                        )
                        .frame(width: 40, height: 40)
                        .overlay {
                            Circle()
                                .stroke(Color.white.opacity(0.15), lineWidth: 1)
                        }
                    Circle()
                        .fill(isOn ? ProMixerDeckView.labelGreen : Color(white: 0.12))
                        .frame(width: 10, height: 10)
                        .shadow(color: isOn ? ProMixerDeckView.labelGreen.opacity(0.8) : .clear, radius: 6)
                }
                Text("POWER")
                    .font(.system(size: 8, weight: .heavy, design: .monospaced))
                    .foregroundStyle(Color.white.opacity(0.55))
            }
        }
        .buttonStyle(.plain)
    }
}

private struct ProMixerRotaryKnob: View {
    let label: String
    @Binding var value: Double
    let tint: Color
    var clipLit: Bool
    @State private var dragAnchor: Double?

    var body: some View {
        VStack(spacing: 5) {
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.08), lineWidth: 3)
                    .frame(width: 40, height: 40)
                Circle()
                    .trim(from: 0, to: value)
                    .stroke(tint.opacity(0.85), style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 40, height: 40)
                Circle()
                    .fill(Color(white: 0.14))
                    .frame(width: 26, height: 26)
                Rectangle()
                    .fill(tint)
                    .frame(width: 2, height: 10)
                    .offset(y: -8)
                    .rotationEffect(.degrees(value * 270 - 135))
            }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { drag in
                        if dragAnchor == nil { dragAnchor = value }
                        let base = dragAnchor ?? value
                        value = min(1, max(0, base - drag.translation.height / 100))
                    }
                    .onEnded { _ in dragAnchor = nil }
            )
            Text(label)
                .font(.system(size: 8, weight: .heavy, design: .monospaced))
                .foregroundStyle(clipLit ? ProMixerDeckView.labelRed : Color.white.opacity(0.55))
            Text("\(Int(value * 100))")
                .font(.system(size: 7, weight: .bold, design: .monospaced))
                .foregroundStyle(tint.opacity(0.75))
        }
    }
}

// MARK: - Transport deck

struct ProMixerTransportDeck: View {
    @ObservedObject var engine: MusicPlaybackEngine
    let playButtonSize: CGFloat
    var tight: Bool = false

    var body: some View {
        HStack(spacing: tight ? 18 : 24) {
            transportButton("shuffle", active: engine.shuffleEnabled) {
                engine.toggleShuffle()
            }
            transportButton("backward.fill", size: .title3) {
                Task { await engine.skipPrevious() }
            }

            Button { engine.togglePlayPause() } label: {
                ZStack {
                    Circle()
                        .fill(
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
                        .frame(width: playButtonSize + 8, height: playButtonSize + 8)
                        .overlay {
                            Circle()
                                .stroke(
                                    LinearGradient(
                                        colors: [Color.white.opacity(0.35), Color.white.opacity(0.08)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 1.5
                                )
                        }
                        .shadow(color: EOSTheme.accent.opacity(engine.isPlaying ? 0.35 : 0.12), radius: 14, y: 4)

                    if engine.isLoading {
                        ProgressView()
                            .controlSize(.large)
                    } else {
                        Image(systemName: engine.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: playButtonSize * 0.38, weight: .bold))
                            .foregroundStyle(.white)
                            .offset(x: engine.isPlaying ? 0 : 2)
                    }
                }
            }
            .disabled(engine.isLoading)

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
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.black.opacity(0.55))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                }
        }
        .padding(.vertical, tight ? 2 : 4)
    }

    private func transportButton(
        _ systemName: String,
        active: Bool = false,
        size: Font = .body,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(size.weight(.semibold))
                .foregroundStyle(active ? EOSTheme.accent : EOSTheme.textMuted)
                .frame(width: 40, height: 40)
                .background(Color.white.opacity(0.04), in: Circle())
        }
        .buttonStyle(.plain)
    }
}

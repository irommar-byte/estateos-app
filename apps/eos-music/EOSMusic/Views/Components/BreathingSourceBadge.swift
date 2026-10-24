import SwiftUI

enum MediaPlaybackOrigin: Equatable {
    case phone
    case server
    case liveSource
    case airPlay
    case unknown

    var title: String {
        switch self {
        case .phone: return "iPhone"
        case .server: return "Serwer EOS"
        case .liveSource: return "Źródło"
        case .airPlay: return "AirPlay"
        case .unknown: return "Odtwarzanie"
        }
    }

    var compactTitle: String {
        switch self {
        case .phone: return "iPhone"
        case .server: return "Serwer"
        case .liveSource: return "Źródło"
        case .airPlay: return "AirPlay"
        case .unknown: return ""
        }
    }

    var systemImage: String {
        switch self {
        case .phone: return "iphone"
        case .server: return "server.rack"
        case .liveSource: return "dot.radiowaves.left.and.right"
        case .airPlay: return "airplayvideo"
        case .unknown: return "play.fill"
        }
    }

    var tint: Color {
        switch self {
        case .phone: return Color.green
        case .server: return EOSTheme.accent
        case .liveSource: return Color.orange
        case .airPlay: return Color.blue
        case .unknown: return Color.white
        }
    }

    static func fromVideoURL(_ url: URL?) -> MediaPlaybackOrigin {
        guard let url else { return .unknown }
        if url.isFileURL { return .phone }
        let path = url.path.lowercased()
        if path.contains("/api/movies/stream/") || path.contains("/api/file/") {
            return .server
        }
        if path.contains("/api/play/") {
            return .liveSource
        }
        return .liveSource
    }

    static func fromMusicURL(_ url: URL?) -> MediaPlaybackOrigin {
        guard let url else { return .unknown }
        if url.isFileURL { return .phone }
        let path = url.path.lowercased()
        if path.contains("/api/music/stream/") || path.contains("/api/file/") {
            return .server
        }
        return .server
    }
}

/// Plakietka źródła odtwarzania — jeden kształt dla wszystkich (szklana kapsuła w kolorze źródła),
/// a mikroanimacja mówi, co się dzieje:
/// • Źródło (stream) — fale sygnału rozchodzą się od ikony: łącze trzymane, dane napływają,
/// • Serwer EOS — strumień światła płynie przez kapsułę do ikony: dane spływają z serwera,
/// • iPhone — statyczna: utwór jest na urządzeniu, nic się nie dzieje,
/// • AirPlay — spokojne pulsowanie nadawania.
struct BreathingSourceBadge: View {
    let origin: MediaPlaybackOrigin
    var compact: Bool = false
    /// Mini-player: icon only so the capsule never covers the title.
    var iconOnly: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var flow = false

    private var height: CGFloat { compact || iconOnly ? 22 : 28 }
    private var animated: Bool { !reduceMotion }

    var body: some View {
        if origin != .unknown {
            HStack(spacing: compact ? 5 : 6) {
                icon
                    .font(.system(size: compact || iconOnly ? 10 : 12, weight: .bold))
                    .frame(width: compact || iconOnly ? 14 : 16)
                if !iconOnly {
                    Text(compact ? origin.compactTitle : origin.title)
                        .font(.system(size: compact ? 11 : 12.5, weight: .semibold, design: .rounded))
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
            .foregroundStyle(origin.tint)
            .padding(.horizontal, iconOnly ? 6 : (compact ? 9 : 11))
            .frame(height: height)
            .background {
                Capsule()
                    .fill(origin.tint.opacity(colorScheme == .dark ? 0.16 : 0.12))
                    .overlay { serverFlow }
                    .clipShape(Capsule())
            }
            .overlay(
                Capsule().strokeBorder(
                    LinearGradient(
                        colors: [origin.tint.opacity(0.55), origin.tint.opacity(0.18)],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 0.8
                )
            )
            .fixedSize()
            .layoutPriority(1)
            .onAppear { flow = false; if animated { flow = true } }
            .accessibilityLabel("Źródło odtwarzania: \(origin.title)")
        }
    }

    @ViewBuilder
    private var icon: some View {
        switch origin {
        case .liveSource:
            Image(systemName: "dot.radiowaves.left.and.right")
                .symbolEffect(.variableColor.iterative.reversing, options: .speed(0.9), isActive: animated)
        case .server:
            Image(systemName: "server.rack")
        case .airPlay:
            Image(systemName: "airplayaudio")
                .symbolEffect(.pulse, options: .speed(0.6), isActive: animated)
        case .phone, .unknown:
            Image(systemName: origin.systemImage)
        }
    }

    /// Serwer: wąska smuga światła płynie od prawej do lewej (do ikony serwera) w pętli.
    @ViewBuilder
    private var serverFlow: some View {
        if origin == .server, animated {
            GeometryReader { geo in
                LinearGradient(
                    colors: [.clear, origin.tint.opacity(0.45), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(width: geo.size.width * 0.35)
                .offset(x: flow ? -geo.size.width * 0.4 : geo.size.width * 1.05)
                .animation(.linear(duration: 1.6).repeatForever(autoreverses: false), value: flow)
            }
            .allowsHitTesting(false)
        }
    }
}

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

/// Pill that pulses so the current playback origin is obvious at a glance.
struct BreathingSourceBadge: View {
    let origin: MediaPlaybackOrigin
    var compact: Bool = false
    /// Mini-player: icon only so the capsule never covers the title.
    var iconOnly: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var inhale = false

    var body: some View {
        if origin != .unknown {
            HStack(spacing: compact ? 4 : 6) {
                Image(systemName: origin.systemImage)
                if !iconOnly {
                    Text(compact ? origin.compactTitle : origin.title)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
            .font(compact || iconOnly ? .caption2.weight(.bold) : .caption.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, iconOnly ? 7 : (compact ? 8 : 10))
            .padding(.vertical, iconOnly ? 5 : (compact ? 4 : 6))
            .background(origin.tint.opacity(pulse ? 0.95 : 0.62), in: Capsule())
            .overlay(
                Capsule()
                    .stroke(origin.tint.opacity(pulse ? 1 : 0.4), lineWidth: compact || iconOnly ? 1 : 1.4)
            )
            // Compact / icon-only never scale — the pulse was covering the song title.
            .scaleEffect(allowsPulse ? (inhale ? 1.05 : 0.97) : 1)
            .shadow(
                color: origin.tint.opacity(allowsPulse && inhale ? 0.55 : 0.18),
                radius: allowsPulse && inhale ? 6 : 1
            )
            .fixedSize()
            .layoutPriority(1)
            .onAppear {
                inhale = false
                guard allowsPulse else { return }
                withAnimation(.easeInOut(duration: 1.15).repeatForever(autoreverses: true)) {
                    inhale = true
                }
            }
            .accessibilityLabel("Źródło odtwarzania: \(origin.title)")
        }
    }

    private var allowsPulse: Bool {
        !reduceMotion && !compact && !iconOnly
    }

    private var pulse: Bool {
        allowsPulse && inhale
    }
}

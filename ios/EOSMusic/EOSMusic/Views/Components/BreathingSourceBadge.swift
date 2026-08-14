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

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var inhale = false

    var body: some View {
        if origin != .unknown {
            HStack(spacing: compact ? 4 : 6) {
                Image(systemName: origin.systemImage)
                Text(compact ? origin.compactTitle : origin.title)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
            .font(compact ? .caption2.weight(.bold) : .caption.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, compact ? 8 : 10)
            .padding(.vertical, compact ? 4 : 6)
            .background(origin.tint.opacity(inhale ? 0.95 : 0.52), in: Capsule())
            .overlay(
                Capsule()
                    .stroke(origin.tint.opacity(inhale ? 1 : 0.35), lineWidth: compact ? 1 : 1.4)
            )
            .scaleEffect(reduceMotion ? 1 : (inhale ? 1.06 : 0.96))
            .shadow(color: origin.tint.opacity(inhale ? 0.75 : 0.2), radius: inhale ? 8 : 2)
            .onAppear {
                inhale = false
                withAnimation(
                    reduceMotion
                        ? nil
                        : .easeInOut(duration: 1.15).repeatForever(autoreverses: true)
                ) {
                    inhale = true
                }
            }
            .accessibilityLabel("Źródło odtwarzania: \(origin.title)")
        }
    }
}

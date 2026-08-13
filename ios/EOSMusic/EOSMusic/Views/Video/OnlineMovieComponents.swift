import SwiftUI

/// Wyraźny prostokątny badge lokalizacji: SERWER / iPHONE (+ postęp).
struct MovieStorageLocationBadge: View {
    enum Kind: Equatable {
        case server
        case phone
        case serverProgress(Double)
        case phoneProgress(Double)
        case queue
        case cancelled
        case error
        case online
    }

    let kind: Kind

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
            Text(label)
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.4)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .foregroundStyle(foreground)
        .background(background, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .strokeBorder(Color.white.opacity(0.18), lineWidth: 0.8)
        }
        .accessibilityLabel(label)
    }

    private var label: String {
        switch kind {
        case .server: return "SERWER"
        case .phone: return "iPHONE"
        case .serverProgress(let p): return String(format: "SERWER %.0f%%", clamp(p))
        case .phoneProgress(let p): return String(format: "iPHONE %.0f%%", clamp(p))
        case .queue: return "KOLEJKA"
        case .cancelled: return "ANULOWANE"
        case .error: return "BŁĄD"
        case .online: return "ONLINE"
        }
    }

    private var icon: String {
        switch kind {
        case .server, .serverProgress: return "server.rack"
        case .phone, .phoneProgress: return "iphone"
        case .queue: return "clock"
        case .cancelled: return "xmark"
        case .error: return "exclamationmark.triangle.fill"
        case .online: return "antenna.radiowaves.left.and.right"
        }
    }

    private var foreground: Color {
        switch kind {
        case .online, .queue: return .primary
        default: return .white
        }
    }

    private var background: Color {
        switch kind {
        case .server, .serverProgress: return EOSTheme.accent.opacity(0.92)
        case .phone, .phoneProgress: return Color.green.opacity(0.88)
        case .queue: return Color.orange.opacity(0.22)
        case .cancelled: return Color.secondary.opacity(0.55)
        case .error: return Color.red.opacity(0.88)
        case .online: return Color.primary.opacity(0.08)
        }
    }

    private func clamp(_ p: Double) -> Double {
        let v = p <= 1 && p > 0 ? p * 100 : p
        return min(100, max(0, v))
    }
}

struct OnlineMovieTransferBadge: View {
    let state: OnlineMovieTransferState

    var body: some View {
        MovieStorageLocationBadge(kind: kind)
    }

    private var kind: MovieStorageLocationBadge.Kind {
        switch state {
        case .idle: return .online
        case .onServer: return .server
        case .onPhone: return .phone
        case .acquiringServer(let p): return .serverProgress(p)
        case .downloadingPhone(let p): return .phoneProgress(p)
        case .failed: return .error
        }
    }
}

/// Karta aktora — czytelna ramka; długie imiona przewijają się w pętli (marquee).
struct OnlineMovieActorChip: View {
    let name: String

    private var parts: (first: String, rest: String?) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let tokens = trimmed.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
        guard tokens.count >= 2 else { return (trimmed, nil) }
        return (tokens[0], tokens.dropFirst().joined(separator: " "))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            MarqueeText(
                text: parts.first,
                font: .system(size: 13, weight: .heavy, design: .rounded),
                foreground: EOSTheme.textPrimary,
                speedPointsPerSecond: 24
            )
            if let rest = parts.rest, !rest.isEmpty {
                MarqueeText(
                    text: rest,
                    font: .system(size: 11, weight: .semibold, design: .rounded),
                    foreground: EOSTheme.accent.opacity(0.9),
                    speedPointsPerSecond: 22
                )
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .frame(width: 128, height: 58, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            EOSTheme.accent.opacity(0.16),
                            EOSTheme.accentSecondary.opacity(0.10),
                            Color.primary.opacity(0.04)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            EOSTheme.accent.opacity(0.55),
                            EOSTheme.accentSecondary.opacity(0.25),
                            Color.primary.opacity(0.12)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.2
                )
        )
        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityLabel(name)
    }
}

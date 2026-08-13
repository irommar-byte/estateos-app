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

/// Karta aktora — prostokątna ramka z „pourywanymi” literami (overflow + clip).
struct OnlineMovieActorChip: View {
    let name: String

    var body: some View {
        ZStack(alignment: .bottomLeading) {
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

            // Literowanie celowo wystaje poza ramkę — efekt „przeniesionych” liter.
            Text(name.uppercased())
                .font(.system(size: 15, weight: .heavy, design: .rounded))
                .tracking(-0.8)
                .foregroundStyle(
                    LinearGradient(
                        colors: [EOSTheme.textPrimary, EOSTheme.accent.opacity(0.85)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(width: 132, alignment: .leading)
                .offset(x: -6, y: 6)
                .opacity(0.92)
        }
        .frame(width: 118, height: 58)
        .clipped()
        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

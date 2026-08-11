import SwiftUI

struct OnlineMovieTransferBadge: View {
    let state: OnlineMovieTransferState

    var body: some View {
        Text(label)
            .font(.system(size: 10, weight: .bold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(foreground)
            .background(background, in: Capsule())
    }

    private var label: String {
        switch state {
        case .idle: return "ONLINE"
        case .onServer: return "SERWER"
        case .onPhone: return "iPHONE"
        case .acquiringServer(let p): return String(format: "SERWER %.0f%%", p)
        case .downloadingPhone(let p): return String(format: "TEL %.0f%%", p)
        case .failed: return "BŁĄD"
        }
    }

    private var foreground: Color {
        switch state {
        case .failed: return .white
        case .onPhone, .onServer: return .white
        default: return .primary
        }
    }

    private var background: Color {
        switch state {
        case .onServer: return EOSTheme.accent.opacity(0.9)
        case .onPhone: return Color.green.opacity(0.85)
        case .failed: return Color.red.opacity(0.85)
        case .acquiringServer, .downloadingPhone: return EOSTheme.accentSecondary.opacity(0.35)
        case .idle: return Color.primary.opacity(0.08)
        }
    }
}

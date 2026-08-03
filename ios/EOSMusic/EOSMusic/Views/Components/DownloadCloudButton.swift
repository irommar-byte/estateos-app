import SwiftUI

struct DownloadCloudButton: View {
    let state: TrackDownloadUIState
    var size: CGFloat = 22
    var onDownload: () -> Void = {}
    var onCancel: () -> Void = {}
    var onRemoveOffline: () -> Void = {}

    var body: some View {
        Group {
            switch state {
            case .done:
                Button(action: onRemoveOffline) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: size))
                        .foregroundStyle(.green.opacity(0.85))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Na tym iPhonie — dotknij, aby usunąć lokalną kopię (serwer zostaje)")

            case .onServer:
                Button(action: onDownload) {
                    Image(systemName: "icloud.fill")
                        .font(.system(size: size, weight: .semibold))
                        .foregroundStyle(EOSTheme.accent)
                        .shadow(color: EOSTheme.accent.opacity(0.55), radius: 5, y: 0)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Na serwerze EOS — pobierz na ten iPhone")

            case .acquiringServer(let progress):
                Button(action: onCancel) {
                    ServerCloudProgressIcon(progress: progress, size: size)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Zapisuję na serwer (\(Int(progress)) procent) — anuluj")

            case .downloading(let progress):
                let pct = min(100, max(0, progress))
                Button(action: onCancel) {
                    ZStack {
                        ServerCloudProgressIcon(progress: pct, size: size)
                        Image(systemName: "arrow.down")
                            .font(.system(size: size * 0.28, weight: .bold))
                            .foregroundStyle(.white)
                            .offset(y: size * 0.06)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Pobieranie na iPhone (\(Int(pct)) procent) — anuluj")

            case .failed:
                Button(action: onDownload) {
                    Image(systemName: "exclamationmark.icloud")
                        .font(.system(size: size))
                        .foregroundStyle(EOSTheme.accent)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Błąd pobierania — spróbuj ponownie")

            case .idle:
                Button(action: onDownload) {
                    Image(systemName: "icloud.and.arrow.down")
                        .font(.system(size: size))
                        .foregroundStyle(EOSTheme.accentSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Pobierz do biblioteki EOS i na ten iPhone")
            }
        }
    }
}

/// Chmurka wypełnia się kolorem w miarę progressu i „oddycha” (mruga) podczas zapisu.
struct ServerCloudProgressIcon: View {
    let progress: Double
    var size: CGFloat = 22
    var animateBreath: Bool = true

    @State private var pulse = false

    private var pct: Double { min(100, max(0, progress)) / 100 }

    var body: some View {
        ZStack {
            Image(systemName: "icloud")
                .font(.system(size: size, weight: .regular))
                .foregroundStyle(EOSTheme.textMuted.opacity(0.35))

            Image(systemName: "icloud.fill")
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(EOSTheme.accent)
                .mask(alignment: .bottom) {
                    Rectangle()
                        .frame(height: max(1, size * pct))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                }
        }
        .frame(width: size + 4, height: size + 2)
        .opacity(animateBreath ? (pulse ? 0.48 : 1) : 1)
        .shadow(color: EOSTheme.accent.opacity(0.22 + 0.4 * pct), radius: pulse && animateBreath ? 7 : 4)
        .onAppear {
            guard animateBreath else { return }
            withAnimation(.easeInOut(duration: 0.85).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }
}

// MARK: - Apple Music–style mini toast

struct MusicToast: Identifiable, Equatable {
    let id = UUID()
    let systemImage: String
    let title: String
    let subtitle: String?

    static func addedToLibrary(trackTitle: String) -> MusicToast {
        MusicToast(
            systemImage: "plus.circle.fill",
            title: "Dodano do biblioteki",
            subtitle: trackTitle
        )
    }

    static func addedToPlaylist(trackTitle: String, playlist: String) -> MusicToast {
        MusicToast(
            systemImage: "text.badge.plus",
            title: "Dodano do playlisty",
            subtitle: "„\(trackTitle)” → \(playlist)"
        )
    }

    static func savedOnServer(trackTitle: String) -> MusicToast {
        MusicToast(
            systemImage: "icloud.fill",
            title: "Zapisano na serwerze",
            subtitle: trackTitle
        )
    }
}

struct MusicToastBanner: View {
    let toast: MusicToast

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: toast.systemImage)
                .font(.title3.weight(.semibold))
                .foregroundStyle(EOSTheme.accent)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(toast.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                if let subtitle = toast.subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.06), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
        .padding(.horizontal, 16)
    }
}

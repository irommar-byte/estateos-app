import SwiftUI

struct DownloadCloudButton: View {
    let state: TrackDownloadUIState
    var size: CGFloat = 22
    var onDownload: () -> Void = {}
    var onCancel: () -> Void = {}
    var onRemoveOffline: () -> Void = {}

    var body: some View {
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
                    .font(.system(size: size))
                    .foregroundStyle(EOSTheme.accent.opacity(0.9))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Na serwerze EOS — pobierz na ten iPhone")

        case .downloading(let progress):
            let pct = min(100, max(0, progress))
            Button(action: onCancel) {
                ZStack {
                    Circle()
                        .stroke(EOSTheme.textMuted.opacity(0.25), lineWidth: 2)
                        .frame(width: size + 6, height: size + 6)
                    Circle()
                        .trim(from: 0, to: pct / 100)
                        .stroke(EOSTheme.accent, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .frame(width: size + 6, height: size + 6)
                    Image(systemName: "stop.fill")
                        .font(.system(size: size * 0.38, weight: .bold))
                        .foregroundStyle(EOSTheme.textSecondary)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Anuluj pobieranie (\(Int(pct)) procent)")

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

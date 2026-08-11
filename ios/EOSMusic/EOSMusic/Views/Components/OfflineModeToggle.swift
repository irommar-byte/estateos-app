import SwiftUI

/// Apple-style Online / Offline segmented control (reusable; global bar is primary).
struct OfflineModeToggle: View {
    @Binding var isOffline: Bool
    var networkOnline: Bool = true
    var downloadedCount: Int = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Picker("Tryb", selection: $isOffline) {
                Text("Online").tag(false)
                Text("Offline").tag(true)
            }
            .pickerStyle(.segmented)
            .accessibilityLabel("Tryb odtwarzania")

            HStack(spacing: 6) {
                OnlineOfflineModeGlyph(
                    isOffline: isOffline,
                    networkOnline: networkOnline,
                    size: 13
                )
                Text(statusText)
                    .font(.caption)
                    .foregroundStyle(isOffline || !networkOnline ? EOSTheme.accent : .secondary)
                    .fixedSize(horizontal: false, vertical: true)
                if isOffline, downloadedCount > 0 {
                    Spacer(minLength: 4)
                    Text("\(downloadedCount)")
                        .font(.caption.weight(.bold).monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var statusText: String {
        if isOffline {
            return networkOnline
                ? "Tylko pobrane na tym urządzeniu."
                : "Brak sieci · tylko pobrane."
        }
        if !networkOnline {
            return "Brak połączenia — włącz Offline."
        }
        return "Stream z serwera EOS i katalogu."
    }
}

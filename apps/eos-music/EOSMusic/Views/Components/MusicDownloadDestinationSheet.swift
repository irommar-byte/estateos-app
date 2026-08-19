import SwiftUI

/// Wybór celu pobierania muzyki (serwer / serwer + urządzenie).
struct MusicDownloadDestinationSheet: View {
    let title: String
    var subtitle: String?
    var trackCount: Int = 1
    let onStart: (MusicDownloadDestination) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var destination: MusicDownloadDestination = .server

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(title)
                        .font(.headline)
                    if let subtitle {
                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    if trackCount > 1 {
                        Text("\(trackCount) utworów")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(EOSTheme.accent)
                    }
                }

                Section("Gdzie zapisać") {
                    ForEach(MusicDownloadDestination.allCases, id: \.self) { option in
                        Button {
                            destination = option
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: option.systemImage)
                                    .font(.title3)
                                    .foregroundStyle(EOSTheme.accent)
                                    .frame(width: 28)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(option.label)
                                        .font(.subheadline.weight(.semibold))
                                    Text(option.detail)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 0)
                                if destination == option {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(EOSTheme.accent)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .navigationTitle("Pobieranie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Rozpocznij") {
                        onStart(destination)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

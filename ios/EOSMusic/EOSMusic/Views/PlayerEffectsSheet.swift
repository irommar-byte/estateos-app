import SwiftUI

/// Compact sheet: Winyl / Okładka / Spectrum / Off — no intensity slider.
struct PlayerEffectsSheet: View {
    @EnvironmentObject private var ui: UIPreferences
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var thermal = ProcessInfo.processInfo.thermalState
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled

    private var policy: PlayerVisualPolicy {
        PlayerVisualPolicy.resolve(
            preset: ui.playerVisualPreset,
            autoPerformance: ui.playerAutoPerformance,
            reduceMotion: reduceMotion,
            lowPower: lowPower,
            thermal: thermal
        )
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(PlayerVisualPreset.allCases) { preset in
                        SettingsChoiceRow(
                            title: preset.title,
                            subtitle: preset.subtitle,
                            systemImage: preset.systemImage,
                            isSelected: ui.playerVisualPreset == preset
                        ) {
                            ui.playerVisualPreset = preset
                        }
                    }
                } header: {
                    Text("Wygląd playera")
                } footer: {
                    Text("Winyl obraca płytę. Okładka pulsuje w rytm. Spectrum pokazuje czytelny EQ. Efektów nie da się „kręcić mocą” — są skalibrowane pod czytelność i baterię.")
                }

                Section {
                    Toggle(isOn: $ui.playerAutoPerformance.animation(EOSMotion.snappy)) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Automatyczna wydajność")
                                Text("Ogranicza animacje przy Low Power i wysokiej temperaturze")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "gauge.with.dots.needle.33percent")
                                .foregroundStyle(EOSTheme.accent)
                        }
                    }
                    .tint(EOSTheme.accent)
                } header: {
                    Text("Bateria")
                } footer: {
                    if let reason = policy.restrictionReason {
                        Text(reason)
                    } else {
                        Text("Efekty są tylko wizualne — nie zmieniają brzmienia.")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Player")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Gotowe") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onReceive(NotificationCenter.default.publisher(for: ProcessInfo.thermalStateDidChangeNotification)) { _ in
            thermal = ProcessInfo.processInfo.thermalState
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        }
    }
}

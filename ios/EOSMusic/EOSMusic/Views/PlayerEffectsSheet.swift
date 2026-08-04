import SwiftUI

/// Apple-style sheet for player visual presets, intensity and safe strobe.
struct PlayerEffectsSheet: View {
    @EnvironmentObject private var ui: UIPreferences
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var thermal = ProcessInfo.processInfo.thermalState
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled

    private var policy: PlayerVisualPolicy {
        PlayerVisualPolicy.resolve(
            preset: ui.playerVisualPreset,
            intensity: ui.playerEffectsIntensity,
            strobeEnabled: ui.playerStrobeEnabled,
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
                    Text("Preset")
                } footer: {
                    Text("Spectrum i Pulse pokazują mikser częstotliwości. Wyłączone usuwa wszystkie efekty.")
                }

                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Moc efektów")
                                .font(.body.weight(.semibold))
                            Spacer()
                            Text("\(Int((ui.playerEffectsIntensity * 100).rounded()))%")
                                .font(.subheadline.monospacedDigit().weight(.semibold))
                                .foregroundStyle(EOSTheme.accent)
                        }
                        Slider(value: $ui.playerEffectsIntensity, in: 0...1, step: 0.01)
                            .tint(EOSTheme.accent)
                            .disabled(ui.playerVisualPreset == .off)
                    }
                    .padding(.vertical, 4)

                    Toggle(isOn: $ui.playerStrobeEnabled.animation(EOSMotion.snappy)) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Strobo")
                                Text(strobeFooter)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "light.max")
                                .foregroundStyle(EOSTheme.accent)
                        }
                    }
                    .tint(EOSTheme.accent)
                    .disabled(!ui.playerVisualPreset.allowsStrobe || ui.playerVisualPreset == .off)

                    Toggle(isOn: $ui.playerAutoPerformance.animation(EOSMotion.snappy)) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Automatyczna wydajność")
                                Text("Ogranicza efekty przy Low Power i wysokiej temperaturze")
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
                    Text("Kontrola")
                } footer: {
                    if let reason = policy.restrictionReason {
                        Text(reason)
                    } else if ui.playerStrobeEnabled {
                        Text("Strobo: maksymalnie 3 impulsy/s, bez pełnoekranowych białych błysków.")
                    } else {
                        Text("Efekty są wizualne — nie zmieniają brzmienia utworu.")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Efekty playera")
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

    private var strobeFooter: String {
        if !ui.playerVisualPreset.allowsStrobe {
            return "Dostępne w Spectrum i Pulse"
        }
        if reduceMotion {
            return "Wyłączone przez Reduce Motion"
        }
        if policy.allowStrobe {
            return "Bezpieczne impulsy zsynchronizowane z beatem"
        }
        if ui.playerStrobeEnabled {
            return "Tymczasowo ograniczone przez system"
        }
        return "Domyślnie wyłączone · max 3 impulsy/s"
    }
}

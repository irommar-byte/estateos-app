import SwiftUI

/// Pełne sterowanie wyglądem playera i stroboskopem: wybór trybu + regulacja intensywności i prędkości.
struct PlayerEffectsSheet: View {
    @EnvironmentObject private var ui: UIPreferences
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var thermal = ProcessInfo.processInfo.thermalState
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled

    private var policy: PlayerVisualPolicy {
        PlayerVisualPolicy.resolve(
            preset: ui.playerVisualPreset,
            strobeEnabled: ui.playerStrobeEnabled || ui.playerVisualPreset == .strobe,
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
                            if preset == .strobe {
                                ui.playerStrobeEnabled = true
                            }
                        }
                    }
                } header: {
                    Text("Tryb wizualny")
                } footer: {
                    Text("Wybierz styl playera: obracający się Winyl 12\", pulsująca Okładka, Spectrum EQ lub klubowy Stroboskop.")
                }

                if ui.playerStrobeEnabled || ui.playerVisualPreset == .strobe {
                    Section {
                        LabeledContent("Jasność") {
                            Text("\(Int(ui.playerStrobeBrightness * 100))%")
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        Slider(value: $ui.playerStrobeBrightness, in: 0.4...1.0)
                    } header: {
                        Text("Stroboskop")
                    } footer: {
                        Text("Błyski idą z bitu. W poziomie wypełniają boki ekranu.")
                    }
                }

                if ui.playerVisualPreset == .spectrum {
                    Section {
                        Picker("Słupki", selection: Binding(
                            get: { ui.playerSpectrumBandCount >= 32 ? 32 : 24 },
                            set: { ui.playerSpectrumBandCount = $0 }
                        )) {
                            Text("24").tag(24)
                            Text("32").tag(32)
                        }
                        .pickerStyle(.segmented)
                    } header: {
                        Text("Equalizer")
                    } footer: {
                        Text("Pasma liczone z dźwięku. Po obrocie EQ zajmuje cały ekran.")
                    }
                }

                Section {
                    Toggle(isOn: $ui.playerAutoPerformance.animation(EOSMotion.snappy)) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Automatyczna wydajność")
                                Text("Ogranicza animacje przy oszczędzaniu baterii i nagrzaniu")
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
                    Text("Bateria i wydajność")
                } footer: {
                    if let reason = policy.restrictionReason {
                        Text(reason)
                    } else {
                        Text("Przy cieple telefonu efekty same się wyciszają.")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Efekty i Stroboskop")
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

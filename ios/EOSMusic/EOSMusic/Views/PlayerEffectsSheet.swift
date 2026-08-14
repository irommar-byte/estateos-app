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

                if ui.playerVisualPreset != .off {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Label("Intensywność efektów", systemImage: "slider.horizontal.3")
                                    .font(.subheadline.weight(.medium))
                                Spacer()
                                Text("\(Int(ui.playerEffectsIntensity * 100))%")
                                    .font(.caption.monospacedDigit().weight(.bold))
                                    .foregroundStyle(EOSTheme.accent)
                            }
                            Slider(value: $ui.playerEffectsIntensity, in: 0.15...1.0)
                                .tint(EOSTheme.accent)
                        }
                        .padding(.vertical, 4)

                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Label("Czułość na bit", systemImage: "waveform.path.badge.plus")
                                    .font(.subheadline.weight(.medium))
                                Spacer()
                                Text("\(Int(ui.playerSensitivity * 100))%")
                                    .font(.caption.monospacedDigit().weight(.bold))
                                    .foregroundStyle(EOSTheme.accent)
                            }
                            Slider(value: $ui.playerSensitivity, in: 0.2...1.0)
                                .tint(EOSTheme.accent)
                        }
                        .padding(.vertical, 4)

                        if ui.playerVisualPreset == .strobe || ui.playerStrobeEnabled {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Label("Szybkość / Prędkość błysków", systemImage: "bolt.fill")
                                        .font(.subheadline.weight(.medium))
                                    Spacer()
                                    Text("\(Int(ui.playerStrobeSpeed * 100))%")
                                        .font(.caption.monospacedDigit().weight(.bold))
                                        .foregroundStyle(EOSTheme.accent)
                                }
                                Slider(value: $ui.playerStrobeSpeed, in: 0.2...1.0)
                                    .tint(EOSTheme.accent)
                            }
                            .padding(.vertical, 4)

                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Label("Jasność stroboskopu", systemImage: "sun.max.fill")
                                        .font(.subheadline.weight(.medium))
                                    Spacer()
                                    Text("\(Int(ui.playerStrobeBrightness * 100))%")
                                        .font(.caption.monospacedDigit().weight(.bold))
                                        .foregroundStyle(EOSTheme.accent)
                                }
                                Slider(value: $ui.playerStrobeBrightness, in: 0.15...1.0)
                                    .tint(EOSTheme.accent)
                            }
                            .padding(.vertical, 4)
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Label("Nasycenie podświetlenia (Drive)", systemImage: "flame.fill")
                                    .font(.subheadline.weight(.medium))
                                Spacer()
                                Text("\(Int(ui.playerDrive * 100))%")
                                    .font(.caption.monospacedDigit().weight(.bold))
                                    .foregroundStyle(EOSTheme.accent)
                            }
                            Slider(value: $ui.playerDrive, in: 0.0...1.0)
                                .tint(EOSTheme.accent)
                        }
                        .padding(.vertical, 4)
                    } header: {
                        Text("Regulacja stroboskopu i dynamiki")
                    } footer: {
                        Text("Reguluj natężenie światła, czułość na bas, jasność i prędkość stroboskopu (STROBO działa też przy EQ).")
                    }
                }

                Section {
                    Picker(selection: $ui.playerSpectrumBandCount) {
                        Text("16 słupków").tag(16)
                        Text("24 słupki").tag(24)
                        Text("32 słupki").tag(32)
                    } label: {
                        Label("Liczba słupków EQ", systemImage: "chart.bar.fill")
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Label("Szerokość słupków", systemImage: "arrow.left.and.right")
                                .font(.subheadline.weight(.medium))
                            Spacer()
                            Text("\(Int(ui.playerSpectrumBarScale * 100))%")
                                .font(.caption.monospacedDigit().weight(.bold))
                                .foregroundStyle(EOSTheme.accent)
                        }
                        Slider(value: $ui.playerSpectrumBarScale, in: 0.5...1.5)
                            .tint(EOSTheme.accent)
                    }
                    .padding(.vertical, 4)

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Label("Segmenty VU L/R", systemImage: "slider.vertical.3")
                                .font(.subheadline.weight(.medium))
                            Spacer()
                            Text("\(ui.playerSideVUSegments)")
                                .font(.caption.monospacedDigit().weight(.bold))
                                .foregroundStyle(EOSTheme.accent)
                        }
                        Slider(
                            value: Binding(
                                get: { Double(ui.playerSideVUSegments) },
                                set: { ui.playerSideVUSegments = Int($0.rounded()) }
                            ),
                            in: 12...32,
                            step: 1
                        )
                        .tint(EOSTheme.accent)
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("Spectrum EQ / Mikser")
                } footer: {
                    Text("Reguluj gęstość i grubość słupków w środku oraz wysokość bocznych wskaźników L/R (efekt miksera DJ).")
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
                        Text("Efekty są renderowane płynnie w 60 FPS.")
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

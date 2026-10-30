import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var wallet: WalletModel
    @EnvironmentObject private var lock: BiometricLock
    @ObservedObject private var cloudSync = CloudSyncMonitor.shared

    var body: some View {
        Form {
            Section {
                TextField("Twoje imię", text: $wallet.settings.displayName)
                    .textInputAutocapitalization(.words)
                    .onChange(of: wallet.settings.displayName) { _, name in
                        wallet.schedulePersistDisplayName(name)
                    }
            } header: {
                Text("Konto")
            } footer: {
                Text("Imię widać przy kaucjach, paragonach i kartach, które udostępnisz bliskim.")
            }
            .listRowBackground(ParagonTheme.surface)

            Section {
                ParagonCloudDevicesRow(cloudSync: cloudSync) {
                    wallet.requestCloudSync()
                }
            } header: {
                Text("Twoje urządzenia")
            } footer: {
                Text("Ten sam Apple ID na iPhonie i iPadzie synchronizuje dane automatycznie. Zaproszenie rodziny ustawiasz w dziale Rodzina.")
            }
            .listRowBackground(ParagonTheme.surface)

            Section {
                reminderLink(
                    title: "Kaucje",
                    symbol: "waterbottle.fill",
                    tint: ParagonSettingsTint.deposit,
                    days: $wallet.settings.depositReminderDays,
                    footer: "Przypomnienia o końcu ważności kwitków z butelkomatu."
                )
                reminderLink(
                    title: "Gwarancja",
                    symbol: "checkmark.seal.fill",
                    tint: ParagonSettingsTint.warranty,
                    days: $wallet.settings.warrantyReminderDays,
                    footer: "Elektronika, RTV i AGD zwykle mają 24 miesiące gwarancji."
                )
                reminderLink(
                    title: "Zwrot",
                    symbol: "arrow.uturn.left",
                    tint: ParagonSettingsTint.returning,
                    days: $wallet.settings.returnReminderDays,
                    footer: "Ubrania, buty i rozrywka — zwykle 14 dni na zwrot."
                )
            } header: {
                Text("Przypomnienia")
            } footer: {
                Text("Każdy termin możesz dodać albo usunąć osobno — jak w Kalendarzu.")
            }
            .listRowBackground(ParagonTheme.surface)

            Section {
                Toggle(isOn: lockBinding) {
                    settingsLabel(lockToggleTitle, symbol: lock.lockSymbol, tint: ParagonSettingsTint.lock)
                }
                .disabled(lock.isAvailable == false)
            } header: {
                Text("Ochrona")
            } footer: {
                Text("Po zablokowaniu ekranu \(Brand.displayName) pyta o \(lock.biometryTitle), zanim pokaże kaucje, paragony i karty.")
            }
            .listRowBackground(ParagonTheme.surface)

            Section {
                Toggle(isOn: $wallet.settings.boostBrightness) {
                    settingsLabel("Maksymalna jasność przy kodzie", symbol: "sun.max.fill", tint: ParagonSettingsTint.brightness)
                }
            } header: {
                Text("Kasa")
            }
            .listRowBackground(ParagonTheme.surface)

            Section {
                Toggle(isOn: $wallet.settings.scanOpensImmediately) {
                    settingsLabel("Po plusie od razu włącz aparat", symbol: "viewfinder", tint: ParagonSettingsTint.scan)
                }
            } header: {
                Text("Skanowanie")
            }
            .listRowBackground(ParagonTheme.surface)

            Section {
                Picker(selection: $wallet.settings.language) {
                    ForEach(AppLanguage.allCases) { language in
                        Text(language.title).tag(language)
                    }
                } label: {
                    settingsLabel("Język", symbol: "globe", tint: ParagonSettingsTint.language)
                }
            }
            .listRowBackground(ParagonTheme.surface)

            Section {
                CoffeeTipSettingsRow()
            } header: {
                Text("Kawa")
            } footer: {
                Text("Napiwek idzie przez zakupy w aplikacji. Nic nie musisz.")
            }
            .listRowBackground(ParagonTheme.surface)

            Section {
                Button {
                    ReviewGate.openWriteReview()
                } label: {
                    settingsLabel("Oceń w App Store", symbol: "star.fill", tint: ParagonSettingsTint.review)
                }
                .buttonStyle(ParagonPressStyle())
            } header: {
                Text("Ocena")
            }
            .listRowBackground(ParagonTheme.surface)

            Section {
                LabeledContent("Wersja", value: Self.versionLabel)
            } header: {
                Text(Brand.displayName)
            } footer: {
                Text("\(Brand.slogan)\n\n\(Brand.disclaimer)\n\nZdjęcia kaucji, paragonów i kart zostają na tym iPhonie i — gdy iCloud jest włączony — w Twojej prywatnej chmurze Apple. ParagonOS™ nie ma własnego serwera kont.")
            }
            .listRowBackground(ParagonTheme.surface)
        }
        .navigationTitle("Ustawienia")
        .navigationBarTitleDisplayMode(.inline)
        .paragonHidesTabBar()
        .onChange(of: wallet.settings.depositReminderDays) { _, _ in refresh() }
        .onChange(of: wallet.settings.warrantyReminderDays) { _, _ in refresh() }
        .onChange(of: wallet.settings.returnReminderDays) { _, _ in refresh() }
    }

    private func reminderLink(
        title: String,
        symbol: String,
        tint: Color,
        days: Binding<[Int]>,
        footer: String
    ) -> some View {
        NavigationLink {
            ReminderDaysEditor(title: title, footer: footer, days: days)
        } label: {
            HStack(spacing: 12) {
                ParagonSettingsGlyph(systemName: symbol, background: tint)
                Text(title)
                Spacer()
                Text(NotificationSettings.summary(for: days.wrappedValue))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
        }
    }

    private func settingsLabel(_ title: String, symbol: String, tint: Color) -> some View {
        HStack(spacing: 12) {
            ParagonSettingsGlyph(systemName: symbol, background: tint)
            Text(title)
        }
    }

    private var lockToggleTitle: String {
        "Wymagaj \(lock.biometryTitle)"
    }

    private var lockBinding: Binding<Bool> {
        Binding(
            get: { wallet.settings.lockWithBiometrics },
            set: { enabled in
                Task { await setLockEnabled(enabled) }
            }
        )
    }

    private func setLockEnabled(_ enabled: Bool) async {
        if enabled {
            lock.lockIfNeeded(enabled: true)
            let ok = await lock.authenticate(enabled: true)
            wallet.settings.lockWithBiometrics = ok
            if ok == false {
                lock.isLocked = false
            }
        } else {
            wallet.settings.lockWithBiometrics = false
            lock.isLocked = false
        }
    }

    private func refresh() {
        wallet.scheduleRefreshNotifications()
    }

    private static var versionLabel: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(version) (\(build))"
    }
}

private struct ReminderDaysEditor: View {
    var title: String
    var footer: String
    @Binding var days: [Int]
    @State private var adding = false

    private var normalized: [Int] {
        NotificationSettings.normalized(days)
    }

    var body: some View {
        Form {
            Section {
                if normalized.isEmpty {
                    Text("Brak przypomnień")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(normalized, id: \.self) { day in
                        Text(NotificationSettings.label(for: day))
                    }
                    .onDelete { offsets in
                        var next = normalized
                        next.remove(atOffsets: offsets)
                        days = NotificationSettings.normalized(next)
                    }
                }
                if normalized.count < NotificationSettings.maxPerKind {
                    Button {
                        adding = true
                    } label: {
                        Label("Dodaj przypomnienie", systemImage: "plus")
                    }
                }
            } footer: {
                Text(footer)
            }
            .listRowBackground(ParagonTheme.surface)
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $adding) {
            ReminderOffsetPicker(title: title, existing: normalized) { day in
                var next = days
                next.append(day)
                days = NotificationSettings.normalized(next)
            }
        }
    }
}

private struct ReminderOffsetPicker: View {
    var title: String
    var existing: [Int]
    var onPick: (Int) -> Void
    @Environment(\.dismiss) private var dismiss

    private var available: [Int] {
        NotificationSettings.presets.filter { existing.contains($0) == false }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(available, id: \.self) { day in
                    Button {
                        onPick(day)
                        dismiss()
                    } label: {
                        Text(NotificationSettings.label(for: day))
                            .foregroundStyle(.primary)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(ParagonTheme.canvas)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
            }
        }
        .presentationDetents(available.count > 6 ? [.medium, .large] : [.medium])
    }
}
































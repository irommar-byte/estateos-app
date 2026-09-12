import SwiftData
import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var wallet: WalletModel
    @EnvironmentObject private var lock: BiometricLock
    @Query private var tickets: [Ticket]
    @Query private var receipts: [Receipt]

    var body: some View {
        Form {
            Section {
                Toggle("7 dni przed terminem", isOn: $wallet.settings.reminder7Days)
                Toggle("1 dzień przed terminem", isOn: $wallet.settings.reminder1Day)
                Toggle("W dniu wygaśnięcia", isOn: $wallet.settings.reminderOnDay)
                Toggle("Udostępniaj nowe kaucje rodzinie", isOn: $wallet.settings.shareNewTicketsWithFamily)
                    .disabled(wallet.family.familyWalletID == nil)
            } header: {
                Text("Kaucje")
            } footer: {
                Text(wallet.family.familyWalletID == nil
                     ? "Przypomnienia o końcu ważności kwitków z butelkomatu. Udostępnianie włączysz po zaproszeniu bliskich w dziale Rodzina."
                     : "Przypomnienia o końcu ważności. Nowe kaucje idą do rodziny osobno od paragonów.")
            }

            Section {
                Toggle("30 dni przed końcem gwarancji", isOn: $wallet.settings.warrantyReminder30)
                Toggle("7 dni przed końcem gwarancji", isOn: $wallet.settings.warrantyReminder7)
                Toggle("3 dni przed końcem zwrotu", isOn: $wallet.settings.returnReminder3)
                Toggle("Udostępniaj nowe paragony rodzinie", isOn: $wallet.settings.shareNewReceiptsWithFamily)
                    .disabled(wallet.family.familyWalletID == nil)
            } header: {
                Text("Paragony")
            } footer: {
                Text(wallet.family.familyWalletID == nil
                     ? "Elektronika, RTV i AGD dostają 24 miesiące gwarancji. Ubrania, buty i rozrywka — 14 dni na zwrot."
                     : "Gwarancja i zwroty. Nowe paragony idą do rodziny osobno od kaucji.")
            }

            Section {
                Toggle(lockToggleTitle, isOn: lockBinding)
                    .disabled(lock.isAvailable == false)
            } header: {
                Text("Ochrona")
            } footer: {
                Text("Po zablokowaniu ekranu \(Brand.displayName) pyta o \(lock.biometryTitle), zanim pokaże kaucje i paragony.")
            }

            Section("Kasa") {
                Toggle("Maksymalna jasność przy kodzie", isOn: $wallet.settings.boostBrightness)
            }

            Section("Skanowanie") {
                Toggle("Po Skanuj od razu włącz aparat", isOn: $wallet.settings.scanOpensImmediately)
            }

            Section("Prywatność") {
                Text("Zdjęcia kaucji i paragonów zostają na tym iPhonie i — gdy iCloud jest włączony — w Twojej prywatnej chmurze Apple. ParagonOS™ nie ma własnego serwera kont.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section(Brand.displayName) {
                LabeledContent("Wersja", value: Self.versionLabel)
                Text(Brand.slogan)
                Text(Brand.disclaimer)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Ustawienia")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: wallet.settings.reminder7Days) { _, _ in refresh() }
        .onChange(of: wallet.settings.reminder1Day) { _, _ in refresh() }
        .onChange(of: wallet.settings.reminderOnDay) { _, _ in refresh() }
        .onChange(of: wallet.settings.warrantyReminder30) { _, _ in refresh() }
        .onChange(of: wallet.settings.warrantyReminder7) { _, _ in refresh() }
        .onChange(of: wallet.settings.returnReminder3) { _, _ in refresh() }
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
        Task { await wallet.refreshNotifications(tickets: tickets, receipts: receipts) }
    }

    private static var versionLabel: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(version) (\(build))"
    }
}

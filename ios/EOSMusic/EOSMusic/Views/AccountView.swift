import SwiftUI

/// Account / settings — Apple Settings–style hierarchy.
struct AccountView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences
    @ObservedObject private var apple = AppleSignInService.shared
    @State private var isAppleBusy = false
    @State private var appleMessage: String?
    @State private var showLogoutConfirm = false

    private var isAppleConnected: Bool {
        app.user?.isAppleLinked == true || apple.isLinked
    }

    private var appleConnectedLabel: String {
        if let email = app.user?.appleEmail, !email.isEmpty { return email }
        if let email = apple.linkedAccount?.email, !email.isEmpty { return email }
        if let name = apple.linkedAccount?.fullName, !name.isEmpty { return name }
        return app.user?.appleDisplayName ?? "Połączono z Apple ID"
    }

    private var localFileCount: Int { OfflineMusicStore.shared.downloadedFileCount }

    var body: some View {
        NavigationStack {
            List {
                profileSection
                playbackSection
                appearanceSection
                storageSection
                appleSection
                aboutSection
                logoutSection
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background { EOSAmbientBackground().ignoresSafeArea() }
            .settingsInsetSurfaces()
            .eosScrollClearance()
            .navigationTitle("Konto")
            .navigationBarTitleDisplayMode(.large)
            .task {
                await app.refreshServerAssets()
                await app.refreshAppleLinkStatus()
            }
            .alert("Apple ID", isPresented: Binding(get: { appleMessage != nil }, set: { if !$0 { appleMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(appleMessage ?? "")
            }
            .confirmationDialog("Wylogować się?", isPresented: $showLogoutConfirm, titleVisibility: .visible) {
                Button("Wyloguj się", role: .destructive) {
                    withAnimation(EOSMotion.soft) { app.logout() }
                }
                Button("Anuluj", role: .cancel) {}
            } message: {
                Text("Ulubione i biblioteka na serwerze zostaną. Lokalne pobrania pozostaną na tym iPhonie.")
            }
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var profileSection: some View {
        Section {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(EOSTheme.accent.opacity(0.14))
                        .frame(width: 58, height: 58)
                    Text(avatarInitials)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(EOSTheme.accent)
                }
                .shadow(color: EOSTheme.accent.opacity(0.18), radius: 8, y: 3)

                VStack(alignment: .leading, spacing: 3) {
                    Text(app.user?.login ?? "Gość")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(isAppleConnected ? "Apple ID połączone" : "Konto Nostalgie™")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 6)
            .accessibilityElement(children: .combine)
        }
    }

    private var avatarInitials: String {
        let login = (app.user?.login ?? "?").trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = login.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(login.prefix(2)).uppercased()
    }

    private var playbackSection: some View {
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

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Label("Moc efektów", systemImage: "dial.medium.fill")
                        .foregroundStyle(.primary)
                    Spacer()
                    Text("\(Int((ui.playerEffectsIntensity * 100).rounded()))%")
                        .font(.subheadline.monospacedDigit().weight(.semibold))
                        .foregroundStyle(EOSTheme.accent)
                }
                Slider(value: $ui.playerEffectsIntensity, in: 0...1, step: 0.01)
                    .tint(EOSTheme.accent)
                    .disabled(ui.playerVisualPreset == .off)
            }
            .padding(.vertical, 2)

            Toggle(isOn: $ui.playerStrobeEnabled.animation(EOSMotion.snappy)) {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Strobo")
                        Text("Bezpieczne impulsy · max 3/s · Spectrum/Pulse")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "light.max")
                        .foregroundStyle(EOSTheme.accent)
                }
            }
            .tint(EOSTheme.accent)
            .disabled(!ui.playerVisualPreset.allowsStrobe)

            Toggle(isOn: $ui.playerAutoPerformance.animation(EOSMotion.snappy)) {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Automatyczna wydajność")
                        Text("Oszczędza baterię i chłodzi urządzenie")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "gauge.with.dots.needle.33percent")
                        .foregroundStyle(EOSTheme.accent)
                }
            }
            .tint(EOSTheme.accent)

            Toggle(isOn: $ui.ultraCompact.animation(EOSMotion.snappy)) {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Kompaktowa lista")
                        Text("Więcej utworów na ekranie")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "list.bullet.rectangle.portrait")
                        .foregroundStyle(EOSTheme.accent)
                }
            }
            .tint(EOSTheme.accent)
        } header: {
            Text("Odtwarzanie")
        } footer: {
            Text("Presety i moc możesz też zmienić w pełnym playerze (ikona suwaków). Efekty są tylko wizualne.")
        }
    }

    private var appearanceSection: some View {
        Section {
            ForEach(AppAppearance.allCases) { mode in
                SettingsChoiceRow(
                    title: mode.title,
                    systemImage: appearanceIcon(mode),
                    isSelected: ui.appearance == mode
                ) {
                    ui.appearance = mode
                }
            }
        } header: {
            Text("Wygląd")
        }
    }

    private var storageSection: some View {
        Section {
            NavigationLink {
                LocalDownloadsBrowseView()
            } label: {
                storageRow(
                    icon: "iphone",
                    title: "Na tym iPhonie",
                    value: localFileCount == 1 ? "1 plik" : "\(localFileCount) plików"
                )
            }

            NavigationLink {
                ServerMusicAssetsView()
            } label: {
                storageRow(
                    icon: "externaldrive.fill.badge.checkmark",
                    title: "Biblioteka EOS",
                    value: ByteCountFormatter.string(
                        fromByteCount: Int64(app.serverLibraryBytes),
                        countStyle: .file
                    )
                )
            }
        } header: {
            Text("Pamięć")
        } footer: {
            Text("Pobrane działają offline. Kopia na serwerze EOS jest dostępna na każdym zalogowanym urządzeniu.")
        }
    }

    private func storageRow(icon: String, title: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body.weight(.semibold))
                .foregroundStyle(EOSTheme.accent)
                .frame(width: 28)
            Text(title)
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }

    private var appleSection: some View {
        Section {
            if isAppleConnected {
                HStack(spacing: 12) {
                    Image(systemName: "apple.logo")
                        .font(.title3.weight(.semibold))
                        .frame(width: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Apple ID")
                            .font(.body.weight(.semibold))
                        Text(appleConnectedLabel)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    Spacer()
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }
                .padding(.vertical, 2)

                Button(role: .destructive) {
                    Task { await unlinkApple() }
                } label: {
                    Label("Odłącz Apple ID", systemImage: "link.badge.plus")
                }
                .disabled(isAppleBusy)
            } else {
                Button {
                    Task { await linkAppleToCurrentAccount() }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "apple.logo")
                            .font(.body.weight(.semibold))
                        Text(isAppleBusy ? "Łączenie…" : "Połącz z Apple ID")
                            .font(.body.weight(.semibold))
                        Spacer()
                    }
                    .foregroundStyle(.primary)
                }
                .disabled(isAppleBusy || app.user == nil)
            }
        } header: {
            Text("Apple")
        } footer: {
            if app.user == nil {
                Text("Zaloguj się, aby powiązać Apple ID z kontem Nostalgie™.")
            } else if isAppleConnected {
                Text("Możesz logować się Apple ID na innych urządzeniach tym samym kontem.")
            } else {
                Text("Powiąż Apple ID z kontem „\(app.user?.login ?? "")”.")
            }
        }
    }

    private var aboutSection: some View {
        Section {
            Link(destination: AppConfig.privacyPolicyURL) {
                Label("Polityka prywatności", systemImage: "hand.raised.fill")
            }
            Link(destination: AppConfig.supportURL) {
                Label("Wsparcie", systemImage: "questionmark.circle.fill")
            }
            LabeledContent("Wersja", value: AppConfig.appVersion)
        } header: {
            Text("Informacje")
        }
    }

    private var logoutSection: some View {
        Section {
            Button(role: .destructive) {
                showLogoutConfirm = true
            } label: {
                HStack {
                    Spacer()
                    Text("Wyloguj się")
                        .font(.body.weight(.semibold))
                    Spacer()
                }
            }
        }
    }

    // MARK: - Helpers

    private func appearanceIcon(_ mode: AppAppearance) -> String {
        switch mode {
        case .system: return "circle.lefthalf.filled"
        case .light: return "sun.max.fill"
        case .dark: return "moon.fill"
        }
    }

    private func linkAppleToCurrentAccount() async {
        guard app.user != nil else {
            appleMessage = "Zaloguj się na konto Nostalgie™, aby powiązać Apple ID."
            return
        }
        isAppleBusy = true
        defer { isAppleBusy = false }
        do {
            let result = try await AppleSignInService.shared.signIn()
            let saved = CredentialsStore.load()
            try await app.linkAppleAccount(
                identityToken: result.identityToken,
                login: saved?.login,
                password: saved?.password
            )
            let linkedEmail = app.user?.appleEmail ?? result.email
            try AppleSignInService.shared.storeLink(AppleAccountLink(
                userId: app.user?.appleUserId ?? result.userId,
                email: linkedEmail,
                fullName: result.fullName,
                linkedAt: Date()
            ))
            await app.refreshAppleLinkStatus()
            app.presentToast(MusicToast(
                systemImage: "checkmark.circle.fill",
                title: "Połączono z Apple ID",
                subtitle: linkedEmail
            ))
        } catch {
            if case AppleSignInError.cancelled = error { return }
            appleMessage = error.localizedDescription
        }
    }

    private func unlinkApple() async {
        let userId = app.user?.appleUserId ?? apple.linkedAccount?.userId
        guard let userId, !userId.isEmpty else {
            appleMessage = "Brak identyfikatora Apple do odłączenia."
            return
        }
        isAppleBusy = true
        defer { isAppleBusy = false }
        do {
            try await app.unlinkAppleAccount(appleUserId: userId)
            app.presentToast(MusicToast(
                systemImage: "link.badge.plus",
                title: "Odłączono Apple ID",
                subtitle: nil
            ))
        } catch {
            appleMessage = error.localizedDescription
        }
    }
}

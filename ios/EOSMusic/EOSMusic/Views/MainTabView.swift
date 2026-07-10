import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            LibraryView()
                .miniPlayerTabInset()
                .tabItem { Label("Biblioteka", systemImage: "music.note.list") }

            SearchCatalogView()
                .miniPlayerTabInset()
                .tabItem { Label("Szukaj", systemImage: "magnifyingglass") }

            SourcesView()
                .miniPlayerTabInset()
                .tabItem { Label("Przeglądaj", systemImage: "folder.fill") }

            SettingsView()
                .miniPlayerTabInset()
                .tabItem { Label("Konto", systemImage: "person.circle") }
        }
        .tint(EOSTheme.accent)
    }
}

struct SettingsView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences
    @ObservedObject private var apple = AppleSignInService.shared
    @State private var isAppleBusy = false
    @State private var appleMessage: String?

    private var needsMiniPlayerClearance: Bool {
        app.playback.engine != nil && !app.isFullPlayerPresented
    }

    var body: some View {
        NavigationStack {
            ZStack {
                EOSAmbientBackground()
                    .allowsHitTesting(false)

                List {
                    if let user = app.user {
                        Section("Konto Nostalgie™") {
                            LabeledContent("Login", value: user.login)
                        }
                    }

                    Section {
                        if apple.isLinked {
                            if let email = apple.linkedAccount?.email, !email.isEmpty {
                                LabeledContent("Apple ID", value: email)
                            } else {
                                Label("Połączono z Apple ID", systemImage: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                            }
                            FilesListButton {
                                Task { await unlinkApple() }
                            } label: {
                                FilesActionRow(icon: "link.badge.plus", title: "Odłącz Apple ID", iconColor: .red, titleColor: .red)
                            }
                            .disabled(isAppleBusy)
                        } else {
                            Button {
                                Task { await linkAppleToCurrentAccount() }
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "apple.logo")
                                        .font(.body.weight(.semibold))
                                    Text("Połącz z Apple ID")
                                        .font(.body.weight(.semibold))
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .foregroundStyle(.white)
                                .background(Color.black, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .disabled(isAppleBusy || app.user == nil)
                        }
                    } header: {
                        Text("Apple Account")
                    } footer: {
                        if app.user == nil {
                            Text("Zaloguj się, aby powiązać Apple ID z kontem Nostalgie™.")
                        } else {
                            Text("Powiąż Apple ID z aktualnie zalogowanym kontem Nostalgie™.")
                        }
                    }

                    Section("Pliki") {
                        LabeledContent("Folder pobranych", value: AppDocuments.downloadsFolderName)
                        Text("Pliki → Na moim iPhonie → \(AppConfig.appDisplayName) → Pobrane")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    Section("Motyw") {
                        ForEach(AppAppearance.allCases) { mode in
                            SettingsChoiceRow(
                                title: mode.title,
                                isSelected: ui.appearance == mode
                            ) {
                                ui.appearance = mode
                            }
                        }
                    }

                    Section("Efekty playera") {
                        ForEach(PlayerEffectsMode.allCases) { mode in
                            SettingsChoiceRow(
                                title: mode.title,
                                isSelected: ui.playerEffectsMode == mode
                            ) {
                                ui.playerEffectsMode = mode
                            }
                        }
                    }

                    Section {
                        Toggle("Ultra Compact (więcej utworów na ekranie)", isOn: $ui.ultraCompact)
                    }

                    Section("Informacje") {
                        Link("Polityka prywatności", destination: AppConfig.privacyPolicyURL)
                        Link("Wsparcie", destination: AppConfig.supportURL)
                        LabeledContent("Wersja", value: AppConfig.appVersion)
                    }

                    Section {
                        Button("Wyloguj się", role: .destructive) {
                            app.logout()
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .settingsInsetSurfaces()
            }
            .contentMargins(.bottom, needsMiniPlayerClearance ? 36 : 0, for: .scrollContent)
            .navigationTitle("Konto")
            .alert("Apple ID", isPresented: Binding(get: { appleMessage != nil }, set: { if !$0 { appleMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(appleMessage ?? "")
            }
        }
    }

    private func linkAppleToCurrentAccount() async {
        guard let saved = CredentialsStore.load() else {
            appleMessage = "Włącz „Zapamiętaj mnie” przy logowaniu lub zaloguj się ponownie, aby powiązać Apple ID."
            return
        }
        isAppleBusy = true
        defer { isAppleBusy = false }
        do {
            let result = try await AppleSignInService.shared.signIn()
            try await app.linkAppleAccount(
                identityToken: result.identityToken,
                login: saved.login,
                password: saved.password
            )
            try AppleSignInService.shared.storeLink(AppleAccountLink(
                userId: result.userId,
                email: result.email,
                fullName: result.fullName,
                linkedAt: Date()
            ))
            appleMessage = "Konto Apple zostało powiązane."
        } catch {
            if case AppleSignInError.cancelled = error { return }
            appleMessage = error.localizedDescription
        }
    }

    private func unlinkApple() async {
        guard let userId = apple.linkedAccount?.userId else { return }
        isAppleBusy = true
        defer { isAppleBusy = false }
        do {
            try await app.unlinkAppleAccount(appleUserId: userId)
            appleMessage = "Odłączono Apple ID."
        } catch {
            appleMessage = error.localizedDescription
        }
    }
}

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

                    Section {
                        LabeledContent("Folder", value: AppDocuments.downloadsFolderName)
                        Text("Pliki → Na moim iPhonie → \(AppConfig.appDisplayName) → Pobrane")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Text("Tu trafiają utwory po „Pobierz”. Działają offline. Usunięcie z iPhone’a nie kasuje kopii na serwerze EOS.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        NavigationLink {
                            LocalDownloadsBrowseView()
                        } label: {
                            Label("Przeglądaj i udostępniaj lokalne pliki", systemImage: "folder")
                        }
                        LabeledContent("Na tym iPhonie", value: "\(OfflineMusicStore.shared.downloadedFileCount) plików")
                    } header: {
                        Text("Na tym iPhonie")
                    }

                    Section {
                        LabeledContent("Utwory w bibliotece EOS", value: "\(app.serverAssetCount)")
                        LabeledContent("Rozmiar na serwerze", value: ByteCountFormatter.string(fromByteCount: Int64(app.serverLibraryBytes), countStyle: .file))
                        Text("Po pierwszym udanym pozyskaniu utwór zostaje na serwerze EOS (MP3 + okładka + tagi). Na każdym zalogowanym urządzeniu otwiera się od razu — bez ponownego sięgania do źródła pierwotnego.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Text("Pliki serwerowe nie widać w aplikacji Pliki, dopóki nie pobierzesz ich na urządzenie.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        if !app.serverAssets.isEmpty {
                            NavigationLink {
                                ServerMusicAssetsView()
                            } label: {
                                Label("Lista utworów na serwerze", systemImage: "externaldrive.fill.badge.checkmark")
                            }
                        }
                    } header: {
                        Text("Biblioteka EOS (serwer)")
                    } footer: {
                        Text("Źródło pierwotne jest używane tylko przy pierwszym pozyskaniu utworu. Potem gra i pobiera wyłącznie biblioteka EOS.")
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
            .task {
                await app.refreshServerAssets()
            }
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


struct ServerMusicAssetsView: View {
    @EnvironmentObject private var app: AppModel
    @State private var assetToDelete: MusicAssetItem?
    @State private var sharePayload: SharePayload?

    private struct SharePayload: Identifiable {
        let id = UUID()
        let url: URL
    }

    var body: some View {
        List {
            Section {
                ForEach(app.serverAssets) { asset in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(asset.title ?? "Utwór")
                            .font(.body.weight(.semibold))
                        Text([asset.artist, asset.album].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        if let bytes = asset.bytes {
                            Text(ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file))
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button("Usuń z serwera", role: .destructive) {
                            assetToDelete = asset
                        }
                    }
                    .contextMenu {
                        Button {
                            Task { await downloadAndShare(asset) }
                        } label: {
                            Label("Pobierz z serwera i udostępnij", systemImage: "square.and.arrow.up")
                        }
                        Button("Usuń z serwera", role: .destructive) {
                            assetToDelete = asset
                        }
                    }
                }
            } footer: {
                Text("Usunięcie z serwera kasuje trwałą kopię EOS. Lokalne pliki na iPhonie zostają.")
            }
        }
        .navigationTitle("Serwer EOS")
        .task { await app.refreshServerAssets() }
        .confirmationDialog(
            "Usunąć utwór z biblioteki serwera?",
            isPresented: Binding(get: { assetToDelete != nil }, set: { if !$0 { assetToDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("Usuń z serwera", role: .destructive) {
                if let id = assetToDelete?.assetId {
                    Task { await app.deleteServerAsset(id) }
                }
                assetToDelete = nil
            }
            Button("Anuluj", role: .cancel) { assetToDelete = nil }
        }
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: [payload.url])
        }
    }

    private func downloadAndShare(_ asset: MusicAssetItem) async {
        guard let url = asset.url, !url.isEmpty else { return }
        do {
            let ensure = try await app.api.startMusicPlay(url: url)
            if ensure.ready != true {
                try await app.api.waitForMusicPlayReady(jobId: ensure.jobId)
            }
            let token = try await app.api.musicPlayToken(jobId: ensure.jobId)
            let request = app.api.streamURLRequest(jobId: ensure.jobId, token: token.token)
            try await OfflineMusicStore.shared.save(
                request: request,
                trackUrl: url,
                title: asset.title ?? "Utwór",
                artist: asset.artist,
                downloadJobId: ensure.jobId
            )
            if let local = OfflineMusicStore.shared.localURL(for: url) {
                sharePayload = SharePayload(url: local)
            }
            await app.refreshServerAssets()
        } catch {
            app.libraryError = error.localizedDescription
        }
    }
}

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

    private var isAppleConnected: Bool {
        app.user?.isAppleLinked == true || apple.isLinked
    }

    private var appleConnectedLabel: String {
        if let email = app.user?.appleEmail, !email.isEmpty { return email }
        if let email = apple.linkedAccount?.email, !email.isEmpty { return email }
        if let name = apple.linkedAccount?.fullName, !name.isEmpty { return name }
        return app.user?.appleDisplayName ?? "Połączono z Apple ID"
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
                        if isAppleConnected {
                            HStack(spacing: 10) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Połączono")
                                        .font(.subheadline.weight(.semibold))
                                    Text(appleConnectedLabel)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
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
                                    Text(isAppleBusy ? "Łączenie…" : "Połącz z Apple ID")
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
                        } else if isAppleConnected {
                            Text("Apple ID jest powiązane z kontem „\(app.user?.login ?? "")”. Możesz się nim logować na innych urządzeniach.")
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
                await app.refreshAppleLinkStatus()
            }
            .alert("Apple ID", isPresented: Binding(get: { appleMessage != nil }, set: { if !$0 { appleMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(appleMessage ?? "")
            }
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
            // Prefer session Bearer link; fall back to remembered password if present.
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


private enum ServerBrowseMode: String, CaseIterable, Identifiable {
    case artists
    case albums
    case songs

    var id: String { rawValue }

    var title: String {
        switch self {
        case .artists: return "Wykonawcy"
        case .albums: return "Albumy"
        case .songs: return "Utwory"
        }
    }
}

struct ServerMusicAssetsView: View {
    @EnvironmentObject private var app: AppModel
    @State private var mode: ServerBrowseMode = .songs
    @State private var query = ""
    @State private var selectedArtist: String?
    @State private var selectedAlbum: String?
    @State private var assetToDelete: MusicAssetItem?
    @State private var sharePayload: SharePayload?
    @State private var isRefreshing = false

    private struct SharePayload: Identifiable {
        let id = UUID()
        let url: URL
    }

    private var assets: [MusicAssetItem] {
        let base = app.serverAssets.sorted { lhs, rhs in
            let lt = lhs.title ?? ""
            let rt = rhs.title ?? ""
            return lt.localizedCaseInsensitiveCompare(rt) == .orderedAscending
        }
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 1 else { return base }
        return base.filter {
            ($0.title?.localizedCaseInsensitiveContains(q) == true)
                || ($0.artist?.localizedCaseInsensitiveContains(q) == true)
                || ($0.album?.localizedCaseInsensitiveContains(q) == true)
        }
    }

    private var artists: [(name: String, count: Int)] {
        var map: [String: Int] = [:]
        for asset in assets {
            let name = asset.artist?.trimmingCharacters(in: .whitespacesAndNewlines)
            let key = (name?.isEmpty == false) ? name! : "Nieznany wykonawca"
            map[key, default: 0] += 1
        }
        return map
            .map { (name: $0.key, count: $0.value) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private var albums: [(id: String, title: String, artist: String?, count: Int)] {
        var map: [String: (title: String, artist: String?, count: Int)] = [:]
        for asset in assets {
            let title = asset.album?.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let title, !title.isEmpty else { continue }
            let key = "\(title.lowercased())|\((asset.artist ?? "").lowercased())"
            if var existing = map[key] {
                existing.count += 1
                map[key] = existing
            } else {
                map[key] = (title, asset.artist, 1)
            }
        }
        return map
            .map { (id: $0.key, title: $0.value.title, artist: $0.value.artist, count: $0.value.count) }
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    private var filteredAssets: [MusicAssetItem] {
        if let selectedArtist {
            return assets.filter {
                let name = $0.artist?.trimmingCharacters(in: .whitespacesAndNewlines)
                let key = (name?.isEmpty == false) ? name! : "Nieznany wykonawca"
                return key == selectedArtist
            }
        }
        if let selectedAlbum {
            return assets.filter { $0.album == selectedAlbum }
        }
        return assets
    }

    var body: some View {
        Group {
            if app.serverAssets.isEmpty && !isRefreshing {
                ContentUnavailableView(
                    "Brak muzyki na serwerze",
                    systemImage: "externaldrive",
                    description: Text("Gdy odtworzysz lub dodasz utwór do biblioteki, trwała kopia EOS pojawi się tutaj.")
                )
            } else {
                ScrollViewReader { proxy in
                    List {
                        Section {
                            Picker("Widok", selection: $mode) {
                                ForEach(ServerBrowseMode.allCases) { item in
                                    Text(item.title).tag(item)
                                }
                            }
                            .pickerStyle(.segmented)
                            .listRowBackground(Color.clear)
                            .onChange(of: mode) { _, _ in
                                selectedArtist = nil
                                selectedAlbum = nil
                            }

                            if !filteredAssets.isEmpty {
                                Button {
                                    Task { await app.playServerAssets(filteredAssets, startIndex: 0) }
                                } label: {
                                    Label(
                                        "Odtwórz \(filteredAssets.count == app.serverAssets.count ? "wszystko" : "wybór") (\(filteredAssets.count))",
                                        systemImage: "play.fill"
                                    )
                                    .font(.headline)
                                    .foregroundStyle(EOSTheme.accent)
                                }
                            }
                        }

                        switch mode {
                        case .artists:
                            artistSections
                        case .albums:
                            albumSections
                        case .songs:
                            songSections
                        }
                    }
                    .listStyle(.insetGrouped)
                    .overlay(alignment: .trailing) {
                        if mode == .songs, selectedArtist == nil, selectedAlbum == nil {
                            AlphabetIndexBar(
                                available: Set(LibraryAlphabet.group(filteredAssets) { $0.title ?? "Utwór" }.map(\.key))
                            ) { letter in
                                withAnimation(.easeOut(duration: 0.12)) {
                                    proxy.scrollTo(letter, anchor: .top)
                                }
                            }
                            .padding(.trailing, 2)
                        }
                    }
                }
            }
        }
        .navigationTitle("Serwer EOS")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Szukaj na serwerze")
        .task {
            isRefreshing = true
            await app.refreshServerAssets()
            isRefreshing = false
        }
        .refreshable { await app.refreshServerAssets() }
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
        } message: {
            Text("Trwała kopia EOS zniknie. Lokalne pliki na iPhonie zostaną.")
        }
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: [payload.url])
        }
    }

    @ViewBuilder
    private var artistSections: some View {
        if let selectedArtist {
            Section {
                Button { self.selectedArtist = nil } label: {
                    Label(selectedArtist, systemImage: "chevron.backward")
                }
            }
            assetList(filteredAssets)
        } else {
            Section("\(artists.count) wykonawców") {
                ForEach(artists, id: \.name) { artist in
                    Button { selectedArtist = artist.name } label: {
                        HStack {
                            Text(artist.name).foregroundStyle(.primary)
                            Spacer()
                            Text("\(artist.count)").foregroundStyle(.secondary)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var albumSections: some View {
        if let selectedAlbum {
            Section {
                Button { self.selectedAlbum = nil } label: {
                    Label(selectedAlbum, systemImage: "chevron.backward")
                }
            }
            assetList(filteredAssets)
        } else if albums.isEmpty {
            Section {
                Text("Brak albumów w metadanych — przełącz na Utwory.")
                    .foregroundStyle(.secondary)
            }
        } else {
            Section("\(albums.count) albumów") {
                ForEach(albums, id: \.id) { album in
                    Button { selectedAlbum = album.title } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(album.title).foregroundStyle(.primary)
                            Text([album.artist, "\(album.count) utw."].compactMap { $0 }.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var songSections: some View {
        ForEach(LibraryAlphabet.group(filteredAssets) { $0.title ?? "Utwór" }, id: \.key) { section in
            Section {
                ForEach(section.items) { asset in
                    assetRow(asset, in: filteredAssets)
                }
            } header: {
                Text(section.key)
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(.secondary)
                    .id(section.key)
            }
        }
    }

    @ViewBuilder
    private func assetList(_ items: [MusicAssetItem]) -> some View {
        Section("\(items.count) utworów") {
            ForEach(items) { asset in
                assetRow(asset, in: items)
            }
        }
    }

    private func assetRow(_ asset: MusicAssetItem, in queue: [MusicAssetItem]) -> some View {
        let index = queue.firstIndex(where: { $0.assetId == asset.assetId }) ?? 0
        return Button {
            Task { await app.playServerAssets(queue, startIndex: index) }
        } label: {
            HStack(spacing: 12) {
                ArtworkImage(
                    url: asset.thumbnail.flatMap(URL.init(string:)),
                    size: 44,
                    cornerRadius: 8
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(asset.title ?? "Utwór")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text([asset.artist, asset.album].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    if let bytes = asset.bytes {
                        Text(ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "play.circle.fill")
                    .foregroundStyle(EOSTheme.accent.opacity(0.85))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                Task { await app.playServerAssets(queue, startIndex: index) }
            } label: {
                Label("Odtwórz", systemImage: "play.fill")
            }
            Button {
                Task { await downloadAndShare(asset) }
            } label: {
                Label("Pobierz i udostępnij", systemImage: "square.and.arrow.up")
            }
            Button("Usuń z serwera", role: .destructive) {
                assetToDelete = asset
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button("Usuń", role: .destructive) {
                assetToDelete = asset
            }
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


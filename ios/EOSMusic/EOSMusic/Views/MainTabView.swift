import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences

    init() {
        EOSTypography.configureGlobalAppearance()
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some View {
        VStack(spacing: 0) {
            GlobalOfflineModeBar()
                .environmentObject(app)
                .environmentObject(ui)

            if let sync = app.librarySyncMessage, !app.isOfflinePlaybackActive {
                LibrarySyncStatusBar(
                    message: sync,
                    showsSpinner: app.isLibraryLoading
                )
            }

            if let queue = app.downloads.bulkServerQueue {
                ServerDownloadQueuePanel(queue: queue) {
                    app.downloads.cancelBulkServerQueue()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }

            if let batch = app.movieDownloads.activeBatch {
                MovieDownloadQueuePanel(batch: batch, service: app.movieDownloads)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
            }

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

                VideoLibraryView()
                    .miniPlayerTabInset()
                    .tabItem { Label("Wideo", systemImage: "film") }

                AccountView()
                    .miniPlayerTabInset()
                    .tabItem { Label("Konto", systemImage: "person.crop.circle.fill") }
            }
            .tint(EOSTheme.accent)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        // Offline sync lives in EOSMusicApp (configureOfflineMode + onChange); picker writes both.
        .syncPlayerVisualAnalysis()
    }
}

/// Compact Apple-style Online/Offline control pinned above every tab.
private struct GlobalOfflineModeBar: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                OnlineOfflineModeGlyph(
                    isOffline: ui.offlineModeEnabled,
                    networkOnline: app.network.isOnline,
                    isBusy: app.isNetworkBusy,
                    size: 17
                )
                .frame(width: 26)

                Picker("Tryb", selection: Binding(
                    get: { ui.offlineModeEnabled },
                    set: { enabled in
                        withAnimation(.spring(response: 0.48, dampingFraction: 0.78)) {
                            ui.offlineModeEnabled = enabled
                            app.offlineModeEnabled = enabled
                        }
                    }
                )) {
                    Text("Online").tag(false)
                    Text("Offline").tag(true)
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 280)

                Spacer(minLength: 0)

                if app.isOfflinePlaybackActive {
                    Text("\(app.downloadedLibraryTracks.count)")
                        .font(.caption.weight(.bold).monospacedDigit())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(EOSTheme.accent, in: Capsule())
                        .accessibilityLabel("Pobrane utwory")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            if app.isOfflinePlaybackActive || !app.network.isOnline {
                Text(statusCaption)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }

            Divider()
        }
        .background(.bar)
    }

    private var statusCaption: String {
        if ui.offlineModeEnabled {
            return "Offline · Biblioteka, Szukaj i player pokazują tylko pobrane."
        }
        if !app.network.isOnline {
            return "Brak sieci · włącz Offline, aby przeglądać pobrane."
        }
        return ""
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
                    .eosScrollClearance()
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
            if let existing = OfflineMusicStore.shared.localURL(for: url) {
                sharePayload = SharePayload(url: existing)
                return
            }
            // Route through MusicDownloadService so concurrency / retry / progress stay shared.
            try await app.downloads.downloadAssetToDevice(
                url: url,
                title: asset.title ?? "Utwór",
                artist: asset.artist,
                api: app.api,
                onLibraryChanged: { [weak app] in
                    await app?.refreshServerAssets()
                }
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


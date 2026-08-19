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
                ServerDownloadQueuePanel(
                    queue: queue,
                    isMinimized: Binding(
                        get: { app.downloads.isBulkQueueMinimized },
                        set: { app.downloads.isBulkQueueMinimized = $0 }
                    )
                ) {
                    app.cancelBulkMusicQueue()
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
            return "Offline · muzyka i filmy: tylko pliki zapisane na tym iPhonie."
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

private enum ServerMediaKind: String, CaseIterable, Identifiable {
    case music
    case movies

    var id: String { rawValue }

    var title: String {
        switch self {
        case .music: return "Muzyka"
        case .movies: return "Filmy"
        }
    }
}

struct ServerMusicAssetsView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @State private var mediaKind: ServerMediaKind = .music
    @State private var mode: ServerBrowseMode = .songs
    @State private var query = ""
    @State private var selectedArtist: String?
    @State private var selectedAlbum: String?
    @State private var assetToDelete: MusicAssetItem?
    @State private var movieToDelete: MovieDownload?
    @State private var movieSelection: OnlineMovieSelection?
    @State private var sharePayload: SharePayload?
    @State private var isRefreshing = false
    @State private var movieEditMode: EditMode = .inactive

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

    private var filteredMovies: [MovieDownload] {
        let base = app.onlineMovies.downloads.sorted {
            $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
        }
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 1 else { return base }
        return base.filter {
            $0.title.localizedCaseInsensitiveContains(q)
                || ($0.serverRelativePath?.localizedCaseInsensitiveContains(q) == true)
                || ($0.source?.localizedCaseInsensitiveContains(q) == true)
        }
    }

    private var groupedMovies: [(series: String, items: [MovieDownload])] {
        let dict = Dictionary(grouping: filteredMovies) { $0.seriesFolderName ?? "Filmy" }
        return dict.keys.sorted().map { key in
            (series: key, items: dict[key]!.sorted {
                $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
            })
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

    private var serverBreakdown: StorageBreakdown? {
        let musicBytes = Int64(app.serverLibraryBytes)
        let movieBytes = Int64(app.onlineMovies.serverMovieBytes)
        let musicCount = app.serverAssetCount
        let movieCount = app.onlineMovies.serverMovieCount
        if let total = app.serverDiskTotalBytes, total > 0 {
            let free = Int64(app.serverDiskFreeBytes ?? max(0, total - Int(musicBytes + movieBytes)))
            return .disk(
                musicBytes: musicBytes,
                movieBytes: movieBytes,
                musicCount: musicCount,
                movieCount: movieCount,
                diskTotal: Int64(total),
                diskFree: free
            )
        }
        if musicBytes + movieBytes <= 0 { return nil }
        return .libraryOnly(
            musicBytes: musicBytes,
            movieBytes: movieBytes,
            musicCount: musicCount,
            movieCount: movieCount
        )
    }

    private var serverStorageLibraryOnly: Bool {
        app.serverDiskTotalBytes == nil || (app.serverDiskTotalBytes ?? 0) <= 0
    }

    var body: some View {
        Group {
            if app.serverAssets.isEmpty
                && app.onlineMovies.downloads.isEmpty
                && app.onlineMovies.serverMovieCount == 0
                && !isRefreshing
            {
                ContentUnavailableView(
                    "Brak mediów na serwerze",
                    systemImage: "externaldrive",
                    description: Text("Gdy odtworzysz lub dodasz utwór albo film, trwała kopia EOS pojawi się tutaj.")
                )
            } else {
                ScrollViewReader { proxy in
                    List {
                        if let serverBreakdown {
                            Section {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Miejsce na serwerze")
                                        .font(.subheadline.weight(.semibold))
                                    StorageCapacityBar(
                                        breakdown: serverBreakdown,
                                        showsLegend: true,
                                        libraryOnly: serverStorageLibraryOnly
                                    )
                                    HStack(spacing: 12) {
                                        Label(
                                            "\(app.serverAssetCount) utw. · \(ByteCountFormatter.string(fromByteCount: Int64(app.serverLibraryBytes), countStyle: .file))",
                                            systemImage: "music.note"
                                        )
                                        Label(
                                            "\(app.onlineMovies.serverMovieCount) film. · \(ByteCountFormatter.string(fromByteCount: Int64(app.onlineMovies.serverMovieBytes), countStyle: .file))",
                                            systemImage: "film"
                                        )
                                    }
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.85)
                                }
                                .padding(.vertical, 4)
                            }
                        }

                        Section {
                            Picker("Typ", selection: $mediaKind) {
                                ForEach(ServerMediaKind.allCases) { kind in
                                    Text(kind.title).tag(kind)
                                }
                            }
                            .pickerStyle(.segmented)
                            .listRowBackground(Color.clear)
                            .onChange(of: mediaKind) { _, _ in
                                selectedArtist = nil
                                selectedAlbum = nil
                                movieEditMode = .inactive
                            }
                        }

                        if mediaKind == .music {
                            musicBrowser
                        } else {
                            moviesBrowser
                        }
                    }
                    .listStyle(.insetGrouped)
                    .eosScrollClearance()
                    .environment(\.editMode, mediaKind == .movies ? $movieEditMode : .constant(.inactive))
                    .overlay(alignment: .trailing) {
                        if mediaKind == .music, mode == .songs, selectedArtist == nil, selectedAlbum == nil {
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
        .searchable(text: $query, prompt: mediaKind == .music ? "Szukaj muzyki" : "Szukaj filmów")
        .toolbar {
            if mediaKind == .movies, !filteredMovies.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    EditButton()
                }
            }
        }
        .task {
            isRefreshing = true
            async let music: Void = app.refreshServerAssets()
            async let movies: Void = app.onlineMovies.refreshDownloads()
            _ = await (music, movies)
            isRefreshing = false
        }
        .refreshable {
            await app.refreshServerAssets()
            await app.onlineMovies.refreshDownloads()
        }
        .navigationDestination(item: $movieSelection) { selection in
            OnlineDownloadedMediaDestination(selection: selection)
                .environmentObject(app)
                .environmentObject(video)
        }
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
        .confirmationDialog(
            "Usunąć film z serwera?",
            isPresented: Binding(get: { movieToDelete != nil }, set: { if !$0 { movieToDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("Usuń z MOVIES/", role: .destructive) {
                if let movie = movieToDelete {
                    Task { await app.onlineMovies.deleteServerDownload(url: movie.url) }
                }
                movieToDelete = nil
            }
            Button("Anuluj", role: .cancel) { movieToDelete = nil }
        } message: {
            if let movie = movieToDelete {
                Text("„\(movie.title)” zniknie z dysku serwera.")
            }
        }
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: [payload.url])
        }
    }

    @ViewBuilder
    private var musicBrowser: some View {
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

    @ViewBuilder
    private var moviesBrowser: some View {
        if filteredMovies.isEmpty {
            Section {
                ContentUnavailableView(
                    query.isEmpty ? "Brak filmów na serwerze" : "Brak wyników",
                    systemImage: "film",
                    description: Text(query.isEmpty
                        ? "Pobierz film z EOS™LIBRARY — plik trafi do MOVIES/ na VPS."
                        : "Spróbuj innej frazy.")
                )
                .listRowBackground(Color.clear)
            }
        } else {
            Section {
                HStack {
                    Label("\(filteredMovies.count) filmów", systemImage: "film.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(ByteCountFormatter.string(
                        fromByteCount: Int64(filteredMovies.reduce(0) { $0 + ($1.bytes ?? 0) }),
                        countStyle: .file
                    ))
                    .font(.subheadline.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.secondary)
                }
            }

            ForEach(groupedMovies, id: \.series) { group in
                Section {
                    ForEach(group.items) { download in
                        movieRow(download)
                    }
                    .onDelete { offsets in
                        for index in offsets {
                            let item = group.items[index]
                            Task { await app.onlineMovies.deleteServerDownload(url: item.url) }
                        }
                    }
                } header: {
                    HStack {
                        Image(systemName: "folder.fill")
                            .foregroundStyle(EOSTheme.accent)
                        Text(group.series)
                    }
                } footer: {
                    let bytes = group.items.reduce(0) { $0 + ($1.bytes ?? 0) }
                    Text("\(group.items.count) · \(ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file))")
                }
            }
        }
    }

    private func movieRow(_ download: MovieDownload) -> some View {
        Button {
            movieSelection = OnlineMovieSelection(download: download)
        } label: {
            HStack(spacing: 12) {
                ArtworkImage(url: download.artworkURL, size: 56, cornerRadius: 8)
                VStack(alignment: .leading, spacing: 3) {
                    Text(download.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)
                    if let path = download.serverRelativePath {
                        Text(path)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                    }
                    HStack(spacing: 8) {
                        if let bytes = download.bytes, bytes > 0 {
                            Text(ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                        OnlineMovieTransferBadge(state: app.onlineMovies.transferState(for: download.url))
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                movieSelection = OnlineMovieSelection(download: download)
            } label: {
                Label("Otwórz", systemImage: "play.fill")
            }
            Button {
                Task {
                    await app.onlineMovies.playFromServer(
                        selection: OnlineMovieSelection(download: download),
                        video: video
                    )
                }
            } label: {
                Label("Odtwórz teraz", systemImage: "play.circle")
            }
            Button("Usuń z serwera", role: .destructive) {
                movieToDelete = download
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button("Usuń", role: .destructive) {
                movieToDelete = download
            }
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
                    MarqueeText(
                        text: asset.title ?? "Utwór",
                        font: .body.weight(.semibold),
                        foreground: .primary,
                        speedPointsPerSecond: 28
                    )
                    MarqueeText(
                        text: [asset.artist, asset.album].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
                        font: .caption,
                        foreground: .secondary,
                        speedPointsPerSecond: 24
                    )
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


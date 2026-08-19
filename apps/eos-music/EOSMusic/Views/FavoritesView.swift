import SwiftUI

/// Per-account liked songs and movies (server `/api/favorites`, keyed by Nostalgie login).
struct FavoritesView: View {
    enum Segment: String, CaseIterable, Identifiable {
        case music
        case movies

        var id: String { rawValue }

        var label: String {
            switch self {
            case .music: return "Muzyka"
            case .movies: return "Filmy"
            }
        }
    }

    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var query = ""
    @State private var sharePayload: SharePayload?
    @State private var segment: Segment
    @State private var movieSelection: OnlineMovieSelection?

    init(initialSegment: Segment = .music) {
        _segment = State(initialValue: initialSegment)
    }

    private var musicFavorites: [FavoriteItem] {
        let base = app.favoriteItems.filter(\.isMusic)
        guard app.isOfflinePlaybackActive else { return base }
        return base.filter { app.isOfflineAvailable($0.url) }
    }

    private var movieFavorites: [FavoriteItem] {
        let base = app.favoriteItems.filter(\.isMovie)
        guard app.isOfflinePlaybackActive else { return base }
        return base.filter { app.isMovieOnPhone(url: $0.url) }
    }

    private var activeFavorites: [FavoriteItem] {
        segment == .music ? musicFavorites : movieFavorites
    }

    private var filtered: [FavoriteItem] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 1 else { return activeFavorites }
        return activeFavorites.filter {
            $0.title.localizedCaseInsensitiveContains(q)
                || ($0.detail?.localizedCaseInsensitiveContains(q) == true)
        }
    }

    var body: some View {
        Group {
            if isLoading && activeFavorites.isEmpty {
                ProgressView("Wczytuję ulubione…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if activeFavorites.isEmpty {
                ContentUnavailableView {
                    Label(segment == .music ? "Ulubione" : "Ulubione filmy", systemImage: "heart")
                } description: {
                    Text(emptyDescription)
                }
            } else if filtered.isEmpty {
                ContentUnavailableView.search(text: query)
            } else if segment == .movies {
                movieList
            } else {
                musicList
            }
        }
        .background(Color(.systemBackground))
        .navigationTitle(app.isOfflinePlaybackActive ? "Ulubione · Offline" : "Ulubione")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: segment == .music ? "Szukaj w ulubionych" : "Szukaj filmów")
        .safeAreaInset(edge: .top, spacing: 0) {
            Picker("Rodzaj", selection: $segment) {
                ForEach(Segment.allCases) { item in
                    Text(item.label).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color(.systemBackground))
        }
        .toolbar {
            if segment == .music, !musicFavorites.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await play(from: 0) }
                    } label: {
                        Image(systemName: "play.fill")
                    }
                    .accessibilityLabel("Odtwórz wszystkie")
                }
            }
        }
        .task { await load(showSpinner: activeFavorites.isEmpty) }
        .refreshable { await load(showSpinner: false) }
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: payload.items)
        }
        .navigationDestination(item: $movieSelection) { item in
            OnlineMovieDetailView(selection: item)
                .environmentObject(app)
                .environmentObject(video)
        }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var musicList: some View {
        List {
            Section {
                playAllHeader
            }
            .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 4, trailing: 20))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)

            Section {
                ForEach(Array(filtered.enumerated()), id: \.element.id) { index, item in
                    favoriteRow(item, index: index)
                }
            } header: {
                Text(countLabel)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(nil)
            }
        }
        .listStyle(.plain)
        .eosScrollClearance()
    }

    private var movieList: some View {
        List {
            Section {
                ForEach(filtered) { item in
                    movieRow(item)
                }
            } header: {
                Text(movieCountLabel)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(nil)
            }
        }
        .listStyle(.plain)
        .eosScrollClearance()
    }

    private var emptyDescription: String {
        if app.isOfflinePlaybackActive {
            return segment == .movies
                ? "Żaden ulubiony film nie jest skopiowany na ten iPhone. Włącz Online, pobierz „Serwer + iPhone”, potem wróć do Offline."
                : "Żadne ulubione nie są pobrane na to urządzenie. Włącz Online, pobierz utwory, potem wróć do Offline."
        }
        if app.user == nil {
            return "Zaloguj się, aby zapisywać ulubione na swoim koncie."
        }
        let login = app.user?.login ?? ""
        if segment == .movies {
            return login.isEmpty
                ? "Dotknij serduszka przy filmie albo odcinku, aby dodać go tutaj."
                : "Dotknij serduszka przy filmie albo odcinku. Lista zapisuje się na koncie „\(login)”."
        }
        if login.isEmpty {
            return "Dotknij serduszka przy utworze, aby dodać go tutaj."
        }
        return "Dotknij serduszka przy utworze. Ulubione zapisują się na koncie „\(login)”."
    }

    private var countLabel: String {
        let n = filtered.count
        if n == 1 { return "1 utwór" }
        if (2...4).contains(n) { return "\(n) utwory" }
        return "\(n) utworów"
    }

    private var movieCountLabel: String {
        let n = filtered.count
        if n == 1 { return "1 film" }
        if (2...4).contains(n) { return "\(n) filmy" }
        return "\(n) filmów"
    }

    private var playAllHeader: some View {
        Button {
            Task { await play(from: 0) }
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(LibraryAccent.icon.opacity(0.14))
                        .frame(width: 48, height: 48)
                    Image(systemName: "play.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(LibraryAccent.icon)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Odtwórz")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text("Wszystkie ulubione")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func movieRow(_ item: FavoriteItem) -> some View {
        HStack(spacing: 12) {
            Button {
                movieSelection = OnlineMovieSelection(favorite: item)
            } label: {
                HStack(spacing: 12) {
                    OnlineMovieBackdrop(url: item.thumbnail.flatMap(URL.init(string:)))
                        .frame(width: 72, height: 108)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.primary)
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                        if let detail = item.detail, !detail.isEmpty {
                            Text(detail)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            FavoriteButton(item: item, size: 17)
                .frame(width: 36, height: 44)

            TrackStorageActionButton(track: item.musicPayload)
        }
        .contextMenu {
            Button {
                movieSelection = OnlineMovieSelection(favorite: item)
            } label: {
                Label("Otwórz", systemImage: "play.fill")
            }
            Button {
                Task { await app.toggleFavorite(item) }
            } label: {
                Label("Usuń z ulubionych", systemImage: "heart.slash")
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                Task { await app.toggleFavorite(item) }
            } label: {
                Label("Usuń", systemImage: "heart.slash")
            }
        }
    }

    private func favoriteRow(_ item: FavoriteItem, index: Int) -> some View {
        HStack(spacing: 4) {
            Button {
                Task { await play(from: index) }
            } label: {
                TrackRowView(
                    index: index + 1,
                    title: item.title,
                    subtitle: item.detail,
                    duration: item.duration,
                    artworkURL: item.thumbnail.flatMap(URL.init(string:)),
                    isPlaying: app.playback.engine?.currentTrack?.url == item.url,
                    downloadState: app.downloads.uiState(
                        for: item.url,
                        isOnServer: app.isOnServer(item.url)
                    )
                )
            }
            .buttonStyle(.plain)

            FavoriteButton(item: item, size: 17)
                .frame(width: 36, height: 44)
        }
        .contextMenu {
            Button {
                Task { await play(from: index) }
            } label: {
                Label("Odtwórz", systemImage: "play.fill")
            }
            Button {
                Task { await app.toggleFavorite(item) }
            } label: {
                Label("Usuń z ulubionych", systemImage: "heart.slash")
            }
            Button {
                sharePayload = .text(shareText(for: item))
            } label: {
                Label("Udostępnij", systemImage: "square.and.arrow.up")
            }
            if let local = OfflineMusicStore.shared.localURL(for: item.url) {
                Button {
                    sharePayload = .file(local)
                } label: {
                    Label("Wyślij plik", systemImage: "paperplane")
                }
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                Task { await app.toggleFavorite(item) }
            } label: {
                Label("Usuń", systemImage: "heart.slash")
            }
        }
    }

    private func shareText(for item: FavoriteItem) -> String {
        if let detail = item.detail, !detail.isEmpty {
            return "\(item.title) — \(detail)"
        }
        return item.title
    }

    private func load(showSpinner: Bool) async {
        if app.isOfflinePlaybackActive {
            return
        }
        if showSpinner { isLoading = true }
        defer { isLoading = false }
        do {
            try await app.refreshFavorites()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func play(from index: Int) async {
        let source = filtered.isEmpty ? musicFavorites : filtered
        guard source.indices.contains(index) else { return }

        let libraryQueue = source.compactMap { fav -> MusicTrack? in
            app.musicTracks.first(where: { $0.url == fav.url })
                ?? app.downloadedLibraryTracks.first(where: { $0.url == fav.url })
        }
        if libraryQueue.count == source.count {
            await app.playTracks(libraryQueue, startIndex: index, folder: nil)
            return
        }

        let items = source.map { fav -> SearchResultItem in
            SearchResultItem(
                title: fav.title,
                url: fav.url,
                thumbnail: fav.thumbnail,
                detail: fav.detail,
                source: fav.source,
                uploader: fav.detail,
                album: nil,
                duration: fav.duration,
                artistId: nil,
                albumId: nil,
                trackNumber: nil,
                quality: nil,
                rating: nil,
                views: nil,
                isSerial: nil,
                premium: nil,
                previewUrl: nil
            )
        }
        await app.playCatalogItems(items, startIndex: index)
    }
}

private struct SharePayload: Identifiable {
    let id = UUID()
    let items: [Any]

    static func file(_ url: URL) -> SharePayload { SharePayload(items: [url]) }
    static func text(_ string: String) -> SharePayload { SharePayload(items: [string]) }
}

import SwiftUI

/// Per-account liked songs (server `/api/favorites`, keyed by Nostalgie login).
struct FavoritesView: View {
    @EnvironmentObject private var app: AppModel
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var query = ""
    @State private var sharePayload: SharePayload?

    private var musicFavorites: [FavoriteItem] {
        let base = app.favoriteItems.filter { $0.type == "music" }
        guard app.isOfflinePlaybackActive else { return base }
        return base.filter { app.isOfflineAvailable($0.url) }
    }

    private var filtered: [FavoriteItem] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 1 else { return musicFavorites }
        return musicFavorites.filter {
            $0.title.localizedCaseInsensitiveContains(q)
                || ($0.detail?.localizedCaseInsensitiveContains(q) == true)
        }
    }

    var body: some View {
        Group {
            if isLoading && musicFavorites.isEmpty {
                ProgressView("Wczytuję ulubione…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if musicFavorites.isEmpty {
                ContentUnavailableView {
                    Label("Ulubione", systemImage: "heart")
                } description: {
                    Text(emptyDescription)
                }
            } else if filtered.isEmpty {
                ContentUnavailableView.search(text: query)
            } else {
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
        }
        .background(Color(.systemBackground))
        .navigationTitle(app.isOfflinePlaybackActive ? "Ulubione · Offline" : "Ulubione")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Szukaj w ulubionych")
        .toolbar {
            if !musicFavorites.isEmpty {
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
        .task { await load(showSpinner: musicFavorites.isEmpty) }
        .refreshable { await load(showSpinner: false) }
        .sheet(item: $sharePayload) { payload in
            ActivityView(activityItems: payload.items)
        }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var emptyDescription: String {
        if app.isOfflinePlaybackActive {
            return "Żadne ulubione nie są pobrane na to urządzenie. Włącz Online, pobierz utwory, potem wróć do Offline."
        }
        if app.user == nil {
            return "Zaloguj się, aby zapisywać ulubione na swoim koncie."
        }
        let login = app.user?.login ?? ""
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
            // Keep last known favorites; filter is applied in musicFavorites.
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

        // Prefer library tracks (local files resolve correctly when offline).
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
                trackNumber: nil
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

import SwiftUI

struct TVAlbumsScreen: View {
    @EnvironmentObject private var library: TVLibrary

    private static func albumWord(_ count: Int) -> String {
        Plural.pick(count, L("\(count) album"), L("\(count) albumy"), L("\(count) albumów"))
    }

    private var kinds: [TVAlbum] {
        var list: [TVAlbum] = []
        if !library.favorites.isEmpty {
            list.append(TVAlbum(name: L("Ulubione"), photos: library.favorites, symbol: "heart.fill"))
        }
        return list + library.mediaTypes
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 52) {
                    TVScreenHeader(
                        title: L("Albumy"),
                        subtitle: Self.albumWord(library.albums.count),
                        showsLink: true
                    )
                    shelf(L("Moje albumy"), note: library.albums.count > 1 ? L("Ostatnio uzupełniane na początku") : "") {
                        if library.albums.isEmpty {
                            Text(L("Albumy z iPhone'a pojawią się tutaj po następnej synchronizacji."))
                                .font(.title3)
                                .foregroundStyle(.secondary)
                        } else {
                            LazyVGrid(columns: TVGridLayout.coverColumns, spacing: TVTheme.spacing) {
                                ForEach(library.albums) { album in
                                    NavigationLink(value: album) {
                                        TVCoverCard(
                                            hash: album.cover.cloudHash ?? "",
                                            title: album.name,
                                            subtitle: PhotoFormat.count(album.photos.count),
                                            detail: TVFormat.span(album.oldest, album.newest)
                                        )
                                    }
                                    .buttonStyle(.card)
                                }
                            }
                            .focusSection()
                        }
                    }
                    if !kinds.isEmpty {
                        shelf(L("Typy multimediów"), note: "") {
                            LazyVGrid(columns: TVGridLayout.kindColumns, spacing: TVTheme.spacing) {
                                ForEach(kinds) { kind in
                                    NavigationLink(value: kind) {
                                        TVKindCard(album: kind)
                                    }
                                    .buttonStyle(.card)
                                }
                            }
                            .focusSection()
                        }
                    }
                }
                .padding(.horizontal, TVTheme.margin)
                .padding(.top, 24)
                .padding(.bottom, 64)
            }
            .navigationDestination(for: TVAlbum.self) { album in
                TVAlbumGrid(album: album)
            }
        }
    }

    private func shelf<Content: View>(_ title: String, note: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                Text(title).font(.title2.weight(.bold))
                if !note.isEmpty {
                    Text(note).font(.headline).foregroundStyle(.secondary)
                }
            }
            content()
        }
    }
}

struct TVFavoritesScreen: View {
    @EnvironmentObject private var library: TVLibrary

    var body: some View {
        NavigationStack {
            if library.favorites.isEmpty {
                VStack(spacing: 24) {
                    Image(systemName: "heart")
                        .font(.system(size: 90))
                        .foregroundStyle(.pink)
                    Text(L("Brak ulubionych"))
                        .font(.title)
                    Text(L("Oznacz zdjęcia sercem w GalleryOS na iPhonie, a pojawią się tutaj."))
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                TVSectionsGrid(sections: [TVSection(id: "fav", title: "", subtitle: "", photos: library.favorites)]) {
                    TVScreenHeader(title: L("Ulubione"), subtitle: PhotoFormat.count(library.favorites.count))
                }
            }
        }
    }
}

struct TVSearchScreen: View {
    @EnvironmentObject private var library: TVLibrary
    @State private var query = ""
    @State private var results: [PhotoRef] = []
    @State private var searching = false

    var body: some View {
        NavigationStack {
            Group {
                if query.trimmingCharacters(in: .whitespaces).isEmpty {
                    suggestions
                } else if results.isEmpty && !searching {
                    VStack(spacing: 18) {
                        Image(systemName: "magnifyingglass").font(.system(size: 80)).foregroundStyle(.secondary)
                        Text(L("Nic nie znaleziono")).font(.title2)
                        Text(L("Spróbuj miesiąca, roku, albumu, miejsca albo słowa „wideo”."))
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    TVSectionsGrid(sections: [TVSection(id: "results", title: "", subtitle: "", photos: results)]) {
                        TVScreenHeader(title: L("Wyniki"), subtitle: PhotoFormat.count(results.count))
                    }
                }
            }
            .task(id: "\(query)#\(library.photoCount)") {
                let text = query
                guard !text.trimmingCharacters(in: .whitespaces).isEmpty else {
                    results = []
                    return
                }
                searching = true
                try? await Task.sleep(nanoseconds: 250_000_000)
                guard !Task.isCancelled else { return }
                results = library.search(text)
                searching = false
            }
        }
        .searchable(text: $query, prompt: L("Szukaj po dacie, albumie, miejscu…"))
    }

    private var suggestions: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 44) {
                TVScreenHeader(title: L("Szukaj"), subtitle: L("Wpisz albo podyktuj Siri"))
                chips(L("Rodzaj"), [L("Wideo"), L("Live"), L("Ulubione"), L("Zrzuty ekranu"), L("Panoramy"), L("Portrety")])
                chips(L("Rok"), years())
                if !library.albums.isEmpty {
                    chips(L("Albumy"), library.albums.prefix(8).map(\.name))
                }
            }
            .padding(.horizontal, TVTheme.margin)
            .padding(.top, 24)
            .padding(.bottom, 64)
        }
    }

    private func years() -> [String] {
        Array(library.model.years.reversed().prefix(8).map(\.title))
    }

    private func chips(_ title: String, _ values: [String]) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(title).font(.headline).foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 24) {
                    ForEach(values, id: \.self) { value in
                        Button(value) { query = value }
                    }
                }
                .padding(.vertical, 20)
                .padding(.horizontal, 4)
            }
        }
    }
}

struct TVSettingsScreen: View {
    @EnvironmentObject private var library: TVLibrary
    @EnvironmentObject private var session: TVSession
    @EnvironmentObject private var link: TVLinkState
    @State private var usage = 0
    @State private var confirmForget = false

    var body: some View {
        NavigationStack {
            HStack(alignment: .top, spacing: 70) {
                account
                    .frame(width: 600)
                    .padding(.top, 60)
                List {
                    Section(L("Połączenie")) {
                        row(L("Serwer"), session.server?.title ?? "-")
                        row(L("Rodzaj"), kindText)
                        row(L("Droga"), routeText)
                        if case .offline(let message) = link.kind {
                            Text(message)
                                .font(.callout)
                                .foregroundStyle(.orange)
                        }
                    }
                    Section(L("Biblioteka")) {
                        row(L("Zdjęcia i filmy"), PhotoFormat.grouped(library.photoCount))
                        row(L("Albumy"), PhotoFormat.grouped(library.albums.count))
                        row(L("Ostatnia aktualizacja"), TVFormat.updated(link.updatedAt))
                        Button {
                            library.refresh()
                        } label: {
                            Label(link.refreshing ? L("Aktualizuję…") : L("Odśwież teraz"), systemImage: "arrow.clockwise")
                        }
                        .disabled(link.refreshing)
                    }
                    Section(L("Pamięć podręczna")) {
                        row(L("Zajmuje"), usage > 0 ? ByteCountFormatter.string(fromByteCount: Int64(usage), countStyle: .file) : "0 MB")
                        Button {
                            library.clearCaches()
                            let pipeline = library.pipeline
                            Task { usage = await Task.detached { pipeline.diskUsage() }.value }
                        } label: {
                            Label(L("Wyczyść pamięć podręczną"), systemImage: "trash")
                        }
                    }
                    Section {
                        Button(role: .destructive) {
                            confirmForget = true
                        } label: {
                            Label(L("Sparuj od nowa"), systemImage: "link.badge.plus")
                        }
                    } footer: {
                        Text(L("GalleryOS™ na Apple TV tylko pokazuje bibliotekę z serwera. Kopiowanie zdjęć odbywa się na iPhonie."))
                    }
                }
            }
            .padding(.horizontal, TVTheme.margin)
            .task {
                // Walking thousands of cache files must not freeze the remote.
                let pipeline = library.pipeline
                usage = await Task.detached { pipeline.diskUsage() }.value
            }
            .confirmationDialog(L("Odłączyć ten serwer od Apple TV?"), isPresented: $confirmForget, titleVisibility: .visible) {
                Button(L("Odłącz i sparuj od nowa"), role: .destructive) { session.forget() }
                Button(L("Anuluj"), role: .cancel) {}
            }
        }
    }

    /// Left column, the way tvOS Settings shows the signed-in account.
    private var account: some View {
        VStack(spacing: 26) {
            TVAvatar(name: session.server?.username ?? "", size: 210)
                .shadow(color: TVTheme.accent.opacity(0.45), radius: 40, y: 12)
            VStack(spacing: 8) {
                Text(session.server?.username.isEmpty == false ? session.server!.username : L("Konto"))
                    .font(.system(size: 46, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(session.server?.title ?? "")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 12) {
                Circle().fill(tint).frame(width: 14, height: 14).shadow(color: tint, radius: 6)
                Text(stateText).font(.headline)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 12)
            .galleryGlass(in: Capsule())
            .animation(TVTheme.spring, value: link.kind)
            Label(L("Konfiguracja z GalleryOS na iPhonie"), systemImage: "iphone")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .multilineTextAlignment(.center)
    }

    private func row(_ title: String, _ value: String) -> some View {
        LabeledContent(title) { Text(value).foregroundStyle(.secondary).lineLimit(1) }
    }

    private var kindText: String {
        switch session.server?.kind {
        case DestinationKind.server: return L("Serwer GalleryOS")
        case DestinationKind.webdav: return L("QNAP (WebDAV)")
        default: return "-"
        }
    }

    private var tint: Color {
        switch link.kind {
        case .connecting: return .orange
        case .online(.home): return .green
        case .online(.remote): return TVTheme.accent
        case .offline: return .red
        }
    }

    private var stateText: String {
        switch link.kind {
        case .connecting: return L("Łączę…")
        case .online(.home): return L("Połączono w domu")
        case .online(.remote): return L("Połączono przez internet")
        case .offline: return L("Bez połączenia")
        }
    }

    private var routeText: String {
        switch link.kind {
        case .online(.home(let host)): return L("Sieć domowa · \(host)")
        case .online(.remote(let host)): return L("Internet · \(host)")
        case .connecting: return L("Szukam serwera…")
        case .offline: return L("Brak")
        }
    }
}

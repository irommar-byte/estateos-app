import SwiftUI

struct HomeTabView: View {
    @EnvironmentObject private var app: AppModel
    @State private var tab: Tab = .films
    @FocusState private var focusedTab: Tab?
    @FocusState private var nowPlayingFocused: Bool
    @Namespace private var primaryTabNamespace
    @State private var deepLinkSeries: VideoInfoResponse?
    @State private var deepLinkDetail: MediaSelection?
    @State private var filmsContentFocus = false
    @State private var searchContentFocus = false
    @State private var favoritesContentFocus = false
    @State private var musicContentFocus = false
    @State private var libraryContentFocus = false
    @State private var accountContentFocus = false

    enum Tab: String, CaseIterable {
        case films = "Filmy"
        case music = "Muzyka"
        case search = "Szukaj"
        case library = "Biblioteka"
        case favorites = "Ulubione"
        case account = "Konto"

        var icon: String {
            switch self {
            case .films: return "film.fill"
            case .music: return "opticaldisc.fill"
            case .search: return "magnifyingglass"
            case .library: return "square.stack.3d.up.fill"
            case .favorites: return "heart.fill"
            case .account: return "person.crop.circle"
            }
        }

        var accessibilityHint: String {
            switch self {
            case .films: return "Katalogi filmów i seriali według serwisu"
            case .music: return "Apple Music i playlisty MP3"
            case .search: return "Wyszukiwarka filmów i seriali"
            case .library: return "Pobrane filmy, seriale i muzyka offline"
            default: return rawValue
            }
        }

        /// Filmy, Muzyka i Szukaj — główne cele nawigacji.
        var isPrimaryDestination: Bool {
            self == .films || self == .music || self == .search
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.horizontal, NostalgieSpacing.screenH)
            if app.movieDownloadService.hasActiveBatch {
                MovieDownloadBatchBanner()
                    .environmentObject(app)
                    .padding(.horizontal, NostalgieSpacing.screenH)
                    .padding(.bottom, 8)
            }

            Group {
                switch tab {
                case .films:
                    FilmsHomeView(
                        navigationTab: .films,
                        focusedTab: $focusedTab,
                        requestContentFocus: $filmsContentFocus
                    )
                case .music:
                    MusicView(
                        navigationTab: .music,
                        focusedTab: $focusedTab,
                        requestContentFocus: $musicContentFocus
                    )
                    .onExitCommand { selectTab(.films) }
                case .search:
                    SearchView(
                        navigationTab: .search,
                        focusedTab: $focusedTab,
                        requestContentFocus: $searchContentFocus
                    )
                    .onExitCommand { selectTab(.films) }
                case .library:
                    LibraryView(
                        navigationTab: .library,
                        focusedTab: $focusedTab,
                        requestContentFocus: $libraryContentFocus
                    )
                    .onExitCommand { selectTab(.films) }
                case .favorites:
                    FavoritesView(
                        navigationTab: .favorites,
                        focusedTab: $focusedTab,
                        requestContentFocus: $favoritesContentFocus
                    )
                    .onExitCommand { selectTab(.films) }
                case .account:
                    AccountView(
                        navigationTab: .account,
                        focusedTab: $focusedTab,
                        requestContentFocus: $accountContentFocus
                    )
                    .onExitCommand { selectTab(.films) }
                }
            }
            .id(tab)
            .transition(.opacity)
            .animation(.easeOut(duration: 0.18), value: tab)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .padding(.top, NostalgieSpacing.screenTop)
        .onAppear {
            if focusedTab == nil {
                focusedTab = tab
            }
        }
        .onChange(of: focusedTab) { _, focused in
            // Jak na Apple TV: focus na zakładce = od razu przełączenie (bez klika).
            guard let focused, focused != tab else { return }
            selectTab(focused)
        }

        .onAppear { consumeDeepLinkIfNeeded() }
        .onChange(of: app.pendingMediaURL) { _, _ in consumeDeepLinkIfNeeded() }
        .fullScreenCover(item: $deepLinkSeries) { info in
            SeriesEpisodesView(info: info, backLabel: "Zamknij") {
                deepLinkSeries = nil
            }
            .environmentObject(app)
        }
        .fullScreenCover(item: $deepLinkDetail) { detail in
            MediaDetailView(selection: detail)
                .environmentObject(app)
        }
        .fullScreenCover(isPresented: musicPlayerPresented) {
            if let controller = app.musicPlayback.controller {
                MusicPlayerScreen(player: controller)
                    .environmentObject(app)
            }
        }
    }

    private var musicPlayerPresented: Binding<Bool> {
        Binding(
            get: { app.musicPlayback.isPlayerPresented },
            set: { app.musicPlayback.isPlayerPresented = $0 }
        )
    }

    private func consumeDeepLinkIfNeeded() {
        guard let url = app.consumePendingMediaURL() else { return }
        Task {
            if let info = try? await app.api.fetchInfo(url: url) {
                await MainActor.run {
                    if info.isPlaylist == true, !info.playableEpisodes.isEmpty {
                        deepLinkSeries = info
                    } else {
                        deepLinkDetail = MediaSelection(from: info)
                    }
                }
            }
        }
    }

    private var showsNowPlayingChip: Bool {
        app.musicPlayback.hasActiveSession
            && !app.musicPlayback.isPlayerPresented
            && app.musicPlayback.controller != nil
    }

    private var header: some View {
        ZStack(alignment: .center) {
            HStack(alignment: .center, spacing: 16) {
                headerLeading
                    .frame(minWidth: 280, maxWidth: 420, alignment: .leading)
                Spacer(minLength: 12)
                secondaryTabs
            }

            primaryTabs
        }
        .padding(.bottom, 22)
        .focusSection()
    }

    @ViewBuilder
    private var headerLeading: some View {
        if showsNowPlayingChip, let controller = app.musicPlayback.controller {
            MusicNowPlayingBar(controller: controller, isFocused: nowPlayingFocused) {
                app.musicPlayback.presentPlayerIfActive()
            }
            .focused($nowPlayingFocused)
            .onMoveCommand { direction in
                switch direction {
                case .right:
                    focusedTab = tab.isPrimaryDestination ? tab : .films
                case .down:
                    requestContentFocus(for: tab)
                default:
                    break
                }
            }
        } else {
            brandMark
        }
    }

    private var brandMark: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [NostalgieTheme.accent, NostalgieTheme.accentSecondary],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 34, height: 34)
                Image(systemName: "play.tv.fill")
                    .font(NostalgieFont.rounded(15, weight: .semibold))
                    .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(AppConfig.appName)
                    .font(NostalgieFont.brand)
                    .tracking(0.3)
                if let login = app.session?.user.login {
                    Text(login)
                        .font(NostalgieFont.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(minWidth: 220, alignment: .leading)
    }

    private var primaryTabs: some View {
        HStack(spacing: 18) {
            ForEach(Tab.allCases.filter(\.isPrimaryDestination), id: \.self) { item in
                primaryTabButton(item)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial.opacity(0.62), in: Capsule(style: .continuous))
        .overlay {
            Capsule(style: .continuous)
                .stroke(Color.white.opacity(0.16), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.35), radius: 18, y: 8)
        .focusSection()
        .onMoveCommand { direction in
            if direction == .down {
                requestContentFocus(for: tab)
            } else if direction == .left, showsNowPlayingChip {
                nowPlayingFocused = true
            }
        }
    }

    private var secondaryTabs: some View {
        HStack(spacing: 8) {
            ForEach(Tab.allCases.filter { !$0.isPrimaryDestination }, id: \.self) { item in
                secondaryTabButton(item)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.04), in: Capsule(style: .continuous))
        .frame(minWidth: 220, alignment: .trailing)
        .focusSection()
        .onMoveCommand { direction in
            if direction == .down {
                requestContentFocus(for: tab)
            }
        }
    }

    private func selectTab(_ item: Tab) {
        guard tab != item else { return }
        withAnimation(NostalgieTheme.tabSpring) {
            tab = item
        }
    }

    @ViewBuilder
    private func primaryTabButton(_ item: Tab) -> some View {
        let isSelected = tab == item
        Button {
            selectTab(item)
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(isSelected ? 0.28 : 0.12))
                        .frame(width: 42, height: 42)
                    Image(systemName: item.icon)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(isSelected ? .white : .white.opacity(0.85))
                }
                Text(item.rawValue)
            }
        }
        .buttonStyle(PrimaryTabButtonStyle(isSelected: isSelected, namespace: primaryTabNamespace))
        .focused($focusedTab, equals: item)
        .accessibilityHint(item.accessibilityHint)
        .onMoveCommand { direction in
            if direction == .left, item == .films, showsNowPlayingChip {
                nowPlayingFocused = true
            } else if direction == .down {
                requestContentFocus(for: tab)
            }
        }
    }

    @ViewBuilder
    private func secondaryTabButton(_ item: Tab) -> some View {
        let isSelected = tab == item
        Button {
            selectTab(item)
        } label: {
            Label(item.rawValue, systemImage: item.icon)
        }
        .buttonStyle(SecondaryTabButtonStyle(isSelected: isSelected))
        .focused($focusedTab, equals: item)
    }

    private func requestContentFocus(for tab: Tab) {
        switch tab {
        case .films:
            filmsContentFocus = true
        case .music:
            musicContentFocus = true
        case .search:
            searchContentFocus = true
        case .library:
            libraryContentFocus = true
        case .favorites:
            favoritesContentFocus = true
        case .account:
            accountContentFocus = true
        }
    }
}

private struct MusicNowPlayingBar: View {
    @ObservedObject var controller: MusicPlayerController
    var isFocused: Bool = false
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 12) {
                NowPlayingEqualizer(isPlaying: controller.isPlaying)
                    .frame(width: 28, height: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text(controller.currentTrack?.title ?? "Odtwarzanie")
                        .font(NostalgieFont.rounded(.caption, weight: .semibold))
                        .lineLimit(1)
                    if let artist = controller.currentTrack?.artist, !artist.isEmpty {
                        Text(artist)
                            .font(NostalgieFont.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: 220, alignment: .leading)

                Image(systemName: "chevron.up.circle.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                Capsule(style: .continuous)
                    .fill(Color.white.opacity(isFocused ? 0.18 : 0.10))
            )
            .overlay {
                Capsule(style: .continuous)
                    .stroke(Color.white.opacity(isFocused ? 0.45 : 0.16), lineWidth: isFocused ? 2 : 1)
            }
        }
        .buttonStyle(FocusCardButtonStyle())
        .accessibilityLabel("Otwórz player")
        .accessibilityHint(controller.currentTrack?.title ?? "Teraz odtwarzane")
    }
}

private struct NowPlayingEqualizer: View {
    var isPlaying: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 20.0, paused: !isPlaying)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            HStack(alignment: .bottom, spacing: 3) {
                ForEach(0..<4, id: \.self) { index in
                    Capsule(style: .continuous)
                        .fill(NostalgieTheme.accent)
                        .frame(width: 3.5, height: barHeight(index: index, time: t))
                }
            }
            .frame(width: 22, height: 22, alignment: .bottom)
            .padding(3)
            .background(Circle().fill(NostalgieTheme.accent.opacity(0.22)))
        }
    }

    private func barHeight(index: Int, time: Double) -> CGFloat {
        guard isPlaying else { return [6, 12, 8, 10][index] }
        let phase = time * (2.6 + Double(index) * 0.55) + Double(index) * 0.9
        let wave = (sin(phase) + 1) / 2
        return 5 + CGFloat(wave) * 14
    }
}

struct AccountView: View {
    @EnvironmentObject private var app: AppModel
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    @Binding var requestContentFocus: Bool

    @FocusState private var logoutFocused: Bool
    @State private var deleteError: String?
    @State private var deletingURL: String?

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 24) {
                ScreenTitle(title: "Konto", subtitle: "Profil EstateOS")

                profileCard
                sourceBadges
                downloadedMoviesSection

                if let deleteError {
                    Text(deleteError)
                        .font(NostalgieFont.metadata)
                        .foregroundStyle(.orange)
                }

                Button {
                    app.logout()
                } label: {
                    Label("Wyloguj", systemImage: "rectangle.portrait.and.arrow.right")
                }
                .buttonStyle(FocusCardButtonStyle())
                .frame(width: 320)
                .focused($logoutFocused)
                .onMoveCommand { direction in
                    if direction == .up {
                        focusedTab.wrappedValue = navigationTab
                    }
                }
            }
            .padding(.horizontal, NostalgieSpacing.screenH)
            .padding(.bottom, NostalgieSpacing.scrollBottom)
        }
        .task { await app.refreshMovieDownloads() }
        .onChange(of: requestContentFocus) { _, requested in
            guard requested else { return }
            logoutFocused = true
            requestContentFocus = false
        }
    }

    private var profileCard: some View {
        HStack(spacing: 22) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [NostalgieTheme.accentSecondary.opacity(0.5), NostalgieTheme.accent.opacity(0.35)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 80, height: 80)
                Text(initials)
                    .font(NostalgieFont.rounded(28, weight: .semibold))
                    .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(app.session?.user.login ?? "—")
                    .font(NostalgieFont.sectionTitle)
                Label("\(app.favoriteURLs.count) ulubionych", systemImage: "heart.fill")
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.secondary)
                Label("\(app.movieDownloads.count) pobranych filmów", systemImage: "internaldrive.fill")
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.secondary)
                Text("Ulubione i pobrania synchronizują się z panelem www.")
                    .font(NostalgieFont.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(24)
        .frame(maxWidth: 680, alignment: .leading)
        .glassPanel(.card)
    }

    private var sourceBadges: some View {
        HStack(spacing: 10) {
            SourceBadgeView(source: "tvp")
            SourceBadgeView(source: "cda-hd")
            SourceBadgeView(source: "cda")
            SourceBadgeView(source: "youtube")
            SourceBadgeView(source: "apple-music")
        }
    }

    @ViewBuilder
    private var downloadedMoviesSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            MusicSectionHeader(
                title: "Pobrane filmy",
                subtitle: "Folder MOVIES na serwerze · odtwarzaj offline"
            )

            if app.movieDownloads.isEmpty {
                EmptyStateView(
                    icon: "internaldrive",
                    title: "Brak pobranych filmów",
                    message: "Pobierz film lub odcinki serialu — pojawią się tutaj i w folderze MOVIES."
                )
            } else {
                LazyVStack(spacing: NostalgieSpacing.listRow) {
                    ForEach(app.movieDownloads) { item in
                        downloadedRow(item)
                    }
                }
            }
        }
    }

    private func downloadedRow(_ item: MovieDownload) -> some View {
        HStack(spacing: 14) {
            if let thumb = item.thumbnail.flatMap(URL.init(string:)) {
                PosterRemoteImage(url: thumb)
                    .scaledToFill()
                    .frame(width: 56, height: 84)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(NostalgieFont.listTitle)
                    .lineLimit(2)
                if let source = item.source, !source.isEmpty {
                    Text(MediaSourceMeta.normalize(source).label)
                        .font(NostalgieFont.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            if deletingURL == item.url {
                ProgressView()
            } else {
                Button {
                    Task { await deleteItem(item) }
                } label: {
                    Label("Usuń", systemImage: "trash")
                }
                .buttonStyle(ChipButtonStyle(isSelected: false))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .glassPanel(.panel)
    }

    private func deleteItem(_ item: MovieDownload) async {
        deleteError = nil
        deletingURL = item.url
        defer { deletingURL = nil }
        do {
            try await app.movieDownloadService.deleteDownload(url: item.url)
        } catch {
            deleteError = error.localizedDescription
        }
    }

    private var initials: String {
        let login = app.session?.user.login ?? "?"
        let parts = login.split(separator: " ").prefix(2)
        if parts.count >= 2 {
            return parts.map { String($0.prefix(1)).uppercased() }.joined()
        }
        return String(login.prefix(2)).uppercased()
    }
}

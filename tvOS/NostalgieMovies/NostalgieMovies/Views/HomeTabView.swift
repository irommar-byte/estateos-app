import SwiftUI

struct HomeTabView: View {
    @EnvironmentObject private var app: AppModel
    @State private var tab: Tab = .favorites
    @FocusState private var focusedTab: Tab?
    @Namespace private var primaryTabNamespace
    @State private var deepLinkSelection: MediaSelection?
    @State private var searchContentFocus = false
    @State private var favoritesContentFocus = false
    @State private var musicContentFocus = false
    @State private var accountContentFocus = false

    enum Tab: String, CaseIterable {
        case favorites = "Ulubione"
        case search = "Filmy"
        case music = "Muzyka"
        case account = "Konto"

        var icon: String {
            switch self {
            case .favorites: return "heart.fill"
            case .search: return "film.fill"
            case .music: return "opticaldisc.fill"
            case .account: return "person.crop.circle"
            }
        }

        var accessibilityHint: String {
            switch self {
            case .search: return "Wyszukiwarka filmów i seriali"
            case .music: return "Apple Music i playlisty MP3"
            default: return rawValue
            }
        }

        /// Filmy i Muzyka to główne cele nawigacji — reszta jest dodatkiem.
        var isPrimaryDestination: Bool {
            self == .search || self == .music
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.horizontal, NostalgieSpacing.screenH)
            if app.musicPlayback.hasActiveSession,
               !app.musicPlayback.isPlayerPresented,
               let controller = app.musicPlayback.controller {
                MusicNowPlayingBar(controller: controller) {
                    app.musicPlayback.presentPlayerIfActive()
                }
                .padding(.horizontal, NostalgieSpacing.screenH)
            }

            Group {
                switch tab {
                case .favorites:
                    FavoritesView(
                        navigationTab: .favorites,
                        focusedTab: $focusedTab,
                        requestContentFocus: $favoritesContentFocus
                    )
                    .onExitCommand { selectTab(.search) }
                case .search:
                    SearchView(
                        navigationTab: .search,
                        focusedTab: $focusedTab,
                        requestContentFocus: $searchContentFocus
                    )
                case .music:
                    MusicView(
                        navigationTab: .music,
                        focusedTab: $focusedTab,
                        requestContentFocus: $musicContentFocus
                    )
                    .onExitCommand { selectTab(.search) }
                case .account:
                    AccountView(
                        navigationTab: .account,
                        focusedTab: $focusedTab,
                        requestContentFocus: $accountContentFocus
                    )
                    .onExitCommand { selectTab(.search) }
                }
            }
            .id(tab)
            .transition(.opacity.combined(with: .move(edge: .trailing)).animation(NostalgieTheme.contentSpring))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .padding(.top, NostalgieSpacing.screenTop)
        .onAppear {
            if focusedTab == nil {
                focusedTab = tab
            }
            requestContentFocus(for: tab)
        }
        .onChange(of: tab) { _, newTab in
            requestContentFocus(for: newTab)
        }
        .onAppear { consumeDeepLinkIfNeeded() }
        .onChange(of: app.pendingMediaURL) { _, _ in consumeDeepLinkIfNeeded() }
        .fullScreenCover(item: $deepLinkSelection) { detail in
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
        deepLinkSelection = MediaSelection(
            from: SearchResultItem(
                title: "Otwieram…",
                url: url,
                thumbnail: nil,
                detail: "CDA-HD",
                source: "cda-hd",
                uploader: nil,
                album: nil,
                duration: nil,
                quality: nil,
                isSerial: url.localizedCaseInsensitiveContains("/tvshow"),
                premium: nil,
                previewUrl: nil,
                artistId: nil,
                albumId: nil,
                trackNumber: nil
            )
        )
        Task {
            if let info = try? await app.api.fetchInfo(url: url) {
                await MainActor.run {
                    deepLinkSelection = MediaSelection(from: info)
                }
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 32) {
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

            Spacer(minLength: 24)

            HStack(spacing: 20) {
                HStack(spacing: 10) {
                    ForEach(Tab.allCases.filter(\.isPrimaryDestination), id: \.self) { item in
                        primaryTabButton(item)
                    }
                }

                Rectangle()
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 1, height: 24)

                HStack(spacing: 8) {
                    ForEach(Tab.allCases.filter { !$0.isPrimaryDestination }, id: \.self) { item in
                        secondaryTabButton(item)
                    }
                }
            }
            .onMoveCommand { direction in
                if direction == .down {
                    requestContentFocus(for: tab)
                }
            }
        }
        .padding(.bottom, 18)
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
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(isSelected ? 0.22 : 0.1))
                        .frame(width: 30, height: 30)
                    Image(systemName: item.icon)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(isSelected ? .white : .white.opacity(0.82))
                }
                Text(item.rawValue)
            }
        }
        .buttonStyle(PrimaryTabButtonStyle(isSelected: isSelected, namespace: primaryTabNamespace))
        .focused($focusedTab, equals: item)
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
        case .favorites:
            favoritesContentFocus = true
        case .search:
            searchContentFocus = true
        case .music:
            musicContentFocus = true
        case .account:
            accountContentFocus = true
        }
    }
}

private struct MusicNowPlayingBar: View {
    @ObservedObject var controller: MusicPlayerController
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 14) {
                Image(systemName: controller.isPlaying ? "waveform.circle.fill" : "pause.circle.fill")
                    .font(.title2)
                    .foregroundStyle(NostalgieTheme.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text(controller.currentTrack?.title ?? "Odtwarzanie")
                        .font(NostalgieFont.rowTitle)
                        .lineLimit(1)
                    if let artist = controller.currentTrack?.artist, !artist.isEmpty {
                        Text(artist)
                            .font(NostalgieFont.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                Label("Player", systemImage: "chevron.up.circle.fill")
                    .font(NostalgieFont.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .glassPanel(.panel)
        }
        .buttonStyle(FocusCardButtonStyle())
        .padding(.bottom, 16)
    }
}

struct AccountView: View {
    @EnvironmentObject private var app: AppModel
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    @Binding var requestContentFocus: Bool

    @FocusState private var logoutFocused: Bool

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 24) {
                ScreenTitle(title: "Konto", subtitle: "Profil EstateOS")

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
                        Text("Ulubione synchronizują się z panelem www.")
                            .font(NostalgieFont.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(24)
                .frame(maxWidth: 680, alignment: .leading)
                .glassPanel(.card)

                HStack(spacing: 10) {
                    SourceBadgeView(source: "tvp")
                    SourceBadgeView(source: "cda-hd")
                    SourceBadgeView(source: "cda")
                    SourceBadgeView(source: "youtube")
                    SourceBadgeView(source: "apple-music")
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
        .onChange(of: requestContentFocus) { _, requested in
            guard requested else { return }
            logoutFocused = true
            requestContentFocus = false
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

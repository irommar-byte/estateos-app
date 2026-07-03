import SwiftUI

struct HomeTabView: View {
    @EnvironmentObject private var app: AppModel
    @State private var tab: Tab = .favorites
    @FocusState private var focusedTab: Tab?
    @State private var deepLinkSelection: MediaSelection?
    @State private var searchContentFocus = false
    @State private var favoritesContentFocus = false
    @State private var musicContentFocus = false
    @State private var accountContentFocus = false

    enum Tab: String, CaseIterable {
        case favorites = "Ulubione"
        case search = "Szukaj"
        case music = "Muzyka"
        case account = "Konto"

        var icon: String {
            switch self {
            case .favorites: return "heart.fill"
            case .search: return "magnifyingglass"
            case .music: return "music.note.list"
            case .account: return "person.crop.circle"
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            Group {
                switch tab {
                case .favorites:
                    FavoritesView(
                        navigationTab: .favorites,
                        focusedTab: $focusedTab,
                        requestContentFocus: $favoritesContentFocus
                    )
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
                case .account:
                    AccountView(
                        navigationTab: .account,
                        focusedTab: $focusedTab,
                        requestContentFocus: $accountContentFocus
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .padding(.horizontal, 72)
        .padding(.top, 48)
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
                premium: nil
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
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 6) {
                Text(AppConfig.appName)
                    .font(.title2.weight(.bold))
                    .tracking(0.4)
                if let login = app.session?.user.login {
                    Text(login)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            HStack(spacing: 12) {
                ForEach(Tab.allCases, id: \.self) { item in
                    Button {
                        tab = item
                    } label: {
                        Label(item.rawValue, systemImage: item.icon)
                    }
                    .buttonStyle(TabBarButtonStyle(isSelected: tab == item))
                    .focused($focusedTab, equals: item)
                }
            }
            .onMoveCommand { direction in
                if direction == .down {
                    requestContentFocus(for: tab)
                }
            }
        }
        .padding(.bottom, 24)
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

struct AccountView: View {
    @EnvironmentObject private var app: AppModel
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    @Binding var requestContentFocus: Bool

    @FocusState private var logoutFocused: Bool

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 32) {
                ScreenTitle(title: "Konto", subtitle: "Profil Nostalgie Legacy")

                HStack(spacing: 28) {
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [NostalgieTheme.accentSecondary.opacity(0.5), NostalgieTheme.accent.opacity(0.35)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 96, height: 96)
                        Text(initials)
                            .font(.system(size: 34, weight: .semibold))
                            .foregroundStyle(.white)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text(app.session?.user.login ?? "—")
                            .font(.title.weight(.semibold))
                        Label("\(app.favoriteURLs.count) ulubionych", systemImage: "heart.fill")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text("Ulubione synchronizują się z panelem www.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(32)
                .frame(maxWidth: 720, alignment: .leading)
                .glassPanel(cornerRadius: 22)

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
            .padding(.bottom, 80)
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

import SwiftUI

/// App shell (2026-10 redesign).
///
/// Top-left: the glass capsule "EstateOS | ⌂ Nieruchomości" — the brand plus the section you are
/// in. It is focusable: ▲ from the content reaches it, Select opens the glass menu.
/// The menu (Nieruchomości / Samochody / Szukaj / Ulubione / Filtry / Konto) slides in from the
/// left over a dimmed screen; MENU closes it. No system sidebar, so nothing expands by itself
/// and there are no hand-written focus jumps — the tvOS focus engine handles direction.
///
/// MENU on a content screen: first returns to the capsule (top of the screen), then — when the
/// capsule already has focus — leaves the app, as the tvOS guidelines expect.
struct HomeView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.eosLaunchRevealed) private var launchRevealed

    @State private var tab: HomeTab = .showroom
    @State private var menuOpen = false
    @State private var showFilterSheet = false
    @FocusState private var chromeFocus: HomeChromeFocus?
    @FocusState private var accountFocusedItem: HomeAccountFocus?
    @FocusState private var auxFocus: HomeAuxFocus?
    @State private var accountContentFocus = false
    @FocusState private var headerFocused: Bool
    @FocusState private var menuFocus: HomeMenuItem?

    var body: some View {
        ZStack(alignment: .topLeading) {
            content
                .id(tab)
                .transition(.opacity)
                .disabled(menuOpen)

            if !menuOpen {
                header
                    .opacity(launchRevealed ? 1 : 0)
                    .offset(y: launchRevealed ? 0 : -16)
                    .animation(EOSMotion.launchReveal.delay(0.45), value: launchRevealed)
                    .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .topLeading)))
            }

            if menuOpen {
                Color.black.opacity(0.45)
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .allowsHitTesting(false)
                menu
                    .transition(.move(edge: .leading).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.9), value: menuOpen)
        .animation(.easeInOut(duration: 0.35), value: tab)
        .onExitCommand(perform: exitHandler)
        .fullScreenCover(isPresented: $showFilterSheet) {
            FilterSheetView(tab: $tab, onDismissFocus: { showFilterSheet = false })
                .environmentObject(app)
        }
        .onAppear { syncBrand(with: tab) }
        .onChange(of: tab) { _, newTab in
            syncBrand(with: newTab)
            switch newTab {
            case .account: accountContentFocus = true
            case .search: auxFocus = .searchQuery
            default: break
            }
        }
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        switch tab {
        case .showroom:
            HomeShowroomView(brand: .home, onOpenFilters: openFilters)
        case .cars:
            HomeShowroomView(brand: .car, onOpenFilters: openFilters)
        case .search:
            SearchView(chromeFocus: $chromeFocus, auxFocus: $auxFocus)
                .environmentObject(app)
                .padding(.top, EOSShellMetrics.contentTopInset)
                .background { secondaryBackdrop }
        case .favorites:
            HomeFavoritesView(tab: $tab, chromeFocus: $chromeFocus)
                .padding(.top, EOSShellMetrics.contentTopInset)
                .background { secondaryBackdrop }
        case .account:
            HomeAccountView(
                chromeFocus: $chromeFocus,
                accountFocusedItem: $accountFocusedItem,
                accountContentFocus: $accountContentFocus
            )
            .padding(.top, EOSShellMetrics.contentTopInset)
            .background { secondaryBackdrop }
        }
    }

    /// Search / Ulubione / Konto sit on a deeply blurred photo, so glass panels have depth.
    private var secondaryBackdrop: some View {
        let url = app.offers.first.flatMap { EOSOfferMedia.primaryImageURL(for: $0) }
        return ZStack {
            Color.black
            EOSFullBleedOfferImage(url: url, quietPlaceholder: true)
                .blur(radius: 70)
                .opacity(0.55)
            Color.black.opacity(0.35)
        }
        .ignoresSafeArea()
    }

    // MARK: Header capsule

    private var header: some View {
        Button(action: openMenu) {
            HStack(spacing: 22) {
                EOSWordmark(size: 30)
                Rectangle()
                    .fill(Color.white.opacity(0.28))
                    .frame(width: 1.5, height: 32)
                HStack(spacing: 14) {
                    Image(systemName: tab.outlineIconName)
                        .font(.system(size: 26, weight: .medium))
                    Text(tab.rawValue)
                        .font(.system(size: 28, weight: .semibold))
                }
            }
            .padding(.leading, 34)
            .padding(.trailing, 38)
            .padding(.vertical, 18)
        }
        .buttonStyle(EOSHeaderCapsuleStyle())
        .focused($headerFocused)
        .focusSection()
        .accessibilityLabel("EstateOS, \(tab.rawValue). Otwórz menu")
    }

    // MARK: Menu

    private var menu: some View {
        VStack(alignment: .leading, spacing: 8) {
            EOSWordmark(size: 36)
                .padding(.horizontal, 26)
                .padding(.bottom, 26)

            ForEach(HomeMenuItem.sections) { item in
                menuRow(item)
            }

            Rectangle()
                .fill(Color.white.opacity(0.14))
                .frame(height: 1)
                .padding(.horizontal, 22)
                .padding(.vertical, 16)

            if tab.brand != nil {
                menuRow(.filters)
            }

            Spacer(minLength: 0)
            menuRow(.account)
        }
        .padding(.vertical, 40)
        .padding(.horizontal, 22)
        .frame(width: 540)
        .frame(maxHeight: .infinity)
        .eosGlassPanel(cornerRadius: 48)
        .focusSection()
        .defaultFocus($menuFocus, HomeMenuItem(tab: tab))
    }

    private func menuRow(_ item: HomeMenuItem) -> some View {
        Button { choose(item) } label: {
            HStack(spacing: 22) {
                Image(systemName: item.iconName)
                    .font(.system(size: 28, weight: .medium))
                    .frame(width: 36)
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.system(size: 28, weight: item.isCurrent(tab) ? .semibold : .medium))
                    if let detail = detail(for: item) {
                        Text(detail)
                            .font(.system(size: 20))
                            .opacity(0.65)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                if let badge = badge(for: item) {
                    Text(badge)
                        .font(.system(size: 21, weight: .semibold).monospacedDigit())
                        .opacity(0.65)
                }
            }
            .padding(.horizontal, 26)
            .padding(.vertical, 20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(EOSMenuRowStyle(isCurrent: item.isCurrent(tab)))
        .focused($menuFocus, equals: item)
    }

    private func detail(for item: HomeMenuItem) -> String? {
        switch item {
        case .filters:
            let summary = tab == .cars ? app.carFilterSummary : app.homeFilterSummary
            let active = tab == .cars ? app.isCarFilteringActive : app.isHomeFilteringActive
            return active ? summary : "Wszystkie oferty"
        case .account:
            return app.session?.user.login ?? "Zaloguj się przez iPhone’a"
        default:
            return nil
        }
    }

    private func badge(for item: HomeMenuItem) -> String? {
        guard item == .tab(.favorites) else { return nil }
        let count = app.favoriteOfferIds.count + app.favoriteCarIds.count
        return count > 0 ? "\(count)" : nil
    }

    // MARK: Actions

    private func openMenu() {
        menuOpen = true
        menuFocus = HomeMenuItem(tab: tab)
    }

    private func closeMenu() {
        menuOpen = false
        headerFocused = true
    }

    private func choose(_ item: HomeMenuItem) {
        switch item {
        case .tab(let newTab):
            tab = newTab
            menuOpen = false
        case .filters:
            menuOpen = false
            openFilters()
        }
    }

    /// nil = let the system handle MENU (leave the app). Only from the capsule on the main screen.
    private var exitHandler: (() -> Void)? {
        if menuOpen { return { closeMenu() } }
        if headerFocused {
            if tab == .showroom { return nil }
            return { tab = .showroom }
        }
        return { headerFocused = true }
    }

    private func syncBrand(with tab: HomeTab) {
        if let brand = tab.brand, brand != app.catalogBrand {
            app.setCatalogBrand(brand)
        }
    }

    private func openFilters() {
        syncBrand(with: tab)
        showFilterSheet = true
    }
}

// MARK: - Shell pieces

enum EOSShellMetrics {
    /// Space reserved under the header capsule on list screens (Szukaj / Ulubione / Konto).
    static let contentTopInset: CGFloat = 116
}

enum HomeMenuItem: Hashable, Identifiable {
    case tab(HomeTab)
    case filters

    static let sections: [HomeMenuItem] = [.tab(.showroom), .tab(.cars), .tab(.search), .tab(.favorites)]
    static let account: HomeMenuItem = .tab(.account)

    init(tab: HomeTab) { self = .tab(tab) }

    var id: String {
        switch self {
        case .tab(let t): return t.rawValue
        case .filters: return "filters"
        }
    }

    var title: String {
        switch self {
        case .tab(let t): return t.rawValue
        case .filters: return "Filtry"
        }
    }

    var iconName: String {
        switch self {
        case .tab(let t): return t.outlineIconName
        case .filters: return "line.3.horizontal.decrease"
        }
    }

    func isCurrent(_ tab: HomeTab) -> Bool { self == .tab(tab) }
}

extension HomeTab {
    /// Outline glyphs read better at TV distance inside the glass capsule.
    var outlineIconName: String {
        switch self {
        case .showroom: return "house"
        case .cars: return "car"
        case .search: return "magnifyingglass"
        case .favorites: return "heart"
        case .account: return "person.crop.circle"
        }
    }
}

/// "EstateOS" wordmark in the brand colours — green E and OS, white "state".
struct EOSWordmark: View {
    var size: CGFloat = 30

    static let green = Color(red: 0.25, green: 0.78, blue: 0.52)

    var body: some View {
        (Text("E").foregroundStyle(Self.green)
         + Text("state")
         + Text("OS").foregroundStyle(Self.green))
            .font(.system(size: size, weight: .bold))
            .tracking(-0.3)
            .fixedSize()
            .accessibilityLabel("EstateOS")
    }
}

/// Glass capsule at rest; bright white with dark text and a lift when focused.
struct EOSHeaderCapsuleStyle: ButtonStyle {
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(isFocused ? Color.black : Color.white)
            .background {
                if isFocused {
                    Capsule().fill(Color.white)
                } else {
                    Capsule()
                        .fill(.ultraThinMaterial)
                        .overlay(Capsule().fill(Color.white.opacity(0.06)))
                        .overlay(
                            Capsule().strokeBorder(
                                LinearGradient(
                                    colors: [.white.opacity(0.42), .white.opacity(0.12), .white.opacity(0.24)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1.5
                            )
                        )
                }
            }
            .scaleEffect(configuration.isPressed ? 0.97 : (isFocused ? 1.06 : 1), anchor: .leading)
            .shadow(color: .black.opacity(isFocused ? 0.45 : 0.25), radius: isFocused ? 28 : 18, y: isFocused ? 16 : 8)
            .animation(EOSMotion.focus, value: isFocused)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Menu row: quiet at rest, current section softly filled, focused row bright white.
struct EOSMenuRowStyle: ButtonStyle {
    var isCurrent: Bool
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(isFocused ? Color.black : Color.white.opacity(isCurrent ? 1 : 0.86))
            .background(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(isFocused ? Color.white : Color.white.opacity(isCurrent ? 0.14 : 0))
            )
            .scaleEffect(configuration.isPressed ? 0.98 : (isFocused ? 1.04 : 1))
            .shadow(color: .black.opacity(isFocused ? 0.4 : 0), radius: 22, y: 12)
            .animation(EOSMotion.focus, value: isFocused)
    }
}

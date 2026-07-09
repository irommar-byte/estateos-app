import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var app: AppModel
    @State private var tab: Tab = .latest
    @FocusState private var focusedTab: Tab?
    @FocusState private var accountFocusedItem: AccountFocus?
    @State private var accountContentFocus = false

    enum Tab: String, CaseIterable {
        case latest = "Polecane"
        case search = "Szukaj"
        case account = "Konto"
    }

    private enum AccountFocus: Hashable {
        case refresh
        case login
        case topShelf(TopShelfPresentationStyle)
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.04, green: 0.06, blue: 0.1),
                    Color.black,
                    Color(red: 0.02, green: 0.05, blue: 0.08),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 26) {
                header

                if app.isLoadingOffers {
                    ProgressView("Ładowanie ofert...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    Group {
                        switch tab {
                        case .latest:
                            showroomView
                        case .search:
                            SearchView()
                                .environmentObject(app)
                        case .account:
                            accountView
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
            .padding(.horizontal, 56)
            .padding(.vertical, 42)
        }
        .fullScreenCover(item: $app.selectedOffer) { offer in
            OfferDetailView(offer: offer)
                .environmentObject(app)
        }
        .onAppear {
            if focusedTab == nil {
                focusedTab = tab
            }
            if tab == .account {
                accountContentFocus = true
            }
        }
        .onChange(of: tab) { _, newTab in
            if newTab == .account {
                accountContentFocus = true
            }
        }
        .task {
            if app.offers.isEmpty {
                try? await app.refreshOffers()
            }
            if app.session != nil {
                await app.refreshFavorites()
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text("EstateOS")
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                if let login = app.session?.user.login {
                    Text("Witaj, \(login)")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            HStack(spacing: 14) {
                ForEach(Tab.allCases, id: \.self) { item in
                    Button(item.rawValue) { tab = item }
                        .buttonStyle(.borderedProminent)
                        .tint(tab == item ? .white : .white.opacity(0.14))
                        .foregroundStyle(tab == item ? .black : .white)
                        .focused($focusedTab, equals: item)
                }
            }
            .padding(8)
            .eosGlass(cornerRadius: 20, opacity: 0.28)
            .onMoveCommand { direction in
                if direction == .down, tab == .account {
                    accountContentFocus = true
                }
            }
        }
    }

    private var accountView: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    accountSection
                    topShelfSettingsSection
                }
                .padding(.bottom, 80)
            }
            .frame(maxHeight: .infinity)
            .onChange(of: accountFocusedItem) { _, item in
                guard let item else { return }
                withAnimation(.easeOut(duration: 0.25)) {
                    proxy.scrollTo(item, anchor: .center)
                }
            }
        }
        .onChange(of: accountContentFocus) { _, requested in
            guard requested else { return }
            accountFocusedItem = .refresh
            accountContentFocus = false
        }
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Konto")
                .font(.system(size: 44, weight: .bold, design: .rounded))

            Text(app.session?.user.login ?? "Tryb showroom bez logowania")
                .foregroundStyle(.secondary)
                .font(.title3)

            if app.session != nil {
                Label("\(app.favoriteOfferIds.count) ulubionych ofert", systemImage: "heart.fill")
                    .font(.callout)
                    .foregroundStyle(.pink.opacity(0.9))
            }

            HStack(spacing: 14) {
                Button("Odśwież oferty") {
                    Task { try? await app.refreshOffers() }
                }
                .buttonStyle(.bordered)
                .focused($accountFocusedItem, equals: .refresh)
                .id(AccountFocus.refresh)
                .onMoveCommand { direction in
                    if direction == .up {
                        focusedTab = .account
                    }
                }

                if app.session == nil {
                    Button("Zaloguj się") {
                        app.openLoginSheet()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .focused($accountFocusedItem, equals: .login)
                    .id(AccountFocus.login)
                } else {
                    Button("Wyloguj") {
                        app.logout()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                    .focused($accountFocusedItem, equals: .login)
                    .id(AccountFocus.login)
                }
            }
        }
        .padding(28)
        .eosGlass(cornerRadius: 28, opacity: 0.38)
        .frame(maxWidth: 980, alignment: .leading)
    }

    private var topShelfSettingsSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Górny pasek Apple TV")
                .font(.system(size: 36, weight: .bold, design: .rounded))

            Text("Wybierz sposób prezentacji ofert z ostatnich 24 godzin na ekranie głównym Apple TV.")
                .font(.body)
                .foregroundStyle(.secondary)

            ForEach(TopShelfPresentationStyle.allCases) { style in
                let focusID = AccountFocus.topShelf(style)
                Button {
                    app.setTopShelfStyle(style)
                } label: {
                    HStack(alignment: .top, spacing: 16) {
                        Image(systemName: app.topShelfStyle == style ? "largecircle.fill.circle" : "circle")
                            .font(.title2)
                            .foregroundStyle(app.topShelfStyle == style ? .green : .secondary)

                        VStack(alignment: .leading, spacing: 6) {
                            Text(style.title)
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(.white)
                            Text(style.subtitle)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer()
                    }
                    .padding(18)
                    .eosGlass(cornerRadius: 20, opacity: app.topShelfStyle == style ? 0.48 : 0.3)
                }
                .buttonStyle(.plain)
                .focused($accountFocusedItem, equals: focusID)
                .id(focusID)
            }

            Text("Po zmianie wróć na ekran główny Apple TV i ponownie ustaw fokus na ikonie EstateOS.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(28)
        .eosGlass(cornerRadius: 28, opacity: 0.38)
        .frame(maxWidth: 980, alignment: .leading)
    }

    private var showroomView: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 32) {
                if app.session != nil {
                    let favorites = app.favoriteOffers.isEmpty
                        ? app.offers.filter { app.isFavorite($0.id) }
                        : app.favoriteOffers
                    if !favorites.isEmpty {
                        section("Twoje ulubione", offers: favorites.prefix(28), showsHeart: true)
                    } else if !app.isLoadingFavorites {
                        favoritesEmptyHint
                    }
                }
                section("Polecane nieruchomości", offers: app.offers.prefix(28))
                section("Nowości w Warszawie", offers: app.offers.filter { ($0.city ?? "").localizedCaseInsensitiveContains("warsz") }.prefix(28))
                section("Luksusowe apartamenty", offers: app.offers.filter { ($0.price ?? 0) >= 2_000_000 }.prefix(28))
            }
            .padding(.bottom, 40)
        }
    }

    private var favoritesEmptyHint: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Twoje ulubione")
                .font(.system(size: 32, weight: .bold, design: .rounded))
            Text("Otwórz ofertę i wybierz „Dodaj do ulubionych”, aby zbudować własną listę na ekranie głównym.")
                .font(.body)
                .foregroundStyle(.secondary)
        }
        .padding(22)
        .eosGlass(cornerRadius: 22, opacity: 0.3)
    }

    private func section(_ title: String, offers: some Sequence<EstateOffer>, showsHeart: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                if showsHeart {
                    Image(systemName: "heart.fill")
                        .foregroundStyle(.pink)
                }
                Text(title)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
            }
            OffersRailView(offers: Array(offers), onSelect: app.openDetail)
        }
        .focusSection()
    }
}

struct OffersRailView: View {
    let offers: [EstateOffer]
    let onSelect: (EstateOffer) -> Void
    @EnvironmentObject private var app: AppModel

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 28) {
                ForEach(offers.prefix(80)) { offer in
                    Button {
                        onSelect(offer)
                    } label: {
                        OfferCardView(
                            offer: offer,
                            isFavorite: app.isFavorite(offer.id)
                        )
                        .frame(width: 480)
                    }
                    .buttonStyle(.plain)
                    .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .hoverEffect(.highlight)
                    .eosFocusParallax(lift: 16, scale: 1.07)
                }
            }
            .padding(.vertical, 8)
        }
    }
}

struct OfferCardView: View {
    let offer: EstateOffer
    var isFavorite: Bool = false
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            EOSOfferThumbnail(url: EOSOfferMedia.primaryImageURL(for: offer), height: 240)
                .overlay(alignment: .topTrailing) {
                    if isFavorite {
                        Image(systemName: "heart.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.pink)
                            .padding(10)
                            .background(Circle().fill(.black.opacity(0.45)))
                            .padding(10)
                    }
                }
                .overlay(alignment: .bottomLeading) {
                    if let city = offer.city {
                        Text(city)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(.ultraThinMaterial.opacity(0.55))
                            .clipShape(Capsule())
                            .padding(10)
                    }
                }

            EOSAdaptiveTitle(text: offer.title, maxLines: 2, maxSize: 22, minSize: 15)
                .foregroundStyle(.white)

            Text(EOSFormat.pricePLN(offer.price))
                .font(.title3.bold())
                .foregroundStyle(.green)

            Text(offer.displayLocation)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .eosGlass(
            cornerRadius: 22,
            opacity: isFocused ? 0.52 : 0.34
        )
        .animation(.easeOut(duration: 0.28).delay(isFocused ? 0.04 : 0), value: isFocused)
    }
}

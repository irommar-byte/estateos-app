import SwiftUI

struct HomeAccountView: View {
    @EnvironmentObject private var app: AppModel
    var chromeFocus: FocusState<HomeChromeFocus?>.Binding
    var accountFocusedItem: FocusState<HomeAccountFocus?>.Binding
    @Binding var accountContentFocus: Bool
    @State private var advancedExpanded = TvPreferences.accountAdvancedExpanded

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    accountSection
                    advancedSection
                }
                .padding(.bottom, 80)
            }
            .frame(maxHeight: .infinity)
            .onChange(of: accountFocusedItem.wrappedValue) { _, item in
                guard let item else { return }
                withAnimation(.easeOut(duration: 0.25)) {
                    proxy.scrollTo(item, anchor: .center)
                }
            }
        }
        .onChange(of: accountContentFocus) { _, requested in
            guard requested else { return }
            accountFocusedItem.wrappedValue = .refresh
            accountContentFocus = false
        }
        .onChange(of: advancedExpanded) { _, expanded in
            TvPreferences.accountAdvancedExpanded = expanded
        }
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Konto")
                .font(.system(size: 32, weight: .semibold))
            Text(app.session?.user.login ?? "Tryb showroom bez logowania")
                .foregroundStyle(.secondary)
                .font(.title3)
            if app.session != nil {
                Label("\(app.favoriteOfferIds.count) Home · \(app.favoriteCarIds.count) Car w ulubionych", systemImage: "heart.fill")
                    .font(.callout)
                    .foregroundStyle(.pink.opacity(0.9))
            }

            HStack(spacing: 14) {
                Button("Odśwież katalogi") {
                    Task {
                        try? await app.refreshOffers()
                        try? await app.refreshCars()
                        await app.refreshFavorites()
                    }
                }
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
                .focused(accountFocusedItem, equals: .refresh)
                .id(HomeAccountFocus.refresh)
                .onMoveCommand { direction in
                    if direction == .up { chromeFocus.wrappedValue = .tab(.account) }
                }

                if app.session == nil {
                    Button("Zaloguj się") { app.openLoginSheet() }
                        .buttonStyle(EOSDetailActionButtonStyle(accent: EOSPalette.home))
                        .focusEffectDisabled()
                        .focused(accountFocusedItem, equals: .login)
                        .id(HomeAccountFocus.login)
                } else {
                    Button("Wyloguj") { app.logout() }
                        .buttonStyle(EOSDetailActionButtonStyle(accent: .pink))
                        .focusEffectDisabled()
                        .focused(accountFocusedItem, equals: .login)
                        .id(HomeAccountFocus.login)
                }
            }
        }
        .padding(28)
        .eosGlass(cornerRadius: 28, opacity: 0.38)
        .frame(maxWidth: 980, alignment: .leading)
    }

    private var advancedSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            Button {
                advancedExpanded.toggle()
            } label: {
                HStack {
                    Text("Zaawansowane")
                        .font(.system(size: 28, weight: .semibold))
                    Spacer()
                    Image(systemName: advancedExpanded ? "chevron.up" : "chevron.down")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .focusEffectDisabled()
            .eosFocusRing(cornerRadius: 16, accent: EOSPalette.car)
            .focused(accountFocusedItem, equals: .advanced)
            .id(HomeAccountFocus.advanced)

            if advancedExpanded {
                topShelfSettingsSection
            }
        }
        .padding(28)
        .eosGlass(cornerRadius: 28, opacity: 0.38)
        .frame(maxWidth: 980, alignment: .leading)
    }

    private var topShelfSettingsSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Górny pasek Apple TV")
                .font(.system(size: 24, weight: .semibold))
            Text("Górny pasek: nieruchomości z 24h oraz wyróżnione samochody EstateOS™ Car.")
                .font(.body)
                .foregroundStyle(.secondary)

            ForEach(TopShelfPresentationStyle.allCases) { style in
                let focusID = HomeAccountFocus.topShelf(style)
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
                .focusEffectDisabled()
                .eosFocusRing(cornerRadius: 20, accent: EOSPalette.car)
                .focused(accountFocusedItem, equals: focusID)
                .id(focusID)
            }

            Text("Po zmianie wyjdź na ekran główny Apple TV (Menu) i ustaw fokus na ikonie EstateOS — dopiero wtedy Górny pasek przełącza się na kafelki.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }
}

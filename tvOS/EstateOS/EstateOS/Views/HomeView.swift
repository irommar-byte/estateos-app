import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var heroTransition: HeroTransitionCoordinator
    @Namespace private var heroNamespace

    @State private var tab: HomeTab = .showroom
    @FocusState private var chromeFocus: HomeChromeFocus?
    @FocusState private var showroomFocus: HomeShowroomFocus?
    @FocusState private var accountFocusedItem: HomeAccountFocus?
    @FocusState private var auxFocus: HomeAuxFocus?
    @State private var accountContentFocus = false
    @State private var showFilterSheet = false

    var body: some View {
        TabView(selection: $tab) {
            Tab("Showroom", systemImage: "play.rectangle.fill", value: HomeTab.showroom) {
                showroomPage
            }

            Tab(value: HomeTab.search, role: .search) {
                SearchView(chromeFocus: $chromeFocus, auxFocus: $auxFocus)
                    .environmentObject(app)
                    .padding(.horizontal, EOSTvSpacing.screenHorizontal)
                    .padding(.vertical, EOSTvSpacing.screenVertical)
            }

            Tab("Ulubione", systemImage: "heart.fill", value: HomeTab.favorites) {
                HomeFavoritesView(tab: $tab, chromeFocus: $chromeFocus)
                    .padding(.horizontal, EOSTvSpacing.screenHorizontal)
                    .padding(.vertical, EOSTvSpacing.screenVertical)
            }

            Tab("Konto", systemImage: "gearshape", value: HomeTab.account) {
                HomeAccountView(
                    chromeFocus: $chromeFocus,
                    accountFocusedItem: $accountFocusedItem,
                    accountContentFocus: $accountContentFocus
                )
                .padding(.horizontal, EOSTvSpacing.screenHorizontal)
                .padding(.vertical, EOSTvSpacing.screenVertical)
            }
        }
        .tabViewStyle(.sidebarAdaptable)
        .background { HomeChromeBackground() }
        .fullScreenCover(isPresented: $showFilterSheet, onDismiss: {
            chromeFocus = .moreFilters
        }) {
            FilterSheetView(tab: $tab, onDismissFocus: {
                showFilterSheet = false
                chromeFocus = .moreFilters
            })
            .environmentObject(app)
        }
        .onAppear {
            if tab == .showroom {
                showroomFocus = .hero
            }
            if tab == .account { accountContentFocus = true }
            Task { await app.fulfillPendingDeepLink() }
        }
        .onChange(of: tab) { _, newTab in
            switch newTab {
            case .showroom:
                showroomFocus = .hero
                auxFocus = nil
            case .account:
                accountContentFocus = true
                auxFocus = nil
            case .search:
                chromeFocus = nil
                auxFocus = .searchQuery
            case .favorites:
                chromeFocus = nil
                auxFocus = nil
            }
        }
    }

    private var showroomPage: some View {
        VStack(spacing: 18) {
            HomeChromeView(
                tab: $tab,
                chromeFocus: $chromeFocus,
                accountFocusedItem: $accountFocusedItem,
                accountContentFocus: $accountContentFocus,
                showFilterSheet: $showFilterSheet,
                showroomFocus: $showroomFocus,
                auxFocus: $auxFocus,
                onBrandChange: { _ in
                    tab = .showroom
                    showroomFocus = .hero
                }
            )

            catalogLoadingGate {
                HomeShowroomView(
                    showroomFocus: $showroomFocus,
                    chromeFocus: $chromeFocus,
                    heroNamespace: heroNamespace
                )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .padding(.horizontal, EOSTvSpacing.screenHorizontal)
        .padding(.vertical, EOSTvSpacing.screenVertical)
    }

    @ViewBuilder
    private func catalogLoadingGate<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        let loading = app.catalogBrand == .home ? app.isLoadingOffers : app.isLoadingCars
        let empty = app.catalogBrand == .home ? app.offers.isEmpty : app.cars.isEmpty
        if loading && empty {
            ProgressView(app.catalogBrand == .home ? "Ładowanie nieruchomości…" : "Ładowanie samochodów…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            content()
        }
    }
}

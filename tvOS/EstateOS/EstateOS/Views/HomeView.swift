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
        ZStack {
            HomeChromeBackground()
            VStack(spacing: 0) {
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
                .padding(.bottom, 18)
                .zIndex(2)

                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .zIndex(1)
            }
            .padding(.horizontal, EOSTvSpacing.screenHorizontal)
            .padding(.vertical, EOSTvSpacing.screenVertical)
        }
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
            } else if chromeFocus == nil {
                chromeFocus = .tab(tab)
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

    @ViewBuilder
    private var content: some View {
        Group {
            switch tab {
            case .showroom:
                catalogLoadingGate {
                    HomeShowroomView(
                        showroomFocus: $showroomFocus,
                        chromeFocus: $chromeFocus,
                        heroNamespace: heroNamespace
                    )
                }
                .transition(.eosModeTransition)
            case .search:
                catalogLoadingGate {
                    SearchView(chromeFocus: $chromeFocus, auxFocus: $auxFocus)
                        .environmentObject(app)
                }
                .transition(.eosModeTransition)
            case .favorites:
                HomeFavoritesView(tab: $tab, chromeFocus: $chromeFocus)
                    .transition(.eosModeTransition)
            case .account:
                HomeAccountView(
                    chromeFocus: $chromeFocus,
                    accountFocusedItem: $accountFocusedItem,
                    accountContentFocus: $accountContentFocus
                )
                .transition(.eosModeTransition)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .animation(.spring(response: 0.5, dampingFraction: 0.88, blendDuration: 0.25), value: tab)
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

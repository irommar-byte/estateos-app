import SwiftUI

/// App shell: the glass tvOS sidebar (collapsed by default, ◀ or MENU opens it).
/// Nieruchomości and Samochody are two first-class sections — no separate brand switcher,
/// no filter strip and no hand-written focus jumps: the tvOS focus engine handles direction.
struct HomeView: View {
    @EnvironmentObject private var app: AppModel

    @State private var tab: HomeTab = .showroom
    @FocusState private var chromeFocus: HomeChromeFocus?
    @FocusState private var accountFocusedItem: HomeAccountFocus?
    @FocusState private var auxFocus: HomeAuxFocus?
    @State private var accountContentFocus = false
    @State private var showFilterSheet = false

    var body: some View {
        TabView(selection: $tab) {
            Tab(HomeTab.showroom.rawValue, systemImage: HomeTab.showroom.iconName, value: HomeTab.showroom) {
                HomeShowroomView(brand: .home, onOpenFilters: openFilters)
            }

            Tab(HomeTab.cars.rawValue, systemImage: HomeTab.cars.iconName, value: HomeTab.cars) {
                HomeShowroomView(brand: .car, onOpenFilters: openFilters)
            }

            Tab(value: HomeTab.search, role: .search) {
                SearchView(chromeFocus: $chromeFocus, auxFocus: $auxFocus)
                    .environmentObject(app)
                    .padding(.horizontal, EOSTvSpacing.screenHorizontal)
                    .padding(.vertical, EOSTvSpacing.screenVertical)
                    .background { secondaryBackdrop }
            }

            Tab(HomeTab.favorites.rawValue, systemImage: HomeTab.favorites.iconName, value: HomeTab.favorites) {
                HomeFavoritesView(tab: $tab, chromeFocus: $chromeFocus)
                    .padding(.horizontal, EOSTvSpacing.screenHorizontal)
                    .padding(.vertical, EOSTvSpacing.screenVertical)
                    .background { secondaryBackdrop }
            }

            Tab(HomeTab.account.rawValue, systemImage: HomeTab.account.iconName, value: HomeTab.account) {
                HomeAccountView(
                    chromeFocus: $chromeFocus,
                    accountFocusedItem: $accountFocusedItem,
                    accountContentFocus: $accountContentFocus
                )
                .padding(.horizontal, EOSTvSpacing.screenHorizontal)
                .padding(.vertical, EOSTvSpacing.screenVertical)
                .background { secondaryBackdrop }
            }
        }
        .tabViewStyle(.sidebarAdaptable)
        .fullScreenCover(isPresented: $showFilterSheet) {
            FilterSheetView(tab: $tab, onDismissFocus: { showFilterSheet = false })
                .environmentObject(app)
        }
        .onAppear {
            syncBrand(with: tab)
            if tab == .account { accountContentFocus = true }
        }
        .onChange(of: tab) { _, newTab in
            syncBrand(with: newTab)
            switch newTab {
            case .account: accountContentFocus = true
            case .search: auxFocus = .searchQuery
            default: break
            }
        }
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

    /// Search / Ulubione / Konto sit on a deeply blurred photo, so glass panels have depth.
    private var secondaryBackdrop: some View {
        let url = app.offers.first.flatMap { EOSOfferMedia.primaryImageURL(for: $0) }
        return ZStack {
            Color.black
            EOSFullBleedOfferImage(url: url)
                .blur(radius: 70)
                .opacity(0.55)
            Color.black.opacity(0.35)
        }
        .ignoresSafeArea()
    }
}

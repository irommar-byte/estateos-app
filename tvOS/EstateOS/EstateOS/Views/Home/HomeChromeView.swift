import SwiftUI

struct HomeChromeBackground: View {
    var body: some View {
        ZStack {
            EOSPalette.canvas.ignoresSafeArea()
            LinearGradient(
                colors: [
                    EOSPalette.canvasTop.opacity(0.95),
                    EOSPalette.canvas,
                    EOSPalette.canvas,
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            RadialGradient(
                colors: [Color.white.opacity(0.04), .clear],
                center: .top,
                startRadius: 40,
                endRadius: 900
            )
            .ignoresSafeArea()
        }
    }
}

struct HomeChromeView: View {
    @EnvironmentObject private var app: AppModel
    @Binding var tab: HomeTab
    var chromeFocus: FocusState<HomeChromeFocus?>.Binding
    var accountFocusedItem: FocusState<HomeAccountFocus?>.Binding
    @Binding var accountContentFocus: Bool
    @Binding var showFilterSheet: Bool
    var showroomFocus: FocusState<HomeShowroomFocus?>.Binding
    var auxFocus: FocusState<HomeAuxFocus?>.Binding
    var onBrandChange: (CatalogBrand) -> Void

    private var brandAccent: Color { EOSPalette.accent(for: app.catalogBrand) }

    var body: some View {
        VStack(spacing: 16) {
            header

            if tab == .showroom {
                BrandSwitcher(
                    brand: Binding(
                        get: { app.catalogBrand },
                        set: { app.setCatalogBrand($0) }
                    ),
                    onChange: onBrandChange
                )
                .focused(chromeFocus, equals: .brandSwitcher)
                .onMoveCommand { direction in
                    if direction == .down {
                        chromeFocus.wrappedValue = .moreFilters
                    }
                }

                HomeFilterStrip(
                    tab: $tab,
                    showFilterSheet: $showFilterSheet,
                    moreFiltersFocus: chromeFocus,
                    showroomFocus: showroomFocus
                )
            }
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity, alignment: .center)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(.ultraThinMaterial.opacity(0.22))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(EOSPalette.hairlineSoft, lineWidth: 1)
        )
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 24) {
            HStack(spacing: 14) {
                Image("EstateOSLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 36)
                    .opacity(0.95)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(app.catalogBrand == .home ? "EstateOS™ Home" : "EstateOS™ Car")
                        .font(.system(size: 28, weight: .semibold, design: .default))
                        .foregroundStyle(EOSPalette.textPrimary)
                    Text(subtitle)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(EOSPalette.textTertiary)
                        .lineLimit(1)
                        .contentTransition(.opacity)
                        .id(subtitle)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                        .animation(.easeOut(duration: 0.22), value: subtitle)
                }
            }
            Spacer(minLength: 16)
            Button {
                tab = .search
                auxFocus.wrappedValue = .searchQuery
            } label: {
                EOSSpotlightLens(active: tab == .search, size: 40)
                    .padding(6)
            }
            .buttonStyle(.plain)
            .focusEffectDisabled()
            .accessibilityLabel("Spotlight — szukaj ofert, agentów i biur")
            .padding(.trailing, 4)

            HStack(spacing: 8) {
                ForEach(HomeTab.allCases, id: \.self) { item in
                    Button {
                        tab = item
                    } label: {
                        Text(item.rawValue)
                    }
                    .buttonStyle(EOSChipButtonStyle(selected: tab == item, accent: brandAccent, icon: item.iconName))
                    .focusEffectDisabled()
                    .focused(chromeFocus, equals: .tab(item))
                    .accessibilityLabel(item.accessibilityLabel)
                }
            }
            .focusSection()
            .onMoveCommand { direction in
                if direction == .down {
                    switch tab {
                    case .showroom:
                        chromeFocus.wrappedValue = .brandSwitcher
                    case .search:
                        auxFocus.wrappedValue = .searchQuery
                    case .favorites, .account:
                        chromeFocus.wrappedValue = nil
                        if tab == .account { accountContentFocus = true }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .focusSection()
    }

    private var subtitle: String {
        if TvCatalogCache.isUsingCachedCatalog {
            return "Tryb offline · ostatni zapisany katalog"
        }
        switch tab {
        case .showroom:
            if !app.activeShowroomSection.isEmpty { return app.activeShowroomSection }
        case .search:
            return "Spotlight · oferty, agenci, biura"
        case .favorites:
            return "Twoje zapisane oferty Home i Car"
        case .account:
            return "Top Shelf, logowanie i ustawienia"
        }
        if let login = app.session?.user.login {
            return "Witaj, \(login)"
        }
        return "Przeglądaj z kanapy"
    }
}

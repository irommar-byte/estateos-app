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

/// Pasek Showroom: Home/Car + filtry. Nawigacja główna jest w szklanym sidebarze.
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

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                Image("EstateOSLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 32)
                    .opacity(0.95)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(app.catalogBrand == .home ? "EstateOS™ Home" : "EstateOS™ Car")
                        .font(.system(size: 26, weight: .semibold, design: .default))
                        .foregroundStyle(EOSPalette.textPrimary)
                    Text(subtitle)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(EOSPalette.textTertiary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }

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
        .padding(.horizontal, 22)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(.ultraThinMaterial.opacity(0.28))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(EOSPalette.hairlineSoft, lineWidth: 1)
        )
    }

    private var subtitle: String {
        if TvCatalogCache.isUsingCachedCatalog {
            return "Tryb offline · ostatni zapisany katalog"
        }
        if !app.activeShowroomSection.isEmpty { return app.activeShowroomSection }
        if let login = app.session?.user.login {
            return "Witaj, \(login)"
        }
        return "Przeglądaj z kanapy"
    }
}

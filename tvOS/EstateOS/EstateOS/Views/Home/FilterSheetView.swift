import SwiftUI

struct FilterSheetView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss
    @Binding var tab: HomeTab
    var onDismissFocus: () -> Void

    private var activeCount: Int {
        app.catalogBrand == .home ? app.homeSecondaryFilterCount : app.carSecondaryFilterCount
    }

    private var headerTitle: String {
        app.catalogBrand == .home ? "Filtry Home" : "Filtry Car"
    }

    var body: some View {
        ZStack {
            EOSPalette.canvas.ignoresSafeArea()
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    if app.catalogBrand == .home { homeFilters } else { carFilters }
                    applyButton
                }
                .padding(48)
                .padding(.bottom, 80)
            }
        }
        .focusSection()
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 16) {
            Text(headerTitle)
                .font(.system(size: 36, weight: .semibold))
            if activeCount > 0 {
                Text("\(activeCount)")
                    .font(.title3.weight(.bold).monospacedDigit())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(EOSPalette.accent(for: app.catalogBrand).opacity(0.45)))
                    .accessibilityLabel("\(activeCount) aktywnych filtrów")
            }
            Spacer()
            Button("Anuluj") { closeSheet() }
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
        }
    }

    private var applyButton: some View {
        Button("Zastosuj i zamknij") { closeSheet() }
            .buttonStyle(EOSDetailActionButtonStyle(accent: EOSPalette.accent(for: app.catalogBrand)))
            .focusEffectDisabled()
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func closeSheet() {
        dismiss()
        onDismissFocus()
    }

    private var homeFilters: some View {
        VStack(alignment: .leading, spacing: 24) {
            filterGroup(title: "Transakcja") {
                ForEach(HomeTransactionFilter.allCases) { kind in
                    filterChip(kind.title, selected: app.selectedHomeTransactions.contains(kind), accent: EOSPalette.home) {
                        app.toggleHomeTransaction(kind)
                    }
                    .accessibilityLabel("Filtr transakcji: \(kind.title)")
                }
            }

            filterGroup(title: "Opcje") {
                filterChip("Premium", selected: app.homePremium, accent: EOSPalette.home) {
                    app.toggleHomePremium()
                }
                .accessibilityLabel("Tylko oferty premium")

                Button { app.toggleHomeDiscounted() } label: {
                    Label("Przecenione (\(app.homeDiscountedCount))", systemImage: "percent")
                }
                .buttonStyle(EOSMicroChipButtonStyle(selected: app.homeDiscounted, accent: Color(red: 0.92, green: 0.32, blue: 0.28)))
                .focusEffectDisabled()
                .accessibilityLabel("Tylko przecenione oferty")

                if app.isHomeFilteringActive {
                    Button("Wyczyść filtry") { app.clearHomeFilters() }
                        .buttonStyle(EOSMicroChipButtonStyle(selected: false, accent: EOSPalette.home))
                        .focusEffectDisabled()
                }
            }

            if !app.homePropertyTypeCounts.isEmpty {
                filterGroup(title: "Typ nieruchomości") {
                    filterChip("Wszystkie typy", selected: app.selectedHomePropertyTypes.isEmpty, accent: EOSPalette.home) {
                        app.clearHomePropertyTypes()
                    }
                    ForEach(app.homePropertyTypeCounts, id: \.kind) { item in
                        filterChip("\(item.kind.title) (\(item.count))", selected: app.selectedHomePropertyTypes.contains(item.kind), accent: EOSPalette.home) {
                            app.toggleHomePropertyType(item.kind)
                            tab = .showroom
                        }
                        .accessibilityLabel("Typ \(item.kind.title)")
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var carFilters: some View {
        VStack(alignment: .leading, spacing: 24) {
            filterGroup(title: "Atrybuty") {
                ForEach(CarAttributeFilter.allCases) { attr in
                    filterChip(attr.title, selected: app.selectedCarAttributes.contains(attr), accent: EOSPalette.car) {
                        app.toggleCarAttribute(attr)
                    }
                    .accessibilityLabel("Filtr: \(attr.title)")
                }
            }

            if !app.popularCarMakes.isEmpty {
                filterGroup(title: "Marki") {
                    filterChip("Wszystkie marki", selected: app.selectedCarMakes.isEmpty, accent: EOSPalette.car) {
                        app.clearCarMakes()
                    }
                    ForEach(Array(app.popularCarMakes.prefix(24)), id: \.name) { item in
                        filterChip("\(item.name) (\(item.count))", selected: app.selectedCarMakes.contains(where: { $0.caseInsensitiveCompare(item.name) == .orderedSame }), accent: EOSPalette.car) {
                            app.toggleCarMake(item.name)
                            tab = .showroom
                        }
                        .accessibilityLabel("Marka \(item.name)")
                    }
                }
            }

            if app.isCarFilteringActive {
                filterGroup(title: "Szybkie akcje") {
                    filterChip("Wyczyść filtry", selected: false, accent: EOSPalette.car) {
                        app.clearCarFilters()
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func filterGroup<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(EOSPalette.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) { content() }
                    .padding(.vertical, 2)
            }
            .focusSection()
        }
    }

    private func filterChip(_ title: String, selected: Bool, accent: Color, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .buttonStyle(EOSMicroChipButtonStyle(selected: selected, accent: accent))
            .focusEffectDisabled()
    }
}

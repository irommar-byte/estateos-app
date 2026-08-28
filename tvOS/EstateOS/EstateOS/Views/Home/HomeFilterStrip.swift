import SwiftUI

struct HomeFilterStrip: View {
    @EnvironmentObject private var app: AppModel
    @Binding var tab: HomeTab
    @Binding var showFilterSheet: Bool
    var moreFiltersFocus: FocusState<HomeChromeFocus?>.Binding

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if app.catalogBrand == .home {
                filterRowHome
            } else {
                filterRowCar
            }

            if let msg = app.location.statusMessage, (app.carNearest || app.homeNearest) {
                Text(msg)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(EOSPalette.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
        .onMoveCommand { direction in
            if direction == .up {
                moreFiltersFocus.wrappedValue = .tab(.showroom)
            }
        }
    }

    private var secondaryCount: Int {
        app.catalogBrand == .home ? app.homeSecondaryFilterCount : app.carSecondaryFilterCount
    }

    private var filterRowHome: some View {
        VStack(alignment: .leading, spacing: 6) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    filterChip("Wszystkie", selected: !app.isHomeFilteringActive && !app.homeCitiesPickerExpanded, accent: EOSPalette.home) {
                        app.clearHomeFilters()
                    }
                    .accessibilityLabel("Wszystkie oferty, bez filtrów")

                    filterChipLabel("Najbliżej", systemImage: "location.fill", selected: app.homeNearest, accent: EOSPalette.home) {
                        app.toggleHomeNearest()
                    }
                    .accessibilityLabel(app.homeNearest ? "Filtr najbliżej włączony" : "Sortuj według odległości")

                    filterChipLabel(
                        app.selectedHomeCities.isEmpty ? "Miejscowości" : "Miejscowości (\(app.selectedHomeCities.count))",
                        systemImage: "building.2",
                        selected: app.homeCitiesPickerExpanded || !app.selectedHomeCities.isEmpty,
                        accent: EOSPalette.home
                    ) {
                        app.toggleHomeCitiesPicker()
                    }
                    .accessibilityLabel("Filtr miejscowości")

                    moreFiltersButton(accent: EOSPalette.home, selected: app.isHomeFilteringActive)
                }
                .padding(.vertical, 2)
            }
            .focusSection()

            if app.homeCitiesPickerExpanded { homeCitiesRow }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var filterRowCar: some View {
        VStack(alignment: .leading, spacing: 6) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    filterChip("Wszystkie", selected: !app.isCarFilteringActive && !app.carCitiesPickerExpanded, accent: EOSPalette.car) {
                        app.clearCarFilters()
                    }
                    .accessibilityLabel("Wszystkie auta, bez filtrów")

                    filterChipLabel("Najbliżej", systemImage: "location.fill", selected: app.carNearest, accent: EOSPalette.car) {
                        app.toggleCarNearest()
                    }
                    .accessibilityLabel(app.carNearest ? "Filtr najbliżej włączony" : "Sortuj według odległości")

                    filterChipLabel(
                        app.selectedCarCities.isEmpty ? "Miejscowości" : "Miejscowości (\(app.selectedCarCities.count))",
                        systemImage: "building.2",
                        selected: app.carCitiesPickerExpanded || !app.selectedCarCities.isEmpty,
                        accent: EOSPalette.car
                    ) {
                        app.toggleCarCitiesPicker()
                    }
                    .accessibilityLabel("Filtr miejscowości")

                    moreFiltersButton(accent: EOSPalette.car, selected: app.isCarFilteringActive)
                }
                .padding(.vertical, 2)
            }
            .focusSection()

            if app.carCitiesPickerExpanded { carCitiesRow }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func moreFiltersButton(accent: Color, selected: Bool) -> some View {
        Button { showFilterSheet = true } label: {
            HStack(spacing: 6) {
                Label("Więcej filtrów", systemImage: "line.3.horizontal.decrease.circle")
                if secondaryCount > 0 {
                    Text("\(secondaryCount)")
                        .font(.caption2.weight(.bold).monospacedDigit())
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(accent.opacity(0.35)))
                }
            }
        }
        .buttonStyle(EOSMicroChipButtonStyle(selected: selected || secondaryCount > 0, accent: accent))
        .focusEffectDisabled()
        .focused(moreFiltersFocus, equals: .moreFilters)
        .accessibilityLabel("Więcej filtrów\(secondaryCount > 0 ? ", aktywnych: \(secondaryCount)" : "")")
    }

    private func filterChip(_ title: String, selected: Bool, accent: Color, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .buttonStyle(EOSMicroChipButtonStyle(selected: selected, accent: accent))
            .focusEffectDisabled()
    }

    private func filterChipLabel(_ title: String, systemImage: String, selected: Bool, accent: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
        }
        .buttonStyle(EOSMicroChipButtonStyle(selected: selected, accent: accent))
        .focusEffectDisabled()
    }

    private var homeCitiesRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                filterChip("Wszystkie miejscowości", selected: app.selectedHomeCities.isEmpty, accent: EOSPalette.home) {
                    app.clearHomeCities()
                }
                ForEach(app.homeCityCounts, id: \.name) { item in
                    filterChip("\(item.name) (\(item.count))", selected: app.selectedHomeCities.contains(where: { $0.caseInsensitiveCompare(item.name) == .orderedSame }), accent: EOSPalette.home) {
                        app.toggleHomeCity(item.name)
                        tab = .showroom
                    }
                    .accessibilityLabel("Miasto \(item.name), \(item.count) ofert")
                }
            }
            .padding(.vertical, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    private var carCitiesRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                filterChip("Wszystkie miejscowości", selected: app.selectedCarCities.isEmpty, accent: EOSPalette.car) {
                    app.clearCarCities()
                }
                ForEach(app.carCityCounts, id: \.name) { item in
                    filterChip("\(item.name) (\(item.count))", selected: app.selectedCarCities.contains(where: { $0.caseInsensitiveCompare(item.name) == .orderedSame }), accent: EOSPalette.car) {
                        app.toggleCarCity(item.name)
                        tab = .showroom
                    }
                    .accessibilityLabel("Miasto \(item.name), \(item.count) aut")
                }
            }
            .padding(.vertical, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }
}

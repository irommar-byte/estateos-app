import SwiftUI

/// Filters — Apple TV Settings layout (2026-10 redesign).
///
/// Left: a glass list of criteria in the order a buyer thinks (what → where → how much → how big
/// → building → extras → order). Each row shows its current value. Moving focus over a row opens
/// its options on the right, no click needed; ▶ steps into the options.
/// Right: option tiles with live counts. Top: the live result count — "Pokaż 128 ofert" closes,
/// "Wyczyść" resets, "Anuluj" restores what was set before opening. MENU keeps the changes.
///
/// All filtering runs on the catalog the app already has (`/api/mobile/v1/offers` sends every
/// Prisma `Offer` field), so no backend change is needed.
struct FilterSheetView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss
    @Binding var tab: HomeTab
    var onDismissFocus: () -> Void

    @State private var category: FilterCategory = .transaction
    @State private var snapshot: FilterSnapshot?
    @FocusState private var rowFocus: FilterCategory?

    private var isCar: Bool { app.catalogBrand == .car }
    private var categories: [FilterCategory] { isCar ? FilterCategory.car : FilterCategory.home }
    private var resultCount: Int { isCar ? app.filteredCars.count : app.filteredOffersForBrowse.count }

    var body: some View {
        ZStack {
            EOSBackdrop(
                url: isCar
                    ? app.cars.first.flatMap { EOSOfferMedia.imageURL(from: $0.imageUrl) }
                    : app.offers.first.flatMap { EOSOfferMedia.primaryImageURL(for: $0) },
                soft: true
            )
            Color.black.opacity(0.55).ignoresSafeArea()

            VStack(alignment: .leading, spacing: 36) {
                header
                HStack(alignment: .top, spacing: 40) {
                    categoryList
                    optionsPanel
                }
            }
        }
        .onAppear {
            snapshot = FilterSnapshot(app: app)
            category = categories.first ?? .transaction
            rowFocus = category
        }
        .onExitCommand { close() }
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .center, spacing: 24) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Filtry")
                    .font(.system(size: 52, weight: .bold))
                    .tracking(-0.6)
                Text(isCar ? "Samochody" : "Nieruchomości")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
            }
            Spacer(minLength: 0)

            Button { cancel() } label: { Text("Anuluj") }
                .eosButton()
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    isCar ? app.clearCarFilters() : app.clearHomeFilters()
                }
            } label: {
                Label("Wyczyść", systemImage: "arrow.counterclockwise")
            }
            .eosButton()
            .disabled(!(isCar ? app.isCarFilteringActive : app.isHomeFilteringActive))

            Button { close() } label: {
                HStack(spacing: 12) {
                    Text("Pokaż")
                    Text("\(resultCount)")
                        .monospacedDigit()
                        .contentTransition(.numericText(value: Double(resultCount)))
                    Text(resultWord(resultCount))
                }
                .font(.system(size: 26, weight: .semibold))
            }
            .buttonStyle(FilterPrimaryButtonStyle())
            .animation(.snappy, value: resultCount)
        }
    }

    private func resultWord(_ n: Int) -> String {
        if isCar {
            if n == 1 { return "auto" }
            let mod10 = n % 10, mod100 = n % 100
            return (2...4).contains(mod10) && !(12...14).contains(mod100) ? "auta" : "aut"
        }
        if n == 1 { return "ofertę" }
        let mod10 = n % 10, mod100 = n % 100
        return (2...4).contains(mod10) && !(12...14).contains(mod100) ? "oferty" : "ofert"
    }

    // MARK: Left · criteria

    private var categoryList: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(categories) { item in
                    Button { rowFocus = item } label: {
                        HStack(spacing: 20) {
                            Image(systemName: item.icon)
                                .font(.system(size: 26, weight: .medium))
                                .frame(width: 34)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.title)
                                    .font(.system(size: 26, weight: .semibold))
                                Text(valueSummary(for: item))
                                    .font(.system(size: 19, weight: .medium))
                                    .opacity(0.62)
                                    .lineLimit(1)
                            }
                            Spacer(minLength: 0)
                            if isSet(item) {
                                Circle()
                                    .fill(Color(red: 0.36, green: 0.84, blue: 0.62))
                                    .frame(width: 10, height: 10)
                            }
                            Image(systemName: "chevron.right")
                                .font(.system(size: 18, weight: .semibold))
                                .opacity(0.4)
                        }
                        .padding(.horizontal, 24)
                        .padding(.vertical, 16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(EOSMenuRowStyle(isCurrent: category == item))
                    .focused($rowFocus, equals: item)
                }
            }
            .padding(18)
        }
        .scrollClipDisabled()
        .frame(width: 620)
        .eosGlassPanel(cornerRadius: 40)
        .focusSection()
        .onChange(of: rowFocus) { _, focused in
            if let focused, focused != category {
                withAnimation(.easeInOut(duration: 0.22)) { category = focused }
            }
        }
    }

    // MARK: Right · options

    private var optionsPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(category.title)
                .font(.system(size: 38, weight: .bold))
                .tracking(-0.4)
            Text(category.hint(isCar: isCar))
                .font(.system(size: 21, weight: .medium))
                .foregroundStyle(.white.opacity(0.6))
                .padding(.bottom, 18)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 34) {
                    options(for: category)
                }
                .padding(.vertical, 18)
                .padding(.horizontal, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollClipDisabled()
            .id(category)
            .transition(.opacity)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .eosGlassPanel(cornerRadius: 40)
        .focusSection()
    }

    @ViewBuilder
    private func options(for category: FilterCategory) -> some View {
        switch category {
        // ── Nieruchomości ──────────────────────────────────────────────
        case .transaction:
            FilterGroup(nil) {
                ForEach(HomeTransactionFilter.allCases) { kind in
                    FilterTile(
                        kind.title,
                        icon: kind == .sale ? "key.horizontal" : "calendar.badge.clock",
                        count: transactionCount(kind),
                        selected: app.selectedHomeTransactions.contains(kind)
                    ) { app.toggleHomeTransaction(kind); clampPriceForTransaction() }
                }
            }
        case .propertyType:
            FilterGroup(nil) {
                ForEach(app.homePropertyTypeCounts, id: \.kind) { item in
                    FilterTile(
                        item.kind.title,
                        icon: item.kind.icon,
                        count: item.count,
                        selected: app.selectedHomePropertyTypes.contains(item.kind)
                    ) { app.toggleHomePropertyType(item.kind) }
                }
            }
        case .location:
            homeLocation
        case .price:
            rangeEditor(
                presets: homePricePresets,
                range: Binding(get: { app.homeCriteria.price }, set: { app.homeCriteria.price = $0 }),
                format: { FilterFormat.money($0) + " zł" }
            )
        case .area:
            rangeEditor(
                presets: [25, 35, 45, 60, 80, 100, 150, 200, 300],
                range: Binding(get: { app.homeCriteria.area }, set: { app.homeCriteria.area = $0 }),
                format: { "\(Int($0)) m²" }
            )
        case .rooms:
            FilterGroup(nil) {
                FilterTile("Dowolnie", selected: app.homeCriteria.minRooms == nil) { app.homeCriteria.minRooms = nil }
                ForEach(1...5, id: \.self) { n in
                    FilterTile(
                        n == 1 ? "1 pokój i więcej" : "\(n)+ pokoje",
                        count: app.offers.filter { Int($0.rooms ?? 0) >= n }.count,
                        selected: app.homeCriteria.minRooms == n
                    ) { app.homeCriteria.minRooms = n }
                }
            }
        case .building:
            FilterGroup("Rok budowy") {
                FilterTile("Dowolny", selected: app.homeCriteria.minYearBuilt == nil) { app.homeCriteria.minYearBuilt = nil }
                ForEach([2020, 2010, 2000, 1990], id: \.self) { year in
                    FilterTile(
                        year == 2020 ? "Nowe · od 2020" : "Od \(year)",
                        count: app.offers.filter { ($0.extras.yearBuilt ?? 0) >= year }.count,
                        selected: app.homeCriteria.minYearBuilt == year
                    ) { app.homeCriteria.minYearBuilt = year }
                }
            }
            FilterGroup("Piętro") {
                ForEach(HomeFloorFilter.allCases) { f in
                    FilterTile(
                        f.title,
                        count: app.offers.filter { f.matches($0.extras) }.count,
                        selected: app.homeCriteria.floors.contains(f)
                    ) { app.homeCriteria.floors.formSymmetricDifference([f]) }
                }
            }
        case .amenities:
            FilterGroup(nil) {
                ForEach(HomeAmenity.allCases) { a in
                    FilterTile(
                        a.title,
                        icon: a.icon,
                        count: app.offers.filter { a.matches($0.extras) }.count,
                        selected: app.homeCriteria.amenities.contains(a)
                    ) { app.homeCriteria.amenities.formSymmetricDifference([a]) }
                }
            }
        case .deals:
            FilterGroup(nil) {
                FilterTile("Przecenione", icon: "tag", count: app.homeDiscountedCount, selected: app.homeDiscounted) {
                    app.toggleHomeDiscounted()
                }
                FilterTile("Premium · od 1,5 mln", icon: "crown", count: app.offers.filter { ($0.price ?? 0) >= 1_500_000 }.count, selected: app.homePremium) {
                    app.toggleHomePremium()
                }
            }
        case .sort:
            FilterGroup(nil) {
                ForEach(HomeSort.allCases) { sort in
                    FilterTile(sort.title, icon: sort.icon, selected: app.homeCriteria.sort == sort, radio: true) {
                        app.homeCriteria.sort = sort
                        if sort == .nearest { app.location.requestIfNeeded() }
                    }
                }
            }

        // ── Samochody ──────────────────────────────────────────────────
        case .make:
            FilterGroup(nil) {
                ForEach(app.popularCarMakes, id: \.name) { make in
                    FilterTile(make.name, count: make.count, selected: app.selectedCarMakes.contains(make.name)) {
                        app.toggleCarMake(make.name)
                        pruneModels()
                    }
                }
            }
        case .model:
            carModels
        case .carLocation:
            carLocation
        case .carPrice:
            rangeEditor(
                presets: [10_000, 20_000, 40_000, 60_000, 80_000, 100_000, 150_000, 200_000, 300_000, 500_000],
                range: Binding(get: { app.carCriteria.price }, set: { app.carCriteria.price = $0 }),
                format: { FilterFormat.money($0) + " zł" }
            )
        case .year:
            rangeEditor(
                presets: [2005, 2010, 2014, 2016, 2018, 2020, 2022, 2024].map(Double.init),
                range: Binding(get: { app.carCriteria.year }, set: { app.carCriteria.year = $0 }),
                format: { "\(Int($0))" }
            )
        case .mileage:
            FilterGroup(nil) {
                FilterTile("Dowolny", selected: app.carCriteria.maxMileage == nil) { app.carCriteria.maxMileage = nil }
                ForEach([25_000, 50_000, 100_000, 150_000, 200_000, 300_000], id: \.self) { km in
                    FilterTile(
                        "do \(FilterFormat.grouped(km)) km",
                        count: app.cars.filter { $0.mileageKm <= km }.count,
                        selected: app.carCriteria.maxMileage == km
                    ) { app.carCriteria.maxMileage = km }
                }
            }
        case .fuel:
            FilterGroup(nil) {
                ForEach([CarAttributeFilter.petrol, .diesel, .hybrid, .electric]) { attr in
                    FilterTile(attr.title, icon: Self.fuelIcon(attr), selected: app.selectedCarAttributes.contains(attr)) {
                        app.toggleCarAttribute(attr)
                    }
                }
            }
        case .gearbox:
            FilterGroup(nil) {
                ForEach(CarTransmissionFilter.allCases) { t in
                    FilterTile(
                        t.title,
                        icon: "gearshape.2",
                        count: app.cars.filter { t.matches($0) }.count,
                        selected: app.carCriteria.transmissions.contains(t)
                    ) { app.carCriteria.transmissions.formSymmetricDifference([t]) }
                }
            }
        case .body:
            FilterGroup(nil) {
                ForEach(Self.counts(app.cars.map(\.bodyType)), id: \.name) { item in
                    FilterTile(item.name, count: item.count, selected: app.carCriteria.bodyTypes.contains(item.name)) {
                        app.carCriteria.bodyTypes.formSymmetricDifference([item.name])
                    }
                }
            }
        case .carDeals:
            FilterGroup(nil) {
                FilterTile("Wyróżnione", icon: "star", count: app.cars.filter(\.featured).count,
                           selected: app.selectedCarAttributes.contains(.featured)) {
                    app.toggleCarAttribute(.featured)
                }
            }
        case .carSort:
            FilterGroup(nil) {
                ForEach(CarSort.allCases) { sort in
                    FilterTile(sort.title, icon: sort.icon, selected: app.carCriteria.sort == sort, radio: true) {
                        app.carCriteria.sort = sort
                        if sort == .nearest { app.location.requestIfNeeded() }
                    }
                }
            }
        }
    }

    // MARK: Location cascades (Kraj → Miasto → Dzielnica)

    @ViewBuilder
    private var homeLocation: some View {
        let countries = Self.counts(app.offers.map { $0.resolvedCountry.name })
        if countries.count > 1 {
            FilterGroup("Kraj") {
                ForEach(countries, id: \.name) { c in
                    FilterTile(c.name, count: c.count, selected: app.homeCriteria.countries.contains(c.name)) {
                        app.homeCriteria.countries.formSymmetricDifference([c.name])
                    }
                }
            }
        }
        let inCountry = app.offers.filter {
            app.homeCriteria.countries.isEmpty || app.homeCriteria.countries.contains($0.resolvedCountry.name)
        }
        FilterGroup("Miasto lub miejscowość") {
            ForEach(Self.counts(inCountry.compactMap(\.city)).prefix(30), id: \.name) { c in
                FilterTile(c.name, count: c.count, selected: isSelectedCity(c.name, in: app.selectedHomeCities)) {
                    app.toggleHomeCity(c.name)
                    pruneDistricts()
                }
            }
        }
        if !app.selectedHomeCities.isEmpty {
            let districts = Self.counts(
                inCountry
                    .filter { o in isSelectedCity(o.city ?? "", in: app.selectedHomeCities) }
                    .compactMap(\.displayDistrict)
            )
            if !districts.isEmpty {
                FilterGroup("Dzielnica") {
                    ForEach(districts, id: \.name) { d in
                        FilterTile(d.name, count: d.count, selected: app.homeCriteria.districts.contains(d.name)) {
                            app.homeCriteria.districts.formSymmetricDifference([d.name])
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var carLocation: some View {
        let countries = Self.counts(app.cars.map { $0.resolvedCountry.name })
        if countries.count > 1 {
            FilterGroup("Kraj") {
                ForEach(countries, id: \.name) { c in
                    FilterTile(c.name, count: c.count, selected: app.carCriteria.countries.contains(c.name)) {
                        app.carCriteria.countries.formSymmetricDifference([c.name])
                    }
                }
            }
        }
        let inCountry = app.cars.filter {
            app.carCriteria.countries.isEmpty || app.carCriteria.countries.contains($0.resolvedCountry.name)
        }
        FilterGroup("Miasto lub miejscowość") {
            ForEach(Self.counts(inCountry.map(\.city)).prefix(30), id: \.name) { c in
                FilterTile(c.name, count: c.count, selected: isSelectedCity(c.name, in: app.selectedCarCities)) {
                    app.toggleCarCity(c.name)
                }
            }
        }
    }

    @ViewBuilder
    private var carModels: some View {
        if app.selectedCarMakes.isEmpty {
            Text("Wybierz najpierw markę — pokażemy jej modele.")
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(.white.opacity(0.7))
            Button { rowFocus = .make } label: {
                Label("Przejdź do marek", systemImage: "arrow.left")
            }
            .eosButton()
        } else {
            ForEach(app.selectedCarMakes.sorted(), id: \.self) { make in
                let models = Self.counts(app.cars.filter { $0.make.caseInsensitiveCompare(make) == .orderedSame }.map(\.model))
                FilterGroup(make) {
                    ForEach(models, id: \.name) { m in
                        FilterTile(m.name, count: m.count, selected: app.carCriteria.models.contains(m.name)) {
                            app.carCriteria.models.formSymmetricDifference([m.name])
                        }
                    }
                }
            }
        }
    }

    // MARK: Range editor (Od / Do presets)

    private func rangeEditor(
        presets: [Double],
        range: Binding<FilterRange>,
        format: @escaping (Double) -> String
    ) -> some View {
        VStack(alignment: .leading, spacing: 34) {
            FilterGroup("Od") {
                FilterTile("Bez minimum", selected: range.wrappedValue.min == nil) { range.wrappedValue.min = nil }
                ForEach(presets, id: \.self) { value in
                    FilterTile(format(value), selected: range.wrappedValue.min == value) {
                        range.wrappedValue.min = value
                        if let max = range.wrappedValue.max, max < value { range.wrappedValue.max = nil }
                    }
                }
            }
            FilterGroup("Do") {
                FilterTile("Bez limitu", selected: range.wrappedValue.max == nil) { range.wrappedValue.max = nil }
                ForEach(presets, id: \.self) { value in
                    FilterTile(format(value), selected: range.wrappedValue.max == value) {
                        range.wrappedValue.max = value
                        if let min = range.wrappedValue.min, min > value { range.wrappedValue.min = nil }
                    }
                }
            }
        }
    }

    private var homePricePresets: [Double] {
        let rentOnly = app.selectedHomeTransactions == [.rent]
        return rentOnly
            ? [1_500, 2_000, 2_500, 3_000, 4_000, 5_000, 7_000, 10_000, 15_000]
            : [200_000, 400_000, 600_000, 800_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000]
    }

    // MARK: Values & counts

    private func valueSummary(for item: FilterCategory) -> String {
        let any = "Dowolnie"
        switch item {
        case .transaction:
            let t = HomeTransactionFilter.allCases.filter { app.selectedHomeTransactions.contains($0) }.map(\.title)
            return t.isEmpty ? "Sprzedaż i wynajem" : t.joined(separator: ", ")
        case .propertyType:
            let t = HomePropertyKind.allCases.filter { app.selectedHomePropertyTypes.contains($0) }.map(\.title)
            return t.isEmpty ? "Wszystkie rodzaje" : t.joined(separator: ", ")
        case .location:
            var parts = app.homeCriteria.countries.sorted()
            parts += app.selectedHomeCities.sorted()
            parts += app.homeCriteria.districts.sorted()
            return parts.isEmpty ? "Cała Polska i zagranica" : parts.joined(separator: " · ")
        case .price:
            return app.homeCriteria.price.isActive ? FilterFormat.range(app.homeCriteria.price, unit: "zł", money: true) : any
        case .area:
            return app.homeCriteria.area.isActive ? FilterFormat.range(app.homeCriteria.area, unit: "m²", money: false) : any
        case .rooms:
            return app.homeCriteria.minRooms.map { "\($0)+ pokoje" } ?? any
        case .building:
            var p: [String] = []
            if let y = app.homeCriteria.minYearBuilt { p.append("od \(y) r.") }
            p += app.homeCriteria.floors.map(\.title).sorted()
            return p.isEmpty ? any : p.joined(separator: ", ")
        case .amenities:
            let a = app.homeCriteria.amenities.map(\.title).sorted()
            return a.isEmpty ? "Bez wymagań" : a.joined(separator: ", ")
        case .deals:
            var p: [String] = []
            if app.homeDiscounted { p.append("Przecenione") }
            if app.homePremium { p.append("Premium") }
            return p.isEmpty ? "Wszystkie oferty" : p.joined(separator: ", ")
        case .sort:
            return app.homeCriteria.sort.title
        case .make:
            return app.selectedCarMakes.isEmpty ? "Wszystkie marki" : app.selectedCarMakes.sorted().joined(separator: ", ")
        case .model:
            return app.carCriteria.models.isEmpty ? "Wszystkie modele" : app.carCriteria.models.sorted().joined(separator: ", ")
        case .carLocation:
            let p = app.carCriteria.countries.sorted() + app.selectedCarCities.sorted()
            return p.isEmpty ? "Wszędzie" : p.joined(separator: " · ")
        case .carPrice:
            return app.carCriteria.price.isActive ? FilterFormat.range(app.carCriteria.price, unit: "zł", money: true) : any
        case .year:
            return app.carCriteria.year.isActive ? FilterFormat.yearRange(app.carCriteria.year) : "Dowolny"
        case .mileage:
            return app.carCriteria.maxMileage.map { "do \(FilterFormat.grouped($0)) km" } ?? "Dowolny"
        case .fuel:
            let f = [CarAttributeFilter.petrol, .diesel, .hybrid, .electric].filter { app.selectedCarAttributes.contains($0) }.map(\.title)
            return f.isEmpty ? "Każde" : f.joined(separator: ", ")
        case .gearbox:
            let g = app.carCriteria.transmissions.map(\.title).sorted()
            return g.isEmpty ? "Każda" : g.joined(separator: ", ")
        case .body:
            return app.carCriteria.bodyTypes.isEmpty ? "Każde" : app.carCriteria.bodyTypes.sorted().joined(separator: ", ")
        case .carDeals:
            return app.selectedCarAttributes.contains(.featured) ? "Wyróżnione" : "Wszystkie auta"
        case .carSort:
            return app.carCriteria.sort.title
        }
    }

    private func isSet(_ item: FilterCategory) -> Bool {
        switch item {
        case .transaction: return !app.selectedHomeTransactions.isEmpty
        case .propertyType: return !app.selectedHomePropertyTypes.isEmpty
        case .location: return !app.selectedHomeCities.isEmpty || !app.homeCriteria.countries.isEmpty || !app.homeCriteria.districts.isEmpty
        case .price: return app.homeCriteria.price.isActive
        case .area: return app.homeCriteria.area.isActive
        case .rooms: return app.homeCriteria.minRooms != nil
        case .building: return app.homeCriteria.minYearBuilt != nil || !app.homeCriteria.floors.isEmpty
        case .amenities: return !app.homeCriteria.amenities.isEmpty
        case .deals: return app.homeDiscounted || app.homePremium
        case .sort: return app.homeCriteria.sort != .newest
        case .make: return !app.selectedCarMakes.isEmpty
        case .model: return !app.carCriteria.models.isEmpty
        case .carLocation: return !app.selectedCarCities.isEmpty || !app.carCriteria.countries.isEmpty
        case .carPrice: return app.carCriteria.price.isActive
        case .year: return app.carCriteria.year.isActive
        case .mileage: return app.carCriteria.maxMileage != nil
        case .fuel: return !app.selectedCarAttributes.subtracting([.featured, .automatic]).isEmpty
        case .gearbox: return !app.carCriteria.transmissions.isEmpty
        case .body: return !app.carCriteria.bodyTypes.isEmpty
        case .carDeals: return app.selectedCarAttributes.contains(.featured)
        case .carSort: return app.carCriteria.sort != .newest
        }
    }

    private func transactionCount(_ kind: HomeTransactionFilter) -> Int {
        app.offers.filter { offer in
            let tx = (offer.transactionType ?? "").uppercased()
            return kind == .rent ? tx.contains("RENT") : !tx.contains("RENT")
        }.count
    }

    private func isSelectedCity(_ city: String, in set: Set<String>) -> Bool {
        let key = city.trimmingCharacters(in: .whitespacesAndNewlines)
        return set.contains { $0.caseInsensitiveCompare(key) == .orderedSame }
    }

    /// Distinct non-empty values with counts, most frequent first.
    static func counts(_ values: [String]) -> [(name: String, count: Int)] {
        var counts: [String: Int] = [:]
        var display: [String: String] = [:]
        for raw in values {
            let v = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !v.isEmpty, v != "—", v.uppercased() != "OTHER" else { continue }
            let key = v.lowercased()
            counts[key, default: 0] += 1
            if display[key] == nil { display[key] = v }
        }
        return counts.keys
            .sorted { (counts[$0] ?? 0, $1) > (counts[$1] ?? 0, $0) }
            .map { (name: display[$0] ?? $0, count: counts[$0] ?? 0) }
    }

    private static func fuelIcon(_ attr: CarAttributeFilter) -> String {
        switch attr {
        case .petrol, .diesel: return "fuelpump"
        case .hybrid: return "leaf"
        case .electric: return "bolt"
        default: return "car"
        }
    }

    private func pruneDistricts() {
        guard !app.homeCriteria.districts.isEmpty else { return }
        let allowed = Set(app.offers
            .filter { isSelectedCity($0.city ?? "", in: app.selectedHomeCities) }
            .compactMap(\.displayDistrict))
        app.homeCriteria.districts.formIntersection(allowed)
    }

    private func pruneModels() {
        guard !app.carCriteria.models.isEmpty else { return }
        let allowed = Set(app.cars
            .filter { car in app.selectedCarMakes.contains { $0.caseInsensitiveCompare(car.make) == .orderedSame } }
            .map(\.model))
        app.carCriteria.models.formIntersection(allowed)
    }

    private func clampPriceForTransaction() {
        // Rent and sale prices live on different scales — drop a bound that no longer fits.
        app.homeCriteria.price = FilterRange()
    }

    // MARK: Close / cancel

    private func close() {
        onDismissFocus()
        dismiss()
    }

    private func cancel() {
        snapshot?.restore(into: app)
        close()
    }
}

// MARK: - Categories

enum FilterCategory: String, Identifiable, Hashable {
    // Nieruchomości
    case transaction, propertyType, location, price, area, rooms, building, amenities, deals, sort
    // Samochody
    case make, model, carLocation, carPrice, year, mileage, fuel, gearbox, body, carDeals, carSort

    var id: String { rawValue }

    static let home: [FilterCategory] = [.transaction, .propertyType, .location, .price, .area, .rooms, .building, .amenities, .deals, .sort]
    static let car: [FilterCategory] = [.make, .model, .carLocation, .carPrice, .year, .mileage, .fuel, .gearbox, .body, .carDeals, .carSort]

    var title: String {
        switch self {
        case .transaction: return "Transakcja"
        case .propertyType: return "Rodzaj nieruchomości"
        case .location, .carLocation: return "Lokalizacja"
        case .price, .carPrice: return "Cena"
        case .area: return "Metraż"
        case .rooms: return "Liczba pokoi"
        case .building: return "Budynek"
        case .amenities: return "Udogodnienia"
        case .deals: return "Okazje"
        case .sort, .carSort: return "Sortowanie"
        case .make: return "Marka"
        case .model: return "Model"
        case .year: return "Rocznik"
        case .mileage: return "Przebieg"
        case .fuel: return "Rodzaj paliwa"
        case .gearbox: return "Skrzynia biegów"
        case .body: return "Nadwozie"
        case .carDeals: return "Wyróżnione"
        }
    }

    var icon: String {
        switch self {
        case .transaction: return "arrow.left.arrow.right"
        case .propertyType: return "building.2"
        case .location, .carLocation: return "mappin.and.ellipse"
        case .price, .carPrice: return "banknote"
        case .area: return "square.dashed"
        case .rooms: return "bed.double"
        case .building: return "building"
        case .amenities: return "checkmark.seal"
        case .deals: return "tag"
        case .sort, .carSort: return "arrow.up.arrow.down"
        case .make: return "car"
        case .model: return "car.side"
        case .year: return "calendar"
        case .mileage: return "speedometer"
        case .fuel: return "fuelpump"
        case .gearbox: return "gearshape.2"
        case .body: return "car.rear"
        case .carDeals: return "star"
        }
    }

    func hint(isCar: Bool) -> String {
        switch self {
        case .transaction: return "Kupno czy wynajem — można zaznaczyć oba."
        case .propertyType: return "Zaznacz jeden lub kilka rodzajów."
        case .location: return "Kraj, potem miasto — dla wybranych miast pojawią się dzielnice."
        case .carLocation: return "Kraj i miasto, w którym stoi auto."
        case .price, .carPrice: return "Wybierz dolną i górną granicę ceny."
        case .area: return "Powierzchnia użytkowa w metrach kwadratowych."
        case .rooms: return "Minimalna liczba pokoi."
        case .building: return "Wiek budynku i położenie mieszkania."
        case .amenities: return "Pokażemy tylko oferty, które mają wszystkie zaznaczone."
        case .deals: return "Oferty z obniżoną ceną i najbardziej wyjątkowe."
        case .sort, .carSort: return "Kolejność ofert w wynikach."
        case .make: return "Zaznacz jedną lub kilka marek."
        case .model: return "Modele zaznaczonych marek."
        case .year: return "Rok produkcji od – do."
        case .mileage: return "Maksymalny przebieg."
        case .fuel: return "Zaznacz jeden lub kilka rodzajów napędu."
        case .gearbox: return "Automatyczna lub manualna."
        case .body: return "Typ nadwozia."
        case .carDeals: return "Auta promowane przez sprzedających."
        }
    }
}

// MARK: - Snapshot (Anuluj)

private struct FilterSnapshot {
    let homeTransactions: Set<HomeTransactionFilter>
    let homeCities: Set<String>
    let homeTypes: Set<HomePropertyKind>
    let homePremium: Bool
    let homeDiscounted: Bool
    let homeNearest: Bool
    let homeCriteria: HomeCriteria
    let carAttributes: Set<CarAttributeFilter>
    let carCities: Set<String>
    let carMakes: Set<String>
    let carNearest: Bool
    let carCriteria: CarCriteria

    @MainActor
    init(app: AppModel) {
        homeTransactions = app.selectedHomeTransactions
        homeCities = app.selectedHomeCities
        homeTypes = app.selectedHomePropertyTypes
        homePremium = app.homePremium
        homeDiscounted = app.homeDiscounted
        homeNearest = app.homeNearest
        homeCriteria = app.homeCriteria
        carAttributes = app.selectedCarAttributes
        carCities = app.selectedCarCities
        carMakes = app.selectedCarMakes
        carNearest = app.carNearest
        carCriteria = app.carCriteria
    }

    @MainActor
    func restore(into app: AppModel) {
        app.selectedHomeTransactions = homeTransactions
        app.selectedHomeCities = homeCities
        app.selectedHomePropertyTypes = homeTypes
        app.homePremium = homePremium
        app.homeDiscounted = homeDiscounted
        app.homeNearest = homeNearest
        app.homeCriteria = homeCriteria
        app.selectedCarAttributes = carAttributes
        app.selectedCarCities = carCities
        app.selectedCarMakes = carMakes
        app.carNearest = carNearest
        app.carCriteria = carCriteria
    }
}

// MARK: - Building blocks

/// A titled group of tiles laid out in an even grid.
private struct FilterGroup<Content: View>: View {
    let title: String?
    @ViewBuilder var content: () -> Content

    init(_ title: String?, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let title {
                Text(title.uppercased())
                    .font(.system(size: 18, weight: .bold))
                    .tracking(2)
                    .foregroundStyle(.white.opacity(0.55))
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 300, maximum: 420), spacing: 20)], alignment: .leading, spacing: 20) {
                content()
            }
        }
        .focusSection()
    }
}

/// Option tile: quiet glass at rest, tinted with a check when chosen, bright white when focused.
private struct FilterTile: View {
    let title: String
    var icon: String? = nil
    var count: Int? = nil
    let selected: Bool
    var radio = false
    let action: () -> Void

    init(_ title: String, icon: String? = nil, count: Int? = nil, selected: Bool, radio: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.count = count
        self.selected = selected
        self.radio = radio
        self.action = action
    }

    var body: some View {
        Button(action: { withAnimation(.snappy(duration: 0.22)) { action() } }) {
            HStack(spacing: 14) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 22, weight: .medium))
                        .frame(width: 28)
                }
                Text(title)
                    .font(.system(size: 23, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Spacer(minLength: 6)
                if let count {
                    Text("\(count)")
                        .font(.system(size: 19, weight: .semibold).monospacedDigit())
                        .opacity(0.55)
                }
                Image(systemName: selected ? (radio ? "largecircle.fill.circle" : "checkmark.circle.fill") : "circle")
                    .font(.system(size: 22, weight: .semibold))
                    .opacity(selected ? 1 : 0.35)
            }
            .padding(.horizontal, 22)
            .frame(height: 74)
        }
        .buttonStyle(FilterTileStyle(selected: selected))
        .accessibilityLabel(title)
        .accessibilityValue(selected ? "zaznaczone" : "")
    }
}

private struct FilterTileStyle: ButtonStyle {
    var selected: Bool
    @Environment(\.isFocused) private var isFocused
    private static let tint = Color(red: 0.36, green: 0.84, blue: 0.62)

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(isFocused ? Color.black : Color.white)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(isFocused ? Color.white : (selected ? Self.tint.opacity(0.24) : Color.white.opacity(0.07)))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(selected && !isFocused ? Self.tint.opacity(0.7) : Color.white.opacity(isFocused ? 0 : 0.12), lineWidth: 1.5)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : (isFocused ? 1.05 : 1))
            .shadow(color: .black.opacity(isFocused ? 0.4 : 0), radius: 20, y: 10)
            .animation(EOSMotion.focus, value: isFocused)
    }
}

/// "Pokaż N ofert" — the one bright, primary action on the screen.
private struct FilterPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var isFocused
    private static let tint = Color(red: 0.36, green: 0.84, blue: 0.62)

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(Color.black)
            .padding(.horizontal, 34)
            .padding(.vertical, 18)
            .background(Capsule().fill(isFocused ? Color.white : Self.tint))
            .scaleEffect(configuration.isPressed ? 0.97 : (isFocused ? 1.08 : 1))
            .shadow(color: .black.opacity(isFocused ? 0.45 : 0.2), radius: isFocused ? 24 : 10, y: isFocused ? 12 : 4)
            .animation(EOSMotion.focus, value: isFocused)
    }
}

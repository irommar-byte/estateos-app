import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var app: AppModel
    var chromeFocus: FocusState<HomeChromeFocus?>.Binding
    var auxFocus: FocusState<HomeAuxFocus?>.Binding
    @FocusState private var queryFocused: Bool

    @State private var query = ""
    @State private var sections: [SpotlightSection] = []
    @State private var results: [SpotlightResult] = []
    @State private var tookMs = 0
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?
    @State private var qrItem: SpotlightQRItem?
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            header
            searchField
            resultsBody
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .focusSection()
        .onChange(of: auxFocus.wrappedValue) { _, value in
            if value == .searchQuery { queryFocused = true }
        }
        .onChange(of: queryFocused) { _, focused in
            if focused { auxFocus.wrappedValue = .searchQuery }
        }
        .onChange(of: query) { _, _ in
            scheduleSearch()
        }
        .onAppear {
            if auxFocus.wrappedValue == .searchQuery || query.isEmpty {
                queryFocused = true
            }
        }
        .onDisappear {
            searchTask?.cancel()
        }
        .fullScreenCover(item: $qrItem) { item in
            EOSQrSheet(
                title: item.title,
                subtitle: item.subtitle,
                urlString: item.url,
                footnote: "Na iPhonie zobaczysz profil, oferty i kontakt.",
                eyebrow: "PROFIL W ESTATEOS"
            )
            .environment(\.colorScheme, .dark)
        }
    }

    // MARK: Header & field

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 22) {
            Text("Szukaj")
                .font(.system(size: 64, weight: .bold))
                .tracking(-0.8)
            Text("Oferty, auta, agenci i biura")
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(.secondary)
            Spacer(minLength: 12)
            if isSearching {
                ProgressView()
            } else if tookMs > 0, !trimmedQuery.isEmpty {
                Text("\(resultCount) wyników")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 18) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(queryFocused ? Color.black.opacity(0.6) : Color.secondary)
            TextField("Numer oferty, miasto, dzielnica, agent, słowo z opisu…", text: $query)
                .textFieldStyle(.plain)
                .font(.system(size: 30, weight: .medium))
                .focused($queryFocused)
                .onSubmit {
                    app.recordSpotlightSearch(query)
                    scheduleSearch()
                }
                .accessibilityLabel("Szukaj w EstateOS")
            if !query.isEmpty {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 32)
        .frame(height: 92)
        .environment(\.colorScheme, queryFocused ? .light : colorScheme)
        .background(
            Capsule().fill(queryFocused ? Color.white : Color.primary.opacity(colorScheme == .dark ? 0.1 : 0.07))
        )
        .overlay(Capsule().strokeBorder(Color.primary.opacity(queryFocused ? 0 : 0.1), lineWidth: 1))
        .scaleEffect(queryFocused ? 1.015 : 1)
        .shadow(color: .black.opacity(queryFocused ? 0.3 : 0), radius: 24, y: 12)
        .animation(EOSMotion.focus, value: queryFocused)
        .frame(maxWidth: 1400)
    }

    // MARK: Results

    private var trimmedQuery: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }

    @ViewBuilder
    private var resultsBody: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: 40) {
                if trimmedQuery.isEmpty {
                    suggestions
                } else if isSearching, sections.isEmpty, results.isEmpty {
                    ProgressView("Szukam w EstateOS…")
                        .padding(.vertical, 24)
                } else if displaySections.isEmpty, carMatches.isEmpty {
                    noResults
                } else {
                    ForEach(displaySections) { section in
                        resultSection(section)
                    }
                    if !carMatches.isEmpty {
                        groupTitle("Samochody", count: carMatches.count)
                        posterGrid {
                            ForEach(carMatches) { car in
                                EOSPosterCard(
                                    imageURL: EOSOfferMedia.imageURL(from: car.imageUrl),
                                    title: car.displayHeadline,
                                    subtitle: [car.displayPrice, car.city].filter { !$0.isEmpty }.joined(separator: " · "),
                                    width: 380
                                ) {
                                    app.recordSpotlightSearch(query)
                                    app.setCatalogBrand(.car)
                                    app.openCarDetail(car)
                                }
                            }
                        }
                    }
                }
            }
            .padding(.vertical, 20)
            .padding(.bottom, 60)
        }
        .scrollClipDisabled()
    }

    @ViewBuilder
    private func resultSection(_ section: SpotlightSection) -> some View {
        groupTitle(section.label, count: section.items.count)
        if section.kind == .offer {
            posterGrid {
                ForEach(section.items) { item in
                    EOSPosterCard(
                        imageURL: item.imageUrl.flatMap { URL(string: $0) },
                        title: item.title,
                        subtitle: item.subtitle,
                        width: 380
                    ) {
                        app.recordSpotlightSearch(query)
                        open(item)
                    }
                }
            }
        } else {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 24), GridItem(.flexible(), spacing: 24)], spacing: 20) {
                ForEach(section.items) { item in
                    Button {
                        app.recordSpotlightSearch(query)
                        open(item)
                    } label: {
                        personRow(item)
                    }
                    .buttonStyle(SearchRowStyle())
                }
            }
        }
    }

    private func posterGrid<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.fixed(380), spacing: 48), count: 4), alignment: .leading, spacing: 40) {
            content()
        }
    }

    private func groupTitle(_ title: String, count: Int) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text(title.capitalizedFirst)
                .font(.system(size: 32, weight: .bold))
            Text("\(count)")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.secondary)
        }
    }

    private func personRow(_ item: SpotlightResult) -> some View {
        HStack(spacing: 22) {
            Group {
                if let raw = item.imageUrl, let url = URL(string: raw) {
                    EOSCachedRemoteImage(url: url, contentMode: .fill, size: .thumb) { Color.primary.opacity(0.08) }
                } else {
                    ZStack {
                        Color.primary.opacity(0.08)
                        Image(systemName: item.kind.iconName).font(.system(size: 30)).foregroundStyle(.secondary)
                    }
                }
            }
            .frame(width: 88, height: 88)
            .clipShape(item.kind == .agent ? AnyShape(Circle()) : AnyShape(RoundedRectangle(cornerRadius: 20, style: .continuous)))
            VStack(alignment: .leading, spacing: 6) {
                Text(item.title)
                    .font(.system(size: 26, weight: .semibold))
                    .lineLimit(1)
                Text(item.subtitle)
                    .font(.system(size: 20))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 12)
            Image(systemName: "qrcode")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.secondary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 128, alignment: .leading)
    }

    // MARK: Suggestions (empty field)

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: 40) {
            let recent = TvPreferences.recentSpotlightSearches
            if !recent.isEmpty {
                chipGroup("Ostatnio wyszukiwane", icon: "clock.arrow.circlepath", terms: recent)
            }
            if !popularPlaces.isEmpty {
                chipGroup("Popularne lokalizacje", icon: "mappin.and.ellipse", terms: popularPlaces)
            }
            VStack(alignment: .leading, spacing: 12) {
                hintLine("number", "Numer oferty, np. 1234")
                hintLine("person.fill", "Imię i nazwisko agenta albo nazwa biura")
                hintLine("text.magnifyingglass", "Słowo z opisu: taras, ogród, widok na las…")
            }
            .padding(.top, 6)
        }
    }

    private func chipGroup(_ title: String, icon: String, terms: [String]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Label(title, systemImage: icon)
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 18) {
                    ForEach(terms, id: \.self) { term in
                        Button(term) {
                            query = term
                            app.recordSpotlightSearch(term)
                        }
                        .eosButton()
                    }
                }
                .padding(.vertical, 14)
            }
            .scrollClipDisabled()
        }
        .focusSection()
    }

    private func hintLine(_ icon: String, _ text: String) -> some View {
        Label(text, systemImage: icon)
            .font(.system(size: 22, weight: .medium))
            .foregroundStyle(.secondary)
    }

    /// The cities (and Warsaw districts) with the most offers — one press to search them.
    private var popularPlaces: [String] {
        var counts: [String: Int] = [:]
        for offer in app.offers {
            if let city = offer.city?.trimmingCharacters(in: .whitespaces), !city.isEmpty { counts[city, default: 0] += 1 }
        }
        return counts.sorted { $0.value > $1.value }.prefix(10).map(\.key)
    }

    private var noResults: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nic nie znaleźliśmy dla „\(trimmedQuery)”")
                .font(.system(size: 34, weight: .bold))
            Text("Spróbuj numeru oferty, dzielnicy, nazwiska agenta albo jednego słowa z opisu.")
                .font(.system(size: 23))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 24)
    }

    private var displaySections: [SpotlightSection] {
        if !sections.isEmpty { return sections }
        if results.isEmpty { return [] }
        let grouped = Dictionary(grouping: results, by: \.kind)
        return SpotlightResultKind.allCases.compactMap { kind in
            guard let items = grouped[kind], !items.isEmpty else { return nil }
            return SpotlightSection(kind: kind, label: kind.sectionLabel, items: items)
        }
    }

    private var resultCount: Int {
        displaySections.reduce(0) { $0 + $1.items.count } + (trimmedQuery.isEmpty ? 0 : carMatches.count)
    }

    private var carMatches: [CarListing] {
        let q = trimmedQuery.lowercased()
        guard q.count >= 2 else { return [] }
        return Array(
            app.cars.filter { car in
                "\(car.displayHeadline) \(car.city) \(car.displaySpecs) \(car.displayPrice)"
                    .lowercased()
                    .contains(q)
            }
            .prefix(8)
        )
    }

    private func open(_ item: SpotlightResult) {
        switch item.kind {
        case .offer:
            if let id = item.offerId {
                Task { await app.openSpotlightOffer(id: id) }
            } else {
                qrItem = SpotlightQRItem(result: item)
            }
        case .agent, .agency:
            qrItem = SpotlightQRItem(result: item)
        }
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        let value = query
        searchTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 180_000_000)
            guard !Task.isCancelled else { return }
            await runSearch(value)
        }
    }

    @MainActor
    private func runSearch(_ value: String) async {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            sections = []
            results = []
            tookMs = 0
            isSearching = false
            return
        }
        isSearching = true
        do {
            let payload = try await app.searchSpotlight(query: trimmed)
            guard !Task.isCancelled else { return }
            sections = payload.sections
            results = payload.results
            tookMs = payload.tookMs ?? 0
        } catch {
            guard !Task.isCancelled else { return }
            sections = []
            results = localOfferFallback(trimmed)
            tookMs = 0
        }
        isSearching = false
    }

    private func localOfferFallback(_ q: String) -> [SpotlightResult] {
        let needle = q.lowercased()
        return app.offers.filter { offer in
            "\(offer.title) \(offer.displayLocation) \(offer.id)"
                .lowercased()
                .contains(needle)
        }
        .prefix(10)
        .map { offer in
            SpotlightResult(
                id: "offer-\(offer.id)",
                kind: .offer,
                title: offer.title,
                subtitle: "#\(offer.id) · \(offer.displayLocation) · \(EOSFormat.pricePLN(offer.price))",
                detail: nil,
                imageUrl: EOSOfferMedia.primaryImageURL(for: offer)?.absoluteString,
                href: "/oferta/\(offer.id)",
                score: nil
            )
        }
    }
}

private struct SpotlightQRItem: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let url: String

    init(result: SpotlightResult) {
        id = result.id
        title = result.title
        subtitle = result.subtitle
        url = result.absoluteURL.absoluteString
    }
}

/// List row for people and agencies: soft fill at rest, white with dark text when focused.
private struct SearchRowStyle: ButtonStyle {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.colorScheme) private var scheme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .environment(\.colorScheme, isFocused ? .light : scheme)
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(isFocused ? Color.white : Color.primary.opacity(scheme == .dark ? 0.08 : 0.06))
            )
            .scaleEffect(configuration.isPressed ? 0.98 : (isFocused ? 1.04 : 1))
            .shadow(color: .black.opacity(isFocused ? 0.35 : 0), radius: 22, y: 12)
            .animation(EOSMotion.focus, value: isFocused)
    }
}

private extension String {
    var capitalizedFirst: String {
        guard let first else { return self }
        return first.uppercased() + dropFirst().lowercased()
    }
}

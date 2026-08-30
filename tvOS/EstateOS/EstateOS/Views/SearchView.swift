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

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            header
            searchField
            recentRow
            resultsBody
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .focusSection()
        .onMoveCommand { direction in
            if direction == .up {
                queryFocused = false
                auxFocus.wrappedValue = nil
                chromeFocus.wrappedValue = .tab(.search)
            }
        }
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
                footnote: "Zeskanuj iPhone’em — ten sam Spotlight co na www."
            )
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            HStack(spacing: 14) {
                EOSSpotlightLens(active: isSearching || queryFocused, size: 44)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Spotlight")
                        .font(.system(size: 30, weight: .semibold))
                    Text("Oferty, agenci i biura — jak na iPhone i estateos.pl")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 12)
            if isSearching {
                ProgressView()
            } else if tookMs > 0, !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text("\(resultCount) wyników · \(tookMs) ms")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var searchField: some View {
        TextField(
            "ID, miasto, dzielnica, agent, słowo z opisu…",
            text: $query
        )
        .textFieldStyle(.plain)
        .font(.title3)
        .padding(.horizontal, 22)
        .padding(.vertical, 18)
        .eosGlass(cornerRadius: 18, opacity: 0.36)
        .focused($queryFocused)
        .onSubmit {
            app.recordSpotlightSearch(query)
            scheduleSearch()
        }
        .accessibilityLabel("Pole Spotlight")
    }

    @ViewBuilder
    private var recentRow: some View {
        let recent = TvPreferences.recentSpotlightSearches
        if !recent.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(recent, id: \.self) { term in
                        Button(term) {
                            query = term
                            queryFocused = true
                        }
                        .buttonStyle(EOSMicroChipButtonStyle(selected: query == term, accent: EOSPalette.home))
                        .focusEffectDisabled()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var resultsBody: some View {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: 8) {
                if trimmed.isEmpty {
                    emptyHint
                } else if isSearching, sections.isEmpty, results.isEmpty {
                    ProgressView("Szukam w EstateOS…")
                        .padding(.vertical, 24)
                } else if displaySections.isEmpty {
                    Text("Brak trafień. Spróbuj numer oferty, dzielnicę, agenta albo słowo z opisu.")
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 24)
                } else {
                    ForEach(displaySections) { section in
                        Text(section.label.uppercased())
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.tertiary)
                            .tracking(1.4)
                            .padding(.top, 16)
                            .padding(.bottom, 4)

                        ForEach(section.items) { item in
                            spotlightRow(item)
                        }
                    }
                }

                if !carMatches.isEmpty, !trimmed.isEmpty {
                    Text("SAMOCHODY")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.tertiary)
                        .tracking(1.4)
                        .padding(.top, 16)
                        .padding(.bottom, 4)
                    ForEach(carMatches) { car in
                        carRow(car)
                    }
                }
            }
            .padding(.bottom, 28)
        }
    }

    private var emptyHint: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Wpisz numer oferty, miasto, dzielnicę, nazwisko agenta albo frazę z opisu.")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Ten sam indeks co Spotlight na iPhone i na www.")
                .font(.callout)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 28)
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
        displaySections.reduce(0) { $0 + $1.items.count } + (query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0 : carMatches.count)
    }

    private var carMatches: [CarListing] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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

    private func spotlightRow(_ item: SpotlightResult) -> some View {
        Button {
            app.recordSpotlightSearch(query)
            open(item)
        } label: {
            HStack(spacing: 18) {
                thumbnail(url: item.imageUrl, icon: item.kind.iconName)
                VStack(alignment: .leading, spacing: 6) {
                    Text(item.title)
                        .font(.headline)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .foregroundStyle(.white)
                    Text(item.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                    if let detail = item.detail, !detail.isEmpty {
                        Text(detail)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                            .lineLimit(2)
                    }
                }
                Spacer(minLength: 12)
                Text(item.kind.label)
                    .font(.caption2.weight(.heavy))
                    .tracking(1.1)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .overlay(Capsule().stroke(Color.white.opacity(0.22), lineWidth: 1))
                    .foregroundStyle(.secondary)
            }
            .padding(18)
            .frame(minHeight: 112)
            .eosGlass(cornerRadius: 18, opacity: 0.32)
            .eosFocusRing(cornerRadius: 18, accent: EOSPalette.home)
        }
        .buttonStyle(EOSPosterButtonStyle(focusScale: 1.04))
        .focusEffectDisabled()
    }

    private func carRow(_ car: CarListing) -> some View {
        Button {
            app.recordSpotlightSearch(query)
            app.setCatalogBrand(.car)
            app.openCarDetail(car)
        } label: {
            HStack(spacing: 18) {
                EOSOfferThumbnail(url: EOSOfferMedia.imageURL(from: car.imageUrl), height: 88)
                    .frame(width: 140)
                VStack(alignment: .leading, spacing: 6) {
                    Text(car.displayHeadline)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .lineLimit(2)
                    Text(car.city.isEmpty ? car.displaySpecs : "\(car.city) · \(car.displaySpecs)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 12)
                Text(car.displayPrice)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(EOSPalette.car)
            }
            .padding(18)
            .eosGlass(cornerRadius: 18, opacity: 0.32)
            .eosFocusRing(cornerRadius: 18, accent: EOSPalette.car)
        }
        .buttonStyle(EOSPosterButtonStyle(focusScale: 1.04))
        .focusEffectDisabled()
    }

    private func thumbnail(url: String?, icon: String) -> some View {
        Group {
            if let url, let parsed = URL(string: url) {
                EOSOfferThumbnail(url: parsed, height: 88)
                    .frame(width: 140)
            } else {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 140, height: 88)
                    .overlay(Image(systemName: icon).font(.title2).foregroundStyle(.secondary))
            }
        }
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

struct EOSSpotlightLens: View {
    var active: Bool
    var size: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(white: 0.78))
                .shadow(color: .black.opacity(0.35), radius: 8, y: 4)
            Circle()
                .fill(.ultraThinMaterial)
                .padding(4)
            Image(systemName: "magnifyingglass")
                .font(.system(size: size * 0.38, weight: .semibold))
                .foregroundStyle(Color(white: 0.12))
            Circle()
                .fill(Color.white.opacity(0.45))
                .frame(width: size * 0.28, height: size * 0.18)
                .offset(x: -size * 0.12, y: -size * 0.14)
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(active ? -10 : -4))
        .scaleEffect(active ? 1.06 : 1)
        .animation(.easeOut(duration: 0.28), value: active)
        .accessibilityHidden(true)
    }
}

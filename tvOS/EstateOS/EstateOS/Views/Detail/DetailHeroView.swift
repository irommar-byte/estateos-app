import SwiftUI
import MapKit

// MARK: - Mapa ofert (2026-10, v2)
//
// The remote moves between PINS, not along a list: ◀ ▲ ▼ ▶ jumps to the nearest pin in that
// direction on screen, exactly where you are looking. Nearby offers are grouped into clusters
// that split as you zoom in:
//   Select on a cluster  → zoom into it (or, when the offers share one building, list them)
//   Select on a pin      → open the offer
//   MENU                 → zoom back out, step by step; at the start view — back to the menu
//   ⏯                    → filters
//
// Performance: a flat map without POIs, light annotation views (no blur materials), clusters
// rebuilt only when the zoom level really changes — never during a camera animation.

struct OfferMapView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.eosLaunchFinished) private var launchFinished
    var onOpenFilters: () -> Void
    /// True while the map owns the remote (the header capsule is disabled meanwhile).
    @Binding var ownsRemote: Bool
    /// Hand the remote back to the header capsule.
    var onRelease: () -> Void

    @State private var pins: [OfferMapPin] = []
    @State private var clusters: [MapCluster] = []
    @State private var clusteredSpan: MKCoordinateSpan?
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 52.1, longitude: 19.4),
        span: MKCoordinateSpan(latitudeDelta: 6.5, longitudeDelta: 9.5)
    )
    @State private var position: MapCameraPosition = .automatic
    @State private var selectedId: String?
    @State private var anchor: CLLocationCoordinate2D?
    @State private var zoomStack: [MKCoordinateRegion] = []
    @State private var homeRegion: MKCoordinateRegion?
    @State private var listing: MapCluster?
    @State private var built = false
    @State private var bump = CGSize.zero
    @FocusState private var stageFocused: Bool
    @FocusState private var listFocus: Int?

    /// Screen the map is drawn on (tvOS renders at 1920 × 1080 points).
    private static let screen = CGSize(width: 1920, height: 1080)
    /// Pins closer than this on screen merge into one cluster.
    private static let clusterRadius: CGFloat = 96
    /// Visible part of the screen above the info panel, as fractions (x, y).
    private static let visibleX: ClosedRange<Double> = 0.08...0.92
    private static let visibleY: ClosedRange<Double> = 0.16...0.6
    private static let minSpan = 0.006

    var body: some View {
        ZStack(alignment: .bottom) {
            map.ignoresSafeArea()

            LinearGradient(colors: [.black.opacity(0.6), .clear], startPoint: .top, endPoint: .bottom)
                .frame(height: 240)
                .frame(maxHeight: .infinity, alignment: .top)
                .ignoresSafeArea()
                .allowsHitTesting(false)
            LinearGradient(colors: [.clear, .black.opacity(0.75)], startPoint: .top, endPoint: .bottom)
                .frame(height: 420)
                .ignoresSafeArea()
                .allowsHitTesting(false)

            stage

            if pins.isEmpty {
                if built { emptyState.frame(maxWidth: .infinity, alignment: .leading) }
            } else if let listing {
                MapClusterList(cluster: listing, focus: $listFocus, onOpen: { app.openDetail($0) }) {
                    closeListing()
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            } else if let cluster = selectedCluster {
                MapInfoPanel(cluster: cluster, canZoom: canZoom(into: cluster))
                    .offset(bump)
                    .transition(.opacity)
            }
        }
        .overlay(alignment: .topTrailing) { hintChip.padding(.top, 8) }
        .animation(.spring(response: 0.45, dampingFraction: 0.9), value: listing?.id)
        .task(id: app.homeFilterSummary + "|\(app.offers.count)") { rebuildPins() }
        .onAppear {
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 120_000_000)
                if listing == nil { stageFocused = true }
            }
        }
        .onChange(of: launchFinished) { _, finished in
            // Map chosen as the start screen: take the remote once the splash is gone.
            guard finished else { return }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 120_000_000)
                stageFocused = true
            }
        }
        .onChange(of: stageFocused) { _, focused in
            if focused { ownsRemote = true } else if listing == nil { ownsRemote = false }
        }
        .onChange(of: app.mapFocusOfferId) { _, target in
            guard let target else { return }
            focusOffer(target)
        }
        .onDisappear { ownsRemote = false }
    }

    // MARK: Map

    private var map: some View {
        Map(position: $position, interactionModes: []) {
            ForEach(drawOrder) { cluster in
                if cluster.count == 1, !cluster.members[0].exact {
                    MapCircle(center: cluster.coordinate, radius: 420)
                        .foregroundStyle(Color.white.opacity(cluster.id == selectedId ? 0.16 : 0.07))
                        .stroke(Color.white.opacity(cluster.id == selectedId ? 0.6 : 0.25), lineWidth: 1.5)
                }
                Annotation("", coordinate: cluster.coordinate, anchor: cluster.count == 1 ? .bottom : .center) {
                    MapMarkerView(cluster: cluster, selected: cluster.id == selectedId)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll, showsTraffic: false))
        .mapControlVisibility(.hidden)
        .environment(\.colorScheme, .dark)
        .focusable(false)
        .onMapCameraChange(frequency: .onEnd) { context in
            region = context.region
            reclusterIfNeeded()
        }
    }

    /// Invisible full-screen target that owns the remote while you move across the map.
    private var stage: some View {
        Button(action: select) { Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity) }
            .buttonStyle(MapStageStyle())
            .focused($stageFocused)
            .disabled(listing != nil || pins.isEmpty)
            .onMoveCommand(perform: move)
            .onExitCommand(perform: back)
            .onPlayPauseCommand(perform: onOpenFilters)
            .accessibilityLabel(selectedCluster.map(accessibilityText) ?? "Mapa ofert")
    }

    /// The selected marker is drawn last, so it is never hidden under its neighbours.
    private var drawOrder: [MapCluster] {
        guard let selectedId, let i = clusters.firstIndex(where: { $0.id == selectedId }) else { return clusters }
        var list = clusters
        list.append(list.remove(at: i))
        return list
    }

    private var selectedCluster: MapCluster? {
        guard let selectedId else { return nil }
        return clusters.first { $0.id == selectedId }
    }

    // MARK: Remote

    private func move(_ direction: MoveCommandDirection) {
        guard let current = selectedCluster else {
            selectNearest(to: region.center)
            return
        }
        let d: CGVector
        switch direction {
        case .left: d = CGVector(dx: -1, dy: 0)
        case .right: d = CGVector(dx: 1, dy: 0)
        case .up: d = CGVector(dx: 0, dy: -1)
        case .down: d = CGVector(dx: 0, dy: 1)
        @unknown default: return
        }
        let origin = screenPoint(current.coordinate)
        var best: (cluster: MapCluster, score: CGFloat)?
        for candidate in clusters where candidate.id != current.id {
            let p = screenPoint(candidate.coordinate)
            let v = CGVector(dx: p.x - origin.x, dy: p.y - origin.y)
            let along = v.dx * d.dx + v.dy * d.dy
            guard along > 6 else { continue }
            let across = abs(v.dx * d.dy - v.dy * d.dx)
            guard across <= along * 1.6 else { continue }      // within ~58° of the arrow
            let score = along + across * 1.8
            if best == nil || score < best!.score { best = (candidate, score) }
        }
        guard let next = best?.cluster else {
            if direction == .up { release() } else { nudge(d) }
            return
        }
        choose(next)
    }

    private func select() {
        guard let cluster = selectedCluster else { return }
        if cluster.count == 1 {
            app.openDetail(cluster.members[0].offer)
        } else if canZoom(into: cluster) {
            zoom(into: cluster)
        } else {
            openListing(cluster)
        }
    }

    private func back() {
        if let previous = zoomStack.popLast() {
            anchor = selectedCluster?.coordinate ?? anchor
            fly(to: previous, duration: 0.9)
        } else {
            release()
        }
    }

    private func release() {
        ownsRemote = false
        onRelease()
    }

    /// Nothing in that direction: a tiny elastic nudge of the panel says "edge".
    private func nudge(_ d: CGVector) {
        withAnimation(.spring(response: 0.18, dampingFraction: 0.5)) { bump = CGSize(width: d.dx * 14, height: d.dy * 8) }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 160_000_000)
            withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { bump = .zero }
        }
    }

    private func choose(_ cluster: MapCluster) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) { selectedId = cluster.id }
        anchor = cluster.coordinate
        prefetch(cluster)
        keepVisible(cluster.coordinate)
    }

    private func selectNearest(to coordinate: CLLocationCoordinate2D) {
        let origin = screenPoint(coordinate)
        let nearest = clusters.min { a, b in
            distance(screenPoint(a.coordinate), origin) < distance(screenPoint(b.coordinate), origin)
        }
        guard let nearest else { return }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) { selectedId = nearest.id }
        prefetch(nearest)
    }

    // MARK: Camera

    private func canZoom(into cluster: MapCluster) -> Bool {
        let box = cluster.bounds
        let spread = max(box.span.latitudeDelta, box.span.longitudeDelta)
        return spread > 0.0009 && region.span.longitudeDelta > Self.minSpan * 1.3
    }

    private func zoom(into cluster: MapCluster) {
        zoomStack.append(region)
        anchor = cluster.coordinate
        fly(to: fitted(cluster.bounds), duration: 1.0)
    }

    /// A region that shows `box` inside the visible band above the info panel.
    private func fitted(_ box: MKCoordinateRegion) -> MKCoordinateRegion {
        let aspect = Self.screen.width / Self.screen.height
        let vFraction = Self.visibleY.upperBound - Self.visibleY.lowerBound
        let hFraction = Self.visibleX.upperBound - Self.visibleX.lowerBound
        var lat = max(box.span.latitudeDelta / vFraction * 1.25, Self.minSpan)
        var lng = max(box.span.longitudeDelta / hFraction * 1.25, Self.minSpan)
        // Keep the screen's proportions (Mercator, scaled by latitude).
        let k = cos(box.center.latitude * .pi / 180)
        if lng * k / lat < aspect { lng = lat * aspect / k } else { lat = lng * k / aspect }
        let visibleMid = (Self.visibleY.lowerBound + Self.visibleY.upperBound) / 2
        let center = CLLocationCoordinate2D(
            latitude: box.center.latitude - (0.5 - visibleMid) * lat,
            longitude: box.center.longitude
        )
        return MKCoordinateRegion(center: center, span: MKCoordinateSpan(latitudeDelta: lat, longitudeDelta: lng))
    }

    /// Pans (never zooms) when the chosen pin would sit outside the visible band or under the panel.
    private func keepVisible(_ c: CLLocationCoordinate2D) {
        let f = fraction(c)
        guard !Self.visibleX.contains(f.x) || !Self.visibleY.contains(f.y) else { return }
        let targetY = 0.4
        var next = region
        next.center = CLLocationCoordinate2D(
            latitude: c.latitude - (0.5 - targetY) * region.span.latitudeDelta,
            longitude: c.longitude
        )
        fly(to: next, duration: 0.7)
    }

    private func fly(to target: MKCoordinateRegion, duration: Double) {
        withAnimation(.easeInOut(duration: duration)) { position = .region(target) }
    }

    private func fraction(_ c: CLLocationCoordinate2D) -> (x: Double, y: Double) {
        (0.5 + (c.longitude - region.center.longitude) / region.span.longitudeDelta,
         0.5 - (c.latitude - region.center.latitude) / region.span.latitudeDelta)
    }

    private func screenPoint(_ c: CLLocationCoordinate2D) -> CGPoint {
        let f = fraction(c)
        return CGPoint(x: f.x * Self.screen.width, y: f.y * Self.screen.height)
    }

    private func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat { hypot(a.x - b.x, a.y - b.y) }

    // MARK: Clusters

    private func reclusterIfNeeded() {
        if let last = clusteredSpan,
           abs(last.longitudeDelta - region.span.longitudeDelta) / last.longitudeDelta < 0.03 {
            // Pan only: clusters are anchored to the ground, nothing to rebuild.
            if selectedId == nil, let anchor { selectNearest(to: anchor) }
            return
        }
        recluster()
    }

    private func recluster() {
        let span = region.span
        clusteredSpan = span
        let next = MapCluster.build(
            pins,
            pointsPerLng: Self.screen.width / span.longitudeDelta,
            pointsPerLat: Self.screen.height / span.latitudeDelta,
            radius: Self.clusterRadius
        )
        clusters = next
        if let id = selectedId, next.contains(where: { $0.id == id }) { return }
        selectedId = nil
        if let anchor { selectNearest(to: anchor) } else if !next.isEmpty { selectNearest(to: region.center) }
    }

    private func prefetch(_ cluster: MapCluster) {
        let urls = cluster.members.prefix(4).compactMap { EOSOfferMedia.primaryImageURL(for: $0.offer) }
        EOSImageCache.prefetch(urls: urls, size: .card)
    }

    // MARK: Listing (offers in one building)

    private func openListing(_ cluster: MapCluster) {
        listing = cluster
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 120_000_000)
            listFocus = cluster.members.first?.id
        }
    }

    private func closeListing() {
        listing = nil
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 80_000_000)
            stageFocused = true
        }
    }

    // MARK: Data

    private func rebuildPins() {
        pins = app.mappableOffers.compactMap { offer -> OfferMapPin? in
            guard let c = offer.extras.coordinate else { return nil }
            let isRent = (offer.transactionType ?? "").uppercased().contains("RENT")
            let label: String
            if let price = offer.price, price > 0 {
                label = FilterFormat.money(price) + (isRent ? " zł/mc" : " zł")
            } else {
                label = "Zapytaj"
            }
            return OfferMapPin(
                id: offer.id, offer: offer,
                coordinate: CLLocationCoordinate2D(latitude: c.lat, longitude: c.lng),
                exact: offer.extras.isExactLocation, label: label, isRent: isRent, price: offer.price ?? 0
            )
        }
        built = true
        zoomStack = []
        listing = nil
        selectedId = nil
        guard !pins.isEmpty else { clusters = []; return }

        let all = MapCluster.bounds(of: pins)
        let start = fitted(all)
        homeRegion = start
        region = start
        position = .region(start)
        recluster()
        if let target = app.mapFocusOfferId { focusOffer(target) }
    }

    /// "Na mapie" from an offer: fly close to it and select its pin.
    private func focusOffer(_ id: Int) {
        app.mapFocusOfferId = nil
        guard let pin = pins.first(where: { $0.id == id }) else { return }
        zoomStack = homeRegion.map { [$0] } ?? []
        anchor = pin.coordinate
        let close = fitted(MKCoordinateRegion(center: pin.coordinate, span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)))
        region = close
        fly(to: close, duration: 1.1)
        recluster()
        if let cluster = clusters.first(where: { $0.members.contains { $0.id == id } }) {
            selectedId = cluster.id
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 150_000_000)
            stageFocused = true
        }
    }

    // MARK: Chrome

    private var hintChip: some View {
        HStack(spacing: 22) {
            Text(pins.isEmpty ? "Brak ofert z lokalizacją" : FilterFormat.offers(pins.count))
                .font(.system(size: 22, weight: .semibold))
            if !pins.isEmpty {
                Rectangle().fill(Color.white.opacity(0.25)).frame(width: 1, height: 24)
                hint("dpad", "pinezki")
                hint("hand.tap", "wybierz")
                hint("playpause", app.isHomeFilteringActive ? "filtry ●" : "filtry")
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 26)
        .padding(.vertical, 14)
        .eosGlassPanel(Capsule())
    }

    private func hint(_ icon: String, _ text: String) -> some View {
        Label(text, systemImage: icon)
            .font(.system(size: 19, weight: .medium))
            .foregroundStyle(.white.opacity(0.72))
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(app.isHomeFilteringActive ? "Żadna z wybranych ofert nie ma lokalizacji" : "Oferty nie mają jeszcze lokalizacji")
                .font(.system(size: 40, weight: .bold))
            Text("Pinezki pojawią się, gdy właściciel oznaczy adres na mapie w EstateOS.")
                .font(.system(size: 24))
                .foregroundStyle(.white.opacity(0.7))
            if app.isHomeFilteringActive {
                Button("Zmień filtry", action: onOpenFilters)
                    .eosButton()
                    .padding(.top, 8)
            }
        }
        .foregroundStyle(.white)
        .padding(48)
        .eosGlassPanel(cornerRadius: 40)
        .padding(80)
    }

    private func accessibilityText(_ cluster: MapCluster) -> String {
        if cluster.count == 1 {
            let o = cluster.members[0].offer
            return "\(o.title), \(EOSFormat.pricePLN(o.price)), \(o.displayLocation)"
        }
        return "\(FilterFormat.offers(cluster.count)) w tej okolicy"
    }
}

// MARK: - Model

struct OfferMapPin: Identifiable {
    let id: Int
    let offer: EstateOffer
    let coordinate: CLLocationCoordinate2D
    let exact: Bool
    let label: String
    let isRent: Bool
    let price: Double
}

struct MapCluster: Identifiable {
    let id: String
    let members: [OfferMapPin]
    let coordinate: CLLocationCoordinate2D

    var count: Int { members.count }

    var bounds: MKCoordinateRegion { Self.bounds(of: members) }

    var priceRange: (min: Double, max: Double)? {
        let prices = members.map(\.price).filter { $0 > 0 }
        guard let lo = prices.min(), let hi = prices.max() else { return nil }
        return (lo, hi)
    }

    static func bounds(of pins: [OfferMapPin]) -> MKCoordinateRegion {
        let lats = pins.map(\.coordinate.latitude), lngs = pins.map(\.coordinate.longitude)
        let minLat = lats.min() ?? 0, maxLat = lats.max() ?? 0
        let minLng = lngs.min() ?? 0, maxLng = lngs.max() ?? 0
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2),
            span: MKCoordinateSpan(latitudeDelta: maxLat - minLat, longitudeDelta: maxLng - minLng)
        )
    }

    /// Greedy screen-space clustering. Seeds are taken in a fixed order (offer id), so the same
    /// zoom always gives the same clusters, whatever the camera position.
    static func build(_ pins: [OfferMapPin], pointsPerLng: Double, pointsPerLat: Double, radius: CGFloat) -> [MapCluster] {
        struct Seed { var x: Double; var y: Double; var members: [OfferMapPin] }
        var seeds: [Seed] = []
        let r2 = Double(radius * radius)
        for pin in pins.sorted(by: { $0.id < $1.id }) {
            let x = pin.coordinate.longitude * pointsPerLng
            let y = -pin.coordinate.latitude * pointsPerLat
            if let i = seeds.firstIndex(where: { ($0.x - x) * ($0.x - x) + ($0.y - y) * ($0.y - y) < r2 }) {
                seeds[i].members.append(pin)
            } else {
                seeds.append(Seed(x: x, y: y, members: [pin]))
            }
        }
        return seeds.map { seed in
            let n = Double(seed.members.count)
            let lat = seed.members.reduce(0) { $0 + $1.coordinate.latitude } / n
            let lng = seed.members.reduce(0) { $0 + $1.coordinate.longitude } / n
            let id = seed.members.count == 1 ? "p\(seed.members[0].id)" : "c\(seed.members[0].id)-\(seed.members.count)"
            return MapCluster(id: id, members: seed.members, coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng))
        }
    }
}

// MARK: - Markers

private let mapGreen = Color(red: 0.25, green: 0.78, blue: 0.52)

/// Price capsule for one offer, a counted disc for a cluster. Selected: white, larger, lifted.
private struct MapMarkerView: View {
    let cluster: MapCluster
    let selected: Bool

    var body: some View {
        Group {
            if cluster.count == 1 { pricePin(cluster.members[0]) } else { clusterDisc }
        }
        .scaleEffect(selected ? 1.15 : 1, anchor: cluster.count == 1 ? .bottom : .center)
        .animation(.spring(response: 0.35, dampingFraction: 0.75), value: selected)
    }

    private func pricePin(_ pin: OfferMapPin) -> some View {
        let tint = pin.isRent ? ShowroomCategory.rent : mapGreen
        return VStack(spacing: 0) {
            HStack(spacing: 7) {
                Circle().fill(tint).frame(width: 9, height: 9)
                Text(pin.label)
                    .font(.system(size: selected ? 21 : 17, weight: .bold).monospacedDigit())
                    .foregroundStyle(selected ? Color.black : .white)
                    .fixedSize()
            }
            .padding(.horizontal, selected ? 16 : 11)
            .padding(.vertical, selected ? 10 : 6)
            .background(Capsule().fill(selected ? Color.white : Color(white: 0.11).opacity(0.92)))
            .overlay(Capsule().strokeBorder(Color.white.opacity(selected ? 0 : 0.22), lineWidth: 1))
            .shadow(color: .black.opacity(selected ? 0.6 : 0.35), radius: selected ? 16 : 5, y: selected ? 8 : 3)
            PinStem()
                .fill(selected ? Color.white : Color(white: 0.11).opacity(0.92))
                .frame(width: selected ? 14 : 10, height: selected ? 8 : 6)
        }
    }

    private var clusterDisc: some View {
        let size = min(96, 46 + log2(Double(cluster.count)) * 9)
        return ZStack {
            Circle()
                .fill(selected ? Color.white : Color(white: 0.11).opacity(0.92))
            Circle()
                .strokeBorder(mapGreen.opacity(selected ? 1 : 0.85), lineWidth: selected ? 4 : 3)
            Text("\(cluster.count)")
                .font(.system(size: size * 0.36, weight: .bold).monospacedDigit())
                .foregroundStyle(selected ? Color.black : .white)
        }
        .frame(width: size, height: size)
        .shadow(color: .black.opacity(selected ? 0.6 : 0.35), radius: selected ? 18 : 6, y: selected ? 8 : 3)
    }
}

private struct PinStem: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

private struct MapStageStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.contentShape(Rectangle())
    }
}

// MARK: - Info panel

/// What the selected pin is: photo, title, price — or, for a cluster, a mosaic and the price range.
private struct MapInfoPanel: View {
    let cluster: MapCluster
    let canZoom: Bool

    var body: some View {
        HStack(alignment: .center, spacing: 32) {
            artwork
            VStack(alignment: .leading, spacing: 8) {
                if cluster.count == 1 { single(cluster.members[0]) } else { group }
            }
            Spacer(minLength: 0)
            Label(actionText, systemImage: cluster.count == 1 ? "arrow.up.forward" : (canZoom ? "plus.magnifyingglass" : "list.bullet"))
                .font(.system(size: 21, weight: .semibold))
                .foregroundStyle(.white.opacity(0.85))
                .padding(.horizontal, 22)
                .padding(.vertical, 12)
                .background(Capsule().fill(Color.white.opacity(0.12)))
        }
        .foregroundStyle(.white)
        .padding(22)
        .frame(maxWidth: 1500)
        .eosGlassPanel(cornerRadius: 36)
        .padding(.horizontal, 80)
        .padding(.bottom, 50)
        .id(cluster.id)
    }

    private var actionText: String {
        if cluster.count == 1 { return "Otwórz ofertę" }
        return canZoom ? "Przybliż" : "Pokaż oferty"
    }

    @ViewBuilder
    private var artwork: some View {
        let urls = cluster.members.prefix(3).compactMap { EOSOfferMedia.primaryImageURL(for: $0.offer) }
        ZStack {
            ForEach(Array(urls.enumerated().reversed()), id: \.offset) { index, url in
                EOSCachedRemoteImage(url: url, contentMode: .fill, size: .card) {
                    Color.white.opacity(0.08)
                }
                .frame(width: 256, height: 144)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .shadow(color: .black.opacity(0.4), radius: 10, y: 5)
                .rotationEffect(.degrees(Double(index) * 4))
                .offset(x: CGFloat(index) * 12, y: CGFloat(index) * -6)
            }
            if urls.isEmpty {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 256, height: 144)
                    .overlay(Image(systemName: "photo").font(.system(size: 34)).opacity(0.4))
            }
        }
        .frame(width: 290, height: 160)
    }

    @ViewBuilder
    private func single(_ pin: OfferMapPin) -> some View {
        let offer = pin.offer
        Text([offer.transactionLabel, offer.displayPropertyType].compactMap { $0 }.joined(separator: " · ").uppercased())
            .font(.system(size: 16, weight: .bold))
            .tracking(1.8)
            .foregroundStyle(.white.opacity(0.65))
        Text(offer.title)
            .font(.system(size: 34, weight: .bold))
            .lineLimit(1)
        HStack(spacing: 18) {
            Text(EOSFormat.pricePLN(offer.price))
                .font(.system(size: 28, weight: .semibold))
            Text([
                offer.area.map { "\(Int($0)) m²" },
                offer.rooms.map { String(format: "%.0f pok.", $0) },
                offer.displayLocation,
            ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.system(size: 21, weight: .medium))
                .foregroundStyle(.white.opacity(0.7))
                .lineLimit(1)
        }
        if !pin.exact {
            Label("Przybliżona lokalizacja", systemImage: "circle.dashed")
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(.white.opacity(0.55))
        }
    }

    @ViewBuilder
    private var group: some View {
        let places = Array(Set(cluster.members.compactMap { $0.offer.displayDistrict ?? $0.offer.city })).sorted()
        Text("W TEJ OKOLICY")
            .font(.system(size: 16, weight: .bold))
            .tracking(1.8)
            .foregroundStyle(.white.opacity(0.65))
        Text(FilterFormat.offers(cluster.count))
            .font(.system(size: 34, weight: .bold))
        if let range = cluster.priceRange {
            Text(range.min == range.max
                 ? "\(FilterFormat.money(range.min)) zł"
                 : "od \(FilterFormat.money(range.min)) do \(FilterFormat.money(range.max)) zł")
                .font(.system(size: 26, weight: .semibold))
        }
        if !places.isEmpty {
            Text(places.prefix(4).joined(separator: " · ") + (places.count > 4 ? " i inne" : ""))
                .font(.system(size: 21, weight: .medium))
                .foregroundStyle(.white.opacity(0.7))
                .lineLimit(1)
        }
    }
}

// MARK: - Offers in one building

private struct MapClusterList: View {
    let cluster: MapCluster
    var focus: FocusState<Int?>.Binding
    let onOpen: (EstateOffer) -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline, spacing: 18) {
                Text("W tym miejscu")
                    .font(.system(size: 34, weight: .bold))
                Text(FilterFormat.offers(cluster.count))
                    .font(.system(size: 24, weight: .medium))
                    .foregroundStyle(.white.opacity(0.65))
                Spacer()
                Label("MENU — wróć do mapy", systemImage: "chevron.backward")
                    .font(.system(size: 19, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 80)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 40) {
                    ForEach(cluster.members) { pin in
                        EOSPosterCard(
                            imageURL: EOSOfferMedia.primaryImageURL(for: pin.offer),
                            title: pin.offer.title,
                            subtitle: ShowroomItem(offer: pin.offer).cardSubtitle,
                            width: 360,
                            action: { onOpen(pin.offer) }
                        )
                        .focused(focus, equals: pin.id)
                    }
                }
                .padding(.horizontal, 80)
                .padding(.vertical, 24)
            }
            .scrollClipDisabled()
        }
        .padding(.vertical, 30)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(colors: [.clear, .black.opacity(0.85)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        )
        .focusSection()
        .onExitCommand(perform: onClose)
    }
}

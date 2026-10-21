import SwiftUI
import MapKit

// MARK: - Mapa ofert (2026-10)
//
// Full-screen dark map with a price pin for every offer in the current browse set (filters
// apply). The remote never "drives" the map: it moves along the rail of offer cards at the
// bottom, and when focus rests on a card the camera glides to that offer and its pin lights up.
// Offers published with an approximate location show a soft circle instead of an exact point.

struct OfferMapView: View {
    @EnvironmentObject private var app: AppModel
    var onOpenFilters: () -> Void

    @State private var position: MapCameraPosition = .automatic
    @State private var selectedId: Int?
    @State private var glide: Task<Void, Never>?
    @State private var pins: [MapPin] = []
    @State private var built = false
    @FocusState private var focusedCard: Int?

    /// Above this many pins the map turns into noise on a TV; the rail still lists them all.
    private static let pinLimit = 400

    struct MapPin: Identifiable {
        let id: Int
        let offer: EstateOffer
        let coordinate: CLLocationCoordinate2D
        let exact: Bool
        let label: String
        let isRent: Bool
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            map
                .ignoresSafeArea()

            // Legibility for the rail and the header capsule.
            LinearGradient(colors: [.black.opacity(0.55), .clear], startPoint: .top, endPoint: .center)
                .frame(height: 260)
                .frame(maxHeight: .infinity, alignment: .top)
                .ignoresSafeArea()
                .allowsHitTesting(false)
            LinearGradient(colors: [.clear, .black.opacity(0.85)], startPoint: .top, endPoint: .bottom)
                .frame(height: 520)
                .ignoresSafeArea()
                .allowsHitTesting(false)

            if pins.isEmpty {
                if built { emptyState }
            } else {
                VStack(alignment: .leading, spacing: 26) {
                    if let pin = selectedPin { SelectedOfferPanel(pin: pin) }
                    rail
                }
            }
        }
        .overlay(alignment: .topTrailing) { summaryChip.padding(.top, 8) }
        .task(id: app.homeFilterSummary + "|\(app.offers.count)") { rebuildPins() }
        .onDisappear { glide?.cancel() }
        // "Na mapie" from a detail opened on this map: jump to that card.
        .onChange(of: app.mapFocusOfferId) { _, target in
            guard let target, let pin = pins.first(where: { $0.id == target }) else { return }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 400_000_000)
                focusedCard = pin.id
                focus(pin)
                app.mapFocusOfferId = nil
            }
        }
    }

    // MARK: Map

    private var map: some View {
        Map(position: $position, interactionModes: []) {
            ForEach(pins) { pin in
                if !pin.exact {
                    MapCircle(center: pin.coordinate, radius: 450)
                        .foregroundStyle((pin.id == selectedId ? Color.white : tint(pin)).opacity(0.16))
                        .stroke((pin.id == selectedId ? Color.white : tint(pin)).opacity(0.5), lineWidth: 2)
                }
                Annotation("", coordinate: pin.coordinate, anchor: .bottom) {
                    PricePin(label: pin.label, tint: tint(pin), selected: pin.id == selectedId, exact: pin.exact)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll, showsTraffic: false))
        .mapControlVisibility(.hidden)
        .environment(\.colorScheme, .dark)
        .focusable(false)
    }

    private func tint(_ pin: MapPin) -> Color {
        pin.isRent ? ShowroomCategory.rent : Color(red: 0.25, green: 0.78, blue: 0.52)
    }

    private var selectedPin: MapPin? {
        guard let selectedId else { return nil }
        return pins.first { $0.id == selectedId }
    }

    // MARK: Rail

    private var rail: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 40) {
                    Button(action: onOpenFilters) {
                        VStack(spacing: 14) {
                            Image(systemName: "line.3.horizontal.decrease")
                                .font(.system(size: 40, weight: .medium))
                            Text(app.isHomeFilteringActive ? "Zmień filtry" : "Filtry")
                                .font(.system(size: 24, weight: .semibold))
                        }
                        .frame(width: 200, height: 180)
                    }
                    .buttonStyle(.card)

                    ForEach(pins) { pin in
                        EOSPosterCard(
                            imageURL: EOSOfferMedia.primaryImageURL(for: pin.offer),
                            title: pin.offer.title,
                            subtitle: ShowroomItem(offer: pin.offer).cardSubtitle,
                            width: 320,
                            onFocus: { focus(pin) },
                            action: { app.openDetail(pin.offer) }
                        )
                        .focused($focusedCard, equals: pin.id)
                        .id(pin.id)
                    }
                }
                .padding(.horizontal, 80)
                .padding(.vertical, 30)
            }
            .scrollClipDisabled()
            .frame(height: 300)
            .focusSection()
            .defaultFocus($focusedCard, app.mapFocusOfferId ?? pins.first?.id)
            .onAppear {
                guard let target = app.mapFocusOfferId, pins.contains(where: { $0.id == target }) else { return }
                proxy.scrollTo(target, anchor: .center)
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 150_000_000)
                    focusedCard = target
                    app.mapFocusOfferId = nil
                }
            }
        }
        .padding(.bottom, 40)
    }

    /// The camera moves only after focus rests (≈0.3 s) — flying along the rail stays smooth.
    private func focus(_ pin: MapPin) {
        glide?.cancel()
        glide = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) { selectedId = pin.id }
            withAnimation(.easeInOut(duration: 1.1)) {
                position = .camera(MapCamera(
                    centerCoordinate: pin.coordinate,
                    distance: pin.exact ? 2600 : 4200,
                    heading: 0,
                    pitch: 52
                ))
            }
        }
    }

    // MARK: Chrome

    private var summaryChip: some View {
        HStack(spacing: 14) {
            Image(systemName: "map")
            Text(pins.isEmpty ? "Brak ofert z lokalizacją" : FilterFormat.offers(pins.count) + " na mapie")
            if app.isHomeFilteringActive {
                Text("·").opacity(0.5)
                Text(app.homeFilterSummary).lineLimit(1).frame(maxWidth: 520)
            }
        }
        .font(.system(size: 22, weight: .semibold))
        .foregroundStyle(.white)
        .padding(.horizontal, 26)
        .padding(.vertical, 14)
        .eosGlassPanel(Capsule())
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

    // MARK: Data

    private func rebuildPins() {
        let result = app.mappableOffers.prefix(Self.pinLimit).compactMap { offer -> MapPin? in
            guard let c = offer.extras.coordinate else { return nil }
            let isRent = (offer.transactionType ?? "").uppercased().contains("RENT")
            let label: String
            if let price = offer.price, price > 0 {
                label = FilterFormat.money(price) + (isRent ? " zł/mc" : " zł")
            } else {
                label = "Zapytaj"
            }
            return MapPin(
                id: offer.id, offer: offer,
                coordinate: CLLocationCoordinate2D(latitude: c.lat, longitude: c.lng),
                exact: offer.extras.isExactLocation, label: label, isRent: isRent
            )
        }
        pins = Array(result)
        built = true
        if let target = app.mapFocusOfferId, let pin = pins.first(where: { $0.id == target }) {
            selectedId = pin.id
            position = .camera(MapCamera(centerCoordinate: pin.coordinate, distance: pin.exact ? 2600 : 4200, heading: 0, pitch: 52))
        } else if selectedId == nil || !pins.contains(where: { $0.id == selectedId }) {
            selectedId = nil
            position = .automatic
        }
    }
}

// MARK: - Pin

/// Glass price capsule with a small stem. Selected: white, larger, lifted, with a soft shadow.
private struct PricePin: View {
    let label: String
    let tint: Color
    let selected: Bool
    let exact: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Circle()
                    .fill(selected ? tint : tint.opacity(0.95))
                    .frame(width: 10, height: 10)
                Text(label)
                    .font(.system(size: selected ? 22 : 17, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(selected ? Color.black : .white)
                    .fixedSize()
            }
            .padding(.horizontal, selected ? 18 : 12)
            .padding(.vertical, selected ? 11 : 7)
            .background(
                Capsule().fill(selected ? AnyShapeStyle(Color.white) : AnyShapeStyle(.ultraThinMaterial))
            )
            .overlay(Capsule().strokeBorder(Color.white.opacity(selected ? 0 : 0.28), lineWidth: 1))
            .shadow(color: .black.opacity(selected ? 0.55 : 0.35), radius: selected ? 18 : 8, y: selected ? 10 : 4)

            Triangle()
                .fill(selected ? Color.white : Color.white.opacity(0.55))
                .frame(width: selected ? 16 : 10, height: selected ? 9 : 6)
                .opacity(exact ? 1 : 0)
        }
        .scaleEffect(selected ? 1.12 : 1, anchor: .bottom)
        .zIndex(selected ? 10 : 0)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: selected)
    }
}

private struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

// MARK: - Selected offer panel

private struct SelectedOfferPanel: View {
    let pin: OfferMapView.MapPin

    var body: some View {
        let offer = pin.offer
        VStack(alignment: .leading, spacing: 8) {
            Text([offer.transactionLabel, offer.displayPropertyType].compactMap { $0 }.joined(separator: " · ").uppercased())
                .font(.system(size: 17, weight: .bold))
                .tracking(2)
                .foregroundStyle(.white.opacity(0.7))
            Text(offer.title)
                .font(.system(size: 40, weight: .bold))
                .lineLimit(1)
            HStack(spacing: 18) {
                Text(EOSFormat.pricePLN(offer.price))
                    .font(.system(size: 30, weight: .semibold))
                Text([
                    offer.area.map { "\(Int($0)) m²" },
                    offer.rooms.map { String(format: "%.0f pok.", $0) },
                    [offer.extras.street, offer.displayLocation].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", "),
                ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(1)
            }
            if !pin.exact {
                Label("Przybliżona lokalizacja", systemImage: "circle.dashed")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
            }
        }
        .foregroundStyle(.white)
        .frame(maxWidth: 1200, alignment: .leading)
        .padding(.horizontal, 80)
        .shadow(color: .black.opacity(0.4), radius: 16, y: 4)
        .id(pin.id)
        .transition(.opacity.combined(with: .offset(y: 8)))
        .animation(.easeOut(duration: 0.3), value: pin.id)
    }
}

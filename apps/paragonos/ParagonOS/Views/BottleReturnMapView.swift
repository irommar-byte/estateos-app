import CoreLocation
import MapKit
import SwiftUI
import UIKit

struct BottleReturnMapView: View {
    private static let warsaw = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 52.2297, longitude: 21.0122),
        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
    )

    @StateObject private var location = LocationProvider()
    @State private var position: MapCameraPosition = .userLocation(
        followsHeading: false,
        fallback: .region(Self.warsaw)
    )
    @State private var points: [BottleReturnPoint] = []
    @State private var selected: BottleReturnPoint?
    @State private var brandID: String?
    @State private var query = ""
    @State private var visibleRegion: MKRegionBox?
    @State private var isLoading = false
    @State private var didCenterOnUser = false

    private var markers: [BottleMapMarker] {
        let box = visibleRegion ?? MKRegionBox(
            center: location.location?.coordinate ?? Self.warsaw.center,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08
        )
        return BottleMapLayout.markers(from: filtered, in: box)
    }

    var body: some View {
        Map(position: $position, selection: $selected) {
            UserAnnotation()
            ForEach(markers) { marker in
                switch marker {
                case .pin(let point):
                    Annotation(point.brand, coordinate: point.coordinate, anchor: .bottom) {
                        BottleMapPin(
                            brandID: point.brandID,
                            selected: selected?.id == point.id
                        )
                        .onTapGesture {
                            withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) {
                                selected = point
                            }
                        }
                    }
                    .tag(point)
                case .cluster(_, let lat, let lon, let count, let brandID):
                    Annotation("\(count)", coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon)) {
                        BottleClusterPin(count: count, brandID: brandID)
                            .onTapGesture {
                                zoomInto(latitude: lat, longitude: lon)
                            }
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
        .mapControls {
            MapCompass()
            MapPitchToggle()
            MapUserLocationButton()
        }
        .overlay(alignment: .center) {
            if isLoading && points.isEmpty {
                ProgressView("Ładuję punkty…")
                    .padding(14)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
        .overlay(alignment: .topTrailing) {
            locateButton
                .padding(.top, 10)
                .padding(.trailing, 12)
        }
        .ignoresSafeArea(edges: .bottom)
        .safeAreaInset(edge: .top, spacing: 0) {
            filterBar
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let selected {
                BottleReturnCard(point: selected, userLocation: location.location)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            } else {
                showAllNearbyButton
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
                    .padding(.top, 4)
                    .frame(maxWidth: .infinity)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .background(ParagonTheme.canvas)
        .navigationTitle("Butelkomaty")
        .navigationBarTitleDisplayMode(.inline)
        .animation(.easeInOut(duration: 0.22), value: selected?.id)
        .onMapCameraChange(frequency: .onEnd) { context in
            visibleRegion = MKRegionBox(
                center: context.region.center,
                latitudeDelta: context.region.span.latitudeDelta,
                longitudeDelta: context.region.span.longitudeDelta
            )
        }
        .task {
            location.request()
            // Seed viewport without animating the camera (avoids Warsaw → user jump).
            if let coordinate = location.location?.coordinate {
                visibleRegion = MKRegionBox(
                    center: coordinate,
                    latitudeDelta: 0.06,
                    longitudeDelta: 0.06
                )
                didCenterOnUser = true
            } else {
                visibleRegion = MKRegionBox(
                    center: Self.warsaw.center,
                    latitudeDelta: Self.warsaw.span.latitudeDelta,
                    longitudeDelta: Self.warsaw.span.longitudeDelta
                )
            }
        }
        .onChange(of: location.location?.timestamp) { _, _ in
            // One gentle first center only — never chase GPS updates.
            guard didCenterOnUser == false, let coordinate = location.location?.coordinate else { return }
            didCenterOnUser = true
            visibleRegion = MKRegionBox(
                center: coordinate,
                latitudeDelta: 0.055,
                longitudeDelta: 0.055
            )
            withAnimation(.easeInOut(duration: 0.55)) {
                position = .region(
                    MKCoordinateRegion(
                        center: coordinate,
                        span: MKCoordinateSpan(latitudeDelta: 0.055, longitudeDelta: 0.055)
                    )
                )
            }
        }
        .onChange(of: location.authorization) { _, status in
            if status == .authorizedWhenInUse || status == .authorizedAlways {
                location.request()
            }
        }
        .task(id: reloadToken) {
            try? await Task.sleep(nanoseconds: 220_000_000)
            guard Task.isCancelled == false else { return }
            await reload()
        }
    }

    private var filtered: [BottleReturnPoint] {
        let needle = query.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pl_PL"))
        return points.filter { point in
            if let brandID, point.brandID != brandID { return false }
            if needle.isEmpty { return true }
            let haystack = "\(point.brand) \(point.address) \(point.city)"
                .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pl_PL"))
            return haystack.contains(needle)
        }
    }

    private var reloadToken: String {
        "\(visibleRegion?.cellKey ?? "start")-\(brandID ?? "all")"
    }

    private var locateButton: some View {
        Button {
            location.locateOrOpenSettings()
            if let coordinate = location.location?.coordinate {
                didCenterOnUser = true
                withAnimation(.easeInOut(duration: 0.45)) {
                    center(on: coordinate)
                }
            }
        } label: {
            Image(systemName: "location.fill")
                .font(.body.weight(.semibold))
                .foregroundStyle(location.isAuthorized ? ParagonTheme.osGreen : .primary)
                .frame(width: 44, height: 44)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(ParagonPressStyle())
        .accessibilityLabel(location.needsSettings ? "Włącz lokalizację w Ustawieniach" : "Zlokalizuj mnie")
    }

    private var showAllNearbyButton: some View {
        Button {
            showAllNearby()
        } label: {
            Label("Pokaż wszystkie w okolicy", systemImage: "map.fill")
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .foregroundStyle(.primary)
                .background(.regularMaterial, in: Capsule())
                .shadow(color: .black.opacity(0.18), radius: 16, y: 6)
        }
        .buttonStyle(ParagonPressStyle())
        .disabled(points.isEmpty && location.location == nil)
        .accessibilityLabel("Pokaż wszystkie w okolicy")
    }

    private func showAllNearby() {
        selected = nil
        brandID = nil
        query = ""
        var coords = points.map(\.coordinate)
        if let user = location.location?.coordinate {
            coords.append(user)
        }
        guard let overview = BottleMapOverview.camera(fitting: coords) else { return }
        visibleRegion = MKRegionBox(
            center: CLLocationCoordinate2D(latitude: overview.latitude, longitude: overview.longitude),
            latitudeDelta: max(0.018, overview.distance / 140_000),
            longitudeDelta: max(0.018, overview.distance / 140_000)
        )
        fly(to: overview)
    }

    private func fly(to overview: BottleMapOverview.Camera) {
        let center = CLLocationCoordinate2D(latitude: overview.latitude, longitude: overview.longitude)
        let land = MapCamera(
            centerCoordinate: center,
            distance: overview.distance,
            heading: overview.heading,
            pitch: overview.pitch
        )
        if UIAccessibility.isReduceMotionEnabled {
            position = .camera(land)
            return
        }
        let lift = MapCamera(
            centerCoordinate: center,
            distance: overview.distance * 1.72,
            heading: 0,
            pitch: 8
        )
        withAnimation(.easeInOut(duration: 0.55)) {
            position = .camera(lift)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.52) {
            withAnimation(.spring(response: 0.95, dampingFraction: 0.84)) {
                position = .camera(land)
            }
        }
    }

    private func center(on coordinate: CLLocationCoordinate2D) {
        position = .region(
            MKCoordinateRegion(
                center: coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.055, longitudeDelta: 0.055)
            )
        )
    }

    private func zoomInto(latitude: Double, longitude: Double) {
        let current = visibleRegion
        let nextLat = max(0.04, (current?.latitudeDelta ?? 0.4) * 0.38)
        let nextLon = max(0.04, (current?.longitudeDelta ?? 0.4) * 0.38)
        withAnimation(.easeInOut(duration: 0.5)) {
            position = .region(
                MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                    span: MKCoordinateSpan(latitudeDelta: nextLat, longitudeDelta: nextLon)
                )
            )
        }
    }

    private var filterBar: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Adres albo sieć", text: $query)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if query.isEmpty == false {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityLabel("Wyczyść")
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    filterChip(title: "Wszystkie", selected: brandID == nil) { brandID = nil }
                    ForEach(BottleReturnBrand.filters, id: \.id) { item in
                        filterChip(title: item.name, selected: brandID == item.id) {
                            brandID = brandID == item.id ? nil : item.id
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(.ultraThinMaterial)
    }

    private func filterChip(title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .foregroundStyle(selected ? Color.white : .primary)
                .background(selected ? ParagonTheme.osGreen : Color(.tertiarySystemFill), in: Capsule())
        }
        .buttonStyle(ParagonPressStyle())
    }

    private func reload() async {
        let box = visibleRegion ?? MKRegionBox(
            center: location.location?.coordinate ?? Self.warsaw.center,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08
        )
        if points.isEmpty { isLoading = true }
        let local = await BottleReturnStore.shared.localPoints(in: box, brandID: brandID)
        if Task.isCancelled { return }
        if local.isEmpty == false {
            points = local
            isLoading = false
        }
        let extra = await BottleReturnStore.shared.osmSupplement(in: box, brandID: brandID)
        if Task.isCancelled { return }
        let merged = BottleReturnStore.dedupe(local + extra)
        if merged.isEmpty == false || local.isEmpty {
            points = merged
        }
        isLoading = false
        if let selected, points.contains(where: { $0.id == selected.id }) == false {
            self.selected = nil
        }
    }
}

// MARK: - Pins

struct BottleMapPin: View {
    let brandID: String
    var selected: Bool = false
    @State private var appeared = false

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle()
                    .fill(.white)
                    .frame(width: selected ? 46 : 40, height: selected ? 46 : 40)
                    .shadow(color: .black.opacity(0.22), radius: selected ? 10 : 6, y: 3)
                Circle()
                    .strokeBorder(RetailerBrand.color(for: brandID).opacity(0.9), lineWidth: selected ? 2.5 : 1.6)
                    .frame(width: selected ? 46 : 40, height: selected ? 46 : 40)
                RetailerLogo(retailerID: brandID, size: selected ? 28 : 24)
            }
            .scaleEffect(appeared ? 1 : 0.72)
            .opacity(appeared ? 1 : 0)

            Capsule()
                .fill(RetailerBrand.color(for: brandID))
                .frame(width: 3, height: selected ? 10 : 7)
                .padding(.top, 1)
        }
        .onAppear {
            guard UIAccessibility.isReduceMotionEnabled == false else {
                appeared = true
                return
            }
            withAnimation(.spring(response: 0.42, dampingFraction: 0.72)) {
                appeared = true
            }
        }
        .accessibilityLabel("Butelkomat")
    }
}

struct BottleClusterPin: View {
    let count: Int
    var brandID: String?

    private var tint: Color {
        if let brandID { return RetailerBrand.color(for: brandID) }
        return ParagonTheme.osGreen
    }

    var body: some View {
        Text("\(count)")
            .font(.caption.weight(.bold).monospacedDigit())
            .foregroundStyle(.white)
            .frame(width: count > 99 ? 44 : 36, height: count > 99 ? 44 : 36)
            .background(
                Circle()
                    .fill(tint.gradient)
                    .shadow(color: .black.opacity(0.24), radius: 8, y: 3)
            )
            .overlay {
                Circle()
                    .strokeBorder(.white.opacity(0.92), lineWidth: 2)
            }
            .accessibilityLabel("Grupa \(count) punktów")
    }
}

private struct BottleReturnCard: View {
    let point: BottleReturnPoint
    var userLocation: CLLocation?

    private var hours: (isOpen: Bool?, label: String) {
        OpeningHours.display(from: point.hoursRaw)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                RetailerLogo(retailerID: point.brandID, size: 40)
                VStack(alignment: .leading, spacing: 3) {
                    Text(point.brand)
                        .font(.title3.weight(.bold))
                    Text(point.subtitle.isEmpty ? "Punkt zwrotu kaucji" : point.subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                if let distance {
                    Text(distance)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }

            if hours.label.isEmpty == false {
                Label(hours.label, systemImage: "clock")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(hours.isOpen == true ? Color(red: 0.22, green: 0.68, blue: 0.36) : .secondary)
            } else if point.hoursRaw.isEmpty == false {
                Label(OpeningHours.pretty(point.hoursRaw), systemImage: "clock")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            if point.materials.isEmpty == false {
                HStack(spacing: 6) {
                    ForEach(point.materials, id: \.self) { item in
                        Text(item)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color(.tertiarySystemFill), in: Capsule())
                    }
                    if point.kind == .machine {
                        Text("Automat")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(ParagonTheme.osGreen.opacity(0.18), in: Capsule())
                    }
                }
            }

            Button {
                openInMaps()
            } label: {
                Label("Wskazówki", systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Text("Dane punktów: MapaKaucji.pl i OpenStreetMap. Godziny mogą się różnić na miejscu.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: ParagonTheme.passCorner, style: .continuous))
        .overlay {
            ParagonTheme.passHairline(
                RoundedRectangle(cornerRadius: ParagonTheme.passCorner, style: .continuous)
            )
        }
        .shadow(color: .black.opacity(0.12), radius: 18, y: 8)
    }

    private var distance: String? {
        guard let userLocation else { return nil }
        return DistanceFormat.string(userLocation.distance(from: point.location))
    }

    private func openInMaps() {
        let destination = MKMapItem(placemark: MKPlacemark(coordinate: point.coordinate))
        destination.name = "\(point.brand) · butelkomat"
        destination.openInMaps(launchOptions: [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
        ])
    }
}

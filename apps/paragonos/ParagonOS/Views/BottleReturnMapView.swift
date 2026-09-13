import CoreLocation
import MapKit
import SwiftUI

struct BottleReturnMapView: View {
    @StateObject private var location = LocationProvider()
    @State private var position: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 52.2297, longitude: 21.0122),
            span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
        )
    )
    @State private var points: [BottleReturnPoint] = []
    @State private var selected: BottleReturnPoint?
    @State private var brandID: String?
    @State private var query = ""
    @State private var visibleRegion: MKRegionBox?

    var body: some View {
        Map(position: $position, selection: $selected) {
            UserAnnotation()
            ForEach(filtered) { point in
                Marker(point.brand, coordinate: point.coordinate)
                    .tint(RetailerBrand.color(for: point.brandID))
                    .tag(point)
            }
        }
        .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
        .mapControls {
            MapCompass()
            MapPitchToggle()
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
            }
        }
        .background(Color(.systemBackground))
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
        }
        .onChange(of: location.location?.timestamp) { _, _ in
            guard let coordinate = location.location?.coordinate, selected == nil else { return }
            center(on: coordinate)
        }
        .onChange(of: location.authorization) { _, status in
            if status == .authorizedWhenInUse || status == .authorizedAlways {
                location.request()
            }
        }
        .task(id: reloadToken) {
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
                center(on: coordinate)
            }
        } label: {
            Image(systemName: "location.fill")
                .font(.body.weight(.semibold))
                .foregroundStyle(location.isAuthorized ? ParagonTheme.osGreen : .primary)
                .frame(width: 44, height: 44)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .accessibilityLabel(location.needsSettings ? "Włącz lokalizację w Ustawieniach" : "Zlokalizuj mnie")
    }

    private func center(on coordinate: CLLocationCoordinate2D) {
        position = .region(
            MKCoordinateRegion(
                center: coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.06, longitudeDelta: 0.06)
            )
        )
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
        .buttonStyle(.plain)
    }

    private func reload() async {
        let box = visibleRegion ?? MKRegionBox(
            center: location.location?.coordinate ?? CLLocationCoordinate2D(latitude: 52.2297, longitude: 21.0122),
            latitudeDelta: 0.12,
            longitudeDelta: 0.12
        )
        let loaded = await BottleReturnStore.shared.points(in: box, brandID: brandID)
        points = loaded
        if let selected, loaded.contains(where: { $0.id == selected.id }) == false {
            self.selected = nil
        }
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
                        .font(.headline)
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

            Text("Dane punktów: MapaKaucji.pl i OpenStreetMap. Godziny mogą się różnić na miejscu.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
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

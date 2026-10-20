import MapKit
import SwiftUI

struct PhotoInfoSheet: View {
    let photo: PhotoRef
    var place: String?
    var names: [String] = []
    var onMap: () -> Void = {}

    var body: some View {
        NavigationStack {
            List {
                if let latitude = photo.latitude, let longitude = photo.longitude {
                    Section {
                        Map(initialPosition: .region(MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                            span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
                        ))) {
                            Marker(place ?? "Zdjęcie", coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude))
                        }
                        .frame(height: 220)
                        .listRowInsets(EdgeInsets())
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(alignment: .bottomTrailing) {
                            Button(action: onMap) {
                                Image(systemName: "arrow.up.left.and.arrow.down.right")
                                    .font(.caption.weight(.bold))
                                    .padding(8)
                                    .background(.ultraThinMaterial, in: Circle())
                            }
                            .padding(10)
                            .accessibilityLabel("Otwórz mapę")
                        }
                        .onTapGesture(perform: onMap)
                    }
                }
                Section {
                    row("Data", dateText)
                    row("Godzina", timeText)
                    if let place, !place.isEmpty { row("Miejsce", place) }
                    if !names.isEmpty { row("Osoby", names.joined(separator: ", ")) }
                    row("Wymiary", "\(photo.pixelWidth) × \(photo.pixelHeight)")
                    row("Rodzaj", kindText)
                    if photo.traits.isVideo {
                        row("Czas", PhotoFormat.duration(photo.duration))
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var title: String {
        if let place, !place.isEmpty { return place }
        return "Informacje"
    }

    private var dateText: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.setLocalizedDateFormatFromTemplate("d MMMM yyyy")
        return formatter.string(from: photo.created)
    }

    private var timeText: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.timeStyle = .short
        return formatter.string(from: photo.created)
    }

    private var kindText: String {
        if photo.traits.isVideo { return "Wideo" }
        if photo.traits.contains(.live) { return "Live Photo" }
        if photo.traits.contains(.raw) { return "RAW" }
        if photo.traits.contains(.portrait) { return "Portret" }
        if photo.traits.contains(.panorama) { return "Panorama" }
        if photo.traits.contains(.screenshot) { return "Zrzut ekranu" }
        return "Zdjęcie"
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
    }
}

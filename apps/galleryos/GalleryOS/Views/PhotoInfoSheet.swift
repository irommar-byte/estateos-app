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
                            Marker(place ?? L("Zdjęcie"), coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude))
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
                            .accessibilityLabel(L("Otwórz mapę"))
                        }
                        .onTapGesture(perform: onMap)
                    }
                }
                Section {
                    row(L("Data"), dateText)
                    row(L("Godzina"), timeText)
                    if let place, !place.isEmpty { row(L("Miejsce"), place) }
                    if !names.isEmpty { row(L("Osoby"), names.joined(separator: ", ")) }
                    row(L("Wymiary"), "\(photo.pixelWidth) × \(photo.pixelHeight)")
                    row(L("Rodzaj"), kindText)
                    if photo.traits.isVideo {
                        row(L("Czas"), PhotoFormat.duration(photo.duration))
                    }
                }
                serverSection
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    /// Who sent the photo to the server, from which device and exactly when; for a photo still
    /// only on this device, why it is not there yet.
    @ViewBuilder
    private var serverSection: some View {
        let engine = LibraryEngine.shared
        if let asset = engine.serverAsset(photo.id) {
            Section {
                row(L("Wgrane przez"), who(asset.owner, name: asset.ownerName, mine: engine.isMine(asset)))
                row(L("Urządzenie"), asset.device ?? L("nie zapisano"))
                if let uploaded = asset.uploadedAt {
                    row(L("Wgrano"), Self.moment(uploaded))
                }
                if let deleted = asset.deletedAt, !LibraryRules.isPurged(asset) {
                    row(L("Usunięte przez"), who(asset.deletedBy, name: asset.deletedByName, mine: GalleryOwner.isMe(asset.deletedBy)))
                    row(L("Usunięto"), Self.moment(deleted))
                }
            } header: {
                Text(L("Serwer"))
            }
        } else if !photo.id.hasPrefix("cloud:"), let note = engine.stateNote(photo.id) {
            Section {
                Label(note, systemImage: "icloud.slash")
                    .foregroundStyle(.secondary)
            } header: {
                Text(L("Serwer"))
            }
        }
    }

    private func who(_ fingerprint: String?, name: String?, mine: Bool) -> String {
        let cleaned = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if mine {
            return cleaned.isEmpty ? L("Ty (to konto iCloud)") : L("Ty · \(cleaned)")
        }
        if !cleaned.isEmpty { return cleaned }
        if fingerprint?.hasPrefix("device:") == true { return L("Inne urządzenie") }
        return L("Inne konto iCloud")
    }

    /// "22 października 2026, 17:49:12": the date and the exact time.
    private static func moment(_ date: Date) -> String {
        date.formatted(Date.FormatStyle(date: .long, time: .standard).locale(Localization.locale))
    }

    private var title: String {
        if let place, !place.isEmpty { return place }
        return L("Informacje")
    }

    private var dateText: String {
        let formatter = DateFormatter()
        formatter.locale = Localization.locale
        formatter.setLocalizedDateFormatFromTemplate("d MMMM yyyy")
        return formatter.string(from: photo.created)
    }

    private var timeText: String {
        let formatter = DateFormatter()
        formatter.locale = Localization.locale
        formatter.timeStyle = .short
        return formatter.string(from: photo.created)
    }

    private var kindText: String {
        if photo.traits.isVideo { return L("Wideo") }
        if photo.traits.contains(.live) { return L("Live Photo") }
        if photo.traits.contains(.raw) { return "RAW" }
        if photo.traits.contains(.portrait) { return L("Portret") }
        if photo.traits.contains(.panorama) { return L("Panorama") }
        if photo.traits.contains(.screenshot) { return L("Zrzut ekranu") }
        return L("Zdjęcie")
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

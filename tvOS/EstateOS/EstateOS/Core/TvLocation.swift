import Foundation
import CoreLocation
import Combine

@MainActor
final class TvLocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = TvLocationService()

    @Published private(set) var coordinate: CLLocationCoordinate2D?
    @Published private(set) var authorization: CLAuthorizationStatus = .notDetermined
    @Published var statusMessage: String?

    private let manager = CLLocationManager()

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
        authorization = manager.authorizationStatus
    }

    var hasFix: Bool { coordinate != nil }

    var canRequest: Bool {
        switch authorization {
        case .notDetermined, .authorizedWhenInUse, .authorizedAlways:
            return true
        default:
            return false
        }
    }

    func requestIfNeeded() {
        authorization = manager.authorizationStatus
        switch authorization {
        case .notDetermined:
            statusMessage = "Proszę o lokalizację, by posortować od najbliższych…"
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            statusMessage = nil
            manager.requestLocation()
        case .denied, .restricted:
            statusMessage = "Brak dostępu do lokalizacji — włącz ją w ustawieniach Apple TV."
        @unknown default:
            statusMessage = "Nie udało się odczytać lokalizacji."
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.authorization = manager.authorizationStatus
            switch manager.authorizationStatus {
            case .authorizedAlways, .authorizedWhenInUse:
                self.statusMessage = nil
                manager.requestLocation()
            case .denied, .restricted:
                self.statusMessage = "Brak dostępu do lokalizacji — włącz ją w ustawieniach Apple TV."
            default:
                break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            self.coordinate = locations.last?.coordinate
            self.statusMessage = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            self.statusMessage = "Nie udało się pobrać lokalizacji."
        }
    }
}

enum PolishPlaceCoordinates {
    /// Approximate city centers for discreet distance estimates.
    static let cities: [String: (lat: Double, lon: Double)] = [
        "warszawa": (52.2297, 21.0122),
        "kraków": (50.0647, 19.9450),
        "krakow": (50.0647, 19.9450),
        "wrocław": (51.1079, 17.0385),
        "wroclaw": (51.1079, 17.0385),
        "poznań": (52.4064, 16.9252),
        "poznan": (52.4064, 16.9252),
        "gdańsk": (54.3520, 18.6466),
        "gdansk": (54.3520, 18.6466),
        "gdynia": (54.5189, 18.5305),
        "sopot": (54.4418, 18.5601),
        "łódź": (51.7592, 19.4560),
        "lodz": (51.7592, 19.4560),
        "lublin": (51.2465, 22.5684),
        "katowice": (50.2649, 19.0238),
        "szczecin": (53.4285, 14.5528),
        "bydgoszcz": (53.1235, 18.0084),
        "bialystok": (53.1325, 23.1688),
        "białystok": (53.1325, 23.1688),
        "rzeszów": (50.0412, 21.9991),
        "rzeszow": (50.0412, 21.9991),
        "kielce": (50.8661, 20.6286),
        "toruń": (53.0138, 18.5984),
        "torun": (53.0138, 18.5984),
        "olsztyn": (53.7784, 20.4801),
        "opole": (50.6751, 17.9213),
        "zielona góra": (51.9356, 15.5064),
        "zielona gora": (51.9356, 15.5064),
        "częstochowa": (50.8118, 19.1203),
        "czestochowa": (50.8118, 19.1203),
        "radom": (51.4027, 21.1471),
        "sosnowiec": (50.2863, 19.1040),
        "gliwice": (50.2945, 18.6714),
        "zabrze": (50.3249, 18.7857),
        "bytom": (50.3480, 18.9156),
        "ruda śląska": (50.2558, 18.8556),
        "ruda slaska": (50.2558, 18.8556),
        "tychy": (50.1022, 18.9865),
        "dąbrowa górnicza": (50.3217, 19.1870),
        "dabrowa gornicza": (50.3217, 19.1870),
        "elbląg": (54.1561, 19.4045),
        "elblag": (54.1561, 19.4045),
        "płock": (52.5463, 19.7060),
        "plock": (52.5463, 19.7060),
        "wałbrzych": (50.7840, 16.2843),
        "walbrzych": (50.7840, 16.2843),
        "włocławek": (52.6483, 19.0677),
        "wloclawek": (52.6483, 19.0677),
        "tarnów": (50.0121, 20.9858),
        "tarnow": (50.0121, 20.9858),
        "chorzów": (50.2975, 18.9546),
        "chorzow": (50.2975, 18.9546),
        "koszalin": (54.1943, 16.1715),
        "kalisz": (51.7677, 18.0853),
        "legnica": (51.2070, 16.1550),
        "grudziądz": (53.4837, 18.7536),
        "grudziadz": (53.4837, 18.7536),
        "słupsk": (54.4641, 17.0287),
        "slupsk": (54.4641, 17.0287),
        "jaworzno": (50.2052, 19.2740),
        "jastrzębie-zdrój": (49.9550, 18.5747),
        "jastrzebie-zdroj": (49.9550, 18.5747),
        "nowy sącz": (49.6175, 20.7153),
        "nowy sacz": (49.6175, 20.7153),
        "marszów": (51.6500, 15.1500),
        "marszow": (51.6500, 15.1500),
    ]

    static func coordinate(forPlace place: String?) -> CLLocationCoordinate2D? {
        guard let place else { return nil }
        let normalized = place
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "pl_PL"))
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return nil }

        if let exact = cities[normalized] {
            return CLLocationCoordinate2D(latitude: exact.lat, longitude: exact.lon)
        }
        // Match "Warszawa Żoliborz" / "Warszawa, Mokotów"
        let token = normalized
            .replacingOccurrences(of: ",", with: " ")
            .split(separator: " ")
            .map(String.init)
            .first
        if let token, let hit = cities[token] {
            return CLLocationCoordinate2D(latitude: hit.lat, longitude: hit.lon)
        }
        for (key, value) in cities where normalized.contains(key) || key.contains(normalized) {
            return CLLocationCoordinate2D(latitude: value.lat, longitude: value.lon)
        }
        return nil
    }

    static func distanceKm(from user: CLLocationCoordinate2D, toPlace place: String?) -> Double? {
        guard let dest = coordinate(forPlace: place) else { return nil }
        let a = CLLocation(latitude: user.latitude, longitude: user.longitude)
        let b = CLLocation(latitude: dest.latitude, longitude: dest.longitude)
        return a.distance(from: b) / 1000.0
    }

    static func distanceLabel(km: Double?) -> String? {
        guard let km else { return nil }
        if km < 1.5 { return "~1 km" }
        if km < 10 { return String(format: "~%.0f km", km) }
        if km < 100 { return String(format: "~%.0f km", (km / 5).rounded() * 5) }
        return String(format: "~%.0f km", (km / 10).rounded() * 10)
    }
}

import CoreLocation
import Foundation

actor BottleReturnStore {
    static let shared = BottleReturnStore()

    private var machines: [BottleReturnPoint] = []
    private var osmByCell: [String: [BottleReturnPoint]] = [:]
    private var osmFailedAt: [String: Date] = [:]
    private var loadedMachines = false

    func localPoints(in region: MKRegionBox, brandID: String?) async -> [BottleReturnPoint] {
        await loadMachinesIfNeeded()
        return filtered(machines, in: region.padded, brandID: brandID)
    }

    func osmSupplement(in region: MKRegionBox, brandID: String?) async -> [BottleReturnPoint] {
        // Skip OSM when fully clustered (local pack is enough at country scale).
        guard region.pinDensity != .cluster else { return [] }
        let osm = await osmPoints(in: region.padded)
        return filtered(osm, in: region.padded, brandID: brandID)
    }

    func points(in region: MKRegionBox, brandID: String?) async -> [BottleReturnPoint] {
        let local = await localPoints(in: region, brandID: brandID)
        let osm = await osmSupplement(in: region, brandID: brandID)
        return Self.dedupe(local + osm)
    }

    func nearby(from location: CLLocation, limit: Int = 3) async -> [BottleReturnPoint] {
        let box = MKRegionBox(
            center: location.coordinate,
            latitudeDelta: 0.35,
            longitudeDelta: 0.45
        )
        let points = await localPoints(in: box, brandID: nil)
        let center = location
        return Array(
            points.sorted { $0.location.distance(from: center) < $1.location.distance(from: center) }.prefix(limit)
        )
    }

    private func filtered(_ points: [BottleReturnPoint], in region: MKRegionBox, brandID: String?) -> [BottleReturnPoint] {
        var merged = points.filter { region.contains($0.coordinate) }
        if let brandID {
            merged = merged.filter { $0.brandID == brandID }
        }
        let center = CLLocation(latitude: region.center.latitude, longitude: region.center.longitude)
        return merged.sorted { $0.location.distance(from: center) < $1.location.distance(from: center) }
    }

    private func loadMachinesIfNeeded() async {
        if loadedMachines, machines.isEmpty == false { return }
        if let cached = Self.readCache(), cached.isEmpty == false {
            machines = cached
            loadedMachines = true
            if Self.cacheIsFresh() { return }
        }
        loadedMachines = true
        async let first = fetchJSON(url: URL(string: "https://mapakaucji.pl/data/kaucjomaty_polska.json")!)
        async let extra = fetchJSON(url: URL(string: "https://mapakaucji.pl/data/pozostale.json")!)
        var rows: [[String: Any]] = []
        if let parsed = await first as? [[String: Any]] { rows.append(contentsOf: parsed) }
        if let parsed = await extra as? [[String: Any]] { rows.append(contentsOf: parsed) }
        let parsed = rows.compactMap { Self.machine(from: $0) }
        if parsed.isEmpty == false {
            machines = parsed
            Self.writeCache(parsed)
        } else if machines.isEmpty, let stale = Self.readCache() {
            machines = stale
        }
    }

    private func osmPoints(in region: MKRegionBox) async -> [BottleReturnPoint] {
        guard region.pinDensity != .cluster else { return [] }
        let cell = region.cellKey
        if let cached = osmByCell[cell] { return cached }
        if let failed = osmFailedAt[cell], Date().timeIntervalSince(failed) < 20 {
            return []
        }
        let south = region.center.latitude - region.latitudeDelta / 2
        let north = region.center.latitude + region.latitudeDelta / 2
        let west = region.center.longitude - region.longitudeDelta / 2
        let east = region.center.longitude + region.longitudeDelta / 2
        let query = """
        [out:json][timeout:20];
        (
          nwr["vending"="bottle_return"](\(south),\(west),\(north),\(east));
          nwr["amenity"="vending_machine"]["vending"="bottle_return"](\(south),\(west),\(north),\(east));
        );
        out center tags;
        """
        guard let body = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://overpass-api.de/api/interpreter?data=\(body)") else {
            return []
        }
        var request = URLRequest(url: url, timeoutInterval: 22)
        request.setValue("ParagonOS/1.0 (bottle-return map; contact marian@paragonos.app)", forHTTPHeaderField: "User-Agent")
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let elements = json["elements"] as? [[String: Any]]
        else {
            osmFailedAt[cell] = Date()
            return []
        }
        let points = elements.compactMap(Self.osmPoint(from:))
        osmByCell[cell] = points
        osmFailedAt.removeValue(forKey: cell)
        return points
    }

    private func fetchJSON(url: URL) async -> Any? {
        var request = URLRequest(url: url, timeoutInterval: 20)
        request.setValue("ParagonOS/1.0 (bottle-return map)", forHTTPHeaderField: "User-Agent")
        request.setValue("public, max-age=3600", forHTTPHeaderField: "Cache-Control")
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    private static func cacheURL() -> URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("paragonos-kaucjomaty.json")
    }

    private static func cacheStampURL() -> URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("paragonos-kaucjomaty.stamp")
    }

    private static func cacheIsFresh() -> Bool {
        guard let stamp = try? String(contentsOf: cacheStampURL(), encoding: .utf8),
              let time = TimeInterval(stamp) else { return false }
        return Date().timeIntervalSince1970 - time < 86_400
    }

    private static func readCache() -> [BottleReturnPoint]? {
        guard let data = try? Data(contentsOf: cacheURL()) else { return nil }
        return try? JSONDecoder().decode([BottleReturnPoint].self, from: data)
    }

    private static func writeCache(_ points: [BottleReturnPoint]) {
        guard let data = try? JSONEncoder().encode(points) else { return }
        try? data.write(to: cacheURL(), options: .atomic)
        try? "\(Date().timeIntervalSince1970)".write(to: cacheStampURL(), atomically: true, encoding: .utf8)
    }

    private static func machine(from row: [String: Any]) -> BottleReturnPoint? {
        let lat = number(row["lat"]) ?? number(row["latitude"])
        let lng = number(row["lng"]) ?? number(row["lon"]) ?? number(row["longitude"])
        guard let lat, let lng else { return nil }
        let brand = string(row["brand"]) ?? "Punkt zwrotu"
        let brandID = BottleReturnBrand.id(from: brand)
        let address = string(row["address"]) ?? ""
        let city = string(row["city"]) ?? ""
        return BottleReturnPoint(
            id: "machine-\(brandID)-\(lat)-\(lng)",
            brand: brand,
            brandID: brandID,
            name: brand,
            address: address,
            city: city,
            postcode: string(row["postcode"]) ?? "",
            latitude: lat,
            longitude: lng,
            hoursRaw: "",
            acceptsPET: bool(row["pet"], default: true),
            acceptsCans: bool(row["can"], default: true),
            acceptsGlass: bool(row["glass"], default: true),
            kind: .machine
        )
    }

    private static func osmPoint(from element: [String: Any]) -> BottleReturnPoint? {
        let tags = element["tags"] as? [String: Any] ?? [:]
        let lat = number(element["lat"]) ?? number((element["center"] as? [String: Any])?["lat"])
        let lon = number(element["lon"]) ?? number((element["center"] as? [String: Any])?["lon"])
        guard let lat, let lon else { return nil }
        let vending = string(tags["vending"]) ?? ""
        guard vending.contains("bottle") else { return nil }
        let brand = string(tags["brand"]) ?? string(tags["name"]) ?? "Punkt zwrotu"
        let brandID = BottleReturnBrand.id(from: brand)
        let street = [string(tags["addr:street"]), string(tags["addr:housenumber"])]
            .compactMap { $0 }
            .filter { $0.isEmpty == false }
            .joined(separator: " ")
        let hours = string(tags["opening_hours"]) ?? ""
        return BottleReturnPoint(
            id: "osm-\(string(element["type"]) ?? "n")-\(element["id"] as? Int ?? 0)",
            brand: brand,
            brandID: brandID,
            name: string(tags["name"]) ?? brand,
            address: street,
            city: string(tags["addr:city"]) ?? "",
            postcode: string(tags["addr:postcode"]) ?? "",
            latitude: lat,
            longitude: lon,
            hoursRaw: hours,
            acceptsPET: true,
            acceptsCans: true,
            acceptsGlass: true,
            kind: .machine
        )
    }

    static func dedupe(_ points: [BottleReturnPoint]) -> [BottleReturnPoint] {
        var kept: [BottleReturnPoint] = []
        for point in points {
            if let index = kept.firstIndex(where: { $0.brandID == point.brandID && $0.location.distance(from: point.location) < 70 }) {
                var current = kept[index]
                if current.hoursRaw.isEmpty, point.hoursRaw.isEmpty == false {
                    current.hoursRaw = point.hoursRaw
                }
                if current.address.isEmpty { current.address = point.address }
                if current.kind == .store, point.kind == .machine {
                    current.kind = .machine
                }
                kept[index] = current
            } else {
                kept.append(point)
            }
        }
        return kept
    }

    static func osmQueryContainsShops(_ query: String) -> Bool {
        query.contains("[\"shop\"]")
    }

    private static func string(_ value: Any?) -> String? {
        if let text = value as? String {
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
        return nil
    }

    private static func number(_ value: Any?) -> Double? {
        if let number = value as? Double { return number }
        if let number = value as? Int { return Double(number) }
        if let text = value as? String { return Double(text.replacingOccurrences(of: ",", with: ".")) }
        return nil
    }

    private static func bool(_ value: Any?, default fallback: Bool) -> Bool {
        if let flag = value as? Bool { return flag }
        if let text = value as? String { return text == "true" || text == "1" }
        return fallback
    }
}

struct MKRegionBox: Equatable {
    var center: CLLocationCoordinate2D
    var latitudeDelta: Double
    var longitudeDelta: Double

    func contains(_ coordinate: CLLocationCoordinate2D) -> Bool {
        abs(coordinate.latitude - center.latitude) <= latitudeDelta / 2
            && abs(coordinate.longitude - center.longitude) <= longitudeDelta / 2
    }

    var padded: MKRegionBox {
        MKRegionBox(
            center: center,
            latitudeDelta: latitudeDelta * 1.2,
            longitudeDelta: longitudeDelta * 1.2
        )
    }

    /// Zoom ladder for Apple-like density (never hide everything).
    var pinDensity: BottlePinDensity {
        let span = max(latitudeDelta, longitudeDelta)
        if span >= 2.2 { return .cluster }
        if span >= 0.16 { return .thin }
        return .all
    }

    var cellKey: String {
        let lat = (center.latitude * 40).rounded() / 40
        let lon = (center.longitude * 40).rounded() / 40
        let span = (max(latitudeDelta, longitudeDelta) * 10).rounded() / 10
        return "\(lat)-\(lon)-\(span)"
    }

    static func == (lhs: MKRegionBox, rhs: MKRegionBox) -> Bool {
        lhs.center.latitude == rhs.center.latitude
            && lhs.center.longitude == rhs.center.longitude
            && lhs.latitudeDelta == rhs.latitudeDelta
            && lhs.longitudeDelta == rhs.longitudeDelta
    }
}

enum BottlePinDensity: Equatable {
    case cluster
    case thin
    case all
}

/// Map markers: singles or clusters — always something on screen, denser when zoomed in.
enum BottleMapMarker: Identifiable, Hashable {
    case pin(BottleReturnPoint)
    case cluster(id: String, latitude: Double, longitude: Double, count: Int, brandID: String?)

    var id: String {
        switch self {
        case .pin(let point): return "pin-\(point.id)"
        case .cluster(let id, _, _, _, _): return "cluster-\(id)"
        }
    }

    var coordinate: CLLocationCoordinate2D {
        switch self {
        case .pin(let point): return point.coordinate
        case .cluster(_, let lat, let lon, _, _): return CLLocationCoordinate2D(latitude: lat, longitude: lon)
        }
    }
}

enum BottleMapLayout {
    static func markers(from points: [BottleReturnPoint], in box: MKRegionBox) -> [BottleMapMarker] {
        switch box.pinDensity {
        case .all:
            return points.map { .pin($0) }
        case .thin:
            return thin(points, minMeters: max(220, box.latitudeDelta * 75_000))
        case .cluster:
            return cluster(points, divisions: 7)
        }
    }

    private static func thin(_ points: [BottleReturnPoint], minMeters: CLLocationDistance) -> [BottleMapMarker] {
        var kept: [BottleReturnPoint] = []
        for point in points.sorted(by: { $0.kind == .machine && $1.kind != .machine }) {
            if kept.contains(where: { $0.location.distance(from: point.location) < minMeters }) {
                continue
            }
            kept.append(point)
        }
        return kept.map { .pin($0) }
    }

    private static func cluster(_ points: [BottleReturnPoint], divisions: Int) -> [BottleMapMarker] {
        guard points.isEmpty == false else { return [] }
        let lats = points.map(\.latitude)
        let lons = points.map(\.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(),
              let minLon = lons.min(), let maxLon = lons.max()
        else { return [] }
        let latSpan = max(0.0001, maxLat - minLat)
        let lonSpan = max(0.0001, maxLon - minLon)
        var buckets: [String: [BottleReturnPoint]] = [:]
        for point in points {
            let row = Int(((point.latitude - minLat) / latSpan) * Double(divisions))
            let col = Int(((point.longitude - minLon) / lonSpan) * Double(divisions))
            buckets["\(min(row, divisions))-\(min(col, divisions))", default: []].append(point)
        }
        return buckets.compactMap { key, group in
            guard let first = group.first else { return nil }
            if group.count == 1 { return .pin(first) }
            let lat = group.map(\.latitude).reduce(0, +) / Double(group.count)
            let lon = group.map(\.longitude).reduce(0, +) / Double(group.count)
            let brandCounts = Dictionary(grouping: group, by: \.brandID).mapValues(\.count)
            let dominant = brandCounts.max(by: { $0.value < $1.value })?.key
            return .cluster(id: key, latitude: lat, longitude: lon, count: group.count, brandID: dominant)
        }
    }
}

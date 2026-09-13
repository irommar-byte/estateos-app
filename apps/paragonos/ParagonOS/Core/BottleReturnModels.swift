import CoreLocation
import Foundation

struct BottleReturnPoint: Identifiable, Hashable {
    enum Kind: String {
        case machine
        case store
    }

    var id: String
    var brand: String
    var brandID: String
    var name: String
    var address: String
    var city: String
    var postcode: String
    var latitude: Double
    var longitude: Double
    var hoursRaw: String
    var acceptsPET: Bool
    var acceptsCans: Bool
    var acceptsGlass: Bool
    var kind: Kind

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var location: CLLocation {
        CLLocation(latitude: latitude, longitude: longitude)
    }

    var subtitle: String {
        [address, city].filter { $0.isEmpty == false }.joined(separator: ", ")
    }

    var materials: [String] {
        var values: [String] = []
        if acceptsPET { values.append("PET") }
        if acceptsCans { values.append("Puszki") }
        if acceptsGlass { values.append("Szkło") }
        return values
    }
}

enum DistanceFormat {
    static func string(_ meters: CLLocationDistance) -> String {
        if meters < 1000 {
            return "\(Int(meters.rounded())) m"
        }
        let km = meters / 1000
        if km < 10 {
            var value = String(format: "%.1f", km)
            if value.hasSuffix(".0") {
                value = String(value.dropLast(2))
            }
            return value.replacingOccurrences(of: ".", with: ",") + " km"
        }
        return "\(Int(km.rounded())) km"
    }
}

enum BottleReturnBrand {
    static let filters: [(id: String, name: String)] = [
        ("biedronka", "Biedronka"),
        ("lidl", "Lidl"),
        ("zabka", "Żabka"),
        ("kaufland", "Kaufland"),
        ("carrefour", "Carrefour"),
        ("aldi", "ALDI"),
        ("auchan", "Auchan"),
        ("netto", "Netto"),
        ("stokrotka", "Stokrotka"),
        ("dino", "Dino")
    ]

    static func id(from raw: String) -> String {
        let folded = raw.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pl_PL")).lowercased()
        if folded.contains("biedronka") { return "biedronka" }
        if folded.contains("lidl") { return "lidl" }
        if folded.contains("zabka") || folded.contains("żabka") { return "zabka" }
        if folded.contains("kaufland") { return "kaufland" }
        if folded.contains("carrefour") { return "carrefour" }
        if folded.contains("aldi") { return "aldi" }
        if folded.contains("auchan") { return "auchan" }
        if folded.contains("netto") { return "netto" }
        if folded.contains("stokrotka") { return "stokrotka" }
        if folded.contains("dino") { return "dino" }
        return folded.replacingOccurrences(of: " ", with: "")
    }

    static func displayName(_ id: String, fallback: String) -> String {
        filters.first(where: { $0.id == id })?.name ?? fallback
    }
}

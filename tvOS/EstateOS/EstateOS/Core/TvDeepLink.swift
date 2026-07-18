import Foundation

enum TvDeepLink {
    static func offerId(from url: URL) -> Int? {
        let host = String(url.host ?? "").lowercased()
        if host == "offer" || host == "browse24h" {
            if let id = Int(url.lastPathComponent), id > 0 { return id }
            if let id = queryValue(url, key: "id"), let parsed = Int(id), parsed > 0 { return parsed }
        }
        if url.pathComponents.contains(where: { $0.lowercased() == "offer" }) {
            if let id = url.pathComponents.last, let parsed = Int(id), parsed > 0 { return parsed }
        }
        return nil
    }

    static func carId(from url: URL) -> Int? {
        let host = String(url.host ?? "").lowercased()
        if host == "car" || host == "cars" || host == "browseCars" {
            if let id = Int(url.lastPathComponent), id > 0 { return id }
            if let id = queryValue(url, key: "id"), let parsed = Int(id), parsed > 0 { return parsed }
        }
        if let idx = url.pathComponents.firstIndex(where: { $0.lowercased() == "cars" || $0.lowercased() == "car" }) {
            let next = url.pathComponents.index(after: idx)
            if next < url.pathComponents.count, let parsed = Int(url.pathComponents[next]), parsed > 0 {
                return parsed
            }
        }
        return nil
    }

    static func opensImmersive(from url: URL) -> Bool {
        if queryValue(url, key: "immersive") == "1" { return true }
        let host = String(url.host ?? "").lowercased()
        return host == "browse24h" || host == "browsecars"
    }

    private static func queryValue(_ url: URL, key: String) -> String? {
        URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == key })?
            .value
    }
}

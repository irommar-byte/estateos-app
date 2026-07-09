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

    static func opensImmersive(from url: URL) -> Bool {
        if queryValue(url, key: "immersive") == "1" { return true }
        return String(url.host ?? "").lowercased() == "browse24h"
    }

    private static func queryValue(_ url: URL, key: String) -> String? {
        URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == key })?
            .value
    }
}

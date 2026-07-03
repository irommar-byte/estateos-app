import Foundation

enum DeepLink {
    static let scheme = "nostalgiemovies"

    static func media(url: String) -> URL? {
        var components = URLComponents()
        components.scheme = scheme
        components.host = "media"
        components.queryItems = [URLQueryItem(name: "url", value: url)]
        return components.url
    }

    static func parseMediaURL(_ incoming: URL) -> String? {
        guard incoming.scheme?.lowercased() == scheme, incoming.host?.lowercased() == "media" else {
            return nil
        }
        return URLComponents(url: incoming, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "url" })?
            .value
    }
}

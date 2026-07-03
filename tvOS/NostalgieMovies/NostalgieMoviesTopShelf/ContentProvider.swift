import Foundation
import TVServices

private struct LatestFeed: Decodable {
    let items: [LatestItem]
}

private struct LatestItem: Decodable {
    let title: String
    let url: String
    let thumbnail: String?
}

public class TopShelfContentProvider: TVTopShelfContentProvider {
    private let feedURL = URL(
        string: "https://lineage.mycloudnas.com/admin_pro/api/movies/proxy/api/cda-hd/latest?limit=10"
    )!

    public override func loadTopShelfContent(completionHandler: @escaping (TVTopShelfContent?) -> Void) {
        Task {
            let content = await buildContent()
            DispatchQueue.main.async {
                completionHandler(content)
            }
        }
    }

    private func buildContent() async -> TVTopShelfContent? {
        guard let items = await fetchLatest(), !items.isEmpty else { return nil }

        let shelfItems: [TVTopShelfSectionedItem] = items.compactMap { item in
            let shelfItem = TVTopShelfSectionedItem(identifier: item.url)
            shelfItem.title = item.title
            shelfItem.imageShape = .poster

            if let thumb = item.thumbnail, let imageURL = URL(string: thumb) {
                shelfItem.setImageURL(imageURL, for: .screenScale1x)
                shelfItem.setImageURL(imageURL, for: .screenScale2x)
            }

            guard let actionURL = deepLink(for: item.url) else { return nil }
            let action = TVTopShelfAction(url: actionURL)
            shelfItem.displayAction = action
            shelfItem.playAction = action
            return shelfItem
        }

        guard !shelfItems.isEmpty else { return nil }

        let collection = TVTopShelfItemCollection(items: shelfItems)
        collection.title = "Najnowsze z CDA-HD"
        return TVTopShelfSectionedContent(sections: [collection])
    }

    private func fetchLatest() async -> [LatestItem]? {
        var request = URLRequest(url: feedURL)
        request.setValue("NostalgieMovies-TopShelf/1.0", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 10

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return nil
            }
            return try JSONDecoder().decode(LatestFeed.self, from: data).items
        } catch {
            return nil
        }
    }

    private func deepLink(for mediaURL: String) -> URL? {
        var components = URLComponents()
        components.scheme = "nostalgiemovies"
        components.host = "media"
        components.queryItems = [URLQueryItem(name: "url", value: mediaURL)]
        return components.url
    }
}

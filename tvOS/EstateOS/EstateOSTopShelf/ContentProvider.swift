import Foundation
import TVServices
import UIKit

private struct TopShelfOfferEnvelope: Decodable {
    let offers: [TopShelfOffer]?
    let data: [TopShelfOffer]?
    let items: [TopShelfOffer]?
}

struct TopShelfOffer: Decodable {
    let id: Int
    let title: String
    let city: String?
    let district: String?
    let price: Double?
    let area: Double?
    let transactionType: String?
    let imageUrl: String?
    let images: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, city, district, price, area, transactionType, imageUrl, images, createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Oferta #\(id)"
        city = try c.decodeIfPresent(String.self, forKey: .city)
        district = try c.decodeIfPresent(String.self, forKey: .district)
        transactionType = try c.decodeIfPresent(String.self, forKey: .transactionType)
        imageUrl = try c.decodeIfPresent(String.self, forKey: .imageUrl)
        images = try c.decodeIfPresent(String.self, forKey: .images)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        price = TopShelfOffer.decodeFlexibleDouble(from: c, key: .price)
        area = TopShelfOffer.decodeFlexibleDouble(from: c, key: .area)
    }

    private static func decodeFlexibleDouble(
        from container: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) -> Double? {
        if let val = try? container.decode(Double.self, forKey: key) { return val }
        if let val = try? container.decode(Int.self, forKey: key) { return Double(val) }
        if let str = try? container.decode(String.self, forKey: key) {
            return Double(str.replacingOccurrences(of: ",", with: "."))
        }
        return nil
    }
}

public class TopShelfContentProvider: TVTopShelfContentProvider {
    private let offersURL = URL(string: "https://estateos.pl/api/mobile/v1/offers?catalog=1")!

    public override func loadTopShelfContent(completionHandler: @escaping (TVTopShelfContent?) -> Void) {
        Task {
            let content = await buildContent()
            DispatchQueue.main.async {
                completionHandler(content)
            }
        }
    }

    private func buildContent() async -> TVTopShelfContent? {
        guard let offers = await fetchOffersLast24Hours(), !offers.isEmpty else { return nil }
        if TopShelfSharedPreferences.isSectioned {
            return await buildSectionedContent(offers: offers)
        }
        return await buildCarouselContent(offers: offers)
    }

    private func buildCarouselContent(offers: [TopShelfOffer]) async -> TVTopShelfContent? {
        var items: [TVTopShelfCarouselItem] = []
        for offer in offers {
            if let item = await makeCarouselItem(for: offer) {
                items.append(item)
            }
        }
        guard !items.isEmpty else { return nil }
        return TVTopShelfCarouselContent(style: .details, items: items)
    }

    private func buildSectionedContent(offers: [TopShelfOffer]) async -> TVTopShelfContent? {
        var items: [TVTopShelfSectionedItem] = []
        for offer in offers {
            if let item = await makeSectionedItem(for: offer) {
                items.append(item)
            }
        }
        guard !items.isEmpty else { return nil }
        let collection = TVTopShelfItemCollection(items: items)
        collection.title = "Ostatnie 24 godziny"
        return TVTopShelfSectionedContent(sections: [collection])
    }

    private func makeCarouselItem(for offer: TopShelfOffer) async -> TVTopShelfCarouselItem? {
        let card = ShelfOfferFormatting.card(from: offer)
        let item = TVTopShelfCarouselItem(identifier: String(offer.id))
        item.title = card.title
        item.contextTitle = card.contextTitle
        item.summary = card.summary

        if let area = offer.area, area > 0 {
            item.namedAttributes = [
                TVTopShelfNamedAttribute(name: "Powierzchnia", values: ["\(Int(area.rounded())) m²"]),
            ]
        }

        let background = await downloadImage(for: offer)
        let image1x = ShelfImageRenderer.renderCarouselHero(background: background, scale: 1)
        let image2x = ShelfImageRenderer.renderCarouselHero(background: background, scale: 2)

        if let url1x = persist(image: image1x, name: "carousel-\(offer.id)-1x"),
           let url2x = persist(image: image2x, name: "carousel-\(offer.id)-2x") {
            item.setImageURL(url1x, for: .screenScale1x)
            item.setImageURL(url2x, for: .screenScale2x)
        } else if let remote = resolveImageURL(for: offer) {
            item.setImageURL(remote, for: .screenScale1x)
            item.setImageURL(remote, for: .screenScale2x)
        } else {
            return nil
        }

        attachActions(to: item, offerId: offer.id)
        return item
    }

    private func makeSectionedItem(for offer: TopShelfOffer) async -> TVTopShelfSectionedItem? {
        let card = ShelfOfferFormatting.card(from: offer)
        let item = TVTopShelfSectionedItem(identifier: String(offer.id))
        item.title = ""
        item.imageShape = .hdtv

        let background = await downloadImage(for: offer)
        let image1x = ShelfImageRenderer.renderSectionedCard(offer: card, background: background, scale: 1)
        let image2x = ShelfImageRenderer.renderSectionedCard(offer: card, background: background, scale: 2)

        if let url1x = persist(image: image1x, name: "section-\(offer.id)-1x"),
           let url2x = persist(image: image2x, name: "section-\(offer.id)-2x") {
            item.setImageURL(url1x, for: .screenScale1x)
            item.setImageURL(url2x, for: .screenScale2x)
        } else if let remote = resolveImageURL(for: offer) {
            item.setImageURL(remote, for: .screenScale1x)
            item.setImageURL(remote, for: .screenScale2x)
        } else {
            return nil
        }

        attachActions(to: item, offerId: offer.id)
        return item
    }

    private func attachActions(to item: TVTopShelfItem, offerId: Int) {
        guard let actionURL = immersiveDeepLink(for: offerId) else { return }
        let action = TVTopShelfAction(url: actionURL)
        item.displayAction = action
        item.playAction = action
    }

    private func fetchOffersLast24Hours() async -> [TopShelfOffer]? {
        var request = URLRequest(url: offersURL)
        request.setValue("EstateOS-tvOS-TopShelf/1.0", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 15

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return nil
            }

            let decoded: [TopShelfOffer]
            if let list = try? JSONDecoder().decode([TopShelfOffer].self, from: data) {
                decoded = list
            } else {
                let envelope = try JSONDecoder().decode(TopShelfOfferEnvelope.self, from: data)
                decoded = envelope.offers ?? envelope.data ?? envelope.items ?? []
            }

            return decoded
                .filter { ShelfOfferFormatting.isWithinLast24Hours($0.createdAt) }
                .sorted { lhs, rhs in
                    parseDate(lhs.createdAt) > parseDate(rhs.createdAt)
                }
        } catch {
            return nil
        }
    }

    private func parseDate(_ raw: String?) -> Date {
        guard let raw, !raw.isEmpty else { return .distantPast }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: raw) { return date }
        iso.formatOptions = [.withInternetDateTime]
        return iso.date(from: raw) ?? .distantPast
    }

    private func downloadImage(for offer: TopShelfOffer) async -> UIImage? {
        guard let url = resolveImageURL(for: offer) else { return nil }
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 8
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return nil
            }
            return UIImage(data: data)
        } catch {
            return nil
        }
    }

    private func persist(image: UIImage, name: String) -> URL? {
        guard let data = image.jpegData(compressionQuality: 0.92) else { return nil }
        guard let directory = cacheDirectory() else { return nil }
        let fileURL = directory.appendingPathComponent("\(name).jpg")
        do {
            try data.write(to: fileURL, options: .atomic)
            return fileURL
        } catch {
            return nil
        }
    }

    private func cacheDirectory() -> URL? {
        guard let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return nil
        }
        let directory = base.appendingPathComponent("estateos-topshelf", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func resolveImageURL(for offer: TopShelfOffer) -> URL? {
        if let imageUrl = offer.imageUrl, let url = absoluteURL(imageUrl) { return url }
        if let imagesRaw = offer.images {
            if let data = imagesRaw.data(using: .utf8),
               let list = try? JSONDecoder().decode([String].self, from: data),
               let first = list.first,
               let url = absoluteURL(first) { return url }
            if imagesRaw.hasPrefix("http") || imagesRaw.hasPrefix("/") {
                return absoluteURL(imagesRaw)
            }
        }
        return nil
    }

    private func absoluteURL(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") { return URL(string: trimmed) }
        if trimmed.hasPrefix("/") { return URL(string: "https://estateos.pl" + trimmed) }
        return URL(string: "https://estateos.pl/" + trimmed)
    }

    private func immersiveDeepLink(for offerId: Int) -> URL? {
        var components = URLComponents()
        components.scheme = "estateos"
        components.host = "browse24h"
        components.queryItems = [
            URLQueryItem(name: "id", value: String(offerId)),
            URLQueryItem(name: "immersive", value: "1"),
        ]
        return components.url
    }
}

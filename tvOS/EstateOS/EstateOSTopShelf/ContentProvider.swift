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

@objc(TopShelfContentProvider)
public class TopShelfContentProvider: TVTopShelfContentProvider {
  private let offersURL = URL(string: "https://estateos.pl/api/mobile/v1/offers?catalog=1")!
  private let appGroupID = "group.pl.estateos.app.tvos"
  private let offerLimit = 10

  public override func loadTopShelfContent(completionHandler: @escaping (TVTopShelfContent?) -> Void) {
    Task {
      let content: TVTopShelfContent?
      do {
        content = await buildContent()
      } catch {
        content = nil
      }
      let resolved = content ?? Self.emergencyContent()
      await MainActor.run {
        completionHandler(resolved)
      }
    }
  }

  private let carsURL = URL(string: "https://estateos.pl/api/cars")!
  private let carLimit = 6

  private func buildContent() async -> TVTopShelfContent? {
    async let offersTask = fetchOffersForTopShelf()
    async let carsTask = fetchCarsForTopShelf()
    let offers = await offersTask ?? []
    let cars = await carsTask ?? []

    guard !offers.isEmpty || !cars.isEmpty else {
      return fallbackContent()
    }

    let limitedOffers = Array(offers.prefix(offerLimit))
    let limitedCars = Array(cars.prefix(carLimit))

    // Explicit "Karty w rzędzie" preference → sectioned Home + Car.
    if TopShelfSharedPreferences.isSectioned {
      if let sectioned = await buildDualSectionedContent(offers: limitedOffers, cars: limitedCars) {
        return sectioned
      }
      if !limitedOffers.isEmpty, let carousel = await buildCarouselContent(offers: limitedOffers) {
        return carousel
      }
      return fallbackContent()
    }

    // Default: full-bleed Apple TV+ carousel with property photos (Top Shelf hero).
    if !limitedOffers.isEmpty {
      if let carousel = await buildCarouselContent(offers: limitedOffers) {
        return carousel
      }
      return fallbackContent()
    }

    if let carsOnly = await buildDualSectionedContent(offers: [], cars: limitedCars) {
      return carsOnly
    }
    return fallbackContent()
  }

  // MARK: - Carousel

  private func buildCarouselContent(offers: [TopShelfOffer]) async -> TVTopShelfContent? {
    // Always use remote HTTPS images. UIKit offscreen rendering in the
    // Top Shelf extension process is unstable on Simulator and was crashing
    // the plugin → HeadBoard fell back to the static brand banner.
    return buildRemoteCarouselContent(offers: offers)
  }

  /// Physical Apple TV: remote HTTPS images only (proven in build 6).
  private func buildRemoteCarouselContent(offers: [TopShelfOffer]) -> TVTopShelfContent? {
    let items = offers.compactMap { makeRemoteCarouselItem(for: $0) }
    guard !items.isEmpty else { return nil }
    return TVTopShelfCarouselContent(style: .details, items: items)
  }

  /// Simulator: designer titles burned into image.
  private func buildStyledCarouselContent(offers: [TopShelfOffer]) async -> TVTopShelfContent? {
    var items: [TVTopShelfCarouselItem] = []
    for (index, offer) in offers.enumerated() {
      if let item = await makeStyledCarouselItem(for: offer, downloadPhoto: index < 3) {
        items.append(item)
      }
    }
    guard !items.isEmpty else { return nil }
    return TVTopShelfCarouselContent(style: .details, items: items)
  }

  private func makeRemoteCarouselItem(for offer: TopShelfOffer) -> TVTopShelfCarouselItem? {
    let card = ShelfOfferFormatting.card(from: offer)
    let remote = resolveImageURL(for: offer)

    let item = TVTopShelfCarouselItem(identifier: String(offer.id))
    item.title = card.title
    item.contextTitle = card.contextTitle
    item.summary = card.summary

    if let area = offer.area, area > 0 {
      item.namedAttributes = [
        TVTopShelfNamedAttribute(name: "Powierzchnia", values: ["\(Int(area.rounded())) m²"]),
      ]
    }

    if let fileURL = renderStyledImage(offer: card, background: nil, offerId: offer.id, mode: .carousel) {
      item.setImageURL(fileURL, for: .screenScale1x)
      item.setImageURL(fileURL, for: .screenScale2x)
    } else if let remote {
      item.setImageURL(remote, for: .screenScale1x)
      item.setImageURL(remote, for: .screenScale2x)
    } else {
      return nil
    }

    attachActions(to: item, offerId: offer.id)
    return item
  }

  private func makeStyledCarouselItem(for offer: TopShelfOffer, downloadPhoto: Bool) async -> TVTopShelfCarouselItem? {
    let card = ShelfOfferFormatting.card(from: offer)
    let remote = resolveImageURL(for: offer)

    let item = TVTopShelfCarouselItem(identifier: String(offer.id))
    clearSystemText(on: item)

    if let area = offer.area, area > 0 {
      item.namedAttributes = [
        TVTopShelfNamedAttribute(name: "Powierzchnia", values: ["\(Int(area.rounded())) m²"]),
      ]
    }

    let background: UIImage?
    if downloadPhoto, let remote {
      background = await TopShelfImageLoader.loadImage(from: remote, timeout: 2.5)
    } else {
      background = nil
    }

    if let fileURL = renderStyledImage(
      offer: card,
      background: background,
      offerId: offer.id,
      mode: .carousel
    ) {
      item.setImageURL(fileURL, for: .screenScale1x)
      item.setImageURL(fileURL, for: .screenScale2x)
    } else if let remote {
      item.setImageURL(remote, for: .screenScale1x)
      item.setImageURL(remote, for: .screenScale2x)
    } else {
      return nil
    }

    attachActions(to: item, offerId: offer.id)
    return item
  }

  // MARK: - Sectioned

  private func buildSectionedContent(offers: [TopShelfOffer]) async -> TVTopShelfContent? {
    return buildRemoteSectionedContent(offers: offers)
  }

  private func buildRemoteSectionedContent(offers: [TopShelfOffer]) -> TVTopShelfContent? {
    let items = offers.compactMap { makeRemoteSectionedItem(for: $0) }
    guard !items.isEmpty else { return nil }
    let collection = TVTopShelfItemCollection(items: items)
    collection.title = "Ostatnie 24 godziny"
    return TVTopShelfSectionedContent(sections: [collection])
  }

  private func buildStyledSectionedContent(offers: [TopShelfOffer]) async -> TVTopShelfContent? {
    var items: [TVTopShelfSectionedItem] = []
    for offer in offers {
      if let item = await makeStyledSectionedItem(for: offer) {
        items.append(item)
      }
    }
    guard !items.isEmpty else { return nil }
    let collection = TVTopShelfItemCollection(items: items)
    collection.title = "Ostatnie 24 godziny"
    return TVTopShelfSectionedContent(sections: [collection])
  }

  private func makeRemoteSectionedItem(for offer: TopShelfOffer) -> TVTopShelfSectionedItem? {
    let card = ShelfOfferFormatting.card(from: offer)
    let remote = resolveImageURL(for: offer)

    let item = TVTopShelfSectionedItem(identifier: String(offer.id))
    item.title = card.title
    item.imageShape = .hdtv

    if let fileURL = renderStyledImage(offer: card, background: nil, offerId: offer.id, mode: .sectioned) {
      item.setImageURL(fileURL, for: .screenScale1x)
      item.setImageURL(fileURL, for: .screenScale2x)
    } else if let remote {
      item.setImageURL(remote, for: .screenScale1x)
      item.setImageURL(remote, for: .screenScale2x)
    } else {
      return nil
    }

    attachActions(to: item, offerId: offer.id)
    return item
  }

  private func makeStyledSectionedItem(for offer: TopShelfOffer) async -> TVTopShelfSectionedItem? {
    let card = ShelfOfferFormatting.card(from: offer)
    let remote = resolveImageURL(for: offer)

    let item = TVTopShelfSectionedItem(identifier: String(offer.id))
    item.title = ""
    item.imageShape = .hdtv

    let background: UIImage?
    if let remote {
      background = await TopShelfImageLoader.loadImage(from: remote, timeout: 2.5)
    } else {
      background = nil
    }

    if let fileURL = renderStyledImage(
      offer: card,
      background: background,
      offerId: offer.id,
      mode: .sectioned
    ) {
      item.setImageURL(fileURL, for: .screenScale1x)
      item.setImageURL(fileURL, for: .screenScale2x)
    } else if let remote {
      item.setImageURL(remote, for: .screenScale1x)
      item.setImageURL(remote, for: .screenScale2x)
    } else {
      return nil
    }

    attachActions(to: item, offerId: offer.id)
    return item
  }


  // MARK: - Dual Home + Car sections

  private struct TopShelfCarEnvelope: Decodable {
    let cars: [TopShelfCar]?
    let items: [TopShelfCar]?
    let data: [TopShelfCar]?
  }

  private struct TopShelfCar: Decodable {
    let id: Int
    let title: String?
    let make: String?
    let model: String?
    let year: Int?
    let pricePln: Double?
    let city: String?
    let imageUrl: String?
    let fuelType: String?
    let transmission: String?
    let featured: Bool?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
      case id, title, make, model, year, pricePln, city, imageUrl, fuelType, transmission, featured, createdAt
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      id = try c.decode(Int.self, forKey: .id)
      title = try c.decodeIfPresent(String.self, forKey: .title)
      make = try c.decodeIfPresent(String.self, forKey: .make)
      model = try c.decodeIfPresent(String.self, forKey: .model)
      city = try c.decodeIfPresent(String.self, forKey: .city)
      imageUrl = try c.decodeIfPresent(String.self, forKey: .imageUrl)
      fuelType = try c.decodeIfPresent(String.self, forKey: .fuelType)
      transmission = try c.decodeIfPresent(String.self, forKey: .transmission)
      featured = try c.decodeIfPresent(Bool.self, forKey: .featured)
      createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
      if let y = try? c.decode(Int.self, forKey: .year) {
        year = y
      } else if let y = try? c.decode(Double.self, forKey: .year) {
        year = Int(y)
      } else {
        year = nil
      }
      if let p = try? c.decode(Double.self, forKey: .pricePln) {
        pricePln = p
      } else if let p = try? c.decode(Int.self, forKey: .pricePln) {
        pricePln = Double(p)
      } else {
        pricePln = nil
      }
    }

    var displayTitle: String {
      let parts = [make, model, year.map(String.init)].compactMap { $0 }.filter { !$0.isEmpty }
      if !parts.isEmpty { return parts.joined(separator: " · ") }
      return title ?? "Auto #\(id)"
    }
  }

  private func buildDualSectionedContent(offers: [TopShelfOffer], cars: [TopShelfCar]) async -> TVTopShelfContent? {
    var sections: [TVTopShelfItemCollection<TVTopShelfSectionedItem>] = []

    if !offers.isEmpty {
      let homeItems = offers.compactMap { makeRemoteSectionedItem(for: $0) }
      if !homeItems.isEmpty {
        let collection = TVTopShelfItemCollection(items: homeItems)
        collection.title = "Nieruchomości · 24h"
        sections.append(collection)
      }
    }

    if !cars.isEmpty {
      let carItems = cars.compactMap { makeRemoteCarSectionedItem(for: $0) }
      if !carItems.isEmpty {
        let collection = TVTopShelfItemCollection(items: carItems)
        collection.title = "Samochody"
        sections.append(collection)
      }
    }

    guard !sections.isEmpty else { return nil }
    return TVTopShelfSectionedContent(sections: sections)
  }

  private func makeRemoteCarSectionedItem(for car: TopShelfCar) -> TVTopShelfSectionedItem? {
    guard let remote = absoluteURL(car.imageUrl ?? "") else { return nil }
    let item = TVTopShelfSectionedItem(identifier: "car-\(car.id)")
    item.title = car.displayTitle
    item.imageShape = .hdtv
    item.setImageURL(remote, for: .screenScale1x)
    item.setImageURL(remote, for: .screenScale2x)
    if let url = carDeepLink(for: car.id) {
      item.displayAction = TVTopShelfAction(url: url)
    }
    return item
  }

  private func fetchCarsForTopShelf() async -> [TopShelfCar]? {
    if let data = cachedCarsData(),
       let list = try? JSONDecoder().decode([TopShelfCar].self, from: data) {
      return Array(list.prefix(carLimit))
    }
    var request = URLRequest(url: carsURL)
    request.setValue("EstateOS-tvOS-TopShelf/1.0", forHTTPHeaderField: "User-Agent")
    request.timeoutInterval = 8
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
        return nil
      }
      let list: [TopShelfCar]
      if let decoded = try? JSONDecoder().decode([TopShelfCar].self, from: data) {
        list = decoded
      } else {
        let envelope = try JSONDecoder().decode(TopShelfCarEnvelope.self, from: data)
        list = envelope.cars ?? envelope.items ?? envelope.data ?? []
      }
      let featured = list.filter { $0.featured == true }
      let pool = featured.isEmpty ? list : featured
      return Array(pool.prefix(carLimit))
    } catch {
      return nil
    }
  }

  private func carDeepLink(for carId: Int) -> URL? {
    var components = URLComponents()
    components.scheme = "estateos"
    components.host = "car"
    components.queryItems = [URLQueryItem(name: "id", value: String(carId))]
    return components.url
  }


  // MARK: - Shared helpers

  private enum StyledRenderMode {
    case carousel
    case sectioned
  }

  private func renderStyledImage(
    offer: ShelfOfferCard,
    background: UIImage?,
    offerId: Int,
    mode: StyledRenderMode
  ) -> URL? {
    let image: UIImage
    switch mode {
    case .carousel:
      image = ShelfImageRenderer.renderCarouselHero(offer: offer, background: background, scale: 1)
    case .sectioned:
      image = ShelfImageRenderer.renderSectionedCard(offer: offer, background: background, scale: 1)
    }
    return writeShelfImage(image, offerId: offerId, suffix: mode == .carousel ? "carousel" : "sectioned")
  }

  private func clearSystemText(on item: TVTopShelfCarouselItem) {
    item.title = ""
    item.contextTitle = ""
    item.summary = ""
  }

  private func writeShelfImage(_ image: UIImage, offerId: Int, suffix: String) -> URL? {
    guard let data = image.jpegData(compressionQuality: 0.86) else { return nil }
    let directory = sharedShelfDirectory()
    do {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let fileURL = directory.appendingPathComponent("offer-\(offerId)-\(suffix).jpg")
      try data.write(to: fileURL, options: .atomic)
      return fileURL
    } catch {
      return nil
    }
  }

  private func sharedShelfDirectory() -> URL {
    if let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) {
      return group.appendingPathComponent("Library/Caches/topshelf", isDirectory: true)
    }
    let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
    return caches.appendingPathComponent("topshelf", isDirectory: true)
  }

  private func attachActions(to item: TVTopShelfItem, offerId: Int) {
    guard let actionURL = immersiveDeepLink(for: offerId) else { return }
    item.displayAction = TVTopShelfAction(url: actionURL)
  }


  private func cachedOffersData() -> Data? {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) else { return nil }
    let url = container.appendingPathComponent("topShelfOffers.json")
    return try? Data(contentsOf: url)
  }

  private func cachedCarsData() -> Data? {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) else { return nil }
    let url = container.appendingPathComponent("topShelfCars.json")
    return try? Data(contentsOf: url)
  }

  private func fetchOffersForTopShelf() async -> [TopShelfOffer]? {
    guard let all = await fetchAllOffers() else { return nil }
    let recent = all
      .filter { ShelfOfferFormatting.isWithinLast24Hours($0.createdAt) }
      .sorted { parseDate($0.createdAt) > parseDate($1.createdAt) }
    if !recent.isEmpty { return recent }
    return Array(all.sorted { parseDate($0.createdAt) > parseDate($1.createdAt) }.prefix(offerLimit))
  }

  private func fetchAllOffers() async -> [TopShelfOffer]? {
    if let data = cachedOffersData(),
       let list = try? JSONDecoder().decode([TopShelfOffer].self, from: data) {
      return list
    }
    var request = URLRequest(url: offersURL)
    request.setValue("EstateOS-tvOS-TopShelf/1.0", forHTTPHeaderField: "User-Agent")
    request.timeoutInterval = 8

    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
        return nil
      }

      if let list = try? JSONDecoder().decode([TopShelfOffer].self, from: data) {
        return list
      }
      let envelope = try JSONDecoder().decode(TopShelfOfferEnvelope.self, from: data)
      return envelope.offers ?? envelope.data ?? envelope.items ?? []
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

  private func fallbackContent() -> TVTopShelfContent? {
    #if targetEnvironment(simulator)
    let card = ShelfOfferCard(
      id: -1,
      title: "Najnowsze oferty EstateOS",
      priceText: "",
      pricePerSqmText: "",
      location: "Warszawa i okolice",
      transactionLabel: "Oferta",
      isRent: false
    )
    let hero = ShelfImageRenderer.renderCarouselHero(offer: card, background: nil, scale: 1)
    if let fileURL = writeShelfImage(hero, offerId: -1, suffix: "fallback") {
      let item = TVTopShelfCarouselItem(identifier: "fallback")
      clearSystemText(on: item)
      item.setImageURL(fileURL, for: .screenScale1x)
      item.setImageURL(fileURL, for: .screenScale2x)
      if let deepLink = URL(string: "estateos://browse24h") {
        item.displayAction = TVTopShelfAction(url: deepLink)
      }
      return TVTopShelfCarouselContent(style: .details, items: [item])
    }
    #endif
    return Self.emergencyContent() as? TVTopShelfCarouselContent
  }

  private static func emergencyContent() -> TVTopShelfContent {
    guard let remote = URL(string: "https://estateos.pl/uploads/offers/575/89c45a6d-1ac9-4ba5-871c-06aa8ac01065.webp") else {
      let item = TVTopShelfCarouselItem(identifier: "emergency")
      return TVTopShelfCarouselContent(style: .details, items: [item])
    }

    let item = TVTopShelfCarouselItem(identifier: "emergency")
    item.title = "EstateOS"
    item.contextTitle = "Nieruchomości"
    item.summary = "Najnowsze oferty"
    item.setImageURL(remote, for: .screenScale1x)
    item.setImageURL(remote, for: .screenScale2x)
    if let deepLink = URL(string: "estateos://browse24h") {
      item.displayAction = TVTopShelfAction(url: deepLink)
    }
    return TVTopShelfCarouselContent(style: .details, items: [item])
  }
}

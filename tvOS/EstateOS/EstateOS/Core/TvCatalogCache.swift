import Foundation

enum TvCatalogCache {
    private static let suiteName = "group.pl.estateos.app.tvos"
    private static let offersFile = "catalogOffers.json"
    private static let carsFile = "catalogCars.json"
    private static let topShelfOffersFile = "topShelfOffers.json"
    private static let topShelfCarsFile = "topShelfCars.json"

    static var isUsingCachedCatalog: Bool = false

    private static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteName)
    }

    // MARK: - Catalog cache

    static func saveOffers(_ offers: [EstateOffer]) {
        guard let url = containerURL?.appendingPathComponent(offersFile) else { return }
        guard let data = try? JSONEncoder().encode(offers) else { return }
        try? data.write(to: url, options: .atomic)
        saveTopShelfOffers(offers)
    }

    static func saveCars(_ cars: [CarListing]) {
        guard let url = containerURL?.appendingPathComponent(carsFile) else { return }
        guard let data = try? JSONEncoder().encode(cars) else { return }
        try? data.write(to: url, options: .atomic)
        saveTopShelfCars(cars)
    }

    static func loadOffers() -> [EstateOffer]? {
        guard let url = containerURL?.appendingPathComponent(offersFile),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode([EstateOffer].self, from: data)
    }

    static func loadCars() -> [CarListing]? {
        guard let url = containerURL?.appendingPathComponent(carsFile),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode([CarListing].self, from: data)
    }

    // MARK: - Top Shelf cache

    private struct TopShelfOfferCache: Encodable {
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
    }

    private struct TopShelfCarCache: Encodable {
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
    }

    static func saveTopShelfOffers(_ offers: [EstateOffer]) {
        guard let url = containerURL?.appendingPathComponent(topShelfOffersFile) else { return }
        let recent = offers
            .filter { $0.isWithinLast24Hours }
            .sorted { $0.sortDate > $1.sortDate }
        let pool = recent.isEmpty ? offers : recent
        let mapped = pool.prefix(12).map { offer in
            TopShelfOfferCache(
                id: offer.id,
                title: offer.title,
                city: offer.city,
                district: offer.district,
                price: offer.price,
                area: offer.area,
                transactionType: offer.transactionType,
                imageUrl: offer.imageUrl,
                images: offer.imageCandidates.first,
                createdAt: offer.createdAt
            )
        }
        guard let data = try? JSONEncoder().encode(mapped) else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func saveTopShelfCars(_ cars: [CarListing]) {
        guard let url = containerURL?.appendingPathComponent(topShelfCarsFile) else { return }
        let featured = cars.filter(\.featured)
        let pool = featured.isEmpty ? cars : featured
        let mapped = pool.prefix(8).map { car in
            TopShelfCarCache(
                id: car.id,
                title: car.title,
                make: car.make,
                model: car.model,
                year: car.year > 0 ? car.year : nil,
                pricePln: car.pricePln,
                city: car.city.isEmpty ? nil : car.city,
                imageUrl: car.imageUrl,
                fuelType: car.fuelType,
                transmission: car.transmission,
                featured: car.featured,
                createdAt: car.createdAt
            )
        }
        guard let data = try? JSONEncoder().encode(mapped) else { return }
        try? data.write(to: url, options: .atomic)
    }

    static var topShelfOffersURL: URL? {
        containerURL?.appendingPathComponent(topShelfOffersFile)
    }

    static var topShelfCarsURL: URL? {
        containerURL?.appendingPathComponent(topShelfCarsFile)
    }
}

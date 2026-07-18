import Foundation

struct EstateSession: Codable {
    let token: String
    let user: EstateUser
}

struct EstateUser: Codable {
    let id: Int?
    let login: String
    let email: String?

    enum CodingKeys: String, CodingKey {
        case id, login, email, name
    }

    init(id: Int?, login: String, email: String?) {
        self.id = id
        self.login = login
        self.email = email
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(Int.self, forKey: .id)
        email = try c.decodeIfPresent(String.self, forKey: .email)
        if let explicitLogin = try c.decodeIfPresent(String.self, forKey: .login), !explicitLogin.isEmpty {
            login = explicitLogin
        } else if let fallbackName = try c.decodeIfPresent(String.self, forKey: .name), !fallbackName.isEmpty {
            login = fallbackName
        } else if let email, !email.isEmpty {
            login = email
        } else {
            login = "EstateOS"
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(id, forKey: .id)
        try c.encode(login, forKey: .login)
        try c.encodeIfPresent(email, forKey: .email)
    }
}

struct EstateLoginResponse: Codable {
    let token: String
    let user: EstateUser
}

struct EstateOffer: Decodable, Identifiable, Hashable {
    let id: Int
    let title: String
    let description: String?
    let city: String?
    let district: String?
    let localityCountry: String?
    let localityCountryCode: String?
    let price: Double?
    let area: Double?
    let rooms: Double?
    let transactionType: String?
    let propertyType: String?
    let imageUrl: String?
    let imageCandidates: [String]
    let createdAt: String?
    let viewsCount: Int
    let favoritesCount: Int
    /// Owner of the listing — used to show engagement stats only to the seller.
    let userId: Int?
    /// List / previous price in PLN (reference for discount %).
    let listPricePln: Double?
    let previousPrice: Double?
    /// Whole-percent drop vs list price (e.g. 12 for −12%). Nil when not discounted.
    let priceDiscountPercent: Int?
    let isDiscounted: Bool

    enum CodingKeys: String, CodingKey {
        case id, title, description, city, district, localityCountry, localityCountryCode
        case price, area, rooms
        case transactionType, propertyType, createdAt
        case imageUrl, mainImage, thumbnail, image
        case images, views, viewsCount, favoritesCount
        case userId, listPricePln, previousPrice, oldPrice, priceDiscountPercent, isDiscounted
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Offer #\(id)"
        description = try c.decodeIfPresent(String.self, forKey: .description)
        city = try c.decodeIfPresent(String.self, forKey: .city)
        district = try c.decodeIfPresent(String.self, forKey: .district)
        localityCountry = try c.decodeIfPresent(String.self, forKey: .localityCountry)
        localityCountryCode = try c.decodeIfPresent(String.self, forKey: .localityCountryCode)
        price = try EstateOffer.decodeFlexibleDouble(from: c, key: .price)
        area = try EstateOffer.decodeFlexibleDouble(from: c, key: .area)
        rooms = try EstateOffer.decodeFlexibleDouble(from: c, key: .rooms)
        transactionType = try c.decodeIfPresent(String.self, forKey: .transactionType)
        propertyType = try c.decodeIfPresent(String.self, forKey: .propertyType)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        viewsCount = (try? c.decodeIfPresent(Int.self, forKey: .viewsCount))
            ?? (try? c.decodeIfPresent(Int.self, forKey: .views))
            ?? 0
        favoritesCount = (try? c.decodeIfPresent(Int.self, forKey: .favoritesCount)) ?? 0
        userId = try? c.decodeIfPresent(Int.self, forKey: .userId)
        listPricePln = try EstateOffer.decodeFlexibleDouble(from: c, key: .listPricePln)
        if let prev = try EstateOffer.decodeFlexibleDouble(from: c, key: .previousPrice) {
            previousPrice = prev
        } else {
            previousPrice = try EstateOffer.decodeFlexibleDouble(from: c, key: .oldPrice)
        }
        if let pct = try? c.decodeIfPresent(Int.self, forKey: .priceDiscountPercent) {
            priceDiscountPercent = pct
        } else if let pctD = try? c.decodeIfPresent(Double.self, forKey: .priceDiscountPercent) {
            priceDiscountPercent = Int(pctD.rounded())
        } else {
            priceDiscountPercent = nil
        }
        if let flag = try? c.decodeIfPresent(Bool.self, forKey: .isDiscounted) {
            isDiscounted = flag
        } else {
            isDiscounted = (priceDiscountPercent ?? 0) > 0
        }
        let directImages = EstateOffer.decodeFlexibleStringArray(from: c, key: .images)
        let primaryImage: String?
        if let v = try c.decodeIfPresent(String.self, forKey: .imageUrl), !v.isEmpty {
            primaryImage = v
        } else if let v = try c.decodeIfPresent(String.self, forKey: .mainImage), !v.isEmpty {
            primaryImage = v
        } else if let v = try c.decodeIfPresent(String.self, forKey: .thumbnail), !v.isEmpty {
            primaryImage = v
        } else if let v = try c.decodeIfPresent(String.self, forKey: .image), !v.isEmpty {
            primaryImage = v
        } else {
            primaryImage = directImages.first
        }
        imageUrl = primaryImage
        imageCandidates = ([primaryImage].compactMap { $0 } + directImages)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    init(
        id: Int,
        title: String,
        description: String?,
        city: String?,
        district: String?,
        localityCountry: String? = nil,
        localityCountryCode: String? = nil,
        price: Double?,
        area: Double?,
        rooms: Double?,
        transactionType: String?,
        propertyType: String?,
        imageUrl: String?,
        imageCandidates: [String] = [],
        createdAt: String?,
        viewsCount: Int = 0,
        favoritesCount: Int = 0,
        userId: Int? = nil,
        listPricePln: Double? = nil,
        previousPrice: Double? = nil,
        priceDiscountPercent: Int? = nil,
        isDiscounted: Bool = false
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.city = city
        self.district = district
        self.localityCountry = localityCountry
        self.localityCountryCode = localityCountryCode
        self.price = price
        self.area = area
        self.rooms = rooms
        self.transactionType = transactionType
        self.propertyType = propertyType
        self.imageUrl = imageUrl
        self.imageCandidates = imageCandidates
        self.createdAt = createdAt
        self.viewsCount = viewsCount
        self.favoritesCount = favoritesCount
        self.userId = userId
        self.listPricePln = listPricePln
        self.previousPrice = previousPrice
        self.priceDiscountPercent = priceDiscountPercent
        self.isDiscounted = isDiscounted
    }

    private static func decodeFlexibleDouble(
        from container: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) throws -> Double? {
        if let val = try? container.decode(Double.self, forKey: key) {
            return val
        }
        if let val = try? container.decode(Int.self, forKey: key) {
            return Double(val)
        }
        if let str = try? container.decode(String.self, forKey: key) {
            return Double(str.replacingOccurrences(of: ",", with: "."))
        }
        return nil
    }

    private static func decodeFlexibleStringArray(
        from container: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) -> [String] {
        if let list = try? container.decode([String].self, forKey: key) {
            return list
        }
        if let asSingle = try? container.decode(String.self, forKey: key) {
            let trimmed = asSingle.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.hasPrefix("["),
               let data = trimmed.data(using: .utf8),
               let parsed = try? JSONDecoder().decode([String].self, from: data) {
                return parsed
            }
            return trimmed.isEmpty ? [] : [trimmed]
        }
        return []
    }
}

struct EstateOfferListEnvelope: Decodable {
    let offers: [EstateOffer]?
    let data: [EstateOffer]?
    let items: [EstateOffer]?
}

extension EstateOfferListEnvelope {
    var resolvedOffers: [EstateOffer] {
        offers ?? data ?? items ?? []
    }
}

struct EstateOfferDetailEnvelope: Decodable {
    let offer: EstateOffer?
    let data: EstateOffer?
    let success: Bool?

    var resolvedOffer: EstateOffer? { offer ?? data }
}


// MARK: - Cars (EstateOS™Car)

struct CarListing: Decodable, Identifiable, Hashable {
    let id: Int
    let title: String
    let description: String?
    let make: String
    let model: String
    let year: Int
    let mileageKm: Int
    let fuelType: String
    let transmission: String
    let bodyType: String
    let exteriorColor: String?
    let generation: String?
    let enginePower: String?
    let engineCapacity: String?
    let trimVersion: String?
    let doorCount: Int?
    let pricePln: Double
    let city: String
    let localityCountry: String?
    let localityCountryCode: String?
    let imageUrl: String?
    let imageCandidates: [String]
    let featured: Bool
    let createdAt: String?
    let vinMasked: String?
    let viewsCount: Int
    let favoritesCount: Int

    enum CodingKeys: String, CodingKey {
        case id, title, description, make, model, year, mileageKm, fuelType, transmission, bodyType
        case exteriorColor, generation, enginePower, engineCapacity, trimVersion, doorCount
        case pricePln, city, localityCountry, localityCountryCode
        case imageUrl, images, featured, createdAt, vin, vinMasked
        case views, viewsCount, favoritesCount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Auto #\(id)"
        description = try c.decodeIfPresent(String.self, forKey: .description)
        make = try c.decodeIfPresent(String.self, forKey: .make) ?? ""
        model = try c.decodeIfPresent(String.self, forKey: .model) ?? ""
        year = try Self.decodeInt(from: c, key: .year) ?? 0
        mileageKm = try Self.decodeInt(from: c, key: .mileageKm) ?? 0
        fuelType = try c.decodeIfPresent(String.self, forKey: .fuelType) ?? ""
        transmission = try c.decodeIfPresent(String.self, forKey: .transmission) ?? ""
        bodyType = try c.decodeIfPresent(String.self, forKey: .bodyType) ?? ""
        exteriorColor = try c.decodeIfPresent(String.self, forKey: .exteriorColor)
        generation = try c.decodeIfPresent(String.self, forKey: .generation)
        enginePower = try c.decodeIfPresent(String.self, forKey: .enginePower)
        engineCapacity = try c.decodeIfPresent(String.self, forKey: .engineCapacity)
        trimVersion = try c.decodeIfPresent(String.self, forKey: .trimVersion)
        doorCount = try Self.decodeInt(from: c, key: .doorCount)
        if let d = try? c.decode(Double.self, forKey: .pricePln) {
            pricePln = d
        } else if let i = try? c.decode(Int.self, forKey: .pricePln) {
            pricePln = Double(i)
        } else {
            pricePln = 0
        }
        city = try c.decodeIfPresent(String.self, forKey: .city) ?? ""
        localityCountry = try c.decodeIfPresent(String.self, forKey: .localityCountry)
        localityCountryCode = try c.decodeIfPresent(String.self, forKey: .localityCountryCode)
        let imgs = Self.decodeStringArray(from: c, key: .images)
        let primary = (try? c.decodeIfPresent(String.self, forKey: .imageUrl)) ?? imgs.first
        imageUrl = primary
        imageCandidates = ([primary].compactMap { $0 } + imgs)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        featured = (try? c.decodeIfPresent(Bool.self, forKey: .featured)) ?? false
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        if let masked = try c.decodeIfPresent(String.self, forKey: .vinMasked), !masked.isEmpty {
            vinMasked = masked
        } else if let vin = try c.decodeIfPresent(String.self, forKey: .vin), vin.count >= 5 {
            vinMasked = String(vin.prefix(3)) + "••••" + String(vin.suffix(2))
        } else {
            vinMasked = nil
        }
        viewsCount = (try? c.decodeIfPresent(Int.self, forKey: .viewsCount))
            ?? (try? c.decodeIfPresent(Int.self, forKey: .views))
            ?? 0
        favoritesCount = (try? c.decodeIfPresent(Int.self, forKey: .favoritesCount)) ?? 0
    }

    private static func decodeInt(from c: KeyedDecodingContainer<CodingKeys>, key: CodingKeys) throws -> Int? {
        if let v = try? c.decode(Int.self, forKey: key) { return v }
        if let v = try? c.decode(Double.self, forKey: key) { return Int(v) }
        if let s = try? c.decode(String.self, forKey: key) { return Int(s) }
        return nil
    }

    private static func decodeStringArray(from c: KeyedDecodingContainer<CodingKeys>, key: CodingKeys) -> [String] {
        if let list = try? c.decode([String].self, forKey: key) { return list }
        if let s = try? c.decode(String.self, forKey: key) {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            if t.hasPrefix("["), let data = t.data(using: .utf8),
               let parsed = try? JSONDecoder().decode([String].self, from: data) {
                return parsed
            }
            return t.isEmpty ? [] : [t]
        }
        return []
    }
}

enum CatalogBrand: String, CaseIterable, Identifiable {
    case home
    case car

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "Nieruchomości"
        case .car: return "Samochody"
        }
    }

    var shortTitle: String {
        switch self {
        case .home: return "Nieruchomości"
        case .car: return "Samochody"
        }
    }

    var accent: String {
        switch self {
        case .home: return "house.fill"
        case .car: return "car.fill"
        }
    }
}

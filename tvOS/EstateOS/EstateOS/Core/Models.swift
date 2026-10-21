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

struct EstateOffer: Codable, Identifiable, Hashable {
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
    /// Building, plot and amenity data from the full catalog (`/api/mobile/v1/offers`).
    var extras: EstateOfferExtras = .empty

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
        extras = (try? EstateOfferExtras(from: decoder)) ?? .empty
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

struct CarListing: Codable, Identifiable, Hashable {
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


// MARK: - Encodable (catalog cache)

extension EstateOffer {
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(title, forKey: .title)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encodeIfPresent(city, forKey: .city)
        try c.encodeIfPresent(district, forKey: .district)
        try c.encodeIfPresent(localityCountry, forKey: .localityCountry)
        try c.encodeIfPresent(localityCountryCode, forKey: .localityCountryCode)
        try c.encodeIfPresent(price, forKey: .price)
        try c.encodeIfPresent(area, forKey: .area)
        try c.encodeIfPresent(rooms, forKey: .rooms)
        try c.encodeIfPresent(transactionType, forKey: .transactionType)
        try c.encodeIfPresent(propertyType, forKey: .propertyType)
        try c.encodeIfPresent(imageUrl, forKey: .imageUrl)
        try c.encode(imageCandidates, forKey: .images)
        try c.encodeIfPresent(createdAt, forKey: .createdAt)
        try c.encode(viewsCount, forKey: .viewsCount)
        try c.encode(favoritesCount, forKey: .favoritesCount)
        try c.encodeIfPresent(userId, forKey: .userId)
        try c.encodeIfPresent(listPricePln, forKey: .listPricePln)
        try c.encodeIfPresent(previousPrice, forKey: .previousPrice)
        try c.encodeIfPresent(priceDiscountPercent, forKey: .priceDiscountPercent)
        try c.encode(isDiscounted, forKey: .isDiscounted)
        try extras.encode(to: encoder)
    }
}

/// Offer fields used by filters and the detail page (Prisma `Offer`): floor, building year, plot,
/// condition and amenities. Decoded from the same JSON object as `EstateOffer`; all optional.
struct EstateOfferExtras: Codable, Hashable {
    var floor: Int?
    var totalFloors: Int?
    var yearBuilt: Int?
    var plotArea: Double?
    var pricePerSqm: Double?
    var pricePln: Double?
    var condition: String?
    var heating: String?
    var hasBalcony = false
    var hasElevator = false
    var hasStorage = false
    var hasParking = false
    var hasGarden = false
    var hasAirConditioning = false
    var isDuplex = false
    var isFurnished = false
    // Media & location
    var videoUrl: String?
    var floorPlanUrl: String?
    var floorPlanExtraUrls: [String] = []
    var floorPlan3dUrl: String?
    var scan: FloorPlanScan?
    var lat: Double?
    var lng: Double?
    var isExactLocation = true
    var street: String?

    static let empty = EstateOfferExtras()

    enum CodingKeys: String, CodingKey {
        case floor, totalFloors, yearBuilt, plotArea, pricePerSqm, pricePln, condition, heating
        case hasBalcony, hasElevator, hasStorage, hasParking, hasGarden, hasAirConditioning
        case isDuplex, isFurnished
        case videoUrl, floorPlanUrl, floorPlan, floorPlanExtraUrls, floorPlan3dUrl, floorPlanScanMeta
        case lat, lng, isExactLocation, street
    }

    var hasFloorPlan: Bool { floorPlanUrl != nil || !floorPlanExtraUrls.isEmpty || (scan?.walls.isEmpty == false) }
    var coordinate: (lat: Double, lng: Double)? {
        guard let lat, let lng, lat != 0 || lng != 0 else { return nil }
        return (lat, lng)
    }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func int(_ k: CodingKeys) -> Int? {
            if let v = try? c.decodeIfPresent(Int.self, forKey: k) { return v }
            if let v = try? c.decodeIfPresent(Double.self, forKey: k) { return Int(v) }
            if let s = try? c.decodeIfPresent(String.self, forKey: k) { return Int(s) }
            return nil
        }
        func dbl(_ k: CodingKeys) -> Double? {
            if let v = try? c.decodeIfPresent(Double.self, forKey: k) { return v }
            if let s = try? c.decodeIfPresent(String.self, forKey: k) {
                return Double(s.replacingOccurrences(of: ",", with: "."))
            }
            return nil
        }
        func flag(_ k: CodingKeys) -> Bool {
            if let v = try? c.decodeIfPresent(Bool.self, forKey: k) { return v }
            if let v = try? c.decodeIfPresent(Int.self, forKey: k) { return v != 0 }
            return false
        }
        floor = int(.floor)
        totalFloors = int(.totalFloors)
        yearBuilt = int(.yearBuilt)
        plotArea = dbl(.plotArea)
        pricePerSqm = dbl(.pricePerSqm)
        pricePln = dbl(.pricePln)
        condition = try? c.decodeIfPresent(String.self, forKey: .condition)
        heating = try? c.decodeIfPresent(String.self, forKey: .heating)
        hasBalcony = flag(.hasBalcony)
        hasElevator = flag(.hasElevator)
        hasStorage = flag(.hasStorage)
        hasParking = flag(.hasParking)
        hasGarden = flag(.hasGarden)
        hasAirConditioning = flag(.hasAirConditioning)
        isDuplex = flag(.isDuplex)
        isFurnished = flag(.isFurnished)
        func text(_ k: CodingKeys) -> String? {
            guard let v = try? c.decodeIfPresent(String.self, forKey: k) else { return nil }
            let t = v.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        }
        videoUrl = text(.videoUrl)
        floorPlanUrl = text(.floorPlanUrl) ?? text(.floorPlan)
        floorPlan3dUrl = text(.floorPlan3dUrl)
        if let list = try? c.decodeIfPresent([String].self, forKey: .floorPlanExtraUrls) {
            floorPlanExtraUrls = list
        } else if let raw = text(.floorPlanExtraUrls), let data = raw.data(using: .utf8),
                  let list = try? JSONDecoder().decode([String].self, from: data) {
            floorPlanExtraUrls = list
        }
        floorPlanExtraUrls = floorPlanExtraUrls.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        if let obj = try? c.decodeIfPresent(FloorPlanScan.self, forKey: .floorPlanScanMeta) {
            scan = obj
        } else if let raw = text(.floorPlanScanMeta), let data = raw.data(using: .utf8) {
            scan = try? JSONDecoder().decode(FloorPlanScan.self, from: data)
        }
        lat = dbl(.lat)
        lng = dbl(.lng)
        if let exact = try? c.decodeIfPresent(Bool.self, forKey: .isExactLocation) { isExactLocation = exact }
        street = text(.street)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(floor, forKey: .floor)
        try c.encodeIfPresent(totalFloors, forKey: .totalFloors)
        try c.encodeIfPresent(yearBuilt, forKey: .yearBuilt)
        try c.encodeIfPresent(plotArea, forKey: .plotArea)
        try c.encodeIfPresent(pricePerSqm, forKey: .pricePerSqm)
        try c.encodeIfPresent(pricePln, forKey: .pricePln)
        try c.encodeIfPresent(condition, forKey: .condition)
        try c.encodeIfPresent(heating, forKey: .heating)
        try c.encode(hasBalcony, forKey: .hasBalcony)
        try c.encode(hasElevator, forKey: .hasElevator)
        try c.encode(hasStorage, forKey: .hasStorage)
        try c.encode(hasParking, forKey: .hasParking)
        try c.encode(hasGarden, forKey: .hasGarden)
        try c.encode(hasAirConditioning, forKey: .hasAirConditioning)
        try c.encode(isDuplex, forKey: .isDuplex)
        try c.encode(isFurnished, forKey: .isFurnished)
        try c.encodeIfPresent(videoUrl, forKey: .videoUrl)
        try c.encodeIfPresent(floorPlanUrl, forKey: .floorPlanUrl)
        if !floorPlanExtraUrls.isEmpty { try c.encode(floorPlanExtraUrls, forKey: .floorPlanExtraUrls) }
        try c.encodeIfPresent(floorPlan3dUrl, forKey: .floorPlan3dUrl)
        try c.encodeIfPresent(scan, forKey: .floorPlanScanMeta)
        try c.encodeIfPresent(lat, forKey: .lat)
        try c.encodeIfPresent(lng, forKey: .lng)
        try c.encode(isExactLocation, forKey: .isExactLocation)
        try c.encodeIfPresent(street, forKey: .street)
    }
}

/// LiDAR floor-plan geometry (`Offer.floorPlanScanMeta`, RoomPlan → metres on the floor plane).
/// Mirrors `src/types/roomScan.ts` (FloorPlanScanMeta) — only what the TV draws.
struct FloorPlanScan: Codable, Hashable {
    struct Wall: Codable, Hashable { var x1, z1, x2, z2: Double }
    struct Opening: Codable, Hashable {
        var kind: String
        var x1, z1, x2, z2: Double
    }
    struct Point: Codable, Hashable { var x, z: Double }
    struct Section: Codable, Hashable {
        var label: String?
        var centerX: Double
        var centerZ: Double
        var areaSqM: Double?
        var floorPolygon: [Point]?
    }
    struct Object: Codable, Hashable {
        var category: String
        var centerX: Double
        var centerZ: Double
        var widthM: Double?
        var depthM: Double?
        var rotationDeg: Double?
    }
    struct Bounds: Codable, Hashable { var minX, maxX, minZ, maxZ: Double }

    var walls: [Wall]
    var openings: [Opening]
    var sections: [Section]
    var objects: [Object]
    var bounds: Bounds?
    var totalAreaSqM: Double?
    var ceilingHeightM: Double?
    var northRotationDegrees: Double?

    enum CodingKeys: String, CodingKey {
        case walls, openings, sections, objects, bounds, totalAreaSqM, ceilingHeightM, northRotationDegrees
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        walls = (try? c.decodeIfPresent([Wall].self, forKey: .walls)) ?? []
        openings = (try? c.decodeIfPresent([Opening].self, forKey: .openings)) ?? []
        sections = (try? c.decodeIfPresent([Section].self, forKey: .sections)) ?? []
        objects = (try? c.decodeIfPresent([Object].self, forKey: .objects)) ?? []
        bounds = try? c.decodeIfPresent(Bounds.self, forKey: .bounds)
        totalAreaSqM = try? c.decodeIfPresent(Double.self, forKey: .totalAreaSqM)
        ceilingHeightM = try? c.decodeIfPresent(Double.self, forKey: .ceilingHeightM)
        northRotationDegrees = try? c.decodeIfPresent(Double.self, forKey: .northRotationDegrees)
    }

    /// Bounds from the data, or computed from the walls.
    var resolvedBounds: Bounds? {
        if let bounds, bounds.maxX > bounds.minX, bounds.maxZ > bounds.minZ { return bounds }
        let xs = walls.flatMap { [$0.x1, $0.x2] }
        let zs = walls.flatMap { [$0.z1, $0.z2] }
        guard let minX = xs.min(), let maxX = xs.max(), let minZ = zs.min(), let maxZ = zs.max(),
              maxX > minX, maxZ > minZ else { return nil }
        return Bounds(minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ)
    }
}

extension CarListing {
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(title, forKey: .title)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encode(make, forKey: .make)
        try c.encode(model, forKey: .model)
        try c.encode(year, forKey: .year)
        try c.encode(mileageKm, forKey: .mileageKm)
        try c.encode(fuelType, forKey: .fuelType)
        try c.encode(transmission, forKey: .transmission)
        try c.encode(bodyType, forKey: .bodyType)
        try c.encodeIfPresent(exteriorColor, forKey: .exteriorColor)
        try c.encodeIfPresent(generation, forKey: .generation)
        try c.encodeIfPresent(enginePower, forKey: .enginePower)
        try c.encodeIfPresent(engineCapacity, forKey: .engineCapacity)
        try c.encodeIfPresent(trimVersion, forKey: .trimVersion)
        try c.encodeIfPresent(doorCount, forKey: .doorCount)
        try c.encode(pricePln, forKey: .pricePln)
        try c.encode(city, forKey: .city)
        try c.encodeIfPresent(localityCountry, forKey: .localityCountry)
        try c.encodeIfPresent(localityCountryCode, forKey: .localityCountryCode)
        try c.encodeIfPresent(imageUrl, forKey: .imageUrl)
        try c.encode(imageCandidates, forKey: .images)
        try c.encode(featured, forKey: .featured)
        try c.encodeIfPresent(createdAt, forKey: .createdAt)
        try c.encodeIfPresent(vinMasked, forKey: .vinMasked)
        try c.encode(viewsCount, forKey: .viewsCount)
        try c.encode(favoritesCount, forKey: .favoritesCount)
    }
}

// MARK: - Account profile (GET /api/mobile/v1/user/me → shapeMobileUser)

struct AccountProfile: Decodable {
    var id: Int?
    var email: String?
    var name: String?
    var phone: String?
    var image: String?
    var role: String?
    var planType: String?
    var isPro: Bool?
    var officePro: Bool?
    var hasMarketPro: Bool?
    var proExpiresAt: String?
    var plusExpiresAt: String?
    var companyName: String?
    var emailVerified: Bool?
    var phoneVerified: Bool?
    var isVerified: Bool?
    var intelligenceEnabled: Bool?
    var intelligenceDecided: Bool?
    var extraListings: Int?
    var hasPasskey: Bool?

    enum Tier: Equatable {
        case admin, pro, agency, plus, investor, basic

        var title: String {
            switch self {
            case .admin: return "Administrator"
            case .pro: return "EstateOS Pro"
            case .agency: return "Biuro partnerskie"
            case .plus: return "EstateOS Plus"
            case .investor: return "Inwestor"
            case .basic: return "Konto podstawowe"
            }
        }

        /// Pro-level membership — the gold treatment.
        var isPremium: Bool { self == .pro || self == .agency || self == .admin }
    }

    var tier: Tier {
        let plan = (planType ?? "").uppercased()
        if (role ?? "").uppercased() == "ADMIN" { return .admin }
        if isPro == true || plan == "PRO" { return .pro }
        if officePro == true || plan == "AGENCY" { return .agency }
        if plan == "PLUS", (plusExpiry.map { $0 > Date() } ?? true) { return .plus }
        if plan == "INVESTOR" { return .investor }
        return .basic
    }

    var roleLabel: String? {
        switch (role ?? "").uppercased() {
        case "AGENT": return "Agent nieruchomości"
        case "ADMIN": return "Zespół EstateOS"
        default: return nil
        }
    }

    var displayName: String {
        let n = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !n.isEmpty { return n }
        return (email ?? "Konto EstateOS")
    }

    var initials: String {
        let parts = displayName.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first }.map { String($0).uppercased() }.joined()
        return letters.isEmpty ? "E" : letters
    }

    var proExpiry: Date? { Self.parse(proExpiresAt) }
    var plusExpiry: Date? { Self.parse(plusExpiresAt) }

    /// "aktywne do 12 marca 2027" for the membership card.
    var membershipValidity: String? {
        let date: Date?
        switch tier {
        case .pro: date = proExpiry
        case .plus: date = plusExpiry
        default: date = nil
        }
        guard let date else { return tier == .basic ? nil : "Aktywne bezterminowo" }
        return "Aktywne do " + Self.longDate.string(from: date)
    }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoPlain = ISO8601DateFormatter()
    private static let longDate: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pl_PL")
        f.dateFormat = "d MMMM yyyy"
        return f
    }()

    private static func parse(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return iso.date(from: raw) ?? isoPlain.date(from: raw)
    }
}

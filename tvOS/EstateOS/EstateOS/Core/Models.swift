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
    let price: Double?
    let area: Double?
    let rooms: Double?
    let transactionType: String?
    let propertyType: String?
    let imageUrl: String?
    let imageCandidates: [String]
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, city, district, price, area, rooms
        case transactionType, propertyType, createdAt
        case imageUrl, mainImage, thumbnail, image
        case images
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Offer #\(id)"
        description = try c.decodeIfPresent(String.self, forKey: .description)
        city = try c.decodeIfPresent(String.self, forKey: .city)
        district = try c.decodeIfPresent(String.self, forKey: .district)
        price = try EstateOffer.decodeFlexibleDouble(from: c, key: .price)
        area = try EstateOffer.decodeFlexibleDouble(from: c, key: .area)
        rooms = try EstateOffer.decodeFlexibleDouble(from: c, key: .rooms)
        transactionType = try c.decodeIfPresent(String.self, forKey: .transactionType)
        propertyType = try c.decodeIfPresent(String.self, forKey: .propertyType)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
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
        price: Double?,
        area: Double?,
        rooms: Double?,
        transactionType: String?,
        propertyType: String?,
        imageUrl: String?,
        imageCandidates: [String] = [],
        createdAt: String?
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.city = city
        self.district = district
        self.price = price
        self.area = area
        self.rooms = rooms
        self.transactionType = transactionType
        self.propertyType = propertyType
        self.imageUrl = imageUrl
        self.imageCandidates = imageCandidates
        self.createdAt = createdAt
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

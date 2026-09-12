import Foundation

enum ScreenBarcodePolicy: String, Codable {
    case tryAtCheckout
    case photoPreferred
}

struct ValidityRule: Codable, Equatable {
    var effectiveFrom: String
    var days: Int?
}

struct RetailerPolicy: Codable, Equatable, Identifiable {
    var id: String
    var name: String
    var keywords: [String]
    var taxIDs: [String]
    var validityRules: [ValidityRule]
    var screenBarcode: ScreenBarcodePolicy
    var networkWide: Bool
    var cashoutAllowed: Bool
    var requiresPurchaseAtLeastAmount: Bool
    var checkoutHint: String

    enum CodingKeys: String, CodingKey {
        case id, name, keywords, taxIDs, validityRules, screenBarcode
        case networkWide, cashoutAllowed, requiresPurchaseAtLeastAmount, checkoutHint
    }

    init(
        id: String,
        name: String,
        keywords: [String],
        taxIDs: [String] = [],
        validityRules: [ValidityRule],
        screenBarcode: ScreenBarcodePolicy,
        networkWide: Bool,
        cashoutAllowed: Bool,
        requiresPurchaseAtLeastAmount: Bool,
        checkoutHint: String
    ) {
        self.id = id
        self.name = name
        self.keywords = keywords
        self.taxIDs = taxIDs
        self.validityRules = validityRules
        self.screenBarcode = screenBarcode
        self.networkWide = networkWide
        self.cashoutAllowed = cashoutAllowed
        self.requiresPurchaseAtLeastAmount = requiresPurchaseAtLeastAmount
        self.checkoutHint = checkoutHint
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        keywords = try container.decode([String].self, forKey: .keywords)
        taxIDs = try container.decodeIfPresent([String].self, forKey: .taxIDs) ?? []
        validityRules = try container.decode([ValidityRule].self, forKey: .validityRules)
        screenBarcode = try container.decode(ScreenBarcodePolicy.self, forKey: .screenBarcode)
        networkWide = try container.decode(Bool.self, forKey: .networkWide)
        cashoutAllowed = try container.decode(Bool.self, forKey: .cashoutAllowed)
        requiresPurchaseAtLeastAmount = try container.decode(Bool.self, forKey: .requiresPurchaseAtLeastAmount)
        checkoutHint = try container.decode(String.self, forKey: .checkoutHint)
    }
}

struct RetailerCatalogFile: Codable {
    var retailers: [RetailerPolicy]
}

enum RetailerCatalog {
    static let shared: [RetailerPolicy] = load()

    static func policy(id: String) -> RetailerPolicy {
        shared.first(where: { $0.id == id }) ?? unknown
    }

    static var unknown: RetailerPolicy {
        shared.first(where: { $0.id == "unknown" }) ?? RetailerPolicy(
            id: "unknown",
            name: "Inna sieć",
            keywords: [],
            taxIDs: [],
            validityRules: [],
            screenBarcode: .photoPreferred,
            networkWide: false,
            cashoutAllowed: false,
            requiresPurchaseAtLeastAmount: false,
            checkoutHint: "Jeśli kasa nie odczyta kodu z ekranu, pokaż zdjęcie kwitka."
        )
    }

    static func match(in text: String) -> RetailerPolicy {
        VoucherParser.matchRetailer(in: text, catalog: shared)
    }

    static func validityDays(for policy: RetailerPolicy, issuedAt: Date, calendar: Calendar = .current) -> Int? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withFullDate]
        iso.timeZone = TimeZone(identifier: "Europe/Warsaw")
        let rules = policy.validityRules.sorted { $0.effectiveFrom < $1.effectiveFrom }
        var matched: ValidityRule?
        for rule in rules {
            guard let from = iso.date(from: rule.effectiveFrom) else { continue }
            let start = calendar.startOfDay(for: from)
            if issuedAt >= start {
                matched = rule
            }
        }
        return matched?.days
    }

    static func defaultExpiry(for policy: RetailerPolicy, issuedAt: Date, calendar: Calendar = .current) -> Date? {
        guard let days = validityDays(for: policy, issuedAt: issuedAt, calendar: calendar) else { return nil }
        return calendar.date(byAdding: .day, value: days, to: calendar.startOfDay(for: issuedAt))
    }

    static func load(from data: Data) throws -> [RetailerPolicy] {
        let decoder = JSONDecoder()
        return try decoder.decode(RetailerCatalogFile.self, from: data).retailers
    }

    private static func load() -> [RetailerPolicy] {
        guard let url = Bundle.main.url(forResource: "Retailers", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let retailers = try? load(from: data) else {
            return []
        }
        return retailers
    }
}

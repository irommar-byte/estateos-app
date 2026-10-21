import Foundation

enum OfferPresentation {
    /// Strips portal HTML, verification tokens and normalizes whitespace for tvOS text views.
    static func plainDescription(from raw: String?) -> String? {
        guard var text = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
            return nil
        }

        text = text.replacingOccurrences(
            of: "<!--[\\s\\S]*?-->",
            with: "",
            options: .regularExpression
        )
        text = text.replacingOccurrences(
            of: "ESTATEOS_VERIFY:[A-Za-z0-9._\\-+/=]+",
            with: "",
            options: .regularExpression
        )
        text = text.replacingOccurrences(of: "<br\\s*/?>", with: "\n", options: .regularExpression)
        text = text.replacingOccurrences(of: "</p>", with: "\n\n", options: .regularExpression)
        text = text.replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)

        let entities: [(String, String)] = [
            ("&nbsp;", " "),
            ("&amp;", "&"),
            ("&lt;", "<"),
            ("&gt;", ">"),
            ("&quot;", "\""),
            ("&#39;", "'"),
        ]
        for (entity, value) in entities {
            text = text.replacingOccurrences(of: entity, with: value)
        }

        text = text.replacingOccurrences(of: "[ \\t]+", with: " ", options: .regularExpression)
        text = text.replacingOccurrences(of: "\\n{3,}", with: "\n\n", options: .regularExpression)
        text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        text = softenConcatenatedWords(text)

        return text.isEmpty ? nil : text
    }

    /// Portal / import dumps often glue equipment tokens together
    /// ("felgiTempomatESP", "dwustrefowa18-calowe"). Re-insert spaces so tvOS
    /// descriptions remain readable.
    private static func softenConcatenatedWords(_ input: String) -> String {
        var text = input
        // letter → Uppercase (camelCase / PascalCase glue)
        text = text.replacingOccurrences(
            of: "([a-ząćęłńóśźż])([A-ZĄĆĘŁŃÓŚŹŻ])",
            with: "$1 $2",
            options: .regularExpression
        )
        // letter → digit, digit → letter
        text = text.replacingOccurrences(
            of: "([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż])([0-9])",
            with: "$1 $2",
            options: .regularExpression
        )
        text = text.replacingOccurrences(
            of: "([0-9])([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż])",
            with: "$1 $2",
            options: .regularExpression
        )
        // Collapse accidental double spaces introduced above
        text = text.replacingOccurrences(of: " {2,}", with: " ", options: .regularExpression)
        return text
    }

    // Formatters are expensive to create; sorting the catalog used to build three per comparison.
    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
    private static let fallbackFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        return f
    }()
    private static let dateCacheLock = NSLock()
    nonisolated(unsafe) private static var dateCache: [String: Date] = [:]

    static func parseCreatedAt(_ raw: String?) -> Date {
        guard let raw, !raw.isEmpty else { return .distantPast }
        dateCacheLock.lock()
        if let hit = dateCache[raw] { dateCacheLock.unlock(); return hit }
        dateCacheLock.unlock()
        let date = isoFractional.date(from: raw)
            ?? isoPlain.date(from: raw)
            ?? fallbackFormatter.date(from: raw)
            ?? .distantPast
        dateCacheLock.lock()
        if dateCache.count > 20_000 { dateCache.removeAll(keepingCapacity: true) }
        dateCache[raw] = date
        dateCacheLock.unlock()
        return date
    }

    static func isWithinLast24Hours(_ date: Date, reference: Date = Date()) -> Bool {
        date > reference.addingTimeInterval(-86_400)
    }

    static func transactionLabel(for raw: String?) -> String {
        switch raw?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() {
        case "RENT": return "Wynajem"
        case "SELL", "SALE": return "Sprzedaż"
        default:
            let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return trimmed.isEmpty ? "Oferta" : trimmed
        }
    }

    static func pricePerSqm(price: Double?, area: Double?) -> Double? {
        guard let price, let area, area > 0 else { return nil }
        return price / area
    }

    /// Dzielnica z katalogu bywa placeholderem „Inny obszar” gdy pinezka nie ma konkretnej dzielnicy — wtedy nie pokazujemy jej.
    static func locationLine(city: String?, district: String?) -> String {
        let parts = [city, meaningfulDistrict(district)]
            .compactMap { value -> String? in
                let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                return trimmed.isEmpty ? nil : trimmed
            }
        return parts.joined(separator: " · ")
    }

    static func meaningfulDistrict(_ district: String?) -> String? {
        guard let raw = district?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        let key = raw
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "en_US_POSIX"))
            .lowercased()
        let placeholders: Set<String> = [
            "inny obszar",
            "other area",
            "other",
            "reszta kraju",
            "pozostale",
            "pozostałe",
            "caly kraj",
            "cały kraj",
            "n/a",
            "-",
            "—",
        ]
        if placeholders.contains(key) { return nil }
        if key.hasPrefix("inny ") { return nil }
        return raw
    }

    static func propertyTypeLabel(for raw: String?) -> String? {
        switch raw?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() {
        case "FLAT", "APARTMENT": return "Mieszkanie"
        case "HOUSE": return "Dom"
        case "PLOT", "LAND": return "Działka"
        case "PREMISES", "COMMERCIAL": return "Lokal użytkowy"
        case "GARAGE": return "Garaż"
        case "ROOM": return "Pokój"
        default:
            let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return trimmed.isEmpty ? nil : trimmed
        }
    }
}

extension EstateOffer {
    var displayDescription: String? {
        OfferPresentation.plainDescription(from: description)
    }

    var displayLocation: String {
        OfferPresentation.locationLine(city: city, district: district)
    }

    var displayDistrict: String? {
        OfferPresentation.meaningfulDistrict(district)
    }

    var resolvedCountry: ResolvedLocalityCountry {
        LocalityCountry.resolve(
            city: city,
            district: district,
            localityCountry: localityCountry,
            localityCountryCode: localityCountryCode
        )
    }

    var sortDate: Date {
        OfferPresentation.parseCreatedAt(createdAt)
    }

    var isWithinLast24Hours: Bool {
        OfferPresentation.isWithinLast24Hours(sortDate)
    }

    var transactionLabel: String {
        OfferPresentation.transactionLabel(for: transactionType)
    }

    var pricePerSqm: Double? {
        OfferPresentation.pricePerSqm(price: price, area: area)
    }

    var displayPricePerSqm: String {
        guard let value = pricePerSqm else { return "—" }
        return EOSFormat.pricePerSqmPLN(value)
    }

    var displayPropertyType: String? {
        OfferPresentation.propertyTypeLabel(for: propertyType)
    }

    /// True when the listing has been reduced by at least `minPercent` vs its list price.
    func isPriceReduced(minPercent: Int = 2) -> Bool {
        guard let pct = priceDiscountPercent else { return false }
        return pct >= minPercent
    }

    /// Compact badge text like "−12%" — never wraps.
    var priceDiscountBadgeText: String? {
        guard isPriceReduced(minPercent: 2), let pct = priceDiscountPercent else { return nil }
        return "−\(pct)%"
    }

    var transactionBadgeText: String {
        // Uppercase short labels that fit a media capsule without hyphenation.
        let raw = (transactionType ?? "").uppercased()
        if raw.contains("RENT") { return "WYNAJEM" }
        return "SPRZEDAŻ"
    }
}

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

        return text.isEmpty ? nil : text
    }

    static func parseCreatedAt(_ raw: String?) -> Date {
        guard let raw, !raw.isEmpty else { return .distantPast }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: raw) { return date }
        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: raw) { return date }
        let fallback = DateFormatter()
        fallback.locale = Locale(identifier: "en_US_POSIX")
        fallback.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        return fallback.date(from: raw) ?? .distantPast
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

    static func locationLine(city: String?, district: String?) -> String {
        [city, district]
            .compactMap { value in
                let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                return trimmed.isEmpty ? nil : trimmed
            }
            .joined(separator: " · ")
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
}

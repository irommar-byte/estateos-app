import UIKit

enum ShelfImageRenderer {
    /// Carousel hero — full-bleed photo; metadata via TVTopShelfCarouselItem.
    static func renderCarouselHero(background: UIImage?, scale: CGFloat) -> UIImage {
        renderBase(background: background, scale: scale, width: 2320, vignette: 0.42)
    }

    /// Sectioned card — photo + bottom metadata + fitted title on image.
    static func renderSectionedCard(offer: ShelfOfferCard, background: UIImage?, scale: CGFloat) -> UIImage {
        let width: CGFloat = 1920 * scale
        let height: CGFloat = 720 * scale
        let size = CGSize(width: width, height: height)

        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            let rect = CGRect(origin: .zero, size: size)
            let padding = 52 * scale
            let contentWidth = rect.width - padding * 2

            if let background {
                drawAspectFill(background, in: rect)
            } else {
                UIColor(white: 0.1, alpha: 1).setFill()
                context.fill(rect)
            }

            let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: [
                    UIColor.clear.cgColor,
                    UIColor.black.withAlphaComponent(0.1).cgColor,
                    UIColor.black.withAlphaComponent(0.55).cgColor,
                    UIColor.black.withAlphaComponent(0.9).cgColor,
                ] as CFArray,
                locations: [0.0, 0.5, 0.78, 1.0]
            )!
            context.cgContext.drawLinearGradient(
                gradient,
                start: CGPoint(x: rect.midX, y: rect.minY),
                end: CGPoint(x: rect.midX, y: rect.maxY),
                options: []
            )

            drawBadge(offer: offer, in: rect, padding: padding, scale: scale)

            var bottomY = rect.maxY - padding
            let priceLine = [offer.priceText, offer.pricePerSqmText]
                .filter { !$0.isEmpty }
                .joined(separator: "   ")
            if !priceLine.isEmpty {
                let font = UIFont.systemFont(ofSize: 26 * scale, weight: .semibold)
                let h = measure(text: priceLine, font: font, width: contentWidth)
                bottomY -= h
                draw(text: priceLine, font: font, color: UIColor(red: 0.45, green: 0.95, blue: 0.62, alpha: 1),
                     in: CGRect(x: padding, y: bottomY, width: contentWidth, height: h))
                bottomY -= 10 * scale
            }

            if !offer.location.isEmpty {
                let font = UIFont.systemFont(ofSize: 20 * scale, weight: .medium)
                let h = measure(text: offer.location, font: font, width: contentWidth)
                bottomY -= h
                draw(text: offer.location, font: font, color: UIColor.white.withAlphaComponent(0.88),
                     in: CGRect(x: padding, y: bottomY, width: contentWidth, height: h))
                bottomY -= 12 * scale
            }

            let titleTop = padding + 72 * scale
            let maxTitleHeight = max(48 * scale, bottomY - titleTop)
            drawFittingTitle(
                offer.title,
                in: CGRect(x: padding, y: titleTop, width: contentWidth, height: maxTitleHeight),
                scale: scale
            )
        }
    }

    private static func renderBase(background: UIImage?, scale: CGFloat, width: CGFloat, vignette: CGFloat) -> UIImage {
        let height: CGFloat = 720 * scale
        let size = CGSize(width: width * scale, height: height)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            let rect = CGRect(origin: .zero, size: size)
            if let background {
                drawAspectFill(background, in: rect)
            } else {
                UIColor(white: 0.1, alpha: 1).setFill()
                context.fill(rect)
            }
            let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: [
                    UIColor.clear.cgColor,
                    UIColor.black.withAlphaComponent(0.12).cgColor,
                    UIColor.black.withAlphaComponent(vignette).cgColor,
                ] as CFArray,
                locations: [0.0, 0.62, 1.0]
            )!
            context.cgContext.drawLinearGradient(
                gradient,
                start: CGPoint(x: rect.midX, y: rect.minY),
                end: CGPoint(x: rect.midX, y: rect.maxY),
                options: []
            )
        }
    }

    private static func drawBadge(offer: ShelfOfferCard, in rect: CGRect, padding: CGFloat, scale: CGFloat) {
        let badgeText = offer.transactionLabel.uppercased()
        let badgeFont = UIFont.systemFont(ofSize: 14 * scale, weight: .heavy)
        let badgeSize = (badgeText as NSString).size(withAttributes: [.font: badgeFont])
        let badgePaddingX = 14 * scale
        let badgePaddingY = 8 * scale
        let badgeRect = CGRect(
            x: rect.maxX - padding - badgeSize.width - badgePaddingX * 2,
            y: padding,
            width: badgeSize.width + badgePaddingX * 2,
            height: badgeSize.height + badgePaddingY * 2
        )
        let path = UIBezierPath(roundedRect: badgeRect, cornerRadius: badgeRect.height / 2)
        (offer.isRent ? UIColor.systemBlue.withAlphaComponent(0.45) : UIColor.systemGreen.withAlphaComponent(0.38)).setFill()
        path.fill()
        draw(text: badgeText, font: badgeFont, color: .white,
             in: CGRect(x: badgeRect.minX + badgePaddingX, y: badgeRect.minY + badgePaddingY,
                        width: badgeSize.width, height: badgeSize.height))
    }

    private static func drawAspectFill(_ image: UIImage, in rect: CGRect) {
        let imageSize = image.size
        guard imageSize.width > 0, imageSize.height > 0 else { return }
        let scale = max(rect.width / imageSize.width, rect.height / imageSize.height)
        let drawRect = CGRect(
            x: rect.midX - (imageSize.width * scale) / 2,
            y: rect.midY - (imageSize.height * scale) / 2,
            width: imageSize.width * scale,
            height: imageSize.height * scale
        )
        image.draw(in: drawRect)
    }

    private static func drawFittingTitle(_ text: String, in bounds: CGRect, scale: CGFloat) {
        let sizes: [CGFloat] = stride(from: 36 * scale, through: 18 * scale, by: -2 * scale).map { $0 }
        for size in sizes {
            let font = UIFont.systemFont(ofSize: size, weight: .bold)
            let paragraph = NSMutableParagraphStyle()
            paragraph.lineBreakMode = .byWordWrapping
            paragraph.alignment = .left
            let attrs: [NSAttributedString.Key: Any] = [
                .font: font,
                .foregroundColor: UIColor.white,
                .paragraphStyle: paragraph,
            ]
            let bounding = (text as NSString).boundingRect(
                with: CGSize(width: bounds.width, height: .greatestFiniteMagnitude),
                options: [.usesLineFragmentOrigin, .usesFontLeading],
                attributes: attrs,
                context: nil
            )
            if bounding.height <= bounds.height {
                let y = bounds.maxY - ceil(bounding.height)
                (text as NSString).draw(
                    with: CGRect(x: bounds.minX, y: y, width: bounds.width, height: ceil(bounding.height)),
                    options: [.usesLineFragmentOrigin, .usesFontLeading],
                    attributes: attrs,
                    context: nil
                )
                return
            }
        }
    }

    private static func measure(text: String, font: UIFont, width: CGFloat) -> CGFloat {
        let attrs: [NSAttributedString.Key: Any] = [.font: font]
        let bounding = (text as NSString).boundingRect(
            with: CGSize(width: width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: attrs,
            context: nil
        )
        return ceil(bounding.height)
    }

    private static func draw(text: String, font: UIFont, color: UIColor, in rect: CGRect) {
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
        (text as NSString).draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attrs, context: nil)
    }
}

struct ShelfOfferCard {
    let id: Int
    let title: String
    let priceText: String
    let pricePerSqmText: String
    let location: String
    let transactionLabel: String
    let isRent: Bool

    var contextTitle: String { transactionLabel }

    var summary: String {
        [priceText, pricePerSqmText, location].filter { !$0.isEmpty }.joined(separator: "  ·  ")
    }
}

enum ShelfOfferFormatting {
    static func card(from offer: TopShelfOffer) -> ShelfOfferCard {
        ShelfOfferCard(
            id: offer.id,
            title: offer.title,
            priceText: formatPrice(offer.price),
            pricePerSqmText: formatPricePerSqm(price: offer.price, area: offer.area),
            location: locationLine(city: offer.city, district: offer.district),
            transactionLabel: transactionLabel(for: offer.transactionType),
            isRent: offer.transactionType?.uppercased() == "RENT"
        )
    }

    static func isWithinLast24Hours(_ raw: String?) -> Bool {
        guard let raw, !raw.isEmpty else { return false }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
        guard let date else { return false }
        return date > Date().addingTimeInterval(-86_400)
    }

    static func transactionLabel(for raw: String?) -> String {
        switch raw?.uppercased() {
        case "RENT": return "Wynajem"
        case "SELL", "SALE": return "Sprzedaż"
        default: return "Oferta"
        }
    }

    static func locationLine(city: String?, district: String?) -> String {
        [city, district]
            .compactMap { value in
                let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                return trimmed.isEmpty ? nil : trimmed
            }
            .joined(separator: " · ")
    }

    static func formatPrice(_ value: Double?) -> String {
        guard let value else { return "Cena na zapytanie" }
        return "\(grouped(Int(value.rounded()))) PLN"
    }

    static func formatPricePerSqm(price: Double?, area: Double?) -> String {
        guard let price, let area, area > 0 else { return "" }
        return "\(grouped(Int((price / area).rounded()))) zł/m²"
    }

    private static func grouped(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = " "
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}

enum TopShelfSharedPreferences {
    private static let suiteName = "group.pl.estateos.app.tvos"
    private static let styleKey = "topShelfPresentationStyle"

    private static var store: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }

    static var isSectioned: Bool {
        let raw = store.string(forKey: styleKey) ?? "carousel"
        return raw == "sectioned"
    }
}

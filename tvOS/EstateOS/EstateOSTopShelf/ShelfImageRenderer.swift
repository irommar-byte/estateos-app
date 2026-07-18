import UIKit
import ImageIO

enum ShelfImageRenderer {
  /// Carousel hero — full-bleed photo with cinematic centered title overlay.
  static func renderCarouselHero(offer: ShelfOfferCard, background: UIImage?, scale: CGFloat) -> UIImage {
    let width: CGFloat = 2320 * scale
    let height: CGFloat = 720 * scale
    let size = CGSize(width: width, height: height)

    let renderer = UIGraphicsImageRenderer(size: size)
    return renderer.image { context in
      let rect = CGRect(origin: .zero, size: size)
      let padding = 96 * scale

      if let background {
        drawAspectFill(background, in: rect)
      } else {
        UIColor(white: 0.08, alpha: 1).setFill()
        context.fill(rect)
      }

      drawCinematicOverlay(in: rect, context: context.cgContext)
      drawBadge(offer: offer, in: rect, padding: padding, scale: scale)

      let contentWidth = rect.width - padding * 2
      let clusterHeight = rect.height * 0.52
      let clusterRect = CGRect(
        x: padding,
        y: rect.midY - clusterHeight / 2,
        width: contentWidth,
        height: clusterHeight
      )

      drawTitleCluster(
        title: offer.title,
        subtitle: offer.location,
        in: clusterRect,
        scale: scale
      )

      if !offer.priceText.isEmpty {
        let priceFont = roundedFont(size: 30 * scale, weight: .semibold)
        let priceHeight = measure(text: offer.priceText, font: priceFont, width: contentWidth)
        let priceRect = CGRect(
          x: padding,
          y: rect.maxY - padding - priceHeight,
          width: contentWidth,
          height: priceHeight
        )
        drawCentered(
          text: offer.priceText,
          font: priceFont,
          color: UIColor(red: 0.42, green: 0.94, blue: 0.62, alpha: 1),
          in: priceRect,
          shadow: true
        )
      }
    }
  }

  /// Sectioned card — photo with centered title cluster.
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

      drawCinematicOverlay(in: rect, context: context.cgContext)
      drawBadge(offer: offer, in: rect, padding: padding, scale: scale)

      let clusterHeight = rect.height * 0.58
      let clusterRect = CGRect(
        x: padding,
        y: rect.midY - clusterHeight / 2 - 12 * scale,
        width: contentWidth,
        height: clusterHeight
      )
      drawTitleCluster(
        title: offer.title,
        subtitle: [offer.priceText, offer.location].filter { !$0.isEmpty }.joined(separator: "  ·  "),
        in: clusterRect,
        scale: scale
      )
    }
  }

  private static func drawCinematicOverlay(in rect: CGRect, context: CGContext) {
    let topGradient = CGGradient(
      colorsSpace: CGColorSpaceCreateDeviceRGB(),
      colors: [
        UIColor.black.withAlphaComponent(0.42).cgColor,
        UIColor.clear.cgColor,
      ] as CFArray,
      locations: [0.0, 1.0]
    )!
    context.drawLinearGradient(
      topGradient,
      start: CGPoint(x: rect.midX, y: rect.minY),
      end: CGPoint(x: rect.midX, y: rect.minY + rect.height * 0.35),
      options: []
    )

    let bottomGradient = CGGradient(
      colorsSpace: CGColorSpaceCreateDeviceRGB(),
      colors: [
        UIColor.clear.cgColor,
        UIColor.black.withAlphaComponent(0.18).cgColor,
        UIColor.black.withAlphaComponent(0.62).cgColor,
      ] as CFArray,
      locations: [0.0, 0.55, 1.0]
    )!
    context.drawLinearGradient(
      bottomGradient,
      start: CGPoint(x: rect.midX, y: rect.minY + rect.height * 0.45),
      end: CGPoint(x: rect.midX, y: rect.maxY),
      options: []
    )

    let centerGlow = CGGradient(
      colorsSpace: CGColorSpaceCreateDeviceRGB(),
      colors: [
        UIColor.black.withAlphaComponent(0.55).cgColor,
        UIColor.black.withAlphaComponent(0.2).cgColor,
        UIColor.clear.cgColor,
      ] as CFArray,
      locations: [0.0, 0.45, 1.0]
    )!
    context.drawRadialGradient(
      centerGlow,
      startCenter: CGPoint(x: rect.midX, y: rect.midY),
      startRadius: 0,
      endCenter: CGPoint(x: rect.midX, y: rect.midY),
      endRadius: max(rect.width, rect.height) * 0.42,
      options: []
    )
  }

  private static func drawTitleCluster(title: String, subtitle: String, in bounds: CGRect, scale: CGFloat) {
    let textWidth = bounds.width * 0.78
    let subtitleFont = luxurySubtitleFont(size: 20 * scale)
    let subtitleGap = 30 * scale
    let subtitleHeight = subtitle.isEmpty
      ? 0
      : measure(text: subtitle, font: subtitleFont, width: textWidth)

    let titleAreaHeight = max(64 * scale, bounds.height - subtitleHeight - (subtitle.isEmpty ? 0 : subtitleGap))
    let measureRect = CGRect(x: 0, y: 0, width: textWidth, height: titleAreaHeight)
    let titleSize = measureTwoLineTitle(title, in: measureRect, scale: scale)

    let combinedHeight = titleSize.height + (subtitle.isEmpty ? 0 : subtitleGap + subtitleHeight)
    let blockTop = bounds.minY + (bounds.height - combinedHeight) / 2

    let titleRect = CGRect(
      x: bounds.midX - textWidth / 2,
      y: blockTop,
      width: textWidth,
      height: titleSize.height
    )
    _ = drawCenteredTwoLineTitle(title, in: titleRect, scale: scale)

    if !subtitle.isEmpty {
      let subtitleRect = CGRect(
        x: bounds.midX - textWidth / 2,
        y: titleRect.maxY + subtitleGap,
        width: textWidth,
        height: subtitleHeight
      )
      drawCentered(
        text: subtitle,
        font: subtitleFont,
        color: UIColor.white.withAlphaComponent(0.88),
        in: subtitleRect,
        shadow: true
      )
    }
  }

  private static func measureTwoLineTitle(_ text: String, in bounds: CGRect, scale: CGFloat) -> CGSize {
    let cleaned = text.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleaned.isEmpty else { return .zero }

    let split = balancedTwoLineSplit(cleaned)
    let maxWidth = bounds.width
    let lineGap = 10 * scale
    let sizes: [CGFloat] = stride(from: 84 * scale, through: 34 * scale, by: -2 * scale).map { $0 }

    for size in sizes {
      let font = luxuryTitleFont(size: size)
      let attrs = titleAttributes(font: font, kern: 0.45 * scale)
      let first = measureMultiline(text: split.first, attrs: attrs, maxWidth: maxWidth)
      let second = split.second.map { measureMultiline(text: $0, attrs: attrs, maxWidth: maxWidth) }
      if first.height > size * 1.7 { continue }
      if let second, second.height > size * 1.7 { continue }
      let combinedHeight = first.height + (second?.height ?? 0) + (split.second == nil ? 0 : lineGap)
      if combinedHeight <= bounds.height {
        return CGSize(width: maxWidth, height: combinedHeight)
      }
    }
    return CGSize(width: maxWidth, height: min(bounds.height, 80 * scale))
  }

  @discardableResult
  private static func drawCenteredTwoLineTitle(_ text: String, in bounds: CGRect, scale: CGFloat) -> CGSize {
    let cleaned = text.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleaned.isEmpty else { return .zero }

    let split = balancedTwoLineSplit(cleaned)
    let maxWidth = bounds.width
    let lineGap = 10 * scale
    let sizes: [CGFloat] = stride(from: 84 * scale, through: 34 * scale, by: -2 * scale).map { $0 }

    for size in sizes {
      let font = luxuryTitleFont(size: size)
      let attrs = titleAttributes(font: font, kern: 0.45 * scale)
      let first = measureMultiline(text: split.first, attrs: attrs, maxWidth: maxWidth)
      let second = split.second.map { measureMultiline(text: $0, attrs: attrs, maxWidth: maxWidth) }

      if first.height > size * 1.7 { continue }
      if let second, second.height > size * 1.7 { continue }

      let combinedHeight = first.height + (second?.height ?? 0) + (split.second == nil ? 0 : lineGap)
      if combinedHeight > bounds.height { continue }

      let startY = bounds.minY + (bounds.height - combinedHeight) / 2
      let firstRect = CGRect(x: bounds.minX, y: startY, width: maxWidth, height: first.height)
      drawCenteredAttributed(text: split.first, attrs: attrs, in: firstRect)

      if let secondText = split.second, let secondSize = second {
        let secondRect = CGRect(
          x: bounds.minX,
          y: firstRect.maxY + lineGap,
          width: maxWidth,
          height: secondSize.height
        )
        drawCenteredAttributed(text: secondText, attrs: attrs, in: secondRect)
      }
      return CGSize(width: maxWidth, height: combinedHeight)
    }

    let fallback = luxuryTitleFont(size: 32 * scale)
    let attrs = titleAttributes(font: fallback, kern: 0.3 * scale)
    let fitted = measureMultiline(text: cleaned, attrs: attrs, maxWidth: maxWidth)
    let drawHeight = min(fitted.height, bounds.height)
    let drawRect = CGRect(
      x: bounds.minX,
      y: bounds.minY + (bounds.height - drawHeight) / 2,
      width: maxWidth,
      height: drawHeight
    )
    drawCenteredAttributed(text: cleaned, attrs: attrs, in: drawRect)
    return CGSize(width: maxWidth, height: drawHeight)
  }

  private static func balancedTwoLineSplit(_ text: String) -> (first: String, second: String?) {
    let words = text
      .split(whereSeparator: { $0.isWhitespace })
      .map(String.init)
    guard words.count > 3 else { return (text, nil) }

    var bestIndex = 1
    var smallestDelta = Int.max
    for idx in 1..<(words.count) {
      let first = words[0..<idx].joined(separator: " ")
      let second = words[idx...].joined(separator: " ")
      let delta = abs(first.count - second.count)
      if delta < smallestDelta {
        smallestDelta = delta
        bestIndex = idx
      }
    }

    let first = words[0..<bestIndex].joined(separator: " ")
    let second = words[bestIndex...].joined(separator: " ")
    return (first, second)
  }

  private static func measureMultiline(
    text: String,
    attrs: [NSAttributedString.Key: Any],
    maxWidth: CGFloat
  ) -> CGSize {
    let bounding = (text as NSString).boundingRect(
      with: CGSize(width: maxWidth, height: .greatestFiniteMagnitude),
      options: [.usesLineFragmentOrigin, .usesFontLeading],
      attributes: attrs,
      context: nil
    )
    return CGSize(width: min(ceil(bounding.width), maxWidth), height: ceil(bounding.height))
  }

  private static func titleAttributes(font: UIFont, kern: CGFloat = 0) -> [NSAttributedString.Key: Any] {
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineBreakMode = .byWordWrapping
    paragraph.alignment = .center
    paragraph.lineSpacing = font.pointSize * 0.12
    var attrs: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: UIColor.white,
      .paragraphStyle: paragraph,
    ]
    if kern > 0 {
      attrs[.kern] = kern
    }
    return attrs
  }

  private static func drawCenteredAttributed(text: String, attrs: [NSAttributedString.Key: Any], in rect: CGRect) {
    let shadow = NSShadow()
    shadow.shadowColor = UIColor.black.withAlphaComponent(0.78)
    shadow.shadowOffset = CGSize(width: 0, height: 4)
    shadow.shadowBlurRadius = 18
    var shadowed = attrs
    shadowed[.shadow] = shadow

    (text as NSString).draw(
      with: rect,
      options: [.usesLineFragmentOrigin, .usesFontLeading, .truncatesLastVisibleLine],
      attributes: shadowed,
      context: nil
    )
  }

  private static func drawCentered(
    text: String,
    font: UIFont,
    color: UIColor,
    in rect: CGRect,
    shadow: Bool
  ) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byTruncatingTail
    var attrs: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: color,
      .paragraphStyle: paragraph,
    ]
    if shadow {
      let s = NSShadow()
      s.shadowColor = UIColor.black.withAlphaComponent(0.65)
      s.shadowOffset = CGSize(width: 0, height: 2)
      s.shadowBlurRadius = 10
      attrs[.shadow] = s
    }
    (text as NSString).draw(
      with: rect,
      options: [.usesLineFragmentOrigin, .usesFontLeading],
      attributes: attrs,
      context: nil
    )
  }

  private static func luxuryTitleFont(size: CGFloat) -> UIFont {
    let system = UIFont.systemFont(ofSize: size, weight: .medium)
    if let serif = system.fontDescriptor.withDesign(.serif),
       let italic = serif.withSymbolicTraits([.traitItalic]) {
      return UIFont(descriptor: italic, size: size)
    }
    return system
  }

  private static func luxurySubtitleFont(size: CGFloat) -> UIFont {
    let system = UIFont.systemFont(ofSize: size, weight: .regular)
    if let descriptor = system.fontDescriptor.withDesign(.serif) {
      return UIFont(descriptor: descriptor, size: size)
    }
    return system
  }

  private static func roundedFont(size: CGFloat, weight: UIFont.Weight) -> UIFont {
    let system = UIFont.systemFont(ofSize: size, weight: weight)
    if let descriptor = system.fontDescriptor.withDesign(.rounded) {
      return UIFont(descriptor: descriptor, size: size)
    }
    return system
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
    draw(
      text: badgeText,
      font: badgeFont,
      color: .white,
      in: CGRect(
        x: badgeRect.minX + badgePaddingX,
        y: badgeRect.minY + badgePaddingY,
        width: badgeSize.width,
        height: badgeSize.height
      )
    )
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

  private static func measure(text: String, font: UIFont, width: CGFloat) -> CGFloat {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    let attrs: [NSAttributedString.Key: Any] = [.font: font, .paragraphStyle: paragraph]
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
    if let suite = UserDefaults(suiteName: suiteName) { return suite }
    return .standard
  }

  static var presentationRawValue: String {
    if let raw = store.string(forKey: styleKey), !raw.isEmpty {
      return raw
    }
    if let url = FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: suiteName)?
      .appendingPathComponent("topShelfPresentationStyle.txt"),
       let data = try? Data(contentsOf: url),
       let raw = String(data: data, encoding: .utf8)?
        .trimmingCharacters(in: .whitespacesAndNewlines),
       !raw.isEmpty {
      return raw
    }
    return "carousel"
  }

  static var isSectioned: Bool {
    presentationRawValue == "sectioned"
  }
}

enum TopShelfImageLoader {
  private static let maxPixelSize: CGFloat = 1280

  static func loadImage(from url: URL, timeout: TimeInterval) async -> UIImage? {
    await withTaskGroup(of: UIImage?.self) { group in
      group.addTask {
        await downloadImage(from: url, timeout: timeout)
      }
      group.addTask {
        try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
        return nil
      }
      let first = await group.next() ?? nil
      group.cancelAll()
      return first
    }
  }

  private static func downloadImage(from url: URL, timeout: TimeInterval) async -> UIImage? {
    var request = URLRequest(url: url)
    request.timeoutInterval = timeout
    request.setValue("EstateOS-tvOS-TopShelf/1.0", forHTTPHeaderField: "User-Agent")

    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
        return nil
      }
      return downsampledImage(from: data)
    } catch {
      return nil
    }
  }

  private static func downsampledImage(from data: Data) -> UIImage? {
    let options: [CFString: Any] = [
      kCGImageSourceShouldCache: false,
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
      kCGImageSourceCreateThumbnailWithTransform: true,
    ]
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
      if let image = UIImage(data: data) { return image }
      return nil
    }
    return UIImage(cgImage: cgImage)
  }
}

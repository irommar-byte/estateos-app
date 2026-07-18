import SwiftUI
import UIKit

// MARK: - Glass surfaces

struct EOSGlassSurface: ViewModifier {
    var cornerRadius: CGFloat = 24
    var opacity: Double = 0.42

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(.ultraThinMaterial.opacity(opacity))
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.34),
                                Color.white.opacity(0.08),
                                Color.white.opacity(0.18),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(color: Color.black.opacity(0.35), radius: 18, y: 10)
    }
}

extension View {
    func eosGlass(cornerRadius: CGFloat = 24, opacity: Double = 0.42) -> some View {
        modifier(EOSGlassSurface(cornerRadius: cornerRadius, opacity: opacity))
    }
}

// MARK: - Native Apple TV focus (scale only — no white fill)

struct EOSFocusParallax: ViewModifier {
    @Environment(\.isFocused) private var isFocused
    var lift: CGFloat = 10
    var scale: CGFloat = 1.12

    func body(content: Content) -> some View {
        content
            .scaleEffect(isFocused ? scale : 1.0, anchor: .center)
            .offset(y: isFocused ? -lift : 0)
            .shadow(
                color: .black.opacity(isFocused ? 0.55 : 0.2),
                radius: isFocused ? 28 : 10,
                y: isFocused ? 18 : 6
            )
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

extension View {
    /// Disables system white focus plate; applies Apple-TV-icon style scale.
    func eosFocusParallax(lift: CGFloat = 10, scale: CGFloat = 1.12) -> some View {
        modifier(EOSFocusParallax(lift: lift, scale: scale))
    }

    func eosTVIconFocus(scale: CGFloat = 1.12, lift: CGFloat = 10) -> some View {
        self
            .buttonStyle(.plain)
            .focusEffectDisabled()
            .eosFocusParallax(lift: lift, scale: scale)
    }

    func eosFocusRing(cornerRadius: CGFloat = 18, accent: Color = .white) -> some View {
        modifier(EOSFocusRing(cornerRadius: cornerRadius, accent: accent))
    }
}

struct EOSFocusRing: ViewModifier {
    @Environment(\.isFocused) private var isFocused
    var cornerRadius: CGFloat
    var accent: Color

    func body(content: Content) -> some View {
        content
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

struct EOSBrandButtonStyle: ButtonStyle {
    var selected: Bool
    var accent: Color
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(selected ? accent : Color.white.opacity(0.1))
            )
            .foregroundStyle(selected ? Color.black : Color.white.opacity(0.92))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(selected ? 0.15 : 0.08), lineWidth: 1)
            )
            .scaleEffect(isFocused ? 1.1 : (configuration.isPressed ? 0.98 : 1.0))
            .shadow(color: .black.opacity(isFocused ? 0.45 : 0.15), radius: isFocused ? 22 : 8, y: isFocused ? 14 : 4)
            .animation(.easeOut(duration: 0.18), value: isFocused)
            .animation(.easeOut(duration: 0.15), value: selected)
    }
}

struct EOSChipButtonStyle: ButtonStyle {
    var selected: Bool
    var accent: Color
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.callout.weight(.semibold))
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(
                Capsule(style: .continuous)
                    .fill(selected ? accent : Color.white.opacity(0.12))
            )
            .foregroundStyle(selected ? Color.black : Color.white.opacity(0.92))
            .overlay(
                Capsule(style: .continuous)
                    .stroke(Color.white.opacity(selected ? 0.2 : 0.08), lineWidth: 1)
            )
            .scaleEffect(isFocused ? 1.12 : (configuration.isPressed ? 0.98 : 1.0))
            .shadow(color: .black.opacity(isFocused ? 0.4 : 0), radius: isFocused ? 18 : 0, y: isFocused ? 10 : 0)
            .animation(.easeOut(duration: 0.18), value: isFocused)
            .animation(.easeOut(duration: 0.15), value: selected)
    }
}

// MARK: - Media helpers

enum EOSOfferMedia {
    static func imageURL(from raw: String?) -> URL? {
        let trimmed = String(raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return URL(string: trimmed)
        }
        if trimmed.hasPrefix("/") {
            return URL(string: AppConfig.apiBaseURL.absoluteString + trimmed)
        }
        let base = AppConfig.apiBaseURL.absoluteString.hasSuffix("/")
            ? AppConfig.apiBaseURL.absoluteString
            : AppConfig.apiBaseURL.absoluteString + "/"
        return URL(string: base + trimmed)
    }

    static func primaryImageURL(for offer: EstateOffer) -> URL? {
        imageURLs(for: offer).first
    }

    static func imageURLs(for offer: EstateOffer) -> [URL] {
        var seen = Set<String>()
        return offer.imageCandidates
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .compactMap { raw -> URL? in
                guard !seen.contains(raw) else { return nil }
                seen.insert(raw)
                return imageURL(from: raw)
            }
    }
}

struct EOSFullBleedOfferImage: View {
    let url: URL?

    var body: some View {
        GeometryReader { proxy in
            Group {
                if let url {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(width: proxy.size.width, height: proxy.size.height)
                                .clipped()
                        default:
                            placeholder
                        }
                    }
                } else {
                    placeholder
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .ignoresSafeArea()
    }

    private var placeholder: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [Color(white: 0.12), Color(white: 0.04)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay {
                Image(systemName: "photo")
                    .font(.system(size: 48, weight: .medium))
                    .foregroundStyle(.white.opacity(0.28))
            }
    }
}

struct EOSOfferThumbnail: View {
    let url: URL?
    var height: CGFloat = 220
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure, .empty:
                        placeholder
                    @unknown default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(height: height)
        .clipped()
        .animation(.easeOut(duration: 0.12), value: isFocused)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var placeholder: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [Color.white.opacity(0.1), Color.white.opacity(0.04)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay {
                Image(systemName: "photo")
                    .font(.system(size: 30, weight: .medium))
                    .foregroundStyle(.white.opacity(0.35))
            }
    }
}

// MARK: - Typography helpers

enum EOSFormat {
    static func pricePLN(_ value: Double?) -> String {
        guard let value else { return "Cena na zapytanie" }
        return "\(grouped(Int(value.rounded()))) PLN"
    }

    static func pricePerSqmPLN(_ value: Double) -> String {
        "\(grouped(Int(value.rounded()))) zł/m²"
    }

    private static func grouped(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = " "
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}


// MARK: - Poster cards (no system white focus plate)

struct EOSPosterButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        // No scaleEffect — scaling overflowed ScrollView clips / caused ghost layers.
        configuration.label
            .opacity(configuration.isPressed ? 0.92 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct EOSPosterCardChrome: ViewModifier {
    @Environment(\.isFocused) private var isFocused
    var cornerRadius: CGFloat = 22
    var accent: Color = .cyan

    func body(content: Content) -> some View {
        content
            .padding(18)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(Color(white: 0.09).opacity(0.97))
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(
                        isFocused ? accent : Color.white.opacity(0.12),
                        lineWidth: isFocused ? 3 : 1
                    )
            )
            .shadow(
                color: .black.opacity(isFocused ? 0.45 : 0.2),
                radius: isFocused ? 18 : 8,
                y: isFocused ? 10 : 4
            )
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

extension View {
    func eosPosterCard(cornerRadius: CGFloat = 22, accent: Color = .cyan) -> some View {
        modifier(EOSPosterCardChrome(cornerRadius: cornerRadius, accent: accent))
    }
}

/// Scales body text so the full string fits in the available frame (TV reading).
struct EOSScreenFitText: View {
    let text: String
    var maxSize: CGFloat = 42
    var minSize: CGFloat = 16
    var lineSpacing: CGFloat = 6

    var body: some View {
        GeometryReader { geo in
            let size = Self.fittingSize(text: text, in: geo.size, max: maxSize, min: minSize, lineSpacing: lineSpacing)
            Text(text)
                .font(.system(size: size, weight: .regular, design: .rounded))
                .foregroundStyle(.white.opacity(0.94))
                .lineSpacing(lineSpacing * (size / 24))
                .multilineTextAlignment(.leading)
                .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
        }
    }

    private static func fittingSize(text: String, in size: CGSize, max: CGFloat, min: CGFloat, lineSpacing: CGFloat) -> CGFloat {
        guard size.width > 40, size.height > 40 else { return min }
        var lo = min
        var hi = max
        var best = min
        let insetW = size.width
        let insetH = size.height
        while hi - lo > 0.5 {
            let mid = (lo + hi) / 2
            let height = measure(text: text, fontSize: mid, width: insetW, lineSpacing: lineSpacing * (mid / 24))
            if height <= insetH {
                best = mid
                lo = mid
            } else {
                hi = mid
            }
        }
        return best
    }

    private static func measure(text: String, fontSize: CGFloat, width: CGFloat, lineSpacing: CGFloat) -> CGFloat {
        let font = UIFont.systemFont(ofSize: fontSize, weight: .regular)
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = lineSpacing
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .paragraphStyle: paragraph,
        ]
        let rect = (text as NSString).boundingRect(
            with: CGSize(width: width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: attrs,
            context: nil
        )
        return ceil(rect.height)
    }
}


struct EOSListingStatsRow: View {
    let views: Int
    let favorites: Int
    var accent: Color = .green

    var body: some View {
        HStack(spacing: 14) {
            Label(Self.format(views), systemImage: "eye.fill")
            Label(Self.format(favorites), systemImage: "heart.fill")
            Spacer(minLength: 0)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(accent.opacity(0.95))
        .labelStyle(.titleAndIcon)
    }

    private static func format(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = " "
        return formatter.string(from: NSNumber(value: max(0, value))) ?? "\(value)"
    }
}

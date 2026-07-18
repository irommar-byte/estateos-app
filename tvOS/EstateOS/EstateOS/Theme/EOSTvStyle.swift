import SwiftUI
import UIKit

// MARK: - Luxury TV design system (Apple-like restraint)

enum EOSPalette {
    static let canvasTop = Color(red: 0.06, green: 0.06, blue: 0.07)
    static let canvas = Color.black
    static let elevated = Color(white: 0.10)
    static let textPrimary = Color.white.opacity(0.96)
    static let textSecondary = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.38)
    static let hairline = Color.white.opacity(0.14)
    static let hairlineSoft = Color.white.opacity(0.08)
    /// Brand gold — used sparingly (splash, rare accents).
    static let gold = Color(red: 0.83, green: 0.69, blue: 0.22)
    /// Muted sage (Home) / steel (Car) — never neon fills on chrome.
    static let home = Color(red: 0.62, green: 0.74, blue: 0.64)
    static let car = Color(red: 0.58, green: 0.70, blue: 0.78)

    static func accent(for brand: CatalogBrand) -> Color {
        brand == .car ? car : home
    }
}

enum EOSTvSpacing {
    static let screenHorizontal: CGFloat = 64
    static let screenVertical: CGFloat = 28
    static let chromeGap: CGFloat = 14
    static let sectionGap: CGFloat = 36
    static let cardPad: CGFloat = 16
    static let controlPad: CGFloat = 14
}

// MARK: - Glass surfaces

struct EOSGlassSurface: ViewModifier {
    var cornerRadius: CGFloat = 24
    var opacity: Double = 0.32

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
    func eosGlass(cornerRadius: CGFloat = 24, opacity: Double = 0.32) -> some View {
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

extension AnyTransition {
    /// The one shared "mode change" transition — crossfade + a whisper of scale and blur so
    /// switching between hero / info / description / gallery feels like one continuous surface
    /// rather than separate screens being swapped.
    static var eosModeTransition: AnyTransition {
        .asymmetric(
            insertion: .opacity
                .combined(with: .scale(scale: 1.035, anchor: .center))
                .combined(with: .modifier(
                    active: EOSBlurTransitionModifier(radius: 14),
                    identity: EOSBlurTransitionModifier(radius: 0)
                )),
            removal: .opacity
                .combined(with: .scale(scale: 0.975, anchor: .center))
        )
    }
}

private struct EOSBlurTransitionModifier: ViewModifier {
    let radius: CGFloat
    func body(content: Content) -> some View {
        content.blur(radius: radius)
    }
}

/// Directional "parallax" swap for full-bleed gallery photos — the incoming shot drifts in
/// from the side you navigated toward and gently overshoots on scale, so cycling images feels
/// dimensional rather than a flat crossfade.
enum EOSGallerySlideDirection {
    case none, forward, back

    var transition: AnyTransition {
        switch self {
        case .forward:
            return .asymmetric(
                insertion: .move(edge: .trailing).combined(with: .opacity).combined(with: .scale(scale: 1.08, anchor: .center)),
                removal: .move(edge: .leading).combined(with: .opacity)
            )
        case .back:
            return .asymmetric(
                insertion: .move(edge: .leading).combined(with: .opacity).combined(with: .scale(scale: 1.08, anchor: .center)),
                removal: .move(edge: .trailing).combined(with: .opacity)
            )
        case .none:
            return .opacity.combined(with: .scale(scale: 1.04, anchor: .center))
        }
    }
}

struct EOSFocusRing: ViewModifier {
    @Environment(\.isFocused) private var isFocused
    var cornerRadius: CGFloat
    var accent: Color

    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(accent.opacity(isFocused ? 0.95 : 0), lineWidth: isFocused ? 3 : 0)
            )
            .shadow(color: accent.opacity(isFocused ? 0.35 : 0), radius: isFocused ? 16 : 0, y: isFocused ? 8 : 0)
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

// MARK: - Spacing tokens

struct EOSBrandButtonStyle: ButtonStyle {
    var selected: Bool
    var accent: Color
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(selected ? Color.white.opacity(0.14) : Color.white.opacity(0.04))
            )
            .foregroundStyle(selected ? EOSPalette.textPrimary : EOSPalette.textSecondary)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(
                        isFocused ? Color.white.opacity(0.55)
                            : (selected ? accent.opacity(0.55) : EOSPalette.hairlineSoft),
                        lineWidth: isFocused ? 2 : 1
                    )
            )
            .scaleEffect(isFocused ? 1.04 : (configuration.isPressed ? 0.99 : 1.0))
            .shadow(color: .black.opacity(isFocused ? 0.35 : 0.08), radius: isFocused ? 14 : 4, y: isFocused ? 8 : 2)
            .animation(.easeOut(duration: 0.16), value: isFocused)
            .animation(.easeOut(duration: 0.14), value: selected)
    }
}

struct EOSChipButtonStyle: ButtonStyle {
    var selected: Bool
    var accent: Color
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.callout.weight(.semibold))
            .padding(.horizontal, 22)
            .padding(.vertical, 12)
            .background(
                Capsule(style: .continuous)
                    .fill(selected ? Color.white.opacity(0.16) : Color.white.opacity(0.05))
            )
            .foregroundStyle(selected ? EOSPalette.textPrimary : EOSPalette.textSecondary)
            .overlay(
                Capsule(style: .continuous)
                    .stroke(
                        isFocused ? Color.white.opacity(0.65)
                            : (selected ? accent.opacity(0.45) : EOSPalette.hairlineSoft),
                        lineWidth: isFocused ? 2 : 1
                    )
            )
            .scaleEffect(isFocused ? 1.08 : (configuration.isPressed ? 0.98 : 1.0))
            .shadow(color: .black.opacity(isFocused ? 0.32 : 0), radius: isFocused ? 14 : 0, y: isFocused ? 8 : 0)
            .animation(.easeOut(duration: 0.16), value: isFocused)
            .animation(.easeOut(duration: 0.14), value: selected)
    }
}

/// Quiet filter / layout chips — selected = soft fill + accent hairline, never neon plates.
struct EOSMicroChipButtonStyle: ButtonStyle {
    var selected: Bool
    var accent: Color
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule(style: .continuous)
                    .fill(selected ? Color.white.opacity(0.12) : Color.clear)
            )
            .foregroundStyle(selected ? EOSPalette.textPrimary : EOSPalette.textSecondary)
            .overlay(
                Capsule(style: .continuous)
                    .stroke(
                        isFocused ? Color.white.opacity(0.55)
                            : (selected ? accent.opacity(0.4) : EOSPalette.hairlineSoft),
                        lineWidth: isFocused ? 1.5 : 1
                    )
            )
            .scaleEffect(isFocused ? 1.06 : (configuration.isPressed ? 0.98 : 1.0))
            .animation(.easeOut(duration: 0.15), value: isFocused)
            .animation(.easeOut(duration: 0.12), value: selected)
    }
}



// MARK: - Cached remote images (cancellable)

enum EOSImageCache {
    private static let cache = NSCache<NSURL, UIImage>()

    static func image(for url: URL) -> UIImage? {
        cache.object(forKey: url as NSURL)
    }

    static func store(_ image: UIImage, for url: URL) {
        cache.setObject(image, forKey: url as NSURL)
    }
}

struct EOSCachedRemoteImage<Placeholder: View>: View {
    let url: URL?
    var contentMode: ContentMode = .fill
    @ViewBuilder var placeholder: () -> Placeholder

    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            } else {
                placeholder()
            }
        }
        .task(id: url?.absoluteString) {
            image = nil
            guard let url else { return }
            if let cached = EOSImageCache.image(for: url) {
                image = cached
                return
            }
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                try Task.checkCancellation()
                guard let ui = UIImage(data: data) else { return }
                EOSImageCache.store(ui, for: url)
                image = ui
            } catch is CancellationError {
                return
            } catch {
                return
            }
        }
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
    /// Enables a slow, continuous Ken-Burns drift — used for the naked immersive gallery so a
    /// still photo keeps a faint pulse of life instead of looking frozen.
    var ambient: Bool = false
    @State private var ambientZoomed = false

    var body: some View {
        GeometryReader { proxy in
            EOSCachedRemoteImage(url: url, contentMode: .fill) {
                placeholder
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .scaleEffect(ambient && ambientZoomed ? 1.055 : 1.0)
            .clipped()
        }
        .ignoresSafeArea()
        .onAppear {
            guard ambient else { return }
            withAnimation(.easeInOut(duration: 10).repeatForever(autoreverses: true)) {
                ambientZoomed = true
            }
        }
        .onChange(of: ambient) { _, isAmbient in
            guard isAmbient else { return }
            withAnimation(.easeInOut(duration: 10).repeatForever(autoreverses: true)) {
                ambientZoomed = true
            }
        }
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
        EOSCachedRemoteImage(url: url, contentMode: .fill) {
            placeholder
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
    /// > 1 only for tiles/list — rails stay at 1 to avoid horizontal clip ghosts.
    var focusScale: CGFloat = 1.0
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(focusScale > 1.001 && isFocused ? focusScale : 1.0)
            .zIndex(focusScale > 1.001 && isFocused ? 20 : 0)
            .opacity(configuration.isPressed ? 0.92 : 1.0)
            .animation(.easeOut(duration: 0.18), value: isFocused)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct EOSPosterCardChrome: ViewModifier {
    @Environment(\.isFocused) private var isFocused
    var cornerRadius: CGFloat = 22
    var accent: Color = .cyan

    func body(content: Content) -> some View {
        content
            .padding(EOSTvSpacing.cardPad)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(Color(white: 0.09).opacity(0.97))
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(
                        isFocused ? accent : Color.white.opacity(0.12),
                        lineWidth: isFocused ? 3.5 : 1
                    )
            )
            .shadow(
                color: .black.opacity(isFocused ? 0.4 : 0.18),
                radius: isFocused ? 16 : 6,
                y: isFocused ? 8 : 3
            )
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

/// Focus chrome + safe lift for list rows (space reserved by outer padding in catalogs).
struct EOSListRowFocusChrome: ViewModifier {
    @Environment(\.isFocused) private var isFocused
    var accent: Color = .green

    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(isFocused ? accent : Color.white.opacity(0.1), lineWidth: isFocused ? 3 : 1)
            )
            .shadow(color: accent.opacity(isFocused ? 0.3 : 0), radius: isFocused ? 16 : 0, y: isFocused ? 8 : 0)
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

extension View {
    func eosPosterCard(cornerRadius: CGFloat = 22, accent: Color = .cyan) -> some View {
        modifier(EOSPosterCardChrome(cornerRadius: cornerRadius, accent: accent))
    }

    func eosListRowFocus(accent: Color = .green) -> some View {
        modifier(EOSListRowFocusChrome(accent: accent))
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
        .font(.caption.weight(.medium))
        .foregroundStyle(EOSPalette.textTertiary)
        .labelStyle(.titleAndIcon)
    }

    private static func format(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = " "
        return formatter.string(from: NSNumber(value: max(0, value))) ?? "\(value)"
    }
}


// MARK: - Detail / immersive actions

struct EOSDetailChromeButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.callout.weight(.semibold))
            .foregroundStyle(.white.opacity(configuration.isPressed ? 0.7 : 0.92))
            .padding(.horizontal, 22)
            .padding(.vertical, 12)
            .background(Capsule(style: .continuous).fill(.ultraThinMaterial.opacity(isFocused ? 0.62 : 0.38)))
            .overlay(Capsule(style: .continuous).stroke(.white.opacity(isFocused ? 0.55 : 0.2), lineWidth: isFocused ? 2 : 1))
            .scaleEffect(isFocused ? 1.12 : (configuration.isPressed ? 0.98 : 1.0))
            .shadow(color: .black.opacity(isFocused ? 0.4 : 0.12), radius: isFocused ? 18 : 6, y: isFocused ? 10 : 3)
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

struct EOSDetailActionButtonStyle: ButtonStyle {
    var accent: Color = .white
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.callout.weight(.semibold))
            .foregroundStyle(EOSPalette.textPrimary)
            .padding(.horizontal, 24)
            .padding(.vertical, 15)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        isFocused
                            ? AnyShapeStyle(Color.white.opacity(0.16))
                            : AnyShapeStyle(.ultraThinMaterial.opacity(0.36))
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(
                        isFocused ? Color.white.opacity(0.7) : accent.opacity(0.35),
                        lineWidth: isFocused ? 2 : 1
                    )
            )
            .scaleEffect(isFocused ? 1.08 : (configuration.isPressed ? 0.98 : 1.0))
            .shadow(color: .black.opacity(isFocused ? 0.35 : 0.1), radius: isFocused ? 16 : 4, y: isFocused ? 8 : 2)
            .animation(.easeOut(duration: 0.16), value: isFocused)
    }
}

struct EOSDetailCardButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(isFocused ? 1.02 : 1.0)
            .shadow(color: .black.opacity(isFocused ? 0.35 : 0.1), radius: isFocused ? 14 : 4, y: isFocused ? 8 : 2)
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

struct EOSGalleryThumbButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(isFocused ? 1.12 : (configuration.isPressed ? 0.98 : 1.0))
            .shadow(color: .black.opacity(isFocused ? 0.5 : 0.2), radius: isFocused ? 22 : 8, y: isFocused ? 14 : 4)
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

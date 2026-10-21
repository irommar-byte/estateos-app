import SwiftUI
import UIKit
import ImageIO

// MARK: - Luxury TV design system (Apple-like restraint)

enum EOSPalette {
    static let canvasTop = Color(red: 0.06, green: 0.06, blue: 0.07)
    static let canvas = Color.black
    static let elevated = Color(white: 0.10)
    static let textPrimary = Color.white.opacity(0.96)
    static let textSecondary = Color.white.opacity(0.70)
    static let textTertiary = Color.white.opacity(0.55)
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
                    .fill(isFocused ? Color.white : (selected ? Color.white.opacity(0.14) : Color.white.opacity(0.04)))
            )
            .foregroundStyle(isFocused ? Color.black : (selected ? EOSPalette.textPrimary : EOSPalette.textSecondary))
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
    var icon: String? = nil
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) {
            if let icon {
                Image(systemName: icon)
                    .font(.callout.weight(.semibold))
            }
            configuration.label
        }
            .font(.callout.weight(.semibold))
            .padding(.horizontal, 22)
            .padding(.vertical, 12)
            .background(
                Capsule(style: .continuous)
                    .fill(isFocused ? Color.white : (selected ? Color.white.opacity(0.16) : Color.white.opacity(0.05)))
            )
            .foregroundStyle(isFocused ? Color.black : (selected ? EOSPalette.textPrimary : EOSPalette.textSecondary))
            .overlay(
                Capsule(style: .continuous)
                    .stroke(
                        isFocused ? Color.white.opacity(0.65)
                            : (selected ? accent.opacity(0.45) : EOSPalette.hairlineSoft),
                        lineWidth: isFocused ? 2 : 1
                    )
            )
            .scaleEffect(
                isFocused ? 1.08 : (selected ? 1.02 : (configuration.isPressed ? 0.98 : 1.0))
            )
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
            .font(.callout.weight(.semibold))
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(
                Capsule(style: .continuous)
                    .fill(isFocused ? Color.white : (selected ? Color.white.opacity(0.12) : Color.clear))
            )
            .foregroundStyle(isFocused ? Color.black : (selected ? EOSPalette.textPrimary : EOSPalette.textSecondary))
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



// MARK: - Image pipeline (2026-10 performance rewrite)
//
// Why the showroom stuttered: every card decoded the FULL-resolution listing photo on the main
// thread, and each cache store re-encoded the image to JPEG just to estimate its size. Now:
//   • photos are downsampled with ImageIO to the size they are shown at (card / thumb / screen),
//   • decoding happens off the main thread and is forced up front (no lazy decode at draw time),
//   • identical requests share one download (in-flight de-duplication),
//   • raw data goes through a dedicated URLCache (memory + disk), so re-visits are instant,
//   • cache cost is width × height × 4 — no re-encoding.

/// Pixel buckets — a request is served by its bucket or any bigger one already in memory.
enum EOSImageSize: Int, CaseIterable, Comparable {
    case thumb = 480     // gallery filmstrip, small rows
    case card = 960      // 400 pt lockups on a 4K Apple TV (@2x)
    case screen = 2560   // full-screen photos and backdrops

    static func < (a: Self, b: Self) -> Bool { a.rawValue < b.rawValue }
}

enum EOSImageCache {
    private static let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.totalCostLimit = 320 * 1024 * 1024
        return c
    }()

    static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 48 * 1024 * 1024, diskCapacity: 600 * 1024 * 1024)
        config.requestCachePolicy = .returnCacheDataElseLoad
        config.httpMaximumConnectionsPerHost = 6
        config.timeoutIntervalForRequest = 20
        return URLSession(configuration: config)
    }()

    private static let loader = EOSImageLoader()

    private static func key(_ url: URL, _ size: EOSImageSize) -> NSString {
        "\(size.rawValue)|\(url.absoluteString)" as NSString
    }

    /// Best image already in memory for `size` (that bucket or a larger one).
    static func image(for url: URL, size: EOSImageSize = .card) -> UIImage? {
        for bucket in EOSImageSize.allCases where bucket >= size {
            if let hit = cache.object(forKey: key(url, bucket)) { return hit }
        }
        return nil
    }

    static func store(_ image: UIImage, for url: URL, size: EOSImageSize = .screen) {
        let px = image.size.width * image.scale * image.size.height * image.scale
        cache.setObject(image, forKey: key(url, size), cost: Int(px * 4))
    }

    /// Loads (or reuses) the image for `size`. Safe to call from anywhere; never decodes on main.
    static func load(_ url: URL, size: EOSImageSize = .card) async -> UIImage? {
        if let hit = image(for: url, size: size) { return hit }
        return await loader.image(url: url, size: size)
    }

    /// Waits (bounded) until the photo is ready — used before the launch doors open.
    static func ensure(_ url: URL?, size: EOSImageSize = .screen, timeout: TimeInterval = 2.5) async {
        guard let url, image(for: url, size: size) == nil else { return }
        await withTaskGroup(of: Void.self) { group in
            group.addTask { _ = await load(url, size: size) }
            group.addTask { try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000)) }
            await group.next()
            group.cancelAll()
        }
    }

    /// Fire-and-forget warm-up at low priority (never competes with what is on screen).
    static func prefetch(urls: [URL], size: EOSImageSize = .card) {
        let todo = urls.prefix(12).filter { image(for: $0, size: size) == nil }
        guard !todo.isEmpty else { return }
        Task.detached(priority: .utility) {
            for url in todo { _ = await load(url, size: size) }
        }
    }

    /// ImageIO downsample + forced decode. Runs on a background thread.
    nonisolated static func decode(_ data: Data, maxPixel: Int) -> UIImage? {
        let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: cg)
    }
}

/// De-duplicates concurrent requests for the same image and size.
private actor EOSImageLoader {
    private var inFlight: [String: Task<UIImage?, Never>] = [:]

    func image(url: URL, size: EOSImageSize) async -> UIImage? {
        let key = "\(size.rawValue)|\(url.absoluteString)"
        if let running = inFlight[key] { return await running.value }
        let task = Task.detached(priority: size == .screen ? .userInitiated : .medium) { () -> UIImage? in
            guard let (data, response) = try? await EOSImageCache.session.data(from: url),
                  (response as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true,
                  let image = EOSImageCache.decode(data, maxPixel: size.rawValue)
            else { return nil }
            EOSImageCache.store(image, for: url, size: size)
            return image
        }
        inFlight[key] = task
        let result = await task.value
        inFlight[key] = nil
        return result
    }
}

/// Remote image view: shows a cached photo on the very first frame, otherwise loads the
/// downsampled version in the background and fades it in.
struct EOSCachedRemoteImage<Placeholder: View>: View {
    let url: URL?
    var contentMode: ContentMode
    var size: EOSImageSize
    var placeholder: () -> Placeholder

    @State private var image: UIImage?

    init(
        url: URL?,
        contentMode: ContentMode = .fill,
        size: EOSImageSize = .card,
        @ViewBuilder placeholder: @escaping () -> Placeholder
    ) {
        self.url = url
        self.contentMode = contentMode
        self.size = size
        self.placeholder = placeholder
        _image = State(initialValue: url.flatMap { EOSImageCache.image(for: $0, size: size) })
    }

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .transition(.opacity)
            } else {
                placeholder()
            }
        }
        .task(id: url?.absoluteString) {
            guard let url else { image = nil; return }
            if let cached = EOSImageCache.image(for: url, size: size) {
                if image !== cached { image = cached }
                return
            }
            image = nil
            let loaded = await EOSImageCache.load(url, size: size)
            guard !Task.isCancelled, let loaded else { return }
            withAnimation(.easeOut(duration: 0.25)) { image = loaded }
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
    /// Plain black while loading (full-screen backdrops) instead of the photo placeholder.
    var quietPlaceholder: Bool = false
    @State private var ambientZoomed = false

    var body: some View {
        GeometryReader { proxy in
            EOSCachedRemoteImage(url: url, contentMode: .fill, size: .screen) {
                if quietPlaceholder { Color.black } else { placeholder }
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
        EOSCachedRemoteImage(url: url, contentMode: .fill, size: height > 300 ? .screen : .card) {
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
                        isFocused ? Color.white : Color.white.opacity(0.12),
                        lineWidth: isFocused ? 4 : 1
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
/// Full-screen description: shrinks font until the copy fits. If it still overflows at `minSize`,
/// slowly scrolls upward in a seamless loop so the whole text stays readable from the couch.
struct EOSScreenFitText: View {
    let text: String
    var maxSize: CGFloat = 42
    var minSize: CGFloat = 14
    var lineSpacing: CGFloat = 6
    /// Points per second when marquee is active — slow enough to read comfortably on tvOS.
    var marqueeSpeed: CGFloat = 34
    /// Brief pause at the top of each loop before scrolling resumes.
    var marqueeHold: TimeInterval = 2.0

    var body: some View {
        GeometryReader { geo in
            let fit = Self.resolve(
                text: text,
                in: geo.size,
                max: maxSize,
                min: minSize,
                lineSpacing: lineSpacing
            )
            let spacing = lineSpacing * (fit.fontSize / 24)

            Group {
                if fit.needsMarquee {
                    EOSVerticalMarqueeText(
                        text: text,
                        fontSize: fit.fontSize,
                        lineSpacing: spacing,
                        contentHeight: fit.contentHeight,
                        speed: marqueeSpeed,
                        hold: marqueeHold
                    )
                } else {
                    Text(text)
                        .font(.system(size: fit.fontSize, weight: .regular, design: .rounded))
                        .foregroundStyle(.white.opacity(0.94))
                        .lineSpacing(spacing)
                        .multilineTextAlignment(.leading)
                        .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
            .clipped()
        }
    }

    fileprivate struct FitResult {
        let fontSize: CGFloat
        let contentHeight: CGFloat
        let needsMarquee: Bool
    }

    fileprivate static func resolve(
        text: String,
        in size: CGSize,
        max: CGFloat,
        min: CGFloat,
        lineSpacing: CGFloat
    ) -> FitResult {
        guard size.width > 40, size.height > 40 else {
            return FitResult(fontSize: min, contentHeight: size.height, needsMarquee: false)
        }
        var lo = min
        var hi = max
        var best = min
        while hi - lo > 0.5 {
            let mid = (lo + hi) / 2
            let height = measure(text: text, fontSize: mid, width: size.width, lineSpacing: lineSpacing * (mid / 24))
            if height <= size.height {
                best = mid
                lo = mid
            } else {
                hi = mid
            }
        }
        let minHeight = measure(text: text, fontSize: min, width: size.width, lineSpacing: lineSpacing * (min / 24))
        if minHeight > size.height + 1 {
            return FitResult(fontSize: min, contentHeight: minHeight, needsMarquee: true)
        }
        let bestHeight = measure(text: text, fontSize: best, width: size.width, lineSpacing: lineSpacing * (best / 24))
        return FitResult(fontSize: best, contentHeight: bestHeight, needsMarquee: false)
    }

    fileprivate static func measure(text: String, fontSize: CGFloat, width: CGFloat, lineSpacing: CGFloat) -> CGFloat {
        var font = UIFont.systemFont(ofSize: fontSize, weight: .regular)
        if let rounded = font.fontDescriptor.withDesign(.rounded) {
            font = UIFont(descriptor: rounded, size: fontSize)
        }
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

/// Continuous vertical marquee — duplicates the block so the loop never flashes empty.
private struct EOSVerticalMarqueeText: View {
    let text: String
    let fontSize: CGFloat
    let lineSpacing: CGFloat
    let contentHeight: CGFloat
    var speed: CGFloat = 34
    var hold: TimeInterval = 2.0
    private let loopGap: CGFloat = 56

    var body: some View {
        let cycle = max(contentHeight + loopGap, 1)
        let scrollDuration = TimeInterval(cycle / max(speed, 1))
        let period = hold + scrollDuration

        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let phase = t.truncatingRemainder(dividingBy: period)
            let offset: CGFloat = {
                if phase < hold { return 0 }
                let progress = (phase - hold) / scrollDuration
                return -CGFloat(progress) * cycle
            }()

            VStack(alignment: .leading, spacing: loopGap) {
                textBlock
                textBlock
            }
            .offset(y: offset)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .clipped()
        .accessibilityLabel(text)
    }

    private var textBlock: some View {
        Text(text)
            .font(.system(size: fontSize, weight: .regular, design: .rounded))
            .foregroundStyle(.white.opacity(0.94))
            .lineSpacing(lineSpacing)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}


/// Single-line media capsule — never wraps or hyphenates. Use for transaction / city / discount.
struct EOSMediaBadge: View {
    let text: String
    var fill: Color = Color.black.opacity(0.58)
    var stroke: Color = Color.white.opacity(0.22)
    var foreground: Color = .white
    var fontSize: CGFloat = 13

    var body: some View {
        Text(text)
            .font(.system(size: fontSize, weight: .bold, design: .rounded))
            .tracking(0.5)
            .foregroundStyle(foreground)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: true)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Capsule(style: .continuous).fill(fill))
            .overlay(Capsule(style: .continuous).stroke(stroke, lineWidth: 1))
            .layoutPriority(1)
    }
}

struct EOSDiscountBadge: View {
    let percentText: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "percent")
                .font(.system(size: 11, weight: .heavy))
            Text(percentText)
                .font(.system(size: 13, weight: .heavy, design: .rounded))
                .tracking(0.3)
        }
        .foregroundStyle(.white)
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: true)
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        .background(
            Capsule(style: .continuous)
                .fill(Color(red: 0.92, green: 0.32, blue: 0.28).opacity(0.92))
        )
        .overlay(
            Capsule(style: .continuous)
                .stroke(Color.white.opacity(0.28), lineWidth: 1)
        )
        .layoutPriority(2)
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
            .foregroundStyle(isFocused ? Color.black : Color.white.opacity(configuration.isPressed ? 0.7 : 0.92))
            .padding(.horizontal, 22)
            .padding(.vertical, 12)
            .background(Capsule(style: .continuous).fill(isFocused ? AnyShapeStyle(Color.white) : AnyShapeStyle(.ultraThinMaterial.opacity(0.38))))
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
            .foregroundStyle(isFocused ? Color.black : EOSPalette.textPrimary)
            .padding(.horizontal, 24)
            .padding(.vertical, 15)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        isFocused
                            ? AnyShapeStyle(Color.white)
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

// MARK: - v2 · Liquid Glass, native focus, motion (redesign 2026-10)

/// One place for every timing in the app, so motion feels like one system.
enum EOSMotion {
    /// Focus lift on cards and buttons.
    static let focus = Animation.spring(response: 0.3, dampingFraction: 0.8)
    /// Full-screen backdrop following the focused offer.
    static let backdrop = Animation.easeInOut(duration: 0.6)
    /// Debounce before the backdrop follows focus — fast scrolling never flickers.
    static let backdropDelayNs: UInt64 = 250_000_000
    /// Text block that describes the focused offer.
    static let spotlightText = Animation.easeInOut(duration: 0.35)
    /// Showroom settling in while the launch doors open.
    static let launchReveal = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 1.4)
    /// Gallery photo swap.
    static let gallery = Animation.spring(response: 0.45, dampingFraction: 0.9)
}

private struct EOSLaunchRevealedKey: EnvironmentKey {
    static let defaultValue = true
}

private struct EOSLaunchFinishedKey: EnvironmentKey {
    static let defaultValue = true
}

private struct EOSAmbientMotionKey: EnvironmentKey {
    static let defaultValue = true
}

extension EnvironmentValues {
    /// False while the launch doors are still closed (RootView flips it as they open).
    var eosLaunchRevealed: Bool {
        get { self[EOSLaunchRevealedKey.self] }
        set { self[EOSLaunchRevealedKey.self] = newValue }
    }

    /// True once the splash is gone and the showroom accepts the remote.
    var eosLaunchFinished: Bool {
        get { self[EOSLaunchFinishedKey.self] }
        set { self[EOSLaunchFinishedKey.self] = newValue }
    }

    /// Konto › "Ruchome zdjęcia w tle": the slow Ken Burns drift of big photos.
    var eosAmbientMotion: Bool {
        get { self[EOSAmbientMotionKey.self] }
        set { self[EOSAmbientMotionKey.self] = newValue }
    }
}

/// Liquid Glass on tvOS 26, a blurred material with a hairline and soft shadow before that.
struct EOSGlassModifier<S: Shape>: ViewModifier {
    var shape: S

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(tvOS 26.0, *) {
            content.glassEffect(.regular, in: shape)
        } else {
            legacy(content)
        }
        #else
        legacy(content)
        #endif
    }

    private func legacy(_ content: Content) -> some View {
        content
            .background(.ultraThinMaterial, in: shape)
            .overlay(shape.stroke(Color.white.opacity(0.18), lineWidth: 1))
            .shadow(color: .black.opacity(0.28), radius: 24, y: 12)
    }
}

extension View {
    func eosGlassPanel<S: Shape>(_ shape: S) -> some View {
        modifier(EOSGlassModifier(shape: shape))
    }

    func eosGlassPanel(cornerRadius: CGFloat = 32) -> some View {
        modifier(EOSGlassModifier(shape: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)))
    }

    /// System tvOS button: glass on tvOS 26; on earlier systems the native bordered button,
    /// which turns bright white with dark text when focused — the clearest focus state on TV.
    @ViewBuilder
    func eosButton() -> some View {
        #if compiler(>=6.2)
        if #available(tvOS 26.0, *) {
            self.buttonStyle(.glass).buttonBorderShape(.capsule)
        } else {
            self.buttonStyle(.bordered).buttonBorderShape(.capsule)
        }
        #else
        self.buttonStyle(.bordered).buttonBorderShape(.capsule)
        #endif
    }
}

/// Reports when the nearest focusable ancestor (the card button) gains focus.
struct EOSFocusProbe: View {
    var onFocus: () -> Void
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .onChange(of: isFocused) { _, focused in
                if focused { onFocus() }
            }
    }
}

/// Apple TV lockup: native `.borderless` button + `.hoverEffect(.highlight)` on the artwork —
/// the same lift, parallax tilt under the remote's touch surface and moving specular highlight
/// as the Apple TV app. Title and subtitle sit under the artwork.
struct EOSPosterCard<Badge: View>: View {
    let imageURL: URL?
    let title: String
    var subtitle: String? = nil
    var width: CGFloat = 400
    var onFocus: () -> Void = {}
    let action: () -> Void
    @ViewBuilder var badge: () -> Badge

    private var height: CGFloat { (width * 9 / 16).rounded() }
    private var corner: CGFloat { 24 }

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 24) {
                EOSCachedRemoteImage(url: imageURL, contentMode: .fill) {
                    Rectangle()
                        .fill(Color.white.opacity(0.08))
                        .overlay {
                            Image(systemName: "photo")
                                .font(.system(size: 34, weight: .medium))
                                .foregroundStyle(.white.opacity(0.3))
                        }
                }
                .frame(width: width, height: height)
                .clipped()
                .overlay(alignment: .bottomLeading) {
                    badge().padding(14)
                }
                .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
                .contentShape(.hoverEffect, RoundedRectangle(cornerRadius: corner, style: .continuous))
                .hoverEffect(.highlight)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 25, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    if let subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: 21, weight: .regular))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .frame(width: width, alignment: .leading)
            }
            .background(EOSFocusProbe(onFocus: onFocus))
        }
        .buttonStyle(.borderless)
        .accessibilityLabel([title, subtitle].compactMap { $0 }.joined(separator: ", "))
    }
}

extension EOSPosterCard where Badge == EmptyView {
    init(imageURL: URL?, title: String, subtitle: String? = nil, width: CGFloat = 400, onFocus: @escaping () -> Void = {}, action: @escaping () -> Void) {
        self.init(imageURL: imageURL, title: title, subtitle: subtitle, width: width, onFocus: onFocus, action: action) { EmptyView() }
    }
}

/// Small frosted capsule for overlays on artwork (e.g. "−5%", "Wynajem").
struct EOSGlassBadge: View {
    let text: String
    var tint: Color = .white

    var body: some View {
        Text(text)
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(tint)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.18), lineWidth: 1))
    }
}

/// Full-screen photo backdrop.
///
/// The photo on screen is replaced only when the next one is fully downloaded and decoded
/// (screen-size, off the main thread) — then the two cross-fade. While the remote flies
/// across cards nothing is loaded here at all: the caller only changes `url` once focus rests.
/// One very slow Ken Burns drift keeps the still photo alive.
struct EOSBackdrop: View {
    let url: URL?
    /// Pre-blurred, softer variant (detail page when scrolled, secondary screens).
    var soft: Bool = false
    @Environment(\.eosLaunchRevealed) private var revealed

    private struct Layer: Equatable {
        let url: URL
        let image: UIImage
        static func == (a: Layer, b: Layer) -> Bool { a.url == b.url }
    }

    @State private var shown: Layer?
    @State private var drift = false
    @Environment(\.eosAmbientMotion) private var ambientMotion
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(url: URL?, soft: Bool = false) {
        self.url = url
        self.soft = soft
        let size: EOSImageSize = soft ? .thumb : .screen
        if let url, let image = EOSImageCache.image(for: url, size: size) {
            _shown = State(initialValue: Layer(url: url, image: image))
        }
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black
                if let shown {
                    Image(uiImage: shown.image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height)
                        .blur(radius: soft ? 28 : 0, opaque: true)
                        .clipped()
                        .id(shown.url)
                        .transition(.opacity)
                }
            }
            .scaleEffect((revealed ? 1.0 : 1.08) * (drift && !soft ? 1.045 : 1.0))
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .animation(EOSMotion.launchReveal, value: revealed)
        .task(id: url) {
            guard let url else { return }
            if shown?.url == url { return }
            let size: EOSImageSize = soft ? .thumb : .screen
            let image: UIImage?
            if let cached = EOSImageCache.image(for: url, size: size) {
                image = cached
            } else {
                image = await EOSImageCache.load(url, size: size)
            }
            guard !Task.isCancelled, let image else { return }
            withAnimation(EOSMotion.backdrop) { shown = Layer(url: url, image: image) }
        }
        .onAppear(perform: startDrift)
        .onChange(of: ambientMotion) { _, on in
            if on { startDrift() } else { withAnimation(.easeOut(duration: 1.2)) { drift = false } }
        }
    }
}

extension EOSBackdrop {
    fileprivate func startDrift() {
        guard !soft, ambientMotion, !reduceMotion, !drift else { return }
        withAnimation(.easeInOut(duration: 24).repeatForever(autoreverses: true)) { drift = true }
    }
}

/// Scrims that keep white text legible over any photo (left column + bottom).
struct EOSBackdropScrim: View {
    var body: some View {
        ZStack {
            LinearGradient(
                stops: [
                    .init(color: .black.opacity(0.75), location: 0),
                    .init(color: .black.opacity(0.35), location: 0.4),
                    .init(color: .clear, location: 0.68),
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0.35),
                    .init(color: .black.opacity(0.6), location: 0.62),
                    .init(color: .black.opacity(0.92), location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

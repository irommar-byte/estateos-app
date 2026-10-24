import SwiftUI
import UIKit
import ImageIO

enum RemoteImageCache {
    static let memory: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        // 80 okładek to ~2 ekrany listy — przy przewijaniu w górę wszystko dekodowało się od nowa.
        cache.countLimit = 400
        cache.totalCostLimit = 64 * 1024 * 1024
        return cache
    }()

    /// Remote URLs that already failed — skip re-fetch during fling scroll.
    private static var failedKeys = Set<String>()
    private static let failedLock = NSLock()

    static func cacheKey(url: URL, maxPixelSize: Int) -> NSString {
        "\(url.absoluteString)|px\(maxPixelSize)" as NSString
    }

    static func image(for url: URL, maxPixelSize: Int) -> UIImage? {
        memory.object(forKey: cacheKey(url: url, maxPixelSize: maxPixelSize))
    }

    static func store(_ image: UIImage, for url: URL, maxPixelSize: Int) {
        let cost = Int(image.size.width * image.size.height * image.scale * image.scale * 4)
        memory.setObject(image, forKey: cacheKey(url: url, maxPixelSize: maxPixelSize), cost: max(1, cost))
        markSuccess(url)
    }

    static func hasFailed(_ url: URL) -> Bool {
        failedLock.lock()
        defer { failedLock.unlock() }
        return failedKeys.contains(url.absoluteString)
    }

    static func markFailed(_ url: URL) {
        failedLock.lock()
        failedKeys.insert(url.absoluteString)
        failedLock.unlock()
    }

    static func markSuccess(_ url: URL) {
        failedLock.lock()
        failedKeys.remove(url.absoluteString)
        failedLock.unlock()
    }
}

/// Bounded ImageIO decode / downsample — never run sync file IO on MainActor for large assets.
actor ArtworkDecodeActor {
    static let shared = ArtworkDecodeActor()

    private let maxConcurrent = 4
    private var inFlight = 0
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func load(url: URL, maxPixelSize: Int, allowAnimated: Bool, timeout: TimeInterval = 4) async -> ArtworkLoader.Result? {
        await acquire()
        defer { release() }

        if url.isFileURL {
            guard let data = try? Data(contentsOf: url) else { return nil }
            return ArtworkLoader.load(from: data, maxPixelSize: maxPixelSize, allowAnimated: allowAnimated)
        }

        do {
            var request = URLRequest(url: url)
            // Short timeout — list scroll must not wait on dead artwork hosts.
            // Player heroes (iPad) get a longer window so covers actually appear.
            request.timeoutInterval = max(2, timeout)
            request.cachePolicy = .returnCacheDataElseLoad
            if url.host == AppConfig.apiBaseURL.host || url.absoluteString.contains("/api/music/folders/") {
                if let token = SessionStore.load()?.token {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
            }
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return nil
            }
            return ArtworkLoader.load(from: data, maxPixelSize: maxPixelSize, allowAnimated: allowAnimated)
        } catch {
            return nil
        }
    }

    private func acquire() async {
        if inFlight < maxConcurrent {
            inFlight += 1
            return
        }
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            waiters.append(cont)
        }
        // Slot transferred from the releaser — already counted in `inFlight`.
    }

    private func release() {
        if !waiters.isEmpty {
            waiters.removeFirst().resume()
            return
        }
        inFlight = max(0, inFlight - 1)
    }
}

enum ArtworkLoader {
    struct Result {
        let still: UIImage
        let animated: UIImage?
    }

    static func load(from data: Data, maxPixelSize: Int = 0, allowAnimated: Bool = false) -> Result? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
            guard let still = UIImage(data: data) else { return nil }
            return Result(still: downsampleIfNeeded(still, maxPixelSize: maxPixelSize) ?? still, animated: nil)
        }
        let count = CGImageSourceGetCount(source)
        guard count > 0 else {
            guard let still = UIImage(data: data) else { return nil }
            return Result(still: downsampleIfNeeded(still, maxPixelSize: maxPixelSize) ?? still, animated: nil)
        }

        let pixelCap = max(0, maxPixelSize)
        if count == 1 || !allowAnimated {
            guard let cg = makeThumbnail(source, maxPixelSize: pixelCap)
                    ?? makeFrame(source, index: 0) else {
                guard let still = UIImage(data: data) else { return nil }
                return Result(still: downsampleIfNeeded(still, maxPixelSize: pixelCap) ?? still, animated: nil)
            }
            return Result(still: UIImage(cgImage: cg), animated: nil)
        }

        var frames: [UIImage] = []
        var duration: Double = 0
        frames.reserveCapacity(count)
        for index in 0..<count {
            guard let cg = makeFrame(source, index: index) else { continue }
            frames.append(UIImage(cgImage: cg))
            duration += frameDuration(source, index: index)
        }
        guard let first = frames.first else { return nil }
        if duration <= 0 {
            duration = Double(frames.count) * 0.1
        }
        let animated = UIImage.animatedImage(with: frames, duration: duration)
        let still: UIImage
        if let thumb = makeThumbnail(source, maxPixelSize: pixelCap) {
            still = UIImage(cgImage: thumb)
        } else {
            still = first
        }
        return Result(still: still, animated: animated)
    }

    private static func makeThumbnail(_ source: CGImageSource, maxPixelSize: Int) -> CGImage? {
        var options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
        ]
        if maxPixelSize > 0 {
            options[kCGImageSourceThumbnailMaxPixelSize] = maxPixelSize
        }
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }

    private static func makeFrame(_ source: CGImageSource, index: Int) -> CGImage? {
        CGImageSourceCreateImageAtIndex(source, index, [kCGImageSourceShouldCache: true] as CFDictionary)
    }

    private static func downsampleIfNeeded(_ image: UIImage, maxPixelSize: Int) -> UIImage? {
        guard maxPixelSize > 0 else { return image }
        let px = max(image.size.width, image.size.height) * image.scale
        guard px > CGFloat(maxPixelSize) else { return image }
        let scale = CGFloat(maxPixelSize) / px
        let target = CGSize(
            width: max(1, image.size.width * image.scale * scale),
            height: max(1, image.size.height * image.scale * scale)
        )
        let renderer = UIGraphicsImageRenderer(size: target)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }

    private static func frameDuration(_ source: CGImageSource, index: Int) -> Double {
        guard let props = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any] else {
            return 0.1
        }
        let gif = props[kCGImagePropertyGIFDictionary] as? [CFString: Any]
        let png = props[kCGImagePropertyPNGDictionary] as? [CFString: Any]
        let webp = props[kCGImagePropertyWebPDictionary] as? [CFString: Any]
        let unclamped =
            (gif?[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
            ?? (png?[kCGImagePropertyAPNGUnclampedDelayTime] as? Double)
            ?? (webp?[kCGImagePropertyWebPUnclampedDelayTime] as? Double)
        let clamped =
            (gif?[kCGImagePropertyGIFDelayTime] as? Double)
            ?? (png?[kCGImagePropertyAPNGDelayTime] as? Double)
            ?? (webp?[kCGImagePropertyWebPDelayTime] as? Double)
        let value = unclamped ?? clamped ?? 0.1
        return value < 0.02 ? 0.1 : value
    }
}

struct ArtworkPlaceholder: View {
    var title: String = ""
    var subtitle: String? = nil
    var size: CGFloat = 40

    var body: some View {
        let colors = Self.palette(title: title, subtitle: subtitle)
        ZStack {
            LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            if glyph.isEmpty {
                Image(systemName: "music.note")
                    .font(.system(size: max(13, size * 0.30), weight: .semibold))
                    .foregroundStyle(.white.opacity(0.82))
            } else {
                Text(glyph)
                    .font(.system(size: max(12, size * 0.36), weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.92))
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                    .padding(.horizontal, 3)
            }
        }
        .accessibilityHidden(true)
    }

    private var glyph: String {
        Self.glyph(from: title)
    }

    static func glyph(from title: String) -> String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = trimmed.first else { return "" }
        return String(first).uppercased()
    }

    static func palette(title: String, subtitle: String?) -> [Color] {
        let palettes: [[Color]] = [
            [Color(red: 0.62, green: 0.16, blue: 0.48), Color(red: 0.22, green: 0.06, blue: 0.28)],
            [Color(red: 0.72, green: 0.18, blue: 0.32), Color(red: 0.28, green: 0.06, blue: 0.18)],
            [Color(red: 0.22, green: 0.28, blue: 0.68), Color(red: 0.08, green: 0.10, blue: 0.32)],
            [Color(red: 0.10, green: 0.46, blue: 0.48), Color(red: 0.06, green: 0.18, blue: 0.28)],
            [Color(red: 0.64, green: 0.34, blue: 0.10), Color(red: 0.28, green: 0.10, blue: 0.06)],
            [Color(red: 0.18, green: 0.48, blue: 0.30), Color(red: 0.06, green: 0.20, blue: 0.14)],
            [Color(red: 0.46, green: 0.14, blue: 0.58), Color(red: 0.16, green: 0.08, blue: 0.36)],
            [Color(red: 0.36, green: 0.18, blue: 0.56), Color(red: 0.10, green: 0.06, blue: 0.26)],
        ]
        let seed = djb2("\(title)\u{1e}\(subtitle ?? "")")
        return palettes[Int(seed % UInt64(palettes.count))]
    }

    private static func djb2(_ value: String) -> UInt64 {
        var hash: UInt64 = 5381
        for byte in value.utf8 {
            hash = ((hash &<< 5) &+ hash) &+ UInt64(byte)
        }
        return hash
    }
}

struct ArtworkImage: View {
    let url: URL?
    var size: CGFloat = 56
    var cornerRadius: CGFloat = 10
    var circleClip = false
    /// Animated GIF/APNG — off by default (player / lists must stay responsive).
    var allowAnimated = false
    /// Immediate cover from ID3 / Now Playing while remote URL loads (critical on iPad player).
    var fallbackImage: UIImage? = nil
    /// Stable per-track key so SwiftUI does not keep the previous cover when the URL is nil.
    var identity: String = ""
    var placeholderTitle: String = ""
    var placeholderSubtitle: String? = nil
    /// Okładka rośnie do szerokości komórki (siatka na iPadzie i Macu).
    var fillsWidth: Bool = false

    @State private var stillImage: UIImage?
    @State private var animatedImage: UIImage?
    @State private var loadingURL: URL?
    @State private var loadedKey = ""

    private var maxPixelSize: Int {
        // Cap decode size — huge iPad hero canvases don't need 4× retina bitmaps.
        min(1024, Int(ceil((fillsWidth ? max(size, 240) : size) * UIScreen.main.scale)))
    }

    private var contentKey: String {
        "\(identity)|\(url?.absoluteString ?? "nil")|\(placeholderTitle)|\(maxPixelSize)|\(allowAnimated)"
    }

    var body: some View {
        let picture = Group {
            if loadedKey == contentKey, let animatedImage {
                AnimatedUIImageView(image: animatedImage)
            } else if loadedKey == contentKey, let stillImage {
                Image(uiImage: stillImage)
                    .resizable()
                    .scaledToFill()
            } else if let fallbackImage {
                Image(uiImage: fallbackImage)
                    .resizable()
                    .scaledToFill()
            } else if !allowAnimated, let url, let cached = RemoteImageCache.image(for: url, maxPixelSize: maxPixelSize) {
                // Okładka już w pamięci — pokaż od razu (bez mignięcia zaślepki podczas przewijania).
                Image(uiImage: cached)
                    .resizable()
                    .scaledToFill()
            } else {
                ArtworkPlaceholder(title: placeholderTitle, subtitle: placeholderSubtitle, size: size)
            }
        }
        Group {
            if fillsWidth {
                Color.clear
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .overlay {
                        picture
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            } else {
                picture
                    .frame(width: size, height: size)
                    .modifier(ArtworkClip(circleClip: circleClip, cornerRadius: cornerRadius, size: size))
            }
        }
        .task(id: contentKey) {
            await loadArtwork()
        }
    }

    @MainActor
    private func loadArtwork() async {
        let key = contentKey
        stillImage = nil
        animatedImage = nil
        loadedKey = key

        guard let url else {
            loadingURL = nil
            return
        }
        loadingURL = url
        let pixelSize = maxPixelSize

        if let cached = RemoteImageCache.image(for: url, maxPixelSize: pixelSize), !allowAnimated {
            stillImage = cached
            animatedImage = nil
            loadedKey = key
            return
        }
        // Animated covers must re-decode GIF/APNG — still cache would freeze frame 0 forever.

        // Offline / already-failed remote art: keep placeholder / fallback — do not hammer the network while scrolling.
        if !url.isFileURL {
            if RemoteImageCache.hasFailed(url) { return }
            if !NetworkReachability.shared.isOnline { return }
        }

        let loaded = await ArtworkDecodeActor.shared.load(
            url: url,
            maxPixelSize: pixelSize,
            allowAnimated: allowAnimated,
            timeout: size >= 120 ? 12 : 4
        )
        guard loadingURL == url, loadedKey == key else { return }
        guard let loaded else {
            if !url.isFileURL {
                RemoteImageCache.markFailed(url)
            }
            stillImage = nil
            animatedImage = nil
            return
        }
        RemoteImageCache.store(loaded.still, for: url, maxPixelSize: pixelSize)
        stillImage = loaded.still
        animatedImage = allowAnimated ? loaded.animated : nil
        loadedKey = key
    }
}

/// UIKit animated image keeps GIF/APNG looping forever (SwiftUI Image freezes on frame 0).
private struct AnimatedUIImageView: UIViewRepresentable {
    let image: UIImage

    func makeUIView(context: Context) -> UIImageView {
        let view = UIImageView()
        view.contentMode = .scaleAspectFill
        view.clipsToBounds = true
        view.animationRepeatCount = 0
        apply(image, to: view)
        return view
    }

    func updateUIView(_ uiView: UIImageView, context: Context) {
        apply(image, to: uiView)
    }

    private func apply(_ image: UIImage, to view: UIImageView) {
        if let frames = image.images, !frames.isEmpty {
            view.animationImages = frames
            view.animationDuration = image.duration > 0 ? image.duration : Double(frames.count) * 0.1
            view.image = frames.first
            if !view.isAnimating {
                view.startAnimating()
            }
        } else {
            view.stopAnimating()
            view.animationImages = nil
            view.image = image
        }
    }
}

private struct ArtworkClip: ViewModifier {
    let circleClip: Bool
    let cornerRadius: CGFloat
    let size: CGFloat

    func body(content: Content) -> some View {
        if circleClip {
            content.clipShape(Circle())
        } else {
            content.clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        }
    }
}

struct TrackRowView: View {
    @EnvironmentObject private var ui: UIPreferences
    let index: Int?
    let title: String
    let subtitle: String?
    let duration: Double?
    let artworkURL: URL?
    var isPlaying = false
    var downloadState: TrackDownloadUIState = .done
    /// Optional Apple-style trailing meta (e.g. "12,4 MB").
    var detailLabel: String? = nil
    var showsOfflineBadge = false

    private var rowSpacing: CGFloat { ui.ultraCompact ? 8 : 10 }
    private var indexWidth: CGFloat { ui.ultraCompact ? 18 : 22 }
    private var artSize: CGFloat { ui.ultraCompact ? 36 : 40 }
    private var artRadius: CGFloat { ui.ultraCompact ? 5 : 6 }
    private var textSpacing: CGFloat { ui.ultraCompact ? 1 : 1 }
    private var verticalPadding: CGFloat { ui.ultraCompact ? 0 : 1 }
    private var titleFont: Font { ui.ultraCompact ? .subheadline.weight(.semibold) : .body }
    private var subtitleFont: Font { .caption }
    private var metaFont: Font { .caption.monospacedDigit() }
    private var indexFont: Font { .subheadline.monospacedDigit() }

    var body: some View {
        HStack(spacing: rowSpacing) {
            if let index {
                Group {
                    if isPlaying {
                        NowPlayingBars()
                            .frame(width: 18, height: 14)
                            .transition(.scale(scale: 0.4).combined(with: .opacity))
                    } else {
                        Text("\(index)")
                            .font(indexFont)
                            .foregroundStyle(EOSTheme.textMuted)
                    }
                }
                .frame(width: max(indexWidth, 22), alignment: .center)
                .accessibilityHidden(true)
            }
            ArtworkImage(
                url: artworkURL,
                size: artSize,
                cornerRadius: artRadius,
                identity: "row:\(title)|\(subtitle ?? "")|\(artworkURL?.absoluteString ?? "nil")",
                placeholderTitle: title,
                placeholderSubtitle: subtitle
            )
            // Lista jak w Apple Music: tytuł przycięty „…” (przewijany tekst zostaje w playerze).
            // MarqueeText w każdym wierszu to dwa pomiary geometrii na wiersz — hamowało przewijanie.
            VStack(alignment: .leading, spacing: textSpacing) {
                Text(title)
                    .font(titleFont)
                    .foregroundStyle(isPlaying ? EOSTheme.accent : EOSTheme.textPrimary)
                    .lineLimit(1)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(subtitleFont)
                        .foregroundStyle(EOSTheme.textSecondary)
                        .lineLimit(1)
                }
            }
            .animation(.easeInOut(duration: 0.25), value: isPlaying)
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 2) {
                if let detailLabel, !detailLabel.isEmpty {
                    Text(detailLabel)
                        .font(metaFont)
                        .foregroundStyle(EOSTheme.textMuted)
                } else {
                    Text(formatDuration(duration))
                        .font(metaFont)
                        .foregroundStyle(EOSTheme.textMuted)
                }
                if showsOfflineBadge {
                    Image(systemName: "arrow.down.circle.fill")
                        .font(.caption2)
                        .foregroundStyle(Color(red: 0.20, green: 0.78, blue: 0.35))
                        .accessibilityLabel("Pobrane na urządzenie")
                }
            }
        }
        .padding(.vertical, verticalPadding)
        .contentShape(Rectangle())
    }
}


// MARK: - Wskaźnik „teraz gra” jak na ekranie blokady iOS

/// Pięć zaokrąglonych słupków skaczących niezależnie — jak w odtwarzaczu na ekranie blokady.
/// Napędzane prawdziwym dźwiękiem (5 pasm analizatora); gdy analiza jest wyłączona, słupki
/// ruszają się w rytmie iOS. Pauza = słupki stoją nisko i płasko.
struct NowPlayingBars: UIViewRepresentable {
    var color: Color = EOSTheme.accent
    var barWidth: CGFloat = 2.4

    func makeUIView(context: Context) -> NowPlayingBarsUIView {
        let view = NowPlayingBarsUIView()
        view.configure(color: UIColor(color), barWidth: barWidth)
        return view
    }

    func updateUIView(_ uiView: NowPlayingBarsUIView, context: Context) {
        uiView.configure(color: UIColor(color), barWidth: barWidth)
    }

    static func dismantleUIView(_ uiView: NowPlayingBarsUIView, coordinator: ()) { uiView.stop() }
}

final class NowPlayingBarsUIView: UIView {
    private var bars: [CALayer] = []
    private var heights: [CGFloat] = [0.3, 0.5, 0.7, 0.45, 0.25]
    private var targets: [CGFloat] = [0.3, 0.5, 0.7, 0.45, 0.25]
    private var nextRetarget: [CFTimeInterval] = Array(repeating: 0, count: 5)
    private var link: CADisplayLink?
    private var barWidth: CGFloat = 2.4
    private var lastTick: CFTimeInterval = 0

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        for _ in 0..<5 {
            let bar = CALayer()
            bar.actions = ["bounds": NSNull(), "position": NSNull(), "frame": NSNull()]
            layer.addSublayer(bar)
            bars.append(bar)
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    func configure(color: UIColor, barWidth: CGFloat) {
        self.barWidth = barWidth
        for bar in bars { bar.backgroundColor = color.cgColor }
        setNeedsLayout()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { stop() } else { start() }
    }

    private func start() {
        guard link == nil else { return }
        let l = CADisplayLink(target: BarsTarget(self), selector: #selector(BarsTarget.tick(_:)))
        l.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
        l.add(to: .main, forMode: .common)
        link = l
    }

    func stop() {
        link?.invalidate()
        link = nil
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        applyHeights()
    }

    fileprivate func step(_ link: CADisplayLink) {
        let now = link.timestamp
        let dt = CGFloat(lastTick == 0 ? 1.0 / 60 : min(0.05, now - lastTick))
        lastTick = now
        let playing = PlayerAudioVisualizer.isPlayingNow
        let live = PlayerAudioVisualizer.current?.snapshot(isPlaying: playing).islandBars ?? []
        let hasLive = playing && live.count == 5 && (live.max() ?? 0) > 0.02

        for i in 0..<5 {
            if !playing {
                targets[i] = 0.18
            } else if hasLive {
                targets[i] = max(0.15, min(1, CGFloat(live[i]) * 1.15))
            } else if now >= nextRetarget[i] {
                // Rytm iOS: każdy słupek co ~0,15–0,3 s wybiera nową wysokość.
                targets[i] = CGFloat.random(in: 0.22...1)
                nextRetarget[i] = now + Double.random(in: 0.14...0.3)
            }
            // Szybko w górę, łagodniej w dół — jak w systemowym wskaźniku.
            let speed: CGFloat = targets[i] > heights[i] ? 22 : 11
            heights[i] += (targets[i] - heights[i]) * min(1, dt * speed)
        }
        applyHeights()
    }

    private func applyHeights() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        let count = CGFloat(bars.count)
        let gap = max(1.2, (bounds.width - barWidth * count) / (count - 1))
        for (i, bar) in bars.enumerated() {
            let h = max(barWidth, bounds.height * heights[i])
            bar.frame = CGRect(
                x: CGFloat(i) * (barWidth + gap),
                y: (bounds.height - h) / 2,
                width: barWidth,
                height: h
            )
            bar.cornerRadius = barWidth / 2
        }
        CATransaction.commit()
    }
}

private final class BarsTarget: NSObject {
    weak var view: NowPlayingBarsUIView?
    init(_ view: NowPlayingBarsUIView) { self.view = view }
    @objc func tick(_ link: CADisplayLink) {
        if let view { view.step(link) } else { link.invalidate() }
    }
}

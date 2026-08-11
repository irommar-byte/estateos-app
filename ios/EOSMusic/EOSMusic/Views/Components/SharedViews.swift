import SwiftUI
import UIKit
import ImageIO

enum RemoteImageCache {
    static let memory: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 80
        cache.totalCostLimit = 24 * 1024 * 1024
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

struct ArtworkImage: View {
    let url: URL?
    var size: CGFloat = 56
    var cornerRadius: CGFloat = 10
    var circleClip = false
    /// Animated GIF/APNG — off by default (player / lists must stay responsive).
    var allowAnimated = false
    /// Immediate cover from ID3 / Now Playing while remote URL loads (critical on iPad player).
    var fallbackImage: UIImage? = nil

    @State private var stillImage: UIImage?
    @State private var animatedImage: UIImage?
    @State private var loadingURL: URL?

    private var maxPixelSize: Int {
        // Cap decode size — huge iPad hero canvases don't need 4× retina bitmaps.
        min(1024, Int(ceil(size * UIScreen.main.scale)))
    }

    var body: some View {
        Group {
            if let animatedImage {
                AnimatedUIImageView(image: animatedImage)
            } else if let stillImage {
                Image(uiImage: stillImage)
                    .resizable()
                    .scaledToFill()
            } else if let fallbackImage {
                Image(uiImage: fallbackImage)
                    .resizable()
                    .scaledToFill()
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .modifier(ArtworkClip(circleClip: circleClip, cornerRadius: cornerRadius, size: size))
        .task(id: "\(url?.absoluteString ?? "nil")|\(maxPixelSize)|\(allowAnimated)") {
            await loadArtwork()
        }
    }

    private var placeholder: some View {
        ZStack {
            LinearGradient(
                colors: [EOSTheme.accent.opacity(0.35), EOSTheme.accentSecondary.opacity(0.3)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Image(systemName: "music.note")
                .font(.system(size: max(14, size * 0.28), weight: .medium))
                .foregroundStyle(.white.opacity(0.7))
        }
    }

    @MainActor
    private func loadArtwork() async {
        guard let url else {
            stillImage = nil
            animatedImage = nil
            loadingURL = nil
            return
        }
        loadingURL = url
        let pixelSize = maxPixelSize

        if let cached = RemoteImageCache.image(for: url, maxPixelSize: pixelSize), !allowAnimated {
            stillImage = cached
            animatedImage = nil
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
        guard loadingURL == url else { return }
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
                    switch downloadState {
                    case .done:
                        Text("\(index)")
                            .font(indexFont)
                            .foregroundStyle(isPlaying ? EOSTheme.accent : EOSTheme.textMuted)
                    case .acquiringServer(let progress):
                        ServerCloudProgressIcon(progress: progress, size: indexWidth)
                    case .downloading(let progress):
                        ServerCloudProgressIcon(progress: progress, size: indexWidth)
                    case .onServer:
                        // Stonowana, ale zawsze widoczna: „utwór jest na serwerze EOS".
                        Image(systemName: "icloud.fill")
                            .font(.system(size: 10, weight: .medium))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(EOSTheme.accent.opacity(0.85))
                            .frame(width: 20, height: 20)
                            .background(EOSTheme.accent.opacity(0.1), in: Circle())
                            .accessibilityLabel("Na serwerze EOS")
                    case .failed:
                        Image(systemName: "exclamationmark.icloud")
                            .font(.caption2)
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(EOSTheme.accent)
                    case .idle:
                        // „Do pobrania" — delikatna fioletowa pastylka.
                        Image(systemName: "icloud.and.arrow.down")
                            .font(.system(size: 10, weight: .medium))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(EOSTheme.accentSecondary.opacity(0.9))
                            .frame(width: 20, height: 20)
                            .background(EOSTheme.accentSecondary.opacity(0.09), in: Circle())
                            .accessibilityLabel("Do pobrania")
                    }
                }
                .frame(width: max(indexWidth, 22), alignment: .trailing)
            }
            ArtworkImage(url: artworkURL, size: artSize, cornerRadius: artRadius)
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

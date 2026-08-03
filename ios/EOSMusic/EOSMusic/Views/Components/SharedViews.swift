import SwiftUI
import UIKit
import ImageIO

enum RemoteImageCache {
    static let memory = NSCache<NSURL, UIImage>()

    static func image(for url: URL) -> UIImage? {
        if url.isFileURL {
            return UIImage(contentsOfFile: url.path)
        }
        return memory.object(forKey: url as NSURL)
    }

    static func store(_ image: UIImage, for url: URL) {
        guard !url.isFileURL else { return }
        memory.setObject(image, forKey: url as NSURL)
    }
}

enum ArtworkLoader {
    struct Result {
        let still: UIImage
        let animated: UIImage?
    }

    static func load(from data: Data) -> Result? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
            guard let still = UIImage(data: data) else { return nil }
            return Result(still: still, animated: nil)
        }
        let count = CGImageSourceGetCount(source)
        guard count > 0 else {
            guard let still = UIImage(data: data) else { return nil }
            return Result(still: still, animated: nil)
        }

        if count == 1 {
            guard let still = UIImage(data: data) ?? makeFrame(source, index: 0).map(UIImage.init(cgImage:)) else {
                return nil
            }
            return Result(still: still, animated: nil)
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
        return Result(still: first, animated: animated)
    }

    private static func makeFrame(_ source: CGImageSource, index: Int) -> CGImage? {
        CGImageSourceCreateImageAtIndex(source, index, [kCGImageSourceShouldCache: true] as CFDictionary)
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

    @State private var stillImage: UIImage?
    @State private var animatedImage: UIImage?
    @State private var loadingURL: URL?

    var body: some View {
        Group {
            if let animatedImage {
                AnimatedUIImageView(image: animatedImage)
            } else if let stillImage {
                Image(uiImage: stillImage)
                    .resizable()
                    .scaledToFill()
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .modifier(ArtworkClip(circleClip: circleClip, cornerRadius: cornerRadius, size: size))
        .task(id: url?.absoluteString) {
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

        if url.isFileURL {
            if let data = try? Data(contentsOf: url), let loaded = ArtworkLoader.load(from: data) {
                stillImage = loaded.still
                animatedImage = loaded.animated
                return
            }
            stillImage = UIImage(contentsOfFile: url.path)
            animatedImage = nil
            return
        }

        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 20
            if url.host == AppConfig.apiBaseURL.host || url.absoluteString.contains("/api/music/folders/") {
                if let token = SessionStore.load()?.token {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
            }
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  let loaded = ArtworkLoader.load(from: data) else { return }
            guard loadingURL == url else { return }
            RemoteImageCache.store(loaded.still, for: url)
            stillImage = loaded.still
            animatedImage = loaded.animated
        } catch {
            // Keep placeholder / cached still.
        }
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

    private var rowSpacing: CGFloat { ui.ultraCompact ? 8 : 10 }
    private var indexWidth: CGFloat { ui.ultraCompact ? 18 : 20 }
    private var artSize: CGFloat { ui.ultraCompact ? 36 : 42 }
    private var artRadius: CGFloat { ui.ultraCompact ? 6 : 7 }
    private var textSpacing: CGFloat { ui.ultraCompact ? 1 : 2 }
    private var verticalPadding: CGFloat { ui.ultraCompact ? 1 : 3 }
    private var titleFont: Font { ui.ultraCompact ? .caption.weight(.semibold) : .subheadline.weight(.semibold) }
    private var subtitleFont: Font { ui.ultraCompact ? .caption2 : .caption2 }
    private var metaFont: Font { ui.ultraCompact ? .caption2.monospacedDigit() : .caption2.monospacedDigit() }
    private var indexFont: Font { ui.ultraCompact ? .caption2.weight(.semibold) : .caption.weight(.semibold) }

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
                        Image(systemName: "icloud.fill")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(EOSTheme.accent)
                            .shadow(color: EOSTheme.accent.opacity(0.45), radius: 3)
                    case .failed:
                        Image(systemName: "exclamationmark.icloud")
                            .font(.caption2)
                            .foregroundStyle(EOSTheme.accent)
                    case .idle:
                        Image(systemName: "icloud")
                            .font(.caption2)
                            .foregroundStyle(EOSTheme.accentSecondary)
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
            Text(formatDuration(duration))
                .font(metaFont)
                .foregroundStyle(EOSTheme.textMuted)
        }
        .padding(.vertical, verticalPadding)
        .contentShape(Rectangle())
    }
}

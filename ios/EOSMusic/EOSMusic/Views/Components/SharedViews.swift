import SwiftUI
import UIKit

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

struct ArtworkImage: View {
    let url: URL?
    var size: CGFloat = 56
    var cornerRadius: CGFloat = 10
    var circleClip = false

    @State private var image: UIImage?
    @State private var loadingURL: URL?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
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
            image = nil
            loadingURL = nil
            return
        }
        if let cached = RemoteImageCache.image(for: url) {
            image = cached
            loadingURL = url
            return
        }
        loadingURL = url
        if url.isFileURL {
            image = UIImage(contentsOfFile: url.path)
            return
        }

        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 20
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                  let loaded = UIImage(data: data) else { return }
            guard loadingURL == url else { return }
            RemoteImageCache.store(loaded, for: url)
            image = loaded
        } catch {
            // Keep placeholder.
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
                if downloadState == .done {
                    Text("\(index)")
                        .font(indexFont)
                        .foregroundStyle(isPlaying ? EOSTheme.accent : EOSTheme.textMuted)
                        .frame(width: indexWidth, alignment: .trailing)
                } else if case .downloading = downloadState {
                    Image(systemName: "icloud")
                        .font(.caption2)
                        .foregroundStyle(EOSTheme.textMuted)
                        .frame(width: indexWidth, alignment: .trailing)
                } else if downloadState == .onServer {
                    Image(systemName: "icloud.fill")
                        .font(.caption2)
                        .foregroundStyle(EOSTheme.accent.opacity(0.85))
                        .frame(width: indexWidth, alignment: .trailing)
                } else {
                    Image(systemName: "icloud")
                        .font(.caption2)
                        .foregroundStyle(EOSTheme.accentSecondary)
                        .frame(width: indexWidth, alignment: .trailing)
                }
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

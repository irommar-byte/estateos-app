import SwiftUI
import UIKit

struct ArtworkImage: View {
    let url: URL?
    var size: CGFloat = 56
    var cornerRadius: CGFloat = 10

    var body: some View {
        Group {
            if let url {
                if url.isFileURL, let image = UIImage(contentsOfFile: url.path) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        placeholder
                    }
                }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }

    private var placeholder: some View {
        ZStack {
            LinearGradient(colors: [EOSTheme.accent.opacity(0.35), EOSTheme.accentSecondary.opacity(0.3)], startPoint: .topLeading, endPoint: .bottomTrailing)
            Image(systemName: "music.note")
                .foregroundStyle(.white.opacity(0.7))
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

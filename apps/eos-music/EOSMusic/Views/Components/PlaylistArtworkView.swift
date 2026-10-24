import SwiftUI

struct PlaylistImportBadgeView: View {
    let badge: PlaylistImportBadge

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: badge.systemImage)
                .font(.system(size: 8, weight: .bold))
            Text(badge.title)
                .font(.system(size: 9, weight: .bold))
        }
        .foregroundStyle(.secondary)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(Color.secondary.opacity(0.14), in: Capsule())
        .accessibilityLabel(badge.title)
    }
}

struct PlaylistArtworkView: View {
    let folder: MusicFolder
    var tracks: [MusicTrack]
    var size: CGFloat
    var cornerRadius: CGFloat = 8
    var fillsWidth: Bool = false

    private var mosaicURLs: [URL] {
        if folder.artworkURL != nil { return [] }
        var seen = Set<String>()
        var urls: [URL] = []
        for track in tracks {
            guard let url = track.artworkURL else { continue }
            guard seen.insert(url.absoluteString).inserted else { continue }
            urls.append(url)
            if urls.count == 4 { break }
        }
        return urls
    }

    var body: some View {
        Group {
            if fillsWidth {
                Color.clear
                    .aspectRatio(1, contentMode: .fit)
                    .overlay {
                        GeometryReader { geo in
                            let side = min(geo.size.width, geo.size.height)
                            artwork(side: side)
                                .frame(width: side, height: side)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            } else {
                artwork(side: size)
                    .frame(width: size, height: size)
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            }
        }
    }

    @ViewBuilder
    private func artwork(side: CGFloat) -> some View {
        if let url = folder.artworkURL {
            ArtworkImage(url: url, size: side, cornerRadius: 0, allowAnimated: true)
        } else if mosaicURLs.count >= 2 {
            mosaic(side: side)
        } else if let url = mosaicURLs.first ?? tracks.first?.artworkURL {
            ArtworkImage(url: url, size: side, cornerRadius: 0, allowAnimated: true)
        } else {
            placeholder
        }
    }

    private func mosaic(side: CGFloat) -> some View {
        let cell = (side - 1) / 2
        return VStack(spacing: 1) {
            HStack(spacing: 1) {
                tile(mosaicURLs[safe: 0], cell: cell)
                tile(mosaicURLs[safe: 1], cell: cell)
            }
            HStack(spacing: 1) {
                tile(mosaicURLs[safe: 2], cell: cell)
                tile(mosaicURLs[safe: 3], cell: cell)
            }
        }
        .background(Color(white: 0.18))
    }

    @ViewBuilder
    private func tile(_ url: URL?, cell: CGFloat) -> some View {
        if let url {
            ArtworkImage(url: url, size: cell, cornerRadius: 0, allowAnimated: false)
        } else {
            Color(white: 0.22)
                .overlay {
                    Image(systemName: "music.note")
                        .font(.system(size: max(10, cell * 0.28), weight: .medium))
                        .foregroundStyle(.white.opacity(0.35))
                }
                .frame(width: cell, height: cell)
        }
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [
                        Color(red: 0.72, green: 0.28, blue: 0.42),
                        Color(red: 0.28, green: 0.16, blue: 0.32)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay {
                Image(systemName: "music.note.list")
                    .font(.system(size: size * 0.32, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.88))
            }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

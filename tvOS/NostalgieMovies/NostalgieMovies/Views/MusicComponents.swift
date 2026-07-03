import SwiftUI

struct MusicSelection: Identifiable, Hashable {
    let id: String
    let title: String
    let url: String
    let artist: String?
    let album: String?
    let thumbnail: String?
    let duration: Double?
    let quality: String?

    init(from item: SearchResultItem) {
        id = item.url
        title = item.title
        url = item.url
        artist = item.uploader
        album = item.album
        thumbnail = item.thumbnail
        duration = item.duration
        quality = item.quality
    }

    init(from track: MusicTrack) {
        id = track.url
        title = track.title
        url = track.url
        artist = track.artist
        album = track.album
        thumbnail = track.thumbnail
        duration = track.duration
        quality = track.quality
    }

    var subtitle: String {
        [artist, album].compactMap { value in
            guard let value, !value.isEmpty else { return nil }
            return value
        }.joined(separator: " · ")
    }

    var trackPayload: MoviesAPIClient.MusicTrackPayload {
        MoviesAPIClient.MusicTrackPayload(
            url: url,
            title: title,
            artist: artist,
            album: album,
            thumbnail: thumbnail,
            duration: duration,
            quality: quality ?? "320 kbps",
            source: "apple-music"
        )
    }
}

struct MusicFolderCard: View {
    let folder: MusicFolder
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    NostalgieTheme.accent.opacity(0.35),
                                    NostalgieTheme.accentSecondary.opacity(0.28),
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 220, height: 220)
                    Image(systemName: "folder.fill")
                        .font(.system(size: 54, weight: .medium))
                        .foregroundStyle(.white.opacity(0.92))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(folder.name)
                        .font(.headline.weight(.semibold))
                        .lineLimit(2)
                    Text("\(folder.trackCount ?? 0) utworów")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(width: 220, alignment: .leading)
            }
            .padding(12)
        }
        .buttonStyle(MediaCardButtonStyle())
    }
}

struct MusicTrackCard: View {
    let title: String
    let subtitle: String
    let thumbnailURL: URL?
    let duration: Double?
    let quality: String?
    let layout: Layout
    let action: () -> Void

    enum Layout {
        case grid
        case row
    }

    var body: some View {
        Button(action: action) {
            if layout == .row {
                rowLayout
            } else {
                gridLayout
            }
        }
        .buttonStyle(MediaCardButtonStyle())
    }

    private var gridLayout: some View {
        VStack(alignment: .leading, spacing: 14) {
            cover(size: nil)
                .aspectRatio(1, contentMode: .fit)
                .frame(maxWidth: .infinity)
            textBlock(titleFont: .headline.weight(.semibold))
        }
        .padding(12)
        .frame(minHeight: 320, alignment: .topLeading)
    }

    private var rowLayout: some View {
        HStack(spacing: 22) {
            cover(size: 140)
                .frame(width: 140, height: 140)
            textBlock(titleFont: .title3.weight(.semibold))
            Spacer(minLength: 0)
            if let quality, !quality.isEmpty {
                Text(quality.uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.85))
                    .glassCapsule(paddingH: 10, paddingV: 6)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassPanel(cornerRadius: 18)
    }

    private func cover(size: CGFloat?) -> some View {
        ZStack {
            PosterRemoteImage(url: thumbnailURL)
                .scaledToFill()
                .frame(maxWidth: size ?? .infinity, maxHeight: size ?? .infinity)
                .clipped()

            LinearGradient(
                colors: [.black.opacity(0.08), .clear, .black.opacity(0.55)],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack {
                HStack {
                    SourceBadgeView(source: "apple-music")
                    Spacer(minLength: 0)
                    if let durationLabel = MediaDurationFormat.label(for: duration) {
                        MediaDurationBadge(text: durationLabel)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(12)
        }
        .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.posterCornerRadius, style: .continuous))
    }

    private func textBlock(titleFont: Font) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(titleFont)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            Text(subtitle.isEmpty ? "Apple Music" : subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct MusicFolderCreateSheet: View {
    @Binding var name: String
    let onCancel: () -> Void
    let onCreate: () -> Void

    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            NostalgieAmbientBackground()
            VStack(alignment: .leading, spacing: 28) {
                Text("Nowy folder")
                    .font(.largeTitle.bold())
                Text("Utwórz playlistę / folder na utwory Apple Music.")
                    .foregroundStyle(.secondary)

                NostalgieTextField(
                    placeholder: "np. Vege, Na imprezę",
                    text: $name,
                    isFocused: focused == true
                )
                .focused($focused)

                HStack(spacing: 18) {
                    Button("Anuluj", action: onCancel)
                        .buttonStyle(FocusCardButtonStyle())
                    Button("Utwórz", action: onCreate)
                        .buttonStyle(FocusCardButtonStyle())
                        .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .padding(72)
            .frame(maxWidth: 760, alignment: .leading)
        }
        .onAppear { focused = true }
        .onExitCommand(perform: onCancel)
    }
}

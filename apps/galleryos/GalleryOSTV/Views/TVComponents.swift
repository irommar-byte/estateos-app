import SwiftUI

enum TVGridLayout {
    /// Five tiles across the 1920 pt screen, inside the 80 pt margins.
    static let columnCount = 5
    static let gap: CGFloat = 24
    static let photoSide: CGFloat = 332
    static let photoColumns = Array(repeating: GridItem(.fixed(photoSide), spacing: gap), count: columnCount)
    static let coverColumns = Array(repeating: GridItem(.flexible(), spacing: TVTheme.spacing), count: 3)
    static let kindColumns = Array(repeating: GridItem(.flexible(), spacing: TVTheme.spacing), count: 4)
}

/// Thumbnail that loads itself from the pipeline and fades in. When nothing can be made it
/// settles on a quiet symbol instead of spinning forever, and tries again on reconnect.
struct TVThumb: View {
    let hash: String
    var video = false
    @EnvironmentObject private var pipeline: TVImagePipeline
    @State private var image: UIImage?
    @State private var showedSpinner = false
    @State private var gaveUp = false
    @State private var attempt = 0

    private var painted: UIImage? { image ?? pipeline.cachedThumbnail(hash: hash) }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.white.opacity(0.11), Color.white.opacity(0.04)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            if let painted {
                Image(uiImage: painted)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            } else if gaveUp || hash.isEmpty {
                Image(systemName: video ? "film" : "photo")
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(.white.opacity(0.35))
                    .transition(.opacity)
            } else if showedSpinner {
                ProgressView()
                    .tint(.white.opacity(0.45))
            }
        }
        .animation(.easeOut(duration: 0.28), value: image != nil)
        .animation(.easeOut(duration: 0.28), value: gaveUp)
        .task(id: "\(hash)#\(pipeline.epoch)") {
            guard !hash.isEmpty, image == nil else { return }
            if let cached = pipeline.cachedThumbnail(hash: hash) {
                image = cached
                return
            }
            gaveUp = false
            // Delay the spinner so cache hits never flash a ProgressView.
            let spinner = Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                if !Task.isCancelled, image == nil { showedSpinner = true }
            }
            defer { spinner.cancel() }
            // A photo whose preview is missing on the server is rebuilt from the original, which
            // is slow. Keep trying instead of settling on the placeholder for good.
            while !Task.isCancelled {
                if let loaded = await pipeline.thumbnail(hash: hash) {
                    image = loaded
                    showedSpinner = false
                    return
                }
                if Task.isCancelled { return }
                showedSpinner = false
                gaveUp = true
                let wait = UInt64(min(attempt, 5)) * 4_000_000_000 + 4_000_000_000
                attempt += 1
                try? await Task.sleep(nanoseconds: wait)
                guard !Task.isCancelled else { return }
                gaveUp = false
                showedSpinner = true
            }
        }
        .onAppear {
            if image == nil, let cached = pipeline.cachedThumbnail(hash: hash) {
                image = cached
            }
        }
    }
}

struct TVPhotoBadges: View {
    let photo: PhotoRef

    var body: some View {
        ZStack(alignment: .bottom) {
            if photo.traits.isVideo || photo.traits.contains(.live) || photo.isFavorite {
                LinearGradient(colors: [.clear, .black.opacity(0.55)], startPoint: .center, endPoint: .bottom)
            }
            HStack(spacing: 8) {
                if photo.traits.isVideo {
                    Image(systemName: "play.fill")
                    Text(PhotoFormat.duration(photo.duration)).monospacedDigit()
                } else if photo.traits.contains(.live) {
                    Text("LIVE").font(.system(size: 16, weight: .heavy))
                }
                Spacer(minLength: 0)
                if photo.isFavorite { Image(systemName: "heart.fill") }
            }
            .font(.system(size: 20, weight: .semibold))
            .foregroundStyle(.white)
            .padding(12)
            .opacity(photo.traits.isVideo || photo.traits.contains(.live) || photo.isFavorite ? 1 : 0)
        }
    }
}

/// Square photo tile for grids. The picture is clipped to the tile so a focused card
/// cannot cover the title, the tabs, or the photo next to it.
struct TVPhotoTile: View {
    let photo: PhotoRef
    var zoom: Namespace.ID? = nil
    var onSlideshow: (() -> Void)? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Color.clear
                .aspectRatio(1, contentMode: .fit)
                .overlay { TVThumb(hash: photo.cloudHash ?? "", video: photo.traits.isVideo) }
                .overlay { TVPhotoBadges(photo: photo) }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .clipped()
        }
        .buttonStyle(.card)
        .modifier(TVZoomSource(id: photo.id, namespace: zoom))
        .contextMenu {
            Button("Otwórz", systemImage: "arrow.up.left.and.arrow.down.right", action: action)
            if let onSlideshow {
                Button("Pokaz slajdów od tego zdjęcia", systemImage: "play.rectangle.on.rectangle", action: onSlideshow)
            }
        }
        .accessibilityLabel(TVFormat.dayTitle(photo.created))
    }
}

/// Source of the zoom transition into the full screen viewer.
struct TVZoomSource: ViewModifier {
    let id: String
    let namespace: Namespace.ID?

    func body(content: Content) -> some View {
        if let namespace {
            content.matchedTransitionSource(id: id, in: namespace)
        } else {
            content
        }
    }
}

/// Wide cover card for years, months and albums.
struct TVCoverCard: View {
    let hash: String
    let title: String
    let subtitle: String
    var detail: String = ""

    var body: some View {
        Color.clear
            .aspectRatio(16.0 / 10.0, contentMode: .fit)
            .overlay { TVThumb(hash: hash) }
            .overlay(alignment: .bottomLeading) {
                ZStack(alignment: .bottomLeading) {
                    LinearGradient(colors: [.clear, .black.opacity(0.72)], startPoint: .center, endPoint: .bottom)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        HStack(spacing: 10) {
                            Text(subtitle)
                            if !detail.isEmpty {
                                Text("·")
                                Text(detail).lineLimit(1)
                            }
                        }
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(.white.opacity(0.78))
                    }
                    .foregroundStyle(.white)
                    .padding(20)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .clipped()
    }
}

/// Compact media-type card (Filmy, Live Photos…): a blurred cover behind a symbol.
struct TVKindCard: View {
    let album: TVAlbum

    var body: some View {
        Color.clear
            .aspectRatio(2.1, contentMode: .fit)
            .overlay {
                TVThumb(hash: album.cover.cloudHash ?? "")
                    .blur(radius: 18)
                    .overlay(Color.black.opacity(0.42))
            }
            .overlay(alignment: .leading) {
                HStack(spacing: 18) {
                    Image(systemName: album.symbol ?? "photo.on.rectangle")
                        .font(.system(size: 40, weight: .semibold))
                        .frame(width: 56)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(album.name)
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                        Text(PhotoFormat.grouped(album.photos.count))
                            .font(.system(size: 20, weight: .medium))
                            .foregroundStyle(.white.opacity(0.75))
                            .monospacedDigit()
                    }
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 24)
            }
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .clipped()
    }
}

/// Lata / Miesiące / Dni / Wszystkie, as a row the remote can focus. A segmented picker
/// on tvOS floats out of the header and lands on top of the photos.
struct TVZoomPicker: View {
    @Binding var zoomRaw: Int

    var body: some View {
        HStack(spacing: 16) {
            ForEach(PhotoZoom.allCases) { level in
                let on = zoomRaw == level.rawValue
                Button(level.title) { zoomRaw = level.rawValue }
                    .buttonStyle(.bordered)
                    .tint(on ? TVTheme.accent : Color.white.opacity(0.18))
            }
        }
        .animation(TVTheme.spring, value: zoomRaw)
    }
}

struct TVScreenHeader: View {
    let title: String
    let subtitle: String
    var showsLink = false

    var body: some View {
        HStack(alignment: .top, spacing: 30) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.system(size: 58, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                        .contentTransition(.numericText())
                }
            }
            Spacer(minLength: 0)
            if showsLink {
                TVLinkPill()
                    .padding(.top, 6)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Who is signed in, which server, and how the TV reaches it. Not focusable — it only informs.
struct TVLinkPill: View {
    @EnvironmentObject private var link: TVLinkState
    @EnvironmentObject private var session: TVSession

    var body: some View {
        HStack(spacing: 16) {
            TVAvatar(name: session.server?.username ?? "")
            VStack(alignment: .leading, spacing: 3) {
                Text(session.server?.username.isEmpty == false ? session.server!.username : "GalleryOS")
                    .font(.system(size: 22, weight: .semibold))
                    .lineLimit(1)
                HStack(spacing: 8) {
                    indicator
                    TimelineView(.periodic(from: .now, by: 30)) { _ in
                        Text(line)
                            .lineLimit(1)
                            .contentTransition(.opacity)
                    }
                }
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(.secondary)
            }
        }
        .padding(.leading, 10)
        .padding(.trailing, 24)
        .padding(.vertical, 10)
        .glassEffect(.regular, in: .capsule)
        .animation(TVTheme.spring, value: link.kind)
        .animation(TVTheme.spring, value: link.refreshing)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var indicator: some View {
        if link.refreshing {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundStyle(tint)
                .symbolEffect(.rotate, options: .repeat(.continuous), isActive: link.refreshing)
        } else {
            Circle()
                .fill(tint)
                .frame(width: 12, height: 12)
                .shadow(color: tint.opacity(0.8), radius: 6)
        }
    }

    private var server: String { session.server?.title ?? "serwer" }

    private var tint: Color {
        switch link.kind {
        case .connecting: return .orange
        case .online(.home): return .green
        case .online(.remote): return TVTheme.accent
        case .offline: return .red
        }
    }

    private var line: String {
        switch link.kind {
        case .connecting:
            return "Łączę z \(server)…"
        case .online(let route):
            var way = "przez internet"
            if case .home = route { way = "w domu" }
            if link.refreshing { return "\(server) · \(way) · sprawdzam nowe" }
            return "\(server) · \(way) · \(TVFormat.updated(link.updatedAt))"
        case .offline:
            return "Bez połączenia · pokazuję zapisaną bibliotekę"
        }
    }
}

struct TVAvatar: View {
    let name: String
    var size: CGFloat = 46

    var body: some View {
        Circle()
            .fill(LinearGradient(colors: [TVTheme.accent, Color(red: 0.55, green: 0.36, blue: 0.98)], startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: size, height: size)
            .overlay {
                Text(name.first.map { String($0).uppercased() } ?? "G")
                    .font(.system(size: size * 0.46, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
    }
}

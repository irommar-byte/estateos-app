import SwiftUI
import UIKit

enum PosterImageService {
    private static let cache = NSCache<NSString, UIImage>()
    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 48_000_000, diskCapacity: 200_000_000)
        config.requestCachePolicy = .returnCacheDataElseLoad
        return URLSession(configuration: config)
    }()

    static func proxyURL(for remote: URL) -> URL {
        var components = URLComponents(url: AppConfig.apiBaseURL.appendingPathComponent("api/thumb"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "url", value: remote.absoluteString)]
        return components.url ?? remote
    }

    static func resolvedURL(from raw: URL?) -> URL? {
        guard let raw else { return nil }
        let trimmed = raw.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let remote = URL(string: trimmed) else { return nil }
        if remote.path.contains("/api/thumb") { return remote }
        return proxyURL(for: remote)
    }

    static func loadImage(from raw: URL?) async -> UIImage? {
        guard let requestURL = resolvedURL(from: raw) else { return nil }
        let key = requestURL.absoluteString as NSString
        if let cached = cache.object(forKey: key) { return cached }

        var request = URLRequest(url: requestURL)
        request.setValue("NostalgieMovies-tvOS/1.0", forHTTPHeaderField: "User-Agent")
        if let token = SessionStore.load()?.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                return nil
            }
            guard let image = UIImage(data: data) else { return nil }
            cache.setObject(image, forKey: key)
            return image
        } catch {
            return nil
        }
    }
}

struct PosterRemoteImage: View {
    let url: URL?
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                PosterPlaceholder()
            }
        }
        .task(id: url?.absoluteString) {
            image = await PosterImageService.loadImage(from: url)
        }
    }
}

struct MediaSelection: Identifiable, Hashable {
    let id: String
    let title: String
    let url: String
    let thumbnail: String?
    let source: String?
    let detail: String?
    let duration: Double?
    let quality: String?
    let isSerial: Bool
    let isEpisode: Bool
    let isPremium: Bool

    init(from item: SearchResultItem) {
        id = item.url
        title = item.title
        url = item.url
        thumbnail = item.thumbnail
        source = item.source
        detail = item.detail
        duration = item.duration
        quality = item.quality
        isSerial = item.isSerial == true || (item.detail?.localizedCaseInsensitiveContains("serial") == true)
        isEpisode = false
        isPremium = item.premium == true
    }

    init(from episode: EpisodeItem, series: VideoInfoResponse) {
        id = episode.url
        title = episode.title
        url = episode.url
        thumbnail = episode.thumbnail ?? series.thumbnail
        source = series.uploader
        detail = "Odcinek · \(series.title)"
        duration = episode.duration
        quality = nil
        isSerial = false
        isEpisode = true
        isPremium = false
    }

    init(from info: VideoInfoResponse) {
        id = info.webpageUrl
        title = info.title
        url = info.webpageUrl
        thumbnail = info.thumbnail
        source = info.uploader
        detail = info.isPlaylist == true ? "Serial · \(info.episodeCount ?? 0) odc." : "Film"
        duration = info.duration
        quality = nil
        isSerial = info.isPlaylist == true
        isEpisode = false
        isPremium = false
    }

    var favoriteItem: FavoriteItem {
        FavoriteItem(
            id: url,
            type: isSerial ? "series" : "video",
            url: url,
            title: title,
            thumbnail: thumbnail,
            source: source,
            detail: detail,
            duration: duration
        )
    }
}

enum MediaSourceMeta {
    case tvp
    case cdaHd
    case cda
    case youtube
    case appleMusic
    case other(String)

    static func normalize(_ raw: String?) -> MediaSourceMeta {
        guard let raw, !raw.isEmpty else { return .other("") }
        let s = raw.lowercased()
        if s.contains("apple-music") || s.contains("apple music") { return .appleMusic }
        if s.contains("cda-hd") || s.contains("cdahd") || s.contains("cda-hd.cc") { return .cdaHd }
        if s.contains("tvp") { return .tvp }
        if s.contains("youtube") || s.contains("youtu.be") { return .youtube }
        if s.contains("cda") { return .cda }
        return .other(raw)
    }

    var label: String {
        switch self {
        case .tvp: return "TVP"
        case .cdaHd: return "CDA-HD"
        case .cda: return "CDA"
        case .youtube: return "YouTube"
        case .appleMusic: return "Muzyka"
        case .other(let value):
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return "Inne" }
            if trimmed.count <= 12 { return trimmed.uppercased() }
            return String(trimmed.prefix(10)).uppercased()
        }
    }

    var accent: Color {
        switch self {
        case .tvp: return Color(red: 0.92, green: 0.18, blue: 0.32)
        case .cdaHd: return Color(red: 0.28, green: 0.78, blue: 0.52)
        case .cda: return Color(red: 0.98, green: 0.52, blue: 0.12)
        case .youtube: return Color(red: 0.96, green: 0.24, blue: 0.24)
        case .appleMusic: return Color(red: 1.0, green: 0.18, blue: 0.33)
        case .other: return NostalgieTheme.accentSecondary
        }
    }
}

enum MediaCardCopy {
    static func cleanedSubtitle(detail: String?, source: String?) -> String {
        if let detail, !detail.isEmpty {
            return sanitizeDetail(detail)
        }
        let label = MediaSourceMeta.normalize(source).label
        return label.isEmpty ? " " : label
    }

    static func normalizedSourceKey(_ source: String?) -> String? {
        guard let source, !source.isEmpty else { return nil }
        switch MediaSourceMeta.normalize(source) {
        case .tvp: return "tvp"
        case .cdaHd: return "cda-hd"
        case .cda: return "cda"
        case .youtube: return "youtube"
        case .appleMusic: return "apple-music"
        case .other: return source
        }
    }

    static func shortTitle(_ raw: String, maxLength: Int = 44) -> String {
        var title = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return raw }

        if let slash = title.firstIndex(of: "/") {
            let left = title[..<slash].trimmingCharacters(in: .whitespaces)
            let right = title[title.index(after: slash)...].trimmingCharacters(in: .whitespaces)
            if left.count >= 2 {
                title = left
            } else if !right.isEmpty {
                title = right
            }
        }

        if let open = title.lastIndex(of: "("), open > title.startIndex {
            let prefix = title[..<open].trimmingCharacters(in: .whitespaces)
            if prefix.count >= 3 {
                title = prefix
            }
        }

        if title.count > maxLength {
            return String(title.prefix(max(1, maxLength - 1))) + "…"
        }
        return title
    }

    private static func sanitizeDetail(_ detail: String) -> String {
        var result = detail
            .replacingOccurrences(of: "cda-hd.cc", with: "CDA-HD", options: .caseInsensitive)
            .replacingOccurrences(of: "TVP VOD", with: "TVP", options: .caseInsensitive)
            .replacingOccurrences(of: "oglad...", with: "ogladaj", options: .caseInsensitive)

        while result.contains(" · · ") {
            result = result.replacingOccurrences(of: " · · ", with: " · ")
        }
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct SourceBadgeView: View {
    let source: String?

    private var meta: MediaSourceMeta { MediaSourceMeta.normalize(source) }

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(meta.accent)
                .frame(width: 7, height: 7)
            Text(meta.label)
                .font(NostalgieFont.badge)
                .tracking(0.6)
        }
        .foregroundStyle(.white.opacity(0.94))
        .glassCapsule(paddingH: 11, paddingV: 7)
    }
}

struct PremiumBadge: View {
    var body: some View {
        Text("PREMIUM")
            .font(NostalgieFont.badge)
            .tracking(1)
            .foregroundStyle(Color(red: 1, green: 0.82, blue: 0.45))
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color(red: 0.92, green: 0.45, blue: 0.08).opacity(0.28))
            .clipShape(Capsule())
            .overlay {
                Capsule().stroke(Color(red: 1, green: 0.6, blue: 0.15).opacity(0.55), lineWidth: 1)
            }
    }
}

struct MediaTypeBadge: View {
    let label: String

    var body: some View {
        Text(label)
            .font(NostalgieFont.badge)
            .tracking(1)
            .foregroundStyle(.white.opacity(0.92))
            .glassCapsule(paddingH: 10, paddingV: 7)
    }
}

struct FavoriteIndicator: View {
    var body: some View {
        Image(systemName: "heart.fill")
            .font(NostalgieFont.rounded(13, weight: .semibold))
            .foregroundStyle(NostalgieTheme.accent)
            .frame(width: 32, height: 32)
            .background {
                Circle()
                    .fill(.ultraThinMaterial)
                    .background(Circle().fill(Color.black.opacity(0.42)))
            }
    }
}

struct PosterPlaceholder: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color.white.opacity(0.08),
                    Color.white.opacity(0.03),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Image(systemName: "film")
                .font(NostalgieFont.rounded(32, weight: .light))
                .foregroundStyle(.white.opacity(0.28))
        }
    }
}

struct MediaDurationFormat {
    static func label(for seconds: Double?) -> String? {
        guard let seconds, seconds > 0 else { return nil }
        let total = Int(seconds.rounded())
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let secs = total % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }
}

struct MediaDurationBadge: View {
    let text: String

    var body: some View {
        Text(text)
            .font(NostalgieFont.badge.monospacedDigit())
            .foregroundStyle(.white.opacity(0.94))
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(Color.black.opacity(0.58))
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }
}

struct MediaCard: View {
    let title: String
    let subtitle: String
    let thumbnailURL: URL?
    let source: String?
    let typeLabel: String
    let quality: String?
    var duration: Double? = nil
    var isPremium: Bool = false
    var isFavorite: Bool = false
    var isLoading: Bool = false
    var layout: MediaCardLayout = .grid
    let action: () -> Void

    enum MediaCardLayout {
        case grid
        case shelf
    }

    private var displayTitle: String {
        layout == .shelf ? MediaCardCopy.shortTitle(title) : title
    }

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: layout == .shelf ? 8 : 10) {
                poster
                textBlock
            }
            .padding(layout == .shelf ? 8 : 10)
            .frame(
                maxWidth: layout == .shelf ? nil : .infinity,
                minHeight: layout == .shelf ? 228 : 252,
                alignment: .topLeading
            )
            .overlay {
                if isLoading {
                    ZStack {
                        Color.black.opacity(0.45)
                        ProgressView()
                            .scaleEffect(1.4)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
                }
            }
        }
        .buttonStyle(MediaCardButtonStyle())
        .disabled(isLoading)
    }

    private var poster: some View {
        ZStack {
            PosterRemoteImage(url: thumbnailURL)
            .aspectRatio(NostalgieTheme.posterAspectRatio, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .clipped()

            LinearGradient(
                colors: [.black.opacity(0.05), .clear, .black.opacity(0.62)],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack(spacing: 0) {
                HStack(alignment: .center, spacing: 8) {
                    Spacer(minLength: 0)
                    if isFavorite {
                        FavoriteIndicator()
                    }
                    if isPremium {
                        PremiumBadge()
                    }
                    MediaTypeBadge(label: typeLabel)
                }
                Spacer(minLength: 0)
                HStack(alignment: .bottom, spacing: 8) {
                    SourceBadgeView(source: source)
                    Spacer(minLength: 0)
                    if let durationLabel = MediaDurationFormat.label(for: duration) {
                        MediaDurationBadge(text: durationLabel)
                    }
                }
            }
            .padding(12)
        }
        .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.posterCornerRadius, style: .continuous))
    }

    private var textBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(displayTitle)
                .font(layout == .shelf ? NostalgieFont.rounded(.subheadline, weight: .semibold) : NostalgieFont.rowTitle)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                Text(subtitle)
                    .font(NostalgieFont.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if let quality, !quality.isEmpty {
                    Text(quality.uppercased())
                        .font(NostalgieFont.badge)
                        .tracking(0.6)
                        .foregroundStyle(.white.opacity(0.85))
                        .glassCapsule(paddingH: 8, paddingV: 4)
                }
            }
        }
        .padding(.horizontal, 4)
    }
}

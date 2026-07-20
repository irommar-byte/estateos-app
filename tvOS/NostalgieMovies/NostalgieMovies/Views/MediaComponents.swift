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
    static func decodedTitle(_ raw: String) -> String {
        var text = raw
        text = text.replacingOccurrences(of: "&#8211;", with: "–")
        text = text.replacingOccurrences(of: "&#8217;", with: "'")
        text = text.replacingOccurrences(of: "&amp;", with: "&")
        text = text.replacingOccurrences(of: "&quot;", with: "\"")
        text = text.replacingOccurrences(of: "&lt;", with: "<")
        text = text.replacingOccurrences(of: "&gt;", with: ">")
        if let regex = try? NSRegularExpression(pattern: "&#(\\d+);") {
            let ns = text as NSString
            let matches = regex.matches(in: text, range: NSRange(location: 0, length: ns.length))
            for match in matches.reversed() {
                guard match.numberOfRanges > 1,
                      let code = Int(ns.substring(with: match.range(at: 1))),
                      let scalar = UnicodeScalar(code) else { continue }
                text = (text as NSString).replacingCharacters(in: match.range, with: String(Character(scalar)))
            }
        }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

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
        .buttonStyle(MediaCardButtonStyle(focusScale: layout == .shelf ? 1.0 : 1.07))
        .focusEffectDisabled()
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

struct MediaDownloadedBadge: View {
    var body: some View {
        Label("Pobrany", systemImage: "checkmark.circle.fill")
            .font(NostalgieFont.rowTitle)
            .foregroundStyle(.green)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .padding(.horizontal, 20)
            .padding(.vertical, 13)
            .background(NostalgieTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous)
                    .stroke(Color.green.opacity(0.35), lineWidth: 1)
            }
    }
}

struct CdaHdRatingView: View {
    let rating: CdaHdRating

    private var value: Double { min(max(rating.value ?? 0, 0), 10) }
    private var barFraction: CGFloat { CGFloat((rating.barPercent ?? value * 10) / 100) }

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            Text(String(format: "%.1f", value))
                .font(NostalgieFont.rounded(34, weight: .bold))
                .foregroundStyle(.white)

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 3) {
                    ForEach(0..<10, id: \.self) { index in
                        Image(systemName: starName(for: index))
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(starColor(for: index))
                    }
                }

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.14))
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [NostalgieTheme.accent, NostalgieTheme.accentSecondary],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: max(8, geo.size.width * barFraction))
                    }
                }
                .frame(height: 7)

                Text(ratingCaption)
                    .font(NostalgieFont.caption)
                    .foregroundStyle(.white.opacity(0.62))
            }
        }
    }

    private var ratingCaption: String {
        var parts: [String] = ["TMDb: \(String(format: "%.1f/10", value))"]
        if let votes = rating.votes, votes > 0 {
            parts.append("\(votes) głosów")
        }
        return parts.joined(separator: " · ")
    }

    private func starName(for index: Int) -> String {
        let threshold = value / 2
        let position = Double(index) + 1
        if position <= threshold - 0.5 { return "star.fill" }
        if position - 0.5 <= threshold { return "star.leadinghalf.filled" }
        return "star"
    }

    private func starColor(for index: Int) -> Color {
        let threshold = value / 2
        let position = Double(index) + 1
        return position <= threshold ? NostalgieTheme.accent : Color.white.opacity(0.22)
    }
}

struct CdaHdLinkChip: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(NostalgieFont.caption)
                .lineLimit(1)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
        }
        .buttonStyle(FocusCardButtonStyle())
    }
}

struct CdaHdCastRow: View {
    let name: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: "star.fill")
                    .font(NostalgieFont.caption)
                    .foregroundStyle(NostalgieTheme.accentSecondary)
                    .frame(width: 22)

                Text(name)
                    .font(NostalgieFont.listTitle)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "chevron.right")
                    .font(NostalgieFont.caption)
                    .foregroundStyle(.white.opacity(0.35))
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
        }
        .buttonStyle(ListRowButtonStyle())
    }
}

struct CdaHdInfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Text(label)
                .font(NostalgieFont.caption)
                .foregroundStyle(.white.opacity(0.52))
                .frame(width: 170, alignment: .leading)
            Text(value)
                .font(NostalgieFont.metadata)
                .foregroundStyle(.white.opacity(0.86))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct CdaHdLinkRow: View {
    let label: String
    let links: [CdaHdLink]
    let onTap: (CdaHdLink) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(NostalgieFont.caption)
                .foregroundStyle(.white.opacity(0.52))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(links) { link in
                        CdaHdLinkChip(title: link.name, icon: "link") {
                            onTap(link)
                        }
                    }
                }
            }
        }
    }
}

struct CdaHdPhotoShelf: View {
    let photos: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScreenTitle(title: "Zdjęcia", subtitle: "Kadrów z serialu", level: .section)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(photos, id: \.self) { raw in
                        if let url = URL(string: raw) {
                            PosterRemoteImage(url: url)
                                .frame(width: 260, height: 146)
                                .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
                        }
                    }
                }
            }
            .fullBleedShelf()
        }
    }
}

// MARK: - Jakość streamu / pobierania

struct MediaQualityOptionRow: View {
    let option: MediaQualityOption
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(option.label)
                    .font(NostalgieFont.rowTitle)
                if !option.displaySubtitle.isEmpty {
                    Text(option.displaySubtitle)
                        .font(NostalgieFont.metadata)
                        .foregroundStyle(.white.opacity(0.58))
                }
            }
            Spacer()
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(NostalgieTheme.accent)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(isSelected ? Color.white.opacity(0.1) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct MediaStreamQualitySheet: View {
    let options: [MediaQualityOption]
    let selectedID: String
    let isBusy: Bool
    let onSelect: (MediaQualityOption) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Wybierz rozdzielczość streamu. Zmiana może chwilę potrwać.")
                        .font(NostalgieFont.metadata)
                        .foregroundStyle(.white.opacity(0.62))
                        .padding(.bottom, 8)

                    if isBusy {
                        HStack(spacing: 12) {
                            ProgressView()
                            Text("Przełączam jakość…")
                                .font(NostalgieFont.body)
                        }
                        .padding(.vertical, 8)
                    }

                    ForEach(options) { option in
                        Button {
                            guard option.id != selectedID, !isBusy else { return }
                            onSelect(option)
                        } label: {
                            MediaQualityOptionRow(option: option, isSelected: option.id == selectedID)
                        }
                        .buttonStyle(.plain)
                        .disabled(isBusy)
                    }
                }
                .padding(32)
            }
            .navigationTitle("Jakość obrazu")
        }
    }
}

struct MediaDownloadOptionsSheet: View {
    let title: String
    let info: VideoInfoResponse
    var itemCount: Int = 1
    var totalDuration: Double?
    var itemsSubtitle: String?
    let onStart: (MediaDownloadFormat, MediaQualityOption) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedFormat: MediaDownloadFormat
    @State private var selectedQualityID: String

    init(
        title: String,
        info: VideoInfoResponse,
        itemCount: Int = 1,
        totalDuration: Double? = nil,
        itemsSubtitle: String? = nil,
        onStart: @escaping (MediaDownloadFormat, MediaQualityOption) -> Void
    ) {
        self.title = title
        self.info = info
        self.itemCount = max(itemCount, 1)
        self.totalDuration = totalDuration
        self.itemsSubtitle = itemsSubtitle
        self.onStart = onStart
        let defaults = info.defaultDownloadSelection()
        _selectedFormat = State(initialValue: defaults.format)
        _selectedQualityID = State(initialValue: defaults.quality.id)
    }

    private var qualityOptions: [MediaQualityOption] {
        let options = info.qualityOptions(for: selectedFormat)
        return options.isEmpty ? MediaQualityOption.defaultStreamTiers(duration: info.duration) : options
    }

    private var effectiveTotalDuration: Double {
        if let totalDuration, totalDuration > 0 { return totalDuration }
        if let duration = info.duration, duration > 0 { return duration * Double(itemCount) }
        return 45 * 60 * Double(itemCount)
    }

    private var selectedQuality: MediaQualityOption? {
        qualityOptions.first(where: { $0.id == selectedQualityID }) ?? qualityOptions.first
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(title)
                            .font(NostalgieFont.sectionTitle)
                            .lineLimit(2)
                        if let itemsSubtitle, !itemsSubtitle.isEmpty {
                            Text(itemsSubtitle)
                                .font(NostalgieFont.metadata)
                                .foregroundStyle(.secondary)
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        ScreenTitle(title: "Format", subtitle: "Kontener pliku", level: .section)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(info.availableDownloadFormats) { format in
                                    Button {
                                        selectedFormat = format
                                        let opts = info.qualityOptions(for: format)
                                        if let first = opts.first(where: { $0.id == selectedQualityID }) ?? opts.first {
                                            selectedQualityID = first.id
                                        }
                                    } label: {
                                        Text(format.label)
                                            .font(NostalgieFont.rowTitle)
                                            .padding(.horizontal, 18)
                                            .padding(.vertical, 12)
                                            .background(
                                                selectedFormat.id == format.id
                                                    ? NostalgieTheme.accent.opacity(0.28)
                                                    : Color.white.opacity(0.08)
                                            )
                                            .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        ScreenTitle(
                            title: selectedFormat.kind == "audio" ? "Jakość audio" : "Rozdzielczość",
                            subtitle: itemCount > 1 ? "Szacunek na jeden odcinek" : "Szacowany rozmiar na dysku",
                            level: .section
                        )
                        ForEach(qualityOptions) { option in
                            Button {
                                selectedQualityID = option.id
                            } label: {
                                MediaQualityOptionRow(option: option, isSelected: option.id == selectedQualityID)
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    if let quality = selectedQuality {
                        totalSizeSummary(for: quality)
                    }

                    Button {
                        guard let quality = selectedQuality else { return }
                        onStart(selectedFormat, quality)
                        dismiss()
                    } label: {
                        Label(startButtonTitle, systemImage: "arrow.down.circle.fill")
                            .font(NostalgieFont.rounded(.title3, weight: .semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(DetailPlayButtonStyle())
                }
                .padding(36)
            }
            .navigationTitle("Pobieranie")
        }
    }

    private var startButtonTitle: String {
        if itemCount > 1 {
            return "Pobierz \(itemCount) pozycji"
        }
        return "Rozpocznij pobieranie"
    }

    @ViewBuilder
    private func totalSizeSummary(for quality: MediaQualityOption) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ScreenTitle(title: "Podsumowanie", subtitle: "Szacowany zajęty dysk", level: .section)
            HStack(spacing: 14) {
                Image(systemName: "internaldrive.fill")
                    .font(.title2)
                    .foregroundStyle(NostalgieTheme.accentSecondary)
                VStack(alignment: .leading, spacing: 4) {
                    Text(quality.totalEstimateLabel(itemCount: itemCount, totalDuration: effectiveTotalDuration))
                        .font(NostalgieFont.sectionTitle)
                    Text(summaryDetail)
                        .font(NostalgieFont.metadata)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
            .glassPanel(.panel)
        }
    }

    private var summaryDetail: String {
        if itemCount > 1 {
            return "\(itemCount) × \(selectedQuality?.label ?? "jakość") · \(selectedFormat.label)"
        }
        return "\(selectedQuality?.label ?? "jakość") · \(selectedFormat.label)"
    }
}

struct MovieDownloadBatchBanner: View {
    @EnvironmentObject private var app: AppModel
    var contextKey: String? = nil
    var showsDismissWhenFinished: Bool = true

    private var service: MovieDownloadService { app.movieDownloadService }

    private var isRelevant: Bool {
        guard service.hasActiveBatch else { return false }
        if let contextKey {
            return service.batchMatches(contextKey: contextKey) || service.isRunning
        }
        return true
    }

    var body: some View {
        if isRelevant, let batch = service.activeBatch {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    if service.isRunning {
                        Label("Pobieranie: \(batch.label)", systemImage: "arrow.down.circle.fill")
                            .font(NostalgieFont.rowTitle)
                            .lineLimit(1)
                    } else if batch.isCancelled {
                        Label("Pobieranie zatrzymane", systemImage: "pause.circle.fill")
                            .font(NostalgieFont.rowTitle)
                            .foregroundStyle(.orange)
                    } else if service.failedCount > 0 {
                        Label("Pobieranie nie powiodło się", systemImage: "exclamationmark.circle.fill")
                            .font(NostalgieFont.rowTitle)
                            .foregroundStyle(.red)
                    } else {
                        Label("Pobieranie zakończone", systemImage: "checkmark.circle.fill")
                            .font(NostalgieFont.rowTitle)
                            .foregroundStyle(.green)
                    }
                    Spacer()
                    Text("\(Int(service.overallProgress * 100))%")
                        .font(NostalgieFont.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }

                HStack {
                    Text("\(service.completedCount)/\(service.totalCount) · zapis do Biblioteki (MOVIES)")
                        .font(NostalgieFont.caption)
                        .foregroundStyle(.secondary)
                    if service.pendingCount > 0 {
                        Text("· kolejka \(service.pendingCount)")
                            .font(NostalgieFont.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let active = service.activeItemTitle, service.isRunning {
                        Text(active)
                            .font(NostalgieFont.caption)
                            .lineLimit(1)
                            .foregroundStyle(.green)
                    }
                }

                ProgressView(value: service.overallProgress, total: 1)
                    .progressViewStyle(.linear)
                    .tint(service.isRunning ? .green : .secondary)

                if let status = service.statusMessage, !service.isRunning {
                    Text(status)
                        .font(NostalgieFont.caption)
                        .foregroundStyle(.white.opacity(0.72))
                }

                HStack(spacing: 12) {
                    if service.isRunning {
                        Button {
                            service.cancelBatch()
                        } label: {
                            Label("Zatrzymaj", systemImage: "stop.circle.fill")
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: false))
                    } else if showsDismissWhenFinished {
                        Button {
                            service.clearFinishedBatch()
                        } label: {
                            Label("Ukryj", systemImage: "xmark.circle.fill")
                        }
                        .buttonStyle(ChipButtonStyle(isSelected: false))
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .glassPanel(.panel)
        }
    }
}

enum MediaPlaybackLauncher {
    @MainActor
    static func startPlayback(
        api: MoviesAPIClient,
        url: String,
        title: String,
        info: VideoInfoResponse?,
        qualityID: String? = nil
    ) async throws -> MediaPlaybackContext {
        let options = info?.effectiveStreamOptions ?? MediaQualityOption.defaultStreamTiers(duration: info?.duration)
        let selectedID = qualityID ?? info?.defaultStreamQualityID() ?? "720"
        let option = options.first(where: { $0.id == selectedID }) ?? options.first!
        let height = MediaQualityOption.apiHeight(for: option, options: options)

        let preview = try await api.startPreview(url: url, height: height)
        if preview.instant == false {
            try await api.waitForPreviewReady(jobId: preview.jobId)
        }
        let token = try await api.playToken(jobId: preview.jobId)
        let streamURL = api.streamURL(jobId: token.jobId, token: token.token)
        let session = PlaybackSession(jobId: token.jobId, streamURL: streamURL, token: token.token)
        return MediaPlaybackContext(
            sourceURL: url,
            title: title,
            streamOptions: options,
            session: session,
            selectedQualityID: option.id
        )
    }

    @MainActor
    static func startDownload(
        api: MoviesAPIClient,
        url: String,
        title: String,
        thumbnail: String?,
        source: String?,
        format: MediaDownloadFormat,
        quality: MediaQualityOption,
        allOptions: [MediaQualityOption]
    ) async throws -> DownloadStartResponse {
        if format.kind == "audio" {
            let br = quality.isBest ? 0 : (quality.bitrate ?? 256)
            return try await api.startDownload(
                url: url,
                title: title,
                thumbnail: thumbnail,
                source: source,
                kind: "audio",
                container: format.container,
                audioBitrate: br
            )
        }
        let height = quality.isBest ? 0 : MediaQualityOption.apiHeight(for: quality, options: allOptions)
        return try await api.startDownload(
            url: url,
            height: height,
            title: title,
            thumbnail: thumbnail,
            source: source,
            kind: "video",
            container: format.container
        )
    }
}

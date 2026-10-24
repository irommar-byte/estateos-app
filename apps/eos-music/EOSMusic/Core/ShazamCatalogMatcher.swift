import Foundation

/// Maps a Shazam hit onto an Apple Music catalog row.
/// Title must match — same artist is never enough (KOLEJNA NOC vs Labirynt).
enum ShazamCatalogMatcher {
    static func normalized(_ value: String) -> String {
        value
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .replacingOccurrences(of: "[^\\p{L}\\p{N}]+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    static func bestSong(
        title: String,
        artist: String?,
        appleMusicID: String? = nil,
        isrc: String? = nil,
        webURL: URL? = nil,
        songs: [SearchResultItem]
    ) -> SearchResultItem? {
        guard !songs.isEmpty else { return nil }

        let musicId = appleMusicID?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !musicId.isEmpty {
            if let hit = songs.first(where: { songContainsAppleMusicID($0, musicId) }) {
                return hit
            }
        }

        if let webURL {
            let web = webURL.absoluteString.lowercased()
            if !web.isEmpty, let hit = songs.first(where: {
                let url = $0.url.lowercased()
                return !url.isEmpty && (web.contains(url) || url.contains(web))
            }) {
                return hit
            }
        }

        let isrcValue = isrc?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !isrcValue.isEmpty {
            if let hit = songs.first(where: { songContainsISRC($0, isrcValue) }) {
                return hit
            }
        }

        let targetTitle = normalized(title)
        let targetArtist = normalized(artist ?? "")
        let targetCore = stripped(title)
        var best: (SearchResultItem, Int)?
        for song in songs {
            let score = score(
                song: song,
                targetTitle: targetTitle,
                targetArtist: targetArtist,
                targetCore: targetCore
            )
            if score > (best?.1 ?? 0) {
                best = (song, score)
            }
        }
        guard let best, best.1 >= 50 else { return nil }
        return best.0
    }

    /// Remix / feat. suffixes must not hide the same recording.
    static func stripped(_ value: String) -> String {
        let cut = value.replacingOccurrences(of: #"[\[\(].*?[\]\)]"#, with: " ", options: .regularExpression)
        return normalized(cut)
    }

    static func catalogFallback(
        title: String,
        artist: String?,
        appleMusicID: String?,
        webURL: String?
    ) -> SearchResultItem? {
        let id = appleMusicID?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let web = webURL?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let url: String
        if web.lowercased().contains("music.apple.com") {
            url = web
        } else if !id.isEmpty {
            url = "https://music.apple.com/song/\(id)"
        } else {
            return nil
        }
        return .catalogStub(title: title, url: url, artist: artist)
    }

    static func isSameRecording(
        lhsTitle: String,
        lhsArtist: String?,
        rhsTitle: String,
        rhsArtist: String?
    ) -> Bool {
        let titleL = normalized(lhsTitle)
        let titleR = normalized(rhsTitle)
        guard !titleL.isEmpty, titleL == titleR else { return false }
        let artistL = normalized(lhsArtist ?? "")
        let artistR = normalized(rhsArtist ?? "")
        if artistL.isEmpty || artistR.isEmpty { return true }
        return artistL == artistR || artistL.contains(artistR) || artistR.contains(artistL)
    }

    private static func songContainsAppleMusicID(_ song: SearchResultItem, _ musicId: String) -> Bool {
        let id = musicId.lowercased()
        guard !id.isEmpty else { return false }
        let url = song.url.lowercased()
        let trackURL = url.contains("/song/") || url.contains("i=")
        if trackURL, urlHasTrackIdentifier(url, id: id) { return true }
        if let preview = song.previewUrl?.lowercased(), urlHasTrackIdentifier(preview, id: id) {
            return true
        }
        return false
    }

    private static func urlHasTrackIdentifier(_ value: String, id: String) -> Bool {
        if value.hasSuffix("/\(id)") { return true }
        if value.contains("/\(id)?") || value.contains("/\(id)&") { return true }
        if let range = value.range(of: "i=\(id)") {
            if range.upperBound == value.endIndex { return true }
            let char = value[range.upperBound]
            return char == "&" || char == "#" || char == "?"
        }
        return false
    }

    private static func songContainsISRC(_ song: SearchResultItem, _ isrc: String) -> Bool {
        if song.isrc?.caseInsensitiveCompare(isrc) == .orderedSame { return true }
        return false
    }

    private static func artistsAgree(_ lhs: String, _ rhs: String) -> Bool {
        if lhs.isEmpty || rhs.isEmpty { return false }
        if lhs == rhs { return true }
        return lhs.contains(rhs) || rhs.contains(lhs)
    }

    private static func score(
        song: SearchResultItem,
        targetTitle: String,
        targetArtist: String,
        targetCore: String
    ) -> Int {
        let songTitle = normalized(song.title)
        var titleScore = titleSimilarity(targetTitle, songTitle)
        if titleScore == 0 {
            titleScore = titleSimilarity(targetCore, stripped(song.title))
        }
        if titleScore == 0, almostEqual(targetCore, stripped(song.title)) {
            titleScore = 62
        }
        guard titleScore > 0 else { return 0 }

        let songArtist = normalized(song.uploader ?? song.detail ?? "")
        if !targetArtist.isEmpty, !songArtist.isEmpty, !artistsAgree(targetArtist, songArtist) {
            return 0
        }

        var score = titleScore
        if !targetArtist.isEmpty, !songArtist.isEmpty {
            if songArtist == targetArtist { score += 20 }
            else { score += 8 }
        }
        return score
    }

    static func titleSimilarity(_ lhs: String, _ rhs: String) -> Int {
        if lhs.isEmpty || rhs.isEmpty { return 0 }
        if lhs == rhs { return 100 }

        let left = tokens(lhs)
        let right = tokens(rhs)
        if !left.isEmpty, left == right { return 95 }

        if !left.isEmpty, !right.isEmpty {
            if left.isSubset(of: right) || right.isSubset(of: left) {
                let smaller = min(left.count, right.count)
                if smaller >= 2 { return 80 }
                if min(lhs.count, rhs.count) >= 8 { return 70 }
            }
        }

        if min(lhs.count, rhs.count) >= 8, lhs.contains(rhs) || rhs.contains(lhs) {
            return 55
        }
        if almostEqual(lhs, rhs) { return 62 }
        return 0
    }

    static func almostEqual(_ lhs: String, _ rhs: String) -> Bool {
        if lhs == rhs { return true }
        if lhs.isEmpty || rhs.isEmpty { return false }
        if abs(lhs.count - rhs.count) > 1 { return false }
        guard min(lhs.count, rhs.count) >= 4 else { return false }
        return editDistance(lhs, rhs) <= 1
    }

    private static func editDistance(_ lhs: String, _ rhs: String) -> Int {
        let left = Array(lhs)
        let right = Array(rhs)
        var previous = Array(0...right.count)
        var current = Array(repeating: 0, count: right.count + 1)
        for (i, lc) in left.enumerated() {
            current[0] = i + 1
            for (j, rc) in right.enumerated() {
                let cost = lc == rc ? 0 : 1
                current[j + 1] = min(previous[j + 1] + 1, current[j] + 1, previous[j] + cost)
            }
            swap(&previous, &current)
        }
        return previous[right.count]
    }

    private static func tokens(_ value: String) -> Set<String> {
        Set(value.split(separator: " ").map(String.init).filter { $0.count >= 2 })
    }
}

/// First ShazamKit hit is often a near-miss. Wait for more audio and a second agreeing match.
enum ShazamMatchConfirmPolicy {
    static let ignoreMatchesBefore: TimeInterval = 0.8
    static let minimumListenSeconds: TimeInterval = 5
    static let confidentIdentitySeconds: TimeInterval = 2.2
    static let confirmationWindowSeconds: TimeInterval = 3.5
    static let maxListenSeconds: TimeInterval = 18

    struct Candidate: Equatable {
        var title: String
        var artist: String
        var appleMusicID: String
        var isrc: String

        var hasStableIdentity: Bool {
            !isrc.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || !appleMusicID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }

        var identity: String {
            let isrcKey = isrc.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if !isrcKey.isEmpty { return "isrc:\(isrcKey)" }
            let apple = appleMusicID.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if !apple.isEmpty { return "am:\(apple)" }
            return "meta:\(ShazamCatalogMatcher.normalized(title))|\(ShazamCatalogMatcher.normalized(artist))"
        }

        func agrees(with other: Candidate) -> Bool {
            identity == other.identity
        }
    }

    static func shouldConsiderMatch(elapsed: TimeInterval) -> Bool {
        elapsed >= ignoreMatchesBefore
    }

    static func applyIncoming(
        current: Candidate?,
        incoming: Candidate,
        agreeingCount: Int
    ) -> (candidate: Candidate, agreeingCount: Int) {
        guard let current else { return (incoming, 1) }
        if current.agrees(with: incoming) {
            return (current, agreeingCount + 1)
        }
        return (incoming, 1)
    }

    static func shouldAccept(
        elapsed: TimeInterval,
        agreeingCount: Int,
        hasCandidate: Bool,
        isStableIdentity: Bool = false
    ) -> Bool {
        guard hasCandidate else { return false }
        if elapsed >= maxListenSeconds { return true }
        if isStableIdentity, elapsed >= confidentIdentitySeconds { return true }
        if elapsed < minimumListenSeconds { return false }
        if agreeingCount >= 2 { return true }
        return elapsed >= minimumListenSeconds + confirmationWindowSeconds
    }
}

extension ShazamCatalogMatcher {
    /// YouTube / inne źródło, gdy utworu nie ma w katalogu Apple Music.
    /// Tytuł musi pasować; kanał nie blokuje wyniku (często to nie jest nazwa wykonawcy).
    static func bestExternalRecording(
        title: String,
        artist: String?,
        songs: [SearchResultItem]
    ) -> SearchResultItem? {
        guard !songs.isEmpty else { return nil }
        let targetTitle = normalized(title)
        let targetArtist = normalized(artist ?? "")
        let targetCore = stripped(title)
        let targetAllowsNoise = containsNoiseMarker(targetTitle) || containsNoiseMarker(targetCore)
        var best: (SearchResultItem, Int)?
        for song in songs {
            let songTitle = normalized(song.title)
            var titleScore = titleSimilarity(targetTitle, songTitle)
            if titleScore == 0 {
                titleScore = titleSimilarity(targetCore, stripped(song.title))
            }
            if titleScore == 0, targetCore.count >= 4, songTitle.contains(targetCore) {
                titleScore = 58
            }
            guard titleScore > 0 else { continue }
            var score = titleScore
            let haystack = normalized("\(song.title) \(song.uploader ?? "") \(song.detail ?? "")")
            if !targetArtist.isEmpty {
                let channel = normalized(song.uploader ?? "")
                if haystack.contains(targetArtist) || artistsAgree(targetArtist, channel) {
                    score += 24
                }
            }
            if !targetAllowsNoise, containsNoiseMarker(songTitle) {
                score -= 36
            }
            if score > (best?.1 ?? 0) {
                best = (song, score)
            }
        }
        if let best, best.1 >= 48 { return best.0 }
        return songs.first
    }

    private static func containsNoiseMarker(_ value: String) -> Bool {
        let markers = ["karaoke", "nightcore", "sped up", "slowed", "ringtone", "reaction", "tutorial", "8d", "cover"]
        return markers.contains { value.contains($0) }
    }
}

extension SearchResultItem {
    static func catalogStub(
        title: String,
        url: String,
        artist: String? = nil,
        thumbnail: String? = nil,
        source: String = "apple-music"
    ) -> SearchResultItem {
        SearchResultItem(
            title: title,
            url: url,
            thumbnail: thumbnail,
            detail: artist,
            source: source,
            uploader: artist,
            album: nil,
            duration: 150,
            artistId: nil,
            albumId: nil,
            trackNumber: nil,
            quality: nil,
            rating: nil,
            views: nil,
            isSerial: nil,
            premium: nil,
            previewUrl: nil,
            isrc: nil,
            year: nil
        )
    }
}

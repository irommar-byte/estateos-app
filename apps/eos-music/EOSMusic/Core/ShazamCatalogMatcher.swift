import Foundation

/// Maps a Shazam hit onto an Apple Music catalog row.
/// Title must match — same artist is never enough (KOLEJNA NOC vs Labirynt).
enum ShazamCatalogMatcher {
    static func normalized(_ value: String) -> String {
        value
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .replacingOccurrences(of: "[^a-zA-Z0-9]+", with: " ", options: .regularExpression)
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
        var best: (SearchResultItem, Int)?
        for song in songs {
            let score = score(song: song, targetTitle: targetTitle, targetArtist: targetArtist)
            if score > (best?.1 ?? 0) {
                best = (song, score)
            }
        }
        guard let best, best.1 >= 55 else { return nil }
        return best.0
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

    private static func score(song: SearchResultItem, targetTitle: String, targetArtist: String) -> Int {
        let songTitle = normalized(song.title)
        let titleScore = titleSimilarity(targetTitle, songTitle)
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
        return 0
    }

    private static func tokens(_ value: String) -> Set<String> {
        Set(value.split(separator: " ").map(String.init).filter { $0.count >= 2 })
    }
}

/// First ShazamKit hit is often a near-miss. Wait for more audio and a second agreeing match.
enum ShazamMatchConfirmPolicy {
    static let ignoreMatchesBefore: TimeInterval = 1.6
    static let minimumListenSeconds: TimeInterval = 5
    static let confirmationWindowSeconds: TimeInterval = 3.5
    static let maxListenSeconds: TimeInterval = 18

    struct Candidate: Equatable {
        var title: String
        var artist: String
        var appleMusicID: String
        var isrc: String

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

    static func shouldAccept(elapsed: TimeInterval, agreeingCount: Int, hasCandidate: Bool) -> Bool {
        guard hasCandidate else { return false }
        if elapsed >= maxListenSeconds { return true }
        if elapsed < minimumListenSeconds { return false }
        if agreeingCount >= 2 { return true }
        return elapsed >= minimumListenSeconds + confirmationWindowSeconds
    }
}

extension SearchResultItem {
    static func catalogStub(title: String, url: String, artist: String? = nil) -> SearchResultItem {
        SearchResultItem(
            title: title,
            url: url,
            thumbnail: nil,
            detail: artist,
            source: "apple-music",
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
            isrc: nil
        )
    }
}

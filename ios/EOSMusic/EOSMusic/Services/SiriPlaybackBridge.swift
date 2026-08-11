import Foundation

/// Most między App Intents / Siri a `AppModel` (intent nie ma EnvironmentObject).
@MainActor
final class SiriPlaybackBridge {
    static let shared = SiriPlaybackBridge()

    weak var app: AppModel?

    enum Outcome: Equatable {
        case played(title: String, artist: String?)
        case notFound(hint: String)
        case emptyLibrary
        case unavailable
    }

    func play(title: String?, artist: String?, query: String?) async -> Outcome {
        guard let app else { return .unavailable }

        if app.isBootstrapping {
            await app.bootstrap()
        }
        if app.musicTracks.isEmpty {
            try? await app.refreshMusicLibrary()
        }

        let pool = app.libraryTracksForBrowsing
        guard !pool.isEmpty else { return .emptyLibrary }

        let matches = Self.matchTracks(
            in: pool,
            title: title,
            artist: artist,
            query: query
        )
        guard let first = matches.first else {
            let hint = [title, artist, query]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
                .joined(separator: " · ")
            return .notFound(hint: hint.isEmpty ? "utwór" : hint)
        }

        // Kolejka: dopasowania najpierw, potem reszta biblioteki z tego samego folderu (jeśli jest).
        var queue = matches
        if let folderId = first.folderId {
            let rest = pool.filter { $0.folderId == folderId && !matches.contains(where: { $0.url == $0.url && $0.id == $0.id }) }
            // Unikalne po URL — najpierw trafienia Siri.
            var seen = Set(matches.map(\.url))
            for track in pool where track.folderId == folderId {
                if seen.insert(track.url).inserted {
                    queue.append(track)
                }
            }
            _ = rest
        }

        let folder = app.musicFolders.first(where: { $0.id == first.folderId })
        await app.playTracks(queue, startIndex: 0, folder: folder)
        app.isFullPlayerPresented = true
        return .played(title: first.title, artist: first.artist)
    }

    /// Wyszukiwanie po tytule / wykonawcy / wolnym zapytaniu (np. „Loco Loco Gordo”).
    static func matchTracks(
        in tracks: [MusicTrack],
        title: String?,
        artist: String?,
        query: String?
    ) -> [MusicTrack] {
        let titleQ = normalized(title)
        let artistQ = normalized(artist)
        var freeQ = normalized(query)

        // „tytuł by wykonawca” / „tytuł wykonawcy …”
        if titleQ.isEmpty, artistQ.isEmpty, !freeQ.isEmpty {
            if let split = splitTitleArtist(freeQ) {
                return rank(tracks, title: split.title, artist: split.artist, free: "")
            }
        }

        return rank(tracks, title: titleQ, artist: artistQ, free: freeQ)
    }

    private static func rank(
        _ tracks: [MusicTrack],
        title: String,
        artist: String,
        free: String
    ) -> [MusicTrack] {
        struct Scored { let track: MusicTrack; let score: Int }
        var scored: [Scored] = []

        for track in tracks {
            let t = normalized(track.title)
            let a = normalized(track.artist)
            var score = 0

            if !title.isEmpty {
                if t == title { score += 100 }
                else if t.hasPrefix(title) { score += 70 }
                else if t.contains(title) { score += 45 }
                else { continue }
            }
            if !artist.isEmpty {
                if a == artist { score += 80 }
                else if a.contains(artist) || artist.contains(a) { score += 50 }
                else if !title.isEmpty {
                    // Tytuł OK, artysta nie — niski priorytet, nie odrzucaj całkowicie.
                    score -= 20
                } else {
                    continue
                }
            }
            if !free.isEmpty {
                let hay = "\(t) \(a)"
                if hay == free { score += 90 }
                else if hay.contains(free) { score += 55 }
                else if t.contains(free) || a.contains(free) { score += 40 }
                else {
                    // Wszystkie tokeny z zapytania muszą wystąpić.
                    let tokens = free.split(separator: " ").map(String.init).filter { $0.count > 1 }
                    guard !tokens.isEmpty, tokens.allSatisfy({ hay.contains($0) }) else { continue }
                    score += 30
                }
            }

            if score > 0 {
                scored.append(Scored(track: track, score: score))
            }
        }

        return scored.sorted { $0.score > $1.score }.map(\.track)
    }

    private static func splitTitleArtist(_ free: String) -> (title: String, artist: String)? {
        let separators = [" by ", " – ", " - ", " — ", " wykonawcy ", " artysta "]
        for sep in separators {
            if let range = free.range(of: sep) {
                let title = String(free[..<range.lowerBound]).trimmingCharacters(in: .whitespaces)
                let artist = String(free[range.upperBound...]).trimmingCharacters(in: .whitespaces)
                if !title.isEmpty, !artist.isEmpty {
                    return (title, artist)
                }
            }
        }
        return nil
    }

    private static func normalized(_ value: String?) -> String {
        (value ?? "")
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }
}

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

        let matches = Self.matchTracks(in: pool, title: title, artist: artist, query: query)
        guard let first = matches.first else {
            let hint = [title, artist, query]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
                .joined(separator: " · ")
            return .notFound(hint: hint.isEmpty ? "utwór" : hint)
        }

        var queue = matches
        let folderId = first.folderId
        if !folderId.isEmpty {
            var seen = Set(matches.map(\.url))
            for track in pool where track.folderId == folderId {
                if seen.insert(track.url).inserted {
                    queue.append(track)
                }
            }
        }

        let folder = app.musicFolders.first(where: { $0.id == first.folderId })
        await app.playTracks(queue, startIndex: 0, folder: folder)
        app.isFullPlayerPresented = true
        return .played(title: first.title, artist: first.artist)
    }

    private static func matchTracks(
        in pool: [MusicTrack],
        title: String?,
        artist: String?,
        query: String?
    ) -> [MusicTrack] {
        let titleQ = (title ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let artistQ = (artist ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let freeQ = (query ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        func score(_ track: MusicTrack) -> Int {
            let t = track.title.lowercased()
            let a = (track.artist ?? "").lowercased()
            var s = 0
            if !titleQ.isEmpty {
                if t == titleQ { s += 100 }
                else if t.contains(titleQ) { s += 60 }
            }
            if !artistQ.isEmpty {
                if a == artistQ { s += 40 }
                else if a.contains(artistQ) { s += 20 }
            }
            if !freeQ.isEmpty {
                let hay = "\(t) \(a)"
                if hay.contains(freeQ) { s += 30 }
            }
            return s
        }

        return pool
            .map { ($0, score($0)) }
            .filter { $0.1 > 0 }
            .sorted { $0.1 > $1.1 }
            .map(\.0)
    }
}

import Foundation
import UIKit

struct EmbeddedTrackMetadata {
    let title: String?
    let artist: String?
    let album: String?
    let artwork: UIImage?

    var asSupplemental: NowPlayingCenter.SupplementalMetadata {
        NowPlayingCenter.SupplementalMetadata(
            title: title,
            artist: artist,
            album: album,
            artwork: artwork
        )
    }

    func cachedArtworkURL(for trackID: String) -> String? {
        guard let artwork else { return nil }
        return PlaybackArtworkCache.storeJPEG(artwork, trackID: trackID)
    }
}

enum PlaybackArtworkCache {
    static func storeJPEG(_ image: UIImage, trackID: String) -> String? {
        guard let data = image.jpegData(compressionQuality: 0.9) else { return nil }
        let dir = AppDocuments.root.appendingPathComponent("ArtworkCache", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let name = cacheFileName(for: trackID)
            let file = dir.appendingPathComponent(name)
            try data.write(to: file, options: .atomic)
            return file.absoluteString
        } catch {
            return nil
        }
    }

    private static func cacheFileName(for trackID: String) -> String {
        var hasher = Hasher()
        hasher.combine(trackID)
        return "art-\(abs(hasher.finalize())).jpg"
    }
}

enum TrackMetadataEnricher {
  /// Uzupełnia metadane: biblioteka / kolejka mają pierwszeństwo przed tagami ID3.
  /// ID3 tylko wypełnia braki — inaczej zły plik lokalny podmieniał tytuł w mini-playerze
  /// (kliknięte „La Sovata”, a widać „Get Back” z tagów).
    static func enrich(
        track: MusicPlaybackTrack,
        embedded: EmbeddedTrackMetadata?,
        libraryTrack: MusicTrack?,
        api: MusicAPIClient?
    ) async -> MusicPlaybackTrack {
        var result = track

        if let libraryTrack {
            result = result.applying(
                title: libraryTrack.title,
                artist: libraryTrack.artist,
                album: libraryTrack.album,
                thumbnail: libraryTrack.thumbnail,
                duration: libraryTrack.duration,
                artistId: libraryTrack.artistId,
                albumId: libraryTrack.albumId
            )
        }

        if let embedded {
            // Always prefer real cover art from the file when library has none.
            let embeddedArtURL = embedded.cachedArtworkURL(for: track.id)
            result = result.applying(
                title: isBlank(result.title) ? embedded.title : nil,
                artist: isBlank(result.artist) ? embedded.artist : nil,
                album: isBlank(result.album) ? embedded.album : nil,
                thumbnail: isBlank(result.thumbnail) ? (embeddedArtURL ?? result.thumbnail) : nil
            )
        }

        guard needsCatalogEnrichment(result), let api else { return result }
        return await enrichFromCatalog(result, api: api)
    }

    /// True when ID3 title clearly disagrees with the track we meant to play.
    static func embeddedTitleConflicts(expectedTitle: String, embeddedTitle: String?) -> Bool {
        let expected = normalizedSearchToken(expectedTitle)
        let embedded = normalizedSearchToken(embeddedTitle ?? "")
        guard !expected.isEmpty, !embedded.isEmpty else { return false }
        if expected == embedded { return false }
        if expected.contains(embedded) || embedded.contains(expected) { return false }
        return true
    }

    private static func isBlank(_ value: String?) -> Bool {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty || trimmed == "Utwór"
    }

    static func enrichPayload(_ track: MusicTrackPayload, api: MusicAPIClient) async throws -> MusicTrackPayload {
        guard needsCatalogEnrichment(track) else { return track }
        let search = try await api.searchMusicCatalog(query: catalogQuery(for: track))
        guard let best = bestMatch(for: track, in: search.songs) else { return track }
        return MusicTrackPayload(
            url: track.url,
            title: track.title,
            artist: pick(track.artist, best.uploader ?? best.detail),
            album: pick(track.album, best.album),
            thumbnail: pick(track.thumbnail, best.thumbnail) ?? best.thumbnail,
            duration: track.duration ?? best.duration,
            quality: pick(track.quality, "320 kbps"),
            source: pick(track.source, best.source ?? "apple-music"),
            artistId: pick(track.artistId, best.artistId),
            albumId: pick(track.albumId, best.albumId)
        )
    }

    private static func enrichFromCatalog(_ track: MusicPlaybackTrack, api: MusicAPIClient) async -> MusicPlaybackTrack {
        let payload = track.payload
        guard let enriched = try? await enrichPayload(payload, api: api) else { return track }
        return track.applying(
            artist: enriched.artist,
            album: enriched.album,
            thumbnail: enriched.thumbnail,
            duration: enriched.duration,
            artistId: enriched.artistId,
            albumId: enriched.albumId
        )
    }

    private static func needsCatalogEnrichment(_ track: MusicPlaybackTrack) -> Bool {
        needsCatalogEnrichment(
            thumbnail: track.thumbnail,
            album: track.album,
            artistId: track.artistId,
            albumId: track.albumId
        )
    }

    private static func needsCatalogEnrichment(_ track: MusicTrackPayload) -> Bool {
        if track.source == "opened-file" { return false }
        return needsCatalogEnrichment(
            thumbnail: track.thumbnail,
            album: track.album,
            artistId: track.artistId,
            albumId: track.albumId
        )
    }

    private static func needsCatalogEnrichment(
        thumbnail: String?,
        album: String?,
        artistId: String?,
        albumId: String?
    ) -> Bool {
        (thumbnail?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false)
            || (album?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false)
            || (artistId?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false)
            || (albumId?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false)
    }

    private static func catalogQuery(for track: MusicTrackPayload) -> String {
        [track.artist, track.title]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    private static func bestMatch(for track: MusicTrackPayload, in songs: [SearchResultItem]) -> SearchResultItem? {
        let targetTitle = normalizedSearchToken(track.title)
        let targetArtist = normalizedSearchToken(track.artist ?? "")

        return songs.max { lhs, rhs in
            score(song: lhs, targetTitle: targetTitle, targetArtist: targetArtist)
                < score(song: rhs, targetTitle: targetTitle, targetArtist: targetArtist)
        }
    }

    private static func score(song: SearchResultItem, targetTitle: String, targetArtist: String) -> Int {
        var score = 0
        let songTitle = normalizedSearchToken(song.title)
        let songArtist = normalizedSearchToken(song.uploader ?? song.detail ?? "")

        if !targetTitle.isEmpty {
            if songTitle == targetTitle { score += 100 }
            else if songTitle.contains(targetTitle) || targetTitle.contains(songTitle) { score += 55 }
        }
        if !targetArtist.isEmpty {
            if songArtist == targetArtist { score += 60 }
            else if songArtist.contains(targetArtist) || targetArtist.contains(songArtist) { score += 30 }
        }
        if song.albumId != nil { score += 8 }
        if song.thumbnail?.isEmpty == false { score += 6 }
        if song.duration ?? 0 > 0 { score += 4 }
        return score
    }

    private static func normalizedSearchToken(_ value: String) -> String {
        value
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .replacingOccurrences(of: "[^a-zA-Z0-9]+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    private static func pick(_ current: String?, _ fallback: String?) -> String? {
        let trimmed = current?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmed, !trimmed.isEmpty { return trimmed }
        let fb = fallback?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let fb, !fb.isEmpty { return fb }
        return nil
    }
}

extension MusicPlaybackTrack {
    func applying(
        title: String? = nil,
        artist: String? = nil,
        album: String? = nil,
        thumbnail: String? = nil,
        duration: Double? = nil,
        artistId: String? = nil,
        albumId: String? = nil,
        downloadJobId: String? = nil,
        serverAssetId: String? = nil
    ) -> MusicPlaybackTrack {
        MusicPlaybackTrack(
            id: id,
            url: url,
            title: pick(title) ?? self.title,
            artist: pick(artist) ?? self.artist,
            album: pick(album) ?? self.album,
            thumbnail: pick(thumbnail) ?? self.thumbnail,
            duration: duration ?? self.duration,
            artistId: pick(artistId) ?? self.artistId,
            albumId: pick(albumId) ?? self.albumId,
            folderId: folderId,
            downloadJobId: pick(downloadJobId) ?? self.downloadJobId,
            serverAssetId: pick(serverAssetId) ?? self.serverAssetId,
            playbackFileURL: playbackFileURL,
            externalRelativePath: externalRelativePath,
            webDAVPath: webDAVPath,
            googleDriveFileId: googleDriveFileId,
            externalSourceId: externalSourceId
        )
    }

    private func pick(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let trimmed, !trimmed.isEmpty else { return nil }
        return trimmed
    }

    private init(
        id: String,
        url: String,
        title: String,
        artist: String?,
        album: String?,
        thumbnail: String?,
        duration: Double?,
        artistId: String?,
        albumId: String?,
        folderId: String?,
        downloadJobId: String?,
        serverAssetId: String?,
        playbackFileURL: URL?,
        externalRelativePath: String?,
        webDAVPath: String?,
        googleDriveFileId: String?,
        externalSourceId: UUID?
    ) {
        self.id = id
        self.url = url
        self.title = title
        self.artist = artist
        self.album = album
        self.thumbnail = thumbnail
        self.duration = duration
        self.artistId = artistId
        self.albumId = albumId
        self.folderId = folderId
        self.downloadJobId = downloadJobId
        self.serverAssetId = serverAssetId
        self.playbackFileURL = playbackFileURL
        self.externalRelativePath = externalRelativePath
        self.webDAVPath = webDAVPath
        self.googleDriveFileId = googleDriveFileId
        self.externalSourceId = externalSourceId
    }
}

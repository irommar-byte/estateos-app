import XCTest
@testable import GalleryOS

final class GalleryCatalogTests: XCTestCase {
    func testSameHashIsOnePhoto() {
        let first = line(seq: 1, at: date(0), hash: "abc", favorite: false)
        var second = line(seq: 2, at: date(10), hash: "abc", favorite: true)
        second.device = "other"
        let merged = LibraryRules.merge([second, first])
        XCTAssertEqual(merged.count, 1)
        XCTAssertEqual(merged["abc"]?.favorite, true)
    }

    func testNewerFavoriteWins() {
        let older = line(seq: 1, at: date(0), hash: "abc", favorite: true)
        let newer = line(seq: 2, at: date(5), hash: "abc", favorite: false)
        XCTAssertEqual(LibraryRules.merge([newer, older])["abc"]?.favorite, false)
    }

    func testTrashLastsThirtyDays() {
        let now = date(40 * 24 * 60 * 60)
        var recent = asset(hash: "new")
        recent.deletedAt = date(20 * 24 * 60 * 60)
        var expired = asset(hash: "old")
        expired.deletedAt = date(0)
        var kept = asset(hash: "kept")
        XCTAssertTrue(LibraryRules.isInTrash(recent, now: now))
        XCTAssertFalse(LibraryRules.isInTrash(expired, now: now))
        XCTAssertTrue(LibraryRules.isVisible(kept))
        XCTAssertFalse(LibraryRules.isVisible(recent))
    }

    func testOldJournalWithoutHiddenFlagStaysVisible() {
        let raw = #"{"seq":1,"device":"phone","at":"2026-10-20T12:00:00Z","asset":{"hash":"abc","created":"2026-10-20T12:00:00Z","pixelWidth":10,"pixelHeight":10,"traits":0,"favorite":false,"duration":0,"albumNames":[],"resources":[],"updatedAt":"2026-10-20T12:00:00Z"}}"#
        let decoded = JournalCodec.decode(Data(raw.utf8))
        XCTAssertEqual(decoded.count, 1)
        XCTAssertFalse(decoded[0].asset.hidden)
        XCTAssertTrue(LibraryRules.isVisible(decoded[0].asset))
        var hidden = decoded[0].asset
        hidden.hidden = true
        XCTAssertFalse(LibraryRules.isVisible(hidden))
    }

    func testJournalRoundTripAndPaths() {
        let encoded = JournalCodec.encode([line(seq: 3, at: date(0), hash: "abcdef", favorite: false)])
        let decoded = JournalCodec.decode(encoded)
        XCTAssertEqual(decoded.count, 1)
        XCTAssertEqual(decoded[0].asset.hash, "abcdef")
        XCTAssertFalse(decoded[0].asset.hidden)
        XCTAssertEqual(CatalogPaths.original(hash: "abcdef", ext: "heic"), "GalleryOS/originals/ab/abcdef.heic")
        XCTAssertEqual(CatalogPaths.thumb(hash: "abcdef"), "GalleryOS/thumbs/ab/abcdef.jpg")
    }

    func testSameFilmIgnoresASecondUpload() {
        let phone = PhotoRef(
            id: "local",
            created: date(0),
            pixelWidth: 1920,
            pixelHeight: 1080,
            traits: .video,
            isFavorite: false,
            latitude: nil,
            longitude: nil,
            duration: 12.4
        )
        var server = asset(hash: "first-export")
        server.created = date(1)
        server.pixelWidth = 1080
        server.pixelHeight = 1920
        server.traits = PhotoTraits.video.rawValue
        server.duration = 12.6
        var again = server
        again.hash = "second-export"
        again.pixelWidth = 1920
        again.pixelHeight = 1080
        XCTAssertTrue(LibraryRules.sameFilm(phone, server))
        XCTAssertTrue(LibraryRules.sameFilm(server, again))
        var still = server
        still.traits = 0
        still.duration = 0
        XCTAssertFalse(LibraryRules.sameFilm(phone, still))
        var otherTake = server
        otherTake.created = date(30)
        XCTAssertFalse(LibraryRules.sameFilm(phone, otherTake))
        let twin = PhotoRef(
            id: "local-again",
            created: date(1),
            pixelWidth: phone.pixelWidth,
            pixelHeight: phone.pixelHeight,
            traits: phone.traits,
            isFavorite: false,
            latitude: nil,
            longitude: nil,
            duration: phone.duration
        )
        XCTAssertTrue(LibraryRules.sameFilm(phone, twin))
        XCTAssertEqual(LibraryRules.keepingOneFilm([phone, twin]).map(\.id), ["local"])
    }

    func testLivePhotoKeepsBothResources() {
        var item = asset(hash: "live")
        item.resources = [
            LibraryResource(role: "primary", hash: "still", ext: "heic", bytes: 10),
            LibraryResource(role: "paired", hash: "motion", ext: "mov", bytes: 20),
        ]
        var entry = line(seq: 1, at: date(0), hash: "live", favorite: false)
        entry.asset = item
        let merged = LibraryRules.merge([entry])
        XCTAssertEqual(merged["live"]?.paired?.hash, "motion")
        XCTAssertEqual(merged["live"]?.primary?.ext, "heic")
    }

    private func date(_ offset: TimeInterval) -> Date {
        Date(timeIntervalSince1970: 1_791_936_000 + offset)
    }

    private func asset(hash: String) -> LibraryAsset {
        LibraryAsset(
            hash: hash,
            created: date(0),
            pixelWidth: 10,
            pixelHeight: 20,
            traits: PhotoTraits.live.rawValue,
            favorite: false,
            latitude: nil,
            longitude: nil,
            duration: 0,
            deletedAt: nil,
            albumNames: ["Wakacje"],
            resources: [],
            updatedAt: date(0)
        )
    }

    private func line(seq: Int, at: Date, hash: String, favorite: Bool) -> JournalLine {
        var item = asset(hash: hash)
        item.favorite = favorite
        return JournalLine(seq: seq, device: "phone", at: at, asset: item)
    }
}

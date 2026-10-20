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

    func testJournalRoundTripAndPaths() {
        let encoded = JournalCodec.encode([line(seq: 3, at: date(0), hash: "abcdef", favorite: false)])
        let decoded = JournalCodec.decode(encoded)
        XCTAssertEqual(decoded.count, 1)
        XCTAssertEqual(decoded[0].asset.hash, "abcdef")
        XCTAssertEqual(CatalogPaths.original(hash: "abcdef", ext: "heic"), "GalleryOS/originals/ab/abcdef.heic")
        XCTAssertEqual(CatalogPaths.thumb(hash: "abcdef"), "GalleryOS/thumbs/ab/abcdef.jpg")
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

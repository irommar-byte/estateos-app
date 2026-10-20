import Photos
import XCTest
@testable import GalleryOS

final class GalleryPolishTests: XCTestCase {
    func testAlbumEligibilityBlocksSharedAndStreamSubtypes() {
        XCTAssertFalse(AlbumEligibility.allowsSmart(.albumCloudShared))
        XCTAssertFalse(AlbumEligibility.allowsSmart(.albumMyPhotoStream))
        XCTAssertFalse(AlbumEligibility.allowsSmart(.smartAlbumAllHidden))
        XCTAssertFalse(AlbumEligibility.allowsSmart(.smartAlbumUnableToUpload))
        XCTAssertFalse(AlbumEligibility.allowsSmart(.smartAlbumUserLibrary))
        XCTAssertFalse(AlbumEligibility.allowsTitle("Ostatnio usunięte"))
        XCTAssertFalse(AlbumEligibility.allowsTitle("Nie można wysłać"))
        XCTAssertTrue(AlbumEligibility.allowsSmart(.smartAlbumFavorites))
        XCTAssertTrue(AlbumEligibility.allowsSmart(.smartAlbumSelfPortraits))
        XCTAssertTrue(AlbumEligibility.allowsTitle("Wakacje"))
    }

    func testStableCloudPhotoIdentity() {
        let asset = LibraryAsset(
            hash: "deadbeef01",
            created: Date(timeIntervalSince1970: 1_700_000_000),
            pixelWidth: 100,
            pixelHeight: 80,
            traits: 0,
            favorite: true,
            latitude: nil,
            longitude: nil,
            duration: 0,
            deletedAt: nil,
            albumNames: [],
            resources: [LibraryResource(role: "primary", hash: "deadbeef01", ext: "heic", bytes: 12)],
            updatedAt: Date(timeIntervalSince1970: 1_700_000_000)
        )
        let photo = asset.photoRef()
        XCTAssertEqual(photo.id, "cloud:deadbeef01")
        XCTAssertEqual(photo.cloudHash, "deadbeef01")
        XCTAssertEqual(photo.isFavorite, true)
    }

    func testLibraryRulesVisibleIgnoresTrashed() {
        var kept = LibraryAsset(
            hash: "kept",
            created: .now,
            pixelWidth: 1,
            pixelHeight: 1,
            traits: 0,
            favorite: false,
            latitude: nil,
            longitude: nil,
            duration: 0,
            deletedAt: nil,
            albumNames: [],
            resources: [],
            updatedAt: .now
        )
        var trashed = kept
        trashed.hash = "gone"
        trashed.deletedAt = .now
        XCTAssertTrue(LibraryRules.isVisible(kept))
        XCTAssertFalse(LibraryRules.isVisible(trashed))
    }

    func testThumbPathCacheContract() {
        let hash = "aa11bb22cc"
        XCTAssertEqual(CatalogPaths.thumb(hash: hash), "GalleryOS/thumbs/aa/aa11bb22cc.jpg")
        // Cache-first contract: same hash always addresses the same thumb blob.
        XCTAssertEqual(CatalogPaths.thumb(hash: hash), CatalogPaths.thumb(hash: hash))
    }
}

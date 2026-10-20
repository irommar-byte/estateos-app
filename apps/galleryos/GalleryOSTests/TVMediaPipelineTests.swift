import XCTest
@testable import GalleryOS

final class TVMediaPipelineTests: XCTestCase {
    func testWebDAVPrefersDownloadFirst() {
        let webdav = WebDAVTransport(
            baseURL: URL(string: "https://example.local:5001/Multimedia/")!,
            username: "u",
            password: "p"
        )
        XCTAssertTrue(TVMediaPolicy.prefersDownloadFirst(transport: webdav))
    }

    func testServerStreamingAllowed() {
        let server = ServerTransport(baseURL: URL(string: "http://192.168.1.10:8787")!, token: "t")
        XCTAssertFalse(TVMediaPolicy.prefersDownloadFirst(transport: server))
    }

    func testNilTransportDoesNotForceDownload() {
        XCTAssertFalse(TVMediaPolicy.prefersDownloadFirst(transport: nil))
    }

    func testThumbAndOriginalPathsStayAlignedWithAssetHash() {
        let hash = "ab12cd34ef"
        XCTAssertEqual(CatalogPaths.thumb(hash: hash), "GalleryOS/thumbs/ab/ab12cd34ef.jpg")
        XCTAssertEqual(CatalogPaths.original(hash: hash, ext: "heic"), "GalleryOS/originals/ab/ab12cd34ef.heic")
        XCTAssertEqual(CatalogPaths.original(hash: hash, ext: "mov"), "GalleryOS/originals/ab/ab12cd34ef.mov")
    }

    func testPhotoRefCloudHashMatchesAssetHashForTVTiles() {
        let asset = LibraryAsset(
            hash: "aa01bb02",
            created: Date(timeIntervalSince1970: 1_700_000_000),
            pixelWidth: 100,
            pixelHeight: 100,
            traits: PhotoTraits.video.rawValue,
            favorite: false,
            latitude: nil,
            longitude: nil,
            duration: 24,
            deletedAt: nil,
            albumNames: [],
            resources: [LibraryResource(role: "primary", hash: "aa01bb02", ext: "mov", bytes: 1_000)],
            updatedAt: Date(timeIntervalSince1970: 1_700_000_000)
        )
        let photo = asset.photoRef()
        XCTAssertEqual(photo.cloudHash, asset.hash)
        XCTAssertEqual(photo.id, "cloud:aa01bb02")
        XCTAssertTrue(photo.traits.isVideo)
        XCTAssertEqual(photo.duration, 24, accuracy: 0.01)
    }

    func testWebDAVStreamTargetUsesHeaderAuthOnly() throws {
        let webdav = WebDAVTransport(
            baseURL: URL(string: "https://nas.local:5001/Multimedia/")!,
            username: "user",
            password: "p@ss:word/weird"
        )
        let target = try XCTUnwrap(webdav.streamTarget("GalleryOS/thumbs/ab/ab12.jpg"))
        XCTAssertNil(target.url.user)
        XCTAssertNil(target.url.password)
        XCTAssertEqual(target.headers["Authorization"]?.hasPrefix("Basic "), true)
        XCTAssertTrue(target.url.absoluteString.contains("GalleryOS/thumbs/ab/ab12.jpg"))
    }

    func testJPEGMagicAcceptedAsImageData() {
        // Minimal JPEG SOI + a few bytes — enough for the magic check used before decode.
        var data = Data([0xFF, 0xD8, 0xFF, 0xE0])
        data.append(contentsOf: [UInt8](repeating: 0, count: 20))
        XCTAssertTrue(Self.looksLikeImage(data))
        XCTAssertFalse(Self.looksLikeImage(Data("<html>error</html>".utf8)))
    }

    /// Mirrors TVImagePipeline.isImageData so GalleryOSTests can guard the contract without linking the TV target.
    private static func looksLikeImage(_ data: Data) -> Bool {
        guard data.count >= 12 else { return false }
        let b = [UInt8](data.prefix(12))
        if b[0] == 0xFF, b[1] == 0xD8 { return true }
        if b[0] == 0x89, b[1] == 0x50, b[2] == 0x4E, b[3] == 0x47 { return true }
        if b[0] == 0x47, b[1] == 0x49, b[2] == 0x46 { return true }
        if b[0] == 0x52, b[1] == 0x49, b[2] == 0x46, b[3] == 0x46 { return true }
        if b.count >= 12, b[4] == 0x66, b[5] == 0x74, b[6] == 0x79, b[7] == 0x70 { return true }
        return false
    }
}

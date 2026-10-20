import XCTest
@testable import GalleryOS

final class TVCatalogTests: XCTestCase {
    private let calendar = Calendar.current

    private func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
    }

    private func asset(
        _ hash: String,
        _ created: Date,
        traits: PhotoTraits = [],
        favorite: Bool = false,
        albums: [String] = [],
        deleted: Date? = nil
    ) -> LibraryAsset {
        LibraryAsset(
            hash: hash,
            created: created,
            pixelWidth: 4000,
            pixelHeight: 3000,
            traits: traits.rawValue,
            favorite: favorite,
            latitude: nil,
            longitude: nil,
            duration: traits.isVideo ? 12 : 0,
            deletedAt: deleted,
            albumNames: albums,
            resources: [LibraryResource(role: "primary", hash: hash, ext: traits.isVideo ? "mov" : "jpg", bytes: 10)],
            updatedAt: created
        )
    }

    private func line(_ asset: LibraryAsset, at: Date, device: String = "phone", seq: Int = 1) -> JournalLine {
        JournalLine(seq: seq, device: device, at: at, asset: asset)
    }

    func testBuildSkipsTrashAndGroupsAlbumsAndFavorites() {
        let list = [
            asset("aa01", date(2026, 10, 1), favorite: true, albums: ["Wakacje"]),
            asset("bb02", date(2026, 10, 2), albums: ["Wakacje", "Rodzina"]),
            asset("cc03", date(2025, 3, 5), traits: .video),
            asset("dd04", date(2026, 10, 3), deleted: date(2026, 10, 4)),
        ]
        let snapshot = TVCatalog.build(from: list)
        XCTAssertEqual(snapshot.model.all.count, 3)
        XCTAssertNil(snapshot.assets["dd04"])
        XCTAssertEqual(snapshot.favorites.map(\.cloudHash), ["aa01"])
        XCTAssertEqual(snapshot.albums.map(\.name), ["Rodzina", "Wakacje"])
        XCTAssertEqual(snapshot.albums.first { $0.name == "Wakacje" }?.photos.first?.cloudHash, "bb02")
        XCTAssertEqual(snapshot.videos, 1)
        XCTAssertEqual(snapshot.model.years.map(\.year), [2025, 2026])
    }

    func testMergeKeepsNewestLinePerAsset() {
        var store: [String: JournalLine] = [:]
        let old = asset("aa01", date(2026, 1, 1), favorite: false)
        let new = asset("aa01", date(2026, 1, 1), favorite: true)
        XCTAssertTrue(TVCatalog.merge([line(old, at: date(2026, 2, 1))], into: &store))
        XCTAssertTrue(TVCatalog.merge([line(new, at: date(2026, 2, 2))], into: &store))
        XCTAssertFalse(TVCatalog.merge([line(old, at: date(2026, 2, 1))], into: &store))
        XCTAssertEqual(store["aa01"]?.asset.favorite, true)
        XCTAssertEqual(store.count, 1)
    }

    func testSearchMatchesMonthYearTypeAndAlbumWithoutDiacritics() {
        let list = [
            asset("aa01", date(2026, 10, 1), albums: ["Święta u Babci"]),
            asset("bb02", date(2025, 3, 5), traits: .video),
            asset("cc03", date(2025, 3, 6), favorite: true),
        ]
        let snapshot = TVCatalog.build(from: list)
        func hits(_ text: String) -> [String] {
            TVCatalog.search(text, photos: snapshot.model.all, blobs: snapshot.blobs, extra: [:]).compactMap(\.cloudHash)
        }
        XCTAssertEqual(hits("październik"), ["aa01"])
        XCTAssertEqual(hits("pazdziernika 2026"), ["aa01"])
        XCTAssertEqual(hits("wideo"), ["bb02"])
        XCTAssertEqual(hits("ulubione marzec"), ["cc03"])
        XCTAssertEqual(hits("swieta babci"), ["aa01"])
        XCTAssertEqual(hits("2025"), ["cc03", "bb02"])
        XCTAssertTrue(hits("kosmos").isEmpty)
        XCTAssertTrue(hits("   ").isEmpty)
    }

    func testAlbumsNewestFirstAndMediaTypesSkipEmptyKinds() {
        let list = [
            asset("aa01", date(2024, 1, 1), albums: ["Stary"]),
            asset("bb02", date(2026, 9, 1), traits: .video, albums: ["Nowy"]),
            asset("cc03", date(2026, 8, 1), traits: .live, albums: ["Nowy"]),
        ]
        let snapshot = TVCatalog.build(from: list)
        XCTAssertEqual(snapshot.albums.map(\.name), ["Nowy", "Stary"])
        XCTAssertEqual(snapshot.albums.first?.cover.cloudHash, "cc03", "a cover is never a video frame when a still exists")
        XCTAssertEqual(snapshot.mediaTypes.map(\.name), ["Filmy", "Live Photos"])
    }

    func testPlacesGroupByNamedTownBiggestFirst() {
        func located(_ hash: String, _ latitude: Double, _ longitude: Double) -> PhotoRef {
            PhotoRef(id: "cloud:\(hash)", created: date(2026, 5, 1), pixelWidth: 1, pixelHeight: 1, traits: [],
                     isFavorite: false, latitude: latitude, longitude: longitude, duration: 0, cloudHash: hash)
        }
        let photos = [
            located("a", 50.06, 19.94), located("b", 50.07, 19.93), located("c", 52.23, 21.01),
            PhotoRef(id: "cloud:d", created: date(2026, 5, 1), pixelWidth: 1, pixelHeight: 1, traits: [],
                     isFavorite: false, latitude: nil, longitude: nil, duration: 0, cloudHash: "d")
        ]
        let places = TVCatalog.places(from: photos, names: [TVCatalog.cellKey(50.06, 19.94): "Kraków"])
        XCTAssertEqual(places.map(\.name), ["Kraków", nil])
        XCTAssertEqual(places.first?.photos.count, 2)
    }

    func testSearchUsesPlaceNames() {
        let snapshot = TVCatalog.build(from: [asset("aa01", date(2026, 7, 1))])
        let found = TVCatalog.search("Kraków", photos: snapshot.model.all, blobs: snapshot.blobs, extra: ["aa01": TVSearch.fold("Kraków, Polska")])
        XCTAssertEqual(found.compactMap(\.cloudHash), ["aa01"])
    }
}

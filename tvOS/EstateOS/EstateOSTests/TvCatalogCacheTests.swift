import XCTest
@testable import EstateOS

final class TvCatalogCacheTests: XCTestCase {
    func testRoundtripOffers() throws {
        let sample = [EstateOffer(id: 1, title: "Test", price: 100, city: "Warszawa")]
        TvCatalogCache.saveOffers(sample)
        let loaded = TvCatalogCache.loadOffers()
        XCTAssertEqual(loaded?.first?.id, 1)
    }
}

import XCTest
@testable import EstateOS

final class TvDeepLinkTests: XCTestCase {
    func testOfferDeepLink() {
        let url = URL(string: "estateos://offer/42")!
        XCTAssertEqual(TvDeepLink.offerId(from: url), 42)
    }

    func testCarDeepLink() {
        let url = URL(string: "estateos://car?id=99")!
        XCTAssertEqual(TvDeepLink.carId(from: url), 99)
    }

    func testImmersiveFlag() {
        let url = URL(string: "estateos://browse24h?id=1&immersive=1")!
        XCTAssertTrue(TvDeepLink.opensImmersive(from: url))
    }
}

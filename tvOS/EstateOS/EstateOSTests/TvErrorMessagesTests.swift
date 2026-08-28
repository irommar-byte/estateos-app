import XCTest
@testable import EstateOS

final class TvErrorMessagesTests: XCTestCase {
    func testOfflineError() {
        let err = URLError(.notConnectedToInternet)
        let msg = TvErrorMessages.message(for: err)
        XCTAssertTrue(msg.contains("internet"))
    }

    func testFallback() {
        let msg = TvErrorMessages.message(for: NSError(domain: "test", code: 999))
        XCTAssertFalse(msg.isEmpty)
    }
}

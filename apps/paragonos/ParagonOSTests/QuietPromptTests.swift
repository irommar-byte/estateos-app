import XCTest
@testable import ParagonOS

final class QuietPromptTests: XCTestCase {
    private let calendar = Calendar(identifier: .gregorian)
    private let session = "session-a"
    private let other = "session-b"

    private func base(now: Date) -> QuietPromptState {
        QuietPromptState(
            installAt: now.addingTimeInterval(-5 * 24 * 3600),
            saveCount: 8,
            coffeeLastPromptAt: nil,
            coffeeLastSuccessAt: nil,
            coffeeRefusals: 0,
            coffeeDisabled: false,
            reviewLastPromptAt: nil,
            reviewCompleted: false,
            coffeeSession: nil,
            reviewSession: nil
        )
    }

    func testReviewWinsWhenBothAreDue() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let state = base(now: now)
        XCTAssertEqual(QuietPromptPolicy.next(state, now: now, session: session, calendar: calendar), .review)
    }

    func testCoffeeAfterFifthSave() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var state = base(now: now)
        state.saveCount = 5
        state.installAt = now
        XCTAssertEqual(QuietPromptPolicy.next(state, now: now, session: session, calendar: calendar), .coffee)
        state.saveCount = 4
        XCTAssertNil(QuietPromptPolicy.next(state, now: now, session: session, calendar: calendar))
    }

    func testHighStarsWouldRequestReviewAndLowWouldNot() {
        XCTAssertTrue((4...5).contains(5))
        XCTAssertFalse((4...5).contains(2))
        XCTAssertEqual(ReviewGate.writeReviewURL.scheme, "itms-apps")
    }

    func testCoffeeCooldownAndThreeRefusals() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var state = base(now: now)
        state.saveCount = 6
        state.installAt = now
        state.coffeeLastPromptAt = now.addingTimeInterval(-10 * 24 * 3600)
        XCTAssertNil(QuietPromptPolicy.next(state, now: now, session: session, calendar: calendar))
        state.coffeeLastPromptAt = now.addingTimeInterval(-46 * 24 * 3600)
        XCTAssertEqual(QuietPromptPolicy.next(state, now: now, session: session, calendar: calendar), .coffee)
        state.coffeeRefusals = 3
        XCTAssertNil(QuietPromptPolicy.next(state, now: now, session: session, calendar: calendar))
    }

    func testReviewWaitsFourDaysAndNotSameSessionAsCoffee() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var state = base(now: now)
        state.installAt = now.addingTimeInterval(-2 * 24 * 3600)
        XCTAssertEqual(QuietPromptPolicy.next(state, now: now, session: session, calendar: calendar), .coffee)
        state.installAt = now.addingTimeInterval(-5 * 24 * 3600)
        state.coffeeSession = session
        XCTAssertNil(QuietPromptPolicy.next(state, now: now, session: session, calendar: calendar))
        state.coffeeSession = other
        XCTAssertEqual(QuietPromptPolicy.next(state, now: now, session: session, calendar: calendar), .review)
    }

    func testReviewSkipsCoffeeDay() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var state = base(now: now)
        state.coffeeLastSuccessAt = now
        XCTAssertFalse(QuietPromptPolicy.reviewDue(state, now: now, session: session, calendar: calendar))
        XCTAssertNil(QuietPromptPolicy.next(state, now: now, session: session, calendar: calendar))
    }
}

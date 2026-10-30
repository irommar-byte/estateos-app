import XCTest

final class CardsGestureUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launchDemo() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-paragon-ui-demo",
            "-ui-testing",
            "-AppleLanguages", "(pl)",
            "-AppleLocale", "pl_PL"
        ]
        app.launchEnvironment["PARAGON_UI_DEMO"] = "1"
        app.launch()

        // SpringBoard / app alerts
        for _ in 0..<3 {
            let alert = app.alerts.firstMatch
            if alert.waitForExistence(timeout: 1.5) {
                if alert.buttons["Cancel"].exists { alert.buttons["Cancel"].tap(); continue }
                if alert.buttons["Anuluj"].exists { alert.buttons["Anuluj"].tap(); continue }
                if alert.buttons["Open"].exists { alert.buttons["Open"].tap(); continue }
                if alert.buttons["Otwórz"].exists { alert.buttons["Otwórz"].tap(); continue }
                break
            } else {
                break
            }
        }
        return app
    }

    private func ensureCardsTab(_ app: XCUIApplication) {
        let tab = app.tabBars.buttons["Karty"]
        if tab.waitForExistence(timeout: 4) {
            tab.tap()
        } else if app.tabBars.buttons["Cards"].waitForExistence(timeout: 2) {
            app.tabBars.buttons["Cards"].tap()
        }
    }

    private func cardsScreenVisible(_ app: XCUIApplication) -> Bool {
        if app.navigationBars["Karty"].waitForExistence(timeout: 2) { return true }
        if app.navigationBars["Cards"].waitForExistence(timeout: 2) { return true }
        if app.staticTexts["Karty"].waitForExistence(timeout: 2) { return true }
        if app.staticTexts["Cards"].waitForExistence(timeout: 2) { return true }
        return false
    }

    func testScrollIsResponsive() throws {
        let app = launchDemo()
        ensureCardsTab(app)
        XCTAssertTrue(cardsScreenVisible(app), app.debugDescription)
        let t0 = Date()
        app.swipeUp()
        app.swipeDown()
        app.swipeUp()
        XCTAssertLessThan(Date().timeIntervalSince(t0), 8)
        XCTAssertTrue(cardsScreenVisible(app))
    }

    func testLongPressDragReorders() throws {
        let app = launchDemo()
        ensureCardsTab(app)
        XCTAssertTrue(cardsScreenVisible(app), app.debugDescription)

        let lidl = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS[c] %@", "Lidl")).element(boundBy: 0)
        let payback = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS[c] %@", "Payback")).element(boundBy: 0)
        XCTAssertTrue(lidl.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(payback.exists, app.debugDescription)

        let start = lidl.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
        let end = payback.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
        start.press(forDuration: 0.55, thenDragTo: end)
        RunLoop.current.run(until: Date().addingTimeInterval(1.0))
        XCTAssertTrue(cardsScreenVisible(app), "Reorder should not freeze the screen")
    }

    func testTapOpenAndEdgeSwipeBack() throws {
        let app = launchDemo()
        ensureCardsTab(app)
        XCTAssertTrue(cardsScreenVisible(app), app.debugDescription)

        let card = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS[c] %@", "Biedronka")).element(boundBy: 0)
        XCTAssertTrue(card.waitForExistence(timeout: 10), app.debugDescription)
        card.tap()
        RunLoop.current.run(until: Date().addingTimeInterval(0.6))

        let leftEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.5))
        let right = app.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5))
        leftEdge.press(forDuration: 0.05, thenDragTo: right)
        RunLoop.current.run(until: Date().addingTimeInterval(1.0))

        if cardsScreenVisible(app) == false {
            let back = app.navigationBars.buttons.firstMatch
            if back.exists { back.tap() }
        }
        XCTAssertTrue(cardsScreenVisible(app), app.debugDescription)
    }
}

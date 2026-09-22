import XCTest
@testable import EOSMusic

final class PlayerLuxuryLayoutTests: XCTestCase {
    func testAppleGridMetrics() {
        XCTAssertEqual(PlayerVisualMetrics.grid, 8)
        XCTAssertEqual(PlayerVisualMetrics.contentInset, 20)
        XCTAssertEqual(PlayerVisualMetrics.heroCornerRadius, 13)
        XCTAssertEqual(PlayerVisualMetrics.heartHit, 44)
        XCTAssertEqual(PlayerVisualMetrics.accessoryHit, 44)
    }

    func testLandscapeClearsDynamicIsland() {
        XCTAssertGreaterThanOrEqual(PlayerVisualMetrics.landscapeIslandInset, 48)
        XCTAssertEqual(
            PlayerVisualMetrics.landscapeSideInset(safeLeading: 0, safeTrailing: 0),
            48
        )
        XCTAssertEqual(
            PlayerVisualMetrics.landscapeSideInset(safeLeading: 59, safeTrailing: 12),
            59
        )
        let disc = PlayerVisualMetrics.landscapeDiscSize(canvas: CGSize(width: 852, height: 393))
        let occupied = 48 * 2 + PlayerVisualMetrics.landscapeBankWidth * 2
            + PlayerVisualMetrics.landscapeLampGap * 2 + disc
        XCTAssertLessThanOrEqual(occupied, 852)
    }

    func testLampAndStrobeWindows() {
        XCTAssertEqual(PlayerVisualMetrics.beatWindow, 0.075, accuracy: 0.006)
        XCTAssertEqual(PlayerVisualMetrics.rytmWindow, 0.090, accuracy: 0.006)
        XCTAssertEqual(PlayerVisualMetrics.bassWindow, 0.100, accuracy: 0.01)
        XCTAssertEqual(PlayerVisualMetrics.hiWindow, 0.065, accuracy: 0.01)
        let fast = PlayerVisualMetrics.strobeWindow(speed: 1)
        let slow = PlayerVisualMetrics.strobeWindow(speed: 0)
        XCTAssertGreaterThanOrEqual(fast, 0.035)
        XCTAssertLessThanOrEqual(fast, 0.045)
        XCTAssertGreaterThanOrEqual(slow, fast)
        XCTAssertLessThanOrEqual(slow, 0.045)
    }

    func testHeroUsesLargeCoverSlot() {
        let side = PlayerVisualMetrics.heroSide(
            width: 390,
            availableHeight: 520,
            showsMixer: false,
            isPad: false
        )
        XCTAssertGreaterThan(side, 180)
        XCTAssertLessThanOrEqual(side, 350)
        let eq = PlayerVisualMetrics.heroSide(
            width: 390,
            availableHeight: 520,
            showsMixer: true,
            isPad: false
        )
        XCTAssertLessThan(eq, 120)
    }

    func testPolicyKillsStrobeAndSpinBudget() {
        let lowPower = PlayerVisualPolicy.resolve(
            preset: .vinyl,
            intensity: 1,
            strobeEnabled: true,
            autoPerformance: true,
            reduceMotion: false,
            lowPower: true,
            thermal: .nominal
        )
        XCTAssertFalse(lowPower.allowStrobe)

        let reduce = PlayerVisualPolicy.resolve(
            preset: .vinyl,
            intensity: 1,
            strobeEnabled: true,
            autoPerformance: true,
            reduceMotion: true,
            lowPower: false,
            thermal: .nominal
        )
        XCTAssertFalse(reduce.allowStrobe)
        XCTAssertEqual(reduce.timelineFPS, 0)

        let hot = PlayerVisualPolicy.resolve(
            preset: .strobe,
            intensity: 1,
            strobeEnabled: true,
            autoPerformance: true,
            reduceMotion: false,
            lowPower: false,
            thermal: .critical
        )
        XCTAssertFalse(hot.allowStrobe)
        XCTAssertEqual(hot.analyzerFPS, 0)

        let warm = PlayerVisualPolicy.resolve(
            preset: .cover,
            intensity: 1,
            strobeEnabled: true,
            autoPerformance: true,
            reduceMotion: false,
            lowPower: false,
            thermal: .fair
        )
        XCTAssertTrue(warm.allowStrobe)
        XCTAssertGreaterThanOrEqual(warm.analyzerFPS, 12)
    }

    func testVinylPeriodIsGramophoneSlow() {
        XCTAssertEqual(PlayerVisualMetrics.vinylSecondsPerRevolution, 18, accuracy: 0.01)
        XCTAssertGreaterThanOrEqual(PlayerVisualMetrics.analyzerFPS(preferred: 8), 12)
        XCTAssertLessThanOrEqual(PlayerVisualMetrics.analyzerFPS(preferred: 48), 16)
    }
}

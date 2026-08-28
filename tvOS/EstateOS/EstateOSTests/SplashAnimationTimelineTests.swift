import XCTest
@testable import EstateOS

final class SplashAnimationTimelineTests: XCTestCase {
    func testLine1StartMs() {
        let start = SplashAnimationTimeline.line1StartMs()
        XCTAssertEqual(start, 720, accuracy: 1)
    }

    func testTaglineRotation() {
        let boot = SplashAnimationTimeline.loadTaglineBoot()
        XCTAssertTrue(SplashAnimationTimeline.taglines.contains(boot.text))
        XCTAssertGreaterThanOrEqual(boot.nextSlot, 0)
        XCTAssertLessThan(boot.nextSlot, SplashAnimationTimeline.taglines.count)
    }

    func testAdaptiveParticleCount() {
        XCTAssertEqual(SplashAnimationTimeline.adaptiveParticleCount(screenHeight: 2160), 80)
        XCTAssertEqual(SplashAnimationTimeline.adaptiveParticleCount(screenHeight: 1080), 75)
        XCTAssertEqual(SplashAnimationTimeline.adaptiveParticleCount(screenHeight: 720), 55)
    }
}

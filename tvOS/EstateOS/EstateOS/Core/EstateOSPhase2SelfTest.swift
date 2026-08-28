import Foundation

#if DEBUG
enum EstateOSPhase2SelfTest {
    static func runAll() {
        testSplashTimeline()
        testDeepLinks()
        testErrorMessages()
        print("[EstateOSPhase2SelfTest] All checks passed")
    }

    private static func testSplashTimeline() {
        assert(SplashAnimationTimeline.line1StartMs() > 0)
        assert(SplashAnimationTimeline.adaptiveParticleCount(screenHeight: 1080) == 75)
        let boot = SplashAnimationTimeline.loadTaglineBoot()
        assert(SplashAnimationTimeline.taglines.contains(boot.text))
    }

    private static func testDeepLinks() {
        let offer = URL(string: "estateos://offer/42")!
        assert(TvDeepLink.offerId(from: offer) == 42)
        let car = URL(string: "estateos://car?id=99")!
        assert(TvDeepLink.carId(from: car) == 99)
        let immersive = URL(string: "estateos://browse24h?id=1&immersive=1")!
        assert(TvDeepLink.opensImmersive(from: immersive))
    }

    private static func testErrorMessages() {
        let msg = TvErrorMessages.message(for: URLError(.notConnectedToInternet))
        assert(msg.contains("internet"))
    }
}
#endif

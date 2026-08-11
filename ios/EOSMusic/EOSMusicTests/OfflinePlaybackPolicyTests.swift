import XCTest
@testable import EOSMusic

final class OfflinePlaybackPolicyTests: XCTestCase {
    func testOfflineModeForcesOfflinePlayback() {
        XCTAssertTrue(OfflinePlaybackPolicy.isOfflinePlaybackActive(offlineModeEnabled: true, isOnline: true))
        XCTAssertTrue(OfflinePlaybackPolicy.isOfflinePlaybackActive(offlineModeEnabled: true, isOnline: false))
    }

    func testNetworkLossForcesOfflinePlayback() {
        XCTAssertTrue(OfflinePlaybackPolicy.isOfflinePlaybackActive(offlineModeEnabled: false, isOnline: false))
        XCTAssertFalse(OfflinePlaybackPolicy.isOfflinePlaybackActive(offlineModeEnabled: false, isOnline: true))
    }

    func testLocalFileAlwaysPlayable() {
        XCTAssertTrue(
            OfflinePlaybackPolicy.canPlayRemoteStream(
                offlineModeEnabled: true,
                isOnline: false,
                hasLocalFile: true
            )
        )
    }

    func testRemoteBlockedWhenOffline() {
        XCTAssertFalse(
            OfflinePlaybackPolicy.canPlayRemoteStream(
                offlineModeEnabled: true,
                isOnline: true,
                hasLocalFile: false
            )
        )
    }
}

final class DownloadRetryPolicyTests: XCTestCase {
    func testBackoffExhausts() {
        XCTAssertNotNil(DownloadRetryPolicy.delayNanoseconds(afterAttempt: 0))
        XCTAssertNotNil(DownloadRetryPolicy.delayNanoseconds(afterAttempt: 4))
        XCTAssertNil(DownloadRetryPolicy.delayNanoseconds(afterAttempt: 5))
    }

    func testBackoffGrows() {
        let a0 = DownloadRetryPolicy.delayNanoseconds(afterAttempt: 0)!
        let a2 = DownloadRetryPolicy.delayNanoseconds(afterAttempt: 2)!
        XCTAssertGreaterThan(a2, a0)
    }
}

final class StreamRecoveryPolicyTests: XCTestCase {
    func testStablePlaybackResets() {
        XCTAssertFalse(StreamRecoveryPolicy.shouldResetAttemptCount(stablePlaybackDuration: 10))
        XCTAssertTrue(StreamRecoveryPolicy.shouldResetAttemptCount(stablePlaybackDuration: 30))
    }

    func testFatalErrorsDetected() {
        XCTAssertTrue(StreamRecoveryPolicy.isFatalPlaybackError("HTTP 401 Unauthorized"))
        XCTAssertTrue(StreamRecoveryPolicy.isFatalPlaybackError("404 Not Found"))
        XCTAssertFalse(StreamRecoveryPolicy.isFatalPlaybackError("The network connection was lost"))
    }
}

final class TrackMetadataConflictTests: XCTestCase {
    func testEmbeddedTitleConflictDetectsDifferentSong() {
        XCTAssertTrue(
            TrackMetadataEnricher.embeddedTitleConflicts(
                expectedTitle: "La Sovata (feat. Cindy)",
                embeddedTitle: "Get Back (ASA)"
            )
        )
    }

    func testEmbeddedTitleConflictAllowsPartialMatch() {
        XCTAssertFalse(
            TrackMetadataEnricher.embeddedTitleConflicts(
                expectedTitle: "La Sovata (feat. Cindy)",
                embeddedTitle: "La Sovata"
            )
        )
    }

    func testEmbeddedTitleConflictIgnoresMissing() {
        XCTAssertFalse(
            TrackMetadataEnricher.embeddedTitleConflicts(
                expectedTitle: "La Sovata",
                embeddedTitle: nil
            )
        )
    }
}

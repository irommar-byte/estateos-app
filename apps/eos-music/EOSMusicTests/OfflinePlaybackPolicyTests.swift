import UIKit
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

    func testServerStreamURLSkipsPlayTokenQuery() {
        let url = MusicAPIClient.musicStreamURL(
            base: URL(string: "https://example.com/proxy")!,
            jobId: "asset-1"
        )
        XCTAssertEqual(url.path, "/proxy/api/music/stream/asset-1")
        XCTAssertNil(url.query)
    }

    func testServerStreamURLKeepsPlayTokenWhenProvided() {
        let url = MusicAPIClient.musicStreamURL(
            base: URL(string: "https://example.com/proxy")!,
            jobId: "asset-1",
            token: "abc"
        )
        XCTAssertEqual(url.query, "token=abc")
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
        XCTAssertTrue(StreamRecoveryPolicy.isFatalPlaybackError("HTTP 403 Forbidden"))
        XCTAssertFalse(StreamRecoveryPolicy.isFatalPlaybackError("404 Not Found"))
        XCTAssertFalse(StreamRecoveryPolicy.isFatalPlaybackError("The network connection was lost"))
    }
}

final class MusicFolderAvailabilityLabelTests: XCTestCase {
    func testPartialMatchesCloudCount() {
        XCTAssertEqual(MusicFolder.availabilityLabel(onServer: 3, total: 5), "3 z 5 na serwerze")
    }

    func testAllOnServerIsExplicit() {
        XCTAssertEqual(MusicFolder.availabilityLabel(onServer: 5, total: 5), "5 utworów na serwerze")
        XCTAssertEqual(MusicFolder.availabilityLabel(onServer: 1, total: 1), "1 utwór na serwerze")
    }

    func testNoneOnServerDoesNotClaimServerCopies() {
        XCTAssertEqual(MusicFolder.availabilityLabel(onServer: 0, total: 5), "5 utworów")
    }

    func testZeroTracks() {
        XCTAssertEqual(MusicFolder.availabilityLabel(onServer: 0, total: 0), "0 utworów")
    }
}

final class MusicPlayWaitPolicyTests: XCTestCase {
    func testLiveProxySatisfiesWithoutDurableRequirement() {
        let job = Self.decodeJob("""
        {"jobId":"j1","status":"starting","ready":true,"mode":"stream-proxy"}
        """)
        XCTAssertTrue(MusicPlayWaitPolicy.isSatisfied(job, requireDurable: false))
        XCTAssertFalse(MusicPlayWaitPolicy.isSatisfied(job, requireDurable: true))
        XCTAssertFalse(job.looksLikeFileIngest)
    }

    func testDownloadingIngestWaitsForDurableFile() {
        let mid = Self.decodeJob("""
        {"jobId":"j2","status":"downloading","ready":false,"progress":4,"intent":"download"}
        """)
        XCTAssertFalse(MusicPlayWaitPolicy.isSatisfied(mid, requireDurable: false))
        XCTAssertFalse(MusicPlayWaitPolicy.isSatisfied(mid, requireDurable: true))
        XCTAssertTrue(mid.looksLikeFileIngest)

        let preparing = Self.decodeJob("""
        {"jobId":"j4","status":"preparing","ready":false,"progress":22,"intent":"download"}
        """)
        XCTAssertTrue(preparing.looksLikeFileIngest)
        XCTAssertFalse(preparing.isPlayableServerStream)

        let done = Self.decodeJob("""
        {"jobId":"j2","status":"done","ready":true,"onServer":true,"mode":"file"}
        """)
        XCTAssertTrue(MusicPlayWaitPolicy.isSatisfied(done, requireDurable: true))
        XCTAssertTrue(done.isDurableServerCopy)
    }

    func testReadyLiveDoesNotCountAsDurable() {
        let job = Self.decodeJob("""
        {"jobId":"j3","status":"starting","ready":true,"mode":"stream-proxy","onServer":false}
        """)
        XCTAssertTrue(MusicPlayWaitPolicy.isSatisfied(job, requireDurable: false))
        XCTAssertFalse(job.isDurableServerCopy)
    }

    func testDoneLiveProxyIsNotDurable() {
        let job = Self.decodeJob("""
        {"jobId":"j5","status":"done","ready":true,"mode":"stream-proxy","onServer":false}
        """)
        XCTAssertTrue(MusicPlayWaitPolicy.isSatisfied(job, requireDurable: false))
        XCTAssertFalse(MusicPlayWaitPolicy.isSatisfied(job, requireDurable: true))
        XCTAssertFalse(job.isDurableServerCopy)
    }

    private static func decodeJob(_ json: String) -> JobStatusResponse {
        try! JSONDecoder().decode(JobStatusResponse.self, from: Data(json.utf8))
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

    func testCyrillicTitleSurvivesNormalization() {
        XCTAssertEqual(
            TrackMetadataEnricher.normalizedSearchToken("Новогодняя"),
            "новогодняя"
        )
    }

    func testEmbeddedArtRejectedWhenTitleConflicts() {
        XCTAssertFalse(
            TrackMetadataEnricher.shouldUseEmbeddedArtwork(
                expectedTitle: "Новогодняя",
                embeddedTitle: "Get Back (ASA)"
            )
        )
        XCTAssertTrue(
            TrackMetadataEnricher.shouldUseEmbeddedArtwork(
                expectedTitle: "Новогодняя",
                embeddedTitle: "Новогодняя"
            )
        )
    }

    func testCyrillicCatalogMatchPicksTheRightCover() {
        let songs = [
            SearchResultItem.catalogStub(
                title: "Random English Hit",
                url: "https://music.apple.com/song/wrong",
                artist: "Someone",
                thumbnail: "https://example.com/woman.jpg"
            ),
            SearchResultItem.catalogStub(
                title: "Новогодняя",
                url: "https://music.apple.com/song/right",
                artist: "Diskoteka Avariya",
                thumbnail: "https://example.com/ny.jpg"
            ),
        ]
        let payload = MusicTrackPayload(
            url: "https://x/novogodnyaya",
            title: "Новогодняя",
            artist: "Diskoteka Avariya",
            album: nil,
            thumbnail: nil,
            duration: nil,
            quality: nil,
            source: nil,
            artistId: nil,
            albumId: nil
        )
        XCTAssertEqual(
            TrackMetadataEnricher.bestCatalogMatch(for: payload, in: songs)?.url,
            "https://music.apple.com/song/right"
        )
    }

    func testUnrelatedCatalogRowDoesNotBecomeCover() {
        let payload = MusicTrackPayload(
            url: "https://x/novogodnyaya",
            title: "Новогодняя",
            artist: "Diskoteka Avariya",
            album: nil,
            thumbnail: nil,
            duration: nil,
            quality: nil,
            source: nil,
            artistId: nil,
            albumId: nil
        )
        XCTAssertNil(
            TrackMetadataEnricher.bestCatalogMatch(
                for: payload,
                in: [
                    SearchResultItem.catalogStub(
                        title: "Unrelated Hit",
                        url: "https://music.apple.com/song/wrong",
                        artist: "Someone",
                        thumbnail: "https://example.com/woman.jpg"
                    )
                ]
            )
        )
    }
}

final class VideoHandoffContractTests: XCTestCase {
    func testVLCCannotSuspendBeforeAVPlayerAndVideoAreReady() {
        XCTAssertFalse(
            VideoHandoffPolicy.canSuspendVLC(
                avPlayerReady: false,
                hasVideoFrame: true,
                destinationAvailable: true
            )
        )
        XCTAssertFalse(
            VideoHandoffPolicy.canSuspendVLC(
                avPlayerReady: true,
                hasVideoFrame: false,
                destinationAvailable: true
            )
        )
        XCTAssertFalse(
            VideoHandoffPolicy.canSuspendVLC(
                avPlayerReady: true,
                hasVideoFrame: true,
                destinationAvailable: false
            )
        )
    }

    func testVLCSuspendsOnlyAfterAtomicHandoffGate() {
        XCTAssertTrue(
            VideoHandoffPolicy.canSuspendVLC(
                avPlayerReady: true,
                hasVideoFrame: true,
                destinationAvailable: true
            )
        )
    }

    func testOnlyActivePiPOrAirPlayOwnsAVPlayerTransport() {
        XCTAssertTrue(VideoHandoffState.pictureInPicture.avPlayerOwnsTransport)
        XCTAssertTrue(VideoHandoffState.airPlay.avPlayerOwnsTransport)
        XCTAssertFalse(VideoHandoffState.preparingPiP.avPlayerOwnsTransport)
        XCTAssertFalse(VideoHandoffState.restoringVLC.avPlayerOwnsTransport)
        XCTAssertFalse(VideoHandoffState.failed("test").avPlayerOwnsTransport)
    }

    func testRejectsShortAVDurationWhenVLCKnowsFeatureLength() {
        XCTAssertTrue(
            VideoHandoffPolicy.isUnreliableAVDuration(avDuration: 120, vlcDuration: 7200)
        )
        XCTAssertFalse(
            VideoHandoffPolicy.isUnreliableAVDuration(avDuration: 7200, vlcDuration: 7200)
        )
        XCTAssertFalse(
            VideoHandoffPolicy.isUnreliableAVDuration(avDuration: 90, vlcDuration: 0)
        )
    }

    func testHTTPAirPlayDoesNotRequirePlayableFlag() {
        XCTAssertFalse(
            VideoHandoffPolicy.requiresPlayableFlag(
                url: URL(string: "https://example.com/api/movies/stream/job-1")!
            )
        )
        XCTAssertTrue(
            VideoHandoffPolicy.requiresPlayableFlag(url: URL(fileURLWithPath: "/tmp/movie.mp4"))
        )
    }

    func testAirPlayHandoffNeedsReadyVideoAndReliableDuration() {
        XCTAssertFalse(
            VideoHandoffPolicy.canHandOffToAirPlay(
                avItemReady: true,
                hasVideoFrame: false,
                durationUnreliable: false
            )
        )
        XCTAssertFalse(
            VideoHandoffPolicy.canHandOffToAirPlay(
                avItemReady: true,
                hasVideoFrame: true,
                durationUnreliable: true
            )
        )
        XCTAssertTrue(
            VideoHandoffPolicy.canHandOffToAirPlay(
                avItemReady: true,
                hasVideoFrame: true,
                durationUnreliable: false
            )
        )
        XCTAssertEqual(VideoHandoffPolicy.airPlayRemuxWaitSeconds, 15)
    }

    func testHandoffTransitionStatesAreExplicit() {
        XCTAssertTrue(VideoHandoffState.preparingPiP.isTransitioning)
        XCTAssertTrue(VideoHandoffState.preparingAirPlay.isTransitioning)
        XCTAssertTrue(VideoHandoffState.restoringVLC.isTransitioning)
        XCTAssertFalse(VideoHandoffState.pictureInPicture.isTransitioning)
        XCTAssertFalse(VideoHandoffState.airPlay.isTransitioning)
    }

    @MainActor
    func testSupportedContainerContract() {
        XCTAssertTrue(VideoPiPController.isApplePiPContainer(URL(string: "https://example.com/movie.mp4")!))
        XCTAssertTrue(VideoPiPController.isApplePiPContainer(URL(string: "https://example.com/api/play/job")!))
        XCTAssertFalse(VideoPiPController.isApplePiPContainer(URL(fileURLWithPath: "/tmp/movie.mkv")))
    }

    @MainActor
    func testLiveFilmstripFramesClearPreparingSpinner() {
        let generator = VideoThumbnailGenerator()
        generator.markPreparing()
        XCTAssertTrue(generator.isGenerating)
        let image = UIImage(systemName: "film") ?? UIImage()
        generator.ingestLiveFrame(image, fraction: 0.2)
        generator.ingestLiveFrame(image, fraction: 0.45)
        generator.ingestLiveFrame(image, fraction: 0.7)
        XCTAssertEqual(generator.frames.count, 3)
        XCTAssertFalse(generator.isGenerating)
    }

    @MainActor
    func testFinishPreparingClearsEmptySpinner() {
        let generator = VideoThumbnailGenerator()
        generator.markPreparing()
        generator.finishPreparingIfNeeded()
        XCTAssertFalse(generator.isGenerating)
        XCTAssertTrue(generator.frames.isEmpty)
    }
}

final class VideoDurationPolicyTests: XCTestCase {
    func testRejectsMillisecondStub() {
        XCTAssertNil(VideoDurationPolicy.acceptedDuration(reportedSeconds: 0.001, currentTime: 0.16))
        XCTAssertNil(VideoDurationPolicy.acceptedDuration(reportedSeconds: 0.4, currentTime: 0))
    }

    func testAcceptsLengthGreaterThanCurrentTime() {
        XCTAssertEqual(
            VideoDurationPolicy.acceptedDuration(reportedSeconds: 7200, currentTime: 16),
            7200
        )
    }

    func testDoesNotShrinkKnownFeatureToTwoMinutes() {
        XCTAssertNil(
            VideoDurationPolicy.acceptedDuration(reportedSeconds: 120, currentTime: 16, existing: 7200)
        )
    }

    func testFreshStartResetsWhenOpenedAwayFromZero() {
        XCTAssertTrue(VideoDurationPolicy.shouldResetFreshStart(currentTime: 16))
        XCTAssertFalse(VideoDurationPolicy.shouldResetFreshStart(currentTime: 0.2))
    }

    func testUnknownDurationClockIsEmDash() {
        XCTAssertEqual(VideoScrubberFormatting.endClock(duration: 0), "—")
        XCTAssertEqual(VideoScrubberFormatting.endClock(duration: 16), "0:16")
    }

    func testMovieJobIdFromStreamURL() {
        let url = URL(string: "https://example.com/admin_pro/api/movies/proxy/api/movies/stream/job-1?token=abc")!
        XCTAssertEqual(VideoStreamURLPolicy.movieJobId(from: url), "job-1")
        XCTAssertNil(VideoStreamURLPolicy.movieJobId(from: URL(string: "https://example.com/api/play/job-1")))
    }

    func testEstimatesDurationFromSizeAndBitrate() {
        XCTAssertEqual(
            VideoDurationPolicy.estimatedDuration(fileBytes: 1_200_000_000, bitrateBps: 2_000_000) ?? -1,
            4800,
            accuracy: 1
        )
        XCTAssertNil(VideoDurationPolicy.estimatedDuration(fileBytes: 1000, bitrateBps: 2_000_000))
        XCTAssertNil(VideoDurationPolicy.estimatedDuration(fileBytes: 1_200_000_000, bitrateBps: 10))
    }

    func testFilmstripPlacesFramesWithoutKnownDuration() {
        XCTAssertEqual(VideoFilmstripPolicy.placementDuration(known: 0, currentTime: 80), 104)
        XCTAssertEqual(VideoFilmstripPolicy.placementDuration(known: 7200, currentTime: 80), 7200)
        XCTAssertTrue(
            VideoFilmstripPolicy.shouldCaptureLiveFrame(
                currentTime: 1.2,
                lastCaptureAt: -30,
                isSeeking: false
            )
        )
        XCTAssertFalse(
            VideoFilmstripPolicy.shouldCaptureLiveFrame(
                currentTime: 2,
                lastCaptureAt: 1.5,
                isSeeking: false
            )
        )
    }
}

final class VideoPlayerChromeMetricsTests: XCTestCase {
    func testPortraitChromeClearsDynamicIsland() {
        XCTAssertGreaterThanOrEqual(VideoPlayerChromeMetrics.portraitTopClearance, 54)
        XCTAssertGreaterThanOrEqual(
            VideoPlayerChromeMetrics.topInset(safeTop: 0, width: 390, height: 844),
            54
        )
    }

    func testLandscapeChromeClearsIslandAndSideSafeArea() {
        XCTAssertGreaterThanOrEqual(
            VideoPlayerChromeMetrics.topInset(safeTop: 0, width: 852, height: 393),
            48
        )
        XCTAssertGreaterThanOrEqual(VideoPlayerChromeMetrics.islandGutter, 120)
        XCTAssertEqual(VideoPlayerChromeMetrics.sideInset(safeSide: 59), 59)
        XCTAssertEqual(VideoPlayerChromeMetrics.sideInset(safeSide: 0), 16)
    }
}

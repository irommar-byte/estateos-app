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
                currentTime: 10,
                lastCaptureAt: -30,
                isSeeking: false,
                knownDuration: 5760
            )
        )
        XCTAssertFalse(
            VideoFilmstripPolicy.shouldCaptureLiveFrame(
                currentTime: 2,
                lastCaptureAt: 1.5,
                isSeeking: false
            )
        )
        let early = VideoFilmstripPolicy.liveBucket(fraction: 12 / 5760)
        XCTAssertFalse(
            VideoFilmstripPolicy.shouldCaptureLiveFrame(
                currentTime: 20,
                lastCaptureAt: 0,
                isSeeking: false,
                knownDuration: 5760,
                occupiedBuckets: [early]
            )
        )
        XCTAssertFalse(VideoFilmstripPolicy.canTakeVLCSnapshot(hasVideoSize: false, isSeeking: false, force: true))
        XCTAssertFalse(VideoFilmstripPolicy.canTakeVLCSnapshot(hasVideoSize: true, isSeeking: true, force: false))
        XCTAssertTrue(VideoFilmstripPolicy.canTakeVLCSnapshot(hasVideoSize: true, isSeeking: false, force: false))
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

final class MovieBrowseOrderingTests: XCTestCase {
    func testNewestPutsLaterYearsFirst() {
        let items = [
            SearchResultItem(title: "Starszy (1990)", url: "https://example.com/a", thumbnail: nil, detail: nil, source: nil, uploader: nil, album: nil, duration: nil, artistId: nil, albumId: nil, trackNumber: nil, quality: nil, rating: 9, views: nil, isSerial: nil, premium: nil, previewUrl: nil, isrc: nil, year: 1990),
            SearchResultItem(title: "Nowy (2025)", url: "https://example.com/b", thumbnail: nil, detail: nil, source: nil, uploader: nil, album: nil, duration: nil, artistId: nil, albumId: nil, trackNumber: nil, quality: nil, rating: 4, views: nil, isSerial: nil, premium: nil, previewUrl: nil, isrc: nil, year: 2025),
        ]
        let ordered = MovieBrowseOrdering.ordered(items, mode: .newest)
        XCTAssertEqual(ordered.map(\.url), ["https://example.com/b", "https://example.com/a"])
    }

    func testTopRatedPutsHigherScoresFirst() {
        let items = [
            SearchResultItem(title: "Słabszy (2024)", url: "https://example.com/a", thumbnail: nil, detail: nil, source: nil, uploader: nil, album: nil, duration: nil, artistId: nil, albumId: nil, trackNumber: nil, quality: nil, rating: 3.8, views: nil, isSerial: nil, premium: nil, previewUrl: nil, isrc: nil, year: 2024),
            SearchResultItem(title: "Lepszy (2019)", url: "https://example.com/b", thumbnail: nil, detail: nil, source: nil, uploader: nil, album: nil, duration: nil, artistId: nil, albumId: nil, trackNumber: nil, quality: nil, rating: 8.1, views: nil, isSerial: nil, premium: nil, previewUrl: nil, isrc: nil, year: 2019),
        ]
        let ordered = MovieBrowseOrdering.ordered(items, mode: .topRated)
        XCTAssertEqual(ordered.map(\.url), ["https://example.com/b", "https://example.com/a"])
    }
}

final class MovieResumePolicyTests: XCTestCase {
    func testMidFilmPositionIsOffered() {
        XCTAssertTrue(MovieResumePolicy.shouldOffer(position: 15 * 60, duration: 96 * 60))
        XCTAssertFalse(MovieResumePolicy.shouldOffer(position: 10, duration: 96 * 60))
        XCTAssertFalse(MovieResumePolicy.shouldOffer(position: 96 * 60 - 10, duration: 96 * 60))
        XCTAssertEqual(MovieResumePolicy.clockLabel(seconds: 15 * 60 + 2), "15:02")
    }

    func testReleaseYearURLKeepsTheCatalogHost() {
        XCTAssertEqual(
            CdaHdBrowseLink.releaseYearURL(year: 1985, referenceURL: "https://cda-hd.cc/3879/rambo/"),
            "https://cda-hd.cc/release-year/1985/"
        )
        XCTAssertEqual(CdaHdBrowseLink.year(in: "Rambo II (1985)"), 1985)
    }
}

final class MovieDownloadQualityPolicyTests: XCTestCase {
    func testInventedMirrorTiersAreNotARealQualityChoice() {
        XCTAssertTrue(
            MovieDownloadQualityPolicy.isInventedMirrorTier(detail: "Szacunek · mirror · czas z strony")
        )
        XCTAssertFalse(MovieDownloadQualityPolicy.isInventedMirrorTier(detail: "1128×480 · jedyna jakość w źródle"))
        XCTAssertFalse(MovieDownloadQualityPolicy.isInventedMirrorTier(detail: "TVP VOD · szacunek"))
    }

    func testSingleSourceHeightHidesTheQualityPicker() {
        let only = [
            MediaQualityOption(id: "best", label: "Najlepsza dostępna", detail: "1128×480", sizeBytes: 681_378_552, height: 480)
        ]
        XCTAssertFalse(MovieDownloadQualityPolicy.offersDistinctVideoQuality(only))
        let ladder = [
            MediaQualityOption(id: "1080", label: "1080p", height: 1080),
            MediaQualityOption(id: "720", label: "720p", height: 720),
        ]
        XCTAssertTrue(MovieDownloadQualityPolicy.offersDistinctVideoQuality(ladder))
    }

    func testProgressLabelUsesBytesWrittenNotABitrateGuess() {
        XCTAssertEqual(
            MovieDownloadQualityPolicy.progressBytesLabel(downloaded: 320 * 1_048_576, expected: 650 * 1_048_576),
            "320 MB / 650 MB"
        )
        XCTAssertEqual(
            MovieDownloadQualityPolicy.progressBytesLabel(downloaded: 681_378_552, expected: nil),
            "650 MB"
        )
        XCTAssertEqual(
            MovieDownloadQualityPolicy.progressBytesLabel(downloaded: 35_651_584, expected: 801_979_233),
            "34.0 MB / 765 MB"
        )
    }

    func testKnownSizeUsesMeasuredBytes() {
        let option = MediaQualityOption(
            id: "best",
            label: "Najlepsza dostępna",
            sizeBytes: 681_378_552,
            sizeLabel: "ok. 650 MB",
            height: 480
        )
        XCTAssertEqual(
            option.knownSizeLabel(itemCount: 1, singleItemDuration: 5761, totalDuration: 5761),
            "ok. 650 MB"
        )
        let invented = MediaQualityOption(
            id: "1080",
            label: "1080p",
            detail: "Szacunek · mirror",
            sizeBytes: 3_600_000_000,
            height: 1080
        )
        XCTAssertNil(invented.knownSizeLabel(itemCount: 1, singleItemDuration: 5761, totalDuration: 5761))
    }
}

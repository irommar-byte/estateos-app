import XCTest
@testable import EOSMusic

final class ShazamCatalogMatcherTests: XCTestCase {
    func testKolejnaNocDoesNotResolveToLabiryntWhenBothAreInResults() {
        let songs = [
            SearchResultItem.catalogStub(
                title: "Labirynt",
                url: "https://music.apple.com/pl/song/labirynt/111",
                artist: "Wac Toja"
            ),
            SearchResultItem.catalogStub(
                title: "Say My Name",
                url: "https://music.apple.com/pl/song/say-my-name/222",
                artist: "Dimitri Vegas & Like Mike"
            ),
            SearchResultItem.catalogStub(
                title: "KOLEJNA NOC",
                url: "https://music.apple.com/pl/song/kolejna-noc/333",
                artist: "Wac Toja"
            ),
        ]
        let match = ShazamCatalogMatcher.bestSong(
            title: "KOLEJNA NOC",
            artist: "Wac Toja",
            songs: songs
        )
        XCTAssertEqual(match?.title, "KOLEJNA NOC")
        XCTAssertEqual(match?.url, "https://music.apple.com/pl/song/kolejna-noc/333")
    }

    func testArtistOnlyHitIsRejected() {
        let songs = [
            SearchResultItem.catalogStub(
                title: "Labirynt",
                url: "https://music.apple.com/pl/song/labirynt/111",
                artist: "Wac Toja"
            ),
        ]
        XCTAssertNil(
            ShazamCatalogMatcher.bestSong(
                title: "KOLEJNA NOC",
                artist: "Wac Toja",
                songs: songs
            )
        )
    }

    func testNeverFallsBackToFirstResult() {
        let songs = [
            SearchResultItem.catalogStub(title: "Labirynt", url: "https://x/labirynt", artist: "Wac Toja"),
            SearchResultItem.catalogStub(title: "Bujanka", url: "https://x/bujanka", artist: "Someone"),
        ]
        XCTAssertNil(
            ShazamCatalogMatcher.bestSong(title: "KOLEJNA NOC", artist: "Wac Toja", songs: songs)
        )
    }

    func testAppleMusicIDWinsOverWrongTitle() {
        let songs = [
            SearchResultItem.catalogStub(
                title: "Labirynt",
                url: "https://music.apple.com/song/111",
                artist: "Wac Toja"
            ),
            SearchResultItem.catalogStub(
                title: "Kolejna Noc",
                url: "https://music.apple.com/song/1440881347",
                artist: "Wac Toja"
            ),
        ]
        let match = ShazamCatalogMatcher.bestSong(
            title: "KOLEJNA NOC",
            artist: "Wac Toja",
            appleMusicID: "1440881347",
            songs: songs
        )
        XCTAssertEqual(match?.url, "https://music.apple.com/song/1440881347")
    }

    func testCoverWithSameTitleIsRejectedWhenArtistKnown() {
        let songs = [
            SearchResultItem.catalogStub(
                title: "Blinding Lights",
                url: "https://music.apple.com/pl/song/cover/1",
                artist: "Some Cover Band"
            ),
            SearchResultItem.catalogStub(
                title: "Blinding Lights",
                url: "https://music.apple.com/pl/song/official/2",
                artist: "The Weeknd"
            ),
        ]
        let match = ShazamCatalogMatcher.bestSong(
            title: "Blinding Lights",
            artist: "The Weeknd",
            songs: songs
        )
        XCTAssertEqual(match?.url, "https://music.apple.com/pl/song/official/2")
    }

    func testSameTitleWrongArtistOnlyIsRejected() {
        XCTAssertNil(
            ShazamCatalogMatcher.bestSong(
                title: "Blinding Lights",
                artist: "The Weeknd",
                songs: [
                    SearchResultItem.catalogStub(
                        title: "Blinding Lights",
                        url: "https://music.apple.com/pl/song/cover/1",
                        artist: "Random Artist"
                    )
                ]
            )
        )
    }

    func testPartialAppleMusicIDDoesNotMatchAnotherTrack() {
        XCTAssertNil(
            ShazamCatalogMatcher.bestSong(
                title: "KOLEJNA NOC",
                artist: "Wac Toja",
                appleMusicID: "111",
                songs: [
                    SearchResultItem.catalogStub(
                        title: "Labirynt",
                        url: "https://music.apple.com/pl/song/labirynt/111222",
                        artist: "Wac Toja"
                    )
                ]
            )
        )
    }

    func testSameRecordingRequiresMatchingTitle() {
        XCTAssertTrue(
            ShazamCatalogMatcher.isSameRecording(
                lhsTitle: "KOLEJNA NOC",
                lhsArtist: "Wac Toja",
                rhsTitle: "Kolejna Noc",
                rhsArtist: "Wac Toja"
            )
        )
        XCTAssertFalse(
            ShazamCatalogMatcher.isSameRecording(
                lhsTitle: "KOLEJNA NOC",
                lhsArtist: "Wac Toja",
                rhsTitle: "Labirynt",
                rhsArtist: "Wac Toja"
            )
        )
    }

    func testCyrillicTitleIsNotStripped() {
        XCTAssertEqual(ShazamCatalogMatcher.normalized("Новогодняя").trimmingCharacters(in: .whitespaces), "новогодняя")
        let match = ShazamCatalogMatcher.bestSong(
            title: "Новогодняя",
            artist: "Diskoteka Avariya",
            songs: [
                SearchResultItem.catalogStub(
                    title: "Unrelated",
                    url: "https://music.apple.com/song/wrong",
                    artist: "Diskoteka Avariya"
                ),
                SearchResultItem.catalogStub(
                    title: "Новогодняя",
                    url: "https://music.apple.com/song/right",
                    artist: "Diskoteka Avariya"
                ),
            ]
        )
        XCTAssertEqual(match?.url, "https://music.apple.com/song/right")
    }

    func testRemixSuffixStillMatchesCoreTitle() {
        let songs = [
            SearchResultItem.catalogStub(
                title: "Ibiza",
                url: "https://music.apple.com/song/ibiza",
                artist: "Francesco Diaz"
            )
        ]
        let match = ShazamCatalogMatcher.bestSong(
            title: "Ibiza (Wawa Club Mix) [feat. Beverly T.J]",
            artist: "Francesco Diaz",
            songs: songs
        )
        XCTAssertEqual(match?.url, "https://music.apple.com/song/ibiza")
    }

    func testExternalRecordingPrefersTitleAndArtistOverKaraoke() {
        let songs = [
            SearchResultItem.catalogStub(
                title: "Tequila (Karaoke Version)",
                url: "https://www.youtube.com/watch?v=karaoke",
                artist: "Karaoke Hub"
            ),
            SearchResultItem.catalogStub(
                title: "Maco Mamuko - Tequila (Official Audio)",
                url: "https://www.youtube.com/watch?v=tequila",
                artist: "Maco Mamuko"
            ),
        ]
        let match = ShazamCatalogMatcher.bestExternalRecording(
            title: "Tequila",
            artist: "Maco Mamuko",
            songs: songs
        )
        XCTAssertEqual(match?.url, "https://www.youtube.com/watch?v=tequila")
    }

    func testExternalRecordingStillReturnsAHitWhenChannelNameDiffers() {
        let songs = [
            SearchResultItem.catalogStub(
                title: "Tequila",
                url: "https://www.youtube.com/watch?v=topic",
                artist: "Topic"
            ),
        ]
        let match = ShazamCatalogMatcher.bestExternalRecording(
            title: "Tequila",
            artist: "Maco Mamuko",
            songs: songs
        )
        XCTAssertEqual(match?.url, "https://www.youtube.com/watch?v=topic")
    }

    func testAppleMusicFallbackDoesNotNeedSearchHits() {
        let fallback = ShazamCatalogMatcher.catalogFallback(
            title: "Ibiza",
            artist: "Francesco Diaz",
            appleMusicID: "123456",
            webURL: nil
        )
        XCTAssertEqual(fallback?.url, "https://music.apple.com/song/123456")
    }
}

final class BulkServerQueuePolicyTests: XCTestCase {
    func testPlaylistRunsOneJobAtATime() {
        var completed = 0
        var inFlight = 0
        var maxInFlight = 0
        var starts: [Int] = []
        let total = 10

        while true {
            switch BulkServerQueuePolicy.nextAction(
                completed: completed,
                total: total,
                cancelled: false,
                inFlight: inFlight
            ) {
            case .start(let index):
                XCTAssertEqual(index, completed + inFlight)
                XCTAssertLessThan(inFlight, BulkServerQueuePolicy.maxConcurrentServerJobs)
                starts.append(index)
                inFlight += 1
                maxInFlight = max(maxInFlight, inFlight)
                if inFlight == BulkServerQueuePolicy.maxConcurrentServerJobs {
                    inFlight -= 1
                    completed += 1
                }
            case .wait:
                XCTAssertGreaterThan(inFlight, 0)
                inFlight -= 1
                completed += 1
            case .done:
                XCTAssertEqual(starts, Array(0..<total))
                XCTAssertEqual(maxInFlight, 1)
                XCTAssertEqual(BulkServerQueuePolicy.maxConcurrentServerJobs, 1)
                return
            case .cancelled:
                XCTFail("cancelled")
                return
            }
        }
    }

    func testWaitsWhenTheSingleJobIsInFlight() {
        XCTAssertEqual(
            BulkServerQueuePolicy.nextAction(completed: 3, total: 144, cancelled: false, inFlight: 1),
            .wait
        )
        XCTAssertEqual(
            BulkServerQueuePolicy.nextAction(completed: 3, total: 144, cancelled: false, inFlight: 0),
            .start(index: 3)
        )
    }

    func testOverallProgressSumsLiveSlots() {
        XCTAssertEqual(
            BulkServerQueuePolicy.overallFraction(completed: 0, total: 99, slotProgresses: [0.22, 0.22]),
            0.22 / 99,
            accuracy: 0.0001
        )
        XCTAssertEqual(
            BulkServerQueuePolicy.overallFraction(completed: 10, total: 100, slotProgresses: [0.5, 0.25, 0.25]),
            0.105,
            accuracy: 0.0001
        )
        XCTAssertEqual(BulkServerQueuePolicy.overallFraction(completed: 0, total: 99, slotProgresses: []), 0)
    }

    func testCancelStopsTheQueueImmediately() {
        XCTAssertEqual(
            BulkServerQueuePolicy.nextAction(completed: 12, total: 144, cancelled: true, inFlight: 1),
            .cancelled
        )
    }

    func testStallAtFortyThreePercentTriggersRetry() {
        XCTAssertFalse(BulkServerQueuePolicy.isAcquireStalled(progress: 43, unchangedFor: 19))
        XCTAssertFalse(BulkServerQueuePolicy.isAcquireStalled(progress: 43, unchangedFor: 91))
        XCTAssertTrue(BulkServerQueuePolicy.isAcquireStalled(progress: 43, unchangedFor: 151))
        XCTAssertFalse(BulkServerQueuePolicy.isAcquireStalled(progress: 0, unchangedFor: 30))
        XCTAssertFalse(BulkServerQueuePolicy.isAcquireStalled(progress: 97, unchangedFor: 30))
        XCTAssertTrue(BulkServerQueuePolicy.isAcquireStalled(progress: 97, unchangedFor: 121))
    }

    func testFinalizeCompleteAtReadyOrHundred() {
        XCTAssertTrue(BulkServerQueuePolicy.isFinalizeComplete(progress: 97, isDurable: true, isReady: false))
        XCTAssertTrue(BulkServerQueuePolicy.isFinalizeComplete(progress: 96, isDurable: false, isReady: true))
        XCTAssertFalse(BulkServerQueuePolicy.isFinalizeComplete(progress: 100, isDurable: false, isReady: false))
        XCTAssertFalse(BulkServerQueuePolicy.isFinalizeComplete(progress: 97, isDurable: false, isReady: false))
    }

    func testJitterDoesNotCountAsProgress() {
        XCTAssertFalse(BulkServerQueuePolicy.isMeaningfulProgress(from: 43, to: 43.1))
        XCTAssertTrue(BulkServerQueuePolicy.isMeaningfulProgress(from: 43, to: 43.4))
        XCTAssertTrue(BulkServerQueuePolicy.isMeaningfulProgress(from: 86, to: 90))
    }

    func testJobIdAloneDoesNotSkipPlaylistTrack() {
        XCTAssertTrue(
            BulkServerQueuePolicy.shouldSkipAsAlreadyOnServer(
                isOffline: false,
                hasDurableAsset: true,
                wasConfirmedOnServer: false
            )
        )
        XCTAssertFalse(
            BulkServerQueuePolicy.shouldSkipAsAlreadyOnServer(
                isOffline: false,
                hasDurableAsset: false,
                wasConfirmedOnServer: false
            )
        )
    }

    func testDisplayTotalNeverCollapsesToOneRemoteJob() {
        XCTAssertEqual(
            BulkServerQueuePolicy.displayTotal(stickyTotal: 144, itemCount: 144, existingTotal: 1),
            144
        )
        XCTAssertEqual(
            BulkServerQueuePolicy.displayTotal(stickyTotal: 144, itemCount: 1, existingTotal: 0),
            144
        )
    }

    func testLockScreenHidesLeftoverTwentySixHourETA() {
        XCTAssertNil(
            LiveActivityLockScreenPolicy.displayETA(seconds: 26 * 3600, remainingCount: 1)
        )
        XCTAssertEqual(
            LiveActivityLockScreenPolicy.displayETA(seconds: 90, remainingCount: 1),
            90
        )
        XCTAssertEqual(
            DownloadETAFormatter.expanded(
                LiveActivityLockScreenPolicy.displayETA(seconds: 26 * 3600, remainingCount: 1)
            ),
            "—"
        )
    }

    func testPlusRemoteDoneFinishesLockScreen() {
        XCTAssertTrue(
            LiveActivityLockScreenPolicy.shouldFinishPlusFromRemote(
                plusURLs: ["https://music.apple.com/song/tonight"],
                finishedURLs: ["https://music.apple.com/song/tonight"]
            )
        )
        XCTAssertFalse(
            LiveActivityLockScreenPolicy.shouldFinishPlusFromRemote(
                plusURLs: ["https://music.apple.com/song/tonight"],
                finishedURLs: []
            )
        )
        XCTAssertTrue(LiveActivityLockScreenPolicy.shouldDismissOrphanActivity(hasActiveWork: false))
        XCTAssertFalse(LiveActivityLockScreenPolicy.shouldDismissOrphanActivity(hasActiveWork: true))
    }

    func testLandedMovieMustNotKeepLockScreenAlive() {
        XCTAssertFalse(
            MovieDownloadLockScreenPolicy.isLiveRemoteJob(isTerminal: false, alreadyLanded: true)
        )
        XCTAssertTrue(
            MovieDownloadLockScreenPolicy.isLiveRemoteJob(isTerminal: false, alreadyLanded: false)
        )
        XCTAssertTrue(
            MovieDownloadLockScreenPolicy.shouldDismissLandedBatch(
                unfinishedCount: 0,
                landedCount: 1,
                total: 1
            )
        )
        XCTAssertFalse(
            MovieDownloadLockScreenPolicy.shouldDismissLandedBatch(
                unfinishedCount: 1,
                landedCount: 0,
                total: 1
            )
        )
    }
}

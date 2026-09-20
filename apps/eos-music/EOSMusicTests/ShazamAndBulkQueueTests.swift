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
}

final class BulkServerQueuePolicyTests: XCTestCase {
    func testPlaylistRunsTwoJobsAtATime() {
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
                XCTAssertEqual(maxInFlight, 2)
                XCTAssertEqual(BulkServerQueuePolicy.maxConcurrentServerJobs, 2)
                return
            case .cancelled:
                XCTFail("cancelled")
                return
            }
        }
    }

    func testWaitsWhenTwoJobsAreInFlight() {
        XCTAssertEqual(
            BulkServerQueuePolicy.nextAction(completed: 3, total: 144, cancelled: false, inFlight: 2),
            .wait
        )
        XCTAssertEqual(
            BulkServerQueuePolicy.nextAction(completed: 3, total: 144, cancelled: false, inFlight: 1),
            .start(index: 4)
        )
        XCTAssertEqual(
            BulkServerQueuePolicy.nextAction(completed: 3, total: 144, cancelled: false, inFlight: 0),
            .start(index: 3)
        )
    }

    func testCancelStopsTheQueueImmediately() {
        XCTAssertEqual(
            BulkServerQueuePolicy.nextAction(completed: 12, total: 144, cancelled: true, inFlight: 1),
            .cancelled
        )
    }

    func testStallAtFortyThreePercentTriggersRetry() {
        XCTAssertTrue(BulkServerQueuePolicy.isAcquireStalled(progress: 43, unchangedFor: 19))
        XCTAssertTrue(BulkServerQueuePolicy.isAcquireStalled(progress: 22, unchangedFor: 19))
        XCTAssertFalse(BulkServerQueuePolicy.isAcquireStalled(progress: 43, unchangedFor: 10))
        XCTAssertFalse(BulkServerQueuePolicy.isAcquireStalled(progress: 97, unchangedFor: 120))
    }

    func testJitterDoesNotCountAsProgress() {
        XCTAssertFalse(BulkServerQueuePolicy.isMeaningfulProgress(from: 43, to: 43.6))
        XCTAssertTrue(BulkServerQueuePolicy.isMeaningfulProgress(from: 43, to: 47))
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
}

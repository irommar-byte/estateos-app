import MediaPlayer
import XCTest
@testable import EOSMusic

final class PlaybackIdentityTests: XCTestCase {
    func testHydrateBDoesNotPublishNowPlayingA() {
        let a = PlaybackItemIdentity(sessionGeneration: 1, queueIndex: 0, transitionID: UUID())
        let b = PlaybackItemIdentity(sessionGeneration: 1, queueIndex: 1, transitionID: UUID())
        XCTAssertFalse(PlaybackIdentityGate.shouldPublishNowPlaying(captured: a, current: b))
    }

    func testDelayedHydrateAAfterSkipToBIsIgnored() {
        let first = PlaybackItemIdentity(sessionGeneration: 3, queueIndex: 4, transitionID: UUID())
        let skipped = PlaybackItemIdentity(sessionGeneration: 3, queueIndex: 5, transitionID: UUID())
        XCTAssertFalse(PlaybackIdentityGate.shouldPublishNowPlaying(captured: first, current: skipped))
        XCTAssertTrue(PlaybackIdentityGate.shouldPublishNowPlaying(captured: skipped, current: skipped))
    }

    func testNaturalAdvanceUsesNewIdentity() {
        let before = PlaybackItemIdentity(sessionGeneration: 2, queueIndex: 0, transitionID: UUID())
        let after = PlaybackItemIdentity(sessionGeneration: 2, queueIndex: 1, transitionID: UUID())
        XCTAssertNotEqual(before, after)
        XCTAssertEqual(after.queueIndex, 1)
    }

    func testDuplicateTrackIDStillNeedsMatchingIdentity() {
        let first = PlaybackItemIdentity(sessionGeneration: 1, queueIndex: 0, transitionID: UUID())
        let duplicate = PlaybackItemIdentity(sessionGeneration: 1, queueIndex: 2, transitionID: UUID())
        XCTAssertFalse(PlaybackIdentityGate.shouldPublishNowPlaying(captured: first, current: duplicate))
    }
}

final class NowPlayingInfoBuilderTests: XCTestCase {
    func testBuilderStartsFromEmptyDictionary() {
        let info = NowPlayingInfoBuilder.make(
            title: "KOLEJNA NOC",
            artist: "Wac Toja",
            album: "Album",
            duration: 180,
            elapsed: 12,
            isPlaying: true,
            queueIndex: 2,
            queueCount: 10,
            persistentSeed: "track-1",
            collectionPersistentSeed: "folder-1",
            externalContentIdentifier: "ext-1",
            artwork: nil
        )
        XCTAssertEqual(info[MPMediaItemPropertyTitle] as? String, "KOLEJNA NOC")
        XCTAssertEqual(info[MPMediaItemPropertyArtist] as? String, "Wac Toja")
        XCTAssertEqual(info[MPMediaItemPropertyAlbumTitle] as? String, "Album")
        XCTAssertEqual(info[MPNowPlayingInfoPropertyPlaybackQueueIndex] as? Int, 2)
        XCTAssertEqual(info[MPNowPlayingInfoPropertyPlaybackQueueCount] as? Int, 10)
        XCTAssertNil(info["legacy-title"])
        XCTAssertFalse((info[MPMediaItemPropertyArtist] as? String)?.contains("losowo") == true)
        XCTAssertFalse((info[MPMediaItemPropertyArtist] as? String)?.contains("powtórz") == true)
    }
}

final class AudioLeasePolicyTests: XCTestCase {
    func testOwnCategoryChangeIsIgnoredDuringCapture() {
        XCTAssertTrue(AudioSessionLeasePolicy.shouldIgnoreOwnCategoryChange(current: .shazamCapture))
        XCTAssertFalse(AudioSessionLeasePolicy.shouldIgnoreOwnCategoryChange(current: .musicPlayback))
    }

    func testMicrophoneRequiresLiveActivityAndPermission() {
        XCTAssertTrue(AudioSessionLeasePolicy.canStartMicrophone(hasLiveActivity: true, permissionGranted: true))
        XCTAssertFalse(AudioSessionLeasePolicy.canStartMicrophone(hasLiveActivity: false, permissionGranted: true))
        XCTAssertFalse(AudioSessionLeasePolicy.canStartMicrophone(hasLiveActivity: true, permissionGranted: false))
    }
}

final class ShazamReducerTests: XCTestCase {
    func testDoubleTapKeepsSingleOperation() {
        var state = ShazamReducerState()
        let first = UUID()
        XCTAssertTrue(state.begin(first))
        XCTAssertFalse(state.begin(UUID()))
        XCTAssertEqual(state.operationId, first)
        XCTAssertEqual(state.message, "Już słucham")
    }

    func testFirstEarlyMatchIsNotAccepted() {
        XCTAssertFalse(ShazamMatchConfirmPolicy.shouldConsiderMatch(elapsed: 0.4))
        XCTAssertFalse(
            ShazamMatchConfirmPolicy.shouldAccept(elapsed: 2.0, agreeingCount: 2, hasCandidate: true)
        )
    }

    func testSecondAgreeingMatchAfterMinimumListenIsAccepted() {
        let first = ShazamMatchConfirmPolicy.Candidate(
            title: "KOLEJNA NOC",
            artist: "Wac Toja",
            appleMusicID: "144",
            isrc: ""
        )
        let second = ShazamMatchConfirmPolicy.Candidate(
            title: "KOLEJNA NOC",
            artist: "Wac Toja",
            appleMusicID: "144",
            isrc: ""
        )
        let applied = ShazamMatchConfirmPolicy.applyIncoming(current: first, incoming: second, agreeingCount: 1)
        XCTAssertEqual(applied.agreeingCount, 2)
        XCTAssertTrue(
            ShazamMatchConfirmPolicy.shouldAccept(elapsed: 5.2, agreeingCount: applied.agreeingCount, hasCandidate: true)
        )
    }

    func testLaterDifferentMatchReplacesEarlyGuess() {
        let early = ShazamMatchConfirmPolicy.Candidate(
            title: "Labirynt",
            artist: "Wac Toja",
            appleMusicID: "111",
            isrc: ""
        )
        let later = ShazamMatchConfirmPolicy.Candidate(
            title: "KOLEJNA NOC",
            artist: "Wac Toja",
            appleMusicID: "333",
            isrc: ""
        )
        let applied = ShazamMatchConfirmPolicy.applyIncoming(current: early, incoming: later, agreeingCount: 1)
        XCTAssertEqual(applied.candidate.title, "KOLEJNA NOC")
        XCTAssertEqual(applied.agreeingCount, 1)
        XCTAssertFalse(
            ShazamMatchConfirmPolicy.shouldAccept(elapsed: 5.2, agreeingCount: 1, hasCandidate: true)
        )
    }

    func testTimeoutCancelsMatcherForSameOperation() {
        var state = ShazamReducerState()
        let id = UUID()
        XCTAssertTrue(state.begin(id))
        state.timeout(id: id)
        XCTAssertEqual(state.phase, .failed)
        XCTAssertEqual(state.message, "Nie rozpoznano")
    }

    func testArtistIdIsNotUsedAsTrackIdentity() {
        let songs = [
            SearchResultItem.catalogStub(
                title: "Labirynt",
                url: "https://music.apple.com/artist/111",
                artist: "Wac Toja"
            )
        ]
        XCTAssertNil(
            ShazamCatalogMatcher.bestSong(
                title: "KOLEJNA NOC",
                artist: "Wac Toja",
                appleMusicID: "111",
                songs: songs
            )
        )
    }
}

final class ControlIntentPolicyTests: XCTestCase {
    func testDesiredPlayAndFavoriteAreIdempotent() {
        XCTAssertEqual(try ControlIntentPolicy.playPauseOutcome(desired: true, isPlaying: true, hasTrack: true, isLoggedIn: true).get(), true)
        XCTAssertEqual(try ControlIntentPolicy.favoriteOutcome(desired: false, isFavorite: false, hasTrack: true, isLoggedIn: true).get(), false)
    }

    func testMissingEngineOrLoginReturnsError() {
        XCTAssertThrowsError(try ControlIntentPolicy.playPauseOutcome(desired: true, isPlaying: false, hasTrack: false, isLoggedIn: true).get())
        XCTAssertThrowsError(try ControlIntentPolicy.favoriteOutcome(desired: true, isFavorite: false, hasTrack: true, isLoggedIn: false).get())
    }
}

final class DownloadQueuePolicyTests: XCTestCase {
    func testOneListIsOneEnqueueAndOneBatch() {
        XCTAssertEqual(ServerOwnedQueuePolicy.enqueueOnce(itemCount: 144).calls, 1)
        XCTAssertEqual(ServerOwnedQueuePolicy.enqueueOnce(itemCount: 144).batches, 1)
    }

    func testRevisionCannotRewindProgress() {
        XCTAssertFalse(DownloadQueueRevision.accept(current: 5, incoming: 4, incomingProgress: 0.9, currentProgress: 0.4))
        XCTAssertTrue(DownloadQueueRevision.accept(current: 5, incoming: 6, incomingProgress: 0.5, currentProgress: 0.4))
        XCTAssertFalse(DownloadQueueRevision.accept(current: 5, incoming: 5, incomingProgress: 0.2, currentProgress: 0.4))
    }

    func testCancelAndServerAutonomyFlags() {
        XCTAssertTrue(ServerOwnedQueuePolicy.phoneMaySleepWhileServerContinues())
        XCTAssertTrue(ServerOwnedQueuePolicy.cancelRemovesActiveAndPending())
    }

    func testMissingServerBatchFallsBackToPhoneAcquire() {
        XCTAssertTrue(ServerOwnedQueuePolicy.shouldFallBackToPhoneAcquire(didEnqueue: false, batchId: nil))
        XCTAssertTrue(ServerOwnedQueuePolicy.shouldFallBackToPhoneAcquire(didEnqueue: true, batchId: nil))
        XCTAssertTrue(ServerOwnedQueuePolicy.shouldFallBackToPhoneAcquire(didEnqueue: true, batchId: ""))
        XCTAssertTrue(ServerOwnedQueuePolicy.shouldFallBackToPhoneAcquire(didEnqueue: true, batchId: "   "))
        XCTAssertFalse(ServerOwnedQueuePolicy.shouldFallBackToPhoneAcquire(didEnqueue: true, batchId: "batch-1"))
    }

    func testIdleAcceptedBatchAlsoFallsBack() {
        XCTAssertTrue(
            ServerOwnedQueuePolicy.shouldAbandonIdleServerBatch(
                secondsWaiting: 12,
                completed: 0,
                hasActiveRemoteJob: false
            )
        )
        XCTAssertFalse(
            ServerOwnedQueuePolicy.shouldAbandonIdleServerBatch(
                secondsWaiting: 12,
                completed: 0,
                hasActiveRemoteJob: true
            )
        )
        XCTAssertFalse(
            ServerOwnedQueuePolicy.shouldAbandonIdleServerBatch(
                secondsWaiting: 11,
                completed: 0,
                hasActiveRemoteJob: false
            )
        )
    }
}

final class AppGroupStoreTests: XCTestCase {
    func testAtomicWriteAndStaleSnapshot() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        await EOSAppGroupStore.shared.setOverrideDirectory(directory)
        var snapshot = EOSControlSnapshot.empty
        snapshot.title = "KOLEJNA NOC"
        snapshot.hasCurrentTrack = true
        snapshot.updatedAt = Date()
        snapshot.schemaVersion = EOSAppGroup.schemaVersion
        try await EOSAppGroupStore.shared.save(snapshot)
        let loaded = await EOSAppGroupStore.shared.load()
        XCTAssertEqual(loaded.title, "KOLEJNA NOC")
        XCTAssertFalse(loaded.isStale)

        snapshot.updatedAt = Date().addingTimeInterval(-EOSAppGroup.staleTTL - 10)
        try await EOSAppGroupStore.shared.save(snapshot)
        let stale = await EOSAppGroupStore.shared.load()
        XCTAssertTrue(stale.isStale)
        XCTAssertEqual(stale.displayTitle, "EOS Music")

        snapshot.schemaVersion = 0
        snapshot.updatedAt = Date()
        try await EOSAppGroupStore.shared.save(snapshot)
        let migrated = await EOSAppGroupStore.shared.load()
        XCTAssertEqual(migrated.schemaVersion, EOSAppGroup.schemaVersion)
        await EOSAppGroupStore.shared.setOverrideDirectory(nil)
    }
}

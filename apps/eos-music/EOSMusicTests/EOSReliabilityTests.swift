import AVFoundation
import QuartzCore
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
        XCTAssertTrue(
            ShazamMatchConfirmPolicy.shouldAccept(
                elapsed: 2.3,
                agreeingCount: 1,
                hasCandidate: true,
                isStableIdentity: true
            )
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

    func testPlaylistNeverFallsBackToPhoneAcquire() {
        XCTAssertFalse(ServerOwnedQueuePolicy.shouldFallBackToPhoneAcquire(didEnqueue: false, batchId: nil))
        XCTAssertFalse(ServerOwnedQueuePolicy.shouldFallBackToPhoneAcquire(didEnqueue: true, batchId: nil))
        XCTAssertFalse(ServerOwnedQueuePolicy.shouldFallBackToPhoneAcquire(didEnqueue: true, batchId: ""))
        XCTAssertFalse(ServerOwnedQueuePolicy.shouldFallBackToPhoneAcquire(didEnqueue: true, batchId: "batch-1"))
    }

    func testIdleServerBatchKeepsWaiting() {
        XCTAssertFalse(
            ServerOwnedQueuePolicy.shouldAbandonIdleServerBatch(
                secondsWaiting: 12,
                completed: 0,
                hasActiveRemoteJob: false
            )
        )
        XCTAssertFalse(
            ServerOwnedQueuePolicy.shouldAbandonIdleServerBatch(
                secondsWaiting: 120,
                completed: 0,
                hasActiveRemoteJob: true
            )
        )
    }

    func testExistingBatchIsNotReenqueued() {
        XCTAssertTrue(ServerOwnedQueuePolicy.shouldReenqueueExistingBatch(nil))
        XCTAssertTrue(ServerOwnedQueuePolicy.shouldReenqueueExistingBatch(""))
        XCTAssertFalse(ServerOwnedQueuePolicy.shouldReenqueueExistingBatch("batch-1"))
    }

    func testPlusSessionDoesNotInheritLeftoverPlaylist() {
        XCTAssertFalse(
            ServerOwnedQueuePolicy.shouldAdoptRemoteBatch(plusSessionActive: true, alreadyOwnsStickyItems: false)
        )
        XCTAssertFalse(
            ServerOwnedQueuePolicy.shouldAdoptRemoteBatch(plusSessionActive: true, alreadyOwnsStickyItems: true)
        )
        XCTAssertFalse(
            ServerOwnedQueuePolicy.shouldAdoptRemoteBatch(plusSessionActive: false, alreadyOwnsStickyItems: false)
        )
        XCTAssertTrue(
            ServerOwnedQueuePolicy.shouldAdoptRemoteBatch(plusSessionActive: false, alreadyOwnsStickyItems: true)
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

// MARK: - Poprawki 2026-10: „Zagraj jako następny”, analizator audio

final class PlayNextQueueEditTests: XCTestCase {
    func testInsertNewTrackAfterCurrent() {
        let r = PlayNextQueueEdit.apply(playOrder: [0, 1, 2, 3], cursor: 1, inserting: [4])
        XCTAssertEqual(r.playOrder, [0, 1, 4, 2, 3])
        XCTAssertEqual(r.cursor, 1)
    }

    func testTrackAlreadyLaterInQueueMovesUpWithoutDuplicate() {
        let r = PlayNextQueueEdit.apply(playOrder: [0, 1, 2, 3], cursor: 0, inserting: [3])
        XCTAssertEqual(r.playOrder, [0, 3, 1, 2])
        XCTAssertEqual(r.cursor, 0)
    }

    func testTrackFromBeforeCurrentKeepsCursorOnSameSong() {
        // Wcześniej usunięcie utworu sprzed bieżącego przesuwało wskaźnik na zły utwór.
        let r = PlayNextQueueEdit.apply(playOrder: [0, 1, 2, 3], cursor: 2, inserting: [0])
        XCTAssertEqual(r.playOrder, [1, 2, 0, 3])
        XCTAssertEqual(r.playOrder[r.cursor], 2)
    }

    func testCurrentTrackIsNotDuplicated() {
        let r = PlayNextQueueEdit.apply(playOrder: [0, 1, 2], cursor: 1, inserting: [1, 2])
        XCTAssertEqual(r.playOrder, [0, 1, 2])
        XCTAssertEqual(r.playOrder[r.cursor], 1)
    }

    func testMultipleTracksKeepTheirOrder() {
        let r = PlayNextQueueEdit.apply(playOrder: [0, 1, 2, 3, 4], cursor: 0, inserting: [4, 3])
        XCTAssertEqual(r.playOrder, [0, 4, 3, 1, 2])
    }

    @MainActor
    func testEngineInsertNextWithTrackAlreadyInQueueDoesNotCrash() {
        let tracks = (0..<4).map { i in
            MusicPlaybackTrack(
                openedLocalFile: URL(fileURLWithPath: "/tmp/eos-test-\(i).mp3"),
                libraryURL: "eosmusic://opened/test-insert-\(i)",
                title: "Utwór \(i)"
            )
        }
        let engine = MusicPlaybackEngine(session: MusicPlaybackSession(queue: tracks, startIndex: 0, folderId: nil, folderName: "Test"))
        engine.insertNext([tracks[3]])
        XCTAssertEqual(engine.playbackQueueRows.map(\.track.title), ["Utwór 0", "Utwór 3", "Utwór 1", "Utwór 2"])
    }
}

final class PlayerAudioAnalyzerRealtimeTests: XCTestCase {
    func testConsumeProducesSpectrumFrameQuickly() {
        let analyzer = PlayerAudioAnalyzer()
        analyzer.setAnalysisEnabled(true)
        analyzer.setSpectrumEnabled(true)
        analyzer.setPublishRate(fps: 30)
        var frames = 0
        var lastFrame: MusicPlaybackEngine.AudioReactiveFrame?
        analyzer.setPublishHandler { frame in
            frames += 1
            lastFrame = frame
        }

        let frameCount = 1024
        let channels = 2
        var samples = [Float](repeating: 0, count: frameCount * channels)
        var phase: Float = 0
        let iterations = 2000
        var worst: Double = 0
        let started = CACurrentMediaTime()
        for _ in 0..<iterations {
            for i in 0..<frameCount {
                let v = 0.4 * sinf(phase) + 0.2 * sinf(phase * 7.3)
                samples[i * 2] = v
                samples[i * 2 + 1] = v
                phase += 2 * .pi * 110 / 44_100
            }
            let t0 = CACurrentMediaTime()
            samples.withUnsafeMutableBufferPointer { bp in
                var list = AudioBufferList(
                    mNumberBuffers: 1,
                    mBuffers: AudioBuffer(
                        mNumberChannels: UInt32(channels),
                        mDataByteSize: UInt32(bp.count * MemoryLayout<Float>.size),
                        mData: UnsafeMutableRawPointer(bp.baseAddress)
                    )
                )
                analyzer.consume(&list, frames: CMItemCount(frameCount), time: .zero)
            }
            worst = max(worst, CACurrentMediaTime() - t0)
            usleep(200)
        }
        let avgMicros = (CACurrentMediaTime() - started) / Double(iterations) * 1_000_000
        print("EOS_BENCH analyzer avg_loop_us=\(Int(avgMicros)) worst_consume_us=\(Int(worst * 1_000_000)) frames=\(frames)")
        XCTAssertGreaterThan(frames, 0)
        XCTAssertGreaterThan(lastFrame?.spectrumBands.prefix(24).max() ?? 0, 0)
        // Bufor 1024 próbek to ~23 ms dźwięku — analiza musi być rzędy wielkości szybsza.
        XCTAssertLessThan(worst, 0.005)
    }
}

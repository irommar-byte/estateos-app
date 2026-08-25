import XCTest
@testable import EOSMusic

final class BluetoothNowPlayingQueueTests: XCTestCase {
    func testIdentifiersStayInPlaylistOrder() {
        let ids = BluetoothNowPlayingQueue.nowPlayingIdentifiers(trackCount: 5)
        XCTAssertEqual(ids, ["eos-q-0", "eos-q-1", "eos-q-2", "eos-q-3", "eos-q-4"])
    }

    func testIdentifiersCap() {
        let ids = BluetoothNowPlayingQueue.nowPlayingIdentifiers(trackCount: 200, cap: 8)
        XCTAssertEqual(ids.count, 8)
        XCTAssertEqual(ids.first, "eos-q-0")
        XCTAssertEqual(ids.last, "eos-q-7")
    }

    func testEmptyQueueHasNoIdentifiers() {
        XCTAssertTrue(BluetoothNowPlayingQueue.nowPlayingIdentifiers(trackCount: 0).isEmpty)
    }

    func testStructureSignatureIgnoresCurrentTrack() {
        let tracks = ["a", "b", "c"]
        let playingFirst = BluetoothNowPlayingQueue.structureSignature(layout: "nested", trackIDs: tracks)
        let playingLast = BluetoothNowPlayingQueue.structureSignature(layout: "nested", trackIDs: tracks)
        XCTAssertEqual(playingFirst, playingLast)
        let shuffled = BluetoothNowPlayingQueue.structureSignature(layout: "nested", trackIDs: ["c", "a", "b"])
        XCTAssertNotEqual(playingFirst, shuffled)
    }

    func testActiveQueueNeverTrimmedToNBTCountOfOne() {
        let count = BluetoothNowPlayingQueue.childCount(
            requested: 24,
            isActiveQueueTracks: true,
            limitsEnforced: true,
            enforcedCount: 1,
            maxItems: 100
        )
        XCTAssertEqual(count, 24)
    }

    func testLibraryHonorsSensibleCarLimit() {
        let count = BluetoothNowPlayingQueue.childCount(
            requested: 40,
            isActiveQueueTracks: false,
            limitsEnforced: true,
            enforcedCount: 12,
            maxItems: 100
        )
        XCTAssertEqual(count, 12)
    }

    func testBrowseCapIgnoresTinyNBTLimit() {
        XCTAssertEqual(
            BluetoothNowPlayingQueue.browseItemCap(limitsEnforced: true, enforcedCount: 1),
            BluetoothNowPlayingQueue.defaultMaxBrowseItems
        )
    }

    func testIdentifierChangeDetection() {
        let a = ["eos-q-0", "eos-q-1"]
        XCTAssertFalse(BluetoothNowPlayingQueue.identifiersChanged(previous: a, next: a))
        XCTAssertTrue(BluetoothNowPlayingQueue.identifiersChanged(previous: a, next: ["eos-q-0"]))
    }
}

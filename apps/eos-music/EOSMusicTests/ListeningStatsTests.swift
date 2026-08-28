import XCTest
@testable import EOSMusic

final class ListeningStatsTests: XCTestCase {
    func testQualifiesAtThirtySeconds() {
        XCTAssertTrue(ListeningStatsPolicy.qualifies(accumulated: 30, duration: 200))
        XCTAssertFalse(ListeningStatsPolicy.qualifies(accumulated: 12, duration: 200))
    }

    func testQualifiesShortTrackAtHalf() {
        XCTAssertTrue(ListeningStatsPolicy.qualifies(accumulated: 12, duration: 20))
        XCTAssertFalse(ListeningStatsPolicy.qualifies(accumulated: 4, duration: 20))
    }

    func testPolishPlayCount() {
        XCTAssertEqual(ListeningStatsPolicy.playCountLabel(1), "1 odtworzenie")
        XCTAssertEqual(ListeningStatsPolicy.playCountLabel(2), "2 odtworzenia")
        XCTAssertEqual(ListeningStatsPolicy.playCountLabel(5), "5 odtworzeń")
        XCTAssertEqual(ListeningStatsPolicy.playCountLabel(22), "22 odtworzenia")
        XCTAssertEqual(ListeningStatsPolicy.playCountLabel(12), "12 odtworzeń")
        XCTAssertEqual(ListeningStatsPolicy.compactPlayCount(47), "47×")
    }

    func testTop50OrdersByPlayCount() {
        let records = [
            record(url: "a", count: 3, last: 10),
            record(url: "b", count: 9, last: 1),
            record(url: "c", count: 9, last: 50)
        ]
        let entries = SmartPlaylistBuilder.entries(kind: .top50, records: records, library: [])
        XCTAssertEqual(entries.map(\.track.url), ["c", "b", "a"])
        XCTAssertEqual(entries.first?.playCount, 9)
    }

    func testOnFireUsesRecentWindow() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let recent = now.timeIntervalSince1970 - 3 * 24 * 3600
        let old = now.timeIntervalSince1970 - 80 * 24 * 3600
        let records = [
            record(url: "hot", count: 2, last: recent, stamps: [recent, recent - 100]),
            record(url: "cold", count: 40, last: old, stamps: [old])
        ]
        let entries = SmartPlaylistBuilder.entries(kind: .onFire, records: records, library: [], now: now)
        XCTAssertEqual(entries.map(\.track.url), ["hot"])
        XCTAssertEqual(entries.first?.playCount, 2)
    }

    func testRediscoverPrefersStalePlaysThenNeverPlayed() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let stale = now.timeIntervalSince1970 - 60 * 24 * 3600
        let records = [record(url: "old-hit", count: 8, last: stale, stamps: [stale])]
        let library = [
            MusicTrack(folderId: "f", url: "old-hit", title: "Old"),
            MusicTrack(folderId: "f", url: "never", title: "Never")
        ]
        let entries = SmartPlaylistBuilder.entries(kind: .rediscover, records: records, library: library, now: now)
        XCTAssertEqual(entries.map(\.track.url), ["old-hit", "never"])
        XCTAssertEqual(entries[0].playCount, 8)
        XCTAssertEqual(entries[1].playCount, 0)
    }

    func testEveningRanksEveningCounts() {
        var night = record(url: "night", count: 4, last: 20)
        night.eveningPlayCount = 4
        var day = record(url: "day", count: 20, last: 30)
        day.eveningPlayCount = 0
        let entries = SmartPlaylistBuilder.entries(kind: .evening, records: [night, day], library: [])
        XCTAssertEqual(entries.map(\.track.url), ["night"])
        XCTAssertEqual(entries.first?.playCount, 4)
    }

    private func record(
        url: String,
        count: Int,
        last: TimeInterval,
        stamps: [TimeInterval]? = nil
    ) -> ListenRecord {
        ListenRecord(
            url: url,
            title: url,
            artist: nil,
            album: nil,
            thumbnail: nil,
            duration: 180,
            folderId: "f",
            playCount: count,
            lastPlayedAt: last,
            firstPlayedAt: last,
            totalListenSeconds: Double(count * 40),
            eveningPlayCount: 0,
            playTimestamps: stamps ?? Array(repeating: last, count: count)
        )
    }
}

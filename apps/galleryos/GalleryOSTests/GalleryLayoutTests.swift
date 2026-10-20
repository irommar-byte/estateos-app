import XCTest
@testable import GalleryOS

final class GalleryLayoutTests: XCTestCase {
    func testMosaicFillsWidthAndKeepsLastRowShort() {
        let frames = PhotoMosaic.frames(aspects: [1, 1, 1, 0.6], width: 302, targetHeight: 90, spacing: 2)
        XCTAssertEqual(frames.count, 4)
        let firstRow = frames.prefix(3)
        XCTAssertEqual(firstRow.map(\.minY).allSatisfy { abs($0 - firstRow[0].minY) < 0.1 }, true)
        XCTAssertEqual(firstRow.last!.maxX, 302, accuracy: 0.6)
        XCTAssertLessThanOrEqual(frames[3].height, 90.1)
        XCTAssertLessThan(frames[3].maxX, 302)
    }

    func testSinglePortraitIsNotStretched() {
        let frames = PhotoMosaic.frames(aspects: [0.7], width: 390, targetHeight: 140, spacing: 2)
        XCTAssertEqual(frames[0].height, 140, accuracy: 0.1)
        XCTAssertLessThan(frames[0].width, 200)
    }

    func testDaysAreOldestFirstWithTodayTitle() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = Date(timeIntervalSince1970: 1_791_936_000) // 2026-10-14 00:00 UTC
        let today = PhotoRef.sample(id: "b", created: now.addingTimeInterval(3_600))
        let yesterday = PhotoRef.sample(id: "a", created: now.addingTimeInterval(-86_400))
        let days = PhotoGrouping.days(from: [today, yesterday], calendar: calendar, now: now)
        XCTAssertEqual(days.map(\.title), ["Wczoraj", "Dzisiaj"])
        XCTAssertEqual(days.last?.photos.first?.id, "b")
    }

    /// Building a title used to allocate a DateFormatter per day and froze launch long enough for iOS to kill the app.
    func testALongLibraryGetsDayTitlesQuickly() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let start = Date(timeIntervalSince1970: 1_600_000_000)
        let photos = (0..<1200).map { index in
            PhotoRef.sample(id: "\(index)", created: start.addingTimeInterval(Double(index) * 86_400))
        }
        let began = Date()
        let days = PhotoGrouping.days(from: photos, calendar: calendar, now: start.addingTimeInterval(86_400 * 1300))
        XCTAssertEqual(days.count, 1200)
        XCTAssertFalse(days[10].title.isEmpty)
        XCTAssertLessThan(Date().timeIntervalSince(began), 1.5)
    }

    func testPolishCount() {
        XCTAssertEqual(PhotoFormat.noun(1), "zdjęcie")
        XCTAssertEqual(PhotoFormat.noun(2), "zdjęcia")
        XCTAssertEqual(PhotoFormat.noun(5), "zdjęć")
        XCTAssertEqual(PhotoFormat.noun(12), "zdjęć")
        XCTAssertEqual(PhotoFormat.noun(22), "zdjęcia")
    }

    func testRedDoesNotNarrowCars() {
        let car = PhotoRef.sample(id: "car", created: .now)
        let beach = PhotoRef.sample(id: "beach", created: .now)
        let labels = ["car": ["car", "automobile"], "beach": ["beach"]]
        let cars = ObjectSearch.match(photos: [car, beach], labels: labels, query: "czerwony samochód")
        XCTAssertEqual(cars, ["car"])
        XCTAssertTrue(ObjectSearch.match(photos: [car, beach], labels: labels, query: "czerwony").isEmpty)
    }

    func testVideoShortcut() {
        var video = PhotoRef.sample(id: "v", created: .now)
        video.traits.insert(.video)
        let photo = PhotoRef.sample(id: "p", created: .now)
        XCTAssertEqual(ObjectSearch.match(photos: [video, photo], labels: [:], query: "wideo"), ["v"])
    }
}

private extension PhotoRef {
    static func sample(id: String, created: Date) -> PhotoRef {
        PhotoRef(
            id: id,
            created: created,
            pixelWidth: 1000,
            pixelHeight: 1000,
            traits: [],
            isFavorite: false,
            latitude: nil,
            longitude: nil,
            duration: 0
        )
    }
}

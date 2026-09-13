import XCTest
@testable import ParagonOS

final class BottleReturnTests: XCTestCase {
    func testBrandIDs() {
        XCTAssertEqual(BottleReturnBrand.id(from: "Żabka"), "zabka")
        XCTAssertEqual(BottleReturnBrand.id(from: "LIDL"), "lidl")
        XCTAssertEqual(BottleReturnBrand.id(from: "Biedronka"), "biedronka")
        XCTAssertEqual(BottleReturnBrand.displayName("kaufland", fallback: "X"), "Kaufland")
    }

    func testOpeningHoursAlwaysOpen() {
        let status = OpeningHours.display(from: "24/7")
        XCTAssertEqual(status.isOpen, true)
        XCTAssertTrue(status.label.contains("Otwarte"))
    }

    func testOpeningHoursWeekdayRange() {
        var calendar = OpeningHours.warsaw
        var components = DateComponents()
        components.year = 2026
        components.month = 9
        components.day = 14 // Monday
        components.hour = 10
        components.minute = 0
        let monday = calendar.date(from: components)!
        let interval = OpeningHours.interval(from: "Mo-Sa 06:00-22:00", on: monday, calendar: calendar)
        XCTAssertNotNil(interval)
        XCTAssertEqual(calendar.component(.hour, from: interval!.start), 6)
        XCTAssertEqual(calendar.component(.hour, from: interval!.end), 22)
        let status = OpeningHours.display(from: "Mo-Sa 06:00-22:00", at: monday)
        XCTAssertEqual(status.isOpen, true)
    }

    func testDistanceFormatMetersAndKilometers() {
        XCTAssertEqual(DistanceFormat.string(250), "250 m")
        XCTAssertEqual(DistanceFormat.string(999), "999 m")
        XCTAssertEqual(DistanceFormat.string(1000), "1 km")
        XCTAssertEqual(DistanceFormat.string(1500), "1,5 km")
        XCTAssertEqual(DistanceFormat.string(12_400), "12 km")
    }
}

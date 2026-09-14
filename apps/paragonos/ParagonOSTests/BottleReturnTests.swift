import CoreLocation
import MapKit
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

    func testDedupePrefersMachineOverStore() {
        let store = BottleReturnPoint(
            id: "s",
            brand: "Lidl",
            brandID: "lidl",
            name: "Lidl",
            address: "",
            city: "Gdańsk",
            postcode: "",
            latitude: 54.35,
            longitude: 18.65,
            hoursRaw: "",
            acceptsPET: true,
            acceptsCans: true,
            acceptsGlass: true,
            kind: .store
        )
        let machine = BottleReturnPoint(
            id: "m",
            brand: "Lidl",
            brandID: "lidl",
            name: "Lidl",
            address: "Grunwaldzka 1",
            city: "Gdańsk",
            postcode: "",
            latitude: 54.3501,
            longitude: 18.6501,
            hoursRaw: "Mo-Su 06:00-22:00",
            acceptsPET: true,
            acceptsCans: true,
            acceptsGlass: true,
            kind: .machine
        )
        let merged = BottleReturnStore.dedupe([store, machine])
        XCTAssertEqual(merged.count, 1)
        XCTAssertEqual(merged.first?.kind, .machine)
        XCTAssertEqual(merged.first?.address, "Grunwaldzka 1")
        XCTAssertFalse(merged.first?.hoursRaw.isEmpty ?? true)
    }

    func testViewportKeepsPointsAwayFromCenterWithoutCap() {
        let box = MKRegionBox(
            center: CLLocationCoordinate2D(latitude: 52.23, longitude: 21.01),
            latitudeDelta: 0.2,
            longitudeDelta: 0.2
        )
        XCTAssertTrue(box.contains(CLLocationCoordinate2D(latitude: 52.23, longitude: 21.01)))
        XCTAssertTrue(box.padded.latitudeDelta > box.latitudeDelta)
        XCTAssertTrue(box.showsIndividualPins)
        let zoomedOut = MKRegionBox(
            center: box.center,
            latitudeDelta: 3,
            longitudeDelta: 3
        )
        XCTAssertFalse(zoomedOut.showsIndividualPins)
    }

    func testOSMQueryDoesNotPullEverySupermarket() {
        XCTAssertFalse(BottleReturnStore.osmQueryContainsShops("nwr[\"vending\"=\"bottle_return\"]"))
        XCTAssertTrue(BottleReturnStore.osmQueryContainsShops("nwr[\"shop\"][\"brand\"~\"Biedronka\"]"))
    }

    func testDistanceFormat() {
        XCTAssertEqual(DistanceFormat.string(250), "250 m")
        XCTAssertEqual(DistanceFormat.string(999), "999 m")
        XCTAssertEqual(DistanceFormat.string(1000), "1 km")
        XCTAssertEqual(DistanceFormat.string(1500), "1,5 km")
        XCTAssertEqual(DistanceFormat.string(12_400), "12 km")
    }
}

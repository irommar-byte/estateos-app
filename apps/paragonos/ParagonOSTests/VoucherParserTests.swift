import XCTest
@testable import ParagonOS

final class VoucherParserTests: XCTestCase {
    func testParsesBiedronkaAmountDateAndExpiry() throws {
        let calendar = Self.warsawCalendar()
        let catalog = try Self.catalog()
        let lines = [
            "BIEDRONKA",
            "Zwrot kaucji 12,50 zł",
            "Data 12.09.2026",
            "Ważny do 12.10.2026",
            "Nr 88345120"
        ]
        let draft = VoucherParser.parse(
            lines: lines,
            barcodes: [DetectedBarcode(payload: "883451201234", symbology: .code128)],
            now: Self.date(2026, 9, 12, calendar: calendar),
            calendar: calendar,
            catalog: catalog
        )
        XCTAssertEqual(draft.retailerID, "biedronka")
        XCTAssertEqual(draft.amount, 12.50, accuracy: 0.001)
        XCTAssertEqual(draft.ticketNumber, "88345120")
        XCTAssertEqual(draft.barcodePayload, "883451201234")
        XCTAssertEqual(draft.barcodeSymbology, .code128)
        XCTAssertNotNil(draft.expiresAt)
        XCTAssertEqual(calendar.startOfDay(for: draft.expiresAt!), Self.date(2026, 10, 12, calendar: calendar))
    }

    func testParsesLidlAndPrefersKaucjaAmount() throws {
        let calendar = Self.warsawCalendar()
        let catalog = try Self.catalog()
        let lines = [
            "Lidl",
            "Kupon kaucyjny 8.00 PLN",
            "12/09/2026"
        ]
        let draft = VoucherParser.parse(
            lines: lines,
            now: Self.date(2026, 9, 12, calendar: calendar),
            calendar: calendar,
            catalog: catalog
        )
        XCTAssertEqual(draft.retailerID, "lidl")
        XCTAssertEqual(draft.amount, 8.0, accuracy: 0.001)
    }

    func testKauflandCrumbledReceiptDoesNotTreatDateAsAmount() throws {
        let calendar = Self.warsawCalendar()
        let catalog = try Self.catalog()
        let lines = [
            "Kautiond Polska Markety",
            "NIP 8982387273",
            "Kaufiand",
            "Bon 27533",
            "1,00zł",
            "1 x Puszka 0.50zl",
            "0,50zł",
            "1,00zł",
            "Bon ważny jest 100 dni od",
            "daty jego wydania.",
            "sob 11.07.2026 - 21.39:57"
        ]
        let draft = VoucherParser.parse(
            lines: lines,
            barcodes: [DetectedBarcode(payload: "96784379081943009000000775381", symbology: .code128)],
            now: Self.date(2026, 9, 12, calendar: calendar),
            calendar: calendar,
            catalog: catalog
        )
        XCTAssertEqual(draft.retailerID, "kaufland")
        XCTAssertEqual(draft.amount, 1.0, accuracy: 0.001)
        XCTAssertNotEqual(draft.amount, 11.07, accuracy: 0.001)
        XCTAssertEqual(draft.ticketNumber, "27533")
        XCTAssertEqual(calendar.startOfDay(for: draft.issuedAt), Self.date(2026, 7, 11, calendar: calendar))
        XCTAssertEqual(draft.expiresAt.map { calendar.startOfDay(for: $0) }, Self.date(2026, 10, 19, calendar: calendar))
        XCTAssertTrue(draft.expiryWasPrinted)
        XCTAssertTrue(draft.issuedWasPrinted)
        XCTAssertTrue(draft.scanIsComplete)
    }

    func testLiveScanWithoutDateIsNotComplete() throws {
        let calendar = Self.warsawCalendar()
        let catalog = try Self.catalog()
        let draft = VoucherParser.parse(
            lines: ["1,00zł", "Bon 27533"],
            barcodes: [DetectedBarcode(payload: "96784379081943009000000775381", symbology: .code128)],
            now: Self.date(2026, 9, 12, calendar: calendar),
            calendar: calendar,
            catalog: catalog
        )
        XCTAssertEqual(draft.amount, 1.0, accuracy: 0.001)
        XCTAssertFalse(draft.issuedWasPrinted)
        XCTAssertFalse(draft.scanIsComplete)
        XCTAssertEqual(calendar.startOfDay(for: draft.issuedAt), Self.date(2026, 9, 12, calendar: calendar))
    }

    func testMergeLiveUsesPhotoIssuedDate() throws {
        let calendar = Self.warsawCalendar()
        let catalog = try Self.catalog()
        let live = VoucherParser.parse(
            lines: ["1,00zł", "Bon 27533"],
            barcodes: [DetectedBarcode(payload: "96784379081943009000000775381", symbology: .code128)],
            now: Self.date(2026, 9, 12, calendar: calendar),
            calendar: calendar,
            catalog: catalog
        )
        let photo = VoucherParser.parse(
            lines: ["Kaufland", "1,00zł", "11.07.2026", "Bon ważny jest 100 dni od daty jego wydania."],
            barcodes: [],
            now: Self.date(2026, 9, 12, calendar: calendar),
            calendar: calendar,
            catalog: catalog
        )
        let merged = VoucherParser.mergeLive(live, photo: photo)
        XCTAssertEqual(merged.retailerID, "kaufland")
        XCTAssertEqual(merged.amount, 1.0, accuracy: 0.001)
        XCTAssertTrue(merged.issuedWasPrinted)
        XCTAssertEqual(calendar.startOfDay(for: merged.issuedAt), Self.date(2026, 7, 11, calendar: calendar))
        XCTAssertEqual(merged.barcodePayload, "96784379081943009000000775381")
        XCTAssertTrue(merged.scanIsComplete)
    }

    func testKauflandMatchesFromNIPTypoWithoutBrandName() throws {
        let catalog = try Self.catalog()
        let policy = VoucherParser.matchRetailer(
            in: "Automat kaucyjny\nNIP 8982387273\nKwota 1,00 zł",
            catalog: catalog
        )
        XCTAssertEqual(policy.id, "kaufland")
    }

    func testStokrotkaPolishMonthDateAndPLNPrefix() throws {
        let calendar = Self.warsawCalendar()
        let catalog = try Self.catalog()
        let lines = [
            "stokrotk.",
            "Stokrotka wskazanych na stronie.",
            "PLN 46.00",
            "9803751578278413029904600743",
            "27x Puszka ALU",
            "13.50",
            "65x Butelka PET",
            "32.50",
            "46.00",
            "Kupon ważny 90 dni",
            "Tomra 70 TriSort",
            "17:50:40",
            "15-LIP-2026"
        ]
        let draft = VoucherParser.parse(
            lines: lines,
            now: Self.date(2026, 9, 12, calendar: calendar),
            calendar: calendar,
            catalog: catalog
        )
        XCTAssertEqual(draft.retailerID, "stokrotka")
        XCTAssertEqual(draft.amount, 46.0, accuracy: 0.001)
        XCTAssertTrue(draft.issuedWasPrinted)
        XCTAssertEqual(calendar.startOfDay(for: draft.issuedAt), Self.date(2026, 7, 15, calendar: calendar))
        XCTAssertEqual(draft.expiresAt.map { calendar.startOfDay(for: $0) }, Self.date(2026, 10, 13, calendar: calendar))
        XCTAssertEqual(draft.barcodePayload, "9803751578278413029904600743")
        XCTAssertTrue(draft.scanIsComplete)
    }

    func testCheckoutCodeFallsBackToLongTicketNumber() {
        XCTAssertEqual(
            CheckoutCode.payload(barcode: "", ticketNumber: "9803751578278413029904600743"),
            "9803751578278413029904600743"
        )
        XCTAssertEqual(CheckoutCode.payload(barcode: "ABC", ticketNumber: "9803751578278413029904600743"), "ABC")
        XCTAssertEqual(CheckoutCode.payload(barcode: "", ticketNumber: "27533"), "")
    }

    func testExpiredVoucherIsFlaggedImmediately() throws {
        let calendar = Self.warsawCalendar()
        let catalog = try Self.catalog()
        let draft = VoucherParser.parse(
            lines: [
                "ALDI Sp. z o. o.",
                "NIP: 1070002973",
                "0,50 zl",
                "Kupon jest wazny 30 dni od daty wydania.",
                "09.39.41  2025-12-01",
                "0114610324251201093940000050"
            ],
            now: Self.date(2026, 9, 12, calendar: calendar),
            calendar: calendar,
            catalog: catalog
        )
        XCTAssertTrue(draft.issuedWasPrinted)
        XCTAssertTrue(draft.isExpired(now: Self.date(2026, 9, 12, calendar: calendar)))
        XCTAssertFalse(draft.isExpired(now: Self.date(2025, 12, 10, calendar: calendar)))
    }

    func testAldiDottedClockIsNotADateAndISODateWins() throws {
        let calendar = Self.warsawCalendar()
        let catalog = try Self.catalog()
        let lines = [
            "ALDI Sp. z o. o.",
            "ul. Niedzwiedziniec 10, 41-506 Chorzow",
            "NIP: 1070002973",
            "BDO: 00006913",
            "Nr bonu0324",
            "0,50 zl",
            "0114610324251201093940000050",
            "0,50 zl",
            "1x Opakowania jednorazowe",
            "Kupon wazny wylacznie w sklepie, w ktorym byl wydany.",
            "Kupon jest wazny 30 dni od daty wydania.",
            "www.aldi.pl/butelkomaty",
            "SN 90560910",
            "09.39.41  2025-12-01"
        ]
        let now = Self.date(2025, 12, 5, calendar: calendar)
        let draft = VoucherParser.parse(
            lines: lines,
            now: now,
            calendar: calendar,
            catalog: catalog
        )
        XCTAssertEqual(draft.retailerID, "aldi")
        XCTAssertEqual(draft.amount, 0.50, accuracy: 0.001)
        XCTAssertTrue(draft.issuedWasPrinted)
        XCTAssertEqual(calendar.startOfDay(for: draft.issuedAt), Self.date(2025, 12, 1, calendar: calendar))
        XCTAssertEqual(draft.expiresAt.map { calendar.startOfDay(for: $0) }, Self.date(2025, 12, 31, calendar: calendar))
        XCTAssertEqual(draft.barcodePayload, "0114610324251201093940000050")
        XCTAssertEqual(draft.ticketNumber, "bonu0324")
        XCTAssertTrue(draft.scanIsComplete)
        let days = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: now),
            to: calendar.startOfDay(for: draft.expiresAt!)
        ).day
        XCTAssertEqual(days, 26)
        XCTAssertLessThan(days ?? 9999, 400)
    }

    func testDottedClockIsRejectedAsCalendarDate() {
        let calendar = Self.warsawCalendar()
        let dates = VoucherParser.parseDates(in: "SN 90560910\n09.39.41  2025-12-01", calendar: calendar)
        XCTAssertEqual(dates.count, 1)
        XCTAssertEqual(dates.first.map { calendar.startOfDay(for: $0) }, Self.date(2025, 12, 1, calendar: calendar))
    }

    func testParsesCompactIsoAndEnglishMonthDates() {
        let calendar = Self.warsawCalendar()
        let compact = VoucherParser.parseDates(in: "Wydano 20251201", calendar: calendar)
        XCTAssertEqual(compact, [Self.date(2025, 12, 1, calendar: calendar)])
        let english = VoucherParser.parseDates(in: "15-Jul-2026", calendar: calendar)
        XCTAssertEqual(english, [Self.date(2026, 7, 15, calendar: calendar)])
        let dottedYearFirst = VoucherParser.parseDates(in: "2025.12.01", calendar: calendar)
        XCTAssertEqual(dottedYearFirst, [Self.date(2025, 12, 1, calendar: calendar)])
    }

    func testUnknownRetailerWithoutPrintedExpiryLeavesPolicyFallback() throws {
        let calendar = Self.warsawCalendar()
        let catalog = try Self.catalog()
        let lines = ["Automat kaucyjny", "Kwota 3,50 zł", "01.02.2026"]
        let draft = VoucherParser.parse(
            lines: lines,
            now: Self.date(2026, 2, 1, calendar: calendar),
            calendar: calendar,
            catalog: catalog
        )
        XCTAssertEqual(draft.retailerID, "unknown")
        XCTAssertEqual(draft.amount, 3.50, accuracy: 0.001)
        XCTAssertNil(draft.expiresAt)
    }

    static func warsawCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Warsaw")!
        return calendar
    }

    static func date(_ y: Int, _ m: Int, _ d: Int, calendar: Calendar) -> Date {
        var components = DateComponents()
        components.calendar = calendar
        components.year = y
        components.month = m
        components.day = d
        return calendar.startOfDay(for: calendar.date(from: components)!)
    }

    static func catalog() throws -> [RetailerPolicy] {
        try RetailerCatalog.load(from: retailersJSON())
    }

    static func retailersJSON() throws -> Data {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("ParagonOS/Resources/Retailers.json")
        return try Data(contentsOf: url)
    }
}

final class RetailerPolicyTests: XCTestCase {
    func testBiedronkaIs30Days() throws {
        let calendar = VoucherParserTests.warsawCalendar()
        let policy = try VoucherParserTests.catalog().first { $0.id == "biedronka" }!
        let issued = VoucherParserTests.date(2026, 9, 12, calendar: calendar)
        XCTAssertEqual(RetailerCatalog.validityDays(for: policy, issuedAt: issued, calendar: calendar), 30)
        XCTAssertEqual(RetailerCatalog.defaultExpiry(for: policy, issuedAt: issued, calendar: calendar), VoucherParserTests.date(2026, 10, 12, calendar: calendar))
    }

    func testLidlSwitchesTo100DaysInOctober2026() throws {
        let calendar = VoucherParserTests.warsawCalendar()
        let policy = try VoucherParserTests.catalog().first { $0.id == "lidl" }!
        XCTAssertEqual(RetailerCatalog.validityDays(for: policy, issuedAt: VoucherParserTests.date(2026, 9, 12, calendar: calendar), calendar: calendar), 30)
        XCTAssertEqual(RetailerCatalog.validityDays(for: policy, issuedAt: VoucherParserTests.date(2026, 10, 1, calendar: calendar), calendar: calendar), 100)
        XCTAssertEqual(
            RetailerCatalog.defaultExpiry(for: policy, issuedAt: VoucherParserTests.date(2026, 10, 1, calendar: calendar), calendar: calendar),
            VoucherParserTests.date(2027, 1, 9, calendar: calendar)
        )
    }

    func testKauflandIs100Days() throws {
        let calendar = VoucherParserTests.warsawCalendar()
        let policy = try VoucherParserTests.catalog().first { $0.id == "kaufland" }!
        XCTAssertEqual(RetailerCatalog.validityDays(for: policy, issuedAt: VoucherParserTests.date(2026, 9, 12, calendar: calendar), calendar: calendar), 100)
    }

    func testAuchanAndDinoHaveNoExpiry() throws {
        let calendar = VoucherParserTests.warsawCalendar()
        let catalog = try VoucherParserTests.catalog()
        let auchan = catalog.first { $0.id == "auchan" }!
        let dino = catalog.first { $0.id == "dino" }!
        XCTAssertNil(RetailerCatalog.validityDays(for: auchan, issuedAt: VoucherParserTests.date(2026, 9, 12, calendar: calendar), calendar: calendar))
        XCTAssertNil(RetailerCatalog.defaultExpiry(for: dino, issuedAt: VoucherParserTests.date(2026, 9, 12, calendar: calendar), calendar: calendar))
    }
}

final class TicketStatusTests: XCTestCase {
    func testRedeemedStaysRedeemedAfterExpiry() {
        let expired = Date().addingTimeInterval(-86_400)
        let status = TicketStatusEngine.resolved(stored: .redeemed, expiresAt: expired)
        XCTAssertEqual(status, .redeemed)
    }

    func testActiveBecomesExpiredAfterDeadline() {
        let expired = Date().addingTimeInterval(-60)
        let status = TicketStatusEngine.resolved(stored: .active, expiresAt: expired)
        XCTAssertEqual(status, .expired)
    }

    func testActiveWithoutExpiryStaysActive() {
        let status = TicketStatusEngine.resolved(stored: .active, expiresAt: nil)
        XCTAssertEqual(status, .active)
    }

    func testFutureExpiryStaysActive() {
        let future = Date().addingTimeInterval(86_400)
        let status = TicketStatusEngine.resolved(stored: .active, expiresAt: future)
        XCTAssertEqual(status, .active)
    }

    func testMarkRedeemedReturnsRedeemedPair() {
        let now = Date(timeIntervalSince1970: 1_000)
        let result = TicketStatusEngine.markRedeemed(now: now)
        XCTAssertEqual(result.status, .redeemed)
        XCTAssertEqual(result.at, now)
    }
}

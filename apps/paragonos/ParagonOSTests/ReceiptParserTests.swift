import XCTest
@testable import ParagonOS

final class ReceiptParserTests: XCTestCase {
    func testParsesMediaExpertInvoiceAndElectronicsCategory() {
        let calendar = VoucherParserTests.warsawCalendar()
        let lines = [
            "FAKTURA VAT",
            "Media Expert",
            "NIP 7791011327",
            "Laptop 3 299,00 zł",
            "SUMA PLN 3 299,00",
            "VAT 616,85",
            "Nr FV 12/09/2026",
            "Data 12.09.2026",
            "Płatność: karta"
        ]
        let draft = ReceiptParser.parse(
            lines: lines,
            now: VoucherParserTests.date(2026, 9, 12, calendar: calendar),
            calendar: calendar
        )
        XCTAssertEqual(draft.merchantName, "Media Expert")
        XCTAssertEqual(draft.merchantNIP, "7791011327")
        XCTAssertEqual(draft.amount, 3299, accuracy: 0.01)
        XCTAssertEqual(draft.category, .elektronika)
        XCTAssertEqual(draft.documentType, .invoice)
        XCTAssertTrue(draft.issuedWasPrinted)
        XCTAssertEqual(calendar.startOfDay(for: draft.issuedAt), VoucherParserTests.date(2026, 9, 12, calendar: calendar))
        XCTAssertNotNil(draft.warrantyUntil)
        XCTAssertEqual(draft.payment, .card)
        XCTAssertTrue(draft.itemName.localizedCaseInsensitiveContains("Laptop"))
        XCTAssertTrue(draft.scanIsComplete)
    }

    func testParsesGroceryReceiptAsFood() {
        let calendar = VoucherParserTests.warsawCalendar()
        let lines = [
            "Lidl sp. z o.o.",
            "PARAGON FISKALNY",
            "NIP: 725-20-06-488",
            "Mleko 3,49 zł",
            "Chleb 4,20 zł",
            "RAZEM 7,69 zł",
            "12.09.2026"
        ]
        let draft = ReceiptParser.parse(lines: lines, calendar: calendar)
        XCTAssertEqual(draft.merchantName, "Lidl")
        XCTAssertEqual(draft.category, .spozywcze)
        XCTAssertEqual(draft.amount, 7.69, accuracy: 0.001)
        XCTAssertEqual(draft.documentType, .receipt)
        XCTAssertNil(draft.warrantyUntil)
        XCTAssertTrue(draft.itemName.localizedCaseInsensitiveContains("Mleko"))
        XCTAssertTrue(draft.itemName.localizedCaseInsensitiveContains("Chleb"))
    }

    func testInfersShoesCategoryFromItems() {
        let draft = ReceiptParser.parse(lines: ["Deichmann", "Sneakers 199,99 zł", "SUMA 199,99", "NIP 5272520145"])
        XCTAssertEqual(draft.category, .buty)
        XCTAssertEqual(draft.merchantName, "Deichmann")
        XCTAssertEqual(draft.amount, 199.99, accuracy: 0.001)
        XCTAssertNotNil(draft.returnUntil)
        XCTAssertTrue(draft.itemName.localizedCaseInsensitiveContains("Sneakers"))
    }

    func testParsesXkomInvoiceCashPaymentSellerNIPAndCameraItem() {
        let calendar = VoucherParserTests.warsawCalendar()
        let lines = [
            "Faktura VAT",
            "nr FVS/xk/000000886153",
            "X-KOM",
            "www.x-kom.pl",
            "Data wystawienia: 06.05.2025",
            "Sprzedawca",
            "X-KOM SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
            "Bojemskiego 25",
            "42-202 Częstochowa",
            "NIP: PL9492107026",
            "Nabywca",
            "House Centre Sp. z o.o",
            "NIP: 1132891054",
            "Towar lub usługa",
            "Inteligentne kamery Aqara Hub Camera G3",
            "1 szt 339,00 275,61 23% 63,39 339,00",
            "Wartość faktury brutto 339,00 PLN",
            "Zapłacono",
            "Gotówka 339,00",
            "Razem w PLN 339,00"
        ]
        let draft = ReceiptParser.parse(
            lines: lines,
            now: VoucherParserTests.date(2026, 9, 12, calendar: calendar),
            calendar: calendar
        )
        XCTAssertEqual(draft.merchantName, "x-kom")
        XCTAssertEqual(draft.merchantNIP, "9492107026")
        XCTAssertEqual(draft.amount, 339, accuracy: 0.01)
        XCTAssertEqual(draft.payment, .cash)
        XCTAssertEqual(draft.documentType, .invoice)
        XCTAssertEqual(draft.category, .elektronika)
        XCTAssertTrue(draft.itemName.localizedCaseInsensitiveContains("Aqara"))
        XCTAssertTrue(draft.itemName.localizedCaseInsensitiveContains("Camera"))
        XCTAssertFalse(draft.itemName.localizedCaseInsensitiveContains("House Centre"))
        XCTAssertEqual(calendar.startOfDay(for: draft.issuedAt), VoucherParserTests.date(2025, 5, 6, calendar: calendar))
    }

    func testDetectsCashDespiteOCRTypo() {
        let draft = ReceiptParser.parse(lines: [
            "x-kom",
            "SUMA 12,00",
            "Zaplacono",
            "Gotdwka 12,00"
        ])
        XCTAssertEqual(draft.payment, .cash)
    }

    func testAppliesWarrantyAndReturnDatesFromCategory() {
        let calendar = VoucherParserTests.warsawCalendar()
        let issued = VoucherParserTests.date(2026, 9, 12, calendar: calendar)
        let dates = ReceiptParser.applyCategoryDates(category: .elektronika, issuedAt: issued, calendar: calendar)
        XCTAssertEqual(
            calendar.date(byAdding: .month, value: 24, to: issued),
            dates.warranty
        )
        XCTAssertEqual(
            calendar.date(byAdding: .day, value: 14, to: issued),
            dates.returning
        )
        let food = ReceiptParser.applyCategoryDates(category: .spozywcze, issuedAt: issued, calendar: calendar)
        XCTAssertNil(food.warranty)
        XCTAssertNil(food.returning)
    }
}

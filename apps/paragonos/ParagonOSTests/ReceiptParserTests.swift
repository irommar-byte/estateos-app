import UIKit
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

    func testParsesDysonInvoiceInsteadOfNettoAndUSThousands() {
        let calendar = VoucherParserTests.warsawCalendar()
        let lines = [
            "dyson",
            "Faktura VAT",
            "Nabywca",
            "Edyta Zielińska",
            "Sprzedawca",
            "Dyson Sp. z o.o.",
            "Ul. Zajęcza 4",
            "00-351 Warszawa",
            "NIP: PL5252649346",
            "Faktura VAT numer: 6740402514",
            "Data sprzedaży: 01.12.2024",
            "Data wystawienia faktury: 01.12.2024",
            "Termin płatności 01.12.2024",
            "L.p. Nazwa Ilość Cena jednostkowa netto Wartość netto Stawka podatku VAT (%) Kwota podatku VAT Wartość brutto",
            "10 448870-01 SV46 V12 DTSlimAbs EU/CH/MEA SGd/lr/Gd 1 EA 1,771.54 1,771.54 23.00 407.45 2,179.00",
            "Fault report date: 30-11-2024",
            "Razem:",
            "Wartość netto 1,771.55",
            "Kwota podatku VAT 407.45",
            "2,179.00",
            "Razem do zapłaty (wartość brutto PLN): 2,179.00"
        ]
        let draft = ReceiptParser.parse(
            lines: lines,
            now: VoucherParserTests.date(2026, 9, 13, calendar: calendar),
            calendar: calendar
        )
        XCTAssertEqual(draft.merchantName, "Dyson")
        XCTAssertEqual(draft.merchantNIP, "5252649346")
        XCTAssertEqual(draft.amount, 2179, accuracy: 0.01)
        XCTAssertEqual(draft.taxAmount, 407.45, accuracy: 0.01)
        XCTAssertEqual(draft.documentType, .invoice)
        XCTAssertEqual(draft.category, .agd)
        XCTAssertEqual(calendar.startOfDay(for: draft.issuedAt), VoucherParserTests.date(2024, 12, 1, calendar: calendar))
        XCTAssertTrue(draft.itemName.localizedCaseInsensitiveContains("V12") || draft.itemName.localizedCaseInsensitiveContains("DTSlim"))
        XCTAssertFalse(draft.merchantName.localizedCaseInsensitiveContains("Netto"))
    }

    func testParsesXkomFiscalReceiptTotalNotPTUAndOldDate() {
        let calendar = VoucherParserTests.warsawCalendar()
        let lines = [
            "x-kom Sp. z o.o.",
            "04-175 Warszawa, ul. Ostrobramska 75c",
            "NIP: 9492107026",
            "16-09-2019 20:20",
            "PARAGON FISKALNY",
            "DRUKARKA LASEROW HP W251A LASERJET PRO 1*259.00 259.00A",
            "INTELIGENTNE OSW YEELIGHT 608887786309 Y 1*79.00 79.00A",
            "SP.OP.A: 338.00 PTU 23% 63.20",
            "Suma PTU: 63.20",
            "Suma: PLN 338.00",
            "Gotówka: 100.00",
            "Karta: 238.00"
        ]
        let draft = ReceiptParser.parse(
            lines: lines,
            now: VoucherParserTests.date(2026, 9, 13, calendar: calendar),
            calendar: calendar
        )
        XCTAssertEqual(draft.merchantName, "x-kom")
        XCTAssertEqual(draft.merchantNIP, "9492107026")
        XCTAssertEqual(draft.amount, 338, accuracy: 0.01)
        XCTAssertEqual(draft.taxAmount, 63.20, accuracy: 0.01)
        XCTAssertEqual(draft.documentType, .receipt)
        XCTAssertEqual(draft.category, .elektronika)
        XCTAssertEqual(calendar.startOfDay(for: draft.issuedAt), VoucherParserTests.date(2019, 9, 16, calendar: calendar))
        XCTAssertTrue(draft.issuedWasPrinted)
        XCTAssertEqual(draft.payment, .card)
        XCTAssertTrue(draft.itemName.localizedCaseInsensitiveContains("drukarka") || draft.itemName.localizedCaseInsensitiveContains("LASERJET"))
    }

    func testKeepsNettoGroceryReceiptAsNetto() {
        let draft = ReceiptParser.parse(lines: [
            "Netto Sp. z o.o.",
            "PARAGON FISKALNY",
            "NIP 585-14-11-739",
            "Mleko 3,49 zł",
            "RAZEM 3,49 zł",
            "12.09.2026"
        ])
        XCTAssertEqual(draft.merchantName, "Netto")
        XCTAssertEqual(draft.category, .spozywcze)
        XCTAssertEqual(draft.amount, 3.49, accuracy: 0.001)
    }

    func testCompressesDocumentPhotosWellUnderOriginalSize() {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let image = UIGraphicsImageRenderer(size: CGSize(width: 3000, height: 4000), format: format).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 3000, height: 4000))
            UIColor.black.setFill()
            ctx.fill(CGRect(x: 80, y: 80, width: 2840, height: 40))
        }
        let original = image.jpegData(compressionQuality: 0.95)?.count ?? 0
        let compressed = ScanService.compressPhoto(image)
        XCTAssertNotNil(compressed)
        XCTAssertLessThan(compressed?.count ?? .max, 280_000)
        XCTAssertLessThan(compressed?.count ?? .max, original)
        XCTAssertNotNil(compressed.flatMap(UIImage.init(data:)))
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
        XCTAssertNotNil(draft.warrantyUntil)
        XCTAssertEqual(calendar.component(.year, from: draft.warrantyUntil ?? .distantPast), 2027)
        XCTAssertEqual(calendar.component(.month, from: draft.warrantyUntil ?? .distantPast), 5)
    }

    func testCollapsesDuplicatedOCRItemNames() {
        let draft = ReceiptParser.parse(lines: [
            "x-kom",
            "Towar lub usługa",
            "Inteligentne kamery Agara Hub Camera",
            "Inteligentne kamery Agara Hab Camera",
            "inteligentne kamery Agara Hub Camera",
            "1 szt 339,00",
            "Wartość faktury brutto 339,00 PLN"
        ])
        XCTAssertTrue(draft.itemName.localizedCaseInsensitiveContains("Camera"))
        XCTAssertFalse(draft.itemName.contains(" · "))
        let messy = "Inteligentne kamery Agara Hub Camera - Inteligentne kamery Agara Hab Camera - inteligentne kamery Agara Hub Camera"
        let collapsed = ReceiptParser.collapsedItemName(messy)
        XCTAssertEqual(collapsed.components(separatedBy: " · ").count, 1)
        XCTAssertTrue(collapsed.localizedCaseInsensitiveContains("Camera"))
        XCTAssertFalse(collapsed.contains(" - "))
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

    func testGroupsReceiptsByMerchantAndSums() {
        let first = receipt(merchant: "x-kom", amount: 339, item: "")
        let second = receipt(merchant: "X-Kom", amount: 339, item: "Kamera")
        let other = receipt(merchant: "Media Expert", amount: 100, item: "")
        let groups = ReceiptMerchantGroup.groups(from: [first, second, other])
        XCTAssertEqual(groups.count, 2)
        XCTAssertEqual(groups[0].merchantName, "x-kom")
        XCTAssertEqual(groups[0].receipts.count, 2)
        XCTAssertEqual(groups[0].total, 678)
        XCTAssertEqual(groups[1].merchantName, "Media Expert")
    }

    func testAllTimeMerchantGroupsMergeAcrossMonths() {
        let calendar = VoucherParserTests.warsawCalendar()
        let first = receipt(merchant: "Biedronka", amount: 20, item: "Mleko")
        first.issuedAt = VoucherParserTests.date(2026, 1, 12, calendar: calendar)
        let second = receipt(merchant: "biedronka", amount: 35, item: "Chleb")
        second.issuedAt = VoucherParserTests.date(2026, 8, 3, calendar: calendar)
        let other = receipt(merchant: "Lidl", amount: 10, item: "")
        other.issuedAt = VoucherParserTests.date(2026, 8, 4, calendar: calendar)
        let groups = ReceiptMerchantGroup.allTime(from: [first, second, other])
        XCTAssertEqual(groups.count, 2)
        XCTAssertEqual(groups[0].merchantName.lowercased(), "biedronka")
        XCTAssertEqual(groups[0].receipts.count, 2)
        XCTAssertEqual(groups[0].total, 55)
        XCTAssertEqual(groups[1].merchantName, "Lidl")
    }

    func testCountsActiveElectronicsWarrantyEvenWhenStoredDateIsMissing() {
        let calendar = VoucherParserTests.warsawCalendar()
        let item = receipt(merchant: "x-kom", amount: 339, item: "Kamera")
        item.issuedAt = VoucherParserTests.date(2025, 5, 6, calendar: calendar)
        item.warrantyUntil = nil
        let now = VoucherParserTests.date(2026, 9, 13, calendar: calendar)
        XCTAssertEqual(ReceiptAnalytics.activeWarranties([item], now: now).count, 1)
        XCTAssertTrue(ReceiptAnalytics.upcomingWarranties([item], now: now).isEmpty)
        XCTAssertTrue(ReceiptAnalytics.healMissingDates([item], calendar: calendar))
        XCTAssertNotNil(item.warrantyUntil)
        XCTAssertEqual(ReceiptAnalytics.activeWarranties([item], now: now).count, 1)
    }

    func testDoesNotCountExpiredWarrantyAsActive() {
        let calendar = VoucherParserTests.warsawCalendar()
        let item = receipt(merchant: "Media Expert", amount: 100, item: "Laptop")
        item.issuedAt = VoucherParserTests.date(2023, 1, 10, calendar: calendar)
        item.warrantyUntil = VoucherParserTests.date(2025, 1, 10, calendar: calendar)
        let now = VoucherParserTests.date(2026, 9, 13, calendar: calendar)
        XCTAssertTrue(ReceiptAnalytics.activeWarranties([item], now: now).isEmpty)
    }

    func testReceiptSearchFindsProductTitlesAndInflectedWords() {
        let item = receipt(
            merchant: "x-kom",
            amount: 339,
            item: "Inteligentne kamery Aqara Hub Camera G3"
        )
        item.ocrText = "Faktura VAT\nTowar lub usługa\nInteligentne kamery Aqara Hub Camera G3"
        XCTAssertTrue(ReceiptSearch.matches(item, query: "kamera"))
        XCTAssertTrue(ReceiptSearch.matches(item, query: "kamery"))
        XCTAssertTrue(ReceiptSearch.matches(item, query: "Aqara"))
        XCTAssertTrue(ReceiptSearch.matches(item, query: "hub camera"))
        XCTAssertTrue(ReceiptSearch.matches(item, query: "x-kom"))
        XCTAssertTrue(ReceiptSearch.matches(item, query: "faktura"))
        XCTAssertFalse(ReceiptSearch.matches(item, query: "biedronka"))
    }

    private func receipt(merchant: String, amount: Double, item: String) -> Receipt {
        Receipt(
            merchantName: merchant,
            merchantNIP: "",
            amount: amount,
            taxAmount: 0,
            issuedAt: Date(),
            category: .elektronika,
            documentType: .receipt,
            documentNumber: "",
            paymentMethod: ReceiptPaymentMethod.card.rawValue,
            itemName: item,
            photoData: nil,
            ocrText: "",
            scannedByName: "",
            ocrConfidence: 1,
            warrantyUntil: nil,
            returnUntil: nil
        )
    }
}

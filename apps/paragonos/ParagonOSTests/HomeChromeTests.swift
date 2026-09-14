import XCTest
@testable import ParagonOS

final class HomeChromeTests: XCTestCase {
    func testWidgetDeepLinksParseScanAndCheckout() {
        XCTAssertEqual(WidgetDeepLink.parse(URL(string: "paragonos://scan/deposit")!), .scanDeposit)
        XCTAssertEqual(WidgetDeepLink.parse(URL(string: "paragonos://scan/receipt")!), .scanReceipt)
        XCTAssertEqual(WidgetDeepLink.parse(URL(string: "paragonos://scan/loyalty")!), .scanLoyalty)
        XCTAssertEqual(WidgetDeepLink.parse(URL(string: "paragonos://map")!), .map)

        let ticketID = UUID()
        let cardID = UUID()
        XCTAssertEqual(
            WidgetDeepLink.parse(URL(string: "paragonos://checkout/ticket/\(ticketID.uuidString)")!),
            .checkoutTicket(ticketID)
        )
        XCTAssertEqual(
            WidgetDeepLink.parse(URL(string: "paragonos://checkout/card/\(cardID.uuidString)")!),
            .checkoutCard(cardID)
        )
        XCTAssertEqual(WidgetDeepLink.scanDeposit.url.absoluteString, "paragonos://scan/deposit")
        XCTAssertNil(WidgetDeepLink.parse(URL(string: "https://example.com")!))
    }

    func testHomeSnapshotRoundTrip() throws {
        let ticketID = UUID()
        let cardID = UUID()
        let snapshot = HomeSnapshot(
            nextTicket: SnapshotTicket(
                id: ticketID,
                brand: "Biedronka",
                amount: 12.5,
                expiresAt: Date(timeIntervalSince1970: 1_800_000_000)
            ),
            cards: [SnapshotCard(id: cardID, name: "Moja Biedronka")],
            lastCardID: cardID
        )
        let data = try JSONEncoder().encode(snapshot)
        let decoded = try JSONDecoder().decode(HomeSnapshot.self, from: data)
        XCTAssertEqual(decoded, snapshot)
        XCTAssertEqual(decoded.nextTicket?.brand, "Biedronka")
        XCTAssertEqual(decoded.cards.first?.name, "Moja Biedronka")
    }

    func testAppGroupAndWidgetIdentifiers() {
        XCTAssertEqual(AppGroup.id, "group.pl.paragonos.app")
        XCTAssertEqual(AppGroup.snapshotName, "home-snapshot.json")
        XCTAssertEqual(HomeQuickActions.scanDeposit, "scan.deposit")
        XCTAssertEqual(HomeQuickActions.scanReceipt, "scan.receipt")
        XCTAssertEqual(HomeQuickActions.scanLoyalty, "scan.loyalty")
        XCTAssertEqual(HomeQuickActions.checkout, "checkout")
        XCTAssertEqual(HomeQuickActions.map, "map")
        XCTAssertEqual(ScanDepositControlLink.url, WidgetDeepLink.scanDeposit.url)
        XCTAssertEqual(ScanDepositControlLink.url.absoluteString, "paragonos://scan/deposit")
        XCTAssertEqual(ScanReceiptControlLink.url, WidgetDeepLink.scanReceipt.url)
        XCTAssertEqual(ScanReceiptControlLink.url.absoluteString, "paragonos://scan/receipt")
    }

    func testPendingLaunchPersistsScanIntent() {
        PendingLaunch.clearScan()
        PendingLaunch.saveScan(.receipt)
        XCTAssertEqual(PendingLaunch.takeScan(), .receipt)
        XCTAssertNil(PendingLaunch.takeScan())
        PendingLaunch.saveScan(.deposit)
        PendingLaunch.clearScan()
        XCTAssertNil(PendingLaunch.takeScan())
    }

    @MainActor
    func testOpenScannerSelectsWalletOrReceiptsNotHistory() {
        let wallet = WalletModel()
        wallet.openScanner(for: .deposit)
        XCTAssertEqual(wallet.requestedTab, .wallet)
        XCTAssertEqual(wallet.scanIntent, .deposit)
        XCTAssertTrue(wallet.showScanner)
        wallet.openScanner(for: .receipt)
        XCTAssertEqual(wallet.requestedTab, .receipts)
        XCTAssertNotEqual(wallet.requestedTab, .history)
        wallet.openScanner(for: .loyalty)
        XCTAssertEqual(wallet.requestedTab, .cards)
    }

    func testStampSlotsFillCardsThenTicketsThenEmpty() {
        let cardID = UUID()
        let ticketID = UUID()
        let snapshot = HomeSnapshot(
            cards: [SnapshotCard(id: cardID, name: "Moja Biedronka", colorHex: "#E30613", programID: "biedronka")],
            tickets: [
                SnapshotTicket(id: ticketID, brand: "Lidl", amount: 4.5, expiresAt: nil, brandID: "lidl", colorHex: "#0050AA")
            ]
        )
        let slots = snapshot.stampSlots
        XCTAssertEqual(slots.count, 6)
        if case .card(let card) = slots[0] {
            XCTAssertEqual(card.id, cardID)
            XCTAssertEqual(card.colorHex, "#E30613")
        } else {
            XCTFail("first slot should be a card")
        }
        if case .ticket(let ticket) = slots[1] {
            XCTAssertEqual(ticket.id, ticketID)
            XCTAssertEqual(ticket.amount, 4.5)
        } else {
            XCTFail("second slot should fill with a deposit")
        }
        if case .empty = slots[5] {
            XCTAssertEqual(slots[5].deepLink, WidgetDeepLink.scanLoyalty.url)
        } else {
            XCTFail("empty slots should invite a card scan")
        }
        XCTAssertEqual(slots[0].deepLink, WidgetDeepLink.checkoutCard(cardID).url)
        XCTAssertEqual(slots[1].deepLink, WidgetDeepLink.checkoutTicket(ticketID).url)
    }

    func testLegacySnapshotDecodesWithoutNewFields() throws {
        let json = """
        {"nextTicket":null,"cards":[],"lastCardID":null}
        """.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(HomeSnapshot.self, from: json)
        XCTAssertTrue(decoded.tickets.isEmpty)
        XCTAssertTrue(decoded.stampSlots.allSatisfy {
            if case .empty = $0 { return true }
            return false
        })
    }

    func testWidgetSourceIncludesReceiptControl() throws {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let source = try String(contentsOf: root.appendingPathComponent("ParagonOSWidgets/ScanReceiptControl.swift"), encoding: .utf8)
        XCTAssertTrue(source.contains("ControlWidget"))
        XCTAssertTrue(source.contains("ScanReceiptControlLink.url"))
        XCTAssertTrue(source.contains("Skanuj paragon"))
        XCTAssertTrue(source.contains("paragonos.app.scanReceipt") || source.contains("pl.paragonos.app.scanReceipt"))
    }

    func testWidgetSourceIncludesControlCenter() throws {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let source = try String(contentsOf: root.appendingPathComponent("ParagonOSWidgets/ScanDepositControl.swift"), encoding: .utf8)
        XCTAssertTrue(source.contains("ControlWidget"))
        XCTAssertTrue(source.contains("ScanDepositControlLink.url"))
        XCTAssertTrue(source.contains("Skanuj kwitek"))
    }

    func testXcodeGeneratorIncludesWidgetTarget() throws {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let generator = root.appendingPathComponent("generate_xcode_project.py")
        let source = try String(contentsOf: generator, encoding: .utf8)
        XCTAssertTrue(source.contains("pl.paragonos.app.widgets"))
        XCTAssertTrue(source.contains("ParagonOSWidgets"))
        XCTAssertTrue(source.contains("Embed Foundation Extensions"))
        XCTAssertTrue(source.contains("Core/HomeSnapshot.swift"))
        XCTAssertTrue(source.contains(".xcstrings"))
        XCTAssertTrue(source.contains(".storekit"))
        XCTAssertTrue(source.contains("knownRegions"))
    }
}

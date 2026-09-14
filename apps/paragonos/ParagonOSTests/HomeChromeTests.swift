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
    }
}

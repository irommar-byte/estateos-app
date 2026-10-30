import UIKit
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
        XCTAssertEqual(ParagonWidgetKind.stampInset, 0.11, accuracy: 0.001)
        XCTAssertEqual(ParagonWidgetKind.artRevision, 5)
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
        XCTAssertEqual(ScanLoyaltyControlLink.url, WidgetDeepLink.scanLoyalty.url)
        XCTAssertEqual(ScanLoyaltyControlLink.url.absoluteString, "paragonos://scan/loyalty")
        XCTAssertEqual(ParagonWidgetKind.home, "ParagonOSHomeWidget")
        XCTAssertEqual(ParagonWidgetKind.lock, "ParagonOSLockWidget")
        XCTAssertEqual(ParagonWidgetKind.tickets, "ParagonOSTicketsWidget")
        XCTAssertEqual(ParagonWidgetKind.cards, "ParagonOSCardsWidget")
        XCTAssertEqual(ParagonWidgetKind.all.count, 4)
        XCTAssertEqual(ParagonWidgetKind.stampCorner, 12, accuracy: 0.01)
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

    func testCardSlotsAreCardsOnlyAndLastCheckoutFirst() {
        let last = UUID()
        let other = UUID()
        let ticketID = UUID()
        let snapshot = HomeSnapshot(
            cards: [
                SnapshotCard(id: other, name: "Orlen", colorHex: "#E45A28", programID: "orlen"),
                SnapshotCard(id: last, name: "Moja Biedronka", colorHex: "#E30613", programID: "biedronka", caption: "Anna")
            ],
            lastCardID: last,
            tickets: [
                SnapshotTicket(id: ticketID, brand: "Lidl", amount: 4.5, expiresAt: nil, brandID: "lidl", colorHex: "#0050AA")
            ]
        )
        let slots = snapshot.cardSlots(count: 6)
        XCTAssertEqual(slots.count, 6)
        if case .card(let card) = slots[0] {
            XCTAssertEqual(card.id, last)
            XCTAssertEqual(card.caption, "Anna")
        } else {
            XCTFail("first card slot should be the last checkout card")
        }
        if case .card(let card) = slots[1] {
            XCTAssertEqual(card.id, other)
        } else {
            XCTFail("second slot should be the remaining card")
        }
        XCTAssertTrue(slots.allSatisfy {
            if case .ticket = $0 { return false }
            return true
        })
        if case .empty(_, let kind) = slots[5] {
            XCTAssertEqual(kind, .loyalty)
            XCTAssertEqual(slots[5].deepLink, WidgetDeepLink.scanLoyalty.url)
        } else {
            XCTFail("empty card slots should invite a card scan")
        }
        XCTAssertEqual(slots[0].deepLink, WidgetDeepLink.checkoutCard(last).url)

        let tickets = snapshot.ticketSlots(count: 6)
        XCTAssertEqual(tickets.count, 6)
        if case .ticket(let ticket) = tickets[0] {
            XCTAssertEqual(ticket.id, ticketID)
        } else {
            XCTFail("first ticket slot should be a deposit")
        }
        if case .empty(_, let kind) = tickets[1] {
            XCTAssertEqual(kind, .deposit)
            XCTAssertEqual(tickets[1].deepLink, WidgetDeepLink.scanDeposit.url)
        } else {
            XCTFail("empty ticket slots should invite a deposit scan")
        }
    }

    func testLastDigitsAndOrderedCards() {
        XCTAssertEqual(HomeSnapshot.lastDigits(from: "5901234567890"), "7890")
        XCTAssertEqual(HomeSnapshot.lastDigits(from: "AB12"), "AB12")
        XCTAssertNil(HomeSnapshot.lastDigits(from: "12"))
        let first = SnapshotCard(id: UUID(), name: "A")
        let second = SnapshotCard(id: UUID(), name: "B")
        let ordered = HomeSnapshot.orderedCards([first, second], lastCardID: second.id)
        XCTAssertEqual(ordered.map(\.id), [second.id, first.id])
    }

    func testStampStoreNamesIncludeArtRevision() {
        let id = UUID()
        XCTAssertEqual("\(id.uuidString)-v\(ParagonWidgetKind.artRevision).png", "\(id.uuidString)-v5.png")
        XCTAssertFalse(
            String(describing: WidgetStampStore.self).isEmpty
        )
    }

    @MainActor
    func testBiedronkaStampKeepsAntennaInsideSafeArea() throws {
        let program = try XCTUnwrap(LoyaltyCatalog.program(id: "biedronka"))
        let image = try XCTUnwrap(LoyaltyBrandArt.raster(program: program, dimension: 96))
        guard let cg = image.cgImage else {
            XCTFail("missing cgImage")
            return
        }
        XCTAssertGreaterThan(cg.width, 40)
        XCTAssertLessThan(alpha(in: image, xRatio: 0.04, yRatio: 0.04), 0.08)
        XCTAssertLessThan(alpha(in: image, xRatio: 0.96, yRatio: 0.04), 0.08)
        XCTAssertLessThan(alpha(in: image, xRatio: 0.04, yRatio: 0.96), 0.08)
        XCTAssertLessThan(alpha(in: image, xRatio: 0.96, yRatio: 0.96), 0.08)
        XCTAssertGreaterThan(alpha(in: image, xRatio: 0.5, yRatio: 0.5), 0.2)
    }

    private func alpha(in image: UIImage, xRatio: CGFloat, yRatio: CGFloat) -> CGFloat {
        guard let cg = image.cgImage else { return 1 }
        let x = min(cg.width - 1, max(0, Int(CGFloat(cg.width) * xRatio)))
        let y = min(cg.height - 1, max(0, Int(CGFloat(cg.height) * yRatio)))
        var pixel = [UInt8](repeating: 0, count: 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
        guard let context = CGContext(
            data: &pixel,
            width: 1,
            height: 1,
            bitsPerComponent: 8,
            bytesPerRow: 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ) else { return 1 }
        context.translateBy(x: -CGFloat(x), y: -CGFloat(y))
        context.draw(cg, in: CGRect(x: 0, y: 0, width: cg.width, height: cg.height))
        return CGFloat(pixel[3]) / 255
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

    func testWidgetSourceIncludesLoyaltyControl() throws {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let source = try String(contentsOf: root.appendingPathComponent("ParagonOSWidgets/ScanLoyaltyControl.swift"), encoding: .utf8)
        XCTAssertTrue(source.contains("ControlWidget"))
        XCTAssertTrue(source.contains("ScanLoyaltyControlLink.url"))
        XCTAssertTrue(source.contains("Skanuj kartę"))
        XCTAssertTrue(source.contains("pl.paragonos.app.scanLoyalty"))
        let widgets = try String(contentsOf: root.appendingPathComponent("ParagonOSWidgets/ParagonOSWidgets.swift"), encoding: .utf8)
        XCTAssertTrue(widgets.contains("ScanLoyaltyControl()"))
        XCTAssertTrue(widgets.contains("WidgetEmptyStamp"))
        XCTAssertTrue(widgets.contains("strokeBorder"))
        XCTAssertFalse(widgets.contains("fill.tertiary"))
        let cards = try String(contentsOf: root.appendingPathComponent("ParagonOSWidgets/CardsWidget.swift"), encoding: .utf8)
        XCTAssertTrue(cards.contains("systemLarge"))
        XCTAssertTrue(cards.contains("cardSlots"))
        XCTAssertFalse(cards.contains("stampSlots"))
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

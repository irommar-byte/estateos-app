import SwiftUI
import UIKit
import XCTest
@testable import ParagonOS

enum LuxSnapDisk {
    static var root: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    static func write(_ image: UIImage, folder: String, name: String) throws -> URL {
        let dir = root.appendingPathComponent(folder, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(name)
        let data = try XCTUnwrap(image.pngData())
        try data.write(to: url)
        return url
    }

    @MainActor
    static func render<V: View>(_ view: V, scale: CGFloat = 2) -> UIImage? {
        let renderer = ImageRenderer(content: view)
        renderer.scale = scale
        renderer.isOpaque = false
        return renderer.uiImage
    }
}

final class LuxSnapTests: XCTestCase {
    @MainActor
    func testWriteStampSnaps() throws {
        let biedronka = try XCTUnwrap(LoyaltyCatalog.program(id: "biedronka"))
        let fishka = try XCTUnwrap(LoyaltyCatalog.program(id: "fishka"))
        let kdr = try XCTUnwrap(LoyaltyCatalog.program(id: "kdr"))
        let brom = LoyaltyProgram.custom(name: "BROM")

        let tileB = try XCTUnwrap(WidgetStampRenderer.tile(program: biedronka, dimension: 96))
        let tileF = try XCTUnwrap(WidgetStampRenderer.tile(program: fishka, dimension: 96))
        let tileK = try XCTUnwrap(WidgetStampRenderer.tile(program: kdr, dimension: 96))
        _ = try LuxSnapDisk.write(tileB, folder: ".stamp-snaps", name: "tile-biedronka.png")
        _ = try LuxSnapDisk.write(tileF, folder: ".stamp-snaps", name: "tile-fishka.png")
        _ = try LuxSnapDisk.write(tileK, folder: ".stamp-snaps", name: "tile-kdr.png")
        _ = try LuxSnapDisk.write(
            try XCTUnwrap(WidgetStampRenderer.tile(program: brom, dimension: 96)),
            folder: ".stamp-snaps",
            name: "tile-brom.png"
        )

        let medium = try XCTUnwrap(
            WidgetStampRenderer.grid(
                cells: [
                    (fishka, "FISHKA"),
                    (biedronka, "Marian"),
                    (brom, "BROM"),
                    (biedronka, "Misia"),
                    (kdr, "Karta Dużej Rodziny"),
                ],
                emptyCount: 1,
                columns: 3,
                cell: 88
            )
        )
        let large = try XCTUnwrap(
            WidgetStampRenderer.grid(
                cells: [
                    (fishka, "FISHKA"),
                    (biedronka, "Marian"),
                    (brom, "BROM"),
                    (biedronka, "Misia"),
                    (kdr, "Karta Dużej Rodziny"),
                ],
                emptyCount: 4,
                columns: 3,
                cell: 88
            )
        )
        _ = try LuxSnapDisk.write(medium, folder: ".stamp-snaps", name: "grid-medium.png")
        _ = try LuxSnapDisk.write(large, folder: ".stamp-snaps", name: "grid-large.png")
        XCTAssertGreaterThan(tileB.size.width, 90)
    }

    @MainActor
    func testWriteCoffeeSnaps() throws {
        let steam = Date(timeIntervalSinceReferenceDate: 120)
        let rest = try XCTUnwrap(LuxSnapDisk.render(CoffeeCupStrip(selected: nil, steamAt: steam)))
        let selected = try XCTUnwrap(LuxSnapDisk.render(CoffeeCupStrip(selected: .medium, steamAt: steam)))
        let sip = try XCTUnwrap(LuxSnapDisk.render(CoffeeCupStrip(selected: .medium, drinking: .medium, steamAt: steam)))
        let compact = try XCTUnwrap(LuxSnapDisk.render(CoffeeCupStrip(selected: .large, steamAt: steam, compact: true)))
        _ = try LuxSnapDisk.write(rest, folder: ".coffee-snaps", name: "row-rest.png")
        _ = try LuxSnapDisk.write(selected, folder: ".coffee-snaps", name: "row-selected-medium.png")
        _ = try LuxSnapDisk.write(sip, folder: ".coffee-snaps", name: "row-sip-medium.png")
        _ = try LuxSnapDisk.write(compact, folder: ".coffee-snaps", name: "row-settings.png")
        let thanksTimes: [(TimeInterval, String)] = [
            (0.05, "thank-you-000.png"),
            (0.70, "thank-you-070.png"),
            (1.20, "thank-you-120.png"),
            (2.50, "thank-you-250.png"),
            (6.95, "thank-you-695.png"),
            (7.40, "thank-you-740.png"),
            (11.85, "thank-you-1185.png"),
            (14.20, "thank-you-1420.png")
        ]
        for (time, name) in thanksTimes {
            let frame = try XCTUnwrap(
                LuxSnapDisk.render(
                    CoffeeThankYouOverlay(onFinished: {}, previewTime: time)
                        .frame(width: 390, height: 844)
                )
            )
            _ = try LuxSnapDisk.write(frame, folder: ".coffee-snaps", name: name)
        }
        XCTAssertGreaterThan(rest.size.width, 200)
        XCTAssertEqual(CoffeeThankYouCue.firstHit, 0.95, accuracy: 0.001)
        XCTAssertEqual(CoffeeThankYouCue.crest, 6.95, accuracy: 0.001)
        XCTAssertEqual(CoffeeThankYouCue.lift, 11.85, accuracy: 0.001)
        XCTAssertEqual(CoffeeThankYouCue.beat, 0.40, accuracy: 0.001)
        XCTAssertLessThan(CoffeeThankYouCue.titleOpacity(0.2), 0.05)
        XCTAssertGreaterThan(CoffeeThankYouCue.titleOpacity(1.55), 0.9)
        XCTAssertGreaterThan(CoffeeThankYouCue.heroScale(1.4), 0.85)
        XCTAssertGreaterThan(CoffeeThankYouCue.heroOpacity(1.2), 0.8)
        XCTAssertLessThan(CoffeeThankYouCue.heroOpacity(0.4), 0.05)
        XCTAssertLessThan(CoffeeThankYouCue.veilOpacity(15.2), 0.4)
        XCTAssertGreaterThan(CoffeeThankYouCue.heroScale(6.95), CoffeeThankYouCue.heroScale(2.40))
        XCTAssertGreaterThan(CoffeeThankYouCue.glowStrength(6.95), CoffeeThankYouCue.glowStrength(2.40))
        XCTAssertTrue(ThankYouSpark.choreography().contains { $0.kind == .lantern })
    }

    @MainActor
    func testWriteCardPassSnaps() throws {
        let payback = LoyaltyCard(
            programID: "payback",
            programName: "Payback",
            holderName: "",
            barcodePayload: "0481343308891",
            barcodeSymbology: .code128,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )
        let brom = LoyaltyCard(
            programID: "brom",
            programName: "BROM",
            holderName: "",
            barcodePayload: "304951462309",
            barcodeSymbology: .code128,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )
        let jula = LoyaltyCard(
            programID: "jula",
            programName: "Jula",
            holderName: "",
            barcodePayload: "3050010902311218",
            barcodeSymbology: .code128,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )
        let auchan = LoyaltyCard(
            programID: "auchan",
            programName: "Auchan",
            holderName: "",
            barcodePayload: "0410028627552",
            barcodeSymbology: .code128,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )

        let walletCards = [
            payback,
            LoyaltyCard(
                programID: "lokal",
                programName: "LOKAL",
                holderName: "",
                barcodePayload: "111",
                barcodeSymbology: .code128,
                note: "",
                photoData: nil,
                scannedByName: "",
                ocrText: ""
            ),
            LoyaltyCard(
                programID: "bigstar",
                programName: "Big Star",
                holderName: "",
                barcodePayload: "222",
                barcodeSymbology: .code128,
                note: "",
                photoData: nil,
                scannedByName: "",
                ocrText: ""
            ),
            brom,
            jula,
            auchan
        ]

        let single = try XCTUnwrap(
            LuxSnapDisk.render(
                LoyaltyCardPass(card: payback, style: .stack, foilActive: false)
                    .frame(width: 358)
                    .padding(18)
                    .background(Color(uiColor: .systemGroupedBackground))
            )
        )
        let stacked = try XCTUnwrap(
            LuxSnapDisk.render(
                walletPile(cards: Array(walletCards.prefix(4)), spread: 0)
                    .frame(width: 358)
                    .padding(18)
                    .background(Color(uiColor: .systemGroupedBackground))
            )
        )
        let list = try XCTUnwrap(
            LuxSnapDisk.render(
                walletPile(cards: walletCards, spread: 0)
                    .frame(width: 358)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                    .background(Color(uiColor: .systemGroupedBackground))
            )
        )
        let listDark = try XCTUnwrap(
            LuxSnapDisk.render(
                walletPile(cards: walletCards, spread: 0)
                    .frame(width: 358)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                    .background(Color.black)
                    .environment(\.colorScheme, .dark)
            )
        )
        let listSpread = try XCTUnwrap(
            LuxSnapDisk.render(
                walletPile(cards: walletCards, spread: 1)
                    .frame(width: 358)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                    .background(Color(uiColor: .systemGroupedBackground))
            )
        )
        let listMid = try XCTUnwrap(
            LuxSnapDisk.render(
                walletPile(cards: walletCards, spread: 0.4)
                    .frame(width: 358)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                    .background(Color(uiColor: .systemGroupedBackground))
            )
        )

        _ = try LuxSnapDisk.write(single, folder: ".card-snaps", name: "pass-payback.png")
        _ = try LuxSnapDisk.write(stacked, folder: ".card-snaps", name: "stack-brom.png")
        _ = try LuxSnapDisk.write(list, folder: ".card-snaps", name: "list-cards.png")
        _ = try LuxSnapDisk.write(listDark, folder: ".card-snaps", name: "list-cards-dark.png")
        _ = try LuxSnapDisk.write(listMid, folder: ".card-snaps", name: "list-cards-mid.png")
        _ = try LuxSnapDisk.write(listSpread, folder: ".card-snaps", name: "list-cards-spread.png")
        for program in LoyaltyCatalog.all {
            let logo = UIImage(named: program.id)
                ?? Bundle.main.url(forResource: program.id, withExtension: "png", subdirectory: "BrandLogos").flatMap { UIImage(contentsOfFile: $0.path) }
            let strip = WalletPassBuilder.stripImage(
                program: program,
                logo: logo,
                size: CGSize(width: 375, height: 123)
            )
            _ = try LuxSnapDisk.write(strip, folder: ".card-snaps", name: "wallet-strip-\(program.id).png")
        }
        XCTAssertGreaterThan(list.size.height, 400)
        XCTAssertGreaterThan(listMid.size.height, list.size.height)
        XCTAssertGreaterThan(listSpread.size.height, listMid.size.height)
        XCTAssertEqual(LoyaltyCardPass.stackHeight, 212, accuracy: 0.001)
        XCTAssertEqual(LoyaltyCardPass.stackPeek, 54, accuracy: 0.001)
        XCTAssertEqual(LoyaltyCardPass.groupedCode("0481343308891"), "0481  3433  0889  1")
        XCTAssertEqual(WalletFan.spread(fromPull: 0), 0, accuracy: 0.001)
        XCTAssertLessThan(WalletFan.spread(fromPull: 80), 0.35)
        XCTAssertLessThanOrEqual(WalletFan.spread(fromPull: 400), 1)

        let pinStrip = HStack(spacing: 18) {
            BottleMapPin(brandID: "zabka", selected: false)
            BottleMapPin(brandID: "biedronka", selected: true)
            BottleMapPin(brandID: "lidl", selected: false)
            BottleClusterPin(count: 12, brandID: "zabka")
            BottleClusterPin(count: 48, brandID: nil)
        }
        .padding(24)
        .background(Color(uiColor: .systemGroupedBackground))
        let pinSnap = try XCTUnwrap(LuxSnapDisk.render(pinStrip))
        _ = try LuxSnapDisk.write(pinSnap, folder: ".card-snaps", name: "bottle-pins.png")
        XCTAssertGreaterThan(pinSnap.size.width, 100)
    }

    @ViewBuilder
    private func walletPile(cards: [LoyaltyCard], spread: CGFloat) -> some View {
        let height = LoyaltyPassStackMetrics.stackHeight(count: cards.count, spread: spread)
        ZStack(alignment: .top) {
            ForEach(Array(cards.enumerated()), id: \.element.id) { index, card in
                LoyaltyCardPass(card: card, style: .stack, foilActive: false)
                    .shadow(color: .black.opacity(0.20), radius: 8, y: 3)
                    .offset(y: LoyaltyPassStackMetrics.yOffset(index: index, spread: spread))
                    .zIndex(Double(index))
            }
        }
        .frame(height: height, alignment: .top)
    }
}

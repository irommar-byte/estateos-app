import PassKit
import UIKit
import XCTest
@testable import ParagonOS

final class LoyaltyCatalogTests: XCTestCase {
    func testBundledCatalogIncludesPolishRetailers() throws {
        let url = Bundle.main.url(forResource: "LoyaltyPrograms", withExtension: "json")
        XCTAssertNotNil(url, "LoyaltyPrograms.json powinno być w bundle aplikacji")
        XCTAssertGreaterThan(LoyaltyCatalog.all.count, 40)
        let names = Set(LoyaltyCatalog.all.map(\.name))
        XCTAssertTrue(names.contains("Kaufland"))
        XCTAssertTrue(names.contains("Jula"))
        XCTAssertTrue(names.contains("JulaClub"))
        XCTAssertTrue(names.contains("Karta Dużej Rodziny"))
        XCTAssertTrue(names.contains("Kiabi"))
        XCTAssertTrue(names.contains("La Vantil"))
        XCTAssertTrue(names.contains("Costa"))
    }

    func testMatchesOCRToProgram() {
        let kaufland = LoyaltyCatalog.match(ocrText: "Kaufland Card\n123456", barcode: "")
        XCTAssertEqual(kaufland?.id, "kaufland")

        let julaClub = LoyaltyCatalog.match(ocrText: "JulaClub kod QR", barcode: "https://jula.pl/club")
        XCTAssertEqual(julaClub?.id, "julaclub")

        let lidlPlus = LoyaltyCatalog.match(ocrText: "Lidl Plus", barcode: "")
        XCTAssertEqual(lidlPlus?.id, "lidlplus")
    }

    func testShortKeywordDoesNotMatchInsideWords() {
        XCTAssertFalse(LoyaltyCatalog.containsKeyword("kari", in: "kariera w sklepie"))
        XCTAssertTrue(LoyaltyCatalog.containsKeyword("kari", in: "karta kari 8821"))
    }

    func testSearchFiltersPrograms() {
        let hits = LoyaltyCatalog.search("jula")
        XCTAssertTrue(hits.contains(where: { $0.id == "jula" }))
        XCTAssertTrue(hits.contains(where: { $0.id == "julaclub" }))
        XCTAssertFalse(hits.contains(where: { $0.id == "kaufland" }))
    }

    func testParserSetsNeedsPickWhenUnknown() {
        let draft = LoyaltyParser.parse(
            lines: ["nieznana siec xyz"],
            barcodes: [DetectedBarcode(payload: "99887766", symbology: .code128)]
        )
        XCTAssertTrue(draft.needsProgramPick)
        XCTAssertEqual(draft.barcodePayload, "99887766")
        XCTAssertFalse(draft.canSave)
    }

    func testParserDetectsKnownStore() {
        let draft = LoyaltyParser.parse(
            lines: ["Moja Biedronka"],
            barcodes: [DetectedBarcode(payload: "1234567890123", symbology: .ean13)]
        )
        XCTAssertEqual(draft.programID, "biedronka")
        XCTAssertFalse(draft.needsProgramPick)
        XCTAssertTrue(draft.canSave)
        XCTAssertEqual(draft.barcodeSymbology, .ean13)
    }

    func testCostaMatchesCoffeeHeaven() {
        let costa = LoyaltyCatalog.match(ocrText: "Costa by coffeeheaven", barcode: "447461001121060")
        XCTAssertEqual(costa?.id, "costa")
        XCTAssertEqual(costa?.preferredBarcode, .qr)

        let heaven = LoyaltyCatalog.match(ocrText: "COFFEE HEAVEN", barcode: "")
        XCTAssertEqual(heaven?.id, "costa")
    }

    func testParserKeepsScannedQRForNumericPayload() {
        let draft = LoyaltyParser.parse(
            lines: ["Costa Coffee"],
            barcodes: [DetectedBarcode(payload: "447461001121060", symbology: .qr)]
        )
        XCTAssertEqual(draft.programID, "costa")
        XCTAssertEqual(draft.barcodeSymbology, .qr)
        XCTAssertEqual(draft.barcodePayload, "447461001121060")
    }

    func testMergesFrontBrandWithBackBarcode() {
        let draft = LoyaltyParser.parse(
            lines: ["Moja Biedronka", "Imię na karcie"],
            barcodes: [DetectedBarcode(payload: "5901234567890", symbology: .ean13)]
        )
        XCTAssertEqual(draft.programID, "biedronka")
        XCTAssertEqual(draft.barcodePayload, "5901234567890")
        XCTAssertFalse(draft.needsProgramPick)
    }

    func testMergesFrontBarcodeWithBackBrand() {
        let draft = LoyaltyParser.parse(
            lines: ["Lidl Plus", "Punkte"],
            barcodes: [DetectedBarcode(payload: "2012345678901", symbology: .code128)]
        )
        XCTAssertEqual(draft.programID, "lidlplus")
        XCTAssertEqual(draft.barcodePayload, "2012345678901")
        XCTAssertFalse(draft.needsProgramPick)
    }

    func testPrefersCardNumberOverWebsiteQR() {
        let draft = LoyaltyParser.parse(
            lines: ["Rossmann"],
            barcodes: [
                DetectedBarcode(payload: "https://www.rossmann.pl/karta", symbology: .qr),
                DetectedBarcode(payload: "1234567890123", symbology: .ean13)
            ]
        )
        XCTAssertEqual(draft.barcodePayload, "1234567890123")
        XCTAssertEqual(draft.programID, "rossmann")
    }

    func testReadsPrintedNumberWhenBarcodeMissing() {
        let draft = LoyaltyParser.parse(
            lines: ["Kaufland Card", "Nr 1234 5678 9012"],
            barcodes: []
        )
        XCTAssertEqual(draft.programID, "kaufland")
        XCTAssertEqual(draft.barcodePayload, "123456789012")
        XCTAssertTrue(draft.canSave)
    }

    func testLinearPayloadScannedAsQRBecomesBarcodeUnlessCatalogIsQR() {
        let asBarcode = BarcodeSymbology.resolved(
            scanned: .qr,
            payload: "447461001121060",
            catalogHint: .code128
        )
        XCTAssertEqual(asBarcode, .code128)

        let costaQR = BarcodeSymbology.resolved(
            scanned: .qr,
            payload: "447461001121060",
            catalogHint: .qr
        )
        XCTAssertEqual(costaQR, .qr)
    }

    func testLinearBarcodeIsNotSavedAsQR() {
        let draft = LoyaltyParser.parse(
            lines: ["FISHKA", "OKKO"],
            barcodes: [DetectedBarcode(payload: "000032224877933", symbology: .qr)]
        )
        XCTAssertEqual(draft.programID, "fishka")
        XCTAssertEqual(draft.barcodePayload, "000032224877933")
        XCTAssertEqual(draft.barcodeSymbology, .code128)
        XCTAssertNotEqual(draft.barcodeSymbology, .qr)
    }

    func testFishkaBeatsOKKOWhenBothAppearOnCard() {
        XCTAssertEqual(LoyaltyCatalog.match(ocrText: "FISHKA OKKO", barcode: "000032224877933")?.id, "fishka")
        XCTAssertEqual(LoyaltyCatalog.program(id: "fishka")?.preferredBarcode, .code128)
    }

    func testThirteenDigitCardNumberUsesEAN() {
        let draft = LoyaltyParser.parse(
            lines: ["Nieznana sieć"],
            barcodes: [DetectedBarcode(payload: "1000322487793", symbology: .unknown)]
        )
        XCTAssertEqual(draft.barcodeSymbology, .ean13)
    }

    func testCardFrameCropUsesID1Aspect() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 1200, height: 1600))
        let photo = renderer.image { ctx in
            UIColor.darkGray.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 1200, height: 1600))
            UIColor.red.setFill()
            ctx.fill(CGRect(x: 60, y: 430, width: 1080, height: 740))
        }
        let cropped = CardScanPhotos.cropToCardFrame(photo)
        XCTAssertEqual(cropped.size.width / cropped.size.height, CardScanMetrics.aspect, accuracy: 0.04)
        XCTAssertLessThan(cropped.size.width * cropped.size.height, photo.size.width * photo.size.height)
    }

    func testStackedCardPhotosSplitIntoSides() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 800, height: 1010))
        let stacked = renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 800, height: 505))
            UIColor.red.setFill()
            ctx.fill(CGRect(x: 0, y: 505, width: 800, height: 505))
        }
        let sides = CardScanPhotos.splitSides(stacked)
        XCTAssertEqual(sides.count, 2)
        XCTAssertEqual(sides[0].size.height, 505, accuracy: 2)
        XCTAssertEqual(sides[1].size.height, 505, accuracy: 2)
    }

    func testReplacingBackAppendsSecondCardSide() {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let front = UIGraphicsImageRenderer(size: CGSize(width: 800, height: 505), format: format).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 800, height: 505))
        }
        let back = UIGraphicsImageRenderer(size: CGSize(width: 800, height: 505), format: format).image { ctx in
            UIColor.red.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 800, height: 505))
        }
        let combined = CardScanPhotos.replacingSide(1, in: front, with: back)
        let sides = CardScanPhotos.splitSides(combined)
        XCTAssertEqual(sides.count, 2)
    }

    func testCardScanGateIgnoresTextOnlyWithoutFill() {
        let observation = CardScanGate.Observation(
            hasBrand: false,
            hasCode: false,
            isSecondSide: false,
            hasNewCode: false,
            hasNewBrand: false,
            coverage: 0.1,
            spreadX: 0.2,
            spreadY: 0.15,
            boxCount: 4
        )
        XCTAssertFalse(CardScanGate.isReady(observation))
        XCTAssertFalse(CardScanGate.fillsFrame(coverage: 0.1, spreadX: 0.2, spreadY: 0.15, boxCount: 4))
    }

    func testCardScanGateReadyWhenCardFillsAndHasCode() {
        let observation = CardScanGate.Observation(
            hasBrand: false,
            hasCode: true,
            isSecondSide: false,
            hasNewCode: false,
            hasNewBrand: false,
            coverage: 0.5,
            spreadX: 0.7,
            spreadY: 0.55,
            boxCount: 3
        )
        XCTAssertTrue(CardScanGate.isReady(observation))
    }

    func testCardScanGateSecondSideNeedsFillNotJustLines() {
        let observation = CardScanGate.Observation(
            hasBrand: true,
            hasCode: true,
            isSecondSide: true,
            hasNewCode: false,
            hasNewBrand: false,
            coverage: 0.08,
            spreadX: 0.2,
            spreadY: 0.12,
            boxCount: 5
        )
        XCTAssertFalse(CardScanGate.isReady(observation))
    }

    func testLoyaltyJPEGKeepsMoreDetailThanReceiptCap() {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let image = UIGraphicsImageRenderer(size: CGSize(width: 2400, height: 1512), format: format).image { ctx in
            UIColor.red.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 2400, height: 1512))
        }
        let receipt = ScanService.compressPhoto(image)
        let loyalty = ScanService.compressLoyaltyPhoto(image)
        XCTAssertNotNil(loyalty)
        XCTAssertGreaterThan(loyalty?.count ?? 0, receipt?.count ?? 0)
        let decoded = loyalty.flatMap(UIImage.init(data:))
        XCTAssertGreaterThan(decoded?.size.width ?? 0, 1000)
    }

    func testCapturedCardCropKeepsID1Aspect() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 1200, height: 1600))
        let photo = renderer.image { ctx in
            UIColor.darkGray.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 1200, height: 1600))
            UIColor.red.setFill()
            ctx.fill(CGRect(x: 80, y: 420, width: 1040, height: 656))
        }
        let cropped = CardScanPhotos.cropCapturedCard(photo)
        XCTAssertEqual(cropped.size.width / cropped.size.height, CardScanMetrics.aspect, accuracy: 0.08)
    }

    func testLoyaltyIdentityTreatsSpacedDigitsAsTheSameCard() {
        XCTAssertTrue(LoyaltyIdentity.isSamePayload("0000 322 248 779 33", "000032224877933"))
        XCTAssertFalse(LoyaltyIdentity.isSamePayload("123", "456"))
        XCTAssertFalse(LoyaltyIdentity.isSamePayload("", "000032224877933"))
    }

    func testPassJSONGroupsUnderParagonOS() throws {
        let card = LoyaltyCard(
            programID: "costa",
            programName: "Costa",
            holderName: "Anna",
            barcodePayload: "447461001121060",
            barcodeSymbology: .qr,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )
        let pass = WalletPassBuilder.passObject(for: card)
        XCTAssertEqual(pass["organizationName"] as? String, Brand.displayName)
        XCTAssertEqual(pass["groupingIdentifier"] as? String, WalletPassBuilder.groupingIdentifier)
        let barcodes = pass["barcodes"] as? [[String: String]]
        XCTAssertEqual(barcodes?.first?["format"], "PKBarcodeFormatQR")
        XCTAssertEqual(barcodes?.first?["message"], "447461001121060")
        XCTAssertTrue(barcodes?.contains(where: { $0["format"] == "PKBarcodeFormatCode128" }) == true)
        XCTAssertNil(pass["logoText"])
        XCTAssertEqual(pass["backgroundColor"] as? String, "rgb(255, 255, 255)")
        XCTAssertEqual(pass["foregroundColor"] as? String, "rgb(29, 29, 31)")
        let store = pass["storeCard"] as? [String: Any]
        XCTAssertNil(store?["headerFields"])
        XCTAssertNil(store?["primaryFields"])
        let secondary = store?["secondaryFields"] as? [[String: String]]
        XCTAssertEqual(secondary?.count, 1)
        XCTAssertEqual(secondary?.first?["label"], "Numer")
        XCTAssertEqual(secondary?.first?["value"], "447461001121060")
        let auxiliary = store?["auxiliaryFields"] as? [[String: String]]
        XCTAssertEqual(auxiliary?.first?["label"], "Właściciel")
        XCTAssertEqual(auxiliary?.first?["value"], "Anna")
    }

    func testBarcodeTypesAreUserSelectable() {
        XCTAssertEqual(BarcodeSymbology.userSelectable.count, 5)
        XCTAssertFalse(BarcodeSymbology.userSelectable.contains(.unknown))
        XCTAssertTrue(BarcodeSymbology.userSelectable.contains(.qr))
    }

    func testInferredQRFromURL() {
        XCTAssertEqual(BarcodeSymbology.inferred(from: "https://lidlplus.com/q/abc"), .qr)
        XCTAssertEqual(BarcodeSymbology.inferred(from: "5901234567890", preferred: .unknown), .ean13)
        XCTAssertEqual(BarcodeSymbology.inferred(from: "ABC123", preferred: .code128), .code128)
    }

    @MainActor
    func testPassPackageBuildsZip() throws {
        let card = LoyaltyCard(
            programID: "kaufland",
            programName: "Kaufland",
            holderName: "Anna",
            barcodePayload: "1234567890",
            barcodeSymbology: .code128,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )
        let zip = try WalletPassBuilder.package(for: card, logo: nil)
        XCTAssertGreaterThan(zip.count, 200)
        XCTAssertEqual(zip.prefix(4), Data([0x50, 0x4b, 0x03, 0x04]))
        let names = String(data: zip, encoding: .isoLatin1) ?? ""
        XCTAssertTrue(names.contains("strip.png"))
        XCTAssertTrue(names.contains("strip@2x.png"))
        XCTAssertTrue(names.contains("strip@3x.png"))
        XCTAssertTrue(names.contains("logo.png"))
        XCTAssertTrue(names.contains("logo@3x.png"))
    }

    @MainActor
    func testSigningRequestCarriesCardAndImages() throws {
        let card = LoyaltyCard(
            programID: "orlen",
            programName: "Orlen Vitay",
            holderName: "Anna",
            barcodePayload: "5901234567890",
            barcodeSymbology: .code128,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )
        let body = try WalletPassBuilder.signingRequestBody(for: card, logo: nil)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(json["serialNumber"] as? String, card.id.uuidString)
        XCTAssertEqual(json["memberNumber"] as? String, "5901234567890")
        let images = try XCTUnwrap(json["images"] as? [String: String])
        XCTAssertEqual(images.count, 9)
        XCTAssertNotNil(images["icon.png"])
        XCTAssertNil(Bundle.main.url(forResource: "PassType", withExtension: "key"), "Signing key must not ship in the app")
    }

    func testOrlenColorIsDistinctFromBiedronka() {
        let biedronka = LoyaltyCatalog.program(id: "biedronka")
        let orlen = LoyaltyCatalog.program(id: "orlen")
        XCTAssertEqual(biedronka?.cardColorHex.uppercased(), "#E30613")
        XCTAssertEqual(orlen?.cardColorHex.uppercased(), "#E45A28")
        XCTAssertNotEqual(biedronka?.cardColorHex, orlen?.cardColorHex)
        XCTAssertTrue(LoyaltyBrandArt.hasMark("biedronka"))
        XCTAssertTrue(LoyaltyBrandArt.hasMark("orlen"))
    }

    func testLogoCropperKnocksOutWhiteBackground() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64))
        let image = renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
            UIColor.red.setFill()
            ctx.fill(CGRect(x: 16, y: 20, width: 32, height: 16))
        }
        let trimmed = LogoCropper.trim(image)
        XCTAssertLessThan(trimmed.size.width, 50)
        XCTAssertLessThan(trimmed.size.height, 40)
        XCTAssertNotNil(trimmed.cgImage)
    }

    func testLogoCropperKeepsInteriorWhiteFace() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64))
        let image = renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
            UIColor.black.setStroke()
            let ring = UIBezierPath(ovalIn: CGRect(x: 16, y: 16, width: 32, height: 32))
            ring.lineWidth = 4
            ring.stroke()
            UIColor.white.setFill()
            UIBezierPath(ovalIn: CGRect(x: 22, y: 22, width: 20, height: 20)).fill()
        }
        let trimmed = LogoCropper.trim(image)
        XCTAssertGreaterThan(trimmed.size.width, 20)
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(trimmed), 0.2)
    }

    @MainActor
    func testBiedronkaMarkReadsOnRedCard() throws {
        let program = try XCTUnwrap(LoyaltyCatalog.program(id: "biedronka"))
        let raster = try XCTUnwrap(LoyaltyBrandArt.raster(program: program, dimension: 160))
        XCTAssertGreaterThan(PassArtwork.contrastRatio(in: raster, againstHex: "#E30613"), 0.12)
        let logo = try XCTUnwrap(bundledBrandLogo(id: "biedronka"), "Biedronka PNG powinno być w bundle")
        let adapted = PassArtwork.adapted(logo, onDarkBackground: true, backgroundHex: "#E30613")
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(adapted), 0.08)
        XCTAssertGreaterThan(PassArtwork.contrastRatio(in: adapted, againstHex: "#E30613"), 0.12)
        XCTAssertLessThan(logo.size.width / max(logo.size.height, 1), 1.6)
    }

    func testGyroFoilFollowsGravity() {
        let left = GyroFoilMath.light(gravityX: -0.7, gravityY: -0.6)
        let right = GyroFoilMath.light(gravityX: 0.7, gravityY: -0.6)
        XCTAssertLessThan(left.x, right.x)
        XCTAssertGreaterThan(abs(right.x - left.x), 0.8)
    }

    func testPaperPlateWordmarkKeepsBrandInk() {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: 240, height: 80), format: format).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 240, height: 80))
            UIColor(red: 228 / 255, green: 0, blue: 43 / 255, alpha: 1).setFill()
            ctx.fill(CGRect(x: 20, y: 18, width: 50, height: 44))
            ctx.fill(CGRect(x: 90, y: 18, width: 50, height: 44))
            ctx.fill(CGRect(x: 160, y: 18, width: 50, height: 44))
        }
        let paper = LogoCropper.trim(image)
        let knocked = LogoCropper.trim(image, knockingOut: "#E4002B", punchInteriorPaper: true)
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(knocked), 0.10)
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(knocked), PassArtwork.opaqueRatio(paper) * 0.45)
    }

    func testBrandColorPlateKeepsInteriorWhiteMark() {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: 240, height: 80), format: format).image { ctx in
            UIColor(red: 0, green: 130 / 255, blue: 194 / 255, alpha: 1).setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 240, height: 80))
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 24, y: 22, width: 192, height: 36))
        }
        let knocked = LogoCropper.trim(image, knockingOut: "#0082C2", punchInteriorPaper: true)
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(knocked), 0.10)
        let adapted = PassArtwork.adapted(knocked, onDarkBackground: true, backgroundHex: "#0082C2", forceWhite: true)
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(adapted), 0.08)
        XCTAssertGreaterThan(PassArtwork.contrastRatio(in: adapted, againstHex: "#0082C2"), 0.12)
    }

    func testAuchanWordmarkSurvivesTrimAndReadsOnRed() throws {
        let logo = try XCTUnwrap(bundledBrandLogo(id: "auchan"), "Auchan PNG powinno być w bundle")
        let trimmed = LogoCropper.trim(logo)
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(trimmed), 0.04)
        let knocked = LogoCropper.trim(logo, knockingOut: "#E4002B", punchInteriorPaper: true)
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(knocked), 0.04)
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(knocked), PassArtwork.opaqueRatio(trimmed) * 0.35)
        let adapted = PassArtwork.adapted(trimmed, onDarkBackground: true, backgroundHex: "#E4002B")
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(adapted), 0.04)
        XCTAssertGreaterThan(PassArtwork.contrastRatio(in: adapted, againstHex: "#E4002B"), 0.12)
        XCTAssertEqual(LoyaltyBrandKit.spec(for: "auchan").face, .wordmark)
        XCTAssertFalse(LoyaltyBrandKit.spec(for: "auchan").whiteOnBrand)
    }

    func testPaybackBrandKitIsCanonicalWordmark() {
        XCTAssertEqual(LoyaltyBrandKit.spec(for: "payback").hex?.uppercased(), "#0033A0")
        XCTAssertEqual(LoyaltyBrandKit.spec(for: "payback").face, .wordmark)
        XCTAssertFalse(LoyaltyBrandKit.spec(for: "payback").allowsRemote)
        XCTAssertTrue(LoyaltyBrandArt.hasMark("payback"))
        XCTAssertEqual(LoyaltyCatalog.program(id: "payback")?.cardColorHex.uppercased(), "#0033A0")
    }

    @MainActor
    func testOriginalLogosStayColorfulWithHaloOnBrandField() throws {
        let biedronka = try XCTUnwrap(LoyaltyCatalog.program(id: "biedronka"))
        let ladybug = WalletPassBuilder.stripImage(
            program: biedronka,
            logo: bundledBrandLogo(id: "biedronka"),
            size: CGSize(width: 375, height: 123)
        )
        XCTAssertTrue(
            PassArtwork.isColorfulMark(ladybug) || PassArtwork.opaqueContrastRatio(in: ladybug, againstHex: biedronka.cardColorHex) > 0.08,
            "Biedronka ladybug lost black/white details"
        )

        let auchan = try XCTUnwrap(LoyaltyCatalog.program(id: "auchan"))
        let strip = WalletPassBuilder.stripImage(
            program: auchan,
            logo: bundledBrandLogo(id: "auchan"),
            size: CGSize(width: 375, height: 123)
        )
        XCTAssertGreaterThan(PassArtwork.contrastRatio(in: strip, againstHex: auchan.cardColorHex), 0.04)
        XCTAssertGreaterThan(
            PassArtwork.contrastingBounds(in: strip, againstHex: auchan.cardColorHex).width,
            120
        )
    }

    func testLogoQualityRejectsSolidFaviconTile() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 128, height: 128))
        let tile = renderer.image { ctx in
            UIColor(red: 0, green: 51 / 255, blue: 160 / 255, alpha: 1).setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 128, height: 128))
        }
        XCTAssertFalse(LogoQuality.accepts(tile))
        XCTAssertTrue(LogoQuality.looksLikeTile(tile))
        XCTAssertFalse(LoyaltyBrandKit.isUsable(tile, for: .wordmark))
    }

    func testLogoQualityRejectsWhiteSquarePlate() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 160, height: 160))
        let plate = renderer.image { ctx in
            UIColor.white.setFill()
            UIBezierPath(roundedRect: CGRect(x: 8, y: 8, width: 144, height: 144), cornerRadius: 24).fill()
        }
        XCTAssertTrue(LogoQuality.looksLikeTile(plate))
        XCTAssertFalse(LoyaltyBrandKit.isUsable(plate, for: .wordmark))
    }

    @MainActor
    func testCanonicalWalletFacesAreOriginalWordmarksNotTiles() throws {
        try assertCanonicalFace(id: "auchan", minAspect: 2.0)
        try assertCanonicalFace(id: "payback", minAspect: 2.0)
        try assertCanonicalFace(id: "biedronka", minAspect: 1.65)
        try assertCanonicalFace(id: "zabka", minAspect: 1.6)
        try assertCanonicalFace(id: "kaufland", minAspect: 0.85)
        try assertCanonicalFace(id: "decathlon", minAspect: 2.0)
        try assertCanonicalFace(id: "rossmann", minAspect: 2.0)
        try assertCanonicalFace(id: "hebe", minAspect: 1.6)
        try assertCanonicalFace(id: "costa", minAspect: 1.4)
        try assertCanonicalFace(id: "lidlplus", minAspect: 0.7)
        try assertCanonicalFace(id: "ikea", minAspect: 0.7)
    }

    @MainActor
    func testEveryCatalogBrandHasCanonicalFaceOnWalletAndCard() throws {
        XCTAssertGreaterThan(LoyaltyCatalog.all.count, 40)
        for program in LoyaltyCatalog.all {
            let spec = LoyaltyBrandKit.spec(for: program.id)
            XCTAssertFalse(spec.allowsRemote, program.id)
            XCTAssertEqual(spec.stripWord, LoyaltyBrandKit.originalWord(for: program.id), program.id)
            try assertWalletStripHasMark(id: program.id)
            let minAspect: CGFloat
            switch spec.face {
            case .wordmark:
                minAspect = program.name.count <= 4 ? 0.7 : 1.35
            case .markAndName:
                minAspect = 1.45
            case .lockup:
                minAspect = 0.65
            }
            try assertCanonicalFace(id: program.id, minAspect: minAspect)
        }
    }

    @MainActor
    func testDecathlonAndOrlenStripsAreWordmarksNotFilledPlates() throws {
        for id in ["decathlon", "orlen"] {
            let program = try XCTUnwrap(LoyaltyCatalog.program(id: id))
            let strip = WalletPassBuilder.stripImage(
                program: program,
                logo: bundledBrandLogo(id: id),
                size: CGSize(width: 375, height: 123)
            )
            let ratio = PassArtwork.contrastRatio(in: strip, againstHex: program.cardColorHex)
            XCTAssertGreaterThan(ratio, 0.03, id)
            let box = PassArtwork.contrastingBounds(in: strip, againstHex: program.cardColorHex)
            XCTAssertGreaterThan(box.width / max(box.height, 1), 1.6, "\(id) \(box)")
        }
    }

    @MainActor
    func testPaybackWalletStripIgnoresJunkFavicon() throws {
        let program = try XCTUnwrap(LoyaltyCatalog.program(id: "payback"))
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 128, height: 128))
        let junk = renderer.image { ctx in
            UIColor(red: 0, green: 51 / 255, blue: 160 / 255, alpha: 1).setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 128, height: 128))
        }
        let strip = WalletPassBuilder.stripImage(
            program: program,
            logo: junk,
            size: CGSize(width: 375, height: 123)
        )
        let box = PassArtwork.contrastingBounds(in: strip, againstHex: program.cardColorHex)
        XCTAssertGreaterThan(box.width / max(box.height, 1), 2.0, "Payback strip became a tile (\(box))")
        XCTAssertGreaterThan(PassArtwork.contrastRatio(in: strip, againstHex: program.cardColorHex), 0.04)
    }

    @MainActor
    func testPaybackBundledWordmarkIsUsable() throws {
        let logo = try XCTUnwrap(bundledBrandLogo(id: "payback"), "Payback PNG powinno być w bundle")
        let trimmed = LogoCropper.trim(logo)
        XCTAssertFalse(LogoQuality.looksLikeTile(trimmed))
        XCTAssertTrue(LoyaltyBrandKit.isUsable(trimmed, for: .wordmark))
    }

    func testCatalogBrandsNeverUseRemoteFavicons() {
        for program in LoyaltyCatalog.all {
            let spec = LoyaltyBrandKit.spec(for: program.id)
            XCTAssertFalse(spec.allowsRemote, "Remote favicon for \(program.id) makes quality random")
            let expected: String
            switch program.id {
            case "biedronka":
                expected = "biedronka"
            case "hebe":
                expected = "hebe"
            case "orlen":
                expected = "ORLEN"
            case "rossmann", "rossmannclub":
                expected = "ROSSMANN"
            default:
                expected = program.name
            }
            XCTAssertEqual(LoyaltyBrandKit.originalWord(for: program.id), expected, program.id)
        }
    }

    func testZabkaAndKauflandUseOriginalLockupsNotGenericLetters() {
        XCTAssertEqual(LoyaltyBrandKit.spec(for: "zabka").face, .wordmark)
        XCTAssertEqual(LoyaltyBrandKit.spec(for: "kaufland").face, .lockup)
        XCTAssertEqual(LoyaltyBrandKit.spec(for: "decathlon").face, .wordmark)
        XCTAssertEqual(LoyaltyBrandKit.spec(for: "hebe").face, .wordmark)
        XCTAssertEqual(LoyaltyBrandKit.spec(for: "starbucks").face, .markAndName)
    }

    @MainActor
    func testEveryCatalogProgramHasReadableWalletStrip() throws {
        XCTAssertGreaterThan(LoyaltyCatalog.all.count, 40)
        for program in LoyaltyCatalog.all {
            let logo = bundledBrandLogo(id: program.id)
            let strip = WalletPassBuilder.stripImage(
                program: program,
                logo: logo,
                size: CGSize(width: 375, height: 123)
            )
            let ratio = PassArtwork.contrastRatio(in: strip, againstHex: program.cardColorHex)
            XCTAssertGreaterThan(ratio, 0.03, "Unreadable Wallet strip for \(program.id) (\(ratio))")
        }
    }

    func testLogoColorSamplerReadsSaturatedMark() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 32, height: 32))
        let image = renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 32, height: 32))
            UIColor(red: 0.89, green: 0.35, blue: 0.16, alpha: 1).setFill()
            ctx.fill(CGRect(x: 6, y: 6, width: 20, height: 20))
        }
        let color = LogoColorSampler.accent(from: image)
        XCTAssertNotNil(color)
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        color?.getRed(&r, green: &g, blue: &b, alpha: nil)
        XCTAssertGreaterThan(r, g)
        XCTAssertGreaterThan(r, b)
    }

    func testGroupsTwoCardsFromTheSameProgram() {
        let first = LoyaltyCard(
            programID: "auchan",
            programName: "Auchan",
            holderName: "Anna",
            barcodePayload: "111",
            barcodeSymbology: .code128,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )
        let second = LoyaltyCard(
            programID: "auchan",
            programName: "Auchan",
            holderName: "Marek",
            barcodePayload: "222",
            barcodeSymbology: .code128,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )
        let ikea = LoyaltyCard(
            programID: "ikea",
            programName: "IKEA Family",
            holderName: "",
            barcodePayload: "333",
            barcodeSymbology: .code128,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )
        let groups = LoyaltyProgramGroup.groups(from: [first, ikea, second])
        XCTAssertEqual(groups.count, 2)
        XCTAssertEqual(groups[0].programID, "auchan")
        XCTAssertEqual(groups[0].cards.count, 2)
        XCTAssertEqual(groups[1].programID, "ikea")
    }

    func testCollapsedStackHeightUsesPeekPlusLastCard() {
        XCTAssertEqual(LoyaltyPassStackMetrics.collapsedHeight(count: 0), 0)
        XCTAssertEqual(LoyaltyPassStackMetrics.collapsedHeight(count: 1), LoyaltyPassStackMetrics.cardHeight)
        XCTAssertEqual(
            LoyaltyPassStackMetrics.collapsedHeight(count: 8),
            LoyaltyPassStackMetrics.cardHeight + 7 * LoyaltyPassStackMetrics.peek
        )
        XCTAssertEqual(
            LoyaltyPassStackMetrics.rowHeight(index: 0, count: 8, expanded: false),
            LoyaltyPassStackMetrics.peek
        )
        XCTAssertEqual(
            LoyaltyPassStackMetrics.rowHeight(index: 7, count: 8, expanded: false),
            LoyaltyPassStackMetrics.cardHeight
        )
        XCTAssertEqual(
            LoyaltyPassStackMetrics.rowHeight(index: 0, count: 8, expanded: true),
            LoyaltyPassStackMetrics.cardHeight
        )
        XCTAssertEqual(LoyaltyPassStackMetrics.step(spread: 0), LoyaltyPassStackMetrics.peek, accuracy: 0.001)
        XCTAssertEqual(LoyaltyPassStackMetrics.step(spread: 1), LoyaltyPassStackMetrics.expandedStep, accuracy: 0.001)
        XCTAssertGreaterThan(LoyaltyPassStackMetrics.stackHeight(count: 5, spread: 1), LoyaltyPassStackMetrics.stackHeight(count: 5, spread: 0))
    }

    func testFanSpacingFillsShortViewportAndKeepsMinimumWhenTall() {
        let tight = LoyaltyPassStackMetrics.fanSpacing(count: 8, viewport: 400)
        XCTAssertEqual(tight, 8)
        let roomy = LoyaltyPassStackMetrics.fanSpacing(count: 3, viewport: 2000)
        XCTAssertEqual(roomy, 14)
        XCTAssertEqual(LoyaltyPassStackMetrics.fanSpacing(count: 1, viewport: 800), 0)
        XCTAssertEqual(PassStackMotion.response, 0.36, accuracy: 0.001)
        XCTAssertEqual(PassStackMotion.damping, 0.88, accuracy: 0.001)
        XCTAssertEqual(LoyaltyCardPass.stackPeek, 54, accuracy: 0.001)
        XCTAssertEqual(LoyaltyCardPass.stackHeight, 212, accuracy: 0.001)
        XCTAssertEqual(ParagonTheme.passCorner, 22, accuracy: 0.001)
        XCTAssertEqual(ParagonTheme.pressScale, 0.985, accuracy: 0.001)
        XCTAssertEqual(ParagonTheme.springResponse, PassStackMotion.response, accuracy: 0.001)
    }

    func testRetailerIDsResolveToLoyaltyProgramsWithDomains() {
        XCTAssertEqual(LoyaltyCatalog.programForRetailer("biedronka").domain, "biedronka.pl")
        XCTAssertEqual(LoyaltyCatalog.programForRetailer("kaufland").id, "kaufland")
        XCTAssertEqual(LoyaltyCatalog.programForRetailer("lidl").id, "lidlplus")
        XCTAssertEqual(LoyaltyCatalog.programForRetailer("ikea").id, "ikea")
        XCTAssertEqual(LoyaltyCatalog.programForRetailer("zabka").domain, "zabka.pl")
        XCTAssertEqual(LoyaltyCatalog.programForRetailer("x-kom").id, "xkom")
        XCTAssertEqual(LoyaltyCatalog.programForRetailer("x-kom").domain, "x-kom.pl")
    }

    func testReceiptStoreLogosKeepRealMarks() throws {
        for id in ["xkom", "action", "dyson", "house", "mediamarkt"] {
            XCTAssertNotNil(LoyaltyBrandKit.bundledLogo(for: id), "Brak bundled logo \(id)")
            XCTAssertFalse(StoreLogoPolicy.shouldFetchRemote(for: LoyaltyCatalog.programForRetailer(id)))
        }
        for id in ["xkom", "action", "dyson", "house"] {
            XCTAssertTrue(LoyaltyBrandArt.hasMark(id), id)
        }

        let xkom = ReceiptStoreBrand.program(forMerchant: "x-kom")
        XCTAssertEqual(xkom.id, "xkom")
        XCTAssertEqual(xkom.domain, "x-kom.pl")

        let media = ReceiptStoreBrand.program(forMerchant: "MediaMarkt")
        XCTAssertEqual(media.id, "mediamarkt")

        let house = ReceiptStoreBrand.program(forMerchant: "House")
        XCTAssertEqual(house.id, "house")

        let action = ReceiptStoreBrand.program(forMerchant: "Action")
        XCTAssertEqual(action.id, "action")

        let dyson = ReceiptStoreBrand.program(forMerchant: "Dyson")
        XCTAssertEqual(dyson.id, "dyson")
        XCTAssertEqual(dyson.domain, "dyson.com")
        XCTAssertNotEqual(dyson.id, house.id)

        let payback = try XCTUnwrap(LoyaltyCatalog.program(id: "payback"))
        XCTAssertFalse(StoreLogoPolicy.shouldFetchRemote(for: payback))
        XCTAssertFalse(LoyaltyBrandKit.spec(for: "xkom").allowsRemote)
    }

    func testCardScanMetricsMatchesID1() {
        XCTAssertEqual(CardScanMetrics.aspect, 85.60 / 53.98, accuracy: 0.0001)
        let size = CardScanMetrics.size(fitting: 320, maxHeight: 180)
        XCTAssertEqual(size.width / size.height, CardScanMetrics.aspect, accuracy: 0.001)
        XCTAssertLessThanOrEqual(size.width, 320)
        XCTAssertLessThanOrEqual(size.height, 180)
        XCTAssertGreaterThan(size.width, size.height)
    }

    func testNewProgramsAreInCatalogAndMatchOCR() {
        for id in ["selgros", "okko", "fishka", "wog", "ukrnafta", "socar", "silpo", "atb", "novus", "varus", "fora", "metro", "epicentr", "rozetka", "comfy", "foxtrot", "eva", "novaposhta"] {
            XCTAssertNotNil(LoyaltyCatalog.program(id: id), id)
        }
        XCTAssertEqual(LoyaltyCatalog.match(ocrText: "Selgros Cash & Carry", barcode: "")?.id, "selgros")
        XCTAssertEqual(LoyaltyCatalog.match(ocrText: "OKKO", barcode: "")?.id, "okko")
        XCTAssertEqual(LoyaltyCatalog.match(ocrText: "FISHKA", barcode: "")?.id, "fishka")
        XCTAssertEqual(LoyaltyCatalog.match(ocrText: "WOG club", barcode: "")?.id, "wog")
        XCTAssertEqual(LoyaltyCatalog.match(ocrText: "Сільпо", barcode: "")?.id, "silpo")
        XCTAssertEqual(LoyaltyCatalog.match(ocrText: "АТБ", barcode: "")?.id, "atb")
        XCTAssertEqual(LoyaltyCatalog.match(ocrText: "Нова Пошта", barcode: "")?.id, "novaposhta")
        XCTAssertTrue(LoyaltyBrandArt.hasMark("selgros"))
        XCTAssertTrue(LoyaltyBrandArt.hasMark("okko"))
        XCTAssertTrue(LoyaltyBrandArt.hasMark("wog"))
        XCTAssertTrue(LoyaltyBrandArt.hasMark("silpo"))
        XCTAssertTrue(LoyaltyBrandArt.hasMark("atb"))
    }

    func testPassArtworkKeepsIKEAYellowOvalOnBlueField() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 120, height: 80))
        let image = renderer.image { ctx in
            UIColor(red: 0, green: 88 / 255, blue: 163 / 255, alpha: 1).setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 120, height: 80))
            UIColor(red: 1, green: 218 / 255, blue: 26 / 255, alpha: 1).setFill()
            UIBezierPath(ovalIn: CGRect(x: 20, y: 18, width: 80, height: 44)).fill()
        }
        let adapted = PassArtwork.adapted(image, onDarkBackground: true, backgroundHex: "#0058A3")
        XCTAssertGreaterThan(PassArtwork.opaqueRatio(adapted), 0.08)
        XCTAssertGreaterThan(PassArtwork.contrastRatio(in: adapted, againstHex: "#0058A3"), 0.18)
    }

    @MainActor
    func testIKEAAndLidlPlusWalletStripsAreNotEmpty() throws {
        try assertWalletStripHasMark(id: "ikea")
        try assertWalletStripHasMark(id: "lidlplus")
    }

    @MainActor
    func testWalletStripsKeepMarksForBundledLogosAndVectors() throws {
        let urls = bundledBrandLogoURLs()
        XCTAssertGreaterThan(urls.count, 10)
        for url in urls {
            let id = url.deletingPathExtension().lastPathComponent
            try assertWalletStripHasMark(id: id, logo: UIImage(contentsOfFile: url.path))
        }
        for program in LoyaltyCatalog.all where LoyaltyBrandArt.hasMark(program.id) {
            try assertWalletStripHasMark(id: program.id)
        }
    }

    @MainActor
    func testIKEAPackageStripPNGIsNotUniform() throws {
        let program = try XCTUnwrap(LoyaltyCatalog.program(id: "ikea"))
        let card = LoyaltyCard(
            programID: program.id,
            programName: program.name,
            holderName: "Anna",
            barcodePayload: "1234567890123",
            barcodeSymbology: .code128,
            note: "",
            photoData: nil,
            scannedByName: "",
            ocrText: ""
        )
        let logo = bundledBrandLogo(id: program.id) ?? LoyaltyBrandArt.raster(program: program, dimension: 256)
        let zip = try WalletPassBuilder.package(for: card, logo: logo)
        XCTAssertTrue((String(data: zip, encoding: .isoLatin1) ?? "").contains("strip.png"))
        let strip = WalletPassBuilder.stripImage(
            program: program,
            logo: logo,
            size: CGSize(width: 375, height: 123)
        )
        XCTAssertGreaterThan(PassArtwork.contrastRatio(in: strip, againstHex: program.cardColorHex), 0.01)
    }

    @MainActor
    private func assertCanonicalFace(id: String, minAspect: CGFloat, file: StaticString = #filePath, line: UInt = #line) throws {
        let program = try XCTUnwrap(LoyaltyCatalog.program(id: id), "Missing program \(id)", file: file, line: line)
        let logo = bundledBrandLogo(id: id) ?? LoyaltyBrandArt.raster(program: program, dimension: 256)
        let strip = WalletPassBuilder.stripImage(
            program: program,
            logo: logo,
            size: CGSize(width: 375, height: 123)
        )
        let box = PassArtwork.contrastingBounds(in: strip, againstHex: program.cardColorHex)
        XCTAssertGreaterThan(
            box.width / max(box.height, 1),
            minAspect,
            "\(id) strip is not a wide original face \(box)",
            file: file,
            line: line
        )
        XCTAssertGreaterThan(
            PassArtwork.contrastRatio(in: strip, againstHex: program.cardColorHex),
            0.04,
            "Empty or low-contrast Wallet strip for \(id)",
            file: file,
            line: line
        )
    }

    @MainActor
    private func assertWalletStripHasMark(id: String, logo: UIImage? = nil, file: StaticString = #filePath, line: UInt = #line) throws {
        let program = try XCTUnwrap(LoyaltyCatalog.program(id: id), "Missing program \(id)", file: file, line: line)
        let source = logo ?? bundledBrandLogo(id: id) ?? LoyaltyBrandArt.raster(program: program, dimension: 256)
        let strip = WalletPassBuilder.stripImage(
            program: program,
            logo: source,
            size: CGSize(width: 375, height: 123)
        )
        let ratio = PassArtwork.contrastRatio(in: strip, againstHex: program.cardColorHex)
        XCTAssertGreaterThan(ratio, 0.01, "Empty Wallet strip for \(id) (\(ratio))", file: file, line: line)
    }

    private func bundledBrandLogo(id: String) -> UIImage? {
        guard let url = bundledBrandLogoURL(id: id) else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    private func bundledBrandLogoURL(id: String) -> URL? {
        Bundle.main.url(forResource: id, withExtension: "png", subdirectory: "BrandLogos")
            ?? Bundle.main.url(forResource: id, withExtension: "png")
    }

    private func bundledBrandLogoURLs() -> [URL] {
        if let nested = Bundle.main.urls(forResourcesWithExtension: "png", subdirectory: "BrandLogos"), nested.isEmpty == false {
            return nested
        }
        return LoyaltyCatalog.all.compactMap { bundledBrandLogoURL(id: $0.id) }
    }
}

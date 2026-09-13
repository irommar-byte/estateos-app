import Foundation
import SwiftData
import SwiftUI

struct LoyaltyProgram: Identifiable, Equatable, Hashable, Codable {
    var id: String
    var name: String
    var programName: String
    var domain: String
    var color: String
    var keywords: [String]
    var barcode: String
    var logoURL: String? = nil

    var preferredBarcode: BarcodeSymbology {
        BarcodeSymbology(rawValue: barcode) ?? .code128
    }

    var brandColor: Color { Color(hex: cardColorHex) }

    var cardColorHex: String {
        LoyaltyBrandArt.hex(for: id) ?? color
    }

    var onColor: Color {
        brandColor.relativeLuminance > 0.62 ? Color.black : Color.white
    }

    var monogram: String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first }.map(String.init)
        if letters.isEmpty { return "•" }
        return letters.joined().uppercased()
    }

    static func custom(name: String) -> LoyaltyProgram {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return LoyaltyProgram(
            id: "custom",
            name: trimmed.isEmpty ? "Inny sklep" : trimmed,
            programName: trimmed.isEmpty ? "Karta lojalnościowa" : trimmed,
            domain: "",
            color: "#3A3A3C",
            keywords: [],
            barcode: BarcodeSymbology.code128.rawValue
        )
    }
}

struct LoyaltyDraft: Equatable {
    var programID: String
    var programName: String
    var holderName: String
    var barcodePayload: String
    var barcodeSymbology: BarcodeSymbology
    var note: String
    var ocrText: String
    var ocrConfidence: Double
    var needsProgramPick: Bool

    var program: LoyaltyProgram {
        if let found = LoyaltyCatalog.program(id: programID) {
            var copy = found
            if programName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
                copy.programName = programName
            }
            return copy
        }
        return LoyaltyProgram.custom(name: programName)
    }

    var canSave: Bool {
        barcodePayload.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            && programName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
    }

    static func blank(program: LoyaltyProgram? = nil) -> LoyaltyDraft {
        LoyaltyDraft(
            programID: program?.id ?? "",
            programName: program?.name ?? "",
            holderName: "",
            barcodePayload: "",
            barcodeSymbology: program?.preferredBarcode ?? .code128,
            note: "",
            ocrText: "",
            ocrConfidence: 0,
            needsProgramPick: program == nil
        )
    }
}

@Model
final class LoyaltyCard {
    var id: UUID = UUID()
    var programID: String = ""
    var programName: String = ""
    var holderName: String = ""
    var barcodePayload: String = ""
    var barcodeSymbologyRaw: String = BarcodeSymbology.code128.rawValue
    var note: String = ""
    var photoData: Data?
    var scannedByName: String = ""
    var familyShareID: String?
    var addedToAppleWallet: Bool = false
    var ocrText: String = ""
    var createdAt: Date = Date()
    var updatedAt: Date = Date()

    init(
        id: UUID = UUID(),
        programID: String,
        programName: String,
        holderName: String,
        barcodePayload: String,
        barcodeSymbology: BarcodeSymbology,
        note: String,
        photoData: Data?,
        scannedByName: String,
        ocrText: String
    ) {
        self.id = id
        self.programID = programID
        self.programName = programName
        self.holderName = holderName
        self.barcodePayload = barcodePayload
        self.barcodeSymbologyRaw = barcodeSymbology.rawValue
        self.note = note
        self.photoData = photoData
        self.scannedByName = scannedByName
        self.ocrText = ocrText
        self.createdAt = Date()
        self.updatedAt = Date()
    }

    var barcodeSymbology: BarcodeSymbology {
        get { BarcodeSymbology(rawValue: barcodeSymbologyRaw) ?? .code128 }
        set { barcodeSymbologyRaw = newValue.rawValue }
    }

    var program: LoyaltyProgram {
        if let found = LoyaltyCatalog.program(id: programID) { return found }
        return LoyaltyProgram.custom(name: programName)
    }

    var displayName: String {
        let name = programName.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.isEmpty == false { return name }
        return program.name
    }
}

enum LoyaltyRoute: Hashable {
    case settings
    case card(UUID)
}

enum LoyaltyParser {
    static func parse(lines: [String], barcodes: [DetectedBarcode]) -> LoyaltyDraft {
        let chosen = preferredBarcode(barcodes) ?? printedBarcode(in: lines)
        let payload = chosen?.payload.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let ocr = lines.joined(separator: "\n")
        let match = LoyaltyCatalog.match(ocrText: ocr, barcode: payload)
        let scanned = chosen?.symbology ?? .unknown
        let inferred = BarcodeSymbology.resolved(scanned: scanned, payload: payload, catalogHint: match?.preferredBarcode)
        return LoyaltyDraft(
            programID: match?.id ?? "",
            programName: match?.name ?? "",
            holderName: "",
            barcodePayload: payload,
            barcodeSymbology: inferred,
            note: "",
            ocrText: ocr,
            ocrConfidence: match == nil ? 0.35 : 0.88,
            needsProgramPick: match == nil
        )
    }

    static func preferredBarcode(_ barcodes: [DetectedBarcode]) -> DetectedBarcode? {
        var seen = Set<String>()
        var unique: [DetectedBarcode] = []
        for barcode in barcodes {
            let payload = barcode.payload.trimmingCharacters(in: .whitespacesAndNewlines)
            guard payload.isEmpty == false, seen.contains(payload) == false else { continue }
            seen.insert(payload)
            unique.append(DetectedBarcode(payload: payload, symbology: barcode.symbology))
        }
        return unique.max(by: { score($0) < score($1) })
    }

    private static func score(_ barcode: DetectedBarcode) -> Int {
        let payload = barcode.payload
        let folded = payload.lowercased()
        let isURL = folded.contains("http") || folded.contains("www.") || folded.contains("://")
        let digits = payload.filter(\.isNumber)
        var value = digits.count
        if isURL {
            value += 2
        } else {
            value += 12
        }
        if digits.count >= 8, digits.count == payload.filter({ $0.isNumber || $0.isLetter }).count {
            value += 8
        }
        switch barcode.symbology {
        case .ean13, .code128: value += 4
        case .qr where isURL == false: value += 5
        default: break
        }
        return value
    }

    private static func printedBarcode(in lines: [String]) -> DetectedBarcode? {
        let text = lines.joined(separator: "\n")
        let ns = text as NSString
        let regex = try! NSRegularExpression(pattern: #"(?<!\d)(\d[\d\s]{6,22}\d)(?!\d)"#)
        var best: String?
        regex.enumerateMatches(in: text, range: NSRange(location: 0, length: ns.length)) { match, _, _ in
            guard let match, match.numberOfRanges >= 2 else { return }
            let compact = ns.substring(with: match.range(at: 1)).filter(\.isNumber)
            guard (8...22).contains(compact.count) else { return }
            if compact.count >= (best?.count ?? 0) {
                best = compact
            }
        }
        guard let best else { return nil }
        return DetectedBarcode(payload: best, symbology: .unknown)
    }
}

extension BarcodeSymbology {
    static func resolved(scanned: BarcodeSymbology, payload: String, catalogHint: BarcodeSymbology? = nil) -> BarcodeSymbology {
        if scanned != .unknown { return scanned }
        if let catalogHint, catalogHint != .unknown { return catalogHint }
        return inferred(from: payload)
    }

    static func inferred(from payload: String, preferred: BarcodeSymbology = .unknown) -> BarcodeSymbology {
        if preferred != .unknown { return preferred }
        let trimmed = payload.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.isEmpty == false else { return .code128 }
        if trimmed.lowercased().contains("http") || trimmed.contains("\n") || trimmed.count > 48 {
            return .qr
        }
        let digits = trimmed.filter(\.isNumber)
        if digits.count == trimmed.count, trimmed.count == 13 || trimmed.count == 8 {
            return .ean13
        }
        return .code128
    }

    static func canEncodeCode128(_ payload: String) -> Bool {
        let trimmed = payload.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...48).contains(trimmed.count) else { return false }
        return trimmed.unicodeScalars.allSatisfy { scalar in
            scalar.value < 128 && scalar != "\n" && scalar != "\r"
        }
    }

    var pkPassFormat: String {
        switch self {
        case .qr: return "PKBarcodeFormatQR"
        case .pdf417: return "PKBarcodeFormatPDF417"
        case .aztec: return "PKBarcodeFormatAztec"
        default: return "PKBarcodeFormatCode128"
        }
    }
}

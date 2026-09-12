import Foundation
import SwiftData

enum TicketKind: String, Codable, CaseIterable {
    case depositVoucher
    case receipt
}

enum TicketLifecycleStatus: String, Codable, CaseIterable, Identifiable {
    case active
    case redeemed
    case expired

    var id: String { rawValue }

    var title: String {
        switch self {
        case .active: return "Aktywny"
        case .redeemed: return "Wykorzystany"
        case .expired: return "Przeterminowany"
        }
    }
}

enum BarcodeSymbology: String, Codable, CaseIterable {
    case code128
    case qr
    case ean13
    case pdf417
    case aztec
    case unknown

    var title: String {
        switch self {
        case .code128: return "Code 128"
        case .qr: return "QR"
        case .ean13: return "EAN-13"
        case .pdf417: return "PDF417"
        case .aztec: return "Aztec"
        case .unknown: return "Kod"
        }
    }
}

@Model
final class Ticket {
    var id: UUID = UUID()
    var kindRaw: String = TicketKind.depositVoucher.rawValue
    var retailerID: String = "unknown"
    var amount: Double = 0
    var issuedAt: Date = Date()
    var expiresAt: Date?
    var barcodePayload: String = ""
    var barcodeSymbologyRaw: String = BarcodeSymbology.unknown.rawValue
    var ticketNumber: String = ""
    var photoData: Data?
    var statusRaw: String = TicketLifecycleStatus.active.rawValue
    var redeemedAt: Date?
    var scannedByName: String = ""
    var redeemedByName: String = ""
    var ocrConfidence: Double = 0
    var note: String = ""
    var createdAt: Date = Date()
    var familyWalletID: String?
    var updatedAt: Date = Date()

    init(
        id: UUID = UUID(),
        retailerID: String,
        amount: Double,
        issuedAt: Date,
        expiresAt: Date?,
        barcodePayload: String,
        barcodeSymbology: BarcodeSymbology,
        ticketNumber: String,
        photoData: Data?,
        scannedByName: String,
        ocrConfidence: Double
    ) {
        self.id = id
        self.kindRaw = TicketKind.depositVoucher.rawValue
        self.retailerID = retailerID
        self.amount = amount
        self.issuedAt = issuedAt
        self.expiresAt = expiresAt
        self.barcodePayload = barcodePayload
        self.barcodeSymbologyRaw = barcodeSymbology.rawValue
        self.ticketNumber = ticketNumber
        self.photoData = photoData
        self.statusRaw = TicketLifecycleStatus.active.rawValue
        self.scannedByName = scannedByName
        self.ocrConfidence = ocrConfidence
        self.createdAt = Date()
        self.updatedAt = Date()
    }

    var kind: TicketKind {
        get { TicketKind(rawValue: kindRaw) ?? .depositVoucher }
        set { kindRaw = newValue.rawValue }
    }

    var barcodeSymbology: BarcodeSymbology {
        get { BarcodeSymbology(rawValue: barcodeSymbologyRaw) ?? .unknown }
        set { barcodeSymbologyRaw = newValue.rawValue }
    }

    var storedStatus: TicketLifecycleStatus {
        get { TicketLifecycleStatus(rawValue: statusRaw) ?? .active }
        set { statusRaw = newValue.rawValue }
    }

    var photoImage: Data? { photoData }

    var displayBarcode: String {
        CheckoutCode.payload(barcode: barcodePayload, ticketNumber: ticketNumber)
    }
}

enum WalletRoute: Hashable {
    case settings
    case ticket(UUID)
}

enum CheckoutCode {
    static func payload(barcode: String, ticketNumber: String) -> String {
        let trimmed = barcode.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty == false { return trimmed }
        let digits = ticketNumber.filter(\.isNumber)
        if digits.count >= 16 { return digits }
        return ""
    }
}

@Model
final class AppProfile {
    var id: String = "singleton"
    var displayName: String = ""
    var familyWalletID: String?
    var updatedAt: Date = Date()

    init(displayName: String = "") {
        self.id = "singleton"
        self.displayName = displayName
        self.updatedAt = Date()
    }
}

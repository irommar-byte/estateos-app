import Foundation
import SwiftData
import SwiftUI

enum ScanIntent: String, Equatable {
    case deposit
    case receipt
}

enum ReceiptDocumentType: String, Codable, CaseIterable, Identifiable {
    case receipt
    case invoice

    var id: String { rawValue }

    var title: String {
        switch self {
        case .receipt: return "Paragon"
        case .invoice: return "Faktura"
        }
    }
}

enum ReceiptPaymentMethod: String, Codable, CaseIterable, Identifiable {
    case unknown
    case cash
    case card
    case blik
    case transfer

    var id: String { rawValue }

    var title: String {
        switch self {
        case .unknown: return "Nie rozpoznano"
        case .cash: return "Gotówka"
        case .card: return "Karta"
        case .blik: return "BLIK"
        case .transfer: return "Przelew"
        }
    }

    static func fromStored(_ raw: String) -> ReceiptPaymentMethod {
        if let value = ReceiptPaymentMethod(rawValue: raw) { return value }
        let folded = raw.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pl_PL"))
        if folded.contains("blik") { return .blik }
        if folded.contains("przelew") { return .transfer }
        if folded.contains("gotow") || folded.contains("cash") { return .cash }
        if folded.contains("karta") || folded.contains("visa") || folded.contains("mastercard") { return .card }
        return .unknown
    }
}

enum ReceiptCategory: String, Codable, CaseIterable, Identifiable {
    case elektronika
    case rtv
    case agd
    case samochod
    case paliwo
    case ubrania
    case buty
    case rozrywka
    case spozywcze
    case zdrowie
    case dom
    case dzieci
    case sport
    case uslugi
    case inne

    var id: String { rawValue }

    var title: String {
        switch self {
        case .elektronika: return "Elektronika"
        case .rtv: return "RTV"
        case .agd: return "AGD"
        case .samochod: return "Samochód"
        case .paliwo: return "Paliwo"
        case .ubrania: return "Ubrania"
        case .buty: return "Buty"
        case .rozrywka: return "Rozrywka"
        case .spozywcze: return "Spożywcze"
        case .zdrowie: return "Zdrowie"
        case .dom: return "Dom"
        case .dzieci: return "Dzieci"
        case .sport: return "Sport"
        case .uslugi: return "Usługi"
        case .inne: return "Inne"
        }
    }

    var symbol: String {
        switch self {
        case .elektronika: return "laptopcomputer"
        case .rtv: return "tv"
        case .agd: return "washer"
        case .samochod: return "car.fill"
        case .paliwo: return "fuelpump.fill"
        case .ubrania: return "tshirt.fill"
        case .buty: return "shoe.fill"
        case .rozrywka: return "ticket.fill"
        case .spozywcze: return "cart.fill"
        case .zdrowie: return "cross.case.fill"
        case .dom: return "house.fill"
        case .dzieci: return "figure.and.child.holdinghands"
        case .sport: return "figure.run"
        case .uslugi: return "wrench.and.screwdriver.fill"
        case .inne: return "square.grid.2x2.fill"
        }
    }

    var color: Color {
        switch self {
        case .elektronika: return Color(red: 0.20, green: 0.48, blue: 0.96)
        case .rtv: return Color(red: 0.40, green: 0.32, blue: 0.86)
        case .agd: return Color(red: 0.18, green: 0.62, blue: 0.72)
        case .samochod: return Color(red: 0.18, green: 0.22, blue: 0.32)
        case .paliwo: return Color(red: 0.92, green: 0.52, blue: 0.10)
        case .ubrania: return Color(red: 0.86, green: 0.28, blue: 0.48)
        case .buty: return Color(red: 0.62, green: 0.38, blue: 0.22)
        case .rozrywka: return Color(red: 0.92, green: 0.28, blue: 0.32)
        case .spozywcze: return Color(red: 0.22, green: 0.68, blue: 0.36)
        case .zdrowie: return Color(red: 0.18, green: 0.64, blue: 0.58)
        case .dom: return Color(red: 0.78, green: 0.48, blue: 0.22)
        case .dzieci: return Color(red: 0.96, green: 0.62, blue: 0.18)
        case .sport: return Color(red: 0.12, green: 0.56, blue: 0.42)
        case .uslugi: return Color(red: 0.42, green: 0.45, blue: 0.52)
        case .inne: return Color(red: 0.55, green: 0.55, blue: 0.58)
        }
    }

    var warrantyMonths: Int? {
        switch self {
        case .elektronika, .rtv, .agd, .samochod: return 24
        default: return nil
        }
    }

    var returnDays: Int? {
        switch self {
        case .ubrania, .buty, .elektronika, .rtv, .agd, .rozrywka, .sport: return 14
        default: return nil
        }
    }
}

struct ReceiptDraft: Equatable {
    var merchantName: String
    var merchantNIP: String
    var amount: Double
    var taxAmount: Double
    var issuedAt: Date
    var category: ReceiptCategory
    var documentType: ReceiptDocumentType
    var documentNumber: String
    var payment: ReceiptPaymentMethod
    var itemName: String
    var ocrText: String
    var ocrConfidence: Double
    var issuedWasPrinted: Bool
    var warrantyUntil: Date?
    var returnUntil: Date?

    var scanIsComplete: Bool {
        amount > 0 && merchantName.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
    }

    static func blank(now: Date = .now) -> ReceiptDraft {
        ReceiptDraft(
            merchantName: "",
            merchantNIP: "",
            amount: 0,
            taxAmount: 0,
            issuedAt: now,
            category: .inne,
            documentType: .receipt,
            documentNumber: "",
            payment: .unknown,
            itemName: "",
            ocrText: "",
            ocrConfidence: 0,
            issuedWasPrinted: false,
            warrantyUntil: nil,
            returnUntil: nil
        )
    }
}

@Model
final class Receipt {
    var id: UUID = UUID()
    var merchantName: String = ""
    var merchantNIP: String = ""
    var amount: Double = 0
    var taxAmount: Double = 0
    var issuedAt: Date = Date()
    var categoryRaw: String = ReceiptCategory.inne.rawValue
    var documentTypeRaw: String = ReceiptDocumentType.receipt.rawValue
    var documentNumber: String = ""
    var paymentMethod: String = ReceiptPaymentMethod.unknown.rawValue
    var itemName: String = ""
    var photoData: Data?
    var ocrText: String = ""
    var note: String = ""
    var warrantyUntil: Date?
    var returnUntil: Date?
    var scannedByName: String = ""
    var familyShareID: String?
    var ocrConfidence: Double = 0
    var createdAt: Date = Date()
    var updatedAt: Date = Date()

    init(
        id: UUID = UUID(),
        merchantName: String,
        merchantNIP: String,
        amount: Double,
        taxAmount: Double,
        issuedAt: Date,
        category: ReceiptCategory,
        documentType: ReceiptDocumentType,
        documentNumber: String,
        paymentMethod: String,
        itemName: String = "",
        photoData: Data?,
        ocrText: String,
        scannedByName: String,
        ocrConfidence: Double,
        warrantyUntil: Date?,
        returnUntil: Date?
    ) {
        self.id = id
        self.merchantName = merchantName
        self.merchantNIP = merchantNIP
        self.amount = amount
        self.taxAmount = taxAmount
        self.issuedAt = issuedAt
        self.categoryRaw = category.rawValue
        self.documentTypeRaw = documentType.rawValue
        self.documentNumber = documentNumber
        self.paymentMethod = paymentMethod
        self.itemName = itemName
        self.photoData = photoData
        self.ocrText = ocrText
        self.scannedByName = scannedByName
        self.ocrConfidence = ocrConfidence
        self.warrantyUntil = warrantyUntil
        self.returnUntil = returnUntil
        self.createdAt = Date()
        self.updatedAt = Date()
    }

    var category: ReceiptCategory {
        get { ReceiptCategory(rawValue: categoryRaw) ?? .inne }
        set { categoryRaw = newValue.rawValue }
    }

    var documentType: ReceiptDocumentType {
        get { ReceiptDocumentType(rawValue: documentTypeRaw) ?? .receipt }
        set { documentTypeRaw = newValue.rawValue }
    }

    var payment: ReceiptPaymentMethod {
        get { ReceiptPaymentMethod.fromStored(paymentMethod) }
        set { paymentMethod = newValue.rawValue }
    }
}

enum ReceiptRoute: Hashable {
    case settings
    case receipt(UUID)
}

enum ReceiptAnalytics {
    static func inMonth(_ receipts: [Receipt], month: Date, calendar: Calendar = .current) -> [Receipt] {
        receipts.filter { calendar.isDate($0.issuedAt, equalTo: month, toGranularity: .month) }
    }

    static func total(_ receipts: [Receipt]) -> Double {
        receipts.reduce(0) { $0 + $1.amount }
    }

    static func categoryTotals(_ receipts: [Receipt]) -> [(category: ReceiptCategory, total: Double)] {
        var sums: [ReceiptCategory: Double] = [:]
        for receipt in receipts {
            sums[receipt.category, default: 0] += receipt.amount
        }
        return ReceiptCategory.allCases.compactMap { category in
            guard let total = sums[category], total > 0 else { return nil }
            return (category, total)
        }
    }

    static func monthSeries(_ receipts: [Receipt], months: Int = 6, now: Date = .now, calendar: Calendar = .current) -> [(month: Date, total: Double)] {
        (0..<months).reversed().compactMap { offset -> (Date, Double)? in
            guard let month = calendar.date(byAdding: .month, value: -offset, to: calendar.startOfDay(for: now)) else { return nil }
            let start = calendar.date(from: calendar.dateComponents([.year, .month], from: month)) ?? month
            return (start, total(inMonth(receipts, month: start, calendar: calendar)))
        }
    }

    static func upcomingWarranties(_ receipts: [Receipt], withinDays: Int = 60, now: Date = .now) -> [Receipt] {
        receipts
            .filter { receipt in
                guard let date = receipt.warrantyUntil else { return false }
                let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: now), to: Calendar.current.startOfDay(for: date)).day ?? 0
                return days >= 0 && days <= withinDays
            }
            .sorted { ($0.warrantyUntil ?? .distantFuture) < ($1.warrantyUntil ?? .distantFuture) }
    }

    static func upcomingReturns(_ receipts: [Receipt], withinDays: Int = 14, now: Date = .now) -> [Receipt] {
        receipts
            .filter { receipt in
                guard let date = receipt.returnUntil else { return false }
                let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: now), to: Calendar.current.startOfDay(for: date)).day ?? 0
                return days >= 0 && days <= withinDays
            }
            .sorted { ($0.returnUntil ?? .distantFuture) < ($1.returnUntil ?? .distantFuture) }
    }
}

struct ReceiptCategoryMark: View {
    let category: ReceiptCategory
    var size: CGFloat = 36

    var body: some View {
        Image(systemName: category.symbol)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(category.color, in: RoundedRectangle(cornerRadius: size * 0.24, style: .continuous))
            .accessibilityHidden(true)
    }
}

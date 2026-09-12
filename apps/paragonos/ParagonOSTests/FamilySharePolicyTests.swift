import XCTest
@testable import ParagonOS

final class FamilySharePolicyTests: XCTestCase {
    func testDepositsAndReceiptsAreIndependent() {
        XCTAssertTrue(
            FamilySharePolicy.shouldShare(
                .deposit,
                depositsEnabled: true,
                receiptsEnabled: false,
                familyWalletID: "family"
            )
        )
        XCTAssertFalse(
            FamilySharePolicy.shouldShare(
                .receipt,
                depositsEnabled: true,
                receiptsEnabled: false,
                familyWalletID: "family"
            )
        )
        XCTAssertFalse(
            FamilySharePolicy.shouldShare(
                .deposit,
                depositsEnabled: false,
                receiptsEnabled: true,
                familyWalletID: "family"
            )
        )
        XCTAssertTrue(
            FamilySharePolicy.shouldShare(
                .receipt,
                depositsEnabled: false,
                receiptsEnabled: true,
                familyWalletID: "family"
            )
        )
    }

    func testShareRequiresFamilyWallet() {
        XCTAssertFalse(
            FamilySharePolicy.shouldShare(
                .deposit,
                depositsEnabled: true,
                receiptsEnabled: true,
                familyWalletID: nil
            )
        )
    }
}

final class HistorySpendTests: XCTestCase {
    func testGroupsReceiptsByMonthOfSelectedYear() {
        let calendar = Calendar(identifier: .gregorian)
        let year = 2026
        let march = calendar.date(from: DateComponents(year: year, month: 3, day: 4))!
        let april = calendar.date(from: DateComponents(year: year, month: 4, day: 9))!
        let receipts = [
            Receipt(
                merchantName: "Lidl",
                merchantNIP: "",
                amount: 10,
                taxAmount: 0,
                issuedAt: march,
                category: .spozywcze,
                documentType: .receipt,
                documentNumber: "",
                paymentMethod: ReceiptPaymentMethod.cash.rawValue,
                photoData: nil,
                ocrText: "",
                scannedByName: "",
                ocrConfidence: 1,
                warrantyUntil: nil,
                returnUntil: nil
            ),
            Receipt(
                merchantName: "x-kom",
                merchantNIP: "",
                amount: 20,
                taxAmount: 0,
                issuedAt: april,
                category: .elektronika,
                documentType: .invoice,
                documentNumber: "",
                paymentMethod: ReceiptPaymentMethod.card.rawValue,
                photoData: nil,
                ocrText: "",
                scannedByName: "",
                ocrConfidence: 1,
                warrantyUntil: nil,
                returnUntil: nil
            )
        ]
        let points = HistorySpend.receiptPoints(receipts, grain: .month, year: year, month: 3, calendar: calendar)
        XCTAssertEqual(points.count, 12)
        XCTAssertEqual(points[2].total, 10, accuracy: 0.01)
        XCTAssertEqual(points[3].total, 20, accuracy: 0.01)
        XCTAssertEqual(points[0].total, 0, accuracy: 0.01)
    }
}

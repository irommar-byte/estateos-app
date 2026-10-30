import SwiftData
import SwiftUI
import UIKit

enum ParagonUIDemo {
    static var isEnabled: Bool {
        if ProcessInfo.processInfo.arguments.contains("-paragon-ui-demo") { return true }
        if ProcessInfo.processInfo.environment["PARAGON_UI_DEMO"] == "1" { return true }
        if UserDefaults.standard.bool(forKey: "PARAGON_UI_DEMO") { return true }
        return false
    }

    static func prepareSimulatorDefaults() {
        // no-op in app; set via `defaults write` before launch
    }

    static func seedLoyaltyCards(into context: ModelContext) {
        let existing = (try? context.fetch(FetchDescriptor<LoyaltyCard>())) ?? []
        guard existing.isEmpty else { return }

        let samples: [(String, String, String)] = [
            ("payback", "Payback", "0481343308891"),
            ("lokal", "LOKAL", "5901234123457"),
            ("bigstar", "Big Star", "5909876543210"),
            ("brom", "BROM", "304951462309"),
            ("jula", "Jula", "3050010902311218"),
            ("auchan", "Auchan", "0410028627552"),
            ("biedronka", "Biedronka", "9970123456789"),
            ("lidl", "Lidl", "2001234567890"),
        ]
        for (index, (programID, name, payload)) in samples.enumerated() {
            let card = LoyaltyCard(
                programID: programID,
                programName: name,
                holderName: "",
                barcodePayload: payload,
                barcodeSymbology: .code128,
                note: "",
                photoData: nil,
                scannedByName: "Demo",
                ocrText: "",
                sortOrder: Double(index)
            )
            context.insert(card)
        }
        try? context.save()
    }
}

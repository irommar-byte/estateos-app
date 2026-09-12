import AppIntents

struct ScanVoucherIntent: AppIntent {
    static var title: LocalizedStringResource = "Skanuj kaucję"
    static var description = IntentDescription("Otwiera skaner kwitków kaucyjnych w ParagonOS™.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        await MainActor.run {
            WalletScanBridge.pendingIntent = .deposit
            OpenScanBridge.pending = true
            NotificationCenter.default.post(name: .paragonOpenScanner, object: nil)
        }
        return .result()
    }
}

struct ScanReceiptIntent: AppIntent {
    static var title: LocalizedStringResource = "Skanuj paragon"
    static var description = IntentDescription("Otwiera skaner paragonów i faktur w ParagonOS™.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        await MainActor.run {
            WalletScanBridge.pendingIntent = .receipt
            OpenScanBridge.pending = true
            NotificationCenter.default.post(name: .paragonOpenScanner, object: nil)
        }
        return .result()
    }
}

enum WalletScanBridge {
    static var pendingIntent: ScanIntent?
}

struct ParagonOSShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ScanVoucherIntent(),
            phrases: [
                "Skanuj kaucję w \(.applicationName)",
                "Skanuj kwitek w \(.applicationName)"
            ],
            shortTitle: "Skanuj kaucję",
            systemImageName: "waterbottle.fill"
        )
        AppShortcut(
            intent: ScanReceiptIntent(),
            phrases: [
                "Skanuj paragon w \(.applicationName)",
                "Skanuj fakturę w \(.applicationName)"
            ],
            shortTitle: "Skanuj paragon",
            systemImageName: "doc.text.viewfinder"
        )
    }
}

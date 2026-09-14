import AppIntents
import SwiftUI
import WidgetKit

struct ScanReceiptControlIntent: AppIntent {
    static var title: LocalizedStringResource = "Skanuj paragon"
    static var description = IntentDescription("Od razu skaner paragonu w ParagonOS™.")
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(ScanReceiptControlLink.url))
    }
}

struct ScanReceiptControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "pl.paragonos.app.scanReceipt") {
            ControlWidgetButton(action: ScanReceiptControlIntent()) {
                Label("Skanuj paragon", systemImage: "doc.text.viewfinder")
            }
        }
        .displayName("Skanuj paragon")
        .description("Po zakupach od razu aparat paragonu.")
    }
}

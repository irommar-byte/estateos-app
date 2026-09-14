import AppIntents
import SwiftUI
import WidgetKit

struct ScanDepositControlIntent: AppIntent {
    static var title: LocalizedStringResource = "Skanuj kwitek"
    static var description = IntentDescription("Po butelkomacie od razu aparat kaucji w ParagonOS™.")
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(ScanDepositControlLink.url))
    }
}

struct ScanDepositControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "pl.paragonos.app.scanDeposit") {
            ControlWidgetButton(action: ScanDepositControlIntent()) {
                Label("Skanuj kwitek", systemImage: "waterbottle.fill")
            }
        }
        .displayName("Skanuj kwitek")
        .description("Po butelkomacie od razu aparat kaucji.")
    }
}

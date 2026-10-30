import AppIntents
import SwiftUI
import WidgetKit

struct ScanLoyaltyControlIntent: AppIntent {
    static var title: LocalizedStringResource = "Skanuj kartę"
    static var description = IntentDescription("Od razu skaner karty lojalnościowej w ParagonOS™.")
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(ScanLoyaltyControlLink.url))
    }
}

struct ScanLoyaltyControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "pl.paragonos.app.scanLoyalty") {
            ControlWidgetButton(action: ScanLoyaltyControlIntent()) {
                Label("Skanuj kartę", systemImage: "creditcard.viewfinder")
            }
        }
        .displayName("Skanuj kartę")
        .description("Od razu aparat karty lojalnościowej.")
    }
}

import SwiftUI
import WidgetKit

struct ParagonOSCardsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ParagonOSCardsWidget", provider: Provider()) { entry in
            CardsStampGrid(snapshot: entry.snapshot)
                .containerBackground(Color(.secondarySystemGroupedBackground), for: .widget)
        }
        .configurationDisplayName("Karty")
        .description("Znaczki kart. Puste miejsce to skan nowej karty.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct CardsStampGrid: View {
    var snapshot: HomeSnapshot
    @Environment(\.widgetFamily) private var family

    var body: some View {
        let count = family == .systemLarge ? 9 : 6
        FittedStampGrid(slots: snapshot.cardSlots(count: count))
    }
}

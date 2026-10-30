import SwiftUI
import WidgetKit

struct ParagonOSTicketsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ParagonOSTicketsWidget", provider: Provider()) { entry in
            TicketsWidgetView(snapshot: entry.snapshot)
                .containerBackground(Color(.secondarySystemGroupedBackground), for: .widget)
        }
        .configurationDisplayName("Kaucje")
        .description("Kwota do oddania i kod przy kasie.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct TicketsWidgetView: View {
    var snapshot: HomeSnapshot
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .systemMedium:
            grid(count: 6)
        case .systemLarge:
            grid(count: 9)
        default:
            small
        }
    }

    private var small: some View {
        Group {
            if let ticket = snapshot.nextTicket ?? snapshot.tickets.first {
                Link(destination: WidgetDeepLink.checkoutTicket(ticket.id).url) {
                    TicketStampView(ticket: ticket, compact: true)
                }
            } else {
                Link(destination: WidgetDeepLink.scanDeposit.url) {
                    WidgetEmptyStamp(caption: "Skanuj")
                }
            }
        }
        .widgetURL(
            (snapshot.nextTicket ?? snapshot.tickets.first).map { WidgetDeepLink.checkoutTicket($0.id).url }
                ?? WidgetDeepLink.scanDeposit.url
        )
    }

    private func grid(count: Int) -> some View {
        FittedStampGrid(slots: snapshot.ticketSlots(count: count))
    }
}

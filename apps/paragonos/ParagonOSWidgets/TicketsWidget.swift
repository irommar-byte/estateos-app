import SwiftUI
import WidgetKit

struct ParagonOSTicketsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ParagonOSTicketsWidget", provider: Provider()) { entry in
            TicketsWidgetView(snapshot: entry.snapshot)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Kaucje")
        .description("Kwota do oddania i kod przy kasie.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct TicketsWidgetView: View {
    var snapshot: HomeSnapshot
    @Environment(\.widgetFamily) private var family

    var body: some View {
        if family == .systemMedium {
            medium
        } else {
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
                    TicketStampView(ticket: nil, compact: true)
                }
            }
        }
        .widgetURL(
            (snapshot.nextTicket ?? snapshot.tickets.first).map { WidgetDeepLink.checkoutTicket($0.id).url }
                ?? WidgetDeepLink.scanDeposit.url
        )
    }

    private var medium: some View {
        let tickets = Array((snapshot.tickets.isEmpty ? [snapshot.nextTicket].compactMap { $0 } : snapshot.tickets).prefix(6))
        return Group {
            if tickets.isEmpty {
                Link(destination: WidgetDeepLink.scanDeposit.url) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Kaucje")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text("Skanuj pierwszy kwitek")
                            .font(.subheadline.weight(.semibold))
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(tickets) { ticket in
                        Link(destination: WidgetDeepLink.checkoutTicket(ticket.id).url) {
                            VStack(spacing: 5) {
                                WidgetStampMark(id: ticket.id, hex: ticket.colorHex ?? "#3A3A3C", title: ticket.brand)
                                    .frame(height: 40)
                                Text(ticket.amount, format: .currency(code: "PLN"))
                                    .font(.caption2.weight(.bold))
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                            }
                        }
                    }
                }
            }
        }
    }
}

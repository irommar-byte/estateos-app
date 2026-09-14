import SwiftUI
import WidgetKit

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> HomeEntry {
        HomeEntry(date: .now, snapshot: HomeSnapshot())
    }

    func getSnapshot(in context: Context, completion: @escaping (HomeEntry) -> Void) {
        completion(HomeEntry(date: .now, snapshot: HomeSnapshotStore.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HomeEntry>) -> Void) {
        let entry = HomeEntry(date: .now, snapshot: HomeSnapshotStore.load())
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(30 * 60))))
    }
}

struct HomeEntry: TimelineEntry {
    let date: Date
    let snapshot: HomeSnapshot
}

struct ParagonOSWidgetEntryView: View {
    var entry: HomeEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .systemMedium:
            medium
        case .accessoryCircular:
            circular
        case .accessoryRectangular:
            rectangular
        default:
            small
        }
    }

    private var small: some View {
        TicketStampView(ticket: entry.snapshot.nextTicket, compact: true)
            .widgetURL(
                entry.snapshot.nextTicket.map { WidgetDeepLink.checkoutTicket($0.id).url }
                    ?? WidgetDeepLink.scanDeposit.url
            )
    }

    private var medium: some View {
        HStack(alignment: .top, spacing: 16) {
            TicketStampView(ticket: entry.snapshot.nextTicket, compact: false)
            VStack(alignment: .leading, spacing: 8) {
                Text("Przy kasie")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                if entry.snapshot.cards.isEmpty {
                    Text("Dodaj kartę, żeby pokazać kod przy kasie.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(entry.snapshot.cards.prefix(2)) { card in
                        Link(destination: WidgetDeepLink.checkoutCard(card.id).url) {
                            Label(card.name, systemImage: "barcode.viewfinder")
                                .font(.subheadline.weight(.semibold))
                        }
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            Image(systemName: "waterbottle.fill")
        }
        .widgetURL(WidgetDeepLink.scanDeposit.url)
    }

    private var rectangular: some View {
        VStack(alignment: .leading) {
            if let ticket = entry.snapshot.nextTicket {
                Text(ticket.brand)
                    .font(.headline)
                Text(ticket.amount, format: .currency(code: "PLN"))
            } else {
                Text("Skanuj kwitek")
            }
        }
        .widgetURL(entry.snapshot.nextTicket.map { WidgetDeepLink.checkoutTicket($0.id).url } ?? WidgetDeepLink.scanDeposit.url)
    }
}

struct TicketStampView: View {
    var ticket: SnapshotTicket?
    var compact: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ParagonOS")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if let ticket {
                HStack(spacing: 8) {
                    WidgetStampMark(
                        id: ticket.id,
                        hex: ticket.colorHex ?? "#3A3A3C",
                        title: ticket.brand
                    )
                    .frame(width: compact ? 36 : 44, height: compact ? 36 : 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(ticket.brand)
                            .font(.headline)
                            .lineLimit(1)
                        Text(ticket.amount, format: .currency(code: "PLN"))
                            .font(.title3.bold())
                    }
                }
                if let expires = ticket.expiresAt {
                    Text(expires, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("Skanuj pierwszy kwitek")
                    .font(.subheadline.weight(.semibold))
            }
            Spacer(minLength: 0)
        }
    }
}

struct WidgetStampMark: View {
    var id: UUID
    var hex: String
    var title: String

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(paragonHex: hex))
            if let image = WidgetStampStore.image(id: id) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .padding(6)
            } else {
                Text(String(title.prefix(1)).uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
            }
        }
    }
}

@main
struct ParagonOSWidgets: WidgetBundle {
    var body: some Widget {
        ParagonOSHomeWidget()
        ParagonOSLockWidget()
        ParagonOSCardsWidget()
        ParagonOSTicketsWidget()
        ScanDepositControl()
        ScanReceiptControl()
    }
}

struct ParagonOSHomeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ParagonOSHomeWidget", provider: Provider()) { entry in
            ParagonOSWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Kaucja i kasa")
        .description("Najbliższa kaucja i szybki skan kwitka albo karty przy kasie.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct ParagonOSLockWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ParagonOSLockWidget", provider: Provider()) { entry in
            ParagonOSWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Kaucja")
        .description("Najbliższy termin kaucji.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular])
    }
}

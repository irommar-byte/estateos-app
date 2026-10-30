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
        Group {
            if let ticket = entry.snapshot.nextTicket {
                TicketStampView(ticket: ticket, compact: true)
            } else {
                WidgetEmptyStamp(caption: "Skanuj")
            }
        }
        .widgetURL(
            entry.snapshot.nextTicket.map { WidgetDeepLink.checkoutTicket($0.id).url }
                ?? WidgetDeepLink.scanDeposit.url
        )
    }

    private var medium: some View {
        HStack(alignment: .top, spacing: 14) {
            if let ticket = entry.snapshot.nextTicket {
                Link(destination: WidgetDeepLink.checkoutTicket(ticket.id).url) {
                    VStack(alignment: .leading, spacing: 6) {
                        WidgetStampMark(id: ticket.id, hex: ticket.colorHex ?? "#3A3A3C", title: ticket.brand)
                            .frame(width: 52, height: 52)
                        Text(ticket.brand)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                        Text(ticket.amount, format: .currency(code: "PLN"))
                            .font(.headline)
                        if let expires = ticket.expiresAt {
                            Text(expires, style: .relative)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                Link(destination: WidgetDeepLink.scanDeposit.url) {
                    WidgetEmptyStamp(caption: "Skanuj")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                ForEach(entry.snapshot.cards.prefix(2)) { card in
                    Link(destination: WidgetDeepLink.checkoutCard(card.id).url) {
                        HStack(spacing: 8) {
                            WidgetStampMark(id: card.id, hex: card.colorHex ?? "#3A3A3C", title: card.name)
                                .frame(width: 36, height: 36)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(card.name)
                                    .font(.subheadline.weight(.semibold))
                                    .lineLimit(1)
                                if let caption = card.caption {
                                    Text(caption)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
                if entry.snapshot.cards.isEmpty {
                    Link(destination: WidgetDeepLink.scanLoyalty.url) {
                        Text("Dodaj kartę")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            if let ticket = entry.snapshot.nextTicket {
                VStack(spacing: 1) {
                    Text(ticket.amount, format: .currency(code: "PLN"))
                        .font(.caption2.weight(.bold))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    if let expires = ticket.expiresAt {
                        Text(expires, style: .relative)
                            .font(.caption2)
                    }
                }
            } else {
                Text("Skanuj")
                    .font(.caption2.weight(.semibold))
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }
        }
        .widgetURL(
            entry.snapshot.nextTicket.map { WidgetDeepLink.checkoutTicket($0.id).url }
                ?? WidgetDeepLink.scanDeposit.url
        )
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let ticket = entry.snapshot.nextTicket {
                Text(ticket.brand)
                    .font(.headline)
                Text(ticket.amount, format: .currency(code: "PLN"))
                if let expires = ticket.expiresAt {
                    Text(expires, style: .relative)
                        .font(.caption)
                }
            } else {
                Text("Skanuj")
                    .font(.headline)
            }
        }
        .widgetURL(
            entry.snapshot.nextTicket.map { WidgetDeepLink.checkoutTicket($0.id).url }
                ?? WidgetDeepLink.scanDeposit.url
        )
    }
}

struct TicketStampView: View {
    var ticket: SnapshotTicket?
    var compact: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
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
                WidgetEmptyStamp(caption: "Skanuj")
            }
            Spacer(minLength: 0)
        }
    }
}

struct WidgetStampMark: View {
    var id: UUID
    var hex: String
    var title: String
    var size: CGFloat? = nil

    var body: some View {
        Group {
            if let image = WidgetStampStore.image(id: id) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                RoundedRectangle(cornerRadius: ParagonWidgetKind.stampCorner, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(paragonHex: hex).opacity(0.92),
                                Color(paragonHex: hex),
                                Color.black.opacity(0.22)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay {
                        Text(String(title.prefix(1)).uppercased())
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                    }
            }
        }
        .frame(width: size, height: size)
        .aspectRatio(1, contentMode: .fit)
    }
}

struct WidgetEmptyStamp: View {
    var caption: String = "Skanuj"
    var stampSize: CGFloat? = nil

    var body: some View {
        VStack(spacing: 4) {
            RoundedRectangle(cornerRadius: ParagonWidgetKind.stampCorner, style: .continuous)
                .strokeBorder(style: StrokeStyle(lineWidth: 1.2, dash: [5, 4]))
                .foregroundStyle(.secondary)
                .frame(width: stampSize, height: stampSize)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    Image(systemName: "plus")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            Text(caption)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}

struct WidgetStampCell: View {
    var slot: WidgetStampSlot
    var stampSize: CGFloat? = nil

    var body: some View {
        switch slot {
        case .card(let card):
            VStack(spacing: 4) {
                WidgetStampMark(id: card.id, hex: card.colorHex ?? "#3A3A3C", title: card.name, size: stampSize)
                Text(card.caption ?? card.name)
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        case .ticket(let ticket):
            VStack(spacing: 4) {
                WidgetStampMark(id: ticket.id, hex: ticket.colorHex ?? "#3A3A3C", title: ticket.brand, size: stampSize)
                Text(ticket.amount, format: .currency(code: "PLN"))
                    .font(.caption2.weight(.bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        case .empty:
            WidgetEmptyStamp(caption: "Skanuj", stampSize: stampSize)
        }
    }
}

struct FittedStampGrid: View {
    var slots: [WidgetStampSlot]

    var body: some View {
        let rows = max(slots.count / 3, 1)
        GeometryReader { geo in
            let spacing: CGFloat = 8
            let caption: CGFloat = 15
            let colW = (geo.size.width - spacing * 2) / 3
            let rowH = (geo.size.height - spacing * CGFloat(rows - 1)) / CGFloat(rows)
            let stamp = min(colW, max(28, rowH - caption - 4))
            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())],
                spacing: spacing
            ) {
                ForEach(slots) { slot in
                    Link(destination: slot.deepLink) {
                        WidgetStampCell(slot: slot, stampSize: stamp)
                    }
                }
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
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
        ScanLoyaltyControl()
        FamilySyncLiveActivityWidget()
    }
}

struct ParagonOSHomeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ParagonOSHomeWidget", provider: Provider()) { entry in
            ParagonOSWidgetEntryView(entry: entry)
                .containerBackground(Color(.secondarySystemGroupedBackground), for: .widget)
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
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Kaucja")
        .description("Najbliższy termin kaucji.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular])
    }
}

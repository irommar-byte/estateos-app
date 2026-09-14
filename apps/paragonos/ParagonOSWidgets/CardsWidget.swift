import SwiftUI
import WidgetKit

struct ParagonOSCardsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ParagonOSCardsWidget", provider: Provider()) { entry in
            CardsStampGrid(snapshot: entry.snapshot)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Karty")
        .description("Sześć znaczków kart. Puste miejsca wypełniają aktywne kaucje.")
        .supportedFamilies([.systemMedium])
    }
}

struct CardsStampGrid: View {
    var snapshot: HomeSnapshot

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            ForEach(snapshot.stampSlots) { slot in
                Link(destination: slot.deepLink) {
                    stamp(slot)
                }
            }
        }
    }

    @ViewBuilder
    private func stamp(_ slot: WidgetStampSlot) -> some View {
        switch slot {
        case .card(let card):
            VStack(spacing: 5) {
                WidgetStampMark(id: card.id, hex: card.colorHex ?? "#3A3A3C", title: card.name)
                    .frame(height: 44)
                Text(card.name)
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        case .ticket(let ticket):
            VStack(spacing: 5) {
                WidgetStampMark(id: ticket.id, hex: ticket.colorHex ?? "#3A3A3C", title: ticket.brand)
                    .frame(height: 44)
                Text(ticket.amount, format: .currency(code: "PLN"))
                    .font(.caption2.weight(.bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        case .empty:
            VStack(spacing: 5) {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1.2, dash: [4, 3]))
                    .foregroundStyle(.secondary)
                    .frame(height: 44)
                    .overlay {
                        Image(systemName: "plus")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                Text("Skanuj kartę")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
    }
}

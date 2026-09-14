import SwiftUI
import UIKit

struct VoucherPassCard: View {
    let retailerID: String
    let amount: Double
    let status: TicketLifecycleStatus
    var expiresAt: Date?
    var ticketNumber: String = ""
    var stackedCount: Int = 1
    var now: Date = .now
    var showsDisclosure: Bool = false
    var isExpanded: Bool = false
    var foilActive: Bool = true

    init(
        retailerID: String,
        amount: Double,
        status: TicketLifecycleStatus,
        expiresAt: Date?,
        ticketNumber: String = "",
        stackedCount: Int = 1,
        now: Date = .now,
        showsDisclosure: Bool = false,
        isExpanded: Bool = false,
        foilActive: Bool = true
    ) {
        self.retailerID = retailerID
        self.amount = amount
        self.status = status
        self.expiresAt = expiresAt
        self.ticketNumber = ticketNumber
        self.stackedCount = stackedCount
        self.now = now
        self.showsDisclosure = showsDisclosure
        self.isExpanded = isExpanded
        self.foilActive = foilActive
    }

    init(ticket: Ticket, now: Date = .now, stackedCount: Int = 1, foilActive: Bool = true) {
        self.init(
            retailerID: ticket.retailerID,
            amount: ticket.amount,
            status: ticket.resolvedStatus(now: now),
            expiresAt: ticket.expiresAt,
            ticketNumber: ticket.ticketNumber,
            stackedCount: stackedCount,
            now: now,
            foilActive: foilActive
        )
    }

    private var policy: RetailerPolicy { RetailerCatalog.policy(id: retailerID) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 12) {
                RetailerLogo(retailerID: retailerID, size: 40)
                Text(policy.name)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.28), radius: 1, y: 1)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Spacer(minLength: 8)
                if showsDisclosure {
                    Image(systemName: "chevron.compact.down")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.9))
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                } else {
                    Text(status.title)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(.white.opacity(0.2), in: Capsule())
                        .foregroundStyle(.white)
                }
            }

            Text(MoneyFormat.string(amount))
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            HStack {
                if let expiresAt {
                    Label(PolishDates.relativeExpiry(expiresAt, now: now), systemImage: "clock")
                } else {
                    Label("Bez terminu", systemImage: "infinity")
                }
                Spacer()
                if stackedCount > 1 {
                    Text(PolishDates.kwitekCount(stackedCount))
                        .font(.subheadline.weight(.semibold))
                } else if ticketNumber.isEmpty == false {
                    Text(ticketNumber)
                        .font(.caption.monospaced().weight(.medium))
                }
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.white.opacity(0.92))
        }
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(passGradient)
                .overlay {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [.white.opacity(0.38), .white.opacity(0.06), .black.opacity(0.18)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 1
                        )
                }
                .overlay {
                    GyroFoilOverlay(cornerRadius: 16, intensity: 0.52, isActive: foilActive)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .allowsHitTesting(false)
                }
                .overlay(alignment: .top) {
                    LinearGradient(
                        colors: [.white.opacity(0.22), .white.opacity(0)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 36)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
        }
        .overlay(alignment: .bottom) {
            Capsule()
                .fill(.white.opacity(0.32))
                .frame(width: 42, height: 5)
                .padding(.bottom, 8)
        }
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var passGradient: LinearGradient {
        let base: Color = {
            switch status {
            case .active: return RetailerBrand.cardColor(for: retailerID)
            case .redeemed: return Color(white: 0.28)
            case .expired: return Color(red: 0.42, green: 0.14, blue: 0.16)
            }
        }()
        return LinearGradient(
            colors: [
                base.opacity(0.92),
                base,
                Color.black.opacity(0.22)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

struct WalletRetailerGroup: Identifiable {
    var id: String { retailerID }
    let retailerID: String
    let tickets: [Ticket]

    var total: Double { tickets.reduce(0) { $0 + $1.amount } }
    var soonestExpiry: Date? {
        tickets.compactMap(\.expiresAt).min()
    }

    static func groups(from tickets: [Ticket]) -> [WalletRetailerGroup] {
        var order: [String] = []
        var buckets: [String: [Ticket]] = [:]
        for ticket in tickets {
            if buckets[ticket.retailerID] == nil {
                order.append(ticket.retailerID)
            }
            buckets[ticket.retailerID, default: []].append(ticket)
        }
        return order.map { WalletRetailerGroup(retailerID: $0, tickets: buckets[$0] ?? []) }
    }
}

struct WalletPassStack: View {
    let tickets: [Ticket]
    var now: Date = .now
    @Binding var expandedRetailerID: String?
    var onOpen: (Ticket) -> Void
    var onCheckout: (Ticket) -> Void
    var onRedeem: (Ticket) -> Void
    var onDelete: ((Ticket) -> Void)? = nil

    private var groups: [WalletRetailerGroup] {
        WalletRetailerGroup.groups(from: tickets)
    }

    var body: some View {
        VStack(spacing: 14) {
            ForEach(groups) { group in
                groupBlock(group)
            }
        }
        .onChange(of: groups.map(\.id)) { _, ids in
            if let expandedRetailerID, ids.contains(expandedRetailerID) == false {
                self.expandedRetailerID = nil
            }
        }
    }

    @ViewBuilder
    private func groupBlock(_ group: WalletRetailerGroup) -> some View {
        let expanded = expandedRetailerID == group.retailerID
        VStack(spacing: 10) {
            Button {
                toggle(group)
            } label: {
                stackedFace(group, expanded: expanded)
            }
            .buttonStyle(LoyaltyPassPressStyle())
            .contextMenu {
                if let first = group.tickets.first, group.tickets.count == 1 {
                    ticketMenu(first)
                }
            }

            if expanded {
                ForEach(group.tickets) { ticket in
                    ticketButton(ticket)
                        .transition(.asymmetric(
                            insertion: .opacity.combined(with: .move(edge: .top)),
                            removal: .opacity
                        ))
                }
            }
        }
        .animation(PassStackMotion.snappy, value: expanded)
    }

    private func stackedFace(_ group: WalletRetailerGroup, expanded: Bool) -> some View {
        let extras = expanded ? 0 : min(max(group.tickets.count - 1, 0), 2)
        let color = RetailerBrand.cardColor(for: group.retailerID)
        return ZStack(alignment: .top) {
            ForEach(0..<extras, id: \.self) { layer in
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(color.opacity(0.55 - Double(layer) * 0.12))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(.white.opacity(0.14), lineWidth: 0.5)
                    }
                    .frame(height: 118)
                    .padding(.horizontal, CGFloat(layer + 1) * 9)
                    .offset(y: CGFloat(layer + 1) * 9)
                    .allowsHitTesting(false)
            }
            VoucherPassCard(
                retailerID: group.retailerID,
                amount: group.total,
                status: .active,
                expiresAt: group.soonestExpiry,
                ticketNumber: group.tickets.count == 1 ? (group.tickets.first?.ticketNumber ?? "") : "",
                stackedCount: group.tickets.count,
                now: now,
                showsDisclosure: group.tickets.count > 1,
                isExpanded: expanded,
                foilActive: true
            )
        }
        .padding(.bottom, CGFloat(extras) * 9)
    }

    private func toggle(_ group: WalletRetailerGroup) {
        if group.tickets.count == 1, let ticket = group.tickets.first {
            onOpen(ticket)
            return
        }
        let expanding = expandedRetailerID != group.retailerID
        UIImpactFeedbackGenerator(style: expanding ? .soft : .light).impactOccurred()
        withAnimation(PassStackMotion.snappy) {
            expandedRetailerID = expanding ? group.retailerID : nil
        }
    }

    private func ticketButton(_ ticket: Ticket) -> some View {
        Button {
            onOpen(ticket)
        } label: {
            VoucherPassCard(ticket: ticket, now: now, foilActive: false)
        }
        .buttonStyle(LoyaltyPassPressStyle())
        .contextMenu { ticketMenu(ticket) }
        .shadow(color: .black.opacity(0.2), radius: 10, y: 5)
    }

    @ViewBuilder
    private func ticketMenu(_ ticket: Ticket) -> some View {
        Button {
            onCheckout(ticket)
        } label: {
            Label("Pokaż przy kasie", systemImage: "barcode")
        }
        Button {
            onRedeem(ticket)
        } label: {
            Label("Wykorzystany", systemImage: "checkmark.circle")
        }
        Button(role: .destructive) {
            onDelete?(ticket)
        } label: {
            Label("Usuń", systemImage: "trash")
        }
    }
}

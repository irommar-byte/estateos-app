import SwiftData
import SwiftUI

struct WalletView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Query(sort: \Ticket.issuedAt, order: .reverse) private var tickets: [Ticket]
    @State private var query = ""
    @State private var isSearching = false
    @FocusState private var searchFocused: Bool

    private var now: Date { .now }

    private var visible: [Ticket] {
        tickets.filter { ticket in
            let status = ticket.resolvedStatus(now: now)
            let matchesQuery: Bool = {
                if query.isEmpty { return true }
                let policy = RetailerCatalog.policy(id: ticket.retailerID)
                let haystack = "\(policy.name) \(ticket.amount) \(ticket.ticketNumber)".lowercased()
                return haystack.contains(query.lowercased())
            }()
            return status == .active && matchesQuery
        }
    }

    private var activeSum: Double {
        visible.reduce(0) { $0 + $1.amount }
    }

    private var nextExpiry: Ticket? {
        visible
            .filter { $0.expiresAt != nil }
            .sorted { ($0.expiresAt ?? .distantFuture) < ($1.expiresAt ?? .distantFuture) }
            .first
    }

    var body: some View {
        Group {
            if tickets.isEmpty {
                ContentUnavailableView {
                    Label("Brak kaucji", systemImage: "waterbottle")
                } description: {
                    Text("Skanuj pierwszy kwitek z butelkomatu w \(Brand.displayName).")
                } actions: {
                    Button("Skanuj kaucję") { wallet.openScanner(for: .deposit) }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        if isSearching {
                            searchField
                        }
                        summaryCard
                        if visible.isEmpty {
                            Text(query.isEmpty ? "Brak aktywnych kwitków." : "Nic nie pasuje do wyszukiwania.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 4)
                        } else {
                            Text("Aktywne")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 4)
                            WalletPassStack(
                                tickets: visible,
                                now: now,
                                onOpen: { ticket in
                                    wallet.walletPath.append(WalletRoute.ticket(ticket.id))
                                },
                                onCheckout: { ticket in
                                    wallet.showCheckoutFor = ticket.id
                                },
                                onRedeem: { ticket in
                                    try? wallet.markRedeemed(ticket, context: context)
                                }
                            )
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 28)
                }
                .scrollIndicators(.hidden)
                .scrollDismissesKeyboard(.interactively)
                .background {
                    ZStack {
                        Color(.systemGroupedBackground)
                        MotifBackground(kind: .deposit)
                    }
                    .ignoresSafeArea()
                }
            }
        }
        .background {
            ZStack {
                Color(.systemGroupedBackground)
                MotifBackground(kind: .deposit)
            }
            .ignoresSafeArea()
        }
        .navigationTitle("Kaucje")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    wallet.walletPath.append(WalletRoute.settings)
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Ustawienia")
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isSearching.toggle()
                        if isSearching {
                            searchFocused = true
                        } else {
                            query = ""
                            searchFocused = false
                        }
                    }
                } label: {
                    Image(systemName: isSearching ? "xmark.circle.fill" : "magnifyingglass")
                }
                .accessibilityLabel(isSearching ? "Zamknij wyszukiwanie" : "Szukaj")
                Button {
                    wallet.openScanner(for: .deposit)
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Skanuj kaucję")
            }
        }
        .fullScreenCover(item: checkoutTicket) { ticket in
            CheckoutCodeView(ticket: ticket)
                .environmentObject(wallet)
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Sklep lub kwota", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($searchFocused)
            if query.isEmpty == false {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .accessibilityLabel("Wyczyść")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(.tertiarySystemFill))
        )
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Do odebrania")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(MoneyFormat.string(activeSum))
                .font(.system(size: 34, weight: .bold, design: .rounded))
            HStack {
                Label(PolishDates.kwitekCount(visible.count), systemImage: "ticket")
                if let next = nextExpiry, let date = next.expiresAt {
                    Spacer()
                    Label(PolishDates.relativeExpiry(date), systemImage: "clock")
                }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
            if wallet.family.isSyncing {
                Label("Synchronizacja…", systemImage: "icloud")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }

    private var checkoutTicket: Binding<Ticket?> {
        Binding(
            get: {
                guard let id = wallet.showCheckoutFor else { return nil }
                return tickets.first(where: { $0.id == id })
            },
            set: { wallet.showCheckoutFor = $0?.id }
        )
    }
}

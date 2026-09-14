import CoreLocation
import MapKit
import SwiftData
import SwiftUI
import TipKit

struct WalletView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Query(sort: \Ticket.issuedAt, order: .reverse) private var tickets: [Ticket]
    @State private var query = ""
    @State private var isSearching = false
    @StateObject private var location = LocationProvider()
    @State private var nearby: [BottleReturnPoint] = []
    @State private var nearbyOrigin: CLLocation?
    @State private var expandedStackID: String?
    @State private var pendingRedeem: Ticket?

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
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if tickets.isEmpty && query.isEmpty {
                    emptyState
                } else if tickets.isEmpty == false {
                    summaryCard
                }
                if location.isAuthorized, tickets.isEmpty == false {
                    mapTeaser
                } else if location.isAuthorized == false {
                    locationPrompt
                }
                if tickets.isEmpty == false {
                    if visible.isEmpty {
                        ContentUnavailableView(
                            query.isEmpty ? "Brak aktywnych kwitków" : "Nic nie pasuje",
                            systemImage: query.isEmpty ? "ticket" : "magnifyingglass",
                            description: Text(query.isEmpty
                                ? "Wykorzystane i przeterminowane są w Historii."
                                : "Spróbuj innej sieci albo kwoty.")
                        )
                        .frame(maxWidth: .infinity)
                    } else {
                        Text("Aktywne")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 4)
                        WalletPassStack(
                            tickets: visible,
                            now: now,
                            expandedRetailerID: $expandedStackID,
                            onOpen: { ticket in
                                wallet.walletPath.append(WalletRoute.ticket(ticket.id))
                            },
                            onCheckout: { ticket in
                                wallet.showCheckoutFor = ticket.id
                            },
                            onRedeem: { ticket in
                                pendingRedeem = ticket
                            },
                            onDelete: { ticket in
                                try? wallet.delete(ticket, context: context)
                            }
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .navigationTitle("Kaucje")
        .searchable(text: $query, isPresented: $isSearching, prompt: "Sklep lub kwota")
        .sensoryFeedback(.success, trigger: tickets.count)
        .sensoryFeedback(.impact(flexibility: .solid), trigger: wallet.showCheckoutFor)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    wallet.walletPath.append(WalletRoute.settings)
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Ustawienia")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    openBottleMap()
                } label: {
                    Image(systemName: "map")
                }
                .accessibilityLabel("Mapa butelkomatów")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Skanuj kaucję", systemImage: "viewfinder") {
                        wallet.openScanner(for: .deposit)
                    }
                    Button("Wpisz ręcznie", systemImage: "keyboard") {
                        wallet.openManualDeposit()
                    }
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Dodaj kaucję")
            }
        }
        .fullScreenCover(item: checkoutTicket) { ticket in
            CheckoutCodeView(ticket: ticket)
                .environmentObject(wallet)
        }
        .confirmationDialog(
            "Czy kasa przyjęła kupon?",
            isPresented: Binding(
                get: { pendingRedeem != nil },
                set: { if $0 == false { pendingRedeem = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Tak, wykorzystany") {
                if let ticket = pendingRedeem {
                    try? wallet.markRedeemed(ticket, context: context)
                }
                pendingRedeem = nil
            }
            Button("Anuluj", role: .cancel) {
                pendingRedeem = nil
            }
        } message: {
            Text("Po skanie przy kasie oznacz kwitek jako wykorzystany, żeby nie leżał w portfelu.")
        }
        .task {
            location.request()
            if location.isAuthorized {
                await loadNearby()
            }
        }
        .onChange(of: location.location?.timestamp) { _, _ in
            guard location.isAuthorized else { return }
            Task { await loadNearby() }
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("Brak kaucji", systemImage: "waterbottle")
        } description: {
            Text("Skanuj kwitek z butelkomatu, wpisz go ręcznie albo znajdź automat na mapie.")
        } actions: {
            Button("Skanuj kaucję") { wallet.openScanner(for: .deposit) }
                .buttonStyle(.borderedProminent)
                .popoverTip(FirstScanTip.deposit)
            Button("Wpisz ręcznie") { wallet.openManualDeposit() }
        }
    }

    private var locationPrompt: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Włącz lokalizację", systemImage: "location.fill")
                .font(.headline)
            Text("Wtedy pokażemy butelkomaty w pobliżu — bez zgody nie zgadujemy Warszawy.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack {
                Button("Włącz") { location.locateOrOpenSettings() }
                    .buttonStyle(.borderedProminent)
                Button("Otwórz mapę") { openBottleMap() }
                    .buttonStyle(.bordered)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
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
            if wallet.cloudSync.isInProgress {
                Label(wallet.cloudSync.statusTitle, systemImage: "icloud")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else if wallet.cloudSync.phase == .failed, let error = wallet.cloudSync.errorText {
                Text(error)
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

    private var mapTeaser: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                openBottleMap()
            } label: {
                HStack {
                    Label("Butelkomaty w pobliżu", systemImage: "map.fill")
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Mapa butelkomatów")

            if nearby.isEmpty {
                Text("Otwórz mapę, żeby znaleźć automat i godziny otwarcia.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 10) {
                    ForEach(nearby.prefix(5)) { point in
                        Button {
                            openDirections(to: point)
                        } label: {
                            nearbyRow(point)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }

    private func nearbyRow(_ point: BottleReturnPoint) -> some View {
        HStack(spacing: 10) {
            RetailerLogo(retailerID: point.brandID, size: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(point.brand)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(point.subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: 4) {
                    if let origin = nearbyOrigin {
                        Text(DistanceFormat.string(origin.distance(from: point.location)))
                            .font(.caption.weight(.semibold).monospacedDigit())
                            .foregroundStyle(.primary)
                    }
                    Image(systemName: "arrow.triangle.turn.up.right.diamond.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(ParagonTheme.osGreen)
                }
                if OpeningHours.display(from: point.hoursRaw).label.isEmpty == false {
                    Text(OpeningHours.display(from: point.hoursRaw).label)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .accessibilityLabel(nearbyAccessibility(point))
    }

    private func nearbyAccessibility(_ point: BottleReturnPoint) -> String {
        var parts = [point.brand, point.subtitle]
        if let origin = nearbyOrigin {
            parts.append(DistanceFormat.string(origin.distance(from: point.location)))
        }
        parts.append("nawigacja")
        return parts.filter { $0.isEmpty == false }.joined(separator: ", ")
    }

    private func openDirections(to point: BottleReturnPoint) {
        let destination = MKMapItem(placemark: MKPlacemark(coordinate: point.coordinate))
        destination.name = "\(point.brand) · butelkomat"
        destination.openInMaps(launchOptions: [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
        ])
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

    private func openBottleMap() {
        wallet.walletPath.append(WalletRoute.bottleMap)
    }

    private func loadNearby() async {
        guard location.isAuthorized, let origin = location.location else {
            nearby = []
            nearbyOrigin = nil
            return
        }
        nearbyOrigin = origin
        nearby = await BottleReturnStore.shared.nearby(from: origin, limit: 8)
    }
}

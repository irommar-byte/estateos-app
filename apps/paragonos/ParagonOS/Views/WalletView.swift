import CoreLocation
import MapKit
import SwiftData
import SwiftUI

struct WalletView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Query(sort: \Ticket.issuedAt, order: .reverse) private var tickets: [Ticket]
    @State private var query = ""
    @State private var isSearching = false
    @FocusState private var searchFocused: Bool
    @StateObject private var location = LocationProvider()
    @State private var nearby: [BottleReturnPoint] = []
    @State private var nearbyOrigin: CLLocation?
    @State private var expandedStackID: String?

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
                if isSearching {
                    searchField
                }
                if tickets.isEmpty {
                    emptyCard
                } else {
                    summaryCard
                }
                mapTeaser
                if tickets.isEmpty == false {
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
                            expandedRetailerID: $expandedStackID,
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
            }
            ToolbarItem(placement: .topBarTrailing) {
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
        .task {
            location.request()
            await loadNearby()
        }
        .onChange(of: location.location?.timestamp) { _, _ in
            Task { await loadNearby() }
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

    private var emptyCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Brak kaucji", systemImage: "waterbottle")
                .font(.headline)
            Text("Skanuj kwitek z butelkomatu albo znajdź automat na mapie.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("Skanuj kaucję") { wallet.openScanner(for: .deposit) }
                .buttonStyle(.borderedProminent)
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
        let origin = location.location ?? CLLocation(latitude: 52.2297, longitude: 21.0122)
        nearbyOrigin = origin
        nearby = await BottleReturnStore.shared.nearby(from: origin, limit: 8)
    }
}

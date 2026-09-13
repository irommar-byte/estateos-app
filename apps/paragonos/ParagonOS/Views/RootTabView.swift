import SwiftData
import SwiftUI
import TipKit

struct RootTabView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @Query(sort: \Ticket.createdAt, order: .reverse) private var tickets: [Ticket]
    @Query(sort: \Receipt.issuedAt, order: .reverse) private var receipts: [Receipt]
    @Query(sort: \LoyaltyCard.createdAt, order: .reverse) private var cards: [LoyaltyCard]
    @State private var tab: AppTab = .wallet

    var body: some View {
        tabs
            .sheet(isPresented: $wallet.showScanner) {
                scannerFlow
            }
            .fullScreenCover(isPresented: $wallet.showOnboarding) {
                OnboardingView()
                    .environmentObject(wallet)
            }
            .task {
                await wallet.bootstrap(context: context, tickets: tickets, receipts: receipts, cards: cards)
                if wallet.showOnboarding == false {
                    try? Tips.configure()
                }
            }
            .modifier(RootTabAlerts())
            .onChange(of: wallet.showOnboarding, handleOnboarding)
            .onChange(of: notificationFingerprint, handleNotifications)
            .onChange(of: wallet.pendingTicketID, handlePendingTicket)
            .onChange(of: wallet.pendingReceiptID) { _, _ in openPendingReceipt() }
            .onChange(of: wallet.pendingLoyaltyID) { _, _ in openPendingCard() }
            .onChange(of: wallet.showScanner) { _, _ in
                openPendingReceipt()
                openPendingCard()
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    Task { await wallet.refreshFamilyFromCloud() }
                }
            }
    }

    private var tabs: some View {
        TabView(selection: $tab) {
            Tab("Kaucje", systemImage: "waterbottle.fill", value: AppTab.wallet) {
                NavigationStack(path: $wallet.walletPath) {
                    WalletView()
                        .navigationDestination(for: WalletRoute.self, destination: walletDestination)
                }
            }
            Tab("Paragony", systemImage: "doc.text.fill", value: AppTab.receipts) {
                NavigationStack(path: $wallet.receiptPath) {
                    ReceiptsHomeView()
                        .navigationDestination(for: ReceiptRoute.self, destination: receiptDestination)
                }
            }
            Tab("Karty", systemImage: "creditcard.fill", value: AppTab.cards) {
                NavigationStack(path: $wallet.loyaltyPath) {
                    LoyaltyHomeView()
                }
            }
            Tab("Historia", systemImage: "clock.arrow.circlepath", value: AppTab.history) {
                NavigationStack {
                    HistoryView()
                }
            }
            Tab("Rodzina", systemImage: "person.2.fill", value: AppTab.family) {
                NavigationStack {
                    FamilyView()
                }
            }
        }
    }

    @ViewBuilder
    private func walletDestination(_ route: WalletRoute) -> some View {
        switch route {
        case .settings:
            SettingsView()
        case .ticket(let id):
            if let ticket = tickets.first(where: { $0.id == id }) {
                TicketDetailView(ticket: ticket)
            } else {
                ContentUnavailableView("Nie ma już tego kwitka", systemImage: "ticket")
            }
        case .bottleMap:
            BottleReturnMapView()
        }
    }

    @ViewBuilder
    private func receiptDestination(_ route: ReceiptRoute) -> some View {
        switch route {
        case .settings:
            SettingsView()
        case .receipt(let id):
            if let receipt = receipts.first(where: { $0.id == id }) {
                ReceiptDetailView(receipt: receipt)
            } else {
                ContentUnavailableView("Nie ma już tego paragonu", systemImage: "doc.text")
            }
        }
    }

    private var notificationFingerprint: String {
        let ticketIDs = tickets.map(\.id.uuidString).joined()
        let receiptIDs = receipts.map(\.id.uuidString).joined()
        let settings = wallet.settings
        return [
            ticketIDs,
            receiptIDs,
            settings.reminder7Days,
            settings.reminder1Day,
            settings.reminderOnDay,
            settings.warrantyReminder30,
            settings.warrantyReminder7,
            settings.returnReminder3
        ].map(String.init(describing:)).joined(separator: "|")
    }

    private func handleOnboarding(_ old: Bool, _ showing: Bool) {
        if showing == false {
            try? Tips.configure()
        }
    }

    private func handleNotifications(_ old: String, _ new: String) {
        Task { await wallet.refreshNotifications(tickets: tickets, receipts: receipts) }
    }

    private func handlePendingTicket(_ old: UUID?, _ id: UUID?) {
        guard let id else { return }
        tab = .wallet
        wallet.walletPath.append(WalletRoute.ticket(id))
        wallet.pendingTicketID = nil
    }

    private func openPendingReceipt() {
        guard wallet.showScanner == false, let id = wallet.pendingReceiptID else { return }
        tab = .receipts
        wallet.receiptPath.append(ReceiptRoute.receipt(id))
        wallet.pendingReceiptID = nil
    }

    private func openPendingCard() {
        guard wallet.showScanner == false, let id = wallet.pendingLoyaltyID else { return }
        tab = .cards
        wallet.loyaltyPath.append(LoyaltyRoute.card(id))
        wallet.pendingLoyaltyID = nil
    }

    @ViewBuilder
    private var scannerFlow: some View {
        if wallet.loyaltyDraft != nil {
            LoyaltyScanReviewView()
                .environmentObject(wallet)
        } else if wallet.receiptDraft != nil {
            ReceiptScanReviewView()
                .environmentObject(wallet)
        } else if wallet.scanDraft != nil {
            ScanReviewView()
                .environmentObject(wallet)
        } else if wallet.settings.scanOpensImmediately {
            ImmediateScanCover()
                .environmentObject(wallet)
        } else {
            ScannerHost()
                .environmentObject(wallet)
        }
    }
}

private struct RootTabAlerts: ViewModifier {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context

    func body(content: Content) -> some View {
        content
            .confirmationDialog(
                "Co skanujesz?",
                isPresented: $wallet.askScanIntent,
                titleVisibility: .visible
            ) {
                Button("Kaucja z butelkomatu") {
                    wallet.openScanner(for: .deposit)
                }
                Button("Paragon lub faktura") {
                    wallet.openScanner(for: .receipt)
                }
                Button("Karta lojalnościowa") {
                    wallet.openScanner(for: .loyalty)
                }
                Button("Anuluj", role: .cancel) {}
            } message: {
                Text("Kaucje, paragony i karty są osobno — rodzina dostaje tylko to, co włączysz.")
            }
            .confirmationDialog(
                redeemTitle,
                isPresented: redeemPresented,
                titleVisibility: .visible
            ) {
                Button("Oznacz jako wykorzystany") {
                    if let ticket = wallet.pendingRedeem {
                        try? wallet.markRedeemed(ticket, context: context)
                    }
                    wallet.pendingRedeem = nil
                }
                Button("Zostaw aktywny", role: .cancel) {
                    wallet.pendingRedeem = nil
                }
            } message: {
                Text("Ten kod jest już w kaucjach. Jeśli kasa właśnie go przyjęła, oznacz kwitek jako wykorzystany.")
            }
    }

    private var redeemPresented: Binding<Bool> {
        Binding(
            get: { wallet.pendingRedeem != nil },
            set: { if $0 == false { wallet.pendingRedeem = nil } }
        )
    }

    private var redeemTitle: String {
        guard let ticket = wallet.pendingRedeem else { return "Kwitek z kaucji" }
        let store = RetailerCatalog.policy(id: ticket.retailerID).name
        return "\(store) · \(MoneyFormat.string(ticket.amount))"
    }
}

enum AppTab: Hashable {
    case wallet
    case receipts
    case cards
    case history
    case family
}

import SwiftData
import SwiftUI
import TipKit

struct RootTabView: View {
    @EnvironmentObject private var wallet: WalletModel
    @EnvironmentObject private var lock: BiometricLock
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab: AppTab = .wallet
    @ObservedObject private var coffeeTips = CoffeeTipStore.shared

    var body: some View {
        tabs
            .overlay(alignment: .top) {
                ParagonSyncIsland {
                    wallet.requestCloudSync()
                }
            }
            .sheet(isPresented: $wallet.showScanner) {
                scannerFlow
            }
            .sheet(isPresented: $wallet.coffeeSheetPresented) {
                CoffeeTipSheet {
                    wallet.coffeeSheetPresented = false
                }
            }
            .fullScreenCover(isPresented: $coffeeTips.showThankYou) {
                CoffeeThankYouOverlay {
                    coffeeTips.showThankYou = false
                }
            }
            .onChange(of: coffeeTips.showThankYou) { _, showing in
                if showing {
                    wallet.coffeeSheetPresented = false
                }
            }
            .sheet(isPresented: $wallet.reviewSheetPresented) {
                AppLovePrompt {
                    wallet.reviewSheetPresented = false
                }
            }
            .fullScreenCover(isPresented: $wallet.showOnboarding) {
                OnboardingView()
                    .environmentObject(wallet)
            }
            .task {
                await wallet.bootstrap(context: context)
                if wallet.showOnboarding == false, ParagonUIDemo.isEnabled == false {
                    try? Tips.configure()
                }
            }
            .modifier(RootTabAlerts())
            .onChange(of: wallet.showOnboarding, handleOnboarding)
            .onChange(of: wallet.settings.notificationSettings) { _, _ in
                wallet.scheduleRefreshNotifications()
            }
            .onChange(of: wallet.pendingTicketID, handlePendingTicket)
            .onChange(of: wallet.pendingReceiptID) { _, _ in openPendingReceipt() }
            .onChange(of: wallet.pendingLoyaltyID) { _, _ in openPendingCard() }
            .onChange(of: wallet.showScanner) { _, showing in
                openPendingReceipt()
                openPendingCard()
                if showing == false {
                    considerQuietPrompts()
                }
            }
            .onChange(of: wallet.quietPromptTick) { _, _ in
                considerQuietPrompts()
            }
            .onChange(of: wallet.chromeReady) { _, ready in
                if ready { considerQuietPrompts() }
            }
            .onChange(of: wallet.showCheckoutFor) { _, id in
                if id == nil { considerQuietPrompts() }
            }
            .onChange(of: wallet.showLoyaltyCheckoutFor) { _, id in
                if id == nil { considerQuietPrompts() }
            }
            .onChange(of: wallet.requestedTab) { _, tab in
                if let tab {
                    self.tab = tab
                    wallet.requestedTab = nil
                }
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    wallet.consumePendingLaunch()
                    wallet.scheduleRefreshNotifications()
                    Task { await wallet.refreshFamilyFromCloud() }
                }
            }
    }

    private var tabs: some View {
        TabView(selection: $tab) {
            Tab("Kaucje", systemImage: "waterbottle.fill", value: AppTab.wallet) {
                NavigationStack(path: $wallet.walletPath) {
                    WalletView()
                        .containerBackground(ParagonTheme.canvas, for: .navigation)
                        .navigationDestination(for: WalletRoute.self, destination: walletDestination)
                }
            }
            Tab("Paragony", systemImage: "doc.text.fill", value: AppTab.receipts) {
                NavigationStack(path: $wallet.receiptPath) {
                    ReceiptsHomeView()
                        .containerBackground(ParagonTheme.canvas, for: .navigation)
                        .navigationDestination(for: ReceiptRoute.self, destination: receiptDestination)
                }
            }
            Tab("Karty", systemImage: "creditcard.fill", value: AppTab.cards) {
                NavigationStack(path: $wallet.loyaltyPath) {
                    LoyaltyHomeView()
                        .containerBackground(ParagonTheme.canvas, for: .navigation)
                }
            }
            Tab("Historia", systemImage: "clock.arrow.circlepath", value: AppTab.history) {
                NavigationStack {
                    HistoryView()
                        .containerBackground(ParagonTheme.canvas, for: .navigation)
                }
            }
            Tab("Rodzina", systemImage: "person.2.fill", value: AppTab.family) {
                NavigationStack {
                    FamilyView()
                        .containerBackground(ParagonTheme.canvas, for: .navigation)
                }
            }
        }
        // Revolut / Liquid Glass: shrink on scroll-up, expand after a short scroll-down.
        .modifier(TabBarScrollMinimize())
    }

    @ViewBuilder
    private func walletDestination(_ route: WalletRoute) -> some View {
        switch route {
        case .settings:
            SettingsView()
        case .ticket(let id):
            TicketByIDView(id: id)
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
            ReceiptByIDView(id: id)
        case .merchant(let key):
            ReceiptMerchantByKeyView(key: key)
        }
    }

    private func considerQuietPrompts() {
        let blocked = wallet.showScanner
            || wallet.askScanIntent
            || wallet.showOnboarding
            || wallet.showCheckoutFor != nil
            || wallet.showLoyaltyCheckoutFor != nil
            || lock.isLocked
            || coffeeTips.showThankYou
        wallet.considerQuietPrompts(blocked: blocked)
    }

    private func handleOnboarding(_ old: Bool, _ showing: Bool) {
        if showing == false {
            try? Tips.configure()
        }
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

private struct TicketByIDView: View {
    let id: UUID
    @Query private var tickets: [Ticket]

    init(id: UUID) {
        self.id = id
        let identifier = id
        _tickets = Query(filter: #Predicate<Ticket> { $0.id == identifier })
    }

    var body: some View {
        if let ticket = tickets.first {
            TicketDetailView(ticket: ticket)
        } else {
            ContentUnavailableView("Nie ma już tego kwitka", systemImage: "ticket")
        }
    }
}

private struct ReceiptByIDView: View {
    let id: UUID
    @Query private var receipts: [Receipt]

    init(id: UUID) {
        self.id = id
        let identifier = id
        _receipts = Query(filter: #Predicate<Receipt> { $0.id == identifier })
    }

    var body: some View {
        if let receipt = receipts.first {
            ReceiptDetailView(receipt: receipt)
        } else {
            ContentUnavailableView("Nie ma już tego paragonu", systemImage: "doc.text")
        }
    }
}

private struct ReceiptMerchantByKeyView: View {
    let key: String
    @Query(sort: \Receipt.issuedAt, order: .reverse) private var receipts: [Receipt]

    var body: some View {
        if let group = ReceiptMerchantGroup.allTime(from: receipts).first(where: { $0.merchantKey == key }) {
            ReceiptMerchantDetailView(group: group)
        } else {
            ContentUnavailableView("Nie ma już tego sklepu", systemImage: "storefront")
        }
    }
}

/// Native Liquid Glass tab minimize (iOS 26+): shrink while scrolling content up, expand on scroll down.
private struct TabBarScrollMinimize: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            content
        }
    }
}

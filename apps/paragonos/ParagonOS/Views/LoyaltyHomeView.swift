import SwiftData
import SwiftUI
import TipKit

struct LoyaltyHomeView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Query(sort: \LoyaltyCard.sortOrder, order: .forward) private var cards: [LoyaltyCard]
    @State private var query = ""
    @State private var isSearching = false
    @State private var showPicker = false
    @State private var spread: CGFloat = 0
    @State private var openingID: UUID?
    @State private var scrollOffsetY: CGFloat = 0
    @State private var isReordering = false
    @Namespace private var passSpace

    private var uniqueCards: [LoyaltyCard] {
        FamilyMergePolicy.uniqued(cards, id: \.id)
    }

    private var filtered: [LoyaltyCard] {
        uniqueCards.filter { card in
            if query.isEmpty { return true }
            let haystack = "\(card.displayName) \(card.holderName) \(card.barcodePayload) \(card.note)".lowercased()
            return haystack.contains(query.lowercased())
        }
    }

    var body: some View {
        Group {
            if uniqueCards.isEmpty && query.isEmpty {
                ScrollView {
                    VStack(spacing: 20) {
                        ContentUnavailableView {
                            Label("Brak kart", systemImage: "creditcard")
                        } description: {
                            Text("Zeskanuj kartę lojalnościową. Jeśli sieć się nie rozpozna, wybierzesz sklep z bazy.")
                        } actions: {
                            Button("Skanuj kartę") { wallet.openScanner(for: .loyalty) }
                                .buttonStyle(.borderedProminent)
                            Button("Wybierz sklep") { showPicker = true }
                        }
                        ParagonTipCard(tip: FirstScanTip.loyalty)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 28)
                }
                .scrollBounceBehavior(.basedOnSize)
                .scrollIndicators(.hidden)
                .paragonTabClearance()
            } else if filtered.isEmpty {
                ContentUnavailableView(
                    "Nic nie pasuje",
                    systemImage: "magnifyingglass",
                    description: Text("Spróbuj innej nazwy sklepu albo numeru karty.")
                )
            } else {
                ScrollView {
                    LoyaltyPassStack(
                        cards: filtered,
                        zoomNamespace: passSpace,
                        scrollOffsetY: scrollOffsetY,
                        spread: $spread,
                        openingID: $openingID,
                        isReordering: $isReordering,
                        onOpen: { card in
                            wallet.loyaltyPath.append(LoyaltyRoute.card(card.id))
                        },
                        onCommitOrder: { ids in
                            commitCardOrder(ids)
                        }
                    )
                    .padding(.horizontal, 16)
                    .padding(.top, 2)
                    .padding(.bottom, 12)
                    .id("loyalty-wallet-stack")
                }
                .scrollIndicators(.hidden)
                .scrollDismissesKeyboard(.interactively)
                .scrollBounceBehavior(.always)
                .scrollDisabled(isReordering)
                .scrollClipDisabled()
                // Extra runway under the pile so the last peeks clear the floating tab bar.
                .contentMargins(.bottom, 128, for: .scrollContent)
                .ignoresSafeArea(edges: .bottom)
                .onScrollGeometryChange(for: CGFloat.self) { geo in
                    geo.contentOffset.y
                } action: { _, new in
                    scrollOffsetY = new
                }
                .task {
                    wallet.dedupeFamilyLocals(in: context)
                    normalizeSortOrdersIfNeeded()
                }
                .onChange(of: wallet.loyaltyPath.count) { _, count in
                    // Clear zoom source immediately so swipe-back isn't fighting a lifted card.
                    if count == 0 {
                        var t = Transaction()
                        t.disablesAnimations = true
                        withTransaction(t) {
                            openingID = nil
                        }
                    }
                }
                .onChange(of: filtered.map(\.id)) { _, _ in
                    if filtered.count <= 1 {
                        spread = 0
                    }
                }
            }
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        .navigationTitle("Karty")
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: LoyaltyRoute.self) { route in
            loyaltyDestination(route)
        }
        .searchable(text: $query, isPresented: $isSearching, prompt: "Sklep lub numer karty")
        .sensoryFeedback(.selection, trigger: spread)
        .sensoryFeedback(.success, trigger: uniqueCards.count)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    spread = 0
                    wallet.loyaltyPath.append(LoyaltyRoute.settings)
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Ustawienia")
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                if wallet.settings.scanOpensImmediately {
                    Button {
                        spread = 0
                        wallet.openScanner(for: .loyalty)
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Skanuj kartę")
                } else {
                    Menu {
                        Button("Skanuj kartę", systemImage: "viewfinder") {
                            spread = 0
                            wallet.openScanner(for: .loyalty)
                        }
                        Button("Wybierz sklep", systemImage: "storefront") {
                            spread = 0
                            showPicker = true
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Dodaj kartę")
                }
            }
        }
        .sheet(isPresented: $showPicker) {
            LoyaltyProgramPicker { program in
                wallet.openManualLoyalty(program: program)
            }
        }
        .fullScreenCover(item: loyaltyCheckoutBinding) { card in
            LoyaltyCheckoutView(card: card)
                .environmentObject(wallet)
        }
    }

    @ViewBuilder
    private func loyaltyDestination(_ route: LoyaltyRoute) -> some View {
        switch route {
        case .settings:
            SettingsView()
        case .card(let id):
            if let card = uniqueCards.first(where: { $0.id == id }) {
                LoyaltyCardDetailView(card: card)
                    .navigationTransition(.zoom(sourceID: id, in: passSpace))
                    .onDisappear {
                        // Ensure source is calm if path pop didn't clear via count==0 race.
                        if wallet.loyaltyPath.isEmpty {
                            openingID = nil
                        }
                    }
            } else {
                ContentUnavailableView("Nie ma już tej karty", systemImage: "creditcard")
            }
        }
    }

    private var loyaltyCheckoutBinding: Binding<LoyaltyCard?> {
        Binding(
            get: {
                guard let id = wallet.showLoyaltyCheckoutFor else { return nil }
                return uniqueCards.first { $0.id == id }
            },
            set: { wallet.showLoyaltyCheckoutFor = $0?.id }
        )
    }

    /// Persist Wallet stack order after finger-up only.
    private func commitCardOrder(_ ids: [UUID]) {
        let byID = Dictionary(uniqueCards.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for (index, id) in ids.enumerated() {
            guard let card = byID[id] else { continue }
            card.sortOrder = Double(index)
            card.updatedAt = Date()
        }
        try? context.save()
        wallet.publishHomeChrome(from: context)
    }

    /// Migrate legacy cards (all sortOrder 0) into createdAt order.
    private func normalizeSortOrdersIfNeeded() {
        guard uniqueCards.count > 1 else { return }
        let unique = Set(uniqueCards.map(\.sortOrder))
        guard unique.count <= 1 else { return }
        let sorted = uniqueCards.sorted { $0.createdAt > $1.createdAt }
        for (index, card) in sorted.enumerated() {
            card.sortOrder = Double(index)
        }
        try? context.save()
    }
}

import SwiftData
import SwiftUI
import TipKit

struct LoyaltyHomeView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Query(sort: \LoyaltyCard.createdAt, order: .reverse) private var cards: [LoyaltyCard]
    @State private var query = ""
    @State private var isSearching = false
    @State private var showPicker = false
    @State private var expandedProgramID: String?
    @State private var openingID: UUID?
    @State private var viewportHeight: CGFloat = 0
    @Namespace private var passSpace

    private var filtered: [LoyaltyCard] {
        cards.filter { card in
            if query.isEmpty { return true }
            let haystack = "\(card.displayName) \(card.holderName) \(card.barcodePayload) \(card.note)".lowercased()
            return haystack.contains(query.lowercased())
        }
    }

    var body: some View {
        Group {
            if cards.isEmpty && query.isEmpty {
                ContentUnavailableView {
                    Label("Brak kart", systemImage: "creditcard")
                } description: {
                    Text("Zeskanuj kartę lojalnościową. Jeśli sieć się nie rozpozna, wybierzesz sklep z bazy.")
                } actions: {
                    Button("Skanuj kartę") { wallet.openScanner(for: .loyalty) }
                        .buttonStyle(.borderedProminent)
                        .popoverTip(FirstScanTip.loyalty)
                    Button("Wybierz sklep") { showPicker = true }
                }
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            if isSearching == false, expandedProgramID == nil {
                                summary
                            }
                            if filtered.isEmpty {
                                ContentUnavailableView(
                                    "Nic nie pasuje",
                                    systemImage: "magnifyingglass",
                                    description: Text("Spróbuj innej nazwy sklepu albo numeru karty.")
                                )
                                .frame(maxWidth: .infinity)
                                .padding(.top, 24)
                            } else {
                                ForEach(LoyaltyProgramGroup.groups(from: filtered)) { group in
                                    LoyaltyPassStack(
                                        cards: group.cards,
                                        zoomNamespace: passSpace,
                                        viewportHeight: viewportHeight,
                                        isExpanded: expandedBinding(group.id),
                                        openingID: $openingID,
                                        onOpen: { card in
                                            wallet.loyaltyPath.append(LoyaltyRoute.card(card.id))
                                        },
                                        onCheckout: { card in
                                            wallet.showLoyaltyCheckoutFor = card.id
                                        }
                                    )
                                    .id("loyalty-\(group.id)")
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 4)
                        .padding(.bottom, 28)
                    }
                    .scrollIndicators(.hidden)
                    .scrollDismissesKeyboard(.interactively)
                    .scrollBounceBehavior(.basedOnSize)
                    .scrollClipDisabled()
                    .background {
                        GeometryReader { geo in
                            Color.clear.preference(key: LoyaltyStackViewportKey.self, value: geo.size.height)
                        }
                    }
                    .onPreferenceChange(LoyaltyStackViewportKey.self) { viewportHeight = $0 }
                    .onChange(of: expandedProgramID) { _, expanded in
                        guard expanded != nil else { return }
                        DispatchQueue.main.async {
                            withAnimation(PassStackMotion.snappy) {
                                proxy.scrollTo("loyalty-\(expanded ?? "")", anchor: .top)
                            }
                        }
                    }
                    .onChange(of: wallet.loyaltyPath.count) { _, count in
                        if count == 0 {
                            openingID = nil
                        }
                    }
                }
            }
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .navigationTitle("Karty")
        .navigationDestination(for: LoyaltyRoute.self) { route in
            loyaltyDestination(route)
        }
        .searchable(text: $query, isPresented: $isSearching, prompt: "Sklep lub numer karty")
        .sensoryFeedback(.selection, trigger: expandedProgramID)
        .sensoryFeedback(.success, trigger: cards.count)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    expandedProgramID = nil
                    wallet.loyaltyPath.append(LoyaltyRoute.settings)
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Ustawienia")
            }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if wallet.settings.scanOpensImmediately {
                        Button {
                            expandedProgramID = nil
                            wallet.openScanner(for: .loyalty)
                        } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel("Skanuj kartę")
                    } else {
                        Menu {
                            Button("Skanuj kartę", systemImage: "viewfinder") {
                                expandedProgramID = nil
                                wallet.openScanner(for: .loyalty)
                            }
                            Button("Wybierz sklep", systemImage: "storefront") {
                                expandedProgramID = nil
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

    private func expandedBinding(_ id: String) -> Binding<Bool> {
        Binding(
            get: { expandedProgramID == id },
            set: { expandedProgramID = $0 ? id : nil }
        )
    }

    @ViewBuilder
    private func loyaltyDestination(_ route: LoyaltyRoute) -> some View {
        switch route {
        case .settings:
            SettingsView()
        case .card(let id):
            if let card = cards.first(where: { $0.id == id }) {
                LoyaltyCardDetailView(card: card)
                    .navigationTransition(.zoom(sourceID: id, in: passSpace))
            } else {
                ContentUnavailableView("Nie ma już tej karty", systemImage: "creditcard")
            }
        }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(PolishDates.cardCount(cards.count))
                .font(.title2.weight(.bold))
            Text("Przy kasie pokazujesz kod z karty albo dodajesz ją do Apple Wallet.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }

    private var loyaltyCheckoutBinding: Binding<LoyaltyCard?> {
        Binding(
            get: {
                guard let id = wallet.showLoyaltyCheckoutFor else { return nil }
                return cards.first { $0.id == id }
            },
            set: { wallet.showLoyaltyCheckoutFor = $0?.id }
        )
    }
}

private struct LoyaltyStackViewportKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

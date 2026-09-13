import SwiftData
import SwiftUI

struct LoyaltyHomeView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Query(sort: \LoyaltyCard.createdAt, order: .reverse) private var cards: [LoyaltyCard]
    @State private var query = ""
    @State private var isSearching = false
    @State private var showPicker = false
    @State private var stackExpanded = false
    @State private var openingID: UUID?
    @State private var viewportHeight: CGFloat = 0
    @FocusState private var searchFocused: Bool
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
                    Text("Zeskanuj kartę lojalnościową. Jeśli sieć się nie rozpozna, wybierzesz sklep z bazy z oryginalnym logotypem.")
                } actions: {
                    Button("Skanuj kartę") { wallet.openScanner(for: .loyalty) }
                        .buttonStyle(.borderedProminent)
                    Button("Wybierz sklep") { showPicker = true }
                }
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            if isSearching {
                                searchField
                            }
                            if stackExpanded == false {
                                summary
                            }
                            if filtered.isEmpty {
                                Text("Nic nie pasuje do wyszukiwania.")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal, 4)
                            } else {
                                LoyaltyPassStack(
                                    cards: filtered,
                                    zoomNamespace: passSpace,
                                    viewportHeight: viewportHeight,
                                    isExpanded: $stackExpanded,
                                    openingID: $openingID,
                                    onOpen: { card in
                                        wallet.loyaltyPath.append(LoyaltyRoute.card(card.id))
                                    },
                                    onCheckout: { card in
                                        wallet.showLoyaltyCheckoutFor = card.id
                                    }
                                )
                                .id("loyaltyStack")
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
                    .onChange(of: stackExpanded) { _, expanded in
                        guard expanded else { return }
                        DispatchQueue.main.async {
                            withAnimation(PassStackMotion.snappy) {
                                proxy.scrollTo("loyaltyStack", anchor: .top)
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
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    stackExpanded = false
                    wallet.loyaltyPath.append(LoyaltyRoute.settings)
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Ustawienia")
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        stackExpanded = false
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
                Menu {
                    Button("Skanuj kartę", systemImage: "viewfinder") {
                        stackExpanded = false
                        wallet.openScanner(for: .loyalty)
                    }
                    Button("Wybierz sklep", systemImage: "storefront") {
                        stackExpanded = false
                        showPicker = true
                    }
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Dodaj kartę")
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

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Sklep lub numer karty", text: $query)
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
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(.tertiarySystemFill))
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

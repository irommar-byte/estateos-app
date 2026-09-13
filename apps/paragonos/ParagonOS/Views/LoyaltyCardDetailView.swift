import SwiftData
import SwiftUI

struct LoyaltyCardDetailView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Bindable var card: LoyaltyCard
    @State private var showCheckout = false
    @State private var confirmDelete = false

    var body: some View {
        List {
            Section {
                LoyaltyCardPass(card: card, showsBarcode: true)
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
            }

            Section {
                Button {
                    showCheckout = true
                } label: {
                    Label("Pokaż przy kasie", systemImage: "barcode.viewfinder")
                }
            }

            Section("Apple Wallet") {
                AddToWalletButton(card: card) {
                    card.addedToAppleWallet = true
                    try? wallet.persistLoyalty(card, context: context)
                }
            }

            Section("Szczegóły") {
                LabeledContent("Program", value: card.displayName)
                TextField("Właściciel", text: $card.holderName)
                    .textInputAutocapitalization(.words)
                    .onChange(of: card.holderName) { _, _ in persist() }
                LabeledContent("Kod", value: card.barcodePayload)
                Picker("Typ", selection: barcodeTypeBinding) {
                    ForEach(BarcodeSymbology.userSelectable, id: \.self) { item in
                        Text(item.title).tag(item)
                    }
                }
                TextField("Notatka", text: $card.note, axis: .vertical)
                    .lineLimit(2...4)
                    .onChange(of: card.note) { _, _ in persist() }
                if card.scannedByName.isEmpty == false {
                    LabeledContent("Dodał", value: card.scannedByName)
                }
            }

            if wallet.family.familyWalletID != nil, card.familyShareID == nil {
                Section("Rodzina") {
                    Button("Udostępnij rodzinie") {
                        Task { await wallet.shareLoyaltyWithFamily(card, context: context) }
                    }
                }
            }

            Section {
                Button("Usuń kartę", role: .destructive) {
                    confirmDelete = true
                }
            }
        }
        .navigationTitle(card.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $showCheckout) {
            LoyaltyCheckoutView(card: card)
                .environmentObject(wallet)
        }
        .confirmationDialog("Usunąć kartę?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Usuń", role: .destructive) {
                context.delete(card)
                try? context.save()
                dismiss()
            }
            Button("Anuluj", role: .cancel) {}
        }
    }

    private func persist() {
        try? wallet.persistLoyalty(card, context: context)
    }

    private var barcodeTypeBinding: Binding<BarcodeSymbology> {
        Binding(
            get: { card.barcodeSymbology == .unknown ? .qr : card.barcodeSymbology },
            set: { next in
                card.barcodeSymbology = next
                persist()
            }
        )
    }
}

import SwiftData
import SwiftUI

struct TicketDetailView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Bindable var ticket: Ticket
    @State private var showCheckout = false
    @State private var confirmDelete = false
    @State private var confirmRestore = false
    @State private var confirmRedeem = false

    private var policy: RetailerPolicy { RetailerCatalog.policy(id: ticket.retailerID) }
    private var status: TicketLifecycleStatus { ticket.resolvedStatus() }

    var body: some View {
        List {
            Section {
                VoucherPassCard(ticket: ticket)
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
            }

            Section("Szczegóły") {
                LabeledContent("Sieć") {
                    HStack(spacing: 8) {
                        RetailerLogo(retailerID: ticket.retailerID, size: 28)
                        Text(policy.name)
                    }
                }
                LabeledContent("Kwota", value: MoneyFormat.string(ticket.amount))
                LabeledContent("Wystawiono", value: PolishDates.display.string(from: ticket.issuedAt))
                if let expiresAt = ticket.expiresAt {
                    LabeledContent("Ważny do", value: PolishDates.display.string(from: expiresAt))
                }
                if ticket.ticketNumber.isEmpty == false {
                    LabeledContent("Numer", value: ticket.ticketNumber)
                }
                if ticket.scannedByName.isEmpty == false {
                    LabeledContent("Zeskanował", value: ticket.scannedByName)
                }
                if ticket.redeemedByName.isEmpty == false {
                    LabeledContent("Zrealizował", value: ticket.redeemedByName)
                }
            }

            Section("Notatka") {
                TextField("Np. który automat, która kasa…", text: $ticket.note, axis: .vertical)
                    .lineLimit(2...4)
                    .onChange(of: ticket.note) { _, _ in
                        try? wallet.persistTicket(ticket, context: context)
                    }
            }

            Section("Przy kasie") {
                Text(policy.checkoutHint)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button {
                    showCheckout = true
                } label: {
                    Label("Pokaż przy kasie", systemImage: "barcode")
                }
            }

            if status == .active {
                Section {
                    Button {
                        confirmRedeem = true
                    } label: {
                        Label("Oznacz jako wykorzystany", systemImage: "checkmark.circle")
                    }
                }
            }

            if status == .redeemed {
                Section {
                    Button {
                        confirmRestore = true
                    } label: {
                        Label("Przywróć do kaucji", systemImage: "arrow.uturn.backward.circle")
                    }
                }
            }

            if wallet.family.familyWalletID != nil {
                Section("Rodzina") {
                    if ticket.familyWalletID == nil {
                        Button {
                            Task { await wallet.shareTicketWithFamily(ticket, context: context) }
                        } label: {
                            Label("Udostępnij rodzinie", systemImage: "person.2")
                        }
                    } else {
                        Label("Udostępniony rodzinie", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(ParagonTheme.osGreen)
                        Button("Przestań udostępniać", role: .destructive) {
                            Task { await wallet.stopSharingTicket(ticket, context: context) }
                        }
                    }
                }
            }

            Section {
                Button(role: .destructive) {
                    confirmDelete = true
                } label: {
                    Label("Usuń kwitek", systemImage: "trash")
                }
            }
        }
        .navigationTitle(policy.name)
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $showCheckout) {
            CheckoutCodeView(ticket: ticket)
                .environmentObject(wallet)
        }
        .confirmationDialog(
            "Czy kasa przyjęła kupon?",
            isPresented: $confirmRedeem,
            titleVisibility: .visible
        ) {
            Button("Tak, wykorzystany") {
                try? wallet.markRedeemed(ticket, context: context)
            }
            Button("Anuluj", role: .cancel) {}
        } message: {
            Text("Po skanie przy kasie oznacz kwitek jako wykorzystany, żeby nie leżał w portfelu.")
        }
        .confirmationDialog("Usunąć kwitek z kaucji?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Usuń", role: .destructive) {
                try? wallet.delete(ticket, context: context)
                dismiss()
            }
        } message: {
            Text("Kwitek zniknie z tego iPhone’a. Jeśli był udostępniony, zniknie też u rodziny.")
        }
        .confirmationDialog("Przywrócić kwitek do kaucji?", isPresented: $confirmRestore, titleVisibility: .visible) {
            Button("Przywróć") {
                try? wallet.restoreToWallet(ticket, context: context)
            }
            Button("Anuluj", role: .cancel) {}
        } message: {
            if let expiresAt = ticket.expiresAt, expiresAt < Date() {
                Text("Termin tego kwitka już minął. Po przywróceniu trafi do przeterminowanych, nie do Kaucji. Na pewno?")
            } else {
                Text("Kwitek wróci do Kaucji jako aktywny. Na pewno?")
            }
        }
    }
}

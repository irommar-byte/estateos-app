import SwiftData
import SwiftUI

struct ScanReviewView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @State private var draft: VoucherDraft
    @State private var photo: UIImage?
    @State private var saveError: String?
    @State private var showExpiredAlert = false

    init() {
        _draft = State(initialValue: .blank())
        _photo = State(initialValue: nil)
    }

    private var policy: RetailerPolicy { RetailerCatalog.policy(id: draft.retailerID) }

    var body: some View {
        NavigationStack {
            Form {
                if draft.isExpired() {
                    Section {
                        Label("Ten kwitek jest przeterminowany", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .font(.headline)
                        if let expiresAt = draft.expiresAt {
                            Text("Ważny był do \(PolishDates.display.string(from: expiresAt)). Możesz go zapisać — trafi do historii, kasa go nie przyjmie.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                if let saveError {
                    Section {
                        Text(saveError)
                            .foregroundStyle(.red)
                    }
                }
                if let message = wallet.scanError {
                    Section {
                        Text(message)
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    HStack(spacing: 16) {
                        RetailerLogo(retailerID: draft.retailerID, size: 64)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(policy.name)
                                .font(.title2.weight(.bold))
                            Text(draft.retailerID == "unknown"
                                 ? "Nie rozpoznano sieci — wybierz z listy."
                                 : "Rozpoznano z kwitka")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 4)

                    Menu {
                        ForEach(RetailerCatalog.shared) { item in
                            Button {
                                selectRetailer(item.id)
                            } label: {
                                Label {
                                    Text(item.name)
                                } icon: {
                                    RetailerLogo(retailerID: item.id, size: 22)
                                }
                            }
                        }
                    } label: {
                        HStack {
                            Text("Sieć")
                                .foregroundStyle(.primary)
                            Spacer()
                            Text(policy.name)
                                .foregroundStyle(ParagonTheme.osGreen)
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Kwota kaucji") {
                    TextField("0,00 zł", value: $draft.amount, format: .currency(code: "PLN").locale(Locale(identifier: "pl_PL")))
                        .keyboardType(.decimalPad)
                }

                Section("Daty") {
                    DatePicker("Wystawiono", selection: $draft.issuedAt, displayedComponents: .date)
                    if draft.expiresAt != nil {
                        DatePicker(
                            "Ważny do",
                            selection: Binding(
                                get: { draft.expiresAt ?? draft.issuedAt },
                                set: { draft.expiresAt = $0 }
                            ),
                            displayedComponents: .date
                        )
                    } else {
                        Text("Brak terminu — uzupełnij, jeśli jest na kwitku.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Button("Dodaj datę ważności") {
                            draft.expiresAt = draft.issuedAt
                        }
                    }
                    Button("Policz z zasad sieci") {
                        applyPolicyExpiry()
                    }
                }

                Section("Kod") {
                    TextField("Kod kreskowy lub QR", text: $draft.barcodePayload)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Picker("Typ", selection: $draft.barcodeSymbology) {
                        ForEach(BarcodeSymbology.allCases, id: \.self) { item in
                            Text(item.title).tag(item)
                        }
                    }
                    TextField("Numer kwitka", text: $draft.ticketNumber)
                }

                Section("Zdjęcie") {
                    if let photo {
                        Image(uiImage: photo)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 180)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    } else {
                        Text("Brak zdjęcia — przy kasie dostępny będzie tylko kod.")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Sprawdź kwitek")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Wstecz") {
                        wallet.scanDraft = nil
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Zapisz") { save() }
                        .fontWeight(.semibold)
                }
            }
            .onAppear {
                if let existing = wallet.scanDraft {
                    var next = existing
                    if next.barcodePayload.isEmpty {
                        next.barcodePayload = CheckoutCode.payload(
                            barcode: next.barcodePayload,
                            ticketNumber: next.ticketNumber
                        )
                        if next.barcodePayload.isEmpty, let digits = VoucherParser.parseDigitBarcode(in: next.ocrText) {
                            next.barcodePayload = digits
                        }
                        if next.barcodePayload.isEmpty == false, next.barcodeSymbology == .unknown {
                            next.barcodeSymbology = .code128
                        }
                    }
                    draft = next
                }
                photo = wallet.scanPhoto
                if draft.isExpired() {
                    showExpiredAlert = true
                }
            }
            .onChange(of: draft.expiresAt) { _, _ in
                if draft.isExpired() {
                    showExpiredAlert = true
                }
            }
            .alert("Kwitek przeterminowany", isPresented: $showExpiredAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                if let expiresAt = draft.expiresAt {
                    Text("Termin minął \(PolishDates.display.string(from: expiresAt)). Kasa takiego kuponu nie przyjmie.")
                } else {
                    Text("Kasa takiego kuponu nie przyjmie.")
                }
            }
            .onChange(of: draft.issuedAt) { _, _ in
                if draft.expiryWasPrinted == false {
                    applyPolicyExpiry()
                }
            }
        }
    }

    private func selectRetailer(_ id: String) {
        draft.retailerID = id
        applyPolicyExpiry()
    }

    private func applyPolicyExpiry() {
        let next = RetailerCatalog.policy(id: draft.retailerID)
        draft.expiresAt = RetailerCatalog.defaultExpiry(for: next, issuedAt: draft.issuedAt)
    }

    private func save() {
        do {
            _ = try wallet.save(
                draft: draft,
                photo: photo,
                context: context,
                shareWithFamily: wallet.settings.shareNewTicketsWithFamily && wallet.family.familyWalletID != nil
            )
        } catch {
            saveError = error.localizedDescription
        }
    }
}

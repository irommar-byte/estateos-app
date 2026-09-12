import SwiftData
import SwiftUI

struct ReceiptScanReviewView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @State private var draft: ReceiptDraft
    @State private var photo: UIImage?
    @State private var saveError: String?

    init() {
        _draft = State(initialValue: .blank())
        _photo = State(initialValue: nil)
    }

    var body: some View {
        NavigationStack {
            Form {
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
                    TextField("Sklep lub sprzedawca", text: $draft.merchantName)
                        .textInputAutocapitalization(.words)
                    TextField("NIP", text: $draft.merchantNIP)
                        .keyboardType(.numberPad)
                    Picker("Dokument", selection: $draft.documentType) {
                        ForEach(ReceiptDocumentType.allCases) { type in
                            Text(type.title).tag(type)
                        }
                    }
                    TextField("Numer dokumentu", text: $draft.documentNumber)
                        .textInputAutocapitalization(.never)
                    Picker("Płatność", selection: $draft.payment) {
                        ForEach(ReceiptPaymentMethod.allCases) { method in
                            Text(method.title).tag(method)
                        }
                    }
                } header: {
                    Text("Sprzedawca")
                } footer: {
                    if draft.ocrConfidence > 0, draft.ocrConfidence < 0.55 {
                        Text("Odczyt jest niepewny — sprawdź sklep, kwotę i datę.")
                    }
                }

                Section("Towar") {
                    TextField("Nazwa towaru lub usługi", text: $draft.itemName, axis: .vertical)
                        .lineLimit(2...4)
                        .textInputAutocapitalization(.sentences)
                }

                Section("Kwota") {
                    TextField("0,00 zł", value: $draft.amount, format: .currency(code: "PLN").locale(Locale(identifier: "pl_PL")))
                        .keyboardType(.decimalPad)
                    if draft.taxAmount > 0 {
                        LabeledContent("VAT", value: MoneyFormat.string(draft.taxAmount))
                    }
                }

                Section("Kategoria") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 72), spacing: 8)], spacing: 8) {
                        ForEach(ReceiptCategory.allCases) { category in
                            Button {
                                selectCategory(category)
                            } label: {
                                VStack(spacing: 6) {
                                    ReceiptCategoryMark(category: category, size: 38)
                                    Text(category.title)
                                        .font(.caption2)
                                        .foregroundStyle(draft.category == category ? .primary : .secondary)
                                        .lineLimit(1)
                                }
                                .padding(.vertical, 8)
                                .frame(maxWidth: .infinity)
                                .background(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(draft.category == category ? category.color.opacity(0.18) : Color(.tertiarySystemFill))
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(category.title)
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                }

                Section("Terminy") {
                    DatePicker("Zakup", selection: $draft.issuedAt, displayedComponents: .date)
                    if draft.returnUntil != nil {
                        DatePicker(
                            "Zwrot do",
                            selection: Binding(
                                get: { draft.returnUntil ?? draft.issuedAt },
                                set: { draft.returnUntil = $0 }
                            ),
                            displayedComponents: .date
                        )
                    } else if draft.category.returnDays != nil {
                        Button("Dodaj 14 dni na zwrot") {
                            draft.returnUntil = ReceiptParser.applyCategoryDates(category: draft.category, issuedAt: draft.issuedAt).returning
                        }
                    }
                    if draft.warrantyUntil != nil {
                        DatePicker(
                            "Gwarancja do",
                            selection: Binding(
                                get: { draft.warrantyUntil ?? draft.issuedAt },
                                set: { draft.warrantyUntil = $0 }
                            ),
                            displayedComponents: .date
                        )
                    } else if draft.category.warrantyMonths != nil {
                        Button("Dodaj gwarancję 24 mies.") {
                            draft.warrantyUntil = ReceiptParser.applyCategoryDates(category: draft.category, issuedAt: draft.issuedAt).warranty
                        }
                    }
                }

                Section("Zdjęcie") {
                    if let photo {
                        Image(uiImage: photo)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 180)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    } else {
                        Text("Brak zdjęcia — możesz zapisać same dane.")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Sprawdź paragon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Wstecz") {
                        wallet.receiptDraft = nil
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Zapisz") { save() }
                        .fontWeight(.semibold)
                        .disabled(draft.scanIsComplete == false)
                }
            }
            .onAppear {
                if let existing = wallet.receiptDraft {
                    draft = existing
                }
                photo = wallet.scanPhoto
            }
            .onChange(of: draft.issuedAt) { _, date in
                let dates = ReceiptParser.applyCategoryDates(category: draft.category, issuedAt: date)
                draft.warrantyUntil = dates.warranty
                draft.returnUntil = dates.returning
            }
        }
    }

    private func selectCategory(_ category: ReceiptCategory) {
        draft.category = category
        let dates = ReceiptParser.applyCategoryDates(category: category, issuedAt: draft.issuedAt)
        draft.warrantyUntil = dates.warranty
        draft.returnUntil = dates.returning
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func save() {
        do {
            _ = try wallet.saveReceipt(
                draft: draft,
                photo: photo,
                context: context,
                shareWithFamily: wallet.settings.shareNewReceiptsWithFamily && wallet.family.familyWalletID != nil
            )
        } catch {
            saveError = error.localizedDescription
        }
    }
}

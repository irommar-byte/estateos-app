import SwiftData
import SwiftUI
import UIKit

struct ReceiptDetailView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Bindable var receipt: Receipt
    @State private var confirmDelete = false
    @State private var showPhoto = false

    var body: some View {
        List {
            Section {
                HStack(spacing: 14) {
                    ReceiptCategoryMark(category: receipt.category, size: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(receipt.merchantName)
                            .font(.title3.weight(.bold))
                        Text(receipt.documentType.title)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 4)
                Text(MoneyFormat.string(receipt.amount))
                    .font(.system(size: 32, weight: .bold, design: .rounded))
            }

            if let data = receipt.photoData, let image = UIImage(data: data) {
                Section("Zdjęcie") {
                    Button {
                        showPhoto = true
                    } label: {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    ShareLink(
                        item: Image(uiImage: image),
                        preview: SharePreview(receipt.merchantName, image: Image(uiImage: image))
                    ) {
                        Label("Udostępnij zdjęcie", systemImage: "square.and.arrow.up")
                    }
                }
            }

            Section("Dane") {
                Picker("Kategoria", selection: $receipt.category) {
                    ForEach(ReceiptCategory.allCases) { category in
                        Label(category.title, systemImage: category.symbol).tag(category)
                    }
                }
                Picker("Dokument", selection: $receipt.documentType) {
                    ForEach(ReceiptDocumentType.allCases) { type in
                        Text(type.title).tag(type)
                    }
                }
                LabeledContent("Sklep") {
                    TextField("Nazwa", text: $receipt.merchantName)
                        .multilineTextAlignment(.trailing)
                }
                LabeledContent("NIP") {
                    TextField("NIP", text: $receipt.merchantNIP)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .textInputAutocapitalization(.never)
                }
                if receipt.merchantNIP.isEmpty == false {
                    Button {
                        UIPasteboard.general.string = receipt.merchantNIP
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    } label: {
                        Label("Kopiuj NIP", systemImage: "doc.on.doc")
                    }
                }
                LabeledContent("Kwota", value: MoneyFormat.string(receipt.amount))
                if receipt.taxAmount > 0 {
                    LabeledContent("VAT", value: MoneyFormat.string(receipt.taxAmount))
                }
                if receipt.documentNumber.isEmpty == false {
                    LabeledContent("Numer", value: receipt.documentNumber)
                }
                Picker("Płatność", selection: $receipt.payment) {
                    ForEach(ReceiptPaymentMethod.allCases) { method in
                        Text(method.title).tag(method)
                    }
                }
            }

            Section("Towar") {
                TextField("Nazwa towaru lub usługi", text: $receipt.itemName, axis: .vertical)
                    .lineLimit(2...5)
            }

            Section("Terminy") {
                DatePicker("Zakup", selection: $receipt.issuedAt, displayedComponents: .date)
                if receipt.returnUntil != nil {
                    DatePicker(
                        "Zwrot do",
                        selection: Binding(
                            get: { receipt.returnUntil ?? receipt.issuedAt },
                            set: { receipt.returnUntil = $0 }
                        ),
                        displayedComponents: .date
                    )
                }
                if receipt.warrantyUntil != nil {
                    DatePicker(
                        "Gwarancja do",
                        selection: Binding(
                            get: { receipt.warrantyUntil ?? receipt.issuedAt },
                            set: { receipt.warrantyUntil = $0 }
                        ),
                        displayedComponents: .date
                    )
                }
                Button("Przelicz terminy z kategorii") {
                    let dates = ReceiptParser.applyCategoryDates(category: receipt.category, issuedAt: receipt.issuedAt)
                    receipt.warrantyUntil = dates.warranty
                    receipt.returnUntil = dates.returning
                    try? wallet.persistReceipt(receipt, context: context)
                }
            }

            Section("Notatka") {
                TextField("Model, numer seryjny, miejsce zakupu…", text: $receipt.note, axis: .vertical)
                    .lineLimit(3...6)
            }

            if receipt.scannedByName.isEmpty == false {
                Section {
                    LabeledContent("Zeskanował", value: receipt.scannedByName)
                }
            }

            Section("Rodzina") {
                if receipt.familyShareID == nil {
                    Button {
                        Task { await wallet.shareReceiptWithFamily(receipt, context: context) }
                    } label: {
                        Label("Udostępnij rodzinie", systemImage: "person.2")
                    }
                    .disabled(wallet.family.familyWalletID == nil)
                } else {
                    Label("Udostępniony rodzinie", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(ParagonTheme.osGreen)
                }
            }

            Section {
                Button(role: .destructive) {
                    confirmDelete = true
                } label: {
                    Label("Usuń paragon", systemImage: "trash")
                }
            }
        }
        .navigationTitle(receipt.merchantName)
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: receipt.category) { _, category in
            let dates = ReceiptParser.applyCategoryDates(category: category, issuedAt: receipt.issuedAt)
            if receipt.warrantyUntil == nil { receipt.warrantyUntil = dates.warranty }
            if receipt.returnUntil == nil { receipt.returnUntil = dates.returning }
        }
        .onDisappear {
            try? wallet.persistReceipt(receipt, context: context)
        }
        .fullScreenCover(isPresented: $showPhoto) {
            if let data = receipt.photoData, let image = UIImage(data: data) {
                NavigationStack {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .background(.black)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Zamknij") { showPhoto = false }
                            }
                        }
                }
            }
        }
        .confirmationDialog("Usunąć paragon?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Usuń", role: .destructive) {
                try? wallet.deleteReceipt(receipt, context: context)
                dismiss()
            }
        } message: {
            Text("Zdjęcie i dane znikną z tego iPhone’a.")
        }
    }
}

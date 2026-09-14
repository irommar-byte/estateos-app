import SwiftUI

struct ReceiptMerchantDetailView: View {
    let group: ReceiptMerchantGroup

    var body: some View {
        List {
            Section {
                HStack(spacing: 14) {
                    LoyaltyLogo(program: group.program, size: 48)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(group.merchantName)
                            .font(.headline)
                        Text(group.category.title)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                LabeledContent("Suma", value: MoneyFormat.string(group.total))
                if group.merchantNIP.isEmpty == false {
                    LabeledContent("NIP", value: group.merchantNIP)
                }
                LabeledContent("Paragony", value: PolishDates.receiptCount(group.receipts.count))
            }
            Section("Wszystkie paragony") {
                ForEach(group.receipts.sorted { $0.issuedAt > $1.issuedAt }, id: \.id) { receipt in
                    NavigationLink {
                        ReceiptDetailView(receipt: receipt)
                    } label: {
                        ReceiptRow(receipt: receipt)
                    }
                }
            }
        }
        .navigationTitle(group.merchantName)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ReceiptMerchantChip: View {
    let group: ReceiptMerchantGroup

    var body: some View {
        VStack(spacing: 8) {
            LoyaltyLogo(program: group.program, size: 36)
            Text(group.merchantName)
                .font(.caption2.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.65)
                .frame(maxWidth: 78)
            Text(MoneyFormat.string(group.total))
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }
}

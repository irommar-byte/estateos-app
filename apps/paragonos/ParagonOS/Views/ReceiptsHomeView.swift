import Charts
import SwiftData
import SwiftUI

struct ReceiptsHomeView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Query(sort: \Receipt.issuedAt, order: .reverse) private var receipts: [Receipt]
    @State private var query = ""
    @State private var isSearching = false
    @State private var selectedCategory: ReceiptCategory?
    @FocusState private var searchFocused: Bool

    private var calendar: Calendar { Calendar.current }
    private var now: Date { .now }

    private var thisMonth: Date {
        calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
    }

    private var monthReceipts: [Receipt] {
        ReceiptAnalytics.inMonth(receipts, month: thisMonth, calendar: calendar)
    }

    private var filtered: [Receipt] {
        receipts.filter { receipt in
            if let selectedCategory, receipt.category != selectedCategory { return false }
            if query.isEmpty { return true }
                let haystack = "\(receipt.merchantName) \(receipt.merchantNIP) \(receipt.documentNumber) \(receipt.itemName) \(receipt.category.title) \(receipt.note)".lowercased()
            return haystack.contains(query.lowercased())
        }
    }

    private var monthGroups: [(month: Date, items: [Receipt])] {
        let grouped = Dictionary(grouping: filtered) { receipt in
            calendar.date(from: calendar.dateComponents([.year, .month], from: receipt.issuedAt)) ?? receipt.issuedAt
        }
        return grouped.keys.sorted(by: >).map { month in
            (month, grouped[month]?.sorted { $0.issuedAt > $1.issuedAt } ?? [])
        }
    }

    private var categorySlices: [(category: ReceiptCategory, total: Double)] {
        ReceiptAnalytics.categoryTotals(selectedCategory == nil ? monthReceipts : filtered)
    }

    private var monthSeries: [(month: Date, total: Double)] {
        ReceiptAnalytics.monthSeries(receipts, months: 6, now: now, calendar: calendar)
    }

    private var warranties: [Receipt] { ReceiptAnalytics.upcomingWarranties(receipts) }
    private var returns: [Receipt] { ReceiptAnalytics.upcomingReturns(receipts) }

    private var lastMonthTotal: Double {
        guard let previous = calendar.date(byAdding: .month, value: -1, to: thisMonth) else { return 0 }
        return ReceiptAnalytics.total(ReceiptAnalytics.inMonth(receipts, month: previous, calendar: calendar))
    }

    var body: some View {
        Group {
            if receipts.isEmpty && query.isEmpty && selectedCategory == nil {
                ContentUnavailableView {
                    Label("Brak paragonów", systemImage: "doc.text.viewfinder")
                } description: {
                    Text("Zeskanuj paragon lub fakturę — \(Brand.displayName) rozpozna sklep, kwotę, NIP i kategorię.")
                } actions: {
                    Button("Skanuj paragon") { wallet.openScanner(for: .receipt) }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        if isSearching {
                            searchField
                        }
                        summaryCard
                        if warranties.isEmpty == false || returns.isEmpty == false {
                            remindersStrip
                        }
                        if monthSeries.contains(where: { $0.total > 0 }) {
                            spendChart
                        }
                        categoryChips
                        if filtered.isEmpty {
                            Text(query.isEmpty ? "Brak paragonów w tej kategorii." : "Nic nie pasuje do wyszukiwania.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 4)
                        } else {
                            ForEach(monthGroups, id: \.month) { group in
                                VStack(alignment: .leading, spacing: 10) {
                                    HStack {
                                        Text(PolishDates.monthTitle(group.month).capitalized)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                        Spacer()
                                        Text(MoneyFormat.string(ReceiptAnalytics.total(group.items)))
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                    }
                                    .padding(.horizontal, 4)
                                    ForEach(group.items, id: \.id) { receipt in
                                        Button {
                                            wallet.receiptPath.append(ReceiptRoute.receipt(receipt.id))
                                        } label: {
                                            ReceiptRow(receipt: receipt)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 28)
                }
                .scrollIndicators(.hidden)
                .scrollDismissesKeyboard(.interactively)
                .background {
                    ZStack {
                        Color(.systemGroupedBackground)
                        MotifBackground(kind: .receipt)
                    }
                    .ignoresSafeArea()
                }
            }
        }
        .background {
            ZStack {
                Color(.systemGroupedBackground)
                MotifBackground(kind: .receipt)
            }
            .ignoresSafeArea()
        }
        .navigationTitle("Paragony")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    wallet.receiptPath.append(ReceiptRoute.settings)
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Ustawienia")
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
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
                Button {
                    wallet.openScanner(for: .receipt)
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Skanuj paragon")
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Sklep, NIP lub kategoria", text: $query)
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
                .accessibilityLabel("Wyczyść")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(.tertiarySystemFill))
        )
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Ten miesiąc")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(MoneyFormat.string(ReceiptAnalytics.total(monthReceipts)))
                .font(.system(size: 34, weight: .bold, design: .rounded))
            HStack(spacing: 16) {
                Label(PolishDates.receiptCount(monthReceipts.count), systemImage: "doc.text")
                if lastMonthTotal > 0 {
                    let delta = ReceiptAnalytics.total(monthReceipts) - lastMonthTotal
                    Label(
                        delta >= 0 ? "+\(MoneyFormat.string(delta))" : MoneyFormat.string(delta),
                        systemImage: delta >= 0 ? "arrow.up.right" : "arrow.down.right"
                    )
                    .foregroundStyle(delta >= 0 ? Color.orange : ParagonTheme.osGreen)
                }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
            HStack(spacing: 10) {
                reminderBadge(count: warranties.count, title: "Gwarancje", symbol: "checkmark.seal.fill", color: Color(red: 0.20, green: 0.48, blue: 0.96))
                reminderBadge(count: returns.count, title: "Zwroty", symbol: "arrow.uturn.left", color: Color(red: 0.86, green: 0.28, blue: 0.48))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }

    private func reminderBadge(count: Int, title: String, symbol: String, color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: symbol)
                .foregroundStyle(color)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(count)")
                    .font(.headline)
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var remindersStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Terminy")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(returns, id: \.id) { receipt in
                        deadlineChip(receipt: receipt, kind: .returning)
                    }
                    ForEach(warranties, id: \.id) { receipt in
                        deadlineChip(receipt: receipt, kind: .warranty)
                    }
                }
            }
        }
    }

    private enum DeadlineKind {
        case warranty
        case returning
    }

    private func deadlineChip(receipt: Receipt, kind: DeadlineKind) -> some View {
        let date = kind == .warranty ? receipt.warrantyUntil : receipt.returnUntil
        return Button {
            wallet.receiptPath.append(ReceiptRoute.receipt(receipt.id))
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Label(
                    kind == .warranty ? "Gwarancja" : "Zwrot",
                    systemImage: kind == .warranty ? "checkmark.seal.fill" : "arrow.uturn.left"
                )
                .font(.caption.weight(.semibold))
                .foregroundStyle(kind == .warranty ? Color(red: 0.20, green: 0.48, blue: 0.96) : Color(red: 0.86, green: 0.28, blue: 0.48))
                Text(receipt.merchantName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                if let date {
                    Text(PolishDates.relativeDeadline(date))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(12)
            .frame(width: 168, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
            )
        }
        .buttonStyle(.plain)
    }

    private var spendChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Wydatki")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)
            VStack(spacing: 16) {
                if categorySlices.isEmpty == false {
                    Chart(categorySlices, id: \.category) { item in
                        SectorMark(
                            angle: .value("Kwota", item.total),
                            innerRadius: .ratio(0.62),
                            angularInset: 1.6
                        )
                        .foregroundStyle(item.category.color)
                        .cornerRadius(3)
                    }
                    .frame(height: 168)
                    .chartLegend(.hidden)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], spacing: 8) {
                        ForEach(categorySlices, id: \.category) { item in
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(item.category.color)
                                    .frame(width: 8, height: 8)
                                Text(item.category.title)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Spacer(minLength: 0)
                                Text(MoneyFormat.string(item.total))
                                    .font(.caption.weight(.semibold))
                            }
                        }
                    }
                }
                Chart {
                    ForEach(monthSeries, id: \.month) { item in
                        BarMark(
                            x: .value("Miesiąc", PolishDates.shortMonth(item.month)),
                            y: .value("Kwota", item.total)
                        )
                        .foregroundStyle(ParagonTheme.osGreen.gradient)
                        .cornerRadius(5)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading)
                }
                .frame(height: 120)
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
            )
        }
    }

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                categoryChip(title: "Wszystkie", selected: selectedCategory == nil, color: ParagonTheme.osGreen) {
                    selectedCategory = nil
                }
                ForEach(ReceiptCategory.allCases) { category in
                    categoryChip(title: category.title, selected: selectedCategory == category, color: category.color) {
                        selectedCategory = selectedCategory == category ? nil : category
                    }
                }
            }
        }
    }

    private func categoryChip(title: String, selected: Bool, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .foregroundStyle(selected ? Color.white : .primary)
                .background(selected ? color : Color(.tertiarySystemFill), in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct ReceiptRow: View {
    let receipt: Receipt

    var body: some View {
        HStack(spacing: 12) {
            ReceiptCategoryMark(category: receipt.category, size: 42)
            VStack(alignment: .leading, spacing: 3) {
                Text(receipt.merchantName)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                if receipt.itemName.isEmpty == false {
                    Text(receipt.itemName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                HStack(spacing: 6) {
                    Text(receipt.category.title)
                    Text("·")
                    Text(PolishDates.display.string(from: receipt.issuedAt))
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                if let date = receipt.returnUntil, PolishDates.daysUntil(date) <= 14, PolishDates.daysUntil(date) >= 0 {
                    Text("Zwrot \(PolishDates.relativeDeadline(date))")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color(red: 0.86, green: 0.28, blue: 0.48))
                } else if let date = receipt.warrantyUntil, PolishDates.daysUntil(date) <= 60, PolishDates.daysUntil(date) >= 0 {
                    Text("Gwarancja \(PolishDates.relativeDeadline(date))")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color(red: 0.20, green: 0.48, blue: 0.96))
                }
            }
            Spacer(minLength: 8)
            Text(MoneyFormat.string(receipt.amount))
                .font(.body.weight(.semibold).monospacedDigit())
                .foregroundStyle(.primary)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }
}

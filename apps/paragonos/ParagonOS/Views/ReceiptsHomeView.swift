import Charts
import SwiftData
import SwiftUI
import TipKit

private enum ReceiptHomeFocus: Equatable {
    case all
    case warranties
    case returns
    case category(ReceiptCategory)
}

struct ReceiptsHomeView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Query(sort: \Receipt.issuedAt, order: .reverse) private var receipts: [Receipt]
    @State private var query = ""
    @State private var isSearching = false
    @State private var focus: ReceiptHomeFocus = .all
    @State private var expandedReceiptGroupID: String?

    private var calendar: Calendar { Calendar.current }
    private var now: Date { .now }

    private var thisMonth: Date {
        calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
    }

    private var monthReceipts: [Receipt] {
        ReceiptAnalytics.inMonth(receipts, month: thisMonth, calendar: calendar)
    }

    private var warranties: [Receipt] { ReceiptAnalytics.activeWarranties(receipts) }
    private var returns: [Receipt] { ReceiptAnalytics.activeReturns(receipts) }
    private var soonWarranties: [Receipt] { ReceiptAnalytics.upcomingWarranties(receipts) }
    private var soonReturns: [Receipt] { ReceiptAnalytics.upcomingReturns(receipts) }

    private var usedCategories: [ReceiptCategory] {
        ReceiptCategory.allCases.filter { category in
            receipts.contains { $0.category == category }
        }
    }

    private var filtered: [Receipt] {
        receipts.filter { receipt in
            switch focus {
            case .all:
                break
            case .warranties:
                if ReceiptAnalytics.isActiveWarranty(receipt) == false { return false }
            case .returns:
                if ReceiptAnalytics.isActiveReturn(receipt) == false { return false }
            case .category(let category):
                if receipt.category != category { return false }
            }
            if query.isEmpty { return true }
            return ReceiptSearch.matches(receipt, query: query)
        }
    }

    private var monthGroups: [(month: Date, groups: [ReceiptMerchantGroup])] {
        let grouped = Dictionary(grouping: filtered) { receipt in
            calendar.date(from: calendar.dateComponents([.year, .month], from: receipt.issuedAt)) ?? receipt.issuedAt
        }
        return grouped.keys.sorted(by: >).map { month in
            let items = grouped[month]?.sorted { $0.issuedAt > $1.issuedAt } ?? []
            return (month, ReceiptMerchantGroup.groups(from: items))
        }
    }

    private var categorySlices: [(category: ReceiptCategory, total: Double)] {
        ReceiptAnalytics.categoryTotals(focus == .all ? monthReceipts : filtered)
    }

    private var monthSeries: [(month: Date, total: Double)] {
        ReceiptAnalytics.monthSeries(receipts, months: 6, now: now, calendar: calendar)
    }

    private var showsSpendChart: Bool {
        monthSeries.filter { $0.total > 0 }.count >= 2
    }

    private var lastMonthTotal: Double {
        guard let previous = calendar.date(byAdding: .month, value: -1, to: thisMonth) else { return 0 }
        return ReceiptAnalytics.total(ReceiptAnalytics.inMonth(receipts, month: previous, calendar: calendar))
    }

    var body: some View {
        Group {
            if receipts.isEmpty && query.isEmpty && focus == .all {
                ContentUnavailableView {
                    Label("Brak paragonów", systemImage: "doc.text.viewfinder")
                } description: {
                    Text("Zeskanuj paragon lub fakturę — \(Brand.displayName) rozpozna sklep, kwotę, NIP i kategorię.")
                } actions: {
                    Button("Skanuj paragon") { wallet.openScanner(for: .receipt) }
                        .buttonStyle(.borderedProminent)
                        .popoverTip(FirstScanTip.receipt)
                }
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 18) {
                        summaryCard
                        if soonWarranties.isEmpty == false || soonReturns.isEmpty == false {
                            remindersStrip
                        }
                        if showsSpendChart {
                            spendChart
                        }
                        categoryChips
                        if filtered.isEmpty {
                            ContentUnavailableView(
                                "Nic nie pasuje",
                                systemImage: "magnifyingglass",
                                description: Text(emptyFilterText)
                            )
                            .frame(maxWidth: .infinity)
                        } else {
                            ForEach(monthGroups, id: \.month) { month, groups in
                                VStack(alignment: .leading, spacing: 10) {
                                    HStack {
                                        Text(PolishDates.monthTitle(month).capitalized)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                        Spacer()
                                        Text(MoneyFormat.string(groups.reduce(0) { $0 + $1.total }))
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                    }
                                    .padding(.horizontal, 4)
                                    ForEach(groups) { group in
                                        receiptGroup(group, month: month)
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
                .scrollBounceBehavior(.basedOnSize)
            }
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .navigationTitle("Paragony")
        .searchable(text: $query, isPresented: $isSearching, prompt: "Sklep, NIP albo kwota")
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
                    wallet.openScanner(for: .receipt)
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Skanuj paragon")
            }
        }
        .onAppear {
            if ReceiptAnalytics.healMissingDates(receipts) {
                try? context.save()
            }
        }
        .onChange(of: receipts.count) { _, _ in
            if ReceiptAnalytics.healMissingDates(receipts) {
                try? context.save()
            }
        }
    }

    private var emptyFilterText: String {
        if query.isEmpty == false { return "Nic nie pasuje do wyszukiwania." }
        switch focus {
        case .warranties: return "Brak aktywnych gwarancji."
        case .returns: return "Brak otwartego terminu zwrotu."
        case .category: return "Brak paragonów w tej kategorii."
        case .all: return "Brak paragonów."
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 16) {
                summaryStat(
                    title: "Ten miesiąc",
                    amount: ReceiptAnalytics.total(monthReceipts),
                    caption: PolishDates.receiptCount(monthReceipts.count)
                )
                summaryStat(
                    title: "Wszystkie",
                    amount: ReceiptAnalytics.total(receipts),
                    caption: PolishDates.receiptCount(receipts.count)
                )
            }
            if lastMonthTotal > 0 {
                let delta = ReceiptAnalytics.total(monthReceipts) - lastMonthTotal
                Label(
                    delta >= 0 ? "+\(MoneyFormat.string(delta)) vs poprzedni miesiąc" : "\(MoneyFormat.string(delta)) vs poprzedni miesiąc",
                    systemImage: delta >= 0 ? "arrow.up.right" : "arrow.down.right"
                )
                .font(.footnote)
                .foregroundStyle(delta >= 0 ? Color.orange : ParagonTheme.osGreen)
            }
            HStack(spacing: 10) {
                reminderBadge(
                    count: warranties.count,
                    title: "Gwarancje",
                    subtitle: warrantyBadgeSubtitle,
                    symbol: "checkmark.seal.fill",
                    color: ParagonTheme.warranty,
                    selected: focus == .warranties
                ) {
                    toggleFocus(.warranties)
                }
                reminderBadge(
                    count: returns.count,
                    title: "Zwroty",
                    subtitle: returns.isEmpty ? "brak terminu" : PolishDates.returnCount(returns.count),
                    symbol: "arrow.uturn.left",
                    color: ParagonTheme.returning,
                    selected: focus == .returns
                ) {
                    toggleFocus(.returns)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }

    private var warrantyBadgeSubtitle: String {
        if warranties.isEmpty { return "brak aktywnych" }
        if let date = warranties.first?.resolvedWarrantyUntil {
            return PolishDates.warrantyRemaining(date)
        }
        return PolishDates.warrantyCount(warranties.count)
    }

    private func summaryStat(title: String, amount: Double, caption: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(MoneyFormat.string(amount))
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(caption)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func receiptGroup(_ group: ReceiptMerchantGroup, month: Date) -> some View {
        let groupID = "\(month.timeIntervalSince1970)-\(group.id)"
        if group.receipts.count == 1, let receipt = group.receipts.first {
            Button {
                wallet.receiptPath.append(ReceiptRoute.receipt(receipt.id))
            } label: {
                ReceiptRow(receipt: receipt)
            }
            .buttonStyle(.plain)
        } else {
            VStack(spacing: 8) {
                Button {
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.86)) {
                        expandedReceiptGroupID = expandedReceiptGroupID == groupID ? nil : groupID
                    }
                } label: {
                    ReceiptGroupRow(group: group, expanded: expandedReceiptGroupID == groupID)
                }
                .buttonStyle(.plain)
                if expandedReceiptGroupID == groupID {
                    ForEach(group.receipts, id: \.id) { receipt in
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

    private func reminderBadge(
        count: Int,
        title: String,
        subtitle: String,
        symbol: String,
        color: Color,
        selected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: symbol)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(selected ? Color.white : color)
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(count)")
                        .font(.headline.monospacedDigit())
                        .foregroundStyle(selected ? Color.white : .primary)
                    Text(title)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(selected ? Color.white.opacity(0.9) : .secondary)
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(selected ? Color.white.opacity(0.72) : Color.secondary.opacity(0.7))
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(selected ? color : color.opacity(0.12))
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title), \(count)")
        .accessibilityAddTraits(.isButton)
    }

    private var remindersStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Zbliżające się terminy")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(soonReturns, id: \.id) { receipt in
                        deadlineChip(receipt: receipt, kind: .returning)
                    }
                    ForEach(soonWarranties, id: \.id) { receipt in
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
        let date = kind == .warranty ? receipt.resolvedWarrantyUntil : receipt.resolvedReturnUntil
        return Button {
            wallet.receiptPath.append(ReceiptRoute.receipt(receipt.id))
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Label(
                    kind == .warranty ? "Gwarancja" : "Zwrot",
                    systemImage: kind == .warranty ? "checkmark.seal.fill" : "arrow.uturn.left"
                )
                .font(.caption.weight(.semibold))
                .foregroundStyle(kind == .warranty ? ParagonTheme.warranty : ParagonTheme.returning)
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
                if categorySlices.count >= 2 {
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
                    ForEach(monthSeries.filter { $0.total > 0 }, id: \.month) { item in
                        BarMark(
                            x: .value("Miesiąc", PolishDates.shortMonth(item.month)),
                            y: .value("Kwota", item.total)
                        )
                        .foregroundStyle(Color.primary.opacity(0.82))
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
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
            )
        }
    }

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                categoryChip(
                    title: "Wszystkie",
                    selected: focus == .all,
                    color: ParagonTheme.osGreen
                ) {
                    focus = .all
                }
                ForEach(usedCategories) { category in
                    let count = receipts.filter { $0.category == category }.count
                    categoryChip(
                        title: count > 1 ? "\(category.title) · \(count)" : category.title,
                        selected: focus == .category(category),
                        color: category.color
                    ) {
                        toggleFocus(.category(category))
                    }
                }
            }
        }
        .sensoryFeedback(.selection, trigger: focus)
    }

    private func toggleFocus(_ next: ReceiptHomeFocus) {
        withAnimation(.snappy(duration: 0.24)) {
            focus = focus == next ? .all : next
        }
    }

    private func categoryChip(title: String, selected: Bool, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .foregroundStyle(selected ? Color(.systemBackground) : .primary)
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
                if receipt.displayItemName.isEmpty == false {
                    Text(receipt.displayItemName)
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
                if let date = receipt.resolvedReturnUntil, PolishDates.daysUntil(date) >= 0, PolishDates.daysUntil(date) <= 14 {
                    Text("Zwrot \(PolishDates.relativeDeadline(date))")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(ParagonTheme.returning)
                } else if let date = receipt.resolvedWarrantyUntil, PolishDates.daysUntil(date) >= 0 {
                    Text("Gwarancja \(PolishDates.warrantyRemaining(date))")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(ParagonTheme.warranty)
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

struct ReceiptGroupRow: View {
    let group: ReceiptMerchantGroup
    var expanded: Bool

    var body: some View {
        let extras = expanded ? 0 : min(max(group.receipts.count - 1, 0), 2)
        ZStack(alignment: .top) {
            ForEach(0..<extras, id: \.self) { layer in
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Color.primary.opacity(0.05), lineWidth: 0.5)
                    }
                    .frame(height: 20)
                    .padding(.horizontal, CGFloat(layer + 1) * 8)
                    .offset(y: CGFloat(layer + 1) * 7)
                    .allowsHitTesting(false)
            }
            HStack(spacing: 12) {
                ReceiptCategoryMark(category: group.category, size: 42)
                VStack(alignment: .leading, spacing: 3) {
                    Text(group.merchantName)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(PolishDates.receiptCount(group.receipts.count))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                Text(MoneyFormat.string(group.total))
                    .font(.body.weight(.semibold).monospacedDigit())
                Image(systemName: expanded ? "chevron.up" : "chevron.down")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
            )
        }
        .padding(.bottom, CGFloat(extras) * 7)
    }
}

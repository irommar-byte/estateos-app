import Charts
import SwiftData
import SwiftUI

enum HistoryScope: String, CaseIterable, Identifiable {
    case kaucje
    case paragony

    var id: String { rawValue }

    var title: String {
        switch self {
        case .kaucje: return "Kaucje"
        case .paragony: return "Paragony"
        }
    }
}

struct HistoryView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Query(sort: \Ticket.issuedAt, order: .reverse) private var tickets: [Ticket]
    @Query(sort: \Receipt.issuedAt, order: .reverse) private var receipts: [Receipt]
    @State private var restoreTicket: Ticket?
    @State private var scope: HistoryScope = .kaucje
    @State private var grain: HistoryGrain = .month
    @State private var selectedYear: Int = Calendar.current.component(.year, from: .now)
    @State private var selectedMonth: Int = Calendar.current.component(.month, from: .now)
    private var now: Date { .now }
    private var calendar: Calendar { .current }

    private var redeemed: [Ticket] {
        tickets.filter { $0.resolvedStatus(now: now) == .redeemed }
    }

    private var expired: [Ticket] {
        tickets.filter { $0.resolvedStatus(now: now) == .expired }
    }

    private var recovered: Double { redeemed.reduce(0) { $0 + $1.amount } }
    private var lost: Double { expired.reduce(0) { $0 + $1.amount } }
    private var receiptsTotal: Double { ReceiptAnalytics.total(receipts) }
    private var allTimeStores: [ReceiptMerchantGroup] { ReceiptMerchantGroup.allTime(from: receipts) }
    private var topStores: [ReceiptMerchantGroup] { Array(allTimeStores.prefix(8)) }
    private var otherStoresTotal: Double {
        allTimeStores.dropFirst(8).reduce(0) { $0 + $1.total }
    }

    private var availableYears: [Int] {
        let dates = scope == .kaucje
            ? tickets.map(\.issuedAt)
            : receipts.map(\.issuedAt)
        return HistorySpend.years(from: dates, calendar: calendar, now: now)
    }

    private var chartPoints: [HistorySpendPoint] {
        if scope == .kaucje {
            return HistorySpend.depositPoints(
                tickets,
                grain: grain,
                year: selectedYear,
                month: selectedMonth,
                now: now,
                calendar: calendar
            )
        }
        return HistorySpend.receiptPoints(
            receipts,
            grain: grain,
            year: selectedYear,
            month: selectedMonth,
            calendar: calendar
        )
    }

    private var chartSignature: String {
        "\(scope.rawValue)-\(grain.rawValue)-\(selectedYear)-\(selectedMonth)-\(tickets.count)-\(receipts.count)"
    }

    var body: some View {
        List {
            Section {
                Picker("Zakres", selection: $scope) {
                    ForEach(HistoryScope.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section {
                Picker("Okres", selection: $grain) {
                    ForEach(HistoryGrain.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
                .pickerStyle(.segmented)
                periodPickers
                CascadeSpendChart(
                    points: chartPoints,
                    showsSecondary: scope == .kaucje,
                    primaryTitle: scope == .kaucje ? "Odzyskane" : "Wydatki",
                    secondaryTitle: "Utracone",
                    signature: chartSignature
                )
                .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 12, trailing: 12))
                .listRowBackground(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color(.secondarySystemGroupedBackground))
                        .padding(.horizontal, 4)
                )
            } header: {
                Text(scope == .kaucje ? "Kaucje w czasie" : "Wydatki w czasie")
            } footer: {
                Text(chartFooter)
            }

            if scope == .kaucje {
                Section {
                    HStack {
                        stat(title: "Odzyskane", value: recovered, symbol: "checkmark.circle.fill", color: ParagonTheme.osGreen)
                        Divider()
                        stat(title: "Utracone", value: lost, symbol: "exclamationmark.circle.fill", color: .red)
                    }
                    .padding(.vertical, 4)
                }

                if redeemed.isEmpty && expired.isEmpty {
                    ContentUnavailableView(
                        "Brak historii kaucji",
                        systemImage: "clock",
                        description: Text("Tu zobaczysz wykorzystane i przeterminowane kwitki.")
                    )
                }

                if redeemed.isEmpty == false {
                    Section("Wykorzystane") {
                        ForEach(redeemed, id: \.id) { ticket in
                            NavigationLink {
                                TicketDetailView(ticket: ticket)
                            } label: {
                                historyRow(ticket)
                            }
                            .swipeActions(edge: .leading, allowsFullSwipe: false) {
                                Button("Przywróć") { restoreTicket = ticket }
                                    .tint(ParagonTheme.osGreen)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button("Pokaż przy kasie") {
                                    wallet.showCheckoutFor = ticket.id
                                }
                                .tint(ParagonTheme.osGreen)
                                Button("Usuń", role: .destructive) {
                                    try? wallet.delete(ticket, context: context)
                                }
                            }
                        }
                    }
                }

                if expired.isEmpty == false {
                    Section("Przeterminowane") {
                        ForEach(expired, id: \.id) { ticket in
                            NavigationLink {
                                TicketDetailView(ticket: ticket)
                            } label: {
                                historyRow(ticket)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button("Usuń", role: .destructive) {
                                    try? wallet.delete(ticket, context: context)
                                }
                            }
                        }
                    }
                }
            } else {
                Section {
                    HStack {
                        stat(title: "Suma", value: receiptsTotal, symbol: "doc.text.fill", color: ParagonTheme.osGreen)
                        Divider()
                        VStack(alignment: .leading, spacing: 6) {
                            Label("Dokumenty", systemImage: "square.stack.fill")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text("\(receipts.count)")
                                .font(.title3.bold())
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.vertical, 4)
                }

                if receipts.isEmpty == false {
                    Section("Według sklepów") {
                        ForEach(topStores) { group in
                            NavigationLink {
                                ReceiptMerchantDetailView(group: group)
                            } label: {
                                HStack(spacing: 12) {
                                    LoyaltyLogo(program: group.program, size: 32)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(group.merchantName)
                                            .font(.body.weight(.semibold))
                                            .lineLimit(1)
                                        Text(PolishDates.receiptCount(group.receipts.count))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer(minLength: 8)
                                    Text(MoneyFormat.string(group.total))
                                        .font(.body.weight(.semibold).monospacedDigit())
                                }
                            }
                        }
                        if otherStoresTotal > 0 {
                            HStack {
                                Text("Inne")
                                Spacer()
                                Text(MoneyFormat.string(otherStoresTotal))
                                    .font(.body.weight(.semibold).monospacedDigit())
                            }
                        }
                    }
                }

                if receipts.isEmpty {
                    ContentUnavailableView(
                        "Brak historii wydatków",
                        systemImage: "doc.text",
                        description: Text("Paragony zostają w zakładce Paragony. Tu widać sumy w czasie.")
                    )
                }
            }
        }
        .navigationTitle("Historia")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    wallet.askScanIntent = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Skanuj")
            }
        }
        .onAppear { clampPeriod() }
        .onChange(of: availableYears) { _, _ in clampPeriod() }
        .confirmationDialog(
            "Przywrócić kwitek do kaucji?",
            isPresented: Binding(
                get: { restoreTicket != nil },
                set: { if $0 == false { restoreTicket = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Przywróć") {
                if let ticket = restoreTicket {
                    try? wallet.restoreToWallet(ticket, context: context)
                }
                restoreTicket = nil
            }
            Button("Anuluj", role: .cancel) {
                restoreTicket = nil
            }
        } message: {
            Text(restoreDialogMessage)
        }
    }

    @ViewBuilder
    private var periodPickers: some View {
        if grain != .year {
            Picker("Rok", selection: $selectedYear) {
                ForEach(availableYears, id: \.self) { year in
                    Text(String(year)).tag(year)
                }
            }
        }
        if grain == .day {
            Picker("Miesiąc", selection: $selectedMonth) {
                ForEach(1...12, id: \.self) { month in
                    Text(PolishDates.monthName(monthDate(month)).capitalized).tag(month)
                }
            }
        }
    }

    private var chartFooter: String {
        switch grain {
        case .year:
            return scope == .kaucje
                ? "Każdy słupek to rok. Zielony to odzyskane kaucje, czerwony — przeterminowane."
                : "Każdy słupek to suma paragonów w danym roku."
        case .month:
            return "Miesiące roku \(selectedYear). Przełącz na Dni, żeby rozłożyć wybrany miesiąc."
        case .day:
            return "Dni w \(PolishDates.monthName(monthDate(selectedMonth))) \(selectedYear)."
        }
    }

    private var restoreDialogMessage: String {
        guard let ticket = restoreTicket else {
            return "Kwitek znów będzie aktywny. Na pewno?"
        }
        if let expiresAt = ticket.expiresAt, expiresAt < now {
            return "Termin tego kwitka już minął. Po przywróceniu trafi do przeterminowanych, nie do Kaucji. Na pewno?"
        }
        return "Kwitek wróci do Kaucji jako aktywny. Na pewno?"
    }

    private func monthDate(_ month: Int) -> Date {
        calendar.date(from: DateComponents(year: selectedYear, month: month, day: 1)) ?? now
    }

    private func clampPeriod() {
        if availableYears.contains(selectedYear) == false, let last = availableYears.last {
            selectedYear = last
        }
        selectedMonth = min(max(selectedMonth, 1), 12)
    }

    private func stat(title: String, value: Double, symbol: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: symbol)
                .font(.caption)
                .foregroundStyle(color)
            Text(MoneyFormat.string(value))
                .font(.title3.bold())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func historyRow(_ ticket: Ticket) -> some View {
        HStack(spacing: 12) {
            RetailerLogo(retailerID: ticket.retailerID, size: 32)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(RetailerCatalog.policy(id: ticket.retailerID).name)
                        .fontWeight(.semibold)
                    Spacer()
                    Text(MoneyFormat.string(ticket.amount))
                        .fontWeight(.semibold)
                }
                Text(PolishDates.display.string(from: ticket.redeemedAt ?? ticket.expiresAt ?? ticket.issuedAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func receiptHistoryRow(_ receipt: Receipt) -> some View {
        HStack(spacing: 12) {
            ReceiptCategoryMark(category: receipt.category, size: 32)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(receipt.merchantName)
                        .fontWeight(.semibold)
                    Spacer()
                    Text(MoneyFormat.string(receipt.amount))
                        .fontWeight(.semibold)
                }
                if receipt.displayItemName.isEmpty == false {
                    Text(receipt.displayItemName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Text("\(receipt.category.title) · \(PolishDates.display.string(from: receipt.issuedAt))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

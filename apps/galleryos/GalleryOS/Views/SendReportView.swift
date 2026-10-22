import SwiftUI

/// "Wyślij na serwer" for many photos: live progress, then every outcome with its reason, as a
/// calm grouped list. A duplicate is not shown as an error: the server simply has it already.
struct SendReportSheet: View {
    @ObservedObject var batch: SendBatch
    @Environment(\.dismiss) private var dismiss

    private var report: SendReport { batch.report }

    private var progress: Double {
        guard report.total > 0 else { return 1 }
        return min(1, Double(report.done) / Double(report.total))
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(report.finished ? L("Gotowe") : L("Wysyłam na serwer"))
                                .font(.title3.weight(.semibold))
                            Spacer()
                            Text(L("\(PhotoFormat.grouped(report.done)) z \(PhotoFormat.grouped(report.total))"))
                                .font(.subheadline)
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                                .contentTransition(.numericText())
                        }
                        ProgressView(value: progress)
                            .tint(report.finished && report.failed.isEmpty ? .green : .accentColor)
                            .animation(.smooth(duration: 0.4), value: progress)
                    }
                    .padding(.vertical, 6)
                }
                Section {
                    if report.sent > 0 {
                        row("checkmark.icloud.fill", .green, L("Wysłane"), report.sent, L("Oryginały są na serwerze i zostały sprawdzone co do bajtu."))
                    }
                    if report.already > 0 {
                        row("icloud.fill", .blue, L("Już były na serwerze"), report.already, L("To nie błąd: ten sam plik wysłało wcześniej to albo inne urządzenie."))
                    }
                    if report.duplicates > 0 {
                        row("square.on.square", .orange, L("Drugie kopie"), report.duplicates, L("Na tym urządzeniu jest drugi egzemplarz tego samego zdjęcia. Serwer ma już jedną kopię."))
                    }
                    if report.restored > 0 {
                        row("arrow.uturn.backward.circle.fill", .teal, L("Przywrócone z kosza"), report.restored, L("Były w Ostatnio usuniętych na serwerze. Wróciły bez wysyłania od nowa."))
                    }
                    if report.waitingWiFi > 0 {
                        row("wifi", .blue, L("Czekają na Wi-Fi"), report.waitingWiFi, L("Duże oryginały są w iCloud. Pójdą same, gdy urządzenie złapie Wi-Fi."))
                    }
                    ForEach(report.failed.sorted { $0.value > $1.value }, id: \.key) { item in
                        row("exclamationmark.triangle.fill", .red, L("Nie wysłano"), item.value, item.key)
                    }
                    if !report.finished, report.total > report.done {
                        HStack(spacing: 12) {
                            ProgressView()
                            Text(L("W drodze: \(PhotoFormat.grouped(report.total - report.done))"))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(L("Wyślij na serwer"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(L("Gotowe")) { dismiss() }
                }
            }
            .animation(.smooth(duration: 0.35), value: report)
            .sensoryFeedback(trigger: report.finished) { _, finished in
                guard finished else { return nil }
                return report.failed.isEmpty ? .success : .warning
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func row(_ symbol: String, _ tint: Color, _ title: String, _ count: Int, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 28, height: 28)
                .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(title).font(.body.weight(.semibold))
                    Spacer()
                    Text(PhotoFormat.grouped(count))
                        .font(.body.weight(.semibold))
                        .monospacedDigit()
                        .contentTransition(.numericText())
                }
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 2)
        .transition(.opacity.combined(with: .move(edge: .top)))
    }
}

/// One filter chip on a shelf: an icon, a name and how many photos it holds.
struct ShelfChip: View {
    let symbol: String
    let title: String
    let count: Int?
    let tint: Color
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button {
            UISelectionFeedbackGenerator().selectionChanged()
            action()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: symbol)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(selected ? Color.white : tint)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                if let count {
                    Text(PhotoFormat.grouped(count))
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(selected ? Color.white.opacity(0.85) : Color.secondary)
                        .contentTransition(.numericText())
                }
            }
            .foregroundStyle(selected ? Color.white : Color.primary)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule().fill(selected ? AnyShapeStyle(tint.gradient) : AnyShapeStyle(Color(uiColor: .tertiarySystemFill)))
            )
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .animation(.smooth(duration: 0.25), value: selected)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

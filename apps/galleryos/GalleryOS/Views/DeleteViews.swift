import SwiftUI
import UIKit

/// Photos chosen for "Usuń na zawsze" in Recently Deleted.
struct PurgeRequest: Identifiable {
    let id = UUID()
    let ids: [String]
    /// Chosen photos of other people: only their owner may delete those for good.
    var others = 0
}

/// The last word before photos leave for good. A calm sheet in the system's own materials, with
/// one red note that softly pulses: after this there is no Recently Deleted to come back from.
struct PermanentDeleteSheet: View {
    let request: PurgeRequest
    let onDelete: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var shown = false

    private var count: Int { request.ids.count }

    private var title: String {
        if count == 0 { return L("To nie są Twoje zdjęcia") }
        if count == 1 { return L("Usunąć to zdjęcie na zawsze?") }
        let number = PhotoFormat.grouped(count)
        return Plural.pick(count,
                           L("Usunąć \(number) zdjęcie na zawsze?"),
                           L("Usunąć \(number) zdjęcia na zawsze?"),
                           L("Usunąć \(number) zdjęć na zawsze?"))
    }

    var body: some View {
        VStack(spacing: 0) {
            WarningSeal()
                .frame(width: 96, height: 96)
                .padding(.top, 30)
                .padding(.bottom, 18)
            Text(title)
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 28)
            Text(count == 0
                 ? L("Na zawsze może je usunąć tylko osoba, która je wysłała. Możesz je przywrócić.")
                 : L("Znikną z serwera, z Apple TV i ze wszystkich urządzeń. Oryginały zostaną skasowane z dysku."))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 32)
                .padding(.top, 8)
            if count > 0 {
                PulsingWarning(text: L("Tego nie da się cofnąć"))
                    .padding(.top, 18)
            }
            if request.others > 0, count > 0 {
                Text(L("Zdjęcia innych osób (\(PhotoFormat.grouped(request.others))) zostają w koszu. Na zawsze może je usunąć tylko ich właściciel."))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 32)
                    .padding(.top, 12)
            }
            Spacer(minLength: 20)
            VStack(spacing: 6) {
                if count > 0 {
                    Button(role: .destructive) {
                        UINotificationFeedbackGenerator().notificationOccurred(.warning)
                        onDelete()
                        dismiss()
                    } label: {
                        Text(L("Usuń na zawsze"))
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.roundedRectangle(radius: 16))
                    .tint(.red)
                }
                Button {
                    dismiss()
                } label: {
                    Text(count == 0 ? L("Dobrze") : L("Anuluj"))
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.tint)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 14)
        }
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
        .presentationDetents([.height(request.others > 0 ? 560 : 500)])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(34)
        .sensoryFeedback(.warning, trigger: shown)
        .onAppear { shown = true }
    }
}

/// A red seal with a trash can: a deep red gradient, a fine highlight and a halo that breathes.
private struct WarningSeal: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            let breath = (sin(t * 2.6) + 1) / 2
            ZStack {
                Circle()
                    .fill(Color.red.opacity(0.22 * (1 - breath)))
                    .scaleEffect(1 + 0.22 * breath)
                Circle()
                    .fill(Color.red.opacity(0.12))
                    .scaleEffect(1.08)
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color(red: 1.0, green: 0.36, blue: 0.33), Color(red: 0.78, green: 0.06, blue: 0.12)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(
                        Circle().strokeBorder(
                            LinearGradient(colors: [.white.opacity(0.55), .white.opacity(0.05)], startPoint: .top, endPoint: .bottom),
                            lineWidth: 1
                        )
                    )
                    .shadow(color: Color.red.opacity(0.35 + 0.25 * breath), radius: 10 + 8 * breath, y: 4)
                    .padding(10)
                Image(systemName: "trash.fill")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
            }
        }
        .accessibilityHidden(true)
    }
}

/// "This cannot be undone", in red, glowing softly on and off like a warning light.
struct PulsingWarning: View {
    let text: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            let glow = reduceMotion ? 1 : 0.55 + 0.45 * (sin(t * 3.4) + 1) / 2
            HStack(spacing: 7) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.bold))
                Text(text)
                    .font(.footnote.weight(.semibold))
            }
            .foregroundStyle(Color.red)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Capsule().fill(Color.red.opacity(0.08 + 0.08 * glow)))
            .overlay(Capsule().strokeBorder(Color.red.opacity(0.25 + 0.35 * glow), lineWidth: 1))
            .shadow(color: Color.red.opacity(0.35 * glow), radius: 8 * glow)
            .opacity(0.7 + 0.3 * glow)
        }
        .accessibilityElement(children: .combine)
    }
}

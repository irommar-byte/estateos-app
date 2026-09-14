import SwiftUI

struct CoffeeTipSheet: View {
    var onFinished: () -> Void
    @ObservedObject private var store = CoffeeTipStore.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dismiss) private var dismiss
    @State private var drinking: CoffeeSize?
    @State private var appeared = false

    var body: some View {
        content
            .padding(24)
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
            .presentationBackground(.ultraThinMaterial)
            .presentationCornerRadius(32)
            .task {
                CoffeeSounds.pour()
                await store.load()
                if reduceMotion {
                    appeared = true
                } else {
                    withAnimation(.spring(response: 0.58, dampingFraction: 0.84)) {
                        appeared = true
                    }
                }
            }
    }

    private var content: some View {
        VStack(spacing: 18) {
            VStack(spacing: 6) {
                Text("Może kawa? Nic nie musisz.")
                    .font(.title3.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8)
                    .lineLimit(2)
                Text("Tylko jeśli masz ochotę. Trzy łyki dla twórcy.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8)
                    .lineLimit(2)
            }
            .padding(.top, 8)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 16)
            .scaleEffect(appeared ? 1 : 0.96)

            HStack(spacing: 6) {
                ForEach(Array(CoffeeSize.allCases.enumerated()), id: \.element.id) { index, size in
                    Button {
                        Task { await choose(size) }
                    } label: {
                        VStack(spacing: 8) {
                            CoffeeCupView(
                                size: size,
                                selected: store.selected == size,
                                drinking: drinking == size,
                                reduceMotion: reduceMotion
                            )
                            Text(store.price(for: size))
                                .font(.caption.weight(.semibold).monospacedDigit())
                                .tracking(0.4)
                                .foregroundStyle(store.selected == size ? .secondary : .tertiary)
                                .minimumScaleFactor(0.75)
                                .lineLimit(1)
                                .opacity(store.selected == size ? 1 : 0.55)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                    .disabled(store.isPurchasing)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 22)
                    .animation(
                        reduceMotion ? nil : .spring(response: 0.58, dampingFraction: 0.84).delay(Double(index) * 0.05),
                        value: appeared
                    )
                    .accessibilityLabel(Text(LocalizedStringKey(size.title)))
                    .accessibilityValue(store.price(for: size))
                }
            }
            .padding(.horizontal, 4)

            if let message = store.message {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .minimumScaleFactor(0.85)
            }

            Button("Nie teraz") {
                QuietPromptStore.markCoffeeDecline()
                onFinished()
                dismiss()
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(.secondary)
            .opacity(appeared ? 1 : 0)
            Spacer(minLength: 0)
        }
    }

    private func choose(_ size: CoffeeSize) async {
        store.selected = size
        CoffeeSounds.pour()
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        if reduceMotion == false {
            drinking = size
        }
        let paid = await store.purchase(size)
        drinking = nil
        if paid {
            onFinished()
            dismiss()
        }
    }
}

struct CoffeeTipSettingsRow: View {
    @ObservedObject private var store = CoffeeTipStore.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drinking: CoffeeSize?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 12) {
                CoffeeCupView(
                    size: .medium,
                    selected: true,
                    drinking: false,
                    reduceMotion: reduceMotion,
                    compact: true
                )
                .frame(width: 72, height: 80)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Może kawa? Nic nie musisz.")
                        .font(.body.weight(.semibold))
                    Text("5, 10 albo 20 zł. Arkusz Apple, bez presji.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 8) {
                ForEach(CoffeeSize.allCases) { size in
                    Button {
                        Task { await choose(size) }
                    } label: {
                        VStack(spacing: 2) {
                            CoffeeCupView(
                                size: size,
                                selected: store.selected == size,
                                drinking: drinking == size,
                                reduceMotion: reduceMotion,
                                compact: true
                            )
                            .frame(height: 86)
                            Text(store.price(for: size))
                                .font(.caption2.weight(.semibold).monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                    .disabled(store.isPurchasing)
                    .accessibilityLabel(Text(LocalizedStringKey(size.title)))
                    .accessibilityValue(store.price(for: size))
                }
            }

            if let message = store.message, store.showThankYou == false {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .task { await store.load() }
    }

    private func choose(_ size: CoffeeSize) async {
        store.selected = size
        CoffeeSounds.pour()
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        if reduceMotion == false {
            drinking = size
        }
        _ = await store.purchase(size)
        drinking = nil
    }
}

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
            .presentationBackground(ParagonTheme.overlayMaterial)
            .presentationCornerRadius(32)
            .task {
                CoffeeSounds.pour()
                await store.load()
                if reduceMotion {
                    appeared = true
                } else {
                    withAnimation(ParagonTheme.snappy) {
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

            HStack(alignment: .top, spacing: 8) {
                ForEach(Array(CoffeeSize.allCases.enumerated()), id: \.element.id) { index, size in
                    Button {
                        Task { await choose(size) }
                    } label: {
                        VStack(spacing: 6) {
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
                                .opacity(store.selected == size ? 1 : 0.7)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(ParagonPressStyle())
                    .disabled(store.isPurchasing)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 22)
                    .animation(
                        reduceMotion ? nil : ParagonTheme.snappy.delay(Double(index) * 0.05),
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
                    compact: true,
                    showsCaption: false
                )
                .frame(width: 68, height: 68)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Może kawa? Nic nie musisz.")
                        .font(.body.weight(.semibold))
                    Text("5, 10 albo 20 zł. Arkusz Apple, bez presji.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(alignment: .top, spacing: 8) {
                ForEach(CoffeeSize.allCases) { size in
                    Button {
                        Task { await choose(size) }
                    } label: {
                        VStack(spacing: 6) {
                            CoffeeCupView(
                                size: size,
                                selected: store.selected == size,
                                drinking: drinking == size,
                                reduceMotion: reduceMotion,
                                compact: true
                            )
                            Text(store.price(for: size))
                                .font(.caption2.weight(.semibold).monospacedDigit())
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(ParagonPressStyle())
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
        .padding(16)
        .background {
            RoundedRectangle(cornerRadius: ParagonTheme.passCorner, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
                .overlay {
                    ParagonTheme.passHairline(
                        RoundedRectangle(cornerRadius: ParagonTheme.passCorner, style: .continuous)
                    )
                }
        }
        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
        .listRowBackground(Color.clear)
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

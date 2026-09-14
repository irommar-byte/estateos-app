import SwiftUI

struct AppLovePrompt: View {
    var onFinished: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var rating = 0
    @State private var note = ""
    @State private var thanked = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 22) {
                if thanked {
                    Text("Dziękuję.")
                        .font(.title2.weight(.semibold))
                        .padding(.top, 24)
                    Spacer()
                } else {
                    Text("Podoba Ci się ParagonOS?")
                        .font(.title3.weight(.semibold))
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.8)
                        .lineLimit(2)
                        .padding(.top, 12)
                    HStack(spacing: 12) {
                        ForEach(1...5, id: \.self) { star in
                            Button {
                                rating = star
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            } label: {
                                Image(systemName: star <= rating ? "star.fill" : "star")
                                    .font(.title)
                                    .foregroundStyle(star <= rating ? Color.yellow : Color.secondary.opacity(0.45))
                                    .scaleEffect(star <= rating ? 1.06 : 1)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(star)")
                        }
                    }
                    .animation(.spring(response: 0.42, dampingFraction: 0.9), value: rating)

                    if rating > 0 && rating <= 3 {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Co poprawić?")
                                .font(.footnote.weight(.semibold))
                            TextField("Opcjonalnie, zostaje na tym iPhonie", text: $note, axis: .vertical)
                                .lineLimit(3...6)
                                .textFieldStyle(.roundedBorder)
                            Button("Wyślij") {
                                finishLow()
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .padding(.horizontal, 8)
                    }

                    Spacer()
                }
            }
            .padding(24)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Nie teraz") {
                        QuietPromptStore.markReviewPrompt()
                        onFinished()
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .onChange(of: rating) { _, value in
            if value >= 4 {
                Task { await finishHigh() }
            }
        }
    }

    private func finishHigh() async {
        QuietPromptStore.markReviewCompleted()
        thanked = true
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        try? await Task.sleep(nanoseconds: 1_400_000_000)
        onFinished()
        dismiss()
        try? await Task.sleep(nanoseconds: 280_000_000)
        ReviewGate.requestNativeReview()
    }

    private func finishLow() {
        QuietPromptStore.markReviewCompleted()
        thanked = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            onFinished()
            dismiss()
        }
    }
}

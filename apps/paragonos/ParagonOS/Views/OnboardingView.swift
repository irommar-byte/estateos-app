import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var page = 0

    private let pages: [(symbol: String, title: String, text: String)] = [
        (
            "waterbottle.fill",
            "Zeskanuj kaucję",
            "Aparat rozpoznaje sieć, kwotę, datę i kod. Zanim zapiszesz, zawsze sprawdzisz dane."
        ),
        (
            "doc.text.viewfinder",
            "Paragony i karty",
            "Paragony pilnują gwarancji i zwrotu. Kartę pokazujesz przy kasie albo dodajesz do Apple Wallet."
        ),
        (
            "person.2.fill",
            "Rodzina i terminy",
            "Kaucje, paragony i karty udostępniasz bliskim osobno. Przypomnimy, zanim minie termin."
        )
    ]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                if page < pages.count - 1 {
                    Button("Pomiń") {
                        wallet.completeOnboarding()
                    }
                    .font(.body.weight(.semibold))
                    .padding(.trailing, 20)
                    .padding(.top, 8)
                }
            }
            .frame(height: 44)

            BrandWordmark(size: .largeTitle)
                .padding(.bottom, 8)

            TabView(selection: $page) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, item in
                    onboardingPage(symbol: item.symbol, title: item.title, text: item.text)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))

            Button {
                if page < pages.count - 1 {
                    if reduceMotion {
                        page += 1
                    } else {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            page += 1
                        }
                    }
                } else {
                    wallet.completeOnboarding()
                }
            } label: {
                Text(page < pages.count - 1 ? "Dalej" : "Zaczynamy")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
        .background(Color(.systemBackground))
    }

    private func onboardingPage(symbol: String, title: String, text: String) -> some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: symbol)
                .font(.system(size: 52, weight: .semibold))
                .foregroundStyle(ParagonTheme.osGreen)
                .symbolRenderingMode(.hierarchical)
            Text(title)
                .font(.title.bold())
            Text(text)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
            Spacer()
        }
    }
}

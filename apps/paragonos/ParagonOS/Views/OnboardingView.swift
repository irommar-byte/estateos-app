import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var wallet: WalletModel

    var body: some View {
        VStack(spacing: 0) {
            BrandWordmark(size: .largeTitle)
                .padding(.top, 12)
                .padding(.bottom, 8)

            TabView {
                onboardingPage(
                    symbol: "waterbottle.fill",
                    title: "Zeskanuj kaucję",
                    text: "Aparat rozpoznaje sieć, kwotę, datę i kod z butelkomatu. Zanim zapiszesz, zawsze sprawdzisz dane."
                )
                onboardingPage(
                    symbol: "doc.text.viewfinder",
                    title: "Paragony i faktury",
                    text: "Elektronika, ubrania, AGD — ParagonOS™ rozpoznaje sklep, kwotę i NIP, układa w kategorie i pilnuje gwarancji oraz 14 dni na zwrot."
                )
                onboardingPage(
                    symbol: "person.2.fill",
                    title: "Rodzina osobno",
                    text: "Kaucje i paragony udostępniasz bliskim niezależnie. Na drugim iPhonie wrócą przez iCloud."
                )
                onboardingPage(
                    symbol: "bell.badge",
                    title: "Nie przegap terminu",
                    text: "Przypomnienie przed końcem kaucji, gwarancji i zwrotu. Przy kasie pokazujesz kod albo zdjęcie."
                )
            }
            .tabViewStyle(.page(indexDisplayMode: .always))

            Button {
                wallet.completeOnboarding()
            } label: {
                Text("Dalej")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
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

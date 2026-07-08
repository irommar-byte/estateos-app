import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var app: AppModel
    @State private var tab: Tab = .latest
    @FocusState private var focusedTab: Tab?

    enum Tab: String, CaseIterable {
        case latest = "Polecane"
        case search = "Szukaj"
        case account = "Konto"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header

            if app.isLoadingOffers {
                ProgressView("Loading offers...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                switch tab {
                case .latest:
                    showroomView
                case .search:
                    SearchView()
                case .account:
                    accountView
                }
            }
        }
        .padding(40)
        .fullScreenCover(item: $app.selectedOffer) { offer in
            OfferDetailView(offer: offer)
                .environmentObject(app)
        }
        .task {
            if app.offers.isEmpty {
                try? await app.refreshOffers()
            }
        }
    }

    private var header: some View {
        HStack {
            Text("EstateOS")
                .font(.system(size: 34, weight: .bold, design: .rounded))
            Spacer()
            HStack(spacing: 12) {
                ForEach(Tab.allCases, id: \.self) { item in
                    Button(item.rawValue) { tab = item }
                        .buttonStyle(.borderedProminent)
                        .tint(tab == item ? .green : .gray)
                        .focused($focusedTab, equals: item)
                }
            }
        }
    }

    private var accountView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Konto")
                .font(.title2.bold())
            if let user = app.session?.user.login {
                Text(user)
                    .foregroundStyle(.secondary)
            } else {
                Text("Tryb showroom bez logowania")
                    .foregroundStyle(.secondary)
            }
            Button("Refresh offers") {
                Task { try? await app.refreshOffers() }
            }
            .buttonStyle(.bordered)

            if app.session == nil {
                Button("Zaloguj się") {
                    app.openLoginSheet()
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
            } else {
                Button("Logout") {
                    app.logout()
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
            }
        }
    }

    private var showroomView: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 24) {
                section("Polecane nieruchomości", offers: app.offers.prefix(24))
                section("Nowości w Warszawie", offers: app.offers.filter { ($0.city ?? "").localizedCaseInsensitiveContains("warsz") }.prefix(24))
                section("Luksusowe apartamenty", offers: app.offers.filter { ($0.price ?? 0) >= 2_000_000 }.prefix(24))
            }
        }
    }

    private func section(_ title: String, offers: some Sequence<EstateOffer>) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.title2.bold())
            OffersRailView(offers: Array(offers), onSelect: app.openDetail)
        }
    }
}

struct OffersRailView: View {
    let offers: [EstateOffer]
    let onSelect: (EstateOffer) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 24) {
                ForEach(offers.prefix(80)) { offer in
                    OfferCardView(offer: offer)
                        .frame(width: 460)
                        .onTapGesture {
                            onSelect(offer)
                        }
                }
            }
        }
    }
}

struct OfferCardView: View {
    let offer: EstateOffer

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 220)
                .overlay(alignment: .bottomLeading) {
                    if let city = offer.city {
                        Text(city)
                            .font(.caption.weight(.semibold))
                            .padding(8)
                    }
                }
            Text(offer.title)
                .font(.headline)
                .lineLimit(2)
            Text(priceLabel)
                .font(.title3.bold())
                .foregroundStyle(.green)
            Text(locationLabel)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 18).fill(Color.white.opacity(0.06)))
    }

    private var priceLabel: String {
        guard let price = offer.price else { return "Price on request" }
        return "\(Int(price)) PLN"
    }

    private var locationLabel: String {
        [offer.city, offer.district].compactMap { $0 }.joined(separator: " • ")
    }
}

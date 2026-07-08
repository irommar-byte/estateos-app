import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var app: AppModel
    @FocusState private var queryFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            TextField("Search offers (city, district, title)", text: $app.searchQuery)
                .textFieldStyle(.plain)
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.12)))
                .focused($queryFocused)

            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(spacing: 12) {
                    ForEach(app.filteredOffers) { offer in
                        Button {
                            app.openDetail(offer)
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(offer.title)
                                        .font(.headline)
                                        .lineLimit(1)
                                    Text([offer.city, offer.district].compactMap { $0 }.joined(separator: " • "))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if let price = offer.price {
                                    Text("\(Int(price)) PLN")
                                        .font(.headline)
                                        .foregroundStyle(.green)
                                }
                            }
                            .padding(14)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .onAppear {
            queryFocused = true
        }
    }
}

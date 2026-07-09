import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var app: AppModel
    @FocusState private var queryFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Wyszukiwarka")
                .font(.system(size: 38, weight: .bold, design: .rounded))

            TextField("Miasto, dzielnica, tytuł oferty", text: $app.searchQuery)
                .textFieldStyle(.plain)
                .font(.title3)
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
                .eosGlass(cornerRadius: 16, opacity: 0.34)
                .focused($queryFocused)

            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(spacing: 16) {
                    ForEach(app.filteredOffers.prefix(80)) { offer in
                        Button {
                            app.openDetail(offer)
                        } label: {
                            HStack(spacing: 18) {
                                EOSOfferThumbnail(
                                    url: EOSOfferMedia.primaryImageURL(for: offer),
                                    height: 96
                                )
                                .frame(width: 150)

                                VStack(alignment: .leading, spacing: 6) {
                                    Text(offer.title)
                                        .font(.headline)
                                        .lineLimit(2)
                                        .multilineTextAlignment(.leading)
                                        .foregroundStyle(.white)
                                    Text(offer.displayLocation)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 16)
                                Text(EOSFormat.pricePLN(offer.price))
                                    .font(.title3.weight(.bold))
                                    .foregroundStyle(.green)
                            }
                            .padding(16)
                            .eosGlass(cornerRadius: 18, opacity: 0.32)
                        }
                        .buttonStyle(.plain)
                        .eosFocusParallax(lift: 10, scale: 1.03)
                    }
                }
            }
        }
        .padding(24)
        .eosGlass(cornerRadius: 28, opacity: 0.26)
        .focusSection()
        .onAppear {
            queryFocused = true
        }
    }
}

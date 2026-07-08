import SwiftUI

struct OfferDetailView: View {
    @EnvironmentObject private var app: AppModel
    let offer: EstateOffer
    @State private var showQR = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(offer.title)
                        .font(.system(size: 42, weight: .bold, design: .rounded))

                    HStack(spacing: 20) {
                        infoBadge("Price", priceLabel)
                        infoBadge("Area", areaLabel)
                        infoBadge("Rooms", roomLabel)
                    }

                    Text([offer.city, offer.district].compactMap { $0 }.joined(separator: " • "))
                        .foregroundStyle(.secondary)

                    if let desc = offer.description, !desc.isEmpty {
                        Text(desc)
                            .font(.body)
                    }

                    Button("Show contact QR") {
                        showQR = true
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                }
                .padding(40)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        app.closeDetail()
                    }
                }
            }
        }
        .sheet(isPresented: $showQR) {
            ContactQrSheet(offer: offer)
        }
    }

    private func infoBadge(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.title3.bold())
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.06)))
    }

    private var priceLabel: String { offer.price.map { "\(Int($0)) PLN" } ?? "Request" }
    private var areaLabel: String { offer.area.map { "\(String(format: "%.0f", $0)) m2" } ?? "-" }
    private var roomLabel: String { offer.rooms.map { String(format: "%.0f", $0) } ?? "-" }
}

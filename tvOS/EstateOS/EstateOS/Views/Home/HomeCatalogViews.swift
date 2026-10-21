import SwiftUI

struct OffersCatalogView: View {
    let offers: [EstateOffer]
    let sectionTitle: String
    let onSelect: (EstateOffer) -> Void
    @EnvironmentObject private var app: AppModel

    private var items: [EstateOffer] { Array(offers.prefix(80)) }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(alignment: .top, spacing: 48) {
                ForEach(items) { offer in
                    offerButton(offer)
                }
            }
            .padding(.vertical, 36)
        }
        .scrollClipDisabled()
        .focusSection()
    }

    private func offerButton(_ offer: EstateOffer) -> some View {
        let item = ShowroomItem(offer: offer)
        return EOSPosterCard(
            imageURL: item.imageURL,
            title: item.title,
            subtitle: item.cardSubtitle,
            width: 400,
            onFocus: { app.noteShowroomSection(sectionTitle) },
            action: {
                app.noteShowroomSection(sectionTitle)
                onSelect(offer)
            }
        ) {
            if let badge = item.badge {
                EOSGlassBadge(text: badge, tint: Color(red: 0.5, green: 0.86, blue: 0.66))
            }
        }
        .contextMenu {
            offerPosterContextMenu(offer, sectionTitle: sectionTitle)
        }
    }

    @ViewBuilder
    private func offerPosterContextMenu(_ offer: EstateOffer, sectionTitle: String) -> some View {
        Button(app.isFavorite(offer.id) ? "Usuń z ulubionych" : "Dodaj do ulubionych") {
            Task { await app.toggleFavorite(offer) }
        }
        Button("Immersyjny przegląd") {
            let pool = offers
            let index = pool.firstIndex(where: { $0.id == offer.id }) ?? 0
            app.openImmersiveBrowse(at: index, from: pool)
        }
        Button("Otwórz szczegóły") {
            app.noteShowroomSection(sectionTitle)
            onSelect(offer)
        }
    }
}

/// Updates sticky section banner when a poster inside the section becomes focused.
private struct FocusSectionProbe: View {
    let title: String
    @EnvironmentObject private var app: AppModel
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .onChange(of: isFocused) { _, focused in
                if focused { app.noteShowroomSection(title) }
            }
            .onAppear {
                if isFocused { app.noteShowroomSection(title) }
            }
    }
}

struct OffersRailView: View {
    let offers: [EstateOffer]
    let onSelect: (EstateOffer) -> Void

    var body: some View {
        OffersCatalogView(
            offers: offers,
            sectionTitle: "Oferty",
            onSelect: onSelect
        )
    }
}

struct OfferCardView: View {
    let offer: EstateOffer
    var isFavorite: Bool = false
    var showsOwnerStats: Bool = false
    var distanceLabel: String? = nil
    var imageHeight: CGFloat = 180
    var compact: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 10 : 14) {
            EOSOfferThumbnail(url: EOSOfferMedia.primaryImageURL(for: offer), height: imageHeight)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if let discount = offer.priceDiscountBadgeText {
                        EOSDiscountBadge(percentText: discount)
                            .padding(10)
                    }
                }
                .overlay(alignment: .topTrailing) {
                    if isFavorite {
                        Image(systemName: "heart.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.pink)
                            .padding(10)
                            .background(Circle().fill(.black.opacity(0.45)))
                            .padding(10)
                    }
                }
                .overlay(alignment: .bottomLeading) {
                    HStack(spacing: 8) {
                        EOSMediaBadge(
                            text: offer.transactionBadgeText,
                            fill: (offer.isRentBadge
                                   ? Color(red: 0.45, green: 0.55, blue: 0.72)
                                   : EOSPalette.home).opacity(0.88),
                            stroke: Color.white.opacity(0.28)
                        )
                        if let distanceLabel {
                            EOSMediaBadge(
                                text: distanceLabel,
                                fill: Color.white.opacity(0.88),
                                stroke: Color.clear,
                                foreground: .black
                            )
                        }
                    }
                    .padding(10)
                }

            Text(offer.title)
                .font(.system(size: compact ? 18 : 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: compact ? 44 : 60, alignment: .topLeading)

            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(EOSFormat.pricePLN(offer.price))
                    .font(compact ? .title3.bold() : .title2.bold())
                    .foregroundStyle(EOSPalette.home)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                if let discount = offer.priceDiscountBadgeText {
                    Text(discount)
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(Color(red: 0.95, green: 0.42, blue: 0.36))
                        .lineLimit(1)
                        .fixedSize()
                }
            }

            if showsOwnerStats {
                EOSListingStatsRow(
                    views: offer.viewsCount,
                    favorites: offer.favoritesCount,
                    accent: EOSPalette.home
                )
            }

            Text(offer.displayLocation)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .eosPosterCard(cornerRadius: 22, accent: EOSPalette.home)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Oferta \(offer.title), \(EOSFormat.pricePLN(offer.price)), \(offer.displayLocation)\(isFavorite ? ", w ulubionych" : "")")
    }
}

struct OfferListRowView: View {
    let offer: EstateOffer
    var isFavorite: Bool = false
    var showsOwnerStats: Bool = false
    var distanceLabel: String? = nil

    var body: some View {
        HStack(spacing: 16) {
            EOSOfferThumbnail(url: EOSOfferMedia.primaryImageURL(for: offer), height: 96)
                .frame(width: 160)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if let discount = offer.priceDiscountBadgeText {
                        EOSDiscountBadge(percentText: discount)
                            .scaleEffect(0.85, anchor: .topLeading)
                            .padding(6)
                    }
                }

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    EOSMediaBadge(
                        text: offer.transactionBadgeText,
                        fill: (offer.isRentBadge
                               ? Color(red: 0.45, green: 0.55, blue: 0.72)
                               : EOSPalette.home).opacity(0.88),
                        stroke: Color.white.opacity(0.28),
                        fontSize: 11
                    )
                    if isFavorite {
                        Image(systemName: "heart.fill").foregroundStyle(.pink).font(.caption)
                    }
                    if let distanceLabel {
                        Text(distanceLabel)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(EOSPalette.home)
                            .lineLimit(1)
                            .fixedSize()
                    }
                }
                Text(offer.title)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Text(EOSFormat.pricePLN(offer.price))
                    .font(.title3.bold())
                    .foregroundStyle(EOSPalette.home)
                    .lineLimit(1)
                HStack {
                    if showsOwnerStats {
                        EOSListingStatsRow(views: offer.viewsCount, favorites: offer.favoritesCount, accent: EOSPalette.home)
                    }
                    Spacer()
                    Text(offer.displayLocation)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(white: 0.09).opacity(0.96))
        )
    }
}

private extension EstateOffer {
    var isRentBadge: Bool {
        (transactionType ?? "").uppercased().contains("RENT")
    }
}

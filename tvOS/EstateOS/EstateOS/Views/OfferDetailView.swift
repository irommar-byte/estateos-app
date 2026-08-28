import SwiftUI

struct OfferDetailView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var heroTransition: HeroTransitionCoordinator
    let offer: EstateOffer
    var heroNamespace: Namespace.ID? = nil
    var heroTransitionID: String? = nil

    @State private var isLoadingDescription = false

    private var liveOffer: EstateOffer {
        if let selected = app.selectedOffer, selected.id == offer.id { return selected }
        return offer
    }

    var body: some View {
        DetailShellView(
            presentation: presentation,
            isFavorite: app.isFavorite(liveOffer.id),
            favoriteIdleAccent: .green,
            onClose: {
                heroTransition.end()
                app.closeDetail()
            },
            onToggleFavorite: { Task { await app.toggleFavorite(liveOffer) } },
            isLoadingDescription: isLoadingDescription,
            heroNamespace: heroNamespace,
            heroTransitionID: heroTransitionID,
            qrSheet: {
                ContactQrSheet(offer: liveOffer)
            }
        )
        .task(id: offer.id) {
            guard liveOffer.displayDescription == nil else { return }
            isLoadingDescription = true
            defer { isLoadingDescription = false }
            await app.refreshSelectedOfferDetail(id: offer.id)
        }
        .onChange(of: liveOffer.description) { _, _ in
            if liveOffer.displayDescription != nil { isLoadingDescription = false }
        }
    }

    private var presentation: DetailPresentation {
        let live = liveOffer
        let isRent = (live.transactionType ?? "").uppercased().contains("RENT")
        let ownerStats: DetailPresentation.OwnerStats? = app.isOwner(of: live)
            ? .init(views: live.viewsCount, favorites: live.favoritesCount)
            : nil

        return DetailPresentation(
            imageURLs: EOSOfferMedia.imageURLs(for: live),
            title: live.title,
            priceText: EOSFormat.pricePLN(live.price),
            subtitleText: [
                live.transactionLabel,
                live.displayPropertyType,
                live.area.map { "\(Int($0)) m²" },
                live.rooms.map { String(format: "%.0f pok.", $0) },
            ].compactMap { $0 }.joined(separator: "  ·  "),
            locationLine: live.displayLocation,
            country: live.resolvedCountry,
            accentColor: EOSPalette.home,
            descriptionText: live.displayDescription,
            specRows: specRows(for: live),
            specsPanelTitle: "Dane oferty",
            specsPanelIcon: "list.bullet.rectangle",
            ownerStats: ownerStats,
            transactionBadgeText: live.transactionLabel,
            transactionBadgeIsRent: isRent
        )
    }

    private func specRows(for offer: EstateOffer) -> [DetailPresentation.SpecRow] {
        let raw: [(String, String, String, String?)] = [
            ("tx", "Transakcja", "arrow.left.arrow.right", offer.transactionLabel),
            ("type", "Typ", "building.2", offer.displayPropertyType),
            ("price", "Cena", "tag", EOSFormat.pricePLN(offer.price)),
            ("area", "Metraż", "square.split.bottomrightquarter", offer.area.map { "\(Int($0)) m²" }),
            ("rooms", "Pokoje", "bed.double", offer.rooms.map { String(format: "%.0f", $0) }),
            ("ppsm", "Cena za m²", "chart.bar", offer.pricePerSqm != nil ? offer.displayPricePerSqm : nil),
            ("city", "Miasto", "mappin.and.ellipse", offer.city),
            ("district", "Dzielnica", "map", offer.displayDistrict),
            ("country", "Kraj", "globe.europe.africa", "\(offer.resolvedCountry.flagEmoji) \(offer.resolvedCountry.name)"),
        ]
        return raw.compactMap { id, label, icon, value in
            guard let value else { return nil }
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, trimmed != "—" else { return nil }
            return DetailPresentation.SpecRow(id: id, label: label, value: trimmed, icon: icon)
        }
    }
}

extension OfferDetailView: DetailPresentable {
    var detailPresentation: DetailPresentation { presentation }
}

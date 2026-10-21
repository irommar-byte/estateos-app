import SwiftUI

struct OfferDetailView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var heroTransition: HeroTransitionCoordinator
    let offer: EstateOffer
    var heroNamespace: Namespace.ID? = nil
    var heroTransitionID: String? = nil

    @State private var isLoadingDescription = false
    /// Offers opened from "Może Ci się spodobać" — MENU walks back through them.
    @State private var trail: [EstateOffer] = []
    @State private var similar: [ShowroomSection] = []

    /// The offer on screen: the opened one, or the last one picked from suggestions.
    private var current: EstateOffer { trail.last ?? offer }

    private var liveOffer: EstateOffer {
        let base = current
        if let selected = app.selectedOffer, selected.id == base.id { return selected }
        if let fresh = app.offers.first(where: { $0.id == base.id }) { return fresh }
        return base
    }

    var body: some View {
        // ZStack hosts the cross-fade when a suggested listing replaces the current one.
        ZStack {
        DetailShellView(
            presentation: presentation,
            isFavorite: app.isFavorite(liveOffer.id),
            favoriteIdleAccent: .green,
            onClose: goBack,
            onToggleFavorite: { Task { await app.toggleFavorite(liveOffer) } },
            isLoadingDescription: isLoadingDescription,
            heroNamespace: heroNamespace,
            heroTransitionID: heroTransitionID,
            similar: similar,
            onOpenSimilar: openSimilar,
            qrSheet: {
                ContactQrSheet(offer: liveOffer)
            }
        )
        // A new offer = a fresh page (focus and scroll start at the top), cross-faded in.
        .id(current.id)
        .transition(.asymmetric(
            insertion: .opacity.combined(with: .scale(scale: 1.03)),
            removal: .opacity
        ))
        }
        .background(Color.black.ignoresSafeArea())
        .task(id: current.id) {
            similar = app.similarSections(for: current)
            guard liveOffer.displayDescription == nil else { return }
            isLoadingDescription = true
            defer { isLoadingDescription = false }
            if trail.isEmpty {
                await app.refreshSelectedOfferDetail(id: offer.id)
            } else {
                await app.loadFullOfferIfNeeded(id: current.id)
            }
        }
        .onChange(of: liveOffer.description) { _, _ in
            if liveOffer.displayDescription != nil { isLoadingDescription = false }
        }
    }

    private func openSimilar(_ item: ShowroomItem) {
        guard let next = item.offer else { return }
        if let url = item.imageURL { EOSImageCache.prefetch(urls: [url], size: .screen) }
        app.recordView(of: next)
        withAnimation(.easeInOut(duration: 0.5)) { trail.append(next) }
    }

    private func goBack() {
        if !trail.isEmpty {
            withAnimation(.easeInOut(duration: 0.45)) { _ = trail.removeLast() }
            return
        }
        heroTransition.end()
        app.closeDetail()
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
        let x = offer.extras
        let floorText: String? = x.floor.map { f in
            let label = f <= 0 ? "parter" : "\(f)"
            if let total = x.totalFloors, total > 0 { return "\(label) / \(total)" }
            return label
        }
        let amenities = HomeAmenity.allCases.filter { $0.matches(x) }.map(\.title)
        let raw: [(String, String, String, String?)] = [
            ("tx", "Transakcja", "arrow.left.arrow.right", offer.transactionLabel),
            ("type", "Typ", "building.2", offer.displayPropertyType),
            ("price", "Cena", "tag", EOSFormat.pricePLN(offer.price)),
            ("area", "Metraż", "square.split.bottomrightquarter", offer.area.map { "\(Int($0)) m²" }),
            ("rooms", "Pokoje", "bed.double", offer.rooms.map { String(format: "%.0f", $0) }),
            ("ppsm", "Cena za m²", "chart.bar", offer.pricePerSqm != nil ? offer.displayPricePerSqm : nil),
            ("floor", "Piętro", "building", floorText),
            ("built", "Rok budowy", "calendar", x.yearBuilt.map(String.init)),
            ("plot", "Działka", "leaf", x.plotArea.map { "\(Int($0)) m²" }),
            ("condition", "Stan", "sparkles", Self.conditionLabel(x.condition)),
            ("heating", "Ogrzewanie", "flame", x.heating),
            ("amenities", "Udogodnienia", "checkmark.seal", amenities.isEmpty ? nil : amenities.joined(separator: ", ")),
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

    /// Prisma `PropertyCondition` → Polish label.
    private static func conditionLabel(_ raw: String?) -> String? {
        switch (raw ?? "").uppercased() {
        case "READY": return "Gotowe do zamieszkania"
        case "RENOVATION", "TO_RENOVATE", "NEEDS_RENOVATION": return "Do remontu"
        case "DEVELOPER", "DEVELOPER_STATE", "SHELL": return "Stan deweloperski"
        case "": return nil
        default: return nil
        }
    }
}

extension OfferDetailView: DetailPresentable {
    var detailPresentation: DetailPresentation { presentation }
}

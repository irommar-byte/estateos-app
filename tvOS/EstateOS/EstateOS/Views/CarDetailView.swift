import SwiftUI

struct CarDetailView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var heroTransition: HeroTransitionCoordinator
    let car: CarListing
    var heroNamespace: Namespace.ID? = nil
    var heroTransitionID: String? = nil

    /// Cars opened from "Może Ci się spodobać" — MENU walks back through them.
    @State private var trail: [CarListing] = []
    @State private var similar: [ShowroomSection] = []

    private var current: CarListing { trail.last ?? car }

    var body: some View {
        // ZStack hosts the cross-fade when a suggested listing replaces the current one.
        ZStack {
        DetailShellView(
            presentation: presentation,
            isFavorite: app.isFavoriteCar(current.id),
            favoriteIdleAccent: .cyan,
            onClose: goBack,
            onToggleFavorite: { app.toggleFavoriteCar(current) },
            heroNamespace: heroNamespace,
            heroTransitionID: heroTransitionID,
            similar: similar,
            onOpenSimilar: openSimilar,
            qrSheet: { CarContactQrSheet(car: current) }
        )
        .id(current.id)
        .transition(.asymmetric(
            insertion: .opacity.combined(with: .scale(scale: 1.03)),
            removal: .opacity
        ))
        }
        .background(Color.black.ignoresSafeArea())
        .task(id: current.id) {
            similar = app.similarSections(for: current)
        }
    }

    private func openSimilar(_ item: ShowroomItem) {
        guard let next = item.car else { return }
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
        app.closeCarDetail()
    }

    private var presentation: DetailPresentation {
        DetailPresentation(
            imageURLs: imageURLs,
            title: current.displayHeadline,
            priceText: current.displayPrice,
            subtitleText: current.displaySpecs,
            locationLine: current.city,
            country: current.resolvedCountry,
            accentColor: EOSPalette.car,
            descriptionText: OfferPresentation.plainDescription(from: current.description),
            specRows: specRows,
            specsPanelTitle: "Dane techniczne",
            specsPanelIcon: "wrench.and.screwdriver",
            descriptionHeaderTrailing: current.displayHeadline
        )
    }

    private var imageURLs: [URL] {
        var seen = Set<String>()
        return current.imageCandidates.compactMap { raw -> URL? in
            guard !seen.contains(raw) else { return nil }
            seen.insert(raw)
            return EOSOfferMedia.imageURL(from: raw)
        }
    }

    private var specRows: [DetailPresentation.SpecRow] {
        let raw: [(String, String, String, String?)] = [
            ("make", "Marka", "car.fill", current.make),
            ("model", "Model", "tag", current.model),
            ("year", "Rok", "calendar", current.year > 0 ? "\(current.year)" : nil),
            ("mileage", "Przebieg", "speedometer", current.mileageKm > 0 ? CarPresentation.mileageLabel(current.mileageKm) : nil),
            ("fuel", "Paliwo", "fuelpump", current.fuelType),
            ("gear", "Skrzynia", "gearshape.2", current.transmission),
            ("body", "Nadwozie", "car", current.bodyType),
            ("power", "Moc", "bolt.fill", current.enginePower),
            ("capacity", "Pojemność", "engine.combustion", current.engineCapacity),
            ("generation", "Generacja", "square.stack", current.generation),
            ("trim", "Wersja", "star", current.trimVersion),
            ("color", "Kolor", "paintpalette", current.exteriorColor),
            ("doors", "Drzwi", "car", current.doorCount.map(String.init)),
            ("city", "Miasto", "mappin.and.ellipse", current.city.isEmpty ? nil : current.city),
            ("country", "Kraj", "globe.europe.africa", "\(current.resolvedCountry.flagEmoji) \(current.resolvedCountry.name)"),
            ("vin", "VIN", "barcode", current.vinMasked),
        ]
        return raw.compactMap { id, label, icon, value in
            guard let value else { return nil }
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            return DetailPresentation.SpecRow(id: id, label: label, value: trimmed, icon: icon)
        }
    }
}

extension CarDetailView: DetailPresentable {
    var detailPresentation: DetailPresentation { presentation }
}

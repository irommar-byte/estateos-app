import SwiftUI

struct CarDetailView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var heroTransition: HeroTransitionCoordinator
    let car: CarListing
    var heroNamespace: Namespace.ID? = nil
    var heroTransitionID: String? = nil

    var body: some View {
        DetailShellView(
            presentation: presentation,
            isFavorite: app.isFavoriteCar(car.id),
            favoriteIdleAccent: .cyan,
            onClose: {
                heroTransition.end()
                app.closeCarDetail()
            },
            onToggleFavorite: { app.toggleFavoriteCar(car) },
            heroNamespace: heroNamespace,
            heroTransitionID: heroTransitionID,
            qrSheet: { CarContactQrSheet(car: car) }
        )
    }

    private var presentation: DetailPresentation {
        DetailPresentation(
            imageURLs: imageURLs,
            title: car.displayHeadline,
            priceText: car.displayPrice,
            subtitleText: car.displaySpecs,
            locationLine: car.city,
            country: car.resolvedCountry,
            accentColor: EOSPalette.car,
            descriptionText: OfferPresentation.plainDescription(from: car.description),
            specRows: specRows,
            specsPanelTitle: "Dane techniczne",
            specsPanelIcon: "wrench.and.screwdriver",
            descriptionHeaderTrailing: car.displayHeadline
        )
    }

    private var imageURLs: [URL] {
        var seen = Set<String>()
        return car.imageCandidates.compactMap { raw -> URL? in
            guard !seen.contains(raw) else { return nil }
            seen.insert(raw)
            return EOSOfferMedia.imageURL(from: raw)
        }
    }

    private var specRows: [DetailPresentation.SpecRow] {
        let raw: [(String, String, String, String?)] = [
            ("make", "Marka", "car.fill", car.make),
            ("model", "Model", "tag", car.model),
            ("year", "Rok", "calendar", car.year > 0 ? "\(car.year)" : nil),
            ("mileage", "Przebieg", "speedometer", car.mileageKm > 0 ? CarPresentation.mileageLabel(car.mileageKm) : nil),
            ("fuel", "Paliwo", "fuelpump", car.fuelType),
            ("gear", "Skrzynia", "gearshape.2", car.transmission),
            ("body", "Nadwozie", "car", car.bodyType),
            ("power", "Moc", "bolt.fill", car.enginePower),
            ("capacity", "Pojemność", "engine.combustion", car.engineCapacity),
            ("generation", "Generacja", "square.stack", car.generation),
            ("trim", "Wersja", "star", car.trimVersion),
            ("color", "Kolor", "paintpalette", car.exteriorColor),
            ("doors", "Drzwi", "car", car.doorCount.map(String.init)),
            ("city", "Miasto", "mappin.and.ellipse", car.city.isEmpty ? nil : car.city),
            ("country", "Kraj", "globe.europe.africa", "\(car.resolvedCountry.flagEmoji) \(car.resolvedCountry.name)"),
            ("vin", "VIN", "barcode", car.vinMasked),
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

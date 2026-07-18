import Foundation

enum CarPresentation {
    static func mileageLabel(_ km: Int) -> String {
        guard km > 0 else { return "Nowy / niski przebieg" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = " "
        let n = formatter.string(from: NSNumber(value: km)) ?? "\(km)"
        return "\(n) km"
    }

    static func headline(for car: CarListing) -> String {
        let parts = [car.make, car.model, car.year > 0 ? "\(car.year)" : nil]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? car.title : parts.joined(separator: " · ")
    }

    static func specsLine(for car: CarListing) -> String {
        [
            car.fuelType.isEmpty ? nil : car.fuelType,
            car.transmission.isEmpty ? nil : car.transmission,
            car.bodyType.isEmpty ? nil : car.bodyType,
            mileageLabel(car.mileageKm),
        ]
        .compactMap { $0 }
        .joined(separator: " · ")
    }
}

extension CarListing {
    var displayHeadline: String { CarPresentation.headline(for: self) }
    var displaySpecs: String { CarPresentation.specsLine(for: self) }
    var displayPrice: String { EOSFormat.pricePLN(pricePln > 0 ? pricePln : nil) }
    var sortDate: Date { OfferPresentation.parseCreatedAt(createdAt) }
    var isWithinLast24Hours: Bool { OfferPresentation.isWithinLast24Hours(sortDate) }
}

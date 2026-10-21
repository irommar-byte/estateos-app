import SwiftUI

struct ContactQrSheet: View {
    let offer: EstateOffer

    private var deepLink: String {
        "https://estateos.pl/oferta/\(offer.id)"
    }

    var body: some View {
        EOSQrSheet(
            title: "Otwórz na iPhonie",
            subtitle: offer.title,
            urlString: deepLink,
            footnote: "Na iPhonie napiszesz do sprzedającego, zadzwonisz albo umówisz oglądanie.",
            eyebrow: "KONTAKT ZE SPRZEDAJĄCYM",
            backdrop: EOSOfferMedia.primaryImageURL(for: offer)
        )
    }
}

struct CarContactQrSheet: View {
    let car: CarListing

    private var link: String {
        "https://estateos.pl/cars/\(car.id)"
    }

    var body: some View {
        EOSQrSheet(
            title: "EstateOS™ Car",
            subtitle: car.displayHeadline,
            urlString: link,
            footnote: "Na iPhonie napiszesz do sprzedającego albo zadzwonisz.",
            eyebrow: "KONTAKT ZE SPRZEDAJĄCYM",
            backdrop: EOSOfferMedia.imageURL(from: car.imageUrl)
        )
    }
}

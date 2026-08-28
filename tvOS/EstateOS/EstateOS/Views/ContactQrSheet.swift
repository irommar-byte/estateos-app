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
            footnote: "Zeskanuj aparatem iPhona, aby otworzyć ofertę i skontaktować się ze sprzedającym."
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
            footnote: "Zeskanuj telefonem, aby otworzyć ogłoszenie i skontaktować się ze sprzedającym."
        )
    }
}

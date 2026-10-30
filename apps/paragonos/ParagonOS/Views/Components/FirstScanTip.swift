import TipKit
import SwiftUI

struct FirstScanTip: Tip {
    enum Kind: String {
        case deposit
        case receipt
        case loyalty
    }

    var kind: Kind = .deposit

    var id: String { "first-scan-\(kind.rawValue)" }

    var title: Text {
        switch kind {
        case .deposit:
            Text("Skanuj kwitek kaucji")
        case .receipt:
            Text("Skanuj paragon albo fakturę")
        case .loyalty:
            Text("Skanuj kartę lojalnościową")
        }
    }

    var message: Text {
        switch kind {
        case .deposit:
            Text("Aparat odczyta sieć, kwotę i kod. Zanim zapiszesz, sprawdzisz dane.")
        case .receipt:
            Text("Rozpoznamy sklep, kwotę i NIP. Gwarancja i zwrot zostaną w portfelu.")
        case .loyalty:
            Text("Przy kasie pokażesz kod z karty albo dodasz ją do Apple Wallet.")
        }
    }

    var image: Image? {
        switch kind {
        case .deposit:
            Image(systemName: "waterbottle")
        case .receipt:
            Image(systemName: "doc.text.viewfinder")
        case .loyalty:
            Image(systemName: "creditcard.viewfinder")
        }
    }

    static let deposit = FirstScanTip(kind: .deposit)
    static let receipt = FirstScanTip(kind: .receipt)
    static let loyalty = FirstScanTip(kind: .loyalty)
}

struct BottleMapTip: Tip {
    var id: String { "paragonos.bottle-map.find" }

    var title: Text {
        Text("Znajdź butelkomaty na mapie")
    }

    var message: Text? {
        Text("Otwórz mapę, żeby zobaczyć automaty w okolicy.")
    }

    var image: Image? {
        Image(systemName: "map")
    }

    static let shared = BottleMapTip()
}

/// Full-width TipKit card — avoids clipped `popoverTip` on Dynamic Island / narrow toolbars.
struct ParagonTipCard<T: Tip>: View {
    var tip: T

    var body: some View {
        TipView(tip)
            .tipBackground(ParagonTheme.surface)
            .tipCornerRadius(ParagonTheme.passCorner)
            .tipImageSize(CGSize(width: 36, height: 36))
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

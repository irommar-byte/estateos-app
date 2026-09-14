import TipKit

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
            Text("Skanuj kwitek z butelkomatu")
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

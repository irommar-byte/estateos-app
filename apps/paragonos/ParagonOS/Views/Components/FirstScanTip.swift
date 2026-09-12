import TipKit

struct FirstScanTip: Tip {
    var title: Text {
        Text("Skanuj kaucję lub paragon")
    }

    var message: Text {
        Text("Kaucje z butelkomatu i paragony są osobno. ParagonOS™ pilnuje kwoty, terminu, gwarancji i zwrotu.")
    }

    var image: Image? {
        Image(systemName: "viewfinder")
    }
}

import StoreKit
import SwiftUI
import UIKit

enum ReviewGate {
    static var writeReviewURL: URL {
        URL(string: "itms-apps://itunes.apple.com/app/paragonos?action=write-review")!
    }

    @MainActor
    static func requestNativeReview() {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive })
            ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else {
            openWriteReview()
            return
        }
        AppStore.requestReview(in: scene)
    }

    @MainActor
    static func openWriteReview() {
        UIApplication.shared.open(writeReviewURL)
    }
}

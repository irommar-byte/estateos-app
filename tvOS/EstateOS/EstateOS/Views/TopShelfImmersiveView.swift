import SwiftUI

struct TopShelfImmersiveView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let offers: [EstateOffer]
    let startIndex: Int

    var body: some View {
        ImmersiveBrowseShell(
            items: offers,
            startIndex: startIndex,
            accent: EOSPalette.home,
            hintText: "← → oferty  ·  ↓ zamknij",
            onShow: { app.openDetail($0) },
            onDismiss: { dismiss() }
        )
    }
}

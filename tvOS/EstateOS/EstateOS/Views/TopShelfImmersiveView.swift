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
            hintText: "",
            onShow: { offer in
                // The detail is presented from the same root as this browse — close it first.
                dismiss()
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 450_000_000)
                    app.openDetail(offer)
                }
            },
            onDismiss: { dismiss() },
            isFavorite: { app.isFavorite($0.id) },
            onToggleFavorite: app.session == nil ? nil : { offer in Task { await app.toggleFavorite(offer) } }
        )
    }
}

import SwiftUI

struct ImmersiveCarBrowseView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let cars: [CarListing]
    let startIndex: Int

    var body: some View {
        ImmersiveBrowseShell(
            items: cars,
            startIndex: startIndex,
            accent: EOSPalette.car,
            hintText: "",
            onShow: { car in
                // The detail is presented from the same root as this browse — close it first.
                dismiss()
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 450_000_000)
                    app.openCarDetail(car)
                }
            },
            onDismiss: { dismiss() },
            isFavorite: { app.isFavoriteCar($0.id) },
            onToggleFavorite: { app.toggleFavoriteCar($0) }
        )
    }
}

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
            hintText: "← → auta  ·  ↓ zamknij",
            onShow: { app.openCarDetail($0) },
            onDismiss: { dismiss() },
            trailingActions: { car in
                AnyView(
                    Button {
                        app.toggleFavoriteCar(car)
                    } label: {
                        Label(
                            app.isFavoriteCar(car.id) ? "W ulubionych" : "Ulubione",
                            systemImage: app.isFavoriteCar(car.id) ? "heart.fill" : "heart"
                        )
                    }
                    .buttonStyle(EOSDetailActionButtonStyle(accent: app.isFavoriteCar(car.id) ? .pink : .cyan))
                    .focusEffectDisabled()
                    .accessibilityLabel(app.isFavoriteCar(car.id) ? "Usuń z ulubionych" : "Dodaj do ulubionych")
                )
            }
        )
    }
}

import SwiftUI

struct FavoriteButton: View {
    @EnvironmentObject private var app: AppModel
    let item: FavoriteItem
    var size: CGFloat = 22

    var body: some View {
        Button {
            Task { await app.toggleFavorite(item) }
        } label: {
            Image(systemName: app.isFavorite(item.url) ? "heart.fill" : "heart")
                .font(.system(size: size))
                .foregroundStyle(app.isFavorite(item.url) ? EOSTheme.accent : EOSTheme.textSecondary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(app.isFavorite(item.url) ? "Usuń z ulubionych" : "Dodaj do ulubionych")
    }
}

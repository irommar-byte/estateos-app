import SwiftUI

struct FavoriteButton: View {
    @EnvironmentObject private var app: AppModel
    let item: FavoriteItem
    var size: CGFloat = 22
    var hitSize: CGFloat = 0

    var body: some View {
        let filled = app.isFavorite(item.url)
        let side = hitSize > 0 ? hitSize : max(size + 12, 36)
        Button {
            Task { await app.toggleFavorite(item) }
        } label: {
            Image(systemName: filled ? "heart.fill" : "heart")
                .font(.system(size: size, weight: filled ? .semibold : .regular))
                .foregroundStyle(filled ? EOSTheme.accent : EOSTheme.textSecondary)
                .frame(width: side, height: side)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(filled ? "Usuń z ulubionych" : "Dodaj do ulubionych")
    }
}

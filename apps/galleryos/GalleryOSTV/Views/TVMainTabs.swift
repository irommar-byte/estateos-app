import SwiftUI

private struct TVTabLockKey: EnvironmentKey {
    static let defaultValue = Binding.constant(false)
}

extension EnvironmentValues {
    /// While the map remote is on a pin, tab changes from an upward swipe are ignored.
    var tvTabLock: Binding<Bool> {
        get { self[TVTabLockKey.self] }
        set { self[TVTabLockKey.self] = newValue }
    }
}

struct TVMainTabs: View {
    @AppStorage("galleryos.tv.preview-tab") private var previewTab = ""
    @State private var pinsEngaged = false

    var body: some View {
        TabView(selection: Binding(
            get: { previewTab.isEmpty ? "photos" : previewTab },
            set: { if !pinsEngaged { previewTab = $0 } }
        )) {
            Tab("Zdjęcia", systemImage: "photo.on.rectangle", value: "photos") {
                TVPhotosScreen()
            }
            Tab("Albumy", systemImage: "rectangle.stack", value: "albums") {
                TVAlbumsScreen()
            }
            Tab("Mapa", systemImage: "map", value: "map") {
                TVMapScreen()
            }
            Tab("Ulubione", systemImage: "heart", value: "favorites") {
                TVFavoritesScreen()
            }
            Tab("Szukaj", systemImage: "magnifyingglass", value: "search", role: .search) {
                TVSearchScreen()
            }
            Tab("Ustawienia", systemImage: "gearshape", value: "settings") {
                TVSettingsScreen()
            }
        }
        .environment(\.tvTabLock, $pinsEngaged)
    }
}

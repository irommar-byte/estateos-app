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
    /// Always opens on Zdjęcia, like the system Photos app.
    @State private var tab: String = {
        #if DEBUG
        let preview = UserDefaults.standard.string(forKey: "galleryos.tv.preview-tab") ?? ""
        return preview.isEmpty ? "photos" : preview
        #else
        return "photos"
        #endif
    }()
    @State private var pinsEngaged = false

    var body: some View {
        TabView(selection: Binding(
            get: { tab },
            set: { if !pinsEngaged { tab = $0 } }
        )) {
            Tab(L("Zdjęcia"), systemImage: "photo.on.rectangle", value: "photos") {
                TVPhotosScreen()
            }
            Tab(L("Wspomnienia"), systemImage: "sparkles.rectangle.stack", value: "memories") {
                TVMemoriesScreen()
            }
            Tab(L("Albumy"), systemImage: "rectangle.stack", value: "albums") {
                TVAlbumsScreen()
            }
            Tab(L("Mapa"), systemImage: "map", value: "map") {
                TVMapScreen()
            }
            Tab(L("Ulubione"), systemImage: "heart", value: "favorites") {
                TVFavoritesScreen()
            }
            Tab(L("Szukaj"), systemImage: "magnifyingglass", value: "search", role: .search) {
                TVSearchScreen()
            }
            Tab(L("Ustawienia"), systemImage: "gearshape", value: "settings") {
                TVSettingsScreen()
            }
        }
        .environment(\.tvTabLock, $pinsEngaged)
    }
}

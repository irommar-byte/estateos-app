import SwiftUI

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var library: PhotoLibrary

    var body: some View {
        Group {
            if UIDevice.current.userInterfaceIdiom == .pad {
                PadRoot()
            } else {
                PhoneRoot()
            }
        }
        .overlay(alignment: .top) {
            LinkAnnouncementBanner()
        }
        .task { library.prepare() }
        .task { ServerLink.shared.start() }
        .task {
            guard ShareAccount.shared.signedIn else { return }
            await AccountVault.restoreIfNeeded()
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                LibraryEngine.shared.resume()
            case .background:
                LibraryEngine.shared.stayAwake()
                LibraryEngine.shared.prepareForBackground()
                if LibraryEngine.shared.stillCopying() {
                    SyncScheduler.scheduleSoon()
                }
            default:
                LibraryEngine.shared.stayAwake()
            }
        }
    }
}

private struct PhoneRoot: View {
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            Tab("Biblioteka", systemImage: "photo.on.rectangle.angled", value: 0) {
                NavigationStack {
                    LibraryScreen()
                }
            }
            Tab("Kolekcje", systemImage: "square.grid.2x2", value: 1) {
                NavigationStack {
                    CollectionsScreen()
                        .syncControl()
                }
            }
            Tab("Szukaj", systemImage: "magnifyingglass", value: 2) {
                SearchScreen(showsClose: false)
            }
            Tab("Znajomi", systemImage: "person.2", value: 3) {
                NavigationStack {
                    FriendsScreen()
                        .syncControl()
                }
            }
        }
        .tabBarMinimizeBehavior(.never)
    }
}

private struct PadRoot: View {
    @EnvironmentObject private var library: PhotoLibrary
    @State private var selection: SideItem? = .library

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Label("Biblioteka", systemImage: "photo.on.rectangle")
                    .tag(SideItem.library)
                Label("Znajomi", systemImage: "person.2")
                    .tag(SideItem.friends)
                Section("Kolekcje") {
                    ForEach(library.albums) { album in
                        Label(album.title, systemImage: "rectangle.stack")
                            .tag(SideItem.album(album.id))
                    }
                }
            }
            .navigationTitle("GalleryOS")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .top, spacing: 0) {
                BrandWordmark()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 18)
                    .padding(.bottom, 6)
            }
        } detail: {
            NavigationStack {
                switch selection ?? .library {
                case .library:
                    LibraryScreen()
                case .friends:
                    FriendsScreen()
                        .syncControl()
                case .album(let id):
                    LibraryScreen(albumID: id)
                }
            }
        }
    }
}

private enum SideItem: Hashable {
    case library
    case friends
    case album(String)
}

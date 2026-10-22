import SwiftUI

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.launchFinished) private var launchFinished
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var membership = GalleryMembership.shared
    @State private var review = false
    /// Control Center, Face ID or a system alert make the app inactive for a moment; those are not launches.
    @State private var lastPhase: ScenePhase = .background

    var body: some View {
        Group {
            if membership.unlocked {
                if UIDevice.current.userInterfaceIdiom == .pad {
                    PadRoot()
                } else {
                    PhoneRoot()
                }
            } else {
                MembershipGate()
            }
        }
        .overlay(alignment: .top) {
            LinkAnnouncementBanner()
        }
        .overlay {
            if let plan = membership.celebration {
                PurchaseCelebration(plan: plan) {
                    withAnimation(.easeInOut(duration: 0.6)) { membership.celebration = nil }
                }
                .transition(.opacity)
                .zIndex(10)
            }
        }
        .animation(.easeInOut(duration: 0.5), value: membership.celebration)
        .task { library.prepare() }
        .sheet(isPresented: $review, onDismiss: {
            // Swiped away without an answer: ask again much later, not on the next return.
            if GalleryReview.due() { GalleryReview.later() }
        }) {
            ReviewPrompt()
        }
        .task { ServerLink.shared.start() }
        .task {
            await AccountVault.restoreIfNeeded()
            await membership.refresh()
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            switch phase {
            case .active:
                Task { await membership.refresh() }
                if lastPhase == .background {
                    GalleryReview.noteLaunch()
                    // Never over the paywall or the launch film.
                    if membership.unlocked, launchFinished, GalleryReview.due() { review = true }
                }
                LibraryEngine.shared.resume()
            case .background:
                LibraryEngine.shared.stayAwake()
                LibraryEngine.shared.prepareForBackground()
                if LibraryEngine.shared.stillCopying() {
                    SyncScheduler.scheduleSoon()
                } else {
                    // Nothing left now; a longer run later picks up new photos.
                    SyncScheduler.schedule()
                }
                SyncScheduler.scheduleRefresh()
            default:
                LibraryEngine.shared.stayAwake()
            }
            lastPhase = phase
        }
    }
}

private struct PhoneRoot: View {
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            Tab(L("Biblioteka"), systemImage: "photo.on.rectangle.angled", value: 0) {
                NavigationStack {
                    LibraryScreen()
                }
            }
            Tab(L("Kolekcje"), systemImage: "square.grid.2x2", value: 1) {
                NavigationStack {
                    CollectionsScreen()
                        .syncControl()
                }
            }
            Tab(L("Szukaj"), systemImage: "magnifyingglass", value: 2) {
                SearchScreen(showsClose: false)
            }
            Tab(L("Znajomi"), systemImage: "person.2", value: 3) {
                NavigationStack {
                    FriendsScreen()
                        .syncControl()
                }
            }
        }
        .modifier(KeepTabBarVisible())
    }
}

private struct KeepTabBarVisible: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.tabBarMinimizeBehavior(.never)
        } else {
            content
        }
    }
}

private struct PadRoot: View {
    @EnvironmentObject private var library: PhotoLibrary
    @State private var selection: SideItem? = .library
    @State private var renaming: AlbumRecord?
    @State private var deleting: AlbumRecord?
    @State private var draft = ""

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Label(L("Biblioteka"), systemImage: "photo.on.rectangle")
                    .tag(SideItem.library)
                Label(L("Kolekcje"), systemImage: "square.grid.2x2")
                    .tag(SideItem.collections)
                Label(L("Szukaj"), systemImage: "magnifyingglass")
                    .tag(SideItem.search)
                Label(L("Mapa"), systemImage: "map")
                    .tag(SideItem.map)
                Label(L("Osoby"), systemImage: "person.2.crop.square.stack")
                    .tag(SideItem.people)
                Label(L("Porządki"), systemImage: "sparkles.rectangle.stack")
                    .tag(SideItem.cleanup)
                Label(L("Znajomi"), systemImage: "person.2")
                    .tag(SideItem.friends)
                Section(L("Albumy")) {
                    // Empty smart albums (Panoramy, Zrzuty… with nothing in them) only cluttered the sidebar.
                    ForEach(library.albums.filter { !$0.system || $0.count > 0 || $0.id == "galleryos.hidden" }) { album in
                        Label(album.title, systemImage: album.id == "galleryos.hidden" ? "lock.fill" : (AlbumActions.isServer(album.id) ? "externaldrive" : "rectangle.stack"))
                            .badge(album.count)
                            .tag(SideItem.album(album.id))
                            .contextMenu {
                                if AlbumActions.editable(album) {
                                    Button(L("Zmień nazwę"), systemImage: "pencil") {
                                        draft = album.title
                                        renaming = album
                                    }
                                    Button(L("Usuń album"), systemImage: "trash", role: .destructive) {
                                        deleting = album
                                    }
                                }
                            }
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
            if selection == .search {
                // Search brings its own navigation stack.
                SearchScreen(showsClose: false)
            } else if selection == .map {
                LibraryMapScreen(embedded: true)
            } else {
                NavigationStack {
                    switch selection ?? .library {
                    case .library:
                        LibraryScreen()
                    case .collections:
                        CollectionsScreen()
                            .syncControl()
                    case .search, .map:
                        EmptyView()
                    case .people:
                        PeopleScreen()
                            .peopleDestinations()
                            .syncControl()
                    case .cleanup:
                        CleanupScreen()
                            .cleanupDestinations()
                            .syncControl()
                    case .friends:
                        FriendsScreen()
                            .syncControl()
                    case .album(let id):
                        if id == "galleryos.hidden" {
                            HiddenLibrary()
                        } else {
                            LibraryScreen(albumID: id)
                        }
                    }
                }
                // A fresh screen per sidebar item: selection and scroll must not carry over to another album.
                .id(selection)
            }
        }
        .alert(L("Zmień nazwę albumu"), isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField(L("Nazwa"), text: $draft)
            Button(L("Zachowaj")) {
                guard let album = renaming else { return }
                let title = draft
                Task {
                    if await AlbumActions.rename(album.id, title) {
                        if selection == .album(album.id), AlbumActions.isServer(album.id) {
                            selection = .album(AlbumActions.serverPrefix + title.trimmingCharacters(in: .whitespacesAndNewlines))
                        }
                        library.reloadNow()
                    }
                }
            }
            Button(L("Anuluj"), role: .cancel) {}
        }
        .confirmationDialog(
            L("Usunąć album „\(deleting?.title ?? "")”?"),
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible
        ) {
            Button(L("Usuń album"), role: .destructive) {
                guard let album = deleting else { return }
                deleting = nil
                Task {
                    if await AlbumActions.delete(album.id) {
                        if selection == .album(album.id) { selection = .library }
                        library.reloadNow()
                    }
                }
            }
            Button(L("Anuluj"), role: .cancel) { deleting = nil }
        } message: {
            Text(L("Znika tylko album. Zdjęcia zostają w bibliotece i na serwerze."))
        }
    }
}

private enum SideItem: Hashable {
    case library
    case collections
    case search
    case map
    case people
    case cleanup
    case friends
    case album(String)
}

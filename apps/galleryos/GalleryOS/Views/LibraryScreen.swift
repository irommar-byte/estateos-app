import CoreLocation
import Photos
import SwiftUI
import UIKit

struct LibraryScreen: View {
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    @Environment(\.launchFinished) private var launchFinished
    @ObservedObject private var account = ShareAccount.shared
    @State private var showChoices = false
    var albumID: String?
    /// Photos behind a map pin. The same grid, selection and actions as an album.
    var placeIDs: [String]? = nil
    var placeTitle: String? = nil
    @AppStorage("galleryos.zoom") private var zoomRaw = PhotoZoom.days.rawValue
    @AppStorage("galleryos.density") private var density = 3.0
    @AppStorage("galleryos.shelf") private var shelf = "phone"
    @State private var sortToken = ""
    @State private var anchor: GridAnchor?
    @State private var selecting = false
    @State private var selection = Set<String>()
    @State private var viewer: ViewerRequest?
    @State private var showSearch = false
    @State private var showPlace = false
    @State private var showGuide = false
    @State private var showSummary = false
    @State private var confirmDelete = false
    @State private var showShare = false
    @State private var showSync = false
    @State private var showAppleTV = false
    @State private var showMap = false
    @State private var mapFocus: CLLocationCoordinate2D?
    @State private var caption = ""
    @State private var confirmRemoveSynced = false
    @State private var removeResult = ""
    @State private var pendingDelete: String?
    @State private var purging: PurgeRequest?
    @State private var sending: SendBatch?
    @State private var deviceFilter: DeviceFilter = .all
    @State private var serverFilter: ServerFilter = .all
    @State private var newAlbum = false
    @State private var albumDraft = ""
    @State private var albumNote = ""
    @State private var confirmRemoveAlbum = false
    @State private var renamingAlbum = false
    @AppStorage("galleryos.vault.explained") private var vaultExplained = false
    @State private var explainVault = false
    @Environment(\.horizontalSizeClass) private var sizeClass

    /// The Library tab itself. Albums and map places reuse this screen without the global tools.
    private var isRoot: Bool { albumID == nil && placeIDs == nil }
    /// Recently Deleted on the server: restore, or delete for good.
    private var inTrash: Bool { albumID == "galleryos.trash" }
    private var showsShelf: Bool { isRoot }

    /// Your own album, on this device or in the server library: it can be renamed, emptied, removed.
    private var userAlbum: AlbumRecord? {
        guard let albumID, let album = library.album(id: albumID), AlbumActions.editable(album) else { return nil }
        return album
    }

    private var counts: MediaCounts {
        if showsShelf { return shelf == "server" ? library.serverCounts : library.phoneCounts }
        return MediaCounts(model.all)
    }
    private var model: GridModel {
        if let placeIDs { return library.grid(placeIDs: placeIDs) }
        guard showsShelf else { return library.grid(albumID: albumID) }
        return shelf == "server" ? library.serverGrid : library.phoneGrid
    }
    private var loadingLibrary: Bool { library.isLoading && model.all.isEmpty }

    private var stage: some View {
        ZStack {
            if library.authorization == .authorized || library.authorization == .limited {
                if loadingLibrary {
                    LibraryLoadingView()
                        .transition(.asymmetric(insertion: .opacity, removal: .opacity.combined(with: .scale(scale: 1.06))))
                } else if model.all.isEmpty {
                    emptyLibrary
                } else {
                    // The library opens out of the loading mosaic: a soft rise and unblur.
                    grid
                        .transition(.asymmetric(insertion: .opacity.combined(with: .scale(scale: 0.97)), removal: .opacity))
                }
            } else if library.authorization == .denied || library.authorization == .restricted {
                denied
            } else {
                welcome
            }
        }
        // Fill the screen: a small centred stage pulled the shelf picker into the middle.
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .animation(.spring(response: 0.7, dampingFraction: 0.9), value: loadingLibrary)
        .animation(.easeOut(duration: 0.5), value: model.all.isEmpty)
    }

    private var zoom: PhotoZoom { PhotoZoom(rawValue: zoomRaw) ?? .days }

    var body: some View {
        dialogs(covers)
    }

    private var covers: some View {
        stage
        .navigationTitle(title.isEmpty ? L("Biblioteka") : title)
        .galleryNavigationSubtitle(selecting ? "" : caption)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .top, spacing: 0) {
            if showsShelf, library.authorization == .authorized || library.authorization == .limited {
                VStack(spacing: 0) {
                    Picker(L("Biblioteka"), selection: $shelf) {
                        Text(shelfLabel(ThisDevice.name, library.phoneCounts)).tag("phone")
                        Text(shelfLabel(L("Serwer"), library.serverCounts)).tag("server")
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    if library.destinationConnected {
                        shelfFilters
                            .padding(.bottom, 8)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .background(.bar)
            }
        }
        .onChange(of: shelf) { _, new in
            UISelectionFeedbackGenerator().selectionChanged()
            selection.removeAll()
            selecting = false
            sortToken = UserDefaults.standard.string(forKey: sortKey) ?? LibrarySort.oldest.rawValue
            if new == "server" {
                let recent = library.serverGrid.all.suffix(80).map(\.id)
                LibraryEngine.shared.prioritizeThumbs(Array(recent))
            }
        }
        .toolbar { toolbar }
        .onAppear {
            if sortToken.isEmpty {
                sortToken = UserDefaults.standard.string(forKey: sortKey) ?? LibrarySort.oldest.rawValue
            }
        }
        .syncControl(hidden: !isRoot || selecting || !(library.authorization == .authorized || library.authorization == .limited))
        .toolbar(selecting ? .hidden : .automatic, for: .tabBar)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if selecting {
                selectionBar
                    .transition(.move(edge: .bottom).combined(with: .opacity).combined(with: .scale(scale: 0.9, anchor: .bottom)))
            }
        }
        .animation(GalleryTheme.snappy, value: selecting)
        .animation(GalleryTheme.snappy, value: account.needsPassword)
        .fullScreenCover(isPresented: $showMap) {
            LibraryMapScreen(focus: mapFocus)
                .environmentObject(library)
        }
        .fullScreenCover(item: $viewer) { request in
            PhotoViewerHost(request: request)
                .environmentObject(library)
                .presentationBackground(.clear)
        }
        .sheet(isPresented: $showSearch) {
            SearchScreen()
                .environmentObject(library)
        }
        .sheet(isPresented: $showSummary) {
            LibrarySummarySheet()
                .environmentObject(library)
        }
        .sheet(isPresented: $showPlace) {
            LibraryPlaceSheet()
                .environmentObject(library)
        }
        .fullScreenCover(isPresented: $showGuide, onDismiss: {
            if SyncChoices.shouldAsk { showChoices = true }
        }) {
            // Until setup is finished the guide greets and offers "later"; afterwards it is the menu tool.
            SetupGuideView(firstRun: !UserDefaults.standard.bool(forKey: SetupGuide.doneKey))
                .environmentObject(library)
        }
        .sheet(isPresented: $showChoices) {
            SyncChoicesSheet { showChoices = false }
        }
        .task(id: launchFinished) {
            // Only the Library tab greets, and only after the launch film:
            // opening an album or a map place must not reopen the guide.
            guard isRoot, launchFinished else { return }
            await AccountVault.restoreIfNeeded()
            if SetupGuide.needed {
                showGuide = true
            } else if SyncChoices.shouldAsk {
                showChoices = true
            }
        }
        .sheet(isPresented: $showSync) {
            SyncSettingsSheet()
        }
        .sheet(isPresented: $showAppleTV) {
            AppleTVPairingSheet()
        }
    }

    private func dialogs<V: View>(_ view: V) -> some View {
        view
        .confirmationDialog(L("Usunąć z \(ThisDevice.genitive) zdjęcia, które są już na serwerze?"), isPresented: $confirmRemoveSynced, titleVisibility: .visible) {
            Button(L("Usuń kopie z \(ThisDevice.genitive)"), role: .destructive) {
                Task { removeResult = await library.removeSyncedCopies() }
            }
            Button(L("Anuluj"), role: .cancel) {}
        } message: {
            Text(L("Najpierw sprawdzę oryginał na serwerze. Kasuję tylko potwierdzone. Na serwerze zostają, a z \(ThisDevice.genitive) trafiają do Ostatnio usuniętych na 30 dni."))
        }
        .alert(L("Zdjęcia"), isPresented: Binding(get: { !removeResult.isEmpty }, set: { if !$0 { removeResult = "" } })) {
            Button(L("Dobrze")) { removeResult = "" }
        } message: {
            Text(removeResult)
        }
        .sheet(isPresented: $showShare) {
            CloudAlbumComposer(ids: Array(selection))
                .environmentObject(library)
        }
        .alert(L("Nowy album"), isPresented: $newAlbum) {
            TextField(L("Nazwa"), text: $albumDraft)
            Button(L("Utwórz")) {
                let title = albumDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                let ids = Array(selection)
                guard !title.isEmpty else { return }
                Task {
                    if await AlbumLibrary.create(title, adding: ids) == nil {
                        albumNote = L("Nie udało się utworzyć albumu.")
                    } else {
                        selection.removeAll()
                        selecting = false
                        library.reloadNow()
                    }
                }
            }
            Button(L("Anuluj"), role: .cancel) {}
        }
        .alert(L("Album"), isPresented: Binding(get: { !albumNote.isEmpty }, set: { if !$0 { albumNote = "" } })) {
            Button(L("Dobrze")) { albumNote = "" }
        } message: {
            Text(albumNote)
        }
        .sheet(isPresented: $explainVault, onDismiss: { vaultExplained = true }) {
            VaultExplainer { explainVault = false }
                .presentationDetents([.medium, .large])
        }
        .alert(L("Zmień nazwę albumu"), isPresented: $renamingAlbum) {
            TextField(L("Nazwa"), text: $albumDraft)
            Button(L("Zachowaj")) {
                guard let id = userAlbum?.id else { return }
                let title = albumDraft
                Task {
                    if await AlbumActions.rename(id, title) {
                        library.reloadNow()
                        // A server album is named by its title: the old screen would be empty.
                        if AlbumActions.isServer(id) { dismiss() }
                    } else {
                        albumNote = L("Nie udało się zmienić nazwy.")
                    }
                }
            }
            Button(L("Anuluj"), role: .cancel) {}
        }
        .confirmationDialog(L("Usunąć ten album?"), isPresented: $confirmRemoveAlbum, titleVisibility: .visible) {
            Button(L("Usuń album"), role: .destructive) {
                guard let id = userAlbum?.id else { return }
                Task {
                    if await AlbumActions.delete(id) {
                        library.reloadNow()
                        dismiss()
                    } else {
                        albumNote = L("Nie udało się usunąć albumu.")
                    }
                }
            }
            Button(L("Anuluj"), role: .cancel) {}
        } message: {
            Text(L("Znika tylko album. Zdjęcia zostają w bibliotece i na serwerze."))
        }
        .confirmationDialog(deleteTitle(Array(selection)), isPresented: $confirmDelete, titleVisibility: .visible) {
            deleteButtons(Array(selection)) {
                selection.removeAll()
                selecting = false
            }
            Button(L("Anuluj"), role: .cancel) {}
        } message: {
            Text(deleteMessage(Array(selection)))
        }
        .confirmationDialog(
            deleteTitle(pendingDelete.map { [$0] } ?? []),
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible
        ) {
            deleteButtons(pendingDelete.map { [$0] } ?? []) { pendingDelete = nil }
            Button(L("Anuluj"), role: .cancel) { pendingDelete = nil }
        } message: {
            Text(deleteMessage(pendingDelete.map { [$0] } ?? []))
        }
        .sheet(item: $sending) { batch in
            SendReportSheet(batch: batch)
        }
        .onChange(of: deviceFilter) { _, _ in
            selection.removeAll()
        }
        .onChange(of: serverFilter) { _, _ in
            selection.removeAll()
        }
        .sheet(item: $purging) { request in
            PermanentDeleteSheet(request: request) {
                library.purge(ids: request.ids)
                selection.removeAll()
                selecting = false
            }
        }
        .task { library.prepare() }
        .safeAreaInset(edge: .top, spacing: 0) {
            if showsShelf, account.needsPassword {
                Button {
                    showPlace = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "key.fill")
                            .font(.footnote.weight(.bold))
                            .foregroundStyle(.white)
                            .frame(width: 24, height: 24)
                            .background(Color.orange.gradient, in: Circle())
                            .symbolEffect(.wiggle, options: .nonRepeating)
                        Text(L("Serwer jest zapisany. Stuknij i wpisz hasło."))
                            .font(.footnote.weight(.semibold))
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .background(.bar)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    private var title: String {
        if selecting { return selection.isEmpty ? L("Wybierz") : L("Wybrano \(selection.count)") }
        if placeIDs != nil { return placeTitle ?? L("Miejsce") }
        if let albumID, let album = library.album(id: albumID) { return album.title }
        return ""
    }

    @ViewBuilder
    private var grid: some View {
        VStack(spacing: 0) {
            if library.authorization == .limited {
                limitedBanner
            }
            if showsShelf {
                GeometryReader { proxy in
                    HStack(spacing: 0) {
                        gridBody(library.phoneShelf(deviceFilter), active: shelf != "server", sort: sort(for: "galleryos.sort.phone"))
                            .overlay { filteredEmpty(phone: true) }
                            .frame(width: proxy.size.width)
                        gridBody(library.serverShelf(serverFilter), active: shelf == "server", sort: sort(for: "galleryos.sort.server"))
                            .overlay { filteredEmpty(phone: false) }
                            .frame(width: proxy.size.width)
                    }
                    .offset(x: shelf == "server" ? -proxy.size.width : 0)
                    .animation(GalleryTheme.page, value: shelf)
                }
                .clipped()
            } else {
                gridBody(model, active: true, sort: sort(for: sortKey))
            }
        }
    }

    private func gridBody(_ base: GridModel, active: Bool, sort: LibrarySort) -> some View {
        let source = base.arranged(sort)
        return PhotoGrid(
            model: source,
            generation: library.generation,
            zoom: zoom,
            selection: selection,
            selecting: selecting,
            placeNames: library.placeNames,
            density: CGFloat(density),
            synced: { library.isUploaded($0) },
            syncMarkFor: { library.syncMark(for: $0) },
            showsSync: library.destinationConnected,
            anchor: anchor,
            asset: { library.asset(id: $0) },
            thumb: { library.thumbnail(id: $0) },
            loadThumb: { await LibraryEngine.shared.cloudThumb(id: $0) },
            onOpen: { open($0, in: source) },
            onSelect: toggle,
            onFavorite: favorite,
            onConceal: { conceal($0) },
            onSendNow: { library.sendNow($0) },
            concealedAlbum: albumID == "galleryos.hidden",
            onSelectionSet: { selection = $0 },
            onDelete: { id in
                if inTrash {
                    purging = library.purgeRequest([id])
                } else {
                    pendingDelete = id
                }
            },
            onZoom: changeZoom,
            onDensity: { density = Double($0) },
            onCaption: { text in if active { caption = text } },
            onPlace: { coordinate in
                // Inside a map place the map is already one step back.
                guard placeIDs == nil else { return }
                mapFocus = coordinate
                showMap = true
            },
            onVisiblePlaces: { library.resolvePlaces($0) },
            startsAtTop: sort != .oldest,
            sharp: { id, side in await library.sharpPreview(id: id, side: side) }
        )
        .id(sort)
    }

    private var limitedBanner: some View {
        Button {
            guard let controller = UIApplication.shared.galleryTopController() else { return }
            library.presentLimitedPicker(from: controller)
        } label: {
            Text(L("Wybrano część zdjęć. Zarządzaj dostępem."))
                .font(.footnote)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .background(.bar)
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        if library.authorization == .authorized || library.authorization == .limited {
            if !model.all.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    // A compact symbol instead of the word, so the bar keeps room for the title
                    // that slides up while scrolling.
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        withAnimation(GalleryTheme.snappy) {
                            selecting.toggle()
                            if !selecting { selection.removeAll() }
                        }
                    } label: {
                        Image(systemName: selecting ? "checkmark.circle.fill" : "checkmark.circle")
                            .symbolRenderingMode(.hierarchical)
                            .contentTransition(.symbolEffect(.replace))
                    }
                    .accessibilityLabel(selecting ? L("Gotowe") : L("Wybierz"))
                }
                if !selecting {
                    ToolbarItem(placement: .topBarTrailing) {
                        sortMenu
                    }
                }
            }
            if !selecting {
                // Widok sits on the bar itself: zoom level, what is counted, screenshots on or off.
                ToolbarItem(placement: .topBarTrailing) {
                    viewMenu
                }
                if hasMoreMenu {
                    ToolbarItem(placement: .topBarLeading) {
                        moreMenu
                    }
                }
            }
        }
    }

    /// Search and Map have their own place in the iPad sidebar; on iPhone they stay one tap away here.
    /// Server, Apple TV and library state all live in the sync panel (the pill), not in this menu.
    private var hasMoreMenu: Bool {
        (isRoot && sizeClass == .compact) || userAlbum != nil || isRoot
    }

    private var moreMenu: some View {
        Menu {
            if isRoot, sizeClass == .compact {
                Button(L("Szukaj"), systemImage: "magnifyingglass") { showSearch = true }
                Button(L("Mapa"), systemImage: "map") {
                    mapFocus = nil
                    showMap = true
                }
            }
            if let album = userAlbum {
                Section(album.title) {
                    Button(L("Zmień nazwę"), systemImage: "pencil") {
                        albumDraft = album.title
                        renamingAlbum = true
                    }
                    Button(L("Usuń album"), systemImage: "trash", role: .destructive) { confirmRemoveAlbum = true }
                }
            }
            if isRoot {
                Section {
                    Button(L("Usuń zsynchronizowane z \(ThisDevice.genitive)"), systemImage: ThisDevice.slashSymbol, role: .destructive) { confirmRemoveSynced = true }
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .accessibilityLabel(L("Więcej"))
    }

    private var viewMenu: some View {
        Menu {
            Section(counts.line) {
                Picker(selection: Binding(
                    get: { zoom },
                    set: { item in
                        zoomRaw = item.rawValue
                        anchor = nil
                    }
                )) {
                    ForEach(PhotoZoom.allCases) { item in
                        Text(item.title).tag(item)
                    }
                } label: {
                    Label(L("Widok"), systemImage: "rectangle.grid.2x2")
                }
                .pickerStyle(.inline)
            }
            Section {
                Toggle(isOn: Binding(
                    get: { !library.hideScreenshots },
                    set: { library.hideScreenshots = !$0 }
                )) {
                    Label(L("Zrzuty ekranu"), systemImage: "camera.viewfinder")
                }
            } footer: {
                Text(L("Wyłączone chowa zrzuty w Bibliotece i Kolekcjach. Zostają w albumie Zrzuty ekranu."))
            }
        } label: {
            Image(systemName: library.hideScreenshots ? "rectangle.grid.2x2.fill" : "rectangle.grid.2x2")
        }
        .accessibilityLabel(L("Widok"))
    }

    private func shelfLabel(_ name: String, _ counts: MediaCounts) -> String {
        counts.total > 0 ? "\(name) · \(PhotoFormat.grouped(counts.total))" : name
    }

    private var sortKey: String {
        if placeIDs != nil { return "galleryos.sort.place" }
        if let albumID { return "galleryos.sort.album.\(albumID)" }
        return "galleryos.sort.\(shelf)"
    }

    private func sort(for key: String) -> LibrarySort {
        _ = sortToken
        let raw = UserDefaults.standard.string(forKey: key) ?? LibrarySort.oldest.rawValue
        return LibrarySort(rawValue: raw) ?? .oldest
    }

    private var sortMenu: some View {
        Menu {
            Picker(L("Kolejność"), selection: Binding(
                get: { sort(for: sortKey) },
                set: { value in
                    UserDefaults.standard.set(value.rawValue, forKey: sortKey)
                    sortToken = sortKey + ":" + value.rawValue
                    anchor = nil
                }
            )) {
                ForEach(LibrarySort.allCases) { item in
                    Text(item.title).tag(item)
                }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
        }
        .accessibilityLabel(L("Sortowanie"))
    }

    private var selectionBar: some View {
        HStack {
            if inTrash {
                trashActions
            } else {
                regularActions
            }
        }
        .font(.system(size: 20, weight: .semibold))
        .symbolEffect(.bounce, value: selection.isEmpty)
        .animation(GalleryTheme.snappy, value: selection.isEmpty)
        .padding(.horizontal, 30)
        .padding(.vertical, 15)
        .galleryGlass(in: Capsule(), interactive: true)
        .padding(.horizontal, 22)
        .padding(.bottom, 6)
    }

    /// Recently Deleted, as in Photos: bring back, or delete for good. With nothing selected
    /// both act on everything in the album.
    @ViewBuilder
    private var trashActions: some View {
        Button {
            restoreSelection()
        } label: {
            Label(selection.isEmpty ? L("Przywróć wszystkie") : L("Przywróć"), systemImage: "arrow.uturn.backward")
                .labelStyle(.titleAndIcon)
        }
        .font(.system(size: 16, weight: .semibold))
        Spacer()
        Button(role: .destructive) {
            let ids = selection.isEmpty ? library.trashedIDs : Array(selection)
            guard !ids.isEmpty else { return }
            purging = library.purgeRequest(ids)
        } label: {
            Label(selection.isEmpty ? L("Usuń wszystkie") : L("Usuń"), systemImage: "trash")
                .labelStyle(.titleAndIcon)
        }
        .font(.system(size: 16, weight: .semibold))
        .foregroundStyle(.red)
    }

    @ViewBuilder
    private var regularActions: some View {
        Menu {
            Button(L("Wyślij…"), systemImage: "square.and.arrow.up") { shareSelection() }
            Button(L("Album dla znajomych"), systemImage: "person.2") { showShare = true }
        } label: {
            Image(systemName: "square.and.arrow.up")
        }
        .disabled(selection.isEmpty)
        .accessibilityLabel(L("Udostępnij"))
        Spacer()
        Button { favoriteSelection() } label: { Image(systemName: "heart") }
            .disabled(selection.isEmpty)
        Spacer()
        if library.destinationConnected, selection.isEmpty || selection.contains(where: { !$0.hasPrefix("cloud:") }) {
            Button {
                UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                sending = library.sendBatch(Array(selection))
                selection.removeAll()
                selecting = false
            } label: {
                Image(systemName: deviceFilter == .deletedOnServer && shelf != "server" ? "arrow.uturn.up.circle" : "icloud.and.arrow.up")
            }
            .disabled(selection.isEmpty)
            .accessibilityLabel(deviceFilter == .deletedOnServer ? L("Przywróć na serwer") : L("Wyślij na serwer"))
            Spacer()
        }
        Button { concealSelection() } label: {
            Image(systemName: albumID == "galleryos.hidden" ? "eye" : "eye.slash")
        }
        .disabled(selection.isEmpty)
        .accessibilityLabel(albumID == "galleryos.hidden" ? L("Pokaż w bibliotece") : L("Ukryj"))
        Spacer()
        Menu {
            let targets = library.albums.filter { AlbumActions.editable($0) && $0.id != albumID }
            if userAlbum != nil, !targets.isEmpty {
                Menu(L("Przenieś do…"), systemImage: "arrow.right.square") {
                    ForEach(targets) { album in
                        Button(album.title) { moveSelection(to: album.id) }
                    }
                }
            }
            Section(userAlbum != nil ? L("Dodaj też do") : L("Dodaj do albumu")) {
                ForEach(targets) { album in
                    Button(album.title, systemImage: AlbumActions.isServer(album.id) ? "externaldrive" : "rectangle.stack") {
                        addSelection(to: album.id)
                    }
                }
            }
            Button(L("Nowy album"), systemImage: "plus") {
                albumDraft = ""
                newAlbum = true
            }
        } label: {
            Image(systemName: "rectangle.stack.badge.plus")
        }
        .disabled(selection.isEmpty)
        .accessibilityLabel(L("Dodaj do albumu"))
        if userAlbum != nil {
            Spacer()
            Button { removeSelectionFromAlbum() } label: { Image(systemName: "rectangle.stack.badge.minus") }
                .disabled(selection.isEmpty)
                .accessibilityLabel(L("Usuń z albumu"))
        }
        Spacer()
        Button(role: .destructive) { confirmDelete = true } label: { Image(systemName: "trash") }
            .disabled(selection.isEmpty)
    }

    /// Where the photos stand, one tap away, with how many there are of each.
    @ViewBuilder
    private var shelfFilters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if shelf == "server" {
                    ShelfChip(symbol: "square.grid.2x2", title: L("Wszystkie"), count: library.serverGrid.all.count, tint: .accentColor, selected: serverFilter == .all) { serverFilter = .all }
                    ShelfChip(symbol: "person.crop.circle", title: L("Moje"), count: library.serverSplit.mine, tint: .blue, selected: serverFilter == .mine) { serverFilter = .mine }
                    ShelfChip(symbol: "person.2", title: L("Od innych"), count: library.serverSplit.others, tint: .purple, selected: serverFilter == .others) { serverFilter = .others }
                    ShelfChip(symbol: ThisDevice.slashSymbol, title: L("Nie ma na \(ThisDevice.locative)"), count: library.serverSplit.notHere, tint: .orange, selected: serverFilter == .notHere) { serverFilter = .notHere }
                } else {
                    let split = library.deviceSplit
                    ShelfChip(symbol: "square.grid.2x2", title: L("Wszystkie"), count: library.phoneGrid.all.count, tint: .accentColor, selected: deviceFilter == .all) { deviceFilter = .all }
                    ShelfChip(symbol: "checkmark.icloud.fill", title: L("Na serwerze"), count: split.onServer, tint: .green, selected: deviceFilter == .onServer) { deviceFilter = .onServer }
                    ShelfChip(symbol: "icloud.and.arrow.up", title: L("Czeka"), count: split.waiting, tint: .blue, selected: deviceFilter == .waiting) { deviceFilter = .waiting }
                    ShelfChip(symbol: "exclamationmark.icloud.fill", title: L("Nie wysłane"), count: split.notSent, tint: .orange, selected: deviceFilter == .notSent) { deviceFilter = .notSent }
                    if split.deletedOnServer > 0 || deviceFilter == .deletedOnServer {
                        ShelfChip(symbol: "xmark.icloud.fill", title: L("Usunięte z serwera"), count: split.deletedOnServer, tint: .red, selected: deviceFilter == .deletedOnServer) { deviceFilter = .deletedOnServer }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
        .scrollClipDisabled()
    }

    /// A filter with nothing in it says why, instead of showing an empty grid.
    @ViewBuilder
    private func filteredEmpty(phone: Bool) -> some View {
        let empty = phone
            ? deviceFilter != .all && library.phoneShelf(deviceFilter).all.isEmpty
            : serverFilter != .all && library.serverShelf(serverFilter).all.isEmpty
        if empty {
            ContentUnavailableView(
                L("Nic tutaj"),
                systemImage: phone ? "checkmark.circle" : "photo.on.rectangle",
                description: Text(phone ? deviceEmptyNote : L("Żadne zdjęcie na serwerze nie pasuje do tego filtra."))
            )
            .transition(.opacity)
        }
    }

    private var deviceEmptyNote: String {
        switch deviceFilter {
        case .all, .onServer: return L("Żadne zdjęcie z tego urządzenia nie jest jeszcze na serwerze.")
        case .waiting: return L("Nic nie czeka. Kolejka jest pusta.")
        case .notSent: return L("Wszystko, co miało pójść na serwer, poszło.")
        case .deletedOnServer: return L("Żadne zdjęcie z tego urządzenia nie zostało usunięte z serwera.")
        }
    }

    private var welcome: some View {
        VStack(spacing: 18) {
            BrandWordmark(size: .largeTitle)
            Text(L("Zdjęcia i filmy z tego \(ThisDevice.genitive), w układzie jak w aplikacji Zdjęcia."))
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button(L("Kontynuuj")) { library.requestAccess() }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
        }
        .padding(32)
    }

    private var denied: some View {
        VStack(spacing: 14) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.system(size: 42))
                .foregroundStyle(.secondary)
            Text(L("GalleryOS potrzebuje dostępu do zdjęć, żeby pokazać bibliotekę."))
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button(L("Otwórz Ustawienia")) {
                guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                UIApplication.shared.open(url)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(32)
    }

    @ViewBuilder
    private var emptyLibrary: some View {
        if placeIDs != nil {
            ContentUnavailableView(
                L("Brak zdjęć"),
                systemImage: "mappin.slash",
                description: Text(L("Zdjęcia z tego miejsca zostały usunięte albo ukryte."))
            )
        } else if albumID == "galleryos.hidden" {
            ContentUnavailableView(
                L("Nic nie jest ukryte"),
                systemImage: "eye.slash",
                description: Text(L("Zaznacz zdjęcia w bibliotece i stuknij oko, żeby je tu schować."))
            )
        } else if albumID != nil {
            ContentUnavailableView(
                L("Pusty album"),
                systemImage: "rectangle.stack",
                description: Text(L("W bibliotece stuknij Wybierz, zaznacz zdjęcia i dodaj je do albumu."))
            )
        } else if showsShelf && shelf == "server" {
            ContentUnavailableView(
                L("Serwer jest pusty"),
                systemImage: "externaldrive",
                description: Text(L("Tu zostają kopie wysłane na serwer, także po skasowaniu ich z \(ThisDevice.genitive)."))
            )
        } else {
            ContentUnavailableView(
                L("Brak zdjęć na \(ThisDevice.locative)"),
                systemImage: ThisDevice.symbol,
                description: Text(L("Tu jest to, co jest w Rolce i czeka na wysłanie albo już zostało wysłane."))
            )
        }
    }

    private func open(_ request: OpenRequest, in source: GridModel) {
        let ids = source.all.map(\.id)
        let index = ids.firstIndex(of: request.id) ?? 0
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            viewer = ViewerRequest(ids: ids, index: index, origin: request.frame, image: request.image, source: request.source)
        }
    }

    private func toggle(_ id: String) {
        UISelectionFeedbackGenerator().selectionChanged()
        if selection.contains(id) {
            selection.remove(id)
        } else {
            selection.insert(id)
        }
    }

    private func favorite(_ id: String) {
        let current = library.photo(id: id)?.isFavorite ?? false
        UIImpactFeedbackGenerator(style: current ? .light : .medium).impactOccurred()
        library.setFavorite(!current, ids: [id])
    }

    private func conceal(_ id: String) {
        let restore = albumID == "galleryos.hidden"
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        library.setConcealed(!restore, ids: [id])
        if !restore, !vaultExplained { explainVault = true }
    }

    private func concealSelection() {
        let restore = albumID == "galleryos.hidden"
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        library.setConcealed(!restore, ids: Array(selection))
        selection.removeAll()
        selecting = false
        if !restore, !vaultExplained { explainVault = true }
    }

    /// Server copies only ("cloud:" ids, the Serwer shelf): they go to Recently Deleted on the server.
    private func serverOnly(_ ids: [String]) -> Bool {
        !ids.isEmpty && ids.allSatisfy { $0.hasPrefix("cloud:") }
    }

    /// Photos on this device that also have a copy on the server: they can go from here only, or everywhere.
    private func alsoOnServer(_ ids: [String]) -> Bool {
        ids.contains { !$0.hasPrefix("cloud:") && library.isUploaded($0) }
    }

    private func deleteTitle(_ ids: [String]) -> String {
        if serverOnly(ids) { return L("Usunąć z serwera?") }
        return L("Usunąć z \(ThisDevice.genitive)?")
    }

    @ViewBuilder
    private func deleteButtons(_ ids: [String], done: @escaping () -> Void) -> some View {
        if serverOnly(ids) {
            Button(L("Usuń z serwera"), role: .destructive) {
                Task {
                    if await library.delete(ids: ids) { done() }
                }
            }
        } else {
            Button(L("Usuń z \(ThisDevice.genitive)"), role: .destructive) {
                Task {
                    if await library.delete(ids: ids) { done() }
                }
            }
            if alsoOnServer(ids) {
                Button(L("Usuń wszędzie"), role: .destructive) {
                    Task {
                        if await library.deleteEverywhere(ids: ids) { done() }
                    }
                }
            }
        }
    }

    private func deleteMessage(_ ids: [String]) -> String {
        if serverOnly(ids) {
            return L("Znikną z biblioteki GalleryOS na wszystkich urządzeniach. Będą w Ostatnio usuniętych na serwerze, skąd można je przywrócić.")
        }
        if alsoOnServer(ids) {
            return L("„Usuń z \(ThisDevice.genitive)” zostawia kopię na serwerze. „Usuń wszędzie” przenosi ją też do Ostatnio usuniętych na serwerze.")
        }
        return L("Kopie, które są już na serwerze, zostają w zakładce Serwer. Z \(ThisDevice.genitive) trafiają do Ostatnio usuniętych na 30 dni.")
    }

    private func restoreSelection() {
        let ids = selection.isEmpty ? library.trashedIDs : Array(selection)
        guard !ids.isEmpty else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        library.restoreFromTrash(ids: ids)
        selection.removeAll()
        selecting = false
    }

    private func favoriteSelection() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        library.setFavorite(true, ids: Array(selection))
    }

    private func addSelection(to albumID: String) {
        let ids = Array(selection)
        Task {
            if await AlbumActions.add(ids, to: albumID) {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                selection.removeAll()
                selecting = false
                library.reloadNow()
            } else {
                albumNote = AlbumActions.isServer(albumID)
                    ? L("Do albumu na serwerze trafiają tylko zdjęcia, które już są na serwerze.")
                    : L("Nie udało się dodać do albumu. Zdjęcia tylko z serwera zostają poza albumami \(ThisDevice.genitive).")
            }
        }
    }

    /// Add to the other album, then take out of this one.
    private func moveSelection(to target: String) {
        guard let albumID else { return }
        let ids = Array(selection)
        Task {
            guard await AlbumActions.add(ids, to: target) else {
                albumNote = L("Nie udało się przenieść. Album docelowy nie przyjął tych zdjęć.")
                return
            }
            _ = await AlbumActions.remove(ids, from: albumID)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            selection.removeAll()
            selecting = false
            library.reloadNow()
        }
    }

    private func removeSelectionFromAlbum() {
        guard let albumID else { return }
        let ids = Array(selection)
        Task {
            if await AlbumActions.remove(ids, from: albumID) {
                selection.removeAll()
                selecting = false
                library.reloadNow()
            } else {
                albumNote = L("Nie udało się usunąć z albumu.")
            }
        }
    }

    private func shareSelection() {
        guard let presenter = UIApplication.shared.galleryTopController() else { return }
        PhotoSharing.present(ids: Array(selection), asset: { library.asset(id: $0) }, from: presenter)
    }

    private func changeZoom(_ next: PhotoZoom, hint: GridAnchor?) {
        zoomRaw = next.rawValue
        anchor = translated(next, hint: hint)
    }

    private func translated(_ zoom: PhotoZoom, hint: GridAnchor?) -> GridAnchor? {
        guard let hint else { return nil }
        if zoom == .days || zoom == .all { return hint }
        guard let photo = model.all.first(where: { $0.id == hint.id }) else { return hint }
        let calendar = Calendar.current
        if zoom == .years {
            return GridAnchor(id: String(calendar.component(.year, from: photo.created)), atTop: false)
        }
        let parts = calendar.dateComponents([.year, .month], from: photo.created)
        return GridAnchor(
            id: String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0),
            atTop: false
        )
    }
}

private struct LibrarySummarySheet: View {
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    @State private var freeSpace = L("Sprawdzam…")
    @State private var confirmRemove = false
    @State private var removeResult = ""

    var body: some View {
        let counts = library.syncCounts()
        NavigationStack {
            List {
                LabeledContent(L("Na serwerze"), value: "\(counts.sent)")
                LabeledContent(L("Czeka na wysłanie"), value: "\(counts.waiting)")
                LabeledContent(L("Wysłano"), value: ByteText.amount((UserDefaults.standard.object(forKey: "galleryos.bytes-sent") as? NSNumber)?.int64Value ?? 0))
                LabeledContent(L("Wolne miejsce"), value: freeSpace)
                NavigationLink(L("Ustawienia synchronizacji")) {
                    SyncSettingsForm()
                }
                Button(L("Usuń zsynchronizowane z \(ThisDevice.genitive)"), role: .destructive) {
                    confirmRemove = true
                }
            }
            .navigationTitle(L("Biblioteka"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("Zamknij")) { dismiss() }
                }
            }
            .confirmationDialog(L("Usunąć z \(ThisDevice.genitive) zdjęcia, które są już na serwerze?"), isPresented: $confirmRemove, titleVisibility: .visible) {
                Button(L("Usuń kopie z \(ThisDevice.genitive)"), role: .destructive) {
                    Task { removeResult = await library.removeSyncedCopies() }
                }
                Button(L("Anuluj"), role: .cancel) {}
            } message: {
                Text(L("Najpierw sprawdzę oryginał na serwerze. Kasuję tylko potwierdzone. Na serwerze zostają, a z \(ThisDevice.genitive) trafiają do Ostatnio usuniętych na 30 dni."))
            }
            .alert(L("Zdjęcia"), isPresented: Binding(get: { !removeResult.isEmpty }, set: { if !$0 { removeResult = "" } })) {
                Button(L("Dobrze")) { removeResult = "" }
            } message: {
                Text(removeResult)
            }
            .task { freeSpace = await library.freeSpaceText() }
        }
        .presentationDetents([.medium, .large])
    }
}

private struct SyncSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            SyncSettingsForm()
                .navigationTitle(L("Synchronizacja"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(L("Zamknij")) { dismiss() }
                    }
                }
        }
        .presentationDetents([.medium])
    }
}

private struct SyncSettingsForm: View {
    @AppStorage("galleryos.sync.enabled") private var uploads = true
    @AppStorage("galleryos.sync.wifiOnly") private var wifiOnly = false
    @AppStorage("galleryos.sync.chargingOnly") private var chargingOnly = false
    @AppStorage("galleryos.live-auto") private var liveAuto = true

    var body: some View {
        Form {
            Section {
                AppleTVShareToggle()
            } footer: {
                Text(L("Apple TV z tym samym Apple ID pokaże bibliotekę sam."))
            }
            Toggle(L("Kopia zapasowa"), isOn: $uploads)
                .tint(GalleryTheme.accent)
            Picker(L("Kiedy wysyłać"), selection: $wifiOnly) {
                Text(L("Automatycznie")).tag(false)
                Text(L("Tylko Wi-Fi")).tag(true)
            }
            .disabled(!uploads)
            Toggle(L("Tylko podczas ładowania"), isOn: $chargingOnly)
                .disabled(!uploads)
            Toggle(L("Live Photo"), isOn: $liveAuto)
            Text(L("Kopia zapasowa zapisuje nowe zdjęcia i filmy na serwerze GalleryOS. Wyłączona nie rusza po otwarciu aplikacji. Chmurka wysyła tylko wskazany plik."))
                .font(.footnote)
                .foregroundStyle(.secondary)
            Section {
                NavigationLink {
                    AppleTVForm()
                } label: {
                    Label(L("Połącz kodem"), systemImage: "appletv")
                }
            } footer: {
                Text(L("Pokaż bibliotekę z serwera na telewizorze."))
            }
        }
        .onChange(of: uploads) { _, enabled in
            withAnimation(GalleryTheme.spring) {
                LibraryEngine.shared.setUploadsEnabled(enabled)
            }
        }
        .onChange(of: wifiOnly) { _, _ in LibraryEngine.shared.kick() }
        .onChange(of: chargingOnly) { _, _ in LibraryEngine.shared.kick() }
    }
}



/// The library being laid out, as a piece of camera craft: a polished iris of seven blades opens
/// and closes slowly while it turns, light gathers in its opening, a ring of light sweeps around
/// it, photo frames drift up through a soft aurora in the colours of the launch film, and a glint
/// runs through the name. One clock drives it all, drawn off the main thread.
struct LibraryLoadingView: View {
    @State private var start = Date()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let palette: [Color] = [
        Color(red: 0.29, green: 0.56, blue: 1.0),
        Color(red: 0.42, green: 0.3, blue: 0.85),
        Color(red: 1.0, green: 0.62, blue: 0.28),
        Color(red: 0.95, green: 0.32, blue: 0.42),
        Color(red: 0.2, green: 0.75, blue: 0.62),
    ]

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let radius = min(size.width, size.height) * 0.17
            let centre = CGPoint(x: size.width / 2, y: size.height * 0.4)
            TimelineView(.animation(minimumInterval: 1 / 60, paused: reduceMotion)) { context in
                let t = reduceMotion ? 2.0 : context.date.timeIntervalSince(start)
                let appear = Self.easeOut(min(1, t / 1.1))
                ZStack {
                    Canvas(rendersAsynchronously: true) { canvas, area in
                        Self.aurora(canvas, size: area, t: t, appear: appear)
                        Self.frames(canvas, size: area, t: t, appear: appear)
                        Self.iris(canvas, centre: centre, radius: radius * CGFloat(0.82 + 0.18 * appear), t: t, appear: appear)
                    }
                    VStack(spacing: 16) {
                        BrandWordmark(size: .largeTitle)
                            .overlay {
                                GeometryReader { text in
                                    let sweep = (t * 0.45).truncatingRemainder(dividingBy: 1.6) / 1.6
                                    LinearGradient(colors: [.clear, .white.opacity(0.85), .clear], startPoint: .leading, endPoint: .trailing)
                                        .frame(width: 70)
                                        .offset(x: CGFloat(sweep) * (text.size.width + 140) - 70)
                                        .blendMode(.plusLighter)
                                }
                                .mask(BrandWordmark(size: .largeTitle))
                            }
                            .opacity(appear)
                            .offset(y: 10 * (1 - appear))
                        Self.hairline(t: t)
                            .frame(width: 120, height: 2)
                            .opacity(appear)
                        Text(L("Układam Twoją bibliotekę"))
                            .font(.footnote.weight(.medium))
                            .tracking(0.3)
                            .foregroundStyle(.white.opacity(0.55))
                            .opacity(Self.easeOut(min(1, max(0, (t - 0.4) / 0.8))))
                    }
                    .position(x: size.width / 2, y: centre.y + radius + 92)
                }
            }
        }
        .background(Color.black)
        .ignoresSafeArea(edges: .bottom)
        .environment(\.colorScheme, .dark)
        .onAppear { start = .now }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L("Wczytywanie biblioteki"))
    }

    // MARK: Drawing

    private static func easeOut(_ x: Double) -> Double { 1 - pow(1 - x, 3) }

    private static func easeInOut(_ x: Double) -> Double {
        x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2
    }

    /// Three slow pools of colour drifting on long curves.
    private static func aurora(_ canvas: GraphicsContext, size: CGSize, t: Double, appear: Double) {
        let spots: [(Color, Double, Double, Double)] = [
            (palette[0], 0.11, 0.0, 0.62),
            (palette[1], 0.08, 2.1, 0.55),
            (palette[2], 0.07, 4.2, 0.4),
            (palette[3], 0.09, 1.3, 0.35),
        ]
        for (index, spot) in spots.enumerated() {
            let (color, speed, offset, strength) = spot
            let x = size.width * CGFloat(0.5 + 0.38 * sin(t * speed + offset))
            let y = size.height * CGFloat(0.45 + 0.3 * cos(t * speed * 0.8 + offset * 1.7 + Double(index)))
            let r = max(size.width, size.height) * CGFloat(0.42 + 0.06 * sin(t * 0.3 + offset))
            canvas.fill(
                Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)),
                with: .radialGradient(Gradient(colors: [color.opacity(0.22 * strength * appear), color.opacity(0)]),
                                      center: CGPoint(x: x, y: y), startRadius: 0, endRadius: r)
            )
        }
    }

    /// Photo frames rising slowly at different depths: near ones larger, brighter and faster.
    private static func frames(_ canvas: GraphicsContext, size: CGSize, t: Double, appear: Double) {
        for index in 0..<16 {
            let seed = Double(index)
            let depth = 0.35 + 0.65 * (sin(seed * 12.9898) * 0.5 + 0.5)
            let lane = (sin(seed * 78.233) * 0.5 + 0.5)
            let rise = (seed * 0.137 + t * 0.028 * (0.5 + depth)).truncatingRemainder(dividingBy: 1)
            let side = CGFloat(22 + 38 * depth)
            let x = size.width * CGFloat(lane) + CGFloat(sin(t * 0.4 + seed) * 14)
            let y = size.height * CGFloat(1.1 - rise * 1.25)
            let fade = sin(rise * .pi)
            let alpha = (0.05 + 0.16 * depth) * fade * appear
            guard alpha > 0.005 else { continue }
            var tile = canvas
            tile.translateBy(x: x, y: y)
            tile.rotate(by: .radians(sin(t * 0.25 + seed) * 0.18))
            let rect = CGRect(x: -side / 2, y: -side * 0.4, width: side, height: side * 0.8)
            let shape = Path(roundedRect: rect, cornerRadius: side * 0.12)
            let tint = palette[index % palette.count]
            tile.fill(shape, with: .linearGradient(Gradient(colors: [tint.opacity(alpha * 1.4), tint.opacity(alpha * 0.4)]),
                                                   startPoint: CGPoint(x: rect.minX, y: rect.minY), endPoint: CGPoint(x: rect.maxX, y: rect.maxY)))
            tile.stroke(shape, with: .color(.white.opacity(alpha * 1.6)), lineWidth: 0.8)
        }
    }

    /// Seven polished blades around a breathing opening, a light core, and a sweeping ring.
    private static func iris(_ canvas: GraphicsContext, centre: CGPoint, radius: CGFloat, t: Double, appear: Double) {
        let blades = 7
        let breath = easeInOut((sin(t * 0.9) + 1) / 2)
        let opening = radius * CGFloat(0.22 + 0.2 * breath)
        let turn = t * 0.35 + breath * 0.6
        let twist = 1.05

        // Light gathering in the opening, slowly changing colour.
        let hue = (t * 0.12).truncatingRemainder(dividingBy: Double(palette.count))
        let first = palette[Int(hue) % palette.count]
        let second = palette[(Int(hue) + 1) % palette.count]
        let core = radius * 0.95
        canvas.fill(
            Path(ellipseIn: CGRect(x: centre.x - core, y: centre.y - core, width: core * 2, height: core * 2)),
            with: .radialGradient(Gradient(colors: [.white.opacity(0.95 * appear), first.opacity(0.9 * appear), second.opacity(0.5 * appear), .black]),
                                  center: centre, startRadius: 0, endRadius: core)
        )

        // The blades, each a facet of brushed graphite catching the light differently.
        var blades_ = canvas
        blades_.clip(to: Path(ellipseIn: CGRect(x: centre.x - radius, y: centre.y - radius, width: radius * 2, height: radius * 2)))
        for index in 0..<blades {
            let a = turn + Double(index) * 2 * .pi / Double(blades)
            let b = turn + Double(index + 1) * 2 * .pi / Double(blades)
            func point(_ angle: Double, _ r: CGFloat) -> CGPoint {
                CGPoint(x: centre.x + r * CGFloat(cos(angle)), y: centre.y + r * CGFloat(sin(angle)))
            }
            var blade = Path()
            blade.move(to: point(a, opening))
            blade.addLine(to: point(b, opening))
            blade.addLine(to: point(b + twist, radius * 1.6))
            blade.addLine(to: point(a + twist, radius * 1.6))
            blade.closeSubpath()
            let light = 0.16 + 0.14 * (sin(a * 1.0 + t * 0.6) * 0.5 + 0.5)
            blades_.fill(blade, with: .linearGradient(
                Gradient(colors: [Color(white: light + 0.12), Color(white: light * 0.45)]),
                startPoint: point(a, opening), endPoint: point(a + twist, radius)))
            var edge = Path()
            edge.move(to: point(a, opening))
            edge.addLine(to: point(a + twist, radius * 1.6))
            blades_.stroke(edge, with: .color(.white.opacity(0.22 * appear)), lineWidth: 0.7)
        }

        // A bezel and a ring of light sweeping around it.
        let bezel = Path(ellipseIn: CGRect(x: centre.x - radius, y: centre.y - radius, width: radius * 2, height: radius * 2))
        canvas.stroke(bezel, with: .linearGradient(Gradient(colors: [.white.opacity(0.5), .white.opacity(0.05), .white.opacity(0.3)]),
                                                     startPoint: CGPoint(x: centre.x - radius, y: centre.y - radius),
                                                     endPoint: CGPoint(x: centre.x + radius, y: centre.y + radius)), lineWidth: 1.2)
        let ring = radius + 14
        let sweep = Angle.radians(t * 1.4)
        canvas.stroke(
            Path(ellipseIn: CGRect(x: centre.x - ring, y: centre.y - ring, width: ring * 2, height: ring * 2)),
            with: .conicGradient(Gradient(colors: [palette[0].opacity(0), palette[0].opacity(0.9 * appear), palette[1].opacity(0.6 * appear), palette[0].opacity(0)]),
                                 center: centre, angle: sweep),
            style: StrokeStyle(lineWidth: 2.2, lineCap: .round)
        )
        canvas.stroke(
            Path(ellipseIn: CGRect(x: centre.x - ring, y: centre.y - ring, width: ring * 2, height: ring * 2)),
            with: .color(.white.opacity(0.06 * appear)), lineWidth: 1
        )
        // The glow the ring throws, breathing with the iris.
        let halo = ring + 26
        canvas.fill(
            Path(ellipseIn: CGRect(x: centre.x - halo, y: centre.y - halo, width: halo * 2, height: halo * 2)),
            with: .radialGradient(Gradient(colors: [palette[0].opacity(0), palette[0].opacity(0.10 * appear * (0.6 + 0.4 * breath)), palette[0].opacity(0)]),
                                  center: centre, startRadius: ring - 10, endRadius: halo)
        )
    }

    /// A hairline with a glint running across it.
    private static func hairline(t: Double) -> some View {
        GeometryReader { proxy in
            let raw = (t * 0.7).truncatingRemainder(dividingBy: 1)
            let x = easeInOut(raw)
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.1))
                Capsule()
                    .fill(LinearGradient(colors: [.clear, palette[0], .white, palette[0], .clear], startPoint: .leading, endPoint: .trailing))
                    .frame(width: 46)
                    .offset(x: CGFloat(x) * (proxy.size.width + 46) - 46)
            }
            .clipShape(Capsule())
        }
    }
}

import CoreLocation
import Photos
import SwiftUI
import UIKit

struct LibraryScreen: View {
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var account = ShareAccount.shared
    @State private var showChoices = false
    var albumID: String?
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
    @State private var newAlbum = false
    @State private var albumDraft = ""
    @State private var albumNote = ""
    @State private var confirmRemoveAlbum = false

    private var showsShelf: Bool { albumID == nil }

    private var userAlbum: AlbumRecord? {
        guard let albumID, let album = library.album(id: albumID), !album.system, !album.id.hasPrefix("galleryos.") else { return nil }
        return album
    }
    private var model: GridModel {
        guard showsShelf else { return library.grid(albumID: albumID) }
        return shelf == "server" ? library.serverGrid : library.phoneGrid
    }
    private var stage: some View {
        ZStack {
            if library.authorization == .authorized || library.authorization == .limited {
                if library.isLoading && model.all.isEmpty {
                    ProgressView("Wczytywanie biblioteki")
                } else if model.all.isEmpty {
                    emptyLibrary
                } else {
                    grid
                }
            } else if library.authorization == .denied || library.authorization == .restricted {
                denied
            } else {
                welcome
            }
        }
    }

    private var zoom: PhotoZoom { PhotoZoom(rawValue: zoomRaw) ?? .days }

    var body: some View {
        dialogs(covers)
    }

    private var covers: some View {
        stage
        .navigationTitle(title.isEmpty ? "Biblioteka" : title)
        .galleryNavigationSubtitle(selecting ? "" : caption)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .top, spacing: 0) {
            if showsShelf, library.authorization == .authorized || library.authorization == .limited {
                Picker("Biblioteka", selection: $shelf) {
                    Text(ThisDevice.name).tag("phone")
                    Text("Serwer").tag("server")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
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
        .syncControl(hidden: selecting || !(library.authorization == .authorized || library.authorization == .limited))
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
        .fullScreenCover(isPresented: $showGuide) {
            SetupGuideView()
                .environmentObject(library)
        }
        .sheet(isPresented: $showChoices) {
            SyncChoicesSheet { showChoices = false }
        }
        .onChange(of: showGuide) { _, open in
            if !open, SyncChoices.shouldAsk { showChoices = true }
        }
        .task {
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
        .confirmationDialog("Usunąć z \(ThisDevice.genitive) zdjęcia, które są już na serwerze?", isPresented: $confirmRemoveSynced, titleVisibility: .visible) {
            Button("Usuń kopie z \(ThisDevice.genitive)", role: .destructive) {
                Task { removeResult = await library.removeSyncedCopies() }
            }
            Button("Anuluj", role: .cancel) {}
        } message: {
            Text("Najpierw sprawdzę oryginał na serwerze. Kasuję tylko potwierdzone. Na serwerze zostają, a z \(ThisDevice.genitive) trafiają do Ostatnio usuniętych na 30 dni.")
        }
        .alert("Zdjęcia", isPresented: Binding(get: { !removeResult.isEmpty }, set: { if !$0 { removeResult = "" } })) {
            Button("Dobrze") { removeResult = "" }
        } message: {
            Text(removeResult)
        }
        .sheet(isPresented: $showShare) {
            ShareAlbumSheet(ids: Array(selection))
                .environmentObject(library)
        }
        .alert("Nowy album", isPresented: $newAlbum) {
            TextField("Nazwa", text: $albumDraft)
            Button("Utwórz") {
                let title = albumDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                let ids = Array(selection)
                guard !title.isEmpty else { return }
                Task {
                    if await AlbumLibrary.create(title, adding: ids) == nil {
                        albumNote = "Nie udało się utworzyć albumu."
                    } else {
                        selection.removeAll()
                        selecting = false
                        library.reloadNow()
                    }
                }
            }
            Button("Anuluj", role: .cancel) {}
        }
        .alert("Album", isPresented: Binding(get: { !albumNote.isEmpty }, set: { if !$0 { albumNote = "" } })) {
            Button("Dobrze") { albumNote = "" }
        } message: {
            Text(albumNote)
        }
        .confirmationDialog("Usunąć ten album?", isPresented: $confirmRemoveAlbum, titleVisibility: .visible) {
            Button("Usuń album", role: .destructive) {
                guard let id = userAlbum?.id else { return }
                Task {
                    if await AlbumLibrary.delete(id) {
                        library.reloadNow()
                        dismiss()
                    } else {
                        albumNote = "Nie udało się usunąć albumu."
                    }
                }
            }
            Button("Anuluj", role: .cancel) {}
        } message: {
            Text("Znika tylko album. Zdjęcia zostają na iPhonie.")
        }
        .confirmationDialog("Usunąć z \(ThisDevice.genitive)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Usuń z \(ThisDevice.genitive)", role: .destructive) {
                library.delete(ids: Array(selection))
                selection.removeAll()
                selecting = false
            }
            Button("Anuluj", role: .cancel) {}
        } message: {
            Text("Kopie, które są już na serwerze, zostają w zakładce Serwer. Z \(ThisDevice.genitive) trafiają do Ostatnio usuniętych na 30 dni.")
        }
        .confirmationDialog(
            "Usunąć z \(ThisDevice.genitive)?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("Usuń z \(ThisDevice.genitive)", role: .destructive) {
                if let pendingDelete { library.delete(ids: [pendingDelete]) }
                pendingDelete = nil
            }
            Button("Anuluj", role: .cancel) { pendingDelete = nil }
        } message: {
            Text("Kopia, która jest już na serwerze, zostaje w zakładce Serwer. Z \(ThisDevice.genitive) trafia do Ostatnio usuniętych na 30 dni.")
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
                        Text("Serwer jest zapisany. Stuknij i wpisz hasło.")
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
        if selecting { return selection.isEmpty ? "Wybierz" : "Wybrano \(selection.count)" }
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
                        gridBody(library.phoneGrid.arranged(sort(for: "galleryos.sort.phone")), active: shelf != "server")
                            .frame(width: proxy.size.width)
                        gridBody(library.serverGrid.arranged(sort(for: "galleryos.sort.server")), active: shelf == "server")
                            .frame(width: proxy.size.width)
                    }
                    .offset(x: shelf == "server" ? -proxy.size.width : 0)
                    .animation(GalleryTheme.page, value: shelf)
                }
                .clipped()
            } else {
                gridBody(model.arranged(sort(for: sortKey)), active: true)
            }
        }
    }

    private func gridBody(_ source: GridModel, active: Bool) -> some View {
        PhotoGrid(
            model: source,
            generation: library.generation,
            zoom: zoom,
            selection: selection,
            selecting: selecting,
            placeNames: library.placeNames,
            density: CGFloat(density),
            synced: { library.isUploaded($0) },
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
            onDelete: shelf == "server" && albumID == nil ? nil : { pendingDelete = $0 },
            onZoom: changeZoom,
            onDensity: { density = Double($0) },
            onCaption: { text in if active { caption = text } },
            onPlace: { coordinate in
                mapFocus = coordinate
                showMap = true
            },
            onVisiblePlaces: { library.resolvePlaces($0) }
        )
    }

    private var limitedBanner: some View {
        Button {
            guard let controller = UIApplication.shared.galleryTopController() else { return }
            library.presentLimitedPicker(from: controller)
        } label: {
            Text("Wybrano część zdjęć. Zarządzaj dostępem.")
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
                    Button(selecting ? "Gotowe" : "Wybierz") {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        withAnimation(GalleryTheme.snappy) {
                            selecting.toggle()
                            if !selecting { selection.removeAll() }
                        }
                    }
                }
                if !selecting {
                    ToolbarItem(placement: .topBarTrailing) {
                        sortMenu
                    }
                }
            }
            if !selecting {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button("Szukaj", systemImage: "magnifyingglass") { showSearch = true }
                        Button("Mapa", systemImage: "map") {
                            mapFocus = nil
                            showMap = true
                        }
                        Menu("Widok", systemImage: "rectangle.grid.2x2") {
                            ForEach(PhotoZoom.allCases) { item in
                                Button(item.title) {
                                    zoomRaw = item.rawValue
                                    anchor = nil
                                }
                            }
                        }
                        Button("Biblioteka GalleryOS", systemImage: "externaldrive") { showPlace = true }
                        Button("Kreator połączenia", systemImage: "wand.and.sparkles") { showGuide = true }
                        Button("Apple TV", systemImage: "appletv") { showAppleTV = true }
                        Button("Synchronizacja", systemImage: "arrow.triangle.2.circlepath") { showSync = true }
                        Button("Stan biblioteki", systemImage: "internaldrive") { showSummary = true }
                        Button("Usuń zsynchronizowane z \(ThisDevice.genitive)", systemImage: ThisDevice.slashSymbol) { confirmRemoveSynced = true }
                        if userAlbum != nil {
                            Button("Usuń album", systemImage: "trash", role: .destructive) { confirmRemoveAlbum = true }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Więcej")
                }
            }
        }
    }

    private var sortKey: String {
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
            Picker("Kolejność", selection: Binding(
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
        .accessibilityLabel("Sortowanie")
    }

    private var selectionBar: some View {
        HStack {
            Button { showShare = true } label: { Image(systemName: "square.and.arrow.up") }
                .disabled(selection.isEmpty)
                .accessibilityLabel("Udostępnij")
            Spacer()
            Button { favoriteSelection() } label: { Image(systemName: "heart") }
                .disabled(selection.isEmpty)
            Spacer()
            Button { concealSelection() } label: {
                Image(systemName: albumID == "galleryos.hidden" ? "eye" : "eye.slash")
            }
            .disabled(selection.isEmpty)
            .accessibilityLabel(albumID == "galleryos.hidden" ? "Pokaż w bibliotece" : "Ukryj")
            Spacer()
            Menu {
                ForEach(library.albums.filter { !$0.system && !$0.id.hasPrefix("galleryos.") && $0.id != albumID }) { album in
                    Button(album.title) { addSelection(to: album.id) }
                }
                Button("Nowy album", systemImage: "plus") {
                    albumDraft = ""
                    newAlbum = true
                }
            } label: {
                Image(systemName: "rectangle.stack.badge.plus")
            }
            .disabled(selection.isEmpty)
            .accessibilityLabel("Dodaj do albumu")
            if userAlbum != nil {
                Spacer()
                Button { removeSelectionFromAlbum() } label: { Image(systemName: "rectangle.stack.badge.minus") }
                    .disabled(selection.isEmpty)
                    .accessibilityLabel("Usuń z albumu")
            }
            Spacer()
            if shelf != "server" || albumID != nil {
                Button(role: .destructive) { confirmDelete = true } label: { Image(systemName: "trash") }
                    .disabled(selection.isEmpty)
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

    private var welcome: some View {
        VStack(spacing: 18) {
            BrandWordmark(size: .largeTitle)
            Text("Zdjęcia i filmy z tego \(ThisDevice.genitive), w układzie jak w aplikacji Zdjęcia.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Kontynuuj") { library.requestAccess() }
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
            Text("GalleryOS potrzebuje dostępu do zdjęć, żeby pokazać bibliotekę.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Otwórz Ustawienia") {
                guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                UIApplication.shared.open(url)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(32)
    }

    private var emptyLibrary: some View {
        if showsShelf && shelf == "server" {
            ContentUnavailableView(
                "Serwer jest pusty",
                systemImage: "externaldrive",
                description: Text("Tu zostają kopie wysłane na serwer, także po skasowaniu ich z \(ThisDevice.genitive).")
            )
        } else {
            ContentUnavailableView(
                "Brak zdjęć na \(ThisDevice.locative)",
                systemImage: ThisDevice.symbol,
                description: Text("Tu jest to, co jest w Rolce i czeka na wysłanie albo już zostało wysłane.")
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
    }

    private func concealSelection() {
        let restore = albumID == "galleryos.hidden"
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        library.setConcealed(!restore, ids: Array(selection))
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
            if await AlbumLibrary.add(ids, to: albumID) {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                selection.removeAll()
                selecting = false
                library.reloadNow()
            } else {
                albumNote = "Nie udało się dodać do albumu. Zdjęcia tylko z serwera zostają poza albumami iPhone’a."
            }
        }
    }

    private func removeSelectionFromAlbum() {
        guard let albumID else { return }
        let ids = Array(selection)
        Task {
            if await AlbumLibrary.remove(ids, from: albumID) {
                selection.removeAll()
                selecting = false
                library.reloadNow()
            } else {
                albumNote = "Nie udało się usunąć z albumu."
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
    @State private var freeSpace = "Sprawdzam…"
    @State private var confirmRemove = false
    @State private var removeResult = ""

    var body: some View {
        let counts = library.syncCounts()
        NavigationStack {
            List {
                LabeledContent("Na serwerze", value: "\(counts.sent)")
                LabeledContent("Czeka na wysłanie", value: "\(counts.waiting)")
                LabeledContent("Wysłano", value: ByteText.amount((UserDefaults.standard.object(forKey: "galleryos.bytes-sent") as? NSNumber)?.int64Value ?? 0))
                LabeledContent("Wolne miejsce", value: freeSpace)
                NavigationLink("Ustawienia synchronizacji") {
                    SyncSettingsForm()
                }
                Button("Usuń zsynchronizowane z \(ThisDevice.genitive)", role: .destructive) {
                    confirmRemove = true
                }
            }
            .navigationTitle("Biblioteka")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Zamknij") { dismiss() }
                }
            }
            .confirmationDialog("Usunąć z \(ThisDevice.genitive) zdjęcia, które są już na serwerze?", isPresented: $confirmRemove, titleVisibility: .visible) {
                Button("Usuń kopie z \(ThisDevice.genitive)", role: .destructive) {
                    Task { removeResult = await library.removeSyncedCopies() }
                }
                Button("Anuluj", role: .cancel) {}
            } message: {
                Text("Najpierw sprawdzę oryginał na serwerze. Kasuję tylko potwierdzone. Na serwerze zostają, a z \(ThisDevice.genitive) trafiają do Ostatnio usuniętych na 30 dni.")
            }
            .alert("Zdjęcia", isPresented: Binding(get: { !removeResult.isEmpty }, set: { if !$0 { removeResult = "" } })) {
                Button("Dobrze") { removeResult = "" }
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
                .navigationTitle("Synchronizacja")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Zamknij") { dismiss() }
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
                Text("Apple TV z tym samym Apple ID pokaże bibliotekę sam.")
            }
            Toggle("Kopia zapasowa", isOn: $uploads)
                .tint(GalleryTheme.accent)
            Picker("Kiedy wysyłać", selection: $wifiOnly) {
                Text("Automatycznie").tag(false)
                Text("Tylko Wi-Fi").tag(true)
            }
            .disabled(!uploads)
            Toggle("Tylko podczas ładowania", isOn: $chargingOnly)
                .disabled(!uploads)
            Toggle("Live Photo", isOn: $liveAuto)
            Text("Kopia zapasowa zapisuje nowe zdjęcia i filmy na serwerze GalleryOS. Wyłączona nie rusza po otwarciu aplikacji. Chmurka wysyła tylko wskazany plik.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Section {
                NavigationLink {
                    AppleTVForm()
                } label: {
                    Label("Połącz kodem", systemImage: "appletv")
                }
            } footer: {
                Text("Pokaż bibliotekę z serwera na telewizorze.")
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


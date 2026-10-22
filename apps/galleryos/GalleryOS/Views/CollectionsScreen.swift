import LocalAuthentication
import MapKit
import SwiftUI

private let utilitiesTitle = L("Narzędzia")

struct CollectionsScreen: View {
    @EnvironmentObject private var library: PhotoLibrary
    @AppStorage("galleryos.album-sort") private var sort = "newest"
    @AppStorage("galleryos.album-order") private var orderRaw = ""
    @State private var creating = false
    @State private var arranging = false
    @State private var draft = ""
    @State private var renaming: AlbumRecord?
    @State private var deleting: AlbumRecord?
    @State private var albumNote = ""
    @State private var showMap = false
    @State private var open: Set<String> = [L("Przypięte"), utilitiesTitle, L("Albumy")]
    /// The user's own pinned collections, in their order. Empty: Photos' defaults (Ulubione, Ostatnio dodane).
    @AppStorage("galleryos.pinned.v1") private var pinnedRaw = ""
    @State private var arrangingPinned = false

    private var defaultPinned: [AlbumRecord] {
        library.albums.filter { album in
            guard album.system, album.count > 0 else { return false }
            return Self.pinnedTitles.contains(album.title) || Self.pinnedHints(album)
        }
    }

    private var pinnedIDs: [String] {
        if pinnedRaw.isEmpty { return defaultPinned.map(\.id) }
        if pinnedRaw == "-" { return [] }
        return pinnedRaw.split(separator: "|").map(String.init)
    }

    private var pinned: [AlbumRecord] {
        let byID = Dictionary(library.albums.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        return pinnedIDs.compactMap { byID[$0] }
    }

    private func setPinned(_ ids: [String]) {
        pinnedRaw = ids.isEmpty ? "-" : ids.joined(separator: "|")
    }

    private func togglePin(_ album: AlbumRecord) {
        var ids = pinnedIDs
        if let index = ids.firstIndex(of: album.id) {
            ids.remove(at: index)
        } else {
            ids.append(album.id)
        }
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { setPinned(ids) }
    }

    private func movePinned(_ album: AlbumRecord, by step: Int) {
        var ids = pinned.map(\.id)
        guard let index = ids.firstIndex(of: album.id) else { return }
        let target = min(max(index + step, 0), ids.count - 1)
        guard target != index else { return }
        ids.swapAt(index, target)
        UISelectionFeedbackGenerator().selectionChanged()
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { setPinned(ids) }
    }

    /// Hidden and Recently Deleted, together and always visible, as in Photos.
    private var utilities: [AlbumRecord] {
        let hidden = library.albums.filter { $0.id == "galleryos.hidden" }
        let trash = library.albums.filter { $0.id == "galleryos.trash" }
        return hidden + trash
    }

    private var media: [AlbumRecord] {
        library.albums.filter {
            $0.system && $0.id != "galleryos.hidden" && $0.id != "galleryos.trash" && !pinned.contains($0) && $0.count > 0
        }
    }

    /// Albums from this iPhone and albums that exist only in the server library.
    private var userAlbums: [AlbumRecord] {
        library.albums.filter { !$0.system }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                tape(L("Przypięte"), albums: pinned, map: true)
                MemoriesShelf()
                PeopleShelf()
                CleanupCard()
                    .padding(.vertical, 4)
                if !media.isEmpty {
                    tape(L("Typy multimediów"), albums: media, map: false)
                }
                tape(L("Albumy"), albums: arranged(userAlbums), map: false, editable: true)
                // Hidden and Recently Deleted: tools, at the very bottom, as in Photos.
                if !utilities.isEmpty {
                    tape(utilitiesTitle, albums: utilities, map: false)
                }
            }
            .padding(.vertical, 8)
        }
        .navigationTitle(L("Kolekcje"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker(L("Sortuj albumy"), selection: $sort) {
                        Text(L("Najnowsze")).tag("newest")
                        Text(L("Najstarsze")).tag("oldest")
                        Text(L("Nazwa")).tag("name")
                        if !orderRaw.isEmpty {
                            Text(L("Własna kolejność")).tag("manual")
                        }
                    }
                    Button(L("Ułóż ręcznie…"), systemImage: "line.3.horizontal") { arranging = true }
                    Button(L("Ułóż przypięte…"), systemImage: "pin") { arrangingPinned = true }
                    Section {
                        Toggle(isOn: Binding(
                            get: { !library.hideScreenshots },
                            set: { library.hideScreenshots = !$0 }
                        )) {
                            Label(L("Zrzuty ekranu w albumach"), systemImage: "camera.viewfinder")
                        }
                    }
                } label: {
                    Image(systemName: "arrow.up.arrow.down")
                }
                .accessibilityLabel(L("Sortuj albumy"))
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button(L("Nowy album"), systemImage: "plus") {
                    draft = ""
                    creating = true
                }
            }
        }
        .alert(L("Nowy album"), isPresented: $creating) {
            TextField(L("Nazwa"), text: $draft)
            Button(L("Utwórz")) {
                let title = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !title.isEmpty else { return }
                Task {
                    if await AlbumLibrary.create(title) == nil {
                        albumNote = L("Nie udało się utworzyć albumu. Sprawdź dostęp do zdjęć.")
                    } else {
                        library.reloadNow()
                    }
                }
            }
            Button(L("Anuluj"), role: .cancel) {}
        }
        .alert(L("Zmień nazwę"), isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField(L("Nazwa"), text: $draft)
            Button(L("Zachowaj")) {
                if let renaming {
                    Task {
                        if await AlbumActions.rename(renaming.id, draft) {
                            library.reloadNow()
                        } else {
                            albumNote = L("Nie udało się zmienić nazwy.")
                        }
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
                guard let deleting else { return }
                let id = deleting.id
                self.deleting = nil
                Task {
                    if await AlbumActions.delete(id) {
                        library.reloadNow()
                    } else {
                        albumNote = L("Nie udało się usunąć albumu. Zdjęcia zostają w bibliotece.")
                    }
                }
            }
            Button(L("Anuluj"), role: .cancel) { deleting = nil }
        } message: {
            Text(L("Znika tylko album. Zdjęcia zostają w bibliotece i na serwerze."))
        }
        .alert(L("Album"), isPresented: Binding(get: { !albumNote.isEmpty }, set: { if !$0 { albumNote = "" } })) {
            Button(L("Dobrze")) { albumNote = "" }
        } message: {
            Text(albumNote)
        }
        .sheet(isPresented: $arrangingPinned) {
            PinnedArrangeSheet(
                pinned: pinned,
                candidates: library.albums.filter { $0.count > 0 || !$0.system },
                onSave: { ids in withAnimation { setPinned(ids) } }
            )
        }
        .sheet(isPresented: $arranging) {
            AlbumArrangeSheet(albums: arranged(userAlbums), orderRaw: $orderRaw, sort: $sort)
        }
        .peopleDestinations()
        .cleanupDestinations()
        .memoryDestinations()
        .navigationDestination(for: String.self) { id in
            if id == "galleryos.hidden" {
                HiddenLibrary()
            } else {
                LibraryScreen(albumID: id)
            }
        }
        .fullScreenCover(isPresented: $showMap) {
            LibraryMapScreen()
                .environmentObject(library)
        }
        .background(Color(uiColor: .systemBackground))
    }

    private func arranged(_ albums: [AlbumRecord]) -> [AlbumRecord] {
        let manual = orderRaw.split(separator: "|").map(String.init)
        if sort == "manual", !manual.isEmpty {
            return albums.sorted {
                (manual.firstIndex(of: $0.id) ?? .max) < (manual.firstIndex(of: $1.id) ?? .max)
            }
        }
        return albums.sorted { lhs, rhs in
            switch sort {
            case "name":
                return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
            case "oldest":
                return (lhs.latest ?? .distantFuture) < (rhs.latest ?? .distantFuture)
            default:
                return (lhs.latest ?? .distantPast) > (rhs.latest ?? .distantPast)
            }
        }
    }

    private func tape(_ title: String, albums: [AlbumRecord], map: Bool, editable: Bool = false) -> some View {
        let shown = open.contains(title)
        return VStack(alignment: .leading, spacing: 10) {
            Button {
                withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) {
                    if shown { open.remove(title) } else { open.insert(title) }
                }
            } label: {
                HStack {
                    Text(title)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(.primary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.blue)
                        .rotationEffect(.degrees(shown ? 90 : 0))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .buttonStyle(.plain)
            if shown {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 12) {
                        if map {
                            // The live map swallowed taps, so only the caption opened it.
                            MapTapeCard()
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                                    showMap = true
                                }
                                .accessibilityAddTraits(.isButton)
                                .accessibilityLabel(L("Mapa"))
                        }
                        ForEach(albums) { album in
                            NavigationLink(value: album.id) {
                                AlbumCard(album: album, wide: false)
                                    .frame(width: 148)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                let isPinned = pinnedIDs.contains(album.id)
                                Button(isPinned ? L("Odepnij") : L("Przypnij na górze"), systemImage: isPinned ? "pin.slash" : "pin") {
                                    togglePin(album)
                                }
                                if title == L("Przypięte"), pinned.count > 1 {
                                    Button(L("Przesuń w lewo"), systemImage: "arrow.left") { movePinned(album, by: -1) }
                                    Button(L("Przesuń w prawo"), systemImage: "arrow.right") { movePinned(album, by: 1) }
                                    Button(L("Ułóż przypięte…"), systemImage: "line.3.horizontal") { arrangingPinned = true }
                                }
                                // Device albums change in Photos; server albums in the shared catalogue.
                                if editable, AlbumActions.editable(album) {
                                    Button(L("Zmień nazwę")) {
                                        draft = album.title
                                        renaming = album
                                    }
                                    Button(L("Usuń album"), role: .destructive) {
                                        deleting = album
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    // Photos' own album names, in whatever language the iPhone uses.
    private static let pinnedTitles: Set<String> = ["Ulubione", "Ostatnio dodane", "Favorites", "Recents", "Улюблені", "Нещодавні"] // l10n:skip

    private static func pinnedHints(_ album: AlbumRecord) -> Bool {
        let title = album.title.lowercased()
        let skipped = ["ukry", "hidden", "usuni", "deleted", "прихов", "видал"] // l10n:skip
        if skipped.contains(where: { title.contains($0) }) { return false }
        let wanted = ["ulub", "ostatnio dod", "favorite", "recent", "улюблен", "нещодавн"] // l10n:skip
        return wanted.contains { title.contains($0) }
    }
}

private struct MapTapeCard: View {
    @EnvironmentObject private var library: PhotoLibrary

    private var center: CLLocationCoordinate2D {
        let photo = library.grid.all.last { $0.latitude != nil && $0.longitude != nil }
        return CLLocationCoordinate2D(latitude: photo?.latitude ?? 52.23, longitude: photo?.longitude ?? 21.01)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Map(initialPosition: .region(MKCoordinateRegion(
                center: center,
                span: MKCoordinateSpan(latitudeDelta: 1.4, longitudeDelta: 1.8)
            )))
            .frame(width: 148, height: 148)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .allowsHitTesting(false)
            .overlay {
                // A nearly invisible layer above the map receives the tap instead of MapKit.
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.black.opacity(0.001))
            }
            Text(L("Mapa"))
                .font(.subheadline.weight(.semibold))
            Text(L("Miejsca"))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(width: 148)
    }
}

private struct AlbumCard: View {
    @EnvironmentObject private var library: PhotoLibrary
    let album: AlbumRecord
    var wide: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Group {
                if album.id == "galleryos.hidden" {
                    Color(uiColor: .secondarySystemFill)
                        .overlay {
                            Image(systemName: "lock.fill")
                                .font(.title2)
                                .foregroundStyle(.secondary)
                        }
                } else {
                    AlbumCover(assetID: album.coverID)
                }
            }
            .frame(width: wide ? nil : 148, height: wide ? 92 : 148)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            Text(album.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
            Text(album.count == 0 ? L("Pusty") : PhotoFormat.count(album.count))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

struct AlbumCover: View {
    @EnvironmentObject private var library: PhotoLibrary
    let assetID: String?

    var body: some View {
        Color(uiColor: .secondarySystemFill)
            .overlay {
                if let assetID, let asset = library.asset(id: assetID) {
                    AssetImage(asset: asset)
                } else if let assetID, let image = library.thumbnail(id: assetID) {
                    // Covers of server albums are not on this iPhone; use the downloaded preview.
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    Image(systemName: "photo")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }
            }
    }
}

private struct AssetImage: UIViewRepresentable {
    let asset: PHAsset

    func makeUIView(context: Context) -> AssetImageView { AssetImageView() }

    func updateUIView(_ view: AssetImageView, context: Context) {
        view.setAsset(asset)
    }
}

import Photos
import UIKit

final class AssetImageView: UIView {
    private let imageView = UIImageView()
    private let gifBadge = UILabel()
    private var request: PHImageRequestID = PHInvalidImageRequestID
    private var currentID: String?
    private var pending: PHAsset?
    private var loadedSide: CGFloat = 0

    override init(frame: CGRect) {
        super.init(frame: frame)
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        addSubview(imageView)
        gifBadge.text = "GIF"
        gifBadge.font = .systemFont(ofSize: 10, weight: .bold)
        gifBadge.textColor = .white
        gifBadge.textAlignment = .center
        gifBadge.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        gifBadge.layer.cornerRadius = 8
        gifBadge.layer.cornerCurve = .continuous
        gifBadge.clipsToBounds = true
        gifBadge.isHidden = true
        addSubview(gifBadge)
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        imageView.frame = bounds
        gifBadge.frame = CGRect(x: 8, y: bounds.height - 24, width: 32, height: 16)
        loadIfNeeded()
    }

    func setAsset(_ asset: PHAsset) {
        pending = asset
        loadIfNeeded()
    }

    private func loadIfNeeded() {
        guard let asset = pending, bounds.width > 1 else { return }
        let scale = max(traitCollection.displayScale, 2)
        let side = bounds.width * scale
        guard currentID != asset.localIdentifier || abs(side - loadedSide) > 24 else { return }
        currentID = asset.localIdentifier
        loadedSide = side
        if request != PHInvalidImageRequestID {
            PHImageManager.default().cancelImageRequest(request)
        }
        let target = CGSize(width: bounds.width * scale, height: bounds.height * scale)
        gifBadge.isHidden = !Self.animates(asset)
        if let cached = AnimatedCache.images.object(forKey: asset.localIdentifier as NSString) {
            imageView.image = cached
            return
        }
        let fast = PHImageRequestOptions()
        fast.deliveryMode = .opportunistic
        fast.resizeMode = .exact
        fast.isNetworkAccessAllowed = true
        let id = asset.localIdentifier
        request = PHImageManager.default().requestImage(
            for: asset,
            targetSize: target,
            contentMode: .aspectFill,
            options: fast
        ) { [weak self] image, info in
            let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
            let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
            DispatchQueue.main.async {
                guard let self, self.currentID == id, !cancelled else { return }
                if let image, self.imageView.image == nil || !degraded {
                    self.imageView.image = image
                }
                if !degraded, Self.animates(asset) {
                    self.playAnimated(asset, side: max(target.width, target.height))
                }
            }
        }
    }

    private static func animates(_ asset: PHAsset) -> Bool {
        if asset.playbackStyle == .imageAnimated { return true }
        return PHAssetResource.assetResources(for: asset).contains { resource in
            resource.uniformTypeIdentifier.lowercased().contains("gif")
        }
    }

    private func playAnimated(_ asset: PHAsset, side: CGFloat) {
        let key = asset.localIdentifier as NSString
        if let cached = AnimatedCache.images.object(forKey: key) {
            imageView.image = cached
            return
        }
        let options = PHImageRequestOptions()
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .highQualityFormat
        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { [weak self] data, _, _, _ in
            guard let data, let animated = AnimatedFrames.image(data: data, maxSide: side, maxFrames: 16) else { return }
            AnimatedCache.images.setObject(animated, forKey: key)
            DispatchQueue.main.async {
                guard let self, self.currentID == asset.localIdentifier else { return }
                self.imageView.image = animated
            }
        }
    }
}

/// One place for album changes, whether the album lives in Photos on this device or only in
/// the server library ("galleryos.album.<name>").
enum AlbumActions {
    static let serverPrefix = "galleryos.album."

    static func isServer(_ id: String) -> Bool { id.hasPrefix(serverPrefix) }

    static func serverName(_ id: String) -> String { String(id.dropFirst(serverPrefix.count)) }

    /// Your own albums: device albums and server albums. Smart albums and Hidden/Trash are not.
    static func editable(_ album: AlbumRecord) -> Bool {
        guard !album.system else { return false }
        return isServer(album.id) || !album.id.hasPrefix("galleryos.")
    }

    @MainActor
    static func rename(_ id: String, _ title: String) async -> Bool {
        if isServer(id) { return LibraryEngine.shared.renameServerAlbum(serverName(id), to: title) }
        return await AlbumLibrary.rename(id, title)
    }

    @MainActor
    static func delete(_ id: String) async -> Bool {
        if isServer(id) { return LibraryEngine.shared.removeServerAlbum(serverName(id)) }
        return await AlbumLibrary.delete(id)
    }

    @MainActor
    static func add(_ ids: [String], to id: String) async -> Bool {
        if isServer(id) { return LibraryEngine.shared.addToServerAlbum(ids, name: serverName(id)) }
        return await AlbumLibrary.add(ids, to: id)
    }

    @MainActor
    static func remove(_ ids: [String], from id: String) async -> Bool {
        if isServer(id) { return LibraryEngine.shared.removeFromServerAlbum(ids, name: serverName(id)) }
        return await AlbumLibrary.remove(ids, from: id)
    }
}

enum AlbumLibrary {
    private final class Holder: @unchecked Sendable {
        var value = ""
    }

    /// The placeholder identifier becomes the album id. Pass photo ids to fill it in the same save.
    static func create(_ title: String, adding ids: [String] = []) async -> String? {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let holder = Holder()
        let photos = ids.filter { !$0.hasPrefix("cloud:") && !$0.hasPrefix("galleryos.") }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                let request = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: trimmed)
                holder.value = request.placeholderForCreatedAssetCollection.localIdentifier
                if !photos.isEmpty {
                    request.addAssets(PHAsset.fetchAssets(withLocalIdentifiers: photos, options: nil))
                }
            }
            return holder.value.isEmpty ? nil : holder.value
        } catch {
            return nil
        }
    }

    static func rename(_ id: String, _ title: String) async -> Bool {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let collection = userAlbum(id) else { return false }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetCollectionChangeRequest(for: collection)?.title = trimmed
            }
            return true
        } catch {
            return false
        }
    }

    static func delete(_ id: String) async -> Bool {
        guard userAlbum(id) != nil else { return false }
        let collections = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [id], options: nil)
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetCollectionChangeRequest.deleteAssetCollections(collections)
            }
            return true
        } catch {
            return false
        }
    }

    static func add(_ ids: [String], to albumID: String) async -> Bool {
        guard let collection = userAlbum(albumID) else { return false }
        let photos = ids.filter { !$0.hasPrefix("cloud:") && !$0.hasPrefix("galleryos.") }
        guard !photos.isEmpty else { return false }
        let assets = PHAsset.fetchAssets(withLocalIdentifiers: photos, options: nil)
        guard assets.count > 0 else { return false }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetCollectionChangeRequest(for: collection)?.addAssets(assets)
            }
            return true
        } catch {
            return false
        }
    }

    static func remove(_ ids: [String], from albumID: String) async -> Bool {
        guard let collection = userAlbum(albumID) else { return false }
        let photos = ids.filter { !$0.hasPrefix("cloud:") && !$0.hasPrefix("galleryos.") }
        guard !photos.isEmpty else { return false }
        let assets = PHAsset.fetchAssets(withLocalIdentifiers: photos, options: nil)
        guard assets.count > 0 else { return false }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetCollectionChangeRequest(for: collection)?.removeAssets(assets)
            }
            return true
        } catch {
            return false
        }
    }

    private static func userAlbum(_ id: String) -> PHAssetCollection? {
        let collection = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [id], options: nil).firstObject
        guard let collection, collection.assetCollectionType == .album else { return nil }
        return collection
    }

}

/// Pinned collections: drag to reorder, swipe to unpin, add any album from the list below.
private struct PinnedArrangeSheet: View {
    let candidates: [AlbumRecord]
    let onSave: ([String]) -> Void
    @State private var rows: [AlbumRecord]
    @Environment(\.dismiss) private var dismiss

    init(pinned: [AlbumRecord], candidates: [AlbumRecord], onSave: @escaping ([String]) -> Void) {
        self.candidates = candidates
        self.onSave = onSave
        _rows = State(initialValue: pinned)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(rows) { album in
                        Label(album.title, systemImage: "pin.fill")
                    }
                    .onMove { rows.move(fromOffsets: $0, toOffset: $1) }
                    .onDelete { rows.remove(atOffsets: $0) }
                } header: {
                    Text(L("Przypięte"))
                } footer: {
                    Text(L("Przeciągnij, żeby zmienić kolejność. Przesuń w lewo, żeby odpiąć."))
                }
                let rest = candidates.filter { candidate in !rows.contains { $0.id == candidate.id } }
                if !rest.isEmpty {
                    Section(L("Dodaj")) {
                        ForEach(rest) { album in
                            Button {
                                withAnimation { rows.append(album) }
                                UISelectionFeedbackGenerator().selectionChanged()
                            } label: {
                                Label(album.title, systemImage: "plus.circle.fill")
                            }
                        }
                    }
                }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle(L("Przypięte"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("Anuluj")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L("Gotowe")) {
                        onSave(rows.map(\.id))
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}

private struct AlbumArrangeSheet: View {
    let albums: [AlbumRecord]
    @Binding var orderRaw: String
    @Binding var sort: String
    @State private var rows: [AlbumRecord]
    @Environment(\.dismiss) private var dismiss

    init(albums: [AlbumRecord], orderRaw: Binding<String>, sort: Binding<String>) {
        self.albums = albums
        _orderRaw = orderRaw
        _sort = sort
        _rows = State(initialValue: albums)
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(rows) { album in
                    Text(album.title)
                }
                .onMove { rows.move(fromOffsets: $0, toOffset: $1) }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle(L("Kolejność"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button(L("Gotowe")) {
                    orderRaw = rows.map(\.id).joined(separator: "|")
                    sort = "manual"
                    dismiss()
                }
            }
        }
    }
}

/// The shared library never lists these photos. Opening the album asks for Face ID or the device code.
struct HiddenLibrary: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var unlocked = false

    var body: some View {
        Group {
            if unlocked {
                LibraryScreen(albumID: "galleryos.hidden")
                    .safeAreaInset(edge: .top, spacing: 0) { VaultBanner() }
            } else {
                ContentUnavailableView {
                    Label(L("Ukryte"), systemImage: "lock.shield.fill")
                } description: {
                    VStack(spacing: 10) {
                        Text(L("Widzisz je tylko Ty – po Face ID na swoim urządzeniu."))
                        Text(L("Na serwerze są zaszyfrowane kluczem z Twojego pęku kluczy iCloud. Inne osoby korzystające z tego samego serwera, Apple TV i ktoś przeglądający dysk NAS widzą tylko nieczytelne dane."))
                            .font(.footnote)
                    }
                } actions: {
                    Button(L("Potwierdź, że to Ty")) { authenticate() }
                        .buttonStyle(.borderedProminent)
                }
            }
        }
        // Ask once per visit, and lock again when the app goes to the background, like Photos.
        .task { if !unlocked { authenticate() } }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { unlocked = false }
        }
    }

    private func authenticate() {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            unlocked = true
            return
        }
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: L("Pokaż ukryte zdjęcia")) { ok, _ in
            DispatchQueue.main.async {
                unlocked = ok
            }
        }
    }
}


/// The state of the encrypted vault, above the Hidden album: how much is already sealed.
struct VaultBanner: View {
    @EnvironmentObject private var library: PhotoLibrary
    @State private var state = (hidden: 0, sealed: 0)
    @State private var explain = false

    private var done: Bool { state.hidden == 0 || state.sealed >= state.hidden }

    var body: some View {
        Button { explain = true } label: {
            HStack(spacing: 12) {
                Image(systemName: done ? "lock.shield.fill" : "lock.rotation")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(done ? Color.green : Color.orange)
                    .symbolEffect(.pulse, options: .repeating, isActive: !done)
                VStack(alignment: .leading, spacing: 1) {
                    Text(done ? L("Zaszyfrowane end-to-end · tylko Ty") : L("Szyfruję na serwerze…"))
                        .font(.footnote.weight(.semibold))
                    Text(line)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "info.circle").foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 9)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(.bar)
        .task {
            while !Task.isCancelled {
                state = LibraryEngine.shared.vaultState()
                try? await Task.sleep(for: .seconds(done ? 10 : 2))
            }
        }
        .sheet(isPresented: $explain) {
            VaultExplainer { explain = false }
                .presentationDetents([.medium, .large])
        }
    }

    private var line: String {
        if !library.destinationConnected { return L("Bez serwera ukryte zostają tylko na tym urządzeniu.") }
        if state.hidden == 0 { return L("Klucz jest w Twoim pęku kluczy iCloud.") }
        if done { return L("\(PhotoFormat.grouped(state.sealed)) na serwerze, klucz tylko w Twoim pęku kluczy iCloud.") }
        return L("\(PhotoFormat.grouped(state.sealed)) z \(PhotoFormat.grouped(state.hidden)) gotowe. Reszta za chwilę.")
    }
}

/// Plain words about what hiding does, shown the first time and from the vault banner.
struct VaultExplainer: View {
    let done: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 14) {
                        Image(systemName: "lock.shield.fill")
                            .font(.system(size: 34, weight: .semibold))
                            .foregroundStyle(.green)
                        Text(L("Ukryte są naprawdę prywatne"))
                            .font(.title2.bold())
                    }
                    point("person.fill.checkmark", L("Tylko Ty"), L("Ukryte zdjęcie widzi wyłącznie osoba, która je schowała – rozpoznaję ją po koncie iCloud. Inni użytkownicy tego samego serwera go nie zobaczą."))
                    point("faceid", L("Face ID przy każdym otwarciu"), L("Album Ukryte otwiera się dopiero po Face ID lub kodzie i zamyka, gdy wyjdziesz z aplikacji."))
                    point("key.fill", L("Szyfrowanie end-to-end"), L("Oryginał i miniatura na serwerze są szyfrowane (AES-256). Klucz powstaje na Twoim urządzeniu i jest tylko w Twoim pęku kluczy iCloud – nie ma go serwer, nie mamy go my."))
                    point("externaldrive.badge.xmark", L("Nieczytelne na dysku"), L("Ktoś, kto zaloguje się do NAS-a albo przegląda folder, zobaczy tylko zaszyfrowane dane."))
                    point("appletv", L("Poza Apple TV i albumami"), L("Ukryte nie pojawiają się na Apple TV ani w albumach udostępnionych znajomym."))
                    point("iphone.and.arrow.forward", L("Na Twoich urządzeniach"), L("iPhone i iPad z tym samym Apple ID otworzą je same – klucz przychodzi przez pęk kluczy iCloud (musi być włączony)."))
                    Text(L("Gdy pokażesz zdjęcie z powrotem, wraca na serwer w zwykłej postaci."))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(22)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(L("Rozumiem"), action: done)
                }
            }
        }
    }

    private func point(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(GalleryTheme.accent)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

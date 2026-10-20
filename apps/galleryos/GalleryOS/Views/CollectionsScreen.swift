import LocalAuthentication
import MapKit
import SwiftUI

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
    @State private var open: Set<String> = ["Przypięte", "Ukryte", "Albumy"]

    private var pinned: [AlbumRecord] {
        library.albums.filter { album in
            guard album.system, album.count > 0 else { return false }
            return Self.pinnedTitles.contains(album.title) || Self.pinnedHints(album)
        }
    }

    private var hiddenAlbum: AlbumRecord? {
        library.albums.first { $0.id == "galleryos.hidden" }
    }

    private var media: [AlbumRecord] {
        library.albums.filter { $0.system && $0.id != "galleryos.hidden" && !pinned.contains($0) && $0.count > 0 }
    }

    private var userAlbums: [AlbumRecord] {
        library.albums.filter { !$0.system && !$0.id.hasPrefix("galleryos.") }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                tape("Przypięte", albums: pinned, map: true)
                if let hiddenAlbum {
                    tape("Ukryte", albums: [hiddenAlbum], map: false)
                }
                if !media.isEmpty {
                    tape("Typy multimediów", albums: media, map: false)
                }
                tape("Albumy", albums: arranged(userAlbums), map: false, editable: true)
            }
            .padding(.vertical, 8)
        }
        .navigationTitle("Kolekcje")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Menu("Sortuj", systemImage: "arrow.up.arrow.down") {
                    Button("Najnowsze") { sort = "newest" }
                    Button("Najstarsze") { sort = "oldest" }
                    Button("Nazwa") { sort = "name" }
                    Button("Ułóż ręcznie") { arranging = true }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Nowy album", systemImage: "plus") {
                    draft = ""
                    creating = true
                }
            }
        }
        .alert("Nowy album", isPresented: $creating) {
            TextField("Nazwa", text: $draft)
            Button("Utwórz") {
                let title = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !title.isEmpty else { return }
                Task {
                    if await AlbumLibrary.create(title) == nil {
                        albumNote = "Nie udało się utworzyć albumu. Sprawdź dostęp do zdjęć."
                    } else {
                        library.reloadNow()
                    }
                }
            }
            Button("Anuluj", role: .cancel) {}
        }
        .alert("Zmień nazwę", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField("Nazwa", text: $draft)
            Button("Zachowaj") {
                if let renaming {
                    Task {
                        if await AlbumLibrary.rename(renaming.id, draft) {
                            library.reloadNow()
                        } else {
                            albumNote = "Nie udało się zmienić nazwy."
                        }
                    }
                }
            }
            Button("Anuluj", role: .cancel) {}
        }
        .confirmationDialog(
            "Usunąć album „\(deleting?.title ?? "")”?",
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible
        ) {
            Button("Usuń album", role: .destructive) {
                guard let deleting else { return }
                let id = deleting.id
                self.deleting = nil
                Task {
                    if await AlbumLibrary.delete(id) {
                        library.reloadNow()
                    } else {
                        albumNote = "Nie udało się usunąć albumu. Zdjęcia zostają w bibliotece."
                    }
                }
            }
            Button("Anuluj", role: .cancel) { deleting = nil }
        } message: {
            Text("Znika tylko album. Zdjęcia zostają na iPhonie.")
        }
        .alert("Album", isPresented: Binding(get: { !albumNote.isEmpty }, set: { if !$0 { albumNote = "" } })) {
            Button("Dobrze") { albumNote = "" }
        } message: {
            Text(albumNote)
        }
        .sheet(isPresented: $arranging) {
            AlbumArrangeSheet(albums: arranged(userAlbums), orderRaw: $orderRaw, sort: $sort)
        }
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
                return AlbumLibrary.date(lhs.id) < AlbumLibrary.date(rhs.id)
            default:
                return AlbumLibrary.date(lhs.id) > AlbumLibrary.date(rhs.id)
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
                            Button { showMap = true } label: { MapTapeCard() }
                                .buttonStyle(.plain)
                        }
                        ForEach(albums) { album in
                            NavigationLink(value: album.id) {
                                AlbumCard(album: album, wide: false)
                                    .frame(width: 148)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                if editable {
                                    Button("Zmień nazwę") {
                                        draft = album.title
                                        renaming = album
                                    }
                                    Button("Usuń album", role: .destructive) {
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

    private static let pinnedTitles: Set<String> = ["Ulubione", "Ostatnio dodane", "Favorites", "Recents"]

    private static func pinnedHints(_ album: AlbumRecord) -> Bool {
        let title = album.title.lowercased()
        if title.contains("ukry") || title.contains("hidden") || title.contains("usuni") || title.contains("deleted") {
            return false
        }
        return title.contains("ulub") || title.contains("ostatnio dod") || title.contains("favorite") || title.contains("recent")
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
            Text("Mapa")
                .font(.subheadline.weight(.semibold))
            Text("Miejsca")
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
            Text(album.count == 0 ? "Pusty" : PhotoFormat.count(album.count))
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

    static func date(_ id: String) -> Date {
        PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [id], options: nil).firstObject?.endDate ?? .distantPast
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
            .navigationTitle("Kolejność")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button("Gotowe") {
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
    @State private var unlocked = false

    var body: some View {
        Group {
            if unlocked {
                LibraryScreen(albumID: "galleryos.hidden")
            } else {
                ContentUnavailableView {
                    Label("Ukryte", systemImage: "lock.fill")
                } description: {
                    Text("Tych zdjęć nie ma w bibliotece na serwerze ani na Apple TV. Widać je tylko tutaj.")
                } actions: {
                    Button("Potwierdź, że to Ty") { authenticate() }
                }
            }
        }
        .task { authenticate() }
    }

    private func authenticate() {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            unlocked = true
            return
        }
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Pokaż ukryte zdjęcia") { ok, _ in
            DispatchQueue.main.async {
                unlocked = ok
            }
        }
    }
}

import MapKit
import Photos
import SwiftUI

struct SearchScreen: View {
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    var showsClose = true
    @State private var query = ""
    @State private var viewer: ViewerRequest?
    @State private var showMap = false

    private var results: GridModel {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .empty }
        let ids = Set(ObjectSearch.match(photos: library.grid.all, labels: library.labels, query: trimmed))
        return GridModel(photos: library.grid.all.filter { ids.contains($0.id) })
    }

    var body: some View {
        NavigationStack {
            Group {
                if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    suggestions
                } else if results.all.isEmpty {
                    ContentUnavailableView.search(text: query)
                        .overlay(alignment: .bottom) {
                            if library.indexing, ObjectSearch.isObjectQuery(query) {
                                Text("Przeglądam bibliotekę na tym iPhonie.")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .padding(.bottom, 24)
                            }
                        }
                } else {
                    PhotoGrid(
                        model: results,
                        generation: library.generation,
                        zoom: .all,
                        selection: [],
                        selecting: false,
                        placeNames: library.placeNames,
                        anchor: nil,
                        asset: { library.asset(id: $0) },
                        onOpen: { request in
                            let ids = results.all.map(\.id)
                            let index = ids.firstIndex(of: request.id) ?? 0
                            var transaction = Transaction()
                            transaction.disablesAnimations = true
                            withTransaction(transaction) {
                                viewer = ViewerRequest(ids: ids, index: index, origin: request.frame, image: request.image, source: request.source)
                            }
                        },
                        onSelect: { _ in },
                        onFavorite: { _ in },
                        onZoom: { _, _ in },
                        onVisiblePlaces: { _ in }
                    )
                }
            }
            .navigationTitle("Szukaj")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Zdjęcia, miejsca, rzeczy")
            .toolbar {
                if showsClose {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Zamknij") { dismiss() }
                    }
                }
            }
            .syncControl(hidden: showsClose)
            .fullScreenCover(isPresented: $showMap) {
                LibraryMapScreen()
                    .environmentObject(library)
            }
            .fullScreenCover(item: $viewer) { request in
                PhotoViewerHost(request: request)
                    .environmentObject(library)
                    .presentationBackground(.clear)
            }
        }
    }

    private var suggestions: some View {
        VStack(spacing: 0) {
            if !clusters.isEmpty {
                Button { showMap = true } label: {
                    Label("Mapa", systemImage: "map")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.bordered)
                .padding(.horizontal, 16)
                .padding(.top, 12)
            }
            shortcutList
        }
    }

    private var shortcutList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("Skróty")
                    .font(.title2.bold())
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 10)], alignment: .leading, spacing: 10) {
                    ForEach(shortcuts, id: \.self) { word in
                        Button(word) { query = word }
                            .buttonStyle(.bordered)
                    }
                }
                Text("Wyniki osób pojawią się po przejrzeniu biblioteki na tym iPhonie. Rzeczy takie jak „samochód” lub „pies” też pochodzą z lokalnego przeglądu.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding(16)
        }
    }

    private var shortcuts: [String] {
        ["Ulubione", "Wideo", "Selfie", "Live", "Zrzuty", "Panoramy", "Portrety"]
    }

    private var clusters: [PlaceCluster] {
        var buckets: [String: PlaceCluster] = [:]
        for photo in library.grid.all {
            guard let latitude = photo.latitude, let longitude = photo.longitude else { continue }
            let key = String(format: "%.2f,%.2f", latitude, longitude)
            if var existing = buckets[key] {
                existing.photoIDs.append(photo.id)
                existing.coverID = photo.id
                buckets[key] = existing
            } else {
                buckets[key] = PlaceCluster(
                    id: key,
                    coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                    photoIDs: [photo.id],
                    coverID: photo.id
                )
            }
        }
        return buckets.values.sorted { $0.photoIDs.count > $1.photoIDs.count }.prefix(60).map { $0 }
    }
}

private struct PlaceCluster: Identifiable {
    let id: String
    var coordinate: CLLocationCoordinate2D
    var photoIDs: [String]
    var coverID: String
    var count: Int { photoIDs.count }
}

private struct PlacePhotoMark: View {
    var asset: PHAsset?
    var fallback: UIImage?
    var count: Int

    var body: some View {
        ZStack(alignment: .topTrailing) {
            PlacePhotoImage(asset: asset, fallback: fallback)
                .frame(width: 54, height: 54)
                .clipShape(Circle())
                .overlay(Circle().strokeBorder(.white, lineWidth: 2))
                .shadow(color: .black.opacity(0.28), radius: 4, y: 2)
            if count > 1 {
                Text(count > 99 ? "99+" : "\(count)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(GalleryTheme.accent, in: Capsule())
                    .offset(x: 6, y: -4)
            }
        }
    }
}

private struct PlacePhotoImage: UIViewRepresentable {
    var asset: PHAsset?
    var fallback: UIImage?

    func makeUIView(context: Context) -> PlacePhotoView { PlacePhotoView() }

    func updateUIView(_ view: PlacePhotoView, context: Context) {
        view.set(asset: asset, fallback: fallback)
    }
}

private final class PlacePhotoView: UIView {
    private let imageView = UIImageView()
    private var request: PHImageRequestID = PHInvalidImageRequestID
    private var currentID: String?

    override init(frame: CGRect) {
        super.init(frame: frame)
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        addSubview(imageView)
        backgroundColor = .secondarySystemFill
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        imageView.frame = bounds
    }

    func set(asset: PHAsset?, fallback: UIImage?) {
        guard let asset else {
            currentID = nil
            imageView.image = fallback
            return
        }
        if currentID == asset.localIdentifier, imageView.image != nil { return }
        currentID = asset.localIdentifier
        if request != PHInvalidImageRequestID {
            PHImageManager.default().cancelImageRequest(request)
        }
        if let fallback { imageView.image = fallback }
        let options = PHImageRequestOptions()
        options.deliveryMode = .opportunistic
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        let scale = max(traitCollection.displayScale, 2)
        let side = max(bounds.width, 54) * scale
        var token = PHInvalidImageRequestID
        token = PHImageManager.default().requestImage(
            for: asset,
            targetSize: CGSize(width: side, height: side),
            contentMode: .aspectFill,
            options: options
        ) { [weak self] image, info in
            let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
            DispatchQueue.main.async {
                guard let self, self.request == token, !cancelled else { return }
                if let image {
                    self.imageView.image = image
                } else if self.imageView.image == nil {
                    self.imageView.image = fallback
                }
            }
        }
        request = token
    }
}

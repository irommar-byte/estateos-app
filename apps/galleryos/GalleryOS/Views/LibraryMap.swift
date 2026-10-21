import MapKit
import Photos
import SwiftUI
import UIKit

extension Notification.Name {
    static let galleryMapLocate = Notification.Name("galleryos.map.locate")
}

struct LibraryMapScreen: View {
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    var focus: CLLocationCoordinate2D?
    @AppStorage("galleryos.map.satellite") private var satellite = false
    @State private var placeAlbum: MapPlaceAlbum?
    @State private var visible = MapVisible.empty

    var body: some View {
        PhotoMapView(
            photos: library.grid.all,
            focus: focus,
            mapType: satellite ? .hybrid : .standard,
            asset: { library.asset(id: $0) },
            thumb: { library.thumbnail(id: $0) },
            onOpen: { ids, coordinate in
                placeAlbum = MapPlaceAlbum(ids: ids, coordinate: coordinate)
            },
            onVisible: { next in
                guard next != visible else { return }
                withAnimation(GalleryTheme.snappy) { visible = next }
            }
        )
        .ignoresSafeArea()
        .overlay(alignment: .topLeading) {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .galleryGlass(in: Circle(), interactive: true)
            .padding(.leading, 16)
            .padding(.top, 6)
            .accessibilityLabel("Wstecz")
        }
        .overlay(alignment: .topTrailing) {
            VStack(spacing: 0) {
                Menu {
                    Picker("Widok mapy", selection: $satellite) {
                        Label("Mapa", systemImage: "map").tag(false)
                        Label("Satelita", systemImage: "globe.europe.africa").tag(true)
                    }
                } label: {
                    Image(systemName: satellite ? "globe.europe.africa.fill" : "map.fill")
                        .contentTransition(.symbolEffect(.replace))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Widok mapy")
                Divider().frame(width: 26)
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    NotificationCenter.default.post(name: .galleryMapLocate, object: nil)
                } label: {
                    Image(systemName: "location")
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Moja lokalizacja")
            }
            .font(.system(size: 17, weight: .medium))
            .foregroundStyle(.primary)
            .buttonStyle(.plain)
            .galleryGlass(in: Capsule(), interactive: true)
            .padding(.trailing, 16)
            .padding(.top, 6)
        }
        .overlay(alignment: .bottom) {
            if !visible.ids.isEmpty {
                Button {
                    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                    placeAlbum = MapPlaceAlbum(ids: visible.ids, coordinate: visible.center)
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "square.grid.2x2.fill")
                            .font(.system(size: 14, weight: .semibold))
                        Text(PhotoFormat.onMap(visible.ids.count))
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .contentTransition(.numericText(value: Double(visible.ids.count)))
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                }
                .buttonStyle(.plain)
                .galleryGlass(in: Capsule(), interactive: true)
                .padding(.bottom, 12)
                .transition(.move(edge: .bottom).combined(with: .opacity).combined(with: .scale(scale: 0.85, anchor: .bottom)))
            }
        }
        .animation(GalleryTheme.snappy, value: satellite)
        .fullScreenCover(item: $placeAlbum) { album in
            MapPlaceAlbumScreen(album: album)
                .environmentObject(library)
        }
    }
}

struct MapVisible: Equatable {
    var ids: [String]
    var center: CLLocationCoordinate2D

    static let empty = MapVisible(ids: [], center: CLLocationCoordinate2D())

    static func == (lhs: MapVisible, rhs: MapVisible) -> Bool {
        lhs.ids == rhs.ids
    }
}

/// One map pin → Photos-style place album (title + count + grid).
private struct MapPlaceAlbum: Identifiable {
    let id = UUID()
    let ids: [String]
    let coordinate: CLLocationCoordinate2D
}

private struct MapPlaceAlbumScreen: View {
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    let album: MapPlaceAlbum
    @State private var title = "Miejsca"
    @State private var viewer: ViewerRequest?

    private var model: GridModel {
        let wanted = Set(album.ids)
        return GridModel(photos: library.grid.all.filter { wanted.contains($0.id) })
    }

    var body: some View {
        let model = model
        NavigationStack {
            PhotoGrid(
                model: model,
                generation: library.generation,
                zoom: .all,
                selection: [],
                selecting: false,
                placeNames: library.placeNames,
                anchor: nil,
                asset: { library.asset(id: $0) },
                thumb: { library.thumbnail(id: $0) },
                loadThumb: { await LibraryEngine.shared.cloudThumb(id: $0) },
                onOpen: { request in
                    let ids = model.all.map(\.id)
                    let index = ids.firstIndex(of: request.id) ?? 0
                    var transaction = Transaction()
                    transaction.disablesAnimations = true
                    withTransaction(transaction) {
                        viewer = ViewerRequest(ids: ids, index: index, origin: request.frame, image: request.image, source: request.source)
                    }
                },
                onSelect: { _ in },
                onFavorite: { id in
                    let current = library.photo(id: id)?.isFavorite ?? false
                    library.setFavorite(!current, ids: [id])
                },
                onConceal: { library.setConcealed(true, ids: [$0]) },
                onZoom: { _, _ in },
                onVisiblePlaces: { _ in }
            )
            .ignoresSafeArea(edges: .bottom)
            .navigationTitle(title)
            .galleryNavigationSubtitle(PhotoFormat.things(model.all.count))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: {
                        Image(systemName: "chevron.left")
                    }
                    .accessibilityLabel("Wstecz")
                }
            }
        }
        .task { await resolveTitle() }
        .fullScreenCover(item: $viewer) { request in
            PhotoViewerHost(request: request)
                .environmentObject(library)
                .presentationBackground(.clear)
        }
    }

    private func resolveTitle() async {
        let location = CLLocation(latitude: album.coordinate.latitude, longitude: album.coordinate.longitude)
        guard let marks = try? await CLGeocoder().reverseGeocodeLocation(location),
              let mark = marks.first else { return }
        let name = mark.name.flatMap { $0.contains("+") ? nil : $0 }
        title = mark.locality ?? name ?? mark.subLocality ?? mark.ocean ?? "Miejsca"
    }
}

private struct PhotoMapView: UIViewRepresentable {
    var photos: [PhotoRef]
    var focus: CLLocationCoordinate2D?
    var mapType: MKMapType
    var asset: (String) -> PHAsset?
    var thumb: (String) -> UIImage?
    var onOpen: ([String], CLLocationCoordinate2D) -> Void
    var onVisible: (MapVisible) -> Void

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.mapType = mapType
        map.showsUserLocation = true
        map.showsCompass = false
        map.register(PhotoPinView.self, forAnnotationViewWithReuseIdentifier: PhotoPinView.reuse)
        let compass = MKCompassButton(mapView: map)
        compass.compassVisibility = .adaptive
        compass.translatesAutoresizingMaskIntoConstraints = false
        map.addSubview(compass)
        NSLayoutConstraint.activate([
            compass.trailingAnchor.constraint(equalTo: map.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            compass.topAnchor.constraint(equalTo: map.safeAreaLayoutGuide.topAnchor, constant: 112)
        ])
        context.coordinator.map = map
        context.coordinator.reload(photos: photos, focus: focus, force: true)
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        if map.mapType != mapType { map.mapType = mapType }
        context.coordinator.asset = asset
        context.coordinator.thumb = thumb
        context.coordinator.onOpen = onOpen
        context.coordinator.onVisible = onVisible
        context.coordinator.reload(photos: photos, focus: focus, force: false)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(asset: asset, thumb: thumb, onOpen: onOpen, onVisible: onVisible)
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        weak var map: MKMapView?
        var asset: (String) -> PHAsset?
        var thumb: (String) -> UIImage?
        var onOpen: ([String], CLLocationCoordinate2D) -> Void
        var onVisible: (MapVisible) -> Void
        private var photos: [PhotoRef] = []
        private var photoSignature = ""
        private var focused = false
        private var level: Int?
        private var observer: NSObjectProtocol?

        init(
            asset: @escaping (String) -> PHAsset?,
            thumb: @escaping (String) -> UIImage?,
            onOpen: @escaping ([String], CLLocationCoordinate2D) -> Void,
            onVisible: @escaping (MapVisible) -> Void
        ) {
            self.asset = asset
            self.thumb = thumb
            self.onOpen = onOpen
            self.onVisible = onVisible
            super.init()
            observer = NotificationCenter.default.addObserver(forName: .galleryMapLocate, object: nil, queue: .main) { [weak self] _ in
                self?.map?.setUserTrackingMode(.follow, animated: true)
            }
        }

        deinit {
            if let observer { NotificationCenter.default.removeObserver(observer) }
        }

        func reload(photos: [PhotoRef], focus: CLLocationCoordinate2D?, force: Bool) {
            let located = photos.filter { $0.latitude != nil && $0.longitude != nil }
            let signature = "\(located.count)|\(located.last?.id ?? "")|\(located.first?.id ?? "")"
            let photosChanged = signature != photoSignature
            self.photos = located
            photoSignature = signature
            if !focused, let map {
                if let focus {
                    focused = true
                    map.setRegion(
                        MKCoordinateRegion(center: focus, span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)),
                        animated: false
                    )
                } else if let latest = located.last, let latitude = latest.latitude, let longitude = latest.longitude {
                    focused = true
                    map.setRegion(
                        MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                            span: MKCoordinateSpan(latitudeDelta: 4, longitudeDelta: 4)
                        ),
                        animated: false
                    )
                }
            }
            if force || photosChanged {
                regroup(level: currentLevel(), animated: false)
                publishVisible()
            }
        }

        // MARK: Clustering

        /// Power-of-two grid so clusters nest: zooming in splits a pin into its children, zooming out merges them.
        private func rawLevel() -> Double {
            guard let map else { return 0 }
            return log2(max(map.region.span.latitudeDelta, 0.0005) / 5)
        }

        private func currentLevel() -> Int {
            let raw = rawLevel()
            if let level, raw > Double(level) - 0.2, raw < Double(level) + 1.2 { return level }
            return Int(floor(raw))
        }

        private static func step(_ level: Int) -> Double { pow(2, Double(level)) }

        private static func key(_ latitude: Double, _ longitude: Double, level: Int) -> String {
            let step = Self.step(level)
            return "\(level):\(Int(floor(latitude / step))),\(Int(floor(longitude / step)))"
        }

        func mapViewDidChangeVisibleRegion(_ mapView: MKMapView) {
            let next = currentLevel()
            guard next != level else { return }
            regroup(level: next, animated: true)
        }

        func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
            let next = currentLevel()
            if next != level { regroup(level: next, animated: true) }
            publishVisible()
        }

        private func publishVisible() {
            guard let map else { return }
            let region = map.region
            let minLat = region.center.latitude - region.span.latitudeDelta / 2
            let maxLat = region.center.latitude + region.span.latitudeDelta / 2
            let minLon = region.center.longitude - region.span.longitudeDelta / 2
            let maxLon = region.center.longitude + region.span.longitudeDelta / 2
            let ids = photos.compactMap { photo -> String? in
                guard let latitude = photo.latitude, let longitude = photo.longitude,
                      latitude >= minLat, latitude <= maxLat,
                      longitude >= minLon, longitude <= maxLon else { return nil }
                return photo.id
            }
            onVisible(MapVisible(ids: ids, center: region.center))
        }

        private func regroup(level next: Int, animated: Bool) {
            guard let map else { return }
            let previous = level
            level = next
            var buckets: [String: (coordinate: CLLocationCoordinate2D, ids: [String], cover: String, coverAt: CLLocationCoordinate2D)] = [:]
            for photo in photos {
                guard let latitude = photo.latitude, let longitude = photo.longitude else { continue }
                let key = Self.key(latitude, longitude, level: next)
                let at = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
                if var existing = buckets[key] {
                    existing.ids.append(photo.id)
                    // Keep the first photo. The album grid shows that one at the top left.
                    let n = Double(existing.ids.count)
                    existing.coordinate = CLLocationCoordinate2D(
                        latitude: existing.coordinate.latitude + (latitude - existing.coordinate.latitude) / n,
                        longitude: existing.coordinate.longitude + (longitude - existing.coordinate.longitude) / n
                    )
                    buckets[key] = existing
                } else {
                    buckets[key] = (at, [photo.id], photo.id, at)
                }
            }

            let current = map.annotations.compactMap { $0 as? PhotoPin }.filter { !$0.leaving }
            let parents = Dictionary(current.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })
            var byKey = parents
            var toAdd: [PhotoPin] = []
            for (key, value) in buckets {
                if let pin = byKey.removeValue(forKey: key) {
                    let coverChanged = pin.coverID != value.cover
                    pin.ids = value.ids
                    pin.coverID = value.cover
                    pin.coverAt = value.coverAt
                    if abs(pin.coordinate.latitude - value.coordinate.latitude) > 0.00001
                        || abs(pin.coordinate.longitude - value.coordinate.longitude) > 0.00001 {
                        pin.coordinate = value.coordinate
                    }
                    if let view = map.view(for: pin) as? PhotoPinView {
                        view.applyCount(pin.ids.count)
                        if coverChanged {
                            view.configure(pin: pin, asset: asset(pin.coverID), thumb: thumb(pin.coverID))
                        }
                    }
                } else {
                    let pin = PhotoPin(key: key, coordinate: value.coordinate, ids: value.ids, coverID: value.cover, coverAt: value.coverAt)
                    if animated, let previous,
                       let parent = parents[Self.key(value.coverAt.latitude, value.coverAt.longitude, level: previous)] {
                        pin.origin = parent.coordinate
                    }
                    toAdd.append(pin)
                }
            }

            let leaving = Array(byKey.values)
            if animated {
                for pin in leaving {
                    pin.leaving = true
                    guard let view = map.view(for: pin) else { continue }
                    let target = buckets[Self.key(pin.coverAt.latitude, pin.coverAt.longitude, level: next)]?.coordinate
                    let delta: CGPoint
                    if let target {
                        let to = map.convert(target, toPointTo: map)
                        let from = map.convert(pin.coordinate, toPointTo: map)
                        delta = CGPoint(x: to.x - from.x, y: to.y - from.y)
                    } else {
                        delta = .zero
                    }
                    view.layer.zPosition = -1
                    UIView.animate(withDuration: 0.34, delay: 0, usingSpringWithDamping: 0.9, initialSpringVelocity: 0, options: [.beginFromCurrentState]) {
                        view.transform = CGAffineTransform(translationX: delta.x, y: delta.y).scaledBy(x: 0.6, y: 0.6)
                        view.alpha = 0
                    } completion: { _ in
                        map.removeAnnotation(pin)
                    }
                }
                let silent = leaving.filter { map.view(for: $0) == nil }
                if !silent.isEmpty { map.removeAnnotations(silent) }
            } else if !leaving.isEmpty {
                map.removeAnnotations(leaving)
            }
            if !toAdd.isEmpty {
                if !animated { toAdd.forEach { $0.origin = nil; $0.quiet = true } }
                map.addAnnotations(toAdd)
            }
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let pin = annotation as? PhotoPin else { return nil }
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: PhotoPinView.reuse, for: pin) as! PhotoPinView
            view.annotation = pin
            view.transform = .identity
            view.alpha = 1
            view.layer.zPosition = 0
            view.configure(pin: pin, asset: asset(pin.coverID), thumb: thumb(pin.coverID))
            return view
        }

        func mapView(_ mapView: MKMapView, didAdd views: [MKAnnotationView]) {
            for view in views {
                guard let pin = view.annotation as? PhotoPin else { continue }
                defer { pin.origin = nil }
                if pin.quiet {
                    pin.quiet = false
                    continue
                }
                if let origin = pin.origin {
                    let from = mapView.convert(origin, toPointTo: mapView)
                    let to = mapView.convert(pin.coordinate, toPointTo: mapView)
                    view.transform = CGAffineTransform(translationX: from.x - to.x, y: from.y - to.y).scaledBy(x: 0.6, y: 0.6)
                } else {
                    view.transform = CGAffineTransform(scaleX: 0.3, y: 0.3)
                }
                view.alpha = 0
                UIView.animate(withDuration: 0.42, delay: 0, usingSpringWithDamping: 0.78, initialSpringVelocity: 0, options: [.allowUserInteraction, .beginFromCurrentState]) {
                    view.transform = .identity
                    view.alpha = 1
                }
            }
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            guard let pin = view.annotation as? PhotoPin else { return }
            mapView.deselectAnnotation(pin, animated: false)
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            UIView.animate(withDuration: 0.12, animations: {
                view.transform = CGAffineTransform(scaleX: 0.9, y: 0.9)
            }, completion: { _ in
                UIView.animate(withDuration: 0.36, delay: 0, usingSpringWithDamping: 0.6, initialSpringVelocity: 0) {
                    view.transform = .identity
                }
            })
            onOpen(pin.ids, pin.coordinate)
        }
    }
}

private final class PhotoPin: NSObject, MKAnnotation {
    let key: String
    @objc dynamic var coordinate: CLLocationCoordinate2D
    var ids: [String]
    var coverID: String
    var coverAt: CLLocationCoordinate2D
    var origin: CLLocationCoordinate2D?
    var leaving = false
    var quiet = false

    init(key: String, coordinate: CLLocationCoordinate2D, ids: [String], coverID: String, coverAt: CLLocationCoordinate2D) {
        self.key = key
        self.coordinate = coordinate
        self.ids = ids
        self.coverID = coverID
        self.coverAt = coverAt
    }
}

/// Photos-style tile: rounded photo, white rim, soft shadow, count badge on the corner.
private final class PhotoPinView: MKAnnotationView {
    static let reuse = "PhotoPinView"
    private let photo = UIImageView()
    private let badge = UILabel()
    private var request: PHImageRequestID = PHInvalidImageRequestID
    private var currentID: String?
    private let side: CGFloat = 62

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        frame = CGRect(x: 0, y: 0, width: side, height: side)
        backgroundColor = .clear
        canShowCallout = false
        displayPriority = .required
        collisionMode = .rectangle
        photo.contentMode = .scaleAspectFill
        photo.clipsToBounds = true
        photo.layer.cornerRadius = 13
        photo.layer.cornerCurve = .continuous
        photo.layer.borderWidth = 2.5
        photo.layer.borderColor = UIColor.white.cgColor
        photo.frame = bounds
        photo.backgroundColor = .secondarySystemFill
        addSubview(photo)
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.3
        layer.shadowRadius = 6
        layer.shadowOffset = CGSize(width: 0, height: 3)
        layer.shadowPath = UIBezierPath(roundedRect: bounds, cornerRadius: 13).cgPath
        badge.font = .monospacedDigitSystemFont(ofSize: 12, weight: .bold)
        badge.textColor = .white
        badge.textAlignment = .center
        badge.backgroundColor = .systemBlue
        badge.layer.borderColor = UIColor.white.cgColor
        badge.layer.borderWidth = 1.5
        badge.layer.cornerCurve = .continuous
        badge.clipsToBounds = true
        addSubview(badge)
    }

    required init?(coder: NSCoder) { nil }

    func applyCount(_ count: Int) {
        badge.isHidden = count < 2
        badge.text = count > 999 ? "999+" : "\(count)"
        let width = max(22, badge.intrinsicContentSize.width + 12)
        badge.frame = CGRect(x: side - width + 7, y: -7, width: width, height: 22)
        badge.layer.cornerRadius = 11
    }

    func configure(pin: PhotoPin, asset: PHAsset?, thumb: UIImage?) {
        applyCount(pin.ids.count)
        let id = pin.coverID
        guard id != currentID || photo.image == nil else { return }
        if request != PHInvalidImageRequestID {
            PHImageManager.default().cancelImageRequest(request)
            request = PHInvalidImageRequestID
        }
        // Drop the previous pin immediately. A reused view otherwise keeps showing another place.
        photo.image = thumb
        currentID = id
        guard let asset else { return }
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .exact
        options.isNetworkAccessAllowed = true
        let scale = max(traitCollection.displayScale, 2)
        // The cached result can arrive before this call returns, so the callback checks `currentID`,
        // which is already the pin we want, not the request number assigned afterwards.
        request = PHImageManager.default().requestImage(
            for: asset,
            targetSize: CGSize(width: side * scale, height: side * scale),
            contentMode: .aspectFill,
            options: options
        ) { [weak self] image, info in
            let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
            DispatchQueue.main.async {
                guard let self, self.currentID == id, !cancelled, let image else { return }
                self.photo.image = image
            }
        }
    }
}

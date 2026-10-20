import AVFoundation
import CoreLocation
import Photos
import SwiftUI
import UIKit

struct GridAnchor: Equatable {
    var id: String
    var atTop: Bool
}

struct OpenRequest {
    var id: String
    var frame: CGRect
    var image: UIImage?
    weak var source: (any ViewerTransitionSource)?
}

/// Grid that hands its tiles to the full-screen viewer and takes them back, like Photos.
@MainActor
protocol ViewerTransitionSource: AnyObject {
    func viewerFrame(for id: String) -> CGRect?
    func viewerReveal(_ id: String)
    func viewerHide(_ id: String?)
}

struct PhotoGrid: UIViewControllerRepresentable {
    var model: GridModel
    var generation: Int
    var zoom: PhotoZoom
    var selection: Set<String>
    var selecting: Bool
    var placeNames: [String: String]
    var density: CGFloat = 3
    var synced: (String) -> Bool = { _ in false }
    var showsSync = false
    var anchor: GridAnchor?
    var asset: (String) -> PHAsset?
    var thumb: (String) -> UIImage? = { _ in nil }
    var loadThumb: (String) async -> UIImage? = { _ in nil }
    var onOpen: (OpenRequest) -> Void
    var onSelect: (String) -> Void
    var onFavorite: (String) -> Void
    var onSelectionSet: (Set<String>) -> Void = { _ in }
    var onDelete: ((String) -> Void)?
    var onZoom: (PhotoZoom, GridAnchor?) -> Void
    var onDensity: (CGFloat) -> Void = { _ in }
    var onCaption: (String) -> Void = { _ in }
    var onPlace: (CLLocationCoordinate2D) -> Void = { _ in }
    var onVisiblePlaces: ([PlaceRequest]) -> Void

    func makeUIViewController(context: Context) -> PhotoGridController {
        let controller = PhotoGridController()
        controller.apply(
            model: model,
            generation: generation,
            zoom: zoom,
            selection: selection,
            selecting: selecting,
            placeNames: placeNames,
            anchor: anchor
        )
        bind(controller)
        controller.attachAssets(asset)
        controller.setDensity(density, notify: false)
        return controller
    }

    func updateUIViewController(_ controller: PhotoGridController, context: Context) {
        bind(controller)
        controller.attachAssets(asset)
        controller.apply(
            model: model,
            generation: generation,
            zoom: zoom,
            selection: selection,
            selecting: selecting,
            placeNames: placeNames,
            anchor: anchor
        )
        if !controller.isPinching {
            controller.setDensity(density, notify: false)
        }
    }

    private func bind(_ controller: PhotoGridController) {
        controller.onOpen = onOpen
        controller.onSelect = onSelect
        controller.onFavorite = onFavorite
        controller.onSelectionSet = onSelectionSet
        controller.onDelete = onDelete
        controller.onZoom = onZoom
        controller.onDensity = onDensity
        controller.onCaption = onCaption
        controller.onPlace = onPlace
        controller.onVisiblePlaces = onVisiblePlaces
        controller.thumb = thumb
        controller.loadThumb = loadThumb
        controller.synced = synced
        controller.showsSync = showsSync
    }
}

final class PhotoGridController: UIViewController, UICollectionViewDataSource, UICollectionViewDelegate {
    var onOpen: (OpenRequest) -> Void = { _ in }
    var onSelect: (String) -> Void = { _ in }
    var onFavorite: (String) -> Void = { _ in }
    var onSelectionSet: (Set<String>) -> Void = { _ in }
    var onDelete: ((String) -> Void)?
    var onZoom: (PhotoZoom, GridAnchor?) -> Void = { _, _ in }
    var onDensity: (CGFloat) -> Void = { _ in }
    var onCaption: (String) -> Void = { _ in }
    var onPlace: (CLLocationCoordinate2D) -> Void = { _ in }
    var onVisiblePlaces: ([PlaceRequest]) -> Void = { _ in }
    var thumb: (String) -> UIImage? = { _ in nil }
    var loadThumb: (String) async -> UIImage? = { _ in nil }
    var synced: (String) -> Bool = { _ in false }
    var showsSync = false

    private let layout = LibraryLayout()
    private var collection: UICollectionView!
    private var model = GridModel.empty
    private var generation = -1
    private var zoom = PhotoZoom.days
    private var selection = Set<String>()
    private var selecting = false
    private var placeNames: [String: String] = [:]
    private var pendingAnchor: GridAnchor?
    private var didInitialScroll = false
    private var pinchAnchorID: String?
    private var pinchFraction: CGFloat = 0
    private var pinchScreenY: CGFloat = 0
    private var pinching = false
    private var photoIDs: [String] = []
    private var sourceIDs: [String] = []
    private var deferredStructure = false
    private var densityLink: CADisplayLink?
    private var densityFrom: CGFloat = 3
    private var densityTo: CGFloat = 3
    private var densityStarted = 0.0
    private var capsuleLabels: [UILabel] = []
    private var lastCaption = ""
    private var scrolling = false
    private let thumbs = GridImageStore.shared
    private var retryTimer: Timer?
    var isPinching: Bool { pinching }
    private let imageManager = PHCachingImageManager()
    private let cacheOptions: PHImageRequestOptions = {
        let options = PHImageRequestOptions()
        options.deliveryMode = .fastFormat
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        options.isSynchronous = false
        return options
    }()
    private var assetLookup: (String) -> PHAsset? = { _ in nil }
    private var cachedIDs: [String] = []
    private var lastCacheOffset: CGFloat = -.greatestFiniteMagnitude
    private var cachePixel: CGFloat = 0
    private let pinnedHeader = DayHeader(frame: .zero)
    private let chronology = ChronologyScrubber()
    private var pinnedKey: String?
    private var pinnedPlace: String?
    private var modelStamp = ""
    private var hiddenID: String?
    private let selectPan = UIPanGestureRecognizer()
    private var swipeStart: Int?
    private var swipeAdds = true
    private var swipeBase = Set<String>()
    private var swipeLast: Int?
    private var swipePoint: CGPoint = .zero
    private var swipeLink: CADisplayLink?
    private var orderCache: (stamp: Int, ids: [String], index: [String: Int])?

    func attachAssets(_ lookup: @escaping (String) -> PHAsset?) {
        assetLookup = lookup
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        collection = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collection.backgroundColor = .secondarySystemBackground
        collection.alwaysBounceVertical = true
        collection.contentInsetAdjustmentBehavior = .automatic
        collection.decelerationRate = UIScrollView.DecelerationRate(rawValue: 0.994)
        collection.panGestureRecognizer.maximumNumberOfTouches = 1
        collection.dataSource = self
        collection.delegate = self
        collection.prefetchDataSource = self
        collection.register(PhotoThumbCell.self, forCellWithReuseIdentifier: PhotoThumbCell.reuse)
        collection.register(HeroThumbCell.self, forCellWithReuseIdentifier: HeroThumbCell.reuse)
        collection.register(
            DayHeader.self,
            forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader,
            withReuseIdentifier: DayHeader.reuse
        )
        view.addSubview(collection)
        chronology.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(chronology)
        NSLayoutConstraint.activate([
            chronology.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            chronology.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            chronology.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -8),
            chronology.widthAnchor.constraint(equalToConstant: 36)
        ])
        chronology.onScrub = { [weak self] offset in
            self?.scrollToChronology(offset)
        }
        collection.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            collection.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collection.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collection.topAnchor.constraint(equalTo: view.topAnchor),
            collection.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        let pinch = UIPinchGestureRecognizer(target: self, action: #selector(pinched(_:)))
        pinch.delegate = self
        collection.addGestureRecognizer(pinch)
        selectPan.addTarget(self, action: #selector(swipeSelect(_:)))
        selectPan.delegate = self
        selectPan.maximumNumberOfTouches = 1
        collection.addGestureRecognizer(selectPan)
        collection.panGestureRecognizer.require(toFail: selectPan)
        pinnedHeader.isHidden = true
        pinnedHeader.isUserInteractionEnabled = true
        pinnedHeader.layer.zPosition = 800
        collection.addSubview(pinnedHeader)
        layout.markDirty()
        collection.reloadData()
        startThumbRetry()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        clearBottomBar()
        flushAnchor()
        updatePinnedHeader()
        refreshChronology()
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        clearBottomBar()
    }

    private func fillThumb(id: String, cell: PhotoThumbCell) {
        let asset = assetLookup(id)
        let fallback = thumbs.cached(id) ?? thumb(id)
        if let fallback {
            cell.applyCloudThumb(fallback, id: id)
        }
        let scale = max(collection?.traitCollection.displayScale ?? 2, 2)
        let side = max(cell.bounds.width, 120) * scale
        let pixel = CGSize(width: side, height: side)
        thumbs.load(
            id: id,
            asset: asset,
            fallback: fallback,
            pixel: pixel,
            server: { [loadThumb] in await loadThumb(id) }
        ) { [weak self, weak cell] readyID, image in
            guard let self else { return }
            if let cell, cell.displays(id: readyID) {
                cell.applyCloudThumb(image, id: readyID)
            } else {
                self.applyCached(readyID, image)
            }
        }
    }

    private func applyCached(_ id: String, _ image: UIImage) {
        guard let collection else { return }
        for indexPath in collection.indexPathsForVisibleItems {
            guard photoID(at: indexPath) == id,
                  let cell = collection.cellForItem(at: indexPath) as? PhotoThumbCell else { continue }
            cell.applyCloudThumb(image, id: id)
        }
    }

    private func fillVisibleThumbs() {
        guard let collection else { return }
        for indexPath in collection.indexPathsForVisibleItems {
            guard let id = photoID(at: indexPath),
                  let cell = collection.cellForItem(at: indexPath) as? PhotoThumbCell,
                  !cell.hasImage else { continue }
            fillThumb(id: id, cell: cell)
        }
    }

    private func startThumbRetry() {
        retryTimer?.invalidate()
        // Only refill still-empty tiles — never shimmer already-painted ones.
        retryTimer = Timer.scheduledTimer(withTimeInterval: 2.4, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.fillVisibleThumbs() }
        }
    }

    deinit {
        retryTimer?.invalidate()
    }

    private func refreshChronology() {
        guard let collection else { return }
        chronology.setMarks(layout.chronologyMarks(), span: layout.chronologyHeight)
        chronology.follow(offset: collection.contentOffset.y + collection.adjustedContentInset.top)
    }

    private func scrollToChronology(_ offset: CGFloat) {
        guard let collection else { return }
        let top = collection.adjustedContentInset.top
        let maxOffset = max(-top, collection.contentSize.height - collection.bounds.height + collection.adjustedContentInset.bottom)
        let y = min(max(offset - top, -top), maxOffset)
        collection.setContentOffset(CGPoint(x: 0, y: y), animated: false)
    }

    private func clearBottomBar() {
        guard let collection else { return }
        let bottom = view.safeAreaInsets.bottom
        guard bottom > 1 else { return }
        let missing = bottom - collection.adjustedContentInset.bottom
        guard missing > 1 else { return }
        collection.contentInset.bottom += missing
        let maxOffset = collection.contentSize.height - collection.bounds.height + collection.adjustedContentInset.bottom
        if didInitialScroll, collection.contentOffset.y > maxOffset - bottom {
            collection.contentOffset.y = max(-collection.adjustedContentInset.top, maxOffset)
        }
    }

    func setDensity(_ value: CGFloat, notify: Bool) {
        let clamped = min(10, max(1, value))
        guard abs(layout.columns - clamped) > 0.02 else { return }
        layout.columns = clamped
        layout.markDirty()
        collection?.collectionViewLayout.invalidateLayout()
        if notify { onDensity(clamped) }
        publishCaption()
        placeCapsules()
    }

    func apply(
        model: GridModel,
        generation: Int,
        zoom: PhotoZoom,
        selection: Set<String>,
        selecting: Bool,
        placeNames: [String: String],
        anchor: GridAnchor?
    ) {
        let incomingIDs = model.all.map(\.id)
        if incomingIDs == sourceIDs, zoom == self.zoom {
            self.selection = selection
            self.selecting = selecting
            self.placeNames = placeNames
            layout.placeNames = placeNames
            refreshVisibleChrome()
            updatePinnedHeader()
            return
        }
        sourceIDs = incomingIDs
        // Show every photo — never hide tiles while a preview is still downloading.
        let ids = model.all.map(\.id)
        let structureChanged = zoom != self.zoom || ids != photoIDs
        let keep = didInitialScroll ? (anchor ?? centerAnchor()) : anchor
        self.model = model
        self.zoom = zoom
        self.selection = selection
        self.selecting = selecting
        self.placeNames = placeNames
        layout.model = model
        layout.zoom = zoom
        layout.placeNames = placeNames
        guard structureChanged else {
            refreshVisibleChrome()
            fillVisibleThumbs()
            updatePinnedHeader()
            return
        }
        self.generation = generation
        if collection?.isDragging == true || collection?.isDecelerating == true {
            deferredStructure = true
            return
        }
        commitStructure(anchor: keep, ids: ids)
    }

    private func commitStructure(anchor: GridAnchor?, ids: [String]) {
        let previous = photoIDs
        photoIDs = ids
        orderCache = nil
        deferredStructure = false
        let kept = didInitialScroll ? collection?.contentOffset : nil
        layout.markDirty()
        pendingAnchor = kept == nil ? anchor : nil
        // Incremental inserts: keep PH caching warm. Only flush on big jumps / zoom changes.
        let smallDelta = abs(ids.count - previous.count) <= 8
            && !previous.isEmpty
            && Set(ids).intersection(previous).count >= max(0, min(ids.count, previous.count) - 8)
        if !smallDelta {
            imageManager.stopCachingImagesForAllAssets()
            cachedIDs = []
            lastCacheOffset = -.greatestFiniteMagnitude
        }
        collection?.reloadData()
        if let kept, let collection {
            collection.layoutIfNeeded()
            let top = -collection.adjustedContentInset.top
            let maxOffset = max(top, collection.contentSize.height - collection.bounds.height + collection.adjustedContentInset.bottom)
            collection.contentOffset.y = min(max(kept.y, top), maxOffset)
        }
        refreshChronology()
        placeCapsules()
    }

    func numberOfSections(in collectionView: UICollectionView) -> Int {
        zoom == .days ? model.days.count : 1
    }

    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        switch zoom {
        case .days:
            guard model.days.indices.contains(section) else { return 0 }
            return model.days[section].photos.count
        case .months: return model.months.count
        case .years: return model.years.count
        case .all: return model.all.count
        }
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        switch zoom {
        case .years:
            let year = model.years[indexPath.item]
            let cell = collectionView.dequeueReusableCell(withReuseIdentifier: HeroThumbCell.reuse, for: indexPath) as! HeroThumbCell
            cell.configure(
                title: year.title,
                subtitle: PhotoFormat.count(year.count),
                asset: assetLookup(year.coverID),
                manager: imageManager,
                fallback: thumb(year.coverID)
            )
            return cell
        case .months:
            guard model.months.indices.contains(indexPath.item) else {
                return collectionView.dequeueReusableCell(withReuseIdentifier: HeroThumbCell.reuse, for: indexPath)
            }
            let month = model.months[indexPath.item]
            let cell = collectionView.dequeueReusableCell(withReuseIdentifier: HeroThumbCell.reuse, for: indexPath) as! HeroThumbCell
            cell.configure(
                title: month.title,
                subtitle: month.yearTitle,
                asset: assetLookup(month.coverID),
                manager: imageManager,
                fallback: thumb(month.coverID)
            )
            return cell
        case .days, .all:
            guard let photo = photo(at: indexPath) else {
                return collectionView.dequeueReusableCell(withReuseIdentifier: PhotoThumbCell.reuse, for: indexPath)
            }
            let cell = collectionView.dequeueReusableCell(withReuseIdentifier: PhotoThumbCell.reuse, for: indexPath) as! PhotoThumbCell
            cell.configure(
                photo: photo,
                asset: assetLookup(photo.id),
                selecting: selecting,
                selected: selection.contains(photo.id),
                sync: mark(for: photo.id),
                image: thumbs.cached(photo.id) ?? thumb(photo.id)
            )
            cell.contentView.alpha = photo.id == hiddenID ? 0 : 1
            fillThumb(id: photo.id, cell: cell)
            return cell
        }
    }

    func collectionView(
        _ collectionView: UICollectionView,
        viewForSupplementaryElementOfKind kind: String,
        at indexPath: IndexPath
    ) -> UICollectionReusableView {
        let header = collectionView.dequeueReusableSupplementaryView(
            ofKind: kind,
            withReuseIdentifier: DayHeader.reuse,
            for: indexPath
        ) as! DayHeader
        guard model.days.indices.contains(indexPath.section) else { return header }
        let day = model.days[indexPath.section]
        header.configure(title: day.title, place: placeNames[day.key])
        header.onTap = { [weak self] in
            guard let self, let latitude = day.latitude, let longitude = day.longitude else { return }
            self.onPlace(CLLocationCoordinate2D(latitude: latitude, longitude: longitude))
        }
        return header
    }

    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        switch zoom {
        case .years:
            let year = model.years[indexPath.item]
            let month = model.months.last { $0.id.hasPrefix(year.id) }
            onZoom(.months, month.map { GridAnchor(id: $0.id, atTop: false) })
        case .months:
            let month = model.months[indexPath.item]
            let day = model.days.first { $0.key.hasPrefix(month.id) }
            onZoom(.days, day?.photos.first.map { GridAnchor(id: $0.id, atTop: true) })
        case .days, .all:
            guard let photo = photo(at: indexPath) else { return }
            if selecting {
                onSelect(photo.id)
                return
            }
            let cell = collectionView.cellForItem(at: indexPath) as? PhotoThumbCell
            let frame = cell.flatMap { collectionView.convert($0.frame, to: nil) } ?? .zero
            onOpen(OpenRequest(id: photo.id, frame: frame, image: cell?.currentImage ?? thumbs.cached(photo.id) ?? thumb(photo.id), source: self))
        }
    }

    func collectionView(
        _ collectionView: UICollectionView,
        contextMenuConfigurationForItemAt indexPath: IndexPath,
        point: CGPoint
    ) -> UIContextMenuConfiguration? {
        guard zoom == .days || zoom == .all, !selecting, let photo = photo(at: indexPath) else { return nil }
        let image = (collectionView.cellForItem(at: indexPath) as? PhotoThumbCell)?.currentImage
            ?? thumbs.cached(photo.id) ?? thumb(photo.id)
        let asset = assetLookup(photo.id)
        return UIContextMenuConfiguration(identifier: photo.id as NSString) {
            PhotoPeekController(photo: photo, asset: asset, placeholder: image)
        } actionProvider: { [weak self] _ in
            guard let self else { return nil }
            var top: [UIMenuElement] = []
            if asset != nil {
                top.append(UIAction(title: "Kopiuj", image: UIImage(systemName: "doc.on.doc")) { _ in
                    PhotoPeekController.copy(asset)
                })
                top.append(UIAction(title: "Udostępnij", image: UIImage(systemName: "square.and.arrow.up")) { [weak self] _ in
                    guard let self else { return }
                    PhotoSharing.present(ids: [photo.id], asset: self.assetLookup, from: self)
                })
            }
            top.append(UIAction(
                title: photo.isFavorite ? "Usuń z ulubionych" : "Ulubione",
                image: UIImage(systemName: photo.isFavorite ? "heart.slash" : "heart")
            ) { [weak self] _ in
                self?.onFavorite(photo.id)
            })
            var sections: [UIMenuElement] = [UIMenu(options: .displayInline, children: top)]
            if let onDelete = self.onDelete {
                sections.append(UIMenu(options: .displayInline, children: [
                    UIAction(title: "Usuń", image: UIImage(systemName: "trash"), attributes: .destructive) { _ in
                        onDelete(photo.id)
                    }
                ]))
            }
            return UIMenu(children: sections)
        }
    }

    func collectionView(
        _ collectionView: UICollectionView,
        willPerformPreviewActionForMenuWith configuration: UIContextMenuConfiguration,
        animator: UIContextMenuInteractionCommitAnimating
    ) {
        guard let id = configuration.identifier as? String,
              let indexPath = layout.indexPath(for: id) else { return }
        animator.preferredCommitStyle = .dismiss
        animator.addCompletion { [weak self] in
            self?.collectionView(collectionView, didSelectItemAt: indexPath)
        }
    }

    func collectionView(_ collectionView: UICollectionView, willDisplay cell: UICollectionViewCell, forItemAt indexPath: IndexPath) {
        guard let id = photoID(at: indexPath) else { return }
        if id.hasPrefix("cloud:") {
            var ids = [id]
            let next = IndexPath(item: indexPath.item + 1, section: indexPath.section)
            if let ahead = photoID(at: next) { ids.append(ahead) }
            LibraryEngine.shared.prioritizeThumbs(ids)
        }
        if let thumbCell = cell as? PhotoThumbCell {
            thumbCell.contentView.alpha = id == hiddenID ? 0 : 1
            fillThumb(id: id, cell: thumbCell)
        }
        focusLoop()
    }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        updatePinnedHeader()
        focusLoop()
        chronology.follow(offset: scrollView.contentOffset.y + scrollView.adjustedContentInset.top)
        placeCapsules()
        publishCaption()
        let y = scrollView.contentOffset.y
        guard abs(y - lastCacheOffset) > 140 else { return }
        lastCacheOffset = y
        updateCache()
    }

    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
        scrolling = true
    }

    func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
        guard !decelerate else { return }
        scrolling = false
        finishDeferredStructure()
        refreshVisibleImages()
    }

    func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
        scrolling = false
        finishDeferredStructure()
        refreshVisibleImages()
    }

    private func refreshVisibleImages() {
        fillVisibleThumbs()
    }

    private func finishDeferredStructure() {
        guard deferredStructure else { return }
        commitStructure(anchor: centerAnchor(), ids: model.all.map(\.id))
    }

    @objc private func pinched(_ gesture: UIPinchGestureRecognizer) {
        guard zoom == .days || zoom == .all else { return }
        let finger = gesture.location(in: collection)
        switch gesture.state {
        case .began:
            densityLink?.invalidate()
            pinching = true
            pinchAnchorID = collection.indexPathForItem(at: finger).map { photoID(at: $0) ?? groupID(at: $0) }
            if let id = pinchAnchorID, let frame = layout.frame(for: id), frame.height > 1 {
                pinchFraction = min(1, max(0, (finger.y - frame.minY) / frame.height))
            } else {
                pinchFraction = 0
            }
            pinchScreenY = finger.y - collection.contentOffset.y
        case .changed:
            let next = min(10, max(1, layout.columns / max(gesture.scale, 0.2)))
            layout.columns = next
            layout.markDirty()
            collection.collectionViewLayout.invalidateLayout()
            collection.layoutIfNeeded()
            holdPinch(fingerScreenY: pinchScreenY)
            placeCapsules()
            publishCaption()
            gesture.scale = 1
        case .ended, .cancelled:
            pinching = false
            let stages: [CGFloat] = [1, 3, 5, 9]
            let target = stages.min { abs($0 - layout.columns) < abs($1 - layout.columns) } ?? layout.columns
            UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.6)
            springDensity(to: target)
            pinchAnchorID = nil
        default:
            break
        }
    }

    private func holdPinch(fingerScreenY: CGFloat) {
        guard let id = pinchAnchorID, let frame = layout.frame(for: id) else { return }
        let y = frame.minY + pinchFraction * frame.height - fingerScreenY
        let top = -collection.adjustedContentInset.top
        let maxOffset = max(top, collection.contentSize.height - collection.bounds.height + collection.adjustedContentInset.bottom)
        collection.contentOffset.y = min(max(y, top), maxOffset)
    }

    private func springDensity(to target: CGFloat) {
        densityFrom = layout.columns
        densityTo = target
        densityStarted = CACurrentMediaTime()
        densityLink?.invalidate()
        let link = CADisplayLink(target: self, selector: #selector(stepDensity))
        link.add(to: .main, forMode: .common)
        densityLink = link
    }

    @objc private func stepDensity() {
        let t = min(1, (CACurrentMediaTime() - densityStarted) / 0.42)
        let eased = 1 - pow(1 - t, 3)
        layout.columns = densityFrom + (densityTo - densityFrom) * eased
        layout.markDirty()
        collection.collectionViewLayout.invalidateLayout()
        collection.layoutIfNeeded()
        holdPinch(fingerScreenY: pinchScreenY)
        placeCapsules()
        publishCaption()
        guard t >= 1 else { return }
        densityLink?.invalidate()
        densityLink = nil
        onDensity(layout.columns)
    }

    private func publishCaption() {
        guard let collection else { return }
        let columns = layout.columns
        let text: String
        if columns < 1.7 || (columns >= 4.2 && columns < 7.5),
           let path = collection.indexPathsForVisibleItems.min(by: { $0.section < $1.section || ($0.section == $1.section && $0.item < $1.item) }),
           model.days.indices.contains(path.section) {
            let day = model.days[path.section]
            text = columns < 1.7 ? PhotoGrouping.dayTitle(for: day.date) : day.title
        } else {
            text = ""
        }
        guard text != lastCaption else { return }
        lastCaption = text
        onCaption(text)
    }

    private func placeCapsules() {
        guard let collection else { return }
        let marks = layout.capsules
        while capsuleLabels.count < marks.count {
            let label = UILabel()
            label.font = .systemFont(ofSize: 13, weight: .semibold)
            label.textColor = .white
            label.backgroundColor = UIColor.black.withAlphaComponent(0.55)
            label.textAlignment = .center
            label.layer.cornerRadius = 13
            label.layer.cornerCurve = .continuous
            label.clipsToBounds = true
            label.isUserInteractionEnabled = false
            label.layer.zPosition = 700
            collection.addSubview(label)
            capsuleLabels.append(label)
        }
        for (index, label) in capsuleLabels.enumerated() {
            guard index < marks.count else {
                label.isHidden = true
                continue
            }
            label.isHidden = false
            label.text = marks[index].title
            let width = label.sizeThatFits(CGSize(width: 200, height: 26)).width + 18
            var frame = marks[index].frame
            frame.size = CGSize(width: width, height: 26)
            label.frame = frame
        }
    }

    private var looping = Set<String>()

    /// Every visible GIF plays, not only the cell under the middle of the screen.
    private func focusLoop() {
        guard let collection, zoom == .days || zoom == .all else { return }
        let visible = collection.indexPathsForVisibleItems.compactMap { path -> String? in
            guard let photo = photo(at: path), photo.traits.contains(.animated), !photo.traits.isVideo else { return nil }
            return photo.id
        }
        let next = Set(visible.prefix(12))
        guard next != looping else { return }
        for id in looping.subtracting(next) {
            if let path = layout.indexPath(for: id) {
                (collection.cellForItem(at: path) as? PhotoThumbCell)?.setLooping(false)
            }
        }
        for id in next.subtracting(looping) {
            if let path = layout.indexPath(for: id) {
                (collection.cellForItem(at: path) as? PhotoThumbCell)?.setLooping(true)
            }
        }
        looping = next
    }

    private func mark(for id: String) -> PhotoSyncMark {
        guard showsSync else { return .hidden }
        if id.hasPrefix("cloud:") { return .serverOnly }
        return synced(id) ? .sent : .waiting
    }

    private func photo(at indexPath: IndexPath) -> PhotoRef? {
        switch zoom {
        case .days:
            guard model.days.indices.contains(indexPath.section) else { return nil }
            let photos = model.days[indexPath.section].photos
            guard photos.indices.contains(indexPath.item) else { return nil }
            return photos[indexPath.item]
        case .all:
            guard model.all.indices.contains(indexPath.item) else { return nil }
            return model.all[indexPath.item]
        case .months, .years:
            return model.all.first
        }
    }

    private func photoID(at indexPath: IndexPath) -> String? {
        photo(at: indexPath)?.id
    }

    private func groupID(at indexPath: IndexPath) -> String {
        switch zoom {
        case .years:
            guard model.years.indices.contains(indexPath.item) else { return "" }
            return model.years[indexPath.item].id
        case .months:
            guard model.months.indices.contains(indexPath.item) else { return "" }
            return model.months[indexPath.item].id
        case .days, .all:
            return photo(at: indexPath)?.id ?? ""
        }
    }

    private func refreshVisibleChrome() {
        guard let collection else { return }
        for indexPath in collection.indexPathsForVisibleItems {
            guard zoom == .days || zoom == .all, let photo = photo(at: indexPath) else { continue }
            (collection.cellForItem(at: indexPath) as? PhotoThumbCell)?.setChrome(
                photo: photo,
                selecting: selecting,
                selected: selection.contains(photo.id),
                sync: mark(for: photo.id)
            )
        }
        for view in collection.visibleSupplementaryViews(ofKind: UICollectionView.elementKindSectionHeader) {
            guard let header = view as? DayHeader,
                  let indexPath = collection.indexPath(forSupplementaryView: header) else { continue }
            guard model.days.indices.contains(indexPath.section) else { continue }
            let day = model.days[indexPath.section]
            header.configure(title: day.title, place: placeNames[day.key])
        }
    }

    private func updatePinnedHeader() {
        guard let collection else { return }
        let top = collection.contentOffset.y + collection.adjustedContentInset.top
        guard let placement = layout.pinnedHeader(top: top, width: collection.bounds.width),
              model.days.indices.contains(placement.index) else {
            pinnedHeader.isHidden = true
            pinnedKey = nil
            pinnedPlace = nil
            return
        }
        pinnedHeader.isHidden = false
        pinnedHeader.frame = placement.frame
        let day = model.days[placement.index]
        let place = placeNames[day.key]
        guard pinnedKey != day.key || pinnedPlace != place else { return }
        pinnedKey = day.key
        pinnedPlace = place
        pinnedHeader.configure(title: day.title, place: place)
        pinnedHeader.onTap = { [weak self] in
            guard let self, let latitude = day.latitude, let longitude = day.longitude else { return }
            self.onPlace(CLLocationCoordinate2D(latitude: latitude, longitude: longitude))
        }
        publishVisiblePlaces()
    }

    private func publishVisiblePlaces() {
        guard zoom == .days, let collection else { return }
        let requests: [PlaceRequest] = collection.indexPathsForVisibleSupplementaryElements(
            ofKind: UICollectionView.elementKindSectionHeader
        ).compactMap { indexPath in
            guard model.days.indices.contains(indexPath.section) else { return nil }
            let day = model.days[indexPath.section]
            guard let latitude = day.latitude, let longitude = day.longitude else { return nil }
            return PlaceRequest(dayKey: day.key, latitude: latitude, longitude: longitude)
        }
        if !requests.isEmpty { onVisiblePlaces(requests) }
    }

    private func updateCache() {
        guard let collection else { return }
        let rect = collection.bounds.insetBy(dx: 0, dy: -collection.bounds.height)
        let ids = layout.photoIDs(in: rect)
        let scale = max(collection.traitCollection.displayScale, 2)
        let side = 132 * scale
        if ids == cachedIDs, abs(side - cachePixel) < 1 { return }
        let size = CGSize(width: side, height: side)
        let options = cacheOptions
        let previous = Set(cachedIDs)
        let next = Set(ids)
        let scaleChanged = cachePixel > 0 && abs(side - cachePixel) > 1
        if scaleChanged {
            let old = CGSize(width: cachePixel, height: cachePixel)
            let gone = previous.compactMap { assetLookup($0) }
            if !gone.isEmpty {
                imageManager.stopCachingImages(for: gone, targetSize: old, contentMode: .aspectFill, options: options)
            }
        } else {
            let removed = previous.subtracting(next).compactMap { assetLookup($0) }
            if !removed.isEmpty {
                imageManager.stopCachingImages(for: removed, targetSize: size, contentMode: .aspectFill, options: options)
            }
        }
        let addedIDs = scaleChanged ? next : next.subtracting(previous)
        let added = addedIDs.compactMap { assetLookup($0) }
        if !added.isEmpty {
            imageManager.startCachingImages(for: added, targetSize: size, contentMode: .aspectFill, options: options)
        }
        cachedIDs = ids
        cachePixel = side
    }

    private func centerAnchor() -> GridAnchor? {
        guard let collection else { return nil }
        let point = CGPoint(x: collection.bounds.midX, y: collection.contentOffset.y + collection.bounds.midY)
        guard let indexPath = collection.indexPathForItem(at: point) else { return nil }
        return GridAnchor(id: groupID(at: indexPath), atTop: false)
    }

    private func flushAnchor() {
        guard let collection, collection.bounds.width > 1, layout.collectionViewContentSize.height > 1 else { return }
        if let anchor = pendingAnchor {
            pendingAnchor = nil
            didInitialScroll = true
            if let indexPath = layout.indexPath(for: anchor.id) {
                collection.scrollToItem(at: indexPath, at: anchor.atTop ? .top : .centeredVertically, animated: false)
            }
            return
        }
        guard !didInitialScroll else { return }
        didInitialScroll = true
        let bottom = max(-collection.adjustedContentInset.top, collection.contentSize.height - collection.bounds.height + collection.adjustedContentInset.bottom)
        collection.setContentOffset(CGPoint(x: 0, y: bottom), animated: false)
    }
}

extension PhotoGridController: UICollectionViewDataSourcePrefetching {
    func collectionView(_: UICollectionView, prefetchItemsAt _: [IndexPath]) {
        updateCache()
    }
}

extension PhotoGridController: UIGestureRecognizerDelegate {
    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
    ) -> Bool {
        false
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard gestureRecognizer === selectPan else { return true }
        guard selecting, zoom == .days || zoom == .all else { return false }
        let velocity = selectPan.velocity(in: collection)
        return abs(velocity.x) > abs(velocity.y) * 1.2
    }
}

extension PhotoGridController: ViewerTransitionSource {
    func viewerFrame(for id: String) -> CGRect? {
        guard let collection, view.window != nil,
              zoom == .days || zoom == .all,
              let indexPath = layout.indexPath(for: id),
              let attributes = collection.layoutAttributesForItem(at: indexPath) else { return nil }
        collection.layoutIfNeeded()
        let visible = collection.bounds.inset(by: collection.adjustedContentInset)
        guard visible.intersects(attributes.frame) else { return nil }
        return collection.convert(attributes.frame, to: nil)
    }

    func viewerReveal(_ id: String) {
        guard let collection, zoom == .days || zoom == .all,
              let indexPath = layout.indexPath(for: id),
              let attributes = collection.layoutAttributesForItem(at: indexPath) else { return }
        let visible = collection.bounds.inset(by: collection.adjustedContentInset)
        guard !visible.contains(attributes.frame) else { return }
        collection.scrollToItem(at: indexPath, at: .centeredVertically, animated: false)
        collection.layoutIfNeeded()
    }

    func viewerHide(_ id: String?) {
        guard hiddenID != id else { return }
        hiddenID = id
        guard let collection else { return }
        for indexPath in collection.indexPathsForVisibleItems {
            guard let cell = collection.cellForItem(at: indexPath) as? PhotoThumbCell else { continue }
            cell.contentView.alpha = photoID(at: indexPath) == id && id != nil ? 0 : 1
        }
    }
}

// MARK: - Swipe to select

extension PhotoGridController {
    private func gridOrder() -> (ids: [String], index: [String: Int]) {
        let stamp = zoom == .days ? 1 : 2
        if let cache = orderCache, cache.stamp == stamp { return (cache.ids, cache.index) }
        let ids = zoom == .days ? model.days.flatMap { $0.photos.map(\.id) } : model.all.map(\.id)
        var index: [String: Int] = [:]
        index.reserveCapacity(ids.count)
        for (offset, id) in ids.enumerated() { index[id] = offset }
        orderCache = (stamp, ids, index)
        return (ids, index)
    }

    private func orderIndex(at point: CGPoint) -> Int? {
        guard let indexPath = collection.indexPathForItem(at: point),
              let id = photoID(at: indexPath) else { return nil }
        return gridOrder().index[id]
    }

    @objc fileprivate func swipeSelect(_ gesture: UIPanGestureRecognizer) {
        let point = gesture.location(in: collection)
        swipePoint = point
        switch gesture.state {
        case .began:
            guard let start = orderIndex(at: point) else { return }
            let id = gridOrder().ids[start]
            swipeStart = start
            swipeLast = nil
            swipeBase = selection
            swipeAdds = !selection.contains(id)
            applySwipe(to: start)
            startSwipeScroll()
        case .changed:
            if let index = orderIndex(at: point) { applySwipe(to: index) }
        default:
            swipeStart = nil
            swipeLast = nil
            swipeLink?.invalidate()
            swipeLink = nil
        }
    }

    private func applySwipe(to index: Int) {
        guard let start = swipeStart, index != swipeLast else { return }
        swipeLast = index
        let ids = gridOrder().ids
        let range = ids[min(start, index)...max(start, index)]
        var next = swipeBase
        if swipeAdds {
            next.formUnion(range)
        } else {
            next.subtract(range)
        }
        guard next != selection else { return }
        UISelectionFeedbackGenerator().selectionChanged()
        selection = next
        refreshVisibleChrome()
        onSelectionSet(next)
    }

    private func startSwipeScroll() {
        swipeLink?.invalidate()
        let link = CADisplayLink(target: self, selector: #selector(swipeScrollStep))
        link.add(to: .main, forMode: .common)
        swipeLink = link
    }

    @objc private func swipeScrollStep() {
        guard let collection, swipeStart != nil else { return }
        let inset = collection.adjustedContentInset
        let localY = swipePoint.y - collection.contentOffset.y
        let edge: CGFloat = 70
        let topEdge = inset.top + edge
        let bottomEdge = collection.bounds.height - inset.bottom - edge
        var speed: CGFloat = 0
        if localY < topEdge {
            speed = -min(1, (topEdge - localY) / edge) * 18
        } else if localY > bottomEdge {
            speed = min(1, (localY - bottomEdge) / edge) * 18
        }
        guard speed != 0 else { return }
        let minY = -inset.top
        let maxY = max(minY, collection.contentSize.height - collection.bounds.height + inset.bottom)
        let y = min(max(collection.contentOffset.y + speed, minY), maxY)
        guard y != collection.contentOffset.y else { return }
        let delta = y - collection.contentOffset.y
        collection.contentOffset.y = y
        swipePoint.y += delta
        if let index = orderIndex(at: swipePoint) { applySwipe(to: index) }
    }
}

final class LibraryLayout: UICollectionViewLayout {
    var zoom: PhotoZoom = .days
    var model = GridModel.empty
    var placeNames: [String: String] = [:]
    var columns: CGFloat = 3
    private(set) var capsules: [(title: String, frame: CGRect)] = []
    private var dirty = true
    private var cachedWidth: CGFloat = -1
    private var sections: [SectionBox] = []
    private var idIndex: [String: IndexPath] = [:]
    private var contentHeight: CGFloat = 0

    func markDirty() { dirty = true }

    func chronologyMarks() -> [(title: String, offset: CGFloat)] {
        guard contentHeight > 1 else { return [] }
        switch zoom {
        case .years:
            return zip(model.years, sections.first?.frames ?? []).map { ($0.title, $1.minY) }
        case .months:
            return zip(model.months, sections.first?.frames ?? []).map { ("\($0.title) \($0.yearTitle)", $1.minY) }
        case .all:
            return monthMarks(photos: model.all, frames: sections.first?.frames ?? [])
        case .days:
            var marks: [(String, CGFloat)] = []
            var seen = ""
            let calendar = Calendar.current
            for (day, box) in zip(model.days, sections) {
                let parts = calendar.dateComponents([.year, .month], from: day.date)
                let key = String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0)
                guard key != seen else { continue }
                seen = key
                let month = PhotoGrouping.monthTitle(for: day.date, calendar: calendar)
                let year = parts.year ?? 0
                let title = year == calendar.component(.year, from: .now) ? month : "\(month) \(year)"
                marks.append((title, box.minY))
            }
            return marks
        }
    }

    private func monthMarks(photos: [PhotoRef], frames: [CGRect]) -> [(title: String, offset: CGFloat)] {
        var marks: [(String, CGFloat)] = []
        var seen = ""
        let calendar = Calendar.current
        for (photo, frame) in zip(photos, frames) {
            let parts = calendar.dateComponents([.year, .month], from: photo.created)
            let key = String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0)
            guard key != seen else { continue }
            seen = key
            let month = PhotoGrouping.monthTitle(for: photo.created, calendar: calendar)
            let year = parts.year ?? 0
            let title = year == calendar.component(.year, from: .now) ? month : "\(month) \(year)"
            marks.append((title, frame.minY))
        }
        return marks
    }

    var chronologyHeight: CGFloat { contentHeight }

    override var collectionViewContentSize: CGSize {
        CGSize(width: cachedWidth > 0 ? cachedWidth : 1, height: max(contentHeight, 1))
    }

    override func prepare() {
        guard let collectionView else { return }
        let width = collectionView.bounds.width
        guard width > 1 else { return }
        if !dirty, abs(width - cachedWidth) < 0.5 { return }
        cachedWidth = width
        dirty = false
        sections.removeAll()
        idIndex.removeAll()
        capsules = []
        let spacing = GalleryTheme.spacing
        switch zoom {
        case .years:
            sections = [heroSection(count: model.years.count, height: 228, ids: model.years.map(\.id), spacing: spacing, width: width)]
        case .months:
            sections = [heroSection(count: model.months.count, height: 168, ids: model.months.map(\.id), spacing: spacing, width: width)]
        case .all:
            sections = [squareSection(photos: model.all, width: width, spacing: spacing)]
        case .days:
            contentHeight = layoutDays(width: width)
            return
        }
        contentHeight = sections.first?.maxY ?? 0
    }

    override func shouldInvalidateLayout(forBoundsChange newBounds: CGRect) -> Bool {
        abs(newBounds.width - cachedWidth) > 0.5
    }

    func pinnedHeader(top: CGFloat, width: CGFloat) -> PinnedHeaderPlacement? {
        guard zoom == .days, let first = sections.first?.header else { return nil }
        if top <= first.minY + 0.5 { return nil }
        var chosen: Int?
        for (index, section) in sections.enumerated() {
            guard let header = section.header else { continue }
            if header.minY <= top + 0.5 { chosen = index }
        }
        guard let chosen, var frame = sections[chosen].header else { return nil }
        frame.origin.y = top
        frame.size.width = width
        if sections.indices.contains(chosen + 1), let next = sections[chosen + 1].header {
            let limit = next.minY - frame.height
            if frame.origin.y > limit { frame.origin.y = limit }
        }
        return PinnedHeaderPlacement(index: chosen, frame: frame)
    }

    override func layoutAttributesForElements(in rect: CGRect) -> [UICollectionViewLayoutAttributes]? {
        guard collectionView != nil else { return nil }
        var result: [UICollectionViewLayoutAttributes] = []
        for (sectionIndex, section) in sections.enumerated() where section.maxY >= rect.minY && section.minY <= rect.maxY {
            if let header = section.header, header.intersects(rect) {
                let attributes = UICollectionViewLayoutAttributes(
                    forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader,
                    with: IndexPath(item: 0, section: sectionIndex)
                )
                attributes.frame = header
                attributes.zIndex = 2
                result.append(attributes)
            }
            for item in section.frames.indices where section.frames[item].intersects(rect) {
                let attributes = UICollectionViewLayoutAttributes(forCellWith: IndexPath(item: item, section: sectionIndex))
                attributes.frame = section.frames[item]
                result.append(attributes)
            }
        }
        return result
    }

    override func layoutAttributesForItem(at indexPath: IndexPath) -> UICollectionViewLayoutAttributes? {
        guard sections.indices.contains(indexPath.section),
              sections[indexPath.section].frames.indices.contains(indexPath.item) else { return nil }
        let attributes = UICollectionViewLayoutAttributes(forCellWith: indexPath)
        attributes.frame = sections[indexPath.section].frames[indexPath.item]
        return attributes
    }

    override func layoutAttributesForSupplementaryView(
        ofKind elementKind: String,
        at indexPath: IndexPath
    ) -> UICollectionViewLayoutAttributes? {
        guard elementKind == UICollectionView.elementKindSectionHeader,
              sections.indices.contains(indexPath.section),
              let header = sections[indexPath.section].header else { return nil }
        let attributes = UICollectionViewLayoutAttributes(forSupplementaryViewOfKind: elementKind, with: indexPath)
        attributes.frame = header
        attributes.zIndex = 20
        return attributes
    }

    func indexPath(for id: String) -> IndexPath? { idIndex[id] }

    func frame(for id: String) -> CGRect? {
        guard let indexPath = idIndex[id],
              sections.indices.contains(indexPath.section),
              sections[indexPath.section].frames.indices.contains(indexPath.item) else { return nil }
        return sections[indexPath.section].frames[indexPath.item]
    }

    func caption(top: CGFloat, height: CGFloat) -> String {
        guard zoom == .days, height > 1 else { return "" }
        let visible = model.days.flatMap(\.photos).filter { photo in
            guard let frame = frame(for: photo.id) else { return false }
            return frame.maxY >= top && frame.minY <= top + height
        }
        guard let first = visible.first, let last = visible.last else { return "" }
        if columns < 1.7 {
            return PhotoGrouping.dayTitle(for: last.created)
        }
        if columns >= 4.2, columns < 7.5 {
            let start = PhotoGrouping.dayTitle(for: first.created)
            let end = PhotoGrouping.dayTitle(for: last.created)
            return start == end ? start : "\(start) – \(end)"
        }
        return ""
    }

    private func layoutDays(width: CGFloat) -> CGFloat {
        let cols = min(max(columns, 1), 12)
        let mosaic = cols >= 7.5
        let large = cols < 1.7
        let gap: CGFloat = mosaic ? 1 : (large ? 4 : 2)
        var y: CGFloat = large ? 8 : 2
        var lastMonth = ""
        let calendar = Calendar.current
        for (sectionIndex, day) in model.days.enumerated() {
            let headerFactor: CGFloat = mosaic ? 0 : max(0, min(1, (7.2 - cols) / 2.4))
            let headerHeight = (day.latitude == nil ? 40 : 56) * headerFactor
            let header = headerHeight > 10 ? CGRect(x: 0, y: y, width: width, height: headerHeight) : nil
            if let header { y = header.maxY }
            var frames: [CGRect] = []
            if large {
                let inner = width - gap * 2
                for photo in day.photos {
                    let aspect = min(max(photo.aspect, 0.45), 1.9)
                    let height = min(max(inner / aspect, inner * 0.56), inner * 1.35)
                    frames.append(CGRect(x: gap, y: y, width: inner, height: height))
                    y += height + gap
                }
            } else {
                let side = max(28, (width - gap * (cols + 1)) / cols)
                let perRow = max(1, Int(floor((width + 0.5) / (side + gap))))
                let rowWidth = CGFloat(perRow) * side + CGFloat(perRow - 1) * gap
                let extra = max(0, (width - rowWidth) / 2)
                for item in day.photos.indices {
                    let column = item % perRow
                    let row = item / perRow
                    frames.append(CGRect(
                        x: extra + CGFloat(column) * (side + gap),
                        y: y + CGFloat(row) * (side + gap),
                        width: side,
                        height: side
                    ))
                }
                let rows = Int(ceil(Double(max(day.photos.count, 1)) / Double(perRow)))
                y += CGFloat(rows) * (side + gap)
            }
            if mosaic, let first = frames.first {
                let parts = calendar.dateComponents([.year, .month], from: day.date)
                let key = String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0)
                if key != lastMonth {
                    lastMonth = key
                    let month = PhotoGrouping.monthTitle(for: day.date, calendar: calendar)
                    let year = parts.year ?? 0
                    let title = year == calendar.component(.year, from: .now) ? month : "\(month) \(year)"
                    capsules.append((title, CGRect(x: first.minX + 8, y: first.minY + 8, width: 132, height: 28)))
                }
            }
            for (item, photo) in day.photos.enumerated() {
                idIndex[photo.id] = IndexPath(item: item, section: sectionIndex)
            }
            let minY = header?.minY ?? frames.first?.minY ?? y
            let maxY = frames.map(\.maxY).max() ?? y
            sections.append(SectionBox(header: header, dayKey: day.key, frames: frames, ids: day.photos.map(\.id), minY: minY, maxY: maxY))
            y = maxY + (large ? 18 : (mosaic ? 1 : 12))
        }
        return y
    }

    func photoIDs(in rect: CGRect) -> [String] {
        sections.flatMap { section -> [String] in
            section.frames.indices.compactMap { item in
                section.frames[item].intersects(rect) ? section.ids[item] : nil
            }
        }
    }

    private func heroSection(count: Int, height: CGFloat, ids: [String], spacing: CGFloat, width: CGFloat) -> SectionBox {
        var frames: [CGRect] = []
        var y: CGFloat = spacing
        for item in 0..<count {
            let frame = CGRect(x: 0, y: y, width: width, height: height)
            frames.append(frame)
            idIndex[ids[item]] = IndexPath(item: item, section: 0)
            y += height + spacing
        }
        return SectionBox(header: nil, dayKey: nil, frames: frames, ids: ids, minY: 0, maxY: y)
    }

    private func squareSection(photos: [PhotoRef], width: CGFloat, spacing: CGFloat) -> SectionBox {
        let columns = max(3, Int(floor((width + spacing) / (74 + spacing))))
        let side = (width - spacing * CGFloat(columns + 1)) / CGFloat(columns)
        var frames: [CGRect] = []
        frames.reserveCapacity(photos.count)
        for item in photos.indices {
            let column = item % columns
            let row = item / columns
            let frame = CGRect(
                x: spacing + CGFloat(column) * (side + spacing),
                y: spacing + CGFloat(row) * (side + spacing),
                width: side,
                height: side
            )
            frames.append(frame)
            idIndex[photos[item].id] = IndexPath(item: item, section: 0)
        }
        let rows = Int(ceil(Double(photos.count) / Double(columns)))
        let height = spacing + CGFloat(rows) * (side + spacing)
        return SectionBox(header: nil, dayKey: nil, frames: frames, ids: photos.map(\.id), minY: 0, maxY: height)
    }
}

struct PinnedHeaderPlacement {
    var index: Int
    var frame: CGRect
}

final class ChronologyScrubber: UIView {
    var onScrub: (CGFloat) -> Void = { _ in }
    private var marks: [(title: String, offset: CGFloat)] = []
    private var span: CGFloat = 1
    private var dragging = false
    private var lastTitle = ""
    private let bubble = UILabel()
    private let thumb = UIView()
    private let feedback = UISelectionFeedbackGenerator()

    override init(frame: CGRect) {
        super.init(frame: frame)
        isHidden = true
        clipsToBounds = false
        thumb.alpha = 0
        thumb.backgroundColor = UIColor.label.withAlphaComponent(0.45)
        thumb.layer.cornerRadius = 1.5
        addSubview(thumb)
        bubble.font = .systemFont(ofSize: 15, weight: .semibold)
        bubble.textColor = .label
        bubble.textAlignment = .center
        bubble.backgroundColor = UIColor.secondarySystemBackground
        bubble.layer.cornerRadius = 14
        bubble.layer.cornerCurve = .continuous
        bubble.clipsToBounds = true
        bubble.alpha = 0
        addSubview(bubble)
        let pan = UIPanGestureRecognizer(target: self, action: #selector(dragged(_:)))
        addGestureRecognizer(pan)
    }

    required init?(coder: NSCoder) { nil }

    func setMarks(_ marks: [(title: String, offset: CGFloat)], span: CGFloat) {
        self.marks = marks
        self.span = max(span, 1)
        isHidden = marks.count < 2
    }

    func follow(offset: CGFloat) {
        guard !dragging else { return }
        place(fraction: min(1, max(0, offset / span)), title: nil)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        thumb.bounds = CGRect(x: 0, y: 0, width: 3, height: 44)
    }

    @objc private func dragged(_ gesture: UIPanGestureRecognizer) {
        let track = bounds.insetBy(dx: 0, dy: 12)
        let fraction = min(1, max(0, (gesture.location(in: self).y - track.minY) / max(track.height, 1)))
        switch gesture.state {
        case .began:
            dragging = true
            feedback.prepare()
            UIView.animate(withDuration: 0.16) { self.thumb.alpha = 1 }
            fallthrough
        case .changed:
            let offset = fraction * span
            let title = marks.last(where: { $0.offset <= offset + 1 })?.title ?? marks.first?.title ?? ""
            if title != lastTitle {
                lastTitle = title
                feedback.selectionChanged()
            }
            place(fraction: fraction, title: title)
            onScrub(offset)
        default:
            dragging = false
            lastTitle = ""
            UIView.animate(withDuration: 0.25) {
                self.thumb.alpha = 0
                self.bubble.alpha = 0
            }
        }
    }

    private func place(fraction: CGFloat, title: String?) {
        let track = bounds.insetBy(dx: 0, dy: 12)
        let y = track.minY + track.height * min(1, max(0, fraction))
        thumb.center = CGPoint(x: bounds.width - 7, y: y)
        guard let title, dragging, !title.isEmpty else { return }
        bubble.text = "  \(title)  "
        bubble.sizeToFit()
        let width = bubble.bounds.width + 18
        let height: CGFloat = 32
        bubble.bounds = CGRect(x: 0, y: 0, width: width, height: height)
        bubble.center = CGPoint(x: -width / 2 - 6, y: y)
        bubble.alpha = 1
    }
}

private struct SectionBox {
    var header: CGRect?
    var dayKey: String?
    var frames: [CGRect]
    var ids: [String]
    var minY: CGFloat
    var maxY: CGFloat
}

final class PhotoThumbCell: UICollectionViewCell {
    static let reuse = "PhotoThumbCell"
    private let imageView = UIImageView()
    private let badge = UILabel()
    private let heart = UIImageView()
    private let check = UIImageView()
    private let syncMark = UIImageView()
    private let selectedVeil = UIView()
    private var wasSelected = false
    private var syncShown: (id: String, symbol: String)?
    private var traits = PhotoTraits()
    private var loopingID: String?
    private var currentAssetID: String?
    private var assetRef: PHAsset?
    private(set) var currentImage: UIImage?
    private let shade = CAGradientLayer()
    var hasImage: Bool { currentImage != nil }

    override init(frame: CGRect) {
        super.init(frame: frame)
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.backgroundColor = .clear
        contentView.addSubview(imageView)
        shade.colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.28).cgColor]
        shade.isHidden = true
        contentView.layer.addSublayer(shade)
        badge.font = .monospacedDigitSystemFont(ofSize: 11, weight: .semibold)
        badge.textColor = .white
        contentView.addSubview(badge)
        heart.image = UIImage(systemName: "heart.fill")
        heart.tintColor = .white
        heart.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 11, weight: .bold)
        contentView.addSubview(heart)
        selectedVeil.backgroundColor = UIColor.white.withAlphaComponent(0.22)
        selectedVeil.isHidden = true
        selectedVeil.isUserInteractionEnabled = false
        contentView.addSubview(selectedVeil)
        check.image = UIImage(systemName: "checkmark.circle.fill")
        check.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            .applying(UIImage.SymbolConfiguration(paletteColors: [.white, .systemBlue]))
        check.layer.shadowColor = UIColor.black.cgColor
        check.layer.shadowOpacity = 0.25
        check.layer.shadowRadius = 2
        check.layer.shadowOffset = .zero
        check.isHidden = true
        contentView.addSubview(check)
        syncMark.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 11, weight: .bold)
        syncMark.tintColor = .white
        contentView.addSubview(syncMark)
        isAccessibilityElement = true
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        imageView.frame = contentView.bounds
        selectedVeil.frame = contentView.bounds
        let tall = contentView.bounds.width > 140
        shade.isHidden = !tall || imageView.image == nil
        shade.frame = CGRect(x: 0, y: contentView.bounds.height * 0.72, width: contentView.bounds.width, height: contentView.bounds.height * 0.28)
        badge.frame = CGRect(x: 6, y: contentView.bounds.height - 18, width: contentView.bounds.width - 28, height: 14)
        heart.frame = CGRect(x: 6, y: 6, width: 14, height: 14)
        check.frame = CGRect(x: contentView.bounds.width - 26, y: contentView.bounds.height - 26, width: 22, height: 22)
        syncMark.frame = CGRect(x: contentView.bounds.width - 16, y: 4, width: 12, height: 12)
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        // Keep the last bitmap until configure paints the next id — prevents empty flashes.
        currentAssetID = nil
        assetRef = nil
        badge.text = nil
        heart.isHidden = true
        check.isHidden = true
        selectedVeil.isHidden = true
        wasSelected = false
        syncMark.isHidden = true
        syncShown = nil
        traits = []
        loopingID = nil
    }

    func displays(id: String) -> Bool {
        currentAssetID == id
    }

    func applyCloudThumb(_ image: UIImage, id: String) {
        guard currentAssetID == id else { return }
        imageView.image = image
        currentImage = image
        imageView.backgroundColor = .clear
        shade.isHidden = contentView.bounds.width < 140
    }

    func configure(
        photo: PhotoRef,
        asset: PHAsset? = nil,
        selecting: Bool,
        selected: Bool,
        sync: PhotoSyncMark = .hidden,
        image: UIImage? = nil
    ) {
        let same = currentAssetID == photo.id
        currentAssetID = photo.id
        assetRef = asset
        traits = photo.traits
        if !same { loopingID = nil }
        setChrome(photo: photo, selecting: selecting, selected: selected, sync: sync)
        accessibilityLabel = photo.traits.isVideo ? "Wideo" : "Zdjęcie"
        if let image {
            imageView.image = image
            currentImage = image
            imageView.backgroundColor = .clear
            shade.isHidden = contentView.bounds.width < 140
        } else if !same {
            // Different photo — clear. Same photo without a new image keeps the previous frame.
            imageView.image = nil
            currentImage = nil
            shade.isHidden = true
        }
    }

    func setLooping(_ on: Bool) {
        let gif = traits.contains(.animated) || assetRef?.playbackStyle == .imageAnimated
        guard on, gif, !traits.isVideo, let asset = assetRef else {
            loopingID = nil
            if let currentImage { imageView.image = currentImage }
            return
        }
        guard loopingID != asset.localIdentifier else { return }
        loopingID = asset.localIdentifier
        let key = asset.localIdentifier as NSString
        if let cached = AnimatedCache.images.object(forKey: key) {
            imageView.image = cached
            return
        }
        let options = PHImageRequestOptions()
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .highQualityFormat
        let id = asset.localIdentifier
        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { [weak self] data, _, _, _ in
            let side = max(self?.bounds.width ?? 120, 120) * 2
            guard let data, let animated = AnimatedFrames.image(data: data, maxSide: side, maxFrames: 12) else { return }
            AnimatedCache.images.setObject(animated, forKey: key)
            DispatchQueue.main.async {
                guard let self, self.currentAssetID == id, self.loopingID == id else { return }
                self.imageView.image = animated
            }
        }
    }

    func setChrome(photo: PhotoRef, selecting: Bool, selected: Bool, sync: PhotoSyncMark = .hidden) {
        heart.isHidden = !photo.isFavorite
        if photo.traits.isVideo {
            badge.text = PhotoFormat.duration(photo.duration)
        } else if photo.traits.contains(.live) {
            badge.text = "LIVE"
        } else if photo.traits.contains(.animated) {
            badge.text = "GIF"
        } else {
            badge.text = nil
        }
        let shown = selecting && selected
        check.isHidden = !shown
        selectedVeil.isHidden = !shown
        if shown, !wasSelected {
            check.addSymbolEffect(.bounce.up, options: .speed(1.6))
        }
        wasSelected = shown
        let symbol: String?
        switch sync {
        case .hidden: symbol = nil
        case .sent: symbol = "checkmark.icloud.fill"
        case .waiting: symbol = "icloud.and.arrow.up"
        case .serverOnly: symbol = "iphone.slash"
        case .duplicate: symbol = "square.on.square"
        }
        guard let symbol, let image = UIImage(systemName: symbol) else {
            syncMark.isHidden = true
            syncShown = nil
            return
        }
        syncMark.isHidden = selecting
        // Same photo, new state: morph the badge the way Photos does instead of swapping it.
        if let previous = syncShown, previous.id == photo.id, previous.symbol != symbol, !selecting, window != nil {
            syncMark.setSymbolImage(image, contentTransition: .replace.downUp.byLayer)
            if sync == .sent {
                syncMark.addSymbolEffect(.bounce.up, options: .speed(1.4))
            }
        } else if syncMark.image != image {
            syncMark.image = image
        }
        syncShown = (photo.id, symbol)
    }
}

enum PhotoSyncMark {
    case hidden, sent, waiting, serverOnly, duplicate
}

final class HeroThumbCell: UICollectionViewCell {
    static let reuse = "HeroThumbCell"
    private let imageView = UIImageView()
    private let shade = CAGradientLayer()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private var request: PHImageRequestID = PHInvalidImageRequestID
    private var sharpToken: PHImageRequestID = PHInvalidImageRequestID
    private var sharpReady = false
    private var manager: PHImageManager?

    override init(frame: CGRect) {
        super.init(frame: frame)
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        contentView.addSubview(imageView)
        shade.colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.55).cgColor]
        contentView.layer.addSublayer(shade)
        titleLabel.font = .systemFont(ofSize: 34, weight: .bold)
        titleLabel.textColor = .white
        subtitleLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        subtitleLabel.textColor = UIColor.white.withAlphaComponent(0.92)
        contentView.addSubview(titleLabel)
        contentView.addSubview(subtitleLabel)
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        imageView.frame = contentView.bounds
        shade.frame = CGRect(x: 0, y: contentView.bounds.height * 0.45, width: contentView.bounds.width, height: contentView.bounds.height * 0.55)
        titleLabel.frame = CGRect(x: 16, y: contentView.bounds.height - 62, width: contentView.bounds.width - 32, height: 38)
        subtitleLabel.frame = CGRect(x: 16, y: contentView.bounds.height - 28, width: contentView.bounds.width - 32, height: 18)
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        if request != PHInvalidImageRequestID { manager?.cancelImageRequest(request) }
        if sharpToken != PHInvalidImageRequestID { manager?.cancelImageRequest(sharpToken) }
        request = PHInvalidImageRequestID
        sharpToken = PHInvalidImageRequestID
        sharpReady = false
        imageView.image = nil
    }

    func configure(title: String, subtitle: String, asset: PHAsset?, manager: PHCachingImageManager, fallback: UIImage? = nil) {
        titleLabel.text = title
        subtitleLabel.text = subtitle
        self.manager = manager
        guard let asset else {
            imageView.image = fallback
            return
        }
        let scale = max(traitCollection.displayScale, 2)
        let width = bounds.width > 1 ? bounds.width : 390
        let height = bounds.height > 1 ? bounds.height : 228
        let size = CGSize(width: width * scale, height: height * scale)
        if let fallback { imageView.image = fallback }
        let fast = PHImageRequestOptions()
        fast.deliveryMode = .opportunistic
        fast.resizeMode = .fast
        fast.isNetworkAccessAllowed = true
        var token = PHInvalidImageRequestID
        token = manager.requestImage(for: asset, targetSize: size, contentMode: .aspectFill, options: fast) { [weak self] image, info in
            let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
            let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
            DispatchQueue.main.async {
                guard let self, self.request == token, !cancelled, let image else { return }
                if !self.sharpReady || !degraded {
                    self.imageView.image = image
                }
            }
        }
        request = token
        SharpThumbLimiter.shared.submit { [weak self] done in
            guard let self, self.request == token else {
                done()
                return
            }
            let sharp = PHImageRequestOptions()
            sharp.deliveryMode = .highQualityFormat
            sharp.resizeMode = .exact
            sharp.isNetworkAccessAllowed = true
            var sharpID = PHInvalidImageRequestID
            sharpID = manager.requestImage(for: asset, targetSize: size, contentMode: .aspectFill, options: sharp) { [weak self] image, info in
                let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
                DispatchQueue.main.async {
                    defer { done() }
                    guard let self, self.sharpToken == sharpID, !cancelled, let image else { return }
                    self.sharpReady = true
                    self.imageView.image = image
                }
            }
            self.sharpToken = sharpID
        }
    }
}

private final class CloudThumbLimiter {
    static let shared = CloudThumbLimiter()
    private let lock = NSLock()
    private var active = 0
    private var waiting: [() -> Void] = []
    /// Photos-style: several iCloud previews at once; newest visible cell first.
    private let limit = 8

    func submit(_ work: @escaping (@escaping () -> Void) -> Void) {
        lock.lock()
        if active < limit {
            active += 1
            lock.unlock()
            work { self.finish() }
            return
        }
        // Newest waiter first — what just appeared on screen matters more.
        waiting.append { work { self.finish() } }
        lock.unlock()
    }

    private func finish() {
        lock.lock()
        active = max(0, active - 1)
        let next = waiting.isEmpty ? nil : waiting.removeLast()
        if next != nil { active += 1 }
        lock.unlock()
        next?()
    }
}

private final class SharpThumbLimiter {
    static let shared = SharpThumbLimiter()
    private let lock = NSLock()
    private var active = 0
    private var waiting: [() -> Void] = []
    private let limit = 4

    func submit(_ work: @escaping (@escaping () -> Void) -> Void) {
        lock.lock()
        let startNow = active < limit
        if startNow {
            active += 1
        } else {
            waiting.append { [weak self] in self?.submit(work) }
        }
        lock.unlock()
        if startNow {
            work { self.finish() }
        }
    }

    private func finish() {
        lock.lock()
        active = max(0, active - 1)
        let next = waiting.isEmpty ? nil : waiting.removeFirst()
        lock.unlock()
        next?()
    }
}

final class DayHeader: UICollectionReusableView {
    static let reuse = "DayHeader"
    private let titleLabel = UILabel()
    private let placeLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .secondarySystemBackground
        titleLabel.font = .systemFont(ofSize: 22, weight: .bold)
        placeLabel.font = .systemFont(ofSize: 13, weight: .regular)
        placeLabel.textColor = .secondaryLabel
        addSubview(titleLabel)
        addSubview(placeLabel)
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapped)))
    }

    var onTap: () -> Void = {}

    @objc private func tapped() { onTap() }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        titleLabel.frame = CGRect(x: 16, y: 8, width: bounds.width - 32, height: 26)
        placeLabel.frame = CGRect(x: 16, y: 34, width: bounds.width - 32, height: 16)
    }

    func configure(title: String, place: String?) {
        titleLabel.text = title
        placeLabel.text = place
        placeLabel.isHidden = place == nil
    }
}

/// Long-press peek: the photo at its true aspect, upgraded to a sharp frame, videos play muted.
final class PhotoPeekController: UIViewController {
    private let photo: PhotoRef
    private let asset: PHAsset?
    private let imageView = UIImageView()
    private var player: AVQueuePlayer?
    private var looper: AVPlayerLooper?
    private var playerLayer: AVPlayerLayer?
    private var request: PHImageRequestID = PHInvalidImageRequestID

    init(photo: PhotoRef, asset: PHAsset?, placeholder: UIImage?) {
        self.photo = photo
        self.asset = asset
        super.init(nibName: nil, bundle: nil)
        imageView.image = placeholder
    }

    required init?(coder: NSCoder) { nil }

    deinit {
        if request != PHInvalidImageRequestID { PHImageManager.default().cancelImageRequest(request) }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .secondarySystemBackground
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        view.addSubview(imageView)
        preferredContentSize = fittedSize()
        loadSharp()
        if asset?.mediaType == .video { loadVideo() }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        imageView.frame = view.bounds
        playerLayer?.frame = view.bounds
    }

    private func fittedSize() -> CGSize {
        let width = CGFloat(asset?.pixelWidth ?? photo.pixelWidth)
        let height = CGFloat(asset?.pixelHeight ?? photo.pixelHeight)
        let screen = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.screen.bounds.size }
            .first ?? CGSize(width: 390, height: 844)
        let maxWidth = screen.width - 24
        let maxHeight = screen.height * 0.62
        guard width > 1, height > 1 else { return CGSize(width: maxWidth, height: maxWidth) }
        let scale = min(maxWidth / width, maxHeight / height)
        return CGSize(width: (width * scale).rounded(), height: (height * scale).rounded())
    }

    private func loadSharp() {
        guard let asset else { return }
        let options = PHImageRequestOptions()
        options.deliveryMode = .opportunistic
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        let side = max(preferredContentSize.width, preferredContentSize.height) * max(traitCollection.displayScale, 2)
        request = PHImageManager.default().requestImage(
            for: asset,
            targetSize: CGSize(width: side, height: side),
            contentMode: .aspectFit,
            options: options
        ) { [weak self] image, _ in
            guard let image else { return }
            DispatchQueue.main.async { self?.imageView.image = image }
        }
    }

    private func loadVideo() {
        guard let asset else { return }
        let options = PHVideoRequestOptions()
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .fastFormat
        PHImageManager.default().requestPlayerItem(forVideo: asset, options: options) { [weak self] item, _ in
            guard let item else { return }
            DispatchQueue.main.async {
                guard let self else { return }
                let player = AVQueuePlayer()
                player.isMuted = true
                self.looper = AVPlayerLooper(player: player, templateItem: item)
                let layer = AVPlayerLayer(player: player)
                layer.videoGravity = .resizeAspectFill
                layer.frame = self.view.bounds
                self.view.layer.addSublayer(layer)
                self.playerLayer = layer
                self.player = player
                player.play()
            }
        }
    }

    static func copy(_ asset: PHAsset?) {
        guard let asset else { return }
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        PHImageManager.default().requestImage(
            for: asset,
            targetSize: PHImageManagerMaximumSize,
            contentMode: .aspectFit,
            options: options
        ) { image, info in
            let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
            guard let image, !degraded else { return }
            DispatchQueue.main.async { UIPasteboard.general.image = image }
        }
    }
}

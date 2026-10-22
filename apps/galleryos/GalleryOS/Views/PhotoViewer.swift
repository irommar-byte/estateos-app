import AVKit
import CoreImage
import CoreLocation
import Photos
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers
import VisionKit

struct ViewerRequest: Identifiable {
    let id = UUID()
    let ids: [String]
    let index: Int
    let origin: CGRect
    let image: UIImage?
    weak var source: (any ViewerTransitionSource)? = nil
}

struct PhotoViewerHost: View {
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    let request: ViewerRequest
    @State private var index: Int
    @State private var info = false
    @State private var showMap = false
    @State private var confirmDelete = false
    @State private var purging: PurgeRequest?
    @State private var chromeVisible = true
    @State private var adjusting = false
    @State private var stripSelection: Int?
    @State private var stripEngaged = false
    @State private var playback = ViewerPlayback()
    @State private var friendShare = false
    @State private var chromeOpacity: Double = 1
    @State private var scrim: Double = 0
    @State private var pageTrack = PageTrack()
    @State private var orientationTicket = 0

    init(request: ViewerRequest) {
        self.request = request
        _index = State(initialValue: request.index)
        _stripSelection = State(initialValue: request.index)
    }

    private var immersive: Bool { verticalSizeClass == .compact }

    private var photoID: String? {
        guard request.ids.indices.contains(index) else { return nil }
        return request.ids[index]
    }

    private var photo: PhotoRef? {
        photoID.flatMap { library.photo(id: $0) }
    }

    /// Every photo can be deleted: an iPhone photo goes to Recently Deleted on the iPhone,
    /// a server copy goes to Recently Deleted on the server.
    private var canDelete: Bool { photoID != nil }

    /// Opened from the Serwer shelf or not stored on this iPhone.
    private var isServerCopy: Bool { photoID?.hasPrefix("cloud:") == true }

    /// In Recently Deleted on the server: it can come back, or go for good.
    private var isTrashed: Bool { photoID.map { library.isTrashed($0) } ?? false }

    /// On this device and also on the server: delete here only, or everywhere.
    private var alsoOnServer: Bool {
        guard let photoID, !isServerCopy else { return false }
        return library.isUploaded(photoID)
    }

    private var deleteTitle: String {
        if isTrashed { return L("Ostatnio usunięte") }
        return isServerCopy ? L("Usunąć z serwera?") : L("Usunąć zdjęcie?")
    }

    private var deleteMessage: String {
        if isTrashed {
            return L("Zdjęcie czeka w Ostatnio usuniętych. Możesz je przywrócić albo usunąć na zawsze.")
        }
        if isServerCopy {
            return L("Zniknie z biblioteki GalleryOS na wszystkich urządzeniach. Będzie w Ostatnio usuniętych na serwerze, skąd można je przywrócić.")
        }
        if alsoOnServer {
            return L("„Usuń z \(ThisDevice.genitive)” zostawia kopię na serwerze. „Usuń wszędzie” przenosi ją też do Ostatnio usuniętych na serwerze.")
        }
        return L("Kopia, która jest już na serwerze, zostaje w zakładce Serwer. Z \(ThisDevice.genitive) trafia do Ostatnio usuniętych na 30 dni.")
    }

    private var isVideo: Bool { photo?.traits.isVideo == true }

    private var showsTransport: Bool {
        guard let photo else { return false }
        return photo.traits.contains(.live) || photo.traits.isVideo
    }

    var body: some View {
        ZStack {
            (immersive ? Color.black : Color(uiColor: .systemBackground))
                .opacity(scrim)
                .ignoresSafeArea()
            pager
                .ignoresSafeArea()
            if !immersive && chromeVisible {
                VStack(spacing: 0) {
                    portraitTop
                        .padding(.top, 6)
                        .padding(.bottom, 4)
                    Spacer(minLength: 0)
                    portraitBottom
                        .padding(.top, 8)
                        .padding(.bottom, 8)
                }
                .opacity(min(chromeOpacity, scrim))
            }
            if immersive && chromeVisible {
                VStack(spacing: 8) {
                    landscapeTop
                    Spacer(minLength: 0)
                        .allowsHitTesting(false)
                    landscapeBottom
                }
            }
        }
        .onAppear {
            orientationTicket = GalleryOrientation.allowViewer()
            withAnimation(.spring(response: 0.42, dampingFraction: 0.9)) {
                scrim = 1
            }
        }
        .onDisappear {
            let ticket = orientationTicket
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(450))
                GalleryOrientation.lockLibrary(ticket: ticket)
            }
        }
        .onChange(of: index) { _, newValue in
            if !stripEngaged, stripSelection != newValue { stripSelection = newValue }
            playback.note(playing: false, fraction: 0)
        }
        .onChange(of: stripSelection) { _, newValue in
            guard stripEngaged, let newValue, newValue != index else { return }
            index = newValue
        }
        .fullScreenCover(isPresented: $showMap) {
            LibraryMapScreen(focus: photo.flatMap { item in
                guard let latitude = item.latitude, let longitude = item.longitude else { return nil }
                return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
            })
            .environmentObject(library)
        }
        .sheet(isPresented: $info) {
            if let photo {
                PhotoInfoSheet(photo: photo, place: placeName, names: PhotoIntelligence.shared.names(for: photo, library: library)) {
                    info = false
                    showMap = true
                }
                    .environmentObject(library)
            }
        }
        .sheet(isPresented: $adjusting) {
            if let photo {
                ViewerAdjustments(photo: photo)
                    .environmentObject(library)
            }
        }
        .sheet(isPresented: $friendShare) {
            CloudAlbumComposer(ids: photoID.map { [$0] } ?? [])
                .environmentObject(library)
        }
        .confirmationDialog(deleteTitle, isPresented: $confirmDelete, titleVisibility: .visible) {
            if let photoID {
                if isTrashed {
                    Button(L("Przywróć")) {
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                        library.restoreFromTrash(ids: [photoID])
                        dismiss()
                    }
                    Button(L("Usuń na zawsze…"), role: .destructive) {
                        purging = library.purgeRequest([photoID])
                    }
                } else if isServerCopy {
                    Button(L("Usuń z serwera"), role: .destructive) {
                        Task { if await library.delete(ids: [photoID]) { dismiss() } }
                    }
                } else {
                    Button(alsoOnServer ? L("Usuń z \(ThisDevice.genitive)") : L("Usuń zdjęcie"), role: .destructive) {
                        Task { if await library.delete(ids: [photoID]) { dismiss() } }
                    }
                    if alsoOnServer {
                        Button(L("Usuń wszędzie"), role: .destructive) {
                            Task { if await library.deleteEverywhere(ids: [photoID]) { dismiss() } }
                        }
                    }
                }
            }
            Button(L("Anuluj"), role: .cancel) {}
        } message: {
            Text(deleteMessage)
        }
        .sheet(item: $purging) { request in
            PermanentDeleteSheet(request: request) {
                library.purge(ids: request.ids)
                dismiss()
            }
        }
    }

    private var pager: some View {
        PhotoPager(
            ids: request.ids,
            index: $index,
            origin: request.origin,
            originImage: request.image,
            source: request.source,
            asset: { library.asset(id: $0) },
            media: { library.cloudMedia(id: $0) },
            revision: library.cloudRevision,
            immersive: immersive,
            playback: playback,
            onClose: { closeQuiet() },
            onToggleChrome: { chromeVisible.toggle() },
            onDrag: { progress in
                if progress <= 0 || progress >= 1 {
                    withAnimation(.smooth(duration: 0.34)) {
                        chromeOpacity = 1 - progress
                        scrim = 1 - progress
                    }
                } else {
                    chromeOpacity = 1 - progress
                    scrim = 1 - progress
                }
            },
            track: pageTrack
        )
        .task(id: photoID) {
            guard let photoID else { return }
            await library.prepareCloud(id: photoID)
            guard let photo, let latitude = photo.latitude, let longitude = photo.longitude else { return }
            library.resolvePlaces([
                PlaceRequest(
                    dayKey: PhotoGrouping.dayKey(photo.created, calendar: .current),
                    latitude: latitude,
                    longitude: longitude
                )
            ])
        }
    }

    private var portraitTop: some View {
        ZStack {
            caption
                .padding(.horizontal, 72)
            HStack {
                circleButton("chevron.left", L("Wstecz")) { closeAnimated() }
                Spacer()
                moreMenu
            }
            .padding(.horizontal, 12)
        }
    }

    private var portraitBottom: some View {
        VStack(spacing: 12) {
            if showsTransport {
                transport
                    .padding(.horizontal, 16)
            }
            filmstrip
            HStack {
                plainButton("square.and.arrow.up", L("Udostępnij")) { share() }
                Spacer()
                plainButton(photo?.isFavorite == true ? "heart.fill" : "heart", L("Ulubione")) { toggleFavorite() }
                Spacer()
                plainButton("info.circle", L("Informacje")) { info = true }
                Spacer()
                plainButton("slider.horizontal.3", L("Dopasuj")) { adjusting = true }
                    .disabled(isVideo)
                    .opacity(isVideo ? 0.35 : 1)
                Spacer()
                plainButton("trash", L("Usuń")) { confirmDelete = true }
                    .disabled(!canDelete)
                    .opacity(canDelete ? 1 : 0.35)
            }
            .padding(.horizontal, 22)
        }
    }

    private var landscapeTop: some View {
        HStack(spacing: 8) {
            circleButton("chevron.left", L("Wstecz")) { closeAnimated() }
            circleButton("square.and.arrow.up", L("Udostępnij")) { share() }
            circleButton(photo?.isFavorite == true ? "heart.fill" : "heart", L("Ulubione")) { toggleFavorite() }
            Spacer(minLength: 8)
            caption
            Spacer(minLength: 8)
            if !isVideo {
                circleButton("slider.horizontal.3", L("Dopasuj")) { adjusting = true }
            }
            circleButton("info.circle", L("Informacje")) { info = true }
            if canDelete {
                circleButton("trash", L("Usuń")) { confirmDelete = true }
            }
            moreMenu
        }
        .padding(.horizontal, 10)
        .padding(.top, 4)
    }

    private var landscapeBottom: some View {
        VStack(spacing: 8) {
            if showsTransport {
                transport
            }
            filmstrip
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 4)
    }

    private var caption: some View {
        Button {
            info = true
        } label: {
            VStack(spacing: 1) {
                Text(captionTitle)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(captionSubtitle)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .foregroundStyle(.primary)
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .galleryGlass(in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityHint(L("Pokaż informacje i miejsce"))
    }

    private var transport: some View {
        ViewerTransport(playback: playback)
    }

    private var filmstrip: some View {
        LinkedFilmstrip(
            ids: request.ids,
            index: index,
            track: pageTrack,
            asset: { library.asset(id: $0) },
            fallback: { library.thumbnail(id: $0) },
            onPick: { index = $0 },
            onScrub: { page in
                pageTrack.scrub(to: page)
                index = page
            }
        )
        .frame(height: 48)
    }

    private var moreMenu: some View {
        Menu {
            Button(L("Informacje"), systemImage: "info.circle") { info = true }
            Button(L("Udostępnij znajomym"), systemImage: "person.2") { friendShare = true }
            if let photo, let latitude = photo.latitude, let longitude = photo.longitude {
                Menu(L("Prowadź do miejsca zdjęcia"), systemImage: "arrow.triangle.turn.up.right.diamond") {
                    PhotoDirections.menuItems(
                        to: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                        name: placeName
                    )
                }
            }
            Button(L("Kopiuj"), systemImage: "doc.on.doc") { copyPhoto() }
            if let photoID {
                let concealed = library.isConcealed(photoID)
                Button(concealed ? L("Pokaż w bibliotece") : L("Ukryj"), systemImage: concealed ? "eye" : "eye.slash") {
                    library.setConcealed(!concealed, ids: [photoID])
                    if !concealed { dismiss() }
                }
            }
            if canDelete {
                Button(L("Usuń"), systemImage: "trash", role: .destructive) { confirmDelete = true }
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.primary)
                .frame(width: 44, height: 44)
                .galleryGlass(in: Circle())
        }
        .accessibilityLabel(L("Więcej"))
    }

    private var placeName: String? {
        guard let photo else { return nil }
        let key = PhotoGrouping.dayKey(photo.created, calendar: .current)
        return library.placeNames[key]
    }

    private var captionTitle: String {
        if let placeName, !placeName.isEmpty { return placeName }
        guard let photo else { return L("Zdjęcie") }
        return PhotoGrouping.dayTitle(for: photo.created)
    }

    private var captionSubtitle: String {
        guard let photo else { return "" }
        let time = viewerTime(photo.created)
        if let placeName, !placeName.isEmpty {
            return "\(PhotoGrouping.dayTitle(for: photo.created))  \(time)"
        }
        return time
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Localization.locale
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    private func viewerTime(_ date: Date) -> String {
        Self.timeFormatter.string(from: date)
    }

    private func circleButton(_ symbol: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.primary)
                .frame(width: 40, height: 40)
                .galleryGlass(in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func plainButton(_ symbol: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(.primary)
                .frame(width: 44, height: 36)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func closeAnimated() {
        if let pager = playback.pager {
            pager.closeToGrid()
        } else {
            dismiss()
        }
    }

    private func closeQuiet() {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) { dismiss() }
    }

    private func toggleFavorite() {
        guard let photo, let photoID else { return }
        library.setFavorite(!photo.isFavorite, ids: [photoID])
    }

    /// The system share sheet (Messages, AirDrop, Save). Photos only on the server go to the
    /// GalleryOS share, which can send server copies.
    private func share() {
        guard let photoID, let presenter = UIApplication.shared.galleryTopController() else { return }
        if library.asset(id: photoID) != nil {
            PhotoSharing.present(ids: [photoID], asset: { library.asset(id: $0) }, from: presenter)
            return
        }
        // A server copy: share the downloaded original file itself.
        let media = library.cloudMedia(id: photoID)
        guard let file = media?.video ?? media?.still else { return }
        PhotoSharing.present(files: [file], from: presenter)
    }

    private func copyPhoto() {
        guard let photoID, let asset = library.asset(id: photoID) else { return }
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        PHImageManager.default().requestImage(
            for: asset,
            targetSize: PHImageManagerMaximumSize,
            contentMode: .aspectFit,
            options: options
        ) { image, _ in
            guard let image else { return }
            DispatchQueue.main.async {
                UIPasteboard.general.image = image
            }
        }
    }
}

enum PhotoSharing {
    static func present(ids: [String], asset: (String) -> PHAsset?, from presenter: UIViewController) {
        let assets = ids.compactMap(asset)
        guard !assets.isEmpty else { return }
        let group = DispatchGroup()
        let box = ShareBox()
        // Temporary copies only; video URLs point into the Photos library and must stay.
        let temporary = ShareBox()
        for item in assets.prefix(200) {
            group.enter()
            if item.mediaType == .video {
                let options = PHVideoRequestOptions()
                options.isNetworkAccessAllowed = true
                PHImageManager.default().requestAVAsset(forVideo: item, options: options) { avAsset, _, _ in
                    if let url = (avAsset as? AVURLAsset)?.url {
                        box.append(url)
                    }
                    group.leave()
                }
            } else {
                let options = PHImageRequestOptions()
                options.deliveryMode = .highQualityFormat
                options.isNetworkAccessAllowed = true
                PHImageManager.default().requestImageDataAndOrientation(for: item, options: options) { data, uti, _, _ in
                    if let data {
                        let ext = uti.flatMap { UTType($0)?.preferredFilenameExtension } ?? "jpg"
                        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension(ext)
                        if (try? data.write(to: url)) != nil {
                            box.append(url)
                            temporary.append(url)
                        }
                    }
                    group.leave()
                }
            }
        }
        group.notify(queue: .main) {
            let items = box.snapshot
            guard !items.isEmpty else { return }
            let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
            controller.completionWithItemsHandler = { _, _, _, _ in
                // The copies were only for sharing; leaving them filled the device over time.
                for url in temporary.snapshot { try? FileManager.default.removeItem(at: url) }
            }
            // iPad shows the sheet as a popover and crashes without an anchor.
            if let popover = controller.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
                popover.permittedArrowDirections = []
            }
            presenter.present(controller, animated: true)
        }
    }
}

extension PhotoSharing {
    static func present(files: [URL], from presenter: UIViewController) {
        guard !files.isEmpty else { return }
        let controller = UIActivityViewController(activityItems: files, applicationActivities: nil)
        if let popover = controller.popoverPresentationController {
            popover.sourceView = presenter.view
            popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }
        presenter.present(controller, animated: true)
    }
}

private final class ShareBox: @unchecked Sendable {
    private let lock = NSLock()
    private var items: [URL] = []
    func append(_ url: URL) {
        lock.lock()
        items.append(url)
        lock.unlock()
    }
    var snapshot: [URL] {
        lock.lock()
        defer { lock.unlock() }
        return items
    }
}

final class PageTrack {
    fileprivate weak var filmstrip: FilmstripView?
    fileprivate weak var pager: PhotoPagerController?
    func follow(_ fraction: CGFloat) {
        filmstrip?.follow(fraction)
    }

    /// The filmstrip is being dragged: show the centred photo at once, without a page animation.
    func scrub(to page: Int) {
        pager?.show(index: page, animated: false)
    }
}

struct PhotoPager: UIViewControllerRepresentable {
    let ids: [String]
    @Binding var index: Int
    let origin: CGRect
    let originImage: UIImage?
    var source: (any ViewerTransitionSource)?
    let asset: (String) -> PHAsset?
    var media: (String) -> CloudMedia? = { _ in nil }
    var revision = 0
    var immersive = false
    var playback: ViewerPlayback?
    let onClose: () -> Void
    let onToggleChrome: () -> Void
    var onDrag: (CGFloat) -> Void = { _ in }
    var track = PageTrack()

    func makeUIViewController(context: Context) -> PhotoPagerController {
        let controller = PhotoPagerController()
        controller.ids = ids
        controller.index = index
        controller.initialIndex = index
        controller.origin = origin
        controller.originImage = originImage
        controller.source = source
        controller.asset = asset
        controller.media = media
        controller.revision = revision
        controller.immersive = immersive
        controller.playback = playback
        playback?.pager = controller
        controller.onClose = onClose
        controller.onIndex = { index = $0 }
        controller.onToggleChrome = onToggleChrome
        controller.onDrag = onDrag
        controller.track = track
        return controller
    }

    func updateUIViewController(_ controller: PhotoPagerController, context: Context) {
        controller.asset = asset
        controller.media = media
        controller.onClose = onClose
        controller.onIndex = { index = $0 }
        controller.onToggleChrome = onToggleChrome
        controller.onDrag = onDrag
        controller.track = track
        track.pager = controller
        controller.playback = playback
        playback?.pager = controller
        controller.setImmersive(immersive)
        if !controller.isInteracting, controller.index != index {
            controller.show(index: index, animated: abs(controller.index - index) < 8)
        }
        if controller.revision != revision {
            controller.revision = revision
            // Soft refresh only — never wipe the painted current page on every cloud tick.
            controller.refreshMediaQuietly()
        }
    }
}

final class PhotoPagerController: UIViewController, UICollectionViewDataSource, UICollectionViewDelegate {
    var ids: [String] = []
    var index = 0
    var initialIndex = 0
    var origin: CGRect = .zero
    var originImage: UIImage?
    weak var source: (any ViewerTransitionSource)?
    var asset: (String) -> PHAsset? = { _ in nil }
    var media: (String) -> CloudMedia? = { _ in nil }
    var revision = 0
    var immersive = false
    weak var playback: ViewerPlayback?
    var onClose: () -> Void = {}
    var onIndex: (Int) -> Void = { _ in }
    var onToggleChrome: () -> Void = {}
    var onDrag: (CGFloat) -> Void = { _ in }
    var track = PageTrack()
    var isInteracting: Bool { dragging }

    private var collection: UICollectionView!
    private let flow = UICollectionViewFlowLayout()
    private var didAppear = false
    private var appliedSize: CGSize = .zero
    private var ticker: Timer?
    private var tapGesture: UITapGestureRecognizer?
    private var programmaticScroll = false
    private var dragging = false
    private var dismissPhoto: UIImageView?
    private var dismissStart: CGRect = .zero
    private var dismissAnchor = CGPoint(x: 0.5, y: 0.5)
    private var dismissTouch: CGPoint = .zero
    private var closing = false

    deinit { ticker?.invalidate() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        flow.scrollDirection = .horizontal
        flow.minimumLineSpacing = 0
        flow.minimumInteritemSpacing = 0
        let pager = PagerCollection(frame: .zero, collectionViewLayout: flow)
        pager.zoomed = { [weak self] in (self?.currentCell()?.zoomScale ?? 1) > 1.01 }
        collection = pager
        collection.backgroundColor = immersive ? .black : .systemBackground
        collection.isPagingEnabled = false
        collection.decelerationRate = .fast
        collection.delaysContentTouches = false
        collection.showsHorizontalScrollIndicator = false
        collection.contentInsetAdjustmentBehavior = .never
        collection.bounces = true
        collection.dataSource = self
        collection.delegate = self
        collection.register(ViewerCell.self, forCellWithReuseIdentifier: ViewerCell.reuse)
        view.addSubview(collection)
        let pan = UIPanGestureRecognizer(target: self, action: #selector(dragged(_:)))
        pan.delegate = self
        pan.cancelsTouchesInView = false
        collection.addGestureRecognizer(pan)
        let tap = UITapGestureRecognizer(target: self, action: #selector(tapped))
        collection.addGestureRecognizer(tap)
        tapGesture = tap
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        guard isViewLoaded else {
            super.viewWillTransition(to: size, with: coordinator)
            return
        }
        let page: Int
        if appliedSize.width > 1 {
            page = Int(round(collection.contentOffset.x / appliedSize.width))
        } else {
            page = index
        }
        let safe = min(max(page, 0), max(ids.count - 1, 0))
        super.viewWillTransition(to: size, with: coordinator)
        programmaticScroll = true
        coordinator.animate(alongsideTransition: { _ in
            self.appliedSize = size
            self.flow.itemSize = size
            self.collection.frame = CGRect(origin: .zero, size: size)
            self.collection.collectionViewLayout.invalidateLayout()
            self.collection.layoutIfNeeded()
            self.collection.contentOffset = CGPoint(x: CGFloat(safe) * size.width, y: 0)
        }, completion: { _ in
            self.index = safe
            self.programmaticScroll = false
            self.onIndex(safe)
        })
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        source?.viewerHide(nil)
        ticker?.invalidate()
        ticker = nil
        if let collection {
            for cell in collection.visibleCells { (cell as? ViewerCell)?.resignCurrent() }
        }
        // Give the audio back: music paused by a film resumes after the viewer closes.
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        collection.frame = view.bounds
        let size = view.bounds.size
        guard size.width > 1, size.height > 1 else { return }
        if appliedSize == .zero {
            appliedSize = size
            flow.itemSize = size
            collection.collectionViewLayout.invalidateLayout()
            collection.layoutIfNeeded()
            let safe = min(max(index, 0), max(ids.count - 1, 0))
            collection.setContentOffset(CGPoint(x: CGFloat(safe) * size.width, y: 0), animated: false)
        }
        guard !didAppear else { return }
        didAppear = true
        animateOrigin()
        // The transport needs live progress for a film that starts by itself, not only after a tap.
        ensureTicker()
    }

    func setImmersive(_ value: Bool) {
        guard immersive != value else { return }
        immersive = value
        let color: UIColor = value ? .black : .systemBackground
        collection?.backgroundColor = color
        guard let collection else { return }
        for cell in collection.visibleCells {
            (cell as? ViewerCell)?.setCanvas(color)
        }
    }

    func show(index target: Int, animated: Bool) {
        guard let collection, ids.indices.contains(target) else { return }
        let jump = abs(target - index) > 8
        index = target
        // Keep the grid tile under the viewer in sync, so closing flies back to the right photo.
        source?.viewerReveal(ids[target])
        source?.viewerHide(ids[target])
        updatePlayingPage()
        programmaticScroll = true
        collection.scrollToItem(
            at: IndexPath(item: target, section: 0),
            at: .centeredHorizontally,
            animated: animated && !jump
        )
        if !animated || jump { programmaticScroll = false }
    }

    func togglePlayback() {
        currentCell()?.playIfNeeded()
        ensureTicker()
        reportPlayback()
    }

    func seek(to fraction: Double) {
        currentCell()?.seek(fraction: fraction)
        ensureTicker()
    }

    private func ensureTicker() {
        guard ticker == nil else { return }
        let timer = Timer(timeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.reportPlayback()
        }
        RunLoop.main.add(timer, forMode: .common)
        ticker = timer
    }

    private func reportPlayback() {
        let cell = currentCell()
        playback?.note(playing: cell?.isPlaying ?? false, fraction: Double(cell?.fraction ?? 0))
    }

    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        ids.count
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: ViewerCell.reuse, for: indexPath) as! ViewerCell
        let id = ids[indexPath.item]
        cell.setCanvas(immersive ? .black : .systemBackground)
        cell.autoplay = indexPath.item == index
        if let doubleTap = cell.doubleTapGesture, let tapGesture {
            // A double tap zooms; it must not also toggle the controls.
            tapGesture.require(toFail: doubleTap)
        }
        cell.configure(asset: asset(id), media: media(id))
        return cell
    }

    func collectionView(_ collectionView: UICollectionView, didEndDisplaying cell: UICollectionViewCell, forItemAt indexPath: IndexPath) {
        (cell as? ViewerCell)?.resignCurrent()
    }

    /// Exactly one page plays: the current one. Called whenever the current page changes.
    private func updatePlayingPage() {
        guard let collection else { return }
        for indexPath in collection.indexPathsForVisibleItems {
            guard let cell = collection.cellForItem(at: indexPath) as? ViewerCell else { continue }
            if indexPath.item == index {
                cell.becameCurrent()
            } else {
                cell.resignCurrent()
            }
        }
        ensureTicker()
        reportPlayback()
    }

    func reloadVisible() {
        guard let collection else { return }
        for indexPath in collection.indexPathsForVisibleItems {
            guard let cell = collection.cellForItem(at: indexPath) as? ViewerCell else { continue }
            let id = ids[indexPath.item]
            cell.configure(asset: asset(id), media: media(id))
        }
    }

    /// Update media refs without forcing a full image reload when the still is already on screen.
    func refreshMediaQuietly() {
        guard let collection else { return }
        for indexPath in collection.indexPathsForVisibleItems {
            guard let cell = collection.cellForItem(at: indexPath) as? ViewerCell else { continue }
            let id = ids[indexPath.item]
            cell.refreshMediaIfNeeded(asset: asset(id), media: media(id))
        }
    }

    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
        dragging = true
        warmNeighbors()
    }

    private func warmNeighbors() {
        let width = collection.bounds.width
        guard width > 1 else { return }
        let page = Int(round(collection.contentOffset.x / width))
        let nearby = ((page - 1)...(page + 2)).compactMap { offset -> PHAsset? in
            guard ids.indices.contains(offset) else { return nil }
            return asset(ids[offset])
        }
        let scale = max(view.traitCollection.displayScale, 2)
        let size = CGSize(width: width * scale, height: collection.bounds.height * scale)
        ViewerImages.cache.startCachingImages(for: nearby, targetSize: size, contentMode: .aspectFit, options: nil)
    }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        guard scrollView === collection, collection.bounds.width > 1 else { return }
        let fraction = collection.contentOffset.x / collection.bounds.width
        track.follow(fraction)
    }

    func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
        dragging = false
        programmaticScroll = false
        publishIndex()
    }

    func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
        programmaticScroll = false
        publishIndex()
    }

    func scrollViewWillEndDragging(
        _ scrollView: UIScrollView,
        withVelocity velocity: CGPoint,
        targetContentOffset: UnsafeMutablePointer<CGPoint>
    ) {
        let width = max(scrollView.bounds.width, 1)
        var page = round(scrollView.contentOffset.x / width)
        if velocity.x > 0.15 { page = ceil(scrollView.contentOffset.x / width - 0.01) }
        if velocity.x < -0.15 { page = floor(scrollView.contentOffset.x / width + 0.01) }
        page = min(max(page, 0), CGFloat(max(ids.count - 1, 0)))
        targetContentOffset.pointee = scrollView.contentOffset
        let x = page * width
        UIView.animate(withDuration: 0.46, delay: 0, usingSpringWithDamping: 0.86, initialSpringVelocity: abs(velocity.x), options: [.allowUserInteraction, .beginFromCurrentState]) {
            scrollView.contentOffset.x = x
        } completion: { _ in
            self.dragging = false
            self.publishIndex()
        }
    }

    func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
        guard !decelerate else { return }
        dragging = false
        programmaticScroll = false
        publishIndex()
    }

    @objc private func tapped() {
        // A tap shows or hides the controls, as in Photos. Play and pause live on the transport bar,
        // otherwise the controls could never be hidden over a film.
        onToggleChrome()
    }

    @objc private func dragged(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: view)
        switch gesture.state {
        case .began:
            beginDismiss(touch: gesture.location(in: view))
        case .changed:
            guard let photo = dismissPhoto else { return }
            let height = max(view.bounds.height, 1)
            let drop = max(0, translation.y)
            let lift = min(0, translation.y)
            let scale = max(0.42, 1 - drop / height * 0.85)
            let size = CGSize(width: dismissStart.width * scale, height: dismissStart.height * scale)
            let finger = CGPoint(x: dismissTouch.x + translation.x, y: dismissTouch.y + drop + lift * 0.25)
            photo.frame = CGRect(
                x: finger.x - dismissAnchor.x * size.width,
                y: finger.y - dismissAnchor.y * size.height,
                width: size.width,
                height: size.height
            )
            onDrag(min(1, drop / (height * 0.42)))
        case .ended, .cancelled:
            let velocity = gesture.velocity(in: view)
            let drop = max(0, translation.y)
            if gesture.state == .ended, velocity.y > 260 || (drop > 120 && velocity.y > -120) {
                finishDismiss(velocity: velocity)
            } else {
                cancelDismiss(velocity: velocity)
            }
        default:
            break
        }
    }

    /// Back button and programmatic close: same flight home as the swipe-down gesture.
    func closeToGrid() {
        guard !closing else { return }
        beginDismiss(touch: CGPoint(x: view.bounds.midX, y: view.bounds.midY))
        finishDismiss(velocity: .zero)
    }

    private func beginDismiss(touch: CGPoint) {
        guard dismissPhoto == nil, !closing else { return }
        let cell = currentCell()
        let image = cell?.displayImage ?? originImage
        let start = cell?.imageFrame(in: view) ?? view.bounds
        let snapshot = UIImageView(image: image)
        snapshot.contentMode = .scaleAspectFill
        snapshot.clipsToBounds = true
        snapshot.layer.cornerCurve = .continuous
        snapshot.frame = start
        view.addSubview(snapshot)
        collection.alpha = 0
        dismissPhoto = snapshot
        dismissStart = start
        dismissTouch = touch
        dismissAnchor = CGPoint(
            x: start.width > 1 ? min(1, max(0, (touch.x - start.minX) / start.width)) : 0.5,
            y: start.height > 1 ? min(1, max(0, (touch.y - start.minY) / start.height)) : 0.5
        )
        if let id = currentID {
            source?.viewerReveal(id)
            source?.viewerHide(id)
        }
    }

    private var currentID: String? {
        ids.indices.contains(index) ? ids[index] : nil
    }

    private func closeTarget() -> CGRect? {
        if let id = currentID, let frame = source?.viewerFrame(for: id) {
            return view.convert(frame, from: nil)
        }
        if index == initialIndex, origin.width > 2 { return view.convert(origin, from: nil) }
        return nil
    }

    private func finishDismiss(velocity: CGPoint) {
        guard let snapshot = dismissPhoto else { return }
        closing = true
        let target = closeTarget()
        let current = snapshot.frame
        let animator: UIViewPropertyAnimator
        if let target {
            let distance = max(1, hypot(target.midX - current.midX, target.midY - current.midY))
            let speed = hypot(velocity.x, velocity.y) / distance
            let timing = UISpringTimingParameters(
                dampingRatio: 0.86,
                initialVelocity: CGVector(dx: min(speed, 8), dy: min(speed, 8))
            )
            animator = UIViewPropertyAnimator(duration: 0.44, timingParameters: timing)
            animator.addAnimations {
                snapshot.frame = target
                snapshot.layer.cornerRadius = 0
                self.onDrag(1)
            }
        } else {
            animator = UIViewPropertyAnimator(duration: 0.32, dampingRatio: 1)
            animator.addAnimations {
                snapshot.transform = CGAffineTransform(scaleX: 0.82, y: 0.82)
                    .translatedBy(x: 0, y: velocity.y > 0 ? 90 : 0)
                snapshot.alpha = 0
                self.onDrag(1)
            }
        }
        animator.addCompletion { _ in
            self.source?.viewerHide(nil)
            self.onClose()
        }
        animator.startAnimation()
    }

    private func cancelDismiss(velocity: CGPoint) {
        let snapshot = dismissPhoto
        let timing = UISpringTimingParameters(dampingRatio: 0.8, initialVelocity: .zero)
        let animator = UIViewPropertyAnimator(duration: 0.42, timingParameters: timing)
        animator.addAnimations {
            snapshot?.frame = self.dismissStart
            snapshot?.layer.cornerRadius = 0
            self.onDrag(0)
        }
        animator.addCompletion { _ in
            self.collection.alpha = 1
            snapshot?.removeFromSuperview()
            self.dismissPhoto = nil
        }
        animator.startAnimation()
    }

    private func publishIndex() {
        guard !programmaticScroll, collection.bounds.width > 1 else { return }
        let page = Int(round(collection.contentOffset.x / collection.bounds.width))
        guard ids.indices.contains(page), page != index else { return }
        index = page
        onIndex(page)
        source?.viewerReveal(ids[page])
        source?.viewerHide(ids[page])
        updatePlayingPage()
    }

    private func currentCell() -> ViewerCell? {
        collection.cellForItem(at: IndexPath(item: index, section: 0)) as? ViewerCell
    }

    private func animateOrigin() {
        if let id = currentID { source?.viewerHide(id) }
        guard let originImage, origin.width > 2, origin.height > 2 else { return }
        let snapshot = UIImageView(image: originImage)
        snapshot.contentMode = .scaleAspectFill
        snapshot.clipsToBounds = true
        snapshot.frame = view.convert(origin, from: nil)
        view.addSubview(snapshot)
        let photo = ids.indices.contains(index) ? asset(ids[index]) : nil
        let pixels = CGSize(
            width: CGFloat(photo?.pixelWidth ?? Int(originImage.size.width)),
            height: CGFloat(photo?.pixelHeight ?? Int(originImage.size.height))
        )
        let fitted = aspectFit(size: pixels, in: view.bounds)
        collection.alpha = 0
        let timing = UISpringTimingParameters(dampingRatio: 0.88, initialVelocity: .zero)
        let animator = UIViewPropertyAnimator(duration: 0.42, timingParameters: timing)
        animator.addAnimations {
            snapshot.frame = fitted
        }
        animator.addCompletion { _ in
            self.collection.alpha = 1
            UIView.animate(withDuration: 0.14, delay: 0, options: [.allowUserInteraction]) {
                snapshot.alpha = 0
            } completion: { _ in
                snapshot.removeFromSuperview()
            }
        }
        animator.startAnimation()
    }

    private func aspectFit(size image: CGSize, in bounds: CGRect) -> CGRect {
        guard image.width > 1, image.height > 1 else { return bounds }
        let scale = min(bounds.width / image.width, bounds.height / image.height)
        let size = CGSize(width: image.width * scale, height: image.height * scale)
        return CGRect(
            x: bounds.midX - size.width / 2,
            y: bounds.midY - size.height / 2,
            width: size.width,
            height: size.height
        )
    }
}

extension PhotoPagerController: UIGestureRecognizerDelegate {
    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let pan = gestureRecognizer as? UIPanGestureRecognizer else { return true }
        let velocity = pan.velocity(in: view)
        guard velocity.y > 0, abs(velocity.y) > abs(velocity.x) else { return false }
        let cell = currentCell()
        return (cell?.zoomScale ?? 1) <= 1.01 && (cell?.contentOffsetY ?? 0) <= 1
    }
}

final class PagerCollection: UICollectionView {
    var zoomed: () -> Bool = { false }

    override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        if gestureRecognizer === panGestureRecognizer, zoomed() { return false }
        return super.gestureRecognizerShouldBegin(gestureRecognizer)
    }
}

final class QuietScroll: UIScrollView {
    override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        if gestureRecognizer === panGestureRecognizer, zoomScale <= 1.01 {
            return false
        }
        return super.gestureRecognizerShouldBegin(gestureRecognizer)
    }
}

enum ViewerImages {
    static let cache = PHCachingImageManager()
}

enum LiveMotion {
    static var automatic: Bool {
        if UserDefaults.standard.object(forKey: "galleryos.live-auto") == nil { return true }
        return UserDefaults.standard.bool(forKey: "galleryos.live-auto")
    }
}

final class ViewerCell: UICollectionViewCell, UIScrollViewDelegate {
    static let reuse = "ViewerCell"
    private let scroll = QuietScroll()
    var images: PHCachingImageManager = ViewerImages.cache
    private let canvas = UIView()
    private let waiting = UILabel()
    private let imageView = UIImageView()
    private let liveView = PHLivePhotoView()
    private let playButton = UIImageView()
    private var request: PHImageRequestID = PHInvalidImageRequestID
    private var videoRequest: PHImageRequestID = PHInvalidImageRequestID
    private var videoExportStarted = false
    /// iCloud is already sending the film; a second full download would only compete with it.
    private var videoDownloading = false
    private var loadToken = 0
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var isLive = false
    /// Live Text, subject lifting ("podnieś motyw"), codes and Visual Look Up, as in Photos.
    private let analysis = ImageAnalysisInteraction()
    private var analysisTask: Task<Void, Never>?
    private static let analyzer = ImageAnalyzer()

    var displayImage: UIImage? { imageView.image }
    func imageFrame(in host: UIView) -> CGRect {
        let box = imageView.frame
        guard let size = imageView.image?.size, size.width > 0, size.height > 0 else {
            return canvas.convert(box, to: host)
        }
        return canvas.convert(AVMakeRect(aspectRatio: size, insideRect: box), to: host)
    }
    var zoomScale: CGFloat { scroll.zoomScale }
    var contentOffsetY: CGFloat { scroll.contentOffset.y }
    var playerIsActive: Bool { player != nil || isLive }
    var isPlaying: Bool {
        if player?.timeControlStatus == .playing { return true }
        return livePulse
    }
    var fraction: CGFloat {
        guard let player, let item = player.currentItem else { return 0 }
        let duration = item.duration.seconds
        let time = player.currentTime().seconds
        guard duration.isFinite, duration > 0, time.isFinite else { return 0 }
        return CGFloat(min(1, max(0, time / duration)))
    }
    private var assetRef: PHAsset?
    private var mediaRef: CloudMedia?
    private var requestedSide: CGFloat = 0
    private var livePulse = false
    private var filled = false
    /// Only the page on screen may play. Neighbours are prepared silently.
    var autoplay = false
    private(set) var doubleTapGesture: UITapGestureRecognizer?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .systemBackground
        scroll.delegate = self
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = 5
        scroll.bouncesZoom = true
        scroll.bounces = true
        scroll.alwaysBounceHorizontal = false
        scroll.alwaysBounceVertical = false
        scroll.showsHorizontalScrollIndicator = false
        scroll.showsVerticalScrollIndicator = false
        scroll.contentInsetAdjustmentBehavior = .never
        contentView.addSubview(scroll)
        scroll.addSubview(canvas)
        imageView.contentMode = .scaleAspectFit
        imageView.isUserInteractionEnabled = true
        analysis.preferredInteractionTypes = []
        imageView.addInteraction(analysis)
        canvas.addSubview(imageView)
        liveView.contentMode = .scaleAspectFit
        liveView.isHidden = true
        canvas.addSubview(liveView)
        waiting.text = L("Wczytuję")
        waiting.font = .systemFont(ofSize: 15, weight: .semibold)
        waiting.textColor = .secondaryLabel
        waiting.isHidden = true
        contentView.addSubview(waiting)
        playButton.isHidden = true
        contentView.addSubview(playButton)
        let doubleTap = UITapGestureRecognizer(target: self, action: #selector(doubleTapped(_:)))
        doubleTap.numberOfTapsRequired = 2
        addGestureRecognizer(doubleTap)
        doubleTapGesture = doubleTap
        let hold = UILongPressGestureRecognizer(target: self, action: #selector(held(_:)))
        hold.minimumPressDuration = 0.28
        hold.cancelsTouchesInView = false
        addGestureRecognizer(hold)
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        scroll.frame = contentView.bounds
        waiting.sizeToFit()
        waiting.center = CGPoint(x: contentView.bounds.midX, y: contentView.bounds.midY)
        if scroll.zoomScale <= 1.01 {
            canvas.frame = contentView.bounds
            imageView.frame = contentView.bounds
            liveView.frame = contentView.bounds
            playerLayer?.frame = canvas.bounds
            scroll.contentSize = contentView.bounds.size
        } else {
            playerLayer?.frame = canvas.bounds
        }
        let side = max(bounds.width, bounds.height)
        if requestedSide == 0, side > 1, assetRef != nil || mediaRef != nil {
            configure(asset: assetRef, media: mediaRef)
        }
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        if request != PHInvalidImageRequestID {
            images.cancelImageRequest(request)
        }
        if videoRequest != PHInvalidImageRequestID {
            images.cancelImageRequest(videoRequest)
        }
        request = PHInvalidImageRequestID
        videoRequest = PHInvalidImageRequestID
        analysisTask?.cancel()
        analysis.analysis = nil
        analysis.preferredInteractionTypes = []
        videoExportStarted = false
        videoDownloading = false
        imageView.image = nil
        waiting.isHidden = true
        liveView.stopPlayback()
        liveView.livePhoto = nil
        liveView.isHidden = true
        player?.pause()
        player = nil
        playerLayer?.removeFromSuperlayer()
        playerLayer = nil
        playButton.isHidden = true
        isLive = false
        livePulse = false
        assetRef = nil
        mediaRef = nil
        requestedSide = 0
        filled = false
        scroll.zoomScale = 1
        imageView.isHidden = false
    }

    func refreshMediaIfNeeded(asset: PHAsset?, media: CloudMedia?) {
        let sameAsset = assetRef?.localIdentifier == asset?.localIdentifier
        let sameStill = mediaRef?.still?.path == media?.still?.path
        let sameVideo = mediaRef?.video?.path == media?.video?.path
        mediaRef = media
        assetRef = asset
        guard !sameAsset || !sameStill || !sameVideo else { return }
        // Only reload when the underlying media actually changed (e.g. cloud file arrived).
        if imageView.image == nil || media?.still != nil && !sameStill || media?.video != nil && !sameVideo {
            configure(asset: asset, media: media)
        }
    }

    func setCanvas(_ color: UIColor) {
        backgroundColor = color
        contentView.backgroundColor = color
    }

    func resetZoom() {
        guard scroll.zoomScale > 1 else { return }
        scroll.setZoomScale(1, animated: false)
    }

    func seek(fraction: CGFloat) {
        guard let player, let item = player.currentItem else { return }
        let seconds = item.duration.seconds * Double(min(1, max(0, fraction)))
        guard seconds.isFinite else { return }
        revealPlayer()
        player.seek(to: CMTime(seconds: max(0, seconds), preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    }

    func configure(asset: PHAsset?, media: CloudMedia? = nil) {
        assetRef = asset
        mediaRef = media
        waiting.isHidden = asset != nil || media?.still != nil || media?.video != nil
        loadToken += 1
        let token = loadToken
        let size = displaySize()
        if bounds.width > 1 { requestedSide = max(bounds.width, bounds.height) }
        guard let asset else {
            show(media)
            return
        }
        if asset.mediaSubtypes.contains(.photoLive) {
            isLive = true
            liveView.isHidden = false
            let options = PHLivePhotoRequestOptions()
            options.deliveryMode = .highQualityFormat
            options.isNetworkAccessAllowed = true
            request = images.requestLivePhoto(for: asset, targetSize: size, contentMode: .aspectFit, options: options) { [weak self] live, _ in
                DispatchQueue.main.async {
                    guard let self, self.loadToken == token else { return }
                    self.liveView.livePhoto = live
                    if LiveMotion.automatic {
                        self.liveView.startPlayback(with: .hint)
                    }
                }
            }
            // The live view plays the motion itself. A separate copy of the paired video
            // filled the temporary folder and replaced the still after playing.
            return
        }
        if asset.playbackStyle == .imageAnimated || Self.isGIF(asset) {
            playAnimated(asset, token: token, side: max(size.width, size.height))
            return
        }
        if asset.mediaType == .video {
            waiting.text = L("Otwieram film…")
            waiting.sizeToFit()
            waiting.isHidden = false
            let still = PHImageRequestOptions()
            still.deliveryMode = .fastFormat
            still.resizeMode = .fast
            still.isNetworkAccessAllowed = true
            request = images.requestImage(for: asset, targetSize: CGSize(width: 1200, height: 1200), contentMode: .aspectFit, options: still) { [weak self] image, info in
                let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
                DispatchQueue.main.async {
                    self?.applyDisplayImage(image, token: token, asset: asset, degraded: degraded)
                }
            }
            if let file = media?.video {
                startFilm(AVPlayerItem(url: file), token: token)
            }
            let video = PHVideoRequestOptions()
            video.isNetworkAccessAllowed = true
            video.deliveryMode = .automatic
            video.progressHandler = { [weak self] progress, _, _, _ in
                DispatchQueue.main.async {
                    guard let self, self.loadToken == token, self.player == nil else { return }
                    self.videoDownloading = true
                    self.waiting.text = L("Pobieram film… \(Int((progress * 100).rounded()))%")
                    self.waiting.sizeToFit()
                    self.waiting.center = CGPoint(x: self.contentView.bounds.midX, y: self.contentView.bounds.midY)
                    self.waiting.isHidden = false
                }
            }
            videoRequest = images.requestPlayerItem(forVideo: asset, options: video) { [weak self] item, _ in
                DispatchQueue.main.async {
                    guard let self, self.loadToken == token else { return }
                    if let item {
                        self.startFilm(item, token: token)
                    } else if self.player == nil {
                        self.exportFilm(asset, token: token)
                    }
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in
                guard let self, self.loadToken == token, self.player == nil, !self.videoDownloading else { return }
                self.exportFilm(asset, token: token)
            }
            return
        }
        let options = PHImageRequestOptions()
        options.deliveryMode = .opportunistic
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        request = images.requestImage(for: asset, targetSize: size, contentMode: .aspectFit, options: options) { [weak self] image, info in
            let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
            DispatchQueue.main.async {
                self?.applyDisplayImage(image, token: token, asset: asset, degraded: degraded)
            }
        }
    }

    private func startFilm(_ item: AVPlayerItem, token: Int) {
        guard loadToken == token else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try? AVAudioSession.sharedInstance().setActive(true)
        attachPlayer(item: item, visible: true)
        waiting.isHidden = true
        if autoplay { player?.play() }
    }

    /// The pager calls this when the page becomes the one on screen.
    func becameCurrent() {
        guard !autoplay else { return }
        autoplay = true
        scheduleAnalysis()
        guard let player, player.timeControlStatus != .playing else { return }
        let time = player.currentTime().seconds
        // Start a film that has not been watched yet; leave a paused one where the user stopped it.
        if !time.isFinite || time < 0.05 { player.play() }
    }

    /// The pager calls this when the page leaves the screen: no sound from a film nobody sees.
    func resignCurrent() {
        autoplay = false
        analysisTask?.cancel()
        player?.pause()
        liveView.stopPlayback()
        livePulse = false
    }

    /// Photos sometimes returns no player item for an iCloud film. Writing the file is the path that still opens it.
    private func exportFilm(_ asset: PHAsset, token: Int) {
        guard !videoExportStarted, player == nil, loadToken == token else { return }
        videoExportStarted = true
        waiting.text = L("Pobieram film…")
        waiting.sizeToFit()
        waiting.isHidden = false
        let resources = PHAssetResource.assetResources(for: asset)
        guard let resource = resources.first(where: { $0.type == .video || $0.type == .fullSizeVideo }) else {
            waiting.text = L("Nie mogę otworzyć filmu")
            return
        }
        let ext = (resource.originalFilename as NSString).pathExtension
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(ext.isEmpty ? "mov" : ext)
        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true
        PHAssetResourceManager.default().writeData(for: resource, toFile: url, options: options) { [weak self] error in
            DispatchQueue.main.async {
                guard let self, self.loadToken == token else {
                    try? FileManager.default.removeItem(at: url)
                    return
                }
                if error != nil || self.player != nil {
                    if self.player == nil {
                        self.waiting.text = L("Film jest w iCloud i nie schodzi")
                        self.waiting.isHidden = false
                    }
                    try? FileManager.default.removeItem(at: url)
                    return
                }
                self.startFilm(AVPlayerItem(url: url), token: token)
            }
        }
    }

    private func playAnimated(_ asset: PHAsset, token: Int, side: CGFloat) {
        let options = PHImageRequestOptions()
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .highQualityFormat
        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { [weak self] data, _, _, _ in
            guard let data, let animated = AnimatedFrames.image(data: data, maxSide: min(side, 900), maxFrames: 48) else { return }
            DispatchQueue.main.async {
                guard let self, self.loadToken == token else { return }
                self.imageView.image = animated
            }
        }
    }

    private func applyDisplayImage(_ image: UIImage?, token: Int, asset: PHAsset, degraded: Bool) {
        guard loadToken == token, let image else { return }
        imageView.image = image
        guard !degraded else { return }
        scheduleAnalysis()
        let pixels = max(image.size.width, image.size.height) * image.scale
        let needed = max(bounds.width, bounds.height) * max(traitCollection.displayScale, 2)
        guard !filled, bounds.width > 1, pixels < needed * 0.8 else { return }
        filled = true
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        let scale = max(traitCollection.displayScale, 2)
        let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
        request = images.requestImage(
            for: asset,
            targetSize: size,
            contentMode: .aspectFit,
            options: options
        ) { [weak self] sharper, _ in
            DispatchQueue.main.async {
                guard let self, self.loadToken == token, let sharper else { return }
                self.imageView.image = sharper
                self.scheduleAnalysis()
            }
        }
    }

    private func displaySize() -> CGSize {
        let scale = max(traitCollection.displayScale, 2)
        let width = bounds.width > 1 ? bounds.width : 390
        let height = bounds.height > 1 ? bounds.height : 844
        return CGSize(width: width * scale, height: height * scale)
    }

    private func attachPlayer(item: AVPlayerItem, visible: Bool) {
        player?.pause()
        playerLayer?.removeFromSuperlayer()
        let player = AVPlayer(playerItem: item)
        let layer = AVPlayerLayer(player: player)
        layer.videoGravity = .resizeAspect
        layer.frame = canvas.bounds
        layer.isHidden = !visible
        canvas.layer.addSublayer(layer)
        self.player = player
        playerLayer = layer
    }

    private func revealPlayer() {
        guard playerLayer != nil else { return }
        playerLayer?.isHidden = false
        liveView.isHidden = true
        imageView.isHidden = true
    }

    private func show(_ media: CloudMedia?) {
        player?.pause()
        player = nil
        playerLayer?.removeFromSuperlayer()
        playerLayer = nil
        liveView.livePhoto = nil
        liveView.isHidden = true
        guard let media else {
            waiting.isHidden = false
            return
        }
        waiting.isHidden = true
        if media.isLive, let still = media.still, let video = media.video {
            isLive = true
            liveView.isHidden = false
            let image = UIImage(contentsOfFile: still.path)
            PHLivePhoto.request(withResourceFileURLs: [still, video], placeholderImage: image, targetSize: bounds.size, contentMode: .aspectFit) { [weak self] live, _ in
                DispatchQueue.main.async {
                    self?.liveView.livePhoto = live
                    if LiveMotion.automatic {
                        self?.liveView.startPlayback(with: .hint)
                    }
                }
            }
            return
        }
        if let video = media.video {
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
            try? AVAudioSession.sharedInstance().setActive(true)
            let player = AVPlayer(url: video)
            let layer = AVPlayerLayer(player: player)
            layer.videoGravity = .resizeAspect
            layer.frame = canvas.bounds
            canvas.layer.addSublayer(layer)
            self.player = player
            playerLayer = layer
            waiting.isHidden = true
            if autoplay { player.play() }
            return
        }
        if let still = media.still {
            imageView.image = UIImage(contentsOfFile: still.path)
            if still.pathExtension.lowercased() == "gif" {
                // A GIF from the server: play its frames instead of showing the first one.
                let token = loadToken
                let side = max(bounds.width, bounds.height) * max(traitCollection.displayScale, 2)
                DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                    guard let data = try? Data(contentsOf: still),
                          let animated = AnimatedFrames.image(data: data, maxSide: min(side, 900), maxFrames: 48) else { return }
                    DispatchQueue.main.async {
                        guard let self, self.loadToken == token else { return }
                        self.imageView.image = animated
                    }
                }
                return
            }
            scheduleAnalysis()
        }
    }

    /// GIFs saved from some apps are not marked as animated by Photos; their file type tells.
    private static func isGIF(_ asset: PHAsset) -> Bool {
        PHAssetResource.assetResources(for: asset).contains { $0.uniformTypeIdentifier.lowercased().contains("gif") }
    }

    /// Analyses only the photo on screen, once it is sharp, so paging stays light.
    private func scheduleAnalysis() {
        analysisTask?.cancel()
        guard ImageAnalyzer.isSupported, !isLive, player == nil, imageView.image != nil else { return }
        let token = loadToken
        analysisTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(450))
            guard let self, !Task.isCancelled, self.loadToken == token, self.autoplay,
                  let image = self.imageView.image, image.images == nil else { return }
            let configuration = ImageAnalyzer.Configuration([.text, .visualLookUp, .machineReadableCode])
            guard let result = try? await Self.analyzer.analyze(image, configuration: configuration),
                  !Task.isCancelled, self.loadToken == token else { return }
            // The Live Text button sits above the filmstrip and toolbar.
            self.analysis.supplementaryInterfaceContentInsets = UIEdgeInsets(top: 0, left: 0, bottom: 150, right: 4)
            self.analysis.analysis = result
            self.analysis.preferredInteractionTypes = .automatic
        }
    }

    func playIfNeeded() {
        if let player {
            revealPlayer()
            if player.timeControlStatus == .playing {
                player.pause()
            } else {
                player.play()
            }
            return
        }
        guard isLive else { return }
        liveView.startPlayback(with: .full)
        livePulse = true
        let token = loadToken
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.8) { [weak self] in
            guard let self, self.loadToken == token else { return }
            self.livePulse = false
        }
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? {
        canvas
    }

    @objc private func held(_ gesture: UILongPressGestureRecognizer) {
        guard isLive, !LiveMotion.automatic else { return }
        switch gesture.state {
        case .began:
            liveView.startPlayback(with: .full)
        case .ended, .cancelled, .failed:
            liveView.stopPlayback()
        default:
            break
        }
    }

    @objc private func doubleTapped(_ gesture: UITapGestureRecognizer) {
        if scroll.zoomScale > 1 {
            scroll.setZoomScale(1, animated: true)
        } else {
            let point = gesture.location(in: imageView)
            let size = CGSize(width: scroll.bounds.width / 2.5, height: scroll.bounds.height / 2.5)
            scroll.zoom(to: CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height), animated: true)
        }
    }
}

final class ViewerPlayback: ObservableObject {
    @Published var fraction: Double = 0
    @Published var playing = false
    weak var pager: PhotoPagerController?
    var scrubbing = false

    func toggle() { pager?.togglePlayback() }

    func seek(_ value: Double) {
        let clamped = min(1, max(0, value))
        fraction = clamped
        pager?.seek(to: clamped)
    }

    func note(playing: Bool, fraction: Double) {
        if self.playing != playing { self.playing = playing }
        guard !scrubbing else { return }
        if abs(self.fraction - fraction) > 0.004 { self.fraction = fraction }
    }
}

private struct ViewerTransport: View {
    @ObservedObject var playback: ViewerPlayback

    var body: some View {
        HStack(spacing: 12) {
            Button {
                playback.toggle()
            } label: {
                Image(systemName: playback.playing ? "pause.fill" : "play.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.primary)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(playback.playing ? L("Pauza") : L("Odtwórz"))
            GeometryReader { geo in
                Capsule()
                    .fill(Color.primary.opacity(0.18))
                    .frame(height: 4)
                    .frame(maxHeight: .infinity)
                    .overlay(alignment: .leading) {
                        Capsule()
                            .fill(Color.primary)
                            .frame(width: max(4, geo.size.width * playback.fraction), height: 4)
                    }
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                playback.scrubbing = true
                                let width = max(geo.size.width, 1)
                                playback.seek(value.location.x / width)
                            }
                            .onEnded { _ in
                                playback.scrubbing = false
                            }
                    )
            }
            .frame(height: 28)
        }
        .padding(.horizontal, 16)
        .frame(height: 48)
        .galleryGlass(in: Capsule())
    }
}

private struct LinkedFilmstrip: UIViewRepresentable {
    var ids: [String]
    var index: Int
    var track: PageTrack
    var asset: (String) -> PHAsset?
    var fallback: (String) -> UIImage?
    var onPick: (Int) -> Void
    var onScrub: (Int) -> Void = { _ in }

    func makeUIView(context: Context) -> FilmstripView { FilmstripView() }

    func updateUIView(_ view: FilmstripView, context: Context) {
        track.filmstrip = view
        view.asset = asset
        view.fallback = fallback
        view.onPick = onPick
        view.onScrub = onScrub
        view.set(ids: ids)
        guard context.coordinator.anchored != index, !view.isDragging else { return }
        context.coordinator.anchored = index
        view.follow(CGFloat(index))
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator {
        var anchored = -1
    }
}

private final class FilmstripView: UIView, UICollectionViewDataSource, UICollectionViewDelegate {
    var asset: (String) -> PHAsset? = { _ in nil }
    var fallback: (String) -> UIImage? = { _ in nil }
    var onPick: (Int) -> Void = { _ in }
    var onScrub: (Int) -> Void = { _ in }
    private var ids: [String] = []
    private var collection: UICollectionView!
    private let pitch: CGFloat = 52
    private var dragging = false
    /// Last thumbnail that crossed the centre while dragging, as in Photos.
    private var scrubbed = -1
    private let tick = UISelectionFeedbackGenerator()
    private var pendingPage: Int?
    var isDragging: Bool { dragging }

    override init(frame: CGRect) {
        super.init(frame: frame)
        let flow = UICollectionViewFlowLayout()
        flow.scrollDirection = .horizontal
        flow.itemSize = CGSize(width: 48, height: 36)
        flow.minimumLineSpacing = 4
        collection = UICollectionView(frame: .zero, collectionViewLayout: flow)
        collection.backgroundColor = .clear
        collection.showsHorizontalScrollIndicator = false
        collection.decelerationRate = .normal
        collection.dataSource = self
        collection.delegate = self
        collection.register(FilmstripCell.self, forCellWithReuseIdentifier: FilmstripCell.reuse)
        addSubview(collection)
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        collection.frame = bounds
        let inset = max(0, bounds.width / 2 - 24)
        collection.contentInset = UIEdgeInsets(top: 6, left: inset, bottom: 6, right: inset)
    }

    func set(ids: [String]) {
        guard ids != self.ids else { return }
        self.ids = ids
        collection.reloadData()
    }

    func follow(_ fraction: CGFloat) {
        guard !dragging, collection.bounds.width > 1 else { return }
        collection.setContentOffset(CGPoint(x: fraction * pitch - collection.contentInset.left, y: -collection.contentInset.top), animated: false)
    }

    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int { ids.count }

    /// Tapping a thumbnail jumps to it, as in Photos. Before only dragging the strip worked.
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        UISelectionFeedbackGenerator().selectionChanged()
        onPick(indexPath.item)
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: FilmstripCell.reuse, for: indexPath) as! FilmstripCell
        let id = ids[indexPath.item]
        cell.set(asset: asset(id), fallback: fallback(id))
        return cell
    }

    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
        dragging = true
        scrubbed = centredPage(scrollView)
        tick.prepare()
    }

    /// Every thumbnail that reaches the centre opens at once, with a light tick.
    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        guard dragging, scrollView.bounds.width > 1, !ids.isEmpty else { return }
        let page = centredPage(scrollView)
        guard page != scrubbed else { return }
        scrubbed = page
        tick.selectionChanged()
        tick.prepare()
        onScrub(page)
    }

    private func centredPage(_ scrollView: UIScrollView) -> Int {
        let raw = (scrollView.contentOffset.x + scrollView.contentInset.left) / pitch
        return min(max(Int(round(raw)), 0), max(ids.count - 1, 0))
    }

    func scrollViewWillEndDragging(
        _ scrollView: UIScrollView,
        withVelocity velocity: CGPoint,
        targetContentOffset: UnsafeMutablePointer<CGPoint>
    ) {
        // Let the strip glide as far as the flick carries it (UIScrollView's own physics),
        // then land exactly on the nearest thumbnail. Each one passing the centre still ticks.
        let raw = (targetContentOffset.pointee.x + scrollView.contentInset.left) / pitch
        let page = min(max(Int(round(raw)), 0), max(ids.count - 1, 0))
        pendingPage = page
        targetContentOffset.pointee = CGPoint(
            x: CGFloat(page) * pitch - scrollView.contentInset.left,
            y: -scrollView.contentInset.top
        )
    }

    func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
        guard !decelerate else { return }
        finishStrip()
    }

    func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
        finishStrip()
    }

    private func finishStrip() {
        dragging = false
        guard let pendingPage else { return }
        self.pendingPage = nil
        onPick(pendingPage)
    }
}

private final class FilmstripCell: UICollectionViewCell {
    static let reuse = "FilmstripCell"
    private let imageView = UIImageView()
    private var request: PHImageRequestID = PHInvalidImageRequestID
    private var currentID: String?

    override init(frame: CGRect) {
        super.init(frame: frame)
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = 5
        contentView.addSubview(imageView)
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        imageView.frame = contentView.bounds
    }

    func set(asset: PHAsset?, fallback: UIImage?) {
        guard let asset else {
            imageView.image = fallback
            currentID = nil
            return
        }
        guard currentID != asset.localIdentifier else { return }
        currentID = asset.localIdentifier
        imageView.image = fallback
        if request != PHInvalidImageRequestID { PHImageManager.default().cancelImageRequest(request) }
        let fast = PHImageRequestOptions()
        fast.deliveryMode = .fastFormat
        fast.resizeMode = .fast
        fast.isNetworkAccessAllowed = false
        let scale = max(traitCollection.displayScale, 2)
        let size = CGSize(width: 48 * scale, height: 36 * scale)
        request = PHImageManager.default().requestImage(for: asset, targetSize: size, contentMode: .aspectFill, options: fast) { [weak self] image, _ in
            DispatchQueue.main.async {
                guard let self, self.currentID == asset.localIdentifier, let image else { return }
                self.imageView.image = image
            }
        }
    }
}

private struct ViewerThumb: UIViewRepresentable {
    var asset: PHAsset?
    var fallback: UIImage?

    func makeUIView(context: Context) -> ViewerThumbView { ViewerThumbView() }

    func updateUIView(_ view: ViewerThumbView, context: Context) {
        view.set(asset: asset, fallback: fallback)
    }
}

private final class ViewerThumbView: UIView {
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
            imageView.image = fallback
            currentID = nil
            return
        }
        guard currentID != asset.localIdentifier else { return }
        currentID = asset.localIdentifier
        if request != PHInvalidImageRequestID {
            PHImageManager.default().cancelImageRequest(request)
        }
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .exact
        options.isNetworkAccessAllowed = false
        options.isSynchronous = false
        let scale = max(traitCollection.displayScale, 2)
        var token = PHInvalidImageRequestID
        token = PHImageManager.default().requestImage(
            for: asset,
            targetSize: CGSize(width: 48 * scale, height: 36 * scale),
            contentMode: .aspectFill,
            options: options
        ) { [weak self] image, info in
            let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
            DispatchQueue.main.async {
                guard let self, self.request == token, !cancelled else { return }
                self.imageView.image = image ?? fallback
            }
        }
        request = token
    }
}

private final class ResumeOnce: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false

    func finish(_ continuation: CheckedContinuation<UIImage?, Never>, _ image: UIImage?) {
        lock.lock()
        if done {
            lock.unlock()
            return
        }
        done = true
        lock.unlock()
        continuation.resume(returning: image)
    }
}

private struct ViewerAdjustments: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var library: PhotoLibrary
    let photo: PhotoRef
    @State private var source: UIImage?
    @State private var brightness = 0.0
    @State private var contrast = 1.0
    @State private var saturation = 1.0
    @State private var saving = false
    @State private var failure = ""
    private static let context = CIContext()

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                ZStack {
                    Color(uiColor: .secondarySystemBackground)
                    if let image = filtered() {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                    } else {
                        ProgressView()
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                slider(L("Jasność"), value: $brightness, range: -0.35...0.35)
                slider(L("Kontrast"), value: $contrast, range: 0.7...1.4)
                slider(L("Nasycenie"), value: $saturation, range: 0...2)
                Text(failure.isEmpty ? explanation : failure)
                    .font(.footnote)
                    .foregroundStyle(failure.isEmpty ? Color.secondary : Color.orange)
                    .multilineTextAlignment(.center)
            }
            .padding(20)
            .navigationTitle(L("Dopasuj"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("Anuluj")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button(L("Gotowe")) { save() }
                            .disabled(source == nil)
                    }
                }
            }
            .task { source = await load() }
        }
        .presentationDetents([.medium, .large])
    }

    private var explanation: String {
        if library.asset(id: photo.id) != nil {
            return L("Gotowe zmienia zdjęcie w pełnej jakości. W aplikacji Zdjęcia możesz to cofnąć: Edytuj → Przywróć.")
        }
        return L("To zdjęcie jest tylko na serwerze. Gotowe zapisze poprawioną kopię na \(ThisDevice.locative), z tą samą datą i miejscem.")
    }

    /// A photo stored only on the server cannot be edited in place; the edited copy lands in
    /// Photos on this device with the original date and location, the server original stays.
    private func saveServerCopy() {
        guard let still = library.cloudMedia(id: photo.id)?.still,
              let original = CIImage(contentsOf: still, options: [.applyOrientationProperty: true]),
              let filter = CIFilter(name: "CIColorControls") else {
            failure = L("Oryginał jeszcze się pobiera. Spróbuj za chwilę.")
            return
        }
        saving = true
        failure = ""
        filter.setValue(original, forKey: kCIInputImageKey)
        filter.setValue(brightness, forKey: kCIInputBrightnessKey)
        filter.setValue(contrast, forKey: kCIInputContrastKey)
        filter.setValue(saturation, forKey: kCIInputSaturationKey)
        let file = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("jpg")
        let space = original.colorSpace ?? CGColorSpace(name: CGColorSpace.sRGB)!
        guard let result = filter.outputImage,
              (try? Self.context.writeJPEGRepresentation(of: result, to: file, colorSpace: space, options: [:])) != nil else {
            saving = false
            failure = L("Nie udało się zapisać zmiany.")
            return
        }
        let created = photo.created
        let place: CLLocation? = {
            guard let latitude = photo.latitude, let longitude = photo.longitude else { return nil }
            return CLLocation(latitude: latitude, longitude: longitude)
        }()
        PHPhotoLibrary.shared().performChanges {
            let request = PHAssetCreationRequest.forAsset()
            request.addResource(with: .photo, fileURL: file, options: nil)
            request.creationDate = created
            request.location = place
        } completionHandler: { ok, _ in
            try? FileManager.default.removeItem(at: file)
            DispatchQueue.main.async {
                saving = false
                if ok {
                    dismiss()
                } else {
                    failure = L("Kopia nie została zapisana. Sprawdź dostęp do zdjęć.")
                }
            }
        }
    }

    private func slider(_ title: String, value: Binding<Double>, range: ClosedRange<Double>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Slider(value: value, in: range)
        }
    }

    private func filtered() -> UIImage? {
        guard let source else { return nil }
        guard let input = CIImage(image: source),
              let filter = CIFilter(name: "CIColorControls") else { return source }
        filter.setValue(input, forKey: kCIInputImageKey)
        filter.setValue(brightness, forKey: kCIInputBrightnessKey)
        filter.setValue(contrast, forKey: kCIInputContrastKey)
        filter.setValue(saturation, forKey: kCIInputSaturationKey)
        guard let output = filter.outputImage,
              let cg = Self.context.createCGImage(output, from: output.extent) else { return source }
        return UIImage(cgImage: cg, scale: source.scale, orientation: source.imageOrientation)
    }

    private func load() async -> UIImage? {
        if let still = library.cloudMedia(id: photo.id)?.still {
            return UIImage(contentsOfFile: still.path)
        }
        guard let asset = library.asset(id: photo.id) else { return library.thumbnail(id: photo.id) }
        return await withCheckedContinuation { continuation in
            let gate = ResumeOnce()
            let options = PHImageRequestOptions()
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = true
            PHImageManager.default().requestImage(
                for: asset,
                // Preview only: a smaller image keeps the sliders smooth. Saving uses the original.
                targetSize: CGSize(width: 1000, height: 1000),
                contentMode: .aspectFit,
                options: options
            ) { image, info in
                let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
                if degraded { return }
                gate.finish(continuation, image)
            }
        }
    }

    /// Edits the original in place, like Photos: full resolution, same date and place,
    /// and revertible. It used to save a new 1600 px copy dated today.
    private func save() {
        guard let asset = library.asset(id: photo.id) else {
            saveServerCopy()
            return
        }
        saving = true
        failure = ""
        let brightness = brightness
        let contrast = contrast
        let saturation = saturation
        let options = PHContentEditingInputRequestOptions()
        options.isNetworkAccessAllowed = true
        asset.requestContentEditingInput(with: options) { input, _ in
            guard let input,
                  let url = input.fullSizeImageURL,
                  let original = CIImage(contentsOf: url)?.oriented(forExifOrientation: input.fullSizeImageOrientation),
                  let filter = CIFilter(name: "CIColorControls") else {
                DispatchQueue.main.async {
                    saving = false
                    failure = L("Nie udało się otworzyć oryginału.")
                }
                return
            }
            filter.setValue(original, forKey: kCIInputImageKey)
            filter.setValue(brightness, forKey: kCIInputBrightnessKey)
            filter.setValue(contrast, forKey: kCIInputContrastKey)
            filter.setValue(saturation, forKey: kCIInputSaturationKey)
            let output = PHContentEditingOutput(contentEditingInput: input)
            output.adjustmentData = PHAdjustmentData(
                formatIdentifier: "pl.galleryos.adjust",
                formatVersion: "1",
                data: Data("\(brightness);\(contrast);\(saturation)".utf8)
            )
            let space = original.colorSpace ?? CGColorSpace(name: CGColorSpace.sRGB)!
            guard let result = filter.outputImage,
                  (try? Self.context.writeJPEGRepresentation(of: result, to: output.renderedContentURL, colorSpace: space, options: [:])) != nil else {
                DispatchQueue.main.async {
                    saving = false
                    failure = L("Nie udało się zapisać zmiany.")
                }
                return
            }
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest(for: asset).contentEditingOutput = output
            } completionHandler: { ok, _ in
                DispatchQueue.main.async {
                    saving = false
                    if ok {
                        dismiss()
                    } else {
                        failure = L("Zmiana nie została zapisana.")
                    }
                }
            }
        }
    }
}

extension UIApplication {
    func galleryTopController() -> UIViewController? {
        let scenes = connectedScenes.compactMap { $0 as? UIWindowScene }
        let root = scenes.flatMap(\.windows).first { $0.isKeyWindow }?.rootViewController
        var controller = root
        while let presented = controller?.presentedViewController {
            controller = presented
        }
        return controller
    }
}

import SwiftUI

struct TVViewer: View {
    let context: TVViewerContext
    let onClose: (PhotoRef) -> Void

    @EnvironmentObject private var library: TVLibrary
    @EnvironmentObject private var pipeline: TVImagePipeline
    @Environment(\.dismiss) private var dismiss

    @State private var index: Int
    @State private var shown: UIImage?
    @State private var shownIndex = -1
    @State private var showInfo = false
    @State private var chrome = true
    @State private var chromeTick = 0
    @State private var playback: TVPlayback?
    @State private var loadFailed = false
    @State private var loadNote = ""
    @State private var slideshow: Bool
    @State private var posterOnly = false
    @State private var lastMove = Date.distantPast
    @State private var autoplay: Bool
    @State private var sharp = false
    @State private var retryTick = 0
    @FocusState private var focused: Bool

    /// Native panel size: 3840 on a 4K TV, 1920 on HD. Nothing bigger is ever decoded.
    private static let fullSide: CGFloat = {
        let bounds = UIScreen.main.nativeBounds
        return min(3840, max(1920, max(bounds.width, bounds.height)))
    }()

    init(context: TVViewerContext, onClose: @escaping (PhotoRef) -> Void) {
        self.context = context
        self.onClose = onClose
        _index = State(initialValue: context.start)
        // ▶︎ on a film or a Live Photo plays it; on a photo it starts a slideshow.
        let first = context.photos.indices.contains(context.start) ? context.photos[context.start] : nil
        let moving = first.map { $0.traits.isVideo || $0.traits.contains(.live) } ?? false
        _autoplay = State(initialValue: context.slideshow && moving)
        _slideshow = State(initialValue: context.slideshow && !moving)
    }

    private var photo: PhotoRef { context.photos[index] }
    private var asset: LibraryAsset? { library.asset(for: photo) }
    private var isMovie: Bool { photo.traits.isVideo }
    private var isLive: Bool { photo.traits.contains(.live) && asset?.paired != nil }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            stage
            if chrome || showInfo { topBar.transition(.opacity) }
            if showInfo {
                infoCard
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            if !showInfo && chrome && !slideshow { hint.transition(.opacity) }
            if slideshow && chrome { slideshowBadge.transition(.opacity.combined(with: .scale(scale: 0.9))) }
            if !sharp && shown != nil && shownIndex == index && !isMovie && !slideshow { sharpeningBadge.transition(.opacity) }
        }
        .ignoresSafeArea()
        .animation(.easeInOut(duration: 0.28), value: chrome)
        .animation(TVTheme.spring, value: showInfo)
        .animation(TVTheme.spring, value: slideshow)
        .task(id: "\(index)#\(pipeline.epoch)#\(retryTick)") { await load() }
        .task(id: chromeTick) {
            try? await Task.sleep(nanoseconds: 4_500_000_000)
            if !Task.isCancelled && !showInfo { chrome = false }
        }
        .task(id: slideshow) { await runSlideshow() }
        .onAppear { focused = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .fullScreenCover(item: $playback) { request in
            TVPlayerView(playback: request)
        }
    }

    // MARK: Stage

    private var stage: some View {
        Button(action: select) {
            ZStack {
                if let shown {
                    TVStill(image: shown, drift: slideshow && !isMovie, anchor: Self.driftAnchors[abs(shownIndex) % 4])
                        .id(shownIndex)
                        .transition(.opacity)
                } else if isMovie && ((posterOnly && shownIndex == index) || loadFailed) {
                    TVFilmPoster(duration: photo.duration)
                        .transition(.opacity)
                }
                // Spinner only when nothing is painted yet — keep the previous frame while the next loads.
                if shown == nil && shownIndex != index && !loadFailed {
                    ProgressView().scaleEffect(1.6)
                }
                if loadFailed && shown == nil && !isMovie {
                    VStack(spacing: 18) {
                        Image(systemName: "wifi.exclamationmark")
                            .font(.system(size: 64))
                            .foregroundStyle(.orange)
                        Text(L("Nie wczytano podglądu"))
                            .font(.title2.weight(.semibold))
                        Text(loadNote.isEmpty ? L("Naciśnij, aby spróbować ponownie.") : loadNote)
                            .font(.title3)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 900)
                    }
                }
                if isMovie && (shownIndex == index || loadFailed) {
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 120))
                        .foregroundStyle(.white.opacity(0.9))
                        .shadow(radius: 24)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(TVBareButtonStyle())
        .focusEffectDisabled()
        .focused($focused)
        .background(RemoteSwipe(enabled: playback == nil) { delta, began in swiped(delta, began: began) })
        .onMoveCommand(perform: move)
        .onPlayPauseCommand(perform: play)
        .onExitCommand(perform: exit)
    }

    private var topBar: some View {
        VStack {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(TVFormat.dayTitle(photo.created)).font(.title3.weight(.semibold))
                    HStack(spacing: 10) {
                        Text(TVFormat.time(photo.created))
                        if let place = library.placeName(for: photo) {
                            Text("·")
                            Label(place, systemImage: "mappin.and.ellipse").labelStyle(.titleAndIcon)
                        }
                    }
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.7))
                }
                .contentTransition(.opacity)
                .animation(.easeInOut(duration: 0.25), value: index)
                Spacer()
                HStack(spacing: 18) {
                    if photo.isFavorite { Image(systemName: "heart.fill").foregroundStyle(.pink) }
                    if isLive { Label("LIVE", systemImage: "livephoto").font(.headline) }
                    Text("\(index + 1) z \(context.photos.count)")
                        .font(.headline)
                        .monospacedDigit()
                        .foregroundStyle(.white.opacity(0.7))
                }
            }
            .padding(.horizontal, 90)
            .padding(.top, 60)
            .padding(.bottom, 60)
            .background(LinearGradient(colors: [.black.opacity(0.6), .clear], startPoint: .top, endPoint: .bottom))
            Spacer()
        }
        .foregroundStyle(.white)
        .allowsHitTesting(false)
    }

    private var hint: some View {
        VStack {
            Spacer()
            HStack(spacing: 26) {
                if isMovie {
                    Label(L("Naciśnij, aby odtworzyć film"), systemImage: "play.fill")
                } else if isLive {
                    Label(L("▶︎ odtwarza Live Photo"), systemImage: "livephoto")
                } else {
                    Label(L("▶︎ pokaz slajdów"), systemImage: "play.rectangle.on.rectangle")
                }
                Label(L("↑ informacje"), systemImage: "info.circle")
            }
            .font(.headline)
            .padding(.horizontal, 28)
            .padding(.vertical, 14)
            .galleryGlass(in: Capsule())
            .padding(.bottom, 60)
        }
        .allowsHitTesting(false)
    }

    /// The thumbnail is on screen while the original is still on its way.
    private var sharpeningBadge: some View {
        VStack {
            HStack {
                Spacer()
                HStack(spacing: 12) {
                    if loadFailed {
                        Image(systemName: "arrow.clockwise")
                        Text(L("Oryginał nie dotarł · naciśnij, aby ponowić"))
                    } else {
                        ProgressView().scaleEffect(0.7)
                        Text(L("Wczytuję oryginał…"))
                    }
                }
                .font(.callout.weight(.medium))
                .padding(.horizontal, 22)
                .padding(.vertical, 12)
                .galleryGlass(in: Capsule())
            }
            Spacer()
        }
        .padding(.top, chrome ? 150 : 60)
        .padding(.horizontal, 90)
        .allowsHitTesting(false)
    }

    private static let driftAnchors: [UnitPoint] = [.center, .topLeading, .bottomTrailing, .topTrailing]

    private var slideshowBadge: some View {
        VStack {
            Spacer()
            Label(L("Pokaz slajdów · ▶︎ zatrzymuje"), systemImage: "play.rectangle.on.rectangle.fill")
                .font(.headline)
                .padding(.horizontal, 28)
                .padding(.vertical, 14)
                .galleryGlass(in: Capsule())
                .padding(.bottom, 60)
        }
        .allowsHitTesting(false)
    }

    private var infoCard: some View {
        VStack {
            Spacer()
            VStack(alignment: .leading, spacing: 14) {
                Text(TVFormat.dayTitle(photo.created)).font(.title2.weight(.bold))
                infoLine("clock", TVFormat.time(photo.created))
                if let place = library.placeName(for: photo) { infoLine("mappin.and.ellipse", place) }
                infoLine("aspectratio", "\(photo.pixelWidth) × \(photo.pixelHeight)" + sizeText)
                if let albums = asset?.albumNames, !albums.isEmpty {
                    infoLine("rectangle.stack", albums.joined(separator: ", "))
                }
                if isMovie { infoLine("play.fill", PhotoFormat.duration(photo.duration)) }
                if let line = uploadLine { infoLine("icloud.and.arrow.up", line) }
            }
            .padding(36)
            .frame(maxWidth: 1000, alignment: .leading)
            .galleryGlass(in: RoundedRectangle(cornerRadius: 34, style: .continuous))
            .padding(.bottom, 60)
        }
        .foregroundStyle(.white)
        .allowsHitTesting(false)
    }

    /// Who sent it, from which device and when: "Marian · iPhone 17 Pro · 22 października 2026, 17:49".
    private var uploadLine: String? {
        guard let asset else { return nil }
        var parts: [String] = []
        if GalleryOwner.isMe(asset.owner) {
            parts.append(asset.ownerName ?? L("Ty"))
        } else if let name = asset.ownerName, !name.isEmpty {
            parts.append(name)
        }
        if let device = asset.device { parts.append(device) }
        if let uploaded = asset.uploadedAt {
            parts.append(uploaded.formatted(Date.FormatStyle(date: .long, time: .shortened).locale(Localization.locale)))
        }
        return parts.isEmpty ? nil : L("Wgrano: \(parts.joined(separator: " · "))")
    }

    private var sizeText: String {
        guard let bytes = asset?.primary?.bytes, bytes > 0 else { return "" }
        return " · " + TVFormat.bytes(bytes)
    }

    private func infoLine(_ symbol: String, _ text: String) -> some View {
        HStack(spacing: 16) {
            Image(systemName: symbol).frame(width: 34).foregroundStyle(TVTheme.accent)
            Text(text).font(.title3)
        }
    }

    // MARK: Remote

    private func move(_ direction: MoveCommandDirection) {
        slideshow = false
        if direction == .left || direction == .right { lastMove = Date() }
        switch direction {
        case .right: step(1)
        case .left: step(-1)
        case .up:
            showInfo = true
            chrome = true
        case .down:
            if showInfo { showInfo = false } else { chrome.toggle(); chromeTick += 1 }
        @unknown default: break
        }
    }

    /// A swipe on the clickpad can arrive both as a pan and as a move command; one gesture is
    /// one photo. A pan that already produced a move command while the finger was down is ignored.
    private func swiped(_ delta: Int, began: Date) {
        guard lastMove < began else { return }
        step(delta)
    }

    private func step(_ delta: Int) {
        slideshow = false
        let next = index + delta
        guard context.photos.indices.contains(next) else { return }
        showInfo = false
        index = next
        chrome = true
        chromeTick += 1
    }

    private func runSlideshow() async {
        UIApplication.shared.isIdleTimerDisabled = slideshow
        guard slideshow else { return }
        showInfo = false
        chrome = true
        chromeTick += 1
        while !Task.isCancelled {
            // Each slide gets its full time on screen: wait for the picture before counting.
            for _ in 0..<50 where shownIndex != index {
                try? await Task.sleep(nanoseconds: 200_000_000)
                if Task.isCancelled { return }
            }
            try? await Task.sleep(nanoseconds: 5_500_000_000)
            guard !Task.isCancelled, slideshow else { return }
            let stills = context.photos.indices.filter { !context.photos[$0].traits.isVideo }
            guard let next = stills.first(where: { $0 > index }) ?? stills.first, next != index else {
                slideshow = false
                return
            }
            index = next
        }
    }

    private func select() {
        if slideshow {
            slideshow = false
            return
        }
        if isMovie {
            play()
            return
        }
        if shown == nil || (loadFailed && !sharp) {
            retryTick += 1
            if shown == nil { return }
        }
        chrome.toggle()
        chromeTick += 1
    }

    private func play() {
        if slideshow || (!isMovie && !isLive) {
            slideshow.toggle()
            return
        }
        guard let current = library.asset(for: photo) else {
            loadFailed = true
            loadNote = L("Brak wpisu w katalogu. Odśwież bibliotekę w Ustawieniach.")
            return
        }
        let resource = isMovie ? current.primary : (isLive ? current.paired : nil)
        guard let resource else {
            loadFailed = true
            loadNote = L("W katalogu nie ma pliku wideo dla tego wpisu.")
            return
        }
        // A Live Photo plays only its own clip; a film plays among the films around it.
        var clips: [LibraryResource] = isMovie
            ? context.photos.compactMap { item in
                guard item.traits.isVideo, let asset = library.asset(for: item) else { return nil }
                return asset.primary
            }
            : [resource]
        if clips.isEmpty { clips = [resource] }
        let start = clips.firstIndex(where: { $0.hash == resource.hash && $0.ext == resource.ext }) ?? 0
        playback = TVPlayback(resources: clips, start: start)
    }

    private func exit() {
        if slideshow {
            slideshow = false
            return
        }
        if showInfo {
            showInfo = false
            return
        }
        onClose(photo)
        dismiss()
    }

    // MARK: Loading

    private func load() async {
        let current = index
        let target = photo
        loadFailed = false
        loadNote = ""
        if shownIndex != current { sharp = false }
        guard let hash = target.cloudHash else {
            loadFailed = true
            loadNote = L("Brak identyfikatora zdjęcia.")
            return
        }
        if !pipeline.isOnline {
            loadNote = L("Łączę z biblioteką…")
        }
        if let thumb = pipeline.cachedThumbnail(hash: hash) {
            present(thumb, at: current)
        } else if let thumb = await pipeline.thumbnail(hash: hash) {
            guard !Task.isCancelled else { return }
            present(thumb, at: current)
        }
        guard let asset = library.asset(for: target) else {
            if shown == nil {
                loadFailed = true
                loadNote = pipeline.isOnline
                    ? L("Nie znaleziono pliku w katalogu.")
                    : L("Brak połączenia z serwerem — katalog jest tylko lokalny.")
            }
            return
        }
        if autoplay {
            autoplay = false
            play()
        }
        if target.traits.isVideo {
            prefetchNeighbours(around: current)
            // The thumbnail is the film's poster; the picture itself comes from the player.
            if shownIndex != current {
                withAnimation(.easeInOut(duration: 0.32)) {
                    shown = nil
                    shownIndex = current
                    posterOnly = true
                }
            }
            return
        }
        if let full = await pipeline.full(asset: asset, maxSide: Self.fullSide), !Task.isCancelled {
            present(full, at: current)
            sharp = true
            // Neighbours only after this photo is sharp: they must not compete with it.
            prefetchNeighbours(around: current)
        } else if !Task.isCancelled {
            loadFailed = true
            prefetchNeighbours(around: current)
            loadNote = pipeline.isOnline
                ? L("Serwer nie oddał oryginału. Sprawdź QNAP / sieć i spróbuj ponownie.")
                : L("Apple TV nie jest połączone z biblioteką.")
        }
    }

    /// A new photo cross-fades in; the sharp original replaces its thumbnail in place.
    private func present(_ image: UIImage, at current: Int) {
        guard current == index else { return }
        posterOnly = false
        if shownIndex == current {
            shown = image
        } else {
            withAnimation(.easeInOut(duration: slideshow ? 0.9 : 0.32)) {
                shown = image
                shownIndex = current
            }
        }
    }

    private func prefetchNeighbours(around current: Int) {
        var hashes: [String] = []
        var assets: [LibraryAsset] = []
        for offset in [1, -1, 2, -2, 3] {
            let position = current + offset
            guard context.photos.indices.contains(position) else { continue }
            let neighbour = context.photos[position]
            if let hash = neighbour.cloudHash { hashes.append(hash) }
            // Only the photo either side: more originals at once fight over the network.
            if abs(offset) == 1, !neighbour.traits.isVideo, let asset = library.asset(for: neighbour) {
                assets.append(asset)
            }
        }
        pipeline.prefetch(thumbnails: hashes)
        pipeline.prefetch(full: assets, maxSide: Self.fullSide)
    }
}

/// Stand-in for a film whose frame is not ready yet. The play button sits on top of it.
private struct TVFilmPoster: View {
    let duration: TimeInterval

    var body: some View {
        VStack(spacing: 22) {
            Spacer()
            Color.clear.frame(height: 150)
            Text(L("Film · \(PhotoFormat.duration(duration))"))
                .font(.title2.weight(.semibold))
                .monospacedDigit()
            Text(L("Naciśnij, aby odtworzyć"))
                .font(.title3)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RadialGradient(colors: [Color.white.opacity(0.10), .clear], center: .center, startRadius: 40, endRadius: 900)
        )
    }
}

/// Full screen picture. In a slideshow it drifts slowly towards the viewer.
private struct TVStill: View {
    let image: UIImage
    let drift: Bool
    var anchor: UnitPoint = .center
    @State private var grown = false

    var body: some View {
        Image(uiImage: image)
            .resizable()
            .scaledToFit()
            .scaleEffect(grown ? 1.08 : 1, anchor: anchor)
            .onAppear { grow(drift) }
            .onChange(of: drift) { _, on in grow(on) }
    }

    private func grow(_ on: Bool) {
        withAnimation(on ? .linear(duration: 7) : .easeOut(duration: 0.45)) { grown = on }
    }
}

/// Finger on the Siri Remote touchpad. A sideways swipe moves to the previous or next photo,
/// the same motion the system Photos app uses.
struct RemoteSwipe: UIViewControllerRepresentable {
    var enabled = true
    let onSwipe: (Int, Date) -> Void

    func makeUIViewController(context: Context) -> RemoteSwipeScreen {
        let screen = RemoteSwipeScreen()
        screen.onSwipe = onSwipe
        screen.enabled = enabled
        return screen
    }

    func updateUIViewController(_ screen: RemoteSwipeScreen, context: Context) {
        screen.onSwipe = onSwipe
        screen.enabled = enabled
    }
}

final class RemoteSwipeScreen: UIViewController {
    var onSwipe: ((Int, Date) -> Void)?
    var enabled = true
    private var began = Date.distantPast

    private let pan = UIPanGestureRecognizer()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = false
        pan.addTarget(self, action: #selector(panned(_:)))
        pan.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.indirect.rawValue)]
        pan.cancelsTouchesInView = false
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        let host: UIView = view.window ?? view
        if pan.view !== host {
            host.addGestureRecognizer(pan)
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        pan.view?.removeGestureRecognizer(pan)
    }

    @objc private func panned(_ pan: UIPanGestureRecognizer) {
        if pan.state == .began { began = Date() }
        guard pan.state == .ended, enabled else { return }
        let travel = pan.translation(in: view).x
        let velocity = pan.velocity(in: view).x
        // A deliberate swipe: far enough, or a quick flick. Resting a thumb does nothing.
        if travel > 180 || (travel > 60 && velocity > 900) { onSwipe?(-1, began) }
        else if travel < -180 || (travel < -60 && velocity < -900) { onSwipe?(1, began) }
    }
}

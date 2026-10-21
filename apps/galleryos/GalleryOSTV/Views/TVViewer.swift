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
    @State private var lastStep = Date.distantPast
    @State private var lastDelta = 0
    @FocusState private var focused: Bool

    /// Native panel size: 3840 on a 4K TV, 1920 on HD. Nothing bigger is ever decoded.
    private static let fullSide: CGFloat = {
        let bounds = UIScreen.main.nativeBounds
        return min(3000, max(1920, max(bounds.width, bounds.height)))
    }()

    init(context: TVViewerContext, onClose: @escaping (PhotoRef) -> Void) {
        self.context = context
        self.onClose = onClose
        _index = State(initialValue: context.start)
        _slideshow = State(initialValue: context.slideshow)
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
        }
        .ignoresSafeArea()
        .animation(.easeInOut(duration: 0.28), value: chrome)
        .animation(TVTheme.spring, value: showInfo)
        .animation(TVTheme.spring, value: slideshow)
        .task(id: index) { await load() }
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
                    TVStill(image: shown, drift: slideshow && !isMovie)
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
                        Text("Nie wczytano podglądu")
                            .font(.title2.weight(.semibold))
                        Text(loadNote.isEmpty ? "Naciśnij, aby spróbować ponownie." : loadNote)
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
        .background(RemoteSwipe { step($0) })
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
            .padding(.horizontal, 72)
            .padding(.top, 54)
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
                    Label("Naciśnij, aby odtworzyć film", systemImage: "play.fill")
                } else if isLive {
                    Label("▶︎ odtwarza Live Photo", systemImage: "livephoto")
                } else {
                    Label("▶︎ pokaz slajdów", systemImage: "play.rectangle.on.rectangle")
                }
                Label("↑ informacje", systemImage: "info.circle")
            }
            .font(.headline)
            .padding(.horizontal, 28)
            .padding(.vertical, 14)
            .galleryGlass(in: Capsule())
            .padding(.bottom, 60)
        }
        .allowsHitTesting(false)
    }

    private var slideshowBadge: some View {
        VStack {
            Spacer()
            Label("Pokaz slajdów · ▶︎ zatrzymuje", systemImage: "play.rectangle.on.rectangle.fill")
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
            }
            .padding(36)
            .frame(maxWidth: 1000, alignment: .leading)
            .galleryGlass(in: RoundedRectangle(cornerRadius: 34, style: .continuous))
            .padding(.bottom, 60)
        }
        .foregroundStyle(.white)
        .allowsHitTesting(false)
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

    /// A swipe on the clickpad can arrive both as a pan and as a move command; one gesture is one photo.
    private func step(_ delta: Int) {
        let now = Date()
        if delta == lastDelta, now.timeIntervalSince(lastStep) < 0.3 { return }
        lastStep = now
        lastDelta = delta
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
            try? await Task.sleep(nanoseconds: 5_500_000_000)
            guard !Task.isCancelled, slideshow else { return }
            guard let next = context.photos.indices[(index + 1)...].first(where: { !context.photos[$0].traits.isVideo }) else {
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
        if shown == nil {
            Task { await load() }
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
            loadNote = "Brak wpisu w katalogu. Odśwież bibliotekę w Ustawieniach."
            return
        }
        let resource = isMovie ? current.primary : (isLive ? current.paired : nil)
        guard let resource else {
            loadFailed = true
            loadNote = "W katalogu nie ma pliku wideo dla tego wpisu."
            return
        }
        var clips: [LibraryResource] = context.photos.compactMap { item in
            guard let asset = library.asset(for: item) else { return nil }
            if item.traits.isVideo { return asset.primary }
            if item.traits.contains(.live) { return asset.paired }
            return nil
        }
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
        guard let hash = target.cloudHash else {
            loadFailed = true
            loadNote = "Brak identyfikatora zdjęcia."
            return
        }
        if !pipeline.isOnline {
            loadNote = "Łączę z biblioteką…"
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
                    ? "Nie znaleziono pliku w katalogu."
                    : "Brak połączenia z serwerem — katalog jest tylko lokalny."
            }
            return
        }
        prefetchNeighbours(around: current)
        if target.traits.isVideo {
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
        } else if shown == nil, !Task.isCancelled {
            loadFailed = true
            loadNote = pipeline.isOnline
                ? "Serwer nie oddał oryginału. Sprawdź QNAP / sieć i spróbuj ponownie."
                : "Apple TV nie jest połączone z biblioteką."
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
            Text("Film · \(PhotoFormat.duration(duration))")
                .font(.title2.weight(.semibold))
                .monospacedDigit()
            Text("Naciśnij, aby odtworzyć")
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
    @State private var grown = false

    var body: some View {
        Image(uiImage: image)
            .resizable()
            .scaledToFit()
            .scaleEffect(grown ? 1.07 : 1)
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
    let onSwipe: (Int) -> Void

    func makeUIViewController(context: Context) -> RemoteSwipeScreen {
        let screen = RemoteSwipeScreen()
        screen.onSwipe = onSwipe
        return screen
    }

    func updateUIViewController(_ screen: RemoteSwipeScreen, context: Context) {
        screen.onSwipe = onSwipe
    }
}

final class RemoteSwipeScreen: UIViewController {
    var onSwipe: ((Int) -> Void)?

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
        guard pan.state == .ended else { return }
        if playerIsShowing { return }
        let travel = pan.translation(in: view).x
        if travel > 70 { onSwipe?(-1) }
        else if travel < -70 { onSwipe?(1) }
    }

    private var playerIsShowing: Bool {
        var controller = view.window?.rootViewController
        while let presented = controller?.presentedViewController {
            if presented is HDRPlayerController || presented is FilmScreen { return true }
            controller = presented
        }
        return false
    }
}

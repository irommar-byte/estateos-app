import AVKit
import Combine
import SwiftUI
import UniformTypeIdentifiers

struct TVPlayback: Identifiable {
    let id = UUID()
    let resources: [LibraryResource]
    let start: Int
}

@MainActor
final class TVPlayerModel: ObservableObject {
    enum Phase: Equatable {
        case loading
        case downloading
        case playing
        case failed(String)
    }

    @Published private(set) var player: AVPlayer?
    @Published private(set) var phase: Phase = .loading
    @Published private(set) var index = 0
    @Published private(set) var downloadNote = ""
    /// Set when the clip plays to its end: the player closes by itself, like Photos.
    @Published private(set) var finished = false
    private var endWatch: NSObjectProtocol?
    private var streamLoader: TVStreamLoader?
    private var resources: [LibraryResource] = []
    private var observer: AnyCancellable?
    private var triedDownload = false
    private var closed = false
    private var pipeline: TVImagePipeline?
    private var playingResource: LibraryResource?
    private var streamWatch: Task<Void, Never>?
    private var loadGeneration = 0

    func start(_ playback: TVPlayback, pipeline: TVImagePipeline) async {
        resources = playback.resources
        index = min(max(0, playback.start), max(resources.count - 1, 0))
        self.pipeline = pipeline
        guard resources.indices.contains(index) else {
            phase = .failed(L("Brak pliku wideo."))
            return
        }
        await load(resources[index], pipeline: pipeline)
    }

    func neighbor(_ delta: Int) {
        let next = index + delta
        guard resources.indices.contains(next), let pipeline, !closed else { return }
        index = next
        triedDownload = false
        // Keep the current surface up while the next clip prepares — no blank remount.
        if player == nil { phase = .downloading }
        player?.pause()
        streamWatch?.cancel()
        loadGeneration &+= 1
        let generation = loadGeneration
        Task { await load(resources[next], pipeline: pipeline, generation: generation) }
    }

    func stop() {
        closed = true
        loadGeneration &+= 1
        streamWatch?.cancel()
        streamWatch = nil
        observer = nil
        if let endWatch { NotificationCenter.default.removeObserver(endWatch) }
        endWatch = nil
        player?.pause()
        player = nil
        streamLoader = nil
        TVDisplay.release()
    }

    private func load(_ resource: LibraryResource, pipeline: TVImagePipeline, generation: Int? = nil) async {
        guard !closed else { return }
        let generation = generation ?? {
            loadGeneration &+= 1
            return loadGeneration
        }()
        playingResource = resource
        if player == nil { phase = .loading }

        if let file = pipeline.existingFile(for: resource) {
            begin(AVPlayerItem(url: file), canFallBack: false, generation: generation)
            return
        }

        // Stream in byte ranges through our own session: it trusts the NAS certificate and
        // sends the account header, so playback starts at once even for a 2 GB Dolby Vision clip.
        if let target = pipeline.streamTarget(for: resource),
           let made = TVStreamLoader.asset(url: target.url, headers: target.headers, ext: resource.ext) {
            streamLoader = made.loader
            begin(AVPlayerItem(asset: made.asset), canFallBack: true, generation: generation)
            watchStreamTimeout(generation: generation)
            return
        }

        await fallBackToFile(reason: L("Brak strumienia — pobieram plik…"), generation: generation)
    }

    private func watchStreamTimeout(generation: Int) {
        streamWatch?.cancel()
        streamWatch = Task { [weak self] in
            let nanos = UInt64(TVMediaPolicy.streamFailSeconds * 1_000_000_000)
            try? await Task.sleep(nanoseconds: nanos)
            guard let self, !self.closed, !Task.isCancelled, self.loadGeneration == generation else { return }
            if case .playing = self.phase { return }
            await self.fallBackToFile(reason: L("Strumień nie wystartował — pobieram na dysk…"), generation: generation)
        }
    }

    private func fallBackToFile(reason: String?, generation: Int) async {
        guard !closed, loadGeneration == generation, let pipeline, let resource = playingResource else {
            if !closed, loadGeneration == generation { phase = .failed(L("Brak połączenia z biblioteką.")) }
            return
        }
        if triedDownload {
            if case .playing = phase { return }
            if player == nil { phase = .failed(L("Nie udało się pobrać tego filmu.")) }
            return
        }
        triedDownload = true
        _ = reason
        streamWatch?.cancel()
        observer = nil
        player?.pause()
        player = nil
        streamLoader = nil
        phase = .downloading
        downloadNote = resource.bytes > 0
            ? L("Pobieram film (\(ByteCountFormatter.string(fromByteCount: Int64(resource.bytes), countStyle: .file))) na Apple TV…")
            : L("Pobieram film na Apple TV…")
        if let stale = pipeline.existingFile(for: resource) {
            begin(AVPlayerItem(url: stale), canFallBack: false, generation: generation)
            return
        }
        guard let file = await pipeline.localFile(for: resource) else {
            if !closed, loadGeneration == generation, player == nil {
                phase = .failed(L("Serwer nie oddał pliku wideo. Sprawdź sieć / QNAP."))
            }
            return
        }
        guard !closed, loadGeneration == generation else { return }
        begin(AVPlayerItem(url: file), canFallBack: false, generation: generation)
    }

    private func begin(_ item: AVPlayerItem, canFallBack: Bool, generation: Int) {
        guard !closed, loadGeneration == generation else { return }
        item.appliesPerFrameHDRDisplayMetadata = true
        let next = AVPlayer(playerItem: item)
        next.automaticallyWaitsToMinimizeStalling = true
        // Swap the item on one controller surface — FilmHost keeps the same host VC.
        player = next
        if let endWatch { NotificationCenter.default.removeObserver(endWatch) }
        endWatch = NotificationCenter.default.addObserver(
            forName: AVPlayerItem.didPlayToEndTimeNotification,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, !self.closed, self.loadGeneration == generation else { return }
                self.finished = true
            }
        }
        observer = item.publisher(for: \.status)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                guard let self, !self.closed, self.loadGeneration == generation else { return }
                if status == .readyToPlay {
                    self.streamWatch?.cancel()
                    self.phase = .playing
                } else if status == .failed, canFallBack {
                    Task { await self.fallBackToFile(reason: item.error?.localizedDescription, generation: generation) }
                } else if status == .failed {
                    self.phase = .failed(item.error?.localizedDescription ?? L("Odtwarzacz odrzucił plik."))
                }
            }
    }
}

/// Asks the television for the picture mode stored in the file itself.
enum TVDisplay {
    static func release() {
        install(nil)
    }

    static var matchingEnabled: Bool {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
        guard let manager = windows.first?.avDisplayManager else { return true }
        return manager.isDisplayCriteriaMatchingEnabled
    }

    private static func install(_ criteria: AVDisplayCriteria?) {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        for scene in scenes {
            for window in scene.windows {
                window.avDisplayManager.preferredDisplayCriteria = criteria
            }
        }
    }
}

struct TVPlayerView: View {
    let playback: TVPlayback
    @EnvironmentObject private var pipeline: TVImagePipeline
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model = TVPlayerModel()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            // Keep one player host mounted across neighbor skips so the surface does not remount.
            // HDR and Dolby Vision play even when the TV does not switch modes; tvOS tone-maps them.
            if let player = model.player {
                FilmHost(player: player, onClose: close)
                    .ignoresSafeArea()
            }
            switch model.phase {
            case .playing:
                EmptyView()
            case .loading, .downloading:
                if model.player == nil {
                    VStack(spacing: 22) {
                        ProgressView().scaleEffect(1.6)
                        Text(model.phase == .downloading
                             ? (model.downloadNote.isEmpty ? L("Pobieram film na Apple TV…") : model.downloadNote)
                             : L("Przygotowuję odtwarzanie…"))
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                }
            case .failed(let message):
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle").font(.system(size: 70)).foregroundStyle(.orange)
                    Text(L("Nie udało się odtworzyć tego filmu")).font(.title2)
                    Text(message)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 900)
                    Text(L("Naciśnij Menu, aby wrócić.")).foregroundStyle(.secondary)
                }
            }
        }
        .task { await model.start(playback, pipeline: pipeline) }
        .onExitCommand(perform: close)
        .onChange(of: model.finished) { _, done in
            if done { close() }
        }
        .onDisappear { model.stop() }
    }

    private func close() {
        model.stop()
        dismiss()
    }
}

struct FilmHost: UIViewControllerRepresentable {
    let player: AVPlayer
    let onClose: () -> Void

    func makeUIViewController(context: Context) -> FilmScreen {
        let screen = FilmScreen()
        screen.attach(player)
        screen.onClose = onClose
        return screen
    }

    func updateUIViewController(_ screen: FilmScreen, context: Context) {
        screen.attach(player)
        screen.onClose = onClose
    }
}

/// Embeds AVPlayerViewController as a child — one Menu back leaves the player cover,
/// without a black intermediate screen that needed a second press.
final class FilmScreen: UIViewController {
    var onClose: (() -> Void)?
    private let playerController = HDRPlayerController()
    private var didEmbed = false

    func attach(_ player: AVPlayer) {
        if playerController.player !== player {
            playerController.player = player
            Task { await startWhenScreenIsReady() }
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        // The player asks the TV for the film's own mode (Dolby Vision, HDR10, frame rate).
        // The remote keeps every native gesture: click left/right skips 10 s, swipe scrubs,
        // swipe down shows the info panel.
        playerController.appliesPreferredDisplayCriteriaAutomatically = true
        playerController.onMenu = { [weak self] in
            self?.onClose?()
        }
        embedPlayer()
    }

    private func embedPlayer() {
        guard !didEmbed else { return }
        didEmbed = true
        addChild(playerController)
        playerController.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(playerController.view)
        NSLayoutConstraint.activate([
            playerController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            playerController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            playerController.view.topAnchor.constraint(equalTo: view.topAnchor),
            playerController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        playerController.didMove(toParent: self)
    }

    /// Starts only once the item is ready and the TV has finished switching picture mode,
    /// so the first seconds of a Dolby Vision clip are not lost behind a black screen.
    private func startWhenScreenIsReady() async {
        guard let player = playerController.player, let item = player.currentItem else { return }
        for _ in 0..<50 where item.status == .unknown {
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        try? await Task.sleep(nanoseconds: 150_000_000)
        for _ in 0..<30 {
            guard let manager = view.window?.avDisplayManager, manager.isDisplayModeSwitchInProgress else { break }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        guard playerController.player === player else { return }
        player.play()
    }
}

final class HDRPlayerController: AVPlayerViewController, AVPlayerViewControllerDelegate {
    var onMenu: (() -> Void)?
    private var barVisible = false

    override func viewDidLoad() {
        super.viewDidLoad()
        delegate = self
    }

    func playerViewController(
        _ playerViewController: AVPlayerViewController,
        willTransitionToVisibilityOfTransportBar visible: Bool,
        with coordinator: AVPlayerViewControllerAnimationCoordinator
    ) {
        barVisible = visible
    }

    /// Menu first hides the transport bar or info panel (system behaviour); only a Menu
    /// press on the bare picture closes the film.
    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if presses.contains(where: { $0.type == .menu }), !barVisible {
            onMenu?()
            return
        }
        super.pressesBegan(presses, with: event)
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if presses.contains(where: { $0.type == .menu }), !barVisible { return }
        super.pressesEnded(presses, with: event)
    }
}

/// Streams a film from the library to AVFoundation in byte ranges through `GalleryNetwork`.
/// AVPlayer's own HTTP stack rejects the NAS's self-signed certificate, so it is given a
/// `galleryos-stream://` address and every range it asks for is fetched here instead.
final class TVStreamLoader: NSObject, AVAssetResourceLoaderDelegate, @unchecked Sendable {
    static let scheme = "galleryos-stream"
    private static let chunk: Int64 = 4 * 1024 * 1024

    private let target: URL
    private let headers: [String: String]
    private let contentType: String
    private let queue = DispatchQueue(label: "pl.galleryos.tv.stream")
    private let lock = NSLock()
    private var jobs: [ObjectIdentifier: Task<Void, Never>] = [:]
    private var knownLength: Int64?

    private init(target: URL, headers: [String: String], ext: String) {
        self.target = target
        self.headers = headers
        contentType = UTType(filenameExtension: ext.lowercased())?.identifier ?? UTType.quickTimeMovie.identifier
    }

    /// An asset keeps only a weak reference to its loader: hold the loader while the asset is in use.
    static func asset(url: URL, headers: [String: String], ext: String) -> (asset: AVURLAsset, loader: TVStreamLoader)? {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        components.scheme = scheme
        guard let address = components.url else { return nil }
        let loader = TVStreamLoader(target: url, headers: headers, ext: ext)
        let asset = AVURLAsset(url: address)
        asset.resourceLoader.setDelegate(loader, queue: loader.queue)
        return (asset, loader)
    }

    deinit {
        lock.withLock { jobs.values.forEach { $0.cancel() } }
    }

    func resourceLoader(
        _ resourceLoader: AVAssetResourceLoader,
        shouldWaitForLoadingOfRequestedResource loadingRequest: AVAssetResourceLoadingRequest
    ) -> Bool {
        let key = ObjectIdentifier(loadingRequest)
        let job = Task { [weak self] in
            guard let self else { return }
            await self.serve(loadingRequest)
            _ = self.lock.withLock { self.jobs.removeValue(forKey: key) }
        }
        lock.withLock { jobs[key] = job }
        return true
    }

    func resourceLoader(_ resourceLoader: AVAssetResourceLoader, didCancel loadingRequest: AVAssetResourceLoadingRequest) {
        let key = ObjectIdentifier(loadingRequest)
        lock.withLock { jobs.removeValue(forKey: key) }?.cancel()
    }

    private func serve(_ request: AVAssetResourceLoadingRequest) async {
        do {
            let total = try await length()
            if let info = request.contentInformationRequest {
                queue.sync {
                    info.contentType = contentType
                    info.contentLength = total
                    info.isByteRangeAccessSupported = true
                }
            }
            if let data = request.dataRequest {
                var offset = data.currentOffset > 0 ? data.currentOffset : data.requestedOffset
                let end = data.requestsAllDataToEndOfResource
                    ? total
                    : min(total, data.requestedOffset + Int64(data.requestedLength))
                while offset < end {
                    try Task.checkCancellation()
                    let last = min(end, offset + Self.chunk) - 1
                    let (bytes, response) = try await GalleryNetwork.shared.range(target, headers: headers, from: offset, through: last)
                    var slice = bytes
                    if response.statusCode == 200 {
                        // The server ignored Range and sent the file from the start.
                        guard Int64(bytes.count) > offset else { throw URLError(.cannotParseResponse) }
                        slice = bytes.subdata(in: Int(offset)..<min(bytes.count, Int(last + 1)))
                    }
                    guard !slice.isEmpty else { throw URLError(.zeroByteResource) }
                    try Task.checkCancellation()
                    queue.sync { data.respond(with: slice) }
                    offset += Int64(slice.count)
                }
            }
            queue.sync { request.finishLoading() }
        } catch {
            guard !Task.isCancelled else { return }
            queue.sync { request.finishLoading(with: error) }
        }
    }

    private func length() async throws -> Int64 {
        if let known = lock.withLock({ knownLength }) { return known }
        var total: Int64 = -1
        // QNAP answers HEAD with 404 for files that download fine, so the size always comes
        // from a one-byte range instead.
        if total <= 0 {
            let (_, response) = try await GalleryNetwork.shared.range(target, headers: headers, from: 0, through: 1)
            if let range = response.value(forHTTPHeaderField: "Content-Range"), let slash = range.lastIndex(of: "/") {
                total = Int64(range[range.index(after: slash)...].trimmingCharacters(in: .whitespaces)) ?? -1
            }
        }
        guard total > 0 else { throw URLError(.cannotParseResponse) }
        lock.withLock { knownLength = total }
        return total
    }
}

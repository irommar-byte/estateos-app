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
            phase = .failed("Brak pliku wideo.")
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

        await fallBackToFile(reason: "Brak strumienia — pobieram plik…", generation: generation)
    }

    private func watchStreamTimeout(generation: Int) {
        streamWatch?.cancel()
        streamWatch = Task { [weak self] in
            let nanos = UInt64(TVMediaPolicy.streamFailSeconds * 1_000_000_000)
            try? await Task.sleep(nanoseconds: nanos)
            guard let self, !self.closed, !Task.isCancelled, self.loadGeneration == generation else { return }
            if case .playing = self.phase { return }
            await self.fallBackToFile(reason: "Strumień nie wystartował — pobieram na dysk…", generation: generation)
        }
    }

    private func fallBackToFile(reason: String?, generation: Int) async {
        guard !closed, loadGeneration == generation, let pipeline, let resource = playingResource else {
            if !closed, loadGeneration == generation { phase = .failed("Brak połączenia z biblioteką.") }
            return
        }
        if triedDownload {
            if case .playing = phase { return }
            if player == nil { phase = .failed("Nie udało się pobrać tego filmu.") }
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
            ? "Pobieram film (\(ByteCountFormatter.string(fromByteCount: Int64(resource.bytes), countStyle: .file))) na Apple TV…"
            : "Pobieram film na Apple TV…"
        if let stale = pipeline.existingFile(for: resource) {
            begin(AVPlayerItem(url: stale), canFallBack: false, generation: generation)
            return
        }
        guard let file = await pipeline.localFile(for: resource) else {
            if !closed, loadGeneration == generation, player == nil {
                phase = .failed("Serwer nie oddał pliku wideo. Sprawdź sieć / QNAP.")
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
                    self.phase = .failed(item.error?.localizedDescription ?? "Odtwarzacz odrzucił plik.")
                }
            }
    }
}

/// Asks the television for the picture mode stored in the file itself.
enum TVDisplay {
    static func engage(_ asset: AVAsset) async {
        guard let criteria = try? await asset.load(.preferredDisplayCriteria) else { return }
        await MainActor.run { install(criteria) }
    }

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
                FilmHost(player: player, onNeighbor: { model.neighbor($0) }, onClose: close)
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
                             ? (model.downloadNote.isEmpty ? "Pobieram film na Apple TV…" : model.downloadNote)
                             : "Przygotowuję odtwarzanie…")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                }
            case .failed(let message):
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle").font(.system(size: 70)).foregroundStyle(.orange)
                    Text("Nie udało się odtworzyć tego filmu").font(.title2)
                    Text(message)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 900)
                    Text("Naciśnij Menu, aby wrócić.").foregroundStyle(.secondary)
                }
            }
        }
        .task { await model.start(playback, pipeline: pipeline) }
        .onExitCommand(perform: close)
        .onDisappear { model.stop() }
    }

    private func close() {
        model.stop()
        dismiss()
    }
}

struct FilmHost: UIViewControllerRepresentable {
    let player: AVPlayer
    let onNeighbor: (Int) -> Void
    let onClose: () -> Void

    func makeUIViewController(context: Context) -> FilmScreen {
        let screen = FilmScreen()
        screen.attach(player)
        screen.onNeighbor = onNeighbor
        screen.onClose = onClose
        return screen
    }

    func updateUIViewController(_ screen: FilmScreen, context: Context) {
        screen.attach(player)
        screen.onNeighbor = onNeighbor
        screen.onClose = onClose
    }
}

/// Embeds AVPlayerViewController as a child — one Menu back leaves the player cover,
/// without a black intermediate screen that needed a second press.
final class FilmScreen: UIViewController {
    var onNeighbor: ((Int) -> Void)?
    var onClose: (() -> Void)?
    private let playerController = HDRPlayerController()
    private var scrubStart: CMTime?
    private var didEmbed = false

    func attach(_ player: AVPlayer) {
        if playerController.player !== player {
            playerController.player = player
            Task { await matchPicture() }
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        playerController.appliesPreferredDisplayCriteriaAutomatically = true
        playerController.onSkip = { [weak self] delta in
            self?.onNeighbor?(delta)
        }
        playerController.onMenu = { [weak self] in
            self?.onClose?()
        }
        embedPlayer()
        let pan = UIPanGestureRecognizer(target: self, action: #selector(scrubbed(_:)))
        pan.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.indirect.rawValue)]
        playerController.view.addGestureRecognizer(pan)
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

    private func matchPicture() async {
        guard let item = playerController.player?.currentItem else { return }
        if item.status != .readyToPlay {
            for _ in 0..<30 where item.status == .unknown {
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
        }
        await TVDisplay.engage(item.asset)
        playerController.player?.play()
    }

    @objc private func scrubbed(_ pan: UIPanGestureRecognizer) {
        guard let player = playerController.player, let item = player.currentItem else { return }
        let duration = item.duration.seconds
        guard duration.isFinite, duration > 0 else { return }
        switch pan.state {
        case .began:
            scrubStart = player.currentTime()
            player.pause()
        case .changed:
            let span = max(duration * 0.35, 20)
            let delta = Double(pan.translation(in: playerController.view).x) / 900 * span
            let origin = scrubStart?.seconds ?? player.currentTime().seconds
            let target = min(max(0, origin + delta), duration - 0.05)
            player.seek(to: CMTime(seconds: target, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
        case .ended, .cancelled, .failed:
            scrubStart = nil
            player.play()
        default:
            break
        }
    }
}

final class HDRPlayerController: AVPlayerViewController {
    var onSkip: ((Int) -> Void)?
    var onMenu: (() -> Void)?

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        for press in presses where press.type == .menu {
            onMenu?()
            return
        }
        super.pressesBegan(presses, with: event)
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        for press in presses {
            if press.type == .menu {
                return
            }
            if press.type == .leftArrow {
                onSkip?(-1)
                return
            }
            if press.type == .rightArrow {
                onSkip?(1)
                return
            }
        }
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

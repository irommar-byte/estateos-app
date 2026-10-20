import AVFoundation
import Photos
import UIKit

/// Loads and caches grid previews independently of cell reuse.
/// iCloud downloads keep going even when the cell scrolls away; the next cell for that id gets the image instantly.
@MainActor
final class GridImageStore {
    static let shared = GridImageStore()

    private let manager = PHCachingImageManager()
    private var cache: [String: UIImage] = [:]
    private var order: [String] = []
    private var inflight = Set<String>()
    private var waiters: [String: [(UIImage) -> Void]] = [:]
    private var active = 0
    private var queue: [() -> Void] = []
    private let limit = 24
    private let capacity = 900

    private init() {
        manager.allowsCachingHighQualityImages = true
    }

    func cached(_ id: String) -> UIImage? {
        guard let hit = cache[id] else { return nil }
        guard PreviewCheck.isUsable(hit) else {
            cache.removeValue(forKey: id)
            return nil
        }
        touch(id)
        return hit
    }

    func remember(_ id: String, _ image: UIImage) {
        guard PreviewCheck.isUsable(image) else { return }
        trimIfNeeded()
        cache[id] = image
        touch(id)
        inflight.remove(id)
        let callbacks = waiters.removeValue(forKey: id) ?? []
        for callback in callbacks { callback(image) }
    }

    /// Delivers a preview as soon as possible. Safe to call repeatedly for the same id.
    func load(
        id: String,
        asset: PHAsset?,
        fallback: UIImage?,
        pixel: CGSize,
        server: (() async -> UIImage?)?,
        deliver: @escaping (String, UIImage) -> Void
    ) {
        if let hit = cached(id) {
            deliver(id, hit)
            return
        }
        if let fallback {
            deliver(id, fallback)
        }
        waiters[id, default: []].append { image in deliver(id, image) }
        guard !inflight.contains(id) else { return }
        inflight.insert(id)

        enqueue { [weak self] done in
            guard let self else { done(); return }
            Task { @MainActor in
                let image = await self.fetch(id: id, asset: asset, pixel: pixel, server: server)
                if let image, PreviewCheck.isUsable(image) {
                    self.remember(id, image)
                } else {
                    self.inflight.remove(id)
                    self.waiters[id] = nil
                }
                done()
            }
        }
    }

    func prefetch(ids: [String], asset: (String) -> PHAsset?, pixel: CGSize) {
        let options = PHImageRequestOptions()
        options.deliveryMode = .fastFormat
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        let assets = ids.compactMap { asset($0) }
        guard !assets.isEmpty else { return }
        manager.startCachingImages(for: assets, targetSize: pixel, contentMode: .aspectFill, options: options)
        for id in ids where cache[id] == nil {
            load(id: id, asset: asset(id), fallback: nil, pixel: pixel, server: nil) { _, _ in }
        }
    }

    private func fetch(
        id: String,
        asset: PHAsset?,
        pixel: CGSize,
        server: (() async -> UIImage?)?
    ) async -> UIImage? {
        if let asset {
            // The local thumbnail is enough for a tile. A nil first callback used to cancel the
            // real frame that arrives a moment later, so the cell stayed empty.
            if let image = await request(id: id, asset: asset, pixel: pixel, network: false) {
                return image
            }
            if let image = await request(id: id, asset: asset, pixel: pixel, network: true) { return image }
        }
        if let server, let image = await server(), image.size.width >= 2, image.size.height >= 2 { return image }
        return nil
    }

    private func request(id: String, asset: PHAsset, pixel: CGSize, network: Bool) async -> UIImage? {
        let box = FrameBox()
        return await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.deliveryMode = .fastFormat
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = network
            options.isSynchronous = false
            manager.requestImage(
                for: asset,
                targetSize: pixel,
                contentMode: .aspectFill,
                options: options
            ) { image, info in
                let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
                if let image, image.size.width >= 2, image.size.height >= 2 {
                    let ready = image
                    Task { @MainActor in self.remember(id, ready) }
                    box.finish(continuation, ready)
                    return
                }
                if cancelled {
                    box.finish(continuation, nil)
                }
            }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(network ? 8 : 3))
                box.finish(continuation, nil)
            }
        }
    }

    private func touch(_ id: String) {
        if let index = order.firstIndex(of: id) {
            order.remove(at: index)
        }
        order.append(id)
    }

    private func trimIfNeeded() {
        guard cache.count >= capacity else { return }
        let excess = cache.count - (capacity * 4 / 5)
        guard excess > 0 else { return }
        let doomed = Array(order.prefix(excess))
        order.removeFirst(min(excess, order.count))
        for id in doomed {
            cache.removeValue(forKey: id)
        }
    }

    private func enqueue(_ work: @escaping (@escaping () -> Void) -> Void) {
        if active < limit {
            active += 1
            work { [weak self] in self?.finish() }
            return
        }
        queue.append { work { [weak self] in self?.finish() } }
    }

    private func finish() {
        active = max(0, active - 1)
        guard !queue.isEmpty else { return }
        let next = queue.removeLast()
        active += 1
        next()
    }
}

/// A tile may show this picture. A 1×1 decode is not a photo. A dark or bright photo still is.
enum PreviewCheck {
    static func isUsable(_ image: UIImage) -> Bool {
        image.size.width >= 2 && image.size.height >= 2
    }
}

/// A film frame kept on disk, so a tile does not stay empty after the Photos request gives up.
enum FilmPoster {
    static let filled = Notification.Name("galleryos.film.poster")
    private static let queue = DispatchQueue(label: "galleryos.posters", qos: .userInitiated)
    private static let lock = NSLock()
    private static var waiters: [String: [(UIImage?) -> Void]] = [:]
    private static var failed: [String: Date] = [:]
    private static var networkActive = 0
    private static var networkWaiting: [() -> Void] = []
    private static let folder: URL = {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("galleryos-posters", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }()

    static func image(for id: String) -> UIImage? {
        let url = file(id)
        guard let image = UIImage(contentsOfFile: url.path) else { return nil }
        guard let frame = usableFrame(image) else {
            try? FileManager.default.removeItem(at: url)
            return nil
        }
        return frame
    }

    static func store(_ image: UIImage, id: String) {
        guard usableFrame(image) != nil, let data = image.jpegData(compressionQuality: 0.72) else { return }
        let url = file(id)
        queue.async { try? data.write(to: url, options: .atomic) }
    }

    static func make(id: String, asset: PHAsset) async -> UIImage? {
        if let image = image(for: id) { return image }
        return await withCheckedContinuation { continuation in
            ensure(id: id, asset: asset) { image in
                continuation.resume(returning: image)
            }
        }
    }

    /// Always calls `done` once, and never from inside the caller's stack.
    static func resetFailures() {
        lock.lock()
        failed.removeAll()
        lock.unlock()
    }

    static func ensure(id: String, asset: PHAsset, done: @escaping (UIImage?) -> Void) {
        if let image = image(for: id) {
            DispatchQueue.main.async { done(image) }
            return
        }
        lock.lock()
        if let when = failed[id], Date().timeIntervalSince(when) < 20 {
            lock.unlock()
            DispatchQueue.main.async { done(nil) }
            return
        }
        if waiters[id] != nil {
            waiters[id]?.append(done)
            lock.unlock()
            return
        }
        waiters[id] = [done]
        lock.unlock()
        let gate = DeliveryBox()
        let stillGate = DeliveryBox()
        // A video poster request often never calls back. Grab a frame at the same time.
        if asset.mediaType == .video, stillGate.claim() {
            localStill(asset) { still in
                finish(id, still, gate: gate)
            }
        }
        let options = PHImageRequestOptions()
        options.deliveryMode = .fastFormat
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        PHImageManager.default().requestImage(
            for: asset,
            targetSize: CGSize(width: 480, height: 480),
            contentMode: .aspectFill,
            options: options
        ) { image, info in
            let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false
            let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
            if cancelled { return }
            if let frame = usableFrame(image) {
                finish(id, frame, gate: gate)
                return
            }
            guard !degraded else { return }
            guard asset.mediaType == .video else {
                finish(id, nil, gate: gate)
                return
            }
            guard stillGate.claim() else { return }
            localStill(asset) { still in
                finish(id, still, gate: gate)
            }
        }
        queue.asyncAfter(deadline: .now() + 45) {
            finish(id, nil, gate: gate)
        }
    }

    private static func finish(_ id: String, _ image: UIImage?, gate: DeliveryBox) {
        if let image {
            store(image, id: id)
        }
        let claimed = gate.claim()
        lock.lock()
        let callbacks = claimed ? (waiters.removeValue(forKey: id) ?? []) : []
        if image != nil || claimed {
            if image == nil { failed[id] = Date() } else { failed[id] = nil }
        }
        lock.unlock()
        DispatchQueue.main.async {
            if let image {
                GridImageStore.shared.remember(id, image)
            }
            if claimed {
                for callback in callbacks { callback(image) }
            } else if image != nil {
                NotificationCenter.default.post(name: filled, object: id)
            }
        }
    }

    /// A flat black or white frame is a missing poster, not a photograph.
    private static func usableFrame(_ image: UIImage?) -> UIImage? {
        guard let image, PreviewCheck.isUsable(image), !isBlank(image) else { return nil }
        return image
    }

    private static func isBlank(_ image: UIImage) -> Bool {
        let side = 8
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let sample = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format).image { _ in
            image.draw(in: CGRect(x: 0, y: 0, width: side, height: side))
        }
        guard let cg = sample.cgImage, let data = cg.dataProvider?.data, let bytes = CFDataGetBytePtr(data) else { return false }
        let bpp = max(cg.bitsPerPixel / 8, 1)
        var low = 255
        var high = 0
        for y in 0..<side {
            for x in 0..<side {
                let offset = y * cg.bytesPerRow + x * bpp
                guard bpp >= 3 else { return false }
                let value = (Int(bytes[offset]) + Int(bytes[offset + 1]) + Int(bytes[offset + 2])) / 3
                low = min(low, value)
                high = max(high, value)
            }
        }
        return high - low < 8 && (high < 18 || low > 240)
    }

    private static func localStill(_ asset: PHAsset, done: @escaping (UIImage?) -> Void) {
        grab(asset, network: false) { local in
            if let local {
                done(local)
                return
            }
            enqueueNetwork {
                let once = DeliveryBox()
                grab(asset, network: true) { image in
                    let first = once.claim()
                    if first { finishNetwork() }
                    if first || image != nil { done(image) }
                }
                queue.asyncAfter(deadline: .now() + 30) {
                    guard once.claim() else { return }
                    finishNetwork()
                    done(nil)
                }
            }
        }
    }

    private static func enqueueNetwork(_ work: @escaping () -> Void) {
        lock.lock()
        if networkActive < 2 {
            networkActive += 1
            lock.unlock()
            work()
            return
        }
        networkWaiting.append(work)
        lock.unlock()
    }

    private static func finishNetwork() {
        lock.lock()
        let next = networkWaiting.isEmpty ? nil : networkWaiting.removeFirst()
        if next == nil { networkActive = max(0, networkActive - 1) }
        lock.unlock()
        next?()
    }

    private static func grab(_ asset: PHAsset, network: Bool, done: @escaping (UIImage?) -> Void) {
        let options = PHVideoRequestOptions()
        options.isNetworkAccessAllowed = network
        options.deliveryMode = .fastFormat
        PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, _ in
            guard let avAsset else {
                done(nil)
                return
            }
            let generator = AVAssetImageGenerator(asset: avAsset)
            generator.appliesPreferredTrackTransform = true
            generator.maximumSize = CGSize(width: 480, height: 480)
            generator.requestedTimeToleranceBefore = .positiveInfinity
            generator.requestedTimeToleranceAfter = .positiveInfinity
            let duration = max(asset.duration, 0)
            let stamps = [0, min(0.4, duration * 0.1), min(1, duration * 0.5)]
            queue.async {
                var frame: UIImage?
                for seconds in stamps {
                    let time = CMTime(seconds: seconds, preferredTimescale: 600)
                    guard let cg = try? generator.copyCGImage(at: time, actualTime: nil) else { continue }
                    if let image = usableFrame(UIImage(cgImage: cg)) {
                        frame = image
                        break
                    }
                }
                done(frame)
            }
        }
    }

    private static func file(_ id: String) -> URL {
        let safe = id.replacingOccurrences(of: "/", with: "_")
        return folder.appendingPathComponent(safe).appendingPathExtension("jpg")
    }
}

/// Walks films that have no frame, then server previews that are missing, and fills both.
@MainActor
final class GalleryRepair: ObservableObject {
    static let shared = GalleryRepair()
    @Published private(set) var line: String?
    @Published private(set) var running = false

    func start(library: PhotoLibrary) {
        guard !running else { return }
        running = true
        line = "Sprawdzam bibliotekę…"
        FilmPoster.resetFailures()
        Task { await run(library) }
    }

    private func run(_ library: PhotoLibrary) async {
        defer { running = false }
        var films: [(String, PHAsset)] = []
        var seen = Set<String>()
        for photo in library.phoneGrid.all + library.serverGrid.all where photo.traits.isVideo {
            guard let asset = library.asset(id: photo.id) else { continue }
            guard seen.insert(asset.localIdentifier).inserted else { continue }
            if FilmPoster.image(for: photo.id) == nil {
                films.append((photo.id, asset))
            }
        }
        var filled = 0
        var blank = 0
        for (index, item) in films.enumerated() {
            if Task.isCancelled { break }
            let image = await FilmPoster.make(id: item.0, asset: item.1)
            if image != nil { filled += 1 } else { blank += 1 }
            if index % 4 == 0 || index + 1 == films.count {
                line = "Uzupełniam kadry · \(index + 1) z \(films.count)"
                NotificationCenter.default.post(name: FilmPoster.filled, object: nil)
            }
        }
        line = "Sprawdzam serwer…"
        let server = await LibraryEngine.shared.repairServerPreviews()
        NotificationCenter.default.post(name: FilmPoster.filled, object: nil)
        if films.isEmpty {
            line = server
        } else {
            line = "Filmy: \(filled) kadrów uzupełnione, \(blank) bez podglądu. \(server)"
        }
    }
}

private final class DeliveryBox: @unchecked Sendable {
    private let lock = NSLock()
    private var taken = false

    func claim() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        if taken { return false }
        taken = true
        return true
    }
}

private final class FrameBox: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false

    func finish(_ continuation: CheckedContinuation<UIImage?, Never>, _ image: UIImage?) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        continuation.resume(returning: image)
    }
}

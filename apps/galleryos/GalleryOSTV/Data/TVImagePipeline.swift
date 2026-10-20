import AVFoundation
import Foundation
import ImageIO
import OSLog
import UIKit

private let tvThumbLog = Logger(subsystem: "pl.galleryos.app.tv", category: "thumbs")

/// Thumbnails and originals for the Apple TV. Memory cache, then disk cache, then server.
final class TVImagePipeline: ObservableObject, @unchecked Sendable {
    /// Bumped when a transport / catalog becomes available so empty cells retry.
    @Published private(set) var epoch = 0
    /// Hashes whose file on the server is missing or short. The grid leaves those cells out.
    @Published private(set) var withheld: Set<String> = []

    private let lock = NSLock()
    private var transport: CatalogTransport?
    private var root: URL
    private var assetsByHash: [String: LibraryAsset] = [:]
    private var flights: [String: (task: Task<UIImage?, Never>, waiters: Int)] = [:]
    private let thumbs = NSCache<NSString, UIImage>()
    private let fulls = NSCache<NSString, UIImage>()
    private let thumbGate = TVGate(limit: 10)
    /// Frames from films and downscaled originals are slow; they get their own lanes so a
    /// screen full of videos never holds up the small thumbnail files of the photos.
    private let videoGate = TVGate(limit: 2)
    private let originalGate = TVGate(limit: 3)
    private var misses: [String: Date] = [:]
    private var withheldHashes = Set<String>()

    init() {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        root = base.appendingPathComponent("GalleryOSTV", isDirectory: true).appendingPathComponent("default", isDirectory: true)
        // A decoded thumb is ~1.2 MB; cap by bytes so long scrolls never hit memory warnings.
        thumbs.countLimit = 600
        thumbs.totalCostLimit = 300 * 1024 * 1024
        fulls.countLimit = 5
        fulls.totalCostLimit = 360 * 1024 * 1024
    }

    // MARK: Setup

    func configure(namespace: String) {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let folder = base.appendingPathComponent("GalleryOSTV", isDirectory: true)
            .appendingPathComponent(namespace, isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        lock.lock()
        root = folder
        lock.unlock()
        thumbs.removeAllObjects()
        fulls.removeAllObjects()
    }

    var folder: URL {
        lock.lock()
        defer { lock.unlock() }
        return root
    }

    func attach(_ transport: CatalogTransport?) {
        lock.lock()
        self.transport = transport
        misses = [:]
        lock.unlock()
        DispatchQueue.main.async { [weak self] in
            guard let self, transport != nil else { return }
            self.epoch += 1
            tvThumbLog.info("transport attached → epoch \(self.epoch)")
        }
    }

    /// Lets the pipeline fall back to originals when `GalleryOS/thumbs/…` is missing on the server.
    func noteAssets(_ assets: [String: LibraryAsset]) {
        lock.lock()
        let wasEmpty = assetsByHash.isEmpty
        assetsByHash = assets
        lock.unlock()
        guard wasEmpty, !assets.isEmpty else { return }
        DispatchQueue.main.async { [weak self] in
            self?.epoch += 1
        }
    }

    /// Ask empty cells to try again (after a successful pull / reconnect).
    func nudge() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.epoch += 1
        }
    }

    func currentTransport() -> CatalogTransport? {
        lock.lock()
        defer { lock.unlock() }
        return transport
    }

    private func asset(for hash: String) -> LibraryAsset? {
        lock.lock()
        defer { lock.unlock() }
        return assetsByHash[hash]
    }

    // MARK: Thumbnails

    static let thumbSide: CGFloat = 640

    func cachedThumbnail(hash: String) -> UIImage? {
        if let hit = thumbs.object(forKey: hash as NSString) {
            if Self.hasPicture(hit) { return hit }
            thumbs.removeObject(forKey: hash as NSString)
        }
        guard hash.hasPrefix("preview-") else { return nil }
        let image = Self.previewImage(hash)
        keepThumb(image, hash)
        return image
    }

    private func keepThumb(_ image: UIImage, _ hash: String) {
        guard Self.hasPicture(image) else { return }
        let pixels = image.size.width * image.size.height * image.scale * image.scale
        thumbs.setObject(image, forKey: hash as NSString, cost: Int(pixels * 4))
    }

    func thumbnail(hash: String) async -> UIImage? {
        guard !hash.isEmpty else { return nil }
        if let hit = cachedThumbnail(hash: hash) { return hit }
        let key = "t:" + hash
        return await run(key: key) { [self] in
            if let hit = thumbs.object(forKey: hash as NSString) {
                if Self.hasPicture(hit) { return hit }
                thumbs.removeObject(forKey: hash as NSString)
            }
            let file = diskURL(CatalogPaths.thumb(hash: hash))
            if let data = try? Data(contentsOf: file), Self.isImageData(data),
               let image = Self.decode(data, maxSide: Self.thumbSide) {
                if Self.hasPicture(image) {
                    keepThumb(image, hash)
                    return image
                }
                try? FileManager.default.removeItem(at: file)
            }
            guard currentTransport() != nil else {
                tvThumbLog.debug("thumb \(hash, privacy: .public): no transport")
                return nil
            }
            if recentlyMissed(hash) { return nil }

            // 1) Dedicated thumb file (small JPEG written by iPhone).
            await thumbGate.enter()
            if Task.isCancelled {
                await thumbGate.leave()
                return nil
            }
            let small = await readBytes(CatalogPaths.thumb(hash: hash), timeout: 12)
            await thumbGate.leave()
            if Task.isCancelled { return nil }
            if let small, Self.isImageData(small), let image = Self.decode(small, maxSide: Self.thumbSide), Self.hasPicture(image) {
                write(small, to: file)
                keepThumb(image, hash)
                return image
            }

            // 2) Film → a frame streamed in byte ranges. 3) Still → downscaled original.
            let isVideo = asset(for: hash).map { PhotoTraits(rawValue: $0.traits).isVideo } ?? false
            let gate = isVideo ? videoGate : originalGate
            await gate.enter()
            if Task.isCancelled {
                await gate.leave()
                return nil
            }
            let made = isVideo
                ? await thumbnailFromVideo(hash: hash, cacheFile: file)
                : await thumbnailFromOriginal(hash: hash, cacheFile: file)
            await gate.leave()
            if let made {
                keepThumb(made, hash)
                release(hash)
                return made
            }

            if Task.isCancelled { return nil }
            if await originalIsShort(hash) {
                withhold(hash)
            }
            tvThumbLog.warning("thumb \(hash, privacy: .public): empty after all fallbacks")
            noteMiss(hash)
            return nil
        }
    }

    /// A tile that just failed waits a moment before the next attempt, so a screen full of missing
    /// previews does not hammer the server. The wait grows, then settles at a few minutes.
    private func recentlyMissed(_ hash: String) -> Bool {
        lock.withLock {
            guard let at = misses[hash] else { return false }
            let waits = misses.count
            let pause = min(180.0, 8.0 + Double(waits))
            return Date().timeIntervalSince(at) < pause
        }
    }

    private func noteMiss(_ hash: String) {
        lock.withLock { misses[hash] = Date() }
    }

    private func thumbnailFromOriginal(hash: String, cacheFile: URL) async -> UIImage? {
        guard let asset = asset(for: hash), let primary = asset.primary else { return nil }
        let traits = PhotoTraits(rawValue: asset.traits)
        if traits.isVideo { return nil }
        guard let data = await readBytes(
            CatalogPaths.original(hash: primary.hash, ext: primary.ext),
            timeout: 40,
            expected: primary.bytes
        ), Self.isImageData(data),
              let image = Self.decode(data, maxSide: Self.thumbSide) else { return nil }
        guard Self.hasPicture(image) else { return nil }
        if let jpeg = image.jpegData(compressionQuality: 0.82) {
            write(jpeg, to: cacheFile)
        }
        return image
    }

    private func thumbnailFromVideo(hash: String, cacheFile: URL) async -> UIImage? {
        guard let asset = asset(for: hash), let primary = asset.primary,
              PhotoTraits(rawValue: asset.traits).isVideo else { return nil }
        var loader: TVStreamLoader?
        let avAsset: AVURLAsset
        if let file = existingFile(for: primary) {
            avAsset = AVURLAsset(url: file)
        } else if let target = streamTarget(for: primary),
                  let made = TVStreamLoader.asset(url: target.url, headers: target.headers, ext: primary.ext) {
            avAsset = made.asset
            loader = made.loader
        } else {
            return nil
        }
        let image = await Self.frame(of: avAsset, maxSide: Self.thumbSide, timeout: 25)
        withExtendedLifetime(loader) {}
        guard let image, Self.hasPicture(image) else {
            tvThumbLog.debug("video frame \(hash, privacy: .public): none")
            return nil
        }
        if let jpeg = image.jpegData(compressionQuality: 0.82) {
            write(jpeg, to: cacheFile)
        }
        return image
    }

    /// A representative SDR frame: HDR and Dolby Vision frames are tone-mapped, and the first
    /// second is skipped because many clips open on black.
    static func frame(of asset: AVAsset, maxSide: CGFloat, timeout: TimeInterval) async -> UIImage? {
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: maxSide, height: maxSide)
        generator.requestedTimeToleranceBefore = .positiveInfinity
        generator.requestedTimeToleranceAfter = CMTime(seconds: 3, preferredTimescale: 600)
        generator.dynamicRangePolicy = .forceSDR
        return await withTaskGroup(of: UIImage?.self) { group in
            group.addTask {
                let duration = (try? await asset.load(.duration))?.seconds ?? 0
                let spots: [Double]
                if duration.isFinite, duration > 2 {
                    spots = [min(1.5, duration * 0.1), min(duration * 0.4, max(0.2, duration - 0.2))]
                } else {
                    spots = [0.5, 0]
                }
                for second in spots {
                    if Task.isCancelled { return nil }
                    guard let cg = try? await generator.image(at: CMTime(seconds: second, preferredTimescale: 600)).image else { continue }
                    let image = UIImage(cgImage: cg)
                    if hasPicture(image) { return image }
                }
                return nil
            }
            group.addTask {
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                generator.cancelAllCGImageGeneration()
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
    }

    func prefetch(thumbnails hashes: [String]) {
        for hash in hashes where !hash.isEmpty && thumbs.object(forKey: hash as NSString) == nil {
            Task(priority: .utility) { [self] in _ = await thumbnail(hash: hash) }
        }
    }

    // MARK: Originals

    func cachedFull(hash: String) -> UIImage? {
        fulls.object(forKey: hash as NSString)
    }

    func full(asset: LibraryAsset, maxSide: CGFloat) async -> UIImage? {
        if let hit = fulls.object(forKey: asset.hash as NSString) { return hit }
        guard let resource = asset.primary else { return nil }
        let key = "f:" + asset.hash
        return await run(key: key) { [self] in
            let isMovie = PhotoTraits(rawValue: asset.traits).isVideo
            if isMovie { return await thumbnail(hash: asset.hash) }
            guard let data = await readBytes(
                CatalogPaths.original(hash: resource.hash, ext: resource.ext),
                timeout: 180
            ) else { return nil }
            let animated = resource.ext.lowercased() == "gif" || PhotoTraits(rawValue: asset.traits).contains(.animated)
            let image: UIImage?
            if animated {
                image = AnimatedFrames.image(data: data, maxSide: 1280, maxFrames: 90)
            } else {
                image = Self.decode(data, maxSide: maxSide)
            }
            guard let image else { return nil }
            let cost = Int(image.size.width * image.size.height * 4)
            fulls.setObject(image, forKey: asset.hash as NSString, cost: cost)
            return image
        }
    }

    func prefetch(full assets: [LibraryAsset], maxSide: CGFloat) {
        for asset in assets where fulls.object(forKey: asset.hash as NSString) == nil {
            Task(priority: .utility) { [self] in _ = await full(asset: asset, maxSide: maxSide) }
        }
    }

    var prefersDownloadFirst: Bool {
        TVMediaPolicy.prefersDownloadFirst(transport: currentTransport())
    }

    func existingFile(for resource: LibraryResource) -> URL? {
        let file = diskURL(CatalogPaths.original(hash: resource.hash, ext: resource.ext))
        guard FileManager.default.fileExists(atPath: file.path) else { return nil }
        let size = (try? FileManager.default.attributesOfItem(atPath: file.path)[.size] as? NSNumber)?.int64Value ?? 0
        if size <= 0 || (resource.bytes > 0 && size != Int64(resource.bytes)) {
            try? FileManager.default.removeItem(at: file)
            return nil
        }
        return file
    }

    /// Downloads a resource straight to disk (never through RAM). Required for video on Apple TV.
    func localFile(for resource: LibraryResource) async -> URL? {
        if let file = existingFile(for: resource) { return file }
        let path = CatalogPaths.original(hash: resource.hash, ext: resource.ext)
        let file = diskURL(path)
        if await downloadToDisk(path, destination: file) {
            return existingFile(for: resource)
        }
        return nil
    }

    func streamTarget(for resource: LibraryResource) -> (url: URL, headers: [String: String])? {
        guard let streaming = currentTransport() as? StreamingTransport else { return nil }
        return streaming.streamTarget(CatalogPaths.original(hash: resource.hash, ext: resource.ext))
    }

    /// Prefetch the newest grid tiles so the first screen is not a wall of empty squares.
    func warmRecent(hashes: [String]) {
        let slice = Array(hashes.prefix(TVMediaPolicy.warmThumbCount))
        prefetch(thumbnails: slice)
    }

    /// True when the pipeline can talk to a server right now.
    var isOnline: Bool { currentTransport() != nil }

    // MARK: Housekeeping

    func clearDisk() {
        thumbs.removeAllObjects()
        fulls.removeAllObjects()
        try? FileManager.default.removeItem(at: folder.appendingPathComponent("GalleryOS", isDirectory: true))
    }

    func diskUsage() -> Int {
        let base = folder.appendingPathComponent("GalleryOS", isDirectory: true)
        guard let walker = FileManager.default.enumerator(at: base, includingPropertiesForKeys: [.fileSizeKey]) else { return 0 }
        var total = 0
        for case let url as URL in walker {
            total += (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        }
        return total
    }

    /// Keeps the cache of originals under a size budget (oldest files go first).
    func trimOriginals(limit: Int = 1_500_000_000) {
        let base = folder.appendingPathComponent("GalleryOS/originals", isDirectory: true)
        guard let walker = FileManager.default.enumerator(
            at: base,
            includingPropertiesForKeys: [.fileSizeKey, .contentAccessDateKey, .contentModificationDateKey]
        ) else { return }
        var files: [(url: URL, size: Int, date: Date)] = []
        for case let url as URL in walker {
            guard let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentAccessDateKey, .contentModificationDateKey]),
                  let size = values.fileSize else { continue }
            files.append((url, size, values.contentAccessDate ?? values.contentModificationDate ?? .distantPast))
        }
        var total = files.reduce(0) { $0 + $1.size }
        guard total > limit else { return }
        for file in files.sorted(by: { $0.date < $1.date }) {
            try? FileManager.default.removeItem(at: file.url)
            total -= file.size
            if total <= limit * 8 / 10 { break }
        }
    }

    // MARK: Internals

    private func diskURL(_ relative: String) -> URL {
        folder.appendingPathComponent(relative)
    }

    private func write(_ data: Data, to url: URL) {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: url, options: .atomic)
    }

    /// Stream URL first (WebDAV + GalleryOS server), then transport.readFile.
    private func readBytes(_ relative: String, timeout: TimeInterval, expected: Int = 0) async -> Data? {
        let file = diskURL(relative)
        if FileManager.default.fileExists(atPath: file.path),
           let data = try? Data(contentsOf: file, options: .mappedIfSafe), !data.isEmpty {
            if expected <= 0 || data.count == expected { return data }
            try? FileManager.default.removeItem(at: file)
        }
        // Prefer disk download for anything that might be large (originals).
        if relative.contains("/originals/") {
            if await downloadToDisk(relative, destination: file, expected: expected),
               let data = try? Data(contentsOf: file, options: .mappedIfSafe),
               expected <= 0 || data.count == expected {
                return data
            }
            return nil
        }
        if let streaming = currentTransport() as? StreamingTransport,
           let target = streaming.streamTarget(relative) {
            var request = URLRequest(url: target.url)
            request.timeoutInterval = timeout
            for (field, value) in target.headers {
                request.setValue(value, forHTTPHeaderField: field)
            }
            if let (data, response) = try? await GalleryNetwork.shared.data(for: request),
               let http = response as? HTTPURLResponse,
               (200..<300).contains(http.statusCode),
               !data.isEmpty {
                return data
            }
        }
        guard let transport = currentTransport() else { return nil }
        do {
            return try await transport.readFile(relative)
        } catch {
            tvThumbLog.debug("read \(relative, privacy: .public): \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    @discardableResult
    private func downloadToDisk(_ relative: String, destination: URL, expected: Int = 0) async -> Bool {
        if let streaming = currentTransport() as? StreamingTransport,
           let target = streaming.streamTarget(relative) {
            var request = URLRequest(url: target.url)
            request.timeoutInterval = 60 * 30
            for (field, value) in target.headers {
                request.setValue(value, forHTTPHeaderField: field)
            }
            if (try? await GalleryNetwork.shared.download(for: request, to: destination)) != nil {
                let size = existingSize(destination)
                if size > 0, expected <= 0 || size == Int64(expected) { return true }
                try? FileManager.default.removeItem(at: destination)
            }
        }
        guard let transport = currentTransport(),
              let data = try? await transport.readFile(relative), !data.isEmpty else { return false }
        if expected > 0, data.count != expected { return false }
        write(data, to: destination)
        return existingSize(destination) > 0
    }

    /// The original is absent or shorter than the journal promised. A network error is not that.
    private func originalIsShort(_ hash: String) async -> Bool {
        guard let asset = asset(for: hash), let primary = asset.primary, primary.bytes > 0,
              let transport = currentTransport() else { return false }
        let path = CatalogPaths.original(hash: primary.hash, ext: primary.ext)
        do {
            guard let size = try await transport.byteCount(path) else { return true }
            return size != primary.bytes
        } catch {
            return false
        }
    }

    private func withhold(_ hash: String) {
        lock.lock()
        let fresh = withheldHashes.insert(hash).inserted
        lock.unlock()
        guard fresh else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.withheld.insert(hash)
            self.epoch += 1
        }
        kick(hash)
    }

    private func kick(_ hash: String) {
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(25))
            guard let self, self.isWithheld(hash) else { return }
            if await self.thumbnail(hash: hash) != nil {
                self.release(hash)
            } else if self.isWithheld(hash) {
                self.kick(hash)
            }
        }
    }

    private func release(_ hash: String) {
        lock.lock()
        let removed = withheldHashes.remove(hash) != nil
        lock.unlock()
        guard removed else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.withheld.remove(hash)
            self.epoch += 1
        }
    }

    func isWithheld(_ hash: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return withheldHashes.contains(hash)
    }

    private func existingSize(_ url: URL) -> Int64 {
        (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.int64Value ?? 0
    }

    /// Coalesce in-flight work. Always drop the flight when the task finishes so a nil
    /// result never permanently blocks later retries (e.g. after transport connects).
    /// A tile that scrolls away cancels its wait; when nobody waits any more the work itself
    /// is cancelled, so a fast scroll does not leave hundreds of downloads behind it.
    private func run(key: String, work: @escaping @Sendable () async -> UIImage?) async -> UIImage? {
        let task: Task<UIImage?, Never> = lock.withLock {
            if var existing = flights[key] {
                existing.waiters += 1
                flights[key] = existing
                return existing.task
            }
            let created = Task { await work() }
            flights[key] = (created, 1)
            return created
        }
        let result = await withTaskCancellationHandler {
            await task.value
        } onCancel: { [self] in
            lock.withLock {
                guard var flight = flights[key], flight.task == task else { return }
                flight.waiters -= 1
                if flight.waiters <= 0 {
                    flights[key] = nil
                    task.cancel()
                } else {
                    flights[key] = flight
                }
            }
        }
        lock.withLock {
            if flights[key]?.task == task { flights[key] = nil }
        }
        return result
    }

    static func decode(_ data: Data, maxSide: CGFloat) -> UIImage? {
        guard isImageData(data) else { return nil }
        if let source = CGImageSourceCreateWithData(data as CFData, nil) {
            let options: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceShouldCacheImmediately: true,
                kCGImageSourceThumbnailMaxPixelSize: max(64, maxSide),
            ]
            if let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) {
                return UIImage(cgImage: cg)
            }
        }
        return UIImage(data: data)
    }

    /// Layout-preview picture: a soft two-tone gradient that differs per photo.
    static func previewImage(_ hash: String) -> UIImage {
        var seed: UInt64 = 1469598103934665603
        for byte in hash.utf8 { seed = (seed ^ UInt64(byte)) &* 1099511628211 }
        let hue = CGFloat(seed % 360) / 360
        let size = CGSize(width: 480, height: 360)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            let top = UIColor(hue: hue, saturation: 0.55, brightness: 0.85, alpha: 1)
            let bottom = UIColor(hue: (hue + 0.12).truncatingRemainder(dividingBy: 1), saturation: 0.75, brightness: 0.35, alpha: 1)
            let colors = [top.cgColor, bottom.cgColor] as CFArray
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
                context.cgContext.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: size.width, y: size.height), options: [])
            }
            UIColor.white.withAlphaComponent(0.18).setFill()
            context.cgContext.fillEllipse(in: CGRect(x: size.width * 0.55, y: size.height * 0.12, width: 120, height: 120))
        }
    }

    /// A 1×1 decode is not a photo. A dark frame still is.
    static func hasPicture(_ image: UIImage) -> Bool {
        image.size.width >= 2 && image.size.height >= 2
    }

    /// Rejects HTML/XML error bodies from WebDAV so they are never cached as “thumbs”.
    static func isImageData(_ data: Data) -> Bool {
        guard data.count >= 12 else { return false }
        let b = [UInt8](data.prefix(12))
        if b[0] == 0xFF, b[1] == 0xD8 { return true } // JPEG
        if b[0] == 0x89, b[1] == 0x50, b[2] == 0x4E, b[3] == 0x47 { return true } // PNG
        if b[0] == 0x47, b[1] == 0x49, b[2] == 0x46 { return true } // GIF
        if b[0] == 0x52, b[1] == 0x49, b[2] == 0x46, b[3] == 0x46 { return true } // WEBP/RIFF
        // HEIC/HEIF: … ftyp ….
        if b.count >= 12, b[4] == 0x66, b[5] == 0x74, b[6] == 0x79, b[7] == 0x70 { return true }
        return false
    }
}

actor TVGate {
    private let limit: Int
    private var running = 0
    private var waiters: [CheckedContinuation<Void, Never>] = []

    init(limit: Int) {
        self.limit = limit
    }

    func enter() async {
        if running < limit {
            running += 1
            return
        }
        await withCheckedContinuation { waiters.append($0) }
    }

    /// Newest waiter first: what just appeared on screen matters more than what scrolled away.
    func leave() {
        if let next = waiters.popLast() {
            next.resume()
        } else {
            running = max(0, running - 1)
        }
    }
}

final class TVOnce: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false

    func run(_ body: () -> Void) {
        lock.lock()
        let first = !done
        done = true
        lock.unlock()
        if first { body() }
    }
}

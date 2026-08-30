import Foundation
import UIKit
#if canImport(TVServices)
import TVServices
#endif

/// Converts catalog photos to JPEG in the App Group so the Top Shelf extension
/// never has to download or render images (that crashes HeadBoard).
enum TopShelfArtBaker {
    private static let appGroupID = "group.pl.estateos.app.tvos"
    private static let carouselSize = CGSize(width: 1920, height: 1080)
    private static let sectionedSize = CGSize(width: 1920, height: 720)

    static func enqueue(offers: [EstateOffer] = [], cars: [CarListing] = []) {
        guard !offers.isEmpty || !cars.isEmpty else { return }
        Task.detached(priority: .utility) {
            let wrote = await bake(offers: offers, cars: cars)
            guard wrote else { return }
#if canImport(TVServices)
            await MainActor.run {
                TVTopShelfContentProvider.topShelfContentDidChange()
            }
#endif
        }
    }

    private static func bake(offers: [EstateOffer], cars: [CarListing]) async -> Bool {
        guard let directory = shelfDirectory() else { return false }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        var wrote = false
        let offerPool = Array(offers.prefix(10))
        for offer in offerPool {
            let source = EOSOfferMedia.primaryImageURL(for: offer)
            if await writeIfNeeded(
                url: source,
                directory: directory,
                name: "offer-\(offer.id)-carousel.jpg",
                size: carouselSize
            ) { wrote = true }
            if await writeIfNeeded(
                url: source,
                directory: directory,
                name: "offer-\(offer.id)-sectioned.jpg",
                size: sectionedSize
            ) { wrote = true }
        }

        for car in cars.prefix(8) {
            let source = EOSOfferMedia.imageURL(from: car.imageUrl)
            if await writeIfNeeded(
                url: source,
                directory: directory,
                name: "car-\(car.id)-sectioned.jpg",
                size: sectionedSize
            ) { wrote = true }
        }
        return wrote
    }

    private static func shelfDirectory() -> URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupID)?
            .appendingPathComponent("Library/Caches/topshelf", isDirectory: true)
    }

    private static func writeIfNeeded(
        url: URL?,
        directory: URL,
        name: String,
        size: CGSize
    ) async -> Bool {
        let fileURL = directory.appendingPathComponent(name)
        if FileManager.default.fileExists(atPath: fileURL.path) { return false }
        guard let url, let image = await loadImage(url) else { return false }
        guard let data = jpegData(from: image, size: size) else { return false }
        do {
            try data.write(to: fileURL, options: .atomic)
            return true
        } catch {
            return false
        }
    }

    private static func loadImage(_ url: URL) async -> UIImage? {
        if let cached = EOSImageCache.image(for: url) { return cached }
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 8
            request.setValue(AppConfig.userAgent, forHTTPHeaderField: "User-Agent")
            let (data, _) = try await URLSession.shared.data(for: request)
            guard let image = UIImage(data: data) else { return nil }
            EOSImageCache.store(image, for: url)
            return image
        } catch {
            return nil
        }
    }

    private static func jpegData(from image: UIImage, size: CGSize) -> Data? {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let rendered = renderer.image { _ in
            UIColor.black.setFill()
            UIRectFill(CGRect(origin: .zero, size: size))
            let imgSize = image.size
            guard imgSize.width > 1, imgSize.height > 1 else { return }
            let scale = max(size.width / imgSize.width, size.height / imgSize.height)
            let width = imgSize.width * scale
            let height = imgSize.height * scale
            image.draw(
                in: CGRect(
                    x: (size.width - width) / 2,
                    y: (size.height - height) / 2,
                    width: width,
                    height: height
                )
            )
        }
        return rendered.jpegData(compressionQuality: 0.84)
    }
}

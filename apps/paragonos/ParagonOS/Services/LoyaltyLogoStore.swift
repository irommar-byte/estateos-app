import Foundation
import UIKit
import SwiftUI

struct LoyaltyVisual {
    var image: UIImage?
    var usesBrandMark: Bool
    var color: Color
}

actor LoyaltyLogoStore {
    static let shared = LoyaltyLogoStore()

    private var memory: [String: UIImage] = [:]
    private let cacheVersion = "LoyaltyLogos-v11"

    func visual(for program: LoyaltyProgram) async -> LoyaltyVisual {
        let fallback = program.brandColor
        if let image = await realImage(for: program) {
            return LoyaltyVisual(image: image, usesBrandMark: false, color: fallback)
        }
        if LoyaltyBrandArt.hasMark(program.id) {
            return LoyaltyVisual(image: nil, usesBrandMark: true, color: fallback)
        }
        return LoyaltyVisual(image: nil, usesBrandMark: false, color: fallback)
    }

    func image(for program: LoyaltyProgram) async -> UIImage? {
        if let image = await realImage(for: program) { return image }
        if LoyaltyBrandArt.hasMark(program.id) {
            let raster = await MainActor.run {
                LoyaltyBrandArt.raster(program: program, dimension: 256)
            }
            return raster.map { LogoCropper.trim($0) }
        }
        return nil
    }

    private func realImage(for program: LoyaltyProgram) async -> UIImage? {
        let spec = LoyaltyBrandKit.spec(for: program.id)
        if let cached = memory[program.id] {
            if LoyaltyBrandKit.bundledLogo(for: program.id) != nil {
                return cached
            }
            if LogoQuality.looksLikeTile(cached), StoreLogoPolicy.shouldFetchRemote(for: program) {
                memory[program.id] = nil
            } else if spec.allowsRemote, LogoQuality.acceptsStoreIcon(cached) == false {
                memory[program.id] = nil
            } else {
                return cached
            }
        }
        let disk = cacheURL(for: program.id)
        if let bundled = bundledImage(for: program.id) {
            let trimmed = LogoCropper.trim(bundled)
            memory[program.id] = trimmed
            try? trimmed.pngData()?.write(to: disk, options: .atomic)
            return trimmed
        }
        if FileManager.default.fileExists(atPath: disk.path),
           let data = try? Data(contentsOf: disk),
           let image = UIImage(data: data),
           pixelWidth(image) >= 64 {
            let trimmed = LogoCropper.trim(image)
            let keep = StoreLogoPolicy.shouldFetchRemote(for: program) || spec.allowsRemote
                ? LogoQuality.acceptsStoreIcon(trimmed)
                : LogoQuality.looksLikeTile(trimmed) == false
            if keep {
                memory[program.id] = trimmed
                return trimmed
            }
            try? FileManager.default.removeItem(at: disk)
        }
        guard StoreLogoPolicy.shouldFetchRemote(for: program) || spec.allowsRemote else {
            return nil
        }
        guard let image = await bestRemoteLogo(for: program) else { return nil }
        let trimmed = LogoCropper.trim(image)
        guard LogoQuality.acceptsStoreIcon(trimmed) else { return nil }
        memory[program.id] = trimmed
        try? trimmed.pngData()?.write(to: disk, options: .atomic)
        return trimmed
    }

    private func bundledImage(for id: String) -> UIImage? {
        let names = [id]
        for name in names {
            if let url = Bundle.main.url(forResource: name, withExtension: "png", subdirectory: "BrandLogos")
                ?? Bundle.main.url(forResource: name, withExtension: "png"),
               let image = UIImage(contentsOfFile: url.path),
               pixelWidth(image) >= 32 {
                return image
            }
        }
        return nil
    }

    private func bestRemoteLogo(for program: LoyaltyProgram) async -> UIImage? {
        var best: UIImage?
        var bestPixels = 0
        for url in iconURLs(for: program) {
            guard let image = await download(url) else { continue }
            let pixels = pixelWidth(image)
            guard pixels >= 128, LogoQuality.acceptsStoreIcon(image) else { continue }
            if pixels > bestPixels {
                best = image
                bestPixels = pixels
            }
            if pixels >= 256 { break }
        }
        return best
    }

    private func download(_ url: URL) async -> UIImage? {
        var request = URLRequest(url: url, timeoutInterval: 8)
        request.setValue("ParagonOS/1.0", forHTTPHeaderField: "User-Agent")
        guard let (data, response) = try? await URLSession.shared.data(for: request) else { return nil }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status), let image = UIImage(data: data) else { return nil }
        return image
    }

    private func iconURLs(for program: LoyaltyProgram) -> [URL] {
        var urls: [URL] = []
        if let raw = program.logoURL, let extra = URL(string: raw) {
            urls.append(extra)
        }
        let host = program.domain.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
        guard host.isEmpty == false else { return urls }
        let apex = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        urls.append(contentsOf: [
            URL(string: "https://logo.clearbit.com/\(apex)?size=512"),
            URL(string: "https://www.\(apex)/apple-touch-icon.png"),
            URL(string: "https://\(apex)/apple-touch-icon.png"),
            URL(string: "https://www.google.com/s2/favicons?sz=256&domain=\(apex)")
        ].compactMap { $0 })
        return urls
    }

    private func pixelWidth(_ image: UIImage) -> Int {
        Int(image.size.width * image.scale)
    }

    private var didClearStale = false

    private func cacheURL(for id: String) -> URL {
        let root = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        if didClearStale == false {
            try? FileManager.default.removeItem(at: root.appendingPathComponent("LoyaltyLogos", isDirectory: true))
            try? FileManager.default.removeItem(at: root.appendingPathComponent("LoyaltyLogos-v3", isDirectory: true))
            try? FileManager.default.removeItem(at: root.appendingPathComponent("LoyaltyLogos-v4", isDirectory: true))
            try? FileManager.default.removeItem(at: root.appendingPathComponent("LoyaltyLogos-v5", isDirectory: true))
            try? FileManager.default.removeItem(at: root.appendingPathComponent("LoyaltyLogos-v7", isDirectory: true))
            try? FileManager.default.removeItem(at: root.appendingPathComponent("LoyaltyLogos-v8", isDirectory: true))
            try? FileManager.default.removeItem(at: root.appendingPathComponent("LoyaltyLogos-v9", isDirectory: true))
            try? FileManager.default.removeItem(at: root.appendingPathComponent("LoyaltyLogos-v10", isDirectory: true))
            didClearStale = true
        }
        let folder = root.appendingPathComponent(cacheVersion, isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("\(id).png")
    }
}

enum StoreLogoPolicy {
    /// Receipt / retailer chips may fetch a real store mark when we have no bundled PNG.
    /// Loyalty cards still ignore remote via `LoyaltyBrandKit.spec.allowsRemote`.
    static func shouldFetchRemote(for program: LoyaltyProgram) -> Bool {
        if LoyaltyBrandKit.bundledLogo(for: program.id) != nil { return false }
        if let extra = program.logoURL, extra.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
            return true
        }
        return program.domain.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
    }
}

enum LogoCropper {
    static func trim(_ image: UIImage, knockingOut hex: String? = nil, punchInteriorPaper: Bool = false) -> UIImage {
        knockoutAndCrop(image, backgroundHex: hex, punchInteriorPaper: punchInteriorPaper)
    }

    static func knockoutAndCrop(_ image: UIImage, backgroundHex: String? = nil, punchInteriorPaper: Bool = false) -> UIImage {
        guard let cg = image.cgImage else { return image }
        let width = cg.width
        let height = cg.height
        guard width > 4, height > 4 else { return image }
        var buffer = [UInt8](repeating: 0, count: width * height * 4)
        let space = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
        return buffer.withUnsafeMutableBytes { raw -> UIImage in
            guard let data = raw.baseAddress, let ctx = CGContext(
                data: data,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: width * 4,
                space: space,
                bitmapInfo: bitmapInfo
            ) else { return image }
            ctx.clear(CGRect(x: 0, y: 0, width: width, height: height))
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
            let bytes = data.assumingMemoryBound(to: UInt8.self)

            func luma(_ i: Int) -> Double {
                let a = Double(bytes[i + 3])
                guard a > 8 else { return 1 }
                let r = Double(bytes[i]) / 255
                let g = Double(bytes[i + 1]) / 255
                let b = Double(bytes[i + 2]) / 255
                return 0.2126 * r + 0.7152 * g + 0.0722 * b
            }
            func sat(_ i: Int) -> Double {
                let r = Double(bytes[i]) / 255
                let g = Double(bytes[i + 1]) / 255
                let b = Double(bytes[i + 2]) / 255
                let maxc = max(r, g, b)
                let minc = min(r, g, b)
                return maxc == 0 ? 0 : (maxc - minc) / maxc
            }
            func alpha(_ i: Int) -> Double {
                Double(bytes[i + 3]) / 255
            }

            let cornerIdx = [
                (1 * width + 1) * 4,
                (1 * width + (width - 2)) * 4,
                ((height - 2) * width + 1) * 4,
                ((height - 2) * width + (width - 2)) * 4
            ]
            let opaqueCorners = cornerIdx.filter { alpha($0) > 0.2 }
            let cornerLuma = opaqueCorners.map(luma)
            let punchWhite = opaqueCorners.count >= 3 && cornerLuma.filter { $0 > 0.9 }.count >= 3
            let punchBlack = opaqueCorners.count >= 3 && cornerLuma.filter { $0 < 0.12 }.count >= 3

            var brand: (r: Double, g: Double, b: Double)?
            if let hex = backgroundHex {
                var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
                UIColor(Color(hex: hex)).getRed(&r, green: &g, blue: &b, alpha: &a)
                brand = (Double(r), Double(g), Double(b))
            }

            func matchesBrand(_ i: Int) -> Bool {
                guard let brand, alpha(i) > 0.12 else { return false }
                let r = Double(bytes[i]) / 255
                let g = Double(bytes[i + 1]) / 255
                let b = Double(bytes[i + 2]) / 255
                return hypot(hypot(r - brand.r, g - brand.g), b - brand.b) < 0.24
            }

            func isPaper(_ i: Int) -> Bool {
                let a = Double(bytes[i + 3]) / 255
                let l = luma(i)
                let s = sat(i)
                return a < 0.08
                    || (l > 0.90 && s < 0.12)
                    || (punchWhite && l > 0.86 && s < 0.18)
                    || (punchBlack && l < 0.14 && s < 0.18)
            }

            func flood(_ shouldEat: (Int) -> Bool) {
                var visited = [UInt8](repeating: 0, count: width * height)
                var queue = [Int]()
                queue.reserveCapacity(width + height)
                func enqueue(_ x: Int, _ y: Int) {
                    guard x >= 0, y >= 0, x < width, y < height else { return }
                    let idx = y * width + x
                    if visited[idx] == 1 { return }
                    visited[idx] = 1
                    if shouldEat(idx * 4) {
                        queue.append(idx)
                    }
                }
                for x in 0..<width {
                    enqueue(x, 0)
                    enqueue(x, height - 1)
                }
                for y in 0..<height {
                    enqueue(0, y)
                    enqueue(width - 1, y)
                }
                var q = 0
                while q < queue.count {
                    let idx = queue[q]
                    q += 1
                    let x = idx % width
                    let y = idx / width
                    enqueue(x - 1, y)
                    enqueue(x + 1, y)
                    enqueue(x, y - 1)
                    enqueue(x, y + 1)
                }
                for idx in queue {
                    let i = idx * 4
                    bytes[i] = 0
                    bytes[i + 1] = 0
                    bytes[i + 2] = 0
                    bytes[i + 3] = 0
                }
            }

            flood(isPaper)

            func inkStats() -> (total: Double, other: Double, coverage: Double, edge: Double, edgeBrand: Double, minX: Int, minY: Int, maxX: Int, maxY: Int) {
                var edgeBrand = 0.0
                var edgeInk = 0.0
                var otherInk = 0.0
                var totalInk = 0.0
                var minX = width
                var minY = height
                var maxX = 0
                var maxY = 0
                for y in 0..<height {
                    for x in 0..<width {
                        let i = (y * width + x) * 4
                        guard bytes[i + 3] > 20 else { continue }
                        minX = min(minX, x)
                        minY = min(minY, y)
                        maxX = max(maxX, x)
                        maxY = max(maxY, y)
                        let weight = Double(bytes[i + 3]) / 255
                        totalInk += weight
                        if matchesBrand(i) == false { otherInk += weight }
                    }
                }
                guard maxX > minX, maxY > minY else {
                    return (totalInk, otherInk, 0, 0, 0, 0, 0, 0, 0)
                }
                func edgePixel(_ x: Int, _ y: Int) {
                    let i = (y * width + x) * 4
                    guard bytes[i + 3] > 20 else { return }
                    let weight = Double(bytes[i + 3]) / 255
                    edgeInk += weight
                    if matchesBrand(i) { edgeBrand += weight }
                }
                for y in minY...maxY {
                    edgePixel(minX, y)
                    edgePixel(maxX, y)
                }
                for x in minX...maxX {
                    edgePixel(x, minY)
                    edgePixel(x, maxY)
                }
                let boxArea = Double(max(1, (maxX - minX + 1) * (maxY - minY + 1)))
                return (totalInk, otherInk, totalInk / boxArea, edgeInk, edgeBrand, minX, minY, maxX, maxY)
            }

            // Wordmarks on white (Auchan, Żabka, Costa): open letter counters.
            // Skip when the remaining bitmap is still a solid plate (Decathlon, Orlen).
            if punchInteriorPaper, inkStats().coverage < 0.72 {
                for i in stride(from: 0, to: width * height * 4, by: 4) {
                    if isPaper(i) {
                        bytes[i] = 0
                        bytes[i + 1] = 0
                        bytes[i + 2] = 0
                        bytes[i + 3] = 0
                    }
                }
            }

            func floodColoredPlate() {
                let stats = inkStats()
                guard stats.coverage > 0.72, stats.total > 0, stats.other / stats.total > 0.08 else { return }
                guard stats.maxX > stats.minX, stats.maxY > stats.minY else { return }
                var sr = 0.0, sg = 0.0, sb = 0.0, sw = 0.0
                func sample(_ x: Int, _ y: Int) {
                    let i = (y * width + x) * 4
                    let a = Double(bytes[i + 3]) / 255
                    guard a > 0.2 else { return }
                    sr += Double(bytes[i]) / 255 * a
                    sg += Double(bytes[i + 1]) / 255 * a
                    sb += Double(bytes[i + 2]) / 255 * a
                    sw += a
                }
                for y in stats.minY...stats.maxY {
                    sample(stats.minX, y)
                    sample(stats.maxX, y)
                }
                for x in stats.minX...stats.maxX {
                    sample(x, stats.minY)
                    sample(x, stats.maxY)
                }
                guard sw > 0 else { return }
                let pr = sr / sw, pg = sg / sw, pb = sb / sw
                let maxc = max(pr, pg, pb)
                let minc = min(pr, pg, pb)
                let sat = maxc == 0 ? 0 : (maxc - minc) / maxc
                let luma = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb
                // Never flood paper/white — that punches letter fills (Orlen, Decathlon).
                guard sat > 0.18, luma < 0.82, luma > 0.04 else { return }
                flood { idx in
                    guard bytes[idx + 3] > 20 else { return false }
                    let r = Double(bytes[idx]) / 255
                    let g = Double(bytes[idx + 1]) / 255
                    let b = Double(bytes[idx + 2]) / 255
                    return hypot(hypot(r - pr, g - pg), b - pb) < 0.24
                }
            }

            if brand != nil {
                let stats = inkStats()
                let plate = stats.edge > 0
                    && stats.edgeBrand / stats.edge > 0.55
                    && stats.coverage > 0.72
                    && stats.total > 0
                    && stats.other / stats.total > 0.08
                if plate {
                    flood { matchesBrand($0) && isPaper($0) == false }
                }
            }
            floodColoredPlate()

            var minX = width
            var minY = height
            var maxX = 0
            var maxY = 0
            for y in 0..<height {
                for x in 0..<width {
                    let i = (y * width + x) * 4
                    if bytes[i + 3] > 20 {
                        minX = min(minX, x)
                        minY = min(minY, y)
                        maxX = max(maxX, x)
                        maxY = max(maxY, y)
                    }
                }
            }
            guard maxX > minX, maxY > minY, let knocked = ctx.makeImage() else { return image }
            let pad = max(2, min(width, height) / 80)
            let crop = CGRect(
                x: max(0, minX - pad),
                y: max(0, minY - pad),
                width: min(width - 1, maxX + pad) - max(0, minX - pad),
                height: min(height - 1, maxY + pad) - max(0, minY - pad)
            )
            guard crop.width > 4, crop.height > 4, let cut = knocked.cropping(to: crop) else {
                return UIImage(cgImage: knocked, scale: image.scale, orientation: image.imageOrientation)
            }
            return UIImage(cgImage: cut, scale: image.scale, orientation: image.imageOrientation)
        }
    }
}

enum LogoQuality {
    /// Favicons and solid tiles never become the card/Wallet mark.
    static func accepts(_ image: UIImage) -> Bool {
        let width = image.size.width * image.scale
        let height = image.size.height * image.scale
        guard min(width, height) >= 64, max(width, height) >= 96 else { return false }
        let coverage = PassArtwork.opaqueRatio(image)
        guard coverage > 0.05, coverage < 0.94 else { return false }
        if looksLikeTile(image) { return false }
        return true
    }

    /// Square store marks (x-kom, MediaMarkt, Dyson) are valid on receipt chips.
    static func acceptsStoreIcon(_ image: UIImage) -> Bool {
        let width = image.size.width * image.scale
        let height = image.size.height * image.scale
        guard min(width, height) >= 64, max(width, height) >= 96 else { return false }
        let coverage = PassArtwork.opaqueRatio(image)
        return coverage > 0.04 && coverage < 0.98
    }

    /// Solid favicon squares, white plates, and low-variance badges.
    static func looksLikeTile(_ image: UIImage) -> Bool {
        let width = image.size.width * image.scale
        let height = image.size.height * image.scale
        let aspect = width / max(height, 1)
        guard aspect > 0.72, aspect < 1.38 else { return false }
        let coverage = PassArtwork.opaqueRatio(image)
        if coverage > 0.82 { return true }
        if coverage > 0.55, variance(image) < 0.045 { return true }
        return false
    }

    private static func variance(_ image: UIImage) -> Double {
        guard let cg = image.cgImage else { return 1 }
        let width = 16
        let height = 16
        var buffer = [UInt8](repeating: 0, count: width * height * 4)
        let ok = buffer.withUnsafeMutableBytes { raw -> Bool in
            guard let ctx = CGContext(
                data: raw.baseAddress,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return false }
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard ok else { return 1 }
        var samples: [Double] = []
        for i in stride(from: 0, to: buffer.count, by: 4) {
            guard buffer[i + 3] > 40 else { continue }
            let r = Double(buffer[i]) / 255
            let g = Double(buffer[i + 1]) / 255
            let b = Double(buffer[i + 2]) / 255
            samples.append(0.2126 * r + 0.7152 * g + 0.0722 * b)
        }
        guard samples.count > 8 else { return 0 }
        let mean = samples.reduce(0, +) / Double(samples.count)
        let varsum = samples.reduce(0) { $0 + ($1 - mean) * ($1 - mean) }
        return varsum / Double(samples.count)
    }
}

enum LogoColorSampler {
    static func accent(from image: UIImage) -> UIColor? {
        guard let cg = image.cgImage else { return nil }
        let width = 24
        let height = 24
        var buffer = [UInt8](repeating: 0, count: width * height * 4)
        let drawn = buffer.withUnsafeMutableBytes { raw -> Bool in
            guard let ctx = CGContext(
                data: raw.baseAddress,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return false }
            ctx.interpolationQuality = .high
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn else { return nil }

        var buckets: [Int: (r: Double, g: Double, b: Double, w: Double)] = [:]
        var dark = (r: 0.0, g: 0.0, b: 0.0, w: 0.0)
        for i in stride(from: 0, to: buffer.count, by: 4) {
            let a = Double(buffer[i + 3]) / 255
            guard a > 0.35 else { continue }
            let r = Double(buffer[i]) / 255
            let g = Double(buffer[i + 1]) / 255
            let b = Double(buffer[i + 2]) / 255
            let maxc = max(r, g, b)
            let minc = min(r, g, b)
            let sat = maxc == 0 ? 0 : (maxc - minc) / maxc
            let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if luma > 0.88 && sat < 0.18 { continue }
            if luma < 0.12 {
                let weight = a
                dark.r += r * weight
                dark.g += g * weight
                dark.b += b * weight
                dark.w += weight
                continue
            }
            guard sat > 0.16 else { continue }
            var h: CGFloat = 0
            var s: CGFloat = 0
            var v: CGFloat = 0
            UIColor(red: r, green: g, blue: b, alpha: 1).getHue(&h, saturation: &s, brightness: &v, alpha: nil)
            let bucket = Int((h * 18).rounded(.down)) % 18
            let weight = sat * sat * a * (0.4 + 0.6 * v)
            var item = buckets[bucket] ?? (0, 0, 0, 0)
            item.r += r * weight
            item.g += g * weight
            item.b += b * weight
            item.w += weight
            buckets[bucket] = item
        }
        if let best = buckets.max(by: { $0.value.w < $1.value.w }), best.value.w > 0 {
            return UIColor(
                red: best.value.r / best.value.w,
                green: best.value.g / best.value.w,
                blue: best.value.b / best.value.w,
                alpha: 1
            )
        }
        if dark.w > 0 {
            return UIColor(red: dark.r / dark.w, green: dark.g / dark.w, blue: dark.b / dark.w, alpha: 1)
        }
        return nil
    }
}

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
    private let cacheVersion = "LoyaltyLogos-v7"

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
        if let cached = memory[program.id] { return cached }
        let disk = cacheURL(for: program.id)
        if FileManager.default.fileExists(atPath: disk.path),
           let data = try? Data(contentsOf: disk),
           let image = UIImage(data: data),
           pixelWidth(image) >= 64 {
            let trimmed = LogoCropper.trim(image)
            memory[program.id] = trimmed
            return trimmed
        }
        if let bundled = bundledImage(for: program.id) {
            let trimmed = LogoCropper.trim(bundled)
            memory[program.id] = trimmed
            try? trimmed.pngData()?.write(to: disk, options: .atomic)
            return trimmed
        }
        guard let image = await bestRemoteLogo(for: program) else { return nil }
        let trimmed = LogoCropper.trim(image)
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
            guard pixels >= 128 else { continue }
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
            try? FileManager.default.removeItem(at: root.appendingPathComponent("LoyaltyLogos-v6", isDirectory: true))
            didClearStale = true
        }
        let folder = root.appendingPathComponent(cacheVersion, isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("\(id).png")
    }
}

enum LogoCropper {
    static func trim(_ image: UIImage, knockingOut hex: String? = nil) -> UIImage {
        knockoutAndCrop(image, backgroundHex: hex)
    }

    static func knockoutAndCrop(_ image: UIImage, backgroundHex: String? = nil) -> UIImage {
        guard let cg = image.cgImage else { return image }
        let width = cg.width
        let height = cg.height
        guard width > 4, height > 4 else { return image }
        var buffer = [UInt8](repeating: 0, count: width * height * 4)
        let space = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
        let brandRGB = backgroundHex.flatMap(rgb(hex:))
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

            func alpha(_ i: Int) -> Double { Double(bytes[i + 3]) / 255 }
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
            func distance(to brand: (r: Double, g: Double, b: Double), at i: Int) -> Double {
                let r = Double(bytes[i]) / 255
                let g = Double(bytes[i + 1]) / 255
                let b = Double(bytes[i + 2]) / 255
                return hypot(hypot(r - brand.r, g - brand.g), b - brand.b)
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
            let punchBrand = brandRGB.flatMap { brand -> (r: Double, g: Double, b: Double)? in
                guard opaqueCorners.count >= 3 else { return nil }
                let matches = opaqueCorners.filter { distance(to: brand, at: $0) < 0.24 }.count
                return matches >= 3 ? brand : nil
            }

            func isBackdrop(_ i: Int) -> Bool {
                let a = Double(bytes[i + 3]) / 255
                let l = luma(i)
                let s = sat(i)
                let brandHit = punchBrand.map { distance(to: $0, at: i) < 0.22 } ?? false
                return a < 0.08
                    || (l > 0.90 && s < 0.12)
                    || (punchWhite && l > 0.86 && s < 0.18)
                    || (punchBlack && l < 0.14 && s < 0.18)
                    || brandHit
            }

            var visited = [UInt8](repeating: 0, count: width * height)
            var queue = [Int]()
            queue.reserveCapacity(width + height)
            func enqueue(_ x: Int, _ y: Int) {
                guard x >= 0, y >= 0, x < width, y < height else { return }
                let idx = y * width + x
                if visited[idx] == 1 { return }
                visited[idx] = 1
                if isBackdrop(idx * 4) {
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

            var minX = width
            var minY = height
            var maxX = 0
            var maxY = 0
            for y in 0..<height {
                for x in 0..<width {
                    let idx = y * width + x
                    let i = idx * 4
                    if visited[idx] == 1 && isBackdrop(i) {
                        bytes[i] = 0
                        bytes[i + 1] = 0
                        bytes[i + 2] = 0
                        bytes[i + 3] = 0
                    } else if bytes[i + 3] > 20 {
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

    private static func rgb(hex: String) -> (r: Double, g: Double, b: Double)? {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        guard cleaned.count == 6 else { return nil }
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        return (
            Double((int >> 16) & 0xFF) / 255,
            Double((int >> 8) & 0xFF) / 255,
            Double(int & 0xFF) / 255
        )
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

import SwiftUI
import UIKit

/// One downsampled average per track — never live-sampled on the audio clock.
enum ArtworkTintCache {
    private static var cache: [String: UIColor] = [:]
    private static let lock = NSLock()

    static func wash(identity: String, image: UIImage?, colorScheme: ColorScheme) -> Color {
        Color(uiColor: uiWash(identity: identity, image: image, colorScheme: colorScheme))
    }

    static func uiWash(identity: String, image: UIImage?, colorScheme: ColorScheme) -> UIColor {
        let base = averageColor(identity: identity, image: image)
        var hue: CGFloat = 0
        var sat: CGFloat = 0
        var bri: CGFloat = 0
        var alpha: CGFloat = 1
        guard base.getHue(&hue, saturation: &sat, brightness: &bri, alpha: &alpha) else {
            return colorScheme == .dark
                ? UIColor(white: 0.10, alpha: 1)
                : UIColor(red: 0.96, green: 0.95, blue: 0.93, alpha: 1)
        }
        if colorScheme == .dark {
            return UIColor(
                hue: hue,
                saturation: min(0.55, sat * 0.72),
                brightness: max(0.10, min(0.28, bri * 0.32)),
                alpha: 1
            )
        }
        return UIColor(
            hue: hue,
            saturation: min(0.28, sat * 0.38),
            brightness: min(0.97, max(0.86, bri * 1.08 + 0.35)),
            alpha: 1
        )
    }

    static func averageColor(identity: String, image: UIImage?) -> UIColor {
        let key = identity.isEmpty ? "empty" : identity
        lock.lock()
        if let cached = cache[key] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        let computed = downsampleAverage(image) ?? UIColor(white: 0.16, alpha: 1)
        lock.lock()
        cache[key] = computed
        lock.unlock()
        return computed
    }

    private static func downsampleAverage(_ image: UIImage?) -> UIColor? {
        guard let image, let cg = image.cgImage else { return nil }
        let width = 8
        let height = 8
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        guard let ctx = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        ctx.interpolationQuality = .low
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))

        var r = 0
        var g = 0
        var b = 0
        var count = 0
        var i = 0
        while i < pixels.count {
            let a = Int(pixels[i + 3])
            if a > 16 {
                r += Int(pixels[i])
                g += Int(pixels[i + 1])
                b += Int(pixels[i + 2])
                count += 1
            }
            i += 4
        }
        guard count > 0 else { return nil }
        return UIColor(
            red: CGFloat(r) / CGFloat(count) / 255,
            green: CGFloat(g) / CGFloat(count) / 255,
            blue: CGFloat(b) / CGFloat(count) / 255,
            alpha: 1
        )
    }
}

struct PlayerArtworkTintBackground: View {
    let identity: String
    let image: UIImage?
    let colorScheme: ColorScheme

    var body: some View {
        let wash = ArtworkTintCache.wash(identity: identity, image: image, colorScheme: colorScheme)
        ZStack {
            wash.ignoresSafeArea()
            LinearGradient(
                colors: [
                    wash.opacity(1),
                    Color.black.opacity(colorScheme == .dark ? 0.28 : 0.04)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            RadialGradient(
                colors: [
                    Color.white.opacity(colorScheme == .dark ? 0.06 : 0.22),
                    .clear
                ],
                center: .top,
                startRadius: 8,
                endRadius: 420
            )
            .ignoresSafeArea()
        }
        .allowsHitTesting(false)
    }
}

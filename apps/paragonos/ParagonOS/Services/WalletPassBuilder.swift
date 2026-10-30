import CryptoKit
import Foundation
import PassKit
import SwiftUI
import UIKit

enum WalletPassError: LocalizedError {
    case cannotAdd
    case unsigned
    case encoding
    case offline
    case server

    var errorDescription: String? {
        switch self {
        case .cannotAdd:
            return "Ten iPhone nie może teraz dodać kart do Apple Wallet."
        case .unsigned:
            return "Apple Wallet nie przyjął karty. Karta nadal działa w \(Brand.displayName) przy kasie — ten sam kod, pełna jasność."
        case .encoding:
            return "Nie udało się złożyć karty do Apple Wallet."
        case .offline:
            return "Połącz się z internetem, żeby dodać kartę do Apple Wallet. W \(Brand.displayName) karta działa też bez sieci."
        case .server:
            return "Apple Wallet jest chwilowo niedostępny. Spróbuj za chwilę — karta nadal działa w \(Brand.displayName) przy kasie."
        }
    }
}

enum WalletPassBuilder {
    static let passTypeIdentifier = "pass.pl.paragonos.loyalty"

    /// Wallet passes are signed by the ParagonOS server; the signing key never ships in the app.
    static let signingEndpoint = URL(string: "https://estateos.pl/api/paragonos/pass")!

    @MainActor
    static func addablePass(for card: LoyaltyCard, logo: UIImage?) async throws -> PKPass {
        guard PKAddPassesViewController.canAddPasses() else { throw WalletPassError.cannotAdd }
        var request = URLRequest(url: signingEndpoint, timeoutInterval: 20)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try signingRequestBody(for: card, logo: logo)
        let result: (Data, URLResponse)
        do {
            result = try await URLSession.shared.data(for: request)
        } catch let error as URLError where offlineCodes.contains(error.code) {
            throw WalletPassError.offline
        } catch {
            throw WalletPassError.server
        }
        let (data, response) = result
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw WalletPassError.server }
        do {
            return try PKPass(data: data)
        } catch {
            throw WalletPassError.unsigned
        }
    }

    private static let offlineCodes: Set<URLError.Code> = [
        .notConnectedToInternet, .networkConnectionLost, .timedOut,
        .cannotFindHost, .cannotConnectToHost, .dataNotAllowed, .internationalRoamingOff
    ]

    /// What the server needs to build and sign the pass. pass.json itself is assembled server-side.
    @MainActor
    static func signingRequestBody(for card: LoyaltyCard, logo: UIImage?) throws -> Data {
        let style = PassStyle(program: card.program, logo: logo)
        let barcodes = barcodeObjects(for: card).prefix(2).map {
            ["format": $0["format"] ?? "", "message": $0["message"] ?? ""]
        }
        var images: [String: String] = [:]
        for (name, data) in passImages(for: card, logo: logo) {
            images[name] = data.base64EncodedString()
        }
        let object: [String: Any] = [
            "serialNumber": card.id.uuidString,
            "description": String(card.displayName.prefix(64)),
            "memberNumber": String(card.barcodePayload.prefix(64)),
            "holderName": String(card.holderName.trimmingCharacters(in: .whitespacesAndNewlines).prefix(64)),
            "note": String(card.note.prefix(300)),
            "barcodes": Array(barcodes),
            "images": images,
            "style": [
                "foreground": style.foreground,
                "background": style.background,
                "label": style.label,
                "logoText": style.showsLogoText ? String(card.displayName.prefix(40)) : ""
            ]
        ]
        return try JSONSerialization.data(withJSONObject: object)
    }

    @MainActor
    static func passImages(for card: LoyaltyCard, logo: UIImage?) -> [(String, Data)] {
        let program = card.program
        return [
            ("icon.png", passIcon(program: program, logo: logo, size: 58)),
            ("icon@2x.png", passIcon(program: program, logo: logo, size: 116)),
            ("icon@3x.png", passIcon(program: program, logo: logo, size: 174)),
            ("logo.png", PassStyle.logo(program: program, logo: logo, pixels: CGSize(width: 160, height: 50))),
            ("logo@2x.png", PassStyle.logo(program: program, logo: logo, pixels: CGSize(width: 320, height: 100))),
            ("logo@3x.png", PassStyle.logo(program: program, logo: logo, pixels: CGSize(width: 480, height: 150))),
            ("strip.png", PassStyle.metalStrip(program: program, pixels: CGSize(width: 375, height: 123))),
            ("strip@2x.png", PassStyle.metalStrip(program: program, pixels: CGSize(width: 750, height: 246))),
            ("strip@3x.png", PassStyle.metalStrip(program: program, pixels: CGSize(width: 1125, height: 369)))
        ]
    }

    /// Unsigned package, used by tests to check contents. Wallet only accepts the server-signed pass.
    @MainActor
    static func package(for card: LoyaltyCard, logo: UIImage?) throws -> Data {
        let files = [("pass.json", try passJSON(for: card))] + passImages(for: card, logo: logo)
        var manifestObject: [String: String] = [:]
        for (name, data) in files {
            manifestObject[name] = sha1Hex(data)
        }
        let manifest = try JSONSerialization.data(withJSONObject: manifestObject, options: [.sortedKeys])
        return ZipStore.data(files: files + [("manifest.json", manifest)])
    }

    static let groupingIdentifier = "pl.paragonos.app.loyalty"

    static func passObject(for card: LoyaltyCard) -> [String: Any] {
        let style = PassStyle(program: card.program, logo: nil)
        var storeCard: [String: Any] = [
            "primaryFields": [
                ["key": "member", "label": "NUMER KARTY", "value": PassStyle.groupedNumber(card.barcodePayload)]
            ],
            "backFields": [
                ["key": "note", "label": "Notatka", "value": card.note.isEmpty ? "—" : card.note],
                ["key": "app", "label": Brand.displayName, "value": "Karta dodana z \(Brand.displayName)."]
            ]
        ]
        let holder = card.holderName.trimmingCharacters(in: .whitespacesAndNewlines)
        if holder.isEmpty == false {
            storeCard["secondaryFields"] = [["key": "holder", "label": "WŁAŚCICIEL", "value": holder]]
        }
        var pass: [String: Any] = [
            "formatVersion": 1,
            "passTypeIdentifier": passTypeIdentifier,
            "serialNumber": card.id.uuidString,
            "teamIdentifier": Brand.teamID,
            "organizationName": Brand.displayName,
            "groupingIdentifier": groupingIdentifier,
            "description": card.displayName,
            "foregroundColor": style.foreground,
            "backgroundColor": style.background,
            "labelColor": style.label,
            "storeCard": storeCard,
            "barcodes": barcodeObjects(for: card)
        ]
        if style.showsLogoText { pass["logoText"] = card.displayName }
        return pass
    }

    private static func passJSON(for card: LoyaltyCard) throws -> Data {
        try JSONSerialization.data(withJSONObject: passObject(for: card), options: [.prettyPrinted, .sortedKeys])
    }

    static func barcodeObjects(for card: LoyaltyCard) -> [[String: String]] {
        let message = card.barcodePayload
        var items: [[String: String]] = [
            [
                "format": card.barcodeSymbology.pkPassFormat,
                "message": message,
                "messageEncoding": "iso-8859-1",
                "altText": message
            ]
        ]
        if card.barcodeSymbology != .code128, BarcodeSymbology.canEncodeCode128(message) {
            items.append([
                "format": BarcodeSymbology.code128.pkPassFormat,
                "message": message,
                "messageEncoding": "iso-8859-1",
                "altText": message
            ])
        }
        return items
    }

    private static func passIcon(program: LoyaltyProgram, logo: UIImage?, size: CGFloat) -> Data {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = true
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format)
        let image = renderer.image { _ in
            UIColor.white.setFill()
            UIBezierPath(rect: CGRect(x: 0, y: 0, width: size, height: size)).fill()
            if let logo {
                let prepared = PassArtwork.fitted(
                    LogoCropper.trim(logo),
                    in: CGSize(width: size, height: size),
                    padding: size * 0.22
                )
                let origin = CGPoint(x: (size - prepared.size.width) / 2, y: (size - prepared.size.height) / 2)
                prepared.draw(in: CGRect(origin: origin, size: prepared.size))
            } else {
                let text = program.monogram as NSString
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: size * 0.32, weight: .bold),
                    .foregroundColor: UIColor(program.onColor)
                ]
                let textSize = text.size(withAttributes: attrs)
                text.draw(
                    at: CGPoint(x: (size - textSize.width) / 2, y: (size - textSize.height) / 2),
                    withAttributes: attrs
                )
            }
        }
        return image.pngData() ?? Data()
    }

    @MainActor
    static func stripImage(program: LoyaltyProgram, logo: UIImage?, size: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = true
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let onDark = program.brandColor.relativeLuminance <= 0.62
        return renderer.image { _ in
            fillBrandStrip(program: program, size: size)
            let highlight = UIColor.white.withAlphaComponent(onDark ? 0.12 : 0.28)
            highlight.setFill()
            UIRectFill(CGRect(x: 0, y: 0, width: size.width, height: max(1, size.height * 0.008)))
            let face = LoyaltyBrandKit.composeForeground(
                program: program,
                logo: logo,
                size: size,
                placement: .centered,
                onBrandField: true,
                scale: 1
            )
            face.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    private static func fillBrandStrip(program: LoyaltyProgram, size: CGSize) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(program.brandColor).getRed(&r, green: &g, blue: &b, alpha: &a)
        let top = UIColor(
            red: min(1, r * 1.06 + 0.03),
            green: min(1, g * 1.06 + 0.03),
            blue: min(1, b * 1.06 + 0.03),
            alpha: 1
        ).cgColor
        let mid = UIColor(program.brandColor).cgColor
        let bottom = UIColor(
            red: max(0, r * 0.82),
            green: max(0, g * 0.82),
            blue: max(0, b * 0.82),
            alpha: 1
        ).cgColor
        let colors = [top, mid, bottom] as CFArray
        let locations: [CGFloat] = [0, 0.42, 1]
        if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: locations) {
            ctx.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        } else {
            UIColor(program.brandColor).setFill()
            UIRectFill(CGRect(origin: .zero, size: size))
        }
    }

    private static func sha1Hex(_ data: Data) -> String {
        Insecure.SHA1.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

enum PassArtwork {
    static func fitted(_ image: UIImage, in size: CGSize, padding: CGFloat) -> UIImage {
        let box = CGSize(width: max(1, size.width - padding * 2), height: max(1, size.height - padding * 2))
        let scale = min(box.width / max(image.size.width, 1), box.height / max(image.size.height, 1))
        let draw = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = max(image.scale, 1)
        guard draw.width > 1, draw.height > 1 else { return image }
        let renderer = UIGraphicsImageRenderer(size: draw, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: draw))
        }
    }

    /// White or black ring around the original mark so it stays a sticker on the brand field.
    static func halo(_ image: UIImage, color: UIColor, width: CGFloat) -> UIImage {
        let stroke = max(1.2, width)
        let pad = ceil(stroke) + 1
        let canvas = CGSize(width: image.size.width + pad * 2, height: image.size.height + pad * 2)
        guard canvas.width > 1, canvas.height > 1 else { return image }
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = max(image.scale, 1)
        let stamp = tinted(image, color: color)
        let steps = max(20, Int(ceil(stroke * 6)))
        let renderer = UIGraphicsImageRenderer(size: canvas, format: format)
        return renderer.image { _ in
            for i in 0..<steps {
                let t = (CGFloat(i) / CGFloat(steps)) * 2 * .pi
                stamp.draw(at: CGPoint(x: pad + cos(t) * stroke, y: pad + sin(t) * stroke))
            }
            image.draw(at: CGPoint(x: pad, y: pad))
        }
    }

    static func tinted(_ image: UIImage, color: UIColor) -> UIImage {
        guard image.size.width > 1, image.size.height > 1 else { return image }
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = max(image.scale, 1)
        let renderer = UIGraphicsImageRenderer(size: image.size, format: format)
        return renderer.image { _ in
            color.setFill()
            UIRectFill(CGRect(origin: .zero, size: image.size))
            image.draw(in: CGRect(origin: .zero, size: image.size), blendMode: .destinationIn, alpha: 1)
        }
    }

    /// Light original marks (white WOG) get a dark ring; red/blue/color marks get a light ring on dark cards.
    static func strokeInk(for image: UIImage, fieldHex: String) -> UIColor {
        let fieldDark = Color(hex: fieldHex).relativeLuminance <= 0.55
        if isMostlyLightInk(image) {
            return UIColor(white: 0.08, alpha: 1)
        }
        return fieldDark ? .white : UIColor(white: 0.08, alpha: 1)
    }

    static func adapted(_ image: UIImage, onDarkBackground: Bool, backgroundHex: String? = nil, forceWhite: Bool = false) -> UIImage {
        // Never punch brand-colored ink — that destroys red/blue wordmarks (Auchan, Payback).
        let trimmed = LogoCropper.trim(image)
        if forceWhite {
            if opaqueRatio(trimmed) > 0.78 {
                return trimmed
            }
            return whiteTemplate(trimmed)
        }
        let prepared: UIImage = {
            if isColorfulBadge(trimmed) {
                if let hex = backgroundHex, contrastRatio(in: trimmed, againstHex: hex) < 0.18 {
                    return whiteTemplate(trimmed)
                }
                return trimmed
            }
            guard onDarkBackground else {
                if let hex = backgroundHex, contrastRatio(in: trimmed, againstHex: hex) < 0.18 {
                    return whiteTemplate(trimmed)
                }
                return trimmed
            }
            let clashes = backgroundHex.map { colorClashes(trimmed, backgroundHex: $0) } ?? false
            let shares = backgroundHex.map { sharesBackgroundColor(trimmed, backgroundHex: $0) } ?? false
            if shares || clashes {
                return whiteTemplate(trimmed)
            }
            if isMostlyDarkInk(trimmed) { return whiteTemplate(trimmed) }
            if let hex = backgroundHex, contrastRatio(in: trimmed, againstHex: hex) < 0.18 {
                return whiteTemplate(trimmed)
            }
            return trimmed
        }()
        if opaqueRatio(prepared) > 0.04 { return prepared }
        let fallback = whiteTemplate(trimmed)
        return opaqueRatio(fallback) > 0.04 ? fallback : trimmed
    }

    static func opaqueRatio(_ image: UIImage) -> Double {
        guard let cg = image.cgImage else { return 0 }
        let width = 32
        let height = 32
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
            ctx.clear(CGRect(x: 0, y: 0, width: width, height: height))
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard ok else { return 0 }
        var opaque = 0
        for i in stride(from: 0, to: buffer.count, by: 4) {
            if buffer[i + 3] > 24 { opaque += 1 }
        }
        return Double(opaque) / Double(width * height)
    }

    static func contrastRatio(in image: UIImage, againstHex hex: String) -> Double {
        guard let cg = image.cgImage else { return 0 }
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        UIColor(Color(hex: hex)).getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        let width = min(cg.width, 120)
        let height = min(cg.height, 80)
        guard width > 2, height > 2 else { return 0 }
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
        guard ok else { return 0 }
        var contrast = 0.0
        var total = 0.0
        for i in stride(from: 0, to: buffer.count, by: 4) {
            total += 1
            let r = Double(buffer[i]) / 255
            let g = Double(buffer[i + 1]) / 255
            let b = Double(buffer[i + 2]) / 255
            let distance = hypot(hypot(r - Double(br), g - Double(bg)), b - Double(bb))
            if distance > 0.22 { contrast += 1 }
        }
        return total == 0 ? 0 : contrast / total
    }

    /// Contrast of ink only — transparent pixels do not count (wordmark silhouettes).
    static func opaqueContrastRatio(in image: UIImage, againstHex hex: String) -> Double {
        guard let cg = image.cgImage else { return 0 }
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        UIColor(Color(hex: hex)).getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        let width = min(cg.width, 120)
        let height = min(cg.height, 80)
        guard width > 2, height > 2 else { return 0 }
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
            ctx.clear(CGRect(x: 0, y: 0, width: width, height: height))
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard ok else { return 0 }
        var contrast = 0.0
        var ink = 0.0
        for i in stride(from: 0, to: buffer.count, by: 4) {
            let a = Double(buffer[i + 3]) / 255
            guard a > 0.18 else { continue }
            ink += 1
            let r = Double(buffer[i]) / 255
            let g = Double(buffer[i + 1]) / 255
            let b = Double(buffer[i + 2]) / 255
            let distance = hypot(hypot(r - Double(br), g - Double(bg)), b - Double(bb))
            if distance > 0.22 { contrast += 1 }
        }
        return ink == 0 ? 0 : contrast / ink
    }

    /// Bounding box of pixels that differ from the brand field — wordmarks are wide, tiles are square.
    static func contrastingBounds(in image: UIImage, againstHex hex: String) -> CGRect {
        guard let cg = image.cgImage else { return .zero }
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        UIColor(Color(hex: hex)).getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        let width = min(cg.width, 200)
        let height = min(cg.height, 80)
        guard width > 2, height > 2 else { return .zero }
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
        guard ok else { return .zero }
        var minX = width
        var minY = height
        var maxX = 0
        var maxY = 0
        for y in 0..<height {
            for x in 0..<width {
                let i = (y * width + x) * 4
                let r = Double(buffer[i]) / 255
                let g = Double(buffer[i + 1]) / 255
                let b = Double(buffer[i + 2]) / 255
                let distance = hypot(hypot(r - Double(br), g - Double(bg)), b - Double(bb))
                if distance > 0.22 {
                    minX = min(minX, x)
                    minY = min(minY, y)
                    maxX = max(maxX, x)
                    maxY = max(maxY, y)
                }
            }
        }
        guard maxX > minX, maxY > minY else { return .zero }
        let scaleX = image.size.width / CGFloat(width)
        let scaleY = image.size.height / CGFloat(height)
        return CGRect(
            x: CGFloat(minX) * scaleX,
            y: CGFloat(minY) * scaleY,
            width: CGFloat(maxX - minX + 1) * scaleX,
            height: CGFloat(maxY - minY + 1) * scaleY
        )
    }

    private static func whiteTemplate(_ image: UIImage) -> UIImage {
        let size = image.size
        guard size.width > 0, size.height > 0 else { return image }
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        return renderer.image { _ in
            UIColor.white.setFill()
            UIRectFill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size), blendMode: .destinationIn, alpha: 1)
        }
    }

    private static func sharesBackgroundColor(_ image: UIImage, backgroundHex: String) -> Bool {
        guard let cg = image.cgImage else { return false }
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        UIColor(Color(hex: backgroundHex)).getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        let width = 24
        let height = 24
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
        guard ok else { return false }
        var match = 0.0
        var opaque = 0.0
        for i in stride(from: 0, to: buffer.count, by: 4) {
            let a = Double(buffer[i + 3]) / 255
            guard a > 0.2 else { continue }
            opaque += a
            let r = Double(buffer[i]) / 255
            let g = Double(buffer[i + 1]) / 255
            let b = Double(buffer[i + 2]) / 255
            let distance = hypot(hypot(r - Double(br), g - Double(bg)), b - Double(bb))
            if distance < 0.28 { match += a }
        }
        return opaque > 0 && match / opaque > 0.16
    }

    private static func colorClashes(_ image: UIImage, backgroundHex: String) -> Bool {
        guard let accent = LogoColorSampler.accent(from: image) else { return false }
        var lr: CGFloat = 0, lg: CGFloat = 0, lb: CGFloat = 0, la: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        accent.getRed(&lr, green: &lg, blue: &lb, alpha: &la)
        UIColor(Color(hex: backgroundHex)).getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        let distance = hypot(hypot(Double(lr - br), Double(lg - bg)), Double(lb - bb))
        return distance < 0.28
    }

    private static func isColorfulBadge(_ image: UIImage) -> Bool {
        guard let cg = image.cgImage else { return false }
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
        guard ok else { return false }
        var hues = Set<Int>()
        var colored = 0.0
        for i in stride(from: 0, to: buffer.count, by: 4) {
            let a = Double(buffer[i + 3]) / 255
            guard a > 0.2 else { continue }
            let r = Double(buffer[i]) / 255
            let g = Double(buffer[i + 1]) / 255
            let b = Double(buffer[i + 2]) / 255
            let maxc = max(r, g, b)
            let minc = min(r, g, b)
            let sat = maxc == 0 ? 0 : (maxc - minc) / maxc
            guard sat > 0.22 else { continue }
            colored += a
            var h: CGFloat = 0
            UIColor(red: r, green: g, blue: b, alpha: 1).getHue(&h, saturation: nil, brightness: nil, alpha: nil)
            hues.insert(Int((h * 8).rounded(.down)) % 8)
        }
        return hues.count >= 2 && colored > 4
    }

    static func isColorfulMark(_ image: UIImage) -> Bool {
        isColorfulBadge(image)
    }

    private static func isMostlyDarkInk(_ image: UIImage) -> Bool {
        guard let cg = image.cgImage else { return false }
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
        guard ok else { return false }
        var ink = 0.0
        var light = 0.0
        var color = 0.0
        for i in stride(from: 0, to: buffer.count, by: 4) {
            let a = Double(buffer[i + 3]) / 255
            guard a > 0.2 else { continue }
            let r = Double(buffer[i]) / 255
            let g = Double(buffer[i + 1]) / 255
            let b = Double(buffer[i + 2]) / 255
            let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            let sat = max(r, g, b) == 0 ? 0 : (max(r, g, b) - min(r, g, b)) / max(r, g, b)
            if sat > 0.28 { color += a }
            if luma < 0.38 { ink += a }
            if luma > 0.72 { light += a }
        }
        return ink > light * 1.15 && color < ink * 0.85
    }

    static func isMostlyLightInk(_ image: UIImage) -> Bool {
        guard let cg = image.cgImage else { return false }
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
        guard ok else { return false }
        var ink = 0.0
        var light = 0.0
        for i in stride(from: 0, to: buffer.count, by: 4) {
            let a = Double(buffer[i + 3]) / 255
            guard a > 0.2 else { continue }
            let r = Double(buffer[i]) / 255
            let g = Double(buffer[i + 1]) / 255
            let b = Double(buffer[i + 2]) / 255
            let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if luma < 0.38 { ink += a }
            if luma > 0.72 { light += a }
        }
        return light > ink * 1.2 && light > 0.8
    }
}

private struct ColorRGB {
    var r: Int
    var g: Int
    var b: Int

    var css: String { "rgb(\(r), \(g), \(b))" }

    init(r: Int, g: Int, b: Int) {
        self.r = r
        self.g = g
        self.b = b
    }

    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        self.r = Int((int >> 16) & 0xFF)
        self.g = Int((int >> 8) & 0xFF)
        self.b = Int(int & 0xFF)
    }
}

enum ZipStore {
    static func data(files: [(String, Data)]) -> Data {
        var locals = Data()
        var centrals = Data()
        for (name, payload) in files {
            let nameData = Data(name.utf8)
            let crc = crc32(payload)
            let offset = UInt32(locals.count)
            locals.appendUInt32(0x04034b50)
            locals.appendUInt16(20)
            locals.appendUInt16(0)
            locals.appendUInt16(0)
            locals.appendUInt16(0)
            locals.appendUInt16(0)
            locals.appendUInt32(crc)
            locals.appendUInt32(UInt32(payload.count))
            locals.appendUInt32(UInt32(payload.count))
            locals.appendUInt16(UInt16(nameData.count))
            locals.appendUInt16(0)
            locals.append(nameData)
            locals.append(payload)

            centrals.appendUInt32(0x02014b50)
            centrals.appendUInt16(20)
            centrals.appendUInt16(20)
            centrals.appendUInt16(0)
            centrals.appendUInt16(0)
            centrals.appendUInt16(0)
            centrals.appendUInt16(0)
            centrals.appendUInt32(crc)
            centrals.appendUInt32(UInt32(payload.count))
            centrals.appendUInt32(UInt32(payload.count))
            centrals.appendUInt16(UInt16(nameData.count))
            centrals.appendUInt16(0)
            centrals.appendUInt16(0)
            centrals.appendUInt16(0)
            centrals.appendUInt16(0)
            centrals.appendUInt32(0)
            centrals.appendUInt32(offset)
            centrals.append(nameData)
        }
        var result = Data()
        result.append(locals)
        let centralOffset = UInt32(result.count)
        result.append(centrals)
        result.appendUInt32(0x06054b50)
        result.appendUInt16(0)
        result.appendUInt16(0)
        result.appendUInt16(UInt16(files.count))
        result.appendUInt16(UInt16(files.count))
        result.appendUInt32(UInt32(centrals.count))
        result.appendUInt32(centralOffset)
        result.appendUInt16(0)
        return result
    }

    private static func crc32(_ data: Data) -> UInt32 {
        var crc: UInt32 = 0xFFFFFFFF
        for byte in data {
            crc ^= UInt32(byte)
            for _ in 0..<8 {
                let bit = crc & 1
                crc >>= 1
                if bit == 1 {
                    crc ^= 0xEDB88320
                }
            }
        }
        return crc ^ 0xFFFFFFFF
    }
}

private extension Data {
    mutating func appendUInt16(_ value: UInt16) {
        var little = value.littleEndian
        Swift.withUnsafeBytes(of: &little) { append(contentsOf: $0) }
    }

    mutating func appendUInt32(_ value: UInt32) {
        var little = value.littleEndian
        Swift.withUnsafeBytes(of: &little) { append(contentsOf: $0) }
    }
}


/// Apple Wallet look for a loyalty pass: the brand's colour as a deep anodized metal,
/// its real logo on a white plate top-left, the card number large over a brushed strip.
struct PassStyle {
    let foreground: String
    let background: String
    let label: String
    /// Square logos get the program name beside them; wordmarks already say it.
    let showsLogoText: Bool

    init(program: LoyaltyProgram, logo: UIImage?) {
        let base = UIColor(program.brandColor)
        let onDark = program.brandColor.relativeLuminance <= 0.62
        let bg = Self.shade(base, by: onDark ? 0.78 : 0.96)
        let fg = onDark ? UIColor.white : UIColor(white: 0.09, alpha: 1)
        background = Self.rgb(bg)
        foreground = Self.rgb(fg)
        label = Self.rgb(Self.mix(fg, bg, 0.62))
        let mark = logo ?? LoyaltyBrandKit.bundledLogo(for: program.id)
        showsLogoText = mark.map { $0.size.width / max($0.size.height, 1) < 1.7 } ?? true
    }

    static func groupedNumber(_ payload: String) -> String {
        let raw = payload.filter { $0.isNumber || $0.isLetter }
        guard raw.count >= 8 else { return payload.isEmpty ? "—" : payload }
        return stride(from: 0, to: raw.count, by: 4).map { start -> String in
            let from = raw.index(raw.startIndex, offsetBy: start)
            let to = raw.index(from, offsetBy: 4, limitedBy: raw.endIndex) ?? raw.endIndex
            return String(raw[from..<to])
        }.joined(separator: " ")
    }

    /// logo.png: the brand's own logo, crisp, on a white tile (square marks) or capsule (wordmarks).
    @MainActor
    static func logo(program: LoyaltyProgram, logo: UIImage?, pixels: CGSize) -> Data {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 1
        let source = (logo ?? LoyaltyBrandKit.bundledLogo(for: program.id)).map { LogoCropper.trim($0) }
        let image = UIGraphicsImageRenderer(size: pixels, format: format).image { context in
            let cg = context.cgContext
            cg.interpolationQuality = .high
            let h = pixels.height * 0.9
            let y = (pixels.height - h) / 2
            guard let source else {
                let tile = CGRect(x: 0, y: y, width: h, height: h)
                UIColor.white.withAlphaComponent(0.18).setFill()
                UIBezierPath(roundedRect: tile, cornerRadius: h * 0.24).fill()
                let text = program.monogram as NSString
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: h * 0.42, weight: .bold),
                    .foregroundColor: UIColor.white
                ]
                let size = text.size(withAttributes: attrs)
                text.draw(at: CGPoint(x: tile.midX - size.width / 2, y: tile.midY - size.height / 2), withAttributes: attrs)
                return
            }
            let aspect = source.size.width / max(source.size.height, 1)
            let plate: CGRect
            let path: UIBezierPath
            if aspect >= 1.7 {
                let pad = h * 0.2
                let inner = CGSize(width: min(pixels.width - pad * 2, (h - pad * 2) * aspect), height: h - pad * 2)
                plate = CGRect(x: 0, y: y, width: inner.width + pad * 2, height: h)
                path = UIBezierPath(roundedRect: plate, cornerRadius: h / 2)
            } else {
                plate = CGRect(x: 0, y: y, width: h, height: h)
                path = UIBezierPath(roundedRect: plate, cornerRadius: h * 0.24)
            }
            cg.saveGState()
            cg.setShadow(offset: CGSize(width: 0, height: h * 0.03), blur: h * 0.08, color: UIColor.black.withAlphaComponent(0.25).cgColor)
            UIColor.white.setFill()
            path.fill()
            cg.restoreGState()
            path.addClip()
            let fullBleed = aspect < 1.7 && LogoQuality.looksLikeTile(source)
            let inset = fullBleed ? 0 : (aspect >= 1.7 ? h * 0.2 : h * 0.16)
            let box = plate.insetBy(dx: inset, dy: inset)
            let fit = min(box.width / source.size.width, box.height / source.size.height)
            let drawn = CGSize(width: source.size.width * fit, height: source.size.height * fit)
            source.draw(in: CGRect(x: box.midX - drawn.width / 2, y: box.midY - drawn.height / 2, width: drawn.width, height: drawn.height))
        }
        return image.pngData() ?? Data()
    }

    /// strip.png: brushed anodized metal in the brand colour. The number is drawn over it by Wallet.
    static func metalStrip(program: LoyaltyProgram, pixels: CGSize) -> Data {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = true
        format.scale = 1
        let onDark = program.brandColor.relativeLuminance <= 0.62
        let base = UIColor(program.brandColor)
        let bg = shade(base, by: onDark ? 0.78 : 0.96)
        let image = UIGraphicsImageRenderer(size: pixels, format: format).image { context in
            let cg = context.cgContext
            let rect = CGRect(origin: .zero, size: pixels)
            let space = CGColorSpaceCreateDeviceRGB()
            func gradient(_ colors: [UIColor], _ locations: [CGFloat]) -> CGGradient? {
                CGGradient(colorsSpace: space, colors: colors.map(\.cgColor) as CFArray, locations: locations)
            }
            if let g = gradient([shade(base, by: onDark ? 1.0 : 1.06), bg, shade(base, by: onDark ? 0.56 : 0.8)], [0, 0.5, 1]) {
                cg.drawLinearGradient(g, start: .zero, end: CGPoint(x: pixels.width, y: pixels.height), options: [])
            }
            BrushedMetal.image.draw(in: rect, blendMode: .overlay, alpha: 0.34)
            if let bands = gradient(
                [.white.withAlphaComponent(0), .white.withAlphaComponent(0.16), .white.withAlphaComponent(0),
                 .white.withAlphaComponent(0.07), .white.withAlphaComponent(0)],
                [0, 0.22, 0.42, 0.68, 0.9]
            ) {
                cg.drawLinearGradient(bands, start: .zero, end: CGPoint(x: 0, y: pixels.height), options: [])
            }
            if let glow = gradient([.white.withAlphaComponent(0.22), .white.withAlphaComponent(0)], [0, 1]) {
                cg.drawRadialGradient(glow, startCenter: .zero, startRadius: 0, endCenter: .zero,
                                      endRadius: pixels.width * 0.7, options: [])
            }
            UIColor.white.withAlphaComponent(0.32).setFill()
            cg.fill(CGRect(x: 0, y: 0, width: pixels.width, height: max(1, pixels.height * 0.01)))
            UIColor.black.withAlphaComponent(0.28).setFill()
            cg.fill(CGRect(x: 0, y: pixels.height - max(1, pixels.height * 0.012), width: pixels.width, height: max(1, pixels.height * 0.012)))
        }
        return image.pngData() ?? Data()
    }

    private static func shade(_ color: UIColor, by factor: CGFloat) -> UIColor {
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return UIColor(hue: h, saturation: min(1, s * (factor < 1 ? 1.04 : 0.96)), brightness: min(1, b * factor), alpha: 1)
    }

    private static func mix(_ a: UIColor, _ b: UIColor, _ t: CGFloat) -> UIColor {
        var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        a.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
        b.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        return UIColor(red: ar * t + br * (1 - t), green: ag * t + bg * (1 - t), blue: ab * t + bb * (1 - t), alpha: 1)
    }

    private static func rgb(_ color: UIColor) -> String {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        func c(_ v: CGFloat) -> Int { Int((min(1, max(0, v)) * 255).rounded()) }
        return "rgb(\(c(r)), \(c(g)), \(c(b)))"
    }
}

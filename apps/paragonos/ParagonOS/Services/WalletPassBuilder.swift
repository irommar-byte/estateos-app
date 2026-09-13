import CryptoKit
import Foundation
import PassKit
import SwiftUI
import UIKit

enum WalletPassError: LocalizedError {
    case cannotAdd
    case unsigned
    case encoding

    var errorDescription: String? {
        switch self {
        case .cannotAdd:
            return "Ten iPhone nie może teraz dodać kart do Apple Wallet."
        case .unsigned:
            return "Apple Wallet nie przyjął karty. Karta nadal działa w \(Brand.displayName) przy kasie — ten sam kod, pełna jasność."
        case .encoding:
            return "Nie udało się złożyć karty do Apple Wallet."
        }
    }
}

enum WalletPassBuilder {
    static let passTypeIdentifier = "pass.pl.paragonos.loyalty"

    @MainActor
    static func addablePass(for card: LoyaltyCard, logo: UIImage?) throws -> PKPass {
        guard PKAddPassesViewController.canAddPasses() else { throw WalletPassError.cannotAdd }
        guard PassCMSSigner.canSign else { throw WalletPassError.unsigned }
        let zip = try package(for: card, logo: logo)
        do {
            return try PKPass(data: zip)
        } catch {
            throw WalletPassError.unsigned
        }
    }

    @MainActor
    static func package(for card: LoyaltyCard, logo: UIImage?) throws -> Data {
        let program = card.program
        let pass = try passJSON(for: card)
        let icon = passIcon(program: program, logo: logo, size: 58)
        let icon2x = passIcon(program: program, logo: logo, size: 116)
        let icon3x = passIcon(program: program, logo: logo, size: 174)
        let logoImage = passHeaderLockup(size: CGSize(width: 160, height: 50))
        let logo2x = passHeaderLockup(size: CGSize(width: 320, height: 100))
        let logo3x = passHeaderLockup(size: CGSize(width: 480, height: 150))
        let strip = passStrip(program: program, logo: logo, size: CGSize(width: 375, height: 123))
        let strip2x = passStrip(program: program, logo: logo, size: CGSize(width: 750, height: 246))
        let strip3x = passStrip(program: program, logo: logo, size: CGSize(width: 1125, height: 369))
        let files: [(String, Data)] = [
            ("pass.json", pass),
            ("icon.png", icon),
            ("icon@2x.png", icon2x),
            ("icon@3x.png", icon3x),
            ("logo.png", logoImage),
            ("logo@2x.png", logo2x),
            ("logo@3x.png", logo3x),
            ("strip.png", strip),
            ("strip@2x.png", strip2x),
            ("strip@3x.png", strip3x)
        ]
        var manifestObject: [String: String] = [:]
        for (name, data) in files {
            manifestObject[name] = sha1Hex(data)
        }
        let manifest = try JSONSerialization.data(withJSONObject: manifestObject, options: [.sortedKeys])
        var zipFiles = files
        zipFiles.append(("manifest.json", manifest))
        if PassCMSSigner.canSign {
            zipFiles.append(("signature", try PassCMSSigner.signature(for: manifest)))
        }
        return ZipStore.data(files: zipFiles)
    }

    static let groupingIdentifier = "pl.paragonos.app.loyalty"

    static func passObject(for card: LoyaltyCard) -> [String: Any] {
        var storeCard: [String: Any] = [
            "secondaryFields": [
                [
                    "key": "member",
                    "label": "Numer",
                    "value": card.barcodePayload.isEmpty ? "—" : card.barcodePayload
                ]
            ],
            "backFields": [
                [
                    "key": "note",
                    "label": Brand.displayName,
                    "value": card.note.isEmpty ? "Karta lojalnościowa z \(Brand.displayName)." : card.note
                ]
            ]
        ]
        if card.holderName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
            storeCard["auxiliaryFields"] = [
                [
                    "key": "holder",
                    "label": "Właściciel",
                    "value": card.holderName
                ]
            ]
        }
        return [
            "formatVersion": 1,
            "passTypeIdentifier": passTypeIdentifier,
            "serialNumber": card.id.uuidString,
            "teamIdentifier": Brand.teamID,
            "organizationName": Brand.displayName,
            "groupingIdentifier": groupingIdentifier,
            "description": card.displayName,
            "foregroundColor": "rgb(29, 29, 31)",
            "backgroundColor": "rgb(255, 255, 255)",
            "labelColor": "rgb(134, 134, 139)",
            "storeCard": storeCard,
            "barcodes": barcodeObjects(for: card)
        ]
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
            UIColor(program.brandColor).setFill()
            UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: size, height: size), cornerRadius: size * 0.22).fill()
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

    private static func passHeaderLockup(size: CGSize) -> Data {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let image = renderer.image { _ in
            drawThreeDWordmark(in: size)
        }
        return image.pngData() ?? Data()
    }

    private static func drawThreeDWordmark(in canvas: CGSize) {
        let scale = max(canvas.height / 50, 1)
        var fontSize = canvas.height * 0.58
        func chunks() -> (paragon: NSAttributedString, os: NSAttributedString, tm: NSAttributedString) {
            let kern = -0.5 * (fontSize / 24)
            return (
                maskString("Paragon", fontSize: fontSize, kern: kern),
                maskString("OS", fontSize: fontSize, kern: kern),
                maskString("™", fontSize: fontSize * 0.4, kern: 0)
            )
        }
        var parts = chunks()
        while parts.paragon.size().width + parts.os.size().width + parts.tm.size().width > canvas.width, fontSize > 8 {
            fontSize -= 0.5
            parts = chunks()
        }
        let wordHeight = parts.paragon.size().height
        let originY = max(0.5 * scale, (canvas.height - wordHeight) * 0.08)
        var x: CGFloat = 0
        drawBeveled(parts.paragon, at: CGPoint(x: x, y: originY), style: .graphite, scale: scale)
        x += parts.paragon.size().width
        drawBeveled(parts.os, at: CGPoint(x: x, y: originY), style: .osGreen, scale: scale)
        x += parts.os.size().width
        drawBeveled(parts.tm, at: CGPoint(x: x, y: max(0, originY - fontSize * 0.12)), style: .osGreen, scale: scale)
    }

    private static func maskString(_ string: String, fontSize: CGFloat, kern: CGFloat) -> NSAttributedString {
        NSAttributedString(string: string, attributes: [
            .font: UIFont.systemFont(ofSize: fontSize, weight: .bold),
            .foregroundColor: UIColor.white,
            .kern: kern
        ])
    }

    private enum WordmarkBevel {
        case graphite
        case osGreen
    }

    private static func drawBeveled(_ text: NSAttributedString, at origin: CGPoint, style: WordmarkBevel, scale: CGFloat) {
        let textSize = text.size()
        guard textSize.width > 0, textSize.height > 0 else { return }
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: textSize, format: format)
        let mask = renderer.image { _ in
            text.draw(at: .zero)
        }
        mask.draw(at: CGPoint(x: origin.x, y: origin.y + 1.6 * scale), blendMode: .normal, alpha: 0.26)

        let bodyColors: [CGColor]
        switch style {
        case .graphite:
            bodyColors = [
                UIColor(white: 0.42, alpha: 1).cgColor,
                UIColor(white: 0.16, alpha: 1).cgColor,
                UIColor(white: 0.05, alpha: 1).cgColor
            ]
        case .osGreen:
            bodyColors = [
                UIColor(red: 0.78, green: 1, blue: 0.52, alpha: 1).cgColor,
                ParagonMark.fill.cgColor,
                UIColor(red: 0.18, green: 0.48, blue: 0.06, alpha: 1).cgColor
            ]
        }
        let body = renderer.image { ctx in
            guard let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: bodyColors as CFArray,
                locations: [0, 0.46, 1]
            ) else { return }
            ctx.cgContext.drawLinearGradient(
                gradient,
                start: .zero,
                end: CGPoint(x: 0, y: textSize.height),
                options: []
            )
            mask.draw(at: .zero, blendMode: .destinationIn, alpha: 1)
        }
        body.draw(at: origin)

        let highlight = renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: textSize))
            mask.draw(at: .zero, blendMode: .destinationIn, alpha: 1)
        }
        highlight.draw(at: CGPoint(x: origin.x, y: origin.y - 0.7 * scale), blendMode: .plusLighter, alpha: 0.38)

        let depth = renderer.image { ctx in
            UIColor.black.setFill()
            ctx.fill(CGRect(origin: .zero, size: textSize))
            mask.draw(at: .zero, blendMode: .destinationIn, alpha: 1)
        }
        depth.draw(at: CGPoint(x: origin.x, y: origin.y + 0.8 * scale), blendMode: .multiply, alpha: 0.22)

        let specular = renderer.image { ctx in
            guard let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: [
                    UIColor.clear.cgColor,
                    UIColor.white.cgColor,
                    UIColor.clear.cgColor
                ] as CFArray,
                locations: [0.12, 0.36, 0.58]
            ) else { return }
            ctx.cgContext.drawLinearGradient(
                gradient,
                start: .zero,
                end: CGPoint(x: textSize.width, y: 0),
                options: []
            )
            mask.draw(at: .zero, blendMode: .destinationIn, alpha: 1)
        }
        specular.draw(at: origin, blendMode: .plusLighter, alpha: 0.55)
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
            let box = CGSize(width: size.width * 0.70, height: size.height * 0.64)
            if let mark = stripMark(program: program, logo: logo, onDark: onDark) {
                let fitted = PassArtwork.fitted(mark, in: box, padding: size.height * 0.04)
                let origin = CGPoint(
                    x: (size.width - fitted.size.width) / 2,
                    y: (size.height - fitted.size.height) / 2
                )
                fitted.draw(in: CGRect(origin: origin, size: fitted.size))
            } else {
                let text = NSAttributedString(
                    string: program.name,
                    attributes: [
                        .font: UIFont.systemFont(ofSize: size.height * 0.2, weight: .semibold),
                        .foregroundColor: UIColor(program.onColor),
                        .kern: size.height * 0.012
                    ]
                )
                let textSize = text.size()
                text.draw(
                    at: CGPoint(
                        x: (size.width - textSize.width) / 2,
                        y: (size.height - textSize.height) / 2
                    )
                )
            }
        }
    }

    @MainActor
    private static func passStrip(program: LoyaltyProgram, logo: UIImage?, size: CGSize) -> Data {
        stripImage(program: program, logo: logo, size: size).pngData() ?? Data()
    }

    @MainActor
    private static func stripMark(program: LoyaltyProgram, logo: UIImage?, onDark: Bool) -> UIImage? {
        if let logo {
            let adapted = PassArtwork.adapted(
                logo,
                onDarkBackground: onDark,
                backgroundHex: program.cardColorHex
            )
            if PassArtwork.opaqueRatio(adapted) > 0.04 {
                return adapted
            }
        }
        if LoyaltyBrandArt.hasMark(program.id),
           let raster = LoyaltyBrandArt.raster(program: program, dimension: 320) {
            let adapted = PassArtwork.adapted(
                raster,
                onDarkBackground: onDark,
                backgroundHex: program.cardColorHex
            )
            if PassArtwork.opaqueRatio(adapted) > 0.04 {
                return adapted
            }
        }
        return nil
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
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: draw, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: draw))
        }
    }

    static func adapted(_ image: UIImage, onDarkBackground: Bool, backgroundHex: String? = nil, forceWhite: Bool = false) -> UIImage {
        let trimmed = LogoCropper.trim(image, knockingOut: backgroundHex)
        if forceWhite {
            return whiteTemplate(trimmed)
        }
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

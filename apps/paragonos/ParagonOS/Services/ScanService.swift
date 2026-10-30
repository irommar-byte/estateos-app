import Foundation
import ImageIO
import UniformTypeIdentifiers
import UIKit
import Vision

enum ScanService {
    static func analyze(image: UIImage) async throws -> (draft: VoucherDraft, barcodes: [DetectedBarcode]) {
        let recognized = try await recognize(image: image)
        let draft = VoucherParser.parse(lines: recognized.lines, barcodes: recognized.barcodes)
        return (draft, recognized.barcodes)
    }

    static func recognize(image: UIImage) async throws -> (lines: [String], barcodes: [DetectedBarcode]) {
        let prepared = preparedForOCR(image)
        guard let cgImage = prepared.cgImage else {
            return ([], [])
        }
        return try await Task.detached(priority: .utility) {
            try performVision(cgImage: cgImage)
        }.value
    }

    nonisolated private static func performVision(cgImage: CGImage) throws -> (lines: [String], barcodes: [DetectedBarcode]) {
        let textRequest = VNRecognizeTextRequest()
        textRequest.recognitionLevel = .accurate
        textRequest.recognitionLanguages = ["pl-PL", "en-US"]
        textRequest.usesLanguageCorrection = true
        textRequest.minimumTextHeight = 0.008

        let barcodeRequest = VNDetectBarcodesRequest()

        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
        try handler.perform([textRequest, barcodeRequest])

        let observations = (textRequest.results ?? []).sorted { left, right in
            if abs(left.boundingBox.midY - right.boundingBox.midY) > 0.012 {
                return left.boundingBox.midY > right.boundingBox.midY
            }
            return left.boundingBox.minX < right.boundingBox.minX
        }
        let lines = observations.compactMap { observation -> String? in
            observation.topCandidates(3).max(by: { $0.confidence < $1.confidence })?.string
        }
        let barcodes: [DetectedBarcode] = (barcodeRequest.results ?? []).compactMap { observation in
            guard let payload = observation.payloadStringValue, payload.isEmpty == false else { return nil }
            return DetectedBarcode(payload: payload, symbology: map(observation.symbology))
        }
        return (lines, barcodes)
    }

    /// Receipt / ticket photos. HEIC first (same sharpness, much smaller), JPEG fallback.
    /// Family share sends this blob once — participants read the same asset, they do not
    /// each get a second iCloud copy from the owner.
    static func compressPhoto(
        _ image: UIImage,
        maxDimension: CGFloat = 1400,
        quality: CGFloat = 0.62,
        maxBytes: Int = 160_000
    ) -> Data? {
        encodeDocument(image, maxDimension: maxDimension, quality: quality, maxBytes: maxBytes)
    }

    /// Re-encode only when the stored blob is still a camera original (or an older
    /// oversized JPEG). Already-small files stay untouched so we do not generationally
    /// soften text.
    static func recompressStoredPhoto(_ data: Data, maxBytes: Int = 160_000) -> Data {
        guard data.count > maxBytes, let image = UIImage(data: data) else { return data }
        guard let next = compressPhoto(image, maxBytes: maxBytes), next.count < data.count else {
            return data
        }
        return next
    }

    static func compressLoyaltyPhoto(_ image: UIImage) -> Data? {
        compressPhoto(image, maxDimension: 2048, quality: 0.85, maxBytes: 720_000)
    }

    static func storedPhoto(_ image: UIImage) -> UIImage {
        compressPhoto(image).flatMap(UIImage.init(data:)) ?? image
    }

    static func preparedForOCR(_ image: UIImage, maxDimension: CGFloat = 2200) -> UIImage {
        resize(image, maxDimension: maxDimension)
    }

    private static func encodeDocument(
        _ image: UIImage,
        maxDimension: CGFloat,
        quality: CGFloat,
        maxBytes: Int
    ) -> Data? {
        let resized = resize(image, maxDimension: maxDimension)
        if maxBytes <= 320_000, let heic = heicData(resized, quality: quality), heic.count <= maxBytes {
            return heic
        }
        var quality = quality
        var data = heicData(resized, quality: quality) ?? resized.jpegData(compressionQuality: quality)
        let floor: CGFloat = maxBytes > 500_000 ? 0.72 : 0.38
        while let current = data, current.count > maxBytes, quality > floor {
            quality -= 0.06
            data = heicData(resized, quality: quality) ?? resized.jpegData(compressionQuality: quality)
        }
        if let current = data, current.count > maxBytes {
            let tighter = resize(image, maxDimension: min(maxDimension, 1100))
            data = heicData(tighter, quality: 0.5) ?? tighter.jpegData(compressionQuality: 0.48)
        }
        return data
    }

    private static func heicData(_ image: UIImage, quality: CGFloat) -> Data? {
        guard let cgImage = image.cgImage else { return nil }
        let buffer = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            buffer,
            UTType.heic.identifier as CFString,
            1,
            nil
        ) else { return nil }
        CGImageDestinationAddImage(
            destination,
            cgImage,
            [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary
        )
        guard CGImageDestinationFinalize(destination) else { return nil }
        return buffer as Data
    }

    private static func resize(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let size = image.size
        guard size.width > 0, size.height > 0 else { return image }
        let scale = min(1, maxDimension / max(size.width, size.height))
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        if target == size, image.imageOrientation == .up, image.scale == 1 {
            return image
        }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: target, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }

    static func map(_ symbology: VNBarcodeSymbology) -> BarcodeSymbology {
        switch symbology {
        case .qr: return .qr
        case .ean13, .ean8, .upce: return .ean13
        case .pdf417: return .pdf417
        case .aztec: return .aztec
        case .code128, .code39, .code93, .itf14, .i2of5, .codabar: return .code128
        default:
            let raw = symbology.rawValue.lowercased()
            if raw.contains("qr") { return .qr }
            if raw.contains("ean") || raw.contains("upc") { return .ean13 }
            if raw.contains("128") || raw.contains("39") || raw.contains("93") || raw.contains("itf") {
                return .code128
            }
            return .unknown
        }
    }
}

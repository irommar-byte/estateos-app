import Foundation
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

    static func compressPhoto(
        _ image: UIImage,
        maxDimension: CGFloat = 1280,
        quality: CGFloat = 0.58,
        maxBytes: Int = 280_000
    ) -> Data? {
        let resized = resize(image, maxDimension: maxDimension)
        var quality = quality
        var data = resized.jpegData(compressionQuality: quality)
        let floor = maxBytes > 500_000 ? 0.72 : 0.36
        while let current = data, current.count > maxBytes, quality > floor {
            quality -= 0.06
            data = resized.jpegData(compressionQuality: quality)
        }
        if maxBytes <= 320_000, let current = data, current.count > 320_000 {
            data = resize(image, maxDimension: 1024).jpegData(compressionQuality: 0.48)
        }
        return data
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

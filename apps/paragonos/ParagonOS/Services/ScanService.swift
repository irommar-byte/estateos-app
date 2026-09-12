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
        guard let cgImage = image.cgImage else {
            return ([], [])
        }
        let textRequest = VNRecognizeTextRequest()
        textRequest.recognitionLevel = .accurate
        textRequest.recognitionLanguages = ["pl-PL", "en-US"]
        textRequest.usesLanguageCorrection = true

        let barcodeRequest = VNDetectBarcodesRequest()

        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: cgOrientation(image.imageOrientation), options: [:])
        try handler.perform([textRequest, barcodeRequest])

        let lines = (textRequest.results ?? []).flatMap { observation in
            observation.topCandidates(3).map(\.string)
        }
        let barcodes: [DetectedBarcode] = (barcodeRequest.results ?? []).compactMap { observation in
            guard let payload = observation.payloadStringValue, payload.isEmpty == false else { return nil }
            return DetectedBarcode(payload: payload, symbology: map(observation.symbology))
        }
        return (lines, barcodes)
    }

    static func compressPhoto(_ image: UIImage, maxDimension: CGFloat = 1600, quality: CGFloat = 0.72) -> Data? {
        let size = image.size
        guard size.width > 0, size.height > 0 else { return image.jpegData(compressionQuality: quality) }
        let scale = min(1, maxDimension / max(size.width, size.height))
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: target, format: format)
        let rendered = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return rendered.jpegData(compressionQuality: quality)
    }

    static func map(_ symbology: VNBarcodeSymbology) -> BarcodeSymbology {
        switch symbology {
        case .qr: return .qr
        case .ean13: return .ean13
        case .pdf417: return .pdf417
        case .aztec: return .aztec
        case .code128: return .code128
        default:
            if symbology.rawValue.lowercased().contains("128") { return .code128 }
            if symbology.rawValue.lowercased().contains("qr") { return .qr }
            return .unknown
        }
    }

    private static func cgOrientation(_ orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch orientation {
        case .up: return .up
        case .down: return .down
        case .left: return .left
        case .right: return .right
        case .upMirrored: return .upMirrored
        case .downMirrored: return .downMirrored
        case .leftMirrored: return .leftMirrored
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }
}

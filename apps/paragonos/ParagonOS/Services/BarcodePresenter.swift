import CoreImage
import UIKit

enum BarcodePresenter {
    static func image(payload: String, symbology: BarcodeSymbology, width: CGFloat = 800, height: CGFloat = 220) -> UIImage? {
        let trimmed = payload.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.isEmpty == false else { return nil }
        if symbology == .qr || looksLikeQR(trimmed) {
            return ciImage("CIQRCodeGenerator", ["inputMessage": Data(trimmed.utf8)], width: width, height: width)
        }
        if let code128 = ciImage("CICode128BarcodeGenerator", ["inputMessage": Data(trimmed.utf8)], width: width, height: height) {
            return code128
        }
        return ciImage("CIPDF417BarcodeGenerator", ["inputMessage": Data(trimmed.utf8)], width: width, height: height)
    }

    private static func looksLikeQR(_ payload: String) -> Bool {
        payload.lowercased().contains("http") || payload.contains("\n")
    }

    private static func ciImage(_ name: String, _ params: [String: Any], width: CGFloat, height: CGFloat) -> UIImage? {
        guard let filter = CIFilter(name: name) else { return nil }
        params.forEach { filter.setValue($0.value, forKey: $0.key) }
        guard let output = filter.outputImage else { return nil }
        let scaleX = width / output.extent.width
        let scaleY = height / output.extent.height
        let scaled = output.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
        let context = CIContext(options: [.useSoftwareRenderer: false])
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

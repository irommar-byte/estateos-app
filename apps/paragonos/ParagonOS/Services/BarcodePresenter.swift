import CoreImage
import UIKit

enum BarcodePresenter {
    static func image(payload: String, symbology: BarcodeSymbology, width: CGFloat = 800, height: CGFloat = 220) -> UIImage? {
        let trimmed = payload.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.isEmpty == false else { return nil }
        switch symbology {
        case .qr:
            return ciImage("CIQRCodeGenerator", ["inputMessage": Data(trimmed.utf8)], width: width, height: width)
        case .aztec:
            return ciImage("CIAztecCodeGenerator", ["inputMessage": Data(trimmed.utf8)], width: width, height: width)
        case .pdf417:
            return ciImage("CIPDF417BarcodeGenerator", ["inputMessage": Data(trimmed.utf8)], width: width, height: height)
        case .ean13, .code128, .unknown:
            if let code128 = ciImage("CICode128BarcodeGenerator", ["inputMessage": Data(trimmed.utf8)], width: width, height: height) {
                return code128
            }
            return ciImage("CIQRCodeGenerator", ["inputMessage": Data(trimmed.utf8)], width: width, height: width)
        }
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

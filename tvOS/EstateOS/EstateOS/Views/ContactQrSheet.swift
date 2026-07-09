import SwiftUI
import CoreImage.CIFilterBuiltins

struct ContactQrSheet: View {
    let offer: EstateOffer
    private let context = CIContext()
    private let filter = CIFilter.qrCodeGenerator()

    var body: some View {
        VStack(spacing: 18) {
            Text("Scan to open on iPhone")
                .font(.title2.bold())
            if let image = qrImage {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 380, height: 380)
                    .padding()
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
            }
            Text(deepLink)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(40)
        .background(
            LinearGradient(
                colors: [Color.black, Color(red: 0.05, green: 0.08, blue: 0.12)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        )
        .eosGlass(cornerRadius: 32, opacity: 0.35)
        .padding(48)
    }

    private var deepLink: String {
        "https://estateos.pl/oferta/\(offer.id)"
    }

    private var qrImage: UIImage? {
        filter.setValue(Data(deepLink.utf8), forKey: "inputMessage")
        guard let outputImage = filter.outputImage else { return nil }
        let scaled = outputImage.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        guard let cgimg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgimg)
    }
}

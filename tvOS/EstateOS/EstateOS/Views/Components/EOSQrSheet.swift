import SwiftUI
import CoreImage.CIFilterBuiltins

struct EOSQrSheet: View {
    let title: String
    let subtitle: String
    let urlString: String
    var footnote: String? = nil

    private let context = CIContext()
    private let filter = CIFilter.qrCodeGenerator()

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.black, Color(red: 0.05, green: 0.08, blue: 0.12)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 24) {
                Text(title)
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .multilineTextAlignment(.center)

                Text(subtitle)
                    .font(.title3)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 720)

                if let image = qrImage {
                    Image(uiImage: image)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(minWidth: 280, minHeight: 280)
                        .frame(maxWidth: 420, maxHeight: 420)
                        .padding(24)
                        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(.white))
                        .accessibilityLabel("Kod QR do otwarcia na iPhonie")
                }

                Text(urlString)
                    .font(.caption.monospaced())
                    .foregroundStyle(.tertiary)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 640)

                if let footnote {
                    Text(footnote)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 640)
                }
            }
            .padding(56)
        }
    }

    private var qrImage: UIImage? {
        filter.setValue(Data(urlString.utf8), forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 14, y: 14))
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
